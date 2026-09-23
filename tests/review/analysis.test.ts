// @vitest-environment node
/**
 * 记忆分析（review/analysis）测试：
 *  - 纯数据层 deriveAnalysis：真实数据形状派生（FSRS 相位/阶梯/逾期/完成/缺失/历史）、
 *    空数据与缺字段不崩（全 0/null 兜底）；
 *  - 契约：幕表 ≥15 幕且 id 唯一、markup 每幕 data-id/data-name 齐全、固定件钩子在位、
 *    motions 每幕表演（out.set）与幕表一一对应（view ↔ motions 钩子全对齐）。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ReviewItem } from '../../src/review/data';
import { deriveAnalysis, RA_RATING_ORDER } from '../../src/review/analysis/data';
import { analysisHtml, RA_SCENES } from '../../src/review/analysis/view';

/** 固定「今天」，daily14/streak 断言确定性 */
const NOW = new Date('2026-09-22T10:00:00+08:00');

/** 造一条 FSRS 相位条目（stability/lastReviewed/nextReviewDate 齐全） */
function fsrsItem(over: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'r1', filePath: 'notes/a.md', name: 'a',
    reviewStart: '2026-08-01T10:00:00+08:00',
    stage: 9, phase: 'fsrs', stability: 30, difficulty: 4.2,
    reviewHistory: [
      { timestamp: '2026-09-20T10:00:00+08:00', rating: 'good', stage: 10, stability: 30, R: 60 },
    ],
    totalReviews: 1, averageConfidence: 0,
    // lastReviewed = 昨天上午 → ageDays ≈ 1，R 高
    lastReviewed: '2026-09-21T10:00:00+08:00',
    nextReviewDate: '2026-09-30T10:00:00+08:00',
    lastDifficulty: 'good', completed: false,
    isOverdue: false, ...over,
  } as ReviewItem;
}

/** 造一条阶梯相位条目（stage 0-8，无记忆参数） */
function ladderItem(stage: number, over: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: `l${stage}`, filePath: `notes/l${stage}.md`, name: `l${stage}`,
    reviewStart: '2026-09-01T10:00:00+08:00',
    stage, phase: 'ladder', stability: 1, difficulty: 0.3,
    reviewHistory: [], totalReviews: 0, averageConfidence: 0,
    nextReviewDate: '2026-09-25T10:00:00+08:00',
    lastReviewed: null, lastDifficulty: null, completed: false,
    ...over,
  } as ReviewItem;
}

