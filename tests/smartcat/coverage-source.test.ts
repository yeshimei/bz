// @vitest-environment node
/**
 * ADR-0069 行为流全量盘点补齐——新观察文案构造层测试：
 * 日记分类调整（diary-source.buildDiaryTagsStructured）、复习计划/题库/入口页/附件搬移（coverage-source），
 * 及对应 behavior-wording 人类文案渲染。（剪藏删除 buildClippingDeletedStructured 已随功能断开移除，2026-08-29）
 */
import { describe, it, expect } from 'vitest';
import { buildDiaryTagsStructured } from '../../src/smartcat/diary-source';
import {
  buildReviewStructured, buildQuizAddedStructured, buildQuizAnsweredStructured,
  buildLauncherOpenedStructured, buildAttachMovedStructured,
} from '../../src/smartcat/coverage-source';
import { buildBehaviorWording, behaviorActionWord } from '../../src/smartcat/behavior-wording';
import type { BehaviorItem } from '../../src/smartcat/types';

function wordingOf(source: string, meta: NonNullable<BehaviorItem['metadata']>): string {
  const item: BehaviorItem = {
    id: 'beh_test',
    timestamp: new Date().toISOString(),
    type: meta.action,
    source,
    description: `${source}:${meta.action}${meta.name ? ` ${meta.name}` : ''}`,
    metadata: meta,
  };
  return buildBehaviorWording(item);
}

describe('buildDiaryTagsStructured（日记分类调整）', () => {
  it('正常载荷 → diary_entry:tagged，name=日期+时间，tags=新分类，extras 留 from/to', () => {
    const s = buildDiaryTagsStructured({ date: '2026-08-29', time: '09:30', from: ['日记'], to: ['工作', '灵感'] });
    expect(s).not.toBeNull();
    expect(s!.entityType).toBe('diary_entry');
    expect(s!.action).toBe('tagged');
    expect(s!.name).toBe('2026-08-29 09:30');
    expect(s!.tags).toEqual(['工作', '灵感']);
    expect(s!.extras).toEqual({ from: ['日记'], to: ['工作', '灵感'] });
  });

  it('缺 date/time → null 不产观察', () => {
    expect(buildDiaryTagsStructured({ date: '', time: '09:30', from: [], to: [] })).toBeNull();
    expect(buildDiaryTagsStructured({ date: '2026-08-29', time: '', from: [], to: [] })).toBeNull();
    expect(buildDiaryTagsStructured(null as any)).toBeNull();
  });

  it('from/to 非数组容忍为空数组', () => {
    const s = buildDiaryTagsStructured({ date: '2026-08-29', time: '09:30', from: undefined as any, to: 'x' as any });
    expect(s!.extras).toEqual({ from: [], to: [] });
  });

  it('行为流文案渲染：你调整了日记（…）的标签', () => {
    const s = buildDiaryTagsStructured({ date: '2026-08-29', time: '09:30', from: ['日记'], to: ['工作'] })!;
    expect(wordingOf('diary', s)).toBe('你调整了日记（2026-08-29 09:30）的标签');
  });
});

describe('coverage-source：复习计划/题库/入口页/附件搬移', () => {
  it('review:started 无条目名', () => {
    const s = buildReviewStructured('started');
    expect(s).toEqual({ entityType: 'review', action: 'started' });
    expect(wordingOf('review', s!)).toBe('你开始了复习');
  });

  it('review:added/removed 带条目名', () => {
    const added = buildReviewStructured('added', '三体');
    expect(added!.entityType).toBe('review');
    expect(added!.action).toBe('added');
    expect(added!.name).toBe('三体');
    expect(wordingOf('review', added!)).toBe('你把《三体》加入了复习计划');
    const removed = buildReviewStructured('removed', '三体');
    expect(wordingOf('review', removed!)).toBe('你把《三体》移出了复习计划');
  });

  it('review:rated 带评分档位（四档文案）', () => {
    for (const [rating, suffix] of [['again', '（忘了）'], ['hard', '（困难）'], ['good', '（一般）'], ['easy', '（简单）']] as const) {
      const s = buildReviewStructured('rated', '三体', rating)!;
      expect(s.extras).toEqual({ rating });
      expect(wordingOf('review', s)).toBe(`你给《三体》完成了复习评分${suffix}`);
    }
  });

  it('review:added 空名 → null', () => {
    expect(buildReviewStructured('added', '  ')).toBeNull();
  });

  it('quiz:added / quiz:answered', () => {
    const added = buildQuizAddedStructured('勾股定理');
    expect(added).toEqual({ entityType: 'quiz', action: 'added', name: '勾股定理' });
    expect(wordingOf('quiz', added!)).toBe('你把「勾股定理」加入了题库');
    const right = buildQuizAnsweredStructured('勾股定理', true)!;
    expect(right.extras).toEqual({ correct: true });
    expect(wordingOf('quiz', right)).toBe('你回答了题目「勾股定理」，答对了');
    const wrong = buildQuizAnsweredStructured('勾股定理', false)!;
    expect(wordingOf('quiz', wrong)).toBe('你回答了题目「勾股定理」，答错了');
    const plain = buildQuizAnsweredStructured('勾股定理')!;
    expect(plain.extras).toBeUndefined();
    expect(wordingOf('quiz', plain)).toBe('你回答了题目「勾股定理」');
    expect(buildQuizAddedStructured('')).toBeNull();
  });

  it('launcher:opened', () => {
    const s = buildLauncherOpenedStructured();
    expect(s).toEqual({ entityType: 'launcher', action: 'opened' });
    expect(wordingOf('launcher', s)).toBe('你打开了入口页');
  });

  it('attach:moved 带计数/缺省两态', () => {
    const withCount = buildAttachMovedStructured(3);
    expect(withCount.count).toBe(3);
    expect(wordingOf('attach', withCount)).toBe('你搬移了当前笔记引用的 3 个附件');
    const plain = buildAttachMovedStructured();
    expect(plain.count).toBeUndefined();
    expect(wordingOf('attach', plain)).toBe('你搬移了当前笔记引用的附件');
  });
});

describe('ADR-0069 动作徽标词', () => {
  it('新增动作有中文徽标词', () => {
    expect(behaviorActionWord('tagged')).toBe('标签');
    expect(behaviorActionWord('opened')).toBe('打开');
    expect(behaviorActionWord('moved')).toBe('搬移');
    expect(behaviorActionWord('answered')).toBe('答题');
  });
});
