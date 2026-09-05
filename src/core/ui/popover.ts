/* ============================================================
 * bz 组件库 · 候选浮层（src/core/ui/popover.ts）
 * uiPopover：候选列表浮层（.bz-popover，分类/笔记/网页选择器）。
 * 视觉 = .bz-select-menu 同形制，提升为独立组件。
 * 前提：anchor/input 须位于 position:relative 容器内（如 .bz-field/
 *   .bz-search 壳）——浮层绝对定位挂其父元素，宽度随容器撑满。
 * 两种锚定模式（issue 198）：
 * 1) click-anchor（默认，向后兼容）：anchor 点击开合 / 选项点击即关 /
 *    外部 click / Esc 关闭（交互骨架仿 uiSelect；监听随开挂、随关摘）。
 * 2) input 锚定（传 input）：锚定输入框 focus / input 开（开着原位刷新），
 *    外部 mousedown（捕获）关、输入框与层内不关；Esc 只收浮层
 *    （stopPropagation 挡上层 escManager——「下拉开只收下拉」分层语义）；
 *    候选源 getOptions(q)（域内过滤，fuzzy/排除自身等域特有逻辑留域）；
 *    emptyCloses: true 无匹配即收层不弹空态；keyboard: true 时 ↑↓ 移动
 *    is-on 高亮（钳边界）、Enter 选中回调（焦点留在输入框，高亮仅视觉）。
 * 监听随开挂、随关摘，无常驻泄漏；detach 连输入监听一并摘。
 * ============================================================ */
import type { BzPopoverInputOpts, BzPopoverOpts } from './types';
import { uiIcon } from './icon';

type PopoverOption = NonNullable<BzPopoverOpts['options']>[number];

/** 候选浮层（.bz-popover），返回 open/close/setValue/setOptions/detach */
export function uiPopover(opts: BzPopoverOpts): {
  open: () => void;
  close: () => void;
  setValue: (id: string) => void;
  setOptions: (items: PopoverOption[]) => void;
  detach: () => void;
} {
  const input = opts.input ?? null;
  const anchor = input ?? opts.anchor; // input 模式锚定输入框自身（浮层挂所在 field/search 壳）
  if (!anchor) throw new Error('uiPopover：anchor 与 input 须传其一');
  const inputOpts = input ? (opts as BzPopoverInputOpts) : null; // input 模式专属字段（收窄用）
  let current = opts.value ?? '';
  let items = opts.options ?? [];
  let layer: HTMLDivElement | null = null;
  let activeIdx = -1; // 键盘高亮位（keyboard 模式；重渲时归位到 current）

  const onOpenChange = (on: boolean) => opts.onOpenChange?.(on);

  /** 渲染候选列表（重建层内容；高亮位归位到 current） */
  const fill = (m: HTMLDivElement, list: PopoverOption[]) => {
    m.replaceChildren();
    activeIdx = list.findIndex((o) => o.id === current);
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'bz-popover-empty';
      empty.textContent = opts.emptyText || '无匹配项';
      m.appendChild(empty);
      return;
    }
    list.forEach((o) => {
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
        ev.stopPropagation(); // 选中即关（不连锁触发外点关闭）
        commit(o.id);
      });
      m.appendChild(b);
    });
  };

  /** 选中收口：值跟踪 → onPick → 关层（点击项与 keyboard Enter 同路） */
  const commit = (id: string) => {
    setValue(id);
    opts.onPick?.(id);
    close();
  };

  // ---- click 模式监听 ----
  const onDocClick = (e: MouseEvent) => {
    if (!layer) return;
    const t = e.target as Node;
    if (anchor.contains(t)) return; // anchor 自身点击由其开合监听处理
    close();
  };
  const onDocKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && layer) close();
  };
  // ---- input 模式监听（捕获 mousedown：先于宿主遮罩/表单收尾） ----
  const onDocDown = (e: MouseEvent) => {
    if (!layer || !input) return;
    const t = e.target as Node;
    if (!input.isConnected) { close(); return; } // 宿主已拆（表单先关）：自清监听
    if (layer.contains(t) || input.contains(t)) return; // 层内/输入框点击不关
    close();
  };

  const open = () => {
    if (layer) return;
    const m = document.createElement('div');
    m.className = 'bz-popover';
    m.setAttribute('role', 'listbox');
    fill(m, items);
    (anchor.parentElement || anchor).appendChild(m);
    layer = m;
    if (input) document.addEventListener('mousedown', onDocDown, true);
    else {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onDocKey);
    }
    onOpenChange(true);
  };

  const close = () => {
    if (!layer) return;
    layer.remove();
    layer = null;
    if (input) document.removeEventListener('mousedown', onDocDown, true);
    else {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onDocKey);
    }
    onOpenChange(false);
  };

  /** 开着时原位重渲（input 模式过滤刷新：不关不闪、不重挂 document 监听） */
  const refresh = (list: PopoverOption[]) => {
    if (layer) fill(layer, list);
  };

  // ---- input 模式：focus/input 同步候选（域内 getOptions 过滤） ----
  const syncFromInput = () => {
    if (!input || !inputOpts) return;
    items = inputOpts.getOptions ? inputOpts.getOptions(input.value) : items;
    if (!items.length && inputOpts.emptyCloses) { close(); return; } // 无匹配即收层
    if (layer) refresh(items);
    else open();
  };

  // ---- input 模式键盘：↑↓ 移动高亮（is-on 仅视觉指示）/ Enter 选中 / Esc 分层 ----
  const onInputKey = (e: KeyboardEvent) => {
    if (!layer) return; // 未开不拦（Esc 穿透给上层 escManager）
    if (e.key === 'Escape') {
      close();
      e.stopPropagation(); // 分层：只收浮层，不穿透关宿主表单
    } else if (inputOpts?.keyboard && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (!items.length) return;
      activeIdx = Math.min(items.length - 1, Math.max(0, activeIdx + (e.key === 'ArrowDown' ? 1 : -1)));
      layer.querySelectorAll<HTMLElement>('.bz-popover-item').forEach((el, i) => {
        const on = i === activeIdx;
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-selected', String(on));
      });
    } else if (inputOpts?.keyboard && e.key === 'Enter') {
      e.preventDefault();
      const it = items[activeIdx];
      if (it) commit(it.id);
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

  // input 锚定：focus/input 开层（不挂 anchor 点击开合，输入框点击不关）
  if (input) {
    input.addEventListener('focus', syncFromInput);
    input.addEventListener('input', syncFromInput);
    input.addEventListener('keydown', onInputKey);
  } else {
    anchor.addEventListener('click', () => {
      if (layer) close();
      else open();
    });
  }

  return {
    open,
    close,
    setValue,
    /** 替换候选（开着时原位重建，保持挂载点与监听不动） */
    setOptions: (next: PopoverOption[]) => {
      items = next;
      refresh(items);
    },
    /** 清理：摘输入监听 + 关浮层并摘除 document 监听（宿主收尾用，对齐 uiSelect.detach） */
    detach: () => {
      if (input) {
        input.removeEventListener('focus', syncFromInput);
        input.removeEventListener('input', syncFromInput);
        input.removeEventListener('keydown', onInputKey);
      }
      document.removeEventListener('mousedown', onDocDown, true);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onDocKey);
      close();
    },
  };
}
