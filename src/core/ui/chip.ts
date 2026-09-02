/* ============================================================
 * bz 组件库 · Chip（src/core/ui/chip.ts）
 * 胶囊 chip：选中/锁定/计数/可删。
 * ============================================================ */
import type { BzChipOpts } from './types';
import { uiIcon } from './icon';

/** 胶囊 chip（筛选/标签），带选中/锁定/计数/可删 */
export function uiChip(opts: BzChipOpts): HTMLButtonElement {
  const c = document.createElement('button');
  c.type = 'button';
  const cls = ['bz-chip'];
  if (opts.selected) cls.push('bz-chip--on');
  else if (opts.removable) cls.push('bz-chip--sel');
  if (opts.locked) cls.push('bz-chip--locked');
  c.className = cls.join(' ');
  if (opts.title) c.title = opts.title;
  if (opts.disabled) c.disabled = true;
  if (opts.icon) c.appendChild(uiIcon(opts.icon));
  const label = document.createElement('span');
  label.textContent = opts.label;
  c.appendChild(label);
  if (typeof opts.count === 'number') {
    const cnt = document.createElement('span');
    cnt.className = 'bz-chip-cnt';
    cnt.textContent = String(opts.count);
    c.appendChild(cnt);
  }
  if (opts.removable && !opts.locked) {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'bz-chip-x';
    x.appendChild(uiIcon('x'));
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onRemove?.();
    });
    c.appendChild(x);
  }
  if (opts.onClick) c.addEventListener('click', () => opts.onClick?.());
  return c;
}
