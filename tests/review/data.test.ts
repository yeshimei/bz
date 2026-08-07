/**
 * 复习计划数据层测试（ticket 16）：review.json 兼容迁移/addItem/updateFilePath
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

describe('ReviewDataManager', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
  });

  it('addItem：完整字段 + 首次复习 1 分钟后', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const item = await dm.addItem(vault.file('A.md') as any);
    expect(item.stage).toBe(0);
    expect(item.phase).toBe('ladder');
    expect(item.stability).toBe(1);
    expect(item.difficulty).toBe(0.3);
    expect(item.completed).toBe(false);
    expect(item.nextReviewDate - item.reviewStart).toBeCloseTo(60000, 0); // 1分钟
    expect(item.currentStage).toBe(1);
    // 落盘
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.items.length).toBe(1);
    expect(raw.items[0].file).toBeUndefined(); // 剥离运行时字段
  });

  it('addItem 重复 → 抛「该笔记已在复习计划中」', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    await dm.addItem(vault.file('A.md') as any);
    await expect(dm.addItem(vault.file('A.md') as any)).rejects.toThrow('该笔记已在复习计划中');
  });

  it('loadItems 兼容迁移：reviewStage→stage、缺省值、phase、isOverdue', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    const now = Date.now();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify({
      items: [
        // 旧格式：reviewStage=3（→stage=2 ladder）、无 stability/difficulty/phase
        { id: '1', filePath: 'A.md', reviewStage: 3, reviewStart: now, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: now - 1000, lastReviewed: null, lastDifficulty: null, completed: false },
        // 新格式 fsrs：stage=12
        { id: '2', filePath: 'B.md', reviewStart: now, stage: 12, phase: 'fsrs', stability: 2.5, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: now + 1000000, lastReviewed: null, lastDifficulty: null, completed: false },
        // 文件不存在 → 跳过
        { id: '3', filePath: 'GONE.md', reviewStart: now, stage: 0, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: now, lastReviewed: null, lastDifficulty: null, completed: false },
      ],
    }));
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
    expect(a.fileName).toBe('A');
    const b = items.find((i) => i.id === '2')!;
    expect(b.phase).toBe('fsrs');
    expect(b.isOverdue).toBe(false);
  });

  it('updateItem 缺失 → 抛「条目不存在」', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    await expect(dm.updateItem({ id: 'nope' } as any)).rejects.toThrow('条目不存在');
  });

  it('updateFilePath：成功/目标被占/未找到', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    vault.files.set('C.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const itemA = await dm.addItem(vault.file('A.md') as any);
    await dm.addItem(vault.file('B.md') as any);
    // 成功
    expect(await dm.updateFilePath('A.md', 'A2.md', 'A2')).toBe(true);
    expect(dm.items.find((i) => i.id === itemA.id)!.filePath).toBe('A2.md');
    // 目标被占
    expect(await dm.updateFilePath('A2.md', 'B.md', 'B')).toBe(false);
    // 未找到
    expect(await dm.updateFilePath('Z.md', 'X.md', 'X')).toBe(false);
  });

  it('removeItem', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const item = await dm.addItem(vault.file('A.md') as any);
    await dm.removeItem(item.id);
    expect(dm.items.length).toBe(0);
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.items.length).toBe(0);
  });
});
