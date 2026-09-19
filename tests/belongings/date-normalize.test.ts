// @vitest-environment node
/**
 * 归物本日期单源归一回归（深审批A · func P3-5 + 一致 P3-6/P3-7 收口）：
 * - parseLocalDay 严格分量校验：脏日期（13 月 45 日 / 2 月 30 日）不再被 JS Date 静默
 *   归一化漂移，无效 = null；面板（daysUsed）与报告（report-stats parseDayTs/exitTsOf）
 *   消费同一实现，天数口径不再分叉；
 * - 无效出离日显式语义 = 无封口锚点（截至查看时点计），不替用户编造封口日期；
 * - 状态串/回血口径收编 shared 单源（recoveredOf 下沉）。
 * 纯数据层：node 直测（不拖 obsidian 面）。
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parseLocalDay, daysUsed, exitDayTsOf, recoveredOf, exitedStatus, todayStr, MAX_PRICE,
} from '../../src/belongings/shared';
import { computeYearReport, reportYears } from '../../src/belongings/report-stats';
import type { BelongingsItem } from '../../src/belongings/types';

const item = (partial: Partial<BelongingsItem>): BelongingsItem => ({
  id: 'it',
  name: '物',
  category: '数码',
  purchase_price: 100,
  purchase_date: '2024-06-01',
  current_status: '使用中',
  description: '',
  created_date: '2024-06-01T10:00:00.000Z',
  last_updated: '2024-06-01T10:00:00.000Z',
  ...partial,
});

describe('parseLocalDay 单源严格解析', () => {
  it('合法日期 → 当日零点本地 Date（带时间后缀取前 10 位）', () => {
    const d = parseLocalDay('2025-06-15T12:34:56')!;
    expect(d).not.toBeNull();
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2025, 5, 15]);
    expect(parseLocalDay('2025-06-15')!.getFullYear()).toBe(2025);
  });

  it('越界分量拒收：13 月 45 日不再归一化成次年（修复前 → 2027-02-14）', () => {
    expect(parseLocalDay('2026-13-45')).toBeNull();
    expect(parseLocalDay('2025-13-01')).toBeNull();
    expect(parseLocalDay('2025-00-10')).toBeNull();
  });

  it('归一化回读比对：2 月 30 日 / 4 月 31 日等不存在日期 = null（修复前漂移进 3 月）', () => {
    expect(parseLocalDay('2025-02-30')).toBeNull();
    expect(parseLocalDay('2025-04-31')).toBeNull();
    expect(parseLocalDay('2024-02-30')).toBeNull(); // 闰年 2 月也只有 29 天
    // 闰年合法日放行
    expect(parseLocalDay('2024-02-29')).not.toBeNull();
  });

  it('残串/空值 = null', () => {
    expect(parseLocalDay('')).toBeNull();
    expect(parseLocalDay('abc')).toBeNull();
    expect(parseLocalDay('2025-06')).toBeNull();
    expect(parseLocalDay(null)).toBeNull();
    expect(parseLocalDay(undefined)).toBeNull();
  });
});

describe('daysUsed / exitDayTsOf 无效出离日口径（面板侧）', () => {
  it('无效 exit_date = 无封口锚点：出离条目按截至今天计，不产生 NaN/负数', () => {
    const it = item({ purchase_date: '2024-06-01', current_status: '已转卖', exit_date: '2026-13-45' });
    const days = daysUsed(it);
    expect(Number.isFinite(days)).toBe(true);
    expect(days).toBeGreaterThanOrEqual(0);
    // 与「无 exit_date 的在库条目」同一条天数轨迹（截至今天）
    expect(days).toBe(daysUsed(item({ purchase_date: '2024-06-01' })));
  });

  it('有效 exit_date 封口不回归：天数停在出离日', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    try {
      const it = item({ purchase_date: '2024-06-01', current_status: '已转卖', exit_date: '2025-01-01' });
      expect(daysUsed(it)).toBe(214); // 2024-06-01 → 2025-01-01
    } finally {
      vi.useRealTimers();
    }
  });

  it('exitDayTsOf：非出离态恒 null；出离+有效日期 → 当日零点 ts；出离+无效 → null', () => {
    const ok = item({ current_status: '已转卖', exit_date: '2025-01-01' });
    expect(exitDayTsOf(ok)).toBe(new Date(2025, 0, 1).getTime());
    expect(exitDayTsOf(item({ current_status: '使用中', exit_date: '2025-01-01' }))).toBeNull();
    expect(exitDayTsOf(item({ current_status: '已丢弃', exit_date: '2025-02-30' }))).toBeNull();
    expect(exitDayTsOf(item({ current_status: '已丢弃', exit_date: null }))).toBeNull();
  });

  it('purchase_date 无效 → 0 天（全价兜底不回归）', () => {
    expect(daysUsed(item({ purchase_date: '2025-02-30', current_status: '已转卖', exit_date: '2025-06-01' }))).toBe(0);
  });
});

describe('报告侧消费同一单源（report-stats）', () => {
  it('脏出离日不再被归一化吸进当年离场统计（修复前 2025-02-30 → 2025-03-02 计入 exitedCount）', () => {
    const items = [
      item({ id: 'a', purchase_date: '2025-01-01', current_status: '已转卖', exit_date: '2025-02-30', sold_price: 50 }),
    ];
    const rep = computeYearReport(items, '2025', new Date(2026, 0, 1));
    expect(rep.exitedCount).toBe(0); // 修复前 = 1（归一化漂移）
    expect(rep.recoveredAmount).toBe(0); // 回血口径随封口失效，不重复计
  });

  it('脏购入日不再漂移进次年月度（修复前 2026-13-45 → 2027-02 月度列）', () => {
    const items = [item({ id: 'b', purchase_date: '2026-13-45', purchase_price: 300 })];
    const rep = computeYearReport(items, '2027', new Date(2028, 0, 1));
    expect(rep.purchasedCount).toBe(0);
    expect(rep.monthlySpend[1].amount).toBe(0); // 2 月列不再被脏数据补柱
    expect(rep.monthlySpend.every((c) => c.amount === 0)).toBe(true);
  });

  it('reportYears 出离年仍只认出离态（exitedStatus 单源判定）', () => {
    const items = [
      item({ id: 'a', purchase_date: '2024-01-01', current_status: '已转卖', exit_date: '2025-03-01' }),
      item({ id: 'b', purchase_date: '2023-01-01', current_status: '使用中', exit_date: '2022-01-01' }), // 在库条目的 exit_date 不入年份集
    ];
    expect(reportYears(items)).toEqual(['2025', '2024', '2023']);
  });
});

describe('状态串/回血单源（cons P3-7 收口）', () => {
  it('recoveredOf：仅已转卖且正售价计回血；丢弃/零/负价不计', () => {
    expect(recoveredOf(item({ current_status: '已转卖', sold_price: 200 }))).toBe(200);
    expect(recoveredOf(item({ current_status: '已丢弃', sold_price: 200 }))).toBe(0);
    expect(recoveredOf(item({ current_status: '已转卖', sold_price: 0 }))).toBe(0);
    expect(recoveredOf(item({ current_status: '已转卖', sold_price: -5 }))).toBe(0);
    expect(recoveredOf(item({ current_status: '已转卖', sold_price: null }))).toBe(0);
  });

  it('exitedStatus 只认转卖/丢弃；todayStr 走 core localDayKey 同形；MAX_PRICE 上限常量在位', () => {
    expect(exitedStatus('已转卖')).toBe(true);
    expect(exitedStatus('已丢弃')).toBe(true);
    expect(exitedStatus('使用中')).toBe(false);
    expect(exitedStatus('闲置')).toBe(false);
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(MAX_PRICE).toBe(1e12);
  });
});
