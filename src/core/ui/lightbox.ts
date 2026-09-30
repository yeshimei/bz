/* ============================================================
 * bz 媒体灯箱（src/core/ui/lightbox.ts）
 * 在样式 .bz-lightbox（components.css）上提供全屏看图/视频。
 * 单例：同一时刻只开一个；Esc / 点背景 / ✕ 关闭。
 * 对齐 core 既有：escManager + z-order（详见下方 import）。
 * 多图模式（可选）：给 items + index 即启用 ←→ 翻图导航
 * （键位与两侧箭头翻页；首末位箭头禁用，不循环——边界一眼可见）。
 * 只传 src 的旧调用方零改动、行为不变。
 * ============================================================ */
import { uiIcon } from './icon';
import { escManager } from '../esc-manager';
import { allocZ } from '../z-order';

/** 多图模式的一张（单图模式即长度 1 的特例） */
export interface BzLightboxItem {
  src: string;              // 媒体地址（img / video / audio）
  type?: 'image' | 'video' | 'audio';
  title?: string;           // 头部说明（逐张可变）
  caption?: string;         // 底部说明（逐张可变）
}

export interface BzLightboxOpts {
  /** 单图模式的媒体地址（旧调用方口径；给了 items 时作为首帧缺省） */
  src?: string;
  type?: 'image' | 'video' | 'audio';
  title?: string;           // 底部/头部说明
  caption?: string;
  /** 多图组：给了（且长度 > 0）即按多图模式打开，src / type / title / caption 作为首帧缺省 */
  items?: BzLightboxItem[];
  /** 起始张（0 基，越界收敛到首/末张）；仅多图模式有意义 */
  index?: number;
}

let current: HTMLDivElement | null = null;
/** 当前灯箱的 esc 层句柄（C9）：提为模块级，closeLightbox 直关时一并注销——
 *  原先仅 openLightbox 内部 close 能注销，导出的 closeLightbox() 绕过它，esc 层残留栈底 */
let currentEscHandle: ReturnType<typeof escManager.register> | null = null;
/** 当前灯箱的 ←→ 翻图键监听退订（多图模式才有；关灯箱一并摘） */
let offNavKeys: (() => void) | null = null;

/** 灯箱打开期间锁定 body 滚动（背景内容随滚轮/触摸穿透防护）；关闭时还原 */
function lockBodyScroll(lock: boolean): void {
  const body = document.body;
  if (lock) {
    body.dataset.bzLightboxScroll = body.style.overflow || '';
    body.style.overflow = 'hidden';
  } else if (body.dataset.bzLightboxScroll !== undefined) {
    body.style.overflow = body.dataset.bzLightboxScroll === '' ? '' : body.dataset.bzLightboxScroll;
    delete body.dataset.bzLightboxScroll;
  }
}

function detachNavKeys(): void {
  offNavKeys?.();
  offNavKeys = null;
}

