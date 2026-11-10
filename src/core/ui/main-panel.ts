/* ============================================================
 * bz 组件库 · 主面板标记与定位（src/core/ui/main-panel.ts）
 *
 * 各域「卡片式主界面」的根元素统一挂 .bz-main-panel（HTML 模板里直接写类，
 * 或建节点后 classList.add）。只为两件事服务：
 *   1. 通用全屏命令（core/ui/global-fullscreen）：找出当前最上层的那扇窗口放大；
 *   2. 首页返回总线（core/home-return）：判断「从首页点进来的功能还开着没有」。
 *
 * 约定：只标**主面板根**——二级弹层、报告层、分析特刊不标；番茄钟与桌宠
 * 不是「窗口」语义，也不标（用户 2026-11-10 拍板：全屏只覆盖主面板、去掉番茄钟）。
 * ============================================================ */

/** 主面板标记类（跨域共享，样式库不接管视觉——纯语义标记） */
export const MAIN_PANEL_CLASS = 'bz-main-panel';

/** 元素是否真的显示在屏幕上：离场 / 自身或祖先 display:none / 隐藏 都不算。
 *  不依赖 getClientRects（jsdom 无布局引擎，恒返回空）——沿祖先链看 computed display/visibility，
 *  浏览器里祖先 display:none 同样会反映到 computed 值上，两条路径结论一致。 */
export function isShown(el: HTMLElement | null | undefined): boolean {
  if (!el || !el.isConnected) return false;
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    if (cur.hidden) return false;
    try {
      const cs = getComputedStyle(cur);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    } catch {
      /* 无样式环境（测试）按可见处理 */
    }
    cur = cur.parentElement;
  }
  return true;
}

/** 元素所在层叠层的 z-index：沿祖先链取最大的数值档（面板 z 发在 overlay / 根容器上）。
 *  先读 computed（浏览器会把 `var(--bz-z-overlay,1000)` 这类内联值解成数字），
 *  取不到再回退内联字符串——jsdom 等无样式引擎环境也能给出排序依据。 */
function layerZ(el: HTMLElement): number {
  let z = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    let raw = '';
    try {
      raw = getComputedStyle(cur).zIndex;
    } catch {
      /* 无样式环境 */
    }
    if (!raw || raw === 'auto') raw = cur.style?.zIndex || '';
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > z) z = n;
    cur = cur.parentElement;
  }
  return z;
}

/** 当前可见主面板（按「所在层 z → DOM 顺序」从低到高；DOM 顺序兜住同层叠放） */
export function visibleMainPanels(): HTMLElement[] {
  if (typeof document === 'undefined') return [];
  const list = Array.from(document.querySelectorAll<HTMLElement>('.' + MAIN_PANEL_CLASS)).filter(isShown);
  return list
    .map((el, i) => ({ el, i, z: layerZ(el) }))
    .sort((a, b) => (a.z - b.z) || (a.i - b.i))
    .map((x) => x.el);
}

/** 最上层可见主面板（通用全屏的作用对象）；没有返回 null */
export function topMainPanel(): HTMLElement | null {
  const list = visibleMainPanels();
  return list.length ? list[list.length - 1] : null;
}
