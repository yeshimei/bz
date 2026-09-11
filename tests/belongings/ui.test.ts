/**
 * 归物本 UI 测试（issue 221：P20「瑞士大字报」整体换血版）
 *
 * 视图层换血后的重写版（前身为 ticket 177 时间轴版）：面板骨架 = 窄头行（品牌/⚙/✕）→
 *   海报 hero（大字标题=筛选名 + 标语 + KPI 行：在库件数强调/在库投入/日均成本/已离场·回收）→
 *   筛选 chips（全部/资产/四态带计数，再点回全部，issue 208）→ 工具行（搜索/年份/排序三档/记一笔）→
 *   大字网格卡（NO.XX/状态徽章/emoji/名称/大字价格/meta；离场灰化）→ 脚注。
 *   桌面点卡 = 详情弹窗（字段全览 + 四态流转条 + 编辑/删除，P20 新增）；动作菜单仍只走右键（issue 202）；
 *   移动点卡 = 底部抽屉（core/item-actions）；删除走 core/flow-dialog；动作发域事件（onDomainEvent spy）；
 *   数据文件 modify 自动刷新；表单校验与保存（belongingsEditChanges 真实纯函数）。
 *
 * 契约回归不变：openPanel toggle/重入保护/ESC 分层/topifyZ 动态发号/confirmDiscard/notifyUndo/
 *   belongingsDefaultStatus 接线/移动全屏设置键/XSS/自动刷新/自写短路。
 *
 * 测试基建对齐 data.test.ts：setApp + setSettingsProvider 先行，MockVault.files 预置 belongings.json；
 * 天数口径用带 T12:00:00 的种子日期 + setSystemTime 中午，跨时区确定。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openPanel, openForm, closePanel, cleanupBelongings, belongingSettingsSchema } from '../../src/belongings/ui';
import { addBelongingsItem, openBelongings, unloadBelongings } from '../../src/belongings/index';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeItemMenu } from '../../src/core/item-actions';
import { onDomainEvent } from '../../src/core/domain-bus';
import { resetAIProviderCache, setAISettingsProvider } from '../../src/core/ai';
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

const panel = () => document.querySelector('.bz-panel-overlay') as HTMLElement | null;
const panelOf = () => document.querySelector('.bz-bel-panel') as HTMLElement | null;
const content = () => document.querySelector('[data-bel-content]') as HTMLElement | null;
const grid = () => document.querySelector('[data-bel-grid]') as HTMLElement | null;
const cells = () => [...document.querySelectorAll('[data-bel-content] .bz-bel-cell')] as HTMLElement[];
const kpis = () => document.querySelector('[data-bel-kpis]') as HTMLElement | null;
const kpiByLabel = (label: string) =>
  ([...document.querySelectorAll('[data-bel-kpis] .bz-bel-kpi')] as HTMLElement[]).find((k) => k.querySelector('span')?.textContent === label) || null;
const kpiVal = (label: string) => kpiByLabel(label)?.querySelector('b')?.textContent || '';
const chipsHost = () => document.querySelector('[data-bel-chips]') as HTMLElement | null;
const chipOf = (key: string) => document.querySelector(`[data-bel-chips] .bz-chip[data-bel-st="${key}"]`) as HTMLElement | null;
const chipCnts = () => [...document.querySelectorAll('[data-bel-chips] .bz-chip .bz-chip-cnt')].map((e) => e.textContent);
const heroTitle = () => document.querySelector('[data-bel-herotitle]') as HTMLElement | null;
const heroSub = () => document.querySelector('[data-bel-herosub]') as HTMLElement | null;
const yearSel = () => document.querySelector('[data-bel-year]') as HTMLElement | null;
const yearLabel = () => yearSel()!.querySelector('.bz-bel-select-label')!.textContent;
const yearOpts = () => [...document.querySelectorAll('[data-bel-yearmenu] .bz-bel-dropopt')] as HTMLElement[];
const searchInp = () => document.querySelector('[data-bel-search]') as HTMLInputElement | null;
const detailMask = () => document.querySelector('.bz-bel-detail-mask') as HTMLElement | null;
const detailBox = () => document.querySelector('.bz-bel-detail') as HTMLElement | null;

/** 桌面：卡右键出跟手菜单（bubbles 到 content 委托；preventDefault 拦原生） */
function rightClick(cell: HTMLElement, x = 60, y = 60) {
  cell.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: x, clientY: y }));
}
/** 单击卡（桌面=详情弹窗 P20 / 移动=底部抽屉） */
function clickCell(cell: HTMLElement) {
  cell.click();
}
/** 触屏按压（core/dom.longPress 手势）：touchstart → 停留 ms → touchend；越过 500ms 即长按。
 *  jsdom 不自动合成 click，故短按不会误走「点卡开抽屉」路径，断言只反映长按入口本身 */