describe('deriveAnalysis 纯数据层', () => {
  it('空数组：全 0/null 兜底，不崩', () => {
    const d = deriveAnalysis([], { now: NOW });
    expect(d.total).toBe(0);
    expect(d.active).toBe(0);
    expect(d.avgR).toBeNull();
    expect(d.stagePeak).toBe(-1);
    expect(d.overdueList).toEqual([]);
    expect(d.streak).toBe(0);
    expect(d.firstReviewAt).toBeNull();
    expect(d.againRate).toBeNull();
    expect(d.rHist).toHaveLength(10);
    expect(d.stageDist).toHaveLength(10);
    expect(d.daily14).toHaveLength(14);
    expect(d.next8).toHaveLength(8);
    expect(d.sBuckets).toHaveLength(4);
    expect(d.dBuckets).toHaveLength(4);
  });

  it('缺字段条目（仅 filePath）：不崩、按阶梯兜底', () => {
    const d = deriveAnalysis([{ filePath: 'x.md', name: 'x', stage: 2, phase: 'ladder' } as unknown as ReviewItem], { now: NOW });
    expect(d.total).toBe(1);
    expect(d.active).toBe(1);
    expect(d.ladderN).toBe(1);
    expect(d.embers[0].r).toBeNull();
  });

  it('真实形状：FSRS/阶梯/逾期/完成/缺失 全量派生', () => {
    const items = [
      fsrsItem(), // FSRS 在炉：S=30、R 高
      fsrsItem({ id: 'r2', filePath: 'notes/b.md', name: 'b', stability: 120, isOverdue: true, nextReviewDate: '2026-09-15T10:00:00+08:00' }),
      ladderItem(3), // 阶梯第 4 阶
      fsrsItem({ id: 'r3', filePath: 'notes/c.md', name: 'c', completed: true }), // 完成
      ladderItem(1, { id: 'r4', filePath: 'notes/d.md', name: 'd', isMissing: true }), // 挂起
      ladderItem(5, { id: 'r5', filePath: 'notes/e.md', name: 'e', pendingRedo: true }), // 待重做
    ];
    const d = deriveAnalysis(items, { now: NOW });
    expect(d.total).toBe(6);
    expect(d.active).toBe(4);
    expect(d.doneN).toBe(1);
    expect(d.missingN).toBe(1);
    expect(d.fsrsN).toBe(2);
    expect(d.ladderN).toBe(2);
    // 阶段分布：FSRS 一篇进第 9 桶；阶梯 stage3/5 各一桶
    expect(d.stageDist[9]).toBe(2);
    expect(d.stageDist[3]).toBe(1);
    expect(d.stageDist[5]).toBe(1);
    expect(d.stagePeak).toBe(9);
    // 逾期专页：只有 b（拖 7 天）
    expect(d.overdueList).toHaveLength(1);
    expect(d.overdueList[0]).toMatchObject({ name: 'b', days: 7 });
    expect(d.overdueN).toBe(1);
    // 留存率：两条 FSRS 可算（b 逾期多日 R 更低），均值落在 (0,1)
    expect(d.avgR).not.toBeNull();
    expect(d.avgR!).toBeGreaterThan(0);
    expect(d.avgR!).toBeLessThanOrEqual(1);
    expect(d.rHist.reduce((a, b) => a + b, 0)).toBe(2);
    // 基岩榜：S 降序，b(120) 在 a(30) 前
    expect(d.bedrock.map((x) => x.name)).toEqual(['b', 'a']);
    // 稳定性分层：<7=0、7-30=0、30-90=1（a S=30）、≥90=1（b S=120）
    expect(d.sBuckets.map((x) => x.n)).toEqual([0, 0, 1, 1]);
    // 来潮：a 的 next = 09-30（8 天窗外）、ladder 的 next = 09-25（+3）
    expect(d.next8[3].count).toBeGreaterThanOrEqual(1);
    // 批改：三条 FSRS 夹具各带一条 good 历史
    expect(d.verdictTotal).toBe(3);
    expect(d.ratingDist.good).toBe(3);
    expect(d.againRate).toBe(0);
    // 待重做
    expect(d.redoN).toBe(1);
    // 添柴志：历史都落在 09-20（14 天窗内倒数第 3 天）
    const hit = d.daily14.find((x) => x.date === '2026-09-20');
    expect(hit?.count).toBe(3);
    expect(d.dailyTotal).toBe(3);
    expect(d.distinctDays).toBe(1);
  });

  it('评级分布按四档键序出幕', () => {
    expect(RA_RATING_ORDER).toEqual(['again', 'hard', 'good', 'easy']);
  });
});

describe('记忆分析契约（幕表/钩子/表演对齐）', () => {
  const html = analysisHtml(deriveAnalysis([], { now: NOW }));

  it('幕表 ≥15 幕、id 唯一', () => {
    expect(RA_SCENES.length).toBeGreaterThanOrEqual(15);
    const ids = RA_SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of RA_SCENES) expect(s.name.length).toBeGreaterThan(0);
  });

  it('markup：每幕 data-id/data-name 齐全，canvas 画布 aria-hidden', () => {
    for (const s of RA_SCENES) {
      expect(html).toContain(`data-id="${s.id}"`);
    }
    expect(html.match(/data-name=/g)?.length).toBe(RA_SCENES.length);
    // 画布：注入件 aria-hidden、不吃指针（CSS 统一 pointer-events 场景由容器保证）
    expect(html).not.toMatch(/<canvas(?![^>]*aria-hidden)/);
  });

  it('固定件钩子齐全（隔扇/灯谱；更漏底栏 2026-09-23 拍板撤去，不再断言）', () => {
    for (const hook of ['shutter', 'rail']) {
      expect(html).toContain(`data-r="${hook}"`);
    }
    expect(html.match(/class="ra-lamp"/g)?.length).toBe(RA_SCENES.length);
  });

  it('motions 每幕表演（out.set）与幕表一一对应', () => {
    const src = readFileSync(new URL('../../src/review/analysis/motions.ts', import.meta.url), 'utf8');
    const setIds = [...src.matchAll(/out\.set\('([\w-]+)'/g)].map((m) => m[1]);
    expect(new Set(setIds)).toEqual(new Set(RA_SCENES.map((s) => s.id)));
  });
});
