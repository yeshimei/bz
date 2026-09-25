// @vitest-environment node
/**
 * 互动画像聚合测试（issue 449）：computeInsights（会话切分 / 回复时延中位数 / 深夜占比 /
 * 沉默段截取 / 语义信号透传）+ buildStatsNote（中文素材段文案 / 缺省维度自动省略）。
 * 隐私口径：全部构造数据，不含真实聊天内容。（纯数据层，无 DOM）
 */
import { describe, it, expect } from 'vitest';
import {
  buildStatsNote,
  computeInsights,
  emptyInsightSignals,
  type InsightsSummary,
  type InsightSignals,
} from '../../src/people/insights';

const DAY = 24 * 3600 * 1000;
/** 本地时间造点：2026-01-05 13:00 起步 */
const T0 = new Date(2026, 0, 5, 13, 0, 0).getTime();
const m = (ts: number, isSender: boolean): { ts: number; isSender: boolean } => ({ ts, isSender });
const sig = (over: Partial<InsightSignals> = {}): InsightSignals => ({ ...emptyInsightSignals(), ...over });

describe('computeInsights 聚合口径', () => {
  it('空时间线：全零 / 空 silenceGaps / 空 voiceEmotion', () => {
    const i = computeInsights([], emptyInsightSignals());
    expect(i).toEqual({
      sessionStartedByMe: 0,
      sessionStartedByOther: 0,
      myReplyMedianSec: 0,
      otherReplyMedianSec: 0,
      nightSharePct: 0,
      callCount: 0,
      callTotalSec: 0,
      callMissedCount: 0,
      recantByMe: 0,
      recantByOther: 0,
      voiceEmotion: {},
      silenceGaps: [],
      shareCount: 0,
      emojiCount: 0,
      emojiNamedCount: 0,
    });
  });

  it('会话切分沿用 30 分钟：首条开启会话者计数；回复中位数双向统计（首条不计）', () => {
    const i = computeInsights(
      [
        m(T0, false),              // 对方开首个会话
        m(T0 + 60_000, true),      // 我 60 秒样本
        m(T0 + 120_000, false),    // 对方 60 秒样本
        m(T0 + 32 * 60_000, true), // 距上一条 30 分钟 → 新会话我开（首条不计样本）
        m(T0 + 32 * 60_000 + 30_000, false), // 对方 30 秒样本
      ],
      emptyInsightSignals()
    );
    expect(i.sessionStartedByMe).toBe(1);
    expect(i.sessionStartedByOther).toBe(1);
    expect(i.myReplyMedianSec).toBe(60);
    expect(i.otherReplyMedianSec).toBe(45); // (60 + 30) / 2 偶数取均值
  });

  it('nightSharePct：本地 0-5 点占比，一位小数', () => {
    const night = (h: number): number => new Date(2026, 0, 6, h, 0, 0).getTime();
    const i = computeInsights([m(night(1), false), m(night(3), true), m(T0, false)], emptyInsightSignals());
    expect(i.nightSharePct).toBe(66.7); // 2/3
    expect(computeInsights([m(T0, false)], emptyInsightSignals()).nightSharePct).toBe(0);
  });

  it('silenceGaps：≥14 天才记、days 按日历差与 from/to 自洽；输出按时间升序', () => {
    const i = computeInsights(
      [
        m(T0, false),
        m(T0 + 14 * DAY + 12 * 3600 * 1000, true), // 14.5 天 → 记，days 按日历差 15
        m(T0 + 14 * DAY + 12 * 3600 * 1000 + 13 * DAY, false), // 13 天 → 不记
        m(T0 + 14 * DAY + 12 * 3600 * 1000 + 13 * DAY + 20 * DAY, true), // 20 天 → 记
      ],
      emptyInsightSignals()
    );
    expect(i.silenceGaps).toEqual([
      { from: '2026-01-05', to: '2026-01-20', days: 15 },
      { from: '2026-02-02', to: '2026-02-22', days: 20 },
    ]);
  });

  it('silenceGaps 超限取最长前 12 段', () => {
    const msgs = Array.from({ length: 14 }, (_, k) => m(T0 + k * 15 * DAY, k % 2 === 0)); // 13 段全部 15 天
    const i = computeInsights(msgs, emptyInsightSignals());
    expect(i.silenceGaps).toHaveLength(12);
    expect(i.silenceGaps.every((g) => g.days === 15)).toBe(true);
  });

  it('语义信号透传：分享 / 表情 / 通话 / 撤回 / 语音情感原样落位', () => {
    const i = computeInsights(
      [m(T0, false)],
      sig({
        shareCount: 4,
        emojiCount: 6,
        emojiNamedCount: 2,
        callCount: 3,
        callTotalSec: 4102,
        callMissedCount: 1,
        recantByMe: 1,
        recantByOther: 2,
        voiceEmotion: { 平静: 5, 开心: 2 },
      })
    );
    expect(i.shareCount).toBe(4);
    expect(i.emojiCount).toBe(6);
    expect(i.emojiNamedCount).toBe(2);
    expect(i.callCount).toBe(3);
    expect(i.callTotalSec).toBe(4102);
    expect(i.callMissedCount).toBe(1);
    expect(i.recantByMe).toBe(1);
    expect(i.recantByOther).toBe(2);
    expect(i.voiceEmotion).toEqual({ 平静: 5, 开心: 2 });
  });
});

