/**
 * 工具坞面板（dock 域 UI，spec §7 UI 定稿 = 卡片墙）。
 *
 * 形态：overlay 面板（对齐各域面板范式）——`.bz-panel-overlay` + `.bz-panel-frame`，
 * 头行走路样式库共享类（`.bz-panel-head` 族），组件一律消费 `core/ui`。
 *
 * 两个视图：
 *  - **卡片墙**（列表）：两分区（自动化 / 手动）+ 过滤条 + 卡片网格。一张卡 = 一个外部工具，
 *    卡面自带「最近 7 次通栏迷你时间轴」——一眼看出这周跑成什么样；欠跑的卡整卡标色；
 *    上次失败的卡把「怎么办」直接写在卡面上（可操作提示不藏在详情里）。
 *  - **详情**：左栏参数表单 + 运行台（在场运行的实时进度），右栏历史时间线（展开可看
 *    `steps` / `info` / `result` / `stderr` 尾部）。
 *
 * **元数据一律来自工具目录的声明文件**（`manifest.json`）：标题、描述、图标、参数定义、节奏、
 * 以及怎么跑。所以登记只有一个动作 —— 选那个文件。这里不提供「填表单说这个工具叫什么、
 * 什么参数、是自动化还是手动」的入口：那些事实声明里已经有了，抄一份就多一个会和它打架的源。
 * 自动化 / 手动也不是字段，是 `triggerOfView(节奏声明)` 推出来的。
 *
 * 三条不可越界的 UI 约束（来自拍板决策，见 spec）：
 *  1) **不给没被 bz 拉起的运行画进度条**。D1 修订后判据是「谁启动的」而非「自动还是手动」：
 *     bz 亲手拉起（含调度器自动触发）的都是在场，照画；系统计划任务那种**离场**形态没有实时流，
 *     不许画。`liveRunsAll()` 里有没有它，就是这条的判据。
 *  2) **移动端只读**：能看状态与历史，不能启动（`core/external-tool` 在非桌面端本就返回
 *     「仅桌面端可用」；这里连按钮都不给，免得点了才知道）。
 *  3) 「任务」二字一律不出现（该词已被备忘录与 people 的画谱任务引擎占用）——用「外部工具」。
 */

import type { App } from 'obsidian';
import { Platform } from 'obsidian';
import { topifyZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { notice, notify } from '../core/notice';
import { uiBtn, uiIconBtn, uiBtnRow, uiChip, uiEmpty, uiField, uiInput, uiModal, uiProgress, uiSearch, uiSelect, uiSwitch, uiIcon } from '../core/ui';
import { openFlowDialog } from '../core/flow-dialog';
import { pickSystemFiles, pickSystemFolder } from '../core/path-picker';
import { attachItemActions, openItemMenu, openItemSheet, type ItemAction } from '../core/item-actions';
import { relTime } from '../core/ui/str';
import { tryGetSettings } from '../core/settings-provider';
import {
  displayDesc,
  displayIcon,
  displayName,
  isEnabled,
  isOverdue,
  isTrusted,
  loadToolViews,
  overview,
  patchRunState,
  readToolEntries,
  runSignature,
  saveToolEntries,
  saveToolValues,
  summarize,
  triggerOfView,
  updateToolEntry,
  type DockToolEntry,
  type DockToolView,
} from './data';
import {
  errorHint,
  initialValuesOf,
  lastRawTailOf,
  liveRunOf,
  liveRunsAll,
  notifyRunOutcome,
  runTool,
  statusText,
  stopRun,
  type DockLiveRun,
} from './runner';
import { kickDockScheduler } from './scheduler';
import {
  DECLARATION_FILENAME,
  readDeclaration,
  resolveRun,
  type ResolvedRun,
} from './declaration';
import {
  EDITABLE_SCHEDULE_KINDS,
  durationText,
  missingRequiredParams,
  recentRuns,
  scheduleFromDraft,
  scheduleSignature,
  successRate,
  timeOf,
  type DockRunHealth,
  type EditableScheduleKind,
} from './schedule';
import type { DockManifest, DockParam, DockRunRecord, DockSchedule } from './schema';

// ==================== 模块状态 ====================

let hostApp: App | null = null;
let overlay: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
/** 当前视图：列表 / 某工具详情 */
let view: { kind: 'list' } | { kind: 'detail'; id: string } = { kind: 'list' };
/** 搜索词（空 = 不过滤） */
let query = '';
/** 搜索行是否展开 */
let searchOpen = false;
/**
 * KPI 格点出来的过滤口径（增强 #15）：点哪格看哪类，再点一次回全部。
 * 只是列表的**视图**开关 —— KPI 数字本身的口径在 `overviewOf`，这里不另算一套。
 */
type KpiFilter = 'all' | 'alarms';
let kpiFilter: KpiFilter = 'all';
/** 正在刷新（读声明 + 读运行记录） */
let refreshing = false;
/** 打开面板时读出来的视图（渲染输入） */
let views: DockToolView[] = [];
/**
 * 参数表单草稿（按工具 id 记住，重渲不丢）。
 * 值的**家**是工具目录里的 `data.json`（`view.values`），这里只是编辑期的副本 ——
 * 每敲一下都写盘太吵，停手后再落（`queueValueSave`）。
 */
const draftValues = new Map<string, Record<string, unknown>>();
/** 草稿落盘的去抖定时器（按工具 id） */
const valueSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** 草稿落盘的去抖时长：够盖住连续击键，又短到「填完就关面板」不至于丢 */
const VALUE_SAVE_DEBOUNCE_MS = 500;
/** 已就「该跑没跑」打过通知的（本会话内去重：`<id>:<日>`） */
const dueNotified = new Set<string>();

/**
 * 节奏编辑草稿（按工具 id）。改完未点「保存节奏」时的暂存；保存/恢复脚本默认后即清，
 * 下次重新从**当前生效值**初始化。
 *
 * `kind` 刻意**不含 `on-demand`**：类型上就写死「编辑器产不出『只手动』」，「不开自动」由总闸表达
 * （ADR-0236 §补记）。`'inherit'` 也不给用户选 —— 它是「恢复脚本默认」按钮内部用的哨兵（= 清除覆盖）。
 */
interface AutoDraft {
  kind: EditableScheduleKind | 'inherit';
  hour: number;
  weekday: number;
  everyHours: number;
}
const autoDraft = new Map<string, AutoDraft>();

/** 节奏形态的中文名（面板用）；选项清单来自 `EDITABLE_SCHEDULE_KINDS`，这里只管怎么念 */
const SCHEDULE_KIND_LABEL: Record<EditableScheduleKind, string> = {
  daily: '每天',
  weekly: '每周',
  interval: '每隔若干小时',
};

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

/** 本地日键（漏跑通知去重用） */
function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 打开 / 定位产物（增强 #16）：vault 里真有这个相对路径 → 用 Obsidian 打开；
 * 其余（绝对路径、vault 找不到的）→ 系统文件管理器定位。移动端没有 shell → 降级复制路径。
 */
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

async function copyText(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    notice(`已复制${what}`);
  } catch {
    notice(`复制失败，请手动复制：${text}`, 'warning');
  }
}

/** 健康态 → 色点类（none 不画点） */
function dotClass(health: DockRunHealth | DockRunRecord['status']): string {
  switch (health) {
    case 'ok':
      return 'bz-dock-dot bz-dock-dot--ok';
    case 'due':
    case 'failed':
    case 'timeout':
      return 'bz-dock-dot bz-dock-dot--bad';
    case 'pending':
    case 'running':
    case 'stopped':
      return 'bz-dock-dot bz-dock-dot--warn';
    default:
      return 'bz-dock-dot bz-dock-dot--idle';
  }
}

/** 卡面「什么时候」：最近一次运行的相对时间——这是卡上最常被看的一个数，给它主信息的字号色阶 */
function whenTextOf(v: DockToolView, last: DockRunRecord | undefined): string {
  if (v.runsUnreadable) return '记录读不懂';
  if (!last) return '还没有运行过';
  return relTime(last.startedAt.replace('T', ' '));
}

/** 卡面「结果」：在场运行给实时阶段，离场给工具自己留的那句话 */
function messageTextOf(v: DockToolView, last: DockRunRecord | undefined): string {
  if (v.runsUnreadable) return '文件在，但内容不合契约';
  const live = liveRunOf(v.entry.id);
  if (live) return live.progress.phase ? `正在${live.progress.phase}…` : '正在运行…';
  if (!v.manifest) return '声明文件读不到，先把路径修好';
  if (!v.run) return '没写怎么跑（既无 run 段，目录里也没有 main.mjs）';
  if (!last) return '等它按自己的节奏跑一次';
  return last.message || statusText(last.status);
}

/**
 * 卡面「怎么办」：上次失败且工具留了 `error.kind` 时给可操作提示。
 * 刻意**不放详情里藏**——「汇报完成情况」最值钱的就是这一句（「去重新导出 cookie」远比「失败了」有用），
 * 而卡墙才是你会扫视的那一层。没有 `error` 就不猜（工具没说死在哪儿，bz 不编）。
 */
function failHintOf(last: DockRunRecord | undefined): string | null {
  if (!last || !last.error) return null;
  if (last.status === 'ok' || last.status === 'running') return null;
  return errorHint(last.error.kind);
}

function viewById(id: string): DockToolView | undefined {
  return views.find((v) => v.entry.id === id);
}

/** 是否桌面端（只有桌面端能启动进程） */
function canRun(): boolean {
  return !Platform.isMobile;
}

/** 这个工具现在能不能启动：桌面端 + 已信任 + 信任没过期 + 声明里写了怎么跑 */
function canStart(v: DockToolView): boolean {
  return canRun() && isTrusted(v.entry) && !v.trustStale && !!v.run;
}

/** 「未信任」与「信任过期」共用的标签文案（两者都要求用户重新确认一次） */
function trustTagOf(v: DockToolView): string | null {
  if (!isTrusted(v.entry)) return '未信任';
  if (v.trustStale) return '命令已变，待重新确认';
  return null;
}

