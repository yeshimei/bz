/**
 * core/item-actions 测试（手势统一）：右键跟手菜单（桌面）+ 长按抽屉（移动）
 * 覆盖：列表不注入图标排、右键出菜单（preventDefault 拦原生）、跟手定位防溢出（右下放不下翻左/上）、
 * 外部点击/ESC 关闭、菜单项执行；移动端遮罩抽屉、下滑关闭。
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

/** 桌面右键开菜单（同步，无补发 click） */
function rightClickOn(card: HTMLElement, x = 60, y = 60): MouseEvent {
  const ev = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: x, clientY: y });
  card.dispatchEvent(ev);
  return ev;
}

/** 移动端路径长按（mousedown 计时触发抽屉；需在 fake timers 下调用） */
function longPressOn(card: HTMLElement, x = 60, y = 60) {
  card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: x, clientY: y }));
  vi.advanceTimersByTime(550);
}

describe('attachItemActions：列表保持干净（无图标排）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (window as any).__opened = false;
    (window as any).__edited = false;
    (window as any).__deleted = false;
    (window as any).__linkClicked = false;
  });

  it('不注入任何常驻/hover 图标排，仅挂统一卡片类（入口只有浮层）', () => {
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    expect(card.classList.contains('bz-item-card')).toBe(true);
    expect(card.querySelector('.bz-item-actions')).toBeNull();
    expect(card.querySelectorAll('.bz-item-action').length).toBe(0);
  });

  it('空操作列表：不注入任何东西，也不影响卡片', () => {
    const card = makeCard();
    attachItemActions(card, []);
    expect(card.querySelector('.bz-item-actions')).toBeNull();
  });

  it('longPressFilter 排除区域右键不弹浮层且不拦原生菜单（让位系统选字/复制），其他区域正常弹+拦截', () => {
    const card = makeCard();
    attachItemActions(card, ACTIONS, {
      longPressFilter: (e) => !(e.target as HTMLElement).closest('.bz-todo-link'),
    });
    // 右键排除区（链接）→ 不弹菜单，也不 preventDefault（放行原生右键菜单）
    const link = card.querySelector('.bz-todo-link') as HTMLElement;
    const evFiltered = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 });
    Object.defineProperty(evFiltered, 'target', { value: link, configurable: true });
    link.dispatchEvent(evFiltered);
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    expect(evFiltered.defaultPrevented).toBe(false);
    // 右键卡片其他区域 → 弹菜单 + 拦截原生
    const ev = rightClickOn(card, 60, 60);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    expect(ev.defaultPrevented).toBe(true);
    closeItemMenu();
  });
});

