/**
 * DOM 工具（Q3.js window.__utils 移植）：notice/injectStyles/longPress/
 * createSiteIcon/createIconBtn/createOverlay——行为与 Q3 逐字一致。
 */
import { Notice } from 'obsidian';

/** notice(msg, dur)：提示（smartCat 气泡优先，否则 Obsidian Notice） */
export function notice(msg: string, dur?: number): void {
  const w = window as any;
  if (w.smartCat && w.smartCat.showBubble) w.smartCat.showBubble(msg, dur || 3000);
  else new Notice(msg, dur || 3000);
}

/** injectStyles(id, css)：style[data-shared-style=id] 幂等注入（已存在跳过） */
export function injectStyles(id: string, css: string): void {
  if (document.querySelector('style[data-shared-style="' + id + '"]')) return;
  const s = document.createElement('style');
  s.setAttribute('data-shared-style', id);
  s.textContent = css;
  document.head.appendChild(s);
}

/** longPress(el, cb, dur, filter)：长按手势（mousedown/touchstart 计时，移动超 10px 取消） */
export function longPress(
  el: HTMLElement,
  cb: (e: any) => void,
  dur?: number,
  filter?: (e: any) => boolean
): void {
  if (!dur) dur = 500;
  let timer: any = null, touching = false, sx = 0, sy = 0;
  const M = 10;
  function start(e: any) {
    if (filter && !filter(e)) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.touches) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; touching = true; }
    timer = setTimeout(function () { timer = null; cb(e); }, dur);
  }
  function cancel() { if (timer) { clearTimeout(timer); timer = null; } }
  function move(e: any) {
    if (!timer || !touching) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - sx) > M || Math.abs(t.clientY - sy) > M) cancel();
  }
  function end() { touching = false; cancel(); }
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', end);
  el.addEventListener('mouseleave', end);
  el.addEventListener('touchstart', function (e) { e.preventDefault(); start(e); });
  el.addEventListener('touchend', end);
  el.addEventListener('touchmove', move);
}

/** DOMAIN_MAP：favicon 域名归一映射（Q3 同款） */
const DOMAIN_MAP: Record<string, string> = {
  'guokrapp.guokr.com': 'guokr.com',
  'daily.zhihu.com': 'zhihu.com',
};

/** createSiteIcon(domain, size=16)：网站 favicon 图标（yandex 取图 + localStorage 缓存） */
export function createSiteIcon(domain: string | null | undefined, size = 16): HTMLImageElement | null {
  if (!domain) return null;
  const mappedDomain = DOMAIN_MAP[domain] || domain;
  const cacheKey = 'favicon_' + mappedDomain;

  const img = document.createElement('img');
  img.style.cssText = `width:${size}px; height:${size}px; border-radius:2px; flex-shrink:0;`;
  img.alt = '';
  (img as any).crossOrigin = 'anonymous';

  // 1. 从 localStorage 读取缓存
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      img.src = cached;
      return img;
    }
  } catch (e) { /* 忽略 */ }

  // 2. 使用网络地址
  const networkUrl = `https://favicon.yandex.net/favicon/${mappedDomain}`;
  img.src = networkUrl;

  // 3. 加载完成后缓存为 Base64
  img.onload = function () {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = (img as any).naturalWidth;
      canvas.height = (img as any).naturalHeight;
      const ctx = canvas.getContext('2d');
      (ctx as any).drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      try {
        localStorage.setItem(cacheKey, dataUrl);
      } catch (e) { /* 忽略 */ }
    } catch (e) { /* 忽略 */ }
    (img as any).onload = null;
  };

  // 4. 加载失败则隐藏
  img.onerror = function () {
    img.style.display = 'none';
    (img as any).onerror = null;
  };

  return img;
}

/** createIconBtn(text, title, onClick, extra)：图标按钮（普通 14px/22×26，关闭 ❌ 13px/21×25 + hover 背景） */
export function createIconBtn(
  text: string,
  title: string,
  onClick: (() => void) | null,
  extra?: string
): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.title = title;
  // 规格：普通按钮较 16px/24×28 减 2px；关闭按钮减 3px
  const isClose = text === '❌';
  const fs = isClose ? 13 : 14;
  const w = isClose ? 21 : 22;
  const h = isClose ? 25 : 26;
  b.style.cssText =
    `background:none;border:none;font-size:${fs}px;cursor:pointer;color:var(--text-muted);padding:0;width:${w}px;height:${h}px;border-radius:4px;display:flex;align-items:center;justify-content:center;box-shadow:none;` +
    (extra || '');
  b.onmouseover = function () { b.style.background = 'var(--background-secondary)'; };
  b.onmouseout = function () { b.style.background = 'none'; };
  b.onclick = onClick;
  return b;
}

/** createOverlay(opts)：{maskId, popupId, zIndex=9999, onMaskClick, width, maxWidth} → {mask, popup} */
export function createOverlay(opts: {
  maskId: string;
  popupId: string;
  zIndex?: number;
  onMaskClick?: () => void;
  width?: string;
  maxWidth?: number;
}): { mask: HTMLDivElement; popup: HTMLDivElement } {
  const mask = document.createElement('div');
  mask.id = opts.maskId;
  mask.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);z-index:' +
    (opts.zIndex || 9999) +
    ';display:none;';
  mask.onclick = function (e) {
    if (e.target === mask && typeof opts.onMaskClick === 'function') opts.onMaskClick();
  };
  const popup = document.createElement('div');
  popup.id = opts.popupId;
  popup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);z-index:' +
    ((opts.zIndex || 9999) + 1) +
    ';width:' +
    (opts.width || '90%') +
    ';max-width:' +
    (opts.maxWidth || 400) +
    'px;max-height:80vh;display:none;flex-direction:column;';
  return { mask, popup };
}
