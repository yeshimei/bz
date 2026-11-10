/* ============================================================
 * bz 共享层 · 从首页进入、关闭后回首页（src/core/home-return.ts）
 *
 * 设置开关：首页 → 行为 → 「关闭后回到首页」（默认关，2026-11-10 用户拍板，
 * 承接 GitHub issue #2 的补充答复）。语义：
 *   - 从首页点进某个功能（磁贴 / 右键菜单动作），功能关掉后首页重新出现；
 *   - 直接打开功能（命令面板 / 快捷键 / ribbon）不经过首页，关闭时不回首页。
 *
 * 为什么由 core 观察而不是逐域上报：各域面板的关闭出口五花八门（点遮罩 / ESC /
 * 按钮 / 二级页返回），逐一接一行容易漏。主面板都挂了 .bz-main-panel 标记
 * （core/ui/main-panel），这里盯主面板的显隐变化——某次会话里出现过的
 * 「新的主面板」全部不可见了，就认为功能闭合；弹窗走 notifyFloatClosed
 * （core/ui/modal 与 core/dom 的 createOverlay 关闭时调）。
 *
 * 三条收口信号，缺一不可：
 *   1. 主面板显隐（观察器）；
 *   2. 弹窗关闭（notifyFloatClosed）；
 *   3. 动作执行完却没开出任何窗口（notifyActionDone，home 域在命令落地后调）。
 * 观察器只在 armed 期间在岗，armed 由这三条信号或用户主动下膛结束——**不再设
 * 「多久没闭合就放弃」的超时**：功能面板开着看一小时也是正常会话，按时间放弃
 * 会让人关掉功能后首页不回来（2026-11-10 发版 review #1）。
 *
 * 观察范围（大库开销，发版 review #7）：节点增删仍盯 body 全子树（面板可能挂在
 * 深层容器），但 style/class 变化只盯 body 的直接子节点——各域面板与浮层都是
 * body 直接挂的 overlay，改 display/class 关窗就发生在这一层；编辑器内部那些
 * 高频样式变化不再惊动返回总线，纯属性回调也不再做那趟全 DOM 扫描。
 *
 * 首页怎么打开由调用方注入（open 回调），core 不反向依赖 home 域。
 * ============================================================ */
import { isShown, visibleMainPanels } from './ui/main-panel';

type OpenHome = () => void;

let armed = false;
let sawPanel = false;
let openHome: OpenHome | null = null;
/** arm 时已在场的主面板（正常为空；有的话也不算「本次新开的」） */
let baseline: Set<HTMLElement> = new Set();
/** arm 时已在场的 body 直接子节点（用来判「这次动作有没有开出窗口」） */
let baselineTop: Set<Element> = new Set();

let observer: MutationObserver | null = null;
let checkTimer: ReturnType<typeof setTimeout> | null = null;
let returnTimer: ReturnType<typeof setTimeout> | null = null;

/** 闭合后的合并等待：同一拍（0ms 宏任务）内让「关一个、马上开下一个」的跳转先落地，
 *  用户感知为零延迟；不做几帧级等待——实测 150ms 会被肉眼读成「卡一下」 */
const RETURN_DELAY_MS = 0;
/** 观察回调的合并延迟（同拍） */
const CHECK_DELAY_MS = 0;

function clearTimers(): void {
  if (checkTimer) { clearTimeout(checkTimer); checkTimer = null; }
  if (returnTimer) { clearTimeout(returnTimer); returnTimer = null; }
}

function stop(): void {
  armed = false;
  clearTimers();
  observer?.disconnect();
  observer = null;
  openHome = null;
  baseline = new Set();
  baselineTop = new Set();
  sawPanel = false;
}

/** 本次会话里新出现（相对 arm 时）的主面板，且当前可见 */
function freshPanels(): HTMLElement[] {
  return visibleMainPanels().filter((el) => !baseline.has(el));
}

/** 本次会话新挂到 body 上、且仍可见的 bz 窗口层（面板壳 / 遮罩 / 弹窗卡）。
 *  通知容器只有 id 没有 bz- 类名，不会被当成窗口。 */
function freshTopLayers(): Element[] {
  if (typeof document === 'undefined') return [];
  return Array.from(document.body.children).filter(
    (el) => !baselineTop.has(el) && /bz-/.test(String(el.className || '')) && isShown(el as HTMLElement),
  );
}

