// @vitest-environment node
/**
 * 复习统计与负载测试（ADR-0077，ticket 174）：streak 宽松口径/评级分布/逾期率/负载分布。
 * A5 审查修复（2026-09）：loadPreview/loadHeatmap 死代码已删，原对应用例随之退役。
 */
import { describe, it, expect } from 'vitest';
import { computeStats, loadDistribution, dateKey } from '../../src/review/stats';
import { currentR, DEFAULT_W } from '../../src/review/fsrs';
import type { ReviewItem } from '../../src/review/data';

/** 造一个复习条目 */
function mkItem(partial: Partial<ReviewItem> & { reviewHistory?: any[] }): ReviewItem {
  return {
    id: 'x',
    filePath: 'A.md',
    name: 'A',
    reviewStart: '2026-08-01T00:00:00.000Z',
    stage: 10,
    phase: 'fsrs',
    stability: 5,
    difficulty: 0.3,
    reviewHistory: [],
    totalReviews: 0,
    averageConfidence: 0,
    nextReviewDate: null,
    lastReviewed: null,
    lastDifficulty: null,
    completed: false,
    ...partial,
  } as ReviewItem;
}

describe('dateKey', () => {
  it('本地日期键 YYYY-MM-DD', () => {
    const d = new Date(2026, 7, 15); // 2026-08-15 本地
    expect(dateKey(d)).toBe('2026-08-15');
  });
});

describe('computeStats', () => {
  it('宽松 streak：所有评级都算，同日去重', () => {
    // 三天前、两天前、昨天各一次；今天没有 → streak 从昨天往回数 = 3
    const now = new Date();
    const d1 = new Date(now); d1.setDate(d1.getDate() - 3);
    const d2 = new Date(now); d2.setDate(d2.getDate() - 2);
    const d3 = new Date(now); d3.setDate(d3.getDate() - 1);
    const item = mkItem({
      reviewHistory: [
        { timestamp: d1.toISOString(), stage: 10, rating: 'good' },
        { timestamp: d2.toISOString(), stage: 10, rating: 'easy' },
        { timestamp: d3.toISOString(), stage: 10, rating: 'again' },
      ],
    });
    const stats = computeStats([item]);
    expect(stats.totalReviews).toBe(3); // 三天三个不同日期
    expect(stats.streak).toBe(3);
    expect(stats.ratingDist.good).toBe(1);
    expect(stats.ratingDist.easy).toBe(1);
    expect(stats.ratingDist.again).toBe(1);
    expect(stats.reviewedNotes).toBe(1);
  });

  it('同日多次复习算 1 次（防刷）', () => {
    const now = new Date();
    const today = now.toISOString();
    const item = mkItem({
      reviewHistory: [
        { timestamp: today, stage: 10, rating: 'good' },
        { timestamp: today, stage: 10, rating: 'good' },
        { timestamp: today, stage: 10, rating: 'again' },
      ],
    });
    const stats = computeStats([item]);
    expect(stats.totalReviews).toBe(1); // 同日去重
    expect(stats.todayReviews).toBe(3); // 今日实际条数（未去重，展示当日活跃）
  });

  it('断一天 → streak 中断', () => {
    const now = new Date();
    const d1 = new Date(now); d1.setDate(d1.getDate() - 5);
    const d3 = new Date(now); d3.setDate(d3.getDate() - 3);
    const item = mkItem({
      reviewHistory: [
        { timestamp: d1.toISOString(), stage: 10, rating: 'good' },
        { timestamp: d3.toISOString(), stage: 10, rating: 'good' },
      ],
    });
    const stats = computeStats([item]);
    expect(stats.streak).toBe(0); // 最近复习是 3 天前，今天昨天都没复习 → 0
  });

  it('逾期率：逾期 / 未完成', () => {
    const item = mkItem({
      isOverdue: true,
      nextReviewDate: '2026-01-01T00:00:00.000Z',
    });
    const itemOk = mkItem({
      filePath: 'B.md',
      isOverdue: false,
      nextReviewDate: '2099-01-01T00:00:00.000Z',
    });
    const stats = computeStats([item, itemOk]);
    expect(stats.overdueRate).toBeCloseTo(0.5, 5);
  });

  it('completed 条目不计入逾期率分母（活跃口径）', () => {
    const item = mkItem({ isOverdue: true, completed: true, nextReviewDate: '2026-01-01T00:00:00.000Z' });
    const stats = computeStats([item]);
    expect(stats.overdueRate).toBe(0); // 活跃为 0，分母 0 → 0
  });

  it('A7 单源回归：avgR = fsrs.currentR 逐条均值（FSRS 条目），阶梯/缺 lastReviewed 条目不计入', () => {
    const now = new Date();
    const fsrs1 = mkItem({ filePath: 'A.md', phase: 'fsrs', stability: 5, lastReviewed: new Date(now.getTime() - 2 * 86400e3).toISOString() });
    const fsrs2 = mkItem({ filePath: 'B.md', phase: 'fsrs', stability: 0.5, lastReviewed: new Date(now.getTime() - 1 * 86400e3).toISOString() });
    const ladder = mkItem({ filePath: 'C.md', phase: 'ladder', stability: 9, lastReviewed: now.toISOString() });
    const noLast = mkItem({ filePath: 'D.md', phase: 'fsrs', stability: 5, lastReviewed: null });
    const stats = computeStats([fsrs1, fsrs2, ladder, noLast]);
    const r1 = currentR(fsrs1, DEFAULT_W)!;
    const r2 = currentR(fsrs2, DEFAULT_W)!;
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(stats.avgR).not.toBeNull();
    expect(stats.avgR!).toBeCloseTo((r1 + r2) / 2, 12);
    // 无可算条目 → null（原口径）
    expect(computeStats([ladder]).avgR).toBeNull();
  });
});

describe('负载', () => {
  it('loadDistribution：N 天内每日负载（含今天）', () => {
    const today = new Date();
    const tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
    const items = [
      mkItem({ nextReviewDate: today.toISOString() }),
      mkItem({ filePath: 'B.md', nextReviewDate: today.toISOString() }),
      mkItem({ filePath: 'C.md', nextReviewDate: tmr.toISOString() }),
    ];
    const dist = loadDistribution(items, 7);
    expect(dist).toHaveLength(7);
    expect(dist[0].date).toBe(dateKey(today));
    expect(dist[0].count).toBe(2);
    expect(dist[1].count).toBe(1);
  });

  it('completed/missing 不计入负载', () => {
    const today = new Date();
    const items = [
      mkItem({ nextReviewDate: today.toISOString(), completed: true }),
      mkItem({ filePath: 'B.md', nextReviewDate: today.toISOString(), isMissing: true }),
    ];
    const dist = loadDistribution(items, 7);
    expect(dist[0].count).toBe(0);
  });
});
