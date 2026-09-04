/**
 * 归物本 UI 测试（ticket 177：状态边栏 × 时间轴重写版）
 *
 * 旧 ui.test.ts / extra.test.ts / ui-cov.test.ts 引用已删除 API（openBelongingsPanel /
 * addBelongingsItemCommand / showSortModal）编译失败——三文件合并重写于此，覆盖新模块契约：
 *   src/belongings/ui.ts：openPanel（toggle）/ openForm / cleanupBelongings / belongingSettingsSchema；
 *   DOM：.bz-bel-overlay > .bz-bel-panel → 左状态栏 + 移动 chips → 搜索/年份 → 统计卡 →
 *   年→月时间轴行（行 = 名称/状态徽章/分类名·日期/天数/价格/日均副行）；
 *   行操作桌面右键/单击跟手菜单、移动底部抽屉（core/item-actions）；删除走 core/flow-dialog
 *   （#__shared_confirm_*）；动作发域事件（onDomainEvent('belongings') spy 断言载荷）；
 *   数据文件 modify 自动刷新（vault.emit）；表单校验与保存（记一笔/编辑，belongingsEditChanges 真实纯函数）。
 *
 * 测试基建对齐 data.test.ts：setApp + setSettingsProvider({belongingsDataFolder}) 先行，
 * MockVault.files 预置 belongings.json，openPanel 内部 loadDatabase 拼真实路径读写；
 * 天数口径用带 T12:00:00 的种子日期 + setSystemTime 中午，跨时区确定（对齐 data.test.ts 手法）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openPanel, openForm, closePanel, cleanupBelongings, belongingSettingsSchema } from '../../src/belongings/ui';
import { addBelongingsItem, openBelongings, unloadBelongings } from '../../src/belongings/index';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeItemMenu } from '../../src/core/item-actions';
import { onDomainEvent } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices, Platform } from '../mock-obsidian-entry';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const flush = () => tick(5);

const DATA_PATH = 'CONFIG/STORAGE/belongings.json';

/** 单件构造（默认使用中） */
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

/** 预置库（items 键控 map → 文本文件落 MockVault） */
function seed(vault: MockVault, items: Record<string, any>, extra: Record<string, any> = {}) {
  vault.files.set(DATA_PATH, JSON.stringify({ version: '1.0', last_updated: '2025-01-01T00:00:00.000Z', items, ...extra }));
}

const panel = () => document.querySelector('.bz-bel-overlay') as HTMLElement | null;
const panelOf = () => document.querySelector('.bz-bel-panel') as HTMLElement | null;
const content = () => document.querySelector('[data-bel-content]') as HTMLElement | null;
const stats = () => document.querySelector('[data-bel-stats]') as HTMLElement | null;
const rows = () => [...document.querySelectorAll('[data-bel-content] .bz-bel-row')] as HTMLElement[];
const countEl = () => document.querySelector('[data-bel-count]') as HTMLElement | null;
const yearSel = () => document.querySelector('[data-bel-year]') as HTMLSelectElement | null;
const searchInp = () => document.querySelector('[data-bel-search]') as HTMLInputElement | null;

/** 桌面：行右键出跟手菜单（bubbles 到 content 委托；preventDefault 拦原生） */
function rightClick(row: HTMLElement, x = 60, y = 60) {
  row.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: x, clientY: y }));
}
/** 单击行（桌面=跟手菜单 / 移动=底部抽屉） */
function clickRow(row: HTMLElement) {
  row.click();
}
/** 当前浮层动作项文案列表（桌面菜单 / 移动抽屉共用 label 断言） */
function actionLabels(): string[] {
  return [...document.querySelectorAll('.bz-item-menu-label, .bz-item-sheet-label')].map((e) => e.textContent || '');
}
/** 按文案点击浮层动作项 */
function clickAction(label: string) {
  const items = [...document.querySelectorAll('.bz-item-menu-item, .bz-item-sheet-item')] as HTMLElement[];
  const target = items.find((el) => el.querySelector('.bz-item-menu-label, .bz-item-sheet-label')?.textContent === label);
  if (!target) throw new Error('找不到动作项：' + label + '；现有=' + actionLabels().join('|'));
  target.click();
}

/** 展开全部默认折叠的年节（ticket 189 年节默认折叠后，渲染/动作类用例经此回到全行可见态；
 *  纯同步点击——假时钟用例（useFakeTimers）也可用） */
function expandAllYears(): void {
  for (let i = 0; i < 10; i++) {
    const bars = [...document.querySelectorAll('[data-bel-content] .bz-bel-collapsed[data-bel-expand]')] as HTMLElement[];
    if (!bars.length) return;
    bars.forEach((b) => b.click());
  }
}

/** 打开面板（内部 setApp/setSettingsProvider/resetObsidianMocks + loadDatabase 完成；随后展开全部年节） */
async function open(vault: MockVault, settings: any = {}) {
  setApp({ vault } as any);
  setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE', ...settings }) as any);
  resetObsidianMocks();
  await openPanel();
  expandAllYears();
  return panel()!;
}

// ---- 表单字段访问（模块级：表单可在面板打开/菜单/命令多路径打开） ----
const formMask = () => {
  const m = document.querySelector('.bz-bel-form-mask') as HTMLElement | null;
  if (!m) throw new Error('表单未打开');
  return m;
};
const nameInp = () => formMask().querySelector('#bm-name') as HTMLInputElement;
const catInp = () => formMask().querySelector('#bm-cat') as HTMLInputElement;
const priceInp = () => formMask().querySelector('#bm-price') as HTMLInputElement;
const dateInp = () => formMask().querySelector('#bm-date') as HTMLInputElement;
const errEl = () => formMask().querySelector('#bm-err') as HTMLElement;
const saveBtn = () => formMask().querySelector('#bm-save') as HTMLButtonElement;
const formTitle = () => formMask().querySelector('.bz-bel-form-title')!.textContent!;
/** 从面板主头行点「记一笔」开表单 */
function openAddForm(overlayEl: HTMLElement) {
  (overlayEl.querySelector('.bz-bel-main-head [data-bel-add]') as HTMLElement).click();
}

/** 每用例前戏（清 DOM/通知/浮层/mock 计数） */
function setupDom() {
  document.body.innerHTML = '';
  closeItemMenu();
  clearNotices();
  resetObsidianMocks();
}
/** 关面板（清理打开期间的 vault modify 监听；体面退出） */
function close() {
  closeItemMenu();
  closePanel();
}

// ==================== 面板开合 / 空态 / 清理 ====================

