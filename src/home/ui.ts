/**
 * 内容首页（home 域）UI 行为层（issue 232 活动河全域入口版）。
 *
 * 形态（桌面/移动同一 overlay，CSS ≤768px 断点切换；与 cinema 同构）：
 *  - 桌面：头行（今日活动河 + 日期）+ 三栏 grid（全部域 | 时间线 | 明天预告）；
 *          点遮罩/ESC 关闭（无关闭钮，头行去设置/关闭范式）
 *  - 移动：头行（活动河 + 关闭钮）+ 单列（时间线 → 明天预告 → 全部域单列瓦片）
 *  - 入口行/瓦片：今日动静彩点（ok/warn/hot/off）+ lucide 图标 + 实时计数，点击执行域命令
 *  - 入口菜单（2026-09-10 用户拍板）：桌面右键跟手菜单 / 移动长按底部抽屉（core/item-actions
 *    统一件）——菜单内容 = `shared.DOMAIN_MENU` 里的域快捷动作；
 *    **没有快捷动作的域不挂菜单**（空菜单不如不弹）。
 *    抽屉盒头 = 域彩色图标 + 域名 + 入口行右侧那行灰字（markup 见 render.sheetHeadHtml）；
 *    动态文案按 `dynamic` 槽位改写（focus → 开始/停止专注；pause → 暂停/继续专注，
 *    读 ./state.H.pomodoroPhase → shared.pomodoroMenuAction）；`keepHome` 的即时类动作不关面板。
 *  - 入口顺序 / 显隐：**本页不做任何编辑交互**，统一由「设置 → 首页入口」弹窗打理
 *    （顺序两端各一套 + 隐藏域，存 home.json，见 ./order）；本页只按序渲染可见域。
 *  - 时间线：recap 五域痕迹流 + 规则点评（✦ 域内自算，非 AI 调用）
 *  - 明天预告：复习/剪藏/日记三张规则卡，点击直达
 * markup 单源（ADR-0104）：面板骨架/周历/入口行/河卡/预告卡 HTML 全部出自 ./render
 * （渲染纯层，与原型壳消费同一份）；本文件只剩行为层——生命周期/事件绑定/ESC/命令直达。
 */
