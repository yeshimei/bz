/**
 * 自动摘要入口（ticket 22）：监听剪藏文件夹，文件创建或打开时缺字段 AI 补全。
 * 源码：自动摘要.js L124-140（插件版：删除 quickAddApi 检查；createAI 来自 core）
 *
 * enh 包 2：pending 触发收敛为一条 FIFO 串行队列（监听触发与手动重跑共用），
 * 多篇并发逐个处理；批量（>1 篇）进度合并为单条「正在生成摘要 k/N…」逐个更新。
 * enh 包 1：regenerateSummary / redoSummaryForActiveFile 手动重跑入口（force 重建）。
 *
 * 深审修复批（bz-fix-as-core）：
 * - N1/一致#3：getWatchDir 直引 clipDir 单源（尾斜杠归一 + 缺省串单处；save.ts 零回边，
 *   静态单向引不构成模块环——宿主单源消费，ADR-0002 合规）；
 * - A3：watch 口径收窄至顶层（对齐 clipbook scanClipDirectory）——子目录个人笔记不再被补全改名；
 * - A10：AI 实例统一「每任务 createAI」（监听路径闭包共享单例退役）；
 * - EFF-2：手动任务插队（unshift 队头）+ 入队反馈；N-UI3：在队去重命中给反馈；
 * - EFF-3：连续失败熔断（≥3 篇暂停泵，常驻提示挂「继续」）；
 * - EFF-1/N-UI4：批量批次收场成败汇总（逐篇 quiet，单篇批次仍逐篇回执）；
 * - N-UI1：批次聚合通知 dedupeKey 带批次序号（不再撞 core 30s 去重窗吞掉紧随批次）；
 * - N6/A4：stop 清队逐个 resolve 存量 Promise + 只摘「排队」态去重（in-flight 防双跑保留）；
 * - AS3：重注册判据改看 openListenerRef（lazy 档 fileListenerRef 恒 null 的语义错误修正）。
 */