async function touchPress(el: HTMLElement, ms: number): Promise<void> {
  const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
  Object.defineProperty(ts, 'touches', { value: [{ clientX: 10, clientY: 10 }] });
  el.dispatchEvent(ts);
  await tick(ms);
  el.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
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

/** 打开面板（内部 setApp/setSettingsProvider/resetObsidianMocks + loadDatabase 完成） */
async function open(vault: MockVault, settings: any = {}) {
  setApp({ vault } as any);
  setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE', ...settings }) as any);
  resetObsidianMocks();
  await openPanel();
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
/** 从工具行点「记一笔」开表单 */
function openAddForm(overlayEl: HTMLElement) {
  (overlayEl.querySelector('.bz-bel-toolrow [data-bel-add]') as HTMLElement).click();
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
/** chips 点击（状态/资产/全部） */
function clickChip(key: string) {
  (chipOf(key) as HTMLElement).click();
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

  it('openPanel：加载空库 → 面板骨架齐全（hero/KPI/chips/工具行/横滑条/移动排序/移动记一笔/页脚品牌）+ 空态文案 + 首建数据文件', async () => {
    await openPanel();
    expect(panelOf()).not.toBeNull();
    // P20 海报皮肤类挂面板根（enh-sweep-c：bz-bel-panel bz-panel-frame bz-panel-mtop 连续 + 皮肤类追加）
    expect(panelOf()!.classList.contains('bz-bel--poster')).toBe(true);
    // 无壳头行（issue 219b/c 范式）：桌面无壳（hero 即头）；移动印章头（H8）：墨章数 + 归物本 + 钱数小字 + ✕
    expect(panelOf()!.querySelector('.bz-bel-mobhead .bz-bel-stamp [data-bel-stampn]')).not.toBeNull();
    expect(panelOf()!.querySelector('[data-bel-mobstats]')).not.toBeNull();
    expect(panelOf()!.querySelector('[data-bel-settings]')).toBeNull();
    expect(panelOf()!.querySelector('[data-bel-close]')!.classList.contains('bz-bel-mob-only')).toBe(true);
    // 骨架：hero / KPI / chips / 工具行 / 排序 / 移动 chips / 移动记一笔
    expect(panel()!.querySelector('[data-bel-herotitle]')).not.toBeNull();
    expect(kpis()).not.toBeNull();
    expect(chipsHost()).not.toBeNull();
    expect(panel()!.querySelector('[data-bel-sort]')).not.toBeNull();
    expect(panel()!.querySelector('[data-bel-mobstatus]')).not.toBeNull();
    expect(panel()!.querySelector('.bz-bel-mobadd')).not.toBeNull();
    expect(yearSel()).not.toBeNull();
    // 用户拍板去除：移动排序段 / 页脚（品牌行+统计脚注）不回归
    expect(panel()!.querySelector('.bz-bel-mobsort, .bz-bel-foot, .bz-bel-foot-brand, [data-bel-footnote]')).toBeNull();
    // 移动横滑条：去资产后五枚（全部+四态，资产筛选走 KPI 点按）
    const mobKeys = [...document.querySelectorAll('[data-bel-mobstatus] .bz-mobstrip-chip')].map((e) => (e as HTMLElement).dataset.belSt);
    expect(mobKeys).toEqual(['__all', 'using', 'idle', 'sold', 'discard']);
    // 空态
    expect(content()!.textContent).toContain('这里还没有物品');
    // hero 大字标题 = 筛选名（默认全部）+ 海报标语
    expect(heroTitle()!.textContent).toBe('全部');
    expect(heroSub()!.textContent).toBe('归物本 — NOTHING MORE, NOTHING LESS');
    // chips 计数：全部/资产/四态 全 0
    expect(chipCnts()).toEqual(['0', '0', '0', '0', '0', '0']);
    // 空库首建（统一读写语义：缺失建文件）
    expect(vault.files.has(DATA_PATH)).toBe(true);
  });

  it('chips 含全部 + 资产 + 四态（key 语义 __all/asset/using/idle/sold/discard），默认选中全部', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1' }) });
    await openPanel();
    const keys = [...document.querySelectorAll('[data-bel-chips] .bz-chip')].map((e) => (e as HTMLElement).dataset.belSt);
    expect(keys).toEqual(['__all', 'asset', 'using', 'idle', 'sold', 'discard']);
    expect(chipOf('__all')!.classList.contains('bz-chip--on')).toBe(true);
    expect(chipOf('using')!.classList.contains('bz-chip--on')).toBe(false);
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
    expect(document.querySelectorAll('.bz-panel-overlay')).toHaveLength(1);
    expect(panelOf()).not.toBeNull();
    // 重入被忽略后 toggle 语义不受影响：再开一次仍能正常关闭
    await openPanel();
    expect(panel()).toBeNull();
  });

  it('工具行主按钮开表单；表单取消钮关闭；表单遮罩 mousedown 关闭；面板不受影响', async () => {
    await openPanel();
    openAddForm(panel()!);
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    // 取消钮关闭
    (document.querySelector('[data-bm-cancel]') as HTMLElement).click();
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(panel()).not.toBeNull();
    // 遮罩 mousedown 关闭（表单关走 mask/取消钮，无独立 esc 注册）
    openAddForm(panel()!);
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

  it('ESC 分层（P20）：详情 → 表单 → 主面板 三层逐层关', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1' }) });
    await openPanel();
    // 第一层：详情
    clickCell(cells()[0]);
    expect(detailMask()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(detailMask()).toBeNull();
    expect(panel()).not.toBeNull();
    // 第二层：表单
    openAddForm(panel()!);
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(panel()).not.toBeNull();
    // 第三层：主面板
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

  it('cleanupBelongings：卸载清理幂等（重复调用安全）+ 详情遮罩一并清理', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1' }) });
    await openPanel();
    clickCell(cells()[0]);
    expect(detailMask()).not.toBeNull();
    cleanupBelongings();
    expect(panel()).toBeNull();
    expect(detailMask()).toBeNull();
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

  it('收尾扫尾：面板/表单/详情遮罩 topifyZ 动态发号（层层恒压）+ 根节点挂 bz-panel-mtop', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1' }) });
    await openPanel();
    const overlay = panel()!;
    // 根节点接线移动全屏顶距工具类
    expect(panelOf()!.classList.contains('bz-panel-mtop')).toBe(true);
    // 静态 z 档退役：显示即发号（ADR-0067）
    const zOverlay = Number(overlay.style.zIndex);
    expect(Number.isFinite(zOverlay) && zOverlay > 0).toBe(true);
    // 详情压面板
    clickCell(cells()[0]);
    const zDetail = Number(detailMask()!.style.zIndex);
    expect(Number.isFinite(zDetail) && zDetail > zOverlay).toBe(true);
    // 表单压详情
    await openForm(null);
    const mask = document.querySelector('.bz-bel-form-mask') as HTMLElement;
    const zForm = Number(mask.style.zIndex);
    expect(Number.isFinite(zForm) && zForm > zDetail).toBe(true);
    // 收尾：取消关表单 + 关详情
    (mask.querySelector('[data-bm-cancel]') as HTMLElement).click();
    (detailMask()! as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); // issue 271：✕ 退役，点遮罩关
    expect(detailMask()).toBeNull();
    cleanupBelongings();
  });
});

// ==================== 渲染：KPI / 网格卡字段 ====================

describe('归物本渲染（KPI / 网格卡字段 / 脏数据容错）', () => {
  let vault: MockVault;
  beforeEach(() => {
    setupDom();
    vault = new MockVault();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanupBelongings();
  });

  it('KPI：在库件数（hero）= 使用中+闲置；在库投入 = 在库原价合计；日均 = 总价/累计天数；已离场·回收', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-01T12:00:00'));
    try {
      seed(vault, {
        item_1: makeItem({ id: 'item_1', name: '键盘', purchase_price: 300, current_status: '使用中' }),
        item_2: makeItem({ id: 'item_2', name: '旧手机', purchase_price: 200, current_status: '闲置' }),
        item_3: makeItem({ id: 'item_3', name: '已卖耳机', purchase_price: 500, current_status: '已转卖' }),
      });
      await open(vault);
      expect(kpiByLabel('在库件数')!.classList.contains('bz-bel-kpi--hero')).toBe(true);
      expect(kpiVal('在库件数')).toBe('2'); // 300+200（转卖/丢弃不计）
      expect(kpiVal('在库投入')).toBe('￥500');
      // 3 件同 2024-06-01 买（61 天）：总价 1000 / (61*3) = 5.46
      expect(kpiVal('日均成本')).toBe('￥5.46');
      expect(kpiVal('已离场 · 回收')).toBe('1 件 · ￥0');
      // 在库两卡可点（data-bel-statclick=asset 语义保留）
      expect(document.querySelectorAll('[data-bel-statclick="asset"]').length).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('网格卡字段全（NO.XX 编号/状态徽章/emoji/名称/大字价格/meta），默认按购入日期降序', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-01T12:00:00'));
    try {
      seed(vault, {
        item_old: makeItem({ id: 'item_old', name: '老键盘', category: '⌨ 机械键盘', purchase_price: 399, purchase_date: '2023-03-15T12:00:00', current_status: '使用中' }),
        item_new: makeItem({ id: 'item_new', name: '新鼠标', category: '🖱 鼠标', purchase_price: 121, purchase_date: '2024-06-01T12:00:00', current_status: '使用中' }),
      });
      await open(vault);
      const cs = cells();
      expect(cs).toHaveLength(2);
      expect(grid()).not.toBeNull();
      const rowNew = cs.find((x) => x.dataset.belId === 'item_new')!;
      const rowOld = cs.find((x) => x.dataset.belId === 'item_old')!;
      // 降序：新鼠标 = NO.01 在前
      expect(cs[0].dataset.belId).toBe('item_new');
      expect(rowNew.querySelector('.bz-bel-cell-idx')!.textContent).toBe('NO.01 — 鼠标');
      expect(rowOld.querySelector('.bz-bel-cell-idx')!.textContent).toBe('NO.02 — 机械键盘');
      expect(rowNew.querySelector('.bz-bel-cell-em [data-icon]')!.getAttribute('data-icon')).toBe('mouse');
      expect(rowNew.querySelector('.bz-bel-name')!.textContent).toBe('新鼠标');
      expect(rowNew.querySelector('.bz-bel-tag')!.textContent).toContain('使用中');
      expect(rowNew.querySelector('.bz-bel-tag')!.classList.contains('bz-bel-tag--using')).toBe(true);
      expect(rowNew.querySelector('.bz-bel-price')!.textContent).toBe('￥121');
      expect(rowNew.querySelector('.bz-bel-mut')!.textContent).toContain('2024-06-01 起 · 61 天 · 日均 ￥1.98');
    } finally {
      vi.useRealTimers();
    }
  });

  it('排序三档：最近购入（默认）/投入最高/日均最高；切换立即生效', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-01T12:00:00'));
    try {
      seed(vault, {
        a: makeItem({ id: 'a', name: '老贵物', purchase_price: 5000, purchase_date: '2023-01-01T12:00:00' }),
        b: makeItem({ id: 'b', name: '新便宜物', purchase_price: 99, purchase_date: '2024-08-01T12:00:00' }),
        c: makeItem({ id: 'c', name: '贵而新', purchase_price: 8000, purchase_date: '2024-07-01T12:00:00' }),
      });
      await open(vault);
      const firstId = () => cells()[0].dataset.belId;
      expect(firstId()).toBe('b'); // 最近购入
      // issue 237 起排序段控随 renderAll 全量重渲（markup 单源胶水，委托在 overlay）——
      // 每次点击前须现查活 DOM，旧工厂「捕获节点连点」模式会点到已 detach 的按钮
      const segBtn = (label: string) => [...document.querySelectorAll('[data-bel-sort] .bz-segmented-btn')].find((b) => b.textContent === label) as HTMLElement;
      expect([...document.querySelectorAll('[data-bel-sort] .bz-segmented-btn')].map((b) => b.textContent)).toEqual(['最近购入', '投入最高', '日均最高']);
      segBtn('投入最高')!.click();
      expect(firstId()).toBe('c'); // 8000
      segBtn('日均最高')!.click();
      // a = 5000/946 ≈ 5.3；b 当天购入 0 天 = 全价档 99/天；c = 8000/31 ≈ 258 → c 最高
      expect(firstId()).toBe('c');
      segBtn('最近购入')!.click();
      expect(firstId()).toBe('b');
    } finally {
      vi.useRealTimers();
    }
  });

  it('购买日期无效（脏数据）：meta「日期未知起 + 天数—」+ 日均全价、不抛错', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-01T12:00:00'));
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', purchase_date: '', purchase_price: 50 }) });
      await open(vault);
      const c = cells()[0];
      expect(c.querySelector('.bz-bel-mut')!.textContent).toContain('日期未知');
      expect(c.querySelector('.bz-bel-mut')!.textContent).toContain('— 天');
      expect(c.querySelector('.bz-bel-price')!.textContent).toBe('￥50');
      expect(c.querySelector('.bz-bel-mut')!.textContent).toContain('日均 ￥50');
    } finally {
      vi.useRealTimers();
    }
  });

  it('NaN 价格（脏数据）：不抛错，价格按 ￥0 显示，全面板无 NaN 外漏', async () => {
    seed(vault, {
      item_bad: makeItem({ id: 'item_bad', name: '坏价格', purchase_price: NaN, category: '📱 智能手机' }),
    });
    await open(vault);
    const c = cells().find((x) => x.dataset.belId === 'item_bad')!;
    expect(c.querySelector('.bz-bel-price')!.textContent).toBe('￥0');
    expect(panel()!.textContent).not.toContain('NaN');
    expect(kpis()!.textContent).not.toContain('NaN');
  });

  it('已转卖 / 已丢弃卡：gone 灰化类 + meta「陪伴 N 天」；转卖带售出价；使用中卡无 gone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    try {
      seed(vault, {
        item_s: makeItem({ id: 'item_s', name: '卖掉的', current_status: '已转卖', exit_date: '2025-01-01', sold_price: 200 }),
        item_d: makeItem({ id: 'item_d', name: '扔掉的', current_status: '已丢弃' }),
        item_u: makeItem({ id: 'item_u', name: '用着的', current_status: '使用中' }),
      });
      await open(vault);
      const cS = cells().find((x) => x.dataset.belId === 'item_s')!;
      const cD = cells().find((x) => x.dataset.belId === 'item_d')!;
      const cU = cells().find((x) => x.dataset.belId === 'item_u')!;
      expect(cS.classList.contains('bz-bel-cell--gone')).toBe(true);
      expect(cD.classList.contains('bz-bel-cell--gone')).toBe(true);
      expect(cU.classList.contains('bz-bel-cell--gone')).toBe(false);
      expect(cS.querySelector('.bz-bel-mut')!.textContent).toContain('陪伴');
      expect(cS.querySelector('.bz-bel-mut')!.textContent).toContain('售出 ￥200');
      expect(cS.querySelector('.bz-bel-tag')!.classList.contains('bz-bel-tag--sold')).toBe(true);
      expect(cD.querySelector('.bz-bel-tag')!.classList.contains('bz-bel-tag--discard')).toBe(true);
      expect(cU.querySelector('.bz-bel-mut')!.textContent).toContain('日均');
    } finally {
      vi.useRealTimers();
    }
  });

  it('闲置卡：accent 价格类（bz-bel-cell--idle）；无 emoji 分类显示首字；空分类兜底 package 图标（issue 231）', async () => {
    seed(vault, {
      item_i: makeItem({ id: 'item_i', name: '闲置物', current_status: '闲置' }),
      item_a: makeItem({ id: 'item_a', name: '无emoji', category: '键盘周边' }),
      item_b: makeItem({ id: 'item_b', name: '空分类', category: '' }),
    });
    await open(vault);
    const cI = cells().find((x) => x.dataset.belId === 'item_i')!;
    expect(cI.classList.contains('bz-bel-cell--idle')).toBe(true);
    const cA = cells().find((x) => x.dataset.belId === 'item_a')!;
    expect(cA.querySelector('.bz-bel-cell-em')!.textContent).toBe('键');
    expect(cA.querySelector('.bz-bel-cell-idx')!.textContent).toContain('键盘周边');
    const cB = cells().find((x) => x.dataset.belId === 'item_b')!;
    expect(cB.querySelector('.bz-bel-cell-em [data-icon]')!.getAttribute('data-icon')).toBe('package');
    expect(cB.querySelector('.bz-bel-cell-idx')!.textContent).toContain('未分类');
  });

  it('hero 大字标题 = 筛选名（issue 208 语义）；筛选后标语切 FILTERED VIEW', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲' }),
      item_2: makeItem({ id: 'item_2', name: '乙', current_status: '闲置' }),
    });
    await open(vault);
    expect(heroTitle()!.textContent).toBe('全部');
    expect(heroSub()!.textContent).toBe('归物本 — NOTHING MORE, NOTHING LESS');
    clickChip('using');
    expect(heroTitle()!.textContent).toBe('使用中');
    expect(heroSub()!.textContent).toBe('归物本 — 1 件在列 · FILTERED VIEW');
    clickChip('asset');
    expect(heroTitle()!.textContent).toBe('资产');
    clickChip('asset');
    expect(heroTitle()!.textContent).toBe('全部');
  });
});

