// @vitest-environment node
/**
 * 复习渲染纯层（render.ts）：G4 回归——列内排序 R 口径与卡片 R 展示同权重源。
 * 修复前 sortColumn 硬编码 DEFAULT_W、卡片 stageTagHtml 走 ctx.w（拟合权重），
 * 一旦 FSRS.R 引入 w 依赖（或换模型），排序与展示即漂移；现排序透传 ctx.w 同源。
 */
import { describe, it, expect } from 'vitest';
import { queueViewHtml, sortColumn, currentRPct } from '../../src/review/render';
import { DEFAULT_W } from '../../src/review/fsrs';
import type { ReviewItem } from '../../src/review/data';

function mkItem(partial: Partial<ReviewItem>): ReviewItem {
  const now = new Date();
  return {
    id: '',
    filePath: '',
    name: '',
    reviewStart: now.toISOString(),
    stage: 10,
    phase: 'fsrs',
    stability: 1,
    difficulty: 0.3,
    reviewHistory: [],
    totalReviews: 1,
    averageConfidence: 0,
    nextReviewDate: null,
    lastReviewed: null,
    lastDifficulty: null,
    completed: false,
    ...partial,
  } as ReviewItem;
}

describe('sortColumn 透传 ctx.w（G4 回归）', () => {
  it('拟合权重透传排序：R 升序与卡片 R 展示同源', () => {
    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 86400e3).toISOString();
    // 同 t：S 小 → R 低（排序应在前）；S 大 → R 高（在后）
    const a = mkItem({ id: 'a', filePath: 'a.md', stability: 1, lastReviewed: daysAgo(3) });
    const b = mkItem({ id: 'b', filePath: 'b.md', stability: 100, lastReviewed: daysAgo(3) });
    const fitted = DEFAULT_W.map((v) => Math.round(v * 1.3 * 100) / 100); // 拟合权重形态（≠默认）

    expect(currentRPct(a, fitted, now)!).toBeLessThan(currentRPct(b, fitted, now)!);
    // 排序透传 w：R 升序（a 在前）——与卡片 stageTagHtml(→currentRPct(w)) 展示同一权重源
    const sorted = sortColumn([b, a], now, fitted);
    expect(sorted.map((i) => i.filePath)).toEqual(['a.md', 'b.md']);
  });

  it('queueViewHtml 三区列：ctx.w 下卡片顺序与卡片 R 标签排序一致', () => {
    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 86400e3).toISOString();
    const mkOverdue = (id: string, stability: number): ReviewItem =>
      mkItem({ id, filePath: `${id}.md`, stability, lastReviewed: daysAgo(3), isOverdue: true });
    const fitted = DEFAULT_W.map((v) => Math.round(v * 1.3 * 100) / 100);
    // 低 R（S=1）在前：故意以高 R 在前入参，验证排序翻正
    const html = queueViewHtml([mkOverdue('hi', 100), mkOverdue('lo', 1)], { w: fitted, now, rThreshold: 0.9 });
    const colOverdue = html.slice(html.indexOf('bz-q-col danger'));
    const ids = [...colOverdue.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(['lo', 'hi']);
  });

  it('阶梯/无 R 条目排 FSRS 条目之后（999 兜底语义在透传 w 下保持）', () => {
    const now = Date.now();
    const ladder = mkItem({ id: 'l', filePath: 'l.md', phase: 'ladder', stage: 2 });
    const fsrsItem = mkItem({ id: 'f', filePath: 'f.md', phase: 'fsrs', stability: 1, lastReviewed: new Date(now - 86400e3).toISOString() });
    const fitted = DEFAULT_W.slice();
    expect(sortColumn([ladder, fsrsItem], now, fitted).map((i) => i.id)).toEqual(['f', 'l']);
  });
});
