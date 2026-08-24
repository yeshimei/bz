/**
 * 通用确认弹窗
 * 原实现来自 QuickAdd 环境的 Q3.js（window.__utils.confirm）。
 * 独立插件版：DOM 结构与原版一致（含 __shared_confirm_* id），并接入本地 escManager。
 * 文案（title/message/confirmText/cancelText）一律 escapeHtml 后拼 HTML（P0-8 防注入）。
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

export function confirm(opts: ConfirmOptions) {
  const t = opts.title || '确认';
  const m = opts.message || '';
  const onOk = opts.onConfirm;
  const onNo = opts.onCancel;
  const okTxt = opts.confirmText || '确定';
  const noTxt = opts.cancelText || '取消';

  const old = document.getElementById('__shared_confirm_mask__');
  if (old) old.remove();

  const mask = document.createElement('div');
  mask.id = '__shared_confirm_mask__';
  mask.onclick = (e) => {
    if (e.target === mask) close(false);
  };

  const popup = document.createElement('div');
  popup.id = '__shared_confirm_popup__';
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

  function close(ok: boolean) {
    mask.remove();
    if (ok && typeof onOk === 'function') onOk();
    if (!ok && typeof onNo === 'function') onNo();
  }

  document.getElementById('__shared_confirm_ok__')!.onclick = () => close(true);
  document.getElementById('__shared_confirm_cancel__')!.onclick = () => close(false);
}
