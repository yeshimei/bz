/**
 * 归物本 UI 补充覆盖测试（src/belongings/ui.ts 未触达分支）：
 * 表单校验全分支、search-select 键盘导航与过滤、编辑/删除目标缺失兜底、
 * 弹窗关闭路径（取消/遮罩/ESC）、排序弹窗高亮与重排、buildForm 字段类型分支、
 * 暗色色板、MutationObserver 主题重渲染、清理幂等。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  openBelongingsPanel,
  addBelongingsItemCommand,
  showSortModal,
  cleanupBelongings,
} from '../../src/belongings/ui';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeItemMenu } from '../../src/core/item-actions';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, Platform } from '../mock-obsidian-entry';

// smartcat barrel 打桩：归物本动作通知断言载荷（belongingsEditChanges 走真实子模块）
const smartcatMocks = vi.hoisted(() => ({ notifyBelongingsAction: vi.fn() }));
vi.mock('../../src/smartcat', () => ({ notifyBelongingsAction: smartcatMocks.notifyBelongingsAction }));

function rightClickOpen(card: HTMLElement) {
  card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
}

function setup(vault: MockVault) {
  setApp({ vault, workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE', customCategories: '' }) as any);
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
        item_2: {
          id: 'item_2', name: '旧手机', category: '📱 备用手机', purchase_price: 1999,
          purchase_date: '2023-01-01', current_status: '闲置', description: '',
          created_date: '2023-01-01T10:00:00.000Z', last_updated: '2023-01-01T10:00:00.000Z',
        },
      },
    })
  );
}

/** 域内模态（遮罩层：带 bz-belongings-overlay--* 层级类且含指定标题） */
function modalByTitle(title: string): HTMLElement {
  return [...document.querySelectorAll('div')].find(
    (d) => (d as HTMLElement).className.includes('bz-belongings-overlay--') && d.textContent?.includes(title)
  ) as HTMLElement;
}

