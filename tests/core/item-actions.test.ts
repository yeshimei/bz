/**
 * core/item-actions 测试（手势统一试点）：桌面操作条 + 长按跟手菜单
 * 覆盖：操作条按钮、长按出菜单、跟手定位防溢出（右下放不下翻左/上）、
 * 残余 click 抑制、外部点击/ESC 关闭、菜单项执行。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { attachItemActions, closeItemMenu, openItemMenu, type ItemAction } from '../../src/core/item-actions';

const ACTIONS: ItemAction[] = [
  { icon: '📄', label: '打开', title: '打开', onClick: () => (window as any).__opened = true },
  { icon: '✏️', label: '编辑', title: '编辑', onClick: () => (window as any).__edited = true },
  { icon: '🗑', label: '删除', title: '删除', kind: 'danger', onClick: () => (window as any).__deleted = true },
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

  it('注入操作条：顺序 = 打开/编辑/删除，危险项带 danger 类', () => {
    const card = makeCard();
    attachItemActions(card, ACTIONS);
    expect(card.classList.contains('bz-item-card')).toBe(true);
    const btns = card.querySelectorAll('.bz-item-action');
    expect(btns.length).toBe(3);
    expect(btns[0].textContent).toBe('📄');
    expect(btns[1].textContent).toBe('✏️');
    expect(btns[2].textContent).toBe('🗑');
    expect(btns[2].classList.contains('bz-item-action--danger')).toBe(true);
    expect((btns[0] as HTMLElement).title).toBe('打开');
  });

  it('空操作列表：不注入任何东西，也不影响卡片', () => {
    const card = makeCard();
    attachItemActions(card, []);
    expect(card.querySelector('.bz-item-actions')).toBeNull();
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
    // 3 项菜单估算尺寸 168×134（jsdom offsetWidth/Height 恒 0 的兜底路径）
    const left = parseFloat(menu.style.left);
    const top = parseFloat(menu.style.top);
    // 不超出视口
    expect(left + 168).toBeLessThanOrEqual(240);
    expect(top + 134).toBeLessThanOrEqual(300);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    // 具体：左翻到锚点左侧（230-168-12=50），上翻到锚点上方（290-134-12=144）
    expect(menu.style.left).toBe('50px');
    expect(menu.style.top).toBe('144px');
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