describe('归物本面板：开合 / 空态 / 清理', () => {
  let vault: MockVault;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE' }) as any);
    resetObsidianMocks();
  });
  afterEach(() => {
    cleanupBelongings();
    closeItemMenu();
  });

  it('openPanel：加载空库 → 面板骨架齐全 + 空态文案（这里还没有物品）+ 首建数据文件', async () => {
    await openPanel();
    expect(panelOf()).not.toBeNull();
    expect(panelOf()!.querySelector('.bz-bel-title')!.textContent).toBe('归物本');
    // 骨架：左状态栏 / 移动 chips / 移动搜索行 / 统计 / 计数 / 年份下拉
    expect(panel()!.querySelector('[data-bel-status]')).not.toBeNull();
    expect(panel()!.querySelector('[data-bel-mobstatus]')).not.toBeNull();
    expect(panel()!.querySelector('[data-bel-mobsearch-row]')).not.toBeNull();
    expect(stats()).not.toBeNull();
    expect(countEl()).not.toBeNull();
    expect(yearSel()).not.toBeNull();
    // 空态
    expect(content()!.textContent).toContain('这里还没有物品');
    // 左栏计数：全部 0 + 四态 0
    const cnts = [...document.querySelectorAll('[data-bel-status] .bz-bel-nav-cnt')].map((e) => e.textContent);
    expect(cnts).toEqual(['0', '0', '0', '0', '0']);
    // 空库首建（统一读写语义：缺失建文件）
    expect(vault.files.has(DATA_PATH)).toBe(true);
  });

  it('左栏含全部 + 四态（key 语义 __all/using/idle/sold/discard），默认选中全部', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1' }) });
    await openPanel();
    const sts = [...document.querySelectorAll('[data-bel-status] [data-bel-st]')].map((e) => (e as HTMLElement).dataset.belSt);
    expect(sts).toEqual(['__all', 'using', 'idle', 'sold', 'discard']);
    const names = [...document.querySelectorAll('[data-bel-status] .bz-bel-side-name')].map((e) => e.textContent);
    expect(names).toEqual(['全部', '使用中', '闲置', '已转卖', '已丢弃']);
    expect(document.querySelector('[data-bel-status] .bz-bel-nav-active')!.getAttribute('data-bel-st')).toBe('__all');
  });

  it('toggle：已开再 openPanel 关闭（overlay 移除）；重复关闭安全（幂等）', async () => {
    await openPanel();
    expect(panel()).not.toBeNull();
    await openPanel();
    expect(panel()).toBeNull();
    closePanel();
    expect(panel()).toBeNull();
  });

  it('openPanel 重入保护：loadDatabase await 窗口内并发二次触发不产生双遮罩（僵尸遮罩修复）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1' }) });
    setApp({ vault } as any);
    setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE' }) as any);
    resetObsidianMocks();
    const p1 = openPanel();
    const p2 = openPanel(); // 首次 await loadDatabase 期间同步重入
    await Promise.all([p1, p2]);
    expect(document.querySelectorAll('.bz-bel-overlay')).toHaveLength(1);
    expect(panelOf()).not.toBeNull();
    // 重入被忽略后 toggle 语义不受影响：再开一次仍能正常关闭
    await openPanel();
    expect(panel()).toBeNull();
  });

  it('主按钮开表单；表单取消钮关闭；表单遮罩 mousedown 关闭；面板不受影响', async () => {
    await openPanel();
    (panel()!.querySelector('.bz-bel-main-head [data-bel-add]') as HTMLElement).click();
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    // 取消钮关闭
    (document.querySelector('[data-bm-cancel]') as HTMLElement).click();
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(panel()).not.toBeNull();
    // 遮罩 mousedown 关闭（表单关走 mask/取消钮，无独立 esc 注册）
    (panel()!.querySelector('.bz-bel-main-head [data-bel-add]') as HTMLElement).click();
    (document.querySelector('.bz-bel-form-mask') as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(panel()).not.toBeNull();
  });

  it('面板打开时 ESC → 关面板（escManager bz-bel 层）；关闭后 modify 不再刷新', async () => {
    await openPanel();
    expect(panel()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel()).toBeNull();
    // 关闭后外部 modify 不再触发重建
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '外部新增' }) });
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    expect(panel()).toBeNull();
  });

  it('ESC 分层（对照 favorites）：表单悬浮时 ESC 只关表单，主面板保留；再 ESC 才关主面板', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1' }) });
    await openPanel();
    openAddForm(panel()!);
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    // 第一次 ESC：只关表单
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(panel()).not.toBeNull();
    // 第二次 ESC：关主面板
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel()).toBeNull();
  });

  it('ESC 分层：面板未开时命令路径开表单，ESC 可关表单（注册随表单补挂）', async () => {
    openForm(null); // 命令路径：内部异步 loadDatabase 后再开
    await flush();
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    expect(panel()).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(panel()).toBeNull();
  });

  it('cleanupBelongings：卸载清理幂等（重复调用安全）', async () => {
    await openPanel();
    cleanupBelongings();
    expect(panel()).toBeNull();
    cleanupBelongings();
    expect(panel()).toBeNull();
  });

  it('unloadBelongings（index 卸载）+ 重新 openBelongings 可再开', async () => {
    await openPanel();
    unloadBelongings();
    expect(panel()).toBeNull();
    openBelongings(getApp());
    await flush();
    expect(panel()).not.toBeNull();
    cleanupBelongings();
  });

  it('收尾扫尾：面板/表单遮罩 topifyZ 动态发号（表单恒压主面板）+ 根节点挂 bz-panel-mtop', async () => {
    await openPanel();
    const overlay = panel()!;
    // 根节点接线移动全屏顶距工具类
    expect(panelOf()!.classList.contains('bz-panel-mtop')).toBe(true);
    // 静态 z 档退役：显示即发号（ADR-0067）
    const zOverlay = Number(overlay.style.zIndex);
    expect(Number.isFinite(zOverlay) && zOverlay > 0).toBe(true);
    await openForm(null);
    const mask = document.querySelector('.bz-bel-form-mask') as HTMLElement;
    expect(mask).not.toBeNull();
    const zMask = Number(mask.style.zIndex);
    expect(Number.isFinite(zMask) && zMask > zOverlay).toBe(true);
    // 收尾：取消关表单
    (mask.querySelector('[data-bm-cancel]') as HTMLElement).click();
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    cleanupBelongings();
  });
});

// ==================== 渲染：统计 / 时间轴 / 行字段 ====================

describe('归物本渲染（统计卡 / 时间轴 / 行字段 / 脏数据容错）', () => {
  let vault: MockVault;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanupBelongings();
  });

  it('统计卡：总资产 = 使用中+闲置合计；日均 = 总价/累计天数；件数 = 全部件数', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-01T12:00:00'));
    try {
      seed(vault, {
        item_1: makeItem({ id: 'item_1', name: '键盘', purchase_price: 300, current_status: '使用中' }),
        item_2: makeItem({ id: 'item_2', name: '旧手机', purchase_price: 200, current_status: '闲置' }),
        item_3: makeItem({ id: 'item_3', name: '已卖耳机', purchase_price: 500, current_status: '已转卖' }),
      });
      await open(vault);
      const cards = [...stats()!.querySelectorAll('.bz-bel-stat-main, .bz-bel-stat')] as HTMLElement[];
      const labelOf = (el: HTMLElement) => el.querySelector('.bz-bel-stat-label')!.textContent || '';
      const valueOf = (el: HTMLElement) => el.querySelector('.bz-bel-stat-value')!.textContent || '';
      const main = cards.find((c) => c.classList.contains('bz-bel-stat-main'))!;
      expect(labelOf(main)).toContain('总资产');
      expect(valueOf(main)).toBe('￥500'); // 300+200（转卖/丢弃不计）
      expect(labelOf(cards[1])).toContain('日均成本');
      // 3 件同 2024-06-01 买（61 天）：总价 1000 / (61*3) = 5.46
      expect(valueOf(cards[1])).toBe('￥5.46');
      expect(labelOf(cards[2])).toContain('在册件数');
      expect(valueOf(cards[2])).toBe('3');
    } finally {
      vi.useRealTimers();
    }
  });

  it('时间轴：年节 meta / 月节 / 行字段全（emoji/名称/状态徽章/分类名·日期/天数/价格/日均副行），年降序', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-01T12:00:00'));
    try {
      seed(vault, {
        item_old: makeItem({ id: 'item_old', name: '老键盘', category: '⌨ 机械键盘', purchase_price: 399, purchase_date: '2023-03-15T12:00:00', current_status: '使用中' }),
        item_new: makeItem({ id: 'item_new', name: '新鼠标', category: '🖱 鼠标', purchase_price: 121, purchase_date: '2024-06-01T12:00:00', current_status: '使用中' }),
      });
      await open(vault);
      // 年节降序 + meta：N 件 · 投入 ￥X
      const years = [...document.querySelectorAll('[data-bel-yearhead]')].map((e) => e.textContent);
      expect(years[0]).toContain('2024');
      expect(years[0]).toContain('1 件 · 投入 ￥121');
      expect(years[1]).toContain('2023');
      expect(years[1]).toContain('1 件 · 投入 ￥399');
      // 月节
      const months = [...document.querySelectorAll('.bz-bel-month-head')].map((e) => e.textContent);
      expect(months).toEqual(['6 月', '3 月']);
      // 行字段
      const r = rows();
      expect(r).toHaveLength(2);
      const rowNew = r.find((x) => x.dataset.belId === 'item_new')!;
      expect(rowNew.querySelector('.bz-bel-thumb')!.textContent).toBe('🖱');
      expect(rowNew.querySelector('.bz-bel-name')!.textContent).toBe('新鼠标');
      expect(rowNew.querySelector('.bz-bel-state')!.textContent).toContain('使用中');
      expect(rowNew.querySelector('.bz-bel-state')!.classList.contains('bz-bel-state--using')).toBe(true);
      expect(rowNew.querySelector('.bz-bel-sub')!.textContent).toContain('鼠标 · 2024-06-01');
      expect(rowNew.querySelector('.bz-bel-days')!.textContent).toMatch(/^61 天$/);
      expect(rowNew.querySelector('.bz-bel-price')!.textContent).toBe('￥121');
      expect(rowNew.querySelector('.bz-bel-daily')!.textContent).toBe('日均 ￥2.0'); // 121/61 = 1.98 → 1 位
    } finally {
      vi.useRealTimers();
    }
  });

  it('购买日期无效（脏数据）：归入「未标注日期」年节 + 「日期未知」月 + 天数「—」、副行日均全价、不抛错', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-01T12:00:00'));
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', purchase_date: '', purchase_price: 50 }) });
      await open(vault);
      expect(content()!.querySelector('[data-bel-yearhead="未标注"]')).not.toBeNull();
      expect(content()!.textContent).toContain('未标注日期');
      expect(content()!.textContent).toContain('日期未知');
      const row1 = rows()[0];
      expect(row1.querySelector('.bz-bel-days')!.textContent).toBe('—');
      expect(row1.querySelector('.bz-bel-price')!.textContent).toBe('￥50');
      expect(row1.querySelector('.bz-bel-daily')!.textContent).toBe('日均 ￥50.0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('NaN 价格（脏数据）：不抛错，价格按 ￥0 显示，全面板无 NaN 外漏', async () => {
    seed(vault, {
      item_bad: makeItem({ id: 'item_bad', name: '坏价格', purchase_price: NaN, category: '📱 智能手机' }),
    });
    await open(vault);
    const rowBad = rows().find((x) => x.dataset.belId === 'item_bad')!;
    expect(rowBad.querySelector('.bz-bel-price')!.textContent).toBe('￥0');
    expect(panel()!.textContent).not.toContain('NaN');
    expect(stats()!.textContent).not.toContain('NaN');
  });

  it('已转卖 / 已丢弃行：inactive 弱化类 + 副行「陪伴 N 天」；使用中行无 inactive', async () => {
    seed(vault, {
      item_s: makeItem({ id: 'item_s', name: '卖掉的', current_status: '已转卖' }),
      item_d: makeItem({ id: 'item_d', name: '扔掉的', current_status: '已丢弃' }),
      item_u: makeItem({ id: 'item_u', name: '用着的', current_status: '使用中' }),
    });
    await open(vault);
    const rowS = rows().find((x) => x.dataset.belId === 'item_s')!;
    const rowD = rows().find((x) => x.dataset.belId === 'item_d')!;
    const rowU = rows().find((x) => x.dataset.belId === 'item_u')!;
    expect(rowS.classList.contains('bz-bel-row--inactive')).toBe(true);
    expect(rowD.classList.contains('bz-bel-row--inactive')).toBe(true);
    expect(rowU.classList.contains('bz-bel-row--inactive')).toBe(false);
    expect(rowS.querySelector('.bz-bel-daily')!.textContent).toMatch(/^陪伴 \d+ 天$/);
    expect(rowD.querySelector('.bz-bel-daily')!.textContent).toMatch(/^陪伴 \d+ 天$/);
    expect(rowU.querySelector('.bz-bel-daily')!.textContent).toContain('日均');
    expect(rowS.querySelector('.bz-bel-state')!.classList.contains('bz-bel-state--sold')).toBe(true);
    expect(rowD.querySelector('.bz-bel-state')!.classList.contains('bz-bel-state--discard')).toBe(true);
  });

  it('无 emoji 分类显示首字；空分类兜底 📦（含表单/列表双路径不抛）', async () => {
    seed(vault, {
      item_a: makeItem({ id: 'item_a', name: '无emoji', category: '键盘周边' }),
      item_b: makeItem({ id: 'item_b', name: '空分类', category: '' }),
    });
    await open(vault);
    const rowA = rows().find((x) => x.dataset.belId === 'item_a')!;
    const rowB = rows().find((x) => x.dataset.belId === 'item_b')!;
    expect(rowA.querySelector('.bz-bel-thumb')!.textContent).toBe('键');
    expect(rowA.querySelector('.bz-bel-sub')!.textContent).toContain('盘周边');
    expect(rowB.querySelector('.bz-bel-thumb')!.textContent).toBe('📦');
  });

  it('主头行计数：无筛选 = N 件 · 总投入 ￥X；筛选后 = N 件', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲', purchase_price: 100 }),
      item_2: makeItem({ id: 'item_2', name: '乙', purchase_price: 200, current_status: '闲置' }),
    });
    await open(vault);
    expect(countEl()!.textContent).toBe('2 件 · 总投入 ￥300');
    (document.querySelector('[data-bel-status] [data-bel-st="using"]') as HTMLElement).click();
    expect(countEl()!.textContent).toBe('1 件');
  });
});