import { createAI } from '../core/ai';
import { tryGetSettings } from '../core/settings-provider';
import { notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { clipDir } from '../clipbook/save';
import { AUTO_SUMMARY_KEYS } from './keys';
import { processFile, type ProcessOutcome } from './processor';

/** 监听目录与剪藏本设置一致（articleDirectory）：直引 clipDir 单源（N1/一致#3） */
function getWatchDir(): string {
  return clipDir();
}

/** watch 目录顶层判定（A3）：仅目录直属文件命中，子目录（递归）不归本域管辖——
 *  clipbook scanClipDirectory 只扫顶层，两域共用同一设置键必须同半径，
 *  否则子目录里的非剪藏笔记会被 AI 补全甚至改名，而剪藏本列表永不显示它们 */
function isWatchedTopLevel(path: string): boolean {
  const dir = getWatchDir();
  const prefix = dir + '/';
  return path.startsWith(prefix) && !path.slice(prefix.length).includes('/');
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
/** 批次聚合通知键序号（N-UI1）：常量键跨批复用会撞 core 30s 去重窗——
 *  上一批开跑后 30s 内的紧随批次整批零进度指示；带序号每批复用新键 */
let batchSeq = 0;
/** EFF-3 熔断：连续失败计数与暂停挂起（非空 = 泵暂停中，等待「继续」唤醒） */
let consecutiveFailures = 0;
let resumeDrain: (() => void) | null = null;
/** 熔断阈值：连续失败 N 篇暂停队列（剩余任务留队不丢弃） */
const FAIL_LIMIT = 3;

/** 入队（同一文件去重：已入队/处理中不再入队）；priority=手动任务插队队头（EFF-2） */
function enqueueJob(job: SummaryJob, priority = false): Promise<void> {
  return new Promise((resolve) => {
    if (processingPaths.has(job.file.path)) {
      resolve();
      return;
    }
    processingPaths.add(job.file.path);
    const queued = { ...job, resolve };
    if (priority) jobQueue.unshift(queued);
    else jobQueue.push(queued);
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
  // 批次成败计数（EFF-1/N-UI4）：收场汇总只在批量（quiet）批次发，单篇批次由 processor 逐篇回执
  let okCount = 0;
  let failCount = 0;
  try {
    while (jobQueue.length > 0) {
      const job = jobQueue.shift()!;
      batchDone++;
      updateBatchNotice();
      let outcome: ProcessOutcome = 'error';
      try {
        outcome = await processFile(job.app, job.ai, job.file, { force: job.force === true, quiet: batchTotal > 1 });
      } catch (e) {
        // processFile 返回结果契约（A5）且内部已兜底；此处防意外异常打断整条队列
      } finally {
        processingPaths.delete(job.file.path);
        job.resolve?.();
      }
      if (outcome === 'ok' || outcome === 'partial') {
        okCount++;
        consecutiveFailures = 0;
      } else if (outcome === 'ai-failed' || outcome === 'write-failed') {
        failCount++;
        consecutiveFailures++;
      } else {
        consecutiveFailures = 0; // skipped-*/error 是正常早退或环境意外，不计服务连续失败
      }
      // EFF-3 熔断：连续失败 ≥3 且仍有存量任务 → 暂停泵（任务留队），常驻提示挂「继续」；
      // 挂起不收场（批次态与进度通知保留），继续后原地续跑，stop 则清队唤醒自然收场
      if (consecutiveFailures >= FAIL_LIMIT && jobQueue.length > 0) {
        const remaining = jobQueue.length;
        notify(`AI 连续失败 ${FAIL_LIMIT} 篇，批量摘要已暂停，剩余 ${remaining} 篇待处理`, {
          type: 'warning',
          duration: 0,
          actions: [
            {
              label: '继续',
              onClick: () => {
                const r = resumeDrain;
                resumeDrain = null;
                consecutiveFailures = 0;
                r?.();
              },
            },
          ],
        });
        await new Promise<void>((resolve) => {
          resumeDrain = resolve;
        });
      }
    }
  } finally {
    draining = false;
    resumeDrain = null;
    if (batchNotice) {
      batchNotice.hide();
      batchNotice = null;
    }
    // EFF-1/N-UI4 批次收场汇总：批量（quiet）批次逐篇回执已静音，成败比单条收口；
    // 全部早退（字段齐全/过短）无 AI 产出不发汇总
    if (batchTotal > 1) {
      if (failCount > 0 && okCount > 0) {
        notify(`已生成 ${okCount} 篇摘要，${failCount} 篇失败`, { type: 'warning' });
      } else if (failCount > 0) {
        notify(`批量摘要生成失败（${failCount} 篇）`, { type: 'error', duration: 0 });
      } else if (okCount > 0) {
        notify(`已生成 ${okCount} 篇摘要`, { type: 'success' });
      }
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
    // N-UI1：dedupeKey 带批次序号——常量键跨批复用会被 core 30s 去重窗吞掉紧随批次
    batchNotice = notify(msg, { type: 'progress', dedupeKey: `auto-summary:batch#${++batchSeq}` });
  }
}

function queueProcess(app: any, file: any): void {
  if (!file || file.extension !== 'md') return;
  if (!isWatchedTopLevel(file.path)) return; // A3：顶层口径（含 N1 尾斜杠归一后的目录）
  if (pendingPaths.has(file.path)) return;
  // 延迟处理，等 frontmatter 写入完成；timer id 入表（stop/unload 统一 clearTimeout，防停用后仍触发 AI）
  const timer = setTimeout(() => {
    pendingPaths.delete(file.path);
    // A10：AI 实例统一「每任务 createAI」（与手动入口一致；AIService 构造纯赋值，实例随任务生命周期走）
    void enqueueJob({ app, ai: createAI(), file });
  }, 1500);
  pendingPaths.set(file.path, timer);
}

/** 手动重跑摘要（enh 包 1）：force 跳过缺失检测直接重建（只动 summary/tags，
 *  不动用户自定义标题）；走同一 FIFO 串行队列，与监听触发互斥串行。
 *  EFF-2：手动任务插队队头（unshift）；N-UI3：撞在队/处理中去重给反馈不静默吞。 */
export function regenerateSummary(app: any, file: any): Promise<void> {
  if (!file || file.extension !== 'md') return Promise.resolve();
  if (processingPaths.has(file.path)) {
    notify('该篇正在处理中，请稍后再试', { type: 'info' });
    return Promise.resolve();
  }
  if (draining) notify('已加入摘要队列，当前篇完成后优先处理', { type: 'info' });
  return enqueueJob({ app, ai: createAI(), file, force: true }, true);
}

/** 失败通知「重试」入口（F9）：与手动重跑共用 FIFO 串行队列——processingPaths 去重，
 *  双击/并发点按只跑一次 AI（直调 processFile 会绕过去重双倍花费）；force 语义与 AI 服务
 *  实例由调用方（processor 失败通知）透传，重试行为不变。EFF-2 插队 + N-UI3 反馈同上。 */
export function retrySummaryWithAI(app: any, ai: any, file: any, force: boolean): Promise<void> {
  if (!file || file.extension !== 'md') return Promise.resolve();
  if (processingPaths.has(file.path)) {
    notify('该篇正在处理中，请稍后再试', { type: 'info' });
    return Promise.resolve();
  }
  if (draining) notify('已加入摘要队列，当前篇完成后优先处理', { type: 'info' });
  return enqueueJob({ app, ai, file, force }, true);
}

/** 命令 bz-auto-summary-redo（enh 包 1）：对当前打开的笔记重跑摘要；
 *  非剪藏笔记（监听目录顶层外）给人话提示，不触发 AI */
export async function redoSummaryForActiveFile(app: any): Promise<void> {
  const ws = app && app.workspace;
  const file = ws && typeof ws.getActiveFile === 'function' ? ws.getActiveFile() : null;
  if (!file || file.extension !== 'md' || !isWatchedTopLevel(String(file.path || ''))) {
    notify('当前打开的不是剪藏笔记，无法重新生成摘要', { type: 'info' });
    return;
  }
  await regenerateSummary(app, file);
}

/** 延迟 2000ms 注册 create + file-open 监听（原脚本防冲突语义）。
 *  ticket 124（Q14 详设三）：timing=lazy 时只注册 file-open（仅打开文件时补全），
 *  immediate（默认）保持 create+file-open 双监听（保存后立刻）。 */
function scheduleRegister(app: any): void {
  registerTimer = setTimeout(() => {
    registerTimer = null; // 注册完成即清引用（stop 后再开的判断依据）
    if (!vaultRef) return;
    const timing = (tryGetSettings() as any)?.[AUTO_SUMMARY_KEYS.timing] || 'immediate';
    if (timing !== 'lazy') {
      fileListenerRef = vaultRef.on('create', (file: any) => queueProcess(app, file));
    }
    // 打开文件同样触发（file-open 关闭时传 null，queueProcess 内跳过）
    if (workspaceRef && typeof workspaceRef.on === 'function') {
      openListenerRef = workspaceRef.on('file-open', (file: any) => queueProcess(app, file));
    }
  }, 2000);
}

/** 幂等初始化；stop 后再开启时复用 initialized 状态重新注册监听 */
export function ensureAutoSummary(app: any): void {
  if (initialized) {
    // stop 摘除过监听且无待注册定时器 → 重新注册。
    // AS3：判据看 openListenerRef（两档时机下 file-open 监听恒注册，是「监听在位」的
    // 单一真相信号）——旧判据看 fileListenerRef 在 lazy 档恒 null，重复 ensure 会双注册
    if (!registerTimer && !openListenerRef) scheduleRegister(app);
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
  // 完成即止；drain 泵见队列已空自然收尾，不再处理后续任务。
  // N6：清队前逐个 resolve 队内任务——await 的手动入口（regenerateSummary）不再永挂；
  // A4：只摘「排队」态的去重标记（in-flight「处理中」标记保留至泵 finally 自摘，防双跑窗口）
  if (resumeDrain) {
    // 熔断暂停中的泵先唤醒：队列已清空，收场对称
    const r = resumeDrain;
    resumeDrain = null;
    r();
  }
  for (const j of jobQueue) {
    processingPaths.delete(j.file.path);
    j.resolve?.();
  }
  jobQueue.length = 0;
  if (drainTimer !== null) {
    clearTimeout(drainTimer);
    drainTimer = null;
  }
  if (batchNotice) {
    batchNotice.hide();
    batchNotice = null;
  }
  batchTotal = 0;
  batchDone = 0;
  consecutiveFailures = 0;
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadAutoSummary(): void {
  stopAutoSummary();
  initialized = false;
  vaultRef = null;
  workspaceRef = null;
}

/**
 * 测试 seam（T5）：冲洗模块级队列/注册/批次/熔断全部状态——
 * 替代测试 afterEach 手工微任务冲洗与门控放行兜底，消除跨用例滞留（draining 曾经咬人）。
 */
export function __resetForTest(): void {
  stopAutoSummary();
  unloadAutoSummary();
  consecutiveFailures = 0;
  resumeDrain = null;
  batchSeq = 0;
}
