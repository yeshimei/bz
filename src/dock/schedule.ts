/**
 * 漏跑判定与运行统计（纯函数，零 import —— node 可直接加载，便于单测）。
 *
 * 这里是「汇报完成情况」真正值钱的一半（spec D11）：**成功了不需要被汇报，失败和漏跑才需要**。
 * 判定原则：
 *  1) **只在工具自己声明了节奏时才判**。没声明 → `none`，UI 只展示「最后运行时间」，绝不猜。
 *  2) **没有基线就不喊狼**。interval 类判定需要「距上次多久」这个前提，一条记录都没有时
 *     返回 `unknown`（「还不知道该不该有」），而不是 `due`（「你该跑没跑」）。
 *  3) **还没到点不算欠**。`daily` 声明了 `hour` 时，当天的期望时刻之前返回 `pending`，
 *     而不是一过零点就标红 —— 否则每天早上打开都一片红，红多了就没人看了。
 *
 * 全部按**本地时区**判定（工具是人配的，人的作息是本地时间）。
 */

import type { DockRunRecord, DockSchedule } from './schema';

/** 判定结果。`none` = 未声明节奏；`unknown` = 已声明但缺基线，判不了 */
export type DockRunHealth = 'ok' | 'due' | 'pending' | 'unknown' | 'none';

export interface DockDueVerdict {
  state: DockRunHealth;
  /** 人话说明（卡片副文案；不带 emoji） */
  detail: string;
}

/** 终结态（`running` 不算一次运行 —— 它还没结束，不能拿它证明「今天跑过了」） */
const TERMINAL = new Set(['ok', 'failed', 'stopped', 'timeout']);

/**
 * 节奏声明 → 自动化 / 手动（spec D2：模型上是同一个实体，只由这一个字段区分）。
 *
 * 判据只有一条：**声明了要按什么节奏跑 = 自动化**。`on-demand` 是工具明说「我不按节奏跑，
 * 你点我才跑」—— 那是手动；`unknown` 与未声明同理。
 *
 * 这里是「自动化还是手动」的**唯一判据**（登记表里不再存第二份）。历史上登记里有个
 * `trigger` 字段与它并存，结果卡片标签读登记、详情页读声明，同一个工具两处说两样。
 */
export function triggerOf(schedule: DockSchedule | undefined): 'auto' | 'manual' {
  if (!schedule) return 'manual';
  return schedule.kind === 'on-demand' || schedule.kind === 'unknown' ? 'manual' : 'auto';
}

// ==================== 生效节奏（声明 ⊕ 用户覆盖） ====================

/**
 * 生效节奏 = 用户覆盖 ?? 声明里的默认值（spec D1 修订：bz 参与调度）。
 *
 * 覆盖是**整体替换**，不是字段级合并。字段级合并（只改 `hour`、其余借作者的）看着聪明，实则
 * 是「改完发现还继承了作者一个自己没注意的 `weekday`」那种幽灵行为的温床。要覆盖，就在面板上
 * 一次写全 —— 作者那份永远只当「没被覆盖时」的默认。
 */
export function effectiveSchedule(
  declared: DockSchedule | undefined,
  override: DockSchedule | undefined,
): DockSchedule | undefined {
  return override ?? declared;
}

/**
 * 节奏签名 —— 只取**参与判定**的字段（`kind` + 三个参数），**不含 `note`**：
 * 注释不参与判定，作者改个注释不该被当成「声明变了」去提示用户重看。
 */
export function scheduleSignature(s: DockSchedule | undefined): string {
  if (!s) return '';
  return [s.kind, s.hour ?? '', s.weekday ?? '', s.everyHours ?? ''].join('|');
}

/**
 * 用户能在面板里选的「节奏」形态 —— **编辑器选项的唯一来源**。
 *
 * 刻意**不含** `on-demand`：「开 / 不开」是总闸（`autoRun`）的语义，在节奏下拉里再放一个
 * 「只手动（不自动）」就是两个控件说同一件事（ADR-0236 §补记）。也不含 `unknown`/`inherit`：
 * 前者是「读不懂的声明」，后者是「恢复脚本默认」按钮内部用的哨兵，都不是用户会主动选的节奏。
 *
 * 做成常量而不是散在 `ui.ts` 里，是为了让「别把只手动加回来」这条有地方钉（`ui.ts` 拖 obsidian，
 * 进不了 node 测试）。
 */
export const EDITABLE_SCHEDULE_KINDS = ['daily', 'weekly', 'interval'] as const;

/** 面板可编辑的节奏形态 */
export type EditableScheduleKind = (typeof EDITABLE_SCHEDULE_KINDS)[number];