// ==================== 筛选：状态 / 年份 / 搜索 / 年节折叠 ====================

describe('归物本筛选（状态 / 年份 / 搜索 / 年节折叠）', () => {
  let vault: MockVault;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
  });
  afterEach(() => {
    vi.useRealTimers();
    Platform.isMobile = false;
    cleanupBelongings();
  });

  it('左栏状态筛选：点 using → 只显示使用中 + nav-active；再点取消回全部（高亮回落全部）', async () => {
    seed(vault, {
      item_u: makeItem({ id: 'item_u', name: '用着的' }),
      item_i: makeItem({ id: 'item_i', name: '闲置物', current_status: '闲置' }),
    });
    await open(vault);
    expect(rows()).toHaveLength(2);
    const usingBtn = document.querySelector('[data-bel-status] [data-bel-st="using"]') as HTMLElement;
    usingBtn.click();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('用着的');
    expect(document.querySelector('[data-bel-status] [data-bel-st="using"]')!.classList.contains('bz-bel-nav-active')).toBe(true);
    expect(document.querySelector('[data-bel-status] .bz-bel-nav-active')!.getAttribute('data-bel-st')).toBe('using');
    (document.querySelector('[data-bel-status] [data-bel-st="using"]') as HTMLElement).click();
    expect(rows()).toHaveLength(2);
    expect(document.querySelector('[data-bel-status] .bz-bel-nav-active')!.getAttribute('data-bel-st')).toBe('__all');
  });

  it('筛选计数：状态栏 + 移动 chips 同源计数正确', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲' }),
      item_2: makeItem({ id: 'item_2', name: '乙', current_status: '闲置' }),
      item_3: makeItem({ id: 'item_3', name: '丙', current_status: '已丢弃' }),
    });
    await open(vault);
    const cnts = [...document.querySelectorAll('[data-bel-status] .bz-bel-nav-cnt')].map((e) => e.textContent);
    expect(cnts).toEqual(['3', '1', '1', '0', '1']);
    const chipCnts = [...document.querySelectorAll('[data-bel-mobstatus] .bz-bel-chip-cnt')].map((e) => e.textContent);
    expect(chipCnts).toEqual(['3', '1', '1', '0', '1']);
  });

  it('筛选无匹配 → 空态（没有符合条件的物品）', async () => {
    seed(vault, { item_u: makeItem({ id: 'item_u', name: '用着的' }) });
    await open(vault);
    (document.querySelector('[data-bel-status] [data-bel-st="sold"]') as HTMLElement).click();
    expect(rows()).toHaveLength(0);
    expect(content()!.querySelector('.bz-empty-title')!.textContent).toBe('没有符合条件的物品');
  });

  it('移动 chips 筛选（Platform.isMobile）：点选过滤主列 + active 类；再点取消回全部', async () => {
    Platform.isMobile = true;
    try {
      seed(vault, {
        item_u: makeItem({ id: 'item_u', name: '用着的' }),
        item_i: makeItem({ id: 'item_i', name: '闲置物', current_status: '闲置' }),
      });
      await open(vault);
      const chipUsing = document.querySelector('[data-bel-mobstatus] [data-bel-st="using"]') as HTMLElement;
      chipUsing.click();
      expect(rows()).toHaveLength(1);
      expect(rows()[0].textContent).toContain('用着的');
      expect(document.querySelector('[data-bel-mobstatus] [data-bel-st="using"]')!.classList.contains('bz-bel-mobchip-active')).toBe(true);
      (document.querySelector('[data-bel-mobstatus] [data-bel-st="using"]') as HTMLElement).click();
      expect(rows()).toHaveLength(2);
    } finally {
      Platform.isMobile = false;
    }
  });

  it('年份下拉：option 全部年份/年份（降序）+ change 筛选；年份×状态组合空态', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲', purchase_date: '2024-06-01T12:00:00' }),
      item_2: makeItem({ id: 'item_2', name: '乙', purchase_date: '2023-05-01T12:00:00' }),
    });
    await open(vault);
    const sel = yearSel()!;
    expect(sel.options.length).toBe(3);
    expect(sel.options[1].value).toBe('2024');
    expect(sel.options[2].value).toBe('2023');
    sel.value = '2024';
    sel.dispatchEvent(new Event('change'));
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('甲');
    // 年份×状态组合 → 无匹配空态（筛选/搜索语境文案）
    (document.querySelector('[data-bel-status] [data-bel-st="idle"]') as HTMLElement).click();
    expect(rows()).toHaveLength(0);
    expect(content()!.querySelector('.bz-empty-title')!.textContent).toBe('没有符合条件的物品');
  });

  it('年份筛选悬空重置：外部 modify 后选中年份消失 → 自动回全部年份（修复前列表恒空）', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲', purchase_date: '2024-06-01T12:00:00' }),
      item_2: makeItem({ id: 'item_2', name: '乙', purchase_date: '2023-05-01T12:00:00' }),
    });
    await open(vault);
    const sel = yearSel()!;
    sel.value = '2024';
    sel.dispatchEvent(new Event('change'));
    expect(rows()).toHaveLength(1);
    // 外部清掉 2024 年条目 → modify 自动刷新
    const db = JSON.parse(vault.files.get(DATA_PATH)!);
    delete db.items.item_1;
    vault.files.set(DATA_PATH, JSON.stringify(db));
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    await tick(20);
    // 修复：悬空年份重置回全部（列表不恒空、下拉显示与筛选状态一致）
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('乙');
    expect(yearSel()!.value).toBe('');
  });

  it('搜索防抖 180ms：标题/分类/描述命中；无匹配文案；清空恢复', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '机械键盘', description: '红轴' }),
      item_2: makeItem({ id: 'item_2', name: '旧手机', category: '📱 备用手机' }),
    });
    await open(vault);
    const inp = searchInp()!;
    inp.value = '键盘';
    inp.dispatchEvent(new Event('input'));
    expect(rows()).toHaveLength(2); // 防抖窗口内未渲染
    await tick(250);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('机械键盘');
    // 分类命中
    inp.value = '备用手机';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('旧手机');
    // 描述命中
    inp.value = '红轴';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(rows()).toHaveLength(1);
    // 无匹配
    inp.value = '不存在的';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(content()!.querySelector('.bz-empty-title')!.textContent).toBe('没有符合条件的物品');
    // 清空恢复
    inp.value = '';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(rows()).toHaveLength(2);
  });

  it('搜索命中只缩列表，左栏计数不随搜索缩小', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲' }),
      item_2: makeItem({ id: 'item_2', name: '乙' }),
    });
    await open(vault);
    const navCnt = document.querySelector('[data-bel-status] .bz-bel-nav-cnt')!.textContent;
    const inp = searchInp()!;
    inp.value = '甲';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(rows()).toHaveLength(1);
    expect(document.querySelector('[data-bel-status] .bz-bel-nav-cnt')!.textContent).toBe(navCnt);
  });

  it('年节折叠/展开：点头部折叠出展开条；点展开条恢复', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲', purchase_date: '2024-06-01T12:00:00' }),
      item_2: makeItem({ id: 'item_2', name: '乙', purchase_date: '2023-05-01T12:00:00' }),
    });
    await open(vault);
    expect(rows()).toHaveLength(2);
    (document.querySelector('[data-bel-yearhead="2024"]') as HTMLElement).click();
    expect(content()!.querySelector('.bz-bel-collapsed[data-bel-expand="2024"]')).not.toBeNull();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('乙');
    expect(content()!.querySelector('.bz-bel-collapsed')!.textContent).toContain('展开 2024 年（1 件）');
    (content()!.querySelector('.bz-bel-collapsed[data-bel-expand="2024"]') as HTMLElement).click();
    expect(content()!.querySelector('.bz-bel-collapsed')).toBeNull();
    expect(rows()).toHaveLength(2);
  });

  it('移动搜索 toggle：点 data-bel-mobsearch 显隐 .bz-bel-mobsearch-show 行，输入过滤生效', async () => {
    Platform.isMobile = true;
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '甲' }) });
      await open(vault);
      const row = document.querySelector('[data-bel-mobsearch-row]') as HTMLElement;
      expect(row.classList.contains('bz-bel-mobsearch-show')).toBe(false);
      (panel()!.querySelector('[data-bel-mobsearch]') as HTMLElement).click();
      expect(row.classList.contains('bz-bel-mobsearch-show')).toBe(true);
      const mobInp = document.querySelector('[data-bel-mobsearch-inp]') as HTMLInputElement;
      mobInp.value = '不存在';
      mobInp.dispatchEvent(new Event('input'));
      await tick(250);
      expect(content()!.querySelector('.bz-empty')).not.toBeNull();
      (panel()!.querySelector('[data-bel-mobsearch]') as HTMLElement).click();
      expect(row.classList.contains('bz-bel-mobsearch-show')).toBe(false);
    } finally {
      Platform.isMobile = false;
    }
  });
});

