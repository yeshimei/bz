/* ============================================================
 * bz 组件库 · 平铺单选组（src/core/ui/choice.ts）
 * 表单里替代下拉的「胶囊选项平铺」：可换行、单选、带选中态。
 * 与 uiSegmented（等宽分段条）互补——选项多/文案长时用本组件。
 * 可选每项前置色点（.bz-choice-dot，数据语义色由调用方内联直给）。
 * ============================================================ */
import type { BzChoiceOpts } from './types';

/** 平铺单选组（可换行胶囊），返回容器 + setValue 句柄。radiogroup + 方向键导航（L8） */
export function uiChoice<T extends string>(opts: BzChoiceOpts<T>): { el: HTMLDivElement; setValue: (v: T) => void } {
  const el = document.createElement('div');
  el.className = 'bz-choice' + (opts.className ? ' ' + opts.className : '');
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', opts.label || '');
  const btns = new Map<T, HTMLButtonElement>();
  let cur: T = opts.value;
  opts.options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-choice-btn' + (o.value === opts.value ? ' is-on' : '');
    b.dataset.value = String(o.value);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(o.value === opts.value));
    if (o.dot) {
      const d = document.createElement('span');
      d.className = 'bz-choice-dot';
      d.style.background = o.dot;
      b.appendChild(d);
    }
    b.appendChild(document.createTextNode(o.label));
    b.addEventListener('click', () => { setValue(o.value); opts.onChange(o.value); });
    b.addEventListener('keydown', (e) => {
      // 方向键在同组内循环移动选中（radio 组语义：左右/上下切换选中项）
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const vals = opts.options.map((x) => x.value);
      const curIdx = vals.indexOf(cur);
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx = (curIdx + delta + vals.length) % vals.length;
      setValue(vals[nextIdx]);
      opts.onChange(vals[nextIdx]);
      btns.get(vals[nextIdx])?.focus();
    });
    btns.set(o.value, b);
    el.appendChild(b);
  });
  function setValue(v: T) {
    cur = v;
    btns.forEach((b, k) => {
      const on = k === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }
  return { el, setValue };
}