describe('右键跟手菜单（桌面主路径）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (window as any).__opened = false;
    (window as any).__edited = false;
    (window as any).__deleted = false;
    (window as any).__linkClicked = false;
  });

  afterEach(() => {
    closeItemMenu();
  });

  it('右键出菜单：菜单项含文案与原生图标，tooltip 随动作 title；锚点右下方定位', () => {
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    rightClickOn(card, 120, 100);
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.querySelectorAll('.bz-item-menu-item').length).toBe(3);
    expect(menu.textContent).toContain('打开');
    expect(menu.textContent).toContain('编辑');
    expect(menu.textContent).toContain('删除');
    // 原生图标进入图标容器（mock setIcon → dataset.icon）
    expect((menu.querySelector('.bz-item-menu-icon') as HTMLElement).dataset.icon).toBe('external-link');
    expect((menu.querySelector('.bz-item-sheet-icon') as HTMLElement)).toBeNull();
    // tooltip 随 action.title（hover 操作条移除后的承载点）
    const editItem = [...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('编辑')) as HTMLElement;
    expect(editItem.title).toBe('编辑');
    // 锚点右下 +GAP：left=132, top=112（jsdom 视口放得下）
    expect(menu.style.left).toBe('132px');
    expect(menu.style.top).toBe('112px');
  });

  it('菜单不渲染右侧小字（sub 仅移动端抽屉显示）：带 sub 的动作在菜单仅图标 + 文案', () => {
    const card = makeCard();
    attachItemActions(card, [...ACTIONS, { icon: 'file-text', label: '字数', sub: '123 字', onClick: () => {} }]);
    rightClickOn(card);
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.querySelector('.bz-item-menu-item-sub')).toBeNull();
    expect(menu.textContent).not.toContain('123 字');
    expect(menu.textContent).toContain('字数');
  });

  it('菜单防溢出：右下放不下 → 翻到锚点左/上方，并夹紧视口边界', () => {
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { value: 240, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    rightClickOn(card, 230, 290);
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
  });

  it('右键路径无残余抑制：紧随的左键点击不被吞——外部点击关闭菜单、卡片链接正常触发', () => {
    const card = makeCard();
    document.body.appendChild(card); // 卡片须在 DOM（真实场景）；否则点击冒泡不到 document 捕获层
    attachItemActions(card, ACTIONS);
    rightClickOn(card);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    // 左键点卡片内链接（相对菜单为外部）→ 菜单关闭 + 链接自身点击生效
    const link = card.querySelector('.bz-todo-link') as HTMLElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    expect((window as any).__linkClicked).toBe(true);
  });

  it('点菜单项：执行回调并关闭菜单（右键后立即可点，无静置窗口）', () => {
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    rightClickOn(card);
    const editItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    expect((window as any).__edited).toBe(true);
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });

  it('点菜单外任意处关闭；ESC 也关闭', () => {
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    rightClickOn(card);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    // 点外部
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    // 再开，ESC 关
    rightClickOn(card);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });

  it('桌面鼠标长按不再触发任何浮层（右键接管）', () => {
    vi.useFakeTimers();
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(800);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    vi.useRealTimers();
  });

  it('键盘导航（UX 整改 38）：打开聚焦首项；↑↓ 循环选择；回车执行选中项', () => {
    const card = makeCard();
    document.body.appendChild(card);
    attachItemActions(card, ACTIONS);
    rightClickOn(card);
    const items = [...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[];
    expect(items).toHaveLength(3);
    // 打开即聚焦首个可交互项
    expect(document.activeElement).toBe(items[0]);
    // ↓ 依次移动
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[2]);
    // ↓ 到末尾循环回首项
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
    // ↑ 回退到末项
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(items[2]);
    // 回车/空格等价于点击（按钮原生激活）→ 执行选中项并关闭菜单
    (document.activeElement as HTMLElement).click();
    expect((window as any).__deleted).toBe(true);
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });

  it('键盘导航：↑↓ 不冒泡成页面滚动（preventDefault）；关闭后焦点还原到打开前元素', () => {
    const card = makeCard();
    document.body.appendChild(card);
    const focusTarget = document.createElement('button');
    focusTarget.textContent = '焦点锚点';
    document.body.appendChild(focusTarget);
    focusTarget.focus();
    attachItemActions(card, ACTIONS);
    rightClickOn(card);
    expect(document.activeElement).not.toBe(focusTarget);
    // 方向键已消费（无默认滚动行为；jsdom 无可观测滚动，这里验证不抛错 + 焦点仍在浮层内）
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(document.querySelectorAll('.bz-item-menu-item')[1]);
    // 关闭 → 焦点还原到打开前的锚点元素
    closeItemMenu();
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    expect(document.activeElement).toBe(focusTarget);
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

  it('键盘导航（UX 整改 38）：抽屉打开聚焦首项；↑↓ 在功能项区循环（头部自定义内容不参与）', () => {
    vi.useFakeTimers();
    const card = makeCard();
    // 头部带自定义按钮（sheetHead 路径）：不参与功能项 roving 范围
    const head = document.createElement('div');
    const headBtn = document.createElement('button');
    headBtn.className = 'sheet-head-btn';
    headBtn.textContent = '头部按钮';
    head.appendChild(headBtn);
    attachItemActions(card, ACTIONS, { sheetHead: head });
    openSheet(card);
    const items = [...document.querySelectorAll('.bz-item-sheet-body .bz-item-sheet-item')] as HTMLElement[];
    expect(items).toHaveLength(3);
    // 打开即聚焦功能首项（而非头部按钮）
    expect(document.activeElement).toBe(items[0]);
    // ↓ 循环；到末项再 ↓ 回首项
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[2]);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
    // ↑ 回末项
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(items[2]);
    // 点击选中项执行并关闭抽屉
    (document.activeElement as HTMLElement).click();
    expect((window as any).__deleted).toBe(true);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
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