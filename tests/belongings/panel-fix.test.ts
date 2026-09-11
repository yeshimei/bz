/**
 * 归物本 review 面板组回归（review-all-bugs.md H14-H20）：
 * H14 表单防叠开分目标提示 / H15 撤销回调写盘失败兜底 / H16 出离日期倒挂校验 /
 * H17 closePanel 断主题监听 / H18 新物品 id 防同毫秒覆盖 / H19 items 非对象重置 /
 * H20 AI 归类图标回退。
 * 基建仿 ui.test.ts / data.test.ts（MockVault + setApp + notice 走 DOM 断言）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openPanel, openForm, closePanel } from '../../src/belongings/ui';
import { loadDatabase } from '../../src/belongings/data';
import { AI_ICON_MENU, parseCategorySuggestion, AI_FALLBACK_ICON } from '../../src/belongings/ai';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const flush = () => tick(5);
const DATA_PATH = 'CONFIG/STORAGE/belongings.json';

function makeItem(partial: Partial<any> = {}): any {
  return {
    id: 'item_x', name: '机械键盘', category: '键盘周边', purchase_price: 399,
    purchase_date: '2024-06-01T12:00:00', current_status: '使用中', description: '',
    created_date: '2024-06-01T10:00:00.000Z', last_updated: '2024-06-01T10:00:00.000Z',
    ...partial,
  };
}

function seed(vault: MockVault, items: Record<string, any>) {
  vault.files.set(DATA_PATH, JSON.stringify({ version: '1.0', last_updated: '2025-01-01T00:00:00.000Z', items }));
}

async function open(vault: MockVault): Promise<HTMLElement> {
  setApp({ vault } as any);
  setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE' }) as any);
  resetObsidianMocks();
  await openPanel();
  return document.querySelector('.bz-panel-overlay') as HTMLElement;
}

const formMask = () => document.querySelector('.bz-bel-form-mask') as HTMLElement;
const cells = () => [...document.querySelectorAll('[data-bel-content] .bz-bel-cell')] as HTMLElement[];

function rightClick(cell: HTMLElement) {
  cell.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
}
function clickAction(label: string) {
  const items = [...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[];
  const target = items.find((el) => el.querySelector('.bz-item-menu-label')?.textContent === label);
  if (!target) throw new Error('找不到动作项：' + label);
  target.click();
}

describe('归物本 review 面板组回归（H14-H20）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
    clearNotices();
  });

  afterEach(() => {
    closePanel();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('H14：表单已开时编辑另一物品 → 提示不静默聚焦；同一物品仍聚焦', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }), item_2: makeItem({ id: 'item_2', name: '台灯' }) });
    await open(vault);
    const it1 = (JSON.parse(vault.files.get(DATA_PATH)!) as any).items.item_1;
    const it2 = (JSON.parse(vault.files.get(DATA_PATH)!) as any).items.item_2;
    // 开 A 的编辑表单（经 openForm 直开，等价详情/菜单入口）
    openForm({ ...it1 });
    await flush();
    expect(formMask()).toBeTruthy();
    (formMask().querySelector('#bm-name') as HTMLInputElement).value = '键盘改名中';
    clearNotices();
    // 对 B 点编辑：不再静默聚焦 A 的表单，出提示
    openForm({ ...it2 });
    await flush();
    expect(hasNotice(/已有打开的表单/)).toBe(true);
    expect(formMask().querySelector<HTMLInputElement>('#bm-name')!.value).toBe('键盘改名中'); // A 表单原样
    // 同一物品再点编辑：保持既有防叠开行为（聚焦）
    (formMask().querySelector('#bm-name') as HTMLInputElement).focus();
    openForm({ ...it1 });
    await flush();
    expect(document.activeElement).toBe(formMask().querySelector('#bm-name'));
  });

  it('H15：撤销回调写盘失败 → 保存失败通知 + 从盘回滚（内存改动不补刀持久化）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中' }) });
    await open(vault);
    rightClick(cells()[0]);
    clickAction('标记为闲置');
    await flush();
    await tick(20);
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.current_status).toBe('闲置');
    // 注入写盘失败后点撤销
    const origModify = vault.modify.bind(vault);
    (vault as any).modify = async () => { throw new Error('disk full'); };
    try {
      const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement;
      expect(undoBtn).toBeTruthy();
      clearNotices();
      undoBtn.click();
      await flush();
      await tick(20);
      expect(hasNotice('保存失败（撤销状态）：disk full')).toBe(true);
      // 从盘回滚：盘上仍是「闲置」（失败的撤销未落盘）
      expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.current_status).toBe('闲置');
    } finally {
      (vault as any).modify = origModify;
    }
  });

  it('H16：出离日期早于购买日期 → 保存拦截（出离日期不能早于购买日期），不落盘', async () => {
    seed(vault, {});
    await open(vault);
    openForm(null);
    await flush();
    (formMask().querySelector('#bm-name') as HTMLInputElement).value = '旧手机';
    (formMask().querySelector('#bm-cat') as HTMLInputElement).value = '数码';
    (formMask().querySelector('#bm-price') as HTMLInputElement).value = '500';
    (formMask().querySelector('#bm-date') as HTMLInputElement).value = '2024-06-15';
    // 状态切「已转卖」，出离日期填早于购买日
    const sold = [...formMask().querySelectorAll('[data-status]')].find((b) => (b as HTMLElement).dataset.status === '已转卖') as HTMLElement;
    sold.click();
    await flush();
    (formMask().querySelector('#bm-exitdate') as HTMLInputElement).value = '2024-06-01';
    (formMask().querySelector('#bm-save') as HTMLButtonElement).click();
    await flush();
    expect((formMask().querySelector('#bm-err') as HTMLElement).textContent).toContain('出离日期不能早于购买日期');
    // 未落盘（表单未关、无文件写入新条目）
    expect(document.querySelector('.bz-bel-form-mask')).toBeTruthy();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!);
    expect(Object.keys(saved.items ?? {}).length).toBe(0);
    // 改成合法出离日期后可保存
    (formMask().querySelector('#bm-exitdate') as HTMLInputElement).value = '2024-06-20';
    (formMask().querySelector('#bm-save') as HTMLButtonElement).click();
    await flush();
    await tick(20);
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items && Object.keys(JSON.parse(vault.files.get(DATA_PATH)!).items)).toHaveLength(1);
  });

  it('H17：closePanel 断开主题 MutationObserver（面板关闭后 body class 变动不再触发回调）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1' }) });
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');
    await open(vault);
    const callsBefore = disconnectSpy.mock.calls.length;
    closePanel();
    expect(disconnectSpy.mock.calls.length).toBeGreaterThan(callsBefore); // closePanel 断开监听
  });

  it('H18：系统时间冻结（同毫秒）连记两笔 → 两条 id 不同、互不覆盖', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    seed(vault, {});
    await open(vault);
    for (const nm of ['甲物品', '乙物品']) {
      openForm(null);
      await flush();
      (formMask().querySelector('#bm-name') as HTMLInputElement).value = nm;
      (formMask().querySelector('#bm-cat') as HTMLInputElement).value = '数码';
      (formMask().querySelector('#bm-price') as HTMLInputElement).value = '10';
      (formMask().querySelector('#bm-date') as HTMLInputElement).value = '2024-06-15';
      (formMask().querySelector('#bm-save') as HTMLButtonElement).click();
      await flush();
      await tick(20);
    }
    const raw = JSON.parse(vault.files.get(DATA_PATH)!);
    const ids = Object.keys(raw.items);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2); // 同毫秒下 id 仍唯一
    for (const id of ids) expect(id).toMatch(/^item_\d+_[a-z0-9]+$/);
  });

  it('H19：items 为真值非对象（字符串/数组）→ 重置空表，不派生垃圾分类不炸', async () => {
    setApp({ vault } as any);
    setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE' }) as any);
    resetObsidianMocks();
    // 字符串：Object.values 会按字符拆
    vault.files.set(DATA_PATH, JSON.stringify({ version: '1.0', items: 'oops' }));
    const db1 = await loadDatabase();
    expect(db1.items).toEqual({});
    expect(db1.categories).toEqual([]);
    // 数组：元素对象会被 Object.values 当物品参与派生
    vault.files.set(DATA_PATH, JSON.stringify({
      version: '1.0',
      items: [{ id: 'a', category: '幽灵分类', last_updated: '2025-01-01' }],
    }));
    const db2 = await loadDatabase();
    expect(db2.items).toEqual({});
    expect(db2.categories).toEqual([]); // 修复前会派生出「幽灵分类」
  });

  it('H20：AI 归类分类合法但图标非法 → 保留分类、图标回退 package（不再整条弃用）', () => {
    // 非法图标：回退默认
    expect(parseCategorySuggestion('{"category":"数码配件","icon":"not-a-real-icon"}'))
      .toEqual({ category: '数码配件', icon: 'package' });
    // 缺图标字段：同样回退
    expect(parseCategorySuggestion('{"category":"数码配件"}'))
      .toEqual({ category: '数码配件', icon: AI_FALLBACK_ICON });
    // 回退图标必须在菜单内（setIcon 不会静默失败的前提）
    expect(AI_ICON_MENU).toContain(AI_FALLBACK_ICON);
    // 分类非法仍整条 null（无可救部分）
    expect(parseCategorySuggestion('{"category":"","icon":"box"}')).toBeNull();
    // 全合法：原样通过
    expect(parseCategorySuggestion('{"category":"数码配件","icon":"camera"}'))
      .toEqual({ category: '数码配件', icon: 'camera' });
  });
});