import type { IconName } from 'obsidian';
import { escManager, registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { notice } from '../core/notice';
import { mountIcons, uiEmpty, uiBtn } from '../core/ui';
import { topifyZ } from '../core/dom';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { tryGetSettings } from '../core/settings-provider';
import { H } from './state';
import { DOMAIN_MAP } from './domains';
import {
  DOMAIN_MENU, pomodoroMenuAction,
  DEFAULT_TIMELINE_FILTER, timelineRangeDays, type TimelineFilter,
} from './shared';
import type { PomodoroPhase } from '../core/pomodoro-phase';
import { isFocusingPhase } from '../core/pomodoro-phase';
import { collectRiver, type RiverData } from './river';
import { loadHomeOrder } from './order';
import {
  headDateText, panelFrameHtml, loadingEntriesHtml, loadingFlowHtml,
  weekHtml, entriesHtml, flowHtml, nextHtml, tilesHtml, sheetHeadHtml, menuHeadHtml, type FlowOpts,
} from './render';

/** 明天预告卡：本次打开是否被设置关掉（关掉时要连第三栏一起收敛，不能只清内容） */
let nextOff = true;

/* ---------- 设置读取（issue 287：首页时间线六项） ---------- */

/**
 * 读首页时间线相关设置。**每次开面板现读**（不从模块状态缓存）——
 * 用户在设置面板里改完立刻再开首页就该生效，缓存一层就多一个不同步的机会。
 * 键缺失/类型不符一律回落默认值（旧 data.json 没有这些键，不能让首页崩）。
 */
function readHomeSettings(): { filter: TimelineFilter; flow: FlowOpts; rangeDays: number; defaultDay: string; next: boolean } {
  const s = tryGetSettings() as Record<string, unknown>;
  const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  const filter: TimelineFilter = {
    produce: bool(s.homeTimelineProduce, DEFAULT_TIMELINE_FILTER.produce),
    progress: bool(s.homeTimelineProgress, DEFAULT_TIMELINE_FILTER.progress),
    notes: bool(s.homeTimelineNotes, DEFAULT_TIMELINE_FILTER.notes),
  };
  // 范围缺省 = week（用户 2026-09-11 拍板：默认能往回翻整周）；老 data.json 无此键时同样落 week
  const range = str(s.homeTimelineRange) ?? 'week';
  return {
    filter,
    flow: {
      filter,
      showTime: bool(s.homeTimelineTime, true),
      size: str(s.homeTimelineSize) ?? 'normal',
    },
    rangeDays: timelineRangeDays(range),
    defaultDay: str(s.homeDefaultDay) ?? 'today',
    next: bool(s.homeNextCards, true),
  };
}

/**
 * 打开时默认落到哪天（issue 287「默认打开日」）。
 * lastActive = 时间线窗口内**最近一天有痕迹的**那天——避免「今天还没动，面板一片空」，
 * 直接落到昨天/前天，用户打开就有东西看。窗口内全空则仍回今天。
 * 只跑一次（首次渲染前定 H.riverView），用户在面板里点周历切天不受影响。
 */
function pickInitialView(river: RiverData, defaultDay: string, rangeDays: number): string | null {
  const today = river.today.dateStr;
  if (defaultDay !== 'lastActive') return null;
  const window = river.days.slice(0, Math.max(1, rangeDays));
  const hit = window.find((d) => d.events.length > 0);
  return hit && hit.dateStr !== today ? hit.dateStr : null;
}

/* ---------- 生命周期 ---------- */

export function createOverlay(app: any): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay bz-home-overlay';
  overlay.innerHTML = panelFrameHtml();
  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号（cinema 等后开面板可压过首页）
  H.currentOverlay = overlay;
  H.overlayVisible = true;
  mountIcons(overlay); // 头行关闭钮等静态占位（renderAll 只挂数据区图标）
  bindEvents(overlay, app);
  renderAll();
  void refreshRiverAndRender();
}

/**
 * 番茄钟实时界面相位（idle / focusing / paused / break）——入口菜单唯一那条番茄钟项的文案与
 * 命令由它决定（彩点数据流也在这里校准）。跨域**只读**，动态 import 遵守 ADR-0002
 * （home 不静态依赖 pomodoro 域）。先 ensurePomodoro 再读相位：插件 onload 已初始化，
 * 这里是幂等的兜底（原型壳／竞态下也拿得到真实相位）；失败按未开始处理。
 */
async function readPomodoroPhase(app: any): Promise<PomodoroPhase> {
  try {
    const m = await import('../pomodoro');
    await m.ensurePomodoro(app);
    return m.menuPhase();
  } catch {
    return 'idle';
  }
}

/** 重新采集活动河数据 + 读入口顺序/隐藏域 + 番茄钟相位（并发取回，避免多趟闪） */
async function refreshRiverAndRender(): Promise<void> {
  if (!H.currentOverlay || !H.appRef) return;
  const [river, order, phase] = await Promise.all([
    collectRiver(H.appRef).catch(() => null),
    loadHomeOrder(H.appRef),
    readPomodoroPhase(H.appRef),
  ]);
  // 番茄相位并入数据流（item-1789106079981：彩点 warn 条件）——collectRiver 只读裸相位，
  // 这里以 ensure 兜底后的实时值为准写回。彩点口径 = **专注进行中（计时或暂停）**，
  // 休息阶段不算；布尔口径与 pomodoro/ui.isFocusing 同出 core.isFocusingPhase 单源。
  const focusing = isFocusingPhase(phase);
  if (river) river.pomodoroFocusing = focusing;
  // 采集失败标记（H12）：聚合层异常被 catch(() => null) 吞成 null 时置位——渲染出「失败 + 重试」
  // 空态而非永挂加载骨架；成功采集即清位。
  // issue 290：失败只兜「从没有过数据」——H.river 不再随失败回 null，常驻 DOM 里已有的
  // 好渲染不被一次刷新失败换成失败空态（重试路径 renderAll 读的也是旧数据，语义不变）。
  H.riverFailed = river === null;
  if (river) H.river = river;
  if (!river && H.river) return;
  if (order) H.order = order;
  H.pomodoroPhase = phase;
  // 「默认打开日」只在数据刚到、用户还没点过周历时定一次（H.riverView 为 null = 没点过）
  if (river && !H.riverView) {
    const { defaultDay, rangeDays } = readHomeSettings();
    H.riverView = pickInitialView(river, defaultDay, rangeDays);
  }
  renderAll();
}

