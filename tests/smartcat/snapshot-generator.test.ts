// @vitest-environment node
/**
 * 语义快照生成器测试（P2c，ticket 123）
 * 覆盖：shouldRegenerateSnapshot（hash 相同/小改/大改/边界）、LLM 生成 + 失败兜底、emotion 白名单回落、tags/summary/length 形状。
 */
import { describe, it, expect } from 'vitest';
import {
  computeDiffRatio,
  shouldRegenerateSnapshot,
  generateSnapshot,
  simpleHash,
} from '../../src/smartcat/snapshot-generator';

describe('computeDiffRatio', () => {
  it('两段相同文本 → 0', () => {
    const text = 'hello\nworld\nfoo';
    expect(computeDiffRatio(text, text)).toBe(0);
  });

  it('完全不同的文本 → 1', () => {
    expect(computeDiffRatio('aaa\nbbb', 'ccc\nddd')).toBe(1);
  });

  it('空文本 → 1', () => {
    expect(computeDiffRatio('', 'something')).toBe(1);
  });

  it('两个空 → 0', () => {
    expect(computeDiffRatio('', '')).toBe(0);
  });

  it('部分修改（5 行改 2 行）→ 0.4', () => {
    const old = 'a\nb\nc\nd\ne';
    const new_ = 'a\nb\nX\nd\nY';
    expect(computeDiffRatio(old, new_)).toBe(0.4);
  });

  it('新增行 → 比例计算基于旧文本长度', () => {
    const old = 'a\nb';
    const new_ = 'a\nb\nc\nd';
    // old 有 2 行，lcs=2, (2-2)/2 = 0
    expect(computeDiffRatio(old, new_)).toBe(0);
  });
});

describe('shouldRegenerateSnapshot', () => {
  const oldContent = '第一行\n第二行\n第三行\n第四行\n第五行';
  const oldHash = simpleHash(oldContent);

  it('无旧 hash（首次）→ true', () => {
    const newHash = simpleHash('新内容');
    expect(shouldRegenerateSnapshot(null, newHash, undefined, '新内容')).toBe(true);
  });

  it('hash 相同 → false', () => {
    expect(shouldRegenerateSnapshot(oldHash, oldHash, oldContent, oldContent)).toBe(false);
  });

  it('小改动（10% 变化 < 0.30 阈值）→ false', () => {
    // 10 行改 1 行 = 10% 变化
    const old = Array.from({ length: 10 }, (_, i) => `行${i}`).join('\n');
    const new_ = Array.from({ length: 10 }, (_, i) => (i === 0 ? '改' : `行${i}`)).join('\n');
    const newHash = simpleHash(new_);
    expect(shouldRegenerateSnapshot(simpleHash(old), newHash, old, new_)).toBe(false);
  });

  it('大改动（40% 变化 ≥ 0.30 阈值）→ true', () => {
    // 10 行改 4 行 = 40%
    const old = Array.from({ length: 10 }, (_, i) => `行${i}`).join('\n');
    const new_ = Array.from({ length: 10 }, (_, i) => (i < 4 ? `新${i}` : `行${i}`)).join('\n');
    const newHash = simpleHash(new_);
    expect(shouldRegenerateSnapshot(simpleHash(old), newHash, old, new_)).toBe(true);
  });

  it('恰好 30% 边界 → true', () => {
    // 10 行改 3 行 = 30%
    const old = Array.from({ length: 10 }, (_, i) => `行${i}`).join('\n');
    const new_ = Array.from({ length: 10 }, (_, i) => (i < 3 ? `新${i}` : `行${i}`)).join('\n');
    const newHash = simpleHash(new_);
    expect(shouldRegenerateSnapshot(simpleHash(old), newHash, old, new_)).toBe(true);
  });

  it('自定义阈值 0.50', () => {
    const old = Array.from({ length: 10 }, (_, i) => `行${i}`).join('\n');
    const new_ = Array.from({ length: 10 }, (_, i) => (i < 4 ? `新${i}` : `行${i}`)).join('\n');
    const newHash = simpleHash(new_);
    // 40% < 50% → false
    expect(shouldRegenerateSnapshot(simpleHash(old), newHash, old, new_, 0.50)).toBe(false);
  });

  it('无旧内容但有旧 hash → true（保守生成）', () => {
    const newHash = simpleHash('new');
    expect(shouldRegenerateSnapshot('oldhash', newHash, undefined, 'new')).toBe(true);
  });
});

