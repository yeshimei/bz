/**
 * 内容首页（home 域）UI 行为层（issue 232 活动河全域入口版）。
 *
 * 形态（桌面/移动同一 overlay，CSS ≤768px 断点切换；与 cinema 同构）：
 *  - 桌面：头行（今日活动河 + 日期）+ 三栏 grid（全部域 | 时间线 | 明天预告）；
 *          点遮罩/ESC 关闭（无关闭钮，头行去设置/关闭范式）
 *  - 移动：头行（活动河 + 关闭钮）+ 单列（全部域单列瓦片 → 明天预告 → 时间线沉底；
 *          顺序以 styles.css 移动档 order 值为准——瓦片 order:-1 置顶，入口第一屏可达）
 *  - 入口行/瓦片：今日动静彩点（ok/warn/hot/off）+ lucide 图标 + 实时计数，点击执行域命令
 *  - 入口菜单（2026-09-10 用户拍板）：桌面右键跟手菜单 / 移动长按底部抽屉（core/item-actions
 *    统一件）——菜单内容 = `shared.DOMAIN_MENU` 里的域快捷动作；
 *    **没有快捷动作的域不挂菜单**（空菜单不如不弹）。
 *    抽屉盒头 = 域彩色图标 + 域名 + 入口行右侧那行灰字（markup 见 render.sheetHeadHtml）；
 *    动态文案按 `dynamic` 槽位改写（focus → 开始/停止专注；pause → 暂停/继续专注，
 *    读 ./state.H.pomodoroPhase → shared.pomodoroMenuAction）；`keepHome` 的即时类动作不关面板。
 *  - 入口顺序 / 显隐：**本页不做任何编辑交互**，统一由「设置 → 首页入口」弹窗打理
 *    （顺序两端各一套 + 隐藏域，存 home.json，见 ./order）；本页只按序渲染可见域。
 *  - 时间线：小橘行为流痕迹 + 规则点评（✦ 域内自算，非 AI 调用）；痕迹**新 → 旧**排
 *    （2026-09-17 用户点名；翻转在 render 层，见 ./layouts/river/render flowHtml）
 *  - 明天预告：复习/剪藏/日记三张规则卡，点击直达
 * markup 单源（ADR-0104）：面板骨架/周历/入口行/河卡/预告卡 HTML 全部出自 ./render
 * （渲染纯层，与原型壳消费同一份）；本文件只剩行为层——生命周期/事件绑定/ESC/命令直达。
 */