/**
 * 「节奏覆盖」编辑器草稿的 kind：比 `DockScheduleKind` 多一个 `inherit`（= 没改，跟随脚本默认），
 * 少一个 `unknown`（用户不会主动选「未知」）。
 *
 * 注：`on-demand` 仍在本类型里（它是合法的节奏形态，`scheduleFromDraft` 得能映射），但编辑器的
 * 节奏下拉**不再提供**它 —— 见 `EDITABLE_SCHEDULE_KINDS`。
 */
export type DockScheduleDraftKind = 'inherit' | 'daily' | 'weekly' | 'interval' | 'on-demand';

/**
 * 编辑器草稿 → 生效覆盖节奏。`inherit` 返回 `undefined`（= 清除覆盖，回落脚本默认）。
 *
 * **抽到这一层是为了可测**：这个映射有个隐蔽的错法 —— 漏掉一个 kind 就会掉进兜底的 `daily`，
 * 于是用户选的那个形态被静默换成「每天跑」（方向刚好相反）。放在 `ui.ts` 里它进不了 node
 * 测试（那份拖 `obsidian`），放这里就能钉住每个分支。
 */
export function scheduleFromDraft(
  kind: DockScheduleDraftKind,
  p: { hour: number; weekday: number; everyHours: number },
): DockSchedule | undefined {
  switch (kind) {
    case 'inherit':
      return undefined;
    case 'daily':
      return { kind: 'daily', hour: p.hour };
    case 'weekly':
      return { kind: 'weekly', weekday: p.weekday };
    case 'interval':
      return { kind: 'interval', everyHours: p.everyHours };
    case 'on-demand':
      return { kind: 'on-demand' };
  }
}

/**
 * 调度器判定「现在该跑吗」—— **与 `judgeDue` 的告警口径刻意分开**。
 *
 * 为什么不在 `judgeDue` 上挂个开关：告警回答「用户该被提醒吗」，调度回答「要不要现在跑」。
 * 这两件事在 `interval` 首次时给出**相反**的答案 —— 告警不该「喊狼」（没有基线不许说「你该跑
 * 没跑」，故 `unknown`），但调度**该跑一次**（工具刚装好，用户就是要它开工，D3 修订）。
 *
 * 判据：
 *  - `on-demand` / `unknown` / 未声明 → 永不自动跑；
 *  - `interval`：一条**终结**记录都没有 → 跑（首次）；否则同 `judgeDue`（`due` 才跑）；
 *  - `daily` / `weekly`：同 `judgeDue`（`due` 才跑）。
 */
export function isDueToRun(
  schedule: DockSchedule | undefined,
  runs: readonly DockRunRecord[],
  now: number = Date.now(),
): boolean {
  if (!schedule || schedule.kind === 'on-demand' || schedule.kind === 'unknown') return false;
  if (schedule.kind === 'interval' && lastRun(runs) === undefined) return true; // 首次：没有基线也跑一次
  return judgeDue(schedule, runs, now).state === 'due';
}

// ==================== 调度决策（bz 亲自调度自动化工具，D1 修订） ====================

/** 某个工具这次为什么不跑（顺序即优先级；只用于解释，`decideDue` 只挑「该跑的」） */
export type DockSkipReason =
  | 'disabled' // 工具被停用
  | 'untrusted' // 没建立信任
  | 'trust-stale' // 声明里的命令改了，信任作废
  | 'no-run' // 声明里没写怎么跑
  | 'not-auto' // 生效节奏不是自动化（手动 / 未声明）
  | 'auto-off' // 用户把自动运行总闸关了
  | 'params' // 必填参数还没填
  | 'paused' // 连续失败已熔断，等手动恢复
  | 'cooldown' // 上次失败后还在冷却
  | 'running' // 已经排上 / 在跑
  | 'not-due'; // 还没到点

/** 决策输入：一个工具此刻的全部相关事实（由 `DockToolView` 压出来，见 scheduler.ts） */
export interface DockSchedInput {
  id: string;
  name: string;
  enabled: boolean;
  trusted: boolean;
  trustStale: boolean;
  hasRun: boolean;
  /** 生效节奏是否为自动化（daily / weekly / interval） */
  autoKind: boolean;
  /** 用户总闸（`autoRun`） */
  autoOn: boolean;
  /** 该不该跑（`isDueToRun`） */
  due: boolean;
  /** 必填参数是否齐 */
  paramsReady: boolean;
  /** 是否已熔断暂停 */
  paused: boolean;
  /** 是否在冷却期内 */
  cooldown: boolean;
  /** 是否已排上 / 在跑 */
  running: boolean;
}

