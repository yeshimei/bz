/**
 * 复习历史时间线（stats-ui）回归测试：
 *  - P1：时间线 R 值二次放大（app.ts 落盘 R 已是 0-100，渲染再 ×100 → 「R=8500%」）
 *  - 老数据 0-1 小数兼容
 *  - item 12：当前 R 与调度同口径（currentW 路径）
 *  - item 14：关闭钮 lucide、无开发文案
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { showTimeline, showStatsModal, closeTimeline, closeStatsModal } from '../../src/review/stats-ui';
import type { ReviewDataManager } from '../../src/review/data';
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

  it('R 已是 0-100 落盘值 → 直接展示，不再二次放大（回归）', async () => {
    await showTimeline(null as any, null as any, mkItem([
      { timestamp: new Date().toISOString(), stage: 10, rating: 'good', stability: 5, R: 85 },
    ]));
    const body = document.getElementById('review-history-body')!;
    expect(body.textContent).toContain('R=85%');
    expect(body.textContent).not.toContain('8500');
    closeTimeline();
  });

  it('老数据 0-1 小数 R → 兼容放大为百分比', async () => {
    await showTimeline(null as any, null as any, mkItem([
      { timestamp: new Date().toISOString(), stage: 10, rating: 'easy', stability: 5, R: 0.85 },
    ]));
    const body = document.getElementById('review-history-body')!;
    expect(body.textContent).toContain('R=85%');
    expect(body.textContent).not.toContain('R=1%'); // 未兼容时 0.85 会被取整成 1%
    closeTimeline();
  });

  it('item 12：当前 R 与调度同口径——展示值 = reviewApp.currentR（同一 FSRS.R + currentW 调用路径）', async () => {
    const { reviewApp } = await import('../../src/review/app');
    const item = mkItem([]);
    item.lastReviewed = new Date(Date.now() - 3 * 86400e3).toISOString();
    // 默认权重基准
    reviewApp._fittedW = null;
    await showTimeline(null as any, null as any, item);
    const text = document.getElementById('review-history-body')!.textContent || '';
    closeTimeline();
    const shown = Number(text.match(/当前 R (\d+)%/)?.[1]);
    // 展示口径 = 调度层同一入口（currentR 内部 new FSRS(currentW()).R）——数值逐位一致
    const expected = reviewApp.currentR(item);
    expect(expected).not.toBeNull();
    expect(shown).toBe(Math.round((expected as number) * 100));
    // 挂上拟合权重后同路径贯通不炸、口径仍逐位一致（R 幂律指数 d 为独立参数，数值不随 w 变）
    const { DEFAULT_W } = await import('../../src/review/fsrs');
    const w2 = [...DEFAULT_W];
    w2[7] = 5;
    reviewApp._fittedW = w2;
    await showTimeline(null as any, null as any, item);
    const text2 = document.getElementById('review-history-body')!.textContent || '';
    closeTimeline();
    reviewApp._fittedW = null;
    expect(Number(text2.match(/当前 R (\d+)%/)?.[1])).toBe(Math.round((expected as number) * 100));
  });
});

describe('统计弹窗（item 14：lucide 关闭钮 + 无开发文案）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    closeStatsModal();
  });

  it('关闭钮为 lucide 图标（不再 ❌）；底部无「对齐影视统计界面」开发文案', async () => {
    const { reviewApp } = await import('../../src/review/app');
    reviewApp.dataManager = null;
    const dm = {
      loadItems: async () => [] as ReviewItem[],
    } as unknown as ReviewDataManager;
    await showStatsModal({ vault: { getAbstractFileByPath: () => null } } as any, dm);
    const close = document.getElementById('review-stats-close')!;
    expect(close).not.toBeNull();
    expect(close.textContent).not.toContain('❌'); // emoji 关闭钮废除
    expect(close.querySelector('.bz-ic')!.getAttribute('data-icon')).toBe('x'); // lucide
    const body = document.getElementById('review-stats-body')!;
    expect(body.textContent).not.toContain('对齐影视统计界面'); // 开发文案删除
    closeStatsModal();
  });

  it('复习历史弹窗关闭钮为 lucide（不再 ❌）', async () => {
    await showTimeline(null as any, null as any, mkItem([
      { timestamp: new Date().toISOString(), stage: 10, rating: 'good', stability: 5, R: 85 },
    ]));
    const close = document.getElementById('review-history-close')!;
    expect(close.textContent).not.toContain('❌');
    expect(close.querySelector('.bz-ic')!.getAttribute('data-icon')).toBe('x');
    closeTimeline();
  });
});
