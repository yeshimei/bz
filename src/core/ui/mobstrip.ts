/* ============================================================
 * bz 组件库 · 移动筛选横滑条（src/core/ui/mobstrip.ts）
 * uiMobStrip：≤768px 替代 rail 的横滑胶囊条（桌面 CSS display:none）。
 * 收编 5 域 CSS 规则体逐字相同的移动 chips 行。
 * ============================================================ */
import type { BzMobStripOpts } from './types';

/** 横滑条（.bz-mobstrip），返回 el + setValue（单选，程序化不触发 onChange） */
export function uiMobStrip(opts: BzMobStripOpts): {
  el: HTMLDivElement;
  setValue: (id: string) => void;
} {
  const el = document.createElement('div');
  el.className = 'bz-mobstrip';

  const chips = new Map<string, HTMLButtonElement>();
  const setValue = (id: string) => {
    chips.forEach((chip) => chip.classList.toggle('is-on', chip.dataset.id === id));
  };

  opts.items.forEach((it) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bz-mobstrip-chip';
    chip.dataset.id = it.id;
    if (it.dot) {
      const dot = document.createElement('span');
      dot.className = 'bz-mobstrip-dot';
      dot.style.setProperty('--bz-rail-tint', it.dot);
      chip.appendChild(dot);
    }
    chip.appendChild(document.createTextNode(it.label));
    chip.addEventListener('click', () => {
      setValue(it.id);
      opts.onChange?.(it.id);
    });
    chips.set(it.id, chip);
    el.appendChild(chip);
  });

  setValue(opts.value);
  return { el, setValue };
}
