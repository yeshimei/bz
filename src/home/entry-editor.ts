/**
 * 「首页入口」内联编辑器（设置面板 → 首页 → **外观**组；2026-09-10 用户拍板）。
 *
 * 形态演进：浮层弹窗（带遮罩/ESC）→ **面板内联**（settings.ts 用 custom 行挂进插槽）。
 * **按端各一份、互不影响、互相不能修改**（用户拍板）：
 *  - 桌面端打开设置面板 → 只显示、只修改 `desk` 那套（顺序 + hiddenDesk）；
 *  - 移动端打开 → 只显示、只修改 `mob` 那套（顺序 + hiddenMob）；
 *  - 没有「桌面/移动」切换段 —— 另一端的数据本端既看不到也改不到。
 * 为何不做成可切：两端屏幕上的入口形态本就不同（桌面是入口行、移动是两列瓦片），
 * 在一端调另一端的顺序只能靠想象；拍板结论是各端只调自己。
 *
 * 交互：拖动排序（Pointer Events；触屏先按住 ~200ms 再拖，短滑归列表滚动）+ 点 × 移除（隐藏）。
 * **移除的域不进独立分区、也无「已隐藏」标题**（用户 2026-09-10 拍板）：就地排到列表最下面，
 * 弱化显示、无拖柄（不参与排序），点 + 即可加回可见列尾部。改动即时落盘 home.json（无保存按钮）。
 */
import { isMobileEnv } from '../core/mobile';
import { mountIcons } from '../core/ui';
import { iconSpan } from '../core/ui/str';
import type { App } from 'obsidian';
import {
  esc, DOMAINS, domainColor, hiddenOf, visibleDomains, reorderTo,
  type HomeDomain, type HomeOrder, type HomeOrderScope,
} from './shared';
import { loadHomeOrder, saveHomeConfig } from './order';

/** 行元素选择器（拖拽与列表查询共用；可见行与移除行同在一个 [data-ent-list] 容器内） */
const ROW_SEL = '[data-ent-row]';
/** 拖拽纵向激活阈值（px） */
const DRAG_PX = 10;
/** 触屏「先按住」窗口（ms）：短于此窗口内滑动 = 滚列表，不进拖拽 */
const TOUCH_ARM_MS = 200;

