/**
 * 归物本 UI 测试（ticket 06）：主面板渲染/统计、添加/编辑/删除确认、
 * 排序弹窗、refreshBtn、长按删除 vs 单击编辑。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { openBelongingsPanel, addBelongingsItemCommand, showSortModal, cleanupBelongings } from '../../src/belongings/ui';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeItemMenu } from '../../src/core/item-actions';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices, Platform } from '../mock-obsidian-entry';

/** 桌面右键开菜单（已有卡片挂统一抽屉） */
function rightClickOpen(card: HTMLElement) {
  card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
}

function setup(vault: MockVault, settings: any = {}) {
  setApp({ vault, workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE', customCategories: '', ...settings }));
  resetObsidianMocks();
}

/** 预置数据 */
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
        item_2: {
          id: 'item_2', name: '旧手机', category: '📱 备用手机', purchase_price: 1999,
          purchase_date: '2023-01-01', current_status: '闲置', description: '',
          created_date: '2023-01-01T10:00:00.000Z', last_updated: '2023-01-01T10:00:00.000Z',
        },
      },
    })
  );
}

describe('归物本主面板', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
    localStorage.clear();
    cleanupBelongings();
    setup(vault);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupBelongings();
  });

  it('打开面板：__gui_wu_ben__ 遮罩 + 渲染统计与物品卡片', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.style.visibility).not.toBe('hidden');
    expect(overlay.textContent).toContain('归物本');
    // 统计：总资产 399+1999=2398.00
    expect(overlay.textContent).toContain('￥2398.00');
    // 物品卡片
    expect(overlay.textContent).toContain('机械键盘');
    expect(overlay.textContent).toContain('旧手机');
    expect(overlay.querySelectorAll('[data-id]').length).toBe(2);
  });

  it('再次打开复用 DOM（visibility visible）', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    overlay.style.visibility = 'hidden';
    await openBelongingsPanel();
    expect(overlay.style.visibility).toBe('visible');
    expect(document.querySelectorAll('#__gui_wu_ben__').length).toBe(1);
  });

  it('关闭按钮 → visibility hidden（不销毁）', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const closeBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '❌')!;
    closeBtn.click();
    expect(overlay.style.visibility).toBe('hidden');
    expect(document.getElementById('__gui_wu_ben__')).not.toBeNull();
  });

  it('自动刷新：面板打开期间数据文件变更 → 实时重渲染（无 ⏳ 按钮）', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    // 右上角不再有刷新按钮
    expect([...overlay.querySelectorAll('button')].find((b) => b.textContent === '⏳')).toBeUndefined();
    // 外部修改数据 → modify 事件
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    data.items['item_3'] = { id: 'item_3', name: '新物品', category: '🎁 礼品', purchase_price: 10, purchase_date: '2025-01-01', current_status: '使用中', description: '', created_date: '', last_updated: '' };
    vault.files.set('CONFIG/STORAGE/belongings.json', JSON.stringify(data));
    vault.emit('modify', { path: 'CONFIG/STORAGE/belongings.json' });
    await new Promise((r) => setTimeout(r, 20));
    expect(overlay.textContent).toContain('新物品');
  });

  it('自动刷新：关闭面板后变更不再触发', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const closeBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '❌')!;
    closeBtn.click();
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    data.items['item_3'] = { id: 'item_3', name: '新物品', category: '🎁 礼品', purchase_price: 10, purchase_date: '2025-01-01', current_status: '使用中', description: '', created_date: '', last_updated: '' };
    vault.files.set('CONFIG/STORAGE/belongings.json', JSON.stringify(data));
    vault.emit('modify', { path: 'CONFIG/STORAGE/belongings.json' });
    await new Promise((r) => setTimeout(r, 20));
    expect(overlay.textContent).not.toContain('新物品');
  });
});

