/**
 * 脸谱生成任务引擎（issue 450 E1；双卷画像 issue 455；issue 467 / ADR-0194 入保库）：
 * 生成与面板生命周期解耦——模块级单例，关面板转后台继续、重启从断点续跑（已完成批次不重烧 AI）。
 *
 * 持久化（467）：people-jobs.json 明文文件退役——每个任务条目落进该联系人的**保库记录**
 * （SafeNote.kind='people' 的 job 段，见 safe-store.ts），与人物卡 / 聊天仓同一条 .enc；
 * 每批 AI 采集完成后原子落盘（updateNotePayload 覆盖同一密文镜像）。
 * **隐私口径（ADR-0194 取代 ADR-0191 §2）**：任务数据只进加密库——批内对话行、消息原文一律不落盘
 * （只落批元数据、已完成批的提炼结果、双卷画像 / 时间线成品、互动统计聚合与消息集指纹），
 * 且现在连同提炼产物一起进了密文。
 *
 * 断点续跑判定（466 / ADR-0197 决策 5）：指纹 = 组装素材的**内容哈希**（条数 + 逐条 ts|归属|文本
 * 链式哈希）。resume(talker) 重读聊天仓（保库记录 store 段）重算指纹：一致 → chunkMessages
 * 确定性重切（跳过已完成批）→ 续跑；漂移 → 任务判废（status error），提示删除后重新生成。
 * 落盘兼容（issue 455）：旧版 in-flight job 的单卷 `portrait` 字段读入视作 `person`。
 *
 * 上锁协作暂停（ADR-0194 决策 5）：订阅 encrypt:unlock-changed——任意路径上锁即 pauseJobs()
 * （当前批完成后停，批级断点保留）；解锁后 kick() 续跑。引擎运行全程要求共锁保险库处于解锁态。
 *
 * 分工口径：引擎只负责跑到 status done 并把 BuildFace 等价产物挂在 job 上；
 * 人物卡写回（PeopleStore / ImportRecord / 面板刷新）由 ui 层（E2）订阅 done 完成。
 */
import { createAI } from '../core/ai';
import { onDomainEvent } from '../core/domain-bus';
import { tryGetSettings } from '../core/settings-provider';
import type { ExternalToolCallbacks } from '../core/external-tool';
import { ENCRYPT_UNLOCK_CHANGED_CHANNEL } from '../encrypt/data';
import { getPeopleSafeStore, type PeopleSafeStore } from './safe-store';
import {
  abortPrepSession,
  applyPrepProgress,
  buildPrepSpec,
  classifyPrepFailure,
  clearPrepControl,
  collectPrepInfo,
  currentPrepSession,
  newPrepProgress,
  prepAllDone,
  prepMediaTotals,
  prepStageLine,
  prepPhaseLabel,
  readPrepSidecars,
  resetPrepForTests,
  startPrepSession,
  writePrepControl,
  type PrepProgress,
} from './prep';
import {
  buildBondPrompt,
  buildChroniclePrompt,
  buildPersonPrompt,
  buildProfileNote,
  chunkMetaOf,
  chunkMessages,
  evenlySample,
  extractBatch,
  mergeBatches,
  sampleWarnOf,
  toPortraitMaterial,
  DEFAULTS,
  MATERIAL_LIMITS,
  type AskLLM,
  type BatchExtract,
  type ChunkMeta,
  type ChunkOptions,
  type DigestChunk,
  type MergedMaterial,
  type MaterialCounts,
} from './digest';
import { mergeWithOld, planIncremental } from './incremental';
import { buildMediaNote } from './media';
import { buildStatsNote, type InsightsSummary } from './insights';
import { computeStats } from './stats';
import { PeopleStore } from './data';
import {
  applyImageMapToMsgs,
  applyVoiceToMsgs,
  normalizeOptionsFromSettings,
  storeStatsOf,
  storeToUnified,
  type StoreContact,
} from './datasource';
import type {
  ContactStats,
  FaceDigest,
  FaceEvent,
  InterestItem,
  MomentItem,
  PersonProfile,
  QuoteItem,
  ThreadItem,
  UnifiedMessage,
} from './types';

// ---------------- 类型 ----------------

export type JobStatus = 'running' | 'paused' | 'interrupted' | 'done' | 'error';
/**
 * 任务阶段：preprocess（469 工具段：媒体导出→派生档→图片关联→语音转写，词表与工具
 * [bz-p].phase 同源）→ chunked → extracting → person（其人）→ bond（我们）→ chronicle（时间线）→ done
 */
export type JobStage = 'preprocess' | 'chunked' | 'extracting' | 'person' | 'bond' | 'chronicle' | 'done';

/** 批元数据（无对话原文；人可读的进度与续跑校验都用它） */
export type JobChunkMeta = ChunkMeta;

/**
 * 生成任务记录（people-jobs.json 队列元素）。
 * 排队未跑 / 暂停 / 中断统一 status 'paused' | 'interrupted'（可续跑态）；done 后产物挂 job 上，
 * people.json 写回由 ui 层订阅完成。
 */
export interface PersonJob {
  talker: string;
  name: string;
  mode: 'full' | 'incremental';
  fileLabel: string;
  status: JobStatus;
  stage: JobStage;
  /** 消息集指纹：全量时间线消息条数（样本警示等人类可读口径） */
  msgCount: number;
  /** 消息集指纹：组装素材内容哈希（466 / ADR-0197 决策 5；续跑校验——内容变即判废，条数不变也判得出） */
  contentHash: string;
  /** 切批参数（缺省即 digest.DEFAULTS；续跑按存储值重切，不随设置漂移） */
  chunkOpts?: { maxChars: number; maxCount: number; maxBatches: number };
  /** 批元数据快照（无对话原文） */
  chunks: JobChunkMeta[];
  /** 已完成批数 = results.length */
  batchesDone: number;
  /** 已完成批的提炼结果（素材级，可落盘） */
  results: BatchExtract[];
  /** 卷一《其人》成品（issue 455；旧落盘字段 portrait 在 resumeJobs 读入时映射到此） */
  person?: string;
  /** 卷二《我们》成品（issue 455） */
  bond?: string;
  chronicle?: string;
  /** 合并去重后的全量事件（随手记并入由 ui 层写回时处理） */
  events?: FaceEvent[];
  quotes?: QuoteItem[];
  /** 成文素材：特质 / 场景 / 兴趣 / 未竟（抽样后口径）+ 喂双卷的三段说明 */
  material?: {
    traits: string[];
    moments: MomentItem[];
    /** 兴趣信号（抽样后口径，issue 455） */
    interests?: InterestItem[];
    /** 未竟之事（抽样后口径，issue 455） */
    threads?: ThreadItem[];
    mediaNote?: string;
    statsNote?: string;
    /** 手动档案文本段（buildProfileNote 产出，排队时定稿；issue 455） */
    profileNote?: string;
  };
  /** 互动统计聚合（导入记录 stats 口径；聚合数字不含原文） */
  stats?: ContactStats;
  /**
   * 工具段进度（469 / ADR-0196 决策 2、4；纯元数据无原文）。存在 = 该任务带 prep 段；
   * donePhases 即断点账本（「已完成段」），重启续跑据此判定工具是否还需起进程——
   * prep 本身幂等（产物在即跳过、voice.json 即转写水位），进程没了重起只补缺口。
   */
  prep?: PrepProgress;
  /** 导入记录元数据（ui 层落 ImportRecord 所需；messageCount = 实际进提炼的条数） */
  importRecord?: { fileLabel: string; skippedCount: number; messageCount: number; timeFrom: string; timeTo: string };
  error?: string;
  /** 最新进度文案（切批说明 / 逐批 / 成文；切批后立刻可算） */
  message?: string;
  startedAt: string;
  updatedAt: string;
}

