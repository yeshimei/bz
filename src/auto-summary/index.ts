/**
 * 自动摘要入口（ticket 22）：监听剪藏文件夹，文件创建或打开时缺字段 AI 补全。
 * 源码：自动摘要.js L124-140（插件版：删除 quickAddApi 检查；createAI 来自 core）
 *
 * enh 包 2：pending 触发收敛为一条 FIFO 串行队列（监听触发与手动重跑共用），
 * 多篇并发逐个处理；批量（>1 篇）进度合并为单条「正在生成摘要 k/N…」逐个更新。
 * enh 包 1：regenerateSummary / redoSummaryForActiveFile 手动重跑入口（force 重建）。
 */
import { createAI } from '../core/ai';
import { tryGetSettings } from '../core/settings-provider';
import { notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { processFile } from './processor';

/** 监听目录与剪藏本设置一致（articleDirectory，默认 归档/网页剪藏） */
function getWatchDir(): string {
  const s = tryGetSettings() as any;
  return (s && s.articleDirectory) || '归档/网页剪藏';
}

let initialized = false;
let vaultRef: any = null;
let workspaceRef: any = null;
let fileListenerRef: any = null;
let openListenerRef: any = null;
let registerTimer: ReturnType<typeof setTimeout> | null = null;
/** 延迟窗口内同一文件只排队一次（create+open 双触发去重）；存 timer id，stop 时统一取消 */
const pendingPaths = new Map<string, ReturnType<typeof setTimeout>>();
/** 已入队/处理中集合：enqueueJob 加入、任务完成移除；重复触发直接忽略 */
const processingPaths = new Set<string>();

/** 队列任务：监听触发与手动重跑（force）共用 */
interface SummaryJob {
  app: any;
  ai: any;
  file: any;
  /** force：跳过缺失检测直接重建 summary/tags（手动重跑；不动用户标题） */
  force?: boolean;
  /** 任务完成回调（enqueueJob 返回的 Promise 用；测试可 await） */
  resolve?: () => void;
}

/** FIFO 串行队列：多篇并发收敛为逐个处理（enh 包 2） */
const jobQueue: SummaryJob[] = [];
let draining = false;
/** 泵启动定时器（0ms 合并窗口）：同一突发的入队先全部落位再开跑——
 *  事件循环对同刻定时器逐个回调间会冲洗微任务，直接启动泵会让首篇抢跑、
 *  批次总数/静音判定失真；0ms 窗口内后续入队只进队不重复调度 */
let drainTimer: ReturnType<typeof setTimeout> | null = null;
/** 当前批次计数（drain 清空后归零；drain 期间新入队的任务计入本批） */
let batchTotal = 0;
let batchDone = 0;
/** 批量进度聚合通知（单条，逐任务 setMessage 更新） */
let batchNotice: NoticeHandle | null = null;

/** 入队（同一文件去重：已入队/处理中不再入队）；返回该任务完成时刻 */
function enqueueJob(job: SummaryJob): Promise<void> {
  return new Promise((resolve) => {
    if (processingPaths.has(job.file.path)) {
      resolve();
      return;
    }
    processingPaths.add(job.file.path);
    jobQueue.push({ ...job, resolve });
    batchTotal++;
    if (drainTimer === null) {
      drainTimer = setTimeout(() => {
        drainTimer = null;
        void drainQueue();
      }, 0);
    }
  });
}

/** 串行泵：一次处理一个任务直至队列清空；批次计数只在整批结束后归零 */
async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (jobQueue.length > 0) {
      const job = jobQueue.shift()!;
      batchDone++;
      updateBatchNotice();
      try {
        await processFile(job.app, job.ai, job.file, { force: job.force === true, quiet: batchTotal > 1 });
      } catch (e) {
        // processFile 内部已兜底（失败人话化 + 重试 + 日志）；此处防单任务异常打断整条队列
      } finally {
        processingPaths.delete(job.file.path);
        job.resolve?.();
      }
    }
  } finally {
    draining = false;
    if (batchNotice) {
      batchNotice.hide();
      batchNotice = null;
    }
    batchTotal = 0;
    batchDone = 0;
  }
}

/** 批量进度聚合（enh 包 2）：>1 篇合并为单条「正在生成摘要 k/N…」逐个更新；
 *  单篇仍走 processor 自带进度通知（结果原地合并语义不变） */
function updateBatchNotice(): void {
  if (batchTotal <= 1) return;
  const msg = `正在生成摘要 ${batchDone}/${batchTotal}…`;
  if (batchNotice) {
    batchNotice.setMessage(msg);
  } else {
    batchNotice = notify(msg, { type: 'progress', dedupeKey: 'auto-summary:batch' });
  }
}

