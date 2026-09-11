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
 * 交互：拖动排序（Pointer Events；触屏先按住 ~250ms 再拖，短滑归列表滚动）+ 点 × 移除（隐藏）。
 * **移除的域不进独立分区、也无「已隐藏」标题**（用户 2026-09-10 拍板）：就地排到列表最下面，
 * 弱化显示、无拖柄（不参与排序），点 + 即可加回可见列尾部。改动即时落盘 home.json（无保存按钮）。
 *
 * 拖拽实现（2026-09-11 用户报 bug 后重写，两条都不再靠浏览器默认行为兜底）：
 *  - **让位动画**：被拖行只在自己那条 transform 轨道上跟手，**其余行按「谁被跨过」反向位移一格**
 *    （.bz-home-ent-shift，配 CSS transition）——此前只移动自身，其它行纹丝不动（用户看到的「没有动态效果」）。
 *  - **触屏长按**：`touch-action: pan-y` 让浏览器接管纵向手势，pointermove 会被 pointercancel 掐断，
 *    故触屏**必须**在 pointerdown 里把 `touch-action` 改成 `none`，拿到手势所有权后再进拖拽；
 *    短滑（按住窗口内位移 > TOUCH_SLOP_PX）立刻交还滚动。
 *    **长按期间禁止长按菜单**（contextmenu 抑制），否则真机先是弹出选择菜单。
 *  - 触屏不用「按满 250ms 自动进拖拽」：那会让「按住想滚动」的用户突然进入拖拽态；
 *    改为「按住 ≥250ms 后，第一次移动才真正起拖」——用户看到的是「按住不动、一动就跟着走」。
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
/** 桌面端起拖阈值（px）：鼠标没有「按住」概念，移动超过它才算拖 */
const DRAG_PX = 10;
/** 触屏「先按住」窗口（ms）：短于此窗口内滑动 = 滚列表，不进拖拽 */
const TOUCH_ARM_MS = 250;
/** 触屏按住窗口内的位移上限（px）：按住时手指微抖不算滚动，也不取消长按 */
const TOUCH_SLOP_PX = 8;
/** 让位动画类（邻居行反向位移一格；过渡在 CSS 里） */
const SHIFT_CLS = 'bz-home-ent-shift';
/** 拖拽中浮起类 */
const DRAG_CLS = 'bz-home-ent-drag';

/** 把编辑器挂进设置面板的 custom 行插槽（域侧只调这一支） */
export function mountHomeEntryEditor(body: HTMLElement, app: App): void {
  const scope: HomeOrderScope = isMobileEnv() ? 'mob' : 'desk';
  const touchMode = isMobileEnv();
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

  interface DragCtx {
    el: HTMLElement;
    listEl: HTMLElement;
    /** 可排序行（可见行，按 DOM 序；不含移除行） */
    rows: HTMLElement[];
    startY: number;
    /** 一行的高度步长（含间距） */
    step: number;
    from: number;
    to: number;
    total: number;
    active: boolean;
    armed: boolean;
    /** 触屏：本次 pointerdown 是否已把 touch-action 改成 none（决定收尾要不要改回） */
    touchLocked: boolean;
    armTimer: ReturnType<typeof setTimeout> | null;
  }
  let drag: DragCtx | null = null;

  /** 邻居让位：把除被拖行外的所有可排序行，按「是否落在被拖区间内」设定反向位移 */
  function applyShift(c: DragCtx): void {
    for (let i = 0; i < c.total; i++) {
      if (i === c.from) continue;
      const el = c.rows[i];
      if (!el) continue;
      // 被拖行从 from 走到 to：途中的行整体朝反方向挪一格
      let shift = 0;
      if (c.to > c.from && i > c.from && i <= c.to) shift = -1;
      else if (c.to < c.from && i >= c.to && i < c.from) shift = 1;
      if (shift) {
        el.style.transform = `translateY(${shift * c.step}px)`;
        el.classList.add(SHIFT_CLS);
      } else {
        el.style.transform = '';
        el.classList.remove(SHIFT_CLS);
      }
    }
  }

  /** 掐断本次拖拽（不落盘）；落点由 onUp 负责 */
  function endDrag(): void {
    const c = drag;
    drag = null;
    if (!c) return;
    if (c.armTimer) clearTimeout(c.armTimer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    if (c.touchLocked && c.el.isConnected) c.el.style.touchAction = '';
    c.el.classList.remove(DRAG_CLS);
    c.el.style.transform = '';
    // 邻居行归位（render() 随后重建 DOM；这里覆盖「取消拖拽」路径）
    for (const el of c.rows) {
      el.style.transform = '';
      el.classList.remove(SHIFT_CLS);
    }
  }

  function onMove(e: PointerEvent): void {
    const c = drag;
    if (!c) return;
    const dy = e.clientY - c.startY;

    if (!c.active) {
      if (!c.armed) {
        // 触屏按住窗口内：位移过大 = 用户在滚列表，交还手势（不 preventDefault，让浏览器继续滚）
        if (Math.abs(dy) > TOUCH_SLOP_PX) endDrag();
        return;
      }
      if (Math.abs(dy) < DRAG_PX) return;
      c.active = true;
      c.el.classList.add(DRAG_CLS);
    }

    // 已进入拖拽：吃掉后续默认行为（滚动/选择），行才跟得住
    if (e.cancelable) e.preventDefault();
    const to = Math.max(0, Math.min(c.from + Math.round(dy / c.step), c.total - 1));
    c.to = to;
    c.el.style.transform = `translateY(${(to - c.from) * c.step}px)`;
    applyShift(c);
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
  function attachDrag(el: HTMLElement, listEl: HTMLElement, rows: HTMLElement[]): void {
    const total = rows.length;
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button) return;
      if ((e.target as HTMLElement).closest('[data-ent-remove]')) return;
      const from = rows.indexOf(el);
      if (from < 0 || total < 2) return;
      let step = (rows[0]?.offsetHeight ?? 40) + 6;
      if (rows.length >= 2) {
        const d = rows[1].offsetTop - rows[0].offsetTop;
        if (d > 0) step = d;
      }
      const c: DragCtx = {
        el, listEl, rows, startY: e.clientY, step, from, to: from, total,
        active: false, armed: !touchMode, touchLocked: false,
        armTimer: null as ReturnType<typeof setTimeout> | null,
      };
      drag = c;
      if (touchMode) {
        // 触屏：立刻拿到手势所有权（否则浏览器按 pan-y 接管，pointermove 会变成 pointercancel —— 拖拽静默失效）
        c.el.style.touchAction = 'none';
        c.touchLocked = true;
        // 按住窗口内不动 → 认定为长按（此后第一次移动即起拖）
        c.armTimer = setTimeout(() => {
          if (drag === c) c.armed = true;
          c.armTimer = null;
        }, TOUCH_ARM_MS);
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
    const movable = rows.slice(0, visible.length);
    for (const el of movable) attachDrag(el, listEl, movable);
  }

  // 触屏长按：压住浏览器长按菜单（真机上不压住会先弹选择框，拖拽根本起不来）
  root.addEventListener('contextmenu', (e) => {
    if (drag) e.preventDefault();
  });
  // 拖拽期间的意外中断（切窗口/切端）兜底收尾
  window.addEventListener('blur', () => { if (drag) endDrag(); });

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