/** people-jobs.json 根结构 */
export interface JobsData {
  version: 1;
  queue: PersonJob[];
}

export function emptyJobsData(): JobsData {
  return { version: 1, queue: [] };
}

/**
 * 生成目标（ui GenTarget 同形）。**msgs 必须是全量时间线消息**（storeToUnified(store.msgs)）——
 * 断点续跑要重读聊天仓校验指纹并重推导提炼集，这是判定成立的前提。
 */
export interface JobTarget {
  talker: string;
  name: string;
  msgs: UnifiedMessage[];
  /** 全形态计数（数据源路径 = chat.json 全量口径）→ 导入记录 stats */
  kindCounts?: Record<string, number>;
  /** 被过滤的非文本 / 空消息条数（导入记录 skippedCount 口径） */
  skippedCount?: number;
  /** 导入记录的 file 标注 */
  fileLabel: string;
  /** 聊天仓侧写互动统计汇总（issue 449）→ 互动统计叙述段 */
  insights?: InsightsSummary;
  /** 手动档案（issue 455）：转档案段进两卷 prompt（缺省回落 PeopleStore 人物卡现有档案） */
  profile?: PersonProfile;
  /** 全量月度消息密度（issue 455，stats.monthly 口径）→ 互动统计叙述段尾的「消息密度」；
   *  缺省不写密度段。注意引擎增量模式自算的 stats 只有新切片，不能当全量密度用，故由入参显式携带。 */
  monthly?: Array<[string, number]>;
}

export interface JobStartOptions {
  /**
   * 本批目标统一模式：'auto'（缺省）按 planIncremental 判 full / incremental / skip；
   * 'full' 强制全量重画；'incremental' 强制走增量（提炼集仍按 planIncremental 推导，skip 则跳过）。
   */
  mode?: 'full' | 'incremental' | 'auto';
  /** 切批参数（缺省即 digest.DEFAULTS） */
  chunkOpts?: ChunkOptions;
  /** 单批 AI 调用失败的重试上限（缺省 DEFAULT_MAX_RETRIES；0 = 不重试，测试用） */
  maxRetries?: number;
  /** 重试退避等待（缺省真实定时器；测试注入 no-op，避免空等） */
  sleep?: (ms: number) => Promise<void>;
  /** AI 依赖注入（digest 同款；测试用假 ask。缺省 createAI()：提炼 .json / 画像 .chat 通道） */
  askExtract?: AskLLM;
  askPortrait?: AskLLM;
  /**
   * 增量合并的旧脸谱引用覆盖（仅本次内存运行生效；断点续跑一律重读 PeopleStore 现有 digest——同源）。
   * 缺省读 PeopleStore 里该人物现有 digest。
   */
  oldOf?: (t: JobTarget) => FaceDigest | undefined;
}

export interface JobResumeOptions {
  /** AI 依赖注入（重启后 resumeJobs 重建引擎时注入；缺省 createAI()） */
  askExtract?: AskLLM;
  askPortrait?: AskLLM;
}

/** 引擎快照（subscribe 推送 / snapshot() 读取；queue 为深拷贝并附带展示用派生字段） */
export interface JobsSnapshot {
  queue: JobView[];
  /** 正在运行的任务下标（空闲 = -1） */
  currentIndex: number;
  running: boolean;
}

/** 快照里的任务视图 = 持久化字段 + 不落盘的展示派生字段（队列位置 / 总批数，供进度块直用） */
export type JobView = PersonJob & {
  batchesTotal: number;
  /** 队列内位置（1 起） */
  queueIndex: number;
  /** 队列总任务数 */
  queueTotal: number;
};

// ---------------- 持久化（保库记录的 job 段；引擎外经 PeopleSafeStore 串行写） ----------------

export class JobStore {
  private readonly app: unknown;

  constructor(app: unknown) {
    this.app = app;
    void this.app;
  }

  /**
   * 读全队列：各保库记录的 job 段按 startedAt 组装（引擎拾起顺序与旧文件数组序等价——
   * 同人至多一任务，跨人按开始时间先后）。上锁期返回空队列（无明文可读；引擎此时也已暂停）。
   */
  async read(): Promise<JobsData> {
    const safe = await getPeopleSafeStore();
    if (!safe.unlocked) return emptyJobsData();
    const all = await safe.readAll();
    const queue = [...all.values()]
      .map((r) => r.job)
      .filter((j): j is PersonJob => !!j)
      .sort(
        (a, b) =>
          (a.startedAt || '').localeCompare(b.startedAt || '') || (a.updatedAt || '').localeCompare(b.updatedAt || '')
      );
    return { version: 1, queue };
  }

  /**
   * 整队列对账写回（引擎是本会话唯一写方）：队列里有的任务按 talker 写进对应记录的 job 段；
   * 记录里有而队列里没有的任务摘除（done 清队 / 删除任务）。未变零重写。
   * 未解锁抛错（persist 侧只告警不阻断——内存队列不丢，解锁后下一 checkpoint 补落）。
   */
  async write(data: JobsData): Promise<void> {
    const safe = await getPeopleSafeStore();
    if (!safe.unlocked) throw new Error('未解锁，无法保存任务');
    const all = await safe.readAll();
    const want = new Map<string, PersonJob>();
    for (const j of data.queue) if (j?.talker) want.set(String(j.talker), j);
    for (const [talker, rec] of all) {
      const job = want.get(talker) ?? null;
      if (JSON.stringify(rec.job ?? null) === JSON.stringify(job)) continue; // 未变零重写（批间checkpoint 大多数只动一人）
      await safe.write(talker, (r) => {
        r.job = job;
      });
    }
    for (const [talker, job] of want) {
      if (all.has(talker)) continue;
      // 任务先于记录存在理论不达（任务必由聊天仓素材发起）——落最小骨架防丢
      await safe.write(talker, (r) => {
        r.job = job;
      });
    }
  }
}

// ---------------- 引擎状态（模块级单例） ----------------

