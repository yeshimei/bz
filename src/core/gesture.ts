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

/**
 * 往上找第一个「真的还能滚」的祖先（溢出可滚 + 内容超出）：命中了就把滚动让给原生。
 *
 * 起跳点 = 事件目标本身，但**不认死它必须是 HTMLElement**：滚轮常压在 `<svg>` 上
 * （图标、印环、图标化的字符），SVGElement 不是 HTMLElement——早先那一版 `instanceof HTMLElement ? node : null`
 * 会当场落空，本该让给原生的块（详情正文 / 数据源列表）被误判成「没有可滚块」而翻摊。
 * 改法：碰到非 HTMLElement 只跳过它、**继续往上走**（svg 的 parentElement 就是那个块）。
 */
function scrollHostOf(node: EventTarget | null): HTMLElement | null {
  for (let n: Element | null = node instanceof Element ? node : null; n && n !== document.body; n = n.parentElement) {
    if (!(n instanceof HTMLElement)) continue;
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

/** 那块还能朝这个方向滚吗（到边了 = 让出来翻页——与原生滚动链同一手感） */
function canScroll(box: HTMLElement, dy: number): boolean {
  return dy > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 1;
}

/**
 * 鼠标滚轮翻页（issue 507：桌面端也认滚轮）——与 {@link bindSwipeTurn} 同一口径：
 * **累积到位即翻、一次只翻一幕**。不同处有两条硬规则：
 *  ① 点里若有真能滚的块（详情正文 / 数据源列表），朝那个方向还能滚时**一律让给原生**
 *     （滚到边了才轮到翻页：滚到底继续滚 = 够到下一页，和翻书一个手感）；
 *  ② 换向立即归零（来回蹭不误翻），翻完进冷却（掀纸动画那么长里不再触发）。
 * 需要 preventDefault，所以必须非 passive 监听。返回解绑函数。
 */
export function bindWheelTurn(el: HTMLElement, go: (dir: 1 | -1) => void, opts: { gap?: number; lock?: number } = {}): () => void {
  const TH = opts.gap ?? 60; // 累积位移阈值（px）：短过它算手抖，不翻页
  const LOCK = opts.lock ?? 620; // 翻一幕之后的冷却（掀纸 0.9s 的大半）
  let acc = 0;
  let last = 0;
  let locked = false;
  const onWheel = (e: WheelEvent): void => {
    const host = scrollHostOf(e.target);
    if (host && canScroll(host, e.deltaY)) return; // 先让原生滚完
    e.preventDefault();
    const now = Date.now();
    if (locked) {
      if (now - last < LOCK) { acc = 0; return; }
      locked = false;
    }
    if (acc !== 0 && Math.sign(acc) !== Math.sign(e.deltaY)) acc = 0; // 换向归零
    acc += e.deltaY;
    if (Math.abs(acc) < TH) return;
    go(acc > 0 ? 1 : -1);
    acc = 0;
    locked = true;
    last = now;
  };
  el.addEventListener('wheel', onWheel, { passive: false });
  return (): void => el.removeEventListener('wheel', onWheel);
}
