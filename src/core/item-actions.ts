/**
 * 统一「行操作条 / 长按浮层」组件（手势统一试点，先接入 memo，后续域迁移复用）
 *
 * 交互约定（桌面 / 移动分离）：
 * - 桌面端：卡片 hover 显示操作条（.bz-item-actions，@media (hover: hover) 控制显隐，样式在 styles.css），
 *   点按钮直接执行（删除类由调用方接 confirm）；长按出跟手小菜单（.bz-item-menu，锚定光标、防溢出）。
 * - 移动/触屏端：长按卡片弹「底部抽屉」（.bz-item-sheet，参照 B 站/网易云）——
 *   半透明遮罩 + 底部滑入面板，功能一行行列出，顶部显示该条目标题（网易云式：展示选中列表信息）。
 *
 * 防穿透机制：
 * - 桌面鼠标路径：长按松手浏览器补发 click → mouseup 捕获标记 residualClickArmed，紧随其后的 click 吞掉。
 * - 触屏路径：touchstart 被动监听（不 preventDefault，滚动不受影响），长按松手的合成 click
 *   在 TOUCH_SETTLE_MS 静置窗口内吞一次，防浮层刚打开就被当成「外部点击」关闭。
 *
 * 实现说明：
 * - 复用 core/dom longPress（500ms 默认、10px 移动取消）。
 * - 浮层注册 escManager（ESC 关闭）；点浮层外任意处关闭（遮罩点击 = 关闭）。
 */
import { longPress } from './dom';
import { escManager } from './esc-manager';
import { isMobileEnv } from './mobile';
import { setIcon, type IconName } from 'obsidian';

export interface ItemAction {
  /** Obsidian 内置 lucide 图标 id（如 'pencil'/'trash-2'/'star'），经 setIcon 渲染原生 SVG；尺寸由 styles.css 控制 */
  icon: IconName;
  /** 菜单项文案（浮层显示） */
  label: string;
  /** 桌面操作条 tooltip（空则不加 title） */
  title?: string;
  /** 危险操作（删除类）：浮层项红色强调 */
  kind?: 'normal' | 'danger';
  onClick: () => void;
}

/** 渲染 Obsidian 原生图标（未知 id 静默忽略） */
function renderIcon(container: HTMLElement, iconId: IconName): void {
  try {
    setIcon(container, iconId);
  } catch (e) {
    /* 未知图标 id：忽略 */
  }
}

/** 浮层附加信息（移动端抽屉顶部展示选中条目信息，参照网易云底部页） */
export interface ItemActionsOptions {
  /** 抽屉顶部自定义内容节点（如条目标题 + 完整 meta 行，与列表显示一致）；未传时回退到 sheetTitle/sheetSub */
  sheetHead?: HTMLElement;
  /** 抽屉顶部标题（未传 sheetHead 时使用） */
  sheetTitle?: string;
  /** 抽屉顶部副标题（未传 sheetHead 时使用） */
  sheetSub?: string;
  /** 长按触发过滤器：返回 false 的按压不弹浮层（如正文文字区——让位系统长按选字/复制） */
  longPressFilter?: (e: any) => boolean;
}

/** 浮层与视口边距（px，桌面跟手菜单用） */
const VIEWPORT_PAD = 8;
/** 菜单相对光标锚点的偏移（px），先往右下放，放不下翻另一侧 */
const ANCHOR_GAP = 12;
/** 估算兜底（jsdom/测量为 0 时）：单菜单项高 + 内边距（与 styles.css 菜单紧凑尺寸对应） */
const ITEM_HEIGHT = 30;
const MENU_PADDING = 10;
/** 触屏合成 click 静置窗口（ms）：长按松手到合成 click 派发通常 <300ms */
const TOUCH_SETTLE_MS = 400;

/** 当前浮层：跟手小菜单 或 底部抽屉 */
let popupEl: HTMLElement | null = null;
/** 底部抽屉遮罩（仅移动端抽屉） */
let sheetMask: HTMLElement | null = null;
let menuEsc: ReturnType<typeof escManager.register> | null = null;
/**
 * 长按残余 click 抑制（桌面鼠标路径）：
 * 长按松开时浏览器会补发一次 click，若不处理会穿透到卡片内链接/复选框。
 * 机制：浮层打开后注册 mouseup 捕获——松手（mouseup 落在浮层外）标记 residualClickArmed，
 * 紧随其后的 click 判定为残余（同一物理手势）吞掉；松手落在浮层内（拖动选择）则不吞。
 */