interface EngineState {
  app: unknown;
  store: JobStore;
  /** 共锁保库记录读写器（素材重读 / 上锁判定 / job 落盘都走它） */
  safe: PeopleSafeStore | null;
  queue: PersonJob[];
  /** 最近一次 startJobs / resumeJobs 注入的 AI 依赖（缺省 createAI()） */
  injected: { askExtract?: AskLLM; askPortrait?: AskLLM } | null;
  /** 批级重试参数（startJobs 注入；缺省 DEFAULT_MAX_RETRIES + 真实退避） */
  retry: RetryPolicy;
  runningJob: string | null;
  pauseRequested: boolean;
  /**
   * 工具段暂停闸（469 协作式暂停）：prep 段运行中收到 pauseJobs（用户 / 上锁）时，
   * pauseJobs 写控制文件让进程待命并触发本闸——runJob 从「等 prep 终结」的 await 里
   * 醒来先落 paused；恢复时写 resume 控制文件并复用待命进程继续等。
   */
  prepGate: (() => void) | null;
}

/** 批级重试策略：失败后按 RETRY_BACKOFF_MS 逐档退避再试（网络抖动 / 限流自愈） */
interface RetryPolicy {
  maxRetries: number;
  sleep: (ms: number) => Promise<void>;
}

/** 缺省重试上限 = 2（即单批最多 3 次 AI 尝试）——issue 453：超大量任务不能因单批抖动整任务作废 */
export const DEFAULT_MAX_RETRIES = 2;

/** 退避梯度（毫秒）：第 1 次重试等 1s，第 2 次等 3s；超出档位沿用末档 */
const RETRY_BACKOFF_MS = [1000, 3000];

function realSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 用户取消（AbortError）不重试——重试是给可自愈失败用的，不是给主动收手用的 */
function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

let st: EngineState | null = null;
let runPromise: Promise<void> | null = null;
const subs = new Set<(s: JobsSnapshot) => void>();

/** 指纹漂移判废文案（冻结：issue 450 口径，ui 直接透出） */
export const DRIFT_ERROR = '消息集已变化（导入过新数据），请删除任务后重新生成';

/**
 * 消息集内容哈希指纹（466 / ADR-0197 决策 5）：对组装素材全量链式哈希（条数 + 逐条 ts|归属|文本）。
 * 取代旧「条数 + 末条派生键」——upsert 让「条数不变、内容变了」成为常态（转写 / 描述回写升级），
 * 旧指纹察觉不到会静默续跑旧素材；内容哈希**条数不变也能判出**，中间条目变了同样判得出。
 */
export function fingerprintOf(msgs: UnifiedMessage[]): { msgCount: number; contentHash: string } {
  let h = 0x811c9dc5;
  const mix = (s: string): void => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  mix(`n:${msgs.length};`);
  for (const m of msgs) mix(`${m.ts}|${m.isSender ? 1 : 0}|${m.text}\n`);
  return { msgCount: msgs.length, contentHash: (h >>> 0).toString(36) };
}

function nowIso(): string {
  return new Date().toISOString();
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 数据根（vault 外；工具段的工作目录与旁路表所在。未配置返回空串） */
function dataRootOf(): string {
  return String(tryGetSettings()?.peopleDataDir ?? '').trim();
}

let lastPrepEmit = 0;
/** prep 段高频进度节流（工具每条媒体吐一次 [bz-p]——1631 条级的事件流不逐帧全量推快照） */
function throttledEmit(): void {
  const now = Date.now();
  if (now - lastPrepEmit < 400) return;
  lastPrepEmit = now;
  emit();
}

/** job.prep 防御性归一（旧落盘 / 外部改动的坏结构不炸引擎） */
function prepOf(job: PersonJob): PrepProgress | null {
  const p = job.prep;
  if (!p || typeof p !== 'object') return null;
  if (!Array.isArray(p.donePhases)) p.donePhases = [];
  if (!p.counts || typeof p.counts !== 'object') p.counts = {};
  return p;
}

// ---------------- 进度文案（issue 450 口径冻结） ----------------

/** 切批说明：`消息 20773 条 → 35 批（每批 ≤400 条 · ≤12000 字），共 38 次 AI 调用`（issue 455 起成文 = 其人 + 我们 + 时间线 3 次） */
function chunkedMessage(msgCount: number, batchCount: number, opts: Required<ChunkOptions>): string {
  return `消息 ${msgCount} 条 → ${batchCount} 批（每批 ≤${opts.maxCount} 条 · ≤${opts.maxChars} 字），共 ${batchCount + 3} 次 AI 调用`;
}

/** 抽样说明：`消息 91234 条 → 300 批超上限，均匀抽样 60 批（覆盖 … 全时段，首尾必保，未抽中的批次不送 AI）` */
function sampledMessage(msgCount: number, allCount: number, kept: number, spanFrom: string, spanTo: string): string {
  return `消息 ${msgCount} 条 → ${allCount} 批超上限，均匀抽样 ${kept} 批（覆盖 ${spanFrom} ~ ${spanTo} 全时段，首尾必保，未抽中的批次不送 AI）`;
}

/** 逐批：`第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条` */
function batchMessage(i: number, total: number, c: ChunkMeta): string {
  return `第 ${i}/${total} 批 · ${c.from} ~ ${c.to} · ${c.count} 条`;
}

/** 成文：`素材采集完成：事件 214 · 原话 63 · 场景 88 · 特质 41 → 正在生成《其人》`（issue 455 双卷口径） */
function materialMessage(c: MaterialCounts): string {
  return `素材采集完成：事件 ${c.events} · 原话 ${c.quotes} · 场景 ${c.moments} · 特质 ${c.traits} → 正在生成《其人》`;
}

/** 批失败重试中：`第 30/47 批失败（<原因>）——正在重试 1/2…` */
function batchRetryMessage(i: number, total: number, attempt: number, maxRetries: number, err: string): string {
  return `第 ${i + 1}/${total} 批失败（${err}）——正在重试 ${attempt}/${maxRetries}…`;
}

/**
 * 批失败终局（issue 453）：一行说清「已完成批次保留、可续跑」；具体错误与「继续生成」
 * 动作由进度块的错误行 / 按钮承担，不再叠第二份说明（455 评审：精简显示）。
 */
function batchFailMessage(i: number, total: number, done: number, err: string): string {
  void err;
  return `第 ${i + 1}/${total} 批提炼失败（已完成 ${done} 批保留，可从失败批续跑）`;
}

// ---------------- 快照 / 订阅 ----------------

export function snapshot(): JobsSnapshot {
  if (!st) return { queue: [], currentIndex: -1, running: false };
  const currentIndex = st.queue.findIndex((j) => j.status === 'running');
  const total = st.queue.length;
  const queue = st.queue.map((j, i) => ({
    ...(JSON.parse(JSON.stringify(j)) as PersonJob),
    batchesTotal: j.chunks.length,
    queueIndex: i + 1,
    queueTotal: total,
  }));
  return { queue, currentIndex, running: currentIndex >= 0 };
}

/** 进度订阅（引擎每次落盘 / 阶段推进时推送快照）；返回退订函数。已启动时立即推一次当前态。 */
export function subscribe(fn: (s: JobsSnapshot) => void): () => void {
  subs.add(fn);
  if (st) fn(snapshot());
  return () => subs.delete(fn);
}

function emit(): void {
  const snap = snapshot();
  for (const fn of subs) {
    try {
      fn(snap);
    } catch {
      /* 订阅方渲染异常不反噬引擎 */
    }
  }
}

/** 整队列原子落盘（写失败只告警不阻断：批内结果仍在内存，下一 checkpoint 会再试） */
async function persist(): Promise<void> {
  if (!st) return;
  try {
    await st.store.write({ version: 1, queue: st.queue });
  } catch (e) {
    console.warn('[people] 任务进度落盘失败:', e);
  }
}

// ---------------- 启动 / 排队 ----------------

/**
 * 导入记录元数据（落 ImportRecord 所需）。新建与复用两条路径共用同一口径——
 * 否则「续跑」任务写回的导入记录会缺条数 / 跨度。
 */
function importRecordOf(t: JobTarget, digestMsgs: UnifiedMessage[]): NonNullable<PersonJob['importRecord']> {
  return {
    fileLabel: t.fileLabel,
    skippedCount: t.skippedCount ?? 0,
    messageCount: digestMsgs.length,
    timeFrom: new Date(t.msgs[0].ts).toISOString(),
    timeTo: new Date(t.msgs[t.msgs.length - 1].ts).toISOString(),
  };
}

/**
 * 复用判定（issue 453）：旧任务的已完成批次能不能接上本次目标。
 * 三项全同才算接得上——**指纹**（聊天仓没动过）/ **模式**（提炼集口径一致）/**切批参数**
 * （重切批边界一致，否则已完成批次对不上号）。只要没成果或已 done，就没有可继承的东西。
 */
function reusableJob(
  prev: PersonJob,
  fp: { msgCount: number; contentHash: string },
  mode: 'full' | 'incremental',
  opts: Required<ChunkOptions>
): boolean {
  if (prev.status === 'done' || prev.batchesDone <= 0) return false;
  if (prev.msgCount !== fp.msgCount || prev.contentHash !== fp.contentHash) return false;
  if (prev.mode !== mode) return false;
  const po = { ...DEFAULTS, ...prev.chunkOpts };
  return po.maxChars === opts.maxChars && po.maxCount === opts.maxCount && po.maxBatches === opts.maxBatches;
}

/**
 * 上锁协作暂停（ADR-0194 决策 5）：订阅共锁保险库的解锁态广播（本会话装一次）——
 * 任意路径上锁（面板「立即上锁」/ 锁屏 / 安全模式）→ pauseJobs()，当前批完成后停，
 * 批级断点保留、绝不带着明文继续吐 AI；解锁 → kick() 从断点续跑。
 */
let lockWired = false;
function wireLock(): void {
  if (lockWired) return;
  lockWired = true;
  onDomainEvent<{ unlocked: boolean }>(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
    if (evt?.unlocked === false) pauseJobs();
    else if (evt?.unlocked === true) kick();
  });
}

