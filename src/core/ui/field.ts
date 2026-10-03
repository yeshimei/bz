/* ============================================================
 * bz 组件库 · 表单（src/core/ui/field.ts）
 * uiField（标签 + 控件 + desc/error，根标签按控件是否可标记自适应）/ uiInput。
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

/**
 * 该控件是不是「可标记元素」（HTML 的 labelable elements）—— 决定 `uiField` 用 `<label>` 还是 `<div>`。
 *
 * 为什么较真：`<label>` 的**激活行为**是「点击标签 → 向它的第一个可标记后代派发一次合成点击」。
 * 对 `uiInput` 这正是我们要的（点标签聚焦输入框）；但对 `uiSelect` 这类自绘控件是灾难 ——
 * 下拉一展开，菜单里的选项 `<button>` 就成了标签里的第一个可标记后代，于是「点一下控件」会
 * 立刻被标签转发成「点第一个选项」并关闭菜单。**表现就是下拉根本用不了（换不了值）**。
 * `uiSwitch` 是 `<span role="switch">`、`uiSelect` 是 `<div role="listbox">`，都不是可标记元素，
 * 包进 `<label>` 本也拿不到任何标签语义，只会平添上面那个坑。
 *
 * 故：控件自身可标记 → `<label>`（保留「点标签即聚焦/切换」）；否则 → `<div>`（只做视觉分组）。
 */
function isLabelable(ctrl: HTMLElement): boolean {
  const tag = ctrl.tagName;
  if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') return (ctrl as HTMLInputElement).type !== 'hidden';
  return false;
}

/**
 * 字段行（标签 + 控件 + desc/error），对照 settings 行。
 *
 * 根元素**按控件类型自适应**：可标记控件用 `<label>`（点标签能聚焦/切换），其余用 `<div>` ——
 * 理由见 `isLabelable`（把自绘下拉放进 `<label>` 会让它换不了值）。两者共用 `.bz-field` 样式，
 * `.bz-field { display:flex }` 与标签名无关，观感一致。
 */
export function uiField(opts: BzFieldOpts): HTMLElement {
  const wrap = isLabelable(opts.control)
    ? document.createElement('label')
    : document.createElement('div');
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
