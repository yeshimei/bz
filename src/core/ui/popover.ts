/* ============================================================
 * bz 组件库 · 候选浮层（src/core/ui/popover.ts）
 * uiPopover：input 锚定的候选列表浮层（.bz-popover，分类/笔记/网页
 *   选择器）。视觉 = .bz-select-menu 同形制，提升为独立组件。
 * 前提：anchor 须位于 position:relative 容器内（如 .bz-search 壳）——
 *   浮层绝对定位挂 anchor.parentElement，宽度随容器撑满。
 * 开合：anchor 点击开合 / 选项点击即关 / 外部点击 / Esc 关闭
 *   （交互骨架仿 uiSelect；监听随开挂、随关摘，无常驻泄漏）。
 * ============================================================ */
import type { BzPopoverOpts } from './types';
import { uiIcon } from './icon';

type PopoverOption = BzPopoverOpts['options'][number];

/** 候选浮层（.bz-popover），返回 open/close/setValue/setOptions */
export function uiPopover(opts: BzPopoverOpts): {
  open: () => void;
  close: () => void;
  setValue: (id: string) => void;
  setOptions: (items: PopoverOption[]) => void;
} {
  const anchor = opts.anchor;
  let current = opts.value ?? '';
  let items = opts.options;
  let layer: HTMLDivElement | null = null;

  const onDocClick = (e: MouseEvent) => {
    if (!layer) return;
    const t = e.target as Node;
    if (anchor.contains(t)) return; // anchor 自身点击由其开合监听处理
    close();
  };
  const onDocKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && layer) close();
  };

  const open = () => {
    if (layer) return;
    const m = document.createElement('div');
    m.className = 'bz-popover';
    m.setAttribute('role', 'listbox');
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'bz-popover-empty';
      empty.textContent = opts.emptyText || '无匹配项';
      m.appendChild(empty);
    } else {
      items.forEach((o) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bz-popover-item' + (o.id === current ? ' is-on' : '');
        b.dataset.id = o.id;
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(o.id === current));
        if (o.icon) b.appendChild(uiIcon(o.icon));
        const span = document.createElement('span');
        span.textContent = o.label;
        b.appendChild(span);
        b.addEventListener('click', (ev) => {
          ev.stopPropagation(); // 选中即关（不连锁触发 document 外点关闭）
          setValue(o.id);
          opts.onPick?.(o.id);
          close();
        });
        m.appendChild(b);
      });
    }
    (anchor.parentElement || anchor).appendChild(m);
    layer = m;
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onDocKey);
  };

  const close = () => {
    if (!layer) return;
    layer.remove();
    layer = null;
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onDocKey);
  };

  const setValue = (id: string) => {
    current = id;
    if (!layer) return;
    // 浮层开着时选中态跟随
    layer.querySelectorAll<HTMLElement>('.bz-popover-item').forEach((item) => {
      const on = item.dataset.id === id;
      item.classList.toggle('is-on', on);
      item.setAttribute('aria-selected', String(on));
    });
  };

  const setOptions = (next: PopoverOption[]) => {
    items = next;
    if (layer) {
      close();
      open(); // 开着时原位重建（保持绝对定位挂载点不变）
    }
  };

  anchor.addEventListener('click', () => {
    if (layer) close();
    else open();
  });

  return { open, close, setValue, setOptions };
}
