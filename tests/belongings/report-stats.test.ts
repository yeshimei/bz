// @vitest-environment node
/**
 * 归物本年度资产报告 · 统计纯层测试（issue 356）
 *
 * 固定 now（2025-06-15 12:00 本地时）断言各指标确定性：
 * 购入件数/金额、离场件数/回血（仅转卖计售价）、月度花销、分类占比、
 * 日均成本走势（月末时点 + future 标记）、陪伴最久榜（截至年末封口）、年份清单解析、
 * 可选字段容错（缺 exit_date/sold_price、残缺日期不炸不 NaN）。
 */
import { describe, it, expect } from 'vitest';
import {
  computeYearReport, reportYears, resolveReportYear, avgDailyCostAsOf, COMPANION_TOP_N,
} from '../../src/belongings/report-stats';
import type { BelongingsItem } from '../../src/belongings/types';

/** 统一「今天」：2025-06-15 12:00 本地时（带时刻，跨时区确定） */
const NOW = new Date(2025, 5, 15, 12, 0, 0);

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

/** 五件种子：覆盖在库/转卖/丢弃、跨年购入、出离封口（天数均为手工核算值） */
function seed(): BelongingsItem[] {
  return [
    makeItem({ id: 'a', name: '键盘', category: '⌨ 外设', purchase_price: 1200, purchase_date: '2025-01-10' }),
    makeItem({ id: 'b', name: '耳机', category: '外设', purchase_price: 300, purchase_date: '2025-03-05', current_status: '已转卖', exit_date: '2025-05-01', sold_price: 100 }),
    makeItem({ id: 'c', name: '椅子', category: '家具', purchase_price: 500, purchase_date: '2024-12-20', current_status: '已丢弃', exit_date: '2025-02-10' }),
    makeItem({ id: 'd', name: '雨伞', category: '外出', purchase_price: 88, purchase_date: '2023-08-01' }),
    makeItem({ id: 'e', name: '台灯', category: '家具', purchase_price: 60, purchase_date: '2025-06-01', current_status: '闲置' }),
  ];
}

describe('reportYears / resolveReportYear', () => {
  it('年份 = 购入年 ∪ 出离年，降序；选年悬空回落最近有记录年', () => {
    expect(reportYears(seed())).toEqual(['2025', '2024', '2023']);
    expect(resolveReportYear(seed(), '')).toBe('2025');
    expect(resolveReportYear(seed(), '1999')).toBe('2025');
    expect(resolveReportYear(seed(), '2024')).toBe('2024');
    expect(reportYears([])).toEqual([]);
    expect(resolveReportYear([], '')).toBe('');
  });

  it('出离年只在出离态计入（在库物品的悬空 exit_date 不产生年份）', () => {
    const items = [makeItem({ purchase_date: '2025-01-01', exit_date: '2024-06-01' })];
    expect(reportYears(items)).toEqual(['2025']);
  });
});

describe('computeYearReport：购入与离场', () => {
  it('当年购入件数/金额；离场按 exit_date 计（含往年购入）；回血仅转卖售价', () => {
    const r = computeYearReport(seed(), '2025', NOW);
    expect(r.purchasedCount).toBe(3); // a / b / e
    expect(r.purchasedAmount).toBe(1560);
    expect(r.exitedCount).toBe(2); // b（转卖）+ c（丢弃，exit_date 落 2025）
    expect(r.recoveredAmount).toBe(100); // 仅 b 的售价；丢弃 c 不计
    expect(r.hasYearData).toBe(true);
  });

  it('空年：无购入无离场 → hasYearData false（指标全零）', () => {
    const r = computeYearReport(seed(), '2022', NOW);
    expect(r.hasYearData).toBe(false);
    expect(r.purchasedCount).toBe(0);
    expect(r.purchasedAmount).toBe(0);
    expect(r.exitedCount).toBe(0);
    expect(r.recoveredAmount).toBe(0);
  });

  it('往年视角：2024 年只购入椅子（c），无离场', () => {
    const r = computeYearReport(seed(), '2024', NOW);
    expect(r.purchasedCount).toBe(1);
    expect(r.purchasedAmount).toBe(500);
    expect(r.exitedCount).toBe(0);
    expect(r.recoveredAmount).toBe(0);
  });
});

