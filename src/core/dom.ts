/**
 * DOM 工具（Q3.js window.__utils 移植）：notice/longPress/
 * createSiteIcon/createIconBtn/createOverlay——行为与 Q3 逐字一致。
 * injectStyles 已随 ticket 60 样式收敛废弃删除（铁律 9：禁运行时注入）。
 */
import { notice } from './notice';
import { allocZ, topifyZ } from './z-order';

/** notice(msg, dur)：统一走自绘通知系统（自动语义归类，ticket 25 替代原生 Notice） */
export { notice };

/** 层级发号（ADR-0067 动态 z-index）：overlay 显示时发号，谁后显示谁在上 */
export { allocZ, topifyZ };

/** longPress(el, cb, dur, filter)：长按手势（mousedown/touchstart 计时，移动超 10px 取消）
 *  触屏滚动兼容：touchstart 被动监听、不 preventDefault（否则整段列表滚动被禁，memo 归档视图
 *  实测复现），长按触发后吞掉浏览器补发的合成 click（防穿透到元素内部链接/按钮）；
 *  未长按的短按由浏览器正常派发 click，不再自行补发。 */
export function longPress(
  el: HTMLElement,
  cb: (e: any) => void,
  dur?: number,
  filter?: (e: any) => boolean
): void {
  if (!dur) dur = 500;
  let timer: any = null, touching = false, fired = false, moved = false, sx = 0, sy = 0;
  let suppressClick = false;
  const M = 10;
  function start(e: any) {
    if (filter && !filter(e)) return;
    if (e.button !== undefined && e.button !== 0) return;
    fired = false;
    moved = false;
    if (e.touches && e.touches.length) {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      touching = true;
    }
    timer = setTimeout(function () { timer = null; fired = true; cb(e); }, dur);
  }
  function cancel() { if (timer) { clearTimeout(timer); timer = null; } }
  function move(e: any) {
    if (!timer || !touching || !e.touches || !e.touches.length) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - sx) > M || Math.abs(t.clientY - sy) > M) { moved = true; cancel(); }
  }
  function endFromTouch() {
    // 长按已触发 → 吞掉浏览器随后补发的合成 click（防穿透）；未长按不吞（短按 = 普通点击）
    if (fired) suppressClick = true;
    touching = false;
    cancel();
  }
  function endFromMouse() { touching = false; cancel(); }
  function onClick(e: MouseEvent) {
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', endFromMouse);
  el.addEventListener('mouseleave', endFromMouse);
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', endFromTouch);
  el.addEventListener('touchmove', move, { passive: true });
  el.addEventListener('touchcancel', endFromTouch);
  // 捕获阶段拦截：必须在卡片内部链接/按钮的 handler（目标/冒泡阶段）之前执行才能防穿透
  el.addEventListener('click', onClick, true);
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
  img.className = 'bz-site-icon';
  img.style.cssText = `width:${size}px; height:${size}px;`;
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
  // 规格：普通按钮 14px/22×26；关闭按钮 13px/21×25（--close 类，styles.css）
  b.className = text === '❌' ? 'bz-icon-btn bz-icon-btn--close' : 'bz-icon-btn';
  if (extra) b.style.cssText = extra;
  b.onclick = onClick;
  return b;
}

/** createOverlay(opts)：{maskId, popupId, onMaskClick, width, maxWidth} → {mask, popup, topify}
 *  z-index 动态分配（ADR-0067）：创建时发号一次（创建即显示的场景够用）；
 *  show/hide 复用的面板每次显示调 topify() 重新发号，保证「谁后显示谁在上」 */
export function createOverlay(opts: {
  maskId: string;
  popupId: string;
  onMaskClick?: () => void;
  width?: string;
  maxWidth?: number;
}): { mask: HTMLDivElement; popup: HTMLDivElement; topify: () => void } {
  const mask = document.createElement('div');
  mask.id = opts.maskId;
  mask.className = 'bz-overlay-mask';
  mask.style.display = 'none';
  mask.onclick = function (e) {
    if (e.target === mask && typeof opts.onMaskClick === 'function') opts.onMaskClick();
  };
  const popup = document.createElement('div');
  popup.id = opts.popupId;
  popup.className = 'bz-overlay-popup';
  popup.style.display = 'none';
  popup.style.width = opts.width || '90%';
  popup.style.maxWidth = (opts.maxWidth || 400) + 'px';
  topifyZ(mask, popup);
  return { mask, popup, topify: () => topifyZ(mask, popup) };
}