function queueProcess(app: any, ai: any, file: any): void {
  if (!file || file.extension !== 'md') return;
  if (!file.path.startsWith(getWatchDir() + '/')) return;
  if (pendingPaths.has(file.path)) return;
  // 延迟处理，等 frontmatter 写入完成；timer id 入表（stop/unload 统一 clearTimeout，防停用后仍触发 AI）
  const timer = setTimeout(() => {
    pendingPaths.delete(file.path);
    void enqueueJob({ app, ai, file });
  }, 1500);
  pendingPaths.set(file.path, timer);
}

/** 手动重跑摘要（enh 包 1）：force 跳过缺失检测直接重建（只动 summary/tags，
 *  不动用户自定义标题）；走同一 FIFO 串行队列，与监听触发互斥串行 */
export function regenerateSummary(app: any, file: any): Promise<void> {
  if (!file || file.extension !== 'md') return Promise.resolve();
  return enqueueJob({ app, ai: createAI(), file, force: true });
}

/** 命令 bz-auto-summary-redo（enh 包 1）：对当前打开的笔记重跑摘要；
 *  非剪藏笔记（监听目录外）给人话提示，不触发 AI */
export async function redoSummaryForActiveFile(app: any): Promise<void> {
  const ws = app && app.workspace;
  const file = ws && typeof ws.getActiveFile === 'function' ? ws.getActiveFile() : null;
  if (!file || file.extension !== 'md' || !String(file.path || '').startsWith(getWatchDir() + '/')) {
    notify('当前打开的不是剪藏笔记，无法重新生成摘要', { type: 'info' });
    return;
  }
  await regenerateSummary(app, file);
}

/** 延迟 2000ms 注册 create + file-open 监听（原脚本防冲突语义）。
 *  ticket 124（Q14 详设三）：timing=lazy 时只注册 file-open（仅打开文件时补全），
 *  immediate（默认）保持 create+file-open 双监听（保存后立刻）。 */
function scheduleRegister(app: any): void {
  const ai = createAI();
  registerTimer = setTimeout(() => {
    registerTimer = null; // 注册完成即清引用（stop 后再开的判断依据）
    if (!vaultRef) return;
    const timing = (tryGetSettings() as any)?.autoSummaryTiming || 'immediate';
    if (timing !== 'lazy') {
      fileListenerRef = vaultRef.on('create', (file: any) => queueProcess(app, ai, file));
    }
    // 打开文件同样触发（file-open 关闭时传 null，queueProcess 内跳过）
    if (workspaceRef && typeof workspaceRef.on === 'function') {
      openListenerRef = workspaceRef.on('file-open', (file: any) => queueProcess(app, ai, file));
    }
    console.log(`[自动摘要] 👁️ 监听 ${getWatchDir()}` + (timing === 'lazy' ? '（懒触发：仅打开时）' : ''));
  }, 2000);
}

/** 幂等初始化；stop 后再开启时复用 initialized 状态重新注册监听 */
export function ensureAutoSummary(app: any): void {
  if (initialized) {
    // stop 摘除过监听且无待注册定时器 → 重新注册
    if (!registerTimer && !fileListenerRef) scheduleRegister(app);
    return;
  }
  initialized = true;
  vaultRef = app.vault;
  workspaceRef = app.workspace;
  scheduleRegister(app);
}

export function isAutoSummaryInitialized(): boolean {
  return initialized;
}

/**
 * 设置开关停用（P1-22）：仅摘除 create/file-open 监听与待注册定时器；
 * initialized 状态保留以便再开启时复用（与 unloadAutoSummary 的差异是不置 disposed/清域引用）。
 */
export function stopAutoSummary(): void {
  if (registerTimer) { clearTimeout(registerTimer); registerTimer = null; }
  if (fileListenerRef && vaultRef) {
    try { vaultRef.offref(fileListenerRef); } catch { /* 忽略 */ }
    fileListenerRef = null;
  }
  if (openListenerRef && workspaceRef) {
    try { workspaceRef.offref(openListenerRef); } catch { /* 忽略 */ }
    openListenerRef = null;
  }
  // 撤销已排队任务（clearTimeout）：停用后不再触发 AI 调用改写文件
  for (const timer of pendingPaths.values()) clearTimeout(timer);
  pendingPaths.clear();
  // 清空待处理队列、泵定时器与批次聚合态（enh 包 2）：正在处理中的单个任务不可中断，
  // 完成即止；drain 泵见队列已空自然收尾，不再处理后续任务
  if (drainTimer !== null) {
    clearTimeout(drainTimer);
    drainTimer = null;
  }
  jobQueue.length = 0;
  if (batchNotice) {
    batchNotice.hide();
    batchNotice = null;
  }
  batchTotal = 0;
  batchDone = 0;
  processingPaths.clear();
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadAutoSummary(): void {
  stopAutoSummary();
  initialized = false;
  vaultRef = null;
  workspaceRef = null;
}
