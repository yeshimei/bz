/* ============================================================
 * bz 组件库 · 滑条（src/core/ui/slider.ts）
 * uiRange：数值/评分滑条（.bz-range）。自绘轨道+滑块，
 * 抗 Obsidian 全局对 input[type=range] 的外观重置
 * （appearance:none + -webkit-slider-thumb 污染）。
 * ============================================================ */
import type { BzRangeOpts } from './types';

/** 滑条（.bz-range；范围/评分调节） */
export function uiRange(opts: BzRangeOpts): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'range';
  el.className = 'bz-range' + (opts.className ? ' ' + opts.className : '');
  if (opts.min !== undefined) el.min = String(opts.min);
  if (opts.max !== undefined) el.max = String(opts.max);
  if (opts.step !== undefined) el.step = String(opts.step);
  if (opts.value !== undefined) el.value = String(opts.value);
  if (opts.disabled) el.disabled = true;
  if (opts.onInput) el.addEventListener('input', () => opts.onInput?.(parseFloat(el.value)));
  if (opts.onChange) el.addEventListener('change', () => opts.onChange?.(parseFloat(el.value)));
  return el;
}
