/* ============================================================
 * bz 组件库 · 统计卡（src/core/ui/stat.ts）
 * uiStat：数字 + 标签统计卡（默认中性 / 语义 tone / --click 可点筛选）。
 * 收编 bookshelf/belongings 两份近似拷贝与 recap/home/review 简版。
 * ============================================================ */
import type { BzStatOpts } from './types';
import { uiIcon } from './icon';

/** 统计卡（.bz-stat） */
export function uiStat(opts: BzStatOpts): HTMLDivElement {
  const el = document.createElement('div');
  const cls = ['bz-stat'];
  if (opts.tone) cls.push(`bz-stat--${opts.tone}`);
  if (opts.click) cls.push('bz-stat--click');
  el.className = cls.join(' ');

  const label = document.createElement('span');
  label.className = 'bz-stat-label';
  if (opts.icon) label.appendChild(uiIcon(opts.icon));
  label.appendChild(document.createTextNode(opts.label));
  el.appendChild(label);

  const num = document.createElement('span');
  num.className = 'bz-stat-num';
  num.textContent = String(opts.num);
  el.appendChild(num);

  if (opts.hint) {
    const hint = document.createElement('span');
    hint.className = 'bz-stat-hint';
    hint.textContent = opts.hint;
    el.appendChild(hint);
  }

  if (opts.onClick) el.addEventListener('click', opts.onClick);
  return el;
}
