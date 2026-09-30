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
 * 阶段机（469 工具段 + 470 图片描述段 / ADR-0196）：
 * preprocess（bz-face prep：媒体导出→派生档→图片关联→语音转写）→ describe（插件 AI 段：图片
 * 描述——确认门一次，跳过 ≠ 取消；批级断点，逐批合并回聊天仓派生 text）→ chunked → extracting
 * → person（其人）→ bond（相交）→ chronicle（纪事 + 人物档案提炼，issue 487；档案是次要
 * 产物，失败不阻断）→ done。零媒体 / 零图片的联系人按决策 9 自动跳过对应段且不弹确认。
 * 上屏名与详情折页名逐字对齐（其人 / 相交 / 纪事，issue 455 拍板）：引擎内部阶段键仍是
 * person / bond / chronicle，只换文案不换键。
 *
 * 断点续跑判定（466 / ADR-0197 决策 5）：指纹 = 组装素材的**内容哈希**（条数 + 逐条 ts|归属|文本
 * 链式哈希）。resume(talker) 重读聊天仓（保库记录 store 段）重算指纹：一致 → chunkMessages
 * 确定性重切（跳过已完成批）→ 续跑；漂移 → 任务判废（status error），提示删除后重新生成。
 * 「合并后重算指纹」豁免路径（469 起）：prep 旁路表合并与 describe 描述合并都会升级派生 text——
 * 两段合并都发生在指纹重算之前，素材升级按 refresh 对齐落盘值，不判废。
 * 落盘兼容（issue 455）：旧版 in-flight job 的单卷 `portrait` 字段读入视作 `person`。
 *
 * 上锁协作暂停（ADR-0194 决策 5）：订阅 encrypt:unlock-changed——任意路径上锁即 pauseJobs()
 * （当前批完成后停，批级断点保留）；解锁后 kick() 续跑。引擎运行全程要求共锁保险库处于解锁态。
 *
 * 分工口径：引擎只负责跑到 status done 并把 BuildFace 等价产物挂在 job 上；
 * 人物卡写回（PeopleStore / ImportRecord / 面板刷新）由 ui 层（E2）订阅 done 完成。
 */
import { createAI } from '../core/ai';
import { proofreadPieces } from '../core/asr-proofread';
import { onDomainEvent } from '../core/domain-bus';
import { notice } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import type { ExternalToolCallbacks } from '../core/external-tool';
import { ENCRYPT_UNLOCK_CHANGED_CHANNEL } from '../encrypt/data';
import { getPeopleSafeStore, type PeopleSafeStore } from './safe-store';
import {
  canAcquireHeavy,
  heavyGatePortraitBusy,
  releaseHeavy,
  setHeavyPortraitBusy,
  setHeavyPreemptHandler,
  waitHeavyGate,
} from './heavy-gate';
import {
  abortPrepSession,
  applyPrepProgress,
  buildPrepSpec,
  classifyPrepFailure,
  clearPrepControl,
  collectPrepInfo,
  currentPrepSession,
  newPrepProgress,
  pendingVoiceProofread,
  prepAllDone,
  prepMediaTotals,
  prepStageLine,
  readPrepSidecars,
  resetPrepForTests,
  startPrepSession,
  writePrepControl,
  writeVoiceSidecarRaw,
  type PrepProgress,
} from './prep';
import {
  buildBondPrompt,
  buildChroniclePrompt,
  buildPersonPrompt,
  buildProfileExtractPrompt,
  buildProfileNote,
  chunkMetaOf,
  chunkMessages,
  evenlySample,
  extractBatch,
  knownProfileText,
  mergeBatches,
  parseProfileReply,
  profileExtractMaterial,
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
  applyImageDescToMsgs,
  applyMediaFailToMsgs,
  applyImageMapToMsgs,
  applySensitiveSkipsToMsgs,
  applyVoiceToMsgs,
  isDescSkipped,
  normalizeOptionsFromSettings,
  pendingMediaCounts,
  storeStatsOf,
  storeToUnified,
  type ImageDescItem,
  type StoreContact,
} from './datasource';
import {
  batchSizeFromSettings,
  buildDescribePrompt,
  contextWindowOf,
  describeBatches,
  describeOf,
  describeStageLine,
  descDataUrlOf,
  imageRefsOf,
  isSensitiveRefusal,
  newDescribeProgress,
  parseDescribeReply,
  describeModelLabelOf,
  type AskDescribe,
  type DescribeImageRef,
  type DescribeProgress,
} from './describe';
import type {
  ContactStats,
  DescribeConfirmInfo,
  FaceDigest,
  FaceEvent,
  InterestItem,
  MomentItem,
  PersonProfile,
  PortraitConfirmInfo,
  QuoteItem,
  ThreadItem,
  UnifiedMessage,
} from './types';

// ---------------- 类型 ----------------

export type JobStatus = 'running' | 'paused' | 'interrupted' | 'done' | 'error';
/**
 * 任务阶段：preprocess（469 工具段：媒体导出→派生档→图片关联→语音转写，词表与工具
 * [bz-p].phase 同源）→ describe（470 图片描述段：插件 AI 段，确认门 + 批级断点）→
 * chunked → extracting → person（其人）→ bond（相交）→ chronicle（纪事）→ done
 */
export type JobStage = 'preprocess' | 'describe' | 'chunked' | 'extracting' | 'person' | 'bond' | 'chronicle' | 'done';

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
  /** 卷二《相交》成品（issue 455） */
  bond?: string;
  chronicle?: string;
  /** 修订前的旧卷原文（issue 517：增量修订式落盘留档） */
  revisedFrom?: { person: string; bond: string; chronicle: string };
  /**
   * 人物档案提炼（issue 487）：时间线之后按素材回填的档案建议——ui 落盘时经 fillProfile
   * **只填空白字段**，手填值绝不覆盖。提炼失败或素材不支撑时缺省（不阻断主流程）。
   */
  aiProfile?: PersonProfile;
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
  /**
   * 图片描述段进度（470 / ADR-0196 决策 8；纯元数据无原文）。权威在聊天仓（描述已合并 =
   * 该图 text 非空），账本供进度展示与「确认过 / 跳过过」的记忆——续跑不再重复弹确认。
   */
  describe?: DescribeProgress;
  /**
   * 画像生成已确认（471 / ADR-0196 决策 8 第二次确认的记账）：重试 / 断点续跑不再二次弹窗
   * ——用户已授权过这次花费。取消 = 任务整条移除，不会有「取消过」的残留态。
   */
  portraitConfirmed?: boolean;
  /** 导入记录元数据（ui 层落 ImportRecord 所需；messageCount = 实际进提炼的条数） */
  importRecord?: { fileLabel: string; skippedCount: number; messageCount: number; timeFrom: string; timeTo: string };
  error?: string;
  /** 最新进度文案（切批说明 / 逐批 / 成文；切批后立刻可算） */
  message?: string;
  /**
   * 排队中（issue 505 补漏 / 531）：paused 且前面还有在跑 / 待跑的同队任务——还没轮到。
   * 派生值，emit() 单源归一（此前无人赋值，render 的「等」印分支是死代码，
   * 排队者被画成「歇 · 上次没画完」与进度便签「第 2/2 位」自相矛盾）。
   */
  queued?: boolean;
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
   * 图片描述的 AI 注入（470：`{text, images}` 多模态通道，走 AI 面板当前服务商与模型）。
   * 缺省 createAI().json。与 askExtract / askPortrait 一样供测试打桩。
   */
  askDescribe?: AskDescribe;
  /**
   * 图片描述的确认门注入（470 / ADR-0196 决策 8）：describe 段开始前回调，返回 'start' | 'skip'
   * （生产 = ui 的确认弹窗；测试注入假门）。缺省（未注入）= 无授权通道，一律按跳过处理。
   */
  askDescribeConfirm?: DescribeGate;
  /**
   * 画像生成的确认门注入（471 / ADR-0196 决策 8 第二次确认）：采集批切定后、烧 AI 前回调，
   * 返回 'start' | 'cancel'（取消 = 任务整条移除，与描述的跳过不同）。缺省（未注入）= 放行
   * ——生产入口（ui.startGeneration）恒注入门，引擎直调（测试 / 编程消费）不为确认所阻。
   */
  askPortraitConfirm?: PortraitGate;
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
  /** 图片描述的 AI 注入（470；缺省 createAI().json 多模态通道） */
  askDescribe?: AskDescribe;
  /** 图片描述的确认门注入（470；缺省 = 无授权通道按跳过处理） */
  askDescribeConfirm?: DescribeGate;
  /** 画像生成的确认门注入（471；缺省 = 放行，生产入口恒注入） */
  askPortraitConfirm?: PortraitGate;
}

