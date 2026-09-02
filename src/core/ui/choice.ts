/* ============================================================
 * bz 组件库 · 平铺单选组（src/core/ui/choice.ts）
 * 表单里替代下拉的「胶囊选项平铺」：可换行、单选、带选中态。
 * 与 uiSegmented（等宽分段条）互补——选项多/文案长时用本组件。
 * 可选每项前置色点（.bz-choice-dot，数据语义色由调用方内联直给）。
 * ============================================================ */
import type { BzChoiceOpts } from './types';

/** 平铺单选组（可换行胶囊），返回容器 + setValue 句柄 */
export function uiChoice<T extends string>(opts: BzChoiceOpts<T>): { el: HTMLDivElement; setValue: (v: T) => void } {
  const el = document.createElement('div');
  el.className = 'bz-choice' + (opts.className ? ' ' + opts.className : '');
  const btns = new Map<T, HTMLButtonElement>();
  opts.options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-choice-btn' + (o.value === opts.value ? ' is-on' : '');
    b.dataset.value = String(o.value);
    if (o.dot) {
      const d = document.createElement('span');
      d.className = 'bz-choice-dot';
      d.style.background = o.dot;
      b.appendChild(d);
    }
    b.appendChild(document.createTextNode(o.label));
    b.addEventListener('click', () => { setValue(o.value); opts.onChange(o.value); });
    btns.set(o.value, b);
    el.appendChild(b);
  });
  function setValue(v: T) {
    btns.forEach((b, k) => b.classList.toggle('is-on', k === v));
  }
  return { el, setValue };
}
