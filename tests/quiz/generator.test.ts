/**
 * 做题家生成器测试（ticket 17）：buildPrompt/extractJSON/generate 校验/generateBatch
 */
import { describe, it, expect, vi } from 'vitest';
import { QuestionGenerator } from '../../src/quiz/generator';

function mkGen(ai: any = null) {
  const g = new QuestionGenerator(ai as any);
  return g;
}

describe('buildPrompt', () => {
  it('单选：类型提示 + 恰好 N 道', () => {
    const g = mkGen();
    const p = g.buildPrompt('A.md', '内容'.repeat(100), 'random', 5);
    expect(p).toContain('单选题（四选一）');
    expect(p).toContain('请生成恰好 5 道题目。');
    expect(p).toContain('"correctIndices":[0]');
    expect(p).toContain('内容'.repeat(100).slice(0, 3000));
  });

  it('多选：数量适中 + [0,2]', () => {
    const g = mkGen();
    const p = g.buildPrompt('A.md', 'x', 'random', null);
    expect(p).toContain('可以是单选题或多选题（正确选项数量不限）');
    expect(p).toContain('生成若干道题目（数量适中，建议 3~6 道）。');
    expect(p).toContain('"correctIndices":[0,2]');
  });

  it('三难度提示逐字', () => {
    const g = mkGen();
    expect(g.buildPrompt('A.md', 'x', 'easy', null)).toContain('请生成基础概念题，选项区分度明显，避免陷阱，难度较低。');
    expect(g.buildPrompt('A.md', 'x', 'medium', null)).toContain('生成中等难度题目，可包含细节辨析，选项有一定迷惑性。');
    expect(g.buildPrompt('A.md', 'x', 'hard', null)).toContain('生成高难度题目，可涉及推理、多知识点交叉，选项具有较强迷惑性。');
    expect(g.buildPrompt('A.md', 'x', 'random', null)).not.toContain('难度');
  });
});

describe('extractJSON', () => {
  const valid = '{"question":"Q","options":["a","b","c","d"],"correctIndices":[0]}';
  it('纯 JSON / code block / 前后杂文', () => {
    const g = mkGen();
    expect(g.extractJSON(valid).question).toBe('Q');
    expect(g.extractJSON('```json\n' + valid + '\n```').question).toBe('Q');
    expect(g.extractJSON('好的，这是结果：' + valid + '（完毕）').question).toBe('Q');
  });

  it('无 JSON → 抛「无法从 AI 响应中提取有效的 JSON」', () => {
    const g = mkGen();
    expect(() => g.extractJSON('纯文本')).toThrow('无法从 AI 响应中提取有效的 JSON');
  });
});

describe('generate', () => {
  it('AI 返回数组 → 校验通过', async () => {
    const ai = { json: vi.fn().mockResolvedValue('{"questions":[{"question":"Q1","options":["a","b","c","d"],"correctIndices":[0]}]}') };
    const g = mkGen(ai);
    const r = await g.generate('A.md', '内容', 'random', 1);
    expect(r).toHaveLength(1);
    expect(r[0].question).toBe('Q1');
  });

  it('校验错误文案逐字', async () => {
    const cases: [string, string][] = [
      ['{"foo":1}', 'AI 未返回有效题目数组。'],
      ['[{"question":"Q1","options":["a","b","c","d"],"correctIndices":[0]}]', 'AI 未返回有效题目数组。'], // 源码语义：extractJSON 只截对象
      ['{"questions":[{"question":"Q","options":["a"],"correctIndices":[0]}]}', '题目格式不正确：缺少 question 或 options 不是长度为4的数组'],
      ['{"questions":[{"question":"Q","options":["a","b","c","d"],"correctIndices":[]}]}', '题目格式不正确：correctIndices 必须是非空数组'],
      ['{"questions":[{"question":"Q","options":["a","b","c","d"],"correctIndices":[9]}]}', 'correctIndices 元素必须在 0~3 之间'],
    ];
    for (const [raw, err] of cases) {
      const ai = { json: vi.fn().mockResolvedValue(raw) };
      const g = mkGen(ai);
      await expect(g.generate('A.md', 'x', 'random', 1)).rejects.toThrow(err);
    }
  });
});

describe('generateBatch', () => {
  it('键名为笔记ID + 过滤非法题', async () => {
    const raw = JSON.stringify({
      'A.md': [{ question: 'QA', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }],
      'B.md': [{ question: 'QB', options: ['a'], correctIndices: [0] }], // 非法
      'C.md': '不是数组',
    });
    const ai = { json: vi.fn().mockResolvedValue(raw) };
    const g = mkGen(ai);
    const r = await g.generateBatch([{ id: 'A.md', content: 'x' }, { id: 'B.md', content: 'y' }]);
    expect(r['A.md']).toHaveLength(1);
    expect(r['B.md']).toBeUndefined();
    // 提示词含 笔记ID 标记
    expect(ai.json.mock.calls[0][0]).toContain('===== 笔记ID:A.md =====');
  });
});
