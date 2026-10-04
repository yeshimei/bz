/**
 * dock 调度器 —— **规则表 v2：触发条件 → 执行**（取代 2026-10-04 被回滚的「单节奏 + 旋钮」那版）。
 *
 * 与 v1 的差别只有一句：判据的输入从「一个工具的生效节奏」换成「一个工具的一串规则」——
 * 每条规则自带触发条件（时间 / 事件）与执行（跑 / 只提醒）。tick 保持 **60 秒**：
 * 触发条件精确到分，分钟级轮询就够。
 *
 * 一次 tick 做五件事：读全部视图 → 收走本拍的事件 → 逐条规则问 `ruleDue`（纯函数）→
 * 命中即**先记账再执行**（记账在跑之前，否则下一拍又命中）→ 串行跑 / 发提醒。
 *
 * 四条纪律（沿用 v1）：
 *  1) **不并行**：同一时刻至多一个工具在跑（一次开 N 个 node 会把机器和网络一起噎住）。
 *  2) **不连坐**：某个工具卡住/失败，后面的照跑（超时到点就 `stopRun`，不让它堵住队列）。
 *  3) **不猜**：判不出该不该跑（没基线、读不到值、声明读不到）就不跑。
 *  4) **不诈尸**：插件卸载后到点的定时器一律短路。
 */
import { Platform, type App } from 'obsidian';
import { notify } from '../core/notice';
import { onDomainEvent } from '../core/domain-bus';
import {
  displayName,
  isEnabled,
  isTrusted,
  loadToolViews,
  patchRuleFired,
  patchRunState,
  readDockSwitch,
  recordRunSuccess,
  type DockToolView,
} from './data';
import { loadDockStore } from './store';
import { missingRequiredParams } from './schedule';
import { ruleDue, type DockRule, type DockTrigger, type RuleEvent } from './rules';
// ui 与 scheduler 互相引用（ui 里改完规则会 kick 调度器；这里的通知要直达工具详情）——
// 双方都只在函数体内调用对方，模块顶层互不取值，ESM 循环在此安全
import { openDockTool } from './ui';
import { errorHint, liveRunOf, runTool, stopRun, type DockRunOutcome } from './runner';

// ==================== 参数 ====================

/** 启动后延迟首跑：等 workspace 就绪，别和启动加载抢资源 */
const STARTUP_DELAY_MS = 3_000;
/** 轮询间隔：分钟级 —— 触发条件精确到分，tick 跟上就够了 */
const TICK_MS = 60_000;
/** 失败后的冷却：这段时间内不重试同一个工具 */
const FAIL_COOLDOWN_MS = 15 * 60_000;
/** 连续失败到这个数就熔断，暂停该工具的自动运行（等用户在面板里手动恢复） */
const BREAKER_THRESHOLD = 3;
/** 单次运行超时：到点强行 stop，不让一个卡死的工具堵住整个队列（core 侧有强杀升级兜底） */
const RUN_TIMEOUT_MS = 10 * 60_000;

/** vault 文件事件在总线上的通道（`obsidian-adapter` 转译后的名字）。订阅是精确通道，只能逐一列出 */
const VAULT_CHANNELS = ['vault:md-created', 'vault:md-modified', 'vault:md-deleted'];

// ==================== 会话态 ====================

let app: App | null = null;
let isUnloaded: (() => boolean) | null = null;
/** 本会话起点（`on-launch` 的基准时刻） */
let sessionStart = 0;
let startupTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
/** 会话内锁：已排上 / 在跑的 id（防同一工具同刻跑两遍） */
const inFlight = new Set<string>();
/** 会话内冷却：id → 解禁时刻（ms） */
const cooldownUntil = new Map<string, number>();
/** 串行队列：把每批运行链起来，保证并发 = 1 */
let chain: Promise<void> = Promise.resolve();
/** 本会话已就「参数没填」提示过的（去重） */
const warnedParams = new Set<string>();
/** 本拍待消费的事件（事件到达时入队并 kick） */
let pendingEvents: RuleEvent[] = [];
/** 已订阅的总线通道 → 退订函数（规则表变了要重订） */
const subscriptions = new Map<string, () => void>();
/** 正在跑 tick（事件在 tick 期间到达时只入队，避免递归重入） */
let ticking = false;
let kickQueued = false;