describe('computeYearReport：月度花销与分类占比', () => {
  it('月度花销固定 12 列，缺月补零；件数随桶', () => {
    const r = computeYearReport(seed(), '2025', NOW);
    expect(r.monthlySpend).toHaveLength(12);
    expect(r.monthlySpend[0]).toEqual({ label: '1月', amount: 1200, count: 1 });
    expect(r.monthlySpend[2]).toEqual({ label: '3月', amount: 300, count: 1 });
    expect(r.monthlySpend[5]).toEqual({ label: '6月', amount: 60, count: 1 });
    expect(r.monthlySpend[1].amount).toBe(0);
  });

  it('分类占比按金额降序，pct 占当年购入金额（分类名去 emoji 前缀）', () => {
    const r = computeYearReport(seed(), '2025', NOW);
    expect(r.categoryShare).toEqual([
      { name: '外设', count: 2, amount: 1500, pct: 96.2 }, // 1500/1560 = 96.15 → 96.2
      { name: '家具', count: 1, amount: 60, pct: 3.8 }, // 60/1560 = 3.846 → 3.8
    ]);
  });

  it('空分类回落「未分类」', () => {
    const items = [makeItem({ category: '', purchase_price: 10 })];
    const r = computeYearReport(items, '2025', NOW);
    expect(r.categoryShare[0].name).toBe('未分类');
  });
});

describe('computeYearReport：日均成本走势', () => {
  it('1 月末时点：键盘 + 往年的伞 + 去年12月的椅子在册（(1200+88+500)/(22+550+43)）', () => {
    const r = computeYearReport(seed(), '2025', NOW);
    expect(r.dailyCostTrend).toHaveLength(12);
    // a：1-10 → 2-01 = 22 天；d：2023-08-01 → 2025-02-01 = 550 天（全价 88）；
    // c：2024-12-20 → 2025-02-01 = 43 天（丢弃全价 500）
    expect(r.dailyCostTrend[0].value).toBeCloseTo(1788 / 615, 6);
  });

  it('5 月末时点：转卖回本扣减 + 出离封口 + 丢弃不扣（(1200+200+500+88)/(142+57+52+670)）', () => {
    const r = computeYearReport(seed(), '2025', NOW);
    // a：1-10 → 6-01 = 142 天全价；b：3-05 封口 5-01，回本 100（净 200/57）；c：12-20 封口 2-10，丢弃全价 500/52；
    // d：2023-08-01 → 6-01 = 670 天全价；e：6-01 购入不早于截止，不参与
    expect(r.dailyCostTrend[4].value).toBeCloseTo(1988 / 921, 6);
  });

  it('未来月（当年未到月末）标 future、值零；往年 12 个月全 real', () => {
    const cur = computeYearReport(seed(), '2025', NOW);
    expect(cur.dailyCostTrend[4].future).toBe(false); // 6-01 截止 ≤ 6-15
    expect(cur.dailyCostTrend[5].future).toBe(true); // 7-01 > 6-15
    expect(cur.dailyCostTrend[11].future).toBe(true);
    expect(cur.dailyCostTrend[11].value).toBe(0);
    const past = computeYearReport(seed(), '2024', NOW);
    expect(past.dailyCostTrend.every((c) => !c.future)).toBe(true);
  });

  it('avgDailyCostAsOf 与走势同口径（今天截止 = 全库日均）', () => {
    const today = avgDailyCostAsOf(seed(), NOW.getTime());
    expect(today).toBeGreaterThan(0);
    // 空集 / 无在册日 → 0
    expect(avgDailyCostAsOf([], NOW.getTime())).toBe(0);
    expect(avgDailyCostAsOf(seed(), new Date(2020, 0, 1).getTime())).toBe(0);
  });
});

describe('computeYearReport：陪伴最久榜', () => {
  it('Top N 按截至年末天数降序；出离封口出离日；当年天板取年末与今天孰早', () => {
    const r = computeYearReport(seed(), '2025', NOW);
    expect(r.companions.map((c) => c.item.id)).toEqual(['d', 'a', 'b', 'c', 'e']);
    expect(r.companions.map((c) => c.days)).toEqual([684, 156, 57, 52, 14]);
    expect(COMPANION_TOP_N).toBe(5);
  });

  it('超过 Top N 截断（天数并列按购入更早优先）', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      makeItem({ id: `x${i}`, name: `物${i}`, purchase_date: '2024-06-01', purchase_price: 10 }),
    );
    const r = computeYearReport(items, '2025', NOW);
    expect(r.companions).toHaveLength(COMPANION_TOP_N);
    expect(r.companions[0].days).toBe(r.companions[1].days);
    expect(r.companions[0].item.id).toBe('x0');
  });

  it('残缺日期容错：purchase_date 非法不参与任何指标，不产生 NaN', () => {
    const items: BelongingsItem[] = [
      makeItem({ id: 'bad', purchase_date: '' }),
      makeItem({ id: 'bad2', purchase_date: '2025-13-99' }),
      makeItem({ id: 'good', purchase_date: '2025-02-01', purchase_price: 30 }),
    ];
    const r = computeYearReport(items, '2025', NOW);
    expect(r.purchasedCount).toBe(1);
    expect(r.companions.map((c) => c.item.id)).toEqual(['good']);
    expect(Number.isFinite(r.dailyCostTrend[0].value)).toBe(true);
    // 非法年只进年份清单（yearOf 宽容四位），但当年无有效数据 → 空年口径
    expect(reportYears(items)).toEqual(['2025']);
    expect(r.hasYearData).toBe(true);
  });
});
