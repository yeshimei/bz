/* ============================================================
 * bz 组件库 · 开关（src/core/ui/switch.ts）
 * uiSwitch：设置/表单行开关（.bz-sw，40×22 滑块，开 = 品牌实底）。
 * 样式库规格由 components.css 提供；键盘 Space/Enter 可开合。
 * ============================================================ */
import type { BzSwitchOpts } from './types';

/** 开关（role=switch），返回容器 + setChecked 句柄 */
export function uiSwitch(opts: BzSwitchOpts): { el: HTMLSpanElement; setChecked: (v: boolean) => void } {
  const el = document.createElement('span');
  el.className = 'bz-sw' + (opts.checked ? ' on' : '');
  el.setAttribute('role', 'switch');
  el.setAttribute('aria-checked', String(!!opts.checked));
  el.tabIndex = 0;
  const setChecked = (v: boolean) => {
    el.classList.toggle('on', v);
    el.setAttribute('aria-checked', String(v));
  };
  const toggle = () => {
    const next = !el.classList.contains('on');
    setChecked(next);
    opts.onChange?.(next);
  };
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  });
  return { el, setChecked };
}
