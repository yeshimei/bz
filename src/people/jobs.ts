/**
 * 脸谱生成任务引擎（issue 450 E1）：生成与面板生命周期解耦——模块级单例，
 * 关面板转后台继续、重启从断点续跑（已完成批次不重烧 AI）。
 *
 * 持久化：CONFIG/STORAGE/people-jobs.json（storagePath 设置键可覆盖基目录），
 * 每批 AI 采集完成后原子落盘（jsonFileStore + enqueueFileTask 串行写，PreviewStore 同款）。
 * **隐私红线（ADR-0191）**：批内对话行、消息原文一律不进这个文件——只落批元数据
 * （from/to/count/媒体数）、已完成批的提炼结果（events/quotes/moments/traits JSON）、
 * 画像 / 时间线成品、互动统计聚合与消息集指纹。
 *
 * 断点续跑判定：指纹 = 全量预览桶消息条数 + 末条派生键（ts|文本哈希）。
 * resume(talker) 重读预览桶重算指纹：一致 → chunkMessages 确定性重切（跳过已完成批）→ 续跑；
 * 漂移（中途导入过新数据）→ 任务判废（status error），提示删除后重新生成。
 *
 * 分工口径：引擎只负责跑到 status done 并把 BuildFace 等价产物挂在 job 上；
 * people.json 写回（PeopleStore / ImportRecord / 面板刷新）由 ui 层（E2）订阅 done 完成。
 */
import { createAI } from '../core/ai';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import {
  buildChroniclePrompt,
  buildPortraitPrompt,
  chunkMetaOf,
  chunkMessages,
  evenlySample,
  extractBatch,
  mergeBatches,
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
import { PreviewStore, previewToUnified } from './datasource';
import type { ContactStats, FaceDigest, FaceEvent, MomentItem, QuoteItem, UnifiedMessage } from './types';

// ---------------- 类型 ----------------

export type JobStatus = 'running' | 'paused' | 'interrupted' | 'done' | 'error';
export type JobStage = 'chunked' | 'extracting' | 'portrait' | 'chronicle' | 'done';

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
  /** 消息集指纹：全量预览桶消息条数 */
  msgCount: number;
  /** 消息集指纹：末条派生键（ts|文本哈希；续跑校验） */
  lastMsgKey: string;
  /** 切批参数（缺省即 digest.DEFAULTS；续跑按存储值重切，不随设置漂移） */
  chunkOpts?: { maxChars: number; maxCount: number; maxBatches: number };
  /** 批元数据快照（无对话原文） */
  chunks: JobChunkMeta[];
  /** 已完成批数 = results.length */
  batchesDone: number;
  /** 已完成批的提炼结果（素材级，可落盘） */
  results: BatchExtract[];
  portrait?: string;
  chronicle?: string;
  /** 合并去重后的全量事件（随手记并入由 ui 层写回时处理） */
  events?: FaceEvent[];
  quotes?: QuoteItem[];
  /** 成文素材：特质 / 场景（抽样后口径）+ 喂画像的两段说明 */
  material?: { traits: string[]; moments: MomentItem[]; mediaNote?: string; statsNote?: string };
  /** 互动统计聚合（导入记录 stats 口径；聚合数字不含原文） */
  stats?: ContactStats;
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
 * 生成目标（ui GenTarget 同形）。**msgs 必须是全量预览桶消息**（previewToUnified(pv.msgs)）——
 * 断点续跑要重读预览桶校验指纹并重推导提炼集，这是判定成立的前提。
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
  /** 预览桶侧写互动统计汇总（issue 449）→ 互动统计叙述段 */
  insights?: InsightsSummary;
}

