/* ============================================================
 * bz 组件库 · 搜索框（src/core/ui/search.ts）
 * uiSearch：前缀搜索图标 + .bz-input（.bz-search 壳，图标绝对定位
 * 左留 30px）。收编 6 域各自的 .bz-*-search 逐字重复。
 * ============================================================ */
import type { BzSearchOpts } from './types';
import { uiIcon } from './icon';
import { uiInput } from './field';

/** 搜索框（.bz-search），返回 el + input + setValue（程序化置值，不触发 onInput） */
export function uiSearch(opts: BzSearchOpts): {
  el: HTMLDivElement;
  input: HTMLInputElement;
  setValue: (v: string) => void;
} {
  const el = document.createElement('div');
  el.className = 'bz-search';
  el.appendChild(uiIcon('search'));
  const input = uiInput({
    placeholder: opts.placeholder,
    value: opts.value,
    onInput: opts.onInput,
  });
  el.appendChild(input);
  const setValue = (v: string) => {
    input.value = v;
  };
  return { el, input, setValue };
}
