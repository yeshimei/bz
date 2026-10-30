/**
 * 工具坞面板（dock 域 UI）。形态 = **卡片墙**（spec §7 UI 定稿）。
 *
 * 外壳走各域共用的面板范式：`.bz-panel-overlay` + `.bz-panel-frame` + `.bz-panel-head`，
 * 组件一律消费 `core/ui`。自上而下四层：
 *   ① 顶部 KPI 四格（今日达标 / 近 7 天成功率 / 待处理异常 / 距下次到期）
 *   ② 面板顶层执行进度（**只有在场运行才出现**；后台值守跑的那条读工具自己写的心跳）
 *   ③ 搜索行（未展开即隐藏）
 *   ④ 主体：卡片墙，一张卡 = 一个外部工具，卡面自带「最近 7 次」点阵，欠跑的卡整卡标色
 *
 * 详情页：封面式头行（返回 + 大图标 + 名 + 描述）+ 展示板 + 统计三格 + meta
 * + 规则表 + 两栏（运行台 / 运行记录）。
 *
 * 数据全部来自契约 v2 的那几份文件，这一层不做判断：
 * 能不能跑问 `judgeRunGate`，该不该跑问内核，面板只负责画和改。
 */

import { Platform, type App } from 'obsidian';
import { topifyZ } from '../core/z-order';
import { bindMaskDismiss } from '../core/mask-dismiss';
import { fileDiskPath } from '../core/path-picker';
import { escManager } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { notice } from '../core/notice';
import {
  uiBtn,
  uiBtnRow,
  uiChoice,
  uiEmpty,
  uiField,
  uiIcon,
  uiIconBtn,
  uiInput,
  uiModal,
  uiProgress,
  uiSearch,
  uiSelect,
  uiSwitch,
} from '../core/ui';
import { relTime } from '../core/ui/str';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { displayNameOf, loadToolView, loadToolViews, panelOf, recentRunsOf, runningHeartbeatOf } from './view';
import { readRegistry, readTrust, removeTool, trustTool, untrustTool, upsertTool } from './registry';
import { currentFs, pathOf, resolveToolPath, writeIntent, writeSettings, type DockFs } from './files';
import { parseManifest } from './parse';
import { actionText, defaultRule, isEventTrigger, nextDueOf, ruleName, triggerText } from './rules';
import { missingParams } from './kernel';
import { judgeRunGate, runToolDirect } from './command';
import { hintOf, liveAll, liveOf, onLiveChanged, statusText, stopLive } from './exec';
import { clearBreakerSafely, kickDockScheduler, notifyDockEvent, runToolManually } from './host';
import { primeVaultFs } from './vault-fs';
import { liveLogOf } from './watchdog-status';
import {
  HEARTBEAT_STALE_MS,
  TRIGGER_KINDS,
  TRIGGER_LABEL,
  type DockHeartbeat,
  type DockParam,
  type DockRegistryEntry,
  type DockRule,
  type DockRunRecord,
  type DockToolView,
  type DockTrigger,
  type DockTriggerKind,
} from './types';

// ==================== 状态 ====================

let hostApp: App | null = null;
let overlay: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
/** 当前视图：列表 / 某工具详情 */
let view: { kind: 'list' } | { kind: 'detail'; id: string } = { kind: 'list' };
/** 搜索词（空 = 不过滤） */
let query = '';
/** 搜索行是否展开 */
let searchOpen = false;
/** KPI「待处理异常」点出来的过滤口径 */
let kpiFilter: 'all' | 'alarms' = 'all';
/** 打开面板时读出来的视图（渲染输入） */
let views: DockToolView[] = [];
/** 列表态的轮询拍 */
let tickTimer: ReturnType<typeof setInterval> | null = null;
let liveOff: (() => void) | null = null;
/**
 * 上一次现场运行留下的输出尾部（按工具 id）。
 *
 * 为什么不找内核要：`LiveRun` 在跑完就从表里摘掉了，而那几行恰恰是「刚才到底干了什么」
 * 最直接的证据。面板每拍顺手抄一份，跑完还能给人看 —— 只在内存，不落盘。
 */
const lastTails = new Map<string, string[]>();
/**
 * 「这一格文件上次读进来时长什么样」—— 后台（值守进程、工具自己）写盘后，
 * 面板要在几秒内跟着变，而不是等人关掉重开。
 *
 * 分两本：`recPrints` 管记录与配置（runs / runtime / intent / data / panel / 声明），
 * `hbPrints` 只关心跳。分开的理由是**重绘范围不同** —— 心跳每 5 秒刷一次，
 * 只为它重画整个运行记录栏，用户展开的那条会被收起来。
 */
const recPrints = new Map<string, string>();
const hbPrints = new Map<string, string>();
/**
 * 展示板单独一本。
 *
 * `panel.html` 一动，那块 iframe 只能整块换（换内容等于换文档）：白闪、高度重测、
 * 工具自己画的状态全丢。而「跑完一条记录」比「重画一次展示板」频繁得多 ——
 * 合在一本里就是「每跑一次，用户正在看的板子闪一下」。分开之后只有板子真变了才换。
 */
const boardPrints = new Map<string, string>();
/**
 * 详情页里展开了哪几条运行记录：`工具 id → runId 集合`。
 *
 * 重画运行记录栏时按它恢复 —— 否则后台每写一条新记录，用户展开看的那条就被收回去。
 * **必须按工具分开**：共用一个集合的话，切到工具 B 渲染时会把 A 的 runId 当成
 * 「已经不在记录里」清掉，切回 A 就全收起了。
 * 每个集合只留最近的记录，超出 60 条窗口的会在渲染后剔掉。
 */
const openRuns = new Map<string, Set<string>>();

function openRunsOf(toolId: string): Set<string> {
  let set = openRuns.get(toolId);
  if (!set) {
    set = new Set<string>();
    openRuns.set(toolId, set);
  }
  return set;
}

/** 打开面板时用来算「上次打开之后自动跑了什么」 */
const LAST_SEEN_KEY = 'bz-dock:lastSeen';

const OVERLAY_ID = 'bz-dock-mask';
const FRAME_ID = 'bz-dock-panel';

// ==================== 小工具 ====================

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

/** 是否桌面端（只有桌面端能起进程） */
function canRun(): boolean {
  return !Platform.isMobile;
}

function viewById(id: string): DockToolView | undefined {
  return views.find((v) => v.id === id);
}