/**
 * 图片描述确认门（470 / ADR-0196 决策 8）：引擎组装确认数据（DescribeConfirmInfo，只报
 * 张数 / 批数 / 调用数不报金额）交给宿主弹窗，解析 'start'（开跑）| 'skip'（跳过 ≠ 取消）；
 * 抛错 = 没拿到授权，按 skip 处理。
 */
export type DescribeGate = (info: DescribeConfirmInfo) => Promise<'start' | 'skip'>;

/**
 * 画像生成确认门（471 / ADR-0196 决策 8）：引擎组装确认数据（PortraitConfirmInfo，只报
 * 素材条数 / 调用数不报金额）交给宿主弹窗，解析 'start'（开跑）| 'cancel'（取消 = 任务整条
 * 移除，不烧 AI）；抛错 = 没拿到授权，按 cancel 处理。
 */
export type PortraitGate = (info: PortraitConfirmInfo) => Promise<'start' | 'cancel'>;

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
  /** 最近一次 startJobs / resumeJobs 注入的 AI 依赖（缺省 createAI()；describe 段缺省 ai.json 多模态） */
  injected: {
    askExtract?: AskLLM;
    askPortrait?: AskLLM;
    askDescribe?: AskDescribe;
    askDescribeConfirm?: DescribeGate;
    askPortraitConfirm?: PortraitGate;
  } | null;
  /** 批级重试参数（startJobs 注入；缺省 DEFAULT_MAX_RETRIES + 真实退避） */
  retry: RetryPolicy;
  runningJob: string | null;
  /**
   * 暂停闸（手动 / 上锁共用置位）：置位时 runner 不拾起新任务、在跑任务批间收手。
   * **粘滞**——不随引擎停转自清（清掉它就分不清「这次暂停是谁要的」），只由两类
   * 显式动作消费：用户点「继续生成」（resume / retryPrepFailures）与解锁续跑（仅限
   * lockPaused 来源，见下）。
   */
  pauseRequested: boolean;
  /**
   * 本次暂停来自上锁（ADR-0194 决策 5）：解锁事件据此决定是否自动续跑——
   * 手动暂停在生效时上锁不接管来源，解锁就不得覆盖用户的暂停意图。
   */
  lockPaused: boolean;
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

/**
 * 成文段固定调用的估算基数：其人 + 相交 + 纪事 + 档案提炼（issue 487）。纪事 / 档案提炼
 * 在素材全空时才跳过、四类素材任一非空即跑（常态命中）——确认门与切批说明的「约 M 次」
 * 按常态计，与 runJob 实际调用面同口径，宁可粗一档也不系统性少报。
 */
const PORTRAIT_FIXED_CALLS = 4;

/** 切批说明：`消息 20773 条 → 35 批 · 共 39 次 AI 调用`（成文 = 其人 + 相交 + 纪事 + 档案提炼 4 次，见 PORTRAIT_FIXED_CALLS；每批条数 / 字数上限不上屏） */
function chunkedMessage(msgCount: number, batchCount: number): string {
  return `消息 ${msgCount} 条 → ${batchCount} 批 · 共 ${batchCount + PORTRAIT_FIXED_CALLS} 次 AI 调用`;
}

/** 抽样说明：`消息 91234 条 → 均匀抽样 60 批`（原批数 / 时段范围 / 首尾必保等机制说明不上屏） */
function sampledMessage(msgCount: number, kept: number): string {
  return `消息 ${msgCount} 条 → 均匀抽样 ${kept} 批`;
}

/** 逐批：`第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条` */
function batchMessage(i: number, total: number, c: ChunkMeta): string {
  return `第 ${i}/${total} 批 · ${c.from} ~ ${c.to} · ${c.count} 条`;
}

/** 成文：`素材：事件 214 · 原话 63 · 场景 88 · 特质 41`（尾段「→ 正在生成《其人》」与主行锚点重复，不再念一遍） */
function materialMessage(c: MaterialCounts): string {
  return `素材：事件 ${c.events} · 原话 ${c.quotes} · 场景 ${c.moments} · 特质 ${c.traits}`;
}

/** 批失败重试中：`第 30/47 批失败，重试 1/2…`（具体原因进底部错误行，不在这句里念） */
function batchRetryMessage(i: number, total: number, attempt: number, maxRetries: number): string {
  return `第 ${i + 1}/${total} 批失败，重试 ${attempt}/${maxRetries}…`;
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
  // 排队印归一（单源）：paused 且前面还有在跑 / 待跑者 = 排队中。所有状态变迁路径都过 emit，
  // 在这里推导比在每个赋值点维护可靠。interrupted / error / done 不算等待者（它们在等用户）。
  if (st) {
    let seenActive = false;
    for (const j of st.queue) {
      j.queued = j.status === 'paused' && seenActive;
      if (j.status === 'running' || j.status === 'paused') seenActive = true;
    }
  }
  const snap = snapshot();
  for (const fn of subs) {
    try {
      fn(snap);
    } catch {
      /* 订阅方渲染异常不反噬引擎 */
    }
  }
}

/**
 * 整队列原子落盘（写失败只告警不阻断：批内结果仍在内存，下一 checkpoint 会再试）。
 * describe-only 的临时任务（509）**在此单点排除、任何 persist 路径都不进盘**——
 * checkpoint 只写正式队列：中途崩溃不留假任务在保库，重启 resumeJobs 也就不会把它标
 * interrupted 出「继续生成」、更不会借面板首开注入的确认门自动放行烧完整条画像链。
 */
async function persist(): Promise<void> {
  if (!st) return;
  const queue =
    describeOnlyJob && st.queue.includes(describeOnlyJob) ? st.queue.filter((j) => j !== describeOnlyJob) : st.queue;
  try {
    await st.store.write({ version: 1, queue });
  } catch (e) {
    console.warn('[people] 任务进度落盘失败:', e);
  }
}

// ---------------- 启动 / 排队 ----------------

/**
 * AI 依赖注入判定（startJobs / resumeJobs **同源**）：任一项注入了就算。漏记一项会把
 * 整包注入当 null 丢掉（如 resumeJobs 曾漏 askDescribeConfirm——重启后只注 describe 门时
 * 描述静默按跳过处理，绝不烧钱的路子没错，但用户授权的活静默没干）。
 */
function hasInjection(o: {
  askExtract?: AskLLM;
  askPortrait?: AskLLM;
  askDescribe?: AskDescribe;
  askDescribeConfirm?: DescribeGate;
  askPortraitConfirm?: PortraitGate;
}): boolean {
  return !!(o.askExtract || o.askPortrait || o.askDescribe || o.askDescribeConfirm || o.askPortraitConfirm);
}

/**
 * 导入记录元数据（落 ImportRecord 所需）。新建与复用两条路径共用同一口径——
 * 否则「续跑」任务写回的导入记录会缺条数 / 跨度。
 * 条数取**本次导出的可消费消息条数**（与 timeFrom / timeTo 同源 `t.msgs`，也与导入路径
 * 的 `msgs.length` 一致）：ImportRecord.messageCount 既用来显示「消息总数」，又是
 * incremental.planIncremental 判「同一导出再导」的整份指纹的一半——记成本次提炼子集条数
 * （增量只跑 1 条就记 1）会让指纹永不命中，每次再导都判成 newer 白烧一遍（issue 523）。
 */