describe('generateSnapshot', () => {
  it('无 aiFn → 非 AI 兜底', async () => {
    const result = await generateSnapshot('这是测试内容\n第二段落');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('tags');
    expect(result).toHaveProperty('length');
    expect(result.length).toBe('这是测试内容\n第二段落'.length);
    expect(result.emotion).toBe('calm');
    expect(typeof result.summary).toBe('string');
    expect(Array.isArray(result.tags)).toBe(true);
  });

  it('AI 成功 → 使用 AI 结果', async () => {
    const mockAiFn = async () => ({
      summary: '这是一段关于春天的诗歌',
      tags: ['春天', '诗歌', '自然'],
      emotion: 'happy',
    });
    const result = await generateSnapshot('春眠不觉晓\n处处闻啼鸟', { aiFn: mockAiFn });
    expect(result.summary).toBe('这是一段关于春天的诗歌');
    expect(result.tags).toEqual(['春天', '诗歌', '自然']);
    expect(result.emotion).toBe('happy');
    expect(result.time).toBeDefined();
    expect(result.length).toBe(11);
  });

  it('AI 返回 null → 非 AI 兜底', async () => {
    const mockAiFn = async () => null;
    const result = await generateSnapshot('内容', { aiFn: mockAiFn });
    expect(result.emotion).toBe('calm');
    expect(typeof result.summary).toBe('string');
  });

  it('AI 抛异常 → 非 AI 兜底', async () => {
    const mockAiFn = async () => { throw new Error('network error'); };
    const result = await generateSnapshot('异常测试内容', { aiFn: mockAiFn });
    expect(result.emotion).toBe('calm');
    expect(result.length).toBe('异常测试内容'.length);
  });

  it('emotion 白名单回落：非白名单值 → calm', async () => {
    const mockAiFn = async () => ({
      summary: '测试摘要',
      tags: ['测试'],
      emotion: 'not-a-real-emotion',
    });
    const result = await generateSnapshot('测试', { aiFn: mockAiFn });
    expect(result.emotion).toBe('calm');
  });

  it('emotion 白名单：合法值保留', async () => {
    const mockAiFn = async () => ({
      summary: '测试',
      tags: [],
      emotion: 'curious',
    });
    const result = await generateSnapshot('测试', { aiFn: mockAiFn });
    expect(result.emotion).toBe('curious');
  });

  it('AI 返回无 emotion → 默认 calm', async () => {
    const mockAiFn = async () => ({
      summary: '无情绪',
      tags: [],
    });
    const result = await generateSnapshot('测试', { aiFn: mockAiFn });
    expect(result.emotion).toBe('calm');
  });

  it('tags/summary/length 形状正确', async () => {
    const content = 'A'.repeat(500);
    const result = await generateSnapshot(content);
    expect(typeof result.summary).toBe('string');
    expect(Array.isArray(result.tags)).toBe(true);
    expect(typeof result.length).toBe('number');
    expect(result.length).toBe(500);
  });

  it('摘要长度受 maxSummaryLength 限制', async () => {
    const mockAiFn = async () => ({
      summary: 'A'.repeat(200),
      tags: [],
      emotion: 'calm',
    });
    const result = await generateSnapshot('test', { aiFn: mockAiFn, maxSummaryLength: 50 });
    // 截断到 50 字 + '…' = 51 字符
    expect(result.summary.length).toBeLessThanOrEqual(51);
    expect(result.summary).toContain('…');
  });

  it('兜底摘要取首段前 N 字', async () => {
    const longContent = 'A'.repeat(200) + '\n\n第二段';
    const result = await generateSnapshot(longContent, { maxSummaryLength: 50 });
    expect(result.summary.length).toBeLessThanOrEqual(51); // 50 + 可能的 '…'
    expect(result.summary).toContain('A');
  });

  it('空内容兜底', async () => {
    const result = await generateSnapshot('');
    expect(result.summary).toBe('(空内容)');
    expect(result.length).toBe(0);
    expect(result.emotion).toBe('calm');
  });

  it('AI 返回的 tags 超过 5 个 → 截断', async () => {
    const mockAiFn = async () => ({
      summary: '测试',
      tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      emotion: 'happy',
    });
    const result = await generateSnapshot('测试', { aiFn: mockAiFn });
    expect(result.tags.length).toBe(5);
  });
});

describe('simpleHash', () => {
  it('相同输入 → 相同 hash', () => {
    expect(simpleHash('hello')).toBe(simpleHash('hello'));
  });

  it('不同输入 → 不同 hash（大概率）', () => {
    expect(simpleHash('hello')).not.toBe(simpleHash('world'));
  });

  it('空字符串 → 确定值', () => {
    expect(simpleHash('')).toBe(simpleHash(''));
    expect(typeof simpleHash('')).toBe('string');
  });
});