/** 启动按钮文案：自动化工具的按钮是「补一次」而不是「运行」，语义不同 */
function runLabel(v: DockToolView): string {
  return triggerOfView(v) === 'auto' ? '手动跑一次' : '运行';
}

// ==================== 打开 / 卸载 ====================

export function openDock(app: App): void {
  hostApp = app;
  if (!overlay) build(app);
  topifyZ(overlay!);
  overlay!.classList.remove('is-off');
  trapPanelFocus(overlay!.querySelector<HTMLElement>(`#${FRAME_ID}`) ?? overlay!);
  // hide 型常驻层重开：显示路径重放 ESC 注册，栈序跟随显示序
  escHandle?.unregister();
  escHandle = escManager.register('bz-dock', {
    isVisible: () => isPanelVisible(),
    close: () => closeDock(),
  });
  render();
  void refresh();
}

export function closeDock(): void {
  overlay?.classList.add('is-off');
}

/**
 * 通知 / 命令的「直达」入口：开面板并定位到该工具详情（面板已开着就只切换定位）。
 * 失败通知这类场景，用户要的不是「面板」而是「那个工具」。
 */
export function openDockTool(app: App, id: string): void {
  view = { kind: 'detail', id };
  openDock(app);
}

export function unloadDock(): void {
  // 先把还没落盘的参数草稿写掉再拆 —— 卸载恰好在去抖窗口内时，clearTimeout 会把
  // 最后一次输入静默丢掉（写盘是同步 fs，卸载路径里照常能完成）
  for (const v of views) saveValuesNow(v);
  hostApp = null;
  escHandle?.unregister();
  escHandle = null;
  overlay?.remove();
  overlay = null;
  views = [];
  view = { kind: 'list' };
  draftValues.clear();
  for (const t of valueSaveTimers.values()) clearTimeout(t);
  valueSaveTimers.clear();
  dueNotified.clear();
  autoDraft.clear();
}

/** 插件启动时的域初始化（当前无监听，占位以对齐各域 ensureXxx 范式） */
export function ensureDock(_app: App): void {
  /* 面板本身不常驻（懒建 DOM）；常驻的后台任务是调度器，由 main.ts 直接 startDockScheduler 起
     （不在这里挂，免得 ensureDock 与调度器两处都能起、谁先谁后说不清）。 */
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
  const brand = el('div', 'bz-panel-brand');
  brand.appendChild(uiIcon('square-terminal'));
  const title = el('div', 'bz-panel-title', '工具坞');
  const pipe = el('div', 'bz-panel-head-pipe');
  const sub = el('div', 'bz-panel-head-sub');
  sub.id = 'bz-dock-headsub';
  const sp = el('div', 'bz-panel-head-sp');
  const btns = el('div', 'bz-panel-head-btns');
  btns.id = 'bz-dock-headbtns';
  head.append(brand, title, pipe, sub, sp, btns);

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
  ov.addEventListener('click', (e) => {
    if (e.target === ov) closeDock();
  });
  document.body.appendChild(ov);
  overlay = ov;
  void app;
}

