/* ============================================================
 * bz 媒体灯箱（src/core/ui/lightbox.ts）
 * 在样式 .bz-lightbox（components.css 后续扩展）上提供全屏看图/视频。
 * 单例：同一时刻只开一个；Esc / 点背景 / ✕ 关闭。
 * 对齐 core 既有：escManager + z-order（详见下方 import）。
 * ============================================================ */
import { uiIcon } from './icon';

export interface BzLightboxOpts {
  src: string;              // 媒体地址（img / video / audio）
  type?: 'image' | 'video' | 'audio';
  title?: string;           // 底部/头部说明
  caption?: string;
}

let current: HTMLDivElement | null = null;

export function openLightbox(opts: BzLightboxOpts): { close: () => void } {
  closeLightbox(); // 单例，先关旧的

  const mask = document.createElement('div');
  mask.className = 'bz-lightbox';
  mask.style.zIndex = '900';

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

  function close() {
    if (current !== mask) return;
    mask.remove();
    current = null;
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
  // 点背景（非媒体/头部/底部）关闭
  mask.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.bz-lightbox-media, .bz-lightbox-head, .bz-lightbox-foot')) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  current = mask;
  return { close };
}

/** 关闭当前灯箱（幂等） */
export function closeLightbox(): void {
  if (current) {
    current.remove();
    current = null;
  }
}