function todayKey(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isToday(iso: string): boolean {
  const t = Date.parse(iso);
  return Number.isFinite(t) && todayKey(iso) === todayKey();
}

/** 健康态 → 色点类（`none` 不画点） */
function dotClass(state: string): string {
  switch (state) {
    case 'ok':
      return 'bz-dock-dot bz-dock-dot--ok';
    case 'due':
    case 'failed':
    case 'timeout':
    case 'abandoned':
      return 'bz-dock-dot bz-dock-dot--bad';
    case 'pending':
    case 'running':
    case 'stopped':
      return 'bz-dock-dot bz-dock-dot--warn';
    default:
      return 'bz-dock-dot bz-dock-dot--idle';
  }
}

/** 上一次完整运行的记录（`runs.jsonl` 尾部最近一条） */
function lastOf(v: DockToolView): DockRunRecord | undefined {
  return v.lastRun;
}

/** 成功率：记录里成功了几条 */
function rateOf(v: DockToolView): number | null {
  const runs = recentRunsOf(v.path, v.id, 60).filter((r) => r.status !== 'running');
  if (!runs.length) return null;
  return runs.filter((r) => r.status === 'ok').length / runs.length;
}

/**
 * 欠跑判定：**有启用的规则、到过点了、今天没跑成**。
 *
 * 只对 daily / interval 这两种「有钟点」的规则算 —— 事件类的「该不该跑」由内核判，
 * 面板不去猜一个事件什么时候会发生。
 */
function dueOf(v: DockToolView): { due: boolean; detail: string } {
  const enabled = v.rules.filter((r) => r.enabled !== false);
  if (!enabled.length) return { due: false, detail: '' };
  if (v.intent.enabled === false) return { due: false, detail: '' };
  if (v.intent.autoRun === false) return { due: false, detail: '' };
  const now = Date.now();
  const last = lastOf(v);
  for (const rule of enabled) {
    const firedRaw = v.runtime.rules?.[rule.id]?.lastFiredAt;
    const fired = firedRaw ? Date.parse(firedRaw) : undefined;
    if (rule.trigger.kind === 'daily') {
      const m = /^(\d{1,2}):(\d{1,2})$/.exec(rule.trigger.at);
      if (!m) continue;
      const at = new Date();
      at.setHours(Number(m[1]), Number(m[2]), 0, 0);
      const done = !!last && last.status === 'ok' && isToday(last.startedAt);
      if (now > at.getTime() && !done && (fired ?? 0) < at.getTime()) {
        return { due: true, detail: '今日未跑' };
      }
    } else if (rule.trigger.kind === 'interval') {
      const span = rule.trigger.everyMin * 60_000;
      const base = fired ?? (last ? Date.parse(last.startedAt) : undefined);
      if (base !== undefined && now > base + span + 5 * 60_000) {
        return { due: true, detail: '该跑没跑' };
      }
    }
  }
  return { due: false, detail: '' };
}

/** 异常口径（KPI「待处理异常」与它点出来的过滤共用这一份） */
function isAlarmView(v: DockToolView): boolean {
  if (dueOf(v).due) return true;
  if (v.runtime.run?.pausedAt) return true;
  if (!v.trusted) return false; // 没授权是「还没开始用」，不算异常
  const s = v.lastRun?.status;
  return s === 'failed' || s === 'timeout' || s === 'abandoned';
}

/** 「未信任」与「信任过期」共用的标签文案 */
function trustTagOf(v: DockToolView): string | null {
  if (!canRun()) return null;
  if (!v.trusted) return v.trustStale ? '命令已变，待重新确认' : '未授权';
  return null;
}

/** 卡面「什么时候」 */
function whenTextOf(v: DockToolView, last: DockRunRecord | undefined): string {
  if (!last) return '还没有运行过';
  return relTime(last.startedAt.replace('T', ' '));
}

/** 卡面「结果」：在场运行给实时阶段，否则给工具自己留的那句话 */
function messageTextOf(v: DockToolView, last: DockRunRecord | undefined): string {
  if (!v.manifest) return v.error ?? '声明文件读不到，先把路径修好';
  const live = liveOf(v.id);
  if (live) return live.phase ? `正在${live.phase}…` : '正在运行…';
  const ext = freshOf(v.heartbeat);
  if (ext) return ext.step ? `后台跑：${ext.step}` : '后台值守正在跑…';
  if (!v.entry) return '声明里没写 entry —— 只能看';
  if (!last) return '等它按自己的节奏跑一次';
  return last.message || statusText(last.status);
}

/** 卡面「怎么办」：上次失败且工具留了 `error.kind` 时给可操作提示 */
function failHintOf(last: DockRunRecord | undefined): string | null {
  if (!last || !last.error) return null;
  if (last.status === 'ok' || last.status === 'running') return null;
  return hintOf(last.error.kind);
}

/** 心跳还新鲜吗（60 秒内） */
function freshOf(hb: DockHeartbeat | undefined): DockHeartbeat | null {
  if (!hb) return null;
  const at = Date.parse(hb.at);
  if (!Number.isFinite(at)) return null;
  return Date.now() - at <= HEARTBEAT_STALE_MS ? hb : null;
}

/** 有没有**别的进程**正在跑它（后台值守拉起的那种） */
function externalRunOf(v: DockToolView): DockHeartbeat | null {
  if (liveOf(v.id)) return null;
  return freshOf(v.heartbeat);
}

/** 剩余时长 → 「数字 + 单位」两段 */
function untilText(ms: number): { num: string; unit: string } {
  const m = ms / 60000;
  if (m < 60) return { num: String(Math.max(1, Math.round(m))), unit: 'm' };
  const h = m / 60;
  if (h < 24) return { num: String(Math.round(h)), unit: 'h' };
  return { num: String(Math.round(h / 24)), unit: 'd' };
}

// ==================== 打开 / 卸载 ====================

export function ensureDock(app: App): void {
  hostApp = app;
  if (!overlay) build(app);
}

export function openDock(app: App): void {
  ensureDock(app);
  if (!overlay) return;
  topifyZ(overlay);
  overlay.classList.remove('is-off');
  trapPanelFocus(overlay.querySelector<HTMLElement>(`#${FRAME_ID}`) ?? overlay);
  // hide 型常驻层重开：显示路径重放 ESC 注册，栈序跟随显示序
  escHandle?.unregister();
  escHandle = escManager.register('bz-dock', {
    isVisible: () => isPanelVisible(),
    close: () => closeDock(),
  });
  render();
  startTick();
  void refresh();
  // 「打开工具坞」本身也是一个触发条件（规则里的 panel-open）
  notifyDockEvent({ kind: 'panel-open' });
  // 移动端：读桥是内存快照，每次打开重读一遍。
  // 预取完成后必须**重新读一遍登记表**（refresh），只 render 等于把预取前那份空视图再画一遍。
  if (Platform.isMobile) void primeVaultFs(app).then(() => refresh());
  else maybeOfflineReport();
}

export function closeDock(): void {
  overlay?.classList.add('is-off');
  stopTick();
}

/** 通知 / 命令的「直达」入口：开面板并定位到该工具详情 */
export function openToolPanel(app: App, id: string): void {
  view = { kind: 'detail', id };
  openDock(app);
}

export function unloadDock(): void {
  stopTick();
  liveOff?.();
  liveOff = null;
  hostApp = null;
  escHandle?.unregister();
  escHandle = null;
  overlay?.remove();
  overlay = null;
  views = [];
  view = { kind: 'list' };
  searchOpen = false;
  query = '';
  lastTails.clear();
  recPrints.clear();
  hbPrints.clear();
  boardPrints.clear();
  openRuns.clear();
}

function isPanelVisible(): boolean {
  return !!overlay && !overlay.classList.contains('is-off');
}

// ==================== 面板壳 ====================

function build(app: App): void {
  const ov = el('div', 'bz-panel-overlay bz-dock-mask is-off');
  ov.id = OVERLAY_ID;
  const frame = el('div', 'bz-panel-frame bz-dock-panel bz-panel-mtop');
  frame.id = FRAME_ID;

  const head = el('div', 'bz-panel-head');
  const kpi = el('div', 'bz-dock-kpi');
  kpi.id = 'bz-dock-kpi';
  const runbar = el('div', 'bz-dock-runbar');
  runbar.id = 'bz-dock-runbar';
  const bar = el('div', 'bz-dock-bar');
  bar.id = 'bz-dock-bar';
  const body = el('div', 'bz-dock-body');
  body.id = 'bz-dock-body';

  frame.append(head, kpi, runbar, bar, body);
  ov.appendChild(frame);
  // 点遮罩关闭：手势配对判据（core/mask-dismiss）——跨元素松手不算点击
  bindMaskDismiss(ov, closeDock);
  document.body.appendChild(ov);
  overlay = ov;
  liveOff = onLiveChanged(() => {
    rememberTails();
    if (view.kind === 'detail') renderLiveInto(view.id);
    renderRunbar();
    updateCards();
  });
  void app;
}

function headEl(): HTMLElement | null {
  return overlay?.querySelector<HTMLElement>('.bz-panel-head') ?? null;
}
function kpiEl(): HTMLElement | null {
  return overlay?.querySelector<HTMLElement>('#bz-dock-kpi') ?? null;
}
function runbarEl(): HTMLElement | null {
  return overlay?.querySelector<HTMLElement>('#bz-dock-runbar') ?? null;
}
function barEl(): HTMLElement | null {
  return overlay?.querySelector<HTMLElement>('#bz-dock-bar') ?? null;
}
function bodyEl(): HTMLElement | null {
  return overlay?.querySelector<HTMLElement>('#bz-dock-body') ?? null;
}

// ==================== 刷新 ====================

function refresh(): void {
  const { registry } = readRegistry();
  views = loadToolViews(registry.tools, {
    trust: readTrust(),
    canRun: canRun(),
    fs: currentFs(),
  });
  syncPrints(registry.tools);
  render();
}

// ==================== 外部改动跟踪 ====================
//
// 工具跑在 bz 之外（值守进程拉起的、脚本自己定时跑的），bz 收不到它们的任何回调 ——
// 唯一的事实来源是那几份文件。上一版只在「打开面板 / 点刷新」时重读一遍，
// 于是后台跑完之后卡片上的时间、结果、按钮的「后台正在跑」全停在跑之前的样子，
// 用户得关掉面板再打开才看得见新记录（2026-10-25 报的正是这个）。
//
// 现在每拍（3 秒）对一遍「这几份文件还是不是上次那样」，变了才重读那一格。

/** 一个工具「记录类文件」的指纹：任何一份变了都算内容变了 */
function recPrintOf(declPath: string, fs: DockFs | null): string {
  if (!fs) return '';
  return [
    // runs.jsonl 可能很大（几百 KB），只看大小：它是**只在终态追加**的，追加必变
    filePrint(pathOf.runs(declPath), fs, true),
    // 其余都是小文件，看内容 —— 大小靠不住：`updatedAt`、`at` 这类 ISO 时间戳是定长的，
    // 内容换了大小却一模一样，只比大小就等于没比
    filePrint(declPath, fs, false),
    filePrint(pathOf.runtime(declPath), fs, false),
    filePrint(pathOf.intent(declPath), fs, false),
    filePrint(pathOf.settings(declPath), fs, false),
  ].join('|');
}

/** 展示板单独一本：它变了要换 iframe，代价和「重画一栏记录」不是一个量级 */
function boardPrintOf(declPath: string, fs: DockFs | null): string {
  if (!fs) return '';
  // 最大 512 KB；内容再变也是重写整份，长度会变
  return filePrint(pathOf.panel(declPath), fs, true);
}

/** 心跳单独一本：它每 5 秒重写一次，跟「跑完了」不是一回事 */
function hbPrintOf(declPath: string, fs: DockFs | null): string {
  if (!fs) return '';
  return filePrint(pathOf.heartbeat(declPath), fs, false);
}

/**
 * 一份文件的指纹。`bySize` 只给可能很大的 `runs.jsonl` 用；
 * 没有 `size` 能力的 fs（移动端内存快照）退回读内容 —— 那种快照本来就不会变，等于关掉跟踪。
 */
function filePrint(path: string, fs: DockFs, bySize: boolean): string {
  if (bySize) {
    const size = fs.size?.(path);
    if (size !== undefined) return `s${size}`;
  }
  const text = fs.readText(path);
  if (text === null) return '-';
  return `h${text.length}:${hashOf(text)}`;
}

/** 内容指纹（只为「变没变」，不做安全用途） */
function hashOf(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function syncPrints(entries: readonly DockRegistryEntry[]): void {
  const fs = currentFs();
  recPrints.clear();
  hbPrints.clear();
  boardPrints.clear();
  for (const e of entries) {
    const decl = resolveToolPath(e.path);
    recPrints.set(e.id, recPrintOf(decl, fs));
    hbPrints.set(e.id, hbPrintOf(decl, fs));
    boardPrints.set(e.id, boardPrintOf(decl, fs));
  }
}

interface ChangedIds {
  /** 记录 / 配置变了：卡片、统计、运行记录都要重画 */
  rec: Set<string>;
  /** 只有心跳变了：重画卡片与实时区就够，别动运行记录栏 */
  hb: Set<string>;
  /** 展示板变了：只有它该换 iframe（换一次就是白闪一次） */
  board: Set<string>;
}

/**
 * 对一遍指纹，把变了的工具重读到 `views` 里。
 *
 * 重读而不是只改某一个字段：`loadToolView` 里有一处**跨文件**的判断
 * ——「心跳还新鲜，但账本里已经有这个 runId 的终态」= 早就跑完了。
 * 那一处只有整份重读才对得上，局部拼装必然又走回「60 秒里一直显示在跑」。
 */
function reloadChanged(): ChangedIds {
  const changed: ChangedIds = { rec: new Set(), hb: new Set(), board: new Set() };
  const fs = currentFs();
  if (!fs) return changed;
  const { registry } = readRegistry();
  if (registry.tools.length !== views.length) {
    // 有人在外面加了 / 删了工具（登记表被改）。这是人的动作，走整份重载
    refresh();
    return changed;
  }
  const trust = readTrust();
  for (const e of registry.tools) {
    const decl = resolveToolPath(e.path);
    const rec = recPrintOf(decl, fs);
    const hb = hbPrintOf(decl, fs);
    const board = boardPrintOf(decl, fs);
    const recDirty = recPrints.get(e.id) !== rec;
    const hbDirty = hbPrints.get(e.id) !== hb;
    const boardDirty = boardPrints.get(e.id) !== board;
    if (!recDirty && !hbDirty && !boardDirty) continue;
    recPrints.set(e.id, rec);
    hbPrints.set(e.id, hb);
    boardPrints.set(e.id, board);
    const i = views.findIndex((v) => v.id === e.id);
    if (i < 0) continue;
    views[i] = loadToolView(e, { trust, canRun: canRun(), fs });
    if (boardDirty) changed.board.add(e.id);
    // 展示板变了也要重读视图，但别顺手把「记录类」那一整套重画一遍
    if (recDirty) changed.rec.add(e.id);
    else if (hbDirty) changed.hb.add(e.id);
  }
  return changed;
}

/** 把变了的工具画到当前界面上 —— 只重画受影响的那几块，不重建整个面板 */
function repaintChanged(changed: ChangedIds): void {
  if (!changed.rec.size && !changed.hb.size && !changed.board.size) return;
  if (view.kind === 'detail') {
    const board = changed.board.has(view.id);
    if (changed.rec.has(view.id) || board) repaintDetail(view.id, { board });
    else if (changed.hb.has(view.id)) {
      renderLiveInto(view.id);
      repaintRunBtns(view.id);
    }
    return;
  }

  const body = bodyEl();
  if (!body) return;
  for (const id of new Set([...changed.rec, ...changed.hb, ...changed.board])) {
    const v = viewById(id);
    if (!v) continue;
    const old = body.querySelector<HTMLElement>(`.bz-dock-card[data-tool="${id}"]`);
    // 卡片不在（搜索过滤掉了 / 空态）就不用管 —— 下次重绘自然会带上新数据
    if (old) old.replaceWith(makeCard(v));
  }
  // 顶栏四格与「谁在后台跑」跟着记录变，与心跳无关
  if (changed.rec.size) {
    renderKpi();
    renderHeadSub();
  }
  renderRunbar();
  updateCards();
}

/** 列表页副标题（工具数 / 待关注数）：只有工具增删或告警数变化时才需要动它 */
function renderHeadSub(): void {
  const sub = overlay?.querySelector<HTMLElement>('#bz-dock-headsub');
  if (!sub) return;
  const alarms = views.filter(isAlarmView).length;
  sub.textContent = views.length
    ? `${views.length} 个工具${alarms ? ` · ${alarms} 个待关注` : ''}`
    : '还没有登记任何外部工具';
}

/**
 * 详情页里只重画「结果类」的几块：统计、运行按钮、运行记录、实时区。
 *
 * `board` 只在 `panel.html` 真变了时才传 true —— iframe 换一次就是白闪一次，
 * 而「多了一条记录」比「换一次板子」频繁得多，不该顺带把它换掉。
 */
function repaintDetail(id: string, opts: { board?: boolean } = {}): void {
  const v = viewById(id);
  const wrap = bodyEl()?.querySelector<HTMLElement>('.bz-dock-detail');
  if (!v || !wrap) return;
  if (opts.board) repaintBoard(v, wrap);
  wrap.querySelector<HTMLElement>('.bz-dock-toolstats')?.replaceWith(toolStats(v));
  wrap.querySelector<HTMLElement>('.bz-dock-histpane')?.replaceWith(histPane(v));
  repaintRunBtns(id);
  renderLiveInto(id);
  renderRunbar();
}

/**
 * 展示板重画。工具跑完顺手重写了 `panel.html`，那块就该是新数 ——
 * 但它是 iframe，只能整块换（换内容等于换文档）。
 */
function repaintBoard(v: DockToolView, wrap: HTMLElement): void {
  const old = wrap.querySelector<HTMLElement>('.bz-dock-board');
  const next = boardSection(v);
  if (old && next) old.replaceWith(next);
  else if (old) old.remove();
  else if (next) {
    // 原本没有、这次有了：仍要排在展示板该在的位置（错误提示之后、统计之前）
    const warn = wrap.querySelector<HTMLElement>('.bz-dock-meta-warn');
    wrap.insertBefore(next, warn ? warn.nextSibling : wrap.firstChild);
  }
}

/**
 * 运行台那一排按钮：它会因为「后台正在跑 / 刚跑完」在「后台正在跑」与「运行」之间切换。
 * 只换这一块，**不重画整台** —— 左边那几张参数表是用户正在填的东西。
 */
function repaintRunBtns(id: string): void {
  const v = viewById(id);
  if (!v) return;
  const old = bodyEl()?.querySelector<HTMLElement>('.bz-dock-runpane .bz-dock-runbtns');
  if (!old) return;
  old.replaceWith(runBtns(v));
}

/**
 * 列表态的状态点与「在跑」标记（每 3 秒一次；只读心跳与该工具的账本尾部，不读整份视图）。
 *
 * 判「在跑」走 `runningHeartbeatOf`（心跳新鲜 + 账本里还没有这一单的终态）——
 * 只看心跳新鲜度的话，跑完后的 60 秒卡片上还挂着绿点。
 */
function updateCards(): void {
  const body = bodyEl();
  if (!body || view.kind === 'detail') return;
  const fs = currentFs();
  const beats = new Map(readRegistry().registry.tools.map((e) => [e.id, runningHeartbeatOf(e.path, fs)]));
  for (const card of Array.from(body.querySelectorAll<HTMLElement>('.bz-dock-card'))) {
    const id = card.dataset.tool ?? '';
    const live = liveOf(id);
    const hb = beats.get(id);
    const ext = live || !hb ? null : freshOf(hb);
    const running = !!live || !!ext;
    card.classList.toggle('is-running', running);
    const dot = card.querySelector<HTMLElement>('.bz-dock-dot');
    // 跑完要**退回它本来该有的颜色**：只在「在跑」时设成 warn、跑完不管，
    // 卡片会一直挂着那个黄点，看着像还在跑
    if (dot) {
      const v = viewById(id);
      const last = v ? lastOf(v) : undefined;
      const want = running
        ? 'bz-dock-dot bz-dock-dot--warn'
        : dotClass(last ? last.status : v && dueOf(v).due ? 'due' : 'none');
      if (dot.className !== want) dot.className = want;
    }
  }
}

function startTick(): void {
  stopTick();
  tickTimer = setInterval(() => {
    if (!isPanelVisible()) return;
    rememberTails();
    // 后台写盘 → 重读 → 局部重画。放在 updateCards 之前：重画时用的是刚读到的视图
    repaintChanged(reloadChanged());
    updateCards();
    if (view.kind === 'detail') renderLiveInto(view.id);
  }, 3000);
}

function stopTick(): void {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

// ==================== 渲染总入口 ====================

function render(): void {
  renderHead();
  renderKpi();
  renderRunbar();
  renderBar();
  renderBody();
}

function renderHead(): void {
  const head = headEl();
  if (!head) return;
  if (view.kind === 'detail') {
    const v = viewById(view.id);
    if (v) {
      renderToolHead(head, v);
      return;
    }
  }
  head.classList.remove('bz-dock-toolhead');
  head.innerHTML = '';
  const brand = el('div', 'bz-panel-brand');
  brand.appendChild(uiIcon('square-terminal'));
  const sub = el('div', 'bz-panel-head-sub');
  sub.id = 'bz-dock-headsub';
  const btns = el('div', 'bz-panel-head-btns');
  btns.id = 'bz-dock-headbtns';
  head.append(brand, el('div', 'bz-panel-title', '工具坞'), el('div', 'bz-panel-head-pipe'), sub, el('div', 'bz-panel-head-sp'), btns);
  renderHeadSub();

  btns.appendChild(
    uiIconBtn({
      icon: 'search',
      title: '搜索工具',
      on: searchOpen,
      onClick: () => {
        searchOpen = !searchOpen;
        render();
      },
    }),
  );
  // 移动端只读：刷新与导入都不给 —— 手机上选不了文件夹，也没有「重读一遍」能改变的东西
  if (canRun()) {
    btns.appendChild(
      uiIconBtn({
        icon: 'refresh-cw',
        title: '重新读取运行记录',
        onClick: () => {
          refresh();
          notice('已重新读取');
        },
      }),
    );
    btns.appendChild(uiIconBtn({ icon: 'plus', title: '导入工具（选文件夹）', onClick: () => pickFolder() }));
  }
  btns.appendChild(uiIconBtn({ icon: 'x', title: '关闭', className: 'bz-dock-close', onClick: () => closeDock() }));
}

/** 详情页头行：封面式（返回 + 大图标 + 名 + 标签 + 描述） */
function renderToolHead(head: HTMLElement, v: DockToolView): void {
  head.innerHTML = '';
  head.classList.add('bz-dock-toolhead');

  const back = uiIconBtn({
    icon: 'chevron-left',
    title: '返回列表',
    className: 'bz-dock-back',
    onClick: () => {
      view = { kind: 'list' };
      render();
    },
  });

  const main = el('div', 'bz-dock-covermain');
  const ic = el('div', 'bz-dock-coveric');
  ic.appendChild(uiIcon(v.manifest?.icon || 'box', 'bz-ic--lg'));

  const txt = el('div', 'bz-dock-covertxt');
  const line = el('div', 'bz-dock-coverline');
  line.appendChild(el('div', 'bz-dock-detail-name', displayNameOf(v)));
  const tags = el('div', 'bz-dock-detail-tags');
  const due = dueOf(v);
  if (due.due) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--due', due.detail));
  const trustTag = trustTagOf(v);
  if (trustTag) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--warn', trustTag));
  if (v.runtime.run?.pausedAt) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--warn', '自动已暂停'));
  if (tags.children.length) line.appendChild(tags);
  txt.appendChild(line);
  const desc = v.manifest?.description;
  if (desc) txt.appendChild(el('div', 'bz-dock-detail-desc', desc));

  main.append(back, ic, txt);
  head.appendChild(main);
}

/**
 * 顶部四格 KPI。口径在这个文件里现算（数据层没有 overview）：
 * 今日达标 = 有启用规则的工具有几个今天跑成了；成功率 = 最近 60 条记录里成功的比例。
 */
function renderKpi(): void {
  const host = kpiEl();
  if (!host) return;
  host.innerHTML = '';
  if (!views.length || view.kind === 'detail') {
    host.classList.add('is-off');
    return;
  }
  host.classList.remove('is-off');

  const withRules = views.filter((v) => v.rules.some((r) => r.enabled !== false));
  const doneToday = withRules.filter((v) => v.lastRun?.status === 'ok' && isToday(v.lastRun.startedAt)).length;
  const left = withRules.length - doneToday;

  let ok = 0;
  let total = 0;
  for (const v of views) {
    for (const r of recentRunsOf(v.path, v.id, 60)) {
      if (r.status === 'running') continue;
      total += 1;
      if (r.status === 'ok') ok += 1;
    }
  }
  const rate = total ? ok / total : null;

  const alarms = views.filter(isAlarmView);
  const alarmHint = alarms[0];
  const next = nextDueOfViews();

  const tile = (
    num: string,
    unit: string,
    label: string,
    sub: string,
    tone?: 'warn' | 'bad' | 'up',
    key?: 'alarms',
  ): HTMLElement => {
    const t = el('div', tone ? `bz-dock-kpi-tile is-${tone}` : 'bz-dock-kpi-tile');
    const v = el('div', 'bz-dock-kpi-v', num);
    if (unit) v.appendChild(el('small', undefined, unit));
    t.append(v, el('div', 'bz-dock-kpi-l', label), el('div', tone === 'up' ? 'bz-dock-kpi-d is-up' : 'bz-dock-kpi-d', sub));
    if (key) {
      t.classList.add('is-click');
      if (kpiFilter === key) t.classList.add('is-selected');
      t.addEventListener('click', () => {
        kpiFilter = kpiFilter === key ? 'all' : key;
        renderKpi();
        renderBody();
      });
    }
    return t;
  };

  host.appendChild(
    tile(
      String(doneToday),
      ` / ${withRules.length}`,
      '今日自动化达标',
      withRules.length === 0 ? '还没有自动化工具' : left > 0 ? `还差 ${left} 个` : '今天都跑成了',
      withRules.length > 0 && left > 0 ? 'warn' : undefined,
    ),
  );
  host.appendChild(
    tile(
      rate === null ? '—' : String(Math.round(rate * 100)),
      rate === null ? '' : '%',
      '近 7 天成功率',
      total ? `${total} 次里成功 ${ok} 次` : '还没有可比的记录',
    ),
  );
  host.appendChild(
    tile(
      String(alarms.length),
      '',
      '待处理异常',
      alarmHint ? `${displayNameOf(alarmHint)} · ${dueOf(alarmHint).due ? dueOf(alarmHint).detail : '上次没跑成'}` : '没有要管的事',
      alarms.length ? 'bad' : undefined,
      'alarms',
    ),
  );
  if (next) {
    const left2 = untilText(next.at - Date.now());
    host.appendChild(tile(left2.num, left2.unit, '距下次到期', next.name));
  } else {
    host.appendChild(tile('—', '', '距下次到期', '没有能算出下次到期的工具'));
  }
}

/** 最早的一次「下次到期」（事件类规则算不出钟点，跳过） */
function nextDueOfViews(): { at: number; name: string } | null {
  let best: { at: number; name: string } | null = null;
  const now = Date.now();
  for (const v of views) {
    if (v.intent.enabled === false || v.intent.autoRun === false) continue;
    for (const rule of v.rules) {
      if (rule.enabled === false || isEventTrigger(rule.trigger.kind)) continue;
      const firedRaw = v.runtime.rules?.[rule.id]?.lastFiredAt;
      const at = nextDueOf(rule, {
        now,
        lastFiredAt: firedRaw ? Date.parse(firedRaw) : undefined,
      });
      if (at === null) continue;
      if (!best || at < best.at) best = { at, name: displayNameOf(v) };
    }
  }
  return best;
}

/**
 * 面板顶层执行进度。**只画真在跑的**：本进程拉起的（有实时进度）+ 后台值守拉起的
 * （只有工具自己写的心跳和那行步骤，不编百分比）。
 */
function renderRunbar(): void {
  const host = runbarEl();
  if (!host) return;
  host.innerHTML = '';
  const live = liveAll();
  // 详情页不画顶栏那条：运行台里已经有同一条运行的实时进度，头顶再来一条是同一件事说两遍
  const offs =
    view.kind === 'detail'
      ? []
      : views
          .map((v) => ({ v, hb: externalRunOf(v) }))
          .filter((x): x is { v: DockToolView; hb: DockHeartbeat } => x.hb !== null);
  if (!live.length && !offs.length) {
    host.classList.add('is-off');
    return;
  }
  host.classList.remove('is-off');

  for (const run of live) {
    const v = viewById(run.toolId);
    const row = el('div', 'bz-dock-rb');
    row.appendChild(el('span', 'bz-dock-rb-pulse'));
    row.appendChild(el('span', 'bz-dock-rb-name', v ? displayNameOf(v) : run.toolId));
    if (run.phase) row.appendChild(el('span', 'bz-dock-rb-phase', run.phase));
    const lastStep = run.steps.length ? run.steps[run.steps.length - 1].text : '正在跑…';
    row.appendChild(el('span', 'bz-dock-rb-step', lastStep));
    if (run.pct !== null) {
      const track = el('div', 'bz-dock-rb-track');
      track.appendChild(uiProgress({ thin: true, value: run.pct }).el);
      row.appendChild(track);
      row.appendChild(el('span', 'bz-dock-rb-pct', `${run.pct}%`));
    }
    host.appendChild(row);
  }

  // 离场（后台值守拉起的）：没有进度条 —— 拿不到实时流就不画百分比，只画工具自己写下的那一步
  for (const { v, hb } of offs) {
    const row = el('div', 'bz-dock-rb');
    row.dataset.tool = v.id;
    row.appendChild(el('span', 'bz-dock-rb-pulse'));
    row.appendChild(el('span', 'bz-dock-rb-name', displayNameOf(v)));
    row.appendChild(el('span', 'bz-dock-rb-tag', '离线'));
    row.appendChild(el('span', 'bz-dock-rb-step', hb.step || '值守进程正在跑'));
    host.appendChild(row);
  }
}

/** 搜索行：没展开搜索时整条隐藏 */
function renderBar(): void {
  const bar = barEl();
  if (!bar) return;
  bar.innerHTML = '';
  if (!searchOpen || view.kind === 'detail') {
    bar.classList.add('is-off');
    return;
  }
  bar.classList.remove('is-off');
  const sp = el('div', 'bz-dock-search');
  const search = uiSearch({
    placeholder: '搜工具名 / 描述 / 命令',
    value: query,
    onInput: (v) => {
      query = v;
      renderBody();
    },
  });
  sp.appendChild(search.el);
  bar.appendChild(sp);
  if (!Platform.isMobile) queueMicrotask(() => search.input.focus());
}

function filtered(): DockToolView[] {
  let list = views.slice();
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter((v) => {
      const hay = [v.id, displayNameOf(v), v.manifest?.description ?? '', v.manifest?.entry?.cmd ?? '']
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }
  if (kpiFilter === 'alarms') list = list.filter(isAlarmView);
  return list;
}

function renderBody(): void {
  const body = bodyEl();
  if (!body) return;
  body.innerHTML = '';
  if (view.kind === 'detail') {
    const v = viewById(view.id);
    if (v) {
      renderDetail(body, v);
      return;
    }
    /*
     * 找不到这个工具。两种可能，别混为一谈：
     *  - `views` 还是空的（面板刚开、`refresh()` 还没跑完）→ **保留** detail 目标，
     *    下一次 render 就能进去；
     *  - `views` 有东西但没有它 → 工具真被删了，退回列表。
     * 上一版无条件改成 list，于是「从通知点直达」在面板首次渲染时必落到列表页。
     */
    if (views.length) view = { kind: 'list' };
  }
  renderList(body);
}

function renderList(body: HTMLElement): void {
  if (!views.length) {
    body.appendChild(
      uiEmpty({
        icon: 'square-terminal',
        title: '还没有外部工具',
        desc: canRun()
          ? '选一个工具文件夹，bz 会自己找里面的 manifest.json。工具坞据此知道它叫什么、有哪些参数、该怎么跑。'
          : '工具要在桌面端导入。手机上只读 —— 工具目录同步过来之后，这里就能看到它的声明、展示板与运行记录。',
        actions: canRun()
          ? uiBtnRow([uiBtn({ label: '导入工具', icon: 'file-input', tone: 'primary', onClick: () => pickFolder() })], {
              center: true,
            })
          : undefined,
      }),
    );
    return;
  }
  const list = filtered();
  if (!list.length) {
    body.appendChild(
      uiEmpty({
        icon: 'search-x',
        title: '没有匹配的工具',
        desc: kpiFilter === 'alarms' ? '这个口径下没有 —— 点顶上的 KPI 格回到全部' : '换个词试试',
      }),
    );
    return;
  }
  const grid = el('div', 'bz-dock-grid');
  for (const v of list) grid.appendChild(makeCard(v));
  body.appendChild(grid);
}

// ==================== 卡片 ====================

function makeCard(v: DockToolView): HTMLElement {
  const id = v.id;
  const card = el('article', 'bz-dock-card');
  card.dataset.tool = id;
  const due = dueOf(v);
  if (due.due) card.classList.add('is-due');
  if (v.intent.enabled === false) card.classList.add('is-disabled');
  if (liveOf(id) || externalRunOf(v)) card.classList.add('is-running');

  // 顶行：图标 + 名 + 标签
  const top = el('div', 'bz-dock-card-top');
  const ic = el('span', 'bz-dock-card-ic');
  ic.appendChild(uiIcon(v.manifest?.icon || 'box', 'bz-ic--md'));
  const idbox = el('div', 'bz-dock-card-idbox');
  const tags = el('div', 'bz-dock-card-tags');
  if (due.due) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--due', due.detail));
  const trustTag = trustTagOf(v);
  if (trustTag) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--warn', trustTag));
  if (!v.manifest) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--muted', '声明读不到'));
  if (v.manifest && !v.entry) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--muted', '只能看'));
  if (v.runtime.run?.pausedAt) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--warn', '自动已暂停'));
  idbox.append(el('div', 'bz-dock-card-name', displayNameOf(v)), tags);
  top.append(ic, idbox);
  card.appendChild(top);

  const desc = v.manifest?.description;
  if (desc) card.appendChild(el('div', 'bz-dock-card-desc', desc));

  // 状态行：什么时候 + 跑成什么样，成功率贴右
  const state = el('div', 'bz-dock-card-state');
  const last = lastOf(v);
  const running = !!liveOf(id) || !!externalRunOf(v);
  state.appendChild(el('span', running ? dotClass('running') : dotClass(last ? last.status : due.due ? 'due' : 'none')));
  state.appendChild(el('span', 'bz-dock-card-when', whenTextOf(v, last)));
  state.appendChild(el('span', 'bz-dock-card-msg', messageTextOf(v, last)));
  const rate = rateOf(v);
  if (rate !== null) {
    const rateEl = el('span', 'bz-dock-rate', `${Math.round(rate * 100)}% 成功`);
    rateEl.title = '最近记录里成功了几条';
    if (rate < 1) rateEl.classList.add('is-warn');
    state.appendChild(rateEl);
  }
  card.appendChild(state);

  // 上次失败 → 卡面直接给「怎么办」
  const hint = failHintOf(last);
  if (hint) {
    const box = el('div', 'bz-dock-card-fail');
    box.appendChild(uiIcon('alert-triangle', 'bz-ic--xs'));
    box.appendChild(el('span', 'bz-dock-card-failtext', hint));
    card.appendChild(box);
  }

  // 最近 7 次：通栏迷你时间轴（左旧右新）
  const strip = el('div', 'bz-dock-strip');
  strip.title = '最近 7 次运行（左旧右新）';
  const runs = recentRunsOf(v.path, v.id, 7).slice().reverse();
  for (let i = 0; i < 7; i++) {
    const r = runs[i];
    const pip = el('i', 'bz-dock-pip');
    if (r) {
      pip.classList.add(`bz-dock-pip--${r.status}`);
      pip.title = `${relTime(r.startedAt.replace('T', ' '))} · ${statusText(r.status)}${r.message ? ` · ${r.message}` : ''}`;
    } else {
      pip.title = '这一次没有运行记录';
    }
    strip.appendChild(pip);
  }
  card.appendChild(strip);

  // 动作行：只留运行 / 停止
  const foot = el('div', 'bz-dock-card-foot');
  if (canRun()) {
    if (liveOf(id)) {
      foot.appendChild(uiBtn({ label: '停止', icon: 'square', tone: 'danger', size: 'sm', onClick: () => stopLive(id) }));
    } else {
      const gate = judgeRunGate(v, true);
      const runBtn = uiBtn({
        label: '运行',
        icon: 'play',
        tone: 'primary',
        size: 'sm',
        disabled: !gate.ok || !!externalRunOf(v),
        onClick: () => void doRun(v),
      });
      runBtn.title = gate.ok ? '' : gate.text ?? '';
      foot.appendChild(runBtn);
    }
  } else {
    foot.appendChild(el('span', 'bz-dock-mobilehint', '移动端仅查看'));
  }
  card.appendChild(foot);

  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    view = { kind: 'detail', id };
    render();
  });
  attachItemActions(card, canRun() ? cardActions(v) : []);
  return card;
}

/**
 * 卡片右键菜单（桌面）/ 长按抽屉（移动端）。
 *
 * 只放**这张卡上能立刻做**的事：进详情、跑一次、恢复熔断、重新选目录、停用、移除登记。
 * 「重新读声明」这类每次渲染本来就读一遍的动作不占位 —— 菜单越长，真正想点的越难找。
 */
function cardActions(v: DockToolView): ItemAction[] {
  const acts: ItemAction[] = [
    {
      icon: 'chevron-right',
      label: '打开详情',
      onClick: () => {
        view = { kind: 'detail', id: v.id };
        render();
      },
    },
  ];
  const gate = judgeRunGate(v, canRun());
  if (gate.ok && !externalRunOf(v)) {
    acts.push({ icon: 'play', label: '运行', onClick: () => void doRun(v) });
  }
  if (v.runtime.run?.pausedAt) {
    acts.push({
      icon: 'rotate-ccw',
      label: '恢复自动运行',
      onClick: () => {
        void clearBreakerSafely(v).then((ok) => {
          if (!ok) {
            notice('有工具正在跑，等它跑完再恢复', 'warning');
            return;
          }
          refresh();
        });
      },
    });
  }
  acts.push({ icon: 'folder-input', label: '重新选目录', onClick: () => pickFolder() });
  acts.push({
    icon: v.intent.enabled === false ? 'play-circle' : 'pause-circle',
    label: v.intent.enabled === false ? '启用' : '停用',
    onClick: () => {
      writeIntent(v.path, { ...v.intent, v: 1, tool: v.id, enabled: v.intent.enabled === false });
      void kickDockScheduler();
      refresh();
    },
  });
  acts.push({
    icon: 'x-circle',
    label: '移除登记',
    kind: 'danger',
    onClick: () => {
      if (!window.confirm(`从工具坞移除「${displayNameOf(v)}」？\n只删登记，不动磁盘上的文件。`)) return;
      removeTool(v.id);
      refresh();
    },
  });
  return acts;
}

// ==================== 详情 ====================

function renderDetail(body: HTMLElement, v: DockToolView): void {
  const wrap = el('div', 'bz-dock-detail');

  if (v.error) wrap.appendChild(el('div', 'bz-dock-meta-warn', v.error));

  // 展示板排在最前：第一眼该看到「这个工具给我看了什么」
  const board = boardSection(v);
  if (board) wrap.appendChild(board);

  wrap.appendChild(toolStats(v));
  wrap.appendChild(metaSection(v));
  wrap.appendChild(rulesPane(v));

  const cols = el('div', 'bz-dock-cols');
  cols.appendChild(runPane(v));
  cols.appendChild(histPane(v));
  wrap.appendChild(cols);

  body.appendChild(wrap);
}

// ---------- 展示板 ----------

/**
 * 展示板 iframe **文档内部**的滚动条样式 —— 全仓唯一允许的 `<style>` 注入（ADR-0243 补记）。
 *
 * 为什么改不了 CSS 文件：`style` 属性写不了伪元素，core 的界面级规则（ADR-0122）又跨不过
 * 文档边界。所以只放滚动条声明 —— 想顺手改框里别的样式，守卫会红。
 */
export const FRAME_SCROLLBAR_CSS =
  '<style>html{scrollbar-width:none;-ms-overflow-style:none}' +
  'html::-webkit-scrollbar{display:none;width:0;height:0}</style>';

/** 展示板文件的上限：面板不是浏览器，几百 KB 的文档灌进 srcdoc 会把「打开详情」拖成秒级 */
const BOARD_MAX_BYTES = 512 * 1024;
/** 展示板的可视高度上限：内容再多也只占这么高，超了在框内滚（条已藏掉） */
const BOARD_MAX_HEIGHT = 560;

/**
 * 灌给展示板的主题变量 —— 只挑「画一块内容」够用的那一小撮。
 * 给全套等于把面板内部 token 变成公开 API（日后重构得先问过所有工具），
 * 而这一小撮已经够脚本画出「像是面板的一部分」的东西。
 */
const BOARD_THEME_VARS = [
  '--bz-surface-0',
  '--bz-surface-1',
  '--bz-surface-2',
  '--bz-surface-3',
  '--bz-text-1',
  '--bz-text-2',
  '--bz-text-3',
  '--bz-border',
  '--bz-brand',
  '--bz-brand-soft',
  '--bz-success',
  '--bz-warning',
  '--bz-danger',
  '--bz-radius-sm',
  '--bz-radius-md',
  '--bz-font-ui',
  '--bz-font-mono',
  '--bz-space-xs',
  '--bz-space-sm',
  '--bz-space-md',
  '--bz-space-lg',
];

/** 一个值要塞进双引号包的 HTML 属性时的转义：`&` 防二次解码，`"` 防属性提前收尾 */
export function escapeStyleAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * 框内 `<body>` 的基线：主题变量 + 撑满 + 跟主题走。
 *
 * `margin:0` 与 `background:transparent` 是**必需**的（body 默认 8px 外边距、iframe 内容默认白底），
 * 另几条只是给个合理默认观感 —— 少了它们，展示板看起来就是「另一个世界」。
 *
 * **值必须转义**：主题变量里有 `--bz-font-ui: -apple-system, "Segoe UI", …` 这种带引号的值，
 * 原样拼进 `style="…"` 会让属性在第一个 `"` 处提前收尾，后面所有声明一起被丢掉。
 */
export function frameBaseStyle(): string {
  const cs = getComputedStyle(document.body);
  const parts = BOARD_THEME_VARS.map((name) => {
    const value = cs.getPropertyValue(name).trim();
    return value ? `${name}:${escapeStyleAttr(value)}` : '';
  }).filter(Boolean);
  parts.push(
    'margin:0',
    'padding:var(--bz-space-md)',
    'background:transparent',
    'color:var(--bz-text-1)',
    'font-family:var(--bz-font-ui)',
    'font-size:var(--bz-font-label)',
    'line-height:1.6',
  );
  return parts.join(';');
}

/**
 * 框文档**根元素**那一条：隐藏框自己的滚动条（ADR-0122「只隐藏条、保留滚动」同款）。
 *
 * 必须挂根上：框里的滚动条是**视口滚动条**，归 `<html>` 管；`scrollbar-width` 不继承，
 * 挂 body 上对它无效。所以别把它并进 `frameBaseStyle()`（那是 body 基线）。
 */
export function frameRootStyle(): string {
  return 'scrollbar-width:none';
}

/**
 * 把 iframe 撑到内容那么高。
 *
 * **为什么不能只量一次**：面板关着的时候也会渲染（刷新 / 运行结束后的重渲染），而 `display:none`
 * 的框里文档没有布局 —— `scrollHeight` 量出来是 0；只量一次就再也不纠正，框停在默认 150px。
 * 所以立刻量一次 + `ResizeObserver` 跟着框内文档走。
 */
export function fitFrameHeight(frame: HTMLIFrameElement): void {
  const doc = frame.contentDocument;
  if (!doc) return;
  let last = -1;
  const measure = (): void => {
    const h = Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0);
    // 差 1px 不动它：否则「量高 → 框变高 → 框内重排 → 再量」会互相追着改
    if (h > 0 && Math.abs(h - last) > 1) {
      last = h;
      frame.style.height = `${h}px`;
    }
  };
  measure();
  try {
    const ro = new ResizeObserver(measure);
    if (doc.body) ro.observe(doc.body);
    ro.observe(doc.documentElement);
  } catch {
    /* 没有 ResizeObserver 的老环境：只留上面那一次 */
  }
}

/**
 * 一段 HTML 装进沙箱 iframe。
 *
 * 为什么是 iframe 而不是净化后直插：直接插，一段 `<style>` 就会串到整个面板，一个没闭合的标签
 * 就会把后面的 DOM 吃掉；iframe 天然把这两样关在框里。
 * 带 `allow-same-origin` 是为了能读 `contentDocument` 量高度，也顺带让宿主的 click 监听够得着框里的链接。
 */
function sandboxFrame(
  html: string,
  className: string,
  title: string,
  opts: { maxHeight?: number; allowPopups?: boolean; allowScripts?: boolean } = {},
): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.className = className;
  const sandbox = ['allow-same-origin'];
  if (opts.allowPopups) sandbox.push('allow-popups', 'allow-popups-to-escape-sandbox');
  if (opts.allowScripts) sandbox.push('allow-scripts');
  frame.setAttribute('sandbox', sandbox.join(' '));
  frame.setAttribute('title', title);
  frame.setAttribute('referrerpolicy', 'no-referrer');
  if (opts.maxHeight) frame.style.maxHeight = `${opts.maxHeight}px`;
  // 框里写片段就行：外层 `<html>` 挂隐藏滚动条那条，`<body>` 承载主题基线
  frame.srcdoc =
    `<html style="${frameRootStyle()}"><head>${FRAME_SCROLLBAR_CSS}</head>` +
    `<body style="${frameBaseStyle()}">${html}</body></html>`;
  frame.addEventListener('load', () => {
    fitFrameHeight(frame);
    if (opts.allowPopups) wireExternalLinks(frame);
  });
  return frame;
}

