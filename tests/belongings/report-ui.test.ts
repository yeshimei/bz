/**
 * 归物本年度资产报告 · 视图行为层测试（issue 356，范式对照 tests/reading-report/index.test.ts）
 *
 * 覆盖：l3 骨架先行、progress toast 先弹/完成转 success、五段分片渲染、金额单位接线、
 * 空库空态带动作（onAdd）、空年人话、年份 ‹ › 切换与边界禁用、取消三路收口
 * （close/cancel 中途不残留 toast 不抛错、遮罩外摘不写死 DOM）、重入单报告体、
 * unload 清理可重开、面板工具行入口（openPanel → data-bel-report → closePanel 连带收口）、
 * 命令路径（bz-belongings-report 回调：面板未开从盘载库直开）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  openBelReport, closeBelReport, cancelBelReport, unloadBelReport, isBelReportOpen,
} from '../../src/belongings/report';
import { openPanel, closePanel, openBelongingsReportView } from '../../src/belongings/ui';
import { openBelongingsReport } from '../../src/belongings/index';
import { __resetNoticeForTests } from '../../src/core/notice';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import type { BelongingsItem } from '../../src/belongings/types';

const DATA_PATH = 'CONFIG/STORAGE/belongings.json';

function makeItem(partial: Partial<BelongingsItem>): BelongingsItem {
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

/** 两年种子：2025 购入+转卖回血；2023 老物件（陪伴榜） */
function seedItems(): BelongingsItem[] {
  return [
    makeItem({ id: 'a', name: '键盘', category: '⌨ 外设', purchase_price: 1200, purchase_date: '2025-01-10' }),
    makeItem({ id: 'b', name: '耳机', category: '外设', purchase_price: 300, purchase_date: '2025-03-05', current_status: '已转卖', exit_date: '2025-05-01', sold_price: 100 }),
    makeItem({ id: 'd', name: '雨伞', category: '外出', purchase_price: 88, purchase_date: '2023-08-01' }),
  ];
}

const mask = () => document.querySelector('.bz-bel-report-mask') as HTMLElement | null;
const body = () => document.querySelector('[data-belr-body]') as HTMLElement | null;
const yearLabel = () => document.querySelector('[data-belr-year]') as HTMLElement | null;
const prevBtn = () => document.querySelector('[data-belr-prev]') as HTMLButtonElement | null;
const nextBtn = () => document.querySelector('[data-belr-next]') as HTMLButtonElement | null;
const toastText = () => document.querySelector('#bz-notice-container')?.textContent || '';

