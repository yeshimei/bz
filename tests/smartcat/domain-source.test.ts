/**
 * 域 JSON 感知（2026-08-23 用户拍板）：CONFIG/STORAGE 各域数据 → 观察文本（新增感知 + 首次快照不产出）
 */
import { describe, it, expect } from 'vitest';
import { DOMAIN_FILES, snapshotDomains } from '../../src/smartcat/domain-source';

describe('DOMAIN_FILES（6 域新增感知；news 已移除，ticket 076）', () => {
  it('memo：新增已完成待办产出观察，重复不产出；新条目才再产出', () => {
    const prev = new Map<string, string>();
    const ex = DOMAIN_FILES.memo.extract;
    expect(ex([{ completed: '2026-08-23T10:00:00Z' }], prev)).toContain('完成了一项待办');
    expect(ex([{ completed: '2026-08-23T10:00:00Z' }], prev)).toBeNull(); // 已见
    expect(ex([{ completed: '2026-08-23T10:00:00Z' }, { completed: '2026-08-23T11:00:00Z' }], prev)).toContain('累计 2 件');
    expect(ex([{ completed: '2026-08-23T10:00:00Z' }, { completed: '2026-08-23T11:00:00Z' }], prev)).toBeNull(); // 已见
  });

  it('pomodoro：新增 ts 记录产出「专注」观察', () => {
    const prev = new Map<string, string>();
    expect(DOMAIN_FILES.pomodoro.extract({ history: [{ ts: 1111 }] }, prev)).toContain('番茄钟');
    expect(DOMAIN_FILES.pomodoro.extract({ history: [{ ts: 1111 }, { ts: 2222 }] }, prev)).toContain('+ 1 次');
    expect(DOMAIN_FILES.pomodoro.extract({ history: [] }, prev)).toBeNull();
  });

  it('quiz/review/favorites/belongings：数量增长才产出', () => {
    const prev = new Map<string, string>();
    expect(DOMAIN_FILES.quiz.extract([{ lastCorrect: 1 }], prev)).toContain('做了几道题');
    expect(DOMAIN_FILES.quiz.extract([{ lastCorrect: 1 }], prev)).toBeNull();
    expect(DOMAIN_FILES.review.extract([{ nextReview: 1 }], prev)).toContain('复习');
    expect(DOMAIN_FILES.favorites.extract([{}, {}], prev)).toContain('收藏');
    expect(DOMAIN_FILES.belongings.extract({ items: { a: {} } }, prev)).toContain('物品');
    expect(DOMAIN_FILES.belongings.extract({ items: { a: {} } }, prev)).toBeNull();
  });

  it('非数组/无数据 → null（不产出噪音）', () => {
    const prev = new Map<string, string>();
    expect(DOMAIN_FILES.memo.extract(null, prev)).toBeNull();
    expect(DOMAIN_FILES.belongings.extract(null, prev)).toBeNull();
    expect(DOMAIN_FILES.pomodoro.extract({ history: 'x' }, prev)).toBeNull();
  });
});

describe('snapshotDomains（首次快照）', () => {
  it('只记录已有状态，不产出观察；返回存在的域', async () => {
    const prev = new Map<string, string>();
    const found = await snapshotDomains(async (path: string) => {
      if (path.includes('memo')) return [{ completed: '2026-01-01T00:00:00Z' }];
      if (path.includes('favorites')) return [{}, {}];
      throw new Error('no file');
    }, prev);
    expect(found).toEqual(expect.arrayContaining(['memo', 'favorites']));
    // 首次快照不产出 → memo 状态已被记录
    expect(prev.has('memoTotal')).toBe(true);
  });
});