/**
 * 框里的外链交给系统浏览器。
 *
 * 只靠沙箱的 `allow-popups` 不保险：Electron 里 `target=_blank` 走的是 Obsidian 自己的
 * window.open 处理，开不开全看宿主版本，用户看到的就是「点了没反应」。框是同源的，
 * 外面直接挂监听自己开，`shell.openExternal` 一定走默认浏览器。
 */
function wireExternalLinks(frame: HTMLIFrameElement): void {
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.addEventListener(
    'click',
    (ev) => {
      const target = ev.target as HTMLElement | null;
      const a = target && typeof target.closest === 'function' ? target.closest('a[href]') : null;
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (!/^https?:\/\//i.test(href)) return;
      ev.preventDefault();
      const shell = (window as unknown as {
        require?: (id: string) => { shell?: { openExternal(url: string): void } };
      }).require?.('electron')?.shell;
      if (shell) shell.openExternal(href);
      else window.open(href, '_blank', 'noopener');
    },
    true,
  );
}

/**
 * 展示板（ADR-0243）：工具目录里的 `panel.html`，工具自己画，面板把它内嵌在详情页最前。
 *
 * **不给标题**：这块就是「工具自己画的东西」，再写个「展示板」是面板在自说自话
 * （iframe 的 `title` 属性留给读屏，那里需要一个名字）。
 */
function boardSection(v: DockToolView): HTMLElement | null {
  const html = panelOf(v.path, currentFs());
  if (html === null) return null;

  const host = el('div', 'bz-dock-board');
  // 按**字节**算：字符串的 length 是 UTF-16 码元数，中文一个码元占三字节 ——
  // 拿码元当上限等于对中文内容把门槛放成三倍
  const bytes = new TextEncoder().encode(html).length;
  if (bytes > BOARD_MAX_BYTES) {
    host.appendChild(
      el(
        'div',
        'bz-dock-board-warn',
        `panel.html 有 ${Math.round(bytes / 1024)} KB，超过 ${BOARD_MAX_BYTES / 1024} KB 就不渲染了 —— 展示板是「一眼看完的几行数」`,
      ),
    );
    return host;
  }

  host.appendChild(
    sandboxFrame(html, 'bz-dock-board-frame', `${displayNameOf(v)} 的展示板`, {
      maxHeight: BOARD_MAX_HEIGHT,
      allowPopups: true,
      allowScripts: true,
    }),
  );
  return host;
}

// ---------- 统计三格 ----------

function toolStats(v: DockToolView): HTMLElement {
  const box = el('div', 'bz-dock-kpi bz-dock-toolstats');
  const runs = recentRunsOf(v.path, v.id, 60).filter((r) => r.status !== 'running');
  const ok = runs.filter((r) => r.status === 'ok').length;
  const single = (num: string, unit: string, label: string, sub: string): HTMLElement => {
    const t = el('div', 'bz-dock-kpi-tile');
    const val = el('div', 'bz-dock-kpi-v', num);
    if (unit) val.appendChild(el('small', undefined, unit));
    t.append(val, el('div', 'bz-dock-kpi-l', label), el('div', 'bz-dock-kpi-d', sub));
    return t;
  };
  box.append(
    single(String(v.params.length), '', '参数', v.params.length ? '在运行台里改' : '这个工具没有参数'),
    single(runs.length ? String(Math.round((ok / runs.length) * 100)) : '—', runs.length ? '%' : '', '成功率', runs.length ? `${runs.length} 条记录` : '还没跑过'),
    single(v.rules.filter((r) => r.enabled !== false).length ? '自动' : '手动', '', '节奏', v.rules.length ? `${v.rules.length} 条规则` : '没有规则'),
  );
  return box;
}

// ---------- meta ----------

function metaRow(label: string, value: string, mono = false, onCopy?: () => void): HTMLElement {
  const row = el('div', 'bz-dock-meta-row');
  row.appendChild(el('span', 'bz-dock-meta-label', label));
  const val = el('span', mono ? 'bz-dock-meta-val is-mono' : 'bz-dock-meta-val', value);
  val.title = value;
  row.appendChild(val);
  if (onCopy) {
    row.appendChild(uiIconBtn({ icon: 'copy', title: '复制', xs: true, onClick: onCopy }));
  }
  return row;
}

function metaSection(v: DockToolView): HTMLElement {
  const meta = el('div', 'bz-dock-meta');
  meta.appendChild(metaRow('声明文件', v.path, true, () => void copyText(v.path, '声明文件路径')));
  if (v.entry) {
    meta.appendChild(metaRow('命令', [v.entry.cmd, ...(v.entry.args ?? [])].join(' '), true));
    if (v.entry.cwd) meta.appendChild(metaRow('工作目录', v.entry.cwd, true));
    if (v.entry.shell) meta.appendChild(metaRow('经 shell 启动', '是'));
  } else {
    meta.appendChild(metaRow('命令', '声明里没写 entry —— 能看，但不知道该怎么跑'));
  }
  const dir = v.dir;
  meta.appendChild(metaRow('参数值文件', `${dir}/data.json`, true, () => void copyText(`${dir}/data.json`, '参数值文件路径')));
  meta.appendChild(metaRow('运行记录', `${dir}/runs.jsonl`, true, () => void copyText(`${dir}/runs.jsonl`, '运行记录路径')));
  return meta;
}

// ---------- 运行台 ----------

function runPane(v: DockToolView): HTMLElement {
  const pane = el('section', 'bz-dock-pane bz-dock-runpane');
  const head = el('div', 'bz-dock-pane-head');
  head.appendChild(el('h3', 'bz-dock-pane-title', '运行台'));
  // 与规则表同口径：手机上只能看。标出来比让人点了没反应好
  if (!canRun()) head.appendChild(el('span', 'bz-dock-pane-count', '只读'));
  pane.appendChild(head);

  if (!v.manifest) {
    const box = el('div', 'bz-dock-noManifest');
    box.appendChild(el('div', 'bz-dock-note', v.error ?? '声明文件读不到。'));
    pane.appendChild(box);
    return pane;
  }

  if (v.params.length) {
    const form = el('div', 'bz-dock-form');
    const values: Record<string, unknown> = { ...v.values };
    for (const p of v.params) form.appendChild(paramRow(p, values, v));
    pane.appendChild(form);
  } else {
    pane.appendChild(el('div', 'bz-dock-note', '这个工具没有参数。'));
  }

  if (!v.entry) {
    pane.appendChild(el('div', 'bz-dock-meta-warn', '这份声明没写 entry —— 能看它的记录，但不知道该怎么跑。'));
  }

  pane.appendChild(runBtns(v));

  // 上一次现场运行的原始输出尾部：跑完不清，下次运行覆盖；只在内存
  const tail = lastTails.get(v.id);
  if (!liveOf(v.id) && tail?.length) {
    const box = el('div', 'bz-dock-lastraw');
    box.appendChild(el('div', 'bz-dock-lastraw-head', '上次现场输出（尾部）'));
    const pre = el('pre', 'bz-dock-raw');
    pre.textContent = tail.slice(-12).join('\n');
    box.appendChild(pre);
    pane.appendChild(box);
  }

  const liveHost = el('div', 'bz-dock-live');
  liveHost.dataset.tool = v.id;
  pane.appendChild(liveHost);
  renderLiveIntoEl(liveHost, v);
  return pane;
}

/**
 * 运行台底下那排按钮。
 *
 * 单独一个函数只为一件事：后台跑完时这一排要从「后台正在跑」变回「运行」，
 * 而它上面那张参数表可能是用户正在填的 —— 重画整台会把填了一半的输入抹掉。
 */
function runBtns(v: DockToolView): HTMLElement {
  const btns = el('div', 'bz-dock-runbtns');
  if (!canRun()) {
    btns.appendChild(el('span', 'bz-dock-mobilehint', '移动端不能启动进程，只能看'));
    return btns;
  }
  const live = liveOf(v.id);
  const external = externalRunOf(v);
  if (live) {
    btns.appendChild(uiBtn({ label: '停止', icon: 'square', tone: 'danger', onClick: () => stopLive(v.id) }));
  } else {
    const gate = judgeRunGate(v, true);
    const run = uiBtn({
      label: external ? '后台正在跑' : '运行',
      icon: 'play',
      tone: 'primary',
      disabled: !gate.ok || !!external,
      onClick: () => void doRun(v),
    });
    run.title = external ? '后台值守正在跑它，等它跑完' : gate.ok ? '' : gate.text ?? '';
    btns.appendChild(run);
  }
  if (!v.trusted) {
    btns.appendChild(
      uiBtn({
        label: v.trustStale ? '重新授权' : '授权这条命令',
        icon: 'shield-check',
        onClick: () => void doTrust(v),
      }),
    );
  } else {
    btns.appendChild(uiBtn({ label: '撤销授权', size: 'sm', onClick: () => void doUntrust(v) }));
  }
  if (v.runtime.run?.pausedAt) {
    btns.appendChild(
      uiBtn({
        label: '恢复自动运行',
        size: 'sm',
        onClick: () => {
          void clearBreakerSafely(v).then((ok) => {
            if (!ok) {
              notice('有工具正在跑，等它跑完再恢复', 'warning');
              return;
            }
            refresh();
          });
        },
      }),
    );
  }
  return btns;
}

/** 详情页的那块实时区（tick / live 事件都只重画这一块） */
function renderLiveInto(id: string): void {
  const host = bodyEl()?.querySelector<HTMLElement>(`.bz-dock-live[data-tool="${id}"]`);
  if (!host) return;
  const v = viewById(id);
  if (!v) return;
  renderLiveIntoEl(host, v);
}

function renderLiveIntoEl(host: HTMLElement, v: DockToolView): void {
  host.innerHTML = '';
  const live = liveOf(v.id);
  const external = externalRunOf(v);
  if (!live && !external) return;

  const box = el('div', 'bz-dock-livelog');
  if (live) {
    box.appendChild(el('div', 'bz-dock-livelog-head', `工单 ${live.runId} · ${live.phase ?? '进行中'}${live.pct !== null ? ` ${live.pct}%` : ''}`));
    if (live.pct !== null) box.appendChild(uiProgress({ thin: true, value: live.pct }).el);
    const steps = live.steps.slice(-40);
    if (!steps.length) box.appendChild(el('div', 'bz-dock-note', '还没有输出'));
    for (const s of steps) box.appendChild(el('div', 'bz-dock-liveline', s.text));
    host.appendChild(box);
    return;
  }

  // 后台值守拉起的：步骤由值守落到本机的 `live/<工具>.jsonl`，面板读那一个文件
  const runId = external?.runId ?? '';
  box.appendChild(el('div', 'bz-dock-livelog-head', `后台进程在跑 · 工单 ${runId || '（未标注）'}`));
  const steps = liveLogOf(v.id, 40).filter((s) => !runId || !s.runId || s.runId === runId);
  if (steps.length) {
    for (const s of steps) box.appendChild(el('div', 'bz-dock-liveline', s.text));
  } else {
    if (external?.step) box.appendChild(el('div', 'bz-dock-liveline', external.step));
    box.appendChild(el('div', 'bz-dock-note', '后台这一轮刚开始，还没输出；跑完会出现在右边的记录里'));
  }
  host.appendChild(box);
}

// ---------- 参数表单 ----------

function paramRow(p: DockParam, values: Record<string, unknown>, v: DockToolView): HTMLElement {
  const current = values[p.key] ?? p.default;
  const commit = (val: unknown): void => {
    values[p.key] = val;
    writeSettings(v.path, v.id, values);
  };
  const label = (p.label ?? p.key) + (p.required ? ' *' : '');
  const desc = p.hint;

  // 移动端**只读**：参数只给看，不给改。
  // 手机上的 fs 是打开面板时预取的内存快照，写函数是空的 —— 控件照样能点、界面照样变，
  // 但盘上的 `data.json` 一点没动。那种「看起来已保存」比不给入口糟得多，所以这里连控件都不建。
  if (!canRun()) {
    return uiField({ label, control: readonlyValueOf(p, current), desc });
  }

  if (p.type === 'bool') {
    const sw = uiSwitch({ checked: current === true, onChange: (on) => commit(on) });
    return uiField({ label, control: sw.el, desc });
  }
  if (p.type === 'choice') {
    const opts = (p.options ?? []).map((o) => ({ value: o, label: o }));
    const sel = uiSelect<string>({ options: opts, value: String(current ?? p.options?.[0] ?? ''), onChange: (val) => commit(val) });
    return uiField({ label, control: sel.el, desc });
  }
  if (p.type === 'multiline') {
    const ta = el('textarea', 'bz-input bz-dock-textarea');
    ta.value = current === undefined ? '' : String(current);
    ta.addEventListener('change', () => commit(ta.value));
    return uiField({ label, control: ta, desc });
  }
  const inp = uiInput({
    type: p.type === 'secret' ? 'password' : p.type === 'number' ? 'number' : 'text',
    value: current === undefined ? '' : String(current),
  });
  inp.addEventListener('change', () => {
    if (p.type === 'number') {
      const n = Number(inp.value);
      commit(Number.isFinite(n) ? n : undefined);
    } else {
      commit(inp.value);
    }
  });
  return uiField({
    label,
    control: inp,
    desc: p.type === 'secret' ? '凭据只存本机工具目录，不进命令行、不写运行记录' : desc,
  });
}

/**
 * 参数值的**只读形态**（移动端）。
 *
 * 不用「禁用的输入框」：禁用态在触屏上看着像坏了，而且一行里既有能点的又有点不上的，
 * 反而分不清哪个能改。这里直接给文本，与上面的标签/说明是同一套排版。
 *
 * `secret` 只报「已设置」—— 手机是最容易被旁边人看到的那块屏幕，这类值本来就是
 * 「填过就好，不需要再读一遍」。
 */
function readonlyValueOf(p: DockParam, current: unknown): HTMLElement {
  const box = el('span', 'bz-dock-roval');
  if (p.type === 'secret') {
    const set = current !== undefined && current !== null && String(current) !== '';
    if (!set) box.classList.add('is-empty');
    box.textContent = set ? '已设置（手机上不显示）' : '未填';
    return box;
  }
  if (p.type === 'bool') {
    box.textContent = current === true ? '开' : '关';
    return box;
  }
  const text = current === undefined || current === null ? '' : String(current).trim();
  if (!text) {
    box.classList.add('is-empty');
    box.textContent = '未填';
    return box;
  }
  if (p.type === 'multiline') box.classList.add('bz-dock-roval--code');
  box.textContent = text;
  return box;
}

// ---------- 规则表 ----------

function rulesPane(v: DockToolView): HTMLElement {
  const pane = el('section', 'bz-dock-pane bz-dock-rulespane');
  const head = el('div', 'bz-dock-pane-head');
  head.appendChild(el('h3', 'bz-dock-pane-title', '自动运行'));
  head.appendChild(el('span', 'bz-dock-pane-count', v.rules.length ? `${v.rules.length} 条` : '只能手动跑'));
  pane.appendChild(head);

  if (!v.rules.length) pane.appendChild(el('div', 'bz-dock-note', '没有规则 —— 加一条就有了'));

  const list = el('div', 'bz-dock-rulelist');
  v.rules.forEach((rule, i) => list.appendChild(ruleRow(v, rule, i)));
  pane.appendChild(list);

  if (canRun()) {
    pane.appendChild(
      uiBtn({
        label: '添加规则',
        icon: 'plus',
        size: 'sm',
        onClick: () => {
          saveRules(v, v.rules.concat(defaultRule()));
        },
      }),
    );
  }
  return pane;
}

/**
 * 规则一行 = **只读摘要**，整行点开弹窗改。
 *
 * 不在行内摊编辑器：九种触发各自要的参数框挤在一行里，既看不清也点不准。
 * 旧面板就是这个口径 —— 摘要一行、点进去改、改完回显一句人话再保存。
 */
function ruleRow(v: DockToolView, rule: DockRule, index: number): HTMLElement {
  const row = el('div', 'bz-dock-rule');
  const main = el('div', 'bz-dock-rulemain');
  const nameOf = (id: string): string => {
    const t = viewById(id);
    return t ? displayNameOf(t) : id;
  };
  main.appendChild(el('div', 'bz-dock-ruleline', triggerText(rule.trigger, nameOf)));
  const meta = [actionText(rule.action)];
  if (rule.jitterMin) meta.push(`抖 ${rule.jitterMin} 分钟`);
  if (rule.enabled === false) meta.push('已停用');
  main.appendChild(el('div', 'bz-dock-rulemeta', meta.join(' · ')));

  const due = nextDueOf(rule, {
    now: Date.now(),
    lastFiredAt: v.runtime.rules?.[rule.id]?.lastFiredAt
      ? Date.parse(v.runtime.rules[rule.id].lastFiredAt as string)
      : undefined,
  });
  if (due && rule.enabled !== false && !isEventTrigger(rule.trigger.kind)) {
    main.appendChild(el('div', 'bz-dock-rulemeta', `下次 ${new Date(due).toLocaleString()}`));
  }
  row.appendChild(main);

  // 移动端只读：不给「点进去改」的入口（也就没有箭头与 role=button）
  if (!canRun()) {
    row.classList.add('is-readonly');
    return row;
  }
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.appendChild(el('span', 'bz-dock-rulearrow', '›'));
  const open = (): void => openRuleEditor(v, rule, index);
  row.addEventListener('click', open);
  row.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    open();
  });
  return row;
}