import type { IconName } from 'obsidian';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
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
import { motionDaySwitch, motionPanelIn, motionPanelOut, motionRendered } from './motion';
import {
  headDateText, panelFrameHtml, loadingEntriesHtml, loadingFlowHtml, flowFailedHtml,
  weekHtml, entriesHtml, flowHtml, nextHtml, tilesHtml, sheetHeadHtml, menuHeadHtml, type FlowOpts,
} from './render';

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
    skipped: bool(s.homeTimelineSkipped, DEFAULT_TIMELINE_FILTER.skipped),
  };
  // 范围缺省 = week（用户 2026-09-11 拍板：默认能往回翻整周）；老 data.json 无此键时同样落 week
  const range = str(s.homeTimelineRange) ?? 'week';
  // 字号档白名单（ui P3-1）：data-tl-size 进 markup 属性位，非法旧值/手改值一律回落 normal——
  // 域内「插值一律 esc」纪律下这里是唯一属性直插点，白名单在源头收口（渲染层零改）
  const TL_SIZES = ['compact', 'normal', 'loose'];
  const sizeRaw = str(s.homeTimelineSize) ?? 'normal';
  return {
    filter,
    flow: {
      filter,
      showTime: bool(s.homeTimelineTime, true),
      size: TL_SIZES.includes(sizeRaw) ? sizeRaw : 'normal',
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

/* ---------- 滚位记忆（eff P2-2；clipbook 效率#17 样板） ---------- */

/** 两滚动容器：桌面时间线列内部滚（.bz-home-flow）、移动整页滚（.bz-home-body）。
 *  触发面 = 重开（display:none 复用丢滚位）与 renderAll 全量重建（keepHome 动作落地/失败重试），
 *  移动单列时间线沉底（order:1）放大跳顶感——归零即跳过瓦片+预告两段。 */
function saveScroll(overlay: HTMLElement): void {
  const body = overlay.querySelector<HTMLElement>('.bz-home-body');
  const flow = overlay.querySelector<HTMLElement>('.bz-home-flow');
  H.scroll.body = body ? body.scrollTop : 0;
  H.scroll.flow = flow ? flow.scrollTop : 0;
}

/** 写回滚位（仅显示中；隐藏期间写回无效——display:none 的元素 scrollTop 恒 0） */
function restoreScroll(overlay: HTMLElement): void {
  if (!H.overlayVisible) return;
  const body = overlay.querySelector<HTMLElement>('.bz-home-body');
  const flow = overlay.querySelector<HTMLElement>('.bz-home-flow');
  if (body) body.scrollTop = H.scroll.body;
  if (flow) flow.scrollTop = H.scroll.flow;
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
  motionPanelIn(overlay, false); // 动效层：面板壳入场（渲染编排由 renderAll 内的 motionRendered 管）
  // 评审便利：#replay 重播首屏编排（motion.ts 的 hashchange 钩子消费；插件内无害）
  (window as unknown as Record<string, unknown>).__bzHomeReplay = () => {
    motionPanelIn(overlay, false);
    motionRendered(overlay, true);
  };
  // 打开即入焦 + Tab 圈闭（呈报#13 F3+H3 全域范式，core trapPanelFocus 单源）
  trapPanelFocus(overlay);
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

/** 刷新代次（arch A3）：并发刷新（showOverlay 与 keepHome 落地同时发）时晚完成者不得
 *  用旧数据覆盖新数据——发号在采集前、校验在写回前，非最新代次直接作废 */
let refreshSeq = 0;

/** 重新采集活动河数据 + 读入口顺序/番茄钟相位（并发取回，避免多趟闪） */
async function refreshRiverAndRender(): Promise<void> {
  if (!H.currentOverlay || !H.appRef) return;
  const overlay = H.currentOverlay;
  const seq = ++refreshSeq;
  const [river, order, phase] = await Promise.all([
    collectRiver(H.appRef).catch(() => null),
    loadHomeOrder(H.appRef),
    readPomodoroPhase(H.appRef),
  ]);
  // 存活守卫（arch A3）：await 期间面板被卸载（unloadHome → remove + resetHomeState 全字段
  // 归零）或重建（currentOverlay 换新）→ 本次采集作废，不得把脏数据写回已清零的 H
  //（否则同会话禁用→重启用首页会闪现上一会话旧渲染，跨天时头行日期与时间线列错位）
  if (H.currentOverlay !== overlay) return;
  // 代次守卫（arch A3）：晚完成的旧一轮不得覆盖新一轮数据
  if (seq !== refreshSeq) return;
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
 * 滚位（eff P2-2）：display:none 期间 Chromium 丢布局 → scrollTop 归零，隐藏前先存。
 */
export function closeOverlay(): void {
  if (!H.currentOverlay || !H.overlayVisible) return;
  const overlay = H.currentOverlay;
  saveScroll(overlay);
  H.overlayVisible = false;
  // 动效层：先演退场再收 display（重开竞态由 motionPanelOut 的 done 判 H.overlayVisible 兜住）
  motionPanelOut(overlay, () => {
    if (!H.overlayVisible && H.currentOverlay === overlay) overlay.style.display = 'none';
  });
}

/** 重开复用（issue 290）：恢复显示 + 重新发号（谁后显示谁在上）+ 立即动态刷新数据；滚位写回 */
export function showOverlay(): void {
  const overlay = H.currentOverlay;
  if (!overlay || H.overlayVisible) return;
  overlay.style.display = '';
  topifyZ(overlay);
  H.overlayVisible = true;
  restoreScroll(overlay);
  motionPanelIn(overlay, true);
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
    // 周历切天：切换选中格并只重渲时间线（数据已在采集窗口内）。
    // aria-pressed 同步（ui P3-3）：选中态只存在于视觉 class 的话，读屏听不出「当前在看哪天」
    const wk = t.closest('[data-home-weekday]') as HTMLElement | null;
    if (wk && H.river) {
      H.riverView = wk.dataset.homeWeekday || null;
      const overlay2 = H.currentOverlay;
      if (overlay2) {
        overlay2.querySelectorAll('[data-home-weekday]').forEach((b) => {
          const sel = (b as HTMLElement).dataset.homeWeekday === H.riverView;
          b.classList.toggle('bz-home-wk--sel', sel);
          b.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
        const flow = overlay2.querySelector('[data-home-flow]') as HTMLElement | null;
        if (flow) {
          // 切天编排（动效层）：旧河 blur 退场 → 重写（markup 单源不动）→ 新河接力揭出
          motionDaySwitch(flow, () => {
            flow.innerHTML = flowHtml(H.river!, H.riverView ?? '', readHomeSettings().flow);
            mountIcons(flow);
          });
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

/** 直达命令（菜单快捷动作/入口打开共用）：FakeApp 等无 commands 环境降级为通知，不崩。
 *  异步失败不再静默（func P3-2）：命令 Promise reject 时原样 void 丢弃 = 用户面对
 *  「点了没反应」，挂 catch 出人话提示（同步异常走同一文案）。 */
function runCommand(commandId: string, app: any, failText = '该功能暂时不可用'): void {
  try {
    const ret = app.commands.executeCommandById(commandId) as unknown;
    if (ret && typeof (ret as Promise<unknown>).catch === 'function') {
      void (ret as Promise<unknown>).catch(() => notice(failText, 'warning'));
    }
  } catch {
    notice(failText, 'warning');
  }
}

/**
 * 直达命令 + 跑完刷新首页数据（`keepHome` 动作专用）。
 * executeCommandById 返回 Promise（命令可能是异步：先弹确认框再写盘）——等它落地再刷新，
 * 否则会在用户还没确认时就刷新（看不到计数变化），或在写入前读到旧值。
 * 无 commands / 非 Promise 环境（原型壳）就地跳过刷新，不崩。
 * 慢动作即时反馈 + 防重入（eff P3-2）：立即同步/重建索引类网络/全库 IO 落地前面板纹丝不动，
 * 点击瞬间出 busyText 轻提示（文案单源在 DOMAIN_MENU 声明，home 不硬编码域语义）；
 * 在途命令重复点击不再重复发（会话级在途表，落地即清）。
 */
const activeCommands = new Set<string>();

function runCommandAndRefresh(commandId: string, app: any, busyText?: string): void {
  if (activeCommands.has(commandId)) return; // 在途：静默忽略重复点击（反馈已在首击的提示上）
  let ret: unknown;
  try {
    ret = app.commands.executeCommandById(commandId);
  } catch {
    notice('该功能暂时不可用', 'warning');
    return;
  }
  if (busyText) notice(busyText, 'info');
  if (ret && typeof (ret as Promise<unknown>).then === 'function') {
    activeCommands.add(commandId);
    void (ret as Promise<unknown>).then(
      () => {
        activeCommands.delete(commandId);
        return refreshRiverAndRender();
      },
      () => {
        // 失败分支（func P3-2 同刀）：不再静默刷新（用户视角「点了像没点」）
        activeCommands.delete(commandId);
        notice('动作没有执行成功', 'warning');
        return refreshRiverAndRender();
      },
    );
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
 * `settingsDeep` 项（shared 层统一追加的「设置」直达，issues 388）：同「开别域面板」先关
 * 首页，再动态 import 设置面板定位到该域设置页（函数级依赖，同 memo/gameshelf 惯例）。
 */
function attachRowMenu(el: HTMLElement, app: any, river: RiverData): void {
  const d = DOMAIN_MAP.get(el.dataset.homeGo || '');
  if (!d) return;
  const menu = DOMAIN_MENU[d.id];
  if (!menu || !menu.length) return;
  const actions: ItemAction[] = menu.map((a) => {
    // 相位敏感项：静态声明只是 idle 兜底，这里按实时相位整体换掉（见 shared.pomodoroMenuAction）
    const spec = a.dynamic === 'phase' ? { ...a, ...pomodoroMenuAction(H.pomodoroPhase) } : a;
    const deep = spec.settingsDeep;
    return {
      icon: spec.icon as IconName,
      label: spec.label,
      kind: spec.kind === 'danger' ? 'danger' : 'normal',
      onClick: () => {
        if (deep) {
          // 设置直达：关首页再开设置面板（定位该域设置页），避免两层面板叠着
          closeOverlay();
          void import('../settings-panel').then((m) => m.openSettingsPanel(app, deep));
          return;
        }
        if (spec.keepHome) {
          // 即时类：面板留着，动作跑完刷新一次数据（计数/彩点当场归位）；
          // busyText 槽位 = 慢动作（同步/重建索引）点击瞬间的即时反馈（eff P3-2）
          runCommandAndRefresh(spec.commandId, app, spec.busyText);
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

/** 渲染后重挂入口菜单；render 是 innerHTML 重建，元素全新不会重复绑定。
 *  前端门控（eff P3-1）：只挂当前布局可见端的容器——桌面 tiles 整块 display:none、
 *  移动 entries 同，隐藏容器里的行永不可达，照挂菜单+预构建盒头等于白花一半开销。
 *  判据用面板容器宽度（对齐 CSS @container/@media 的 768 断点，桌面窄窗口同切移动布局；
 *  不用 Platform.isMobile——它判平台不判宽度）。宽度 0（未布局/测试环境）保守全挂，
 *  行为与旧版一致。 */
function mountRowInteractions(overlay: HTMLElement, app: any, river: RiverData): void {
  const panel = overlay.querySelector<HTMLElement>('.bz-home-panel');
  const w = panel?.clientWidth ?? 0;
  const narrow = w > 0 && w <= 768;
  if (w === 0 || !narrow) {
    const entries = overlay.querySelector<HTMLElement>('[data-home-entries]');
    if (entries) for (const el of rowEls(entries)) attachRowMenu(el, app, river);
  }
  if (w === 0 || narrow) {
    const tiles = overlay.querySelector<HTMLElement>('[data-home-tiles]');
    if (tiles) for (const el of rowEls(tiles)) attachRowMenu(el, app, river);
  }
}

/* ---------- 渲染（胶水：把单源 markup 灌进骨架数据区） ---------- */

/** 焦点定位键（ui P3-4）：renderAll 全量重建会丢焦点——重建前从 activeElement 提取
 *  委托定位键（入口行/瓦片/预告卡的 data-home-go、周历格的 data-home-weekday），
 *  重建后对等价新元素回焦；找不到（域被隐藏等）即放弃，不抢焦点。 */
function focusKeyOf(el: Element | null): { attr: string; value: string } | null {
  if (!el) return null;
  const go = el.closest('[data-home-go]') as HTMLElement | null;
  if (go) return { attr: 'data-home-go', value: go.dataset.homeGo || '' };
  const wk = el.closest('[data-home-weekday]') as HTMLElement | null;
  if (wk) return { attr: 'data-home-weekday', value: wk.dataset.homeWeekday || '' };
  return null;
}

function renderAll(): void {
  const overlay = H.currentOverlay;
  if (!overlay) return;
  const date = overlay.querySelector('[data-home-date]');
  if (date) date.textContent = headDateText();

  // 全量重建前的双记忆（eff P2-2 / ui P3-4）：滚位 + 焦点——keepHome 动作落地刷新
  // 与失败重试不再把浏览位置/键盘焦点打回面板顶部
  const preGrid = overlay.querySelector('.bz-home-grid');
  saveScroll(overlay);
  const active = document.activeElement as HTMLElement | null;
  const fk = active && overlay.contains(active) ? focusKeyOf(active) : null;

  if (!H.river) {
    // 数据未到：结构占位（骨架），不闪空内容；采集失败（H12）→ 失败空态 + 重试，不再永挂骨架
    // 骨架期也按设置收敛第三栏（预告卡关掉时空列 224px 只闪现到数据到达，同刀收口）
    const { next: nextOn } = readHomeSettings();
    preGrid?.classList.toggle('bz-home-grid--no-next', !nextOn);
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
      // 失败三态（func P3-1）：flow 列同步出失败位（行级文案，避免「正在汇入…」假加载）——
      // 重试入口只在 entries 大卡上挂一个，成功后随 renderAll 两列一并恢复
      flow.innerHTML = flowFailedHtml();
    } else {
      entries.innerHTML = loadingEntriesHtml();
      flow.innerHTML = loadingFlowHtml();
    }
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
  const entries = overlay.querySelector('[data-home-entries]') as HTMLElement;
  const flow = overlay.querySelector('[data-home-flow]') as HTMLElement;
  // 动效层 boot 判定：重写前 flow 还处于「骨架 / 汇入中 / 失败位」= 数据首次到达 → 走首屏编排；
  // 已有渲染的 keepHome 刷新走静默（整屏不闪，对齐 cinema issue 402 的 identity 口径）
  const flowBoot = !!flow.querySelector('.bz-home-sk-line, .bz-home-flow-empty');
  // 周历只画范围窗口内的格子（today 档就一格「今」——范围设置本身在管「能翻到多远」）
  if (week) week.innerHTML = weekHtml(river.week.slice(0, cfg.rangeDays), today, view ?? today);
  const next = overlay.querySelector('[data-home-next]') as HTMLElement;
  entries.innerHTML = entriesHtml(river, H.order.desk, H.order.hiddenDesk);
  flow.innerHTML = flowHtml(river, view ?? today, cfg.flow);
  next.innerHTML = nextHtml(river, cfg.next);
  // 预告卡关掉 → 第三栏整块收掉：桌面 grid 显式三轨道不随空 item 塌缩（display:none 只对
  // 移动 flex 生效），修饰类同步切两列轨道（ui P3-2——原实现注释宣称收掉、实际留 224px 白）
  const nextOff = !cfg.next;
  next.style.display = nextOff ? 'none' : '';
  preGrid?.classList.toggle('bz-home-grid--no-next', nextOff);
  const tiles = overlay.querySelector('[data-home-tiles]') as HTMLElement;
  tiles.innerHTML = tilesHtml(river, H.order.mob, H.order.hiddenMob);
  mountIcons(week);
  mountIcons(entries);
  mountIcons(flow);
  mountIcons(next);
  mountIcons(tiles);
  mountRowInteractions(overlay, H.appRef, river);
  restoreScroll(overlay);
  motionRendered(overlay, flowBoot); // 动效层：首屏编排 / 刷新静默补挂河道
  // 焦点回置（ui P3-4）：等价新元素在场且面板显示中才回焦，找不到不抢
  if (fk && fk.value && H.overlayVisible) {
    const target = overlay.querySelector(`[${fk.attr}="${fk.value}"]`) as HTMLElement | null;
    target?.focus();
  }
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
