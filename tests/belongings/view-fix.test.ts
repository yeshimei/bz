/**
 * 归物本 · 批B「视图交互与报告」修复回归（view-fix）
 *
 * 覆盖清单：
 *  - closePanel 浮层收口（表单净/脏、右键菜单、移动抽屉）——修复前面板关而浮层悬空
 *  - 年份筛选跨开合回落（与 status/sort 同口径）
 *  - 搜索防抖「关后 180ms 内重开」竞态（身份守卫）
 *  - 搜索 ESC 二段清词 + 框尾 ✕（clipbook 定稿范式）
 *  - 网格卡键盘可达（role/tabindex/aria + Enter/Space 委托）
 *  - 表单 Enter / Ctrl+Enter 提交（core bindFormSubmit 收编）；textarea 换行豁免
 *  - 移动端开表单无 100ms 强制聚焦（core 防软键盘口径）
 *  - 详情弹窗编辑保存后就地刷新
 *  - KPI「回收」口径与统计层同源（仅已转卖计售价）
 *  - 年份下拉 data-v esc（脏 purchase_date 不逃逸属性）
 *  - 触控热区：报告头行三钮 + 移动端下拉触发器挂 bz-touch-target
 *  - 日均格式化单源 trimDailyNum（卡片/报告同源；0 元形态不动待拍板 B4）
 *  - 当年日均走势当月列截至今日补全（修复前当月起恒空档）
 *  - 报告重入保留 ctxYear（修复前就地重开跳回最新年）
 *  - 移动端面板/报告页高度接 --bz-vvh（css 源码断言）
 *
 * 测试基建对齐 ui.test.ts：setApp + setSettingsProvider + MockVault 预置 belongings.json。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { openPanel, closePanel, openForm, cleanupBelongings } from '../../src/belongings/ui';
import { openBelReport, closeBelReport, unloadBelReport, isBelReportOpen } from '../../src/belongings/report';
import { computeYearReport, avgDailyCostAsOf } from '../../src/belongings/report-stats';
import { trimDailyNum } from '../../src/belongings/shared';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeItemMenu } from '../../src/core/item-actions';
import { __resetNoticeForTests } from '../../src/core/notice';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, Platform } from '../mock-obsidian-entry';
import type { BelongingsItem } from '../../src/belongings/types';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const flush = () => tick(5);
const DATA_PATH = 'CONFIG/STORAGE/belongings.json';

/** 单件构造（默认使用中；默认日期 2024-06-01 中午，跨时区确定） */
function makeItem(partial: Partial<any> = {}): any {
  const base: any = {
    id: 'item_x',
    name: '机械键盘',
    category: '⌨ 机械键盘',
    purchase_price: 399,
    purchase_date: '2024-06-01T12:00:00',
    current_status: '使用中',
    description: '',
    created_date: '2024-06-01T10:00:00.000Z',
    last_updated: '2024-06-01T10:00:00.000Z',
  };
  return { ...base, ...partial };
}

/** 报告用两/item 构造（purchase_date 纯日期串） */
function makeRepItem(partial: Partial<BelongingsItem>): BelongingsItem {
  return {
    id: 'it',
    name: '物品',
    category: '外设',
    purchase_price: 100,
    purchase_date: '2025-01-01',
    current_status: '使用中',
    description: '',
    created_date: '2025-01-01T00:00:00.000Z',
    last_updated: '2025-01-01T00:00:00.000Z',
    ...partial,
  };
}

/** 报告两年种子（2025 购入+转卖；2023 老物件） */
function seedRepItems(): BelongingsItem[] {
  return [
    makeRepItem({ id: 'a', name: '键盘', category: '⌨ 外设', purchase_price: 1200, purchase_date: '2025-01-10' }),
    makeRepItem({ id: 'b', name: '耳机', category: '外设', purchase_price: 300, purchase_date: '2025-03-05', current_status: '已转卖', exit_date: '2025-05-01', sold_price: 100 }),
    makeRepItem({ id: 'd', name: '雨伞', category: '外出', purchase_price: 88, purchase_date: '2023-08-01' }),
  ];
}