/** 引擎可跑判定：已启动 && 未请求暂停 && 共锁保险库处于解锁态 */
function runnable(): boolean {
  return !!st && !st.pauseRequested && !!st.safe?.unlocked;
}

/**
 * 排队生成（多人顺序跑）：逐人建任务（预切批元数据 + 进度说明）→ 立即返回，
 * 引擎后台顺序执行；每批完成原子落盘。返回排队 / 跳过 / **续跑**名单
 * （skip = 无新消息或无可提炼文本；resumed = 接了上次没跑完的任务，已完成批次不重烧）。
 * 想等整批跑完：`await startJobs(...); await whenIdle();`
 * 上锁期调用：全部目标记跳过（面板解锁门禁保证正常路径不会走到这里）。
 */
export async function startJobs(
  app: unknown,
  targets: JobTarget[],
  opts: JobStartOptions = {}
): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }> {
  if (!st) {
    st = {
      app,
      store: new JobStore(app),
      safe: null,
      queue: [],
      injected: null,
      retry: { maxRetries: DEFAULT_MAX_RETRIES, sleep: realSleep },
      runningJob: null,
      pauseRequested: false,
      prepGate: null,
    };
  }
  st.app = app;
  st.store = new JobStore(app);
  st.safe = await getPeopleSafeStore();
  wireLock();
  if (!st.safe.unlocked) {
    return { queued: [], skipped: targets.map((t) => t.name || t.talker), resumed: [] };
  }
  st.injected = opts.askExtract || opts.askPortrait ? { askExtract: opts.askExtract, askPortrait: opts.askPortrait } : null;
  // 重试策略：只在显式传入时覆盖（不传 = 沿用当前，缺省 DEFAULT_MAX_RETRIES + 真实退避）
  if (opts.maxRetries !== undefined) st.retry.maxRetries = opts.maxRetries;
  if (opts.sleep) st.retry.sleep = opts.sleep;
  const people = new PeopleStore(app);
  const entries = await people.list();
  const queued: string[] = [];
  const skipped: string[] = [];
  const resumed: string[] = [];
  const chunkFull: Required<ChunkOptions> = { ...DEFAULTS, ...opts.chunkOpts };
  for (const t of targets) {
    const label = t.name || t.talker;
    if (!t.msgs.length) {
      skipped.push(label);
      continue;
    }
    if (st.runningJob === t.talker) {
      skipped.push(label); // 正在跑的同人不重复排队
      continue;
    }
    const existing = entries.find((p) => p.id === t.talker);
    // 提炼集推导（auto 按增量计划；强制模式也用计划定提炼集，skip 照跳）
    let effective: 'full' | 'incremental';
    let digestMsgs: UnifiedMessage[];
    if (opts.mode === 'full') {
      effective = 'full';
      digestMsgs = t.msgs;
    } else {
      const plan = planIncremental(t.msgs, existing);
      if (plan.mode === 'skip' || !plan.msgs.length) {
        skipped.push(label);
        continue;
      }
      effective = opts.mode === 'incremental' ? 'incremental' : plan.mode === 'full' ? 'full' : 'incremental';
      digestMsgs = plan.msgs;
    }
    // 预切批（确定性；对话行只留内存，落盘只存元数据）
    const all = chunkMessages(digestMsgs, { ...chunkFull, maxBatches: Number.MAX_SAFE_INTEGER });
    if (!all.length) {
      skipped.push(label);
      continue;
    }
    const sampled = all.length > chunkFull.maxBatches;
    const chunks = sampled ? evenlySample(all, chunkFull.maxBatches) : all;
    const fp = fingerprintOf(t.msgs);
    const stats = computeStats(t.msgs, t.kindCounts ?? {});
    const mediaNote = buildMediaNote({
      voiceCount: stats.voiceCount ?? 0,
      voiceTotalSec: stats.voiceTotalSec ?? 0,
      imageCount: stats.imageCount ?? 0,
    });
    const now = nowIso();
    const prev = st.queue.find((j) => j.talker === t.talker);
    st.queue = st.queue.filter((j) => j.talker !== t.talker);
    const importRecord = importRecordOf(t, digestMsgs);
    const noteMaterial = {
      mediaNote: mediaNote || undefined,
      statsNote: t.insights ? buildStatsNote(t.insights, t.monthly) || undefined : undefined,
      // 手动档案段（issue 455）：入参优先，回落人物卡现有档案；排队时定稿（与 statsNote 同一语义）
      profileNote: buildProfileNote(t.profile ?? existing?.profile) || undefined,
    };
    // 续跑而非重烧（issue 453 主修）：同人 + 聊天仓未变 + 模式与切批参数一致 + 有已完成批次
    // ⇒ 复用旧任务对象，保留 results / batchesDone（error / interrupted 后重新点「画脸谱」
    // 走的正是这条——超大量人物唯一跑得完的方式；重建 = 从第 1 批重烧 AI）。
    if (prev && reusableJob(prev, fp, effective, chunkFull)) {
      Object.assign(prev, {
        name: t.name,
        fileLabel: t.fileLabel,
        importRecord,
        stats,
        material: { ...(prev.material ?? { traits: [], moments: [] }), ...noteMaterial },
        message: `继续生成：已完成 ${prev.batchesDone}/${prev.chunks.length} 批`,
        status: 'paused' as JobStatus,
        error: undefined,
        updatedAt: now,
      });
      st.queue.push(prev);
      queued.push(label);
      resumed.push(label);
      continue;
    }
    st.queue.push({
      talker: t.talker,
      name: t.name,
      mode: effective,
      fileLabel: t.fileLabel,
      status: 'paused', // 排队待跑（与用户暂停同态：runner 按序拾起）
      stage: 'chunked',
      msgCount: fp.msgCount,
      contentHash: fp.contentHash,
      chunkOpts: chunkFull,
      chunks: chunks.map(chunkMetaOf),
      batchesDone: 0,
      results: [],
      material: {
        traits: [],
        moments: [],
        ...noteMaterial,
      },
      stats,
      importRecord,
      message: sampled
        ? sampledMessage(t.msgs.length, all.length, chunks.length, all[0].from, all[all.length - 1].to)
        : chunkedMessage(t.msgs.length, chunks.length, chunkFull),
      startedAt: now,
      updatedAt: now,
    });
    queued.push(label);
  }
  if (queued.length) {
    await persist();
    emit();
  }
  kick();
  return { queued, skipped, resumed };
}

