/* ============================================================
 * bz 组件库 · 进度条（src/core/ui/progress.ts）
 * uiProgress：track + i 填充基元（value 0-100 钳制）。
 * 收编 checkup/encrypt/bookshelf/reading-report 四域同形制。
 * ============================================================ */
import type { BzProgressOpts } from './types';

/** 进度条（.bz-progress），返回 el + setValue（0-100，越界钳制） */
export function uiProgress(opts: BzProgressOpts = {}): {
  el: HTMLDivElement;
  setValue: (n: number) => void;
} {
  const el = document.createElement('div');
  const cls = ['bz-progress'];
  if (opts.thin) cls.push('bz-progress--thin');
  if (opts.tone) cls.push(`bz-progress--${opts.tone}`);
  el.className = cls.join(' ');

  const fill = document.createElement('i');
  el.appendChild(fill);

  const setValue = (n: number) => {
    const v = Math.min(100, Math.max(0, Number(n) || 0));
    fill.style.width = v + '%';
  };
  if (opts.value !== undefined) setValue(opts.value);

  return { el, setValue };
}
