/* ============================================================
 * bz 组件库 · 居中模态（src/core/ui/modal.ts）
 * 对齐设计手册 §9/§10 弹窗规格（12px 圆角、shadow-lg、82vh 限高）：
 *   .bz-overlay-mask（遮罩，点关）+ .bz-overlay-popup（内容卡）
 * 供新体系域复用——替换各域自造的 .bz-*-mask/modal 弹窗基座。
 * ESC 经 escManager 单例注册（先开先关，后开优先）。
 * ============================================================ */
import { escManager } from '../esc-manager';
import { allocZ } from '../z-order';
import { uiIcon } from './icon';

export interface BzModalOpts {
  content: HTMLElement | string;   // 弹窗内容（元素或 HTML 片段）
  maxWidth?: number;               // 像素宽度（默认 400，≤90vw）
  head?: boolean;                  // 带头行（关闭钮）——默认 false（无关闭钮，靠遮罩/ESC）
  title?: string;
  onClose?: () => void;            // 关闭回调（遮罩/ESC/✕）
  className?: string;              // 附加到 popup 的类
}

/** 打开居中模态，返回 { mask, popup, close } */
export function uiModal(opts: BzModalOpts): { mask: HTMLElement; popup: HTMLElement; close: () => void } {
  const mask = document.createElement('div');
  mask.className = 'bz-overlay-mask';
  mask.style.zIndex = String(allocZ());

  const popup = document.createElement('div');
  popup.className = 'bz-overlay-popup' + (opts.className ? ' ' + opts.className : '');
  if (opts.maxWidth) popup.style.maxWidth = `min(${opts.maxWidth}px, calc(100vw - 32px))`;

  if (opts.head) {
    const head = document.createElement('div');
    head.className = 'bz-dialog-head';
    const title = document.createElement('span');
    title.className = 'bz-dialog-title';
    title.textContent = opts.title || '';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'bz-icon-btn bz-icon-btn--lg';
    closeBtn.title = '关闭';
    closeBtn.appendChild(uiIcon('x'));
    closeBtn.addEventListener('click', () => close());
    head.appendChild(title);
    head.appendChild(closeBtn);
    popup.appendChild(head);
  }

  const body = document.createElement('div');
  body.className = 'bz-dialog-body';
  if (typeof opts.content === 'string') body.innerHTML = opts.content;
  else body.appendChild(opts.content);
  popup.appendChild(body);
  mask.appendChild(popup);

  let closed = false;
  let escHandle: ReturnType<typeof escManager.register> | null = null;
  function close() {
    if (closed) return;
    closed = true;
    mask.remove();
    escHandle?.unregister();
    opts.onClose?.();
  }

  // 点遮罩关闭（弹窗内元素不触发）
  mask.addEventListener('click', (e) => {
    if (e.target === mask) close();
  });

  // ESC：栈顶后开先关（escManager 会做可见性判断）
  escHandle = escManager.register('bz-modal', {
    isVisible: () => mask.isConnected,
    close,
  });

  document.body.appendChild(mask);
  return { mask, popup, close };
}
