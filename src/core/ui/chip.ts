/* ============================================================
 * bz 组件库 · Chip（src/core/ui/chip.ts）
 * 胶囊 chip：选中/锁定/计数/可删。
 * ============================================================ */
import type { BzChipOpts } from './types';
import { uiIcon } from './icon';

/** 胶囊 chip（筛选/标签），带选中/软选中/锁定/计数/可删 */
export function uiChip(opts: BzChipOpts): HTMLButtonElement {
  const c = document.createElement('button');
  c.type = 'button';
  const cls = ['bz-chip'];
  // 选中态必须显式声明（selected=实底 / selectedSoft=软底）；removable 不再自动暗示选中（L3）
  if (opts.selected) cls.push('bz-chip--on');
  else if (opts.selectedSoft) cls.push('bz-chip--sel');
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
    // ✕ 用 span[role=button]（HTML 不允许 button 嵌套 button——L11）
    const x = document.createElement('span');
    x.className = 'bz-chip-x';
    x.setAttribute('role', 'button');
    x.setAttribute('aria-label', `移除 ${opts.label}`);
    x.tabIndex = 0;
    x.appendChild(uiIcon('x'));
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onRemove?.();
    });
    x.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        opts.onRemove?.();
      }
    });
    c.appendChild(x);
  }
  if (opts.onClick) c.addEventListener('click', () => opts.onClick?.());
  return c;
}
