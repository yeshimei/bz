/* ============================================================
 * bz 组件库 · 输入联想（src/core/ui/suggest.ts）
 * uiSuggest：input 锚定的联想候选下拉（.bz-popover）。
 * 视觉 = 样式库 .bz-popover 族（不新造类）；交互 = 三域先例收敛
 *   （belongings 分类 / favorites 关联笔记 / memo 脚本·课程联想，issue 203）：
 *   聚焦/输入惰性弹出（issue 202 拍板：默认不弹）→ 现值子串过滤（上限 max）
 *   → 点选/回车回填并回调 → 外点收起 → Esc 只收下拉不穿表单。
 * 前提：anchor 须位于 position:relative 容器内（如 .bz-field）——浮层
 *   绝对定位挂 anchor.parentElement。候选文本用 textContent、图标可挂元素
 *   （iconOf 返回 HTMLElement，issue 231），不经 HTML 拼接，天然免注入。
 * ============================================================ */
import type { BzSuggestOpts } from './types';

export function uiSuggest(opts: BzSuggestOpts): {
  close: () => void;
  detach: () => void;
} {
  const anchor = opts.anchor;
  const max = opts.max ?? 30;
  let layer: HTMLDivElement | null = null;
  let skipNextOpen = false; // 点选回填后回焦不再复弹自身（favorites notePicker 同款语义）

  const close = () => {
    if (!layer) return;
    layer.remove();
    layer = null;
    document.removeEventListener('mousedown', onDocDown, true);
  };
  const onDocDown = (e: MouseEvent) => {
    const t = e.target as Node;
    // 宿主已离场（表单被整体移除）→ 自清监听；点在输入框/弹层内不关
    if (!anchor.isConnected) { close(); return; }
    if (layer?.contains(t) || anchor.contains(t)) return;
    close();
  };

  const pick = (raw: string) => {
    anchor.value = raw;
    close();
    opts.onPick?.(raw);
    // 回焦会触发 focus 开层——压一次；已聚焦（键盘 Enter 路径）不触发事件无需压
    if (document.activeElement !== anchor) {
      skipNextOpen = true;
      anchor.focus();
    }
  };

  const draw = () => {
    if (!layer) return;
    const cur = anchor.value.trim();
    const q = cur.toLowerCase();
    const matched = opts.source()
      .filter((s) => (!opts.excludeCurrent || s !== cur) && (!q || s.toLowerCase().includes(q)))
      .slice(0, max);
    if (!matched.length) { close(); return; } // 无匹配即收（不开空壳）
    layer.replaceChildren();
    matched.forEach((raw) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bz-popover-item';
      b.dataset.value = raw;
      b.setAttribute('role', 'option');
      const on = raw === cur; // 现值高亮（键盘导航起点；excludeCurrent 场景恒无）
      if (on) b.classList.add('is-on');
      const icon = opts.iconOf?.(raw);
      if (icon) {
        const ic = document.createElement('span');
        ic.className = 'bz-suggest-ic';
        if (typeof icon === 'string') ic.textContent = icon;
        else ic.appendChild(icon);
        b.appendChild(ic);
      }
      const label = document.createElement('span');
      label.textContent = opts.labelOf ? opts.labelOf(raw) : raw;
      b.appendChild(label);
      b.addEventListener('click', () => pick(raw));
      layer!.appendChild(b);
    });
  };

  const open = () => {
    if (skipNextOpen) { skipNextOpen = false; return; }
    if (layer) { draw(); return; }
    const m = document.createElement('div');
    m.className = 'bz-popover';
    m.setAttribute('role', 'listbox');
    (anchor.parentElement || anchor).appendChild(m);
    layer = m;
    document.addEventListener('mousedown', onDocDown, true);
    draw();
  };

  const activeIdx = () => [...(layer?.querySelectorAll('.bz-popover-item') ?? [])].findIndex((o) => o.classList.contains('is-on'));
  const moveActive = (to: number) => {
    const items = [...(layer?.querySelectorAll('.bz-popover-item') ?? [])];
    if (!items.length) return;
    const next = items[Math.max(0, Math.min(items.length - 1, to))];
    items.forEach((o) => o.classList.toggle('is-on', o === next));
    next.scrollIntoView?.({ block: 'nearest' }); // jsdom 无此法，可选调用
  };

  anchor.addEventListener('focus', open);
  anchor.addEventListener('input', () => { skipNextOpen = false; open(); }); // 输入恒可（重）开
  anchor.addEventListener('keydown', (e) => {
    if (!layer) return; // 收起态不拦键（Esc 落回表单层关窗）
    if (e.key === 'ArrowDown') {
      moveActive(activeIdx() + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      moveActive(activeIdx() < 0 ? (layer.querySelectorAll('.bz-popover-item').length - 1) : activeIdx() - 1);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const on = layer.querySelector<HTMLElement>('.bz-popover-item.is-on');
      if (on) pick(on.dataset.value as string);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      close();
      e.stopPropagation(); // 只收下拉，不穿 escManager/表单层
    }
  });

  return {
    close,
    /** 清理：关浮层并摘 document 监听（宿主收尾用；anchor 随表单移除时下次外点自清） */
    detach: () => {
      close();
    },
  };
}