/**
 * 关闭（issue 290）= 隐藏保留 DOM：面板壳、上次渲染、采集数据、入口顺序、查看日全部原地保留，
 * 重开（openHome → showOverlay）秒显旧内容再动态刷新，不重建不闪骨架。
 * 真销毁只有一条路：unloadHome（插件卸载，remove + resetHomeState）。
 */
export function closeOverlay(): void {
  if (!H.currentOverlay || !H.overlayVisible) return;
  H.currentOverlay.style.display = 'none';
  H.overlayVisible = false;
}

/** 重开复用（issue 290）：恢复显示 + 重新发号（谁后显示谁在上）+ 立即动态刷新数据 */
export function showOverlay(): void {
  const overlay = H.currentOverlay;
  if (!overlay || H.overlayVisible) return;
  overlay.style.display = '';
  topifyZ(overlay);
  H.overlayVisible = true;
  void refreshRiverAndRender();
}

/* ---------- 事件 ---------- */

function bindEvents(overlay: HTMLElement, app: any): void {
  // 键盘可达性：role=button 元素响应 Enter/Space（button 换 div 后的补偿）
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as HTMLElement;
    const el = t.closest('[role="button"]') as HTMLElement | null;
    if (el) {
      e.preventDefault();
      el.click();
    }
  });
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) {
      closeOverlay();
      return;
    }
    if (t.closest('[data-home-close]')) {
      closeOverlay();
      return;
    }
    const go = t.closest('[data-home-go]') as HTMLElement | null;
    if (go) {
      const id = go.dataset.homeGo || '';
      if (id && DOMAIN_MAP.has(id)) openDomain(id, app);
      return;
    }
    // 周历切天：切换选中格并只重渲时间线（数据已在采集窗口内）
    const wk = t.closest('[data-home-weekday]') as HTMLElement | null;
    if (wk && H.river) {
      H.riverView = wk.dataset.homeWeekday || null;
      const overlay2 = H.currentOverlay;
      if (overlay2) {
        overlay2.querySelectorAll('[data-home-weekday]').forEach((b) =>
          b.classList.toggle('bz-home-wk--sel', (b as HTMLElement).dataset.homeWeekday === H.riverView));
        const flow = overlay2.querySelector('[data-home-flow]') as HTMLElement | null;
        if (flow) {
          flow.innerHTML = flowHtml(H.river!, H.riverView ?? '', readHomeSettings().flow);
          mountIcons(flow);
        }
      }
    }
  });
}

function openDomain(id: string, app: any): void {
  const d = DOMAIN_MAP.get(id);
  if (!d) return;
  closeOverlay();
  runCommand(d.commandId, app, `「${d.name}」暂时不可用`);
}

/** 直达命令（菜单快捷动作/入口打开共用）：FakeApp 等无 commands 环境降级为通知，不崩 */
function runCommand(commandId: string, app: any, failText = '该功能暂时不可用'): void {
  try {
    void app.commands.executeCommandById(commandId);
  } catch {
    notice(failText, 'warning');
  }
}

/**
 * 直达命令 + 跑完刷新首页数据（`keepHome` 动作专用）。
 * executeCommandById 返回 Promise（命令可能是异步：先弹确认框再写盘）——等它落地再刷新，
 * 否则会在用户还没确认时就刷新（看不到计数变化），或在写入前读到旧值。
 * 无 commands / 非 Promise 环境（原型壳）就地跳过刷新，不崩。
 */
