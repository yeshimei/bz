/* ============================================================
 * bz 共享层 · 移动端可视视口高度（src/core/viewport.ts）
 *
 * 解决的问题：手机软键盘弹出时，`100vh` **不会收缩**——它等于布局视口高度
 * （含被键盘占据的区域）。所有移动端真全屏面板（.bz-panel-mtop，13 域）都用
 * `height: 100vh` 定高，于是键盘一弹出，面板底部的输入条（memo composer /
 * secondbrain 问答框 / smartcat 聊天框）就被顶到键盘底下，输入时看不见自己
 * 在打什么。
 *
 * `dvh`（dynamic viewport height）能表达「随键盘收缩的视口高度」，但：
 *   1) Obsidian 移动端 WebView 内核版本不齐，`dvh` 不一定可用；
 *   2) `dvh` 只在键盘动画结束后才稳定，有抖动。
 * 故采用「CSS `dvh` 打底 + JS `visualViewport` 精修」的双保险：
 *   - CSS：`.bz-panel-mtop { height: 100dvh }`（components.css），现代内核直接正确；
 *   - JS：本模块把 `visualViewport.height` 写进 `--bz-vvh`，CSS 变量在支持时
 *         覆盖 `dvh`，并额外扣除键盘占去的底部安全区（见 syncMobileViewport）。
 *
 * 触发时机：`visualViewport` 的 `resize`（键盘弹出/收起、旋屏、浏览器地址栏收放）
 * 与 `scroll`（iOS 上键盘弹出只发 scroll 不发 resize）。全站只挂一个 document
 * 级监听（非面板级），面板开关不重复注册。
 *
 * 与 `src/smartcat/interaction.ts` 的关系：那里有一套 UA 判定 + visualViewport
 * 监听，但它服务的是小橘气泡的拖拽定位（把猫抬到键盘上方），与本模块的
 * 「面板高度随键盘收缩」是两个诉求，未强行合并，避免动到小橘的行为单源。
 * ============================================================ */

/** --bz-vvh 在 :root 上的变量名（components.css 的 .bz-panel-mtop 消费） */
export const VVH_VAR = '--bz-vvh';

/** 视口高度夹取下限（px）：低于此值视为内核上报异常，忽略该帧 */
const MIN_VVH = 120;

type Cleanup = () => void;

let cleanup: Cleanup | null = null;

/** 当前是否已接管（测试/调试用） */
export function isViewportBound(): boolean {
  return cleanup !== null;
}

/**
 * 同步一次可视视口高度到 `--bz-vvh`。
 * 未挂载 / 无 visualViewport 时是安全的 no-op（CSS 侧 `100dvh` 兜底）。
 */
export function syncMobileViewport(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  if (!h || h < MIN_VVH) return;
  // 写 px（不写 100vh 之类）：CSS 变量最终要被 calc() 消费，必须带单位且可结算
  document.documentElement.style.setProperty(VVH_VAR, `${Math.round(h)}px`);
}

/**
 * 挂载移动端视口监听（幂等：重复调用只会重挂一次监听，不叠加）。
 * 在 `main.ts` onload 调用一次即可；桌面端调用也无害（内联高度被媒体查询挡在
 * 桌面之外，且 desktop 下 visualViewport 不随软键盘变化）。
 *
 * @returns 解除监听的函数；重复调用时返回同一个解绑器
 */
export function bindMobileViewport(): Cleanup {
  if (cleanup) return cleanup;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    cleanup = () => {};
    return cleanup;
  }

  const vv = window.visualViewport;
  addEventListenerSafe(vv, 'resize', syncMobileViewport);
  addEventListenerSafe(vv, 'scroll', syncMobileViewport);
  // 兜底：个别内核 visualViewport 事件不全，window resize / orientationchange 也同步一次
  window.addEventListener('resize', syncMobileViewport);
  window.addEventListener('orientationchange', syncMobileViewport);
  syncMobileViewport();

  cleanup = () => {
    removeEventListenerSafe(vv, 'resize', syncMobileViewport);
    removeEventListenerSafe(vv, 'scroll', syncMobileViewport);
    window.removeEventListener('resize', syncMobileViewport);
    window.removeEventListener('orientationchange', syncMobileViewport);
    document.documentElement.style.removeProperty(VVH_VAR);
    cleanup = null;
  };
  return cleanup;
}

/** 解绑（unload 时调用；未挂载时 no-op） */
export function unbindMobileViewport(): void {
  cleanup?.();
}

type EventTargetLike = { addEventListener?: (t: string, l: EventListenerOrEventListenerObject) => void } | null | undefined;

function addEventListenerSafe(target: EventTargetLike, type: string, listener: () => void): void {
  target?.addEventListener?.(type, listener as EventListener);
}

function removeEventListenerSafe(target: EventTargetLike, type: string, listener: () => void): void {
  const removable = target as { removeEventListener?: (t: string, l: EventListenerOrEventListenerObject) => void } | null | undefined;
  removable?.removeEventListener?.(type, listener as EventListener);
}