/** 把编辑器挂进设置面板的 custom 行插槽（域侧只调这一支） */
export function mountHomeEntryEditor(body: HTMLElement, app: App): void {
  const scope: HomeOrderScope = isMobileEnv() ? 'mob' : 'desk';
  let order: HomeOrder | null = null;
  /** 拖拽落点那一下的点击抑制（防松手误触 ×/+） */
  let suppressClickUntil = 0;

  const root = document.createElement('div');
  root.className = 'bz-home-ent';
  root.setAttribute('data-ent-scope', scope);
  body.appendChild(root);

  /* ---------- 数据写入 ---------- */

  /** 覆盖本端的隐藏清单（另一端原样保留） */
  function setHidden(ids: string[]): void {
    if (!order) return;
    order = scope === 'mob' ? { ...order, hiddenMob: ids } : { ...order, hiddenDesk: ids };
  }

  /** 覆盖本端的顺序（另一端原样保留） */
  function setScopeOrder(ids: string[]): void {
    if (!order) return;
    order = scope === 'mob' ? { ...order, mob: ids } : { ...order, desk: ids };
  }

  function persist(): void {
    if (!order) return;
    // 提交读到的整份 order（含另一端），本端编辑不动另一端
    void saveHomeConfig(order, app).catch(() => undefined);
  }

  /* ---------- 拖拽排序 ---------- */
  let drag: {
    el: HTMLElement; listEl: HTMLElement; startY: number; step: number;
    from: number; to: number; total: number; active: boolean; armed: boolean;
    armTimer: ReturnType<typeof setTimeout> | null;
  } | null = null;

  function endDrag(): void {
    const c = drag;
    drag = null;
    if (!c) return;
    if (c.armTimer) clearTimeout(c.armTimer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    c.el.classList.remove('bz-home-ent-drag');
    c.el.style.transform = '';
  }

  function onMove(e: PointerEvent): void {
    const c = drag;
    if (!c) return;
    const dy = e.clientY - c.startY;
    if (!c.active) {
      if (!c.armed) {
        if (Math.abs(dy) > 8) endDrag(); // 触屏未按住就滑 → 让位滚动
        return;
      }
      if (Math.abs(dy) < DRAG_PX) return;
      c.active = true;
      c.el.classList.add('bz-home-ent-drag');
    }
    e.preventDefault();
    const to = Math.max(0, Math.min(c.from + Math.round(dy / c.step), c.total - 1));
    c.to = to;
    c.el.style.transform = `translateY(${(to - c.from) * c.step}px)`;
  }

  function onUp(): void {
    const c = drag;
    if (!c) return;
    const { active, to, from } = c;
    const id = c.el.dataset.entRow || '';
    endDrag();
    if (!active) return;
    suppressClickUntil = Date.now() + 300;
    if (!order || to === from || !id) {
      render();
      return;
    }
    setScopeOrder(reorderTo(order[scope], id, to, hiddenOf(order, scope)));
    persist();
    render();
  }

  /** total = 可排序行数（= 可见行数；移除的域排在最下面，不参与排序） */
  function attachDrag(el: HTMLElement, listEl: HTMLElement, total: number): void {
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button) return;
      if ((e.target as HTMLElement).closest('[data-ent-remove]')) return;
      const rows = Array.from(listEl.querySelectorAll<HTMLElement>(ROW_SEL));
      const from = rows.indexOf(el);
      if (from < 0 || total < 2) return;
      let step = (rows[0]?.offsetHeight ?? 40) + 6;
      if (rows.length >= 2) {
        const d = rows[1].offsetTop - rows[0].offsetTop;
        if (d > 0) step = d;
      }
      const c = {
        el, listEl, startY: e.clientY, step, from, to: from, total,
        active: false, armed: !isMobileEnv(), armTimer: null as ReturnType<typeof setTimeout> | null,
      };
      drag = c;
      if (isMobileEnv()) {
        c.armTimer = setTimeout(() => { if (drag === c) c.armed = true; c.armTimer = null; }, TOUCH_ARM_MS);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  }

  /* ---------- 渲染 ---------- */

  function rowHtml(d: HomeDomain, isHidden: boolean): string {
    const btn = isHidden
      ? '<button type="button" class="bz-home-ent-btn bz-home-ent-btn--add" data-ent-restore="' + d.id + '" title="重新加回" aria-label="加回' + d.name + '">' + iconSpan('plus') + '</button>'
      : '<button type="button" class="bz-home-ent-btn" data-ent-remove="' + d.id + '" title="移除（隐藏）" aria-label="移除' + d.name + '">' + iconSpan('x') + '</button>';
    return '<div class="bz-home-ent-row' + (isHidden ? ' bz-home-ent-row--off' : '') + '" data-ent-row="' + d.id + '">'
      + '<span class="bz-home-ent-grip" aria-hidden="true">' + iconSpan('grip-vertical') + '</span>'
      + '<span class="bz-home-ent-ic" style="color:' + domainColor(d.id) + '">' + iconSpan(d.icon) + '</span>'
      + '<span class="bz-home-ent-nm">' + esc(d.name) + '</span>'
      + btn
      + '</div>';
  }

  function render(): void {
    if (!order) return;
    const ids = hiddenOf(order, scope);
    const visible = visibleDomains(order[scope], ids);
    const hidden = DOMAINS.filter((d) => ids.includes(d.id));
    // 单一列表：**可见域在前、移除（隐藏）的域排最下面** —— 不分区、无「已隐藏」标题（用户拍板）
    root.innerHTML = '<div class="bz-home-ent-hint">拖动排序 · 点 × 移除（移除的排到最下面，点 + 加回）</div>'
      + '<div class="bz-home-ent-list" data-ent-list>'
      + visible.map((d) => rowHtml(d, false)).join('')
      + hidden.map((d) => rowHtml(d, true)).join('')
      + '</div>';
    mountIcons(root);
    const listEl = root.querySelector<HTMLElement>('[data-ent-list]');
    if (!listEl) return;
    // 只给可见行挂拖拽：移除的域不参与排序（拖柄在 CSS 里也隐掉）
    const rows = Array.from(listEl.querySelectorAll<HTMLElement>(ROW_SEL));
    for (const el of rows.slice(0, visible.length)) attachDrag(el, listEl, visible.length);
  }

  root.addEventListener('click', (e) => {
    if (Date.now() < suppressClickUntil) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (!order) return;
    const t = e.target as HTMLElement;
    const rm = t.closest('[data-ent-remove]') as HTMLElement | null;
    if (rm) {
      const id = rm.dataset.entRemove || '';
      const ids = hiddenOf(order, scope);
      if (id && !ids.includes(id)) {
        setHidden([...ids, id]);
        persist();
        render();
      }
      return;
    }
    const rs = t.closest('[data-ent-restore]') as HTMLElement | null;
    if (rs) {
      const id = rs.dataset.entRestore || '';
      setHidden(hiddenOf(order, scope).filter((x) => x !== id));
      persist();
      render();
    }
  });

  render(); // 先出骨架（加载完成前列表为空），读到顺序后填内容
  void loadHomeOrder(app).then((o) => {
    order = o;
    render();
  });
}
