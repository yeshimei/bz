/**
 * dock 调度器 —— **bz 亲自调度自动化工具**（spec D1 修订，ADR-0236）。
 *
 * 为什么改口：原 D1 是「dock 不参与调度」，让用户在系统任务计划程序里自己配 schedule、自己
 * 写死路径、自己处理凭据。结果本域最重的活全推给用户，还换不来「漏跑能补、失败能重试、状态
 * 看得见」。改成 bz 调度之后这些自然就有 —— 代价是 **Obsidian 关着的时候不会跑**（bz 不是父
 * 进程就无从调度）。这是要认的硬后果（「要不要另留系统计划任务兜底」是后续单独议题）。
 *
 * 一次 tick 做四件事：读全部视图 → 用纯函数 `decideDue` 算出「现在该跑哪些」→ 串行跑 →
 * 记 bz 侧台账（`dockRunState`）+ 只对失败发通知。判据本体在 `decideDue`（零依赖纯函数，
 * node 可直测）；本文件剩下的部分是薄薄的运行时。
 *
 * 四条纪律：
 *  1) **不并行**：同一时刻至多一个工具在跑（一次开 N 个 node 会把机器和网络一起噎住）。
 *  2) **不连坐**：某个工具卡住/失败，后面的照跑（超时到点就 `stopRun`，不让它堵住队列）。
 *  3) **不猜**：判不出该不该跑（无基线、声明读不到）就不跑，绝不「反正先跑一下试试」。
 *  4) **不诈尸**：插件卸载后到点的定时器一律短路（同 main.ts 的 C13 精神），不在禁用后幽灵运行。
 */
import { Platform, type App } from 'obsidian';
import { notify } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import {
  displayName,
  isEnabled,
  isTrusted,
  loadToolViews,
  patchRunState,
  triggerOf,
  type DockToolView,
} from './data';
import { decideDue, missingRequiredParams, type DockSchedInput } from './schedule';
// ui 与 scheduler 互相引用（ui 里改完节奏会 kick 调度器；这里的通知要直达工具详情）——
// 双方都只在函数体内调用对方，模块顶层互不取值，ESM 循环在此安全
import { openDockTool } from './ui';
import { errorHint, liveRunOf, runTool, stopRun, type DockRunOutcome } from './runner';

// ==================== 参数 ====================

/** 启动后延迟首跑：等 workspace 就绪，别和启动加载抢资源 */
const STARTUP_DELAY_MS = 10_000;
/** 轮询间隔：兜住「Obsidian 一直开着、到了点该跑」那种（到点触发）。粗到分钟级足够 */
const TICK_MS = 60_000;
/** 失败后的冷却：这段时间内不重试同一个工具（否则每 tick 都重试，把失败放大成刷屏） */
const FAIL_COOLDOWN_MS = 15 * 60_000;
/** 连续失败到这个数就熔断，暂停该工具的自动运行（等用户在面板里手动恢复） */
const BREAKER_THRESHOLD = 3;
/** 单次运行超时：到点强行 stop，不让一个卡死的工具堵住整个队列 */
const RUN_TIMEOUT_MS = 10 * 60_000;

// ==================== 会话态 ====================

let app: App | null = null;
let isUnloaded: (() => boolean) | null = null;
let startupTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
/** 会话内锁：已排上 / 在跑的 id（防同一工具同刻跑两遍） */
const inFlight = new Set<string>();
/** 会话内冷却：id → 解禁时刻（ms） */
const cooldownUntil = new Map<string, number>();
/** 串行队列：把每批运行链起来，保证并发 = 1 */
let chain: Promise<void> = Promise.resolve();
/** 本会话已就「参数没填」提示过的（去重，免得每 tick 说一遍） */
const warnedParams = new Set<string>();

/** 自动运行总闸是否开着（缺省开，只有显式 false 才算关） */
function globalAutoOn(): boolean {
  return (tryGetSettings() as Record<string, unknown> | undefined)?.dockAutoRun !== false;
}

/**
 * 起调度（幂等）。**只在桌面端起** —— 移动端起不了子进程，自动运行没有意义。
 *
 * 注意：**不因总闸关着就不起** —— 那样用户中途打开总闸就不生效了。总闸由每次 tick 现查，
 * 所以中途开关立刻生效（`kickDockScheduler()` 可让它当拍就动）。
 */
export function startDockScheduler(a: App, unloaded: () => boolean): void {
  if (app !== null) return; // 幂等
  if (Platform.isMobile) return;
  app = a;
  isUnloaded = unloaded;
  startupTimer = setTimeout(() => {
    void tick();
    tickTimer = setInterval(() => void tick(), TICK_MS);
  }, STARTUP_DELAY_MS);
}