/** 自动运行总闸是否开着（缺省开，只有显式 false 才算关；读面板数据 `dock.json`） */
function globalAutoOn(): boolean {
  return readDockSwitch('autoRun');
}

/**
 * 起调度（幂等）。**只在桌面端起** —— 移动端起不了子进程。
 * **不因总闸关着就不起**：总闸每次 tick 现查，中途开关立刻生效。
 */
export function startDockScheduler(a: App, unloaded: () => boolean): void {
  if (app !== null) return; // 幂等
  if (Platform.isMobile) return;
  app = a;
  isUnloaded = unloaded;
  sessionStart = Date.now();
  startupTimer = setTimeout(() => {
    void tick();
    tickTimer = setInterval(() => void tick(), TICK_MS);
  }, STARTUP_DELAY_MS);
}

/** 停调度（幂等）：清定时器、退总线订阅、复位会话态。**不杀在跑的子进程** */
export function stopDockScheduler(): void {
  if (startupTimer !== null) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (tickTimer !== null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  for (const off of subscriptions.values()) off();
  subscriptions.clear();
  pendingEvents = [];
  app = null;
  isUnloaded = null;
  inFlight.clear();
  cooldownUntil.clear();
  warnedParams.clear();
  chain = Promise.resolve();
}

/** 立刻跑一轮判据（UI 刚改完规则 / 开了总闸时调，免得干等一拍） */
export function kickDockScheduler(): void {
  if (app === null) return;
  void tick();
}

/**
 * 喂一个事件进来（面板打开、工具跑完、总线事件都会被转到这里）。
 *
 * 事件是**瞬时事实**：入队后当作「本拍刚发生」，下一拍就清空 —— 因此不需要额外的防重账本。
 * tick 进行中时只入队不递归，等这一拍收尾时补一次 kick。
 */
export function notifyDockEvent(ev: RuleEvent): void {
  if (app === null) return;
  pendingEvents.push(ev);
  if (ticking) {
    kickQueued = true;
    return;
  }
  kickDockScheduler();
}

// ==================== 订阅 ====================

/** 总线载荷里取 vault 相对路径（宽容：转译层给的是 file 对象或 {path}） */
function pathOfPayload(evt: unknown): string {
  const e = evt as { path?: unknown; file?: { path?: unknown } } | null;
  if (!e) return '';
  if (typeof e.path === 'string') return e.path;
  const p = e.file?.path;
  return typeof p === 'string' ? p : '';
}

/** 总线事件 → 判据认得的载荷形态 */
function fromBus(channel: string, evt: unknown): RuleEvent {
  if (channel.startsWith('vault:')) return { kind: 'vault-file', path: pathOfPayload(evt) };
  return { kind: 'domain-event', channel };
}

/**
 * 让订阅集合与「当前规则表真正用到的通道」对齐。
 *
 * 订阅是**精确通道**（总线没有通配），所以每条规则用到哪个通道就得订哪个；规则删掉后再退掉。
 * 每次 tick 调一次：规则表是文件里的数据，可能被外部改。
 */
function syncSubscriptions(views: readonly DockToolView[]): void {
  const wanted = new Set<string>();
  for (const v of views) {
    for (const r of v.rules) {
      if (r.enabled === false) continue;
      if (r.trigger.kind === 'domain-event') wanted.add(r.trigger.channel);
      else if (r.trigger.kind === 'vault-file') for (const c of VAULT_CHANNELS) wanted.add(c);
    }
  }
  for (const [ch, off] of [...subscriptions]) {
    if (!wanted.has(ch)) {
      off();
      subscriptions.delete(ch);
    }
  }
  for (const ch of wanted) {
    if (subscriptions.has(ch)) continue;
    subscriptions.set(
      ch,
      onDomainEvent(ch, (evt) => notifyDockEvent(fromBus(ch, evt))),
    );
  }
}

// ==================== 门槛 ====================

/** 「跑」这条动作的硬门槛（任一不满足就不跑；顺序即原因优先级） */
function runGate(v: DockToolView, now: number): string | null {
  if (!isEnabled(v.entry)) return 'disabled';
  if (!isTrusted(v.entry)) return 'untrusted';
  if (v.trustStale) return 'trust-stale';
  if (!v.run) return 'no-run';
  if (v.runState?.pausedAt) return 'paused';
  if (inFlight.has(v.entry.id) || liveRunOf(v.entry.id) !== undefined) return 'running';
  if ((cooldownUntil.get(v.entry.id) ?? 0) > now) return 'cooldown';
  if (missingRequiredParams(v.manifest?.params, v.values).length > 0) return 'params';
  return null;
}

/** 「只提醒」的门槛只有一条：工具没被停用（它不拉进程，不碰信任也不记台账） */
function remindGate(v: DockToolView): string | null {
  return isEnabled(v.entry) ? null : 'disabled';
}

// ==================== 数值型触发的读值 ====================

/** 读到的数值缓存（路径+键 → 值）。一分钟一拍，别每拍都去读一次文件 */
const valueCache = new Map<string, { at: number; v: number | undefined }>();
const VALUE_TTL_MS = 10_000;

/** 从 vault 里一个 json 文件读某个键的数值（支持 `a.b.c` 这种点路径）。读不到就 undefined —— 判不出就不跑 */
async function readJsonNumber(a: App, path: string, key: string): Promise<number | undefined> {
  try {
    const raw = await a.vault.adapter.read(path);
    const obj = JSON.parse(raw) as unknown;
    const v = key
      .split('.')
      .reduce<unknown>(
        (o, k) => (typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[k] : undefined),
        obj,
      );
    return typeof v === 'number' ? v : undefined;
  } catch {
    return undefined; // 文件没有 / 解析坏了 / 值不是数 —— 一律当读不到，不猜
  }
}

async function cachedValue(key: string, read: () => Promise<number | undefined>): Promise<number | undefined> {
  const hit = valueCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < VALUE_TTL_MS) return hit.v;
  const v = await read();
  valueCache.set(key, { at: now, v });
  return v;
}

