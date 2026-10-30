/* ============================================================
 * 遮罩点击关闭 · 防误触（src/core/mask-dismiss.ts）
 *
 * 背景：弹窗内容嵌在遮罩内部（`mask.appendChild(popup)` 或 `mask.innerHTML = 面板`），
 * 而 click 事件的 target 是 mousedown 与 mouseup 两点的**最近公共祖先**。于是
 * 「在弹窗里选字，鼠标划到遮罩上松手」「在遮罩上误按，滑回弹窗松手」这两种手势
 * 产生的 click 都落在遮罩本体上，与「明确点遮罩空白」无法区分——旧判法
 * `if (e.target === mask) close()` 全部误关。popup 限高 82vh、内部可滚动，
 * 把手滑出去再松手也走同一条路径。
 *
 * 判据（四条全中才关）：
 *   1) mousedown/touchstart 的 target 是遮罩本体（起点不在弹窗内任何节点）；
 *   2) 本次手势位移未超过 MASK_DISMISS_SLOP（轨迹累计，非首尾净位移——
 *      「拖出去再拖回来松手」净位移可能为 0，只比首尾点根本挡不住）；
 *   3) click 的 target 仍是遮罩本体；
 *   4) 关闭时机取 click，不在 mouseup 里关：提前摘遮罩后浏览器仍会往当前顶层
 *      （body）派发一个 click，全仓有文档捕获层的 click 监听（item-actions 的
 *      外部点击关闭 / 残余 click 抑制），会被当成一次真实外部点击再关一层浮层。
 *
 * 为什么不用 getSelection() 判定：看着更贴题，实际反噬——用户在弹窗里选了一段字、
 * 选区还留着，接着点遮罩想关，pointerdown 通常才折叠选区；一旦没折叠（控件
 * preventDefault 了 mousedown），就变成「点了不关」。位移判据已覆盖选字场景。
 *
 * 三态 armed：
 *   true  = 按下在遮罩上（候选关闭）
 *   false = 按下在遮罩内的内容上（拦）
 *   null  = 本组件没收到按下（合成事件 / 测试直接派发 click）→ 回退旧判法
 * 留 null 这一档是为了让「只 dispatch 一次 click」的既有测试继续成立；真实手势
 * 必然先有 mousedown，走不到这一支。
 *
 * 事件用 mousedown/mouseup 系列而非 Pointer 事件：jsdom 未实现 PointerEvent，
 * 用 pointer* 会让测试里模拟手势直接崩；且与 item-actions 的长按手势同一套口径。
 * 按下与移动都走捕获阶段——弹窗内任何 stopPropagation 都拦不住记录，
 * 否则会静默退化成「记录不到起点 → 误关」。
 * ============================================================ */

/** 手势位移容差（px）：超过即判为拖拽，本次 click 不作关闭依据 */
export const MASK_DISMISS_SLOP = 8;

/** 已挂过的遮罩 → 它的解绑函数。同一元素重复调用直接复用，不再叠一套监听
 *  （一次点击关两层浮层的老事故）。WeakMap 不持有元素，遮罩被移除后自然释放。 */
const unbinders = new WeakMap<HTMLElement, () => void>();

/** 绑定「点遮罩关闭」。返回解绑函数（同一元素反复挂载时才需要；一次性 DOM 可不管）。
 *  **幂等**：同一个遮罩元素重复调用不会重复绑定，第二次返回的是同一个解绑函数。
 *  （调用方约 50 处，绝大多数新建遮罩用完即弃、随手丢弃返回值——靠「只绑一次」的约定不安全。） */
export function bindMaskDismiss(mask: HTMLElement, onDismiss: () => void): () => void {
  const existing = unbinders.get(mask);
  if (existing) return existing;
  let armed: boolean | null = null;
  let dragged = false;
  /** 抬起落点是否也在遮罩本体：按下在遮罩空白、松手滑进弹窗本体的边界情况靠它拦 */
  let upOnMask = false;
  let downX = 0;
  let downY = 0;

  const pointOf = (e: Event): { x: number; y: number } | null => {
    if (typeof TouchEvent !== 'undefined' && e instanceof TouchEvent) {
      const t = e.changedTouches[0] ?? e.touches[0];
      return t ? { x: t.clientX, y: t.clientY } : null;
    }
    const m = e as MouseEvent;
    if (typeof m.clientX !== 'number' || typeof m.clientY !== 'number') return null;
    return { x: m.clientX, y: m.clientY };
  };

  const onDown = (e: Event): void => {
    const m = e as MouseEvent;
    // 只认主键：右键不派发 click，中键走 auxclick——都不该改动候选状态
    if (typeof m.button === 'number' && m.button !== 0) {
      armed = null;
      return;
    }
    armed = e.target === mask;
    dragged = false;
    upOnMask = false;
    const p = pointOf(e);
    if (p) {
      downX = p.x;
      downY = p.y;
    }
  };

  const onUp = (e: Event): void => {
    upOnMask = e.target === mask;
  };

  /** 轨迹累计：一旦离开起点超过容差就锁定为拖拽态（不再回退），直到下一次按下 */
  const onMove = (e: Event): void => {
    if (armed !== true || dragged) return;
    const p = pointOf(e);
    if (!p) return;
    if (Math.abs(p.x - downX) > MASK_DISMISS_SLOP || Math.abs(p.y - downY) > MASK_DISMISS_SLOP) dragged = true;
  };

  /** 触屏手势被系统接管（长按选择 / 弹出手势菜单）：不补发 click 是常态，
   *  万一补发了也按「非点击」处理——置 false 而不是 null，避免落进宽松分支 */
  const onCancel = (): void => {
    armed = false;
    dragged = true;
  };

  const onClick = (e: MouseEvent): void => {
    const wasArmed = armed;
    const wasDragged = dragged;
    const wasUpOnMask = upOnMask;
    armed = null; // 每次 click 消费完即复位，防上一次手势的残留影响下一次
    dragged = false;
    upOnMask = false;
    if (wasArmed === false) return; // 起点在弹窗内（选字拖出 / 误按遮罩滑回）
    if (wasArmed === true && (wasDragged || !wasUpOnMask)) return; // 拖过，或落点滑进了弹窗
    if (e.target === mask) onDismiss();
  };

  mask.addEventListener('mousedown', onDown, true);
  mask.addEventListener('mouseup', onUp, true);
  mask.addEventListener('mousemove', onMove, true);
  mask.addEventListener('touchstart', onDown, { capture: true, passive: true });
  mask.addEventListener('touchend', onUp, { capture: true, passive: true });
  mask.addEventListener('touchmove', onMove, { capture: true, passive: true });
  mask.addEventListener('touchcancel', onCancel, true);
  mask.addEventListener('click', onClick);

  // 先登记再挂监听：登记表里没有它，重复调用就会再挂一套
  const unbind = (): void => {
    mask.removeEventListener('mousedown', onDown, true);
    mask.removeEventListener('mouseup', onUp, true);
    mask.removeEventListener('mousemove', onMove, true);
    mask.removeEventListener('touchstart', onDown, true);
    mask.removeEventListener('touchend', onUp, true);
    mask.removeEventListener('touchmove', onMove, true);
    mask.removeEventListener('touchcancel', onCancel, true);
    mask.removeEventListener('click', onClick);
    unbinders.delete(mask);
  };
  unbinders.set(mask, unbind);
  return unbind;
}