export interface DockSchedDecision {
  /** 该跑的（**保持输入顺序** —— 登记顺序即优先级） */
  ready: DockSchedInput[];
  skipped: { input: DockSchedInput; reason: DockSkipReason }[];
}

/**
 * 第一个命中的不跑原因（`null` = 该跑）。**顺序即优先级**：先判硬门槛，最后判「到点」。
 * 一个没信任的工具若报「还没到点」是误导（它压根跑不起来），所以 `untrusted` 排在 `not-due` 前。
 */
function skipReasonOf(i: DockSchedInput): DockSkipReason | null {
  if (!i.enabled) return 'disabled';
  if (!i.trusted) return 'untrusted';
  if (i.trustStale) return 'trust-stale';
  if (!i.hasRun) return 'no-run';
  if (!i.autoKind) return 'not-auto';
  if (!i.autoOn) return 'auto-off';
  if (!i.paramsReady) return 'params';
  if (i.paused) return 'paused';
  if (i.running) return 'running';
  if (i.cooldown) return 'cooldown';
  if (!i.due) return 'not-due';
  return null;
}

/**
 * 纯决策：从一批工具事实里挑出「现在该跑的」，其余给出不跑的原因。**保持输入顺序**。
 * 顺序稳定有意义：串行跑时它决定谁先跑，而登记顺序是用户排的。
 */
export function decideDue(inputs: readonly DockSchedInput[]): DockSchedDecision {
  const ready: DockSchedInput[] = [];
  const skipped: DockSchedDecision['skipped'] = [];
  for (const i of inputs) {
    const r = skipReasonOf(i);
    if (r) skipped.push({ input: i, reason: r });
    else ready.push(i);
  }
  return { ready, skipped };
}

/**
 * 必填参数缺哪些（返回缺的 `label`，供提示）。
 * `required` 且值为空（`undefined` / `null` / 空串 / 空数组）→ 算缺。用途：自动跑之前挡一下 ——
 * 拿不到 Cookie 就白跑一次网络请求，还多一条失败记录，不如直接说「先填参数」。
 */
export function missingRequiredParams(
  params: readonly { key: string; label: string; required?: boolean }[] | undefined,
  values: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  for (const p of params ?? []) {
    if (!p.required) continue;
    const v = values[p.key];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) out.push(p.label || p.key);
  }
  return out;
}

/** 本地日键 YYYY-MM-DD（与 core/ui/str localDayKey 同口径；此处独立实现保零依赖） */
function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 时间串 → 毫秒（解析失败 undefined；' ' 换 'T' 兼容 localNow 写入格式） */
export function timeOf(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const t = new Date(s.replace(' ', 'T')).getTime();
  return Number.isFinite(t) ? t : undefined;
}

/** 按 startedAt 降序取终结态运行（解析不出时刻的排最后；不改原数组） */
export function terminalRuns(runs: readonly DockRunRecord[]): DockRunRecord[] {
  return runs
    .filter((r) => TERMINAL.has(r.status))
    .slice()
    .sort((a, b) => (timeOf(b.startedAt) ?? 0) - (timeOf(a.startedAt) ?? 0));
}

/** 最近一次终结运行（无则 undefined） */
export function lastRun(runs: readonly DockRunRecord[]): DockRunRecord | undefined {
  return terminalRuns(runs)[0];
}

/**
 * 漏跑判定。
 * @param schedule 清单声明的节奏（未声明传 undefined）
 * @param runs     运行记录（乱序/含 running 都行 —— 内部自己筛）
 * @param now      当前时刻（ms；可注入便于单测）
 */
