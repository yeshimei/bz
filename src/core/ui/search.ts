/* ============================================================
 * bz 组件库 · 搜索框（src/core/ui/search.ts）
 * uiSearch：前缀搜索图标 + .bz-input（.bz-search 壳，图标绝对定位
 * 左留 30px）+ 尾部清除钮（有词才现；clipbook 效率#12 全域拍板：
 * 输入文字后右侧才出现清除图标，清空即隐）。收编 6 域各自的
 * .bz-*-search 逐字重复。
 * ============================================================ */
import type { BzSearchOpts } from './types';
import { uiIcon } from './icon';
import { uiInput } from './field';

/** 搜索框（.bz-search），返回 el + input + setValue（程序化置值，不触发 onInput）
 *  + syncClear（程序化置值后手动同步清除钮显隐；input 事件路径组件自管） */
export function uiSearch(opts: BzSearchOpts): {
  el: HTMLDivElement;
  input: HTMLInputElement;
  setValue: (v: string) => void;
  syncClear: () => void;
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
  // 尾部清除钮（效率#12 全域拍板）：hidden 初始态 + input 事件同步显隐（清空即隐、
  // 输入即显）；点击 = 清值 + 派发 input（消费方既有 onInput 过滤链自动刷新）+ 焦点回框
  let clearBtn: HTMLButtonElement | null = null;
  if (opts.clearable !== false) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'bz-search-clear';
    clearBtn.title = '清除搜索';
    clearBtn.setAttribute('aria-label', '清除搜索');
    clearBtn.hidden = !input.value.trim();
    clearBtn.appendChild(uiIcon('x'));
    clearBtn.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
    input.addEventListener('input', () => {
      if (clearBtn) clearBtn.hidden = !input.value.trim();
    });
    el.appendChild(clearBtn);
  }
  const syncClear = () => {
    if (clearBtn) clearBtn.hidden = !input.value.trim();
  };
  const setValue = (v: string) => {
    input.value = v;
    syncClear();
  };
  return { el, input, setValue, syncClear };
}
