/**
 * 「首页入口」内联编辑器（设置面板 → 首页 → **入口**组；2026-09-10 用户拍板）。
 *
 * 形态演进：浮层弹窗（带遮罩/ESC）→ **面板内联**（settings.ts 用 custom 行挂进插槽）。
 * **按端各一份、互不影响、互相不能修改**（用户拍板）：
 *  - 桌面端打开设置面板 → 只显示、只修改 `desk` 那套（顺序 + hiddenDesk）；
 *  - 移动端打开 → 只显示、只修改 `mob` 那套（顺序 + hiddenMob）；
 *  - 没有「桌面/移动」切换段 —— 另一端的数据本端既看不到也改不到。
 * 为何不做成可切：两端屏幕上的入口形态本就不同（桌面是入口行、移动是两列瓦片），
 * 在一端调另一端的顺序只能靠想象；拍板结论是各端只调自己。
 *
 * 版式（2026-09-11 用户拍板）：
 *  - **无说明小字**（原「拖动排序 · 点 × 移除…」灰字删除）；
 *  - **列表靠左、左边不留内边距**（挂 .bz-home-ent-flush 把宿主行的左内边距清零，
 *    见 styles.css）——拖柄贴到卡片左缘，整块更宽；右边照常留边距。
 *
 * 交互：拖动排序（Pointer Events；触屏先按住 ~250ms 再拖，短滑归列表滚动）+ 点 × 移除（隐藏）。
 * **移除的域不进独立分区、也无「已隐藏」标题**（用户 2026-09-10 拍板）：就地排到列表最下面，
 * 弱化显示、无拖柄（不参与排序），点 + 即可加回可见列尾部。改动即时落盘 home.json（无保存按钮）。
 *
 * 拖拽实现（2026-09-11 用户报 bug 后重写，两条都不再靠浏览器默认行为兜底）：
 *  - **让位动画**：被拖行只在自己那条 transform 轨道上跟手，**其余行按「谁被跨过」反向位移一格**
 *    （.bz-home-ent-shift，配 CSS transition）——此前只移动自身，其它行纹丝不动（用户看到的「没有动态效果」）。
 *  - **触屏滚动仲裁（2026-09-12 补扫 E 重写，不再抢 touch-action）**：此前 pointerdown 立刻把
 *    `touch-action` 置 `none` 想「短滑时再交还滚动」——但 touch-action 在手势起点一次性裁决，
 *    **进行中的手势中途改它不生效**（pointerdown 置 none 确实能拿住手势，可 endDrag 里还原
 *    对本次触摸已是马后炮）：短滑既不拖也不滚，成了死手势。现改为 pointerdown 不动
 *    touch-action，挂非 passive `touchmove` 仲裁滚动归属：未按满长按窗口（未 armed）→ 不
 *    preventDefault，原生滚动照常（短滑=滚列表）；armed 后 → preventDefault 拦下滚动，
 *    浏览器不再起滚动/不发 pointercancel，第一次移动即起拖。
 *  - 触屏不用「按满 250ms 自动进拖拽」：那会让「按住想滚动」的用户突然进入拖拽态；
 *    改为「按住 ≥250ms 后，第一次移动才真正起拖」——用户看到的是「按住不动、一动就跟着走」。
 */
import { isMobileEnv } from '../core/mobile';
import { notice } from '../core/notice';
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
/** 宿主行「右边不留内边距」标记类（挂到祖先 .bz-sp-set-row 上；样式见 styles.css） */
const FLUSH_CLS = 'bz-home-ent-flush';

/** window blur 兜底监听的信号源（D 补扫 home P3）：设置面板每次渲染首页域都会重新 mount，
 *  blur 挂在 window 上不随 DOM 移除——裸 addEventListener 会逐次叠加（有界泄漏）。
 *  记录最近一次 mount 的 AbortController，重建时 abort 旧的，window 上永远只有最新一份 */
let blurController: AbortController | null = null;

/** 把编辑器挂进设置面板的 custom 行插槽（域侧只调这一支） */
export function mountHomeEntryEditor(body: HTMLElement, app: App): void {
  // D：重建即摘除上一次 mount 的 blur 监听（signal abort），再为本轮发新信号
  blurController?.abort();
  blurController = new AbortController();
  const scope: HomeOrderScope = isMobileEnv() ? 'mob' : 'desk';
  const touchMode = isMobileEnv();
  let order: HomeOrder | null = null;
  /** 拖拽落点那一下的点击抑制（防松手误触 ×/+） */
  let suppressClickUntil = 0;

  const root = document.createElement('div');
  root.className = 'bz-home-ent';
  root.setAttribute('data-ent-scope', scope);
  body.appendChild(root);

  // 列表靠左（用户 2026-09-11 拍板）：宿主 custom 行左侧内边距清零，
  // 行自身再收掉左 padding → 拖柄贴卡片左缘。CSS 管不着祖先，故由这里挂个标记类。
  const hostRow = body.closest('.bz-sp-set-row');
  if (hostRow) hostRow.classList.add(FLUSH_CLS);

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
    // 提交读到的整份 order（含另一端），本端编辑不动另一端；
    // 失败不再静默（H13）：静默回弹会让用户以为排序已存
    void saveHomeConfig(order, app).catch(() => {
      notice('入口顺序保存失败，重开设置后会回到原顺序', 'error');
    });
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
    armTimer: ReturnType<typeof setTimeout> | null;
  }
  let drag: DragCtx | null = null;

  /**
   * 触屏滚动仲裁（E 修复）：touch-action 不抢（进行中的手势中途改它不生效），
   * 改在非 passive touchmove 里决定滚动归属——无拖拽上下文或未 armed（按住窗口内）→
   * 放行原生滚动（短滑=滚列表）；armed 后 → preventDefault 拦下滚动，拖拽独占手势。
   */
  function onTouchMove(e: TouchEvent): void {
    if (!drag || !drag.armed) return;
    if (e.cancelable) e.preventDefault();
  }

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
    window.removeEventListener('touchmove', onTouchMove);
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
        // 触屏按住窗口内：位移过大 = 用户在滚列表（touchmove 仲裁未拦截，原生滚动照常），
        // 直接收掉本次候选拖拽，不 preventDefault
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
        active: false, armed: !touchMode,
        armTimer: null as ReturnType<typeof setTimeout> | null,
      };
      drag = c;
      if (touchMode) {
        // 触屏滚动仲裁（E 修复）：不动 touch-action（对手势进行中的裁决无效），改挂
        // 非 passive touchmove——未 armed 放行原生滚动（短滑=滚列表），armed 后拦滚动起拖
        window.addEventListener('touchmove', onTouchMove, { passive: false });
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
    // 不挂说明小字（2026-09-11 用户拍板删除）：排版由拖柄与 ×/+ 自解释
    root.innerHTML = '<div class="bz-home-ent-list" data-ent-list>'
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
  // 拖拽期间的意外中断（切窗口/切端）兜底收尾（D：signal 挂钩，重建 mount 时随 abort 自动摘除）
  window.addEventListener(
    'blur',
    () => {
      if (drag) endDrag();
    },
    { signal: blurController.signal }
  );

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
