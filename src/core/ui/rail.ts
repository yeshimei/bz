/* ============================================================
 * bz 组件库 · 状态侧栏（src/core/ui/rail.ts）
 * uiRail：左栏分组导航——分组 label + 行（图标/图标底座/字母徽标/色点
 *   前缀槽四选一 + 名称 + 计数/胶囊计数 + 未读气泡）+ 可选二级子列表
 *   （父项点击 = 展开收起）+ 底部固定区。
 * 收编 6-8 域各自手写侧栏（超集归一，宽度/密度用变量微调，禁止域内复制）。
 * ============================================================ */
import { setIcon } from 'obsidian';
import type { BzRailItem, BzRailOpts } from './types';
import { uiIcon } from './icon';

/** 单行（叶子/父项通用）：前缀槽 + 名称 + 计数 + 未读 +（父项）caret */
function buildRow(item: BzRailItem): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bz-rail-item';
  b.dataset.id = item.id;

  // 前缀槽四选一：图标底座 > 图标 > 字母徽标 > 状态色点
  if (item.boxedIcon) {
    const box = document.createElement('span');
    box.className = 'bz-rail-ic';
    box.appendChild(uiIcon(item.boxedIcon));
    b.appendChild(box);
  } else if (item.icon) {
    b.appendChild(uiIcon(item.icon));
  } else if (item.badge) {
    const badge = document.createElement('span');
    badge.className = 'bz-rail-badge';
    badge.textContent = item.badge.t;
    badge.setAttribute('aria-label', item.badge.label);
    if (item.badge.tint) badge.style.setProperty('--bz-rail-tint', item.badge.tint);
    b.appendChild(badge);
  } else if (item.dot) {
    const dot = document.createElement('span');
    dot.className = 'bz-rail-dot';
    dot.style.setProperty('--bz-rail-tint', item.dot);
    b.appendChild(dot);
  }

  const name = document.createElement('span');
  name.className = 'bz-rail-name';
  name.textContent = item.name;
  b.appendChild(name);

  if (item.count !== undefined && item.count !== null && item.count !== '') {
    const cnt = document.createElement('span');
    cnt.className = 'bz-rail-count' + (item.pill ? ' bz-rail-count--pill' : '');
    cnt.textContent = String(item.count);
    b.appendChild(cnt);
  }
  if (item.unread) {
    const u = document.createElement('span');
    u.className = 'bz-rail-unread';
    u.textContent = String(item.unread);
    b.appendChild(u);
  }
  if (item.children && item.children.length) {
    b.classList.add('has-sub');
    // caret 独立类（不吃 .bz-rail-item .bz-ic 的 14px 档，走 12px 旋转档）
    const caret = document.createElement('span');
    caret.className = 'bz-rail-caret';
    setIcon(caret, 'chevron-right');
    b.appendChild(caret);
  }
  return b;
}

/** 状态侧栏（.bz-rail），返回 el + setActive（组内单选；程序化不触发 onSelect） */
export function uiRail(opts: BzRailOpts): {
  el: HTMLDivElement;
  setActive: (id: string) => void;
} {
  const el = document.createElement('div');
  el.className = 'bz-rail';
  const scroll = document.createElement('div');
  scroll.className = 'bz-rail-scroll';
  el.appendChild(scroll);

  // 行注册表（含子项）：id → 行，供 setActive 单选
  const rows = new Map<string, HTMLButtonElement>();
  const setActive = (id: string) => {
    rows.forEach((row) => row.classList.remove('on'));
    rows.get(id)?.classList.add('on');
  };

  opts.groups.forEach((g) => {
    if (g.label) {
      const lb = document.createElement('div');
      lb.className = 'bz-rail-label';
      lb.textContent = g.label;
      scroll.appendChild(lb);
    }
    g.items.forEach((item) => {
      const row = buildRow(item);
      rows.set(item.id, row);
      scroll.appendChild(row);
      if (item.children && item.children.length) {
        const sub = document.createElement('div');
        sub.className = 'bz-rail-sub';
        item.children.forEach((child) => {
          const cr = buildRow(child);
          rows.set(child.id, cr);
          cr.addEventListener('click', () => {
            setActive(child.id);
            opts.onSelect?.(child.id);
          });
          sub.appendChild(cr);
        });
        scroll.appendChild(sub);
        // 父项点击 = 展开收起（不触发 onSelect）
        row.addEventListener('click', () => {
          const open = !sub.classList.contains('open');
          sub.classList.toggle('open', open);
          row.classList.toggle('sub-open', open);
        });
      } else {
        row.addEventListener('click', () => {
          setActive(item.id);
          opts.onSelect?.(item.id);
        });
      }
    });
  });

  if (opts.foot) {
    const foot = document.createElement('div');
    foot.className = 'bz-rail-foot';
    foot.appendChild(opts.foot);
    el.appendChild(foot);
  }

  setActive(opts.activeId);
  return { el, setActive };
}