const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('表单校验与添加流程全分支', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
    localStorage.clear();
    cleanupBelongings();
    setup(vault);
  });

  afterEach(() => {
    Platform.isMobile = false;
    vi.useRealTimers();
    closeItemMenu();
    cleanupBelongings();
  });

  /** 找添加弹窗内的输入控件 */
  function addModalInputs(): {
    modal: HTMLElement;
    name: HTMLInputElement;
    category: HTMLInputElement;
    price: HTMLInputElement;
    date: HTMLInputElement;
  } {
    const modal = [...document.querySelectorAll('div')].find(
      (d) => (d as HTMLElement).classList.contains('bz-belongings-overlay--11100') && d.style.display === 'flex'
    ) as HTMLElement;
    const inputs = modal.querySelectorAll('input');
    return {
      modal,
      name: inputs[0],
      category: inputs[1],
      price: modal.querySelector('input[type="number"]') as HTMLInputElement,
      date: modal.querySelector('input[type="date"]') as HTMLInputElement,
    };
  }

  it('校验链：名称空 → 价格非法 → 缺日期 → 缺分类，全部通过后成功入库', async () => {
    seed(vault);
    await addBelongingsItemCommand();
    await wait();
    const i = addModalInputs();
    const submit = [...i.modal.querySelectorAll('button')].find((b) => b.textContent === '✅ 保存')!;

    submit.click(); // 名称空
    await wait(10);
    expect(hasNotice('请输入物品名称')).toBe(true);

    i.name.value = '新耳机';
    submit.click(); // 价格 NaN
    await wait(10);
    expect(hasNotice('请输入有效的价格')).toBe(true);

    i.price.value = '-5';
    submit.click(); // 价格为负同样拒绝
    await wait(10);
    expect(hasNotice('请输入有效的价格')).toBe(true);

    i.price.value = '299';
    i.date.value = '';
    submit.click(); // 缺日期
    await wait(10);
    expect(hasNotice('请选择购买日期')).toBe(true);

    i.date.value = '2025-01-01';
    submit.click(); // 分类空
    await wait(10);
    expect(hasNotice('请选择或输入分类')).toBe(true);

    i.category.value = '🎧 蓝牙耳机';
    submit.click(); // 全部通过
    await wait();
    expect(hasNotice(/已添加/)).toBe(true);
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    expect(Object.keys(data.items).length).toBe(3);
    expect(document.body.contains(i.modal)).toBe(false); // 成功后弹窗移除
  });

  it('添加弹窗：取消按钮 / 点击遮罩均可关闭', async () => {
    seed(vault);
    await addBelongingsItemCommand();
    await wait();
    let modal = modalByTitle('添加物品');
    [...modal.querySelectorAll('button')].find((b) => b.textContent === '取消')!.click();
    expect(modal.isConnected).toBe(false);

    await addBelongingsItemCommand();
    await wait();
    modal = modalByTitle('添加物品');
    modal.dispatchEvent(new MouseEvent('click', { bubbles: true })); // e.target === overlay
    expect(modal.isConnected).toBe(false);
    expect(hasNotice(/已添加/)).toBe(false); // 未保存
  });

  it('search-select 键盘导航：聚焦展开、输入过滤、↓ 高亮、Enter 选中、Esc 收起', async () => {
    seed(vault);
    await addBelongingsItemCommand();
    await wait();
    const { category } = addModalInputs();
    const wrapper = category.closest('div > div') as HTMLElement; // searchWrapper
    const dropdown = wrapper.querySelector('div[style*="absolute"]') as HTMLElement;
    const options = [...dropdown.children] as HTMLElement[];

    // 聚焦展开全部选项
    category.dispatchEvent(new Event('focus'));
    expect(dropdown.style.display).toBe('block');
    expect(options.length).toBeGreaterThan(0);

    // 输入过滤：仅匹配项可见
    category.value = '机械';
    category.dispatchEvent(new Event('input'));
    const visible = options.filter((o) => o.style.display !== 'none');
    expect(visible.length).toBe(1);
    expect(visible[0].textContent).toContain('机械键盘');

    // ↓ 高亮可见首项 → Enter 写入选中项（选中值自匹配过滤，下拉重新展开属预期行为）
    category.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    expect(visible[0].style.background).toBe('rgb(232, 232, 232)');
    category.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(category.value).toBe('⌨ 机械键盘');
    const visibleAfterEnter = options.filter((o) => o.style.display !== 'none');
    expect(visibleAfterEnter).toEqual([visible[0]]); // 仅剩自身匹配

    // ↑ 在无高亮时夹到第 0 项（不抛错即覆盖分支）；Esc 直接收起
    category.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
    category.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dropdown.style.display).toBe('none');

    // 无匹配 → 下拉隐藏
    category.value = '不存在的分类xyz';
    category.dispatchEvent(new Event('input'));
    expect(dropdown.style.display).toBe('none');
  });

  it('search-select 鼠标点选：写入选项值并按新值过滤下拉', async () => {
    seed(vault);
    await addBelongingsItemCommand();
    await wait();
    const { category } = addModalInputs();
    const wrapper = category.closest('div > div') as HTMLElement;
    const dropdown = wrapper.querySelector('div[style*="absolute"]') as HTMLElement;
    const firstOption = dropdown.children[0] as HTMLElement;
    category.dispatchEvent(new Event('focus'));
    firstOption.click();
    expect(category.value).toBe(firstOption.textContent);
    // 选项点击会触发 input 过滤：选中项文本仍命中自身 → 下拉保持展开且只剩该项
    expect(dropdown.style.display).toBe('block');
    const stillVisible = [...dropdown.children].filter((o) => (o as HTMLElement).style.display !== 'none');
    expect(stillVisible).toEqual([firstOption]);
  });

  it('暗色主题：弹窗与输入框换用暗色色板', async () => {
    seed(vault);
    document.body.classList.add('theme-dark');
    await addBelongingsItemCommand();
    await wait();
    const modal = modalByTitle('添加物品');
    const input = modal.querySelector('input') as HTMLInputElement;
    expect(input.style.border).toContain('rgb(64, 64, 64)'); // jsdom 读回归一化为 rgb
    document.body.classList.remove('theme-dark');
  });

  it('buildForm 字段类型分支：number step / select 选中 / textarea 预填 / required 标记', async () => {
    seed(vault);
    await openBelongingsPanel();
    const card = (document.getElementById('__gui_wu_ben__') as HTMLElement).querySelector('[data-id="item_1"]') as HTMLElement;
    rightClickOpen(card);
    ([...document.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('编辑')) as HTMLElement).click();
    await wait();

    const modal = modalByTitle('编辑物品');
    const numberInput = modal.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numberInput.step).toBe('0.01');
    expect(numberInput.required).toBe(true);
    expect(numberInput.value).toBe('399');

    const select = modal.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('使用中'); // 与条目当前状态一致

    const textarea = modal.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.value).toBe('');

    // 取消按钮关闭
    [...modal.querySelectorAll('button')].find((b) => b.textContent === '取消')!.click();
    expect(modal.isConnected).toBe(false);
  });

  it('编辑校验失败：清空名称保存 → 警告且弹窗保留', async () => {
    seed(vault);
    await openBelongingsPanel();
    const card = (document.getElementById('__gui_wu_ben__') as HTMLElement).querySelector('[data-id="item_1"]') as HTMLElement;
    rightClickOpen(card);
    ([...document.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('编辑')) as HTMLElement).click();
    await wait();

    const modal = modalByTitle('编辑物品');
    const nameInput = modal.querySelector('input') as HTMLInputElement;
    nameInput.value = '';
    ([...modal.querySelectorAll('button')].find((b) => b.textContent === '💾 保存')! as HTMLButtonElement).click();
    await wait(10);
    expect(hasNotice('请输入物品名称')).toBe(true);
    expect(modal.isConnected).toBe(true); // 校验失败不关弹窗

    // ESC 经 escManager 兜底关闭（顶层 belongings-modal 层）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(modal.isConnected).toBe(false);
  });

  it('编辑目标已被移除（数据重载后仍点旧菜单）→ 「物品不存在」', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    rightClickOpen(overlay.querySelector('[data-id="item_1"]') as HTMLElement);
    // 数据文件中移除 item_1 → 自动刷新重载内存库
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    delete data.items.item_1;
    vault.files.set('CONFIG/STORAGE/belongings.json', JSON.stringify(data));
    vault.emit('modify', { path: 'CONFIG/STORAGE/belongings.json' });
    await wait();

    // 旧菜单仍在挂载 → 点「编辑」时按 id 找不到物品
    ([...document.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('编辑')) as HTMLElement).click();
    await wait();
    expect(hasNotice('物品不存在')).toBe(true);
  });

  it('删除目标已被移除 → 同样「物品不存在」兜底', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    rightClickOpen(overlay.querySelector('[data-id="item_2"]') as HTMLElement);
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    delete data.items.item_2;
    vault.files.set('CONFIG/STORAGE/belongings.json', JSON.stringify(data));
    vault.emit('modify', { path: 'CONFIG/STORAGE/belongings.json' });
    await wait();

    const delItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.classList.contains('bz-item-menu-item--danger')
    ) as HTMLElement;
    delItem.click();
    await wait();
    expect(hasNotice('物品不存在')).toBe(true);
  });
});

