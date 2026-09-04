// @vitest-environment node
/**
 * 复习 D3 可靠写契约回归（写路径收编）：
 * ①并发读改写事务不互踩——复习评级（updateItem）与加入新计划（addItem）并发，双方改动都落盘
 *   （事务已整体入 core per-path 串行队列，后写者不再用陈旧基线覆盖先写者）；
 * ②解析坏文件 → 原样留档 CONFIG/.CORRUPT + 降级初始化后域功能可用。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ReviewDataManager, getReviewFilePath, getReviewFitFilePath, saveFittedParams, loadFittedParams } from '../../src/review/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';

const PATH = getReviewFilePath();
const FIT_PATH = getReviewFitFilePath();

function seed(id: string, path: string): any {
  return {
    id, filePath: path, name: path, reviewStart: '2026-01-01T00:00:00.000Z', stage: 0, phase: 'ladder',
    stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
    nextReviewDate: '2026-12-01T00:00:00.000Z', lastReviewed: null, lastDifficulty: null, completed: false,
  };
}

beforeEach(() => {
  setApp(null as any);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
});

describe('review.json D3 可靠写契约', () => {
  it('①并发事务：addItem 与 updateItem 交错，双方改动都落盘', async () => {
    const vault = new MockVault();
    vault.files.set(PATH, JSON.stringify([seed('a', '笔记A.md'), seed('b', '笔记B.md')]));
    const app = { vault };
    setApp(app as any);
    const dm = new ReviewDataManager(app as any);

    await Promise.all([
      dm.addItem('笔记C.md', '笔记C'), // 事务一：新增
      dm.updateItem('笔记B.md', (it) => { it.stage = 3; }), // 事务二：评级推进
    ]);

    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw.find((r: any) => r.filePath === '笔记C.md')).toBeTruthy(); // 新增未丢
    expect(raw.find((r: any) => r.filePath === '笔记B.md').stage).toBe(3); // 评级未被陈旧基线回滚
    expect(raw).toHaveLength(3);
  });

  it('①续：restoreItem 与 removeItem 同路径并发，终态自洽（无半写）', async () => {
    const vault = new MockVault();
    vault.files.set(PATH, JSON.stringify([seed('a', '笔记A.md'), seed('b', '笔记B.md')]));
    const app = { vault };
    setApp(app as any);
    const dm = new ReviewDataManager(app as any);

    await Promise.all([dm.removeItem('笔记A.md'), dm.restoreItem(seed('a', '笔记A.md'))]);
    const raw = JSON.parse(vault.files.get(PATH)!);
    // 串行执行后文件必为完整 JSON 且集合自洽（删了又还原 or 原样 or 删掉，不得半写）
    expect(Array.isArray(raw)).toBe(true);
    expect(raw.length === 1 || raw.length === 2).toBe(true);
  });

  it('②解析坏文件 → 留档 CONFIG/.CORRUPT + 降级空列表后可继续 addItem', async () => {
    const vault = new MockVault();
    const broken = '[{"filePath":"笔记A.md"'; // 半截 JSON
    vault.files.set(PATH, broken);
    const app = { vault };
    setApp(app as any);
    const dm = new ReviewDataManager(app as any);

    const items = await dm.loadItems(); // 留档 + 降级空列表，不抛
    expect(items).toEqual([]);
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/review.json.'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^CONFIG\/\.CORRUPT\/review\.json\.\d{8}-\d{6}\.bak$/);
    expect(vault.files.get(backups[0])).toBe(broken); // 原文原样留档
    // 降级后域功能可用
    const added = await dm.addItem('笔记C.md', '笔记C');
    expect(added.filePath).toBe('笔记C.md');
  });

  it('②续：review-fit.json 拟合写同样入队（并发拟合写不互踩，坏文件留档降级）', async () => {
    const vault = new MockVault();
    setApp({ vault } as any);
    const fitA = { w: Array(19).fill(0.5), fitAt: '2026-01-01T00:00:00.000Z', fitCount: 10, full: true };
    const fitB = { w: Array(19).fill(0.6), fitAt: '2026-01-02T00:00:00.000Z', fitCount: 20, full: false };
    await Promise.all([saveFittedParams({ vault } as any, fitA), saveFittedParams({ vault } as any, fitB)]);
    const raw = JSON.parse(vault.files.get(FIT_PATH)!);
    expect([10, 20]).toContain(raw.fitCount); // 终态为某一次完整拟合，无交错

    // 坏文件：读路径留档 + 降级重建，之后拟合写恢复正常
    const broken = '{"w":[1,2'; // 半截 JSON
    vault.files.set(FIT_PATH, broken);
    expect(await loadFittedParams({ vault } as any)).toBeNull(); // 字段不齐 → null（留档降级已发生）
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/review-fit.json.'));
    expect(backups).toHaveLength(1);
    expect(vault.files.get(backups[0])).toBe(broken); // 原文原样留档
    await saveFittedParams({ vault } as any, fitA); // 降级后拟合写恢复正常
    expect(JSON.parse(vault.files.get(FIT_PATH)!).fitCount).toBe(10);
  });
});