function importRecordOf(t: JobTarget): NonNullable<PersonJob['importRecord']> {
  return {
    fileLabel: t.fileLabel,
    skippedCount: t.skippedCount ?? 0,
    messageCount: t.msgs.length,
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
 * refresh 重切批的断点对齐（D 组拍板）：任务自身合并升级素材后整体重切，旧已完成批
 * 能不能复用按**批元数据**对齐——新切批次从第一批起逐条与旧已完成批比对首末日期
 * （from / to，切批确定性口径），匹配的保留断点；从第一个不匹配批起全部作废。
 * 返回可保留的批数（= 截后的 batchesDone，results 由调用方按同长度截断）。
 * 抽样封顶（evenlySample）后样本位可能整体位移——按前缀对齐只保住「确实没变」的头部，
 * 不猜后面，宁多烧不漏炼。
 */
export function alignRefreshedBatches(oldDone: ChunkMeta[], fresh: ChunkMeta[]): number {
  const n = Math.min(oldDone.length, fresh.length);
  let keep = 0;
  while (keep < n && fresh[keep].from === oldDone[keep].from && fresh[keep].to === oldDone[keep].to) keep++;
  return keep;
}

// ---------------- 画谱总确认估算（issue 497：一次报清全部要花钱 / 花时间的事） ----------------

/**
 * 单人画像调用估算：min(切批数, maxBatches 上限) + 其人 + 相交 + 纪事 + 档案提炼。
 * 与引擎同口径（chunkMessages + DEFAULTS.maxBatches 截断），估算偏保守——上限截断时实际更少。
 */
export function estimatePortraitCallsOf(msgs: UnifiedMessage[]): number {
  const all = chunkMessages(msgs, { ...DEFAULTS, maxBatches: Number.MAX_SAFE_INTEGER });
  return Math.min(all.length, DEFAULTS.maxBatches) + PORTRAIT_FIXED_CALLS;
}

/**
 * 按条数版（issue 514）：增量模式手里只有提炼集条数（planCount），没有那批消息本体——
 * 用 24 字符哑行近似平均行宽切批（真实聊天行宽的中位量级），「约」数宁粗不细。
 */
export function estimatePortraitCallsOfCount(count: number): number {
  return estimatePortraitCallsOf(Array.from({ length: Math.max(0, count) }, (_, i) => ({ ts: i, isSender: false, text: 'x'.repeat(24) })));
}

/**
 * 单人描述调用估算：ceil(图片数 / 每批张数)。图片数取 kindCounts 全量口径（含已描述的——
 * 总确认在起跑前给「约」数，宁粗不细；引擎 describe 段按聊天仓实际剩余张数精确切批）。
 */
export function estimateDescribeCallsOf(images: number): number {
  return Math.ceil(images / batchSizeFromSettings());
}

/**
 * 上锁协作暂停（ADR-0194 决策 5）：订阅共锁保险库的解锁态广播（本会话装一次）——
 * 任意路径上锁（面板「立即上锁」/ 锁屏 / 安全模式）→ 暂停（标记来源 lockPaused），
 * 当前批完成后停，批级断点保留、绝不带着明文继续吐 AI；解锁 → 仅当暂停来自上锁时
 * kick() 从断点续跑（手动暂停在生效时上锁不接管来源，解锁不覆盖用户意图）。
 */
let lockWired = false;
/** 引擎一次性 wiring（上锁联动 + 重进程闸门抢占回调）；三处入口（startJob / resumeJobs / describe 单段）都调 */
function wireLock(): void {
  if (lockWired) return;
  lockWired = true;
  wireHeavyPreempt();
  onDomainEvent<{ unlocked: boolean }>(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
    if (evt?.unlocked === false) pauseEngine(true);
    else if (evt?.unlocked === true) {
      if (st?.lockPaused) {
        st.lockPaused = false;
        st.pauseRequested = false; // 解锁续跑 = 消费掉上锁置位的暂停闸
        kick();
      }
    }
  });
}

/** 抢占后等待命进程自己退的宽限（毫秒）；超时兜底硬杀（协作式优先，与停止同口径） */
const PREP_PREEMPT_KILL_MS = 30000;

let preemptWired = false;
/**
 * 注册「录音侧请求抢占待命 prep 进程」的回调（ADR-0218 决策 4）。
 * 录音要起进程但闸门被 portrait 占着、且那边**只是待命进程**（无任务在 running）时，
 * heavy-gate 触发本回调：写 prep control `stop` 让进程在安全点留账退出，宽限期内未退则兜底杀。
 * 由 jobs 侧注册而非 recording 直接调，是为守住 ADR-0002 依赖方向（recording 不 import jobs）。
 */
function wireHeavyPreempt(): void {
  if (preemptWired) return;
  preemptWired = true;
  setHeavyPreemptHandler(() => {
    const s = currentPrepSession();
    if (!s) return;
    const dataRoot = dataRootOf();
    if (dataRoot) void writePrepControl(dataRoot, 'stop');
    console.log('[people] 为腾出内存已请求结束待命预处理进程（恢复画谱任务时会重新加载模型）');
    setTimeout(() => {
      // 30 秒兜底只杀「仍是待命」的会话：宽限期内用户点了「继续生成」（resume 控制已写、
      // 进程复活在跑活）时 portraitBusy 为真——再杀会把活跃任务打回 paused（意外中断）。
      if (!heavyGatePortraitBusy() && currentPrepSession()?.talker === s.talker) abortPrepSession(s.talker);
    }, PREP_PREEMPT_KILL_MS);
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
  if (describeOnlyBusy) {
    // 补充素材·描述单段在跑（509）：不与全链并发，本次目标全记跳过（重试即可）
    return { queued: [], skipped: targets.map((t) => t.name || t.talker), resumed: [] };
  }
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
      lockPaused: false,
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
  st.injected = hasInjection(opts)
    ? {
        askExtract: opts.askExtract,
        askPortrait: opts.askPortrait,
        askDescribe: opts.askDescribe,
        askDescribeConfirm: opts.askDescribeConfirm,
        askPortraitConfirm: opts.askPortraitConfirm,
      }
    : null;
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
    const importRecord = importRecordOf(t);
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
        ? sampledMessage(t.msgs.length, chunks.length)
        : chunkedMessage(t.msgs.length, chunks.length),
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
    injected: hasInjection(ai) ? ai : null,
    retry: { maxRetries: DEFAULT_MAX_RETRIES, sleep: realSleep },
    runningJob: null,
    pauseRequested: false,
    lockPaused: false,
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
  if (describeOnlyBusy) return false; // 补充素材·描述单段在跑（509）：不与全链并发
  const job = st.queue.find((j) => j.talker === talker);
  if (!job) return false;
  if (job.status === 'error' && job.error === DRIFT_ERROR) return false;
  if (job.status !== 'paused' && job.status !== 'interrupted' && job.status !== 'error') return false;
  job.status = 'paused';
  job.error = undefined;
  job.updatedAt = nowIso();
  // 用户显式「继续生成」= 解除暂停闸（旗标粘滞，只由用户动作 / 解锁续跑消费——不随引擎停转自清）
  st.pauseRequested = false;
  void persist().then(emit);
  kick();
  return true;
}

/**
 * 暂停引擎（手动 / 上锁共用body）：当前批完成后停下（成文阶段的画像 / 时间线调用照常收尾），
 * 队列不再拾起后续任务。工具段（preprocess）运行中收到暂停 = 协作式让行（ADR-0196 决策 3）：
 * 写数据根 `.bz-face/control.json` {action:"pause"} 让进程在本条媒体后待命（不硬杀——模型冷加载
 * 按分钟计），并触发 prepGate 唤醒 runJob 先落 paused；恢复时写 resume 复用同一进程。
 * 来源记账：fromLock = true 时标 lockPaused（解锁续跑的凭据）；手动暂停在生效时上锁
 * **不接管来源**——否则解锁会覆盖用户先前的手动暂停意图。
 */
function pauseEngine(fromLock: boolean): void {
  if (!st) return;
  const manualInEffect = st.pauseRequested && !st.lockPaused;
  if (!manualInEffect) st.lockPaused = fromLock;
  st.pauseRequested = true;
  const engine = st;
  const job = engine.runningJob ? engine.queue.find((j) => j.talker === engine.runningJob) : null;
  if (job && job.status === 'running' && job.stage === 'preprocess') {
    const dataRoot = dataRootOf();
    if (dataRoot) void writePrepControl(dataRoot, 'pause');
    engine.prepGate?.();
  }
}

/** 用户手动暂停（面板「暂停」）：来源标记为手动——解锁不自动续跑，点「继续生成」才恢复 */
export function pauseJobs(): void {
  pauseEngine(false);
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
  // 同 resume：用户显式的「重试失败项」也解除暂停闸（旗标只由用户动作 / 解锁续跑消费）
  st.pauseRequested = false;
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
    // 不自清 pauseRequested：旗标粘滞（暂停来源要留到解锁时刻判读），
    // 只由用户动作（resume / retryPrepFailures）与解锁续跑消费。
  });
  return runPromise;
}

async function runQueue(): Promise<void> {
  for (;;) {
    if (!st || !runnable()) break; // 暂停请求 / 共锁保险库上锁（ADR-0194）都停在这里
    if (describeOnlyBusy) break; // 补充素材·描述单段在跑（509）：全链等它，不并发
    const job = st.queue.find((j) => j.status === 'paused');
    if (!job) break;
    // 重进程闸门（ADR-0218 决策 6）：录音在跑 → 等它释放。这里**不是 break**——有任务在等闸时
    // whenIdle() 不能提前 resolve（等闸本身就是"还没空"）。等闸期间任务仍是 paused，只是文案
    // 交代在等什么；放弃条件（暂停 / 上锁 / 任务被删 / 描述段插队）由 keepWaiting 判。
    const prevMessage = job.message;
    if (!canAcquireHeavy('portrait')) {
      job.message = '等待录音处理结束…';
      emit();
    }
    const got = await waitHeavyGate('portrait', () => !!st && runnable() && !describeOnlyBusy && st.queue.includes(job) && job.status === 'paused');
    if (job.status === 'paused') job.message = prevMessage;
    if (!got) {
      // 等闸弃等（任务被删 / 暂停 / 上锁 / 描述段插队）≠ 队列没活：**不得 break**——
      // 此时没人会再 kick（startJobs 末尾那次早发完了），break 会让队列里后续 paused
      // 任务无人拾起（停摆）。回循环顶部，runnable() / describeOnlyBusy / find(paused)
      // 自然处理后续；emit 把恢复前的文案落一帧快照。
      emit();
      continue;
    }
    emit();
    try {
      await runJob(job);
    } finally {
      releaseHeavy('portrait'); // 任务出 running = 松开这一份（prep 待命进程另持一份，见 prep.ts）
    }
  }
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
        job.message = typeof data.note === 'string' && data.note.trim() ? data.note.trim() : '本条做完即停';
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
 * 快检分支的账本落位：已有断点账本时**只刷新分母**（counts 各段 total 对齐当前聊天仓口径），
 * 绝不清账——donePhases 清了会让续跑重起 prep 进程白扫全库、failed 清了会弄丢进度块上的
 * 「重试失败项」按钮。无账本（首跑）按 newPrepProgress 建账（原口径不变）。
 */
function rollPrepLedger(job: PersonJob, totals: { media?: number; derive?: number; transcribe?: number; map?: number }): PrepProgress {
  const prep = prepOf(job);
  if (!prep) return newPrepProgress(totals);
  const fresh = newPrepProgress(totals);
  for (const [phase, c] of Object.entries(fresh.counts)) {
    prep.counts[phase] = { done: prep.counts[phase]?.done ?? 0, total: c.total };
  }
  return prep;
}

/**
 * 工具段（469 / ADR-0196 决策 1、3、4、7）：跑 `bz-face prep` 四段。
 *   - 零媒体联系人自动跳过全段（决策 9）；媒体无欠账（text 全非空）同样跳过（issue 515）；
 *     账本齐段也跳过——语音欠账例外（账本齐段压过新语音是条 bug，见函数体内注释）。
 *   - 暂停 = 协作式让行：pauseJobs 写控制文件并触发 prepGate，本函数从「等进程终结」的
 *     await 醒来落 paused——进程待命不退出，恢复时复用（模型冷加载不白付）。
 *   - 失败分流（决策 7）：[bz-result]{ok:false} = 密钥 / 解密类硬失败，整链停给中文原因；
 *     failed>0 = 单条媒体 / 语音失败计账继续（进度块给「重试失败项」，重跑 prep 只补缺口）。
 * 返回 'skipped' | 'ok' | 'halted'（halted = runJob 立即返回，finish 已落状态）。
 */
async function runPrepStage(
  job: PersonJob,
  finish: (patch: Partial<PersonJob>) => Promise<void>,
  store: StoreContact | null,
  safe: PeopleSafeStore
): Promise<'skipped' | 'ok' | 'halted'> {
  const totals = prepMediaTotals(store?.kindCounts, store?.stats);
  if (!totals) return 'skipped'; // 零媒体：不为 0 张图起一次进程（决策 9）
  // 媒体无欠账（issue 515）：描述 / 转写完成会升级进 text，text 全非空 = 产物已吃干榨净——
  // 不再为存量起 bz-face prep 全扫（此前每次补画都要过一遍 3000+ 文件，观感即「又开始导出」）。
  // 新导入的媒体 text 为空会计进待办，prep 照常起；转写失败条目保持空同样不漏。
  const pending = pendingMediaCounts(store?.msgs ?? []);
  if (!pending.images && !pending.voices) return 'skipped';
  // 断点：账本齐段照旧跳过——**例外：有语音欠账**。原「齐段即跳过」压过欠账检查是条 bug：
  // 中途导入新语音时 prep 被跳过，新语音 text 恒空、静默缺料（新图片反而会被 describe 段
  // 补上，两条媒体线不一致）。图片欠账不在此拦（归 describe 段管，别为它重起进程重扫全库，
  // issue 515 的口径不回退）；转写幂等（voice.json 即水位），重起进程只补语音缺口。
  const prep = prepOf(job);
  if (prep && prepAllDone(prep) && !pending.voices) return 'skipped';
  const dataRoot = dataRootOf();
  if (!dataRoot) {
    await finish({ status: 'error', error: '数据根未配置——媒体导出与语音转写没有可跑的目录', message: '数据根未配置' });
    return 'halted';
  }
  // 快检（issue 515 续）：盘上旁路表已就位时先试直接靶向升级（读盘毫秒级）——升级后待办清零
  // 就不起 prep 进程了（3000+ 文件的全扫整个消失）；覆盖不全（转写失败 / 新语音）才落回原路径。
  const side = readPrepSidecars(dataRoot, job.talker);
  if (side && (side.voice.length || side.imageMap.length)) {
    await proofreadVoiceSidecarIfEnabled(job, dataRoot, job.talker); // ADR-0222：并仓前校对
    await mergePrepArtifactsIntoStore(safe, job.talker, dataRoot);
    const fresh = (await safe.read(job.talker))?.store;
    const after = pendingMediaCounts(fresh?.msgs ?? []);
    if (!after.images && !after.voices) {
      job.prep = rollPrepLedger(job, totals); // 段进度齐账：已有账本只刷分母，不清 donePhases / failed
      job.message = '预处理产物已覆盖全部待办，直接合并升级，无需起预处理进程';
      return 'skipped';
    }
    job.prep = rollPrepLedger(job, totals); // 覆盖不全：回落原路径前落账本（同样不清账）
  }
  if (!job.prep) job.prep = newPrepProgress(totals);

  // 预处理起跑：不另写「预处理：媒体导出、语音转写…」这种只看一帧的句子——进程第一行
  // [bz-p]/{step} 一到，主行进度行（`媒体导出 312/1631`）就接管（步短语与阶段行重复念是噪音）
  job.stage = 'preprocess';
  await persist();
  emit();

  // 起跑前写 resume：清掉陈旧 pause / stop 指令——**必须先于起进程**（新进程第一眼读到的
  // 就该是 resume；先起进程后写与「起跑前写」语义相反，写失败的那一窗里新进程会读到陈旧
  // stop 干净退出，任务落 paused 且无报错）。写失败留痕便于诊断这类「一启动就没了」。
  if (!(await writePrepControl(dataRoot, 'resume'))) {
    console.warn('[people] prep 起跑前写 resume 控制失败：若盘上有陈旧 stop，进程可能一启动就退出');
  }
  // 待命进程复用（暂停后恢复）或起新进程
  const existing = currentPrepSession();
  const session = existing && existing.talker === job.talker ? existing : startPrepSession(job.talker, buildPrepSpecFromSettings(job, dataRoot), prepCallbacks(job));

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

  // 终结分流（[bz-result] 是成果权威；stopped 优先——与 core/external-tool 同口径）。
  // 进程已终结的各分支**都要清控制文件**（clearPrepControl）：残指令靠「下次起跑后写 resume
  // 覆盖」兜不住写失败的窗口，残留 stop 会让续跑进程一出生就自己退（任务 paused 循环无报错）。
  const { outcome, result } = settled;
  if (outcome.stopped) {
    // 中断（删除任务 / 换人跑）：杀进程留状态——产物幂等，续跑只补缺口
    clearPrepControl(dataRoot);
    await finish({ status: 'paused', message: '已完成的部分保留' });
    return 'halted';
  }
  if (result && result.ok === false) {
    // 密钥 / 解密类硬失败（工具预检 [bz-result]{ok:false,error}）：整链停给中文原因
    clearPrepControl(dataRoot);
    const msg = typeof result.error === 'string' && String(result.error).trim() ? String(result.error).trim() : '预处理失败：工具报错，没有给出原因';
    await finish({ status: 'error', error: msg, message: msg });
    return 'halted';
  }
  if (result && result.stopped === true) {
    // 工具收到 stop 控制指令自己退的（控制文件被外部写 stop）：等同暂停，产物保留
    clearPrepControl(dataRoot);
    await finish({ status: 'paused', message: '已完成的部分保留' });
    return 'halted';
  }
  if (!outcome.ok || !result || result.ok !== true) {
    clearPrepControl(dataRoot);
    const classified = classifyPrepFailure(outcome);
    await finish({ status: 'error', error: classified.message, message: classified.message });
    return 'halted';
  }
  const failed = Number(result.failed);
  // 成账即以本轮为准：重跑全成功后 failed 清零（否则「N 条失败待补齐」与「重试失败项」永久残留）
  if (job.prep) job.prep.failed = Number.isFinite(failed) && failed > 0 ? failed : 0;
  clearPrepControl(dataRoot); // 终态收尾：残留的 pause 会让下一次 prep 起跑即待命
  return 'ok';
}

/**
 * 语音条旁路表 LLM 校对（ADR-0222 / issue 518）：开关关 / 无待校条目零开销直返。
 * 校对结果连同 `proofread` 标记写回 voice.json——整档任一批终败**不写回**，原文照旧并仓并
 * 通知留缺口；重跑任务时 Python 侧 text 已有不重转，只补校对（批内不可暂停，整档通常秒级）。
 */
async function proofreadVoiceSidecarIfEnabled(job: PersonJob, dataRoot: string, talker: string): Promise<void> {
  if (tryGetSettings()?.asrLlmProofread !== true) return;
  const items = readPrepSidecars(dataRoot, talker)?.voice ?? [];
  const pending = pendingVoiceProofread(items);
  if (!pending.length) return;
  const step = (t: string) => { job.message = t; void persist(); emit(); };
  step(`LLM 校对语音条中（${pending.length} 条）…`);
  const res = await proofreadPieces(pending.map((v) => String(v.text ?? '')), {
    contextNote: '双人聊天语音消息逐条转写（口语，按时间先后排列）',
    onProgress: (done, total) => step(`LLM 校对语音条 ${done}/${total} 批`),
  });
  if (res.failed) {
    notice(`「${talker}」语音条 LLM 校对失败——按原文并仓，重跑任务可补校`, 'warning');
    return;
  }
  pending.forEach((v, k) => { v.text = res.texts[k]; v.proofread = true; });
  if (!writeVoiceSidecarRaw(dataRoot, talker, items)) {
    notice(`「${talker}」语音条校对结果写回失败——按原文并仓`, 'warning');
  }
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
): Promise<{ voice: number; images: number; unusable: number } | null> {
  if (!safe.unlocked) return null;
  const side = readPrepSidecars(dataRoot, talker);
  // mediaFail 为 null = 无权威（表缺失 / --limit 调试轮），此时不并该类（不动已有标注）
  if (!side || (!side.voice.length && !side.imageMap.length && side.mediaFail === null)) return null;
  const previewVoice = opts?.previewVoice ?? normalizeOptionsFromSettings().previewVoice;
  const counts = { voice: 0, images: 0, unusable: 0 };
  await safe.write(talker, (rec) => {
    // 次序：先并关联表（img 换成产物名），再按产物名标终态——否则 broken 项对不上 img（ADR-0225）
    counts.voice = applyVoiceToMsgs(rec.store.msgs, side.voice, { previewVoice });
    counts.images = applyImageMapToMsgs(rec.store.msgs, side.imageMap);
    if (side.mediaFail !== null) counts.unusable = applyMediaFailToMsgs(rec.store.msgs, side.mediaFail);
    if (counts.voice + counts.images > 0) {
      rec.store.stats = storeStatsOf(rec.store.msgs); // 时间线变多 → 统计重算（口径单源 storeStatsOf）
      rec.store.updatedAt = new Date().toISOString();
    } else if (counts.unusable > 0) {
      rec.store.updatedAt = new Date().toISOString(); // 标注变了也要让面板重读（统计不受影响）
    }
  });
  return counts;
}

// ---------------- 图片描述段 describe（issue 470 / ADR-0196 决策 8、9） ----------------

/**
 * 图片描述段（470 / ADR-0196 决策 8）：prep 产物（img 关联 + desc/ 派生档）就位后、素材切批前，
 * 用 AI 面板当前模型给图片出描述，逐批合并进聊天仓派生 text（`[图片] 描述`）。
 *   - 零图片 / 已全部描述 / 已确认过跳过：直接跳过且不弹确认（决策 9；确认只为花钱的事而弹）。
 *   - 确认门一次（决策 8）：`用 <服务商>/<模型> 描述 N 张图片，约 M 次调用；已完成 X 张，
 *     本次从第 X+1 张开始`，按钮 开始 / 跳过图片描述；跳过 ≠ 取消——图片保持空文本继续走画像。
 *     门未注入（无法征求授权）或门抛错 = 没拿到授权 → 一律按跳过处理，绝不静默烧钱。
 *   - 批级断点：批切分由图片集（ts 升序）确定性重导；「该批是否已完成」以聊天仓 text 为权威，
 *     已完成批零调用跳过；单批失败只废该批（重试退避后 error 落账，resume 从失败批续跑）。
 *   - 暂停 = 批间自然断点（批完成后停）；批级 checkpoint 逐批落保库记录（job.describe 账本）。
 * 返回 'skipped' | 'ok' | 'halted'（halted = runJob 立即返回，finish 已落状态）。
 */
async function runDescribeStage(job: PersonJob, finish: (patch: Partial<PersonJob>) => Promise<void>): Promise<'skipped' | 'ok' | 'halted' | 'unreadable'> {
  const safe = st!.safe;
  if (!safe?.unlocked) {
    // 同 runJob 步 1：早退不留 running 孤儿——按上锁暂停落账，解锁自续
    pauseEngine(true);
    await finish({ status: 'paused', message: '已暂停 · 保险库上锁——解锁后可继续' });
    return 'halted';
  }
  const ledger = describeOf(job);
  if (ledger?.skipped) return 'skipped'; // 已跳过：续跑不再问（跳过 ≠ 取消，整链继续）
  const dataRoot = dataRootOf();
  if (!dataRoot) return 'skipped'; // 没有数据根就没有派生档可读——描述无从谈起，不弹确认

  const rec = await safe.read(job.talker);
  if (gone(job)) return 'halted';
  const msgs = rec?.store.msgs ?? [];
  const byKey = new Map(msgs.map((m) => [m.key, m]));
  // 敏感标注即终态（ADR-0224）：已标注的图不进 refs——不计数、不切批、不再调用；也因此
  // 「有欠账」不会永久成立（ADR-0223 决策 6 的落点：否则每轮补画都重扫全库）
  const refs = imageRefsOf(msgs).filter((r) => !isDescSkipped(byKey.get(r.key)));
  if (!refs.length) return 'skipped'; // 零图片：不为 0 张图弹一次确认（决策 9）
  const isDone = (ref: DescribeImageRef): boolean => (byKey.get(ref.key)?.text ?? '') !== '';
  const batchSize = ledger?.batchSize ?? batchSizeFromSettings();
  const batches = describeBatches(refs, batchSize);
  const doneBatches = batches.filter((b) => b.every(isDone)).length;
  const pendingCount = refs.filter((r) => !isDone(r)).length;
  if (!ledger) job.describe = newDescribeProgress(refs.length, batchSize);
  const led = job.describe!;
  led.imgCount = refs.length;
  led.batchSize = batchSize;
  led.totalBatches = batches.length;
  led.doneBatches = Math.max(led.doneBatches, doneBatches);
  if (pendingCount <= 0) {
    // 全部描述过（上一轮已并仓 / 旁路表兜底命中）：零调用直接过
    await finish({ describe: led, message: describeStageLine(doneBatches, batches.length) });
    return 'skipped';
  }

  // 确认门（决策 8）：同一任务只问一次（confirmed 记账——重试 / 续跑不重复弹）
  if (!led.confirmed) {
    const gate = st!.injected?.askDescribeConfirm;
    if (!gate) {
      led.skipped = true;
      await finish({ describe: led, message: '已跳过图片描述，继续生成画像' });
      return 'skipped';
    }
    const label = describeModelLabelOf();
    job.stage = 'describe';
    job.message = '等待确认图片描述…';
    await persist();
    emit();
    let answer: 'start' | 'skip';
    try {
      answer = await gate({
        provider: label.provider,
        model: label.model,
        name: job.name,
        totalImages: refs.length,
        doneImages: refs.length - pendingCount,
        calls: batches.filter((b) => b.some((r) => !isDone(r))).length, // 有剩余工作的批 = 约调用次数
        batchSize,
      });
    } catch (e) {
      console.warn('[people] 图片描述确认门异常，按跳过处理:', e);
      answer = 'skip';
    }
    if (gone(job)) return 'halted';
    if (answer === 'skip') {
      // 跳过 ≠ 取消（ADR-0196 决策 8）：图片以空文本在仓（不进时间线），整链继续走到画像生成
      led.skipped = true;
      await finish({ describe: led, message: '已跳过图片描述，继续生成画像' });
      return 'skipped';
    }
    led.confirmed = true;
    await persist();
  }

  // 逐批描述（批级断点：聊天仓 text 是权威，已完成批零调用跳过）
  job.stage = 'describe';
  await finish({ describe: led, message: describeStageLine(led.doneBatches, batches.length) });
  const ask = asksOf().describe;
  // 「有欠账、零可读」探测（issue 521 / ADR-0225 决策 3）：整个图片集一张派生档都读不动时，
  // 本段零调用走完——过去这就静默当「全批完成」，欠账口径（待描述 N 张）与批完成口径互相
  // 矛盾、永不收敛。现在把它认出来，交 runJob 收尾并说清楚。
  let readRefs = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const pending = batch.filter((r) => !isDone(r));
    if (!pending.length) {
      if (led.doneBatches < i + 1) led.doneBatches = i + 1;
      continue;
    }
    if (st!.pauseRequested) {
      await finish({ status: 'paused', message: `已暂停 · ${describeStageLine(i, batches.length)}` });
      return 'halted';
    }
    if (gone(job)) return 'halted';
    // 组批：读派生档换 data URL；读不动的剔除（单条失败不废整批），绝不回落原图 / 微信缩略图
    const images: Array<{ ref: DescribeImageRef; url: string }> = [];
    for (const ref of pending) {
      const url = descDataUrlOf(dataRoot, job.talker, ref.img);
      if (url) images.push({ ref, url });
    }
    if (!images.length) {
      led.doneBatches = i + 1; // 批内派生档全读不动：不烧调用，计完成跳过（成因见下面的收尾判定）
      await persist();
      continue;
    }
    readRefs += images.length;
    led.doneBatches = i; // 进行中口径（当前批未完，断点落在本批开头）
    job.message = `本批 ${images.length} 张`; // 批号与主行锚点（`图片描述 3/82 批`）同义，这里只补本批张数
    emit();
    // 批级重试（issue 453 同款）：退避再试，重试期间推快照；耗尽 → error 落账（可从失败批续跑）
    const context = contextWindowOf(msgs, batch[0].ts, batch[batch.length - 1].ts);
    const prompt = buildDescribePrompt(images.length, context);
    let descs: string[];
    let attempt = 0;
    let refused = false; // 整批被判敏感拒绝（ADR-0224）
    for (;;) {
      try {
        descs = parseDescribeReply(await ask({ text: prompt, images: images.map((x) => x.url) }), images.length);
        break;
      } catch (e) {
        if (gone(job)) return 'halted';
        const err = errorMessage(e);
        // 敏感拒绝：这一批必再被拒，重试纯属白付——直接转逐张（ADR-0224 决策 2）
        if (isSensitiveRefusal(err)) { refused = true; break; }
        if (isAbortError(e) || attempt >= st!.retry.maxRetries) {
          // error 面不带 message：原因与「继续生成」由进度块的错误行 / 按钮承担（说了两遍是噪音）
          await finish({ status: 'error', error: err });
          return 'halted';
        }
        attempt += 1;
        job.message = `第 ${i + 1}/${batches.length} 批失败，重试 ${attempt}/${st!.retry.maxRetries}…`;
        emit();
        await st!.retry.sleep(RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)]);
        if (gone(job)) return 'halted';
        if (st!.pauseRequested) {
          await finish({ status: 'paused', message: `已暂停 · ${describeStageLine(i, batches.length)}` });
          return 'halted';
        }
      }
    }
    // 敏感降级（ADR-0224 决策 2、3）：整批被拒 → 该批逐张重来。一张毒图不该废掉整批 20 张，
    // 更不该废掉整条链——成功的照常并仓，被拒的标注 descSkip 跳过，两者都继续往下走。
    const missed: DescribeImageRef[] = [];
    if (refused) {
      const onePrompt = buildDescribePrompt(1, context);
      descs = [];
      for (const item of images) {
        if (gone(job)) return 'halted';
        if (st!.pauseRequested) {
          await finish({ status: 'paused', message: `已暂停 · ${describeStageLine(i, batches.length)}` });
          return 'halted';
        }
        try {
          const one = parseDescribeReply(await ask({ text: onePrompt, images: [item.url] }), 1);
          descs.push(one[0] ?? '');
        } catch (e) {
          if (gone(job)) return 'halted';
          // 只有「明确被判敏感」才标注；其它错误（网络抖动等）只让这一张留空待重试，
          // 绝不把它误标成不可重跑的终态（ADR-0224 决策 1：宁可漏判也不误判）
          if (isSensitiveRefusal(errorMessage(e))) missed.push(item.ref);
          descs.push('');
        }
      }
      if (missed.length) led.sensitive = (led.sensitive ?? 0) + missed.length;
      job.message = `本批 ${images.length} 张中 ${missed.length} 张被判敏感，已标注跳过`;
      emit();
    }
    // 本批合并进聊天仓（ADR-0197：插件是唯一写入者；走 safe.write 串行链，批级 checkpoint）
    const items: ImageDescItem[] = images.map((x, j) => ({ file: x.ref.img, ct: Math.round(x.ref.ts / 1000), desc: descs[j] ?? '' }));
    await safe.write(job.talker, (rec2) => {
      // 次序要紧：**先标注、后并描述**。标注先行，applyImageDescToMsgs 才会把被拒的图整条跳过
      // （否则它的近邻描述会被「最近邻兜底」借给它——一张毒图反而拿到别人的描述）
      const k = missed.length ? applySensitiveSkipsToMsgs(rec2.store.msgs, missed.map((r) => r.img)) : 0;
      const n = applyImageDescToMsgs(rec2.store.msgs, items);
      if (n > 0 || k > 0) {
        rec2.store.stats = storeStatsOf(rec2.store.msgs); // 描述进时间线 → 统计重算（图片数变化）
        rec2.store.updatedAt = new Date().toISOString();
      }
    });
    if (gone(job)) return 'halted';
    led.doneBatches = i + 1;
    await persist();
    emit();
  }
  // 「有欠账、零可读」→ 交 runJob 收尾（ADR-0225 决策 3）。判据收窄的理由：终态标注落地后，
  // 死欠账已不算欠账，这里只剩两种成因——本轮刚导入、派生还没跑起来，或数据根 / 磁盘临时掉线。
  // 两种都该停下手说清楚，而不是继续烧 4 次成文调用（用户实测：1 条新增素材白烧 5 次）。
  if (readRefs === 0 && pendingCount > 0) {
    led.unreadable = pendingCount;
    await finish({ describe: led, message: `图片描述 0/${batches.length} 批` });
    return 'unreadable';
  }
  // 敏感标注是终态、不会重跑（ADR-0224）。这里不通知——通知归 UI 层（引擎不碰 DOM，
  // 任务完成时的统一通知在 ui.persistJobDone，读 job.describe.sensitive 拼出去）。
  return 'ok';
}

