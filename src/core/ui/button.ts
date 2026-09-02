/* ============================================================
 * bz 组件库 · 按钮族（src/core/ui/button.ts）
 * uiBtn / uiIconBtn / uiBtnRow / uiDialogActions（弹窗底部主/次对）
 * ============================================================ */
import type { BzButtonOpts, BzIconBtnOpts } from './types';
import { uiIcon } from './icon';

/** 通用按钮（.bz-btn），样式库规格由 components.css 提供 */
export function uiBtn(opts: BzButtonOpts): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  const cls = ['bz-btn'];
  if (opts.tone && opts.tone !== 'default') cls.push(`bz-btn--${opts.tone}`);
  if (opts.size && opts.size !== 'md') cls.push(`bz-btn--${opts.size}`);
  if (opts.className) cls.push(opts.className);
  b.className = cls.join(' ');
  if (opts.title) b.title = opts.title;
  if (opts.disabled) b.disabled = true;
  if (opts.icon) b.appendChild(uiIcon(opts.icon));
  if (opts.label) {
    const span = document.createElement('span');
    span.textContent = opts.label;
    b.appendChild(span);
  }
  if (opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

/** 图标按钮（.bz-icon-btn，无文字小按钮） */
export function uiIconBtn(opts: BzIconBtnOpts): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  const cls = ['bz-icon-btn'];
  if (opts.on) cls.push('bz-icon-btn--on');
  if (opts.lg) cls.push('bz-icon-btn--lg');
  if (opts.xs) cls.push('bz-icon-btn--xs');
  if (opts.close) cls.push('bz-icon-btn--close');
  if (opts.className) cls.push(opts.className);
  b.className = cls.join(' ');
  if (opts.title) b.title = opts.title;
  if (opts.disabled) b.disabled = true;
  if (opts.danger) b.setAttribute('data-danger', '');
  b.appendChild(uiIcon(opts.icon));
  if (opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

/** 按钮行容器（.bz-btn-row，右对齐） */
export function uiBtnRow(buttons: HTMLElement[], opts?: { center?: boolean; grow?: boolean }): HTMLDivElement {
  const row = document.createElement('div');
  const cls = ['bz-btn-row'];
  if (opts?.center) cls.push('bz-btn-row--center');
  if (opts?.grow) cls.push('bz-btn-row--grow');
  row.className = cls.join(' ');
  buttons.forEach((x) => row.appendChild(x));
  return row;
}

/** 弹窗底部主/次按钮对（取消 + 确认） */
export function uiDialogActions(opts: {
  cancelText?: string;
  okText: string;
  okTone?: 'primary' | 'danger';
  onCancel?: () => void;
  onOk: () => void;
}): { row: HTMLDivElement; cancelBtn: HTMLButtonElement; okBtn: HTMLButtonElement } {
  const cancel = uiBtn({ label: opts.cancelText || '取消', onClick: opts.onCancel });
  const ok = uiBtn({ label: opts.okText, tone: opts.okTone || 'primary', onClick: opts.onOk });
  const row = uiBtnRow([cancel, ok]);
  return { row, cancelBtn: cancel, okBtn: ok };
}