function seed(vault: MockVault, items: Record<string, any>, extra: Record<string, any> = {}) {
  vault.files.set(DATA_PATH, JSON.stringify({ version: '1.0', last_updated: '2025-01-01T00:00:00.000Z', items, ...extra }));
}

const panel = () => document.querySelector('.bz-panel-overlay') as HTMLElement | null;
const content = () => document.querySelector('[data-bel-content]') as HTMLElement | null;
const cells = () => [...document.querySelectorAll('[data-bel-content] .bz-bel-cell')] as HTMLElement[];
const kpiByLabel = (label: string) =>
  ([...document.querySelectorAll('[data-bel-kpis] .bz-bel-kpi')] as HTMLElement[]).find((k) => k.querySelector('span')?.textContent === label) || null;
const kpiVal = (label: string) => kpiByLabel(label)?.querySelector('b')?.textContent || '';
const yearSel = () => document.querySelector('[data-bel-year]') as HTMLElement | null;
const yearLabel = () => yearSel()!.querySelector('.bz-bel-select-label')!.textContent;
const yearOpts = () => [...document.querySelectorAll('[data-bel-yearmenu] .bz-bel-dropopt')] as HTMLElement[];
const searchInp = () => document.querySelector('[data-bel-search]') as HTMLInputElement | null;
const searchClear = () => document.querySelector('[data-bel-search-clear]') as HTMLButtonElement | null;
const detailMask = () => (document.querySelector('.bz-overlay-popup.bz-bel-detail')?.closest('.bz-overlay-mask') as HTMLElement | null) ?? null;
const detailBox = () => document.querySelector('.bz-bel-detail') as HTMLElement | null;

const formMask = () => {
  const m = document.querySelector('.bz-overlay-popup.bz-bel-form') as HTMLElement | null;
  if (!m) throw new Error('表单未打开');
  return m;
};
const nameInp = () => formMask().querySelector('#bm-name') as HTMLInputElement;
const catInp = () => formMask().querySelector('#bm-cat') as HTMLInputElement;
const priceInp = () => formMask().querySelector('#bm-price') as HTMLInputElement;
const dateInp = () => formMask().querySelector('#bm-date') as HTMLInputElement;

function rightClick(cell: HTMLElement, x = 60, y = 60) {
  cell.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: x, clientY: y }));
}
function clickCell(cell: HTMLElement) {
  cell.click();
}
function openAddForm(overlayEl: HTMLElement) {
  (overlayEl.querySelector('.bz-bel-toolrow [data-bel-add]') as HTMLElement).click();
}

async function open(vault: MockVault, settings: any = {}) {
  setApp({ vault } as any);
  setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE', ...settings }) as any);
  resetObsidianMocks();
  await openPanel();
  return panel()!;
}

function setupDom() {
  document.body.innerHTML = '';
  closeItemMenu();
  __resetNoticeForTests();
  resetObsidianMocks();
}
function close() {
  closeItemMenu();
  closePanel();
}

/** 报告分片渲染轮询 */
async function until(cond: () => boolean, timeout = 6000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('until: 条件超时');
    await new Promise((r) => setTimeout(r, 10));
  }
}

// ==================== 生命周期：closePanel 收口 / 年份回落 ====================