/** 只有 `data-threshold` 才需要读值，其余触发返回 undefined（判据不看它） */
async function thresholdValueOf(a: App, t: DockTrigger): Promise<number | undefined> {
  if (t.kind !== 'data-threshold') return undefined;
  return cachedValue(`${t.path}#${t.key}`, () => readJsonNumber(a, t.path, t.key));
}

// ==================== 运行时 ====================

async function tick(): Promise<void> {
  if (app === null || isUnloaded === null) return;
  if (isUnloaded()) return;
  if (ticking) return; // 防重入（一分钟一拍，慢的一拍没走完就跳过）
  ticking = true;
  try {
    // 面板数据（含总闸）现读：外部改了 `dock.json` 也在下一拍生效
    try {
      await loadDockStore();
    } catch {
      /* 用现有快照 */
    }
    if (!globalAutoOn()) return;

    let views: DockToolView[];
    try {
      views = await loadToolViews(app);
    } catch {
      return; // 读不到就当这拍没到点（绝不把异常抛给宿主）
    }
    if (isUnloaded()) return;

    syncSubscriptions(views);

    const now = Date.now();
    const events = pendingEvents; // 本拍的事件（消费掉即清空）
    pendingEvents = [];

    for (const v of views) {
      if (!v.rules.length) continue;
      for (const rule of v.rules) {
        if (rule.enabled === false) continue;
        const lastFiredAt = v.ruleFiredAt[rule.id];
        const base = { now, lastFiredAt, sessionStart };
        // 只有 data-threshold 需要现值（读文件，走 TTL 缓存）；其余触发不读盘
        const value =
          rule.trigger.kind === 'data-threshold'
            ? await thresholdValueOf(app, rule.trigger)
            : undefined;
        const ctx = value === undefined ? base : { ...base, value };
        // 时间类看时钟；事件类看本拍收到的事件。两者都可能命中（同一拍里只跑一次）
        const hit =
          ruleDue(rule, ctx) ||
          events.some((e) => {
            // 自触发防环：「本工具跑完 → 再跑本工具」会无限套娃（事件触发不看记账）
            if ((e.kind === 'tool-ok' || e.kind === 'tool-fail') && e.toolId === v.entry.id) {
              return false;
            }
            return ruleDue(rule, { ...ctx, event: e });
          });
        if (!hit) continue;

        const isRemind = rule.action.kind === 'remind';
        const gate = isRemind ? remindGate(v) : runGate(v, now);
        if (gate === 'params' && !warnedParams.has(v.entry.id)) {
          warnedParams.add(v.entry.id);
          notify(`${displayName(v)} 没自动跑：必填参数还没填`, { type: 'warning' });
        }
        if (gate) continue;

        // 先记账再执行：一分钟一拍，不记账下一拍会再命中同一条规则
        await patchRuleFired(v.entry.id, rule.id, now);
        if (isRemind) remindOf(v, rule);
        else scheduleRun(v, rule);
      }
    }
  } finally {
    ticking = false;
    if (kickQueued) {
      kickQueued = false;
      void tick();
    }
  }
}