function headSubEl(): HTMLElement | null {
  return overlay?.querySelector<HTMLElement>('#bz-dock-headsub') ?? null;
}
function headBtnsEl(): HTMLElement | null {
  return overlay?.querySelector<HTMLElement>('#bz-dock-headbtns') ?? null;
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

// ==================== 刷新（读盘） ====================

async function refresh(): Promise<void> {
  if (!hostApp || refreshing) return;
  refreshing = true;
  renderHead();
  try {
    views = await loadToolViews(hostApp);
    runDueNotifications();
  } catch (e) {
    console.warn('[dock] 载入工具视图失败', e);
    notice('工具坞载入失败，详见控制台', 'error');
  } finally {
    refreshing = false;
    render();
  }
}

/**
 * 「该跑没跑」通知（spec D11）。
 * 只对**已声明节奏**且判定为 `due` 的工具发；同一会话内每个工具每天最多一条
 * （不落盘 —— ADR-0218 已拍 bz 不持久化队列/状态；重启后重来一次，可接受）。
 * 开关 = `dockNotifyMissed`（设置面板「工具坞 → 提醒」）；缺省开——键缺失视为开。
 *
 * **调度器会管的就不在这里喊**（ADR-0236）：能被自动跑的工具，它「该跑没跑」会被调度器直接
 * 补跑，再发一条「该跑没跑」就是同一件事喊两遍。只有调度器够不着的（总闸关、参数没填、自动
 * 已关、熔断暂停、未信任、没写 run）才轮到这条兜底提醒。
 */
function runDueNotifications(): void {
  if (tryGetSettings().dockNotifyMissed === false) return;
  const day = todayKey();
  for (const v of views) {
    if (!isEnabled(v.entry)) continue;
    if (v.due.state !== 'due') continue;
    if (willAutoRun(v)) continue; // 调度器会补跑它，别重复喊
    const key = `${v.entry.id}:${day}`;
    if (dueNotified.has(key)) continue;
    dueNotified.add(key);
    notify(`${displayName(v)} 今天该跑没跑：${v.due.detail}`, {
      type: 'warning',
      dedupeKey: `dock-due-${key}`,
      action: { label: '查看', onClick: () => openDockTool(hostApp as App, v.entry.id) },
    });
  }
}

/**
 * 这个工具是否在**调度器的覆盖范围内**（用来避免与「该跑没跑」通知重复出声）。
 * 判据是调度资格的静态面（不含「到点没到点」与运行中的会话锁），与 `scheduler.decideDue`
 * 的口径一致但不必那么细。
 */
function willAutoRun(v: DockToolView): boolean {
  if (tryGetSettings().dockAutoRun === false) return false;
  if (!isEnabled(v.entry) || !isTrusted(v.entry) || v.trustStale) return false;
  if (!v.run || !v.autoRun) return false;
  if (triggerOfView(v) !== 'auto') return false;
  if (v.runState?.pausedAt) return false;
  return missingRequiredParams(v.manifest?.params, v.values).length === 0;
}

// ==================== 渲染 ====================

function render(): void {
  renderHead();
  renderKpi();
  renderRunbar();
  renderBar();
  renderBody();
}

/**
 * 顶部四格 KPI（口径全在 `data.ts` 的 `overview()` 里，这里只负责画）。
 * 一格都没有工具时整条隐藏 —— 空面板上方压四个 0 只是噪音。
 */
function renderKpi(): void {
  const host = kpiEl();
  if (!host) return;
  host.innerHTML = '';
  if (!views.length) {
    host.classList.add('is-off');
    return;
  }
  host.classList.remove('is-off');

  const o = overview(views);
  const tile = (
    num: string,
    unit: string,
    label: string,
    sub: string,
    tone?: 'warn' | 'bad' | 'up',
    key?: KpiFilter,
  ): HTMLElement => {
    const t = el('div', tone ? `bz-dock-kpi-tile is-${tone}` : 'bz-dock-kpi-tile');
    const v = el('div', 'bz-dock-kpi-v', num);
    if (unit) v.appendChild(el('small', undefined, unit));
    t.appendChild(v);
    t.appendChild(el('div', 'bz-dock-kpi-l', label));
    t.appendChild(el('div', tone === 'up' ? 'bz-dock-kpi-d is-up' : 'bz-dock-kpi-d', sub));
    // 带口径的格可以点（增强 #15）：点下去列表只看那一类，再点一次回全部。
    // 过滤本身在 filtered() 里做，KPI 数字仍从 overviewOf 来 —— 两处不各算一套。
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

  const left = o.autoTotal - o.autoDoneToday;
  host.appendChild(
    tile(
      String(o.autoDoneToday),
      ` / ${o.autoTotal}`,
      '今日自动化达标',
      o.autoTotal === 0 ? '还没有自动化工具' : left > 0 ? `还差 ${left} 个` : '今天都跑成了',
      o.autoTotal > 0 && left > 0 ? 'warn' : undefined,
    ),
  );

  host.appendChild(
    tile(
      o.rate7d === null ? '—' : String(Math.round(o.rate7d * 100)),
      o.rate7d === null ? '' : '%',
      '近 7 天成功率',
      o.runs7d ? `${o.runs7d} 次里成功 ${o.ok7d} 次` : '还没有可比的记录',
    ),
  );

  host.appendChild(
    tile(
      String(o.alarms),
      '',
      '待处理异常',
      o.alarmHint ? `${o.alarmHint.name} · ${o.alarmHint.reason}` : '没有要管的事',
      o.alarms ? 'bad' : undefined,
      'alarms',
    ),
  );

  // 「下次到期」只显示**还没到的**那一格（口径在 overview() 里：「已逾期」归上面的「待处理异常」，
  // 同一件事不在两格里各说一遍）
  if (o.nextDue) {
    const left = untilText(o.nextDue.at - Date.now());
    host.appendChild(tile(left.num, left.unit, '距下次到期', o.nextDue.name));
  } else {
    host.appendChild(tile('—', '', '距下次到期', '没有能算出下次到期的工具'));
  }
}

/** 剩余时长 → 拆成「数字 + 单位」两段（单位在 KPI 里降一档字号） */
function untilText(ms: number): { num: string; unit: string } {
  const m = ms / 60000;
  if (m < 60) return { num: String(Math.max(1, Math.round(m))), unit: 'm' };
  const h = m / 60;
  if (h < 24) return { num: String(Math.round(h)), unit: 'h' };
  return { num: String(Math.round(h / 24)), unit: 'd' };
}

/**
 * 面板顶层执行进度。
 *
 * **只画在场运行**（`liveRunsAll()`）—— 也就是 bz 亲手启动、能真的收到 `onProgress` 的那些。
 * D1 修订后，自动化工具由 bz 调度器亲手拉起，**于是它们也在这一条里**（有实时进度、能停止）；
 * 只有系统计划任务那种**离场**形态不在（bz 不是父进程、拿不到实时流），所以这里也不会出现编造的百分比。
 * 一个在跑的都没有时整条隐藏：不留空行，也不为「可能有用」占位。
 */
function renderRunbar(): void {
  const host = runbarEl();
  if (!host) return;
  host.innerHTML = '';
  const runs = liveRunsAll();
  if (!runs.length) {
    host.classList.add('is-off');
    return;
  }
  host.classList.remove('is-off');
  for (const run of runs) host.appendChild(makeRunbarRow(run));
}

function makeRunbarRow(run: DockLiveRun): HTMLElement {
  const row = el('div', 'bz-dock-rb');
  row.dataset.tool = run.toolId;
  row.appendChild(el('span', 'bz-dock-rb-pulse'));

  const v = viewById(run.toolId);
  row.appendChild(el('span', 'bz-dock-rb-name', v ? displayName(v) : run.toolId));
  row.appendChild(
    el('span', 'bz-dock-rb-phase', run.progress.phase ? `正在${run.progress.phase}…` : '运行中…'),
  );

  const lastStep = run.steps.length ? run.steps[run.steps.length - 1].text : '';
  row.appendChild(el('span', 'bz-dock-rb-step', lastStep));

  // pct 为 null = 该阶段不可估 → 不确定态，绝不假报百分比（同 schema.ts 的 pct 语义）
  const bar = uiProgress({ value: run.progress.pct ?? 0 });
  bar.el.classList.add('bz-dock-rb-track');
  if (run.progress.pct === null) bar.el.classList.add('is-indeterminate');
  row.appendChild(bar.el);
  row.appendChild(el('span', 'bz-dock-rb-pct', run.progress.pct === null ? '—' : `${Math.round(run.progress.pct)}%`));

  if (canRun()) {
    row.appendChild(
      uiBtn({
        label: '停止',
        icon: 'square',
        tone: 'danger',
        size: 'sm',
        onClick: () => stopRun(run.toolId),
      }),
    );
  }
  return row;
}

function renderHead(): void {
  const sub = headSubEl();
  const btns = headBtnsEl();
  if (!sub || !btns) return;
  const s = summarize(views);
  sub.textContent = views.length
    ? `${s.total} 个工具 · 自动化 ${s.auto} · 手动 ${s.manual}${s.overdue ? ` · ${s.overdue} 个待关注` : ''}`
    : '还没有登记任何外部工具';
  btns.innerHTML = '';
  btns.append(
    uiIconBtn({
      icon: 'search',
      title: '搜索工具',
      on: searchOpen,
      onClick: () => {
        searchOpen = !searchOpen;
        render();
      },
    }),
    uiIconBtn({
      icon: 'refresh-cw',
      title: '重新读取运行记录',
      disabled: refreshing,
      onClick: () => void refresh(),
    }),
    uiIconBtn({
      icon: 'plus',
      title: '导入工具声明',
      onClick: () => importToolFlow(),
    }),
    uiIconBtn({
      icon: 'x',
      title: '关闭',
      // ⚠️ 刻意**不**传 close:true —— 那个标记会带上 `bz-icon-btn--close`，而 core/styles.css 有
      // `button.bz-icon-btn--close { display: none !important }`（「非真全屏一律隐藏关闭钮」），
      // 域内后置的移动端 display 覆盖不动 !important。桌面对齐：关闭钮显隐由本域自己管。
      className: 'bz-dock-close',
      onClick: () => closeDock(),
    }),
  );
}

/**
 * 搜索行。这一条只剩搜索 —— 原先把「全部 / 自动化 / 手动 / 待关注」四档也放这里，
 * 但那四档要说的两件事（自动化 vs 手动、有几个待关注）现在分别由分区标题和顶部 KPI 说过了。
 * 没展开搜索时整条隐藏，面板上不留一条空横杠。
 */
function renderBar(): void {
  const bar = barEl();
  if (!bar) return;
  bar.innerHTML = '';
  if (refreshing) bar.classList.add('is-loading');
  else bar.classList.remove('is-loading');
  if (!searchOpen) {
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
  // 展开即入焦（移动端跳过，防软键盘顶起）
  if (!Platform.isMobile) queueMicrotask(() => search.input.focus());
}

/**
 * 搜索后的视图。
 *
 * 面板**不再提供**「全部 / 自动化 / 手动 / 待关注」那排点击过滤档：分区标题已经把自动化与手动分开，
 * 顶上四格 KPI 已经回答了「有几个要管」，再摆一排 chip 只是让人多一次点击、还多一处会跟 KPI 对不上的计数。
 * 要缩小范围就用搜索。
 */
/** KPI「待处理异常」的同一口径（与 `overviewOf` 一致）：已逾期，或最近一次收尾是失败 / 超时 */
function isAlarmView(v: DockToolView): boolean {
  if (isOverdue(v.due.state)) return true;
  const last = lastOf(v);
  return !!last && (last.status === 'failed' || last.status === 'timeout');
}

function filtered(): DockToolView[] {
  let list = views.slice();
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter((v) => {
      const hay = [v.entry.id, displayName(v), displayDesc(v), v.run?.cmd ?? v.declPath]
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
    view = { kind: 'list' }; // 工具没了（被移除）：退回列表
  }
  renderList(body);
}

function renderList(body: HTMLElement): void {
  if (!views.length) {
    body.appendChild(
      uiEmpty({
        icon: 'square-terminal',
        title: '还没有外部工具',
        desc: '选一个工具的声明文件（manifest.json），工具坞就知道它叫什么、有哪些参数、该怎么跑；运行记录也归它收口',
        actions: uiBtnRow(
          [uiBtn({ label: '导入声明文件', icon: 'file-input', tone: 'primary', onClick: () => importToolFlow() })],
          { center: true },
        ),
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
  const auto = list.filter((v) => triggerOfView(v) === 'auto');
  const manual = list.filter((v) => triggerOfView(v) === 'manual');
  if (auto.length) body.appendChild(section('自动化', '由 bz 按你配好的节奏自动跑（到点触发、漏跑补跑）', auto));
  if (manual.length) body.appendChild(section('手动', '想起来才点一次', manual));
}

function section(title: string, hint: string, list: DockToolView[]): HTMLElement {
  const sec = el('section', 'bz-dock-sec');
  const head = el('div', 'bz-dock-sec-head');
  head.appendChild(el('span', 'bz-dock-sec-title', title));
  head.appendChild(el('span', 'bz-dock-sec-count', String(list.length)));
  head.appendChild(el('span', 'bz-dock-sec-hint', hint));
  sec.appendChild(head);
  const grid = el('div', 'bz-dock-grid');
  for (const v of list) grid.appendChild(makeCard(v));
  sec.appendChild(grid);
  return sec;
}

// ==================== 卡片 ====================

function makeCard(v: DockToolView): HTMLElement {
  const id = v.entry.id;
  const card = el('article', 'bz-dock-card');
  card.dataset.tool = id;
  if (isOverdue(v.due.state)) card.classList.add('is-due');
  if (!isEnabled(v.entry)) card.classList.add('is-disabled');
  if (liveRunOf(id)) card.classList.add('is-running');

  // 顶行：图标 + 名 + 触发标签
  const top = el('div', 'bz-dock-card-top');
  const ic = el('span', 'bz-dock-card-ic');
  ic.appendChild(uiIcon(displayIcon(v), 'bz-ic--md'));
  const idbox = el('div', 'bz-dock-card-idbox');
  const name = el('div', 'bz-dock-card-name', displayName(v));
  const tags = el('div', 'bz-dock-card-tags');
  tags.appendChild(el('span', 'bz-dock-tag', triggerOfView(v) === 'auto' ? '自动化' : '手动'));
  if (isOverdue(v.due.state)) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--due', '今日未跑'));
  const trustTag = trustTagOf(v);
  if (trustTag) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--warn', trustTag));
  if (!v.manifest) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--muted', '声明读不到'));
  if (v.manifest && !v.run) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--muted', '只能看'));
  if (triggerOfView(v) === 'auto' && !v.autoRun) {
    tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--muted', '自动已关'));
  }
  if (v.runState?.pausedAt) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--warn', '自动已暂停'));
  idbox.append(name, tags);
  top.append(ic, idbox);
  card.appendChild(top);

  const desc = displayDesc(v);
  if (desc) card.appendChild(el('div', 'bz-dock-card-desc', desc));

  // 状态行：最近一次「什么时候 + 跑成什么样」，成功率贴右
  const state = el('div', 'bz-dock-card-state');
  const last = lastOf(v);
  state.appendChild(el('span', dotClass(last ? last.status : v.due.state)));
  state.appendChild(el('span', 'bz-dock-card-when', whenTextOf(v, last)));
  state.appendChild(el('span', 'bz-dock-card-msg', messageTextOf(v, last)));
  const rate = successRate(v.runs);
  if (rate !== null) {
    // ⚠️ 必须带上「成功」二字：光一个百分比挨着时间轴，会被读成进度条。
    //    这个数字是「记录里成功了几条」，不是任何一次运行的进度 —— 别让它被误读。
    const rateEl = el('span', 'bz-dock-rate', `${Math.round(rate * 100)}% 成功`);
    rateEl.title = `${v.runs.length} 条记录里成功了几条`;
    if (rate < 1) rateEl.classList.add('is-warn');
    state.appendChild(rateEl);
  }
  card.appendChild(state);

  // 上次失败 → 卡面就直接给「怎么办」（可操作提示不该藏在详情里）
  const hint = failHintOf(last);
  if (hint) {
    const box = el('div', 'bz-dock-card-fail');
    box.appendChild(uiIcon('alert-triangle', 'bz-ic--xs'));
    box.appendChild(el('span', 'bz-dock-card-failtext', hint));
    card.appendChild(box);
  }

  // 最近 7 次：通栏迷你时间轴（格子撑满一行 = 一眼看出这周达标几次；单格 hover 能问出是哪一次）
  const strip = el('div', 'bz-dock-strip');
  strip.title = '最近 7 次运行（左旧右新）';
  for (const r of recentRuns(v.runs, 7)) {
    const cell = el('i', 'bz-dock-pip');
    if (r) {
      cell.classList.add(`bz-dock-pip--${r.status}`);
      cell.title = `${relTime(r.startedAt.replace('T', ' '))} · ${statusText(r.status)}${r.message ? ` · ${r.message}` : ''}`;
    } else {
      cell.title = '这一次没有运行记录';
    }
    strip.appendChild(cell);
  }
  card.appendChild(strip);

  // 动作行
  const foot = el('div', 'bz-dock-card-foot');
  if (canRun()) {
    const live = liveRunOf(id);
    if (live) {
      foot.appendChild(
        uiBtn({
          label: '停止',
          icon: 'square',
          tone: 'danger',
          size: 'sm',
          onClick: () => {
            stopRun(id);
          },
        }),
      );
    } else {
      foot.appendChild(
        uiBtn({
          label: runLabel(v),
          icon: 'play',
          tone: 'primary',
          size: 'sm',
          disabled: !canStart(v),
          onClick: () => void runFlow(v),
        }),
      );
    }
  } else {
    foot.appendChild(el('span', 'bz-dock-mobilehint', '移动端仅查看'));
  }
  foot.appendChild(
    uiBtn({
      label: '详情',
      icon: 'chevron-right',
      size: 'sm',
      className: 'bz-dock-foot-detail',
      onClick: () => {
        view = { kind: 'detail', id };
        render();
      },
    }),
  );
  const more = uiIconBtn({
    icon: 'more-horizontal',
    title: '更多操作',
    xs: true,
    onClick: () => openCardActions(more, v),
  });
  foot.appendChild(more);
  card.appendChild(foot);

  // 菜单（右键 / 长按）+ 左键开详情
  attachItemActions(card, cardActions(v));
  card.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('button')) return; // 按钮自己处理
    view = { kind: 'detail', id };
    render();
  });
  return card;
}

function lastOf(v: DockToolView): DockRunRecord | undefined {
  return v.runs
    .slice()
    .sort((a, b) => (timeOf(b.startedAt) ?? 0) - (timeOf(a.startedAt) ?? 0))[0];
}

function cardActions(v: DockToolView): ItemAction[] {
  const id = v.entry.id;
  const acts: ItemAction[] = [
    {
      icon: 'chevron-right',
      label: '打开详情',
      onClick: () => {
        view = { kind: 'detail', id };
        render();
      },
    },
    {
      icon: 'refresh-cw',
      label: '重新读声明',
      onClick: () => void reloadDeclaration(v),
    },
  ];
  if (canStart(v)) {
    acts.push({
      icon: 'play',
      label: runLabel(v),
      onClick: () => void runFlow(v),
    });
  }
  if (v.runState?.pausedAt) {
    acts.push({ icon: 'play', label: '恢复并立即重试', onClick: () => void resumeAndRetry(v) });
  }
  acts.push({ icon: 'pencil', label: '重新导入声明', onClick: () => void importToolFlow(v.entry) });
  acts.push({
    icon: 'trash-2',
    label: v.entry.enabled === false ? '启用' : '停用',
    onClick: () => void toggleEnabled(v.entry),
  });
  acts.push({
    icon: 'x-circle',
    label: '移除登记',
    kind: 'danger',
    onClick: () => void removeToolFlow(v),
  });
  return acts;
}

function openCardActions(anchor: HTMLElement, v: DockToolView): void {
  const actions = cardActions(v);
  const head = el('div', 'bz-dock-sheet-head');
  const sub = el('div', 'bz-dock-sheet-sub');
  sub.textContent = v.declPath;
  head.append(el('div', 'bz-dock-sheet-name', displayName(v)), sub);
  if (Platform.isMobile) {
    openItemSheet(actions, { sheetHead: head });
  } else {
    const r = anchor.getBoundingClientRect();
    openItemMenu(r.left, r.bottom + 4, actions);
  }
}

// ==================== 详情 ====================

// ---------- 自动运行（详情页；D1 修订后 bz 与调度器之间唯一的用户界面） ----------

/**
 * 取（或初始化）某工具的节奏草稿。**初值 = 当前生效值**（覆盖 ?? 默认），不是「跟随脚本」那种占位——
 * 用户要的是「打开就能直接改」，而不是先选一个「我要改了」才能看见可填的字段（ADR-0236 §补记）。
 * 脚本没给节奏（手动工具）或给的是 `on-demand` 时，落到一组能用的默认（每天 12:00），
 * 让人能就地把它排成自动化 —— 编辑器不提供「只手动」，那是总闸的事。
 */
function autoDraftOf(v: DockToolView): AutoDraft {
  const key = v.entry.id;
  const existing = autoDraft.get(key);
  if (existing) return existing;

  const cur = v.schedule;
  const k = cur?.kind;
  // 只有 daily/weekly/interval 是可编辑的「节奏」；`on-demand`/`unknown`/未声明都落到默认形态
  const kind: AutoDraft['kind'] =
    k === 'daily' || k === 'weekly' || k === 'interval' ? k : 'daily';
  const d: AutoDraft = {
    kind,
    hour: cur?.hour ?? 12,
    weekday: cur?.weekday ?? 1,
    everyHours: cur?.everyHours ?? 6,
  };
  autoDraft.set(key, d);
  return d;
}

/**
 * 保存节奏。存完踢调度器一拍，让改动作立刻生效。
 *
 * 两条口径：
 *  - `kind: 'inherit'`（「恢复脚本默认」按钮）→ **清除覆盖**，回落脚本那份默认（含它日后的改动）。
 *  - 改出来的节奏**与脚本默认一模一样** → 也清除覆盖。用户把值调回原样，意思就是「照脚本的来」，
 *    这时还留着一份覆盖只会让工具从此不再跟随脚本的后续改动 —— 那是隐坑，不是意图。
 */
async function saveAuto(v: DockToolView, d: AutoDraft): Promise<void> {
  const id = v.entry.id;
  const next = scheduleFromDraft(d.kind, d);
  const sameAsDeclared =
    next !== undefined && scheduleSignature(next) === scheduleSignature(v.declaredSchedule);
  if (!next || sameAsDeclared) {
    await updateToolEntry(id, { scheduleOverride: undefined, overrideDeclSig: undefined });
  } else {
    await updateToolEntry(id, {
      scheduleOverride: next,
      overrideDeclSig: scheduleSignature(v.declaredSchedule),
    });
  }
  autoDraft.delete(id);
  kickDockScheduler();
  await refresh();
}

function autoRow(label: string, value: string): HTMLElement {
  const row = el('div', 'bz-dock-autorow');
  row.appendChild(el('span', 'bz-dock-autorow-label', label));
  row.appendChild(el('span', 'bz-dock-autorow-val', value));
  return row;
}

/** 取值并夹到 [lo, hi] 的整数（输入框删空 / 乱输时回落到 fallback） */
function clampInt(raw: string, lo: number, hi: number, fallback: number): number {
  // '' 必须先拦：Number('') === 0，会假装成合法的 0 溜过 Number.isFinite，把「删空」变成「设成下限」
  if (raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/**
 * 「自动运行」块（详情页）。
 *
 * **模型一句话**（ADR-0236 §补记）：**自动化是 bz 这一侧的事** —— 开不开、怎么排，都在这里（用户）定；
 * 脚本声明里的节奏只是**初始默认值**。所以本块不是「让这个工具参与自动化」，而是「给这个工具配一个
 * bz 的定时任务」。措辞上别用「参与 / 授权 / 覆盖作者」那套 —— 会让人以为主动权在脚本那边。
 *
 * 三件事实摆出来：**脚本默认**（`declaredSchedule`）、**当前生效**（`scheduleOverride ?? declared`）、
 * 下次什么时候跑。改的永远是 bz 这一份覆盖，脚本那份只读不写（它在工具目录里，bz 不碰）。
 *
 * 「开 / 不开」**只有总闸一个控件**（`autoRun`）；节奏编辑器只管「多久一次」。故编辑器**不再**摆
 * 「只手动（不自动）」这种选项 —— 那是把开关的意思在第二个控件里又说了一遍，两个控件说同一件事
 * 只会互相打架（选了「只手动」却发现总闸还开着，或者反过来，谁说话算数？）。
 *
 * 编辑器直接预填当前生效值、就地可改（不是「先声明我要覆盖，才露出字段」）：打开面板就能把自动化
 * 配成要的样子。手动工具（脚本没排节奏）也渲染本块，在这里选一套节奏就等于给它排上了自动化。
 */
function autoSection(v: DockToolView): HTMLElement {
  const sec = el('section', 'bz-dock-pane bz-dock-autopane');
  const head = el('div', 'bz-dock-pane-head');
  head.appendChild(el('h3', 'bz-dock-pane-title', '自动运行'));
  sec.appendChild(head);

  const id = v.entry.id;

  // 总闸（autoRun）：开 / 不开，就这一个控件说了算
  sec.appendChild(
    uiField({
      label: '自动运行',
      desc: '由 bz 按下面的节奏自动触发；关掉就只在面板里手动点。脚本里那份是默认值，不是定死的',
      control: uiSwitch({
        checked: v.autoRun,
        onChange: (on) => {
          void (async () => {
            await updateToolEntry(id, { autoRun: on });
            autoDraft.delete(id);
            kickDockScheduler();
            await refresh();
          })();
        },
      }).el,
    }),
  );

  // 事实三行：脚本默认 vs 当前生效 vs 下次预计
  const facts = el('div', 'bz-dock-autorows');
  facts.appendChild(autoRow('脚本默认', scheduleTextOf(v.declaredSchedule)));
  facts.appendChild(autoRow('当前生效', scheduleTextOf(v.schedule) + (v.scheduleOverridden ? '（你改的）' : '')));
  facts.appendChild(
    autoRow('下次预计', v.nextDue === null ? '算不出（没有节奏，或缺运行基线）' : dueTimeText(v.nextDue)),
  );
  if (v.runState?.pausedAt) {
    facts.appendChild(
      el(
        'div',
        'bz-dock-autonote bz-dock-autonote--warn',
        `连续失败 ${v.runState.consecutiveFailures ?? 0} 次，自动运行已暂停`,
      ),
    );
  }
  if (v.declChangedSinceOverride) {
    facts.appendChild(el('div', 'bz-dock-autonote', '脚本改过默认节奏了 —— 看一眼要不要跟着调'));
  }
  if (!v.autoRun) {
    facts.appendChild(
      el(
        'div',
        'bz-dock-autonote',
        '自动运行已关 —— 下面排的节奏不会生效，要它自己跑起来得先打开上面的开关',
      ),
    );
  }
  sec.appendChild(facts);

  // 节奏编辑：bz 这一侧的「多久一次」。预填「当前生效」，改完即成为 bz 的覆盖节奏
  const d = autoDraftOf(v);
  const editor = el('div', 'bz-dock-autoeditor');
  editor.appendChild(
    uiField({
      label: '节奏',
      control: uiSelect<string>({
        // 选项来自 schedule.ts 的 EDITABLE_SCHEDULE_KINDS（唯一来源，不带「只手动」）
        options: EDITABLE_SCHEDULE_KINDS.map((k) => ({ value: k, label: SCHEDULE_KIND_LABEL[k] })),
        value: d.kind === 'inherit' ? 'daily' : d.kind,
        onChange: (val) => {
          d.kind = val as AutoDraft['kind'];
          render(); // 切换形态要换下面那行输入，重渲染一次
        },
      }).el,
    }),
  );

  if (d.kind === 'daily') {
    const inp = uiInput({
      type: 'number',
      value: String(d.hour),
      onInput: (val) => {
        d.hour = clampInt(val, 0, 23, 12);
      },
    });
    inp.min = '0';
    inp.max = '23';
    editor.appendChild(uiField({ label: '当天几点前跑完', desc: '本地时间，0–23', control: inp }));
  } else if (d.kind === 'weekly') {
    editor.appendChild(
      uiField({
        label: '每周哪天',
        control: uiSelect<string>({
          options: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((l, i) => ({
            value: String(i),
            label: l,
          })),
          value: String(d.weekday),
          onChange: (val) => {
            d.weekday = clampInt(val, 0, 6, 1);
          },
        }).el,
      }),
    );
  } else if (d.kind === 'interval') {
    const inp = uiInput({
      type: 'number',
      value: String(d.everyHours),
      onInput: (val) => {
        d.everyHours = clampInt(val, 1, 168, 6);
      },
    });
    inp.min = '1';
    inp.max = '168';
    editor.appendChild(uiField({ label: '每隔几小时', desc: '1–168', control: inp }));
  }

  const btns = el('div', 'bz-dock-runbtns');
  btns.appendChild(uiBtn({ label: '保存节奏', size: 'sm', tone: 'primary', onClick: () => void saveAuto(v, d) }));
  if (v.scheduleOverridden) {
    btns.appendChild(
      uiBtn({
        label: '恢复脚本默认',
        size: 'sm',
        onClick: () => {
          autoDraft.delete(id);
          void saveAuto(v, { ...d, kind: 'inherit' });
        },
      }),
    );
  }
  if (v.runState?.pausedAt) {
    btns.appendChild(
      uiBtn({
        label: '恢复并立即重试',
        size: 'sm',
        tone: 'primary',
        onClick: () => void resumeAndRetry(v),
      }),
    );
  }
  editor.appendChild(btns);
  sec.appendChild(editor);

  return sec;
}

function renderDetail(body: HTMLElement, v: DockToolView): void {
  const wrap = el('div', 'bz-dock-detail');

  // 头：返回 + 图标 + 名 + 标签
  const head = el('div', 'bz-dock-detail-head');
  head.appendChild(uiIconBtn({ icon: 'chevron-left', title: '返回列表', onClick: () => { view = { kind: 'list' }; render(); } }));
  const ic = el('span', 'bz-dock-detail-ic');
  ic.appendChild(uiIcon(displayIcon(v), 'bz-ic--lg'));
  const idbox = el('div', 'bz-dock-detail-idbox');
  idbox.appendChild(el('div', 'bz-dock-detail-name', displayName(v)));
  const tags = el('div', 'bz-dock-detail-tags');
  tags.appendChild(el('span', 'bz-dock-tag', triggerOfView(v) === 'auto' ? '自动化' : '手动'));
  if (isOverdue(v.due.state)) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--due', v.due.detail));
  const trustTag = trustTagOf(v);
  if (trustTag) tags.appendChild(el('span', 'bz-dock-tag bz-dock-tag--warn', trustTag));
  idbox.appendChild(tags);
  head.append(ic, idbox);
  const sp = el('div', 'bz-dock-detail-sp');
  head.appendChild(sp);
  if (canStart(v)) {
    const live = liveRunOf(v.entry.id);
    head.appendChild(
      live
        ? uiBtn({ label: '停止', icon: 'square', tone: 'danger', onClick: () => stopRun(v.entry.id) })
        : uiBtn({
            label: runLabel(v),
            icon: 'play',
            tone: 'primary',
            onClick: () => void runFlow(v),
          }),
    );
  }
  head.appendChild(uiIconBtn({ icon: 'refresh-cw', title: '重新读取记录', onClick: () => void refresh() }));
  head.appendChild(uiIconBtn({ icon: 'more-horizontal', title: '更多操作', onClick: () => openCardActions(head, v) }));
  wrap.appendChild(head);

  const desc = displayDesc(v);
  if (desc) wrap.appendChild(el('div', 'bz-dock-detail-desc', desc));

  if (v.declError) {
    const box = el('div', 'bz-dock-meta-warn');
    box.textContent = v.declError;
    wrap.appendChild(box);
  }

  // meta 行：怎么跑 / 在哪 —— 命令不再由登记给，而是声明文件里那份
  const meta = el('div', 'bz-dock-meta');
  // 作者 / 版本 / 文档（增强 #2）：声明里写了才显示，没写不占位
  const who = [v.manifest?.author, v.manifest?.toolVersion].filter(Boolean).join(' · ');
  if (who) meta.appendChild(metaRow('作者', who));
  if (v.manifest?.docs) {
    const docs = v.manifest.docs;
    const row = el('div', 'bz-dock-meta-row');
    row.appendChild(el('span', 'bz-dock-meta-label', '文档'));
    row.appendChild(el('span', 'bz-dock-meta-val', docs));
    // 只放行 http(s) —— 声明是外部文件，docs 写什么都可能，别把它当任意跳转的入口
    if (/^https?:\/\//i.test(docs)) {
      row.appendChild(
        uiIconBtn({ icon: 'external-link', title: '打开文档', xs: true, onClick: () => window.open(docs, '_blank') }),
      );
    } else {
      row.appendChild(uiIconBtn({ icon: 'copy', title: '复制', xs: true, onClick: () => void copyText(docs, '文档地址') }));
    }
    meta.appendChild(row);
  }
  meta.appendChild(
    metaRow('声明文件', v.declPath, true, () => void copyText(v.declPath, '声明文件路径')),
  );
  if (v.run) {
    meta.appendChild(metaRow('命令', v.run.cmd, true));
    if (v.run.args.length) meta.appendChild(metaRow('固定参数', v.run.args.join(' '), true));
    if (v.run.cwd) meta.appendChild(metaRow('工作目录', v.run.cwd, true));
    if (v.run.shell) meta.appendChild(metaRow('经 shell 启动', '是'));
  } else {
    meta.appendChild(metaRow('命令', '没写怎么跑（既无 run 段，目录里也没有 main.mjs）'));
  }
  meta.appendChild(
    metaRow('参数值文件', v.valuesPath, true, () => void copyText(v.valuesPath, '参数值文件路径')),
  );
  meta.appendChild(metaRow('运行记录', v.runsPath, true, () => void copyText(v.runsPath, '运行记录路径')));
  const rate = successRate(v.runs);
  meta.appendChild(metaRow('成功率', rate === null ? '暂无记录' : `${Math.round(rate * 100)}%（共 ${v.runs.length} 条）`));
  if (v.overLimit) {
    meta.appendChild(el('div', 'bz-dock-meta-warn', '记录条数已超约定上限 —— 裁剪是工具自己的活，去检查它的 GC'));
  }
  if (v.runsUnreadable) {
    meta.appendChild(el('div', 'bz-dock-meta-warn', '运行记录文件读不懂（坏 JSON 或结构不符）；工具坞不打补丁、不改写，等工具自己修好'));
  }
  wrap.appendChild(meta);
  wrap.appendChild(autoSection(v));

  const cols = el('div', 'bz-dock-cols');
  cols.appendChild(runPane(v));
  cols.appendChild(histPane(v));
  wrap.appendChild(cols);
  body.appendChild(wrap);
}

function metaRow(label: string, value: string, mono = false, onCopy?: () => void): HTMLElement {
  const row = el('div', 'bz-dock-meta-row');
  row.appendChild(el('span', 'bz-dock-meta-label', label));
  const val = el('span', 'bz-dock-meta-val' + (mono ? ' is-mono' : ''), value);
  val.title = value;
  row.appendChild(val);
  if (onCopy) {
    row.appendChild(uiIconBtn({ icon: 'copy', title: '复制', xs: true, onClick: onCopy }));
  }
  return row;
}

// ---------- 运行台（左栏） ----------

function runPane(v: DockToolView): HTMLElement {
  const pane = el('section', 'bz-dock-pane bz-dock-runpane');
  pane.appendChild(el('h3', 'bz-dock-pane-title', '运行台'));

  if (!v.manifest) {
    // 读声明**不需要信任** —— 它就是读一个文件。所以这里给的是「修路径 / 重读」，不是「要授权」。
    const box = el('div', 'bz-dock-noManifest');
    box.appendChild(el('div', 'bz-dock-note', v.declError ?? '声明文件读不到。'));
    box.appendChild(
      uiBtn({
        label: '重新读声明',
        icon: 'refresh-cw',
        onClick: () => void reloadDeclaration(v),
      }),
    );
    pane.appendChild(box);
    pane.appendChild(liveHost(v.entry.id));
    return pane;
  }

  const params = v.manifest.params ?? [];
  if (params.length) {
    const form = el('div', 'bz-dock-form');
    const values = valuesOf(v);
    for (const p of params) form.appendChild(paramRow(p, values, v));
    pane.appendChild(form);
  } else {
    pane.appendChild(el('div', 'bz-dock-note', '这个工具没有参数。'));
  }

  if (!v.run) {
    pane.appendChild(
      el('div', 'bz-dock-meta-warn', '这份声明没写 run 段 —— 能看它的记录，但不知道该怎么跑。'),
    );
  }

  const btns = el('div', 'bz-dock-runbtns');
  if (canRun()) {
    const live = liveRunOf(v.entry.id);
    btns.appendChild(
      live
        ? uiBtn({ label: '停止', icon: 'square', tone: 'danger', onClick: () => stopRun(v.entry.id) })
        : uiBtn({
            label: runLabel(v),
            icon: 'play',
            tone: 'primary',
            disabled: !canStart(v),
            onClick: () => void runFlow(v),
          }),
    );
    if (params.length) {
      btns.appendChild(
        uiBtn({ label: '重置参数', size: 'sm', onClick: () => resetValues(v) }),
      );
    }
  } else {
    btns.appendChild(el('span', 'bz-dock-mobilehint', '移动端不能启动进程，只能看'));
  }
  pane.appendChild(btns);
  // 上一次现场运行的原始输出尾部（增强 #17）：跑完不清，下次运行覆盖；只在内存，不落盘
  if (!liveRunOf(v.entry.id)) {
    const lastTail = lastRawTailOf(v.entry.id);
    if (lastTail?.length) {
      const box = el('div', 'bz-dock-lastraw');
      box.appendChild(el('div', 'bz-dock-lastraw-head', '上次现场输出（尾部）'));
      const tail = el('pre', 'bz-dock-raw');
      tail.textContent = lastTail.slice(-12).join('\n');
      box.appendChild(tail);
      pane.appendChild(box);
    }
  }
  pane.appendChild(liveHost(v.entry.id));
  return pane;
}

function liveHost(id: string): HTMLElement {
  const host = el('div', 'bz-dock-live');
  host.dataset.tool = id;
  renderLiveInto(host, id);
  return host;
}

function renderLiveInto(host: HTMLElement, id: string): void {
  host.innerHTML = '';
  const run = liveRunOf(id);
  if (!run) {
    host.classList.add('is-off');
    return;
  }
  host.classList.remove('is-off');

  host.appendChild(el('div', 'bz-dock-live-head', '正在跑（bz 亲手启动的，所以有实时进度）'));
  const ptxt = run.progress.phase
    ? `${run.progress.phase}${run.progress.pct === null ? '' : ` ${Math.round(run.progress.pct)}%`}`
    : '进行中';
  host.appendChild(el('div', 'bz-dock-live-phase', ptxt));
  // pct 为 null = 该阶段不可估 —— 画的是不确定态条纹，不是假进度
  const bar = uiProgress({ value: run.progress.pct ?? 0 });
  if (run.progress.pct === null) bar.el.classList.add('is-indeterminate');
  host.appendChild(bar.el);

  const steps = el('ol', 'bz-dock-steps');
  for (const s of run.steps.slice(-8)) {
    const li = el('li', 'bz-dock-step');
    li.appendChild(el('span', 'bz-dock-step-dot'));
    li.appendChild(el('span', 'bz-dock-step-text', s.text));
    steps.appendChild(li);
  }
  host.appendChild(steps);
  if (run.rawTail.length) {
    const tail = el('pre', 'bz-dock-raw');
    tail.textContent = run.rawTail.slice(-12).join('\n');
    host.appendChild(tail);
  }
}

/**
 * 参数表单草稿。
 *
 * 初值 = 声明默认值叠加**工具目录里已存的值**（`view.values`，来自 `data.json`）；
 * 之后每次改动只落在草稿上，去抖后写回那个文件（`queueValueSave`）。
 * 草稿按工具 id 在会话内保留 —— 重渲（切视图、刷新）不该把用户正在填的东西冲掉。
 */
function valuesOf(v: DockToolView): Record<string, unknown> {
  const id = v.entry.id;
  if (!draftValues.has(id)) {
    draftValues.set(id, initialValuesOf(v.manifest?.params, v.values));
  }
  return draftValues.get(id)!;
}

/** 草稿落盘（去抖）。写失败只提示一次 —— 面板要照常能用，不能让一次落盘失败卡住填表 */
function queueValueSave(v: DockToolView): void {
  const id = v.entry.id;
  const prev = valueSaveTimers.get(id);
  if (prev) clearTimeout(prev);
  valueSaveTimers.set(
    id,
    setTimeout(() => {
      valueSaveTimers.delete(id);
      saveValuesNow(v);
    }, VALUE_SAVE_DEBOUNCE_MS),
  );
}

/** 立刻落盘（去抖未到就要启动运行、或关面板时用） */
function saveValuesNow(v: DockToolView): void {
  const id = v.entry.id;
  const t = valueSaveTimers.get(id);
  if (t) {
    clearTimeout(t);
    valueSaveTimers.delete(id);
  }
  const draft = draftValues.get(id);
  if (!draft) return;
  if (!saveToolValues(v.entry, draft)) {
    notice('参数没存住（写不进工具目录），检查那个目录是否能写', 'warning');
  }
}

/** 重置参数：清掉已存的值，回到声明默认（不是「清空表单」—— 声明给了默认就回默认） */
function resetValues(v: DockToolView): void {
  draftValues.set(v.entry.id, initialValuesOf(v.manifest?.params));
  saveValuesNow(v);
  render();
}

function paramRow(p: DockParam, values: Record<string, unknown>, v: DockToolView): HTMLElement {
  const set = (val: unknown) => {
    values[p.key] = val;
    queueValueSave(v);
  };
  let control: HTMLElement;
  switch (p.type) {
    case 'bool': {
      const sw = uiSwitch({ checked: values[p.key] === true, onChange: (c) => set(c) });
      control = sw.el;
      break;
    }
    case 'choice': {
      const opts = (p.options ?? []).map((o) => ({ value: o.value, label: o.label }));
      if (!opts.length) opts.push({ value: '', label: '（无选项）' });
      // 初值：已填过 → 用已填；否则用清单 default（不在选项里就退回第一项）
      const seed = values[p.key] !== undefined ? String(values[p.key]) : String(p.default ?? opts[0].value);
      const picked = opts.some((o) => o.value === seed) ? seed : opts[0].value;
      set(picked);
      const sel = uiSelect<string>({
        options: opts,
        value: picked,
        placeholder: '请选择',
        onChange: (val) => set(val),
      });
      control = sel.el;
      break;
    }
    case 'multichoice': {
      const box = el('div', 'bz-dock-multichoice');
      const cur = new Set<string>(Array.isArray(values[p.key]) ? (values[p.key] as string[]) : []);
      for (const o of p.options ?? []) {
        box.appendChild(
          uiChip({
            label: o.label,
            selectedSoft: cur.has(o.value),
            onClick: () => {
              if (cur.has(o.value)) cur.delete(o.value);
              else cur.add(o.value);
              set([...cur]);
              render();
            },
          }),
        );
      }
      control = box;
      break;
    }
    case 'number': {
      const inp = uiInput({
        type: 'number',
        value: values[p.key] === undefined ? '' : String(values[p.key]),
        placeholder: p.placeholder,
        onInput: (val) => set(val === '' ? undefined : Number(val)),
      });
      if (p.min !== undefined) inp.min = String(p.min);
      if (p.max !== undefined) inp.max = String(p.max);
      if (p.step !== undefined) inp.step = String(p.step);
      control = inp;
      break;
    }
    case 'multiline': {
      const ta = el('textarea', 'bz-dock-textarea');
      ta.rows = p.rows ?? 4;
      ta.value = values[p.key] === undefined ? '' : String(values[p.key]);
      if (p.placeholder) ta.placeholder = p.placeholder;
      ta.addEventListener('input', () => set(ta.value));
      control = ta;
      break;
    }
    case 'path': {
      const row = el('div', 'bz-dock-pathrow');
      const inp = uiInput({
        value: values[p.key] === undefined ? '' : String(values[p.key]),
        placeholder: p.placeholder,
        onInput: (val) => set(val),
      });
      row.appendChild(inp);
      row.appendChild(
        uiIconBtn({
          icon: 'folder-open',
          title: p.mode === 'dir' ? '选择文件夹' : '选择文件',
          onClick: () => {
            void (async () => {
              if (p.mode === 'dir') {
                const dir = await pickSystemFolder();
                if (dir) {
                  inp.value = dir;
                  set(dir);
                }
              } else {
                const files = await pickSystemFiles(`选择${p.label}`, []);
                if (files.length) {
                  inp.value = files[0];
                  set(files[0]);
                }
              }
            })();
          },
        }),
      );
      control = row;
      break;
    }
    case 'secret': {
      const inp = uiInput({
        type: 'password',
        value: values[p.key] === undefined ? '' : String(values[p.key]),
        placeholder: p.placeholder || '只存在本机工具目录',
        onInput: (val) => set(val),
      });
      control = inp;
      break;
    }
    default: {
      const inp = uiInput({
        value: values[p.key] === undefined ? '' : String(values[p.key]),
        placeholder: p.placeholder,
        onInput: (val) => set(val),
      });
      control = inp;
      break;
    }
  }
  const desc = p.help || (p.type === 'secret' ? '存在本机工具目录里，不进 vault、不写运行记录' : undefined);
  return uiField({ label: p.label + (p.required ? ' *' : ''), desc, control });
}

// ---------- 历史（右栏） ----------

function histPane(v: DockToolView): HTMLElement {
  const pane = el('section', 'bz-dock-pane bz-dock-histpane');
  const head = el('div', 'bz-dock-pane-head');
  head.appendChild(el('h3', 'bz-dock-pane-title', '运行记录'));
  head.appendChild(el('span', 'bz-dock-pane-count', `${v.runs.length} 条`));
  pane.appendChild(head);

  if (!v.runs.length) {
    pane.appendChild(
      uiEmpty({
        icon: 'history',
        title: v.runsUnreadable ? '记录读不懂' : '还没有运行记录',
        desc: v.runsUnreadable
          ? '文件在，但内容不合契约；工具坞只读不改'
          : '跑一次，或等它按声明的节奏自动跑完，记录就会出现',
      }),
    );
    return pane;
  }
  const list = el('div', 'bz-dock-histlist');
  // 文件顺序不是契约（schedule.ts 全部先按时间排再判）；「最近 60 条」得自己排，不能信落盘顺序
  const newestFirst = [...v.runs].sort(
    (a, b) => (timeOf(b.startedAt) ?? 0) - (timeOf(a.startedAt) ?? 0),
  );
  for (const r of newestFirst.slice(0, 60)) list.appendChild(histRow(r));
  pane.appendChild(list);
  if (v.runs.length > 60) pane.appendChild(el('div', 'bz-dock-note', '只显示最近 60 条'));
  return pane;
}

function histRow(r: DockRunRecord): HTMLElement {
  const row = el('article', 'bz-dock-histrow');
  const head = el('div', 'bz-dock-histhead');
  head.appendChild(el('span', dotClass(r.status)));
  head.appendChild(el('span', 'bz-dock-histtime', relTime(r.startedAt.replace('T', ' '))));
  head.appendChild(el('span', 'bz-dock-histstatus', statusText(r.status)));
  const dur = durationText(r);
  if (dur) head.appendChild(el('span', 'bz-dock-histdur', dur));
  head.appendChild(el('span', 'bz-dock-histtrig', r.trigger === 'auto' ? '自动' : '手动'));
  row.appendChild(head);
  if (r.message) row.appendChild(el('div', 'bz-dock-histmsg', r.message));

  if (r.error) {
    const box = el('div', 'bz-dock-histerr');
    box.appendChild(el('div', 'bz-dock-histerr-hint', errorHint(r.error.kind)));
    if (r.error.detail) box.appendChild(el('div', 'bz-dock-histerr-detail', r.error.detail));
    row.appendChild(box);
  }

  const hasMore =
    (r.steps && r.steps.length > 0) ||
    (r.info && r.info.length > 0) ||
    r.result !== undefined ||
    r.metrics !== undefined ||
    (r.artifacts && r.artifacts.length > 0) ||
    r.error?.stderr;
  if (hasMore) {
    const btn = uiBtn({
      label: '展开',
      size: 'sm',
      className: 'bz-dock-histtoggle',
      onClick: () => {
        const open = row.classList.toggle('is-open');
        btn.querySelector('span')!.textContent = open ? '收起' : '展开';
      },
    });
    row.appendChild(btn);

    const more = el('div', 'bz-dock-histmore');
    if (r.steps?.length) more.appendChild(block('步骤', r.steps.map((s) => s.text).join('\n')));
    if (r.metrics) more.appendChild(block('指标', JSON.stringify(r.metrics, null, 2)));
    if (r.artifacts?.length) {
      // 产物路径可点（增强 #16）：vault 里的用 Obsidian 打开，外面的在文件管理器定位
      const box = el('div', 'bz-dock-block');
      box.appendChild(el('div', 'bz-dock-block-label', '产物'));
      for (const a of r.artifacts) {
        const row = el('div', 'bz-dock-artrow');
        row.appendChild(el('span', 'bz-dock-artrow-path', `${a.label ? a.label + ' · ' : ''}${a.path}`));
        row.appendChild(
          uiIconBtn({ icon: 'external-link', title: '打开 / 定位产物', xs: true, onClick: () => openArtifact(a.path) }),
        );
        box.appendChild(row);
      }
      more.appendChild(box);
    }
    if (r.result !== undefined) more.appendChild(block('结果', JSON.stringify(r.result, null, 2)));
    if (r.info?.length) more.appendChild(block('信息', JSON.stringify(r.info, null, 2)));
    if (r.error?.stderr) more.appendChild(block('stderr 尾部', r.error.stderr));
    row.appendChild(more);
  }
  if (r.startedAt) {
    const exact = el('div', 'bz-dock-histexact', r.startedAt.replace('T', ' ').replace(/\..*$/, ''));
    row.appendChild(exact);
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

// ==================== 运行 ====================

/** 运行前置检查 → 启动 */
async function runFlow(v: DockToolView): Promise<void> {
  if (!hostApp) return;
  if (!canRun()) {
    notice('移动端不能启动本机进程', 'warning');
    return;
  }
  if (!v.run) {
    notice('这份声明没写怎么跑：既无 run 段，目录里也没有 main.mjs', 'warning');
    return;
  }
  if (!isTrusted(v.entry) || v.trustStale) {
    // 未信任 / 声明把命令改了 → 先看清再确认。**确认之前一个字节都不会被执行**
    const ok = await applyTrust(v.entry, v.manifest!, v.declPath, v.run, {
      title: v.trustStale ? '启动命令变了，重新确认信任' : '信任此命令',
      accept: '信任',
    });
    if (!ok) return;
  }
  // 值先落盘再启动：工具坞发的参数与设置文件里那份必须一致，否则用户下次看到的和这次跑的不是一回事
  saveValuesNow(v);
  const values = valuesOf(v);
  // 与调度器同一条口径（missingRequiredParams）：手动这边放行、自动那边却报「必填参数没填」，
  // 同一个状态两处说法不一样，人就没法对账。`null` / 空数组（multichoice 全不选）都算缺。
  const missing = missingRequiredParams(v.manifest?.params, values);
  if (missing.length) {
    notice(`还差必填参数：${missing.join('、')}`, 'warning');
    return;
  }

  const run = runTool(hostApp, v.entry, v.run, v.manifest, values, {
    onStep: () => updateLive(v.entry.id),
    onProgress: () => updateLive(v.entry.id),
    onInfo: () => updateLive(v.entry.id),
    onResult: () => updateLive(v.entry.id),
    onDone: (outcome) => {
      notifyRunOutcome(displayName(v), outcome, () => openDockTool(hostApp as App, v.entry.id));
      // 手动成功也给熔断记账：手动成功是「工具活着」的直接证据，连续失败清零、熔断解除。
      // 手动失败**不动**台账 —— 熔断保护的是没人盯着时的自动运行，别让人手动试错把它搞停。
      if (outcome.ok) {
        void patchRunState(v.entry.id, {
          lastAttemptAt: outcome.finishedAt,
          lastAttemptOk: true,
          consecutiveFailures: 0,
          pausedAt: undefined,
        });
      }
      void refresh();
      updateLive(v.entry.id);
    },
  });
  void run;
  render();
}

/** 熔断恢复 + 立即补跑，一步到位：恢复是清台账，补跑走手动同一条路（全部门槛照过） */
async function resumeAndRetry(v: DockToolView): Promise<void> {
  await patchRunState(v.entry.id, null);
  kickDockScheduler();
  await refresh();
  const nv = viewById(v.entry.id);
  if (nv && canStart(nv)) await runFlow(nv);
}

function updateLive(id: string): void {
  const hosts = overlay?.querySelectorAll<HTMLElement>(`.bz-dock-live[data-tool="${id}"]`);
  hosts?.forEach((h) => renderLiveInto(h, id));
  renderRunbar(); // 顶层进度条与详情里的运行台是同一次运行的两个视角，一起动
}

// ==================== 声明 ====================

/**
 * 重新读声明文件。
 *
 * **不需要信任** —— 声明是文件，读它不执行任何东西。这正是 D4 修订要换来的顺序：先看清它会
 * 跑什么，再决定信不信任。原先靠 `<cmd> --manifest` 自描述，要读清单就得先执行那条命令，
 * 于是信任只能在「还不知道它会跑什么」的前提下做出。
 */
async function reloadDeclaration(v: DockToolView): Promise<void> {
  const res = readDeclaration(v.entry.path);
  if (!res.ok || !res.manifest) {
    notice(res.error ?? '声明读不到', 'error');
    return;
  }
  const m = res.manifest;
  if (m.id !== v.entry.id) {
    // 声明里 id 变了 → 登记的键对不上。bz 不自动改键（改了运行记录就失联），交给人定
    notice(
      `声明里的 id 是「${m.id}」，与登记的「${v.entry.id}」不一致 —— 当两个工具看，或移除后重新导入`,
      'warning',
    );
  }
  // 回落命中旧名时以实际路径为准（cwd 等缺省都从它算）；没写 run 段时带上约定入口的探测结果
  const run = resolveRun(m, res.path ?? v.entry.path, res.conventionalRun);
  const sig = run ? runSignature(run) : undefined;
  if (isTrusted(v.entry) && sig !== v.entry.trustedRun) {
    // 声明改了「怎么跑」→ 信任作废：信任的对象是那条命令，不是这个 id
    if (
      await applyTrust(v.entry, m, res.path ?? v.entry.path, run, {
        title: '启动命令变了，重新确认信任',
        accept: '信任',
      })
    ) {
      return;
    }
    notice('已保留原样 —— 但这条命令在你重新确认之前不会被运行', 'warning');
    return;
  }
  notice(`声明已重新读取：${m.params.length} 个参数`, 'success');
  await refresh();
}

/** 节奏 → 人话（只认节奏对象本身；**声明那份与用户覆盖那份共用这一份口径**，免得两处措辞漂开） */
function scheduleTextOf(s: DockSchedule | undefined): string {
  if (!s) return '未声明';
  const base: Record<string, string> = {
    daily: '每天一次',
    weekly: s.weekday !== undefined ? `每周${'日一二三四五六'[s.weekday]}` : '每周一次',
    interval: s.everyHours !== undefined ? `每 ${s.everyHours} 小时` : '按间隔',
    'on-demand': '按需（只手动）',
    unknown: '未声明',
  };
  const parts = [base[s.kind] ?? s.kind];
  if (s.kind === 'daily' && s.hour !== undefined) parts.push(`${String(s.hour).padStart(2, '0')}:00 前`);
  if (s.note) parts.push(`（${s.note}）`);
  return parts.join('');
}

/** 声明里那份节奏的人话（保留旧签名，内部转调 `scheduleTextOf`） */
function scheduleText(m: DockManifest): string {
  return scheduleTextOf(m.schedule);
}

/** 到期时刻 → 人话（当天说「今天 HH:MM」，跨天说「M-D HH:MM」） */
function dueTimeText(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return sameDay ? `今天 ${hm}` : `${d.getMonth() + 1}-${p(d.getDate())} ${hm}`;
}

/** 声明里「会跑什么」的人话摘要（信任确认框与详情页共用一份口径） */
function runTextOf(run: ResolvedRun | null): string {
  if (!run) return '没写怎么跑（既无 run 段，目录里也没有 main.mjs）';
  return [run.cmd, ...run.args].join(' ');
}

/**
 * 信任确认（spec D7：加一次，长期有效；不做每次执行前确认）。
 *
 * 对话框里摆的全是**从声明里读到的事实** —— 用户是在核对，不是在填空。顺序也对：
 * 这些内容是在建立信任**之前**显示出来的，因为读声明本来就只需要读一个文件。
 */
async function confirmTrust(
  manifest: DockManifest,
  declPath: string,
  run: ResolvedRun | null,
  title: string,
  accept: string,
): Promise<boolean> {
  // 增量构造：只跳过**缺席的可选行**（描述 / cwd），刻意的空行分段必须活着 ——
  // 一把梭的 `.filter(s => s !== '')` 会把分隔空行一并吃掉，核对信息挤成一坨
  const lines: string[] = [manifest.name];
  if (manifest.description) lines.push(manifest.description);
  lines.push('', `会跑：${runTextOf(run)}`);
  if (run?.cwd) lines.push(`工作目录：${run.cwd}`);
  lines.push(`声明文件：${declPath}`, '');
  lines.push(
    manifest.schedule
      ? `节奏：${scheduleText(manifest)}（自动化；bz 会在它开着时按节奏跑）`
      : '节奏：未声明（手动）',
  );
  lines.push(`参数：${manifest.params.length} 个`, '');
  lines.push(
    '建立信任之后工具坞才会运行它（读声明不需要信任）。信任的对象是「那条命令」，',
    '建立一次长期有效；以后命令变了会重新问一次。',
  );
  const v = await openFlowDialog({
    title,
    message: lines.join('\n'),
    actions: [
      { label: '取消', value: 'cancel' },
      { label: accept, value: 'ok', cta: true },
    ],
  });
  return v === 'ok';
}

// ==================== 登记（导入声明 / 重新导入 / 停用 / 移除） ====================

/**
 * 给**已登记**的工具建立 / 重建信任，并落盘。三处共用：重新读声明发现命令变了、运行前被拦下、
 * 详情页手动点「重新确认信任」。
 *
 * 落盘的是**当前这条命令的签名**（`trustedRun`）—— 下次声明再被人改，比对不上就又会被拦。
 * 返回是否已建立信任；用户取消返回 false（此时**一个字都不会被执行**）。
 */
async function applyTrust(
  entry: DockToolEntry,
  manifest: DockManifest,
  declPath: string,
  run: ResolvedRun | null,
  opts: { title: string; accept: string },
): Promise<boolean> {
  const ok = await confirmTrust(manifest, declPath, run, opts.title, opts.accept);
  if (!ok) return false;
  const next: DockToolEntry = { ...entry, trustedAt: new Date().toISOString() };
  if (run) next.trustedRun = runSignature(run);
  else delete next.trustedRun;
  await persist(readToolEntries().map((e) => (e.id === entry.id ? next : e)), `已信任 ${manifest.name}`);
  return true;
}

/**
 * 导入一份工具声明 —— **唯一的登记入口，而且只有一个输入：声明文件在哪**。
 *
 * 标题 / 描述 / 图标 / 参数 / 节奏 / 启动命令全部读自那个文件，所以这里没有「填表单」。
 * 用户看到的是「它会跑什么」的核对，不是「请你告诉我它是什么」的问卷 —— 后者要求用户
 * 知道签到接口 URL 那种只有写脚本的人才知道的事。
 *
 * 传 `entry` 表示重新导入某个已登记的工具（换文件，或文件内容变了想刷新）。
 */
async function importToolFlow(entry?: DockToolEntry): Promise<void> {
  if (!canRun()) {
    notice('导入声明需要桌面端（要读本机文件）', 'warning');
    return;
  }
  const picked = await pickSystemFiles(
    entry ? '重新选择该工具的声明文件' : `选择工具声明（${DECLARATION_FILENAME}）`,
    [{ name: '工具声明', ext: ['json'] }],
  );
  if (!picked.length) return;
  const declPath = picked[0];

  const res = readDeclaration(declPath);
  if (!res.ok || !res.manifest) {
    notice(res.error ?? '声明读不到', 'error');
    return;
  }
  const manifest = res.manifest;
  // 约定入口必须带上：导入是登记的主路，信任框与 trustedRun 都按「真实会跑的命令」算，
  // 漏了它，三行最薄声明（guide §2.3）登记完立即 trustStale，自动运行永远跑不起来
  const run = resolveRun(manifest, declPath, res.conventionalRun);

  const entries = readToolEntries();
  if (entries.some((e) => e.id === manifest.id && e.id !== entry?.id)) {
    notice(`id「${manifest.id}」已被另一个登记占用 —— 改声明里的 id，或先移除那个`, 'warning');
    return;
  }

  const next: DockToolEntry = { id: entry?.id ?? manifest.id, path: declPath };
  if (entry) {
    if (entry.enabled !== undefined) next.enabled = entry.enabled;
    // bz 侧的调度状态一并沿用：重新导入是「换文件 / 刷新」，不是「重置我的配置」——
    // 尤其 autoRun 缺省即开，丢了它等于用户特意关掉的自动化悄悄复活
    if (entry.autoRun !== undefined) next.autoRun = entry.autoRun;
    if (entry.scheduleOverride !== undefined) next.scheduleOverride = entry.scheduleOverride;
    if (entry.overrideDeclSig !== undefined) next.overrideDeclSig = entry.overrideDeclSig;
    // 命令没变就沿用旧信任；变了则不带 trustedAt（下面重新问）
    const sig = run ? runSignature(run) : undefined;
    if (sig !== undefined && sig === entry.trustedRun) {
      next.trustedAt = entry.trustedAt;
      next.trustedRun = entry.trustedRun;
    }
  }

  if (!isTrusted(next)) {
    const ok = await confirmTrust(
      manifest,
      declPath,
      run,
      entry ? '重新导入声明' : '导入工具声明',
      entry ? '确认并信任' : '信任并登记',
    );
    if (!ok) return;
    next.trustedAt = new Date().toISOString();
    const sig = run ? runSignature(run) : undefined;
    if (sig !== undefined) next.trustedRun = sig;
  }

  // 信任状态在上面的 confirmTrust 分支里已写进 next（沿用旧的或本次新授），此处不再二次拼装
  const list = entry ? entries.map((e) => (e.id === entry.id ? next : e)) : [...entries, next];
  await persist(list, entry ? `已更新 ${manifest.name}` : `已登记 ${manifest.name}`);
}

/** 登记项显示名（优先取视图里的声明名；视图还没有时退回 id） */
function nameOfEntry(id: string): string {
  const v = viewById(id);
  return v ? displayName(v) : id;
}

async function persist(list: DockToolEntry[], msg: string): Promise<void> {
  // 结构性改动之前先把在填的参数落住 —— 否则改个停用就顺手把刚才填的东西丢了
  for (const v of views) saveValuesNow(v);
  try {
    await saveToolEntries(list);
    notice(msg, 'success');
  } catch (e) {
    notice(`保存失败：${(e as Error)?.message ?? e}`, 'error');
    return;
  }
  // 登记变了 → 视图重建，草稿按新声明重新播种（旧草稿可能对应已经删掉的参数）
  draftValues.clear();
  await refresh();
}

async function toggleEnabled(entry: DockToolEntry): Promise<void> {
  const entries = readToolEntries();
  const next = { ...entry, enabled: entry.enabled === false };
  const name = nameOfEntry(entry.id);
  await persist(
    entries.map((e) => (e.id === entry.id ? next : e)),
    next.enabled ? `已启用 ${name}` : `已停用 ${name}`,
  );
}

async function removeToolFlow(v: DockToolView): Promise<void> {
  const res = await openFlowDialog({
    title: '移除登记',
    message:
      `确定把「${displayName(v)}」从工具坞移除？\n\n` +
      '只移除 bz 这边的登记 —— 声明文件、参数值文件、运行记录文件都不会被删' +
      '（前两个是工具目录里的，后一个是工具的账本）。调度台账（失败计数 / 熔断标记）一并清掉。',
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '移除', value: 'ok', cta: true, danger: true },
    ],
  });
  if (res !== 'ok') return;
  const entries = readToolEntries().filter((e) => e.id !== v.entry.id);
  if (view.kind === 'detail' && view.id === v.entry.id) view = { kind: 'list' };
  // 台账一并清（增强 #19）：失败计数 / 熔断标记不留孤儿（重导同 id 会从头记，正该如此）
  await patchRunState(v.entry.id, null);
  await persist(entries, `已移除 ${displayName(v)}`);
}
