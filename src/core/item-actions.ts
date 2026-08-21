/**
 * 统一「行操作条 / 跟手菜单」组件（手势统一试点，先接入 memo，后续域迁移复用）
 *
 * 交互约定（桌面 / 移动分离）：
 * - 桌面端：卡片 hover 显示操作条（.bz-item-actions，@media (hover: hover) 控制显隐，样式在 styles.css），
 *   点按钮直接执行（删除类由调用方接 confirm）。
 * - 移动/触屏端：长按卡片弹出跟手菜单（.bz-item-menu）——锚定手指位置，
 *   放不下自动翻到锚点另一侧，最后夹紧视口边界，保证菜单不超出屏幕。
 * - 桌面长按同样可用（与 hover 条同语义），长按松手后的残余 click 会被吞掉，防穿透卡片内链接/复选框。
 *
 * 实现说明：
 * - 复用 core/dom longPress（500ms 默认、10px 移动取消、短按补发合成 click）。
 * - 菜单注册 escManager（ESC 关闭）；点菜单外任意处关闭。
 */
import { longPress } from './dom';
import { escManager } from './esc-manager';

export interface ItemAction {
  /** 图标字符（emoji），操作条与菜单项共用，不再添加文案前缀 */
  icon: string;
  /** 菜单项文案（触屏菜单显示） */
  label: string;
  /** 桌面操作条 tooltip（空则不加 title） */
  title?: string;
  /** 危险操作（删除类）：菜单项红色强调 */
  kind?: 'normal' | 'danger';
  onClick: () => void;
}

/** 菜单与视口边距（px） */
const VIEWPORT_PAD = 8;
/** 菜单相对手指锚点的偏移（px），先往右下放，放不下翻另一侧 */
const ANCHOR_GAP = 12;
/** 估算兜底（jsdom/测量为 0 时）：单菜单项高 + 内边距 */
const ITEM_HEIGHT = 40;
const MENU_PADDING = 14;

let menuEl: HTMLElement | null = null;
let menuEsc: ReturnType<typeof escManager.register> | null = null;
/**
 * 长按残余 click 抑制（仅桌面鼠标路径）：
 * 长按松开时浏览器会补发一次 click，若不处理会穿透到卡片内链接/复选框。
 * 机制：菜单打开后注册 mouseup 捕获——松手（mouseup 落在菜单外）标记 residualClickArmed，
 * 紧随其后的 click 判定为残余（同一物理手势）吞掉；松手落在菜单内（拖动选择）则不吞。
 */
let suppressNextClick = false;
let residualClickArmed = false;

/** 文档捕获层 mousedown：点菜单外任意处按下即关闭菜单 */
function onMouseDownCapture(ev: MouseEvent): void {
  if (menuEl && menuEl.isConnected && !menuEl.contains(ev.target as Node)) {
    closeItemMenu();
  }
}

/** 文档捕获层 mouseup：长按松手标记残余 click（落在菜单内 = 拖动选择，不标记） */
function onMouseUpCapture(ev: MouseEvent): void {
  if (!suppressNextClick) return;
  if (menuEl && menuEl.isConnected && menuEl.contains(ev.target as Node)) return;
  suppressNextClick = false;
  residualClickArmed = true;
}

/** 文档捕获层 click：吞残余 click；其余外部点击关闭菜单（触屏路径无 mousedown，这里兜底） */
function onClickCapture(ev: MouseEvent): void {
  const target = ev.target as Node;
  if (residualClickArmed) {
    residualClickArmed = false;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    return;
  }
  if (menuEl && menuEl.isConnected && !menuEl.contains(target)) {
    closeItemMenu();
  }
}

/** 关闭当前菜单（幂等） */
export function closeItemMenu(): void {
  if (menuEsc) {
    menuEsc.unregister();
    menuEsc = null;
  }
  document.removeEventListener('mousedown', onMouseDownCapture, true);
  document.removeEventListener('mouseup', onMouseUpCapture, true);
  document.removeEventListener('click', onClickCapture, true);
  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }
  suppressNextClick = false;
  residualClickArmed = false;
}

/**
 * 定位菜单：跟手 + 防溢出。
 * 目标锚点 (x, y) 为手指/光标位置；先放右下（+偏移），放不下翻到左侧/上方，最后夹紧视口。
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

/** 打开跟手菜单（closeItemMenu 幂等前置） */
export function openItemMenu(x: number, y: number, actions: ItemAction[], suppressResidualClick = false): void {
  closeItemMenu();
  const m = document.createElement('div');
  m.className = 'bz-item-menu';
  m.style.visibility = 'hidden';
  for (const a of actions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'bz-item-menu-item' + (a.kind === 'danger' ? ' bz-item-menu-item--danger' : '');
    item.innerHTML = `<span class="bz-item-menu-icon">${a.icon}</span><span class="bz-item-menu-label">${a.label}</span>`;
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
  menuEl = m;
  suppressNextClick = suppressResidualClick;
  residualClickArmed = false;
  document.addEventListener('mousedown', onMouseDownCapture, true);
  document.addEventListener('mouseup', onMouseUpCapture, true);
  document.addEventListener('click', onClickCapture, true);
  menuEsc = escManager.register('bz-item-menu', {
    isVisible: () => !!(menuEl && menuEl.isConnected),
    close: closeItemMenu,
  });
}

/**
 * 给列表卡片挂统一操作：桌面 hover 操作条 + 长按跟手菜单。
 * @param card 卡片元素（须为相对定位容器，见 styles.css .bz-item-card）
 * @param actions 操作项（顺序即显示顺序；删除类传 kind: 'danger' 并自行接 confirm）
 */
export function attachItemActions(card: HTMLElement, actions: ItemAction[]): void {
  if (!card || actions.length === 0) return;
  card.classList.add('bz-item-card');

  // 桌面操作条（hover 显示，显隐由 styles.css @media (hover: hover) 控制）
  const bar = document.createElement('div');
  bar.className = 'bz-item-actions';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-item-action' + (a.kind === 'danger' ? ' bz-item-action--danger' : '');
    btn.textContent = a.icon;
    if (a.title) btn.title = a.title;
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeItemMenu();
      a.onClick();
    });
    bar.appendChild(btn);
  }
  card.appendChild(bar);

  // 长按 → 跟手菜单（触屏主入口；桌面兼容，与 hover 条同语义）
  longPress(card, (ev: any) => {
    const pt = (ev.touches && ev.touches[0]) || ev;
    const isTouch = ev.type === 'touchstart';
    openItemMenu(pt.clientX, pt.clientY, actions, !isTouch);
  });
}