describe('批B：closePanel 浮层收口 + 年份回落', () => {
  let vault: MockVault;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
  });
  afterEach(() => {
    vi.useRealTimers();
    Platform.isMobile = false;
    cleanupBelongings();
    closeItemMenu();
  });

  it('修复1a：表单开着再触发 closePanel（命令 toggle 路径）→ 面板与表单一并关（修复前表单孤悬）', async () => {
    await open(vault);
    openAddForm(panel()!);
    expect(document.querySelector('.bz-overlay-popup.bz-bel-form')).not.toBeNull();
    close();
    expect(panel()).toBeNull();
    expect(document.querySelector('.bz-overlay-popup.bz-bel-form')).toBeNull();
  });

  it('修复1b：脏表单开着 closePanel → confirmDiscard 拦截（与 ESC 分支同语义），放弃才关表单', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    rightClick(cells()[0]);
    const items = [...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[];
    (items.find((el) => el.textContent === '编辑') as HTMLElement).click();
    await flush();
    nameInp().value = '改一半';
    close(); // 面板关，脏表单走 confirmDiscard
    expect(panel()).toBeNull();
    expect(document.querySelector('.bz-overlay-popup.bz-bel-form')).not.toBeNull();
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    // 放弃（confirmDiscard 第一动作）→ 表单关，数据未动
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await flush();
    expect(document.querySelector('.bz-overlay-popup.bz-bel-form')).toBeNull();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.name).toBe('键盘');
  });

  it('修复1c：右键菜单开着 closePanel → 菜单一并收（修复前菜单悬空）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    rightClick(cells()[0]);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    close();
    expect(panel()).toBeNull();
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });

  it('修复1d：移动抽屉开着 closePanel → 抽屉一并收', async () => {
    Platform.isMobile = true;
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
      await open(vault);
      clickCell(cells()[0]);
      await flush();
      expect(document.querySelector('.bz-item-sheet-mask')).not.toBeNull();
      close();
      expect(panel()).toBeNull();
      expect(document.querySelector('.bz-item-sheet-mask')).toBeNull();
    } finally {
      Platform.isMobile = false;
    }
  });

  it('修复8：年份筛选跨开合回落「全部年份」（与 status/sort 同口径；修复前重开列表隐性只剩旧年份）', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲', purchase_date: '2024-06-01T12:00:00' }),
      item_2: makeItem({ id: 'item_2', name: '乙', purchase_date: '2023-05-01T12:00:00' }),
    });
    await open(vault);
    yearOpts()[1].click(); // 2024
    expect(yearLabel()).toBe('2024');
    expect(cells()).toHaveLength(1);
    close();
    await openPanel();
    expect(yearLabel()).toBe('全部年份');
    expect(cells()).toHaveLength(2);
  });
});

// ==================== 搜索：竞态 / ESC 二段 / ✕ / 占位符 ====================

describe('批B：搜索防抖竞态 + ESC 二段清词 + ✕', () => {
  let vault: MockVault;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanupBelongings();
  });

  it('修复9：关后 180ms 内重开，旧防抖词不灌新面板（修复前身份穿透 → 空框配过滤列表）', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲' }),
      item_2: makeItem({ id: 'item_2', name: '乙' }),
    });
    await open(vault);
    const inp = searchInp()!;
    inp.value = '甲';
    inp.dispatchEvent(new Event('input'));
    close(); // 防抖窗口内关面板
    await openPanel(); // 窗口内立即重开（修复前定时器此时穿透存活守卫写 M.q）
    await tick(250);
    expect(searchInp()!.value).toBe('');
    expect(cells()).toHaveLength(2);
  });

  it('修复7a：搜索框有词按 ESC → 只清词不关面板（防抖尾触一并取消）；无词 ESC 放行关面板', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '机械键盘' }),
      item_2: makeItem({ id: 'item_2', name: '乙', category: '📱 备用手机' }),
    });
    await open(vault);
    const inp = searchInp()!;
    inp.value = '机械键盘';
    inp.dispatchEvent(new Event('input'));
    await tick(250); // 等防抖落定，列表缩小
    expect(cells()).toHaveLength(1);
    inp.focus();
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(inp.value).toBe('');
    expect(panel()).not.toBeNull(); // 面板不被误关
    await tick(250);
    expect(cells()).toHaveLength(2); // 清词生效（含防抖尾触取消）
    // 无词 ESC：放行 → 关面板语义不变
    inp.focus();
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(panel()).toBeNull();
  });

  it('修复7b：框尾 ✕ 有词显示、点击清词 + 焦点回框；无词隐藏', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '机械键盘' }) });
    await open(vault);
    const inp = searchInp()!;
    const btn = searchClear()!;
    expect(btn.hidden).toBe(true); // 无词隐藏
    inp.value = '键盘';
    inp.dispatchEvent(new Event('input'));
    expect(btn.hidden).toBe(false); // input 同步显隐
    btn.click();
    expect(inp.value).toBe('');
    expect(btn.hidden).toBe(true);
    expect(document.activeElement).toBe(inp); // 焦点回框（继续改词）
    await tick(250);
    expect(cells()).toHaveLength(1); // 全量恢复
  });

  it('杂项：搜索占位符全列举「搜索名称 / 分类 / 备注…」（与 filtered 口径一致）', async () => {
    await open(vault);
    expect(searchInp()!.placeholder).toBe('搜索名称 / 分类 / 备注…');
  });
});

