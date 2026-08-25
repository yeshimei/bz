/**
 * 剪藏批准弹窗（AIAgent.js showClipConfirmDialog 逐字移植）
 * 仅 AI 剪藏匹配使用（权限模型：非 AI 操作静默直改；仅 AI 匹配弹窗批准）。
 */
import { escManager } from '../core/esc-manager';
import { escapeHtml } from '../core/utils';

export function showClipConfirmDialog({
  itemTitle,
  itemId,
  noteName,
  onConfirm,
}: {
  itemTitle: string;
  itemId: string;
  noteName: string;
  onConfirm: () => void;
}): void {
  const mask = document.createElement('div');
  mask.style.cssText = `
    position: fixed; top:0; left:0; right:0; bottom:0;
    background: rgba(0,0,0,0.5); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--background-primary); border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    padding: 16px 20px; max-width: 440px; width: 90%;
  `;
  dialog.innerHTML = `
    <h3 style="margin:0 0 8px; font-size:16px;">🤖 AI 剪藏匹配</h3>
    <div style="font-size:14px; line-height:1.6; margin-bottom:12px;">
      <div>🎯 新笔记：<b>${escapeHtml(noteName)}</b></div>
      <div>📋 命中备忘录条目：<b>${escapeHtml(itemTitle)}</b>（ID:${escapeHtml(itemId)}）</div>
      <hr style="margin:10px 0; border:0; border-top:1px solid var(--background-modifier-border);">
      <div><b>批准</b> → 更新条目标题/链接并归档</div>
      <div><b>忽略</b> → 不做任何更改</div>
    </div>
    <div style="display:flex; gap:10px; justify-content:flex-end;">
      <button id="clip-cancel" style="padding:4px 16px; border:none; background:var(--background-secondary); border-radius:4px; cursor:pointer; font-size:13px;">忽略</button>
      <button id="clip-ok" style="padding:4px 16px; border:none; background:var(--interactive-accent); color:var(--text-on-accent); border-radius:4px; cursor:pointer; font-weight:500; font-size:13px;">批准</button>
    </div>`;

  mask.appendChild(dialog);
  document.body.appendChild(mask);
  escManager.register('aia', { isVisible: () => mask.isConnected, close: () => mask.remove() });

  const close = (fn: () => void) => () => { mask.remove(); fn(); };
  (dialog.querySelector('#clip-cancel') as HTMLButtonElement).onclick = close(() => {});
  (dialog.querySelector('#clip-ok') as HTMLButtonElement).onclick = close(onConfirm);
  mask.addEventListener('click', (e) => {
    if (e.target === mask) mask.remove();
  });
}
