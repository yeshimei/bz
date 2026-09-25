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

// ---------------- 媒体素材接线（issue 445） ----------------

describe('chunkMessages 媒体计数', () => {
  it('批内语音 / 图片条数随切批累计，无媒体则不带 media 字段', () => {
    const messages = [
      msg(0, false, '[语音 12s·平静] 转写一'),
      msg(1, true, '普通文本'),
      msg(2, false, '[图片] 一只猫'),
      msg(3, true, '[语音]'), // 旧空标签：不算素材
    ];
    const [chunk] = chunkMessages(messages, { maxCount: 10 });
    expect(chunk.media).toEqual({ voice: 1, image: 1 });
    const [plain] = chunkMessages([msg(0, false, '早'), msg(1, true, '晚')]);
    expect(plain.media).toBeUndefined();
  });

  it('切批边界重置计数：各批只算本批的媒体', () => {
    const messages = [
      msg(0, false, '[语音 5s] 甲'),
      msg(1, true, '文字'),
      msg(2, false, '[语音 6s] 乙'),
      msg(3, true, '[图片] 描述'),
    ];
    const chunks = chunkMessages(messages, { maxCount: 2 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].media).toEqual({ voice: 1, image: 0 });
    expect(chunks[1].media).toEqual({ voice: 1, image: 1 });
  });
});

describe('媒体素材进提示词（issue 445）', () => {
  it('buildExtractPrompt 有媒体：说明标签含义、quotes 优先收语音原话、图片描述可进 moments', () => {
    const withMedia = buildExtractPrompt(
      {
        from: '2024-05-01',
        to: '2024-05-01',
        count: 2,
        lines: ['[2024-05-01 12:00][对方] [语音 12s·平静] 你猜怎么着', '[2024-05-01 12:01][对方] [图片] 一只猫'],
        media: { voice: 1, image: 1 },
      },
      '老王'
    );
    expect(withMedia).toContain('语音转写');
    expect(withMedia).toContain('画面描述');
    expect(withMedia).toContain('优先收这里的口语原话');
    expect(withMedia).toContain('不要把标签、时长、情感标记写进去');
    expect(withMedia).toContain('难忘画面');

    const plain = buildExtractPrompt(
      { from: '2024-05-01', to: '2024-05-01', count: 1, lines: ['[2024-05-01 12:00][我] 早'] },
      '老王'
    );
    expect(plain).not.toContain('语音转写');
    expect(plain).not.toContain('口语原话');
  });

  it('buildPortraitPrompt / buildChroniclePrompt：媒体说明进素材清单，缺省不出现', () => {
    const note = '聊天里还有语音 26 条 · 4 分 · 图片 14 张的媒体素材';
    const portrait = buildPortraitPrompt('老王', {
      events: [],
      traits: [],
      quotes: [{ ts: '2024-05-01', who: '对方', text: '你猜怎么着' }],
      moments: [],
      mediaNote: note,
    });
    expect(portrait).toContain(`素材说明：${note}`);
    expect(portrait).toContain('你猜怎么着'); // 原话素材与媒体说明同在

    expect(buildPortraitPrompt('老王', { events: [], traits: [], quotes: [], moments: [] })).not.toContain('素材说明');

    const chronicle = buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }], note);
    expect(chronicle).toContain(`素材说明：${note}`);
    expect(buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }])).not.toContain('素材说明');
  });

  it('buildFace：语音原话进 quotes 与文字原话同池去重；媒体说明缺省自算并进画像 prompt', async () => {
    const messages = [
      msg(0, false, '[语音 12s·开心] 周末爬山去啊'),
      msg(1, true, '普通文字原话哈哈'),
    ];
    let batch = 0;
    const askExtract = vi.fn(async () => {
      batch += 1;
      // 两批都回同一句语音原话（模拟相邻批重复采集）——同池按 text 去重只留一条
      return batch === 1
        ? '{"events":[],"traits":[],"quotes":[{"ts":"2024-05-01","who":"对方","text":"周末爬山去啊"}],"moments":[]}'
        : '{"events":[],"traits":[],"quotes":[{"ts":"2024-05-01","who":"对方","text":"周末爬山去啊"}],"moments":[]}';
    });
    const seen: string[] = [];
    const face = await buildFace(
      askExtract,
      async (p) => (seen.push(p), '## 画像速写\n稳'),
      messages,
      '老王',
      undefined,
      { maxCount: 1 } // 强制切两批：跨批同池去重
    );
    expect(face.quotes).toEqual([{ ts: '2024-05-01', who: '对方', text: '周末爬山去啊' }]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('素材说明');
    expect(seen[0]).toContain('语音 1 条');
  });

  it('buildFace 显式传 mediaNote：画像与时间线 prompt 都带说明', async () => {
    const seen: string[] = [];
    await buildFace(
      async () => '{"events":[{"ts":"2024-05-01","summary":"约饭"}],"traits":[]}',
      async (p) => (seen.push(p), p.includes('关系时间线') ? '## 2024 年\n- 开头' : '## 画像速写\n稳'),
      [msg(0, false, '早')],
      '老王',
      undefined,
      undefined,
      '自定义媒体说明'
    );
    expect(seen.some((p) => p.includes('素材说明：自定义媒体说明'))).toBe(true);
    expect(seen.filter((p) => p.includes('自定义媒体说明'))).toHaveLength(2); // 画像 + 时间线
  });
});

