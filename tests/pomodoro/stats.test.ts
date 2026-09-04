// @vitest-environment node
/**
 * 番茄钟历史聚合测试（ticket 30）：今日计数 + 近 7 天滚动窗口
 * 增强包：今日总分钟（todayMinutes）+ 今日 12 槽时段分布（todayHourBuckets）+ 日维度分钟数
 */
import { describe, it, expect } from 'vitest';
import { todayCount, todayMinutes, todayHourBuckets, last7Days } from '../../src/pomodoro/stats';
import type { HistoryEntry } from '../../src/pomodoro/state';

// 本地时区日期（2026-08-10 周一 10:00 本地）
const NOW = new Date(2026, 7, 10, 10, 0, 0).getTime();

function entry(day: number, hour = 9): HistoryEntry {
  return { ts: new Date(2026, 7, day, hour, 0, 0).getTime(), duration: 1500 };
}

describe('todayCount', () => {
  it('空历史 → 0', () => {
    expect(todayCount([], NOW)).toBe(0);
  });

  it('只计今天的完成', () => {
    const h = [entry(10), entry(10, 14), entry(9), entry(8)];
    expect(todayCount(h, NOW)).toBe(2);
  });

  it('跨月边界（今天为月初）', () => {
    const now = new Date(2026, 7, 1, 10, 0, 0).getTime();
    const h = [
      { ts: new Date(2026, 7, 1, 8, 0, 0).getTime(), duration: 1500 }, // 8/1 今天
      { ts: new Date(2026, 6, 31, 9, 0, 0).getTime(), duration: 1500 }, // 7/31 上月
      { ts: new Date(2026, 6, 20, 9, 0, 0).getTime(), duration: 1500 }, // 7/20
    ];
    expect(todayCount(h, now)).toBe(1);
  });

  it('只有今天：窗口仅今天有值', () => {
    const h = [entry(10), entry(10, 14)];
    expect(todayCount(h, NOW)).toBe(2);
    const days = last7Days(h, NOW);
    expect(days[6]).toEqual({ date: '2026-08-10', count: 2, minutes: 50 }); // 增强包：日维度含总分钟
    expect(days.slice(0, 6).every((d) => d.count === 0)).toBe(true);
  });
});

describe('last7Days', () => {
  it('空历史 → 7 个 0 的窗口（含今天，最左 6 天前）', () => {
    const days = last7Days([], NOW);
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual({ date: '2026-08-10', count: 0, minutes: 0 });
    expect(days[0]).toEqual({ date: '2026-08-04', count: 0, minutes: 0 });
  });

  it('按日聚合计数（滚动窗口内）', () => {
    const h = [entry(10), entry(10), entry(9), entry(6), entry(3)]; // 8/3 在窗口外（7 天前=8/3？8/4-8/10 共 7 天，8/3 外）
    const days = last7Days(h, NOW);
    expect(days[6]).toEqual({ date: '2026-08-10', count: 2, minutes: 50 });
    expect(days[5]).toEqual({ date: '2026-08-09', count: 1, minutes: 25 });
    expect(days[2]).toEqual({ date: '2026-08-06', count: 1, minutes: 25 });
    expect(days[0]).toEqual({ date: '2026-08-04', count: 0, minutes: 0 });
    const total = days.reduce((s, d) => s + d.count, 0);
    expect(total).toBe(4); // 窗口外的 8/3 不计
  });

  it('跨月滚动窗口（今天 8/2 → 窗口含 7 月底）', () => {
    const now = new Date(2026, 7, 2, 10, 0, 0).getTime();
    const h = [
      { ts: new Date(2026, 7, 2, 8, 0, 0).getTime(), duration: 1500 }, // 8/2
      { ts: new Date(2026, 6, 31, 8, 0, 0).getTime(), duration: 1500 }, // 7/31
      { ts: new Date(2026, 6, 20, 8, 0, 0).getTime(), duration: 1500 }, // 7/20 窗口外
    ];
    const days = last7Days(h, now);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: '2026-07-27', count: 0, minutes: 0 });
    expect(days[5]).toEqual({ date: '2026-08-01', count: 0, minutes: 0 });
    expect(days[6]).toEqual({ date: '2026-08-02', count: 1, minutes: 25 });
    expect(days).toContainEqual({ date: '2026-07-31', count: 1, minutes: 25 });
  });
});
describe('todayMinutes（增强包：今日总时长）', () => {
  it('空历史 → 0', () => {
    expect(todayMinutes([], NOW)).toBe(0);
  });

  it('今日 duration 秒求和折分钟；昨日不计', () => {
    const h = [
      { ts: new Date(2026, 7, 10, 9, 0, 0).getTime(), duration: 25 * 60 },
      { ts: new Date(2026, 7, 10, 15, 30, 0).getTime(), duration: 30 * 60 },
      { ts: new Date(2026, 7, 9, 15, 30, 0).getTime(), duration: 60 * 60 }, // 昨天
    ];
    expect(todayMinutes(h, NOW)).toBe(55);
  });

  it('非整分钟时长四舍五入（防御浮点）', () => {
    const h = [{ ts: new Date(2026, 7, 10, 9, 0, 0).getTime(), duration: 90 }]; // 1.5 分钟
    expect(todayMinutes(h, NOW)).toBe(2);
  });
});

describe('todayHourBuckets（增强包：今日 12 槽时段分布）', () => {
  it('恒 12 槽（2 小时一格），空历史全 0', () => {
    const buckets = todayHourBuckets([], NOW);
    expect(buckets).toHaveLength(12);
    expect(buckets.map((b) => b.hour)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it('按完成时刻落槽：9 点 → [8,10) 槽、14 点 → [14,16) 槽；非今日不计', () => {
    const h = [
      { ts: new Date(2026, 7, 10, 9, 15, 0).getTime(), duration: 1500 }, // 今天 9 点
      { ts: new Date(2026, 7, 10, 9, 59, 0).getTime(), duration: 1500 }, // 今天 9 点
      { ts: new Date(2026, 7, 10, 14, 0, 0).getTime(), duration: 1500 }, // 今天 14 点（槽下界）
      { ts: new Date(2026, 7, 10, 15, 59, 0).getTime(), duration: 1500 }, // 今天 15:59（槽内）
      { ts: new Date(2026, 7, 10, 23, 30, 0).getTime(), duration: 1500 }, // 今天 23 点 → [22,24) 末槽
      { ts: new Date(2026, 7, 9, 9, 15, 0).getTime(), duration: 1500 }, // 昨天 9 点不计
    ];
    const buckets = todayHourBuckets(h, NOW);
    expect(buckets[4]).toEqual({ hour: 8, count: 2 });
    expect(buckets[7]).toEqual({ hour: 14, count: 2 });
    expect(buckets[11]).toEqual({ hour: 22, count: 1 });
    expect(buckets[0].count).toBe(0);
  });
});