/**
 * 启动扫描（面板首开时调一次，解锁门禁之后）：从保库记录的 job 段重建队列，
 * 把上次崩溃遗留的 running 标为 interrupted（出「继续生成」），不自动续跑。
 * 本会话已启动过引擎时直接返回（不覆盖运行中的内存队列——重复调用安全）。
 * 上锁期调用：不动引擎单例（等解锁后面板重试——st 保持未建，队列不会被空数据覆盖）。
 */
export async function resumeJobs(app: unknown, ai: JobResumeOptions = {}): Promise<void> {
  if (st) {
    st.app = app;
    st.safe = st.safe ?? (await getPeopleSafeStore());
    return;
  }
  const safe = await getPeopleSafeStore();
  if (!safe.unlocked) return; // 上锁期不建引擎（门禁保证面板路径先解锁；此处兜底）
  const store = new JobStore(app);
  const data = await store.read();
  const queue = Array.isArray(data?.queue) ? data.queue : [];
  let dirty = false;
  for (const j of queue) {
    if (!j || typeof j !== 'object') continue;
    if (!Array.isArray(j.results)) j.results = [];
    if (!Array.isArray(j.chunks)) j.chunks = [];
    // 落盘兼容（issue 455）：旧版单卷字段 portrait 读入视作 person——已缓存批次照常复用，
    // runJob 从《其人》阶段起重画双卷。映射发生即标记重写，把旧字段从盘上迁掉。
    const legacy = (j as { portrait?: unknown }).portrait;
    if (!j.person && typeof legacy === 'string' && legacy) {
      j.person = legacy;
      dirty = true;
    }
    if (j.status === 'running') {
      j.status = 'interrupted';
      j.message = '上次未完成，可从断点继续';
      j.updatedAt = nowIso();
      dirty = true;
    }
  }
  st = {
    app,
    store,
    safe,
    queue,
    injected: ai.askExtract || ai.askPortrait ? ai : null,
    retry: { maxRetries: DEFAULT_MAX_RETRIES, sleep: realSleep },
    runningJob: null,
    pauseRequested: false,
    prepGate: null,
  };
  wireLock();
  runPromise = null;
  if (dirty) await store.write({ version: 1, queue });
  emit();
}

/**
 * 从断点继续指定人物（paused / interrupted 态；排队中任务按序拾起）。返回是否受理。
 * issue 451 放宽：**除漂移判废外的 error 也受理**——AI 调用类失败（超时 / 画像为空）按
 * job.batchesDone 从断点续跑，已付费批次不重烧（runJob 本就从已完成批之后起循环）。
 * 漂移判废（DRIFT_ERROR）是终局，仍不受理——消息集已变，续跑必然再判废。
 */
export function resume(talker: string): boolean {
  if (!st || !st.safe?.unlocked) return false; // 上锁期不受理（解锁后 UI 重试 / kick 自续）
  const job = st.queue.find((j) => j.talker === talker);
  if (!job) return false;
  if (job.status === 'error' && job.error === DRIFT_ERROR) return false;
  if (job.status !== 'paused' && job.status !== 'interrupted' && job.status !== 'error') return false;
  job.status = 'paused';
  job.error = undefined;
  job.updatedAt = nowIso();
  void persist().then(emit);
  kick();
  return true;
}

/**
 * 暂停：当前批完成后停下（成文阶段的画像 / 时间线调用照常收尾），队列不再拾起后续任务。
 * 工具段（preprocess）运行中收到暂停 = 协作式让行（ADR-0196 决策 3）：写数据根
 * `.bz-face/control.json` {action:"pause"} 让进程在本条媒体后待命（不硬杀——模型冷加载
 * 按分钟计），并触发 prepGate 唤醒 runJob 先落 paused；恢复时写 resume 复用同一进程。
 * 上锁走本函数（wireLock → pauseJobs）——工具段上锁同样让行而非杀进程。
 */
export function pauseJobs(): void {
  if (!st) return;
  st.pauseRequested = true;
  const engine = st;
  const job = engine.runningJob ? engine.queue.find((j) => j.talker === engine.runningJob) : null;
  if (job && job.status === 'running' && job.stage === 'preprocess') {
    const dataRoot = dataRootOf();
    if (dataRoot) void writePrepControl(dataRoot, 'pause');
    engine.prepGate?.();
  }
}

/** 删除任务（运行中的也删：AI 调用作废、prep 进程杀掉留状态，不再落盘、不再出 done 事件）；落盘完成后 resolve */
export async function removeJob(talker: string): Promise<boolean> {
  if (!st) return false;
  const before = st.queue.length;
  st.queue = st.queue.filter((j) => j.talker !== talker);
  if (st.runningJob === talker) {
    abortPrepSession(talker); // 中断语义（ADR-0196）：杀进程留状态，产物幂等续
    st.prepGate?.();
    st.runningJob = null;
  }
  if (st.queue.length < before) {
    await persist();
    emit();
    return true;
  }
  return false;
}

/**
 * 重试 prep 失败项（469 失败分流：单条媒体 / 语音失败计 failed 继续，进度块给「重试失败项」）：
 * 清掉 prep 断点账本让工具段重跑（工具幂等——已成功的产物在即跳过，只补失败项），AI 段
 * 已完成的批次照常保留。返回是否受理。
 */