let suppressNextClick = false;
let residualClickArmed = false;
/** 触屏路径：长按松手后浏览器补发的合成 click（touchstart 不再 preventDefault）——打开后短暂窗口吞一次，防浮层闪关 */
let touchSettlePending = false;
let touchSettleTimer: ReturnType<typeof setTimeout> | null = null;

/** 文档捕获层 mousedown：点浮层外任意处按下即关闭 */
function onMouseDownCapture(ev: MouseEvent): void {
  if (popupEl && popupEl.isConnected && !popupEl.contains(ev.target as Node)) {
    closeItemMenu();
  }
}

/** 文档捕获层 mouseup：长按松手标记残余 click（落在浮层内 = 拖动选择，不标记） */
function onMouseUpCapture(ev: MouseEvent): void {
  if (!suppressNextClick) return;
  if (popupEl && popupEl.isConnected && popupEl.contains(ev.target as Node)) return;
  suppressNextClick = false;
  residualClickArmed = true;
}

/** 文档捕获层 click：吞残余/合成 click；其余外部点击关闭浮层（触屏路径无 mousedown，这里兜底） */
function onClickCapture(ev: MouseEvent): void {
  const target = ev.target as Node;
  if (residualClickArmed) {
    residualClickArmed = false;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    return;
  }
  if (touchSettlePending) {
    touchSettlePending = false;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    return;
  }
  if (popupEl && popupEl.isConnected && !popupEl.contains(target)) {
    closeItemMenu();
  }
}

/** 关闭当前浮层（幂等）：跟手菜单 / 抽屉 + 遮罩，一并清理 */
export function closeItemMenu(): void {
  if (menuEsc) {
    menuEsc.unregister();
    menuEsc = null;
  }
  if (touchSettleTimer) {
    clearTimeout(touchSettleTimer);
    touchSettleTimer = null;
  }
  document.removeEventListener('mousedown', onMouseDownCapture, true);
  document.removeEventListener('mouseup', onMouseUpCapture, true);
  document.removeEventListener('click', onClickCapture, true);
  if (sheetMask) {
    sheetMask.remove();
    sheetMask = null;
  }
  if (popupEl) {
    popupEl.remove();
    popupEl = null;
  }
  suppressNextClick = false;
  residualClickArmed = false;
  touchSettlePending = false;
}

/** 打开触屏合成 click 静置窗口（长按松手后的合成 click 吞一次） */
function armTouchSettle(): void {
  touchSettlePending = true;
  if (touchSettleTimer) clearTimeout(touchSettleTimer);
  touchSettleTimer = setTimeout(() => {
    touchSettlePending = false;
    touchSettleTimer = null;
  }, TOUCH_SETTLE_MS);
}

/** 注册浮层通用监听（外部点击关闭 / 残余 click 抑制 / ESC） */
function attachPopupListeners(id: string): void {
  document.addEventListener('mousedown', onMouseDownCapture, true);
  document.addEventListener('mouseup', onMouseUpCapture, true);
  document.addEventListener('click', onClickCapture, true);
  menuEsc = escManager.register(id, {
    isVisible: () => !!(popupEl && popupEl.isConnected),
    close: closeItemMenu,
  });
}

/**
 * 定位桌面跟手菜单：锚点 (x, y) 为光标位置；先放右下（+偏移），放不下翻到左侧/上方，最后夹紧视口。
 */
function positionMenu(m: HTMLElement, x: number, y: number): void {
  // 尺寸测量（挂载后取；jsdom 恒 0 → 估算兜底，保证测试与真机路径一致）
  const mw = m.offsetWidth || 168;
  const mh = m.offsetHeight || m.children.length * ITEM_HEIGHT + MENU_PADDING;
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;

  let left = x + ANCHOR_GAP;
  let top = y + ANCHOR_GAP;
  if (vw && left + mw > vw - VIEWPORT_PAD) left = Math.max(VIEWPORT_PAD, x - mw - ANCHOR_GAP);
  if (vh && top + mh > vh - VIEWPORT_PAD) top = Math.max(VIEWPORT_PAD, y - mh - ANCHOR_GAP);
  if (vw) left = Math.min(Math.max(left, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, vw - mw - VIEWPORT_PAD));
  if (vh) top = Math.min(Math.max(top, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, vh - mh - VIEWPORT_PAD));
  m.style.left = `${left}px`;
  m.style.top = `${top}px`;
}

