/* ============================================================
 * bz 组件库 · 卡片视觉单选组（src/core/ui/cardpick.ts，issue 210）
 * 「看脸选」的单选卡：迷你预览区 + 名称，无编号无描述（用户拍板）。
 * 与 uiChoice（文案胶囊）/ uiSelect（下拉）互补——适合皮肤/布局等
 * 视觉差异为主的设置项；预览变体视觉由使用方域样式提供（prevClass）。
 * ============================================================ */
import type { BzCardPickOpts } from './types';

/** 卡片视觉单选组，返回容器 + setValue 句柄。radiogroup + 左右方向键导航（对齐 uiChoice L8） */
export function uiCardChoice<T extends string>(opts: BzCardPickOpts<T>): { el: HTMLDivElement; setValue: (v: T) => void } {
  const el = document.createElement('div');
  el.className = 'bz-cardpick' + (opts.className ? ' ' + opts.className : '');
  el.setAttribute('role', 'radiogroup');
  if (opts.label) el.setAttribute('aria-label', opts.label);
  const btns = new Map<T, HTMLButtonElement>();
  let cur = opts.value;

  const sync = (v: T) => {
    cur = v;
    btns.forEach((b, val) => {
      const on = val === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  };

  opts.options.forEach((o) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bz-cardpick-card' + (o.value === opts.value ? ' is-on' : '');
    card.dataset.value = String(o.value);
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(o.value === opts.value));
    const prev = document.createElement('span');
    prev.className = 'bz-cardpick-prev' + (o.prevClass ? ` ${o.prevClass}` : '');
    prev.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'bz-cardpick-name';
    name.textContent = o.label;
    card.append(prev, name);
    card.addEventListener('click', () => {
      if (cur === o.value) return;
      sync(o.value);
      opts.onChange(o.value);
    });
    btns.set(o.value, card);
    el.appendChild(card);
  });

  // 左右方向键在卡片间移动焦点（Enter/Space 原生触发 click）
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const list = opts.options.map((o) => o.value);
    const idx = list.indexOf(cur);
    const next = e.key === 'ArrowRight' ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
    btns.get(list[next])?.focus();
    e.preventDefault();
  });

  return { el, setValue: sync };
}