/**
 * 规则编辑弹窗（新建 / 编辑共用）。
 *
 * 底行那句话是整条规则的**人话回显**：改哪儿它跟到哪儿，保存前能自己核对一遍 ——
 * 规则是「到点替你起进程」的东西，填错了不会有第二次确认的机会。
 */
function openRuleEditor(v: DockToolView, rule: DockRule | null, index: number): void {
  const draft: DockRule = rule
    ? { ...rule, trigger: { ...rule.trigger }, action: { ...rule.action } }
    : { ...defaultRule(), trigger: defaultRule().trigger };

  const form = el('div', 'bz-dock-ruleform');
  const params = el('div', 'bz-dock-ruleparams');
  const err = el('div', 'bz-dock-ruleformerr');
  const preview = el('div', 'bz-dock-rulepreview');

  const syncPreview = (): void => {
    const jit = draft.jitterMin ? ` · 抖 ${draft.jitterMin} 分钟` : '';
    preview.textContent = `${triggerText(draft.trigger, (id) => (viewById(id) ? displayNameOf(viewById(id)!) : id))} → ${actionText(draft.action)}${jit}`;
  };
  const rebuild = (): void => {
    params.replaceChildren(...triggerFieldsOf(draft, rebuild));
    syncPreview();
  };

  const triggerPick = uiChoice<DockTriggerKind>({
    options: TRIGGER_KINDS.map((k) => ({ value: k, label: TRIGGER_LABEL[k] })),
    value: draft.trigger.kind,
    label: '触发条件',
    onChange: (kind) => {
      draft.trigger = blankTrigger(kind);
      rebuild();
    },
  });

  const actionPick = uiChoice<'run' | 'remind'>({
    options: [
      { value: 'run', label: '运行' },
      { value: 'remind', label: '只提醒' },
    ],
    value: draft.action.kind,
    label: '执行',
    onChange: (kind) => {
      draft.action = { kind };
      syncPreview();
    },
  });

  const jitter = uiInput({ type: 'number', value: String(draft.jitterMin ?? 0) });
  jitter.min = '0';
  jitter.max = '720';
  jitter.addEventListener('change', () => {
    const n = Number(jitter.value);
    draft.jitterMin = Number.isFinite(n) && n > 0 ? Math.min(720, Math.floor(n)) : undefined;
    syncPreview();
  });

  const enabled = uiSwitch({
    checked: draft.enabled !== false,
    onChange: (on) => {
      draft.enabled = on;
    },
  });

  const group = (title: string, children: HTMLElement[]): HTMLElement => {
    const box = el('div', 'bz-dock-ruleformsec');
    box.appendChild(el('div', 'bz-dock-ruleformlegend', title));
    for (const c of children) box.appendChild(c);
    return box;
  };

  form.appendChild(group('触发条件', [triggerPick.el, params]));
  form.appendChild(group('执行', [actionPick.el, uiField({ label: '错峰：到点后再等（分钟）', control: jitter, desc: '0 = 不抖' })]));
  form.appendChild(group('状态', [uiField({ label: '这条规则生效', control: enabled.el })]));
  form.appendChild(preview);
  form.appendChild(err);
  rebuild();

  const modal = uiModal({ head: true, title: rule ? '编辑规则' : '新建规则', content: form, maxWidth: 480 });

  /** 缺参数的规则跑不起来 —— 说清缺什么，比让它静默生效强 */
  const problem = (): string | null => {
    const t = draft.trigger;
    if ((t.kind === 'tool-ok' || t.kind === 'tool-fail') && !t.toolId) return '还没选工具';
    if (t.kind === 'domain-event' && !t.channel.trim()) return '还没填事件通道';
    if (t.kind === 'file-change' && !t.target.trim()) return '还没填目录';
    if (t.kind === 'value-threshold' && (!t.path.trim() || !t.key.trim())) return '还没填文件与键';
    return null;
  };

  const buttons: HTMLElement[] = [];
  if (rule) {
    buttons.push(
      uiBtn({
        label: '删除',
        tone: 'danger',
        onClick: () => {
          modal.close();
          saveRules(v, v.rules.filter((r) => r.id !== rule.id));
        },
      }),
    );
  }
  buttons.push(
    uiBtn({ label: '取消', onClick: () => modal.close() }),
    uiBtn({
      label: '保存',
      tone: 'primary',
      onClick: () => {
        const bad = problem();
        if (bad) {
          err.textContent = bad;
          return;
        }
        const next = v.rules.slice();
        if (rule) next[index] = { ...draft, id: rule.id };
        else next.push({ ...draft, id: `r${Date.now().toString(36)}` });
        modal.close();
        saveRules(v, next);
      },
    }),
  );
  form.appendChild(uiBtnRow(buttons));

  syncPreview();
}

