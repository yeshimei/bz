/**
 * 触屏翻幕手势（软横屏分析层的配套，2026-09-24 真机反馈）：
 * 触屏没有 wheel——引擎只认滚轮时手机上滑翻不动页；而旋转层的原生滚向
 * 又与视觉错 90°，放任原生滚动只会乱滚。所以手势区整体接管：
 * 一滑一幕（阈值即翻、一次触按只翻一幕，同滚轮 GESTURE_GAP 的口径），
 * 纵向优先、横向也认——横屏握持时左右滑更顺手；
 * touchmove 一律 preventDefault 压掉原生滚动与下拉刷新，点按不受影响。
 * 方向按**视觉**位移判定（浏览器已把触点逆映射回视觉），引擎翻幕用逻辑 scrollTop，
 * 两边不必互相换算。返回解绑函数（引擎 stop 时摘）。
 */
export function bindSwipeTurn(el: HTMLElement, go: (dir: 1 | -1) => void): () => void {
  const TH = 46; // 翻幕触发阈值（px）：短过它算点按/轻抚，不翻页
  let x0 = 0, y0 = 0, on = false, fired = false;
  const start = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (!t) return;
    x0 = t.clientX; y0 = t.clientY; on = true; fired = false;
  };
  const move = (e: TouchEvent): void => {
    if (!on) return;
    e.preventDefault();
    if (fired) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
    fired = true;
    go(Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 1 : -1) : (dx < 0 ? 1 : -1));
  };
  const end = (): void => { on = false; };
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchmove', move, { passive: false });
  el.addEventListener('touchend', end, { passive: true });
  el.addEventListener('touchcancel', end, { passive: true });
  return (): void => {
    el.removeEventListener('touchstart', start);
    el.removeEventListener('touchmove', move);
    el.removeEventListener('touchend', end);
    el.removeEventListener('touchcancel', end);
  };
}
