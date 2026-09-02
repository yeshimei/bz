/* ============================================================
 * bz 组件库 · 分段控件（src/core/ui/segmented.ts）
 * 单选多段切换，返回容器 + setValue 句柄。
 * ============================================================ */
import type { BzSegOpts } from './types';

/** 分段（单选多段） */
export function uiSegmented<T extends string>(opts: BzSegOpts<T>): { el: HTMLDivElement; setValue: (v: T) => void } {
  const el = document.createElement('div');
  el.className = 'bz-segmented' + (opts.className ? ' ' + opts.className : '');
  const btns = new Map<T, HTMLButtonElement>();
  opts.options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-segmented-btn' + (o.value === opts.value ? ' is-on' : '');
    b.textContent = o.label;
    b.addEventListener('click', () => { setValue(o.value); opts.onChange(o.value); });
    btns.set(o.value, b);
    el.appendChild(b);
  });
  function setValue(v: T) {
    btns.forEach((b, k) => b.classList.toggle('is-on', k === v));
  }
  return { el, setValue };
}
