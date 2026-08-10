/**
 * 黑匣子纯函数测试（ticket 34）：词表/复盘阈值/对话历史裁剪。
 */
import { describe, it, expect } from 'vitest';
import { EMOTION_TAGS, MAX_EMOTIONS, MAX_INTENSITY, shouldAutoReview, trimChat, DEFAULT_PERSONA } from '../../src/blackbox/types';

describe('EMOTION_TAGS 词表（v1 定全，ADR-0013）', () => {
  it('24 词固定，无重复', () => {
    expect(EMOTION_TAGS.length).toBe(24);
    expect(new Set(EMOTION_TAGS).size).toBe(24);
  });

  it('包含核心情绪', () => {
    expect(EMOTION_TAGS).toContain('触动');
    expect(EMOTION_TAGS).toContain('想念');
    expect(EMOTION_TAGS).toContain('希望');
  });

  it('常量约束：最多 3 个情绪、强度 1-5', () => {
    expect(MAX_EMOTIONS).toBe(3);
    expect(MAX_INTENSITY).toBe(5);
  });
});

describe('DEFAULT_PERSONA 种子（方案 D：有诗心的思辨者）', () => {
  it('名字包仔 + 种子 + 语气示例', () => {
    expect(DEFAULT_PERSONA.name).toBe('包仔');
    expect(DEFAULT_PERSONA.seed).toContain('思辨');
    expect(DEFAULT_PERSONA.toneExample).toContain('茉莉花');
    expect(DEFAULT_PERSONA.selfViews).toEqual([]);
  });
});

describe('shouldAutoReview 复盘阈值', () => {
  it('恰好阈值整数倍触发', () => {
    expect(shouldAutoReview(10, 10)).toBe(true);
    expect(shouldAutoReview(20, 10)).toBe(true);
    expect(shouldAutoReview(1, 1)).toBe(true);
  });

  it('未达阈值/0 条/非法阈值不触发', () => {
    expect(shouldAutoReview(9, 10)).toBe(false);
    expect(shouldAutoReview(0, 10)).toBe(false);
    expect(shouldAutoReview(11, 10)).toBe(false);
    expect(shouldAutoReview(10, 0)).toBe(false);
  });
});

describe('trimChat 对话历史滚动淘汰', () => {
  const msg = (role: 'user' | 'assistant', text: string) => ({ role, text, ts: '2026-01-01T00:00:00.000Z' });

  it('超限保留最近 max 条', () => {
    const chat = [msg('user', 'a'), msg('assistant', 'b'), msg('user', 'c'), msg('assistant', 'd')];
    expect(trimChat(chat, 2).map((m) => m.text)).toEqual(['c', 'd']);
  });

  it('未超限原样保留', () => {
    const chat = [msg('user', 'a')];
    expect(trimChat(chat, 20)).toEqual(chat);
  });

  it('非法输入回退空数组；max<=0 用默认 20', () => {
    expect(trimChat(null as any, 5)).toEqual([]);
    const long = Array.from({ length: 25 }, (_, i) => msg('user', `m${i}`));
    expect(trimChat(long, 0).length).toBe(20);
  });
});
