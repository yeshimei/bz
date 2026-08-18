// @vitest-environment node
/**
 * 番茄钟历史聚合测试（ticket 30）：今日计数 + 近 7 天滚动窗口
 */
import { describe, it, expect } from 'vitest';
import { todayCount, last7Days, readingSecondsToday } from '../../src/pomodoro/stats';
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

  it('book 条目 duration < 45min（中途结算）→ 不计个数（ticket 62 完整番茄口径）', () => {
    const h: HistoryEntry[] = [
      { ts: new Date(2026, 7, 10, 8, 0, 0).getTime(), duration: 45 * 60, target: { type: 'book', path: '书架/a.epub', label: 'A' } }, // 完整 → 计
      { ts: new Date(2026, 7, 10, 9, 0, 0).getTime(), duration: 20 * 60, target: { type: 'book', path: '书架/b.epub', label: 'B' } }, // 部分 → 不计
      { ts: new Date(2026, 7, 10, 10, 0, 0).getTime(), duration: 1500 }, // 主番茄钟 → 计
    ];
    expect(todayCount(h, NOW)).toBe(2);
    // 时长统计不受影响：两段 book 都计入
    expect(readingSecondsToday(h, NOW)).toBe(45 * 60 + 20 * 60);
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
    expect(days[6]).toEqual({ date: '2026-08-10', count: 2 });
    expect(days.slice(0, 6).every((d) => d.count === 0)).toBe(true);
  });
});

describe('readingSecondsToday（今日读书时长，秒，ticket 56）', () => {
  function bookEntry(day: number, hour = 9, duration = 1500, label = '活着'): HistoryEntry {
    return { ts: new Date(2026, 7, day, hour, 0, 0).getTime(), duration, target: { type: 'book', path: `书架/${label}.epub`, label } };
  }

  it('今日读书时长 = target.type=book 条目的实读秒数之和', () => {
    const h = [bookEntry(10, 9, 2700), bookEntry(10, 14, 1200), bookEntry(9, 9, 2700)];
    expect(readingSecondsToday(h, NOW)).toBe(2700 + 1200); // 3000s 昨天的 2700 不计
  });

  it('非书目标 / 无目标不计入', () => {
    const h: HistoryEntry[] = [
      { ts: new Date(2026, 7, 10, 9, 0, 0).getTime(), duration: 1500, target: { type: 'memo', id: 'm1', label: '写报告' } },
      { ts: new Date(2026, 7, 10, 10, 0, 0).getTime(), duration: 1500 },
    ];
    expect(readingSecondsToday(h, NOW)).toBe(0);
  });

  it('跨日不计（只有今天）', () => {
    const h = [bookEntry(9), bookEntry(10, 9, 2700)];
    expect(readingSecondsToday(h, NOW)).toBe(2700);
  });

  it('空历史 → 0', () => {
    expect(readingSecondsToday([], NOW)).toBe(0);
  });
});

describe('last7Days', () => {
  it('空历史 → 7 个 0 的窗口（含今天，最左 6 天前）', () => {
    const days = last7Days([], NOW);
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual({ date: '2026-08-10', count: 0 });
    expect(days[0]).toEqual({ date: '2026-08-04', count: 0 });
  });

  it('按日聚合计数（滚动窗口内）', () => {
    const h = [entry(10), entry(10), entry(9), entry(6), entry(3)]; // 8/3 在窗口外（7 天前=8/3？8/4-8/10 共 7 天，8/3 外）
    const days = last7Days(h, NOW);
    expect(days[6]).toEqual({ date: '2026-08-10', count: 2 });
    expect(days[5]).toEqual({ date: '2026-08-09', count: 1 });
    expect(days[2]).toEqual({ date: '2026-08-06', count: 1 });
    expect(days[0]).toEqual({ date: '2026-08-04', count: 0 });
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
    expect(days[0]).toEqual({ date: '2026-07-27', count: 0 });
    expect(days[5]).toEqual({ date: '2026-08-01', count: 0 });
    expect(days[6]).toEqual({ date: '2026-08-02', count: 1 });
    expect(days).toContainEqual({ date: '2026-07-31', count: 1 });
  });

  it('book 部分条目（<45min）不计入柱条（ticket 62）', () => {
    const h: HistoryEntry[] = [
      { ts: new Date(2026, 7, 10, 8, 0, 0).getTime(), duration: 45 * 60, target: { type: 'book', path: '书架/a.epub', label: 'A' } },
      { ts: new Date(2026, 7, 10, 9, 0, 0).getTime(), duration: 10 * 60, target: { type: 'book', path: '书架/b.epub', label: 'B' } },
      { ts: new Date(2026, 7, 10, 10, 0, 0).getTime(), duration: 1500 },
    ];
    const days = last7Days(h, NOW);
    expect(days[6]).toEqual({ date: '2026-08-10', count: 2 }); // 完整 book + 主番茄钟
  });
});