// ==================== 键盘路径：卡片可达 / 表单提交 / 移动聚焦 ====================

describe('批B：键盘路径（卡片可达 + 表单提交 + 移动聚焦）', () => {
  let vault: MockVault;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
  });
  afterEach(() => {
    vi.useRealTimers();
    Platform.isMobile = false;
    cleanupBelongings();
    closeItemMenu();
  });

  it('修复6：卡片带 role=button/tabindex/aria-label；Enter 与 Space 开详情（修复前 Tab 序跳过内容区）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '机械键盘', purchase_price: 399 }) });
    await open(vault);
    const c = cells()[0];
    expect(c.getAttribute('role')).toBe('button');
    expect(c.getAttribute('tabindex')).toBe('0');
    expect(c.getAttribute('aria-label') || '').toContain('机械键盘');
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(detailMask()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(detailMask()).toBeNull();
    c.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(detailMask()).not.toBeNull();
  });

  it('修复6b：移动端卡片 Enter 开底部抽屉（与点击同路）', async () => {
    Platform.isMobile = true;
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '机械键盘' }) });
      await open(vault);
      cells()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await flush();
      expect(document.querySelector('.bz-item-sheet-mask')).not.toBeNull();
    } finally {
      Platform.isMobile = false;
    }
  });

  it('修复5：表单单行 input 回车提交（bindFormSubmit 收编；修复前断头必须点钮）', async () => {
    await open(vault);
    openAddForm(panel()!);
    nameInp().value = '回车新物';
    catInp().value = '数码';
    priceInp().value = '12';
    dateInp().value = '2024-06-01';
    nameInp().dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush();
    expect(document.querySelector('.bz-overlay-popup.bz-bel-form')).toBeNull();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!).items as Record<string, any>;
    expect(Object.values(saved)[0].name).toBe('回车新物');
  });

  it('修复5b：Ctrl+Enter 恒提交；textarea 回车换行不提交', async () => {
    await open(vault);
    openAddForm(panel()!);
    nameInp().value = '组合键新物';
    catInp().value = '数码';
    priceInp().value = '8';
    dateInp().value = '2024-06-01';
    // textarea 回车：放行换行，不提交
    (formMask().querySelector('#bm-desc') as HTMLTextAreaElement).dispatchEvent(
      new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await flush();
    expect(formMask()).not.toBeNull();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items).toEqual({});
    // Ctrl+Enter：任意字段恒提交
    nameInp().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await flush();
    expect(document.querySelector('.bz-overlay-popup.bz-bel-form')).toBeNull();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!).items as Record<string, any>;
    expect(Object.values(saved)[0].name).toBe('组合键新物');
  });

  it('修复3：移动端开表单不自动聚焦输入框（修复前 100ms setTimeout 强制聚焦唤软键盘）', async () => {
    Platform.isMobile = true;
    try {
      await open(vault);
      openAddForm(panel()!);
      expect(document.querySelector('.bz-overlay-popup.bz-bel-form')).not.toBeNull();
      await tick(150); // 越过旧 100ms 定时点
      const active = document.activeElement as HTMLElement | null;
      expect(active?.id).not.toBe('bm-name');
      expect(active?.tagName).not.toBe('TEXTAREA');
    } finally {
      Platform.isMobile = false;
    }
  });
});

// ==================== 详情：编辑保存后就地刷新 ====================