export function retryPrepFailures(talker: string): boolean {
  if (!st || !st.safe?.unlocked) return false;
  const job = st.queue.find((j) => j.talker === talker);
  if (!job || job.status === 'running' || job.status === 'done') return false;
  const prep = prepOf(job);
  if (!prep || prep.failed <= 0) return false;
  prep.donePhases = []; // 重跑 prep：幂等只补失败项
  job.status = 'paused';
  job.error = undefined;
  job.updatedAt = nowIso();
  void persist().then(emit);
  kick();
  return true;
}

/** 等当前队列跑空（引擎空闲即 resolve；从未启动过则立即 resolve） */
export function whenIdle(): Promise<void> {
  return runPromise ?? Promise.resolve();
}

// ---------------- 执行 ----------------

function kick(): Promise<void> {
  if (!st || runPromise) return runPromise ?? Promise.resolve();
  runPromise = runQueue().finally(() => {
    runPromise = null;
    if (st) st.pauseRequested = false;
  });
  return runPromise;
}

async function runQueue(): Promise<void> {
  for (;;) {
    if (!st || !runnable()) break; // 暂停请求 / 共锁保险库上锁（ADR-0194）都停在这里
    const job = st.queue.find((j) => j.status === 'paused');
    if (!job) break;
    await runJob(job);
  }
  if (st) st.pauseRequested = false;
}

/** 运行中任务被 removeJob 移除后立即收手（不落盘、不再消耗 AI） */
function gone(job: PersonJob): boolean {
  return !st || st.queue.indexOf(job) < 0;
}

// ---------------- 工具段 prep（issue 469 / ADR-0196 决策 1、3、7） ----------------

/** prep 进程的协议回调（[bz-step]/[bz-p]/[bz-info] → job 进度；段完成即落盘断点账本） */
function prepCallbacks(job: PersonJob): ExternalToolCallbacks {
  return {
    onStep: (t) => {
      job.message = t;
      throttledEmit();
    },
    onProgress: (phase, pct) => {
      if (job.prep) applyPrepProgress(job.prep, phase, pct);
      throttledEmit();
    },
    onInfo: (data) => {
      const prep = job.prep;
      if (!prep) return;
      const before = prep.donePhases.length;
      if (!collectPrepInfo(prep, data)) return;
      if (prep.paused) {
        job.message = typeof data.note === 'string' && data.note.trim() ? data.note.trim() : '已请求暂停——这一条做完就让行';
      } else if (prep.donePhases.length > before) {
        // 段完成：账本落盘（断点）+ 阶段行文案推进
        job.message = prepStageLine(prep);
        void persist();
      }
      emit();
    },
    onResult: () => {}, // [bz-result] 由 PrepSession 记账进终态，这里不用
  };
}

