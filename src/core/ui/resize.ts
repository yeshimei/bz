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
 * 尺寸记忆：可选 persist（ADR-0094）——挂载时 load() 有值即恢复；
 *   onChange 防抖 300ms 调 save() 落盘（仿 memo 域 rememberPanelSize trailing
 *   防抖），句柄另有 flush()（立即落盘待存尾值，无待存 no-op；域内「关面板
 *   即落盘」用），detach 时未落盘的尾值也立即 flush 防丢。不传 persist 行为
 *   不变（向后兼容）。
 * 意图尺寸 × 渲染尺寸分离（半屏挤压修复）——旧口径把「视口钳制后的渲染值」
 *   直接内联冻结 + 落盘，Obsidian 半屏下打开/拖拽会把挤压尺寸永久写进
 *   settings，恢复全屏后回不去。现拆两层：
 *   wantW/H（意图值）只钳 min/硬上限、不掺视口——persist 存取全走它；
 *     半屏下拖大，记下的是「用户想要的尺寸」而非被挤压的渲染值。
 *   renderSize()（渲染值）= clamp(意图值, min, 视口 92%) 写内联，挂载恢复
 *     与拖拽中都是意图值在当前视口下的投影。
 *   window resize 跟帧：视口变化即按意图值重新钳制渲染（拖拽中跳过；
 *     宿主离场自摘监听自愈，口径同拖拽监听）——半屏挤压→全屏自动复原。
 *   兼容：旧档存的本就是渲染值，读回当意图值只会更大，硬上限 + 视口 cap
 *     双兜底不越屏；已落盘的挤压小值无法找回，拖一次即重新记忆。
 * 拖拽收尾吞终端 click（issue 222）：mousedown 在面板热区、mouseup 落遮罩时 click
 *   派发公共祖先遮罩 → 「点遮罩关闭」误触发；经 core/dom swallowNextClick 统一防线，
 *   memo/剪藏本/保险库等「缩放热区 × 点遮罩关闭」组合全量受益。
 * 注意：移动端（触屏）请勿挂载——本工厂只处理 mouse 指针事件。
 * ============================================================ */
import { swallowNextClick } from '../dom';

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

/** 尺寸记忆钩子（可选）：load 恢复 / save 防抖落盘（键由调用域自定义） */
export interface BzResizablePersist {
  /** 挂载时读回记忆尺寸（无记忆返回 null） */
  load?(): { w: number; h: number } | null;
  /** 尺寸变化后防抖 300ms 落盘（detach 时未落的尾值立即补调） */
  save?(w: number, h: number): void;
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
  /** 拖拽结束回调（意图尺寸，未按视口钳制；调方持久化用） */
  onChange?: (w: number, h: number) => void;
  /** 尺寸记忆（可选；不传行为不变） */
  persist?: BzResizablePersist;
}

/** 使元素支持「右缘/底缘/右下角」拖动缩放，返回 detach() + flush()。
 *  触屏设备（coarse pointer）不挂载：本实现仅处理 mouse 事件，返回空 detach 空转（L7） */