// ==================== 行操作浮层（桌面菜单 / 移动抽屉 / 动作集） ====================

describe('归物本行操作（桌面菜单 / 移动抽屉 / 动作集）', () => {
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

  it('桌面右键 → .bz-item-menu：动作 = 3 流转（当前状态跳过）+ 编辑 + 删除；删除 danger 类', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中' }) });
    await open(vault);
    rightClick(rows()[0]);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    expect(actionLabels()).toEqual(['标记为闲置', '标记为已转卖', '标记为已丢弃', '编辑', '删除']);
    const items = [...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[];
    expect(items[items.length - 1].classList.contains('bz-item-menu-item--danger')).toBe(true);
    closeItemMenu();
  });

  it('桌面单击行 → 同样出跟手菜单（content 点击委托路径）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    clickRow(rows()[0]);
    await flush();
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    expect(actionLabels()).toContain('编辑');
    closeItemMenu();
  });

  it('移动（Platform.isMobile）：单击行出 .bz-item-sheet + sheetHead（emoji/名称/分类名 · ￥价 · 已用 N 天）', async () => {
    Platform.isMobile = true;
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '机械键盘', purchase_price: 399 }) });
      await open(vault);
      clickRow(rows()[0]);
      await flush();
      expect(document.querySelector('.bz-item-sheet-mask')).not.toBeNull();
      expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
      expect(document.querySelector('.bz-item-sheet-emoji')!.textContent).toBe('⌨');
      expect(document.querySelector('.bz-item-sheet-title')!.textContent).toBe('机械键盘');
      expect(document.querySelector('.bz-item-sheet-sub')!.textContent).toMatch(/^机械键盘 · ￥399\.00 · 已用 \d+ 天$/);
      expect(actionLabels()).toEqual(['标记为闲置', '标记为已转卖', '标记为已丢弃', '编辑', '删除']);
    } finally {
      Platform.isMobile = false;
    }
  });
});

// ==================== 动作：状态流转 / 删除确认流 ====================