// ==================== 筛选：状态 chips / 年份 / 搜索 ====================

describe('归物本筛选（状态 chips / 年份 / 搜索）', () => {
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

  it('chips 状态筛选：点 using → 只显示使用中 + 实底选中；再点取消回全部（高亮回落全部）', async () => {
    seed(vault, {
      item_u: makeItem({ id: 'item_u', name: '用着的' }),
      item_i: makeItem({ id: 'item_i', name: '闲置物', current_status: '闲置' }),
    });
    await open(vault);
    expect(cells()).toHaveLength(2);
    clickChip('using');
    expect(cells()).toHaveLength(1);
    expect(cells()[0].textContent).toContain('用着的');
    expect(chipOf('using')!.classList.contains('bz-chip--on')).toBe(true);
    expect(chipOf('__all')!.classList.contains('bz-chip--on')).toBe(false);
    clickChip('using');
    expect(cells()).toHaveLength(2);
    expect(chipOf('__all')!.classList.contains('bz-chip--on')).toBe(true);
  });

  it('资产 chip（asset 合成筛选）：使用中+闲置显示，转卖/丢弃隐藏；再点取消', async () => {
    seed(vault, {
      iu: makeItem({ id: 'iu', name: '用着' }),
      ii: makeItem({ id: 'ii', name: '闲置', current_status: '闲置' }),
      is: makeItem({ id: 'is', name: '卖了', current_status: '已转卖' }),
    });
    await open(vault);
    clickChip('asset');
    expect(cells()).toHaveLength(2);
    expect(cells().map((c) => c.textContent).join('|')).toContain('用着');
    expect(chipOf('asset')!.classList.contains('bz-chip--on')).toBe(true);
    clickChip('asset');
    expect(cells()).toHaveLength(3);
  });

  it('筛选计数：桌面 chips 含资产六枚；移动横滑条去资产五枚（同源计数）', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲' }),
      item_2: makeItem({ id: 'item_2', name: '乙', current_status: '闲置' }),
      item_3: makeItem({ id: 'item_3', name: '丙', current_status: '已丢弃' }),
    });
    await open(vault);
    expect(chipCnts()).toEqual(['3', '2', '1', '1', '0', '1']);
    const mobCnts = [...document.querySelectorAll('[data-bel-mobstatus] .bz-chip-cnt')].map((e) => e.textContent);
    expect(mobCnts).toEqual(['3', '1', '1', '0', '1']); // 无资产位
  });

  it('筛选无匹配 → 空态（没有符合条件的物品）', async () => {
    seed(vault, { item_u: makeItem({ id: 'item_u', name: '用着的' }) });
    await open(vault);
    clickChip('sold');
    expect(cells()).toHaveLength(0);
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
      expect(cells()).toHaveLength(1);
      expect(cells()[0].textContent).toContain('用着的');
      expect(document.querySelector('[data-bel-mobstatus] [data-bel-st="using"]')!.classList.contains('is-on')).toBe(true);
      (document.querySelector('[data-bel-mobstatus] [data-bel-st="using"]') as HTMLElement).click();
      expect(cells()).toHaveLength(2);
    } finally {
      Platform.isMobile = false;
    }
  });

  it('年份下拉：自绘海报菜单选项（全部年份/年份降序）+ 点选筛选；年份×状态组合空态', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲', purchase_date: '2024-06-01T12:00:00' }),
      item_2: makeItem({ id: 'item_2', name: '乙', purchase_date: '2023-05-01T12:00:00' }),
    });
    await open(vault);
    // 自绘海报菜单：选项行由 renderPanelView 回填，点选项 = 选年份
    const opts = yearOpts();
    expect(opts.length).toBe(3);
    expect(opts[1].dataset.v).toBe('2024');
    expect(opts[2].dataset.v).toBe('2023');
    expect(yearLabel()).toBe('全部年份');
    opts[1].click();
    expect(cells()).toHaveLength(1);
    expect(cells()[0].textContent).toContain('甲');
    expect(yearLabel()).toBe('2024');
    // 年份×状态组合 → 无匹配空态（筛选/搜索语境文案）
    clickChip('idle');
    expect(cells()).toHaveLength(0);
    expect(content()!.querySelector('.bz-empty-title')!.textContent).toBe('没有符合条件的物品');
  });

  it('年份筛选悬空重置：外部 modify 后选中年份消失 → 自动回全部年份（修复前列表恒空）', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲', purchase_date: '2024-06-01T12:00:00' }),
      item_2: makeItem({ id: 'item_2', name: '乙', purchase_date: '2023-05-01T12:00:00' }),
    });
    await open(vault);
    yearOpts()[1].click(); // 2024
    expect(cells()).toHaveLength(1);
    // 外部清掉 2024 年条目 → modify 自动刷新
    const db = JSON.parse(vault.files.get(DATA_PATH)!);
    delete db.items.item_1;
    vault.files.set(DATA_PATH, JSON.stringify(db));
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    await tick(20);
    // 修复：悬空年份重置回全部（列表不恒空、下拉显示与筛选状态一致）
    expect(cells()).toHaveLength(1);
    expect(cells()[0].textContent).toContain('乙');
    expect(yearLabel()).toBe('全部年份');
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
    expect(cells()).toHaveLength(2); // 防抖窗口内未渲染
    await tick(250);
    expect(cells()).toHaveLength(1);
    expect(cells()[0].textContent).toContain('机械键盘');
    // 分类命中
    inp.value = '备用手机';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(cells()).toHaveLength(1);
    expect(cells()[0].textContent).toContain('旧手机');
    // 描述命中
    inp.value = '红轴';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(cells()).toHaveLength(1);
    // 无匹配
    inp.value = '不存在的';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(content()!.querySelector('.bz-empty-title')!.textContent).toBe('没有符合条件的物品');
    // 清空恢复
    inp.value = '';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(cells()).toHaveLength(2);
  });

  it('搜索命中只缩列表，chips 计数不随搜索缩小', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲' }),
      item_2: makeItem({ id: 'item_2', name: '乙' }),
    });
    await open(vault);
    const cnt = chipCnts()[0];
    const inp = searchInp()!;
    inp.value = '甲';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(cells()).toHaveLength(1);
    expect(chipCnts()[0]).toBe(cnt);
  });

  it('B3：搜索词不跨开关残留——输入后立刻关面板，防抖回调不再写入（重开面板空框配全量列表）', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲' }),
      item_2: makeItem({ id: 'item_2', name: '乙' }),
    });
    await open(vault);
    const inp = searchInp()!;
    inp.value = '甲';
    inp.dispatchEvent(new Event('input'));
    close(); // 防抖窗口内关面板（修复前定时器仍触发写 M.q）
    await tick(250);
    // 重开面板：搜索框为空、列表全量（修复前 M.q 残留「甲」→ 空搜索框配过滤后列表）
    await openPanel();
    expect(searchInp()!.value).toBe('');
    expect(cells()).toHaveLength(2);
  });

  it('B3：搜索渲染刷新 hero 副题（筛选态下「N 件在列」计数随搜索同步）', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '甲' }),
      item_2: makeItem({ id: 'item_2', name: '乙', current_status: '闲置' }),
    });
    await open(vault);
    clickChip('using');
    expect(heroSub()!.textContent).toBe('归物本 — 1 件在列 · FILTERED VIEW');
    // 搜索后该筛选下无命中 → 副题计数同步为 0（修复前搜索回调不刷 hero，仍显示 1 件在列）
    const inp = searchInp()!;
    inp.value = '乙';
    inp.dispatchEvent(new Event('input'));
    await tick(250);
    expect(cells()).toHaveLength(0);
    expect(heroSub()!.textContent).toBe('归物本 — 0 件在列 · FILTERED VIEW');
  });

  it('移动排序下拉：data-bel-mobsortsel 三档（自绘海报菜单），点选生效且桌面段同步', async () => {
    Platform.isMobile = true;
    try {
      seed(vault, {
        item_1: makeItem({ id: 'item_1', name: '甲', purchase_price: 100 }),
        item_2: makeItem({ id: 'item_2', name: '乙', purchase_price: 500 }),
      });
      await open(vault);
      const sel = panel()!.querySelector('[data-bel-mobsortsel]') as HTMLElement;
      expect(sel).not.toBeNull();
      const opts = [...panel()!.querySelectorAll('[data-bel-mobsortmenu] .bz-bel-dropopt')] as HTMLElement[];
      expect(opts.length).toBe(3);
      expect(sel.querySelector('.bz-bel-select-label')!.textContent).toBe('最近购入');
      // 独立 seg 段不回归
      expect(panel()!.querySelector('.bz-bel-mobsort')).toBeNull();
      opts.find((o) => o.dataset.v === 'price')!.click();
      await tick(50);
      // 价格降序生效：乙(500) 在甲(100) 前
      const names = [...content()!.querySelectorAll('.bz-bel-name')].map((e) => e.textContent);
      expect(names).toEqual(['乙', '甲']);
      // 桌面段同步
      const dtBtn = [...panel()!.querySelectorAll('[data-bel-sort] .bz-segmented-btn')]
        .find((b) => b.textContent === '投入最高') as HTMLElement;
      expect(dtBtn.classList.contains('is-on')).toBe(true);
    } finally {
      Platform.isMobile = false;
    }
  });
});

