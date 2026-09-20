/**
 * 设置面板「搜索状态机 + 下拉交互 + 键盘导航」回归组（ARCH-5 测试缺口 3 收口）：
 * - F-1 搜索恢复不再放行 visibleWhen 门控隐藏的行/组（打标只记「本次过滤亲手藏的」+ 清空后 refresh 重求值兜底）；
 * - UI-6 搜索过滤后组卡「N 项」徽标按可见行数重算；
 * - UI-7 搜索命中大小写不敏感（桌面导航 / 面板行过滤）；
 * - F-6 搜索态 ↑↓ 导航只在命中（可见）集内移动；
 * - UI-1 自绘下拉 ESC 内层语义（先收菜单不关面板）+ hide/open 残留不复活；
 * - UI-2 触发器 aria/tabindex + 键盘开合 + choiceCards radio 语义；
 * - E-4 左栏 roving tabindex（Tab 序收敛）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { setSettingsProvider } from '../src/core/settings-provider';
import { setApp } from '../src/core/app';
import { MockVault } from './mock-vault';
import { renderPanelSchema, closeAllSelectMenus } from '../src/settings-panel/renderer';
import type { SettingsSchema } from '../src/core/settings-schema';
import { SettingsPanelUI } from '../src/settings-panel/ui';

const flush = () => new Promise((r) => setTimeout(r, 5));
const flushSearch = () => new Promise((r) => setTimeout(r, 260)); // E-5：180ms 防抖 + 余量

describe('搜索状态机（F-1 / UI-6 / UI-7 / F-6）', () => {
  let state: Record<string, unknown>;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    state = {};
    setSettingsProvider(() => state as any);
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  const render = (schema: SettingsSchema) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderPanelSchema(host, schema);
    return host;
  };

  it('F-1：搜索后清空，visibleWhen 门控隐藏的行/组不被放行', () => {
    state.on = true;
    const host = render({
      groups: [{
        name: 'g',
        rows: [
          { type: 'text', name: 'DeepSeek 密钥', binding: { key: 'k' }, visibleWhen: () => false },
          { type: 'text', name: '普通行甲', binding: { key: 'a' } },
          { type: 'text', name: '普通行乙含 API', binding: { key: 'b' } },
        ],
      }],
    } as unknown as SettingsSchema);
    const ui = new SettingsPanelUI();
    const rows = [...host.querySelectorAll<HTMLElement>('.bz-sp-set-row')];
    expect(rows[0].style.display).toBe('none'); // 门控行初始隐藏
    // 搜索「xyz」：无命中 → 全部未命中行被过滤藏起（含门控行——但它 display 已是 none，不打标）
    (ui as any).applyHitFilter(host, 'xyz');
    expect(rows[1].style.display).toBe('none');
    expect(rows[1].dataset.spHitHidden).toBe('1');
    expect(rows[0].dataset.spHitHidden).toBeUndefined(); // 修复前：门控行也被打标
    // 清空恢复：普通行回显，门控行仍隐藏（修复前：恢复分支无条件回写 display='' 放出门控行）
    (ui as any).applyHitFilter(host, '');
    expect(rows[1].style.display).toBe('');
    expect(rows[0].style.display).toBe('none');
    // 命中后再清空变体：hit 行不打标不受影响
    (ui as any).applyHitFilter(host, 'API');
    expect(rows[2].classList.contains('hit')).toBe(true);
    expect(rows[2].style.display).toBe('');
    (ui as any).applyHitFilter(host, '');
    expect(rows[2].style.display).toBe('');
    expect(rows[0].style.display).toBe('none');
  });

  it('F-1 组级：门控隐藏的组在搜索恢复后仍隐藏，过滤隐藏的组正常回显', () => {
    const host = render({
      groups: [
        { name: '可见组', rows: [{ type: 'text', name: '行甲', binding: { key: 'a' } }] },
        { name: '门控组', visibleWhen: () => false, rows: [{ type: 'text', name: '行乙', binding: { key: 'b' } }] },
      ],
    } as unknown as SettingsSchema);
    const ui = new SettingsPanelUI();
    const groups = [...host.querySelectorAll<HTMLElement>('.bz-sp-group')];
    expect(groups[1].style.display).toBe('none');
    (ui as any).applyHitFilter(host, '不命中');
    expect(groups[0].style.display).toBe('none');
    expect(groups[0].dataset.spHitHidden).toBe('1');
    expect(groups[1].dataset.spHitHidden).toBeUndefined();
    (ui as any).applyHitFilter(host, '');
    expect(groups[0].style.display).toBe('');
    expect(groups[1].style.display).toBe('none'); // 门控组不放行
  });

  it('UI-6：搜索过滤后组卡「N 项」徽标按可见行数重算，清空恢复', () => {
    const host = render({
      groups: [{
        name: 'g',
        rows: [
          { type: 'text', name: '甲行', binding: { key: 'a' } },
          { type: 'text', name: '乙行', binding: { key: 'b' } },
        ],
      }],
    } as unknown as SettingsSchema);
    const ui = new SettingsPanelUI();
    const count = host.querySelector('.bz-sp-group-count') as HTMLElement;
    expect(count.textContent).toBe('2 项');
    (ui as any).applyHitFilter(host, '甲');
    expect(count.textContent).toBe('1 项');
    (ui as any).applyHitFilter(host, '');
    expect(count.textContent).toBe('2 项');
  });

  it('UI-7：桌面搜索命中大小写不敏感（小写「ai」命中 AI 域）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 等预载填充行缓存
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && popup.querySelectorAll('.bz-sp-nav-item').length < 15) {
      await new Promise((r) => setTimeout(r, 30));
    }
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.value = 'ai';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushSearch();
    const names = [...popup.querySelectorAll('.bz-sp-nav-name')].map((b) => b.textContent);
    expect(names).toContain('AI'); // 修复前：'AI'.includes('ai') 为 false 零命中
    ui.cleanup();
  });

  it('F-6：搜索态 ↑↓ 导航只在命中集内移动（可切到的一定是导航可见的域）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && popup.querySelectorAll('.bz-sp-nav-item').length < 15) {
      await new Promise((r) => setTimeout(r, 30));
    }
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.value = '番茄';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushSearch();
    // 修复前：↑↓ 在未过滤全集移动——可切到左栏根本没显示的域。
    // SP1（呈报#17 拍板）后 ↑↓ 切域入口 = 面板本体/导航容器；搜索框输入内让路给光标移动
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    expect((ui as any).activeDomainId).toBe('pomodoro'); // 命中集唯一 → 停在番茄钟
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    expect((ui as any).activeDomainId).toBe('pomodoro'); // 命中集外不再越界
    // 清空搜索 → 导航全集恢复
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushSearch();
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    expect((ui as any).activeDomainId).not.toBe('pomodoro'); // 全集内正常移动
    ui.cleanup();
  });

  it('SP1：搜索框输入内 ↑↓ 让路给光标移动（不再切域，呈报#17 拍板）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && popup.querySelectorAll('.bz-sp-nav-item').length < 15) {
      await new Promise((r) => setTimeout(r, 30));
    }
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.value = '番茄';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushSearch();
    // 修复前必红：搜索框（INPUT）内 ↓ 会借道切域到番茄钟
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    expect((ui as any).activeDomainId).toBe('global'); // 输入框内 ↓ = 光标移动，不切域
    ui.cleanup();
  });
});

describe('自绘下拉交互（UI-1 / UI-2）与左栏 roving（E-4）', () => {
  let state: Record<string, unknown>;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    state = {};
    setSettingsProvider(() => state as any);
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  const render = (schema: SettingsSchema) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderPanelSchema(host, schema);
    return host;
  };

  const dropdownSchema = {
    groups: [{
      name: 'g',
      rows: [{ type: 'select', name: '下拉甲', binding: { key: 'sel' }, options: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }, { value: 'c', label: '丙' }] }],
    }],
  } as unknown as SettingsSchema;

  it('UI-2：触发器可聚焦带 aria-expanded；菜单项 role=option + aria-selected；键盘开合提交', () => {
    state.sel = 'a';
    const host = render(dropdownSchema);
    const sel = host.querySelector('.bz-select') as HTMLElement;
    expect(sel.getAttribute('tabindex')).toBe('0');
    expect(sel.getAttribute('role')).toBe('listbox');
    expect(sel.getAttribute('aria-expanded')).toBe('false');
    // 键盘：Enter 开菜单（当前值高亮不动）→ ↓ 移高亮 → Enter 提交（core uiSelect 同范式）
    sel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const menu = host.querySelector('.bz-select-menu') as HTMLElement;
    expect(menu).toBeTruthy();
    expect(sel.getAttribute('aria-expanded')).toBe('true');
    const first = menu.querySelector('.bz-select-item') as HTMLElement;
    expect(first.getAttribute('role')).toBe('option');
    expect(first.getAttribute('aria-selected')).toBe('true');
    sel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // 高亮移到乙
    const on = menu.querySelectorAll('.bz-select-item')[1] as HTMLElement;
    expect(on.classList.contains('is-on')).toBe(true);
    expect(on.getAttribute('aria-selected')).toBe('true');
    sel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(state.sel).toBe('b'); // 键盘提交落值
    expect(host.querySelector('.bz-select-menu')).toBeNull();
    expect(sel.getAttribute('aria-expanded')).toBe('false');
    expect((sel.querySelector('.bz-select-val') as HTMLElement).textContent).toBe('乙');
  });

  it('UI-1：菜单开着按 ESC 先收菜单不关面板；closeAllSelectMenus 纵深兜底不残留', () => {
    const host = render(dropdownSchema);
    const sel = host.querySelector('.bz-select') as HTMLElement;
    sel.click();
    const group = host.querySelector('.bz-sp-group') as HTMLElement;
    expect(host.querySelector('.bz-select-menu')).toBeTruthy();
    expect(group.style.overflow).toBe('visible');
    // ESC（escManager 文档级监听）：菜单层比面板层新 → 只收菜单
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.querySelector('.bz-select-menu')).toBeNull();
    expect(group.style.overflow).toBe('');
    // 纵深（hide/cleanup 路径同款）：菜单开着时强制收起——菜单 DOM 与提层样式不残留
    sel.click();
    expect(host.querySelector('.bz-select-menu')).toBeTruthy();
    closeAllSelectMenus(host);
    expect(host.querySelector('.bz-select-menu')).toBeNull();
    expect(group.style.overflow).toBe('');
    expect(sel.getAttribute('aria-expanded')).toBe('false');
  });

  it('UI-2：choiceCards 卡带 role=radio + aria-checked，点击翻转播报态', () => {
    state.c1 = 'x';
    const host = render({
      groups: [{
        name: 'g',
        rows: [{
          type: 'choiceCards', name: '卡组', binding: { key: 'c1' },
          options: [{ value: 'x', label: '甲', prevClass: 'p' }, { value: 'y', label: '乙', prevClass: 'q' }],
        }],
      }],
    } as unknown as SettingsSchema);
    const cards = [...host.querySelectorAll<HTMLElement>('.bz-sp-cardpick-card')];
    expect(cards[0].getAttribute('role')).toBe('radio');
    expect(cards[0].getAttribute('aria-checked')).toBe('true');
    expect(cards[1].getAttribute('aria-checked')).toBe('false');
    cards[1].click();
    expect(cards[1].classList.contains('is-on')).toBe(true);
    expect(cards[1].getAttribute('aria-checked')).toBe('true');
    expect(cards[0].getAttribute('aria-checked')).toBe('false');
  });

  it('E-4：左栏导航 roving tabindex——容器单站进 Tab 序，↑↓ 在域钮间移焦点', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const nav = popup.querySelector('.bz-sp-nav') as HTMLElement;
    expect(nav.getAttribute('tabindex')).toBe('0');
    const items = [...popup.querySelectorAll<HTMLElement>('.bz-sp-nav-item')];
    expect(items.length).toBeGreaterThan(5);
    for (const it of items) expect(it.getAttribute('tabindex')).toBe('-1'); // 域钮退出 Tab 序
    nav.focus();
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
    ui.cleanup();
  });
});
