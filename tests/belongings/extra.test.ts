/**
 * 归物本 UI 补测（覆盖率目标）：search-select 键盘导航、校验失败分支、
 * 编辑保存流程、删除取消、排序弹窗关闭。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { openBelongingsPanel, addBelongingsItemCommand, showSortModal, cleanupBelongings } from '../../src/belongings/ui';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';

function setup(vault: MockVault, settings: any = {}) {
  setApp({ vault, workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE', customCategories: '', ...settings }));
  resetObsidianMocks();
}

function seed(vault: MockVault) {
  vault.files.set(
    'CONFIG/STORAGE/belongings.json',
    JSON.stringify({
      version: '1.0',
      last_updated: '2025-01-01T00:00:00.000Z',
      items: {
        item_1: {
          id: 'item_1', name: '机械键盘', category: '⌨ 机械键盘', purchase_price: 399,
          purchase_date: '2024-06-01', current_status: '使用中', description: '',
          created_date: '2024-06-01T10:00:00.000Z', last_updated: '2024-06-01T10:00:00.000Z',
        },
      },
      categories: ['⌨ 机械键盘', '📱 备用手机'],
      categoryIcons: { '⌨ 机械键盘': '⌨', '📱 备用手机': '📱' },
    })
  );
}

/** 添加弹窗内按名称定位控件 */
function modalByTitle(title: string): HTMLElement {
  return [...document.querySelectorAll('div')].find(
    (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100') && d.textContent?.includes(title)
  ) as HTMLElement;
}

beforeEach(() => {
  const vault = new MockVault();
  document.body.innerHTML = '';
  localStorage.clear();
  cleanupBelongings();
  setup(vault);
});

afterEach(() => {
  vi.useRealTimers();
  cleanupBelongings();
});

describe('校验失败分支', () => {
  it('价格为空/无效 → 「请输入有效的价格」', async () => {
    const vault = new MockVault();
    seed(vault);
    setup(vault);
    await addBelongingsItemCommand();
    const modal = modalByTitle('添加物品');
    const nameInput = modal.querySelector('input') as HTMLInputElement;
    nameInput.value = '新物品';
    const submit = [...modal.querySelectorAll('button')].find((b) => b.textContent === '✅ 保存')!;
    // 价格为空
    submit.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('请输入有效的价格')).toBe(true);
    // 价格为负数
    clearNotices();
    const numInput = modal.querySelector('input[type="number"]') as HTMLInputElement;
    numInput.value = '-5';
    submit.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('请输入有效的价格')).toBe(true);
  });

  it('日期为空 → 「请选择购买日期」', async () => {
    const vault = new MockVault();
    seed(vault);
    setup(vault);
    await addBelongingsItemCommand();
    const modal = modalByTitle('添加物品');
    const nameInput = modal.querySelector('input') as HTMLInputElement;
    nameInput.value = '新物品';
    (modal.querySelector('input[type="number"]') as HTMLInputElement).value = '100';
    (modal.querySelector('input[type="date"]') as HTMLInputElement).value = '';
    const submit = [...modal.querySelectorAll('button')].find((b) => b.textContent === '✅ 保存')!;
    submit.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('请选择购买日期')).toBe(true);
  });

  it('分类为空 → 「请选择或输入分类」', async () => {
    const vault = new MockVault();
    seed(vault);
    setup(vault);
    await addBelongingsItemCommand();
    const modal = modalByTitle('添加物品');
    const nameInput = modal.querySelector('input') as HTMLInputElement;
    nameInput.value = '新物品';
    (modal.querySelector('input[type="number"]') as HTMLInputElement).value = '100';
    const submit = [...modal.querySelectorAll('button')].find((b) => b.textContent === '✅ 保存')!;
    submit.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('请选择或输入分类')).toBe(true);
  });
});

describe('search-select 键盘导航', () => {
  it('ArrowDown/Enter 选择分类；Escape 只收下拉、不再连关整层弹窗（e1）', async () => {
    const vault = new MockVault();
    seed(vault);
    setup(vault);
    await addBelongingsItemCommand();
    const modal = modalByTitle('添加物品');
    const inputs = modal.querySelectorAll('input');
    const categoryInput = inputs[1] as HTMLInputElement; // name → category
    categoryInput.focus();
    categoryInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    categoryInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(categoryInput.value).toBeTruthy();
    // e1：ESC 在输入框内只收起下拉，弹窗保持打开（不再冒泡到 escManager 连关一层）
    categoryInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(modal.isConnected).toBe(true);
    expect(modalByTitle('添加物品')).toBeTruthy();
    // 收尾：取消关闭，不污染后续用例
    ([...modal.querySelectorAll('button')].find((b) => b.textContent === '取消') as HTMLElement).click();
  });

  it('下拉选项点击填充输入框', async () => {
    const vault = new MockVault();
    seed(vault);
    setup(vault);
    await addBelongingsItemCommand();
    const modal = modalByTitle('添加物品');
    const inputs = modal.querySelectorAll('input');
    const categoryInput = inputs[1] as HTMLInputElement;
    categoryInput.focus();
    categoryInput.dispatchEvent(new Event('input'));
    const dropdownItems = modal.querySelectorAll('#add-todo-scenes, [style*="display: block"]');
    // 选项 div 在 dropdown 内（z-index 11101）
    const opt = [...modal.querySelectorAll('div')].find((d) => d.textContent === '📱 备用手机');
    if (opt) (opt as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(categoryInput.value).toBe('📱 备用手机');
  });
});

describe('编辑保存流程', () => {
  it('右键卡片 → 编辑弹窗 → 修改保存 → 数据更新', async () => {
    const vault = new MockVault();
    seed(vault);
    setup(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const card = overlay.querySelector('[data-id="item_1"]') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
    const editItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    await new Promise((r) => setTimeout(r, 20));

    const editModal = [...document.querySelectorAll('div')].find((d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100')) as HTMLElement;
    expect(editModal.textContent).toContain('编辑物品');
    // 修改名称并保存
    const nameInput = editModal.querySelector('input') as HTMLInputElement;
    nameInput.value = '新键盘名';
    const saveBtn = [...editModal.querySelectorAll('button')].find((b) => b.textContent === '💾 保存')!;
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 50));
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    expect(data.items['item_1'].name).toBe('新键盘名');
    expect(hasNotice(/已更新/)).toBe(true);
  });
});

describe('删除取消 / 排序关闭', () => {
  it('右键卡片 → 确认弹窗 → 取消不删除', async () => {
    const vault = new MockVault();
    seed(vault);
    setup(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const card = overlay.querySelector('[data-id="item_1"]') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
    const delItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('删除')
    ) as HTMLElement;
    delItem.click();
    await new Promise((r) => setTimeout(r, 20));
    const confirmModal = [...document.querySelectorAll('div')].find((d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11101')) as HTMLElement;
    expect(confirmModal.textContent).toContain('确认删除');
    const cancelBtn = [...confirmModal.querySelectorAll('button')].find((b) => b.textContent === '取消')!;
    cancelBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    expect(data.items['item_1']).toBeDefined();
  });

  it('排序弹窗：关闭按钮收起', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    seed(vault);
    setup(vault);
    await openBelongingsPanel();
    const p = showSortModal();
    await vi.advanceTimersByTimeAsync(0);
    const sortModal = [...document.querySelectorAll('div')].find((d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100')) as HTMLElement;
    const closeBtn = [...sortModal.querySelectorAll('button')].find((b) => b.textContent === '关闭')!;
    closeBtn.click();
    await p;
    expect(document.querySelector('.bz-belongings-overlay--11100')).toBeNull();
  });
});