/** 给顶层节点补挂「显隐观察」——收窄后的 attributes 只覆盖这一层 */
function watchTopLayer(el: Element): void {
  observer?.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
}

function fire(): void {
  if (!armed) return;
  const cb = openHome;
  stop();
  cb?.();
}

/** 回首页前的最后一道检查：主面板真没了才回（防「关一个开下一个」误回） */
function scheduleReturn(): void {
  if (!armed || returnTimer) return;
  returnTimer = setTimeout(() => {
    returnTimer = null;
    if (!armed) return;
    if (freshPanels().length) return; // 又开了新的主面板：继续等它关闭
    fire();
  }, RETURN_DELAY_MS);
}

/** body 变化 → 先立刻记下「本次开过主面板」，再评估是否已经闭合。
 *  「出现」必须即时标记：面板可能开得很短（点开又马上关），只靠下一拍快照会看漏。 */
function onMutation(records: MutationRecord[]): void {
  if (!armed) return;
  let added = false;
  for (const r of records) {
    if (r.type !== 'childList' || !r.addedNodes.length) continue;
    added = true;
    for (const n of Array.from(r.addedNodes)) {
      if (n instanceof Element && n.parentElement === document.body) watchTopLayer(n);
    }
  }
  // 纯属性变化（编辑器里最高频）跳过这一趟全 DOM 扫描，交给同拍合并的 evaluate
  if (added && freshPanels().length) sawPanel = true;
  scheduleCheck();
}

/** 评估：主面板确实都不可见了才进入「回首页」合并等待 */
function evaluate(): void {
  if (!armed) return;
  if (freshPanels().length) {
    sawPanel = true;
    return;
  }
  // 没出现过主面板 = 本次可能是弹窗动作：不因 DOM 杂音回首页，等 notifyFloatClosed
  if (!sawPanel) return;
  scheduleReturn();
}

function scheduleCheck(): void {
  if (!armed || checkTimer) return;
  checkTimer = setTimeout(() => {
    checkTimer = null;
    evaluate();
  }, CHECK_DELAY_MS);
}

/**
 * 上膛：从首页进入功能前调用（首页随即关闭）。openHome 是「确保首页可见」的
 * 回调（不是 toggle——回首页时首页若已显示不能又关掉）。重复调用按新的一次算。
 */
export function armHomeReturn(open: OpenHome): void {
  stop();
  armed = true;
  openHome = open;
  baseline = new Set(visibleMainPanels());
  baselineTop = new Set(typeof document === 'undefined' ? [] : Array.from(document.body.children));
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    observer = new MutationObserver(onMutation);
    // 节点增删：全子树（面板可能挂在深层容器）；显隐/类名：只盯 body 直接子节点这一层
    observer.observe(document.body, { childList: true, subtree: true });
    for (const el of Array.from(document.body.children)) watchTopLayer(el);
  }
}

/** 下膛：功能重新打开别的入口 / 用户自己关掉了首页等场景，不再回 */
export function disarmHomeReturn(): void {
  if (armed) stop();
}

/**
 * 弹窗类浮层关闭通知（core/ui/modal 与 core/dom 的 createOverlay 调）。
 * 主面板还开着时（面板内的表单弹窗）什么都不做；本次只开了弹窗的会话，
 * 这里就是「功能闭合」的信号。
 */
export function notifyFloatClosed(): void {
  if (!armed) return;
  setTimeout(() => {
    if (!armed) return;
    if (freshPanels().length) return;
    scheduleReturn();
  }, 80);
}

/**
 * 动作执行完的收口（home 域在命令落地后调）：有些菜单动作只复制一段文本、
 * 发一条通知，压根不开窗口，永远不会有人来报「关闭」。一拍后看一眼——
 * 既没开出新的主面板、也没有新挂出来的浮层，就当这次功能已经闭合。
 */
export function notifyActionDone(): void {
  if (!armed) return;
  setTimeout(() => {
    if (!armed) return;
    if (freshPanels().length || freshTopLayers().length) return;
    scheduleReturn();
  }, 0);
}

/** 当前是否上膛（测试与域内调试用） */
export function isHomeReturnArmed(): boolean {
  return armed;
}
