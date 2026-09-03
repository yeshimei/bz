/**
 * 复习历史时间线（stats-ui）回归测试：
 *  - P1：时间线 R 值二次放大（app.ts 落盘 R 已是 0-100，渲染再 ×100 → 「R=8500%」）
 *  - 老数据 0-1 小数兼容
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { showTimeline, closeTimeline } from '../../src/review/stats-ui';
import type { ReviewItem } from '../../src/review/data';

function mkItem(history: any[]): ReviewItem {
  return {
    id: '1',
    filePath: 'A.md',
    name: 'A',
    reviewStart: new Date().toISOString(),
    stage: 10,
    phase: 'fsrs',
    stability: 5,
    difficulty: 0.3,
    reviewHistory: history,
    totalReviews: history.length,
    averageConfidence: 0,
    nextReviewDate: null,
    lastReviewed: null,
    lastDifficulty: null,
    completed: false,
  } as ReviewItem;
}

describe('复习历史时间线 R 值渲染', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    closeTimeline();
  });

  it('R 已是 0-100 落盘值 → 直接展示，不再二次放大（回归）', () => {
    showTimeline(null as any, null as any, mkItem([
      { timestamp: new Date().toISOString(), stage: 10, rating: 'good', stability: 5, R: 85 },
    ]));
    const body = document.getElementById('review-history-body')!;
    expect(body.textContent).toContain('R=85%');
    expect(body.textContent).not.toContain('8500');
    closeTimeline();
  });

  it('老数据 0-1 小数 R → 兼容放大为百分比', () => {
    showTimeline(null as any, null as any, mkItem([
      { timestamp: new Date().toISOString(), stage: 10, rating: 'easy', stability: 5, R: 0.85 },
    ]));
    const body = document.getElementById('review-history-body')!;
    expect(body.textContent).toContain('R=85%');
    expect(body.textContent).not.toContain('R=1%'); // 未兼容时 0.85 会被取整成 1%
    closeTimeline();
  });
});
