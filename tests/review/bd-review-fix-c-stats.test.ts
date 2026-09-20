/**
 * review 域「全域深审拍板后修复批」Wave1 · 统计弹窗回归（bd-review-fix-* 独立命名防撞）：
 *  - 呈报#55（R11）：统计弹窗按影院现行统计外观重刷（stat-card/sec + lucide 板块头/
 *    bar-row/soft-row/kv-inline/top-row 形制；数据驱动评级色仍内联；不抽公共组件）
 *  - 呈报#12-R7：统计「复习时间线」排名行键盘可达（role=button + tabindex + Enter/Space 打开历史）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showStatsModal, closeStatsModal, closeTimeline } from '../../src/review/stats-ui';
import type { ReviewDataManager, ReviewItem } from '../../src/review/data';

function mkItem(partial: any = {}): ReviewItem {
  const now = new Date();
  return {
    id: 'x', filePath: 'A.md', name: 'A',
    reviewStart: now.toISOString(), stage: 2, phase: 'ladder', stability: 1, difficulty: 0.3,
    reviewHistory: [], totalReviews: 0, averageConfidence: 0,
    nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null,
    completed: false,
    ...partial,
  } as ReviewItem;
}

/** 带复习历史的条目（时间线板块有排名行可断） */
function itemWithHistory(name: string, times: number): ReviewItem {
  const hist = Array.from({ length: times }, (_, i) => ({
    timestamp: new Date(Date.now() - i * 3600e3).toISOString(),
    stage: 2 + i,
    rating: 'good',
  }));
  return mkItem({ id: name, filePath: `${name}.md`, name, reviewHistory: hist, totalReviews: times });
}

async function openStats(items: ReviewItem[]): Promise<HTMLElement> {
  const dm = {
    loadItems: async () => items,
  } as unknown as ReviewDataManager;
  const { reviewApp } = await import('../../src/review/app');
  reviewApp._fitMeta = null;
  await showStatsModal({ vault: { getAbstractFileByPath: () => null } } as any, dm);
  return document.getElementById('review-stats-body')!;
}

beforeEach(() => {
  document.body.innerHTML = '';
  closeStatsModal();
});

afterEach(() => {
  closeStatsModal();
  vi.restoreAllMocks();
});

/** 轮询等待异步弹窗出现（showTimeline 内含动态 import，多微任务后才挂 DOM） */
async function waitPopup(id: string, timeoutMs = 500): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const el = document.getElementById(id);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 10));
  }
  return document.getElementById(id);
}

describe('呈报#55（R11）：统计弹窗重刷为影院现行形制', () => {
  it('统计卡改 stat-card（.v/.k）形制，旧彩色 .bz-stats-card 退役', async () => {
    const body = await openStats([itemWithHistory('A', 3)]);
    expect(body.querySelector('.stat-cards .stat-card .v')).not.toBeNull();
    expect(body.querySelector('.stat-cards .stat-card .k')).not.toBeNull();
    expect(body.querySelector('.bz-stats-card')).toBeNull();
    closeStatsModal();
  });

  it('板块改 sec + lucide 板块头（setIcon 兑现或占位在），旧 accent 色条退役', async () => {
    const body = await openStats([itemWithHistory('A', 3)]);
    const secs = body.querySelectorAll('.sec .sec-title');
    expect(secs.length).toBeGreaterThanOrEqual(4); // 评级分布/复习负载/时间线/最近 7 天
    // mock setIcon 兑现为 data-icon；未兑现环境退而存 data-lucide 占位
    expect(body.querySelector('.sec-title [data-icon], .sec-title [data-lucide]')).not.toBeNull();
    expect(body.querySelector('.bz-stats-section-accent')).toBeNull();
    closeStatsModal();
  });

  it('评级分布用 soft-row 软条（评级中文标签在 bar-label），负载/周量用 bar-row 水平条', async () => {
    const body = await openStats([itemWithHistory('A', 3)]);
    expect(body.querySelector('.soft-row .bar-label')?.textContent).toBe('忘了');
    expect(body.querySelectorAll('.soft-row').length).toBe(4); // 四档评级
    expect(body.querySelectorAll('.bar-row').length).toBeGreaterThan(0); // 负载 + 最近 7 天
    expect(body.querySelector('.bz-stats-chart')).toBeNull(); // 旧竖柱图退役
    closeStatsModal();
  });

  it('拟合档位/摘要改 kv-inline 形制（人话文案与 title 注解保留）', async () => {
    const body = await openStats([itemWithHistory('A', 3)]);
    expect(body.querySelector('.kv-inline')).not.toBeNull();
    expect(body.textContent).toContain('记忆曲线：默认参数，复习积累后自动拟合');
    expect(body.querySelector('.bz-stats-inline-chip')).toBeNull();
    closeStatsModal();
  });
});

describe('呈报#12-R7：时间线排名行键盘可达', () => {
  it('排名行 role=button + tabindex=0，Enter/Space 打开该篇复习历史', async () => {
    const body = await openStats([itemWithHistory('A', 3), itemWithHistory('B', 1)]);
    const rowEl = body.querySelector('[data-idx]') as HTMLElement;
    expect(rowEl).not.toBeNull();
    expect(rowEl.getAttribute('role')).toBe('button');
    expect(rowEl.getAttribute('tabindex')).toBe('0');

    rowEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(await waitPopup('review-history-popup')).not.toBeNull(); // 历史弹窗已开
    closeTimeline();

    // 空格同效
    const rowEl2 = body.querySelector('[data-idx]') as HTMLElement;
    rowEl2.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(await waitPopup('review-history-popup')).not.toBeNull();
    closeTimeline();
    closeStatsModal();
  });

  it('排名行点击路径保留（回归：data-idx 定位到最近复习的条目）', async () => {
    const body = await openStats([itemWithHistory('A', 3), itemWithHistory('B', 1)]);
    const rowEl = body.querySelector('[data-idx]') as HTMLElement;
    rowEl.click();
    const histBody = await waitPopup('review-history-body');
    // B 的最后评级时刻更新（1 条 = now；A 最后一条 = now-2h）→ 最近复习的 B 排首
    expect(histBody?.textContent).toContain('B');
    closeTimeline();
    closeStatsModal();
  });
});