// ---------------- 补充素材·描述单段入口（issue 509 / ADR-0212） ----------------

let describeOnlyBusy = false;
/** describe-only 的临时任务本体（runDescribeOnly 持有）：persist 单点排除它（见 persist），
 *  跑完 / 异常收尾置空——不置空会连累后续正式任务的 checkpoint 漏写。 */
let describeOnlyJob: PersonJob | null = null;

/** 是否有 describe-only 任务在跑（startJobs 互斥护栏的另一读法，测试用） */
export function isDescribeOnlyBusy(): boolean {
  return describeOnlyBusy;
}

/**
 * 只跑图片描述段（509 补充素材·图片页签的「生成描述」）：计费授权由**按钮本身**承担
 * （显式动作，不再二次弹确认门——注入恒 start 的 gate），批切分 / 批级断点 / 并仓
 * 全部复用 runDescribeStage。零图片 / 已全部描述直接 ok（不烧调用）。
 * 引擎忙（画谱排队 / 在跑 / 另一个 describe-only）拒绝——单段不与全链并发。
 * 临时任务不入持久队列：入队跑、跑完摘（进度经 snapshot 推给 UI，与画谱 describe 同一套渲染）。
 */
export async function runDescribeOnly(app: unknown, talker: string): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  if (describeOnlyBusy) return { ok: false, reason: '已有描述任务在跑' };
  if (st && (st.runningJob || st.queue.some((j) => j.status === 'paused'))) {
    return { ok: false, reason: '画谱任务进行中——等它跑完再补描述' };
  }
  describeOnlyBusy = true; // 同步占位（早于一切 await）：与 startJobs 入口检查互掐时不再双方过检
  const prevInjected = st?.injected ?? null;
  try {
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
        lockPaused: false,
        prepGate: null,
      };
    }
    st.app = app;
    st.store = new JobStore(app);
    st.safe = await getPeopleSafeStore();
    wireLock();
    if (!st.safe.unlocked) return { ok: false, reason: '保险库上锁' };
    st.injected = { ...(st.injected ?? {}), askDescribeConfirm: async () => 'start' };

    const entries = await new PeopleStore(app).list();
    const name = entries.find((p) => p.id === talker)?.name ?? talker;
    const now = nowIso();
    const job: PersonJob = {
      talker,
      name,
      mode: 'incremental',
      fileLabel: '补充素材',
      status: 'running',
      stage: 'describe',
      msgCount: 0,
      contentHash: '',
      chunks: [],
      batchesDone: 0,
      results: [],
      message: '准备图片描述…',
      startedAt: now,
      updatedAt: now,
    };
    st.queue.push(job);
    st.runningJob = talker;
    describeOnlyJob = job; // 挂单点排除标记：任何 persist 路径都不把临时任务写进保库
    emit();
    const finish = async (patch: Partial<PersonJob>): Promise<void> => {
      Object.assign(job, patch, { updatedAt: nowIso() });
      // 临时任务不落盘（checkpoint 只写正式队列，中途崩溃不留假任务在保库）
      const engine = st;
      if (!engine) return;
      engine.queue = engine.queue.filter((j) => j !== job);
      await persist();
      engine.queue.push(job);
      emit();
    };
    try {
      const r = await runDescribeStage(job, finish);
      if (job.status === 'error') return { ok: false, reason: job.error };
      if (r === 'halted') return { ok: false, reason: '描述没有跑完（保险库上锁或任务被移除），稍后重试' };
      return { ok: true, skipped: r === 'skipped' };
    } finally {
      st.queue = st.queue.filter((j) => j !== job);
      if (st.runningJob === talker) st.runningJob = null;
      describeOnlyJob = null; // 摘除排除标记：后续正式任务的 checkpoint 恢复整队列落盘
      await persist();
      emit();
    }
  } finally {
    describeOnlyBusy = false;
    if (st) st.injected = prevInjected; // 确认门注入还原（不短路后续全链的确认门）
  }
}

