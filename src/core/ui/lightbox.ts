/* ============================================================
 * bz 媒体灯箱（src/core/ui/lightbox.ts）
 * 在样式 .bz-lightbox（components.css）上提供全屏看图/视频。
 * 单例：同一时刻只开一个；Esc / 点背景 / ✕ 关闭。
 * 对齐 core 既有：escManager + z-order（详见下方 import）。
 * ============================================================ */
import { uiIcon } from './icon';
import { escManager } from '../esc-manager';
import { allocZ } from '../z-order';

export interface BzLightboxOpts {
  src: string;              // 媒体地址（img / video / audio）
  type?: 'image' | 'video' | 'audio';
  title?: string;           // 底部/头部说明
  caption?: string;
}

let current: HTMLDivElement | null = null;

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

export function openLightbox(opts: BzLightboxOpts): { close: () => void } {
  closeLightbox(); // 单例，先关旧的

  const mask = document.createElement('div');
  mask.className = 'bz-lightbox';
  // 动态发号（ADR-0067）：与 modal/overlay 共用分配器，避免固定 900 被弹窗压住的层级问题
  mask.style.zIndex = String(allocZ());

  // 头部（标题 + 关闭）
  const head = document.createElement('div');
  head.className = 'bz-lightbox-head';
  const title = document.createElement('span');
  title.className = 'bz-lightbox-title';
  title.textContent = opts.title || '';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bz-lightbox-close';
  closeBtn.setAttribute('aria-label', '关闭');
  closeBtn.appendChild(uiIcon('x'));
  head.appendChild(title);
  head.appendChild(closeBtn);

  // 媒体主体
  const media = document.createElement('div');
  media.className = 'bz-lightbox-media';
  const type = opts.type || (opts.src.endsWith('.mp4') || opts.src.endsWith('.webm') ? 'video' : 'image');
  if (type === 'video') {
    const v = document.createElement('video');
    v.src = opts.src;
    v.controls = true;
    v.autoplay = true;
    media.appendChild(v);
  } else if (type === 'audio') {
    const a = document.createElement('audio');
    a.src = opts.src;
    a.controls = true;
    a.autoplay = true;
    media.appendChild(a);
  } else {
    const img = document.createElement('img');
    img.src = opts.src;
    img.alt = opts.title || '';
    media.appendChild(img);
  }

  // 底部说明
  const foot = document.createElement('div');
  foot.className = 'bz-lightbox-foot';
  foot.textContent = opts.caption || '';

  mask.appendChild(head);
  mask.appendChild(media);
  mask.appendChild(foot);
  document.body.appendChild(mask);
  lockBodyScroll(true);

  let escHandle: ReturnType<typeof escManager.register> | null = null;
  function close() {
    if (current !== mask) return;
    mask.remove();
    escHandle?.unregister();
    current = null;
    lockBodyScroll(false);
  }
  // ESC 经 escManager 登记统一栈序（与 uiModal 同栈，后开先关；私挂 document 监听会被
  // escManager 的 stopImmediatePropagation 抢先短路 → 改走 register）
  escHandle = escManager.register('bz-lightbox', {
    isVisible: () => mask.isConnected,
    close,
  });
  // 点背景（非媒体/头部/底部）关闭
  mask.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.bz-lightbox-media, .bz-lightbox-head, .bz-lightbox-foot')) close();
  });
  closeBtn.addEventListener('click', close);

  current = mask;
  return { close };
}

/** 关闭当前灯箱（幂等） */
export function closeLightbox(): void {
  if (current) {
    current.remove();
    current = null;
    lockBodyScroll(false);
  }
}
