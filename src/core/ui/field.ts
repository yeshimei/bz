/* ============================================================
 * bz 组件库 · 表单（src/core/ui/field.ts）
 * uiField（label + 控件 + desc/error）/ uiInput。
 * ============================================================ */
import type { BzFieldOpts, BzInputOpts } from './types';

/** 文本输入（.bz-input） */
export function uiInput(opts: BzInputOpts): HTMLInputElement {
  const inp = document.createElement('input');
  inp.className = 'bz-input' + (opts.error ? ' bz-input--error' : '');
  inp.type = opts.type || 'text';
  if (opts.placeholder) inp.placeholder = opts.placeholder;
  if (opts.value !== undefined) inp.value = opts.value;
  if (opts.disabled) inp.disabled = true;
  if (opts.onInput) inp.addEventListener('input', () => opts.onInput?.(inp.value));
  return inp;
}

/** 字段行（label + 控件 + desc/error），对照 settings 行 */
export function uiField(opts: BzFieldOpts): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.className = 'bz-field';
  if (opts.label) {
    const l = document.createElement('span');
    l.className = 'bz-field-label';
    l.textContent = opts.label;
    wrap.appendChild(l);
  }
  wrap.appendChild(opts.control);
  if (opts.error) {
    // error 边框样式仅对 .bz-input 定义（L4）：select/range 等非 input 控件不上无效类，
    // 错误文案仍由 .bz-field-error 呈现
    if (opts.control.classList.contains('bz-input')) opts.control.classList.add('bz-input--error');
    const e = document.createElement('span');
    e.className = 'bz-field-error';
    e.textContent = opts.error;
    wrap.appendChild(e);
  } else if (opts.desc) {
    const d = document.createElement('span');
    d.className = 'bz-field-desc';
    d.textContent = opts.desc;
    wrap.appendChild(d);
  }
  return wrap;
}
