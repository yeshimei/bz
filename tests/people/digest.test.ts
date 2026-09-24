/**
 * 脸谱域提炼管线测试（issue 435）：切批双限与抽样、JSON 回执容错、
 * 假 ask 全流程（进度回调 / 合并去重 / 空输入与空画像报错）。（纯编排，无 DOM）
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildExtractPrompt,
  buildPortraitPrompt,
  buildFace,
  chunkMessages,
  extractJsonLoose,
  parseBatchExtract,
} from '../../src/people/digest';
import type { UnifiedMessage } from '../../src/people/types';

/** 本地时区 2024-05-01 12:00 起的第 n 分钟 */
function msg(minutes: number, isSender = false, text = '嗯'): UnifiedMessage {
  return { ts: Date.UTC(2024, 4, 1, 12, minutes), isSender, text };
}

describe('chunkMessages', () => {
  it('maxCount 切批；空文本滤除；from/to 取批内首末日期', () => {
    const messages = [msg(0, false, 'a'), msg(1, true, ''), msg(2, true, 'b'), msg(3, false, 'c')];
    const chunks = chunkMessages(messages, { maxCount: 2 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].lines).toHaveLength(2);
    expect(chunks[0].from).toBe(chunks[0].to); // 同一天的固定时间
    expect(chunks[0].count).toBe(2);
  });

  it('maxChars 切批：单行超限也成批（不丢消息）', () => {
    const messages = [msg(0, false, 'x'.repeat(50)), msg(1, false, 'y'.repeat(50))];
    const chunks = chunkMessages(messages, { maxChars: 30 });
    expect(chunks).toHaveLength(2);
  });

  it('批数超 maxBatches → 均匀抽样保首尾', () => {
    const messages = Array.from({ length: 12 }, (_, i) => msg(i, false, `m${i}`));
    const chunks = chunkMessages(messages, { maxCount: 1, maxBatches: 5 });
    expect(chunks.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(chunks[0])).toContain('m0');
    expect(JSON.stringify(chunks[chunks.length - 1])).toContain('m11');
  });
});

describe('extractJsonLoose / parseBatchExtract', () => {
  it('裸 JSON / json 围栏 / 前后杂文本都能截出', () => {
    expect(extractJsonLoose('{"events":[],"traits":[]}')).toEqual({ events: [], traits: [] });
    expect(extractJsonLoose('```json\n{"events":[],"traits":[]}\n```')).toEqual({ events: [], traits: [] });
    const noisy = extractJsonLoose('结果如下：{"events":[],"traits":[]}（完）') as Record<string, unknown>;
    expect(noisy.events).toEqual([]);
  });
  it('无 JSON / 括号不完整抛错', () => {
    expect(() => extractJsonLoose('没有任何结构')).toThrow();
    expect(() => extractJsonLoose('{"events": [')).toThrow();
  });
  it('parseBatchExtract：残缺事件剔除、traits 串化、非数组兜底', () => {
    const out = parseBatchExtract(
      '{"events":[{"ts":"2024-05-01","summary":"约饭"},{"ts":"","summary":"坏"},{"bad":1}],"traits":["话痨",3]}'
    );
    expect(out.events).toEqual([{ ts: '2024-05-01', summary: '约饭' }]);
    expect(out.traits).toEqual(['话痨', '3']);
    expect(parseBatchExtract('{"events":"不是数组"}').events).toEqual([]);
  });
});

describe('buildFace 全流程（假 ask）', () => {
  it('逐批提炼 → 进度回调 → 事件合并去重排序 → 画像生成', async () => {
    const messages = [msg(0, false, 'a'), msg(1, true, 'b'), msg(2, false, 'c'), msg(3, true, 'd')];
    const askExtract = vi.fn(async (prompt: string) =>
      prompt.includes('12:03')
        ? '{"events":[{"ts":"2024-05-02","summary":"聊项目"}],"traits":["细节控"]}'
        : '{"events":[{"ts":"2024-05-01","summary":"约饭"},{"ts":"2024-05-02","summary":"聊项目"}],"traits":["话痨"]}'
    );
    const askPortrait = vi.fn(async () => '## 画像速写\n**热情**开朗\n- 常聊吃饭');
    const onProgress = vi.fn();
    const face = await buildFace(askExtract, askPortrait, messages, '老王', onProgress, { maxCount: 2 });
    expect(askExtract).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
    expect(face.events).toEqual([
      { ts: '2024-05-01', summary: '约饭' },
      { ts: '2024-05-02', summary: '聊项目' },
    ]);
    expect(face.portrait).toContain('画像速写');
  });

  it('prompt 携带人名与对话行', async () => {
    const prompt = buildExtractPrompt({ from: '2024-05-01', to: '2024-05-02', count: 1, lines: ['[2024-05-01 12:00][我] 早'] }, '老王');
    expect(prompt).toContain('老王');
    expect(prompt).toContain('[我] 早');
    const portrait = buildPortraitPrompt('老王', [{ ts: '2024-05-01', summary: '约饭' }], ['话痨']);
    expect(portrait).toContain('2024-05-01：约饭');
    expect(portrait).toContain('话痨');
  });

  it('空消息列表抛错；空画像抛错', async () => {
    await expect(buildFace(vi.fn(), vi.fn(), [], '老王')).rejects.toThrow('没有可提炼的文本消息');
    await expect(
      buildFace(
        async () => '{"events":[],"traits":[]}',
        async () => '   ',
        [msg(0)],
        '老王'
      )
    ).rejects.toThrow('画像生成为空');
  });
});
