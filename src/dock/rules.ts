/**
 * 规则表 v2 —— **触发条件 → 执行**（纯函数，零 import，node 可直测）。
 *
 * 方向（2026-10-04 用户拍板，取代被回滚的 ADR-0238）：一条规则 = **一个触发条件** + **一个执行**。
 * 日期不再是主干，只是触发条件池里的一类条目 —— 与「网络恢复」「打开面板」「别的工具跑完」
 * 平起平坐。多条件表达为多行（天然 OR），不在行内做 AND。
 *
 * 三条纪律，与调度器共用：
 *  1) **判据是纯函数**：给定触发条件 + 事实（上次命中、会话起点、事件载荷）→ 答「现在该不该跑」，
 *     不读文件、不掷随机、不发通知。随机延迟（`jitterMin`）与副作用全在调度器那一侧。
 *  2) **判不出就不跑**（沿用 D 系列「不猜」）：缺基线时只回答「说不好」，不假装到点。
 *  3) **每条规则各自记账**：`lastFiredAt` 按规则记（`ruleState`），不共享一副全局欠账 ——
 *     两条规则分属不同触发条件，共享账会让「A 跑了」把 B 的欠一并清掉。
 *
 * 精度：**到分钟**（`daily.at` = "HH:MM"、`interval.everyMin`、`on-launch.delayMin`、
 * `jitterMin`）。秒级用不上 —— 调度器是分钟级 tick，多一位精度只会让界面变长。
 */

import type { DockSchedule } from './schema';

// ==================== 类型 ====================

/** 触发条件 —— 九种，UI 下拉的唯一来源见 `TRIGGER_KINDS` */
export type DockTrigger =
  /** 每天某时刻（周期语义，不是「某一天」） */
  | { kind: 'daily'; at: string }
  /** 固定间隔 */
  | { kind: 'interval'; everyMin: number }
  /** Obsidian 启动后 N 分钟，且本会话还没跑过 */
  | { kind: 'on-launch'; delayMin: number }
  /** 打开工具坞面板时 */
  | { kind: 'panel-open' }
  /** 指定工具成功收尾后 */
  | { kind: 'tool-ok'; toolId: string }
  /** 指定工具失败后 */
  | { kind: 'tool-fail'; toolId: string }
  /** bz 域事件总线上的某条通道（`<域名>:<事件>`） */
  | { kind: 'domain-event'; channel: string }
  /** vault 里某个目录 / 某个类下的文件变化 */
  | { kind: 'vault-file'; target: string }
  /** 某个数据值达到阈值（值由调度器读完传进来，判据只做比较） */
  | { kind: 'data-threshold'; path: string; key: string; op: '>' | '<' | '='; value: number };

export type DockTriggerKind = DockTrigger['kind'];

/** 执行 —— 两种动作，`notify` / `open` 是它们的修饰 */
export type DockAction =
  | { kind: 'run'; notify?: 'never' | 'fail' | 'always' }
  | { kind: 'remind'; open?: string };

export type DockActionKind = DockAction['kind'];

/** 一条规则（住登记项 `DockToolEntry.rules`） */
export interface DockRule {
  /** 面板内稳定 id（本机生成，非用户输入；记账键就是它） */
  id: string;
  /** 规则名；缺省「规则 N」由 UI 补 */
  name?: string;
  /** 缺省 true */
  enabled?: boolean;
  trigger: DockTrigger;
  action: DockAction;
  /** 随机延迟上限（分钟）：到点后再等 0~N 分钟才跑，用来错峰。0 / 缺省 = 不抖 */
  jitterMin?: number;
}

/** 触发类型清单 —— 编辑器下拉的唯一来源（顺序即展示顺序） */
export const TRIGGER_KINDS: readonly DockTriggerKind[] = [
  'daily',
  'interval',
  'on-launch',
  'panel-open',
  'tool-ok',
  'tool-fail',
  'domain-event',
  'vault-file',
  'data-threshold',
];

/** 触发类型的中文名（面板用） */
export const TRIGGER_LABEL: Record<DockTriggerKind, string> = {
  daily: '每天某时',
  interval: '每隔一段时间',
  'on-launch': '启动 Obsidian 后',
  'panel-open': '打开工具坞时',
  'tool-ok': '某个工具成功后',
  'tool-fail': '某个工具失败后',
  'domain-event': '某个事件发生时',
  'vault-file': '某个目录有变动',
  'data-threshold': '某个数值达到条件',
};

/** 动作的中文名 */
export const ACTION_LABEL: Record<DockActionKind, string> = {
  run: '运行',
  remind: '只提醒',
};

// ==================== 判据 ====================