function runCommandAndRefresh(commandId: string, app: any): void {
  let ret: unknown;
  try {
    ret = app.commands.executeCommandById(commandId);
  } catch {
    notice('该功能暂时不可用', 'warning');
    return;
  }
  if (ret && typeof (ret as Promise<unknown>).then === 'function') {
    void (ret as Promise<unknown>).then(() => refreshRiverAndRender(), () => refreshRiverAndRender());
  } else {
    void refreshRiverAndRender();
  }
}

/* ---------- 入口行交互：域快捷菜单 ---------- */

/** 容器内的入口元素（桌面容器只有入口行、移动容器只有瓦片） */
function rowEls(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.bz-home-erow, .bz-home-m-tile'));
}

/**
 * 挂统一操作浮层（core/item-actions：桌面右键菜单、移动长按抽屉）。
 * **DOMAIN_MENU 没有条目的域直接不挂** —— 右键/长按不弹任何东西。
 * 抽屉盒头 = 域彩色图标 + 域名 + 入口行那行灰字（markup 出自 render.sheetHeadHtml）；
 * `dynamic: 'phase'` 的项（番茄钟）按实时相位**整条替换**（文案/命令/图标）——
 * 四相位互斥、一次只出一条，不会出现「停止专注 + 继续专注」并列。
 * `keepHome` 的动作**不关首页**（即时类，如锁定保险库/暂停专注）：关面板再执行会让用户
 * 看不到结果、下次还得重开；执行完刷新面板数据（未读计数/彩点即时归位）。
 * 其余动作（开别域面板、需要确认框的批量改写）先关首页再执行——避免两层面板叠着。
 */
function attachRowMenu(el: HTMLElement, app: any, river: RiverData): void {
  const d = DOMAIN_MAP.get(el.dataset.homeGo || '');
  if (!d) return;
  const menu = DOMAIN_MENU[d.id];
  if (!menu || !menu.length) return;
  const actions: ItemAction[] = menu.map((a) => {
    // 相位敏感项：静态声明只是 idle 兜底，这里按实时相位整体换掉（见 shared.pomodoroMenuAction）
    const spec = a.dynamic === 'phase' ? { ...a, ...pomodoroMenuAction(H.pomodoroPhase) } : a;
    return {
      icon: spec.icon as IconName,
      label: spec.label,
      kind: spec.kind === 'danger' ? 'danger' : 'normal',
      onClick: () => {
        if (spec.keepHome) {
          // 即时类：面板留着，动作跑完刷新一次数据（计数/彩点当场归位）
          runCommandAndRefresh(spec.commandId, app);
          return;
        }
        closeOverlay();
        runCommand(spec.commandId, app);
      },
    };
  });
  const head = document.createElement('div');
  head.innerHTML = sheetHeadHtml(d, river);
  mountIcons(head); // data-lucide 占位 → 真 SVG（抽屉盒头消费它）
  // bz-home-menu = home 浮层皮肤类：两端都传（桌面菜单 + 移动抽屉），字号口径见 styles.css
  attachItemActions(el, actions, {
    sheetHead: head,
    // 桌面菜单另给一行版盒头（B 方案 2026-09-11）：跨 21 个域，右键后要知道自己点的是哪个域
    menuHeadHtml: menuHeadHtml(d, river),
    menuClass: 'bz-home-menu',
    sheetClass: 'bz-home-menu',
  });
}

/** 渲染后重挂入口菜单；render 是 innerHTML 重建，元素全新不会重复绑定 */
function mountRowInteractions(overlay: HTMLElement, app: any, river: RiverData): void {
  const entries = overlay.querySelector<HTMLElement>('[data-home-entries]');
  if (entries) for (const el of rowEls(entries)) attachRowMenu(el, app, river);
  const tiles = overlay.querySelector<HTMLElement>('[data-home-tiles]');
  if (tiles) for (const el of rowEls(tiles)) attachRowMenu(el, app, river);
}