// ==================== 详情弹窗（P20 桌面点卡） ====================

describe('归物本详情弹窗（P20）', () => {
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

  it('桌面点卡 → 详情弹窗：标题/分类/描述/字段全览/四态流转条（当前态高亮）/编辑删除钮', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-01T12:00:00'));
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '机械键盘', purchase_price: 399, description: '红轴' }) });
      await open(vault);
      clickCell(cells()[0]);
      expect(detailBox()).not.toBeNull();
      expect(detailBox()!.querySelector('.bz-bel-detail-title')!.textContent).toBe('机械键盘');
      expect(detailBox()!.textContent).toContain('红轴');
      expect(detailBox()!.textContent).toContain('￥399.00');
      expect(detailBox()!.textContent).toContain('购买日期');
      const flows = [...detailBox()!.querySelectorAll('[data-bd-flow]')] as HTMLElement[];
      expect(flows.map((b) => b.dataset.bdFlow)).toEqual(['使用中', '闲置', '已转卖', '已丢弃']);
      expect(flows.find((b) => b.dataset.bdFlow === '使用中')!.classList.contains('is-cur')).toBe(true);
      expect(detailBox()!.querySelector('[data-bd-edit]')).not.toBeNull();
      expect(detailBox()!.querySelector('[data-bd-del]')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('详情流转条：点闲置 → 落盘 + status 事件 + notice + 流转条高亮刷新；点遮罩关（issue 271）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    clickCell(cells()[0]);
    (detailBox()!.querySelector('[data-bd-flow="闲置"]') as HTMLElement).click();
    await flush();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.current_status).toBe('闲置');
    expect(events).toEqual([{ kind: 'status', title: '键盘', status: '闲置' }]);
    expect(hasNotice('「键盘」已标记为闲置')).toBe(true);
    // 详情保持 + 流转条重绘（当前态 = 闲置）
    expect(detailBox()).not.toBeNull();
    const flows = [...detailBox()!.querySelectorAll('[data-bd-flow]')] as HTMLElement[];
    expect(flows.find((b) => b.dataset.bdFlow === '闲置')!.classList.contains('is-cur')).toBe(true);
    // 网格卡徽章同步
    expect(cells()[0].querySelector('.bz-bel-tag')!.textContent).toContain('闲置');
    // 点遮罩关闭（issue 271：✕ 退役；belongings 遮罩走 mousedown）
    (detailMask()! as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(detailMask()).toBeNull();
  });

  it('详情编辑钮 → 表单打开（回填）；详情删除钮 → 确认流，确认后删除 + 详情关', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    clickCell(cells()[0]);
    (detailBox()!.querySelector('[data-bd-edit]') as HTMLElement).click();
    await flush();
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    expect(nameInp().value).toBe('键盘');
    (formMask().querySelector('[data-bm-cancel]') as HTMLElement).click();
    // 删除
    (detailBox()!.querySelector('[data-bd-del]') as HTMLElement).click();
    await flush();
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await flush();
    expect(detailBox()).not.toBeNull(); // 取消：详情保持
    (detailBox()!.querySelector('[data-bd-del]') as HTMLElement).click();
    await flush();
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items).toEqual({});
    expect(detailMask()).toBeNull(); // 删除后详情随之关
    expect(events).toEqual([{ kind: 'delete', title: '键盘' }]);
  });

  it('详情遮罩 mousedown 自身关闭；点弹窗本体不关', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1' }) });
    await open(vault);
    clickCell(cells()[0]);
    (detailMask() as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(detailMask()).toBeNull();
    clickCell(cells()[0]);
    detailBox()!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(detailMask()).not.toBeNull();
  });

  it('B6：表单叠详情时 ESC 先关表单（顶层先关，修复前先关底下的详情）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    clickCell(cells()[0]);
    expect(detailMask()).not.toBeNull();
    // 详情内点编辑 → 表单叠上
    (detailBox()!.querySelector('[data-bd-edit]') as HTMLElement).click();
    await flush();
    expect(document.querySelector('.bz-bel-form-mask')).not.toBeNull();
    expect(detailMask()).not.toBeNull();
    // 第一层 ESC：关表单，详情保持
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(detailMask()).not.toBeNull();
    // 第二层 ESC：关详情
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(detailMask()).toBeNull();
    expect(panel()).not.toBeNull();
  });

  it('点卡=详情（非动作菜单，issue 202 不冲突），右键仍是动作菜单', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    clickCell(cells()[0]);
    await flush();
    expect(detailMask()).not.toBeNull();
    expect(document.querySelector('.bz-item-menu')).toBeNull(); // 点卡≠菜单
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // ESC 关详情
    expect(detailMask()).toBeNull();
    rightClick(cells()[0]);
    await flush();
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    expect(actionLabels()).toEqual(['标记为闲置', '标记为已转卖', '标记为已丢弃', '编辑', '删除']);
    closeItemMenu();
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
    rightClick(cells()[0]);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    expect(actionLabels()).toEqual(['标记为闲置', '标记为已转卖', '标记为已丢弃', '编辑', '删除']);
    const items = [...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[];
    expect(items[items.length - 1].classList.contains('bz-item-menu-item--danger')).toBe(true);
    closeItemMenu();
  });

  it('桌面右键坐标与菜单挂载不变（P20 网格下右键仍出菜单）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    rightClick(cells()[0], 200, 150);
    await flush();
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    expect(actionLabels()).toContain('编辑');
    closeItemMenu();
  });

  it('移动（Platform.isMobile）：单击卡出 .bz-item-sheet + sheetHead（emoji/名称/分类名 · ￥价 · 已用 N 天）', async () => {
    Platform.isMobile = true;
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '机械键盘', purchase_price: 399 }) });
      await open(vault);
      clickCell(cells()[0]);
      await flush();
      expect(document.querySelector('.bz-item-sheet-mask')).not.toBeNull();
      expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
      expect(document.querySelector('.bz-item-sheet-emoji [data-icon]')!.getAttribute('data-icon')).toBe('keyboard');
      expect(document.querySelector('.bz-item-sheet-title')!.textContent).toBe('机械键盘');
      expect(document.querySelector('.bz-item-sheet-sub')!.textContent).toMatch(/^机械键盘 · ￥399\.00 · 已用 \d+ 天$/);
      // 内联 flex 样式上岸（合规）：头行布局走域内类，无 style.cssText
      expect(document.querySelector('.bz-item-sheet-entry .bz-bel-sheet-head')).not.toBeNull();
      expect(document.querySelector('.bz-bel-sheet-info')).not.toBeNull();
      expect(actionLabels()).toEqual(['标记为闲置', '标记为已转卖', '标记为已丢弃', '编辑', '删除']);
    } finally {
      Platform.isMobile = false;
    }
  });

  it('长按卡 → .bz-item-sheet（统一手势 core/dom.longPress）：桌面长按不弹、移动端短按不弹、移动端长按弹', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '机械键盘', purchase_price: 399 }) });
    await open(vault);
    // 桌面（Platform.isMobile=false）：手势过滤不放行
    await touchPress(cells()[0], 550);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    // 移动端短按（未到 500ms）：不弹
    Platform.isMobile = true;
    await touchPress(cells()[0], 100);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    // 移动端长按：弹抽屉，头部名称正确（与点卡入口同一 openMobSheet）
    await touchPress(cells()[0], 550);
    await flush();
    expect(document.querySelector('.bz-item-sheet-mask')).not.toBeNull();
    expect(document.querySelector('.bz-item-sheet-title')!.textContent).toBe('机械键盘');
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
    rightClick(cells()[0]);
    clickAction('标记为闲置');
    await flush();
    // 落盘
    const saved = JSON.parse(vault.files.get(DATA_PATH)!);
    expect(saved.items.item_1.current_status).toBe('闲置');
    expect(saved.items.item_1.last_updated).toBeTruthy();
    // 事件载荷
    expect(events).toEqual([{ kind: 'status', title: '键盘', status: '闲置' }]);
    expect(hasNotice('「键盘」已标记为闲置')).toBe(true);
    // 列表刷新：卡徽章变闲置
    const c1 = cells()[0];
    expect(c1.querySelector('.bz-bel-tag')!.textContent).toContain('闲置');
    expect(c1.querySelector('.bz-bel-tag')!.classList.contains('bz-bel-tag--idle')).toBe(true);
    // 桌面菜单非 keepOpen：动作后菜单已关
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });

  it('移动抽屉状态流转：keepOpen 抽屉保持 + 动作区刷新（使用中 出现、闲置 消失）', async () => {
    Platform.isMobile = true;
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '闲置', purchase_date: '2024-06-01' }) });
    await open(vault);
    clickCell(cells()[0]);
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
    // 关抽屉后列表卡已刷新
    closeItemMenu();
    expect(cells()[0].querySelector('.bz-bel-tag')!.textContent).toContain('使用中');
  });

  it('删除确认流：文案/按钮；取消不删（无事件无 notice）；确认删除 → 落盘删除 + delete 事件 + notice', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    rightClick(cells()[0]);
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
    expect(cells()).toHaveLength(1);
    expect(events).toHaveLength(0);
    expect(hasNotice(/已删除/)).toBe(false);
    // 重开删除确认 → 确认删除
    rightClick(cells()[0]);
    clickAction('删除');
    await flush();
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items).toEqual({});
    expect(cells()).toHaveLength(0);
    expect(content()!.querySelector('.bz-empty-title')!.textContent).toBe('这里还没有物品');
    expect(events).toEqual([{ kind: 'delete', title: '键盘' }]);
    expect(hasNotice('已删除「键盘」')).toBe(true);
  });

  it('移动抽屉删除：非 keepOpen 先关抽屉再确认；确认后删除', async () => {
    Platform.isMobile = true;
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '旧手机', purchase_date: '2024-06-01' }) });
    await open(vault);
    clickCell(cells()[0]);
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
    rightClick(cells()[0]); // 菜单开着（捕获打开时的条目引用）
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
    rightClick(cells()[0]);
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

  it('B5：状态流转写盘失败 → 保存失败通知 + 内存从盘回滚 + 不发事件不弹撤销', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中' }) });
    await open(vault);
    // 注入写盘失败（jsonFileStore write 会先留档再照抛）
    const origModify = vault.modify.bind(vault);
    (vault as any).modify = async () => { throw new Error('disk full'); };
    try {
      rightClick(cells()[0]);
      clickAction('标记为闲置');
      await flush();
      await tick(20);
      // 人话错误通知（对照 favorites notifySaveError 风格）
      expect(hasNotice('保存失败（状态流转）：disk full')).toBe(true);
      // 失败路径：无领域事件、无撤销按钮
      expect(events).toHaveLength(0);
      expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(false);
      // 内存已从盘回滚：卡徽章仍是使用中
      expect(cells()[0].querySelector('.bz-bel-tag')!.textContent).toContain('使用中');
    } finally {
      (vault as any).modify = origModify;
    }
    // 回滚生效：基于回滚后的库再次流转，落盘终态正确（修复前内存残留「闲置」被下次保存补刀）
    rightClick(cells()[0]);
    clickAction('标记为已转卖');
    await flush();
    await tick(20);
    const saved = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
    expect(saved.current_status).toBe('已转卖');
    expect(events).toEqual([{ kind: 'status', title: '键盘', status: '已转卖' }]);
  });

  it('B5：删除写盘失败 → 保存失败通知 + 条目回滚（无事件无撤销）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    const origModify = vault.modify.bind(vault);
    (vault as any).modify = async () => { throw new Error('disk full'); };
    try {
      rightClick(cells()[0]);
      clickAction('删除');
      await flush();
      (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
      await flush();
      await tick(20);
      expect(hasNotice('保存失败（删除物品）：disk full')).toBe(true);
      expect(events).toHaveLength(0);
      expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(false);
      // 内存回滚：条目仍在列
      expect(cells()).toHaveLength(1);
      expect(cells()[0].textContent).toContain('键盘');
    } finally {
      (vault as any).modify = origModify;
    }
    // 回滚生效：再次删除成功落盘
    rightClick(cells()[0]);
    clickAction('删除');
    await flush();
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    await tick(20);
    expect(JSON.parse(vault.files.get(DATA_PATH)!).items).toEqual({});
    expect(events).toEqual([{ kind: 'delete', title: '键盘' }]);
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

  it('工具行「记一笔」开表单：标题/分类默认空（issue 202 不回填）/日期今天/状态平铺默认使用中', async () => {
    await open(vault);
    openAddForm(panel()!);
    expect(formTitle()).toBe('记一笔');
    expect(saveBtn().textContent).toBe('保存');
    expect(catInp().value).toBe('');
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
    rightClick(cells()[0]);
    clickAction('编辑');
    await flush();
    catInp().value = '';
    saveBtn().click();
    expect(errEl().textContent).toBe('请选择或输入分类');
    expect(events).toHaveLength(0);
  });

  it('分类下拉：输入过滤 + 选项点击回填（弹层收起；候选 = 历史分类，issue 231）', async () => {
    seed(vault, { item_h: makeItem({ id: 'item_h', name: '旧手机', category: '📱 智能手机' }) });
    await open(vault);
    openAddForm(panel()!);
    // 惰性弹出（issue 202 跟进）：开表单不弹，聚焦/输入才弹
    expect(formMask().querySelector('.bz-popover')).toBeNull();
    catInp().dispatchEvent(new FocusEvent('focus'));
    expect(formMask().querySelector('.bz-popover')).not.toBeNull();
    catInp().value = '手机';
    catInp().dispatchEvent(new Event('input'));
    const filtered = [...formMask().querySelectorAll('.bz-popover-item')] as HTMLElement[];
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((o) => o.textContent!.includes('手机'))).toBe(true);
    filtered[0].click();
    expect(catInp().value).toBe(filtered[0].dataset.value);
    expect(formMask().querySelector('.bz-popover')).toBeNull();
  });

  it('AI 归类（issue 231）：按名称回填分类+图标 chip，保存写入 item.icon', async () => {
    await open(vault);
    openAddForm(panel()!);
    nameInp().value = 'AirPods Pro';
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }) as any);
    resetAIProviderCache();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: '{"category":"耳机耳麦","icon":"headphones"}' } }] }) });
    (formMask().querySelector('#bm-ai') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(catInp().value).toBe('耳机耳麦');
    expect(formMask().querySelector('#bm-icon [data-icon]')!.getAttribute('data-icon')).toBe('headphones');
    priceInp().value = '199';
    dateInp().value = '2024-06-01';
    saveBtn().click();
    await flush();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!).items as Record<string, any>;
    const added = Object.values(saved).find((x) => x.name === 'AirPods Pro')!;
    expect(added.category).toBe('耳机耳麦');
    expect(added.icon).toBe('headphones');
  });

  it('AI 归类失败 → 内联报错，手填路径不受影响（issue 231）', async () => {
    await open(vault);
    openAddForm(panel()!);
    nameInp().value = '某物';
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }) as any);
    resetAIProviderCache();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockRejectedValue(new Error('boom'));
    (formMask().querySelector('#bm-ai') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(errEl().textContent).toContain('AI 归类失败');
    catInp().value = '桌面杂物';
    priceInp().value = '10';
    dateInp().value = '2024-06-01';
    saveBtn().click();
    await flush();
    const saved = JSON.parse(vault.files.get(DATA_PATH)!).items as Record<string, any>;
    const added = Object.values(saved).find((x) => x.name === '某物')!;
    expect(added.category).toBe('桌面杂物');
    expect(added.icon ?? null).toBeNull();
  });

  it('选历史分类自动带馆内图标（issue 231）：联想点选回填 icon chip', async () => {
    seed(vault, { item_h: makeItem({ id: 'item_h', name: '旧手机', category: '📱 智能手机' }) });
    await open(vault);
    openAddForm(panel()!);
    catInp().dispatchEvent(new FocusEvent('focus'));
    const opt = formMask().querySelector('.bz-popover-item') as HTMLElement;
    expect(opt).not.toBeNull();
    expect(opt.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('smartphone');
    opt.click();
    expect(catInp().value).toBe('智能手机');
    expect(formMask().querySelector('#bm-icon [data-icon]')!.getAttribute('data-icon')).toBe('smartphone');
  });

  it('分类下拉收起时 Esc 不拦（落回表单层）；弹出后 Esc 只收下拉不关表单', async () => {
    seed(vault, { item_h: makeItem({ id: 'item_h', name: '旧手机', category: '📱 智能手机' }) });
    await open(vault);
    openAddForm(panel()!);
    // 收起态：不冒泡 Esc 只到输入框，下拉不吞键、表单不被关
    catInp().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(formMask().querySelector('.bz-popover')).toBeNull();
    expect(formMask()).not.toBeNull();
    // 弹出态：冒泡 Esc 被下拉拦下（stopPropagation），只收下拉，表单保持
    catInp().dispatchEvent(new FocusEvent('focus'));
    expect(formMask().querySelector('.bz-popover')).not.toBeNull();
    catInp().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(formMask().querySelector('.bz-popover')).toBeNull();
    expect(formMask()).not.toBeNull();
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

  it('正常保存：8 字段 items 落盘（保存结构零冗余）+ add 事件载荷 + 表单关 + 列表出现', async () => {
    await open(vault);
    openAddForm(panel()!);
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
    expect(content()!.textContent).toContain('新显示器');
  });

  it('index 命令 addBelongingsItem：直接弹记一笔表单（面板可不开）', async () => {
    await open(vault);
    addBelongingsItem(getApp());
    expect(formMask().querySelector('.bz-bel-form-title')!.textContent).toBe('记一笔');
    (formMask().querySelector('[data-bm-cancel]') as HTMLElement).click();
  });

  it('B8：表单已开时再 openForm 不叠开（聚焦既有输入框，基线不被互踩）', async () => {
    await open(vault);
    openAddForm(panel()!);
    nameInp().value = '改一半';
    // 第二次触发打开（面板路径 / 命令路径同入口）
    openForm(null);
    await flush();
    // 只有一张表单，且焦点回到既有表单输入框
    expect(document.querySelectorAll('.bz-bel-form-mask')).toHaveLength(1);
    expect(document.activeElement).toBe(nameInp());
    expect((formMask().querySelector('#bm-name') as HTMLInputElement).value).toBe('改一半');
    // 基线未被第二次调用互踩：脏拦截照常工作
    (formMask().querySelector('[data-bm-cancel]') as HTMLElement).click();
    await flush();
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await flush();
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
  });

  it('B7：命令路径数据加载失败 → error 通知，表单不开（修复前静默无任何反馈）', async () => {
    setApp({ vault } as any);
    setSettingsProvider((() => { throw new Error('设置读取失败'); }) as any);
    resetObsidianMocks();
    openForm(null);
    await flush();
    await tick(20);
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(hasNotice('数据加载失败：设置读取失败')).toBe(true);
  });

  it('编辑：菜单「编辑」→ 回填 → 改名改价保存 → 落盘 + edit 事件（belongingsEditChanges）+ 表单关', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '机械键盘', purchase_price: 399, description: '红轴', purchase_date: '2024-06-01' }),
    });
    await open(vault);
    rightClick(cells()[0]);
    clickAction('编辑');
    await flush();
    const f = formMask();
    expect(f.querySelector('.bz-bel-form-title')!.textContent).toBe('编辑物品');
    expect(saveBtn().textContent).toBe('更新');
    // 回填（购买日期剥成 date 串）
    expect(nameInp().value).toBe('机械键盘');
    expect(catInp().value).toBe('机械键盘'); // issue 231：分类已迁移为纯文字
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
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(cells()[0].textContent).toContain('红轴机械键盘');
  });

  it('编辑改状态为已转卖：changes 含 改了状态+改了出离日期；落盘状态更新 + exit_date 记当天（ADR-0089）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中', purchase_date: '2024-06-01' }) });
    await open(vault);
    rightClick(cells()[0]);
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
    clickCell(cells()[0]);
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
  });

  it('编辑表单点取消：脏表单走 confirmDiscard（放弃才关）；不改动直接关', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘' }) });
    await open(vault);
    rightClick(cells()[0]);
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
    expect(cells()[0].textContent).toContain('键盘');
    // 未改动表单：取消直接关（无 confirm）
    rightClick(cells()[0]);
    clickAction('编辑');
    await flush();
    (formMask().querySelector('[data-bm-cancel]') as HTMLElement).click();
    await flush();
    expect(document.querySelector('.bz-bel-form-mask')).toBeNull();
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
  });

  it('外部 modify 换库后表单保存：按 id 重取写入当前库（修复前改动落不进新库）', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', description: '红轴', purchase_date: '2024-06-01' }) });
    await open(vault);
    rightClick(cells()[0]);
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
    expect(cells()).toHaveLength(1);
    // 外部写入（非本会话 saveAndRender）
    const db = JSON.parse(vault.files.get(DATA_PATH)!);
    db.items.item_2 = makeItem({ id: 'item_2', name: '外部新增', purchase_date: '2024-07-01T12:00:00' });
    vault.files.set(DATA_PATH, JSON.stringify(db));
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    await tick(20);
    expect(content()!.textContent).toContain('外部新增');
    expect(cells()).toHaveLength(2);
    // 其他文件 modify 不触发
    vault.emit('modify', { path: 'CONFIG/STORAGE/other.json' });
    await flush();
    expect(cells()).toHaveLength(2);
  });

  it('自写同路径 modify 不丢内存新值（saveAndRender 后模拟外部事件：回读数据一致，列表仍在）', async () => {
    seed(vault, {});
    await open(vault);
    openAddForm(panel()!);
    nameInp().value = '新物品';
    priceInp().value = '10';
    catInp().value = '🎧 耳机耳麦'; // issue 202：分类不再默认回填，保存前须自选
    saveBtn().click();
    await flush();
    expect(content()!.textContent).toContain('新物品');
    // 自写后同路径 modify：数据已落盘 → 重载一致，条目不丢
    vault.emit('modify', { path: DATA_PATH });
    await flush();
    await tick(20);
    expect(cells()).toHaveLength(1);
    expect(content()!.textContent).toContain('新物品');
    // 面板内 db 仍持有该条目（后续动作不炸）
    rightClick(cells()[0]);
    expect(actionLabels()).toContain('编辑');
    closeItemMenu();
  });

  it('smartcat 总线事件载荷形状：status{title,status} / add{item 全形} / delete{title}', async () => {
    seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中' }) });
    await open(vault);
    // status
    rightClick(cells()[0]);
    clickAction('标记为闲置');
    await flush();
    expect(events[0]).toMatchObject({ kind: 'status', title: '键盘', status: '闲置' });
    // add（载荷 = 落盘 item）
    openAddForm(panel()!);
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
    rightClick(cells().find((r) => r.dataset.belId === 'item_1')!);
    clickAction('删除');
    await flush();
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await flush();
    expect(events[2]).toEqual({ kind: 'delete', title: '键盘' });
  });

  it('belongingSettingsSchema：外观组（布局/主题占位单卡）+ 显示组', () => {
    const settings = { belongingsDataFolder: 'CONFIG/STORAGE' };
    setSettingsProvider(() => settings as any);
    const schema = belongingSettingsSchema();
    expect(schema.groups).toHaveLength(2);
    // 外观组（用户拍板 C 占位单卡）：布局/主题两行 choiceCards，主题行绑 layoutKey=belSkin
    const look = schema.groups[0];
    expect(look.name).toBe('外观');
    expect(look.rows).toHaveLength(2);
    const lrow = look.rows[0] as any;
    expect(lrow.type).toBe('choiceCards');
    expect(lrow.binding).toMatchObject({ key: 'belSkin' });
    expect(lrow.options).toHaveLength(1);
    expect(lrow.options[0]).toMatchObject({ value: 'poster', label: '大字报', prevClass: 'bz-sp-prev-poster' });
    const trow = look.rows[1] as any;
    expect(trow.type).toBe('choiceCards');
    expect(trow.binding).toMatchObject({ key: 'belSkinTheme' });
    expect(trow.layoutKey).toBe('belSkin');
    expect(trow.options[0]).toMatchObject({ value: 'warmwhite', label: '暖白', layout: 'poster', prevClass: 'bz-sp-prev-warmwhite' });
    // 显示组（issue 194）：默认状态筛选 select，常显（无组级门控）
    const view = schema.groups[1];
    expect(view.name).toBe('显示');
    expect(view.visibleWhen).toBeUndefined();
    const vrow = view.rows[0] as any;
    expect(vrow.type).toBe('select');
    expect(vrow.binding).toMatchObject({ key: 'belongingsDefaultStatus' });
  });

  it('XSS：名称含 <img onerror> 按纯文本渲染，不产生 img 元素；动作项按文本构造', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '<img src=x onerror="window.__xss=1">' }),
    });
    await open(vault);
    const c1 = cells()[0];
    expect(c1.querySelectorAll('img')).toHaveLength(0);
    expect(c1.textContent).toContain('<img src=x onerror="window.__xss=1">'); // 原文以文本呈现
    expect((window as any).__xss).toBeUndefined();
    rightClick(c1);
    expect(actionLabels()).toContain('标记为闲置');
    expect(actionLabels()).toContain('删除');
    closeItemMenu();
  });
});