/** prep 段的设置下发面（462 外部工具组 + AI 面板转写组 → 468 CLI 参数） */
function buildPrepSpecFromSettings(job: PersonJob, dataRoot: string) {
  const s = (tryGetSettings() ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
  return buildPrepSpec({
    dataRoot,
    contact: job.talker,
    asrEngine: str(s.asrEngine),
    asrModel: str(s.asrWhisperModel),
    src: str(s.peopleWxAccountDir),
    python: str(s.pythonPath),
    ffmpeg: str(s.ffmpegPath),
  });
}

/**
 * 工具段（469 / ADR-0196 决策 1、3、4、7）：跑 `bz-face prep` 四段。
 *   - 零媒体联系人自动跳过全段（决策 9）；donePhases 齐四段 = 已完成，续跑不再起进程。
 *   - 暂停 = 协作式让行：pauseJobs 写控制文件并触发 prepGate，本函数从「等进程终结」的
 *     await 醒来落 paused——进程待命不退出，恢复时复用（模型冷加载不白付）。
 *   - 失败分流（决策 7）：[bz-result]{ok:false} = 密钥 / 解密类硬失败，整链停给中文原因；
 *     failed>0 = 单条媒体 / 语音失败计账继续（进度块给「重试失败项」，重跑 prep 只补缺口）。
 * 返回 'skipped' | 'ok' | 'halted'（halted = runJob 立即返回，finish 已落状态）。
 */
async function runPrepStage(
  job: PersonJob,
  finish: (patch: Partial<PersonJob>) => Promise<void>,
  store: StoreContact | null
): Promise<'skipped' | 'ok' | 'halted'> {
  const totals = prepMediaTotals(store?.kindCounts, store?.stats);
  if (!totals) return 'skipped'; // 零媒体：不为 0 张图起一次进程（决策 9）
  const prep = prepOf(job);
  if (prep && prepAllDone(prep)) return 'skipped'; // 断点：prep 已齐段
  if (!job.prep) job.prep = newPrepProgress(totals);

  const dataRoot = dataRootOf();
  if (!dataRoot) {
    await finish({ status: 'error', error: '数据根未配置——媒体导出与语音转写没有可跑的目录', message: '数据根未配置' });
    return 'halted';
  }

  job.stage = 'preprocess';
  job.message = `预处理：${prepPhaseLabel('media')}、${prepPhaseLabel('transcribe')}…`;
  await persist();
  emit();

  // 待命进程复用（暂停后恢复）或起新进程；起跑前写 resume 清掉陈旧 pause 指令
  const existing = currentPrepSession();
  const session = existing && existing.talker === job.talker ? existing : startPrepSession(job.talker, buildPrepSpecFromSettings(job, dataRoot), prepCallbacks(job));
  await writePrepControl(dataRoot, 'resume');

  // 等进程终结，或暂停请求先到（协作式让行：进程待命，runJob 先落 paused）
  let gateFired = false;
  const gate = new Promise<undefined>((r) => {
    st!.prepGate = () => {
      gateFired = true;
      r(undefined);
    };
  });
  const settled = await Promise.race([session.done, gate]);
  st!.prepGate = null;
  if (gateFired || !settled) {
    await finish({ status: 'paused', message: `已暂停 · ${prepStageLine(job.prep)}` });
    return 'halted';
  }

  // 终结分流（[bz-result] 是成果权威；stopped 优先——与 core/external-tool 同口径）
  const { outcome, result } = settled;
  if (outcome.stopped) {
    // 中断（删除任务 / 换人跑）：杀进程留状态——产物幂等，续跑只补缺口
    await finish({ status: 'paused', message: '预处理已中止——已完成的产物保留，可从断点继续' });
    return 'halted';
  }
  if (result && result.ok === false) {
    // 密钥 / 解密类硬失败（工具预检 [bz-result]{ok:false,error}）：整链停给中文原因
    const msg = typeof result.error === 'string' && String(result.error).trim() ? String(result.error).trim() : '预处理失败：工具报错，没有给出原因';
    await finish({ status: 'error', error: msg, message: msg });
    return 'halted';
  }
  if (result && result.stopped === true) {
    // 工具收到 stop 控制指令自己退的（控制文件被外部写 stop）：等同暂停，产物保留
    await finish({ status: 'paused', message: '预处理已停止——已完成的产物保留，可从断点继续' });
    return 'halted';
  }
  if (!outcome.ok || !result || result.ok !== true) {
    const classified = classifyPrepFailure(outcome);
    await finish({ status: 'error', error: classified.message, message: classified.message });
    return 'halted';
  }
  const failed = Number(result.failed);
  if (Number.isFinite(failed) && failed > 0 && job.prep) job.prep.failed = failed;
  clearPrepControl(dataRoot); // 终态收尾：残留的 pause 会让下一次 prep 起跑即待命
  return 'ok';
}

/**
 * prep 产物合并进聊天仓（ADR-0197 决策 4：vault 的唯一写者是插件；幂等靶向升级）——
 * voice.json（转写）与 image_map.json（图片↔消息关联）→ 保库记录 store 段的派生 text/img
 * 字段，走 PeopleSafeStore.write 串行链；旁路表文件保留作兜底（readContactBundle extras
 * 口径不变）。同 sid 重合并不重复（同键同值不计数）。470 图片描述段可复用同一入口。
 * 返回升级条数；无产物 / 上锁返回 null。
 */
export async function mergePrepArtifactsIntoStore(
  safe: PeopleSafeStore,
  talker: string,
  dataRoot: string,
  opts?: { previewVoice?: boolean }
): Promise<{ voice: number; images: number } | null> {
  if (!safe.unlocked) return null;
  const side = readPrepSidecars(dataRoot, talker);
  if (!side || (!side.voice.length && !side.imageMap.length)) return null;
  const previewVoice = opts?.previewVoice ?? normalizeOptionsFromSettings().previewVoice;
  const counts = { voice: 0, images: 0 };
  await safe.write(talker, (rec) => {
    counts.voice = applyVoiceToMsgs(rec.store.msgs, side.voice, { previewVoice });
    counts.images = applyImageMapToMsgs(rec.store.msgs, side.imageMap);
    if (counts.voice + counts.images > 0) {
      rec.store.stats = storeStatsOf(rec.store.msgs); // 时间线变多 → 统计重算（口径单源 storeStatsOf）
      rec.store.updatedAt = new Date().toISOString();
    }
  });
  return counts;
}

async function runJob(job: PersonJob): Promise<void> {
  const asks = asksOf();
  st!.runningJob = job.talker;
  job.status = 'running';
  job.error = undefined;
  job.updatedAt = nowIso();
  await persist();
  emit();
  const finish = async (patch: Partial<PersonJob>): Promise<void> => {
    Object.assign(job, patch, { updatedAt: nowIso() });
    await persist();
    emit();
  };
  try {
    // 1. 读保库记录的聊天仓段（合并前快照）+ 外部漂移粗校验：烧过批（AI 已付费）的素材
    //    先验指纹，别为一份已经对不上的素材白跑几十分钟工具段
    const safe = st!.safe;
    if (!safe?.unlocked) return; // 上锁竞态：runQueue 下一轮自会停，任务保持原态
    const storeBefore = (await safe.read(job.talker))?.store ?? null;
    if (gone(job)) return;
    const fp0 = fingerprintOf(storeToUnified(storeBefore?.msgs ?? []));
    const externalDrift = fp0.msgCount !== job.msgCount || fp0.contentHash !== job.contentHash;
    if (externalDrift && job.batchesDone > 0) {
      await finish({ status: 'error', error: DRIFT_ERROR, message: DRIFT_ERROR });
      return;
    }

    // 2. 工具段 prep（469 / ADR-0196 决策 1）：媒体导出→派生档→图片关联→语音转写。
    //    零媒体联系人自动跳过（决策 9）；暂停 = 协作式让行；硬失败整链停；单条失败计账继续。
    const prepState = await runPrepStage(job, finish, storeBefore);
    if (prepState === 'halted') return; // 暂停 / 硬失败（finish 已落状态）
    if (prepState === 'ok') {
      // prep 产物合并进聊天仓（ADR-0197 决策 4：插件是唯一写入者；幂等靶向升级）
      const merged = await mergePrepArtifactsIntoStore(safe, job.talker, dataRootOf());
      if (gone(job)) return;
      if (merged && merged.voice + merged.images > 0) {
        job.message = `预处理完成${job.prep?.failed ? `（失败 ${job.prep.failed} 条，可用「重试失败项」补齐）` : ''}，开始组装素材…`;
      }
    }

    // 3. 重读聊天仓 + 指纹判定（prep 合并把转写 / 图片关联升级进 text——指纹在合并后算）。
    //    判废只认「外部漂移且烧过批」（上面已拦）；此处的指纹变化只能来自本任务自己的
    //    prep 合并（AI 未烧批时还可能是中途导入的新素材）——预期内的素材升级，刷新落盘值继续。
    const contact = (await safe.read(job.talker))?.store;
    if (gone(job)) return;
    const bucketMsgs = contact ? storeToUnified(contact.msgs) : [];
    const fp = fingerprintOf(bucketMsgs);
    const drifted = fp.msgCount !== job.msgCount || fp.contentHash !== job.contentHash;
    const refresh = drifted;

    // 4. 提炼集重推导（与 startJobs 同判定：bucket + 人物卡未变 ⇒ 结果确定）
    const existing = (await new PeopleStore(st!.app).list()).find((p) => p.id === job.talker);
    if (gone(job)) return;
    let digestMsgs: UnifiedMessage[];
    if (job.mode === 'full') {
      digestMsgs = bucketMsgs;
    } else {
      const plan = planIncremental(bucketMsgs, existing);
      if (plan.mode === 'skip' || !plan.msgs.length) {
        await finish({ status: 'error', error: '没有可提炼的新消息，请删除任务后重新生成', message: '没有可提炼的新消息' });
        return;
      }
      digestMsgs = plan.msgs;
    }

    // 5. 确定性重切批（与落盘批元数据比对；不一致同判漂移——素材升级重切（refresh）除外，
    //    那是本任务 prep 合并的预期结果，旧批元数据整体作废重切）
    const optsC: Required<ChunkOptions> = { ...DEFAULTS, ...job.chunkOpts };
    const all = chunkMessages(digestMsgs, { ...optsC, maxBatches: Number.MAX_SAFE_INTEGER });
    if (!all.length) {
      await finish({ status: 'error', error: '没有可提炼的文本消息', message: '没有可提炼的文本消息' });
      return;
    }
    const sampled = all.length > optsC.maxBatches;
    const chunks: DigestChunk[] = sampled ? evenlySample(all, optsC.maxBatches) : all;
    const metas = chunks.map(chunkMetaOf);
    if (!refresh && job.chunks.length && JSON.stringify(job.chunks) !== JSON.stringify(metas)) {
      await finish({ status: 'error', error: DRIFT_ERROR, message: DRIFT_ERROR });
      return;
    }
    job.chunks = metas;
    if (refresh) {
      // 指纹刷新（469）：prep 合并升级 / 首跑即见新素材——把落盘值对齐当前聊天仓，
      // 之后批级断点续跑的校验以升级后的素材为准
      job.msgCount = fp.msgCount;
      job.contentHash = fp.contentHash;
      job.stats = computeStats(bucketMsgs, contact?.kindCounts ?? {});
      job.material = {
        ...(job.material ?? { traits: [], moments: [] }),
        mediaNote:
          buildMediaNote({
            voiceCount: job.stats.voiceCount ?? 0,
            voiceTotalSec: job.stats.voiceTotalSec ?? 0,
            imageCount: job.stats.imageCount ?? 0,
          }) || undefined,
      };
      if (bucketMsgs.length) {
        job.importRecord = {
          fileLabel: job.fileLabel,
          skippedCount: job.importRecord?.skippedCount ?? 0,
          messageCount: digestMsgs.length,
          timeFrom: new Date(bucketMsgs[0].ts).toISOString(),
          timeTo: new Date(bucketMsgs[bucketMsgs.length - 1].ts).toISOString(),
        };
      }
    }

    // 6. 逐批采集（断点：跳过前 batchesDone 批，results 已存）
    job.stage = 'extracting';
    const total = chunks.length;
    for (let i = job.batchesDone; i < total; i++) {
      if (st!.pauseRequested) {
        await finish({ status: 'paused', message: `已暂停（${job.batchesDone}/${total} 批）` });
        return;
      }
      if (gone(job)) return;
      const c = chunks[i];
      job.message = batchMessage(i + 1, total, c);
      emit(); // 批开始只推快照；落盘粒度 = 批完成
      // 批级重试（issue 453）：单批 AI 失败不再直接作废整个任务——抖动 / 限流按梯度退避再试，
      // 重试期间推快照让用户看见「它在自愈」。退避等待里响应暂停（转 paused，批次断点保留）。
      let result!: BatchExtract;
      let attempt = 0;
      for (;;) {
        try {
          result = await extractBatch(asks.extract, c, job.name);
          break;
        } catch (e) {
          if (gone(job)) return;
          const err = errorMessage(e);
          if (isAbortError(e) || attempt >= st!.retry.maxRetries) {
            await finish({ status: 'error', error: err, message: batchFailMessage(i, total, job.batchesDone, err) });
            return;
          }
          attempt += 1;
          job.message = batchRetryMessage(i, total, attempt, st!.retry.maxRetries, err);
          emit();
          await st!.retry.sleep(RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)]);
          if (gone(job)) return;
          if (st!.pauseRequested) {
            await finish({ status: 'paused', message: `已暂停（${job.batchesDone}/${total} 批）` });
            return;
          }
        }
      }
      if (gone(job)) return;
      job.results.push(result);
      job.batchesDone = i + 1;
      await persist();
      emit();
    }

    // 5. 素材合并（digest / incremental 单源）→ 卷一《其人》
    let merged: MergedMaterial = mergeBatches(job.results);
    if (job.mode === 'incremental') merged = mergeWithOld(merged, existing?.digest);
    if (gone(job)) return;
    const counts: MaterialCounts = {
      events: merged.events.length,
      quotes: merged.quotes.length,
      moments: merged.moments.length,
      traits: merged.traits.length,
    };
    const material = toPortraitMaterial(merged, {
      mediaNote: job.material?.mediaNote,
      statsNote: job.material?.statsNote,
      profileNote: job.material?.profileNote,
      sampleEvents: job.mode === 'incremental',
    });
    // 样本警示（issue 455）：按全量时间线消息数判（不是已提炼切片），两卷共用同一段
    const sampleWarn = sampleWarnOf(job.msgCount);
    await finish({
      stage: 'person',
      message: materialMessage(counts),
    });

    let person = '';
    try {
      person = (await asks.portrait(buildPersonPrompt(job.name, material, sampleWarn))).trim();
    } catch (e) {
      await finish({ status: 'error', error: errorMessage(e), message: `《其人》生成失败：${errorMessage(e)}` });
      return;
    }
    if (gone(job)) return;
    if (!person) {
      await finish({ status: 'error', error: '卷一《其人》生成为空', message: '卷一《其人》生成为空' });
      return;
    }
    job.person = person;
    job.updatedAt = nowIso();
    await persist();
    emit();

    // 5.5 卷二《我们》（必产：空则判 error，批次成果保留可续跑）
    await finish({ stage: 'bond', message: '《其人》完成，正在生成《我们》…' });
    let bond = '';
    try {
      bond = (await asks.portrait(buildBondPrompt(job.name, material, sampleWarn))).trim();
    } catch (e) {
      await finish({ status: 'error', error: errorMessage(e), message: `《我们》生成失败：${errorMessage(e)}` });
      return;
    }
    if (gone(job)) return;
    if (!bond) {
      await finish({ status: 'error', error: '卷二《我们》生成为空', message: '卷二《我们》生成为空' });
      return;
    }
    job.bond = bond;
    job.updatedAt = nowIso();
    await persist();
    emit();

    // 6. 关系时间线（次要产物：失败不阻断）
    await finish({ stage: 'chronicle', message: '双卷完成，正在生成关系时间线…' });
    let chronicle = '';
    if (merged.events.length) {
      try {
        chronicle = (
          await asks.portrait(
            buildChroniclePrompt(job.name, evenlySample(merged.events, MATERIAL_LIMITS.chronicle), material.mediaNote, material.statsNote)
          )
        ).trim();
      } catch {
        chronicle = '';
      }
    }
    if (gone(job)) return;

    // 7. 终局：产物挂 job（people.json 写回由 ui 层订阅 done 完成）
    await finish({
      stage: 'done',
      status: 'done',
      chronicle,
      events: merged.events,
      quotes: material.quotes,
      material: {
        traits: material.traits,
        moments: material.moments,
        interests: material.interests,
        threads: material.threads,
        mediaNote: material.mediaNote,
        statsNote: material.statsNote,
        profileNote: material.profileNote,
      },
      message: `「${job.name}」脸谱已生成`,
    });
  } catch (e) {
    if (gone(job)) return;
    // 上锁竞态（读记录 / 落盘被锁打断）：协作暂停而非判错——批级断点保留，解锁后可续
    if (!st?.safe?.unlocked) {
      await finish({ status: 'paused', message: '保险库已上锁，任务已暂停（解锁后可继续）' });
      return;
    }
    await finish({ status: 'error', error: errorMessage(e), message: `生成失败：${errorMessage(e)}` });
  } finally {
    if (st && st.runningJob === job.talker) st.runningJob = null;
  }
}

/** AI 依赖解析：最近一次注入优先，缺省 createAI()（提炼 .json / 画像 .chat 通道，ui 同款） */
function asksOf(): { extract: AskLLM; portrait: AskLLM } {
  if (st?.injected?.askExtract && st.injected.askPortrait) {
    return { extract: st.injected.askExtract, portrait: st.injected.askPortrait };
  }
  const ai = createAI();
  return {
    extract: st?.injected?.askExtract ?? ((p: string) => ai.json(p)),
    portrait: st?.injected?.askPortrait ?? ((p: string) => ai.chat(p)),
  };
}

// ---------------- 测试钩子 ----------------

/** 清空引擎单例（跨用例隔离；不清则上一用例的队列与订阅串场；prep 会话一并清） */
export function __resetJobsForTests(): void {
  st = null;
  runPromise = null;
  subs.clear();
  resetPrepForTests();
}