describe('批B：详情弹窗编辑保存后刷新', () => {
  let vault: MockVault;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanupBelongings();
    closeItemMenu();
  });

  it('修复2：详情开着点编辑保存 → 详情就地重建显示新数据（修复前残留旧字段）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '机械键盘', purchase_price: 399, purchase_date: '2024-06-01' }) });
    await open(vault);
    clickCell(cells()[0]);
    expect(detailBox()).not.toBeNull();
    (detailBox()!.querySelector('[data-bd-edit]') as HTMLElement).click();
    await flush();
    expect(document.querySelector('.bz-overlay-popup.bz-bel-form')).not.toBeNull();
    nameInp().value = '红轴机械键盘';
    priceInp().value = '450';
    (formMask().querySelector('#bm-save') as HTMLButtonElement).click();
    await flush();
    // 表单关、详情保持且显示新数据
    expect(document.querySelector('.bz-overlay-popup.bz-bel-form')).toBeNull();
    expect(detailBox()).not.toBeNull();
    expect(detailBox()!.querySelector('.bz-bel-detail-title')!.textContent).toBe('红轴机械键盘');
    expect(detailBox()!.textContent).toContain('￥450.00');
    // 网格卡同步
    expect(cells()[0].textContent).toContain('红轴机械键盘');
  });
});

// ==================== 口径：KPI 回收 / data-v esc / 单源格式化 / 热区 ====================

describe('批B：口径统一（KPI 回收 / data-v esc / trimDailyNum / 热区）', () => {
  let vault: MockVault;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanupBelongings();
  });

  it('修复12：KPI 回收仅认已转卖（丢弃残留售价不计）——与统计层「转卖回血」同口径', async () => {
    seed(vault, {
      is: makeItem({ id: 'is', name: '卖了', current_status: '已转卖', purchase_date: '2024-06-01T12:00:00', exit_date: '2025-01-01', sold_price: 200 }),
      idd: makeItem({ id: 'idd', name: '扔了', current_status: '已丢弃', purchase_date: '2024-06-01T12:00:00', exit_date: '2025-01-01', sold_price: 500 }), // 转卖→丢弃流转残留
    });
    await open(vault);
    // 修复前对全部出离件 sold_price 求和 = ￥700，与年度报告「转卖回血 ￥200」互相矛盾
    expect(kpiVal('已离场 · 回收')).toBe('2 件 · ￥200');
  });

  it('修复10：脏 purchase_date 前 4 字符不逃逸 data-v 属性（年份下拉转义链收口）', async () => {
    seed(vault, { x: makeItem({ id: 'x', name: '脏年份', purchase_date: '"><img src=x>' }) });
    await open(vault);
    const menu = document.querySelector('[data-bel-yearmenu]') as HTMLElement;
    expect(menu.querySelectorAll('img')).toHaveLength(0);
    // 选项仍以文本呈现（选项数 = 全部年份 + 1 脏年份）
    expect(yearOpts().length).toBe(2);
  });

  it('修复13：trimDailyNum 单源（0 元「—」呈报#20 拍板、<0.01 保四位、去尾零）；卡片日均消费同源', async () => {
    expect(trimDailyNum(0.004)).toBe('0.0040');
    expect(trimDailyNum(0)).toBe('—'); // 呈报#20（B4）拍板落地：0 元日均「—」（原 '0.0000' 断言随拍板翻转）
    expect(trimDailyNum(12.5)).toBe('12.5');
    expect(trimDailyNum(5)).toBe('5');
    // 卡片侧消费单源：超小日均显示四位（与报告柱顶同形，修复前报告侧为 0）
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-02T12:00:00'));
    try {
      seed(vault, { t: makeItem({ id: 't', name: '小价差', purchase_price: 0.004, purchase_date: '2024-08-01T12:00:00' }) });
      await open(vault);
      expect(cells()[0].querySelector('.bz-bel-mut')!.textContent).toContain('日均 ￥0.0040');
    } finally {
      vi.useRealTimers();
    }
  });

  it('修复11：报告头行三钮 + 面板年份/移动排序下拉触发器挂 bz-touch-target（触控热区）', async () => {
    // 面板侧：两枚下拉触发器
    await open(vault);
    expect(yearSel()!.classList.contains('bz-touch-target')).toBe(true);
    expect((panel()!.querySelector('[data-bel-mobsortsel]') as HTMLElement).classList.contains('bz-touch-target')).toBe(true);
    close();
    // 报告侧：‹ › ✕ 三钮
    __resetNoticeForTests();
    openBelReport(seedRepItems(), 'cny');
    await until(() => !!document.querySelector('[data-belr-prev]'));
    expect(document.querySelector('[data-belr-prev]')!.classList.contains('bz-touch-target')).toBe(true);
    expect(document.querySelector('[data-belr-next]')!.classList.contains('bz-touch-target')).toBe(true);
    expect(document.querySelector('[data-belr-close]')!.classList.contains('bz-touch-target')).toBe(true);
    closeBelReport();
    unloadBelReport();
  });

  it('修复4：移动端面板/报告页高度接 --bz-vvh（css 源码断言，修复前裸 100vh）', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../src/belongings/styles.css'), 'utf8');
    const mobMedia = css.slice(css.indexOf('@media (max-width: 768px)'));
    expect(mobMedia).toContain('height: var(--bz-vvh, 100vh)');
    const panelRule = mobMedia.slice(mobMedia.indexOf('.bz-bel-panel {'), mobMedia.indexOf('.bz-overlay-popup.bz-bel-detail'));
    expect(panelRule).toContain('height: var(--bz-vvh, 100vh)');
    expect(panelRule).toContain('max-height: var(--bz-vvh, 100vh)');
    const reportRule = mobMedia.slice(mobMedia.indexOf('.bz-bel-report {'));
    expect(reportRule).toContain('height: var(--bz-vvh, 100vh)');
    expect(reportRule).toContain('max-height: var(--bz-vvh, 100vh)');
  });
});