// ---------------- 互动统计素材与新对话行说明（issue 449） ----------------

describe('buildExtractPrompt 新行类语义说明（issue 449）', () => {
  it('分享 / 引用 / 通话 / 命名表情的标签说明进头部；moments 引导收分享来源', () => {
    const prompt = buildExtractPrompt(
      {
        from: '2024-05-01',
        to: '2024-05-01',
        count: 3,
        lines: [
          '[2024-05-01 12:00][对方] [分享] 晨间新闻',
          '[2024-05-01 12:01][我] [引用「明天见」] 好的',
          '[2024-05-01 12:02][对方] [通话 32:15]',
        ],
      },
      '老王'
    );
    expect(prompt).toContain('[分享]');
    expect(prompt).toContain('[小程序]');
    expect(prompt).toContain('引用回复');
    expect(prompt).toContain('通话事件');
    expect(prompt).toContain('[表情·名]');
    expect(prompt).toContain('口味与审美');
    expect(prompt).toContain('内容来源'); // moments 引导：分享来源也是难忘画面
  });
});

describe('buildPortraitPrompt 互动统计与新小节（issue 449）', () => {
  const base = { events: [] as never[], traits: [] as string[], quotes: [] as never[], moments: [] as never[] };

  it('statsNote 原文进「素材五：互动统计」；缺省整段不渲染', () => {
    const withStats = buildPortraitPrompt('老王', {
      ...base,
      statsNote: '互动画像：会话我发起 12 次、对方发起 5 次；深夜（0-6 点）消息占 18.0%。',
    });
    expect(withStats).toContain('## 素材五：互动统计');
    expect(withStats).toContain('深夜（0-6 点）消息占 18.0%');

    const without = buildPortraitPrompt('老王', base);
    expect(without).not.toContain('素材五');
    expect(without).not.toContain('互动统计');
  });

  it('新增「聊天的形状」「分享的口味」小节；表达 DNA 收称呼；硬性要求同步', () => {
    const portrait = buildPortraitPrompt('老王', base);
    expect(portrait).toContain('## 聊天的形状');
    expect(portrait).toContain('谁更常先开口');
    expect(portrait).toContain('## 分享的口味');
    expect(portrait).toContain('称呼');
    expect(portrait).toContain('（素材不足）');
  });

  it('buildChroniclePrompt：statsNote 进 prompt；沉默期与「关系的季节」引导在场', () => {
    const chron = buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }], undefined, '互动画像：通话 26 次共 3.2 时。');
    expect(chron).toContain('互动画像：通话 26 次共 3.2 时。');
    expect(chron).toContain('沉默期');
    expect(chron).toContain('季节');
    expect(buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }])).not.toContain('互动画像：');
  });
});

describe('buildFace moments/traits 出口与 statsNote 透传（issue 449）', () => {
  it('BuiltFace 带合并后的 moments / traits；statsNote 进画像与时间线两路 prompt', async () => {
    const seen: string[] = [];
    const face = await buildFace(
      async () =>
        '{"events":[{"ts":"2024-05-01","summary":"约饭"}],"traits":["话痨"],"quotes":[],"moments":[{"ts":"2024-05-01","summary":"常去的那家店"}]}',
      async (p) => (seen.push(p), p.includes('关系时间线') ? '## 2024 年' : '## 画像速写'),
      [msg(0, false, '早')],
      '老王',
      undefined,
      undefined,
      undefined,
      '互动画像：我中位 45 秒。'
    );
    expect(face.traits).toEqual(['话痨']);
    expect(face.moments).toEqual([{ ts: '2024-05-01', summary: '常去的那家店' }]);
    expect(seen[0]).toContain('## 素材五：互动统计');
    expect(seen[0]).toContain('我中位 45 秒');
    expect(seen.filter((p) => p.includes('互动画像：我中位 45 秒'))).toHaveLength(2); // 画像 + 时间线
  });
});
