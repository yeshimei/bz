/**
 * 域 JSON 感知（2026-08-23 用户拍板）：CONFIG/STORAGE 各域数据 → 观察文本（新增感知 + 首次快照不产出）
 * ticket 075：memo 移除（改走 methods 监听 notifyMemoAction，防 JSON 事件通道双记录）
 * ticket 080：pomodoro 移除（改走方法监听 notifyPomodoroAction，防 JSON 事件通道双记录）
 */
import { describe, it, expect } from 'vitest';
import { DOMAIN_FILES, snapshotDomains } from '../../src/smartcat/domain-source';

describe('DOMAIN_FILES（4 域新增感知；memo/news/pomodoro 均已移除）', () => {
  it('memo（ticket 075）/news（ticket 076）/pomodoro（ticket 080）不再有 extract，防双记录', () => {
    expect(DOMAIN_FILES.memo).toBeUndefined();
    expect(DOMAIN_FILES.news).toBeUndefined();
    expect(DOMAIN_FILES.pomodoro).toBeUndefined();
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
expect(DOMAIN_FILES.belongings.extract(null, prev)).toBeNull();
    expect(DOMAIN_FILES.quiz.extract({ bogus: 'x' }, prev)).toBeNull();
    expect(DOMAIN_FILES.review.extract('x', prev)).toBeNull();
  });
});

describe('snapshotDomains（首次快照）', () => {
  it('只记录已有状态，不产出观察；返回存在的域；memo/news/pomodoro 已移出感知', async () => {
    const prev = new Map<string, string>();
    const found = await snapshotDomains(async (path: string) => {
      if (path.includes('quiz')) return [{ lastCorrect: 1 }];
      if (path.includes('favorites')) return [{}, {}];
      throw new Error('no file');
    }, prev);
    expect(found).toEqual(expect.arrayContaining(['quiz', 'favorites']));
    expect(found).not.toContain('memo');
    expect(found).not.toContain('news');
    expect(found).not.toContain('pomodoro');
    // 首次快照不产出 → quiz 状态已被记录
    expect(prev.has('quizDone')).toBe(true);
  });
});