// ==================== 年度报告：当月列补全 / 重入保留年份 ====================

describe('批B：年度报告（当月列补全 + 重入保留年份）', () => {
  beforeEach(() => {
    setupDom();
  });
  afterEach(() => {
    closeBelReport();
    unloadBelReport();
  });

  it('修复14：当年当月列截至今日补全（修复前当月起恒 future 空档），未开始月仍 future 零', () => {
    const NOW = new Date(2026, 8, 19, 12, 0, 0); // 2026-09-19：修复前 9-12 月四列空档
    const items = [makeRepItem({ id: 'k', name: '键盘', purchase_price: 1200, purchase_date: '2026-01-10' })];
    const r = computeYearReport(items, '2026', NOW);
    const sep = r.dailyCostTrend[8]; // 9 月 = 当月
    expect(sep.future).toBe(false);
    expect(sep.capped).toBe(true);
    expect(sep.value).toBeGreaterThan(0);
    expect(sep.value).toBeCloseTo(avgDailyCostAsOf(items, NOW.getTime()), 6); // 截止点 = 今天
    expect(r.dailyCostTrend[9].future).toBe(true); // 10 月未开始
    expect(r.dailyCostTrend[9].capped).toBeUndefined();
    expect(r.dailyCostTrend[11].value).toBe(0);
    // 往年：全月末时点，无 capped
    const past = computeYearReport(items, '2025', NOW);
    expect(past.dailyCostTrend.every((c) => !c.capped)).toBe(true);
  });

  it('修复15：报告重入保留当前年份（修复前就地重开跳回最新年）', async () => {
    openBelReport(seedRepItems(), 'cny');
    await until(() => (document.querySelector('[data-belr-body]')?.textContent || '').includes('2025 年购入与离场'));
    (document.querySelector('[data-belr-prev]') as HTMLElement).click(); // 2025 → 2023
    await until(() => (document.querySelector('[data-belr-body]')?.textContent || '').includes('2023 年购入与离场'));
    expect(document.querySelector('[data-belr-year]')!.textContent).toBe('2023');
    // 面板内保存触发就地重开（openBelReport 重入）：年份保持 2023 不被跳回
    openBelReport(seedRepItems(), 'cny');
    await until(() => (document.querySelector('[data-belr-body]')?.textContent || '').includes('2023 年购入与离场'), 8000);
    expect(document.querySelector('[data-belr-year]')!.textContent).toBe('2023');
    expect(document.querySelectorAll('.bz-bel-report')).toHaveLength(1);
    expect(isBelReportOpen()).toBe(true);
  });
});
