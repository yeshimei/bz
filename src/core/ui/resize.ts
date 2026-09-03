/* ============================================================
 * bz 组件库 · 边缘拖动缩放（src/core/ui/resize.ts）
 * ADR-0084：给「flex 居中卡片式主面板」加桌面拖动缩放——
 *   el 不需要 fixed/absolute 定位；拖拽期间写 width/height 内联，
 *   宿主若是 flex 居中容器（.bz-*-overlay 的 align/justify center），
 *   宽高变化即双向对称扩缩，天然不越视口、无跳变。
 * 可拖表面 = 右缘/底缘/右下角热区（SE 扩展，用户拍板）：
 *   零 DOM 手柄、零视觉提示——指针命中热区时光标变 ew/ns/nwse
 *   （功能性几何内联，样式库零新增）；命中检测挂在 el 自身
 *   mousemove/mousedown 上，不注入任何常驻覆盖层，内容交互不受影响。
 * 尺寸钳制：下限 minW×minH；上限逐帧取 min(硬上限 maxW×maxH,
 *   视口 92%)——任何屏幕不越出遮罩可视区，大屏也不会拉出无边面板。
 * 位置：uiResizable 不做持久化；尺寸由调用域经 onChange 落 settings。
 * 注意：移动端（触屏）请勿挂载——本工厂只处理 mouse 指针事件。
 * ============================================================ */

/** 命中热区判定（右缘 / 底缘 / 右下角），单位为 CSS px */
function hitRegion(rect: { width: number; height: number }, x: number, y: number, edge: number): string | null {
  const onE = x >= rect.width - edge;
  const onS = y >= rect.height - edge;
  const onW = x <= edge;
  const onN = y <= edge;
  if (onE && onS) return 'se';
  if (onE && !onW) return 'e';
  if (onS && !onN) return 's';
  return null;
}

export interface BzResizableOpts {
  /** 可拖命中热区宽度 px（默认 8） */
  edge?: number;
  /** 下限宽高（默认 320×240） */
  minW?: number;
  minH?: number;
  /** 硬上限宽高（默认不设 = 仅视口 92% 约束） */
  maxW?: number;
  maxH?: number;
  /** 拖拽结束回调（尺寸已钳制；调方持久化用） */
  onChange?: (w: number, h: number) => void;
}

/** 使元素支持「右缘/底缘/右下角」拖动缩放，返回 detach() */
export function uiResizable(el: HTMLElement, opts: BzResizableOpts = {}): { detach: () => void } {
  const edge = opts.edge ?? 8;
  const minW = opts.minW ?? 320;
  const minH = opts.minH ?? 240;
  const maxW = opts.maxW ?? Number.POSITIVE_INFINITY;
  const maxH = opts.maxH ?? Number.POSITIVE_INFINITY;

  let dir: 'e' | 's' | 'se' | null = null;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;

  /** 当前可用上限（逐帧取 min(硬上限, 视口 92%)） */
  const cap = (isW: boolean) => {
    const view = (isW ? window.innerWidth : window.innerHeight) * 0.92;
    return Math.floor(Math.min(isW ? maxW : maxH, view));
  };

  /** 指针相对 el 的命中方向；非热区返回 null */
  const regionAt = (e: MouseEvent): string | null => {
    const rect = el.getBoundingClientRect();
    return hitRegion(rect, e.clientX - rect.left, e.clientY - rect.top, edge);
  };

  const setCursor = (d: string | null) => {
    el.style.cursor = d === 'e' ? 'ew-resize' : d === 's' ? 'ns-resize' : d === 'se' ? 'nwse-resize' : '';
  };

  /** hover（仅 el 上）：实时 rect 换光标；拖拽中交由 document 移动处理 */
  const onHover = (e: MouseEvent) => {
    if (dragging) return;
    setCursor(regionAt(e));
  };

  /** 拖拽移动（document 上：鼠标移出面板仍持续） */
  const onDragMove = (e: MouseEvent) => {
    if (!dragging) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let w = dir === 'e' || dir === 'se' ? startW + dx : startW;
    let h = dir === 's' || dir === 'se' ? startH + dy : startH;
    w = Math.min(Math.max(w, minW), cap(true));
    h = Math.min(Math.max(h, minH), cap(false));
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    if (opts.onChange) opts.onChange(w, h);
  };

  const onMouseLeave = () => {
    if (!dragging) setCursor(null);
  };

  const onMouseDown = (e: MouseEvent) => {
    const d = regionAt(e);
    if (!d) return;
    e.preventDefault();
    dir = d as 'e' | 's' | 'se';
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = el.getBoundingClientRect().width;
    startH = el.getBoundingClientRect().height;
    // 拖拽期间禁选中（鼠标可能在列表文本上按下）
    document.body.style.userSelect = 'none';
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    dir = null;
    document.body.style.userSelect = '';
    setCursor(null);
  };

  // 命中检测/光标挂在 el 自身（热区外的 mousedown 不拦截，内容交互如常）；
  // 拖拽移动监听挂 document（鼠标移出面板仍持续）
  el.addEventListener('mousemove', onHover);
  el.addEventListener('mouseleave', onMouseLeave);
  el.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onMouseUp);

  return {
    detach: () => {
      el.removeEventListener('mousemove', onHover);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      setCursor(null);
    },
  };
}
