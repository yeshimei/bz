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
import { openPanel, closePanel } from '../../src/belongings/ui';
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
