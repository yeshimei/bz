/* ============================================================
 * bz 组件库 · 竖向分割线拖拽（src/core/ui/splitter.ts）
 * issue 222：多栏面板的栏间可拖分割线——拖动改左栏定宽
 *   （left.style.width，契约：左栏须为 width 驱动的定宽布局），
 *   右栏弹性吸收剩余空间。
 * 触屏（coarse pointer）不挂载：返回空转句柄 + 隐藏样式（.bz-vsplit
 *   的 pointer:coarse 媒体查询兜底），移动端布局不受影响。
 * 拖拽收尾吞终端 click（issue 222 同 uiResizable）：mouseup 落列表行/
 *   遮罩时 click 派发公共祖先，误触发行点击/点遮罩关闭。
 * 尺寸记忆：可选 persist——restore() 由宿主在面板可见后调用
 *   （display:none 容器 clientWidth=0 无法钳制，挂载时机不可靠），
 *   拖动后防抖 300ms save() 落盘；flush() 立即落尾值；detach 未落尾值
 *   立即补存（口径同 uiResizable / ADR-0094）。
 * ============================================================ */
import { swallowNextClick } from '../dom';

/** 尺寸记忆钩子（可选）：load 恢复左栏宽 / save 防抖落盘（键由调用域自定义） */
export interface BzVSplitterPersist {
  /** restore() 时读回记忆宽度（无记忆返回 null） */
  load?(): number | null;
  /** 宽度变化后防抖 300ms 落盘（detach 时未落的尾值立即补调） */
  save?(w: number): void;
}

export interface BzVSplitterOpts {
  /** 左栏（拖动时改写 width 的定宽面板） */
  left: HTMLElement;
  /** 右栏（弹性吸收剩余空间，仅用于钳制下限） */
  right: HTMLElement;
  /** 左栏最小宽 px（默认 220） */
  minLeft?: number;
  /** 右栏最小宽 px（默认 320） */
  minRight?: number;
  /** 拖拽结束回调（宽度已钳制；调方即时布局联动用） */
  onChange?: (w: number) => void;
  /** 尺寸记忆（可选；不传行为不变） */
  persist?: BzVSplitterPersist;
}

/** 创建竖向分割线（返回 el 由调用方插入两栏之间），返回 { el, restore, flush, detach } */
export function uiVSplitter(opts: BzVSplitterOpts): {
  el: HTMLElement;
  /** 面板可见后调用：读回记忆宽度并钳制应用（幂等；无记忆/容器零宽 no-op） */
  restore: () => void;
  /** 立即落盘待存的防抖尾值（清除计时器；无待存值 no-op） */
  flush: () => void;
  detach: () => void;
} {
  const left = opts.left;
  const minLeft = opts.minLeft ?? 220;
  const minRight = opts.minRight ?? 320;
  const persist = opts.persist;

  const el = document.createElement('div');
  el.className = 'bz-vsplit';
  el.setAttribute('role', 'separator');
  el.setAttribute('aria-orientation', 'vertical');
  el.title = '拖动调整两侧宽度';

  const isCoarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (isCoarse) {
    // 触屏无栏宽拖拽（媒体查询同时 display:none）；空转句柄保持调用方代码路径统一
    return { el, restore: () => {}, flush: () => {}, detach: () => {} };
  }

  let dragging = false;
  let startX = 0;
  let startW = 0;

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let lastW = 0;
  let restored = false;

  /** 当前容器可用宽度（分条自身占位扣除）；容器未就位返回 0 */
  const availW = (): number => {
    const parent = left.parentElement;
    if (!parent) return 0;
    return parent.clientWidth - el.offsetWidth;
  };

  /** 钳制：[minLeft, 容器 - minRight]；容器未就位（0）时只兜下限 */
  const clampW = (w: number): number => {
    const avail = availW();
    const max = avail > 0 ? avail - minRight : Number.POSITIVE_INFINITY;
    return Math.min(Math.max(w, minLeft), Math.max(minLeft, max));
  };

  const applyW = (w: number): void => {
    left.style.width = w + 'px';
  };

  const debSave = (w: number): void => {
    if (!persist?.save) return;
    lastW = w;
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persist.save?.(w);
    }, 300);
  };

  /** 面板可见后调用：读回记忆宽度并钳制应用（幂等） */
  const restore = (): void => {
    if (restored || !persist?.load || !el.isConnected) return;
    if (availW() <= 0) return; // 容器不可见（display:none）不钳制不应用
    const saved = persist.load();
    restored = true;
    if (saved != null && saved > 0) {
      const w = clampW(saved);
      applyW(w);
      lastW = w;
    }
  };

  const onDragMove = (e: MouseEvent): void => {
    if (!dragging) return;
    e.preventDefault();
    const w = clampW(startW + (e.clientX - startX));
    if (w === lastW) return;
    applyW(w);
    lastW = w;
    if (opts.onChange) opts.onChange(w);
    debSave(w);
  };

  const onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    startW = left.getBoundingClientRect().width;
    el.classList.add('is-drag');
    // 拖拽期间禁选中（鼠标可能压在列表文本上）
    document.body.style.userSelect = 'none';
  };

  const onMouseUp = (): void => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-drag');
    document.body.style.userSelect = '';
    // 终端 click 是拖拽残影（落 rail 行/条目卡会误触行点击），吞掉
    swallowNextClick();
  };

  document.addEventListener('mousemove', onDragMove);
  el.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);

  const flush = (): void => {
    if (persistTimer === null) return;
    clearTimeout(persistTimer);
    persistTimer = null;
    if (persist?.save && lastW > 0) persist.save(lastW);
  };

  return {
    el,
    restore,
    flush,
    detach: () => {
      flush();
      document.removeEventListener('mousemove', onDragMove);
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      el.classList.remove('is-drag');
    },
  };
}
