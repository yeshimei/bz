/**
 * 复习计划数据层测试（ticket 16 修正版）：ISO 日期/兼容迁移/updateItem(filePath,fn)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ReviewDataManager, REVIEW_FILE_PATH, getReviewFilePath } from '../../src/review/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

describe('ReviewDataManager', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
  });

  it('addItem：完整字段 + 首次复习 1 分钟后（ISO 日期）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const item = await dm.addItem('A.md', 'A');
    expect(item.stage).toBe(0);
    expect(item.phase).toBe('ladder');
    expect(item.stability).toBe(1);
    expect(item.difficulty).toBe(0.3);
    expect(item.completed).toBe(false);
    expect(item.name).toBe('A');
    // ISO 字符串日期
    expect(typeof item.reviewStart).toBe('string');
    expect(typeof item.nextReviewDate).toBe('string');
    expect(new Date(item.nextReviewDate!).getTime() - new Date(item.reviewStart).getTime()).toBeCloseTo(60000, 0);
    // 落盘（数组结构 + 剥离运行时字段）
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(Array.isArray(raw)).toBe(true);
    expect(raw.length).toBe(1);
    expect(raw[0].file).toBeUndefined();
    expect(typeof raw[0].nextReviewDate).toBe('string');
  });

  it('addItem 重复 → 抛「该笔记已在复习计划中」', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    await dm.addItem('A.md', 'A');
    await expect(dm.addItem('A.md', 'A')).rejects.toThrow('该笔记已在复习计划中');
  });

  it('loadItems 兼容迁移：reviewStage→stage、缺省值、phase、isOverdue（ISO）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      // 旧格式：reviewStage=3（→stage=2 ladder）、无 stability/difficulty/phase
      { id: '1', filePath: 'A.md', reviewStage: 3, reviewStart: now.toISOString(), reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
      // 新格式 fsrs：stage=12
      { id: '2', filePath: 'B.md', reviewStart: now.toISOString(), stage: 12, phase: 'fsrs', stability: 2.5, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 1000000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
      // 文件不存在 → 跳过
      { id: '3', filePath: 'GONE.md', reviewStart: now.toISOString(), stage: 0, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: now.toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const items = await dm.loadItems();
    expect(items.length).toBe(2);
    const a = items.find((i) => i.id === '1')!;
    expect(a.stage).toBe(2);
    expect(a.stability).toBe(1);
    expect(a.difficulty).toBe(0.3);
    expect(a.phase).toBe('ladder');
    expect(a.isOverdue).toBe(true);
    expect(a.currentStage).toBe(3);
    expect(a.totalStages).toBe(10);
    expect(a.name).toBe('A');
    const b = items.find((i) => i.id === '2')!;
    expect(b.phase).toBe('fsrs');
    expect(b.isOverdue).toBe(false);
  });

  it('updateItem(filePath, fn) 缺失 → 抛「条目不存在」', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    await expect(dm.updateItem('nope.md', () => {})).rejects.toThrow('条目不存在');
  });

  it('updateItem 就地修改 + 落盘', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    await dm.addItem('A.md', 'A');
    await dm.updateItem('A.md', (it) => {
      it.stage = 5;
    });
    const items = await dm.loadItems();
    expect(items[0].stage).toBe(5);
  });

  it('updateFilePath：成功/目标被占/未找到', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    vault.files.set('C.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    await dm.addItem('A.md', 'A');
    await dm.addItem('B.md', 'B');
    // 成功
    expect(await dm.updateFilePath('A.md', 'A2.md', 'A2')).toBe(true);
    // 目标被占
    expect(await dm.updateFilePath('A2.md', 'B.md', 'B')).toBe(false);
    // 未找到
    expect(await dm.updateFilePath('Z.md', 'X.md', 'X')).toBe(false);
  });

  it('removeItem(filePath)', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    await dm.addItem('A.md', 'A');
    await dm.removeItem('A.md');
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.length).toBe(0);
  });

  it('getOverdueCount', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
      { id: '2', filePath: 'B.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const items = await dm.loadItems();
    expect(dm.getOverdueCount(items)).toBe(1);
  });
});

describe('数据文件路径设置', () => {
  it('getReviewFilePath 读取 reviewStoragePath 设置，缺省回退 CONFIG/STORAGE', () => {
    setSettingsProvider(() => ({ reviewStoragePath: '自定义/数据' }) as any);
    expect(getReviewFilePath()).toBe('自定义/数据/review.json');
    setSettingsProvider(() => ({} as any));
    expect(getReviewFilePath()).toBe('CONFIG/STORAGE/review.json');
  });
});
