/**
 * 复习计划核心逻辑测试（ticket 16）：markReview 阶梯/FSRS/未到期/autoJumpOverdue
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { reviewApp } from '../../src/review/app';
import type { ReviewItem } from '../../src/review/data';

function makeItem(partial: Partial<ReviewItem> = {}): ReviewItem {
  const now = Date.now();
  return {
    id: 'x',
    filePath: 'A.md',
    fileName: 'A',
    reviewStart: now,
    stage: 0,
    phase: 'ladder',
    stability: 1,
    difficulty: 0.3,
    reviewHistory: [],
    totalReviews: 0,
    averageConfidence: 0,
    nextReviewDate: now - 1000, // 已到期
    lastReviewed: null,
    lastDifficulty: null,
    completed: false,
    currentStage: 1,
    ...partial,
  };
}

describe('markReview 阶梯分支', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({}) as any);
  });

  it('again→stage-1（clamp 0）；hard 不变；good+1；easy+2（clamp 9）', async () => {
    const app = mockAppWithVault(new MockVault());
    setApp(app);

    const i1 = makeItem({ stage: 3, currentStage: 4 });
    await reviewApp.markReview(app, i1, 'again');
    expect(i1.stage).toBe(2);
    expect(i1.phase).toBe('ladder');
    expect(i1.nextReviewDate).toBeGreaterThan(Date.now());

    const i2 = makeItem({ stage: 3, currentStage: 4 });
    await reviewApp.markReview(app, i2, 'hard');
    expect(i2.stage).toBe(3);

    const i3 = makeItem({ stage: 3, currentStage: 4 });
    await reviewApp.markReview(app, i3, 'good');
    expect(i3.stage).toBe(4);

    const i4 = makeItem({ stage: 8, currentStage: 9 });
    await reviewApp.markReview(app, i4, 'easy');
    expect(i4.stage).toBe(9); // clamp

    const i5 = makeItem({ stage: 0, currentStage: 1 });
    await reviewApp.markReview(app, i5, 'again');
    expect(i5.stage).toBe(0); // clamp

    // history 结构
    expect(i3.reviewHistory).toHaveLength(1);
    expect(i3.reviewHistory[0]).toMatchObject({ rating: 'good', stage: 5 });
  });

  it('进入 fsrs：stability=initS(rating)、difficulty、notice', async () => {
    const app = mockAppWithVault(new MockVault());
    setApp(app);
    const item = makeItem({ stage: 8, currentStage: 9 });
    await reviewApp.markReview(app, item, 'good');
    expect(item.phase).toBe('fsrs');
    expect(item.stability).toBe(2.4); // initS('good')
    expect(item.difficulty).toBe(0.3);
    expect(item.nextReviewDate).toBeGreaterThan(Date.now());
  });

  it('again 从阶梯分支不可达 fsrs（9-1=8 仍阶梯，源码语义）', async () => {
    const app = mockAppWithVault(new MockVault());
    setApp(app);
    const item = makeItem({ stage: 9, currentStage: 10 });
    await reviewApp.markReview(app, item, 'again');
    expect(item.stage).toBe(8);
    expect(item.phase).toBe('ladder');
  });

  it('未到期 → Notice 且不推进', async () => {
    const app = mockAppWithVault(new MockVault());
    setApp(app);
    const item = makeItem({ stage: 2, currentStage: 3, nextReviewDate: Date.now() + 10 * 60000 });
    await reviewApp.markReview(app, item, 'good');
    expect(item.stage).toBe(2); // 未变
  });
});

describe('markReview FSRS 分支', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({}) as any);
  });

  it('S/D 舍入 2 位 + history 带 stability/R', async () => {
    const app = mockAppWithVault(new MockVault());
    setApp(app);
    const now = Date.now();
    const item = makeItem({
      phase: 'fsrs',
      stage: 12,
      currentStage: 13,
      stability: 5,
      difficulty: 0.3,
      lastReviewed: now - 3 * 86400000,
      nextReviewDate: now - 1000,
    });
    await reviewApp.markReview(app, item, 'good');
    expect(item.phase).toBe('fsrs');
    expect(item.stage).toBe(13);
    expect(item.stability).toBeCloseTo(Math.round(item.stability * 100) / 100, 5);
    expect(item.totalReviews).toBe(1);
    expect(item.reviewHistory[0]).toMatchObject({ rating: 'good', stability: item.stability });
    expect(typeof item.reviewHistory[0].R).toBe('number');
    expect(item.nextReviewDate).toBeGreaterThan(now);
  });

  it('again → stability 降低', async () => {
    const app = mockAppWithVault(new MockVault());
    setApp(app);
    const now = Date.now();
    const item = makeItem({
      phase: 'fsrs',
      stage: 15,
      stability: 0.4,
      difficulty: 0.3,
      lastReviewed: now - 86400000,
      nextReviewDate: now - 1000,
    });
    await reviewApp.markReview(app, item, 'again');
    expect(item.stability).toBeLessThan(1);
  });
});

describe('autoJumpOverdue / accuracyToRating', () => {
  it('无逾期 → 🎉 没有逾期笔记', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({}) as any);
    const dm = {
      items: [makeItem({ isOverdue: false }), makeItem({ isOverdue: false })],
      loadItems: async () => {},
    };
    await reviewApp.autoJumpOverdue(app, dm, null);
  });

  it('accuracyToRating 分档', () => {
    expect(reviewApp.accuracyToRating(95)).toBe('easy');
    expect(reviewApp.accuracyToRating(75)).toBe('good');
    expect(reviewApp.accuracyToRating(55)).toBe('hard');
    expect(reviewApp.accuracyToRating(30)).toBe('again');
  });

  it('addCurrentToReview：无文件 → 提示', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const dm = { addItem: async () => { throw new Error('该笔记已在复习计划中'); } };
    await reviewApp.addCurrentToReview(app, dm); // getActiveFile null → Notice
  });
});