/** 桌面跟手菜单（鼠标长按；anchored at 光标，防溢出） */
export function openItemMenu(x: number, y: number, actions: ItemAction[], suppressResidualClick = false): void {
  closeItemMenu();
  const m = document.createElement('div');
  m.className = 'bz-item-menu';
  m.style.visibility = 'hidden';
  for (const a of actions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'bz-item-menu-item' + (a.kind === 'danger' ? ' bz-item-menu-item--danger' : '');
    const itemIcon = document.createElement('span');
    itemIcon.className = 'bz-item-menu-icon';
    renderIcon(itemIcon, a.icon);
    const itemLabel = document.createElement('span');
    itemLabel.className = 'bz-item-menu-label';
    itemLabel.textContent = a.label;
    item.appendChild(itemIcon);
    item.appendChild(itemLabel);
    item.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeItemMenu();
      a.onClick();
    });
    m.appendChild(item);
  }
  document.body.appendChild(m);
  positionMenu(m, x, y);
  m.style.visibility = 'visible';
  popupEl = m;
  suppressNextClick = suppressResidualClick;
  residualClickArmed = false;
  if (!suppressResidualClick) armTouchSettle();
  attachPopupListeners('bz-item-menu');
}

/** 移动端底部抽屉（长按卡片弹出；遮罩 + 顶部信息 + 功能一行行列出） */
export function openItemSheet(actions: ItemAction[], opts?: ItemActionsOptions, suppressResidualClick = false): void {
  closeItemMenu();
  const mask = document.createElement('div');
  mask.className = 'bz-item-sheet-mask';
  const sheet = document.createElement('div');
  sheet.className = 'bz-item-sheet';
  if (opts?.sheetHead) {
    const head = document.createElement('div');
    head.className = 'bz-item-sheet-head';
    head.appendChild(opts.sheetHead);
    sheet.appendChild(head);
  } else if (opts?.sheetTitle) {
    const head = document.createElement('div');
    head.className = 'bz-item-sheet-head';
    const titleEl = document.createElement('div');
    titleEl.className = 'bz-item-sheet-title';
    titleEl.textContent = opts.sheetTitle;
    head.appendChild(titleEl);
    if (opts.sheetSub) {
      const subEl = document.createElement('div');
      subEl.className = 'bz-item-sheet-sub';
      subEl.textContent = opts.sheetSub;
      head.appendChild(subEl);
    }
    sheet.appendChild(head);
  }
  // 功能项区：项多时内部滚动（最大 70vh，隐藏滚动条，styles.css）
  const body = document.createElement('div');
  body.className = 'bz-item-sheet-body';
  for (const a of actions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'bz-item-sheet-item' + (a.kind === 'danger' ? ' bz-item-sheet-item--danger' : '');
    const itemIcon = document.createElement('span');
    itemIcon.className = 'bz-item-sheet-icon';
    renderIcon(itemIcon, a.icon);
    const itemLabel = document.createElement('span');
    itemLabel.className = 'bz-item-sheet-label';
    itemLabel.textContent = a.label;
    item.appendChild(itemIcon);
    item.appendChild(itemLabel);
    item.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeItemMenu();
      a.onClick();
    });
    body.appendChild(item);
  }
  sheet.appendChild(body);
  document.body.appendChild(mask);
  document.body.appendChild(sheet);
  popupEl = sheet;
  sheetMask = mask;
  suppressNextClick = suppressResidualClick; // 鼠标路径：残余 click 由 mouseup 标记吞；触屏路径：走合成 click 静置窗口
  residualClickArmed = false;
  if (!suppressResidualClick) armTouchSettle();
  attachPopupListeners('bz-item-sheet');
  attachSheetDismiss(sheet, body);
}