describe('归物本动作（状态流转 / 删除确认流）', () => {
  let vault: MockVault;
  let events: any[];
  let off: () => void;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
    events = [];
    off = onDomainEvent('belongings', (evt) => events.push(evt));
  });
  afterEach(() => {
    off();
    vi.useRealTimers();
    Platform.isMobile = false;
    cleanupBelongings();
    closeItemMenu();
  });

  it('桌面菜单状态流转：标记为闲置 → 落盘 current_status/last_updated + status 事件 + notice + 列表刷新', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中' }) });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('标记为闲置');
    await flush();
    // 落盘
    const saved = JSON.parse(vault.files.get(DATA_PATH)!);
    expect(saved.items.item_1.current_status).toBe('闲置');
    expect(saved.items.item_1.last_updated).toBeTruthy();
    // 事件载荷
    expect(events).toEqual([{ kind: 'status', title: '键盘', status: '闲置' }]);
    expect(hasNotice('「键盘」已标记为闲置')).toBe(true);
    // 列表刷新：行徽章变闲置
    const row1 = rows()[0];
    expect(row1.querySelector('.bz-bel-state')!.textContent).toContain('闲置');
    expect(row1.querySelector('.bz-bel-state')!.classList.contains('bz-bel-state--idle')).toBe(true);
    // 桌面菜单非 keepOpen：动作后菜单已关
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });

  it('移动抽屉状态流转：keepOpen 抽屉保持 + 动作区刷新（使用中 出现、闲置 消失）', async () => {
    Platform.isMobile = true;
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '闲置', purchase_date: '2024-06-01' }) });
    await open(vault);
    clickRow(rows()[0]);
    await flush();
    expect(actionLabels()).toEqual(['标记为使用中', '标记为已转卖', '标记为已丢弃', '编辑', '删除']);
    // 触屏静置窗口（item-actions 400ms 吞合成 click）：先过窗口再点动作
    await tick(420);
    clickAction('标记为使用中');
    await flush();
    // keepOpen：抽屉保持 + 动作区重建（新状态项「标记为闲置」出现）
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    expect(actionLabels()).toEqual(['标记为闲置', '标记为已转卖', '标记为已丢弃', '编辑', '删除']);
    expect(document.querySelector('.bz-item-sheet-title')!.textContent).toBe('键盘');
    // 落盘 + 事件 + notice
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.current_status).toBe('使用中');
    expect(events).toEqual([{ kind: 'status', title: '键盘', status: '使用中' }]);
    expect(hasNotice('「键盘」已标记为使用中')).toBe(true);
    // 关抽屉后列表行已刷新
    closeItemMenu();
    expect(rows()[0].querySelector('.bz-bel-state')!.textContent).toContain('使用中');
  });

  it('删除确认流：文案/按钮；取消不删（无事件无 notice）；确认删除 → 落盘删除 + delete 事件 + notice', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('删除');
    await flush();
    // 流程框（标准双动作：取消左 / 确认右）；ticket 189 去掉「不可撤销」威慑文案
    const popup = document.getElementById('__shared_confirm_popup__')!;
    expect(popup).not.toBeNull();
    expect(popup.querySelector('h4')!.textContent).toBe('删除物品');
    expect(popup.textContent).toContain('确定要删除物品「键盘」吗？');
    expect(popup.textContent).not.toContain('不可撤销');
    expect((document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).textContent).toBe('取消');
    expect((document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).textContent).toBe('删除');
    // 取消：不删、无事件、无 notice
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await flush();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1).toBeTruthy();
    expect(rows()).toHaveLength(1);
    expect(events).toHaveLength(0);
    expect(hasNotice(/已删除/)).toBe(false);
    // 重开删除确认 → 确认删除
    rightClick(rows()[0]);
    clickAction('删除');
    await flush();
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items).toEqual({});
    expect(rows()).toHaveLength(0);
    expect(content()!.querySelector('.bz-empty-title')!.textContent).toBe('这里还没有物品');
    expect(events).toEqual([{ kind: 'delete', title: '键盘' }]);
    expect(hasNotice('已删除「键盘」')).toBe(true);
  });

  it('移动抽屉删除：非 keepOpen 先关抽屉再确认；确认后删除', async () => {
    Platform.isMobile = true;
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '旧手机', purchase_date: '2024-06-01' }) });
    await open(vault);
    clickRow(rows()[0]);
    await flush();
    await tick(420); // 触屏静置窗口（否则删除动作的合成 click 被吞）
    clickAction('删除');
    await flush();
    expect(document.querySelector('.bz-item-sheet')).toBeNull(); // 抽屉先收
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items).toEqual({});
    expect(events).toEqual([{ kind: 'delete', title: '旧手机' }]);
    expect(hasNotice('已删除「旧手机」')).toBe(true);
  });

  it('外部 modify 换库后菜单状态流转：按 id 从当前库重取再改，改动照常落盘（修复前写旧引用静默丢失）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中' }) });
    await open(vault);
    rightClick(rows()[0]); // 菜单开着（捕获打开时的条目引用）
    // 外部改写数据文件 → modify → 面板内部 loadDatabase 把 M.db 整体换新
    const db = JSON.parse(vault.files.get(DATA_PATH)!);
    db.items.item_1.name = '外部改名';
    vault.files.set(DATA_PATH, JSON.stringify(db));
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    await tick(20);
    clickAction('标记为闲置');
    await flush();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!);
    expect(saved.items.item_1.current_status).toBe('闲置');
    expect(saved.items.item_1.name).toBe('外部改名'); // 基于新库条目（外部改动不回退）
    expect(events).toEqual([{ kind: 'status', title: '外部改名', status: '闲置' }]);
    expect(hasNotice('「外部改名」已标记为闲置')).toBe(true);
  });

  it('外部 modify 删除条目后：删除确认按 id 校验，不产生幽灵删除通知', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('删除');
    await flush();
    // 确认框开着期间外部已删除该条目 → modify 换库
    const db = JSON.parse(vault.files.get(DATA_PATH)!);
    delete db.items.item_1;
    vault.files.set(DATA_PATH, JSON.stringify(db));
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    await tick(20);
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!);
    expect(saved.items.item_1).toBeUndefined();
    expect(events).toHaveLength(0); // 无 delete 事件（当前库已无此条目）
    expect(hasNotice('该物品已被外部变更删除，列表已刷新')).toBe(true);
  });
});

// ==================== 记一笔 / 编辑表单 ====================

