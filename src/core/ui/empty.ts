/* ============================================================
 * bz 组件库 · 空态（src/core/ui/empty.ts）
 * 对齐手册 §8.3：图标 + 标题 + 描述 + CTA。
 * ============================================================ */
import type { BzEmptyOpts } from './types';
import { uiIcon } from './icon';

/** 空态（图标 + 标题 + 描述 + CTA） */
export function uiEmpty(opts: BzEmptyOpts): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'bz-empty';
  if (opts.icon) {
    const ic = uiIcon(opts.icon);
    ic.classList.add('bz-empty-ic');
    el.appendChild(ic);
  }
  const t = document.createElement('div');
  t.className = 'bz-empty-title';
  t.textContent = opts.title;
  el.appendChild(t);
  if (opts.desc) {
    const d = document.createElement('div');
    d.className = 'bz-empty-desc';
    d.textContent = opts.desc;
    el.appendChild(d);
  }
  if (opts.actions) el.appendChild(opts.actions);
  return el;
}