export function uiResizable(el: HTMLElement, opts: BzResizableOpts = {}): {
  detach: () => void;
  /** 立即落盘待存的防抖尾值（清除计时器；无待存值 no-op；调用后不重复落盘） */
  flush: () => void;
} {
  const isCoarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (isCoarse) {
    // 移动端无需缩放热区（面板自适配全屏）；空操作避免在触屏上误挂鼠标拖拽
    return { flush: () => {}, detach: () => {} };
  }
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

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let wantW = 0;
  let wantH = 0;

  /** 渲染值 = 意图值在当前视口下的投影（clamp(意图, min, 视口 92%)）写内联；
   *  无意图值（未拖过/无记忆）不动，面板走 CSS 默认 + CSS 视口钳制自动跟帧 */
  const renderSize = (): void => {
    if (wantW <= 0 || wantH <= 0) return;
    el.style.width = Math.min(Math.max(wantW, minW), cap(true)) + 'px';
    el.style.height = Math.min(Math.max(wantH, minH), cap(false)) + 'px';
  };

  // 尺寸记忆（可选）：挂载即恢复——记忆值是意图尺寸，只钳 min/硬上限（防旧值/
  // 手改超大值打开即越界），视口挤压留给 renderSize 逐帧钳
  const persist = opts.persist;
  if (persist?.load) {
    const saved = persist.load();
    if (saved && saved.w > 0 && saved.h > 0) {
      wantW = Math.min(Math.max(saved.w, minW), maxW);
      wantH = Math.min(Math.max(saved.h, minH), maxH);
      renderSize();
    }
  }

  /** 视口跟帧：半屏↔全屏切换时按意图值重新钳制渲染（挤压不落盘，全屏即复原）。
   *  宿主离场自摘 window 监听自愈（口径同拖拽监听，防忘 detach 滞留） */
  const onWinResize = () => {
    if (!el.isConnected) {
      window.removeEventListener('resize', onWinResize);
      return;
    }
    if (!dragging) renderSize();
  };
  window.addEventListener('resize', onWinResize);

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
    // C12 同款：宿主离场自摘 document 级监听——detach 契约不变，忘调时下一次
    // 全局事件自愈（原先一对监听随实例永久滞留，面板反复开关持续累积）
    if (!el.isConnected) {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onMouseUp);
      return;
    }
    if (!dragging) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    // 意图值只钳 min/硬上限，逐轴更新（未拖的轴保持既有意图不被拉低）——
    // 半屏下拖大也记下完整意图，不掺视口挤压
    if (dir === 'e' || dir === 'se') wantW = Math.min(Math.max(startW + dx, minW), maxW);
    if (dir === 's' || dir === 'se') wantH = Math.min(Math.max(startH + dy, minH), maxH);
    renderSize();
    if (opts.onChange) opts.onChange(wantW, wantH);
    // 尺寸记忆：trailing 防抖 300ms 落盘一次（拖一次 = 几十次回调，不逐帧写）；
    // 落盘口径 = 意图值（半屏挤压不污染存档）
    if (persist?.save) {
      if (persistTimer !== null) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        persistTimer = null;
        persist.save?.(wantW, wantH);
      }, 300);
    }
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
    const rect = el.getBoundingClientRect();
    startW = rect.width;
    startH = rect.height;
    // 首次拖拽把 CSS 默认渲染尺寸固化为意图基线（renderSize 需两轴意图齐备才写内联，
    // 否则只拖一轴时另一轴无值）。clamp 防默认尺寸越出 min/max 口径
    if (wantW <= 0) wantW = Math.min(Math.max(startW, minW), maxW);
    if (wantH <= 0) wantH = Math.min(Math.max(startH, minH), maxH);
    // 拖拽期间禁选中（鼠标可能在列表文本上按下）
    document.body.style.userSelect = 'none';
  };

  const onMouseUp = () => {
    if (!el.isConnected) {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onMouseUp);
      return;
    }
    if (!dragging) return;
    dragging = false;
    dir = null;
    document.body.style.userSelect = '';
    setCursor(null);
    // 拖拽终端 click 是拖拽残影而非用户点击意图（issue 222：落遮罩会误关窗口），吞掉
    swallowNextClick();
  };

  // 命中检测/光标挂在 el 自身（热区外的 mousedown 不拦截，内容交互如常）；
  // 拖拽移动监听挂 document（鼠标移出面板仍持续）
  el.addEventListener('mousemove', onHover);
  el.addEventListener('mouseleave', onMouseLeave);
  el.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onMouseUp);

  /** 立即落盘待存的防抖尾值（flush 句柄与 detach 收尾共用；无待存值 no-op） */
  const flush = () => {
    if (persistTimer === null) return;
    clearTimeout(persistTimer);
    persistTimer = null;
    if (persist?.save && wantW > 0 && wantH > 0) persist.save(wantW, wantH);
  };

  return {
    flush,
    detach: () => {
      // 未落的防抖尾值立即补存防丢（仿 memo flushPendingSize）
      flush();
      el.removeEventListener('mousemove', onHover);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onWinResize);
      document.body.style.userSelect = '';
      setCursor(null);
    },
  };
}