describe('buildStatsNote 素材段文案', () => {
  const full: InsightsSummary = {
    sessionStartedByMe: 3,
    sessionStartedByOther: 2,
    myReplyMedianSec: 45,
    otherReplyMedianSec: 120,
    nightSharePct: 12.3,
    callCount: 2,
    callTotalSec: 3723,
    callMissedCount: 1,
    recantByMe: 1,
    recantByOther: 2,
    voiceEmotion: { 平静: 5, 开心: 2 },
    silenceGaps: [{ from: '2025-01-02', to: '2025-03-01', days: 58 }],
    shareCount: 4,
    emojiCount: 6,
    emojiNamedCount: 2,
  };

  it('全维度：一段中文自然句，句号收尾', () => {
    const note = buildStatsNote(full);
    expect(note).toContain('互动画像：');
    expect(note).toContain('会话我发起 3 次、对方发起 2 次');
    expect(note).toContain('回复时延我中位 45 秒、对方中位 2 分钟');
    expect(note).toContain('深夜（0-6 点）消息占 12.3%');
    expect(note).toContain('通话 2 次（累计 1 小时），其中未接通 1 次');
    expect(note).toContain('我撤回 1 条、对方撤回 2 条');
    expect(note).toContain('语音情感 平静 5、开心 2');
    expect(note).toContain('分享链接 4 条，表情包 6 个（其中 2 个带名称）');
    expect(note).toContain('最长的沉默 2025-01-02 至 2025-03-01（58 天）');
    expect(note.endsWith('。')).toBe(true);
  });

  it('全空：返回空串（prompt 不加废话段）', () => {
    expect(buildStatsNote(computeInsights([], emptyInsightSignals()))).toBe('');
  });

  it('缺省维度自动省略：只有通话样本时不写会话 / 时延 / 深夜 / 撤回 / 情感 / 表情 / 沉默', () => {
    const note = buildStatsNote(computeInsights([], sig({ callCount: 2, callTotalSec: 90, callMissedCount: 1 })));
    expect(note).toContain('通话 2 次（累计 2 分钟），其中未接通 1 次');
    expect(note).not.toContain('会话');
    expect(note).not.toContain('回复时延');
    expect(note).not.toContain('深夜');
    expect(note).not.toContain('撤回');
    expect(note).not.toContain('语音情感');
    expect(note).not.toContain('表情');
    expect(note).not.toContain('沉默');
  });

  it('单侧样本只写一侧：撤回只有对方时不提我', () => {
    const note = buildStatsNote(computeInsights([], sig({ recantByOther: 2 })));
    expect(note).toContain('对方撤回 2 条');
    expect(note).not.toContain('我撤回');
  });
});