/* ---------- 渲染（胶水：把单源 markup 灌进骨架数据区） ---------- */

function renderAll(): void {
  const overlay = H.currentOverlay;
  if (!overlay) return;
  const date = overlay.querySelector('[data-home-date]');
  if (date) date.textContent = headDateText();

  if (!H.river) {
    // 数据未到：结构占位（骨架），不闪空内容；采集失败（H12）→ 失败空态 + 重试，不再永挂骨架
    const entries = overlay.querySelector('[data-home-entries]') as HTMLElement;
    const flow = overlay.querySelector('[data-home-flow]') as HTMLElement;
    const next = overlay.querySelector('[data-home-next]') as HTMLElement;
    if (H.riverFailed) {
      const empty = uiEmpty({
        icon: 'alert-circle',
        title: '首页数据采集失败',
        desc: '活动河数据没能读出来（各域数据文件或面板数据暂不可用）',
      });
      const retry = uiBtn({ label: '重试', onClick: () => {
        H.riverFailed = false;
        renderAll();
        void refreshRiverAndRender();
      } });
      const row = document.createElement('div');
      row.className = 'bz-btn-row bz-btn-row--center';
      row.appendChild(retry);
      empty.appendChild(row);
      entries.innerHTML = '';
      entries.appendChild(empty);
      mountIcons(entries);
    } else {
      entries.innerHTML = loadingEntriesHtml();
    }
    flow.innerHTML = loadingFlowHtml();
    next.innerHTML = '';
    (overlay.querySelector('[data-home-tiles]') as HTMLElement).innerHTML = '';
    (overlay.querySelector('[data-home-week]') as HTMLElement).innerHTML = '';
    return;
  }
  const river = H.river;
  const cfg = readHomeSettings();
  // 时间范围：只放窗口内的天可选（week 档 = 采集窗口全长 7 天，越界自然回落今天）
  const windowDays = river.days.slice(0, cfg.rangeDays);
  const view = H.riverView && windowDays.some((d) => d.dateStr === H.riverView) ? H.riverView : null;
  H.riverView = view;
  const today = river.today.dateStr;
  const week = overlay.querySelector('[data-home-week]') as HTMLElement;
  // 周历只画范围窗口内的格子（today 档就一格「今」——范围设置本身在管「能翻到多远」）
  if (week) week.innerHTML = weekHtml(river.week.slice(0, cfg.rangeDays), today, view ?? today);
  const entries = overlay.querySelector('[data-home-entries]') as HTMLElement;
  const flow = overlay.querySelector('[data-home-flow]') as HTMLElement;
  const next = overlay.querySelector('[data-home-next]') as HTMLElement;
  entries.innerHTML = entriesHtml(river, H.order.desk, H.order.hiddenDesk);
  flow.innerHTML = flowHtml(river, view ?? today, cfg.flow);
  next.innerHTML = nextHtml(river, cfg.next);
  // 预告卡关掉 → 第三栏整块收掉（只清内容会留一条空列，桌面 grid 里就是一道空白）
  nextOff = !cfg.next;
  next.style.display = nextOff ? 'none' : '';
  const tiles = overlay.querySelector('[data-home-tiles]') as HTMLElement;
  tiles.innerHTML = tilesHtml(river, H.order.mob, H.order.hiddenMob);
  mountIcons(week);
  mountIcons(entries);
  mountIcons(flow);
  mountIcons(next);
  mountIcons(tiles);
  mountRowInteractions(overlay, H.appRef, river);
}

/* ---------- ESC / 通知 ---------- */

export function registerEscapeHandler(): void {
  // DOM 常驻（issue 290）后 currentOverlay 恒非 null，判活必须带上「显示中」——
  // 隐藏保留的首页层不得截胡其他面板的 ESC
  registerPanelEsc('bz-home', () => !!H.currentOverlay && H.overlayVisible, closeOverlay);
}

/** 注销 ESC 层（关闭面板/卸载时调用；escManager 层不随插件卸载自动清理） */
export function unregisterEscapeHandler(): void {
  unregisterPanelEsc('bz-home');
}