/** 条件轮询（防并行负载钉死时长） */
async function until(cond: () => boolean, timeout = 6000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('until: 条件超时');
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** 轮询等待分片渲染完成（success 反馈 toast = finishDone 标记） */
async function waitReportDone(timeout = 6000): Promise<void> {
  await until(() => toastText().includes('年度报告完成'), timeout);
}

/** 内存库落 MockVault（面板/命令入口用例用） */
function seedVault(items: BelongingsItem[]): MockVault {
  const vault = new MockVault();
  vault.files.set(
    DATA_PATH,
    JSON.stringify({ version: '1.0', last_updated: '2025-01-01T00:00:00.000Z', items: Object.fromEntries(items.map((i) => [i.id, i])) }),
  );
  return vault;
}

describe('年度报告页渲染（body 级 mask）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    __resetNoticeForTests();
    unloadBelReport();
  });

  it('骨架先行 + progress toast 先弹 + 完成后五段齐、年份标签与边界禁用', async () => {
    openBelReport(seedItems(), 'cny');
    // 同步返回后（首个让出点前）骨架已在、toast 已弹并进入首阶段
    expect(body()!.textContent).toContain('统计中');
    expect(toastText()).toContain('正在读取归物本');
    expect(isBelReportOpen()).toBe(true);

    await waitReportDone();
    const text = body()!.textContent || '';
    expect(text).toContain('2025 年购入与离场');
    expect(text).toContain('购入件数');
    expect(text).toContain('转卖回血');
    expect(text).toContain('月度花销走势');
    expect(text).toContain('分类占比');
    expect(text).toContain('日均成本走势');
    expect(text).toContain('陪伴最久榜');
    expect(text).toContain('￥1,200'); // cny 金额单位
    expect(text).toContain('键盘'); // 陪伴榜行
    // 年份导航：最新年 → › 禁用、‹ 可用
    expect(yearLabel()!.textContent).toBe('2025');
    expect(nextBtn()!.disabled).toBe(true);
    expect(prevBtn()!.disabled).toBe(false);
  });

  it('金额单位接线：usd 前缀 / none 裸数字', async () => {
    openBelReport(seedItems(), 'usd');
    await until(() => (body()!.textContent || '').includes('$1,200'));
    closeBelReport();
    // 等 toast 离场动画结束（旧完成反馈不干扰下一轮判定）
    await new Promise((r) => setTimeout(r, 450));
    openBelReport(seedItems(), 'none');
    await until(() => {
      const t = body()!.textContent || '';
      return t.includes('1,200') && !t.includes('统计中');
    });
    const text = body()!.textContent || '';
    expect(text).toContain('1,200');
    expect(text).not.toContain('￥');
  });

  it('空库空态带动作：uiEmpty + 记一笔回调，不渲染空报告不弹完成 toast', async () => {
    let added = 0;
    openBelReport([], 'cny', { onAdd: () => added++ });
    await until(() => !!body()?.querySelector('.bz-empty'));
    expect(body()!.textContent).toContain('归物本还没有物品');
    const btn = (Array.from(body()!.querySelectorAll('button')) as HTMLElement[]).find((b) => b.textContent?.includes('记一笔')) as HTMLElement;
    expect(btn).toBeTruthy();
    btn.click();
    expect(added).toBe(1);
    await new Promise((r) => setTimeout(r, 60));
    expect(toastText()).not.toContain('年度报告完成');
  });

  it('空年人话：残缺日期年切过去 → 提示文案（导航仍可切回）', async () => {
    // '2023-13-01' 年份进清单但无有效数据（统计层容错口径的 UI 呈现）
    openBelReport([
      makeItem({ id: 'good', name: '键盘', purchase_date: '2025-06-01' }),
      makeItem({ id: 'bad', name: '幽灵', purchase_date: '2023-13-01' }),
    ], 'cny');
    await waitReportDone();
    prevBtn()!.click();
    expect(yearLabel()!.textContent).toBe('2023');
    await until(() => (body()!.textContent || '').includes('2023 年没有物品记录'));
    // 切回 2025 恢复报告体
    nextBtn()!.click();
    await until(() => (body()!.textContent || '').includes('2025 年购入与离场'));
  });

  it('年份 ‹ › 切换：边界禁用随游标同步（‹ 到底 / › 回顶）', async () => {
    openBelReport(seedItems(), 'cny');
    await waitReportDone();
    // 2025（最新）→ ‹ 到 2023（最老）
    prevBtn()!.click();
    expect(yearLabel()!.textContent).toBe('2023');
    await until(() => (body()!.textContent || '').includes('2023 年购入与离场'));
    expect(prevBtn()!.disabled).toBe(true);
    expect(nextBtn()!.disabled).toBe(false);
    // › 回 2025：边界态复原
    nextBtn()!.click();
    expect(yearLabel()!.textContent).toBe('2025');
    await until(() => (body()!.textContent || '').includes('2025 年购入与离场'));
    expect(nextBtn()!.disabled).toBe(true);
    expect(prevBtn()!.disabled).toBe(false);
  });

  it('取消三路：渲染中 closeBelReport 摘遮罩收 toast；cancelBelReport 幂等不抛错', async () => {
    openBelReport(seedItems(), 'cny');
    closeBelReport(); // 同步取消（分片尚未铺开）
    expect(mask()).toBeNull();
    expect(isBelReportOpen()).toBe(false);
    cancelBelReport(); // 幂等
    // 等 toast 离场动画（hide 200ms）结束再断言无残留
    await new Promise((r) => setTimeout(r, 450));
    expect(toastText()).not.toContain('年度报告');
  });

  it('取消三路：遮罩被外力摘除（面板关闭路径）→ 渲染中止不抛错，unload 复位模块状态', async () => {
    openBelReport(seedItems(), 'cny');
    mask()!.remove(); // 模拟外力摘除（closePanel 已摘 mask 后的在途分片）
    await new Promise((r) => setTimeout(r, 120)); // 不抛错即通过
    unloadBelReport();
    expect(isBelReportOpen()).toBe(false);
    // 复位后可正常重开
    openBelReport(seedItems(), 'cny');
    await waitReportDone();
    expect(body()!.textContent).toContain('购入件数');
  });

  it('重入：开着再开 = 就地重开（单报告体、旧渲染作废）', async () => {
    openBelReport(seedItems(), 'cny');
    openBelReport(seedItems(), 'cny');
    await waitReportDone();
    expect(document.querySelectorAll('.bz-bel-report')).toHaveLength(1);
    expect(body()!.textContent).toContain('购入件数');
  });

  it('移动端面板规范挂载：popup 带 bz-panel-mtop（移动真全屏 + 44px 顶部避让，桌面不生效）；关闭钮在位、遮罩点击可关', () => {
    openBelReport(seedItems(), 'cny');
    const popup = document.querySelector('.bz-bel-report') as HTMLElement;
    expect(popup).toBeTruthy();
    // 真机回归（issue 356）：报告层原先只挂遮罩无 mtop → 移动端页面顶到 Obsidian 头部
    expect(popup.classList.contains('bz-panel-mtop'), '报告 popup 未挂 .bz-panel-mtop').toBe(true);
    // 移动全屏后没有遮罩可点，关闭钮是唯一出口，必须在位
    expect(popup.querySelector('[data-belr-close]'), '移动全屏后关闭钮必须在位').toBeTruthy();
    // 桌面语义保留：点遮罩（popup 之外）直接关
    mask()!.click();
    expect(mask()).toBeNull();
    expect(isBelReportOpen()).toBe(false);
  });

  it('面板工具行入口：点 data-bel-report 开报告；closePanel 连带收口', async () => {
    const vault = seedVault(seedItems());
    setApp({ vault } as any);
    setSettingsProvider(() => ({}) as any);
    await openPanel();
    const reportBtn = document.querySelector('[data-bel-report]') as HTMLElement;
    expect(reportBtn).toBeTruthy();
    reportBtn.click();
    await until(() => !!mask());
    await waitReportDone();
    expect(body()!.textContent).toContain('购入件数');
    // 面板关闭：报告（派生视图）随收口
    closePanel();
    expect(mask()).toBeNull();
    expect(isBelReportOpen()).toBe(false);
  });

  it('命令路径（bz-belongings-report 回调）：面板未开从盘载库直开，ESC 层已注册', async () => {
    const vault = seedVault(seedItems());
    setApp({ vault } as any);
    setSettingsProvider(() => ({}) as any);
    openBelongingsReport({ vault } as any);
    await until(() => !!mask());
    await waitReportDone();
    expect(body()!.textContent).toContain('购入件数');
    closeBelReport();
    expect(mask()).toBeNull();
  });
});

