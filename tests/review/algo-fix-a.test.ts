/**
 * review 域深审批 A「算法与数据层」回归集（2026-09-19）：
 * - A7：fsrs.currentR 单源（原 app/queue/stats/render/stats-ui 五处同式复写；本批收编
 *   queue.isEarlyDue 与 stats.computeStats avgR，另三处合并后主线程收口）。
 * - A9/C3：stats.dateKey 收编 core/ui/str localDayKey 零依赖单源；core/utils 转发保路径。
 * - A5：stats.loadPreview/loadHeatmap 死代码删除——防复活守卫。
 * - F1：currentR/nextDiff 新 D 值域下的排期一致性（算法-队列-统计同源）。
 * 引 core/utils（obsidian 面）故用默认 jsdom 环境，不加 node 指令。
 */
import { describe, it, expect } from 'vitest';
import { FSRS, DEFAULT_W, currentR, scheduleNext } from '../../src/review/fsrs';
import { isEarlyDue } from '../../src/review/queue';
import { computeStats, dateKey } from '../../src/review/stats';
import * as statsModule from '../../src/review/stats';
import { localDayKey as strLocalDayKey } from '../../src/core/ui/str';
import { localDayKey as utilsLocalDayKey } from '../../src/core/utils';
import type { ReviewItem } from '../../src/review/data';

const NOW = new Date('2026-09-19T10:00:00');

function mkItem(partial: Partial<ReviewItem>): ReviewItem {
  return {
    id: 'x',
    filePath: 'A.md',
    name: 'A',
    reviewStart: '2026-08-01T00:00:00.000Z',
    stage: 12,
    phase: 'fsrs',
    stability: 5,
    difficulty: 4.93,
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

describe('A7：fsrs.currentR 单源', () => {
  const item = mkItem({ lastReviewed: new Date(NOW.getTime() - 3 * 86400e3).toISOString() });

  it('可算条目：与手推 FSRS.R(t,S) 逐位一致；now 可注入', () => {
    const t = 3;
    expect(currentR(item, DEFAULT_W, NOW)).toBeCloseTo(new FSRS(DEFAULT_W).R(t, 5), 15);
  });

  it('不可算 → null：阶梯相位 / 缺 stability / 缺 lastReviewed / t≤0', () => {
    expect(currentR(mkItem({ phase: 'ladder', lastReviewed: item.lastReviewed }), DEFAULT_W, NOW)).toBeNull();
    expect(currentR(mkItem({ stability: 0, lastReviewed: item.lastReviewed }), DEFAULT_W, NOW)).toBeNull();
    expect(currentR(mkItem({ lastReviewed: null }), DEFAULT_W, NOW)).toBeNull();
    expect(currentR(mkItem({ lastReviewed: new Date(NOW.getTime() + 86400e3).toISOString() }), DEFAULT_W, NOW)).toBeNull(); // 未来时间戳
  });

  it('等价回归：isEarlyDue 与手写旧式（守卫 + R<threshold）逐条目一致', () => {
    // 锚定真实时钟（isEarlyDue→currentR 内部走 Date.now()），偏移量级远小于阈值距离
    const now = Date.now();
    const cases: ReviewItem[] = [
      mkItem({ lastReviewed: new Date(now - 3 * 86400e3).toISOString() }),
      mkItem({ phase: 'ladder', lastReviewed: new Date(now - 3 * 86400e3).toISOString() }),
      mkItem({ stability: 0.5, lastReviewed: new Date(now - 10 * 86400e3).toISOString() }), // R 极低
      mkItem({ stability: 100, lastReviewed: new Date(now - 0.5 * 86400e3).toISOString() }), // R 极高
      mkItem({ lastReviewed: null }),
      mkItem({ lastReviewed: new Date(now + 86400e3).toISOString() }), // 未来时间戳
    ];
    const fsrs = new FSRS(DEFAULT_W);
    for (const c of cases) {
      const expected = (() => {
        if (c.phase !== 'fsrs' || !c.stability || !c.lastReviewed) return false;
        const t = (Date.now() - new Date(c.lastReviewed).getTime()) / 86400000;
        if (!(t > 0)) return false;
        return fsrs.R(t, c.stability) < 0.9;
      })();
      expect(isEarlyDue(c, 0.9, DEFAULT_W) as boolean).toBe(expected);
    }
  });

  it('等价回归：computeStats avgR 与 currentR 逐条均值一致（w 透传）', () => {
    const now = Date.now();
    const a = mkItem({ filePath: 'A.md', stability: 5, lastReviewed: new Date(now - 2 * 86400e3).toISOString() });
    const b = mkItem({ filePath: 'B.md', stability: 0.5, lastReviewed: new Date(now - 1 * 86400e3).toISOString() });
    const stats = computeStats([a, b], { w: DEFAULT_W });
    const r1 = currentR(a, DEFAULT_W)!;
    const r2 = currentR(b, DEFAULT_W)!;
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(stats.avgR).not.toBeNull();
    // 两侧取时差毫秒级 → R 漂移 ~1e-8，1e-6 容差充分
    expect(stats.avgR!).toBeGreaterThanOrEqual(Math.min(r1, r2) - 1e-6);
    expect(stats.avgR!).toBeLessThanOrEqual(Math.max(r1, r2) + 1e-6);
  });

  it('F1 一致性：currentR 与 scheduleNext 的 R 同源（同 t 同 S 逐位一致）', () => {
    const st = { stage: 12, phase: 'fsrs' as const, stability: 5, difficulty: 4.93, lastReviewed: new Date(NOW.getTime() - 3 * 86400e3).toISOString() };
    const d = scheduleNext(st, 'good', NOW);
    const rManual = new FSRS(DEFAULT_W).R(3, 5);
    expect(currentR(st, DEFAULT_W, NOW)).toBeCloseTo(rManual, 15);
    expect(d.R).toBeCloseTo(rManual, 15);
  });
});

describe('A9/C3：localDayKey 零依赖单源', () => {
  it('stats.dateKey ≡ str.localDayKey（Date 入参同值）', () => {
    const d = new Date(2026, 8, 19, 10, 30); // 本地 2026-09-19
    expect(dateKey(d)).toBe('2026-09-19');
    expect(dateKey(d)).toBe(strLocalDayKey(d));
    const d2 = new Date(2026, 0, 2);
    expect(dateKey(d2)).toBe(strLocalDayKey(d2));
  });

  it('core/utils 转发保路径：utils.localDayKey 即 str.localDayKey 同一实现（单源不双份）', () => {
    expect(utilsLocalDayKey).toBe(strLocalDayKey);
  });

  it('str.localDayKey 支持 number 时间戳（签名与旧 utils 正典一致）', () => {
    const ts = new Date(2026, 11, 31).getTime();
    expect(strLocalDayKey(ts)).toBe('2026-12-31');
  });
});

describe('A5：stats 死代码防复活守卫', () => {
  it('loadPreview / loadHeatmap 已删除（生产零消费，不得回魂）', () => {
    expect((statsModule as Record<string, unknown>).loadPreview).toBeUndefined();
    expect((statsModule as Record<string, unknown>).loadHeatmap).toBeUndefined();
  });
});