export interface JobStartOptions {
  /**
   * 本批目标统一模式：'auto'（缺省）按 planIncremental 判 full / incremental / skip；
   * 'full' 强制全量重画；'incremental' 强制走增量（提炼集仍按 planIncremental 推导，skip 则跳过）。
   */
  mode?: 'full' | 'incremental' | 'auto';
  /** 切批参数（缺省即 digest.DEFAULTS） */
  chunkOpts?: ChunkOptions;
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

// ---------------- 持久化（PreviewStore 同款：jsonFileStore + 串行写队列） ----------------

/** 任务文件路径（storagePath 设置键可覆盖基目录，缺省 CONFIG/STORAGE） */
export function getJobsFilePath(): string {
  const s = tryGetSettings() as { storagePath?: string } | null;
  return storageFile('people-jobs.json', (s && s.storagePath) || 'CONFIG/STORAGE');
}

export class JobStore {
  private readonly app: unknown;
  private readonly filePath: string;

  constructor(app: unknown) {
    this.app = app;
    this.filePath = getJobsFilePath();
  }

  private open() {
    return jsonFileStore<JobsData>(this.filePath, { defaultValue: emptyJobsData, app: this.app });
  }

  async read(): Promise<JobsData> {
    return enqueueFileTask(this.filePath, async () => this.open().read());
  }

