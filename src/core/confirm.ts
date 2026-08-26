/**
 * 通用确认弹窗
 * 原实现来自 QuickAdd 环境的 Q3.js（window.__utils.confirm）。
 * 独立插件版：DOM 结构与原版一致（含 __shared_confirm_* id），并接入本地 escManager。
 * 文案（title/message/confirmText/cancelText）一律 escapeHtml 后拼 HTML（P0-8 防注入）。
 * 焦点管理（UX 整改 37）：打开聚焦弹窗内首个可交互元素（DOM 序在前者为取消钮，
 * 默认焦点不落在确认钮防误删，与「删除不预聚焦」精神一致）；关闭还原焦点到触发元素；
 * popup 挂 role="dialog" aria-modal="true"（读屏语义）。id/类名不变（铁律 3）。
 */
import { escManager } from './esc-manager';
import { escapeHtml } from './utils';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/** 弹窗内可交互元素选择器（读屏/焦点管理的通用口径） */
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function confirm(opts: ConfirmOptions) {
  const t = opts.title || '确认';
  const m = opts.message || '';
  const onOk = opts.onConfirm;
  const onNo = opts.onCancel;
  const okTxt = opts.confirmText || '确定';
  const noTxt = opts.cancelText || '取消';
  const prevActive = document.activeElement;

  const old = document.getElementById('__shared_confirm_mask__');
  if (old) old.remove();

  const mask = document.createElement('div');
  mask.id = '__shared_confirm_mask__';
  mask.onclick = (e) => {
    if (e.target === mask) close(false);
  };

  const popup = document.createElement('div');
  popup.id = '__shared_confirm_popup__';
  // UX 整改 37：读屏语义——弹窗容器为 dialog 模态
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  // P0-8：文案全部经 escapeHtml 再拼 HTML（title/message/okText/noText 均为纯文本语义），
  // DOM 结构/id/类名不变
  popup.innerHTML =
    '<h4>' + escapeHtml(t) + '</h4>' +
    '<p>' + escapeHtml(m) + '</p>' +
    '<div class="confirm-actions">' +
    '<button id="__shared_confirm_cancel__">' + escapeHtml(noTxt) + '</button>' +
    '<button id="__shared_confirm_ok__">' + escapeHtml(okTxt) + '</button>' +
    '</div>';

  mask.appendChild(popup);
  document.body.appendChild(mask);
  escManager.register('q3-confirm', { isVisible: () => mask.isConnected, close: () => close(false) });

  // 关闭后还原焦点到触发元素（含 ESC/遮罩路径，共走 close）
  function restoreFocus(): void {
    if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
      prevActive.focus();
    }
  }

  function close(ok: boolean) {
    mask.remove();
    restoreFocus();
    if (ok && typeof onOk === 'function') onOk();
    if (!ok && typeof onNo === 'function') onNo();
  }

  // 打开聚焦首个可交互元素（取消钮在前，确认钮在后，见上）
  const first = popup.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  if (first) first.focus();

  document.getElementById('__shared_confirm_ok__')!.onclick = () => close(true);
  document.getElementById('__shared_confirm_cancel__')!.onclick = () => close(false);
}