/** 停调度（幂等）：清定时器 + 复位会话态。**不杀在跑的子进程**（那是用户/系统的事） */
export function stopDockScheduler(): void {
  if (startupTimer !== null) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (tickTimer !== null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  app = null;
  isUnloaded = null;
  inFlight.clear();
  cooldownUntil.clear();
  warnedParams.clear();
  chain = Promise.resolve();
}

/** 立刻跑一轮判据（UI 刚把总闸打开 / 改完节奏时调，免得干等一个轮询周期） */
export function kickDockScheduler(): void {
  if (app === null) return;
  void tick();
}

// ==================== 运行时 ====================

/** 视图 → 决策输入 */
function inputOf(v: DockToolView, now: number): DockSchedInput {
  return {
    id: v.entry.id,
    name: displayName(v),
    enabled: isEnabled(v.entry),
    trusted: isTrusted(v.entry),
    trustStale: v.trustStale,
    hasRun: v.run !== null,
    autoKind: triggerOf(v.schedule) === 'auto',
    autoOn: v.autoRun,
    due: v.dueToRun,
    paramsReady: missingRequiredParams(v.manifest?.params, v.values).length === 0,
    paused: !!v.runState?.pausedAt,
    cooldown: (cooldownUntil.get(v.entry.id) ?? 0) > now,
    // 「在跑」的唯一事实源是执行层的名册（live 表）：用户手动点的那次不进 inFlight，
    // 只看自己的集合，会在手动跑到一半时把同一个工具再拉起一个进程
    running: inFlight.has(v.entry.id) || liveRunOf(v.entry.id) !== undefined,
  };
}

async function tick(): Promise<void> {
  if (app === null || isUnloaded === null) return;
  if (isUnloaded()) return;
  if (!globalAutoOn()) return;

  let views: DockToolView[];
  try {
    views = await loadToolViews(app);
  } catch {
    return; // 读不到就当这轮没到点，下轮再看（绝不把异常抛给宿主）
  }
  if (isUnloaded()) return;

  const now = Date.now();
  const { ready, skipped } = decideDue(views.map((v) => inputOf(v, now)));

  // 「参数没填」单独说一声：不是跑，而是解释这个自动工具为什么一直不动（每会话每工具一次）
  for (const s of skipped) {
    if (s.reason === 'params' && !warnedParams.has(s.input.id)) {
      warnedParams.add(s.input.id);
      notify(`${s.input.name} 没自动跑：必填参数还没填`, { type: 'warning' });
    }
  }

  if (!ready.length) return;

  const batch = chain.then(() => runBatch(ready, views));
  chain = batch.catch(() => undefined); // 一批失败不断链
  await batch;
}

/** 依次跑完一批（串行）。只对**失败**出声（成功静默，沿用 D11 精神） */
async function runBatch(ready: readonly DockSchedInput[], views: readonly DockToolView[]): Promise<void> {
  let ok = 0;
  let fail = 0;
  for (const input of ready) {
    if (isUnloaded?.()) return;
    const view = views.find((v) => v.entry.id === input.id);
    if (!view) continue;
    inFlight.add(input.id);
    let result: RunResult = 'skip';
    try {
      result = await runOne(view);
    } catch {
      result = 'fail';
    } finally {
      inFlight.delete(input.id);
    }
    if (result === 'ok') ok += 1;
    else if (result === 'fail') fail += 1;
  }
  if (fail > 0) {
    notify(`自动运行：${ok} 成 ${fail} 败`, { type: 'warning' });
  }
}

type RunResult = 'ok' | 'fail' | 'skip';

/**
 * 跑一个工具（自动形态）并记台账。返回 bz 侧判果：
 *  - `skip`：用户手动掐的（不算失败，台账不动）；
 *  - `fail`：真失败 / 超时（记失败、进冷却、出声）。
 */
async function runOne(view: DockToolView): Promise<RunResult> {
  const launch = view.run;
  if (app === null || !launch) return 'skip';
  const entry = view.entry;

  const handle = runTool(app, entry, launch, view.manifest, view.values, {}, { trigger: 'auto' });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    stopRun(entry.id); // 卡死的工具到点掐掉，不堵队列
  }, RUN_TIMEOUT_MS);

  let outcome: DockRunOutcome;
  try {
    outcome = await handle.done;
  } finally {
    clearTimeout(timer);
  }

  if (outcome.ok) {
    await patchRunState(entry.id, {
      lastAttemptAt: outcome.finishedAt,
      lastAttemptOk: true,
      consecutiveFailures: 0,
      pausedAt: undefined, // 一次成功即恢复（清熔断）
    });
    return 'ok';
  }

  // 用户手动掐的（不是超时触发的 stop）：不算失败，他大概正要自己处理
  if (outcome.stopped && !timedOut) return 'skip';

  const failures = (view.runState?.consecutiveFailures ?? 0) + 1;
  const trip = failures >= BREAKER_THRESHOLD;
  await patchRunState(entry.id, {
    lastAttemptAt: outcome.finishedAt,
    lastAttemptOk: false,
    consecutiveFailures: failures,
    ...(trip ? { pausedAt: outcome.finishedAt } : {}),
  });
  cooldownUntil.set(entry.id, Date.now() + FAIL_COOLDOWN_MS);

  notify(`${displayName(view)} 自动运行失败：${errorHint(timedOut ? 'timeout' : outcome.kind)}`, {
    type: 'error',
    // 失败通知是死的，用户就得自己开面板找是哪个工具 —— 点了直达它的详情页
    action: { label: '查看', onClick: () => openDockTool(app!, view.entry.id) },
  });
  if (trip) {
    notify(`${displayName(view)} 连续失败 ${failures} 次，已暂停自动运行（面板里可恢复）`, {
      type: 'warning',
    });
  }
  return 'fail';
}
