/**
 * core/item-actions 测试（手势统一试点）：桌面操作条 + 长按跟手菜单
 * 覆盖：操作条按钮、长按出菜单、跟手定位防溢出（右下放不下翻左/上）、
 * 残余 click 抑制、外部点击/ESC 关闭、菜单项执行。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { attachItemActions, closeItemMenu, openItemMenu, type ItemAction } from '../../src/core/item-actions';
import { Platform as MockPlatform } from '../mock-obsidian-entry';

const ACTIONS: ItemAction[] = [
  { icon: 'external-link', label: '打开', title: '打开', onClick: () => (window as any).__opened = true },
  { icon: 'pencil', label: '编辑', title: '编辑', onClick: () => (window as any).__edited = true },
  { icon: 'trash-2', label: '删除', title: '删除', kind: 'danger', onClick: () => (window as any).__deleted = true },
];

function makeCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'todo-card';
  const link = document.createElement('a');
  link.className = 'bz-todo-link';
  link.textContent = '标题';
  link.onclick = () => (window as any).__linkClicked = true;
  card.appendChild(link);
  return card;
}

function longPressOn(card: HTMLElement, x = 60, y = 60) {
  card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: x, clientY: y }));
  vi.advanceTimersByTime(550);
}

describe('attachItemActions：桌面操作条', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (window as any).__opened = false;
    (window as any).__edited = false;
    (window as any).__deleted = false;
    (window as any).__linkClicked = false;
  });

  it('注入操作条：顺序 = 打开/编辑/删除，原生 lucide 图标（setIcon 到 dataset.icon），危险项带 danger 类', () => {
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    expect(card.classList.contains('bz-item-card')).toBe(true);
    const btns = card.querySelectorAll('.bz-item-action');
    expect(btns.length).toBe(3);
    // Obsidian 原生图标：mock setIcon 记录 dataset.icon（真实环境渲染 lucide svg）
    expect((btns[0] as HTMLElement).dataset.icon).toBe('external-link');
    expect((btns[1] as HTMLElement).dataset.icon).toBe('pencil');
    expect((btns[2] as HTMLElement).dataset.icon).toBe('trash-2');
    expect(btns[2].classList.contains('bz-item-action--danger')).toBe(true);
    expect((btns[0] as HTMLElement).title).toBe('打开');
  });

  it('空操作列表：不注入任何东西，也不影响卡片', () => {
    const card = makeCard();
    attachItemActions(card, []);
    expect(card.querySelector('.bz-item-actions')).toBeNull();
  });

  it('longPressFilter：排除区域长按不弹浮层（让位系统选字/复制），其他区域正常', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS, {
      longPressFilter: (e) => !(e.target as HTMLElement).closest('.bz-todo-link'),
    });
    // 长按排除区（链接）→ 不弹
    const link = card.querySelector('.bz-todo-link') as HTMLElement;
    link.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    expect((window as any).__linkClicked).toBe(false);
    // 长按卡片其他区域 → 弹菜单
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    vi.useRealTimers();
  });

  it('点操作条按钮直接执行回调（桌面主路径）', () => {
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    const btns = card.querySelectorAll('.bz-item-action');
    (btns[0] as HTMLElement).click();
    expect((window as any).__opened).toBe(true);
    (btns[2] as HTMLElement).click();
    expect((window as any).__deleted).toBe(true);
  });
});

describe('长按跟手菜单（移动端主路径）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (window as any).__opened = false;
    (window as any).__edited = false;
    (window as any).__deleted = false;
    (window as any).__linkClicked = false;
  });

  it('长按出菜单：菜单项含文案，跟手定位在锚点右下方', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    longPressOn(card, 120, 100);
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.querySelectorAll('.bz-item-menu-item').length).toBe(3);
    expect(menu.textContent).toContain('打开');
    expect(menu.textContent).toContain('编辑');
    expect(menu.textContent).toContain('删除');
    // 原生图标进入图标容器（mock setIcon → dataset.icon）
    expect((menu.querySelector('.bz-item-menu-icon') as HTMLElement).dataset.icon).toBe('external-link');
    expect((menu.querySelector('.bz-item-sheet-icon') as HTMLElement)).toBeNull();
    // 锚点右下 +GAP：left=132, top=112（jsdom 视口放得下）
    expect(menu.style.left).toBe('132px');
    expect(menu.style.top).toBe('112px');
    vi.useRealTimers();
  });

  it('菜单防溢出：右下放不下 → 翻到锚点左/上方，并夹紧视口边界', () => {
    vi.useFakeTimers();
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { value: 240, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    longPressOn(card, 230, 290);
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    // 3 项菜单估算尺寸 168×100（jsdom offsetWidth/Height 恒 0 的兜底路径）
    const left = parseFloat(menu.style.left);
    const top = parseFloat(menu.style.top);
    // 不超出视口
    expect(left + 168).toBeLessThanOrEqual(240);
    expect(top + 100).toBeLessThanOrEqual(300);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    // 具体：左翻到锚点左侧（230-168-12=50），上翻到锚点上方（290-100-12=178）
    expect(menu.style.left).toBe('50px');
    expect(menu.style.top).toBe('178px');
    Object.defineProperty(window, 'innerWidth', { value: origW, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: origH, configurable: true });
    vi.useRealTimers();
  });

  it('残余 click 抑制：长按松手补发的 click 被吞掉，菜单保持、卡片内链接不触发', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    longPressOn(card);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    expect((window as any).__linkClicked).toBe(false);
    vi.useRealTimers();
  });

  it('触屏长按：松手后的合成 click 在静置窗口内被吞（菜单不闪关、链接不触发），窗口过后菜单项可点', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    // 触屏路径：touchstart 长按出菜单（无 mouseup，走合成 click 静置窗口抑制）
    const ts = new MouseEvent('touchstart', { bubbles: true, clientX: 60, clientY: 60 });
    card.dispatchEvent(ts);
    vi.advanceTimersByTime(550);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    card.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    // 浏览器合成 click（400ms 窗口内）→ 吞掉：菜单保持打开、卡片链接不触发
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    expect((window as any).__linkClicked).toBe(false);
    // 静置窗口过后，菜单项正常可点
    vi.advanceTimersByTime(500);
    const editItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    expect((window as any).__edited).toBe(true);
    vi.useRealTimers();
  });

  it('点菜单项：执行回调并关闭菜单', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    longPressOn(card);
    const editItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    expect((window as any).__edited).toBe(true);
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    vi.useRealTimers();
  });

  it('点菜单外任意处关闭；ESC 也关闭', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    longPressOn(card);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    // 点外部
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    // 再开，ESC 关
    longPressOn(card);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    vi.useRealTimers();
  });
});

describe('移动端底部抽屉（Platform.isMobile = true）', () => {
  const SHEET_OPTS = { sheetTitle: '抽屉标题', sheetSub: '#工作' };

  beforeEach(() => {
    document.body.innerHTML = '';
    (window as any).__opened = false;
    (window as any).__edited = false;
    (window as any).__deleted = false;
    (window as any).__linkClicked = false;
    MockPlatform.isMobile = true;
  });

  afterEach(() => {
    MockPlatform.isMobile = false;
    closeItemMenu();
  });

  /** 鼠标路径长按开抽屉 + 消费残余 click（与服务测试同构：mouseup 标记 → click 被吞） */
  function openSheet(card: HTMLElement) {
    longPressOn(card);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  it('长按卡片 → 遮罩 + 底部抽屉：顶部显示选中条目信息，功能一行行列出', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS, SHEET_OPTS);
    openSheet(card);
    const mask = document.querySelector('.bz-item-sheet-mask');
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(mask).not.toBeNull();
    expect(sheet).not.toBeNull();
    // 顶部信息区（网易云式）
    expect(sheet.querySelector('.bz-item-sheet-title')!.textContent).toBe('抽屉标题');
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toBe('#工作');
    // 功能项一行行列出（打开/编辑/删除）
    const items = sheet.querySelectorAll('.bz-item-sheet-item');
    expect(items.length).toBe(3);
    expect(sheet.textContent).toContain('删除');
    // 原生图标进入图标容器（mock setIcon → dataset.icon）
    expect((items[0].querySelector('.bz-item-sheet-icon') as HTMLElement).dataset.icon).toBe('external-link');
    expect((items[2].querySelector('.bz-item-sheet-icon') as HTMLElement).dataset.icon).toBe('trash-2');
    // 抽屉固定底部：不设 left/top（桌面跟手菜单才需要锚点定位）
    expect(sheet.style.left).toBe('');
    expect(sheet.style.top).toBe('');
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    vi.useRealTimers();
  });

  it('无标题选项 → 抽屉不渲染顶部信息区（纯功能列表）', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    openSheet(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet.querySelector('.bz-item-sheet-head')).toBeNull();
    vi.useRealTimers();
  });

  it('点抽屉项：执行回调并关闭（遮罩与抽屉都移除）', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS, SHEET_OPTS);
    openSheet(card);
    const editItem = [...document.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    expect((window as any).__edited).toBe(true);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect(document.querySelector('.bz-item-sheet-mask')).toBeNull();
    vi.useRealTimers();
  });

  it('点遮罩关闭；ESC 也关闭', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS, SHEET_OPTS);
    openSheet(card);
    // 点遮罩
    document.querySelector('.bz-item-sheet-mask')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    // 再开，ESC 关
    openSheet(card);
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect(document.querySelector('.bz-item-sheet-mask')).toBeNull();
    vi.useRealTimers();
  });

  it('触屏长按：松手后的合成 click 被吞（抽屉不闪关、卡片链接不触发）', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS, SHEET_OPTS);
    const ts = new MouseEvent('touchstart', { bubbles: true, clientX: 60, clientY: 60 });
    card.dispatchEvent(ts);
    vi.advanceTimersByTime(550);
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    card.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    expect((window as any).__linkClicked).toBe(false);
    vi.useRealTimers();
  });

  it('功能项区：项收进 .bz-item-sheet-body（内部滚动、最高 70vh、无滚动条由样式承载）', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS, SHEET_OPTS);
    openSheet(card);
    const body = document.querySelector('.bz-item-sheet-body') as HTMLElement;
    expect(body).not.toBeNull();
    expect(body.querySelectorAll('.bz-item-sheet-item').length).toBe(3);
    expect(document.querySelector('.bz-item-sheet-head')).not.toBeNull();
    // 头部信息区与功能项区分层：head 与 body 是兄弟
    expect((body.previousElementSibling as HTMLElement).classList.contains('bz-item-sheet-head')).toBe(true);
    vi.useRealTimers();
  });

  it('下滑关闭：拖动跟随位移、遮罩变淡；松手超阈值 → 滑出动画后移除', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS, SHEET_OPTS);
    openSheet(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const mask = document.querySelector('.bz-item-sheet-mask') as HTMLElement;
    // touchstart → touchmove 下拉 100px
    const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ts, 'touches', { value: [{ clientY: 100 }] });
    sheet.dispatchEvent(ts);
    const tm = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(tm, 'touches', { value: [{ clientY: 200 }] });
    sheet.dispatchEvent(tm);
    expect(sheet.style.transform).toBe('translateY(100px)');
    expect(sheet.classList.contains('bz-item-sheet--dragging')).toBe(true);
    expect(parseFloat(mask.style.opacity)).toBeLessThan(1); // 遮罩变淡
    // 松手（100 > 80 阈值）→ 滑出动画
    sheet.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    expect(sheet.style.transform).toBe('translateY(100%)');
    expect(mask.style.opacity).toBe('0');
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull(); // 动画中未移除
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect(document.querySelector('.bz-item-sheet-mask')).toBeNull();
    vi.useRealTimers();
  });

  it('下滑未超阈值 → 回弹：transform 清空、遮罩恢复', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS, SHEET_OPTS);
    openSheet(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const mask = document.querySelector('.bz-item-sheet-mask') as HTMLElement;
    const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ts, 'touches', { value: [{ clientY: 100 }] });
    sheet.dispatchEvent(ts);
    const tm = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(tm, 'touches', { value: [{ clientY: 140 }] }); // 40px < 80
    sheet.dispatchEvent(tm);
    sheet.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    expect(sheet.style.transform).toBe('');
    expect(sheet.classList.contains('bz-item-sheet--dragging')).toBe(false);
    expect(mask.style.opacity).toBe('1');
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    vi.useRealTimers();
  });

  it('功能项区已向下滚动（scrollTop>0）且触摸在区内 → 不接管为下拉关闭', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS, SHEET_OPTS);
    openSheet(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const body = document.querySelector('.bz-item-sheet-body') as HTMLElement;
    body.scrollTop = 50; // 模拟已滚动
    const item = body.querySelector('.bz-item-sheet-item') as HTMLElement;
    const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ts, 'touches', { value: [{ clientY: 100 }] });
    item.dispatchEvent(ts);
    const tm = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(tm, 'touches', { value: [{ clientY: 200 }] });
    item.dispatchEvent(tm);
    expect(sheet.style.transform).toBe(''); // 未接管
    item.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    vi.useRealTimers();
  });
});

describe('openItemMenu / closeItemMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('手动打开菜单可指定锚点与抑制行为；closeItemMenu 幂等清理', () => {
    openItemMenu(10, 10, ACTIONS, false);
    const menu = document.querySelector('.bz-item-menu');
    expect(menu).not.toBeNull();
    closeItemMenu();
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    closeItemMenu(); // 幂等不抛
  });

  afterEach(() => {
    closeItemMenu();
  });
});