// ==================== 审查修复批（issue 356） ====================

describe('年度报告页 · 审查修复批', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    __resetNoticeForTests();
    unloadBelReport();
  });

  it('纯离场年（有出离无购入）：月度柱与分类段给人话空态，不再渲染 12 根零柱与「共 0 类」', async () => {
    openBelReport([
      makeItem({ id: 'gone', name: '旧椅', purchase_date: '2023-01-01', current_status: '已丢弃', exit_date: '2025-04-01' }),
      makeItem({ id: 'keep', name: '老桌', purchase_date: '2024-06-01' }),
    ], 'cny');
    // 默认最新年 2025 = 纯离场年（出离年 ∈ 年份清单）；等分片铺完（末段陪伴榜）再断言
    await until(() => (body()?.textContent || '').includes('陪伴最久榜'));
    const text = body()!.textContent || '';
    expect(text).toContain('这一年没有购入记录，只有出离');
    expect(text).toContain('当年无购入 · 只有出离记录');
    const monthlySec = (Array.from(body()!.querySelectorAll('.bz-belr-sec')) as HTMLElement[]).find(
      (sec) => sec.textContent?.includes('月度花销走势'),
    );
    expect(monthlySec?.querySelectorAll('.bz-belr-col')).toHaveLength(0); // 月度段零柱区不再渲染
    expect(text).toContain('日均成本走势'); // 回血使日均下降，走势段仍有数据保留
  });

  it('陪伴榜：日均千分位、days=0 显示 —、当年段注「截至今日」往年「截至年末」', async () => {
    const Y = new Date().getFullYear();
    const tenDaysAgo = new Date();
    tenDaysAgo.setHours(0, 0, 0, 0);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10); // 恒 10 天前 → 日均 = 25000/10 = 2,500 精确可控
    const pd = `${tenDaysAgo.getFullYear()}-${String(tenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(tenDaysAgo.getDate()).padStart(2, '0')}`;
    openBelReport([
      makeItem({ id: 'big', name: '大家伙', purchase_price: 999999, purchase_date: `${Y}-01-01` }), // 整数段恒 ≥2,739 → 必现千分位
      makeItem({ id: 'mid', name: '中家伙', purchase_price: 25000, purchase_date: pd }),
      makeItem({ id: 'flash', name: '闪买闪卖', purchase_date: '2025-03-01', current_status: '已转卖', exit_date: '2025-03-01', sold_price: 50 }), // days=0
      makeItem({ id: 'old', name: '旧物', purchase_date: '2025-01-01', purchase_price: 100 }),
    ], 'cny');
    await until(() => (body()?.textContent || '').includes('陪伴最久榜')); // 等分片铺到最后一段
    const text = body()!.textContent || '';
    expect(text).toContain('截至今日 · Top'); // 当年（最新年）段注不再写死「年末」
    expect(text).not.toContain('截至年末');
    expect(text).toContain('日均 ￥2,500'); // 千分位与其他金额一致（10 天前购入 25000）
    expect(text).toMatch(/日均 ￥\d{1,3},\d{3}(\.\d+)?/); // 大额日均千分位形态
    expect(text).toContain('日均 —'); // 购入=出离同天无日均语义
    // 翻到 2025（往年）：段注回到「截至 2025 年末」
    prevBtn()!.click();
    await until(() => (body()?.textContent || '').includes('截至 2025 年末 · Top'));
    expect(body()!.textContent || '').toContain('日均 —');
  });

  it('报告开着保存物品后就地刷新：空库空态「记一笔」保存 → 报告出现新记录（旧一次性快照问题）', async () => {
    const vault = seedVault([]);
    setApp({ vault } as any);
    setSettingsProvider(() => ({}) as any);
    await openPanel();
    await openBelongingsReportView();
    await until(() => !!body()?.querySelector('.bz-empty')); // 空库空态
    const addBtn = (Array.from(body()!.querySelectorAll('button')) as HTMLElement[]).find(
      (b) => b.textContent?.includes('记一笔'),
    ) as HTMLElement;
    expect(addBtn).toBeTruthy();
    addBtn.click();
    await until(() => !!document.querySelector('#bm-save'));
    (document.querySelector('#bm-name') as HTMLInputElement).value = '报告新物';
    (document.querySelector('#bm-price') as HTMLInputElement).value = '399';
    (document.querySelector('#bm-cat') as HTMLInputElement).value = '外设';
    (document.querySelector('#bm-save') as HTMLElement).click();
    // 保存回调重入 openBelReport（就地重开）→ 报告从空态变为含新物品
    await until(() => (body()?.textContent || '').includes('报告新物'), 8000);
    expect(isBelReportOpen()).toBe(true);
  });

  it('翻年静默完成：切年后不再连闪「年度报告完成」toast（quiet finish）', async () => {
    openBelReport(seedItems(), 'cny');
    await waitReportDone(); // 首开完成 feedback 照旧
    prevBtn()!.click(); // 2025 → 2023
    await until(() => (body()?.textContent || '').includes('2023 年购入与离场'));
    // 翻年渲染完成不追加新 toast：容器内「年度报告完成」至多 1 次（旧 success 帧未过期）
    expect((toastText().match(/年度报告完成/g) || []).length).toBeLessThanOrEqual(1);
  });
});