/** 下滑关闭手势：按住抽屉下拉跟随位移、遮罩变淡；松手超阈值滑出关闭，未超回弹 */
function attachSheetDismiss(sheet: HTMLElement, body: HTMLElement): void {
  const CLOSE_AT = 80; // 松手关闭阈值（px）
  let startY = 0;
  let dragging = false;
  let dy = 0;

  const reset = () => {
    dragging = false;
    dy = 0;
    sheet.style.transform = '';
    sheet.classList.remove('bz-item-sheet--dragging');
  };

  sheet.addEventListener(
    'touchstart',
    (e) => {
      const t = (e as any).touches && (e as any).touches[0];
      if (!t) return;
      startY = t.clientY;
      dragging = true;
      dy = 0;
    },
    { passive: true }
  );

  sheet.addEventListener(
    'touchmove',
    (e) => {
      if (!dragging) return;
      const t = (e as any).touches && (e as any).touches[0];
      if (!t) return;
      const cur = t.clientY - startY;
      // 上滑：不接管（留给功能项区滚动）；已拖过则回弹复位
      if (cur <= 0) {
        if (dy !== 0) reset();
        return;
      }
      // 功能项区内已向下滚动（scrollTop>0）：滚动优先，不接管为下拉关闭
      if (body.scrollTop > 0 && body.contains(e.target as Node)) {
        if (dy !== 0) reset();
        return;
      }
      dy = cur;
      e.preventDefault(); // 接管：禁止滚动，纯下拉
      sheet.classList.add('bz-item-sheet--dragging');
      sheet.style.transform = `translateY(${dy}px)`;
      if (sheetMask) sheetMask.style.opacity = String(Math.max(0, 1 - dy / 400));
    },
    { passive: false }
  );

  const onTouchEnd = () => {
    if (!dragging) return;
    const over = dy > CLOSE_AT;
    dragging = false;
    if (over) {
      // 滑出动画后移除（遮罩同步淡出）
      sheet.classList.remove('bz-item-sheet--dragging');
      const s = sheet;
      s.style.transform = 'translateY(100%)';
      if (sheetMask) sheetMask.style.opacity = '0';
      setTimeout(() => {
        if (popupEl === s) closeItemMenu();
      }, 180);
    } else {
      reset();
      if (sheetMask) sheetMask.style.opacity = '1';
    }
    dy = 0;
  };
  sheet.addEventListener('touchend', onTouchEnd);
  sheet.addEventListener('touchcancel', () => {
    reset();
    if (sheetMask) sheetMask.style.opacity = '1';
  });
}

/**
 * 给列表卡片挂统一操作：桌面 hover 操作条 + 长按浮层（移动端底部抽屉 / 桌面跟手小菜单）。
 * @param card 卡片元素（须为相对定位容器，见 styles.css .bz-item-card）
 * @param actions 操作项（顺序即显示顺序；删除类传 kind: 'danger' 并自行接 confirm）
 * @param opts 抽屉顶部信息（移动端显示选中条目信息，参照网易云）
 */
export function attachItemActions(card: HTMLElement, actions: ItemAction[], opts?: ItemActionsOptions): void {
  if (!card || actions.length === 0) return;
  card.classList.add('bz-item-card');

  // 桌面操作条（hover 显示，显隐由 styles.css @media (hover: hover) 控制）
  const bar = document.createElement('div');
  bar.className = 'bz-item-actions';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-item-action' + (a.kind === 'danger' ? ' bz-item-action--danger' : '');
    renderIcon(btn, a.icon); // 原生 lucide svg，颜色继承 currentColor
    if (a.title) btn.title = a.title;
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeItemMenu();
      a.onClick();
    });
    bar.appendChild(btn);
  }
  card.appendChild(bar);

  // 长按 → 移动端底部抽屉 / 桌面跟手菜单；longPressFilter 排除区域（如正文文字）让位系统长按选字复制
  longPress(
    card,
    (ev: any) => {
      const isMouse = ev.type !== 'touchstart';
      if (isMobileEnv()) {
        openItemSheet(actions, opts, isMouse);
        return;
      }
      const pt = (ev.touches && ev.touches[0]) || ev;
      openItemMenu(pt.clientX, pt.clientY, actions, isMouse);
    },
    undefined,
    opts?.longPressFilter
  );
}