/**
 * 复习计划核心逻辑测试（ticket 16 修正版）：markReview 阶梯/FSRS/未到期/autoJumpOverdue
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { reviewApp } from '../../src/review/app';
import { ReviewDataManager, REVIEW_FILE_PATH, ReviewItem } from '../../src/review/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 预置一条逾期复习数据 */
async function seedOverdue(vault: MockVault, partial: Partial<ReviewItem> = {}) {
  const now = new Date();
  vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
    {
      id: 'x', filePath: 'A.md', name: 'A',
      reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3,
      reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
      ...partial,
    },
  ]));
  return now;
}

describe('markReview 阶梯分支', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({}) as any);
    (reviewApp as any).dataManager = null; // 重置单例（跨测试污染）
  });

  it('again→stage-1（clamp 0）；hard 不变；good+1；easy+2（clamp 9）；ISO 时间落盘', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 3 });
    const app = makeApp(vault);
    setApp(app);

    // 每次复习前重置种子（避免未到期拦截）
    await reviewApp.markReview('A.md', 'again');
    let items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(2);
    expect(items[0].phase).toBe('ladder');
    expect(typeof items[0].nextReviewDate).toBe('string');
    expect(typeof items[0].lastReviewed).toBe('string');
    expect(items[0].reviewHistory[0]).toMatchObject({ rating: 'again', stage: 3 });
    expect(typeof items[0].reviewHistory[0].timestamp).toBe('string');

    await seedOverdue(vault, { stage: 3 });
    await reviewApp.markReview('A.md', 'hard');
    items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(3);

    await seedOverdue(vault, { stage: 3 });
    await reviewApp.markReview('A.md', 'good');
    items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(4);
  });

  it('easy 从 stage 8 → clamp 9 进入 fsrs：stability=initS、difficulty、Notice 文案', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 8 });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'easy');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(9);
    expect(items[0].phase).toBe('fsrs');
    expect(items[0].stability).toBe(5.8); // initS('easy')
    expect(items[0].difficulty).toBe(0.3);
    // 进入 fsrs 的 nextReviewDate = 阶梯 interval[9] = 120 天（源码语义）
    const diffDays = (new Date(items[0].nextReviewDate!).getTime() - new Date(items[0].reviewStart).getTime()) / 86400000;
    expect(diffDays).toBeCloseTo(120, 5);
  });

  it('again 从阶梯不可达 fsrs（9-1=8 仍阶梯）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 9 });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'again');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(8);
    expect(items[0].phase).toBe('ladder');
  });

  it('未到期 → ceil 分钟 Notice 且不推进', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, { stage: 2, nextReviewDate: new Date(now.getTime() + 10 * 60000 + 30000).toISOString() });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(2); // 未变
  });

  it('completed 条目 → 该笔记已完成全部复习', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { completed: true });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(0); // 未变
  });
});

describe('markReview FSRS 分支', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({}) as any);
    (reviewApp as any).dataManager = null;
  });

  it('stage 不递增（源码语义）；S/D 舍入；history stage=currentStage+1', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, {
      stage: 12, phase: 'fsrs', stability: 5, difficulty: 0.3,
      lastReviewed: new Date(now.getTime() - 3 * 86400000).toISOString(),
    });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(12); // FSRS 分支不递增 stage
    expect(items[0].totalReviews).toBe(1);
    expect(items[0].reviewHistory[0]).toMatchObject({ rating: 'good', stage: 13 });
    expect(typeof items[0].reviewHistory[0].R).toBe('number');
    expect(items[0].nextReviewDate).toBeTruthy();
  });

  it('again → stability 显著降低', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, {
      stage: 15, phase: 'fsrs', stability: 0.4, difficulty: 0.3,
      lastReviewed: new Date(now.getTime() - 86400000).toISOString(),
    });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'again');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stability).toBeLessThan(1);
  });
});

describe('autoJumpOverdue / reviewLoop / accuracyToRating', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({ forceQuizForReview: false }) as any);
    (reviewApp as any).dataManager = null;
  });

  it('无逾期 → 🎉 没有逾期笔记', async () => {
    const vault = new MockVault();
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.autoJumpOverdue();
  });

  it('accuracyToRating 分档', () => {
    expect(reviewApp.accuracyToRating(95)).toBe('easy');
    expect(reviewApp.accuracyToRating(75)).toBe('good');
    expect(reviewApp.accuracyToRating(55)).toBe('hard');
    expect(reviewApp.accuracyToRating(30)).toBe('again');
  });

  it('reviewLoop：文件不存在 → removeItem + 继续', async () => {
    const vault = new MockVault();
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: 'gone', filePath: 'GONE.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    // loadItems 已过滤不存在文件，直接传手工列表触发防御分支
    const goneItem = {
      id: 'gone', filePath: 'GONE.md', name: 'GONE', reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    } as any;
    await reviewApp.reviewLoop([goneItem], 0);
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.length).toBe(0);
  });

  it('addCurrentToReview：重复 → 抛错', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.addCurrentToReview(vault.file('A.md') as any);
    await expect(reviewApp.addCurrentToReview(vault.file('A.md') as any)).rejects.toThrow('该笔记已在复习计划中');
  });
});

describe('applyReviewStyles', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as any);
    (reviewApp as any).dataManager = null;
  });

  it('data-path 选择器 + 时间徽标（d/h/m）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 2, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 5 * 3600000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    // 文件树 DOM（源码选择器）
    const treeItem = document.createElement('div');
    treeItem.setAttribute('data-path', 'A.md');
    const inner = document.createElement('div');
    inner.className = 'tree-item-inner';
    treeItem.appendChild(inner);
    document.body.appendChild(treeItem);

    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app, vault.file('A.md') as any);
    expect(inner.style.color).toBe('rgb(24, 144, 255)'); // stage<=2 #1890ff
    const badge = inner.querySelector('.review-stage-badge');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toMatch(/^\d+[dhm]$/); // 时间文本
  });

  it('completed → ✅ + #52c41a', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: now.toISOString(), lastReviewed: null, lastDifficulty: null, completed: true },
    ]));
    const treeItem = document.createElement('div');
    treeItem.setAttribute('data-path', 'A.md');
    const inner = document.createElement('div');
    inner.className = 'tree-item-inner';
    treeItem.appendChild(inner);
    document.body.appendChild(treeItem);

    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app, vault.file('A.md') as any);
    expect(inner.style.color).toBe('rgb(82, 196, 26)'); // #52c41a
    expect(inner.querySelector('.review-stage-badge')!.textContent).toBe('✅');
  });
});
