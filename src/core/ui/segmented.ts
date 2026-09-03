/* ============================================================
 * bz 组件库 · 分段控件（src/core/ui/segmented.ts）
 * 单选多段切换，返回容器 + setValue 句柄。
 * ============================================================ */
import type { BzSegOpts } from './types';

/** 分段（单选多段）。radiogroup + 方向键导航（L8） */
export function uiSegmented<T extends string>(opts: BzSegOpts<T>): { el: HTMLDivElement; setValue: (v: T) => void } {
  const el = document.createElement('div');
  el.className = 'bz-segmented' + (opts.className ? ' ' + opts.className : '');
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', opts.label || '');
  const btns = new Map<T, HTMLButtonElement>();
  opts.options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-segmented-btn' + (o.value === opts.value ? ' is-on' : '');
    b.textContent = o.label;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(o.value === opts.value));
    b.addEventListener('click', () => { setValue(o.value); opts.onChange(o.value); });
    b.addEventListener('keydown', (e) => {
      // 方向键在同组内循环移动选中（radio 组语义：左右/上下切换选中项）
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const vals = opts.options.map((x) => x.value);
      const curIdx = vals.indexOf(current());
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx = (curIdx + delta + vals.length) % vals.length;
      setValue(vals[nextIdx]);
      opts.onChange(vals[nextIdx]);
      btns.get(vals[nextIdx])?.focus();
    });
    btns.set(o.value, b);
    el.appendChild(b);
  });
  let cur: T = opts.value;
  function current(): T {
    return cur;
  }
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