/** 触发类型的参数区（换类型时整块重建） */
function triggerFieldsOf(draft: DockRule, rebuild: () => void): HTMLElement[] {
  const t = draft.trigger;
  const out: HTMLElement[] = [];
  if (t.kind === 'daily') {
    const inp = uiInput({ type: 'time', value: t.at });
    inp.addEventListener('change', () => {
      if (!/^\d{1,2}:\d{2}$/.test(inp.value)) return;
      draft.trigger = { kind: 'daily', at: inp.value };
      rebuild();
    });
    out.push(uiField({ label: '每天几点', control: inp }));
  } else if (t.kind === 'interval') {
    const inp = uiInput({ type: 'number', value: String(t.everyMin) });
    inp.min = '1';
    inp.addEventListener('change', () => {
      const n = Number(inp.value);
      if (!Number.isFinite(n) || n < 1) return;
      draft.trigger = { kind: 'interval', everyMin: Math.min(43200, Math.floor(n)) };
      rebuild();
    });
    out.push(uiField({ label: '每隔多少分钟', control: inp }));
  } else if (t.kind === 'on-launch') {
    const inp = uiInput({ type: 'number', value: String(t.delayMin) });
    inp.min = '0';
    inp.addEventListener('change', () => {
      const n = Number(inp.value);
      if (!Number.isFinite(n) || n < 0) return;
      draft.trigger = { kind: 'on-launch', delayMin: Math.min(1440, Math.floor(n)) };
      rebuild();
    });
    out.push(uiField({ label: '启动 Obsidian 后多少分钟', control: inp }));
  } else if (t.kind === 'tool-ok' || t.kind === 'tool-fail') {
    const opts = [{ value: '', label: '（选一个工具）' }].concat(
      views.map((v) => ({ value: v.id, label: displayNameOf(v) })),
    );
    const sel = uiSelect<string>({
      options: opts,
      value: t.toolId,
      onChange: (id) => {
        draft.trigger = t.kind === 'tool-ok' ? { kind: 'tool-ok', toolId: id } : { kind: 'tool-fail', toolId: id };
        rebuild();
      },
    });
    out.push(uiField({ label: '哪个工具', control: sel.el }));
  } else if (t.kind === 'domain-event') {
    const inp = uiInput({ value: t.channel });
    inp.addEventListener('change', () => {
      draft.trigger = { kind: 'domain-event', channel: inp.value.trim() };
    });
    out.push(uiField({ label: '事件通道', control: inp, desc: '例如 memo-saved；填错了这条规则永远不会响' }));
  } else if (t.kind === 'file-change') {
    const inp = uiInput({ value: t.target });
    inp.addEventListener('change', () => {
      draft.trigger = { kind: 'file-change', target: inp.value.trim().replace(/\/+$/, '') };
    });
    out.push(uiField({ label: 'vault 里的目录', control: inp, desc: '那个目录里有文件变动就跑一次' }));
  } else if (t.kind === 'value-threshold') {
    const pathIn = uiInput({ value: t.path });
    const keyIn = uiInput({ value: t.key });
    const opSel = uiSelect<'>' | '<' | '='>({
      options: [
        { value: '>', label: '大于' },
        { value: '<', label: '小于' },
        { value: '=', label: '等于' },
      ],
      value: t.op,
      onChange: (op) => {
        draft.trigger = { ...t, op };
      },
    });
    const numIn = uiInput({ type: 'number', value: String(t.value) });
    pathIn.addEventListener('change', () => {
      draft.trigger = { ...t, path: pathIn.value.trim() };
    });
    keyIn.addEventListener('change', () => {
      draft.trigger = { ...t, key: keyIn.value.trim() };
    });
    numIn.addEventListener('change', () => {
      const n = Number(numIn.value);
      if (Number.isFinite(n)) draft.trigger = { ...t, value: n };
    });
    out.push(uiField({ label: '文件', control: pathIn, desc: 'vault 里的 JSON' }));
    out.push(uiField({ label: '键', control: keyIn }));
    const row = el('div', 'bz-dock-rule-edit');
    row.append(opSel.el, numIn);
    out.push(uiField({ label: '条件', control: row }));
  } else {
    out.push(el('div', 'bz-dock-note', '这条触发不需要参数。'));
  }
  return out;
}

