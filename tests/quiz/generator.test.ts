// @vitest-environment node
/**
 * 做题家生成器测试（ticket 17 修正版）：逐字提示词/三难度/extractJSON/generate 校验
 */
import { describe, it, expect, vi } from 'vitest';
import { QuestionGenerator } from '../../src/quiz/generator';

function mkGen() {
  return new QuestionGenerator();
}

describe('buildPrompt', () => {
  it('单选：完整模板逐字', () => {
    const g = mkGen();
    const p = g.buildPrompt('内容内容', false, 5, 'random');
    expect(p).toContain('根据以下笔记内容，生成若干道四选一的选择题（每题一个正确答案），数量适中，以便复习。请仅返回一个合法的 JSON 对象');
    expect(p).toContain('"questions"');
    expect(p).toContain('注意：题目类型为 单选题（四选一），请生成恰好 5 道题目。');
    expect(p).toContain('"correctIndices": [0] }');
    expect(p).toContain('笔记内容：\n内容内容');
  });

  it('多选：typeHint/structure 变化', () => {
    const g = mkGen();
    const p = g.buildPrompt('x', true, 0, 'random');
    expect(p).toContain('可以是单选题或多选题（正确选项数量不限）');
    expect(p).toContain('生成若干道题目（数量适中，建议 3~6 道）。');
    expect(p).toContain('"correctIndices": [0, 2] }（数组内为正确选项的索引）');
  });

  it('三难度提示逐字', () => {
    const g = mkGen();
    expect(g.buildPrompt('x', false, 0, 'easy')).toContain('请生成基础概念题，选项区分度明显，避免陷阱，难度较低。');
    expect(g.buildPrompt('x', false, 0, 'medium')).toContain('生成中等难度题目，可包含细节辨析，选项有一定迷惑性。');
    expect(g.buildPrompt('x', false, 0, 'hard')).toContain('生成高难度题目，可涉及推理、多知识点交叉，选项具有较强迷惑性。');
    expect(g.buildPrompt('x', false, 0, 'random')).not.toContain('请生成基础');
  });
});

describe('buildBatchPrompt', () => {
  it('规则段 + 笔记ID 块', () => {
    const g = mkGen();
    const p = g.buildBatchPrompt([{ id: 'A.md', content: '内容' }], true, 3, 'easy');
    expect(p).toContain('根据以下多篇笔记内容，为每篇笔记生成选择题。请仅返回一个合法的 JSON 对象');
    expect(p).toContain('类型：可以是单选题或多选题，每篇生成恰好 3 道。');
    expect(p).toContain('生成基础概念题，难度较低。');
    expect(p).toContain('键名为笔记ID（即 "笔记ID:xxx" 中的 xxx），值为该笔记的题目数组');
    expect(p).toContain('===== 笔记ID:A.md =====\n内容');
  });
});

describe('extractJSON', () => {
  const valid = '{"questions":[{"question":"Q","options":["a","b","c","d"],"correctIndices":[0]}]}';
  it('code block / 纯 JSON / {..} 截取', () => {
    const g = mkGen();
    expect(g.extractJSON('```json\n' + valid + '\n```').questions.length).toBe(1);
    expect(g.extractJSON(valid).questions.length).toBe(1);
    expect(g.extractJSON('前缀文本' + valid + '后缀').questions.length).toBe(1);
  });

  it('无法提取 → 抛「无法从 AI 响应中提取有效的 JSON」', () => {
    const g = mkGen();
    expect(() => g.extractJSON('纯文本')).toThrow('无法从 AI 响应中提取有效的 JSON');
  });
});

describe('generate', () => {
  it('正常流程 + 校验错误文案逐字', async () => {
    const g = mkGen();
    const ai = { json: vi.fn().mockResolvedValue('{"questions":[{"question":"Q1","options":["a","b","c","d"],"correctIndices":[0]}]}') };
    const r = await g.generate('内容', ai as any, false, 1, 'random');
    expect(r).toHaveLength(1);
    expect(r[0].question).toBe('Q1');
  });

  it('校验错误文案逐字', async () => {
    const g = mkGen();
    const cases: [string, string][] = [
      ['{"foo":1}', 'AI 未返回有效题目数组。'],
      ['{"questions":[{"question":"Q","options":["a"],"correctIndices":[0]}]}', '题目格式不正确：缺少 question 或 options 不是长度为4的数组'],
      ['{"questions":[{"question":"Q","options":["a","b","c","d"],"correctIndices":[]}]}', '题目格式不正确：correctIndices 必须是非空数组'],
      ['{"questions":[{"question":"Q","options":["a","b","c","d"],"correctIndices":[9]}]}', 'correctIndices 元素必须在 0~3 之间'],
    ];
    for (const [raw, err] of cases) {
      const ai = { json: vi.fn().mockResolvedValue(raw) };
      await expect(g.generate('x', ai as any, false, 1, 'random')).rejects.toThrow(err);
    }
  });
});

describe('generateBatch', () => {
  it('返回 {noteId: valid[]} + 过滤非法', async () => {
    const g = mkGen();
    const raw = JSON.stringify({
      'A.md': [{ question: 'QA', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }],
      'B.md': [{ question: 'QB', options: ['a'], correctIndices: [0] }], // 非法
      'C.md': '不是数组',
    });
    const ai = { json: vi.fn().mockResolvedValue(raw) };
    const r = await g.generateBatch([{ id: 'A.md', content: 'x' }, { id: 'B.md', content: 'y' }], ai as any, false, 1, 'random');
    expect(r['A.md']).toHaveLength(1);
    expect(r['B.md']).toBeUndefined();
    // 提示词含规则
    expect(ai.json.mock.calls[0][0]).toContain('===== 笔记ID:A.md =====');
  });
});
