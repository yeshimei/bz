/**
 * 脸谱域提炼管线测试（issue 435）：切批双限与抽样、JSON 回执容错、
 * 假 ask 全流程（进度回调 / 合并去重 / 空输入与空画像报错）。（纯编排，无 DOM）
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildChroniclePrompt,
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
      '{"events":[{"ts":"2024-05-01","kind":"major","summary":"约饭"},{"ts":"","summary":"坏"},{"bad":1}],"traits":["话痨",3]}'
    );
    expect(out.events).toEqual([{ ts: '2024-05-01', summary: '约饭', kind: 'major' }]);
    expect(out.traits).toEqual(['话痨', '3']);
    expect(parseBatchExtract('{"events":"不是数组"}').events).toEqual([]);
  });

  it('parseBatchExtract：kind 非法值不落字段；quotes / moments 归一（who 缺省、残缺剔除）', () => {
    const odd = parseBatchExtract('{"events":[{"ts":"2024-05-01","kind":"巨大","summary":"约饭"}]}');
    expect(odd.events).toEqual([{ ts: '2024-05-01', summary: '约饭' }]);

    const out = parseBatchExtract(
      '{"quotes":[{"ts":"2024-05-01","text":"你什么星座"},{"ts":"2024-05-02","who":"我","text":"哈哈"},{"text":"没日期"}],' +
        '"moments":[{"ts":"2024-05-01","summary":"常去的那家店"},{"ts":"","summary":"坏"}]}'
    );
    expect(out.quotes).toEqual([
      { ts: '2024-05-01', who: '对方', text: '你什么星座' },
      { ts: '2024-05-02', who: '我', text: '哈哈' },
    ]);
    expect(out.moments).toEqual([{ ts: '2024-05-01', summary: '常去的那家店' }]);
  });
});

describe('buildFace 全流程（假 ask）', () => {
  it('逐批采集 → 进度回调 → 合并去重（kind 回填）→ 画像 + 关系时间线', async () => {
    const messages = [msg(0, false, 'a'), msg(1, true, 'b'), msg(2, false, 'c'), msg(3, true, 'd')];
    // 按批内消息内容区分（不能用时刻判断：渲染时分随本地时区偏移，不一定是 12 点）
    const askExtract = vi.fn(async (prompt: string) =>
      prompt.includes('[我] d')
        ? '{"events":[{"ts":"2024-05-02","kind":"major","summary":"聊项目"}],"traits":["细节控"],' +
          '"quotes":[{"ts":"2024-05-02","who":"我","text":"别熬夜"}],"moments":[{"ts":"2024-05-02","summary":"凌晨的便利店"}]}'
        : '{"events":[{"ts":"2024-05-01","summary":"约饭"},{"ts":"2024-05-02","summary":"聊项目"}],"traits":["话痨"]}'
    );
    const askPortrait = vi.fn(async (prompt: string) =>
      prompt.includes('关系时间线')
        ? '## 2024 年\n- 第一次说话（2024-05-01）'
        : '## 画像速写\n**热情**开朗\n> 「别熬夜」'
    );
    const onProgress = vi.fn();
    const face = await buildFace(askExtract, askPortrait, messages, '老王', onProgress, { maxCount: 2 });
    expect(askExtract).toHaveBeenCalledTimes(2);
    expect(askPortrait).toHaveBeenCalledTimes(2); // 画像 + 时间线各一次
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
    expect(face.events).toEqual([
      { ts: '2024-05-01', summary: '约饭' },
      { ts: '2024-05-02', summary: '聊项目', kind: 'major' }, // 后一批的 kind 回填
    ]);
    expect(face.quotes).toEqual([{ ts: '2024-05-02', who: '我', text: '别熬夜' }]);
    expect(face.portrait).toContain('画像速写');
    expect(face.chronicle).toContain('2024 年');
  });

  it('时间线生成失败不阻断画像（次要产物兜底）', async () => {
    let call = 0;
    const askPortrait = vi.fn(async () => {
      call += 1;
      if (call === 2) throw new Error('模型抽风');
      return '## 画像速写\n稳';
    });
    const face = await buildFace(
      async () => '{"events":[{"ts":"2024-05-01","summary":"约饭"}]}',
      askPortrait,
      [msg(0)],
      '老王'
    );
    expect(face.portrait).toContain('画像速写');
    expect(face.chronicle).toBe('');
  });

  it('prompt 携带人名与对话行；画像 prompt 吃四类素材并点名分层小节', async () => {
    const prompt = buildExtractPrompt({ from: '2024-05-01', to: '2024-05-02', count: 1, lines: ['[2024-05-01 12:00][我] 早'] }, '老王');
    expect(prompt).toContain('老王');
    expect(prompt).toContain('[我] 早');

    const portrait = buildPortraitPrompt('老王', {
      events: [{ ts: '2024-05-01', summary: '约饭' }],
      traits: ['话痨'],
      quotes: [{ ts: '2024-05-01', who: '对方', text: '你什么星座' }],
      moments: [{ ts: '2024-05-01', summary: '常去的那家店' }],
    });
    expect(portrait).toContain('2024-05-01：约饭');
    expect(portrait).toContain('话痨');
    expect(portrait).toContain('你什么星座'); // 原话进素材才有证据可引
    expect(portrait).toContain('表达 DNA');
    expect(portrait).toContain('冲突与修复');

    const chronicle = buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }]);
    expect(chronicle).toContain('2024-05-01：第一次说话');
    expect(chronicle).toContain('关系时间线');
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
