/**
 * 通用确认弹窗
 * 原实现来自 QuickAdd 环境的 Q3.js（window.__utils.confirm）。
 * 独立插件版：DOM 结构与原版一致（含 __shared_confirm_* id），并接入本地 escManager。
 */
import { escManager } from './esc-manager';

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
  mask.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10060;display:flex;align-items:center;justify-content:center;';
  mask.onclick = (e) => {
    if (e.target === mask) close(false);
  };

  const popup = document.createElement('div');
  popup.style.cssText =
    'position:relative;background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px;max-width:400px;width:90%;display:flex;flex-direction:column;align-items:center;text-align:center;';
  popup.innerHTML =
    '<h4 style="margin:0 0 12px 0;font-size:18px;font-weight:600;color:var(--text-normal);">' +
    t +
    '</h4>' +
    '<p style="margin:0 0 20px 0;font-size:15px;color:var(--text-muted);line-height:1.5;word-wrap:break-word;max-width:100%;">' +
    m +
    '</p>' +
    '<div style="display:flex;gap:12px;justify-content:center;width:100%;">' +
    '<button id="__shared_confirm_cancel__" style="padding:8px 24px;border-radius:6px;border:none;background:var(--background-secondary);cursor:pointer;font-size:14px;box-shadow:none;flex:1;">' +
    noTxt +
    '</button>' +
    '<button id="__shared_confirm_ok__" style="padding:8px 24px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:14px;font-weight:500;box-shadow:none;flex:1;">' +
    okTxt +
    '</button>' +
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