export function openLightbox(opts: BzLightboxOpts): { close: () => void } {
  closeLightbox(); // 单例，先关旧的

  // 多图组：没给 items 就按单张组装（旧调用方口径）
  const items: BzLightboxItem[] = opts.items?.length
    ? opts.items
    : [{ src: opts.src ?? '', type: opts.type, title: opts.title, caption: opts.caption }];
  const multi = items.length > 1;
  let idx = Math.max(0, Math.min(opts.index ?? 0, items.length - 1));

  const mask = document.createElement('div');
  mask.className = 'bz-lightbox';
  // 动态发号（ADR-0067）：与 modal/overlay 共用分配器，避免固定 900 被弹窗压住的层级问题
  mask.style.zIndex = String(allocZ());

  // 头部（标题 + 关闭）
  const head = document.createElement('div');
  head.className = 'bz-lightbox-head';
  const title = document.createElement('span');
  title.className = 'bz-lightbox-title';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bz-lightbox-close';
  closeBtn.setAttribute('aria-label', '关闭');
  closeBtn.appendChild(uiIcon('x'));
  head.appendChild(title);
  head.appendChild(closeBtn);

  // 媒体主体容器（多图模式翻页只换这一块的子节点，遮罩/箭头不重建）
  const mediaBox = document.createElement('div');
  /** 组一帧媒体节点（类型判定剥掉查询串/锚点再看后缀（N7 潜在缺陷）：Obsidian
   *  vault.getResourcePath 产出 `app://…?path=…` 形态 URL，带着 ? 判后缀永远落不中 →
   *  视频被当图片塞进 <img>。无后缀兜底维持现状（显式 type 优先，audio 本就无后缀判定）。 */
  function mediaNode(item: BzLightboxItem): HTMLElement {
    const media = document.createElement('div');
    media.className = 'bz-lightbox-media';
    const bareSrc = item.src.split('?')[0].split('#')[0];
    const type = item.type || (bareSrc.endsWith('.mp4') || bareSrc.endsWith('.webm') ? 'video' : 'image');
    if (type === 'video') {
      const v = document.createElement('video');
      v.src = item.src;
      v.controls = true;
      v.autoplay = true;
      media.appendChild(v);
    } else if (type === 'audio') {
      const a = document.createElement('audio');
      a.src = item.src;
      a.controls = true;
      a.autoplay = true;
      media.appendChild(a);
    } else {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.title || opts.title || '';
      media.appendChild(img);
    }
    return media;
  }

  // 底部说明
  const foot = document.createElement('div');
  foot.className = 'bz-lightbox-foot';

  /** 摆出第 i 张：媒体 / 标题 / 底部说明原位换内容，首末位箭头禁用（不循环，边界一眼可见） */
  function show(i: number): void {
    idx = Math.max(0, Math.min(i, items.length - 1));
    const it = items[idx];
    mediaBox.replaceChildren(mediaNode(it));
    title.textContent = it.title ?? opts.title ?? ''; // 逐张标题优先，缺省回落打开时的 title（如「留影」）
    foot.textContent = it.caption ?? '';
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= items.length - 1;
  }

  // 翻图箭头（仅多图模式出现）
  let prevBtn: HTMLButtonElement | null = null;
  let nextBtn: HTMLButtonElement | null = null;
  if (multi) {
    prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'bz-lightbox-nav bz-lightbox-prev';
    prevBtn.setAttribute('aria-label', '上一张');
    prevBtn.appendChild(uiIcon('chevron-left'));
    nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'bz-lightbox-nav bz-lightbox-next';
    nextBtn.setAttribute('aria-label', '下一张');
    nextBtn.appendChild(uiIcon('chevron-right'));
    prevBtn.addEventListener('click', () => show(idx - 1));
    nextBtn.addEventListener('click', () => show(idx + 1));
    mask.appendChild(prevBtn);
    mask.appendChild(nextBtn);
  }

  mask.appendChild(head);
  mask.appendChild(mediaBox);
  mask.appendChild(foot);
  document.body.appendChild(mask);
  lockBodyScroll(true);
  show(idx);

  let escHandle: ReturnType<typeof escManager.register> | null = null;
  function close() {
    if (current !== mask) return;
    mask.remove();
    detachNavKeys();
    escHandle?.unregister();
    if (currentEscHandle === escHandle) currentEscHandle = null;
    current = null;
    lockBodyScroll(false);
  }
  // ESC 经 escManager 登记统一栈序（与 uiModal 同栈，后开先关；私挂 document 监听会被
  // escManager 的 stopImmediatePropagation 抢先短路 → 改走 register）
  escHandle = escManager.register('bz-lightbox', {
    isVisible: () => mask.isConnected,
    close,
  });
  currentEscHandle = escHandle;
  // 点背景（非媒体/头部/底部/箭头）关闭
  mask.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.bz-lightbox-media, .bz-lightbox-head, .bz-lightbox-foot, .bz-lightbox-nav')) close();
  });
  closeBtn.addEventListener('click', close);
  // ←→ 翻图（多图模式；焦点在输入框里时不抢，组合输入中不抢）
  if (multi) {
    const onKey = (e: KeyboardEvent): void => {
      if (e.isComposing) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
    };
    document.addEventListener('keydown', onKey);
    offNavKeys = () => document.removeEventListener('keydown', onKey);
  }

  current = mask;
  return { close };
}

/** 关闭当前灯箱（幂等）；C9：一并注销 esc 层，不留死层级在 escManager 栈底 */
export function closeLightbox(): void {
  if (current) {
    current.remove();
    current = null;
    detachNavKeys();
    currentEscHandle?.unregister();
    currentEscHandle = null;
    lockBodyScroll(false);
  }
}