describe('归物本表单（记一笔 / 编辑）', () => {
  let vault: MockVault;
  let events: any[];
  let off: () => void;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
    events = [];
    off = onDomainEvent('belongings', (evt) => events.push(evt));
  });
  afterEach(() => {
    off();
    vi.useRealTimers();
    Platform.isMobile = false;
    cleanupBelongings();
    closeItemMenu();
  });

  const stBtns = () => [...formMask().querySelectorAll('[data-status]')] as HTMLElement[];

  it('主按钮「记一笔」开表单：标题/默认分类（默认分类首条）/日期今天/状态平铺默认使用中', async () => {
    await open(vault);
    openAddForm(panel()!);
    expect(formTitle()).toBe('记一笔');
    expect(saveBtn().textContent).toBe('保存');
    expect(catInp().value).toBe('📱 智能手机'); // DEFAULT_CATEGORIES[0]
    expect(dateInp().value).not.toBe('');
    expect(stBtns().map((b) => b.dataset.status)).toEqual(['使用中', '闲置', '已转卖', '已丢弃']);
    expect(stBtns().find((b) => b.dataset.status === '使用中')!.classList.contains('is-on')).toBe(true);
  });

  it('校验：空名 / 价格 NaN / 价格负值 / 空日期 四文案逐步触发（#bm-err），不落盘不发事件', async () => {
    await open(vault);
    openAddForm(panel()!);
    saveBtn().click(); // 名空（价格也空）
    expect(errEl().textContent).toBe('请输入物品名称');
    nameInp().value = '新物品';
    saveBtn().click(); // 价格 NaN
    expect(errEl().textContent).toBe('请输入有效的价格');
    priceInp().value = '-5';
    saveBtn().click(); // 价格负值
    expect(errEl().textContent).toBe('请输入有效的价格');
    priceInp().value = '100';
    dateInp().value = '';
    saveBtn().click(); // 日期空
    expect(errEl().textContent).toBe('请选择购买日期');
    // 无任何保存发生
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items).toEqual({});
    expect(events).toHaveLength(0);
  });

  it('校验：空分类 → 请选择或输入分类（编辑物品分类被清空且原分类为空才可达）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '无分类物', category: '' }) });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('编辑');
    await flush();
    catInp().value = '';
    saveBtn().click();
    expect(errEl().textContent).toBe('请选择或输入分类');
    expect(events).toHaveLength(0);
  });

  it('分类下拉：输入过滤 + 选项点击回填（弹层收起）', async () => {
    await open(vault);
    (panel()!.querySelector('.bz-bel-main-head [data-bel-add]') as HTMLElement).click();
    catInp().value = '手机';
    catInp().dispatchEvent(new Event('input'));
    const filtered = [...formMask().querySelectorAll('.bz-bel-catopt')] as HTMLElement[];
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((o) => o.textContent!.includes('手机'))).toBe(true);
    filtered[0].click();
    expect(catInp().value).toBe(filtered[0].dataset.cat);
    expect(formMask().querySelector('.bz-bel-catpop')).toBeNull();
  });

  it('状态单选平铺：点选切换 is-on；保存按所选状态落盘', async () => {
    await open(vault);
    openAddForm(panel()!);
    const idleBtn = stBtns().find((b) => b.dataset.status === '闲置') as HTMLElement;
    idleBtn.click();
    expect(stBtns().find((b) => b.dataset.status === '闲置')!.classList.contains('is-on')).toBe(true);
    expect(stBtns().find((b) => b.dataset.status === '使用中')!.classList.contains('is-on')).toBe(false);
    nameInp().value = '闲置新物';
    priceInp().value = '88';
    dateInp().value = '2024-06-01';
    catInp().value = '⌨ 机械键盘';
    saveBtn().click();
    await flush();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!);
    const item: any = Object.values(saved.items)[0];
    expect(item.current_status).toBe('闲置');
  });

  it('正常保存：8 字段 items 落盘（保存结构零冗余）+ add 事件载荷 + notice + 表单关 + 列表出现', async () => {
    await open(vault);
    (panel()!.querySelector('.bz-bel-main-head [data-bel-add]') as HTMLElement).click();
    nameInp().value = '新显示器';
    catInp().value = '🖥 显示器';
    priceInp().value = '1299';
    dateInp().value = '2024-06-15';
    saveBtn().click();
    await flush();
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    const raw = JSON.parse(vault.files.get(DATA_PATH)!);
    expect(Object.keys(raw)).toEqual(['version', 'last_updated', 'items']);
    const item: any = Object.values(raw.items)[0];
    expect(item).toMatchObject({
      name: '新显示器', category: '🖥 显示器', purchase_price: 1299,
      purchase_date: '2024-06-15', current_status: '使用中', description: '',
    });
    expect(item.id).toMatch(/^item_\d+$/);
    expect(item.created_date).toBeTruthy();
    expect(item.last_updated).toBeTruthy();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('add');
    expect(events[0].item).toMatchObject({ name: '新显示器', purchase_price: 1299, current_status: '使用中' });
    expect(events[0].item.id).toBeTruthy();
    expect(hasNotice('物品「新显示器」已添加')).toBe(true);
    expandAllYears(); // 保存后 2024 年节按 ticket 189 默认折叠，展开后断言行可见
    expect(content()!.textContent).toContain('新显示器');
  });

  it('index 命令 addBelongingsItem：直接弹记一笔表单（面板可不开）', async () => {
    await open(vault);
    addBelongingsItem(getApp());
    expect(formMask().querySelector('.bz-bel-form-title')!.textContent).toBe('记一笔');
    (formMask().querySelector('[data-bm-cancel]') as HTMLElement).click();
  });

  it('编辑：菜单「编辑」→ 回填 → 改名改价保存 → 落盘 + edit 事件（belongingsEditChanges）+ notice 已更新', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '机械键盘', purchase_price: 399, description: '红轴', purchase_date: '2024-06-01' }),
    });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('编辑');
    await flush();
    const f = formMask();
    expect(f.querySelector('.bz-bel-form-title')!.textContent).toBe('编辑物品');
    expect(saveBtn().textContent).toBe('更新');
    // 回填（购买日期剥成 date 串）
    expect(nameInp().value).toBe('机械键盘');
    expect(catInp().value).toBe('⌨ 机械键盘');
    expect(priceInp().value).toBe('399');
    expect(dateInp().value).toBe('2024-06-01');
    expect((f.querySelector('#bm-desc') as HTMLTextAreaElement).value).toBe('红轴');
    // 保存（改名称 + 改价；日期不动 → 无 改了购买日期）
    nameInp().value = '红轴机械键盘';
    priceInp().value = '450';
    saveBtn().click();
    await flush();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!);
    expect(saved.items.item_1.name).toBe('红轴机械键盘');
    expect(saved.items.item_1.purchase_price).toBe(450);
    expect(saved.items.item_1.created_date).toBe('2024-06-01T10:00:00.000Z'); // created 保留
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'edit', title: '红轴机械键盘', changes: ['改了名称', '改了价格'] });
    expect(hasNotice('物品「红轴机械键盘」已更新')).toBe(true);
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(rows()[0].textContent).toContain('红轴机械键盘');
  });

  it('编辑改状态为已转卖：changes 含 改了状态+改了出离日期；落盘状态更新 + exit_date 记当天（ADR-0089）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中', purchase_date: '2024-06-01' }) });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('编辑');
    await flush();
    stBtns().find((b) => b.dataset.status === '已转卖')!.click(); // 重绘后新节点
    // 出离态展开出离记录行
    expect((formMask().querySelector('#bm-exit') as HTMLElement).hidden).toBe(false);
    expect((formMask().querySelector('#bm-soldfield') as HTMLElement).hidden).toBe(false);
    saveBtn().click();
    await flush();
    expect(events[0]).toEqual({ kind: 'edit', title: '键盘', changes: ['改了状态', '改了出离日期'] });
    const saved: any = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
    expect(saved.current_status).toBe('已转卖');
    expect(saved.exit_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('编辑来自抽屉（移动）：表单叠抽屉（companion 防误关）→ 保存后表单关 + 抽屉关', async () => {
    Platform.isMobile = true;
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '旧手机', current_status: '闲置', purchase_date: '2024-06-01' }) });
    await open(vault);
    clickRow(rows()[0]);
    await flush();
    await tick(420); // 触屏静置窗口（否则「编辑」动作的合成 click 被吞）
    clickAction('编辑');
    await flush();
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    // 点表单本体不触发外部点击关闭抽屉（registerSheetCompanion）
    formMask().querySelector('.bz-bel-form')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    // 改名保存 → 表单关 + 抽屉关
    nameInp().value = '改后手机';
    saveBtn().click();
    await flush();
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.name).toBe('改后手机');
    expect(events[0]).toEqual({ kind: 'edit', title: '改后手机', changes: ['改了名称'] });
    expect(hasNotice('物品「改后手机」已更新')).toBe(true);
  });

  it('编辑表单点取消：脏表单走 confirmDiscard（放弃才关）；不改动直接关', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('编辑');
    await flush();
    nameInp().value = '改一半';
    (formMask().querySelector('[data-bm-cancel]') as HTMLElement).click();
    await flush();
    // 脏拦截：confirm 弹出，表单保持
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    // 放弃（confirmDiscard 第一动作 = __shared_confirm_cancel__）→ 表单关，数据未动
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await flush();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.name).toBe('键盘');
    expect(events).toHaveLength(0);
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(rows()[0].textContent).toContain('键盘');
    // 未改动表单：取消直接关（无 confirm）
    rightClick(rows()[0]);
    clickAction('编辑');
    await flush();
    (formMask().querySelector('[data-bm-cancel]') as HTMLElement).click();
    await flush();
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
  });

  it('外部 modify 换库后表单保存：按 id 重取写入当前库（修复前弹已更新但改动落不进新库）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', description: '红轴', purchase_date: '2024-06-01' }) });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('编辑');
    await flush();
    // 外部改写 → modify → M.db 整体换新；表单仍悬浮（表单字段 = 打开时快照，保存按表单值全量覆盖）
    const db = JSON.parse(vault.files.get(DATA_PATH)!);
    db.items.item_1.name = '外部同名改';
    vault.files.set(DATA_PATH, JSON.stringify(db));
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    await tick(20);
    // 本地表单保存 → 改动必须写进当前库并落盘（修复前：改在旧对象上，落盘文件无变化）
    nameInp().value = '本地改名';
    saveBtn().click();
    await flush();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!);
    expect(saved.items.item_1.name).toBe('本地改名');
    expect(saved.items.item_1.created_date).toBe('2024-06-01T10:00:00.000Z'); // 当前库对象字段保留（非新建）
    expect(events).toEqual([{ kind: 'edit', title: '本地改名', changes: ['改了名称'] }]);
    expect(hasNotice('物品「本地改名」已更新')).toBe(true);
  });
});

// ==================== 自动刷新 / 事件载荷 / schema / XSS ====================