async function runJob(job: PersonJob): Promise<void> {
  const asks = asksOf();
  st!.runningJob = job.talker;
  job.status = 'running';
  job.error = undefined;
  job.updatedAt = nowIso();
  setHeavyPortraitBusy(true); // 任务在跑 = 真占闸（区别于"只有待命进程"——录音侧据此前置抢占，ADR-0218）
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
    if (!safe?.unlocked) {
      // 上锁竞态：早退不能把任务留在 running 态——resume()/runQueue 只受理 paused，
      // running 是没人拾起的孤儿（引擎堵死到重启）。按上锁暂停落账，解锁广播自续（wireLock）。
      pauseEngine(true);
      await finish({ status: 'paused', message: '已暂停 · 保险库上锁——解锁后可继续' });
      return;
    }
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
    const prepState = await runPrepStage(job, finish, storeBefore, safe);
    if (prepState === 'halted') return; // 暂停 / 硬失败（finish 已落状态）
    if (prepState === 'ok') {
      // prep 产物合并进聊天仓（ADR-0197 决策 4：插件是唯一写入者；幂等靶向升级）；合并前先过 LLM 校对（ADR-0222）
      await proofreadVoiceSidecarIfEnabled(job, dataRootOf(), job.talker);
      const merged = await mergePrepArtifactsIntoStore(safe, job.talker, dataRootOf());
      if (gone(job)) return;
      if (merged && merged.voice + merged.images > 0) {
        job.message = `预处理完成${job.prep?.failed ? `，${job.prep.failed} 条失败待补齐` : ''}，开始组装素材…`;
      }
    }

    // 2.5 图片描述段（470 / ADR-0196 决策 8、9）：确认门一次、跳过 ≠ 取消、批级断点，
    //     描述逐批合并进聊天仓派生 text。零图片 / 已跳过 / 已描述完的自动跳过且不弹确认。
    const descState = await runDescribeStage(job, finish);
    if (descState === 'halted') return; // 确认 / 暂停 / 批失败（finish 已落状态）
    if (descState === 'unreadable') {
      // 有欠账、零可读（ADR-0225 决策 3，用户拍板）：本趟没有可提炼的内容——收尾说清楚，
      // 不再往下烧采集批 + 其人 / 相交 / 纪事 / 档案提炼（实测 1 条新增素材白烧 5 次）。
      // 收尾为 done 但**不挂 person**：ui.persistJobDone 对「done 且无产物」只提示不留痕
      // （不写导入记录 / 不动锚点，下次补画照旧从同一水位续）。
      const n = job.describe?.unreadable ?? 0;
      await finish({
        stage: 'done',
        status: 'done',
        message: `本次没有可提炼的内容：${n} 张图片的源图损坏或缺失，无法生成描述`,
      });
      return;
    }

    // 3. 重读聊天仓 + 指纹判定（prep 合并与 describe 合并把转写 / 关联 / 描述升级进 text——
    //    指纹在合并后算）。判废只认「外部漂移且烧过批」（上面已拦）；此处的指纹变化只能来自
    //    本任务自己的合并（AI 未烧批时还可能是中途导入的新素材）——预期内的素材升级，刷新落盘值继续。
    const contact = (await safe.read(job.talker))?.store;
    if (gone(job)) return;
    const bucketMsgs = contact ? storeToUnified(contact.msgs) : [];
    const fp = fingerprintOf(bucketMsgs);
    const drifted = fp.msgCount !== job.msgCount || fp.contentHash !== job.contentHash;
    const refresh = drifted;

    if (!bucketMsgs.length) {
      // 聊天数据被清空（设置「清空聊天数据」不清任务）后续跑：空数组进 planIncremental 会炸出
      // 英文 TypeError。startJobs 的空守卫管起跑，这里管续跑——拦下说人话。
      await finish({
        status: 'error',
        error: '聊天记录是空的——数据可能已被清空，请重新导入聊天数据后再画',
        message: '聊天记录为空，无法提炼',
      });
      return;
    }

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
    // refresh 重切批的断点对齐（D 组拍板）：素材升级后整体重切，不能盲留 batchesDone——
    // 新边界从第一批起与旧已完成批按首末日期对齐，对不上的从第一个不匹配批起清断点
    // （results 一并截断，batchesDone = results.length 不变量保持），后面的批重跑。
    // 不对齐的旧做法会从新布局的第 batchesDone 批续跑：头部增量素材漏提炼、重叠段重复烧钱。
    const oldDoneChunks = job.chunks.slice(0, job.batchesDone);
    job.chunks = metas;
    if (refresh && job.batchesDone > 0) {
      const keep = alignRefreshedBatches(oldDoneChunks, metas);
      if (keep < job.batchesDone) {
        job.results = job.results.slice(0, keep);
        job.batchesDone = keep;
        job.message = `素材升级重切为 ${metas.length} 批——前 ${keep} 批边界没变接着用，其余重跑`;
      }
    }
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
        // 条数 / 跨度同取 bucketMsgs（聊天仓全量）：这是「这份素材」的条数口径，
        // 与 startJobs 的 importRecordOf（t.msgs）同义——写本次提炼子集条数会让
        // planIncremental 的整份指纹永不命中（issue 523）
        job.importRecord = {
          fileLabel: job.fileLabel,
          skippedCount: job.importRecord?.skippedCount ?? 0,
          messageCount: bucketMsgs.length,
          timeFrom: new Date(bucketMsgs[0].ts).toISOString(),
          timeTo: new Date(bucketMsgs[bucketMsgs.length - 1].ts).toISOString(),
        };
      }
    }

    // 5.5 画像生成确认门（471 / ADR-0196 决策 8 第二次确认，与图片描述确认互相独立——
    //     跳过了描述这扇门照弹）：素材条数 / 约调用次数（采集批 + 其人 + 相交 + 纪事 + 档案提炼，
    //     口径单源 PORTRAIT_FIXED_CALLS）在切批定案后最准。取消 = 任务整条移除（画像不画，
    //     已同步的数据保留）；抛错 = 没拿到授权，按取消处理。门未注入 = 放行（生产入口恒注入；
    //     引擎直调的测试 / 编程消费不阻）。已确认过（重试 / 断点续跑）不再二次弹窗。
    if (!job.portraitConfirmed) {
      const gate = st!.injected?.askPortraitConfirm;
      if (gate) {
        const label = describeModelLabelOf();
        job.stage = 'chunked';
        job.message = '等待确认画像生成…';
        await persist();
        emit();
        let answer: 'start' | 'cancel';
        try {
          answer = await gate({
            provider: label.provider,
            model: label.model,
            name: job.name,
            materials: digestMsgs.length,
            calls: chunks.length + PORTRAIT_FIXED_CALLS,
          });
        } catch (e) {
          console.warn('[people] 画像生成确认门异常，按取消处理:', e);
          answer = 'cancel';
        }
        if (gone(job)) return;
        if (answer === 'cancel') {
          await removeJob(job.talker);
          return;
        }
        job.portraitConfirmed = true;
        await persist();
      } else {
        job.portraitConfirmed = true;
      }
    }

    // 6. 逐批采集（断点：跳过前 batchesDone 批，results 已存）
    job.stage = 'extracting';
    const total = chunks.length;
    for (let i = job.batchesDone; i < total; i++) {
      if (st!.pauseRequested) {
        // 状态词由主行承担（`已暂停 · …`），message 只留批位
        await finish({ status: 'paused', message: `${job.batchesDone}/${total} 批` });
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
            // error 面不带 message：原因与「继续生成」由底部错误行 / 按钮承担
            await finish({ status: 'error', error: err });
            return;
          }
          attempt += 1;
          job.message = batchRetryMessage(i, total, attempt, st!.retry.maxRetries);
          emit();
          await st!.retry.sleep(RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)]);
          if (gone(job)) return;
          if (st!.pauseRequested) {
            await finish({ status: 'paused', message: `${job.batchesDone}/${total} 批` });
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
    if (job.mode === 'incremental') {
      merged = mergeWithOld(merged, existing?.digest);
      // issue 517：修订式留档——旧卷原文随 job 走，落盘时写进 digest.revisedFrom
      if (existing?.digest && (existing.digest.person || existing.digest.bond || existing.digest.chronicle)) {
        job.revisedFrom = {
          person: existing.digest.person ?? '',
          bond: existing.digest.bond ?? '',
          chronicle: existing.digest.chronicle ?? '',
        };
      }
    }
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
      person = (await asks.portrait(buildPersonPrompt(job.name, material, sampleWarn, job.mode === 'incremental' ? existing?.digest?.person : undefined))).trim();
    } catch (e) {
      await finish({ status: 'error', error: errorMessage(e) });
      return;
    }
    if (gone(job)) return;
    if (!person) {
      await finish({ status: 'error', error: '卷一《其人》生成为空' });
      return;
    }
    job.person = person;
    job.updatedAt = nowIso();
    await persist();
    emit();

    // 5.5 卷二《相交》（必产：空则判 error，批次成果保留可续跑）——引擎侧阶段键仍为 bond，
    //     上屏名与详情折页名逐字对齐（其人 / 相交 / 纪事）
    await finish({ stage: 'bond', message: '《其人》完成，正在生成《相交》…' });
    let bond = '';
    try {
      bond = (await asks.portrait(buildBondPrompt(job.name, material, sampleWarn, job.mode === 'incremental' ? existing?.digest?.bond : undefined))).trim();
    } catch (e) {
      // error 面 message 不上屏（原因由底部错误行承担）——不写第二份
      await finish({ status: 'error', error: errorMessage(e) });
      return;
    }
    if (gone(job)) return;
    if (!bond) {
      await finish({ status: 'error', error: '卷二《相交》生成为空' });
      return;
    }
    job.bond = bond;
    job.updatedAt = nowIso();
    await persist();
    emit();

    // 6. 纪事（次要产物：失败不阻断；编年时间线 + 按月交往事件，落进《纪事》折）
    await finish({ stage: 'chronicle', message: '《相交》完成，正在生成《纪事》…' });
    let chronicle = '';
    if (merged.events.length) {
      try {
        chronicle = (
          await asks.portrait(
            buildChroniclePrompt(
              job.name,
              evenlySample(merged.events, MATERIAL_LIMITS.chronicle),
              material.mediaNote,
              material.statsNote,
              job.mode === 'incremental' ? existing?.digest?.chronicle : undefined
            )
          )
        ).trim();
      } catch {
        chronicle = '';
      }
    }
    if (gone(job)) return;

    // 6.5 人物档案提炼（issue 487，时间线之后的次要产物）：按合并素材回填档案建议，
    //     stage 仍报 chronicle（不新增阶段）；四类素材（事件 / 原话 / 场景 / 特质）全空则整段跳过；
    //     任何失败不阻断画谱主流程——job.aiProfile 拿不到就留空。手填档案以「已知档案」进
    //     prompt 声明不要覆盖；落盘侧（ui.persistJobDone）再用 fillProfile 只填空白兜一道。
    if (merged.events.length || merged.quotes.length || merged.moments.length || merged.traits.length) {
      await finish({ message: '《纪事》完成，正在提炼人物档案…' });
      try {
        const aiProfile = parseProfileReply(
          await asks.portrait(buildProfileExtractPrompt(job.name, profileExtractMaterial(merged), knownProfileText(existing?.profile)))
        );
        if (Object.keys(aiProfile).length) job.aiProfile = aiProfile;
      } catch (e) {
        console.warn('[people] 档案提炼失败（不阻断画谱）:', e);
      }
    }
    if (gone(job)) return;

    // 7. 终局：产物挂 job（people.json 写回由 ui 层订阅 done 完成）
    await finish({
      stage: 'done',
      status: 'done',
      chronicle,
      aiProfile: job.aiProfile,
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
      // 终局不再写 message：done 态进度块不上屏（完成靠通知与折页），留一句没人看的句子只会误导
    });
  } catch (e) {
    if (gone(job)) return;
    // 上锁竞态（读记录 / 落盘被锁打断）：协作暂停而非判错——批级断点保留，解锁后可续
    if (!st?.safe?.unlocked) {
      await finish({ status: 'paused', message: '保险库已上锁，解锁后继续' });
      return;
    }
    await finish({ status: 'error', error: errorMessage(e) });
  } finally {
    if (st && st.runningJob === job.talker) st.runningJob = null;
    setHeavyPortraitBusy(false); // 任务出 running：闸门是否松开由重入计数决定（prep 待命进程可能仍持着）
  }
}

/** AI 依赖解析：注入项逐字段优先，缺省 createAI()（提炼 .json / 画像 .chat / 描述 .json 多模态） */
function asksOf(): { extract: AskLLM; portrait: AskLLM; describe: AskDescribe } {
  const ai = createAI();
  return {
    extract: st?.injected?.askExtract ?? ((p: string) => ai.json(p)),
    portrait: st?.injected?.askPortrait ?? ((p: string) => ai.chat(p)),
    describe: st?.injected?.askDescribe ?? ((input) => ai.json(input)),
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