// ==================== KPI 可点筛选（ticket 189 语义保留） ====================

describe('KPI 可点筛选（ticket 189 语义保留）', () => {
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

  it('点在库 KPI 卡（hero/投入）= 在库合成筛选（转卖/丢弃隐藏）；再点取消；chips 资产位同步高亮', async () => {
    seed(vault, {
      iu: makeItem({ id: 'iu', name: '用着', purchase_date: '2024-06-01T12:00:00' }),
      ii: makeItem({ id: 'ii', name: '闲置', current_status: '闲置', purchase_date: '2024-06-01T12:00:00' }),
      is: makeItem({ id: 'is', name: '卖了', current_status: '已转卖', purchase_date: '2024-06-01T12:00:00' }),
      idd: makeItem({ id: 'idd', name: '扔了', current_status: '已丢弃', purchase_date: '2024-06-01T12:00:00' }),
    });
    await open(vault);
    expect(cells()).toHaveLength(4);
    (kpiByLabel('在库件数') as HTMLElement).click();
    expect(cells()).toHaveLength(2);
    expect(cells().map((c) => c.textContent).join('|')).toContain('用着');
    expect(cells().map((c) => c.textContent).join('|')).toContain('闲置');
    // 合成筛选：chips 资产位高亮（P20 中 asset 为一等筛选项）
    expect(chipOf('asset')!.classList.contains('bz-chip--on')).toBe(true);
    // hero 标题切「资产」
    expect(heroTitle()!.textContent).toBe('资产');
    // 再点取消
    (kpiByLabel('在库投入') as HTMLElement).click();
    expect(cells()).toHaveLength(4);
    expect(chipOf('asset')!.classList.contains('bz-chip--on')).toBe(false);
  });

  it('chips「全部」= 清状态筛选回全部', async () => {
    seed(vault, {
      iu: makeItem({ id: 'iu', name: '用着', purchase_date: '2024-06-01T12:00:00' }),
      ii: makeItem({ id: 'ii', name: '闲置物', current_status: '闲置', purchase_date: '2024-06-01T12:00:00' }),
    });
    await open(vault);
    clickChip('using');
    expect(cells()).toHaveLength(1);
    clickChip('__all');
    expect(cells()).toHaveLength(2);
    expect(chipOf('__all')!.classList.contains('bz-chip--on')).toBe(true);
  });
});