describe('归物本自动刷新 / 事件载荷 / schema / XSS', () => {
  let vault: MockVault;
  let events: any[];
  let off: () => void;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
    events = [];
    off = onDomainEvent('belongings', (evt) => events.push(evt));
  });
  afterEach(() => {
    off();
    vi.useRealTimers();
    Platform.isMobile = false;
    cleanupBelongings();
    closeItemMenu();
  });

  it('自动刷新：面板开着时数据文件 modify → 内部 loadDatabase 重载 + 新条目出现；无关路径不触发', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    expect(rows()).toHaveLength(1);
    // 外部写入（非本会话 saveAndRender）
    const db = JSON.parse(vault.files.get(DATA_PATH)!);
    db.items.item_2 = makeItem({ id: 'item_2', name: '外部新增', purchase_date: '2024-07-01T12:00:00' });
    vault.files.set(DATA_PATH, JSON.stringify(db));
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    await tick(20);
    expect(content()!.textContent).toContain('外部新增');
    expect(rows()).toHaveLength(2);
    // 其他文件 modify 不触发
    vault.emit('modify', { path: 'CONFIG/STORAGE/other.json' });
    await flush();
    expect(rows()).toHaveLength(2);
  });

  it('自写同路径 modify 不丢内存新值（saveAndRender 后模拟外部事件：回读数据一致，列表仍在）', async () => {
    seed(vault, {});
    await open(vault);
    (panel()!.querySelector('.bz-bel-main-head [data-bel-add]') as HTMLElement).click();
    nameInp().value = '新物品';
    priceInp().value = '10';
    saveBtn().click();
    await flush();
    expect(content()!.textContent).toContain('新物品');
    // 自写后同路径 modify：数据已落盘 → 重载一致，条目不丢
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    await tick(20);
    expect(rows()).toHaveLength(1);
    expect(content()!.textContent).toContain('新物品');
    // 面板内 db 仍持有该条目（后续动作不炸）
    rightClick(rows()[0]);
    expect(actionLabels()).toContain('编辑');
    closeItemMenu();
  });

  it('smartcat 总线事件载荷形状：status{title,status} / add{item 全形} / delete{title}', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中' }) });
    await open(vault);
    // status
    rightClick(rows()[0]);
    clickAction('标记为闲置');
    await flush();
    expect(events[0]).toMatchObject({ kind: 'status', title: '键盘', status: '闲置' });
    // add（载荷 = 落盘 item）
    (panel()!.querySelector('.bz-bel-main-head [data-bel-add]') as HTMLElement).click();
    nameInp().value = '鼠标';
    catInp().value = '🖱 鼠标';
    priceInp().value = '99';
    dateInp().value = '2024-07-01';
    saveBtn().click();
    await flush();
    expect(events[1].kind).toBe('add');
    expect(events[1].item).toMatchObject({
      name: '鼠标', category: '🖱 鼠标', purchase_price: 99,
      purchase_date: '2024-07-01', current_status: '使用中', description: '',
    });
    // delete
    rightClick(rows().find((r) => r.dataset.belId === 'item_1')!);
    clickAction('删除');
    await flush();
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    expect(events[2]).toEqual({ kind: 'delete', title: '键盘' });
  });

  it('belongingSettingsSchema：显示组（默认状态筛选）+ 移动端组；桌面移动组门控 false / 移动 true', () => {
    const settings = { belongingsDataFolder: 'CONFIG/STORAGE' };
    setSettingsProvider(() => settings as any);
    const schema = belongingSettingsSchema();
    expect(schema.groups).toHaveLength(2);
    // 显示组（issue 194）：默认状态筛选 select，常显（无组级门控）
    const view = schema.groups[0];
    expect(view.name).toBe('显示');
    expect(view.visibleWhen).toBeUndefined();
    const vrow = view.rows[0] as any;
    expect(vrow.type).toBe('select');
    expect(vrow.binding).toMatchObject({ key: 'belongingsDefaultStatus' });
    // 移动端组：桌面整组隐藏 / 移动可见
    const g = schema.groups[1];
    expect(g.name).toBe('移动端');
    expect(g.visibleWhen!(settings as any)).toBe(false);
    expect(g.rows).toHaveLength(1);
    const row = g.rows[0] as any;
    expect(row.type).toBe('toggle');
    expect(row.name).toBe('移动端默认全屏');
    expect(row.binding).toMatchObject({ key: 'belongingsMobileDefaultFullscreen' });
    Platform.isMobile = true;
    try {
      expect(g.visibleWhen!(settings as any)).toBe(true);
    } finally {
      Platform.isMobile = false;
    }
  });

  it('XSS：名称含 <img onerror> 按纯文本渲染，不产生 img 元素；动作项按文本构造', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '<img src=x onerror="window.__xss=1">' }),
    });
    await open(vault);
    const row1 = rows()[0];
    expect(row1.querySelectorAll('img')).toHaveLength(0);
    expect(row1.textContent).toContain('<img src=x onerror="window.__xss=1">'); // 原文以文本呈现
    expect((window as any).__xss).toBeUndefined();
    rightClick(row1);
    expect(actionLabels()).toContain('标记为闲置');
    expect(actionLabels()).toContain('删除');
    closeItemMenu();
  });
});

// ==================== ticket 189 增强包回归 ====================