/** 事件触发这次携带的事实（非事件类触发不看它） */
export interface RuleEvent {
  kind: 'panel-open' | 'tool-ok' | 'tool-fail' | 'domain-event' | 'vault-file';
  /** tool-ok / tool-fail：哪个工具 */
  toolId?: string;
  /** domain-event：通道名 */
  channel?: string;
  /** vault-file：变化文件的 vault 相对路径 */
  path?: string;
}

/** 判据上下文 —— 由调度器（或 UI 预估下次时刻）装配 */
export interface RuleCtx {
  now: number;
  /** 本规则上次命中时刻（ms）；没有过就是 undefined */
  lastFiredAt?: number;
  /** 本会话（Obsidian 这次启动）起点时刻（ms），`on-launch` 用 */
  sessionStart?: number;
  /** 本次事件（只有事件类触发看） */
  event?: RuleEvent;
  /** `data-threshold` 的当前值（由调度器读完传入；读不到就是 undefined） */
  value?: number;
}

/** "HH:MM" → 当天过去的秒数（兼容旧的 "HH:MM:SS" 写法）；解析失败返回 undefined */
export function atSecondsOf(at: string | undefined): number | undefined {
  if (!at) return undefined;
  const m = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(at.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  const s = m[3] === undefined ? 0 : Number(m[3]);
  if (h > 23 || mi > 59 || s > 59) return undefined;
  return h * 3600 + mi * 60 + s;
}

/** 当天零点（本地时区） */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** `at` 在 `now` 所在当天的落点时刻（ms）；解析不出返回 undefined */
export function todayAt(trigger: { kind: 'daily'; at: string }, now: number): number | undefined {
  const sec = atSecondsOf(trigger.at);
  if (sec === undefined) return undefined;
  return startOfDay(now) + sec * 1000;
}

/**
 * 这条规则此刻该不该跑。**纯函数**：同样的入参永远同样的答案。
 *
 * 时间类（daily / interval / on-launch）看 `lastFiredAt`；事件类看 `ctx.event` —— 事件是「已经发生
 * 过一次」的瞬时事实，所以事件类的防重放在调度器（同一事件只 kick 一次），判据只负责匹配。
 */
export function ruleDue(rule: DockRule, ctx: RuleCtx): boolean {
  const t = rule.trigger;
  switch (t.kind) {
    case 'daily': {
      const at = todayAt(t, ctx.now);
      if (at === undefined) return false;
      if (ctx.now < at) return false; // 还没到点
      return (ctx.lastFiredAt ?? 0) < at; // 今天这个点之后还没跑过
    }
    case 'interval': {
      if (!(t.everyMin > 0)) return false;
      if (ctx.lastFiredAt === undefined) return true; // 首次：没有基线也跑一次
      return ctx.now - ctx.lastFiredAt >= t.everyMin * 60000;
    }
    case 'on-launch': {
      const base = ctx.sessionStart;
      if (base === undefined) return false;
      if (ctx.now < base + t.delayMin * 60000) return false; // 还没到延迟
      return (ctx.lastFiredAt ?? 0) < base; // 本会话还没跑过
    }
    case 'panel-open':
      return ctx.event?.kind === 'panel-open';
    case 'tool-ok':
      return ctx.event?.kind === 'tool-ok' && ctx.event.toolId === t.toolId;
    case 'tool-fail':
      return ctx.event?.kind === 'tool-fail' && ctx.event.toolId === t.toolId;
    case 'domain-event':
      return ctx.event?.kind === 'domain-event' && ctx.event.channel === t.channel;
    case 'vault-file': {
      if (ctx.event?.kind !== 'vault-file') return false;
      const p = ctx.event.path ?? '';
      if (!p) return false;
      const target = t.target.replace(/\/+$/, '');
      return p === target || p.startsWith(target + '/');
    }
    case 'data-threshold': {
      if (ctx.value === undefined) return false; // 读不到值 → 判不出就不跑
      if (t.op === '>') return ctx.value > t.value;
      if (t.op === '<') return ctx.value < t.value;
      return ctx.value === t.value;
    }
  }
}

/** 该触发是不是「靠事件」的（决定 UI 要不要显示「下次预计」） */
export function isEventTrigger(kind: DockTriggerKind): boolean {
  return (
    kind === 'panel-open' ||
    kind === 'tool-ok' ||
    kind === 'tool-fail' ||
    kind === 'domain-event' ||
    kind === 'vault-file' ||
    kind === 'data-threshold'
  );
}

/** 下次该跑的时刻（ms）。事件类返回 null（「等事件」，算不出钟点） */
export function nextDueOf(rule: DockRule, ctx: RuleCtx): number | null {
  const t = rule.trigger;
  switch (t.kind) {
    case 'daily': {
      const today = todayAt(t, ctx.now);
      if (today === undefined) return null;
      if (ctx.now < today && (ctx.lastFiredAt ?? 0) < today) return today;
      // 今天这次已经跑过 / 已经过点 → 明天
      return today + 86400000;
    }
    case 'interval': {
      if (!(t.everyMin > 0)) return null;
      if (ctx.lastFiredAt === undefined) return ctx.now; // 首次：就是现在
      return ctx.lastFiredAt + t.everyMin * 60000;
    }
    case 'on-launch': {
      if (ctx.sessionStart === undefined) return null;
      const at = ctx.sessionStart + t.delayMin * 60000;
      return (ctx.lastFiredAt ?? 0) < ctx.sessionStart ? at : null;
    }
    default:
      return null;
  }
}

// ==================== 人话（面板用，通知正文不带 emoji） ====================

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 时间串 → 「HH:MM」（UI 展示；秒位一律抹掉） */
export function clockText(at: string): string {
  const sec = atSecondsOf(at);
  if (sec === undefined) return at;
  return `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}`;
}

/** 分钟数 → 「5 分钟 / 2 小时」 */
export function durationText(min: number): string {
  if (min % 60 === 0 && min >= 60) return `${min / 60} 小时`;
  return `${min} 分钟`;
}

/** 触发条件 → 一行中文（卡片与行卡共用） */
export function triggerText(t: DockTrigger, toolNameOf?: (id: string) => string): string {
  const name = (id: string): string => (toolNameOf ? toolNameOf(id) : id);
  switch (t.kind) {
    case 'daily':
      return `每天 ${clockText(t.at)}`;
    case 'interval':
      return `每 ${durationText(t.everyMin)}`;
    case 'on-launch':
      return `启动后 ${durationText(t.delayMin)}`;
    case 'panel-open':
      return '打开工具坞时';
    case 'tool-ok':
      return `${name(t.toolId)} 成功后`;
    case 'tool-fail':
      return `${name(t.toolId)} 失败后`;
    case 'domain-event':
      return `事件 ${t.channel}`;
    case 'vault-file':
      return `${t.target} 有变动`;
    case 'data-threshold':
      return `${t.path} ${t.key} ${t.op} ${t.value}`;
  }
}

/** 执行 → 一行中文 */
export function actionText(a: DockAction): string {
  if (a.kind === 'remind') return a.open ? '只提醒（通知可跳转）' : '只提醒';
  return a.notify === 'always' ? '运行并提醒' : a.notify === 'fail' ? '运行（失败才提醒）' : '运行';
}

/** 规则名（缺省补「规则 N」，N 为调用方给的序号） */
export function ruleName(rule: DockRule, index: number): string {
  return rule.name?.trim() || `规则 ${index + 1}`;
}

/** 本机生成规则 id（不追求全局唯一，面板内稳定够用） */
export function newRuleId(now: number = Date.now()): string {
  return `r${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// ==================== 草稿（UI 编辑器 → 类型化触发） ====================

/**
 * 默认触发条件（新建一条规则时的初值）。
 *
 * 选 `daily` 12:00 而不是「空」：让人打开就能改，不用先选一个类型才看见字段
 * （与旧节奏编辑器的取向一致）。
 */
export function defaultTrigger(): DockTrigger {
  return { kind: 'daily', at: '12:00' };
}

export function defaultAction(): DockAction {
  return { kind: 'run', notify: 'fail' };
}

// ==================== 生效规则表（规则表 ⊕ 旧节奏的种子回落） ====================

/**
 * 旧节奏 → 一条种子规则（读侧映射，**不写盘迁移**）。
 *
 * 只认能一一对应的两种：`daily`（hour → 当天的 "HH:00"）与 `interval`（everyHours → 分钟）。
 * `weekly` 在新模型里没有对应条目（用户本轮没选「每周多天」），映射不出来就返回 null ——
 * 宁可这条工具暂时没有规则（面板上看得见、加得回来），也不要揣测成别的节奏。
 */
export function seedRuleFromSchedule(s: DockSchedule | undefined, id: string): DockRule | null {
  if (!s) return null;
  if (s.kind === 'daily') {
    const h = s.hour ?? 12;
    return { id, trigger: { kind: 'daily', at: `${pad2(h)}:00` }, action: defaultAction() };
  }
  if (s.kind === 'interval' && s.everyHours) {
    return {
      id,
      trigger: { kind: 'interval', everyMin: s.everyHours * 60 },
      action: defaultAction(),
    };
  }
  return null;
}

/**
 * 某工具此刻**生效的规则表**。
 *
 * 优先级：登记项的 `rules`（非空）→ 旧的 `scheduleOverride` 折一条种子 → 声明里的 `schedule` 折一条种子
 * → 空表。规则表一旦非空，脚本日后改默认值不再动它（种子只在表为空时才存在）。
 */
export function effectiveRules(
  rules: readonly DockRule[] | undefined,
  override: DockSchedule | undefined,
  declared: DockSchedule | undefined,
): DockRule[] {
  if (rules && rules.length) return rules.slice();
  const seed = seedRuleFromSchedule(override, 'seed') ?? seedRuleFromSchedule(declared, 'seed');
  return seed ? [seed] : [];
}

/** 该工具有没有启用中的规则（面板「自动化 / 手动」两分区的唯一判据） */
export function hasActiveRule(rules: readonly DockRule[]): boolean {
  return rules.some((r) => r.enabled !== false);
}

// ==================== 反序列化（登记表读侧） ====================

/**
 * 脏值校验的同一把尺子：**登记项落地前先过这里**，读不出来的规则整条丢弃。
 *
 * 为什么要单写一份而不是直接用 `as`：登记表是 `dock.json` 里的用户可编辑文本，写坏了要让
 * 面板照样开得起来（丢坏的那条，不连累其余）。少了这一层，写进去的规则读回来就没了——
 * 表现是「面板上改了，刷新又变回原样」。
 */
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

/** 整数并夹在 [min,max]；不是整数 / 越界 → undefined（由调用方决定回落） */
function intOf(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const n = Math.floor(v);
  if (n < min || n > max) return undefined;
  return n;
}

function parseTrigger(raw: unknown): DockTrigger | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case 'daily': {
      const at = str(r.at);
      if (!at || atSecondsOf(at) === undefined) return null;
      return { kind: 'daily', at: clockText(at) }; // 统一成「HH:MM」
    }
    case 'interval': {
      const everyMin = intOf(r.everyMin, 1, 43200);
      return everyMin === undefined ? null : { kind: 'interval', everyMin };
    }
    case 'on-launch': {
      const delayMin = intOf(r.delayMin, 0, 1440);
      return delayMin === undefined ? null : { kind: 'on-launch', delayMin };
    }
    case 'panel-open':
      return { kind: 'panel-open' };
    case 'tool-ok':
      return { kind: 'tool-ok', toolId: str(r.toolId) ?? '' };
    case 'tool-fail':
      return { kind: 'tool-fail', toolId: str(r.toolId) ?? '' };
    case 'domain-event':
      return { kind: 'domain-event', channel: str(r.channel) ?? '' };
    case 'vault-file':
      return { kind: 'vault-file', target: str(r.target) ?? '' };
    case 'data-threshold': {
      const op = r.op;
      if (op !== '>' && op !== '<' && op !== '=') return null;
      // 阈值读不出就整条丢：回落成 0 会让「< 0」「= 0」这类规则自己点火
      const value = r.value;
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      return {
        kind: 'data-threshold',
        path: str(r.path) ?? '',
        key: str(r.key) ?? '',
        op,
        value,
      };
    }
    default:
      return null;
  }
}

function parseAction(raw: unknown): DockAction | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === 'remind') {
    const open = str(r.open);
    return open ? { kind: 'remind', open } : { kind: 'remind' };
  }
  if (r.kind !== 'run') return null;
  const n = r.notify;
  return { kind: 'run', notify: n === 'always' || n === 'fail' || n === 'never' ? n : 'fail' };
}

/** 单条规则：读不出（连触发条件都不成立）就 null，由调用方丢弃 */
export function parseRule(raw: unknown): DockRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  const trigger = parseTrigger(r.trigger);
  if (!trigger) return null;
  const out: DockRule = { id, trigger, action: parseAction(r.action) ?? defaultAction() };
  const name = str(r.name);
  if (name) out.name = name;
  if (typeof r.enabled === 'boolean') out.enabled = r.enabled;
  const jit = intOf(r.jitterMin, 0, 720);
  if (jit !== undefined) out.jitterMin = jit;
  return out;
}

/** 规则表：逐条校验，脏值丢弃，同 id 只留第一条 */
export function parseRules(raw: unknown): DockRule[] {
  if (!Array.isArray(raw)) return [];
  const out: DockRule[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = parseRule(item);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    out.push(parsed);
  }
  return out;
}

/** 规则记账表（规则 id → 上次命中 ISO）。脏值丢弃，空表返回 undefined（不写空对象） */
export function parseRuleState(raw: unknown): Record<string, { lastFiredAt?: string }> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, { lastFiredAt?: string }> = {};
  let any = false;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const at = str((v as Record<string, unknown>).lastFiredAt);
    if (!at) continue;
    out[k] = { lastFiredAt: at };
    any = true;
  }
  return any ? out : undefined;
}