export function judgeDue(
  schedule: DockSchedule | undefined,
  runs: readonly DockRunRecord[],
  now: number = Date.now(),
): DockDueVerdict {
  if (!schedule || schedule.kind === 'on-demand' || schedule.kind === 'unknown') {
    return { state: 'none', detail: '未声明节奏' };
  }
  const latest = lastRun(runs);
  const latestAt = latest ? timeOf(latest.startedAt) : undefined;
  const d = new Date(now);
  const DAY = 86400000;

  switch (schedule.kind) {
    case 'daily': {
      if (schedule.hour !== undefined && d.getHours() < schedule.hour) {
        return { state: 'pending', detail: `今天 ${String(schedule.hour).padStart(2, '0')}:00 之后应有记录` };
      }
      if (latestAt !== undefined && dayKey(latestAt) === dayKey(now)) {
        return { state: 'ok', detail: '今天已有记录' };
      }
      return { state: 'due', detail: '今天还没有记录' };
    }
    case 'weekly': {
      if (schedule.weekday !== undefined) {
        // 期望时点 = 最近一个该星期几（含今天）的零点；跑在它之后即达标
        const back = (d.getDay() - schedule.weekday + 7) % 7;
        const expected = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
        if (latestAt !== undefined && latestAt >= expected) {
          return { state: 'ok', detail: '本周这份记录已到位' };
        }
        return { state: 'due', detail: '本周该跑的还没跑' };
      }
      const weekAgo = now - 7 * DAY;
      if (latestAt !== undefined && latestAt >= weekAgo) {
        return { state: 'ok', detail: '最近 7 天内有记录' };
      }
      return { state: 'due', detail: '最近 7 天没有任何记录' };
    }
    case 'interval': {
      if (schedule.everyHours === undefined) return { state: 'none', detail: '未声明间隔时长' };
      if (latestAt === undefined) {
        return { state: 'unknown', detail: '还没有任何运行记录，无法判定' };
      }
      const gap = now - latestAt;
      const limit = schedule.everyHours * 3600000;
      if (gap <= limit) return { state: 'ok', detail: `距上次 ${Math.round(gap / 60000)} 分钟` };
      const overdueH = Math.floor(gap / 3600000);
      return { state: 'due', detail: `距上次已 ${overdueH} 小时，超过声明的 ${schedule.everyHours} 小时` };
    }
    default:
      return { state: 'none', detail: '未声明节奏' };
  }
}

// ==================== 面板 KPI（口径） ====================

/**
 * 四格 KPI 的输入：每条工具压成判定所需的几个事实。
 *
 * 刻意**不**吃 data.ts 的 `DockToolView` —— 那会把 core/storage 拖进来，这一层就进不了 node 测试。
 * `overdue` 由调用方用 `judgeDue` 判好传进来，判定口径仍然只有一处。
 */
export interface DockOverviewInput {
  trigger: 'auto' | 'manual';
  name: string;
  schedule: DockSchedule | undefined;
  runs: readonly DockRunRecord[];
  /** 当前是否判为欠跑 */
  overdue: boolean;
}

export interface DockOverview {
  /** 自动化工具：今天已有**成功**运行的数量 / 自动化工具总数 */
  autoDoneToday: number;
  autoTotal: number;
  /** 近 7 天终结态条数；0 = 没有基线，此时 rate7d 为 null */
  runs7d: number;
  /** 近 7 天里成功的条数（`rate7d` 的分子，直接给出省得消费方自己乘回去） */
  ok7d: number;
  rate7d: number | null;
  /** 待处理 = 欠跑，或最近一次终结运行是失败 / 超时 */
  alarms: number;
  /** 第一条待处理的「工具名 · 原因」（原因给可操作的那一类，不是干巴巴的「失败」） */
  alarmHint: { name: string; reason: string } | null;
  /** 最近一个**还没到**的到期时点（含工具名）；判不出、或全都已逾期则 null */
  nextDue: { at: number; name: string } | null;
}

/** 失败分类 → 短标签（KPI 副文案宽度有限；可操作建议由 runner 的 errorHint 在卡面/详情给） */
const ERROR_KIND_LABEL: Readonly<Record<string, string>> = {
  auth: '认证失效',
  network: '网络异常',
  config: '配置不对',
  timeout: '超时',
  aborted: '被中止',
  unknown: '未知错误',
};

/**
 * 四格 KPI 的口径（纯函数）。三条自我约束：
 *  1) **不另算一套数** —— 每个数都从 `judgeDue` / `lastRun` / `nextDueAt` 上取。
 *     面板别处显示同一件事时必须同源；抄一份出来早晚对不上。
 *  2) **没基线就不给数** —— 近 7 天一条终结记录都没有时 `rate7d = null`（UI 显示「—」），不假报 0%。
 *  3) **已逾期的不进「距下次到期」** —— 那件事归 `alarms`，同一件事不在两格里各喊一次。
 */