  /** 整文件写回（引擎是本会话唯一写方；队列整体在内存，读→改→写整体入队） */
  async write(data: JobsData): Promise<void> {
    await enqueueFileTask(this.filePath, async () => {
      await this.open().write(data);
    });
  }
}

// ---------------- 引擎状态（模块级单例） ----------------

interface EngineState {
  app: unknown;
  store: JobStore;
  queue: PersonJob[];
  /** 最近一次 startJobs / resumeJobs 注入的 AI 依赖（缺省 createAI()） */
  injected: { askExtract?: AskLLM; askPortrait?: AskLLM } | null;
  runningJob: string | null;
  pauseRequested: boolean;
}

let st: EngineState | null = null;
let runPromise: Promise<void> | null = null;
const subs = new Set<(s: JobsSnapshot) => void>();

/** 指纹漂移判废文案（冻结：issue 450 口径，ui 直接透出） */
export const DRIFT_ERROR = '消息集已变化（导入过新数据），请删除任务后重新生成';

/** FNV-1a 32 位哈希（末条消息键原料；datasource 同算法本地实现——该模块不导出） */
function hash32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** 消息集指纹：条数 + 末条派生键（ts|文本哈希；对 UnifiedMessage / PreviewMsg 同样可推导） */
export function fingerprintOf(msgs: UnifiedMessage[]): { msgCount: number; lastMsgKey: string } {
  const last = msgs[msgs.length - 1];
  return { msgCount: msgs.length, lastMsgKey: last ? `${last.ts}|${hash32(last.text)}` : '' };
}

function nowIso(): string {
  return new Date().toISOString();
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------- 进度文案（issue 450 口径冻结） ----------------

/** 切批说明：`消息 20773 条 → 35 批（每批 ≤400 条 · ≤12000 字），共 37 次 AI 调用` */
function chunkedMessage(msgCount: number, batchCount: number, opts: Required<ChunkOptions>): string {
  return `消息 ${msgCount} 条 → ${batchCount} 批（每批 ≤${opts.maxCount} 条 · ≤${opts.maxChars} 字），共 ${batchCount + 2} 次 AI 调用`;
}

/** 抽样说明：`消息 91234 条 → 300 批超上限，均匀抽样 60 批（覆盖 … 全时段，首尾必保，未抽中的批次不送 AI）` */
function sampledMessage(msgCount: number, allCount: number, kept: number, spanFrom: string, spanTo: string): string {
  return `消息 ${msgCount} 条 → ${allCount} 批超上限，均匀抽样 ${kept} 批（覆盖 ${spanFrom} ~ ${spanTo} 全时段，首尾必保，未抽中的批次不送 AI）`;
}

/** 逐批：`第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条` */
function batchMessage(i: number, total: number, c: ChunkMeta): string {
  return `第 ${i}/${total} 批 · ${c.from} ~ ${c.to} · ${c.count} 条`;
}

/** 成文：`素材采集完成：事件 214 · 原话 63 · 场景 88 · 特质 41 → 正在生成画像` */
function materialMessage(c: MaterialCounts): string {
  return `素材采集完成：事件 ${c.events} · 原话 ${c.quotes} · 场景 ${c.moments} · 特质 ${c.traits} → 正在生成画像`;
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
 * 排队生成（多人顺序跑）：逐人建任务（预切批元数据 + 进度说明）→ 立即返回，
 * 引擎后台顺序执行；每批完成原子落盘。返回排队 / 跳过名单（skip = 无新消息或无可提炼文本）。
 * 想等整批跑完：`await startJobs(...); await whenIdle();`
 */
export async function startJobs(
  app: unknown,
  targets: JobTarget[],
  opts: JobStartOptions = {}
): Promise<{ queued: string[]; skipped: string[] }> {
  if (!st) {
    st = { app, store: new JobStore(app), queue: [], injected: null, runningJob: null, pauseRequested: false };
  }
  st.app = app;
  st.store = new JobStore(app);
  st.injected = opts.askExtract || opts.askPortrait ? { askExtract: opts.askExtract, askPortrait: opts.askPortrait } : null;
  const people = new PeopleStore(app);
  const entries = await people.list();
  const queued: string[] = [];
  const skipped: string[] = [];
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
    // 重复排队（上次没跑完 / 已完成重画）：一律替换为本次新任务
    st.queue = st.queue.filter((j) => j.talker !== t.talker);
    st.queue.push({
      talker: t.talker,
      name: t.name,
      mode: effective,
      fileLabel: t.fileLabel,
      status: 'paused', // 排队待跑（与用户暂停同态：runner 按序拾起）
      stage: 'chunked',
      msgCount: fp.msgCount,
      lastMsgKey: fp.lastMsgKey,
      chunkOpts: chunkFull,
      chunks: chunks.map(chunkMetaOf),
      batchesDone: 0,
      results: [],
      material: {
        traits: [],
        moments: [],
        mediaNote: mediaNote || undefined,
        statsNote: t.insights ? buildStatsNote(t.insights) || undefined : undefined,
      },
      stats,
      importRecord: {
        fileLabel: t.fileLabel,
        skippedCount: t.skippedCount ?? 0,
        messageCount: digestMsgs.length,
        timeFrom: new Date(t.msgs[0].ts).toISOString(),
        timeTo: new Date(t.msgs[t.msgs.length - 1].ts).toISOString(),
      },
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
  return { queued, skipped };
}

/**
 * 启动扫描（插件加载 / 面板首开时调一次）：读 people-jobs.json 重建队列，
 * 把上次崩溃遗留的 running 标为 interrupted（出「继续生成」），不自动续跑。
 * 本会话已启动过引擎时直接返回（不覆盖运行中的内存队列——重复调用安全）。
 */
export async function resumeJobs(app: unknown, ai: JobResumeOptions = {}): Promise<void> {
  if (st) {
    st.app = app;
    return;
  }
  const store = new JobStore(app);
  const data = await store.read();
  const queue = Array.isArray(data?.queue) ? data.queue : [];
  let dirty = false;
  for (const j of queue) {
    if (!j || typeof j !== 'object') continue;
    if (!Array.isArray(j.results)) j.results = [];
    if (!Array.isArray(j.chunks)) j.chunks = [];
    if (j.status === 'running') {
      j.status = 'interrupted';
      j.message = '上次未完成，可从断点继续';
      j.updatedAt = nowIso();
      dirty = true;
    }
  }
  st = { app, store, queue, injected: ai.askExtract || ai.askPortrait ? ai : null, runningJob: null, pauseRequested: false };
  runPromise = null;
  if (dirty) await store.write({ version: 1, queue });
  emit();
}

/** 从断点继续指定人物（paused / interrupted 态；排队中任务按序拾起）。返回是否受理。 */
export function resume(talker: string): boolean {
  if (!st) return false;
  const job = st.queue.find((j) => j.talker === talker);
  if (!job || (job.status !== 'paused' && job.status !== 'interrupted')) return false;
  job.status = 'paused';
  job.error = undefined;
  job.updatedAt = nowIso();
  void persist().then(emit);
  kick();
  return true;
}

/** 暂停：当前批完成后停下（成文阶段的画像 / 时间线调用照常收尾），队列不再拾起后续任务 */
export function pauseJobs(): void {
  if (st) st.pauseRequested = true;
}

/** 删除任务（运行中的也删：当前 AI 调用作废，不再落盘、不再出 done 事件）；落盘完成后 resolve */
export async function removeJob(talker: string): Promise<boolean> {
  if (!st) return false;
  const before = st.queue.length;
  st.queue = st.queue.filter((j) => j.talker !== talker);
  if (st.runningJob === talker) st.runningJob = null;
  if (st.queue.length < before) {
    await persist();
    emit();
    return true;
  }
  return false;
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
    if (!st || st.pauseRequested) break;
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
    // 1. 重读预览桶 + 指纹校验（漂移 = 中途导入过新数据 → 判废）
    const pv = await new PreviewStore(st!.app).read();
    if (gone(job)) return;
    const contact = pv.contacts[job.talker];
    const bucketMsgs = contact ? previewToUnified(contact.msgs) : [];
    const fp = fingerprintOf(bucketMsgs);
    if (fp.msgCount !== job.msgCount || fp.lastMsgKey !== job.lastMsgKey) {
      await finish({ status: 'error', error: DRIFT_ERROR, message: DRIFT_ERROR });
      return;
    }

    // 2. 提炼集重推导（与 startJobs 同判定：bucket + 人物卡未变 ⇒ 结果确定）
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

    // 3. 确定性重切批（与落盘批元数据比对；不一致同判漂移）
    const optsC: Required<ChunkOptions> = { ...DEFAULTS, ...job.chunkOpts };
    const all = chunkMessages(digestMsgs, { ...optsC, maxBatches: Number.MAX_SAFE_INTEGER });
    if (!all.length) {
      await finish({ status: 'error', error: '没有可提炼的文本消息', message: '没有可提炼的文本消息' });
      return;
    }
    const sampled = all.length > optsC.maxBatches;
    const chunks: DigestChunk[] = sampled ? evenlySample(all, optsC.maxBatches) : all;
    const metas = chunks.map(chunkMetaOf);
    if (job.chunks.length && JSON.stringify(job.chunks) !== JSON.stringify(metas)) {
      await finish({ status: 'error', error: DRIFT_ERROR, message: DRIFT_ERROR });
      return;
    }
    job.chunks = metas;

    // 4. 逐批采集（断点：跳过前 batchesDone 批，results 已存）
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
      let result: BatchExtract;
      try {
        result = await extractBatch(asks.extract, c, job.name);
      } catch (e) {
        await finish({ status: 'error', error: errorMessage(e), message: `第 ${i + 1} 批提炼失败：${errorMessage(e)}` });
        return;
      }
      if (gone(job)) return;
      job.results.push(result);
      job.batchesDone = i + 1;
      await persist();
      emit();
    }

    // 5. 素材合并（digest / incremental 单源）→ 画像
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
      sampleEvents: job.mode === 'incremental',
    });
    await finish({
      stage: 'portrait',
      message: materialMessage(counts),
    });

    let portrait = '';
    try {
      portrait = (await asks.portrait(buildPortraitPrompt(job.name, material))).trim();
    } catch (e) {
      await finish({ status: 'error', error: errorMessage(e), message: `画像生成失败：${errorMessage(e)}` });
      return;
    }
    if (gone(job)) return;
    if (!portrait) {
      await finish({ status: 'error', error: '画像生成为空', message: '画像生成为空' });
      return;
    }
    job.portrait = portrait;
    job.updatedAt = nowIso();
    await persist();
    emit();

    // 6. 关系时间线（次要产物：失败不阻断）
    await finish({ stage: 'chronicle', message: '画像完成，正在生成关系时间线…' });
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
        mediaNote: material.mediaNote,
        statsNote: material.statsNote,
      },
      message: `「${job.name}」脸谱已生成`,
    });
  } catch (e) {
    if (gone(job)) return;
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

/** 清空引擎单例（跨用例隔离；不清则上一用例的队列与订阅串场） */
export function __resetJobsForTests(): void {
  st = null;
  runPromise = null;
  subs.clear();
}
