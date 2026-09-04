/* ============================================================
 * bz 组件库 · 主头行（src/core/ui/mainhead.ts）
 * uiMainHead：内容区主头行——分组标题 + 计数 + spacer + 主按钮
 * （30px 中档）。收编 todo/cinema/favorites/belongings 四域逐字重复。
 * ============================================================ */
import type { BzMainHeadOpts } from './types';
import { uiBtn } from './button';

/** 主头行（.bz-main-head），返回 el + setTitle + setCount（空值隐藏计数位） */
export function uiMainHead(opts: BzMainHeadOpts): {
  el: HTMLDivElement;
  setTitle: (t: string) => void;
  setCount: (c?: string) => void;
} {
  const el = document.createElement('div');
  el.className = 'bz-main-head';

  const title = document.createElement('span');
  title.className = 'bz-main-title';
  title.textContent = opts.title;
  el.appendChild(title);

  const count = document.createElement('span');
  count.className = 'bz-main-count';
  el.appendChild(count);

  const sp = document.createElement('span');
  sp.className = 'bz-main-spacer';
  el.appendChild(sp);

  if (opts.action) {
    el.appendChild(uiBtn({
      label: opts.action.label,
      icon: opts.action.icon,
      tone: 'primary',
      className: 'bz-btn--md',
      onClick: opts.action.onClick,
    }));
  }

  const setCount = (c?: string) => {
    if (c === undefined || c === null || c === '') {
      count.style.display = 'none';
      count.textContent = '';
    } else {
      count.style.display = '';
      count.textContent = c;
    }
  };
  setCount(opts.count);

  return {
    el,
    setTitle: (t: string) => {
      title.textContent = t;
    },
    setCount,
  };
}