// ==================== 状态流转 / 删除接撤销（ticket 189） ====================

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
  });

  it('流转撤销：标记为闲置 → notifyUndo；点撤销回使用中并落盘', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中', purchase_date: '2024-06-01T12:00:00' }) });
      await open(vault);
      rightClick(cells()[0]);
      clickAction('标记为闲置');
      await drain();
      expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.current_status).toBe('闲置');
      const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement;
      expect(undoBtn).toBeTruthy();
      undoBtn.click();
      await drain();
      const saved = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
      expect(saved.current_status).toBe('使用中');
      expect(cells()[0].querySelector('.bz-bel-tag')!.textContent).toContain('使用中');
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
      rightClick(cells()[0]);
      clickAction('标记为已转卖');
      await drain();
      const sold = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
      expect(sold.current_status).toBe('已转卖');
      expect(sold.exit_date).toBe('2025-06-15');
      // 陪伴天数封口在出离日：2024-06-01 → 2025-06-15 = 379 天（不再随时间增长）
      expect(cells()[0].querySelector('.bz-bel-mut')!.textContent).toContain('陪伴 379 天');
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

  it('B4：出离→出离流转保留原封口日期；撤销后 exit_date 不丢', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    try {
      seed(vault, {
        item_1: makeItem({
          id: 'item_1', name: '键盘', current_status: '已转卖',
          purchase_date: '2024-06-01T12:00:00', exit_date: '2025-01-01', sold_price: 200,
        }),
      });
      await open(vault);
      // 已转卖 → 已丢弃：出离内流转不重置封口（修复前被盖成今天 2025-06-15）
      rightClick(cells()[0]);
      clickAction('标记为已丢弃');
      await drain();
      const discard = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
      expect(discard.current_status).toBe('已丢弃');
      expect(discard.exit_date).toBe('2025-01-01');
      // 陪伴天数仍按原封口算：2024-06-01 → 2025-01-01 = 214 天
      expect(cells()[0].querySelector('.bz-bel-mut')!.textContent).toContain('陪伴 214 天');
      // 撤销 → 回已转卖，原封口日期不丢（修复前被清成 null）
      const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement;
      undoBtn.click();
      await drain();
      const restored = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
      expect(restored.current_status).toBe('已转卖');
      expect(restored.exit_date).toBe('2025-01-01');
      expect(cells()[0].querySelector('.bz-bel-mut')!.textContent).toContain('陪伴 214 天');
    } finally {
      vi.useRealTimers();
    }
  });

  it('B1：面板已关后流转撤销仍生效（closePanel 清库，撤销回调从盘重载不误报外部删除）', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    try {
      seed(vault, { item_1: makeItem({ id: 'item_1', name: '键盘', current_status: '使用中', purchase_date: '2024-06-01T12:00:00' }) });
      await open(vault);
      rightClick(cells()[0]);
      clickAction('标记为闲置');
      await drain();
      expect(JSON.parse(vault.files.get(DATA_PATH)!).items.item_1.current_status).toBe('闲置');
      // 关面板（closePanel 置 M.db=null）后点撤销
      close();
      expect(panel()).toBeNull();
      const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement;
      undoBtn.click();
      await drain();
      // 修复前：M.db 为 null → itemById 落空误报「已被外部变更删除，无法撤销」
      expect(hasNotice('该物品已被外部变更删除，无法撤销')).toBe(false);
      expect(hasNotice('已撤销，「键盘」回到使用中')).toBe(true);
      const restored = JSON.parse(vault.files.get(DATA_PATH)!).items.item_1;
      expect(restored.current_status).toBe('使用中');
    } finally {
      vi.useRealTimers();
    }
  });

  it('删除撤销：确认删除后点撤销 → 条目按 snapshot 原样写回', async () => {
    seed(vault, {
      item_1: makeItem({ id: 'item_1', name: '键盘', purchase_price: 399, current_status: '闲置', purchase_date: '2024-06-01T12:00:00' }),
    });
    await open(vault);
    rightClick(cells()[0]);
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
    expect(cells()).toHaveLength(1);
    expect(hasNotice('已恢复「键盘」')).toBe(true);
  });
});