function blankTrigger(kind: DockTriggerKind): DockTrigger {
  switch (kind) {
    case 'daily':
      return { kind: 'daily', at: '09:00' };
    case 'interval':
      return { kind: 'interval', everyMin: 60 };
    case 'on-launch':
      return { kind: 'on-launch', delayMin: 5 };
    case 'tool-ok':
      return { kind: 'tool-ok', toolId: '' };
    case 'tool-fail':
      return { kind: 'tool-fail', toolId: '' };
    case 'domain-event':
      return { kind: 'domain-event', channel: '' };
    case 'file-change':
      return { kind: 'file-change', target: '' };
    case 'value-threshold':
      return { kind: 'value-threshold', path: '', key: '', op: '>', value: 0 };
    case 'obsidian-exit':
      return { kind: 'obsidian-exit' };
    default:
      return { kind: 'panel-open' };
  }
}

function saveRules(v: DockToolView, rules: DockRule[]): void {
  writeIntent(v.path, { ...v.intent, v: 1, tool: v.id, rules });
  void kickDockScheduler();
  refresh();
}

// ---------- 运行记录 ----------

function histPane(v: DockToolView): HTMLElement {
  const pane = el('section', 'bz-dock-pane bz-dock-histpane');
  const runs = recentRunsOf(v.path, v.id, 60);
  const head = el('div', 'bz-dock-pane-head');
  head.appendChild(el('h3', 'bz-dock-pane-title', '运行记录'));
  head.appendChild(el('span', 'bz-dock-pane-count', `${runs.length} 条`));
  pane.appendChild(head);

  if (!runs.length) {
    pane.appendChild(
      uiEmpty({
        icon: 'history',
        title: '还没有运行记录',
        desc: '跑一次，或等它按规则自动跑完，记录就会出现',
      }),
    );
    return pane;
  }
  const list = el('div', 'bz-dock-histlist');
  for (const r of runs) list.appendChild(histRow(r, v.id));
  pane.appendChild(list);
  // 被 60 条窗口挤掉的 runId 不再记着 —— **只动这个工具自己的那份**，
  // 别的工具正在展开的那条不归这里管
  const open = openRuns.get(v.id);
  if (open?.size) {
    const alive = new Set(runs.map((r) => r.runId));
    for (const id of open) if (!alive.has(id)) open.delete(id);
  }
  if (runs.length >= 60) pane.appendChild(el('div', 'bz-dock-note', '只显示最近 60 条'));
  return pane;
}