/** 只提醒：发一条能跳到该工具详情的通知（不拉进程、不进队列、不算失败） */
function remindOf(v: DockToolView, rule: DockRule): void {
  const why = rule.name?.trim() ? rule.name.trim() : '规则';
  notify(`${displayName(v)}：该手动跑一次了（${why}）`, {
    type: 'info',
    action: { label: '查看', onClick: () => openDockTool(app!, v.entry.id) },
  });
}

/**
 * 排一次运行。**随机延迟在这里掷骰**（判据保持纯函数）：到点后再等 `0~jitterMin` 分钟，
 * 用来错峰（整点批量触发是风控最爱的形状）。延迟期间不重复命中 —— 记账已经写过了。
 */
function scheduleRun(v: DockToolView, rule: DockRule): void {
  const min = rule.jitterMin ?? 0;
  const delayMs = min > 0 ? Math.floor(Math.random() * min * 60000) : 0;
  const go = (): void => {
    const batch = chain.then(() => runOne(v));
    chain = batch.then(
      () => undefined,
      () => undefined,
    ); // 一批失败不断链
  };
  if (delayMs > 0) setTimeout(go, delayMs);
  else go();
}

/**
 * 跑一个工具（自动形态）并记台账。返回 bz 侧判果：
 *  - `skip`：用户手动掐的（不算失败，台账不动）；
 *  - `fail`：真失败 / 超时（记失败、进冷却、出声）。
 */
async function runOne(view: DockToolView): Promise<'ok' | 'fail' | 'skip'> {
  const launch = view.run;
  if (app === null || !launch) return 'skip';
  const entry = view.entry;

  inFlight.add(entry.id);
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
    inFlight.delete(entry.id);
  }

  if (outcome.ok) {
    await recordRunSuccess(entry.id, outcome.finishedAt); // 一次成功即恢复（清熔断）
    notifyDockEvent({ kind: 'tool-ok', toolId: entry.id });
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
    action: { label: '查看', onClick: () => openDockTool(app!, view.entry.id) },
  });
  if (trip) {
    notify(`${displayName(view)} 连续失败 ${failures} 次，已暂停自动运行（面板里可恢复）`, {
      type: 'warning',
    });
  }
  notifyDockEvent({ kind: 'tool-fail', toolId: entry.id });
  return 'fail';
}
