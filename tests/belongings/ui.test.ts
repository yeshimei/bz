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
import { onDomainEvent } from '../../src/core/domain-bus';

// ticket 079 观测点换线（域事件派发）：真实总线 + onDomainEvent('belongings', spy) 挂间谍，
// 断言 UI 动作发出的载荷（挂点契约不变）；belongingsEditChanges 走真实纯函数（子模块直连）。
let belongingsSpy: (evt?: unknown) => void = () => {};
let offBelongingsSpy: () => void = () => {};

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

  it('空库：零物品显示首步引导（l6-belongings）', async () => {
    // 不 seed（belongings.json 不存在 → 空库）
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    expect(overlay.textContent).toContain('归物本还没有物品');
    expect(overlay.textContent).toContain('点右上角 ✏️ 添加第一个物品');
    expect(overlay.querySelectorAll('[data-id]').length).toBe(0); // 无物品卡片
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
      (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100') && d.style.display === 'flex'
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
      (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100')
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
      (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11101')
    ) as HTMLElement;
    expect(confirmModal).toBeTruthy();
    expect(confirmModal.textContent).toContain('确认删除');
    expect(confirmModal.textContent).toContain('确定要删除物品「旧手机」吗？此操作不可撤销。');

    // 19：默认焦点不落在「删除」按钮（防误触），落在「取消」
    await new Promise((r) => setTimeout(r, 150)); // 等待 100ms 聚焦回调
    expect((document.activeElement as HTMLElement).textContent).toBe('取消');

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

    // 点「标记为闲置」→ keepOpen：抽屉保持 + 数据写回 + toast 反馈（12）+ 动作区刷新（使用中 出现、闲置 消失）
    const idleItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('标记为闲置')
    ) as HTMLElement;
    idleItem.click();
    await new Promise((r) => setTimeout(r, 30));
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    expect(data.items['item_1'].current_status).toBe('闲置');
    expect(hasNotice(/「机械键盘」已标记为闲置/)).toBe(true); // 状态流转成功 toast（正文无 emoji）
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
    expect([...document.querySelectorAll('div')].some((d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11101'))).toBe(true);
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
      (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100')
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

describe('smartcat 域事件派发挂点（ticket 079）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
    localStorage.clear();
    cleanupBelongings();
    setup(vault);
    belongingsSpy = vi.fn((_evt?: unknown) => {});
    offBelongingsSpy = onDomainEvent('belongings', (evt) => belongingsSpy(evt));
  });

  afterEach(() => {
    offBelongingsSpy();
    Platform.isMobile = false;
    vi.useRealTimers();
    closeItemMenu();
    cleanupBelongings();
  });

  it('添加保存成功 → 发 add 事件（item 完整载荷）', async () => {
    seed(vault);
    await addBelongingsItemCommand();
    const modal = [...document.querySelectorAll('div')].find(
      (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100') && d.style.display === 'flex'
    ) as HTMLElement;
    const nameInput = modal.querySelector('input') as HTMLInputElement;
    nameInput.value = '新耳机';
    // 分类 search-select：表单字段顺序 name → category（第 2 个 input）
    const inputs = modal.querySelectorAll('input');
    (inputs[1] as HTMLInputElement).value = '🎧 蓝牙耳机';
    const numberInputs = modal.querySelectorAll('input[type="number"]');
    (numberInputs[0] as HTMLInputElement).value = '299';
    const submit = [...modal.querySelectorAll('button')].find((b) => b.textContent === '✅ 保存')!;
    submit.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(belongingsSpy).toHaveBeenCalledTimes(1);
    expect(belongingsSpy).toHaveBeenCalledWith({
      kind: 'add',
      item: expect.objectContaining({ name: '新耳机', category: '🎧 蓝牙耳机', purchase_price: 299, current_status: '使用中' }),
    });
  });

  it('编辑保存成功 → 发 edit 事件（snapshot vs 保存后 changes）', async () => {
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
      (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100')
    ) as HTMLElement;
    expect(editModal.textContent).toContain('机械键盘');
    const nameInput = editModal.querySelector('input') as HTMLInputElement;
    nameInput.value = '机械键盘 Pro';
    const statusSelect = [...editModal.querySelectorAll('select')].find(
      (s) => (s as HTMLSelectElement).value === '使用中'
    ) as HTMLSelectElement;
    statusSelect.value = '闲置';
    const save = [...editModal.querySelectorAll('button')].find((b) => b.textContent === '💾 保存')!;
    save.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(belongingsSpy).toHaveBeenCalledWith({
      kind: 'edit',
      title: '机械键盘 Pro',
      changes: ['改了名称', '改了状态'],
    });
  });

  it('编辑全不改 → 发 edit 事件（空 changes，仍发主句）', async () => {
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
      (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100')
    ) as HTMLElement;
    const save = [...editModal.querySelectorAll('button')].find((b) => b.textContent === '💾 保存')!;
    save.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(belongingsSpy).toHaveBeenCalledWith({
      kind: 'edit',
      title: '机械键盘',
      changes: [],
    });
  });

  it('抽屉状态流转 → 发 status 事件（4 态动词化）', async () => {
    Platform.isMobile = true;
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const card = overlay.querySelector('[data-id="item_2"]') as HTMLElement; // 旧手机（闲置）

    vi.useFakeTimers();
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 20));

    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    const useItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('标记为使用中')
    ) as HTMLElement;
    useItem.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(belongingsSpy).toHaveBeenCalledWith({ kind: 'status', title: '旧手机', status: '使用中' });
  });

  it('删除确认 → 发 delete 事件（仅标题）', async () => {
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
      (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11101')
    ) as HTMLElement;
    const delBtn = [...confirmModal.querySelectorAll('button')].find((b) => b.textContent === '🗑 删除')!;
    delBtn.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(belongingsSpy).toHaveBeenCalledWith({ kind: 'delete', title: '旧手机' });
  });
});

describe('修复回归（P0-7 层级 / P0-8 注入 / P1-38 回车双删 / P2 泄漏与容错）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
    localStorage.clear();
    cleanupBelongings();
    setup(vault);
    belongingsSpy = vi.fn((_evt?: unknown) => {});
    offBelongingsSpy = onDomainEvent('belongings', (evt) => belongingsSpy(evt));
  });

  afterEach(() => {
    offBelongingsSpy();
    Platform.isMobile = false;
    vi.useRealTimers();
    closeItemMenu();
    cleanupBelongings();
  });

  /** 按标题找域内模态（遮罩层：带 bz-belongings-overlay--* 层级类且含指定标题） */
  function modalByTitle(title: string): HTMLElement {
    return [...document.querySelectorAll('div')].find(
      (d) => (d as HTMLElement).className.includes('bz-belongings-overlay--') && d.textContent?.includes(title)
    ) as HTMLElement;
  }

  it('P0-7/e3：添加/编辑/删除/排序弹窗挂 11100 层级类（压过抽屉遮罩 10999），下拉为 11101 档；JS 不再内联 z-index', async () => {
    seed(vault);
    // 添加弹窗
    await addBelongingsItemCommand();
    const addModal = modalByTitle('添加物品');
    expect(addModal.classList.contains('bz-belongings-overlay--11100')).toBe(true);
    expect(addModal.style.zIndex).toBe(''); // e3：JS 不再内联 z-index（值由根样式档位类提供，移交 ux-css）
    const dropdown = [...addModal.querySelectorAll('div')].find((d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11101')) as HTMLElement;
    expect(dropdown).toBeTruthy();
    addModal.remove();

    // 主面板 → 编辑 / 删除 / 排序
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    expect(overlay.classList.contains('bz-belongings-overlay--1000')).toBe(true);
    const card = overlay.querySelector('[data-id="item_1"]') as HTMLElement;
    rightClickOpen(card);
    ([...document.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('编辑')) as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(modalByTitle('编辑物品').classList.contains('bz-belongings-overlay--11100')).toBe(true);

    rightClickOpen(card);
    ([...document.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('删除')) as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(modalByTitle('确认删除').classList.contains('bz-belongings-overlay--11101')).toBe(true); // 删除确认档 +1

    vi.useFakeTimers();
    const p = showSortModal();
    await vi.advanceTimersByTimeAsync(0);
    expect(modalByTitle('排序设置').classList.contains('bz-belongings-overlay--11100')).toBe(true);
    [...modalByTitle('排序设置').querySelectorAll('button')].find((b) => b.textContent === '关闭')!.click();
    await p;
    vi.useRealTimers();
  });

  it('P0-8：物品名含 HTML → 按文本渲染，不产生 <img> 标签', async () => {
    vault.files.set(
      'CONFIG/STORAGE/belongings.json',
      JSON.stringify({
        version: '1.0',
        last_updated: '2025-01-01T00:00:00.000Z',
        items: {
          item_x: {
            id: 'item_x', name: '<img src=x onerror=alert(1)>键盘', category: '⌨ 机械键盘', purchase_price: 99,
            purchase_date: '2024-06-01', current_status: '使用中', description: '',
            created_date: '', last_updated: '',
          },
        },
      })
    );
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    expect(overlay.querySelector('img')).toBeNull(); // 不产生标签
    expect(overlay.querySelector('[data-id="item_x"]')).not.toBeNull(); // 卡片正常渲染
    expect(overlay.textContent).toContain('<img src=x onerror=alert(1)>键盘'); // 纯文本呈现
  });

  it('P1-38：确认弹窗 Enter 仅触发一次删除回调（preventDefault 拦原生激活）', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const card = overlay.querySelector('[data-id="item_1"]') as HTMLElement;
    rightClickOpen(card);
    ([...document.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('删除')) as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));

    const confirmModal = modalByTitle('确认删除');
    const delBtn = [...confirmModal.querySelectorAll('button')].find((b) => b.textContent === '🗑 删除')!;
    delBtn.focus();
    // 真实路径：Enter 在删除按钮上触发，冒泡到 modal 的 keydown 处理器
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    delBtn.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true); // 与 edit/add 弹窗对齐：拦原生按钮二次激活
    await new Promise((r) => setTimeout(r, 50));

    // 删除回调只执行一次（修复前原生激活 + 处理器 click 会双发）
    expect(belongingsSpy).toHaveBeenCalledTimes(1);
    expect(belongingsSpy).toHaveBeenCalledWith({ kind: 'delete', title: '机械键盘' });
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    expect(data.items['item_1']).toBeUndefined();
  });

  it('P2 监听泄漏：search-select 弹窗销毁后，旧 document click 监听自注销', async () => {
    seed(vault);
    await addBelongingsItemCommand();
    const addModal = modalByTitle('添加物品');
    addModal.remove(); // 弹窗销毁（取消/保存路径同款 removeChild）

    const rmSpy = vi.spyOn(document, 'removeEventListener');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(rmSpy.mock.calls.some(([type]) => type === 'click')).toBe(true); // closeDropdown 引用化后可移除
    rmSpy.mockRestore();
  });

  it('P2 形状容错：缺 purchase_price/category/purchase_date 的脏数据渲染不抛错、按 0 计入统计', async () => {
    vault.files.set(
      'CONFIG/STORAGE/belongings.json',
      JSON.stringify({
        version: '1.0',
        last_updated: '2025-01-01T00:00:00.000Z',
        items: {
          item_ok: {
            id: 'item_ok', name: '正常物品', category: '⌨ 机械键盘', purchase_price: 100,
            purchase_date: '2024-06-01', current_status: '使用中', description: '',
            created_date: '', last_updated: '',
          },
          item_dirty: {
            id: 'item_dirty', name: '脏数据物品', current_status: '使用中', description: '',
          },
        },
      })
    );
    await expect(openBelongingsPanel()).resolves.toBeUndefined(); // 渲染全程不抛 TypeError
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    expect(overlay.textContent).toContain('脏数据物品'); // 脏数据卡片照常渲染
    expect(overlay.textContent).toContain('￥100.00'); // 总资产只计正常项（缺失按 0）
    expect(overlay.textContent).toContain('📦'); // 分类缺失回退默认图标
    expect(overlay.textContent).not.toContain('NaN'); // 无 NaN 外漏
  });
});