function histRow(r: DockRunRecord, toolId: string): HTMLElement {
  const row = el('article', 'bz-dock-histrow');
  row.dataset.run = r.runId;
  const openSet = openRunsOf(toolId);
  const wasOpen = openSet.has(r.runId);
  const head = el('div', 'bz-dock-histhead');
  head.appendChild(el('span', dotClass(r.status)));
  head.appendChild(el('span', 'bz-dock-histtime', relTime(r.startedAt.replace('T', ' '))));
  head.appendChild(el('span', 'bz-dock-histstatus', statusText(r.status)));
  if (r.durationMs) head.appendChild(el('span', 'bz-dock-histdur', `${Math.round(r.durationMs / 1000)}s`));
  head.appendChild(el('span', 'bz-dock-histtrig', r.trigger === 'auto' ? '自动' : '手动'));
  row.appendChild(head);
  if (r.message) row.appendChild(el('div', 'bz-dock-histmsg', r.message));

  if (r.error) {
    const box = el('div', 'bz-dock-histerr');
    box.appendChild(el('div', 'bz-dock-histerr-hint', hintOf(r.error.kind)));
    if (r.error.detail) box.appendChild(el('div', 'bz-dock-histerr-detail', r.error.detail));
    row.appendChild(box);
  }

  const hasMore =
    (r.steps && r.steps.length > 0) ||
    (r.info && r.info.length > 0) ||
    r.result !== undefined ||
    r.metrics !== undefined ||
    (r.artifacts && r.artifacts.length > 0) ||
    !!r.error?.stderr;
  if (hasMore) {
    const btn = uiBtn({
      label: wasOpen ? '收起' : '展开',
      size: 'sm',
      className: 'bz-dock-histtoggle',
    });
    row.appendChild(btn);
    // 重建时按记录恢复：用户展开看的那条不会因为后台又写了一条就被收回去
    if (wasOpen) row.classList.add('is-open');

    const more = el('div', 'bz-dock-histmore');
    if (r.steps?.length) more.appendChild(block('步骤', r.steps.map((s) => s.text).join('\n')));
    if (r.metrics) more.appendChild(block('指标', JSON.stringify(r.metrics, null, 2)));
    if (r.artifacts?.length) {
      const box = el('div', 'bz-dock-block');
      box.appendChild(el('div', 'bz-dock-block-label', '产物'));
      for (const a of r.artifacts) {
        const line = el('div', 'bz-dock-artrow');
        line.appendChild(el('span', 'bz-dock-artrow-path', `${a.label ? a.label + ' · ' : ''}${a.path}`));
        line.appendChild(uiIconBtn({ icon: 'external-link', title: '打开 / 定位产物', xs: true, onClick: () => openArtifact(a.path) }));
        box.appendChild(line);
      }
      more.appendChild(box);
    }
    if (r.result !== undefined) more.appendChild(block('结果', JSON.stringify(r.result, null, 2)));
    if (r.info?.length) more.appendChild(block('信息', JSON.stringify(r.info, null, 2)));
    if (r.error?.stderr) more.appendChild(block('stderr 尾部', r.error.stderr));
    row.appendChild(more);

    btn.addEventListener('click', () => {
      const open = row.classList.toggle('is-open');
      if (open) openSet.add(r.runId);
      else openSet.delete(r.runId);
      const span = btn.querySelector('span');
      if (span) span.textContent = open ? '收起' : '展开';
    });
  }
  if (r.startedAt) {
    row.appendChild(el('div', 'bz-dock-histexact', r.startedAt.replace('T', ' ').replace(/\..*$/, '')));
  }
  return row;
}

