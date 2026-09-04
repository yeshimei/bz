// @vitest-environment node
/**
 * 复习队列口径纯函数测试（item 6/9 拍板，2026-09）：
 *  - 三区列与「开始本轮」同一套口径（roundQueue ⊇ partition 的 overdue+today）
 *  - R<阈值提前复习卡落「今天」列 + 挂「提前」tag 依据（isEarlyDue/earlyDueOnly）
 *  - 今日到期时刻未到 → 允许提前开始今天全部（roundQueue 纳入）
 */
import { describe, it, expect } from 'vitest';
import { partitionQueue, roundQueue, isEarlyDue, earlyDueOnly, isDueToday } from '../../src/review/queue';
import { DEFAULT_W } from '../../src/review/fsrs';
import type { ReviewItem } from '../../src/review/data';

const THRESHOLD = 0.9;

function mk(partial: Partial<ReviewItem>): ReviewItem {
  const now = new Date();
  return {
    id: partial.filePath || 'x',
    filePath: 'X.md',
    name: 'X',
    reviewStart: now.toISOString(),
    stage: 0,
    phase: 'ladder',
    stability: 1,
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

/** fsrs 相位条目：R(t, S) 可控（S 大 R 高、S 小 R 低） */
function fsrsItem(partial: Partial<ReviewItem>): ReviewItem {
  return mk({ stage: 12, phase: 'fsrs', difficulty: 0.3, ...partial });
}

describe('partitionQueue 三区分区（互斥）', () => {
  it('逾期 → 逾期列；今日稍晚 → 今天列；明天 → 未来列；完成 → done', () => {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 0);
    const col = partitionQueue([
      mk({ filePath: 'A.md', nextReviewDate: new Date(now.getTime() - 1000).toISOString(), isOverdue: true }), // 逾期
      mk({ filePath: 'B.md', nextReviewDate: endOfDay.toISOString() }), // 今日（时刻未到）
      mk({ filePath: 'C.md', nextReviewDate: new Date(now.getTime() + 86400e3 * 5).toISOString() }), // 未来
      mk({ filePath: 'D.md', completed: true }), // 完成
    ]);
    expect(col.overdue.map((i) => i.filePath)).toEqual(['A.md']);
    expect(col.today.map((i) => i.filePath)).toEqual(['B.md']);
    expect(col.future.map((i) => i.filePath)).toEqual(['C.md']);
    expect(col.done.map((i) => i.filePath)).toEqual(['D.md']);
  });

  it('R<阈值提前卡落「今天」列（拍板口径），tag 依据 earlyDueOnly 可辨', () => {
    const now = new Date();
    // R(t=10, S=1) ≈ 0.106 < 0.9 → 提前；nextReviewDate 在 30 天后（非今日）
    const early = fsrsItem({
      filePath: 'E.md',
      stability: 1,
      lastReviewed: new Date(now.getTime() - 10 * 86400e3).toISOString(),
      nextReviewDate: new Date(now.getTime() + 86400e3 * 30).toISOString(),
    });
    const col = partitionQueue([early], THRESHOLD, DEFAULT_W);
    expect(col.today.map((i) => i.filePath)).toEqual(['E.md']); // 落今天列
    expect(col.future).toHaveLength(0);
    expect(earlyDueOnly([early], THRESHOLD, DEFAULT_W)).toHaveLength(1); // 提前 tag 依据
  });

  it('挂起（isMissing）不进三区也不进开始本轮', () => {
    const col = partitionQueue([mk({ filePath: 'M.md', isMissing: true, isOverdue: false })]);
    expect(col.overdue).toHaveLength(0);
    expect(col.today).toHaveLength(0);
    expect(col.future).toHaveLength(0);
    expect(roundQueue([mk({ filePath: 'M.md', isMissing: true })], THRESHOLD, DEFAULT_W)).toHaveLength(0);
  });
});

describe('roundQueue 开始本轮集合（与列表同口径）', () => {
  it('= 逾期 ∪ R 阈值提前 ∪ 今日到期；与 partitionQueue 逾期+今天列一致', () => {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 0);
    const items = [
      mk({ filePath: 'A.md', nextReviewDate: new Date(now.getTime() - 1000).toISOString(), isOverdue: true }), // 逾期
      mk({ filePath: 'B.md', nextReviewDate: endOfDay.toISOString() }), // 今日未到时点
      fsrsItem({
        filePath: 'E.md', stability: 1,
        lastReviewed: new Date(now.getTime() - 10 * 86400e3).toISOString(),
        nextReviewDate: new Date(now.getTime() + 86400e3 * 30).toISOString(),
      }), // 提前
      mk({ filePath: 'C.md', nextReviewDate: new Date(now.getTime() + 86400e3 * 5).toISOString() }), // 未来
    ];
    const round = roundQueue(items, THRESHOLD, DEFAULT_W);
    expect(round.map((i) => i.filePath).sort()).toEqual(['A.md', 'B.md', 'E.md'].sort());
    // 口径统一断言：partition 的逾期列+今天列 = round 集合
    const col = partitionQueue(items, THRESHOLD, DEFAULT_W);
    expect([...col.overdue, ...col.today].map((i) => i.filePath).sort()).toEqual(round.map((i) => i.filePath).sort());
  });

  it('R≥阈值（记忆牢固）不提前纳入', () => {
    const now = new Date();
    // R(t=1, S=100) ≈ 0.99 ≥ 0.9
    const solid = fsrsItem({
      stability: 100,
      lastReviewed: new Date(now.getTime() - 1 * 86400e3).toISOString(),
      nextReviewDate: new Date(now.getTime() + 86400e3 * 5).toISOString(),
    });
    expect(isEarlyDue(solid, THRESHOLD, DEFAULT_W)).toBe(false);
    expect(roundQueue([solid], THRESHOLD, DEFAULT_W)).toHaveLength(0);
  });
});

describe('isDueToday（自 ui 下沉）', () => {
  it('日历日口径与原实现一致', () => {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 0);
    expect(isDueToday(mk({ nextReviewDate: endOfDay.toISOString() }))).toBe(true);
    expect(isDueToday(mk({ nextReviewDate: new Date(now.getTime() + 86400e3).toISOString() }))).toBe(false);
    expect(isDueToday(mk({ nextReviewDate: null }))).toBe(false);
  });
});