export function overviewOf(
  items: readonly DockOverviewInput[],
  now: number = Date.now(),
): DockOverview {
  const d = new Date(now);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const weekAgo = now - 7 * 86400000;

  let autoTotal = 0;
  let autoDoneToday = 0;
  let runs7d = 0;
  let ok7d = 0;
  let alarms = 0;
  let alarmHint: DockOverview['alarmHint'] = null;
  let nextDue: DockOverview['nextDue'] = null;

  for (const it of items) {
    if (it.trigger === 'auto') {
      autoTotal += 1;
      const done = terminalRuns(it.runs).some(
        (r) => r.status === 'ok' && (timeOf(r.startedAt) ?? 0) >= dayStart,
      );
      if (done) autoDoneToday += 1;
    }

    for (const r of terminalRuns(it.runs)) {
      const at = timeOf(r.startedAt);
      if (at === undefined || at < weekAgo) continue;
      runs7d += 1;
      if (r.status === 'ok') ok7d += 1;
    }

    const last = lastRun(it.runs);
    const lastBad = !!last && (last.status === 'failed' || last.status === 'timeout');
    if (it.overdue || lastBad) {
      alarms += 1;
      if (!alarmHint) {
        alarmHint = {
          name: it.name,
          reason: it.overdue ? '该跑没跑' : ERROR_KIND_LABEL[last?.error?.kind ?? 'unknown'] ?? '未知错误',
        };
      }
    }

    const dueAt = nextDueAt(it.schedule, it.runs, now);
    if (dueAt !== null && dueAt > now && (nextDue === null || dueAt < nextDue.at)) {
      nextDue = { at: dueAt, name: it.name };
    }
  }

  return {
    autoDoneToday,
    autoTotal,
    runs7d,
    ok7d,
    rate7d: runs7d ? ok7d / runs7d : null,
    alarms,
    alarmHint,
    nextDue,
  };
}

/**
 * 最近 n 次**终结**运行，按时间正序（左旧右新），不足补 `null` 占位。
 * 长度恒为 n —— 卡片上的点阵是固定格数的通栏时间轴，「空格」本身就是信息（那一次没有跑）。
 */
/**
 * 下一次「该跑」的时刻（ms）。判不了一律返回 `null` —— **绝不编一个假的到期时间**。
 *
 * 与 `judgeDue` 严格同一套口径（同一个 `kind` 分支、同一个「未声明就不猜」原则）：
 *  - `daily`：未声明 `hour` 视同零点（对齐 judgeDue 的「一过零点就算欠」）。
 *  - `weekly`：未声明 `weekday` 返回 null（judgeDue 那支退化成「最近 7 天内」，没有确定时点可给）。
 *  - `interval`：需要「距上次多久」这个前提，一条记录都没有时返回 null（同 judgeDue 的 unknown）。
 *  - `on-demand` / `unknown` / 未声明：null。
 */
export function nextDueAt(
  schedule: DockSchedule | undefined,
  runs: readonly DockRunRecord[],
  now: number = Date.now(),
): number | null {
  if (!schedule) return null;
  const d = new Date(now);
  const DAY = 86400000;

  switch (schedule.kind) {
    case 'daily': {
      const hour = schedule.hour ?? 0;
      const todayAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).getTime();
      return todayAt > now ? todayAt : todayAt + DAY;
    }
    case 'weekly': {
      if (schedule.weekday === undefined) return null;
      const back = (d.getDay() - schedule.weekday + 7) % 7;
      const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
      return slot > now ? slot : slot + 7 * DAY;
    }
    case 'interval': {
      if (schedule.everyHours === undefined) return null;
      const latest = lastRun(runs);
      const latestAt = latest ? timeOf(latest.startedAt) : undefined;
      if (latestAt === undefined) return null; // 缺基线：不猜
      return latestAt + schedule.everyHours * 3600000;
    }
    default:
      return null;
  }
}

export function recentRuns(runs: readonly DockRunRecord[], n = 7): Array<DockRunRecord | null> {
  const list = terminalRuns(runs).slice(0, n).reverse();
  const out: Array<DockRunRecord | null> = [];
  for (let i = 0; i < n - list.length; i++) out.push(null);
  for (const r of list) out.push(r);
  return out;
}

/** 只要状态的薄壳（`recentRuns` 的 status 投影） */
export function recentStrip(runs: readonly DockRunRecord[], n = 7): Array<DockRunRecord['status'] | null> {
  return recentRuns(runs, n).map((r) => (r ? r.status : null));
}

/** 区间内成功率（分母 = 终结态条数；无记录返回 null —— 不假报 0%） */
export function successRate(runs: readonly DockRunRecord[]): number | null {
  const list = terminalRuns(runs);
  if (!list.length) return null;
  return list.filter((r) => r.status === 'ok').length / list.length;
}

/** 单次运行耗时文案（缺 durationMs 时由起止时刻现算；都没有则空串） */
export function durationText(run: DockRunRecord): string {
  let ms = run.durationMs;
  if (ms === undefined) {
    const a = timeOf(run.startedAt);
    const b = timeOf(run.finishedAt);
    if (a !== undefined && b !== undefined && b >= a) ms = b - a;
  }
  if (ms === undefined) return '';
  if (ms < 1000) return `${ms} 毫秒`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} 秒`;
  const m = Math.floor(s / 60);
  return `${m} 分 ${Math.round(s - m * 60)} 秒`;
}