function block(label: string, text: string): HTMLElement {
  const b = el('div', 'bz-dock-block');
  b.appendChild(el('div', 'bz-dock-block-label', label));
  const pre = el('pre', 'bz-dock-json');
  pre.textContent = text;
  b.appendChild(pre);
  return b;
}

// ==================== 动作 ====================

async function doRun(v: DockToolView): Promise<void> {
  const outcome = await runToolManually(v);
  if (outcome) notice(`${displayNameOf(v)}：${outcome.ok ? '跑完了' : '失败了'}`, outcome.ok ? 'success' : 'error');
  refresh();
}

/** 授权：把声明里**现读出来**的那条命令摆给人看，确认的才是那条 */
function doTrust(v: DockToolView): void {
  if (!v.entry) return;
  const content = document.createElement('div');
  content.className = 'bz-dock-trust';
  content.appendChild(el('div', 'bz-dock-note', '授权之后，工具坞可以按这条命令启动它。声明里的命令一改，这道授权就失效。'));
  const pre = el('pre', 'bz-dock-json');
  pre.textContent = [v.entry.cmd, ...(v.entry.args ?? [])].join(' ');
  content.appendChild(pre);

  const modal = uiModal({ content, head: true, title: '授权这条命令', maxWidth: 520 });
  content.appendChild(
    uiBtnRow(
      [
        uiBtn({ label: '取消', onClick: () => modal.close() }),
        uiBtn({
          label: '授权',
          tone: 'primary',
          onClick: () => {
            modal.close();
            void trustTool(v.id, v.entry!).then(() => {
              notice(`${displayNameOf(v)} 已授权`, 'success');
              refresh();
            });
          },
        }),
      ],
      { center: true },
    ),
  );
}

async function doUntrust(v: DockToolView): Promise<void> {
  if (!window.confirm(`撤销「${displayNameOf(v)}」的授权？\n撤销后它不能再跑，直到重新授权。`)) return;
  await untrustTool(v.id);
  refresh();
}

// ==================== 导入 ====================

function pickFolder(): void {
  const input = document.createElement('input');
  input.type = 'file';
  (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    // 只看 manifest.json；`webkitRelativePath` 的段数就是深度 —— 用户选的是父目录时
    // 子目录里的工具会一起进来，取最浅的一层，别把别人的工具当成这次要导的那个
    const cands = files
      .filter((f) => f.name === 'manifest.json')
      .map((f) => ({ f, depth: (f.webkitRelativePath || f.name).split('/').length }))
      .sort((a, b) => a.depth - b.depth);
    if (!cands.length) {
      notice('这个文件夹里没有 manifest.json', 'warning');
      return;
    }
    const shallow = cands.filter((c) => c.depth === cands[0].depth);
    if (shallow.length > 1) {
      notice(`这个文件夹里有 ${shallow.length} 个工具，请选中具体的那一个工具目录`, 'warning');
      return;
    }
    // 只能用 `fileDiskPath` 这条：Electron ≥32 删了 `File.path`，上一版只读它，
    // 于是新版宿主上每次导入都报「读不到文件夹路径」，还把锅推给「平台不支持」
    const abs = fileDiskPath(shallow[0].f);
    if (!abs) {
      notice('读不到文件夹路径（这个平台不支持）', 'warning');
      return;
    }
    void importFrom(abs.replace(/\\/g, '/'));
  });
  input.click();
}

async function importFrom(manifestPath: string): Promise<void> {
  const fs = currentFs();
  if (!fs) {
    notice('桌面端才能导入', 'warning');
    return;
  }
  const text = fs.readText(manifestPath);
  if (text === null) {
    notice('读不到这个文件', 'warning');
    return;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    notice('manifest.json 不是合法 JSON', 'warning');
    return;
  }
  const manifest = parseManifest(raw);
  if (!manifest) {
    notice('声明校验不过（需要 v:2、合法 id、非空 name）', 'warning');
    return;
  }
  upsertTool({ id: manifest.id, path: manifestPath });
  notice(`已登记「${manifest.name}」，先看一眼它会跑什么，再授权`);
  view = { kind: 'detail', id: manifest.id };
  refresh();
}

// ==================== 小工具 ====================

/** 顺手抄一份正在跑的原始输出尾部（跑完 `LiveRun` 就从表里没了） */
function rememberTails(): void {
  for (const run of liveAll()) {
    if (run.rawTail?.length) lastTails.set(run.toolId, run.rawTail.slice(-12));
  }
}

/**
 * 「上次打开之后，自动跑了这些」—— 打开面板时的一次性交代。
 *
 * 旧版这块靠值守写的队列文件，契约 v2 没有那个队列了，所以这里直接从各工具的
 * `runs.jsonl` 里挑 `trigger === 'auto'` 且时间在「上次打开」之后的记录。
 * 口径差别只有一条：插件在场时自动跑的也算进来 —— 所以文案写「上次打开之后」，
 * 不写「离开期间」，说了什么就是什么。
 *
 * 一分钟内反复开关面板不弹：那不是「离开」，是手抖。
 */
function maybeOfflineReport(): void {
  let prev = 0;
  try {
    prev = Number(window.localStorage.getItem(LAST_SEEN_KEY) || 0);
    window.localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
  } catch {
    return; // 隐私模式 / 存储不可用：宁可不弹，也别每次刷一遍
  }
  const now = Date.now();
  if (!Number.isFinite(prev) || prev <= 0 || now - prev < 60_000) return;

  const hits: { name: string; run: DockRunRecord }[] = [];
  for (const v of views) {
    for (const run of recentRunsOf(v.path, v.id, 60)) {
      if (run.trigger !== 'auto') continue;
      const at = Date.parse(run.startedAt);
      if (!Number.isFinite(at) || at <= prev || at > now) continue;
      hits.push({ name: displayNameOf(v), run });
    }
  }
  if (!hits.length) return;
  hits.sort((a, b) => Date.parse(b.run.startedAt) - Date.parse(a.run.startedAt));

  const ok = hits.filter((h) => h.run.status === 'ok').length;
  const bad = hits.length - ok;

  const box = el('div', 'bz-dock-rep');
  const sum = el('div', 'bz-dock-rep-sum');
  sum.appendChild(el('div', 'bz-dock-rep-lead', `上次打开之后，自动跑了 ${hits.length} 次`));
  const tally = el('div', 'bz-dock-rep-tally');
  tally.appendChild(el('span', 'bz-dock-rep-ok', `成功 ${ok}`));
  if (bad) tally.appendChild(el('span', 'bz-dock-rep-bad', `没跑成 ${bad}`));
  tally.appendChild(el('span', 'bz-dock-rep-span', new Date(prev).toLocaleString()));
  sum.appendChild(tally);
  box.appendChild(sum);

  const list = el('div', 'bz-dock-rep-list');
  for (const h of hits.slice(0, 12)) {
    const item = el('div', h.run.status === 'ok' ? 'bz-dock-rep-item' : 'bz-dock-rep-item is-bad');
    const line = el('div', 'bz-dock-rep-line');
    line.appendChild(el('span', 'bz-dock-rep-dot'));
    line.appendChild(el('span', 'bz-dock-rep-name', h.name));
    line.appendChild(el('span', 'bz-dock-rep-fact', `${statusText(h.run.status)} · ${relTime(h.run.startedAt.replace('T', ' '))}`));
    item.appendChild(line);
    if (h.run.message) item.appendChild(el('div', 'bz-dock-rep-detail', h.run.message));
    list.appendChild(item);
  }
  box.appendChild(list);
  if (hits.length > 12) box.appendChild(el('div', 'bz-dock-note', `只列最近 12 条，其余去各工具的记录里看`));

  box.appendChild(
    uiBtnRow([uiBtn({ label: '知道了', tone: 'primary', onClick: () => modal.close() })], { center: true }),
  );
  const modal = uiModal({ head: true, title: '自动运行简报', content: box, maxWidth: 460 });
}

async function copyText(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    notice(`已复制${what}`);
  } catch {
    notice(`复制失败，请手动复制：${text}`, 'warning');
  }
}

/** 打开 / 定位产物：vault 里的用 Obsidian 打开，外面的在文件管理器定位 */
function openArtifact(p: string): void {
  const w = window as unknown as {
    require?: (id: string) => { shell?: { showItemInFolder(p: string): void } };
  };
  const shell = w.require?.('electron')?.shell;
  if (!shell) {
    void copyText(p, '产物路径');
    return;
  }
  const norm = p.replace(/\\/g, '/');
  const isAbsolute = /^[a-zA-Z]:\//.test(norm) || norm.startsWith('//') || norm.startsWith('/');
  if (!isAbsolute && hostApp) {
    const file = hostApp.vault.getAbstractFileByPath(norm);
    if (file) {
      void hostApp.workspace.openLinkText(norm, '', true);
      return;
    }
  }
  const base = hostApp
    ? (hostApp.vault as unknown as { adapter?: { getBasePath?: () => string } }).adapter?.getBasePath?.()
    : undefined;
  shell.showItemInFolder(isAbsolute || !base ? p : `${base}/${norm}`);
}

/** 供 main.ts 注册直达命令时读登记表 */
export function listToolEntries(): { id: string; path: string }[] {
  const { registry } = readRegistry();
  return registry.tools.map((t) => ({ id: t.id, path: t.path }));
}

export { runToolDirect };