describe('添加/编辑/删除', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
    localStorage.clear();
    cleanupBelongings();
    setup(vault);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupBelongings();
  });

  it('addBelongingsItemCommand：弹出添加弹窗 → 保存写入 items', async () => {
    seed(vault);
    await addBelongingsItemCommand();
    const modal = [...document.querySelectorAll('div')].find(
      (d) => d.style.zIndex === '10000' && d.style.display === 'flex'
    ) as HTMLElement;
    expect(modal.textContent).toContain('添加物品');

    // 填写表单
    const nameInput = modal.querySelector('input') as HTMLInputElement;
    nameInput.value = '新耳机';
    // 分类 search-select 是第一个输入框后面那个……直接用 inputs 顺序：name → category(第2个 input)
    const inputs = modal.querySelectorAll('input');
    (inputs[1] as HTMLInputElement).value = '🎧 蓝牙耳机';
    // price (number)
    const numberInputs = modal.querySelectorAll('input[type="number"]');
    (numberInputs[0] as HTMLInputElement).value = '299';
    // date 已默认今天
    // status select 默认第一个（使用中）
    const submit = [...modal.querySelectorAll('button')].find((b) => b.textContent === '✅ 保存')!;
    submit.click();
    await new Promise((r) => setTimeout(r, 20));

    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    const keys = Object.keys(data.items);
    expect(keys.length).toBe(3);
    expect(data.items[keys[2]]).toMatchObject({ name: '新耳机', category: '🎧 蓝牙耳机', purchase_price: 299, current_status: '使用中' });
    expect(hasNotice(/已添加/)).toBe(true);
  });

  it('名称空 → 「请输入物品名称」', async () => {
    seed(vault);
    await addBelongingsItemCommand();
    const submit = [...document.querySelectorAll('button')].find((b) => b.textContent === '✅ 保存')!;
    submit.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('请输入物品名称')).toBe(true);
  });

  it('右键卡片 → 菜单「编辑」→ 编辑弹窗（回填）', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const card = overlay.querySelector('[data-id="item_1"]') as HTMLElement;

    rightClickOpen(card);
    const editItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    await new Promise((r) => setTimeout(r, 20));

    const editModal = [...document.querySelectorAll('div')].find(
      (d) => d.style.zIndex === '10001'
    ) as HTMLElement;
    expect(editModal.textContent).toContain('编辑物品');
    expect(editModal.textContent).toContain('机械键盘');
  });

  it('右键卡片 → 菜单「删除」→ 删除确认弹窗 → 确认删除', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const card = overlay.querySelector('[data-id="item_2"]') as HTMLElement;

    rightClickOpen(card);
    const delItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('删除')
    ) as HTMLElement;
    delItem.click();
    await new Promise((r) => setTimeout(r, 20));

    const confirmModal = [...document.querySelectorAll('div')].find(
      (d) => d.style.zIndex === '10002'
    ) as HTMLElement;
    expect(confirmModal).toBeTruthy();
    expect(confirmModal.textContent).toContain('确认删除');
    expect(confirmModal.textContent).toContain('确定要删除物品「旧手机」吗？此操作不可撤销。');

    // 确认删除
    const delBtn = [...confirmModal.querySelectorAll('button')].find((b) => b.textContent === '🗑 删除')!;
    delBtn.click();
    await new Promise((r) => setTimeout(r, 50));
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    expect(data.items['item_2']).toBeUndefined();
    expect(hasNotice(/已删除/)).toBe(true);
  });
});

describe('归物本抽屉（移动端：状态流转 keepOpen）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
    localStorage.clear();
    cleanupBelongings();
    setup(vault);
    Platform.isMobile = true;
  });

  afterEach(() => {
    Platform.isMobile = false;
    closeItemMenu();
    cleanupBelongings();
  });

  it('长按卡片 → 抽屉：状态流转（当前状态不显示）+ 编辑 + 删除', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const card = overlay.querySelector('[data-id="item_1"]') as HTMLElement; // 使用中

    vi.useFakeTimers();
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 20));

    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    const labels = [...sheet.querySelectorAll('.bz-item-sheet-label')].map((e) => e.textContent);
    // 使用中条目：不显示「标记为使用中」，其余三状态流转 + 编辑 + 删除
    expect(labels).not.toContain('标记为使用中');
    expect(labels).toContain('标记为闲置');
    expect(labels).toContain('标记为已转卖');
    expect(labels).toContain('标记为已丢弃');
    expect(labels).toContain('编辑');
    expect(labels).toContain('删除');
    // 头部：分类 emoji + 名称 + 小字
    expect(sheet.querySelector('.bz-item-sheet-title')!.textContent).toBe('机械键盘');
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toContain('机械键盘');

    // 点「标记为闲置」→ keepOpen：抽屉保持 + 数据写回 + 动作区刷新（使用中 出现、闲置 消失）
    const idleItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('标记为闲置')
    ) as HTMLElement;
    idleItem.click();
    await new Promise((r) => setTimeout(r, 30));
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    expect(data.items['item_1'].current_status).toBe('闲置');
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull(); // keepOpen
    const labels2 = [...document.querySelectorAll('.bz-item-sheet-label')].map((e) => e.textContent);
    expect(labels2).toContain('标记为使用中');
    expect(labels2).not.toContain('标记为闲置');
  });

  it('抽屉删除：先收抽屉再弹确认（非 keepOpen）', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const card = overlay.querySelector('[data-id="item_2"]') as HTMLElement;

    vi.useFakeTimers();
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 20));

    const delItem = [...document.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('删除')
    ) as HTMLElement;
    delItem.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.bz-item-sheet')).toBeNull(); // 先收抽屉
    expect([...document.querySelectorAll('div')].some((d) => (d as HTMLElement).style.zIndex === '10002')).toBe(true);
  });
});

describe('排序弹窗', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
    localStorage.clear();
    cleanupBelongings();
    setup(vault);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupBelongings();
  });

  it('showSortModal：8 个排序按钮，点击后按字段重排', async () => {
    vi.useFakeTimers();
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    // 默认日期降序：机械键盘(2024)最新在前
    let cards = overlay.querySelectorAll('[data-id]');
    expect((cards[0] as HTMLElement).dataset.id).toBe('item_1');

    const p = showSortModal();
    await vi.advanceTimersByTimeAsync(0);
    const sortModal = [...document.querySelectorAll('div')].find(
      (d) => d.style.zIndex === '10003'
    ) as HTMLElement;
    expect(sortModal.textContent).toContain('排序设置');
    const buttons = [...sortModal.querySelectorAll('button')];
    expect(buttons.length).toBe(9); // 8 排序 + 关闭

    // 点击「名称 ↑」
    buttons.find((b) => b.textContent === '名称 ↑')!.click();
    await p;
    cards = overlay.querySelectorAll('[data-id]');
    expect((cards[0] as HTMLElement).dataset.id).toBe('item_1'); // 拼音序：机械键盘(ji) < 旧手机(jiu)
    vi.useRealTimers();
  });
});
