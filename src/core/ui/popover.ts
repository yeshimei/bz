/* ============================================================
 * bz 组件库 · 候选浮层（src/core/ui/popover.ts）
 * uiPopover：input 锚定的候选列表浮层（.bz-popover，分类/笔记/网页
 *   选择器）。视觉 = .bz-select-menu 同形制，提升为独立组件。
 * 前提：anchor 须位于 position:relative 容器内（如 .bz-search 壳）——
 *   浮层绝对定位挂 anchor.parentElement，宽度随容器撑满。
 * 开合：anchor 点击开合 / 选项点击即关 / 外部点击 / Esc 关闭
 *   （交互骨架仿 uiSelect；外部点击监听随开挂、随关摘；Esc 走 escManager 层，C5）。
 * ============================================================ */
import type { BzPopoverOpts } from './types';
import { uiIcon } from './icon';
import { escManager } from '../esc-manager';

type PopoverOption = BzPopoverOpts['options'][number];

/** 候选浮层（.bz-popover），返回 open/close/setValue/setOptions/detach */
export function uiPopover(opts: BzPopoverOpts): {
  open: () => void;
  close: () => void;
  setValue: (id: string) => void;
  setOptions: (items: PopoverOption[]) => void;
  detach: () => void;
} {
  const anchor = opts.anchor;
  let current = opts.value ?? '';
  let items = opts.options;
  let layer: HTMLDivElement | null = null;
  /** ESC 层句柄（C5）：浮层开着时经 escManager 注册，随 close 注销——替代私挂 document 级 ESC 监听 */
  let escHandle: ReturnType<typeof escManager.register> | null = null;

  const onDocClick = (e: MouseEvent) => {
    if (!layer) return;
    const t = e.target as Node;
    if (anchor.contains(t)) return; // anchor 自身点击由其开合监听处理
    close();
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
    // ESC 关闭走 escManager 统一层序（C5）：私挂 document 级 ESC 监听会被 escManager 命中
    // 可见层后的 stopImmediatePropagation 抢先短路（面板开着时整面板直关、浮层不动）
    escHandle = escManager.register('bz-ui-popover', {
      isVisible: () => !!layer && layer.isConnected,
      close: () => close(),
    });
  };

  const close = () => {
    if (!layer) return;
    layer.remove();
    layer = null;
    document.removeEventListener('click', onDocClick);
    if (escHandle) {
      escHandle.unregister();
      escHandle = null;
    }
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

  return {
    open,
    close,
    setValue,
    setOptions,
    /** 清理：关浮层并摘除 document 监听（宿主收尾用，对齐 uiSelect.detach） */
    detach: () => {
      document.removeEventListener('click', onDocClick);
      close();
    },
  };
}