/** 微任务排空（假时钟用 flush 会因 setTimeout 冻结挂死，改用纯微任务驱动 async 链） */
async function drain(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

/** 打开面板但不展开年节（年节默认折叠用例专用） */
async function openRaw(vault: MockVault): Promise<void> {
  setApp({ vault } as any);
  setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE' }) as any);
  resetObsidianMocks();
  await openPanel();
}

describe('年节默认折叠（ticket 189）', () => {
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

  it('当年/上一年默认展开，更早与未标注默认折叠；手动展开以会话内状态为准', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00'));
    try {
      seed(vault, {
        i26: makeItem({ id: 'i26', name: '今年物', purchase_date: '2026-02-01T12:00:00' }),
        i25: makeItem({ id: 'i25', name: '去年物', purchase_date: '2025-02-01T12:00:00' }),
        i24: makeItem({ id: 'i24', name: '前年物', purchase_date: '2024-02-01T12:00:00' }),
        iNA: makeItem({ id: 'iNA', name: '无日期物', purchase_date: '' }),
      });
      await openRaw(vault);
      const names = () => rows().map((r) => r.textContent);
      // 当年/上一年可见；更早 + 未标注折叠
      expect(names().join('|')).toContain('今年物');
      expect(names().join('|')).toContain('去年物');
      expect(names().join('|')).not.toContain('前年物');
      expect(names().join('|')).not.toContain('无日期物');
      // 折叠条出现（未标注折叠条文案用「未标注日期」）
      const bars = [...document.querySelectorAll('.bz-bel-collapsed[data-bel-expand]')] as HTMLElement[];
      expect(bars.map((b) => b.dataset.belExpand).sort()).toEqual(['2024', '未标注']);
      expect(content()!.textContent).toContain('展开 2024 年（1 件）');
      expect(content()!.textContent).toContain('展开 未标注日期（1 件）');
      // 手动展开 2024 → 可见（会话内状态生效）
      (content()!.querySelector('.bz-bel-collapsed[data-bel-expand="2024"]') as HTMLElement).click();
      expect(names().join('|')).toContain('前年物');
      // 再点头部折叠回去
      (document.querySelector('[data-bel-yearhead="2024"]') as HTMLElement).click();
      expect(names().join('|')).not.toContain('前年物');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('统计卡可点筛选（ticket 189）', () => {
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

  it('点总资产卡 = 在用+闲置合成筛选（转卖/丢弃隐藏）；再点取消回全部', async () => {
    seed(vault, {
      iu: makeItem({ id: 'iu', name: '用着', purchase_date: '2024-06-01T12:00:00' }),
      ii: makeItem({ id: 'ii', name: '闲置', current_status: '闲置', purchase_date: '2024-06-01T12:00:00' }),
      is: makeItem({ id: 'is', name: '卖了', current_status: '已转卖', purchase_date: '2024-06-01T12:00:00' }),
      idd: makeItem({ id: 'idd', name: '扔了', current_status: '已丢弃', purchase_date: '2024-06-01T12:00:00' }),
    });
    await open(vault);
    expect(rows()).toHaveLength(4);
    const mainCard = document.querySelector('[data-bel-statclick="asset"]') as HTMLElement;
    expect(mainCard).not.toBeNull();
    mainCard.click();
    expect(rows()).toHaveLength(2);
    expect(rows().map((r) => r.textContent).join('|')).toContain('用着');
    expect(rows().map((r) => r.textContent).join('|')).toContain('闲置');
    // 合成筛选下左栏无四态高亮（asset 非四态之一，「全部」也不亮）
    expect(document.querySelector('[data-bel-status] .bz-bel-nav-active')).toBeNull();
    // 再点取消
    (document.querySelector('[data-bel-statclick="asset"]') as HTMLElement).click();
    expect(rows()).toHaveLength(4);
  });

  it('点在册件数卡 = 清全部筛选（状态/年份/搜索一并复位）', async () => {
    seed(vault, {
      iu: makeItem({ id: 'iu', name: '用着', purchase_date: '2024-06-01T12:00:00' }),
      ii: makeItem({ id: 'ii', name: '闲置物', current_status: '闲置', purchase_date: '2024-06-01T12:00:00' }),
    });
    await open(vault);
    // 预设三层筛选
    (document.querySelector('[data-bel-status] [data-bel-st="using"]') as HTMLElement).click();
    expect(rows()).toHaveLength(1);
    const sel = yearSel()!;
    sel.value = '2024';
    sel.dispatchEvent(new Event('change'));
    const inp = searchInp()!;
    inp.value = '用着';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(rows()).toHaveLength(1);
    // 点在册件数卡 → 全复位
    (document.querySelector('[data-bel-statclick="count"]') as HTMLElement).click();
    expect(rows()).toHaveLength(2);
    expect(yearSel()!.value).toBe('');
    expect(searchInp()!.value).toBe('');
    expect(document.querySelector('[data-bel-status] .bz-bel-nav-active')!.getAttribute('data-bel-st')).toBe('__all');
  });
});

describe('状态流转 / 删除接撤销（ticket 189）', () => {
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

  it('流转撤销：标记为闲置 → notifyUndo；点撤销回使用中并落盘', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中', purchase_date: '2024-06-01T12:00:00' }) });
      await open(vault);
      rightClick(rows()[0]);
      clickAction('标记为闲置');
      await drain();
      expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.current_status).toBe('闲置');
      const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement;
      expect(undoBtn).toBeTruthy();
      undoBtn.click();
      await drain();
      const saved = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
      expect(saved.current_status).toBe('使用中');
      expect(rows()[0].querySelector('.bz-bel-state')!.textContent).toContain('使用中');
      expect(hasNotice('已撤销，「键盘」回到使用中')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('转卖流转记出离日期（ADR-0089）；撤销后清除', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中', purchase_date: '2024-06-01T12:00:00' }) });
      await open(vault);
      rightClick(rows()[0]);
      clickAction('标记为已转卖');
      await drain();
      const sold = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
      expect(sold.current_status).toBe('已转卖');
      expect(sold.exit_date).toBe('2025-06-15');
      // 陪伴天数封口在出离日：2024-06-01 → 2025-06-15 = 379 天（不再随时间增长）
      expect(rows()[0].querySelector('.bz-bel-daily')!.textContent).toContain('陪伴 379 天');
      // 撤销 → 回使用中 + exit_date 清除
      const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement;
      undoBtn.click();
      await drain();
      const restored = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
      expect(restored.current_status).toBe('使用中');
      expect(restored.exit_date ?? null).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('删除撤销：确认删除后点撤销 → 条目按 snapshot 原样写回', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '键盘', purchase_price: 399, current_status: '闲置', purchase_date: '2024-06-01T12:00:00' }),
    });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('删除');
    await flush();
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items).toEqual({});
    expect(hasNotice('已删除「键盘」')).toBe(true);
    const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement;
    undoBtn.click();
    await flush();
    const restored: any = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
    expect(restored).toMatchObject({ id: 'item_1', name: '键盘', purchase_price: 399, current_status: '闲置' });
    expect(rows()).toHaveLength(1);
    expect(hasNotice('已恢复「键盘」')).toBe(true);
  });
});

describe('出离闭环：售价回本 + 表单出离字段（ticket 189 ADR-0089）', () => {
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

  it('日均成本扣转卖回本；转卖行副行带「售出 ￥x」；陪伴天数封口', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    try {
      seed(vault, {
        // 使用中 300 元 2024-06-01（379 天）；转卖 500 元售价 200，出离 2025-01-01（封口 214 天）
        iu: makeItem({ id: 'iu', name: '用着', purchase_price: 300, purchase_date: '2024-06-01T12:00:00' }),
        is: makeItem({
          id: 'is', name: '卖了', purchase_price: 500, current_status: '已转卖',
          purchase_date: '2024-06-01T12:00:00', exit_date: '2025-01-01', sold_price: 200,
        }),
      });
      await open(vault);
      // 回本 =（300 + 500 − 200）/（379 + 214）= 600 / 593 ≈ 1.01
      const cards = [...document.querySelectorAll('[data-bel-stats] .bz-bel-stat, [data-bel-stats] .bz-bel-stat-main')] as HTMLElement[];
      const avgCard = cards.find((c) => c.textContent!.includes('日均成本'))!;
      expect(avgCard.querySelector('.bz-bel-stat-value')!.textContent).toBe('￥1.01');
      // 转卖行副行：陪伴封口 214 天 + 售出 ￥200
      const rowS = rows().find((r) => r.dataset.belId === 'is')!;
      expect(rowS.querySelector('.bz-bel-daily')!.textContent).toBe('陪伴 214 天 · 售出 ￥200');
    } finally {
      vi.useRealTimers();
    }
  });

  it('编辑已转卖条目：出离日期/售价回填；改售价保存 → sold_price 落盘 + changes 含 改了售价', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    try {
      seed(vault, {
        is: makeItem({
          id: 'is', name: '旧手机', purchase_price: 500, current_status: '已转卖',
          purchase_date: '2024-06-01T12:00:00', exit_date: '2025-01-01', sold_price: 200,
        }),
      });
      await open(vault);
      rightClick(rows()[0]);
      clickAction('编辑');
      await drain();
      // 出离行展开 + 字段回填
      expect((formMask().querySelector('#bm-exit') as HTMLElement).hidden).toBe(false);
      expect((formMask().querySelector('#bm-exitdate') as HTMLInputElement).value).toBe('2025-01-01');
      expect((formMask().querySelector('#bm-soldprice') as HTMLInputElement).value).toBe('200');
      // 改售价保存
      (formMask().querySelector('#bm-soldprice') as HTMLInputElement).value = '260.5';
      saveBtn().click();
      await drain();
      const saved: any = JSON.parse(vault.files.get(DATA_PATH)!).items.is;
      expect(saved.sold_price).toBe(260.5);
      expect(saved.exit_date).toBe('2025-01-01');
    } finally {
      vi.useRealTimers();
    }
  });

  it('售价校验：负数/非数字 → 请输入有效的售价，不落盘', async () => {
    seed(vault, {
      is: makeItem({ id: 'is', name: '旧手机', current_status: '已转卖', purchase_date: '2024-06-01T12:00:00', exit_date: '2025-01-01' }),
    });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('编辑');
    await flush();
    (formMask().querySelector('#bm-soldprice') as HTMLInputElement).value = '-5';
    saveBtn().click();
    expect(errEl().textContent).toBe('请输入有效的售价');
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items.is.sold_price).toBeUndefined();
  });

  it('状态选择切到已丢弃：售价字段隐藏（出离日期保留）', async () => {
    const stBtnsLocal = () => [...formMask().querySelectorAll('[data-status]')] as HTMLElement[];
    seed(vault, { iu: makeItem({ id: 'iu', name: '用着', purchase_date: '2024-06-01T12:00:00' }) });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('编辑');
    await flush();
    stBtnsLocal().find((b) => b.dataset.status === '已丢弃')!.click();
    expect((formMask().querySelector('#bm-exit') as HTMLElement).hidden).toBe(false);
    expect((formMask().querySelector('#bm-soldfield') as HTMLElement).hidden).toBe(true);
    // 切回使用中 → 整行隐藏
    stBtnsLocal().find((b) => b.dataset.status === '使用中')!.click();
    expect((formMask().querySelector('#bm-exit') as HTMLElement).hidden).toBe(true);
  });

  it('脏表单遮罩拦截：改名称后点遮罩 → confirm；继续编辑保持', async () => {
    seed(vault, { iu: makeItem({ id: 'iu', name: '键盘', purchase_date: '2024-06-01T12:00:00' }) });
    await open(vault);
    rightClick(rows()[0]);
    clickAction('编辑');
    await flush();
    nameInp().value = '改一半';
    (document.querySelector('.bz-bel-form-mask') as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    // 继续编辑 = __shared_confirm_ok__
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    expect(nameInp().value).toBe('改一半');
  });
});

describe('默认状态筛选接线（issue 194）', () => {
  it('belongingsDefaultStatus=idle → 打开即选中「闲置」并只显闲置件', async () => {
    const vault = new MockVault();
    seed(vault, {
      a: makeItem({ id: 'a', name: '机械键盘', current_status: '使用中' }),
      b: makeItem({ id: 'b', name: '旧相机', category: '📷 相机', current_status: '闲置' }),
    });
    const overlay = await open(vault, { belongingsDefaultStatus: 'idle' });
    // 侧栏激活项 = 闲置
    const active = overlay.querySelector('.bz-bel-side-item.bz-bel-nav-active');
    expect(active?.textContent).toContain('闲置');
    // 内容只渲染闲置件
    const text = content()!.textContent || '';
    expect(text).toContain('旧相机');
    expect(text).not.toContain('机械键盘');
    close();
  });

  it('空串与非法值 → 回落全部', async () => {
    const vault = new MockVault();
    seed(vault, {
      a: makeItem({ id: 'a', name: '机械键盘', current_status: '使用中' }),
      b: makeItem({ id: 'b', name: '旧相机', current_status: '闲置' }),
    });
    const overlay = await open(vault, { belongingsDefaultStatus: 'bogus' });
    const active = overlay.querySelector('.bz-bel-side-item.bz-bel-nav-active');
    expect(active?.textContent).toContain('全部');
    const text = content()!.textContent || '';
    expect(text).toContain('机械键盘');
    expect(text).toContain('旧相机');
    close();
  });

  it('schema 显示组：默认状态筛选 select 五态直绑 belongingsDefaultStatus', () => {
    const schema = belongingSettingsSchema();
    const view = schema.groups.find((g) => g.name === '显示')!;
    const row = view.rows[0] as any;
    expect(row.type).toBe('select');
    expect(row.binding).toMatchObject({ key: 'belongingsDefaultStatus' });
    expect(row.options.map((o: any) => o.value)).toEqual(['', 'using', 'idle', 'sold', 'discard']);
  });
});