// ==================== 出离闭环：售价回本 + 表单出离字段（ticket 189 ADR-0089） ====================

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
  });

  it('日均成本扣转卖回本（KPI）；转卖卡 meta 带「售出 ￥x」；陪伴天数封口', async () => {
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
      expect(kpiVal('日均成本')).toBe('￥1.01');
      // 转卖卡 meta：陪伴封口 214 天 + 售出 ￥200
      const cS = cells().find((r) => r.dataset.belId === 'is')!;
      expect(cS.querySelector('.bz-bel-mut')!.textContent).toContain('陪伴 214 天');
      expect(cS.querySelector('.bz-bel-mut')!.textContent).toContain('售出 ￥200');
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
      rightClick(cells()[0]);
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
    rightClick(cells()[0]);
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
    rightClick(cells()[0]);
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
    rightClick(cells()[0]);
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
  it('belongingsDefaultStatus=idle → 打开即选中「闲置」chips 并只显闲置件', async () => {
    const vault = new MockVault();
    seed(vault, {
      a: makeItem({ id: 'a', name: '机械键盘', current_status: '使用中' }),
      b: makeItem({ id: 'b', name: '旧相机', category: '📷 相机', current_status: '闲置' }),
    });
    await open(vault, { belongingsDefaultStatus: 'idle' });
    // chips 激活项 = 闲置 + hero 大字标题切「闲置」
    expect(chipOf('idle')!.classList.contains('bz-chip--on')).toBe(true);
    expect(heroTitle()!.textContent).toBe('闲置');
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
    await open(vault, { belongingsDefaultStatus: 'bogus' });
    expect(chipOf('__all')!.classList.contains('bz-chip--on')).toBe(true);
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

// ==================== 撤销用假时钟排空 ====================

/** 微任务排空（假时钟用 flush 会因 setTimeout 冻结挂死，改用纯微任务驱动 async 链） */
async function drain(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}