describe('排序弹窗补充', () => {
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

  /** 同状态两件（同组内排序才决定 DOM 顺序）：贵而旧 / 便宜而新 */
  function seedSameStatus(vault: MockVault) {
    vault.files.set(
      'CONFIG/STORAGE/belongings.json',
      JSON.stringify({
        version: '1.0',
        last_updated: '2025-01-01T00:00:00.000Z',
        items: {
          item_a: {
            id: 'item_a', name: '贵的旧物', category: '📦 收藏', purchase_price: 1999,
            purchase_date: '2020-01-01', current_status: '使用中', description: '',
            created_date: '', last_updated: '',
          },
          item_b: {
            id: 'item_b', name: '便宜的新物', category: '📦 收藏', purchase_price: 399,
            purchase_date: '2024-06-01', current_status: '使用中', description: '',
            created_date: '', last_updated: '',
          },
        },
      })
    );
  }

  it('当前排序按钮高亮；点击「价格 ↓」立即按价格降序重排', async () => {
    vi.useFakeTimers();
    seedSameStatus(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    // 默认购买日期降序：便宜的新物(2024)在前
    expect((overlay.querySelectorAll('[data-id]')[0] as HTMLElement).dataset.id).toBe('item_b');

    // 先归位「日期 ↓」再重开：模块级 sortField/sortOrder 跨用例残留时保证初始态确定
    let p = showSortModal();
    await vi.advanceTimersByTimeAsync(0);
    ([...modalByTitle('排序设置').querySelectorAll('button')].find(
      (b) => b.textContent === '日期 ↓'
    )! as HTMLButtonElement).click();
    await p;

    p = showSortModal();
    await vi.advanceTimersByTimeAsync(0);
    const sortModal = modalByTitle('排序设置');
    const activeBtn = [...sortModal.querySelectorAll('button')].find((b) => b.style.background.includes('accent'))!;
    expect(activeBtn.textContent).toBe('日期 ↓'); // 高亮当前排序

    ([...sortModal.querySelectorAll('button')].find((b) => b.textContent === '价格 ↓')! as HTMLButtonElement).click();
    await p;
    // 价格降序：贵的旧物(1999)在前
    expect((overlay.querySelectorAll('[data-id]')[0] as HTMLElement).dataset.id).toBe('item_a');
    expect(sortModal.isConnected).toBe(false);
    vi.useRealTimers();
  });

  it('排序弹窗内 Esc → 触发关闭按钮等价路径', async () => {
    vi.useFakeTimers();
    seed(vault);
    const p = showSortModal();
    await vi.advanceTimersByTimeAsync(0);
    const sortModal = modalByTitle('排序设置');
    sortModal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await p;
    expect(sortModal.isConnected).toBe(false);
    vi.useRealTimers();
  });

  it('点击遮罩关闭排序弹窗', async () => {
    vi.useFakeTimers();
    seed(vault);
    const p = showSortModal();
    await vi.advanceTimersByTimeAsync(0);
    const sortModal = modalByTitle('排序设置');
    sortModal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await p;
    expect(sortModal.isConnected).toBe(false);
    vi.useRealTimers();
  });
});

describe('主题变化重渲染与清理', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
    localStorage.clear();
    cleanupBelongings();
    setup(vault);
  });

  afterEach(() => {
    Platform.isMobile = false;
    closeItemMenu();
    cleanupBelongings();
  });

  it('body class 变化经 MutationObserver 触发整区重渲染', async () => {
    seed(vault);
    await openBelongingsPanel();
    const overlay = document.getElementById('__gui_wu_ben__') as HTMLElement;
    const cardBefore = overlay.querySelector('[data-id]');
    document.body.classList.add('theme-dark');
    await wait(10);
    const cardAfter = overlay.querySelector('[data-id]');
    expect(cardAfter).not.toBeNull();
    expect(cardAfter).not.toBe(cardBefore); // innerHTML 重建 → 新节点
    document.body.classList.remove('theme-dark');
    await wait(10);
  });

  it('cleanupBelongings 幂等：无面板时重复调用安全', async () => {
    seed(vault);
    await openBelongingsPanel();
    cleanupBelongings();
    expect(document.getElementById('__gui_wu_ben__')).toBeNull();
    expect(() => cleanupBelongings()).not.toThrow(); // 再清一次无元素可移除
  });
});
