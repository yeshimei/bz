/**
 * 脸谱域提炼管线测试（issue 435；双卷画像 issue 455）：切批双限与抽样、JSON 回执容错（6 类素材）、
 * 双卷 prompt（其人 7 节 / 我们 8 节 / 档案段 / 密度段 / 样本警示）、
 * 假 ask 全流程（四阶段进度 / 合并去重 / 三次文本调用 / 抛错路径）。（纯编排，无 DOM）
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildBondPrompt,
  buildChroniclePrompt,
  buildExtractPrompt,
  buildPersonPrompt,
  buildProfileNote,
  buildFace,
  chunkMessages,
  chunkMetaOf,
  extractJsonLoose,
  mergeBatches,
  parseBatchExtract,
  sampleWarnOf,
  toPortraitMaterial,
  MATERIAL_LIMITS,
  type PortraitMaterial,
} from '../../src/people/digest';
import type { PersonProfile, UnifiedMessage } from '../../src/people/types';

/** 本地时区 2024-05-01 12:00 起的第 n 分钟 */
function msg(minutes: number, isSender = false, text = '嗯'): UnifiedMessage {
  return { ts: Date.UTC(2024, 4, 1, 12, minutes), isSender, text };
}

/** 空 PortraitMaterial 底座（各测试按需覆盖） */
function baseMaterial(over: Partial<PortraitMaterial> = {}): PortraitMaterial {
  return { events: [], traits: [], quotes: [], moments: [], interests: [], threads: [], ...over };
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

  it('parseBatchExtract 六类（issue 455）：interests / threads 归一，脏字段剔除、数字串化、非对象元素丢弃', () => {
    const out = parseBatchExtract(
      '{"interests":[{"ts":"2024-05-01","topic":"五月天"},{"ts":"","topic":"没日期"},{"ts":"2024-05-02","topic":42},{"bad":1}],' +
        '"threads":[{"ts":"2024-05-01","text":"下次一起爬山"},{"text":"没日期"},{"ts":"2024-05-02","text":""}]}'
    );
    expect(out.interests).toEqual([
      { ts: '2024-05-01', topic: '五月天' },
      { ts: '2024-05-02', topic: '42' },
    ]);
    expect(out.threads).toEqual([{ ts: '2024-05-01', text: '下次一起爬山' }]);
    // 老回执没有这两个字段：兜空数组不炸
    expect(parseBatchExtract('{"events":[],"traits":[]}').interests).toEqual([]);
    expect(parseBatchExtract('{"events":[],"traits":[]}').threads).toEqual([]);
  });
});

describe('buildExtractPrompt 六类采集（issue 455）', () => {
  it('四类扩六类：interests / threads 的采集引导与字数上限在场；媒体引导保留', () => {
    const prompt = buildExtractPrompt(
      {
        from: '2024-05-01',
        to: '2024-05-02',
        count: 2,
        lines: ['[2024-05-01 12:00][对方] [语音 12s·平静] 你猜怎么着', '[2024-05-01 12:01][对方] [分享] 一首歌'],
        media: { voice: 1, image: 0 },
      },
      '老王'
    );
    expect(prompt).toContain('六类素材');
    expect(prompt).toContain('5. interests：兴趣信号');
    expect(prompt).toContain('分享 / 安利的具体内容、反复聊起的话题、正在投入的事');
    expect(prompt).toContain('topic（话题名，不超过 15 字）');
    expect(prompt).toContain('单次顺带一提不收，反复出现或特征鲜明才收');
    expect(prompt).toContain('6. threads：未竟之事');
    expect(prompt).toContain('约定、邀约、「下次一起…」、聊到一半没下文的话题');
    expect(prompt).toContain('text（不超过 30 字）');
    expect(prompt).toContain('只采集，不判断是否兑现');
    // JSON schema 行同步扩两字段
    expect(prompt).toContain('"interests":[{"ts":"YYYY-MM-DD","topic":"..."}]');
    expect(prompt).toContain('"threads":[{"ts":"YYYY-MM-DD","text":"..."}]');
    // 既有 4 类与媒体引导不回退
    expect(prompt).toContain('1. events');
    expect(prompt).toContain('2. traits');
    expect(prompt).toContain('3. quotes');
    expect(prompt).toContain('4. moments');
    expect(prompt).toContain('语音转写');
    expect(prompt).toContain('优先收这里的口语原话');
    expect(prompt).toContain('[分享]');
  });
});

describe('mergeBatches / toPortraitMaterial（issue 455 六类）', () => {
  it('interests 按 topic 去重、threads 按 text 去重，均保持首现顺序', () => {
    const merged = mergeBatches([
      {
        events: [],
        traits: [],
        quotes: [],
        moments: [],
        interests: [
          { ts: '2024-05-01', topic: '五月天' },
          { ts: '2024-05-02', topic: '任天堂' },
        ],
        threads: [{ ts: '2024-05-01', text: '下次一起爬山' }],
      },
      {
        events: [],
        traits: [],
        quotes: [],
        moments: [],
        interests: [{ ts: '2024-05-03', topic: '五月天' }], // 同 topic 跨批重复 → 留首条
        threads: [{ ts: '2024-05-03', text: '有空吗' }],
      },
    ]);
    expect(merged.interests).toEqual([
      { ts: '2024-05-01', topic: '五月天' },
      { ts: '2024-05-02', topic: '任天堂' },
    ]);
    expect(merged.threads).toEqual([
      { ts: '2024-05-01', text: '下次一起爬山' },
      { ts: '2024-05-03', text: '有空吗' },
    ]);
  });

  it('toPortraitMaterial 按 MATERIAL_LIMITS 抽样（interests 40 / threads 30）；profileNote 透传', () => {
    const merged = mergeBatches([
      {
        events: [],
        traits: [],
        quotes: [],
        moments: [],
        interests: Array.from({ length: 45 }, (_, i) => ({ ts: '2024-05-01', topic: `话${i}` })),
        threads: Array.from({ length: 35 }, (_, i) => ({ ts: '2024-05-01', text: `事${i}` })),
      },
    ]);
    const material = toPortraitMaterial(merged, { profileNote: '生日：1994-02-14' });
    expect(material.interests).toHaveLength(MATERIAL_LIMITS.interests);
    expect(material.interests[0].topic).toBe('话0'); // 均匀抽样首尾必保
    expect(material.interests[material.interests.length - 1].topic).toBe('话44');
    expect(material.threads).toHaveLength(MATERIAL_LIMITS.threads);
    expect(material.threads[0].text).toBe('事0');
    expect(material.threads[material.threads.length - 1].text).toBe('事34');
    expect(material.profileNote).toBe('生日：1994-02-14');
  });
});

describe('buildProfileNote（issue 455 素材〇）', () => {
  it('逐项成句：生日 / 职业 / 家乡 / 怎么认识 / 什么时候认识 / 关系标签 / 备注', () => {
    const profile: PersonProfile = {
      birthday: '1994-02-14',
      job: '设计师',
      hometown: '杭州',
      metVia: '大学同学',
      metAt: '2016 年秋',
      tags: ['同学', '好友'],
      note: '聊天必带表情包',
    };
    const note = buildProfileNote(profile);
    expect(note).toContain('生日：1994-02-14');
    expect(note).toContain('职业：设计师');
    expect(note).toContain('家乡：杭州');
    expect(note).toContain('怎么认识：大学同学');
    expect(note).toContain('什么时候认识：2016 年秋');
    expect(note).toContain('关系标签：同学、好友');
    expect(note).toContain('备注：聊天必带表情包');
  });

  it('部分档案只写有的项；空档案 / 缺省返回空串', () => {
    expect(buildProfileNote({ tags: ['同事'] })).toBe('关系标签：同事');
    expect(buildProfileNote({})).toBe('');
    expect(buildProfileNote(undefined)).toBe('');
  });
});

describe('buildPersonPrompt（卷一《其人》，issue 455）', () => {
  it('素材六段：档案 / 事件 / 原话 / 场景 / 特质 / 兴趣信号，互动统计为素材六', () => {
    const prompt = buildPersonPrompt(
      '老王',
      baseMaterial({
        events: [{ ts: '2024-05-01', summary: '约饭' }],
        traits: ['话痨'],
        quotes: [{ ts: '2024-05-01', who: '对方', text: '你什么星座' }],
        moments: [{ ts: '2024-05-01', summary: '常去的那家店' }],
        interests: [{ ts: '2024-05-01', topic: '五月天' }],
        statsNote: '互动画像：深夜（0-6 点）消息占 18.0%。',
        profileNote: '生日：1994-02-14',
      })
    );
    expect(prompt).toContain('卷一《其人》');
    expect(prompt).toContain('老王');
    expect(prompt).toContain('## 素材〇：档案');
    expect(prompt).toContain('生日：1994-02-14');
    expect(prompt).toContain('2024-05-01：约饭');
    expect(prompt).toContain('你什么星座'); // 原话进素材才有证据可引
    expect(prompt).toContain('常去的那家店');
    expect(prompt).toContain('话痨');
    expect(prompt).toContain('五月天'); // 兴趣信号进素材
    expect(prompt).toContain('## 素材六：互动统计');
    expect(prompt).toContain('深夜（0-6 点）消息占 18.0%');
  });

  it('产出 7 节：速写须含矛盾感 / 行为规则 / 表达 DNA 引原话且称呼归卷二 / 兴趣三层 / 价值观全推断 / 习惯 / 情感倾向', () => {
    const prompt = buildPersonPrompt('老王', baseMaterial());
    expect(prompt).toContain('## 画像速写');
    expect(prompt).toContain('矛盾感');
    expect(prompt).toContain('## 性格与思维');
    expect(prompt).toContain('当 X 时，TA Y');
    expect(prompt).toContain('## 表达 DNA');
    expect(prompt).toContain('`> ` 引用块');
    expect(prompt).toContain('称呼 / 昵称不写在这节');
    expect(prompt).toContain('## 兴趣爱好');
    expect(prompt).toContain('实际投入');
    expect(prompt).toContain('精神底色');
    expect(prompt).toContain('## 价值观与红线');
    expect(prompt).toContain('「看来」或「似乎」起头');
    expect(prompt).toContain('## 习惯');
    expect(prompt).toContain('## 情感倾向');
    expect(prompt).toContain('语音情感计数可直引');
  });

  it('硬性要求块沿用全部条目 + 保留矛盾；档案 / 统计缺省整段不渲染；样本警示插头部', () => {
    const warn = sampleWarnOf(132)!;
    const withWarn = buildPersonPrompt('老王', baseMaterial(), warn);
    expect(withWarn.startsWith(`你在帮用户为好友「老王」`)).toBe(true);
    expect(withWarn).toContain(warn);
    expect(withWarn).toContain('保留矛盾');
    expect(withWarn).toContain('1200 字以内');
    expect(withWarn).toContain('（素材不足）');
    expect(withWarn).toContain('不要代码围栏');

    const bare = buildPersonPrompt('老王', baseMaterial());
    expect(bare).not.toContain('素材〇');
    expect(bare).not.toContain('素材六');
    expect(bare).not.toContain(warn);
  });

  it('媒体说明进素材清单，缺省不出现', () => {
    const note = '聊天里还有语音 26 条 · 4 分 · 图片 14 张的媒体素材';
    const withNote = buildPersonPrompt('老王', baseMaterial({ mediaNote: note, quotes: [{ ts: '2024-05-01', who: '对方', text: '你猜怎么着' }] }));
    expect(withNote).toContain(`素材说明：${note}`);
    expect(withNote).toContain('你猜怎么着');
    expect(buildPersonPrompt('老王', baseMaterial())).not.toContain('素材说明');
  });
});

describe('buildBondPrompt（卷二《我们》，issue 455）', () => {
  it('素材分段含未竟之事线索；互动统计为素材五；未竟线索缺省写（无）', () => {
    const prompt = buildBondPrompt(
      '老王',
      baseMaterial({
        events: [{ ts: '2024-05-01', summary: '约饭' }],
        threads: [{ ts: '2024-05-02', text: '说好一起去看海' }],
        statsNote: '互动画像：会话我发起 12 次。',
      })
    );
    expect(prompt).toContain('卷二《我们》');
    expect(prompt).toContain('## 素材四：未竟之事线索');
    expect(prompt).toContain('说好一起去看海');
    expect(prompt).toContain('## 素材五：互动统计');
    expect(prompt).toContain('会话我发起 12 次');

    const bare = buildBondPrompt('老王', baseMaterial());
    expect(bare).toContain('（无）');
    expect(bare).not.toContain('素材五');
  });

  it('产出 8 节：定性（档案优先）/ 互动结构（不罗列数字）/ 演变阶段 / 我们的语言 / 共同记忆 / 冲突与修复（和解单独写）/ 未竟之事（对照 events）/ 经营建议', () => {
    const prompt = buildBondPrompt('老王', baseMaterial({ profileNote: '关系标签：同学' }));
    expect(prompt).toContain('## 关系定性');
    expect(prompt).toContain('以档案为准并注明');
    expect(prompt).toContain('## 互动结构');
    expect(prompt).toContain('不要罗列数字');
    expect(prompt).toContain('## 演变阶段');
    expect(prompt).toContain('最后一句写「现在」');
    expect(prompt).toContain('## 我们的语言');
    expect(prompt).toContain('梗与暗语');
    expect(prompt).toContain('## 共同记忆');
    expect(prompt).toContain('## 冲突与修复');
    expect(prompt).toContain('「直接」');
    expect(prompt).toContain('和解信号单独写');
    expect(prompt).toContain('雷区清单');
    expect(prompt).toContain('## 未竟之事');
    expect(prompt).toContain('约定过且后来一起做了的不收');
    expect(prompt).toContain('## 经营建议');
    expect(prompt).toContain('关系标签：同学');
    expect(prompt).toContain('保留矛盾');
    expect(prompt).toContain('## 硬性要求');
  });

  it('样本警示插头部；硬性要求在场', () => {
    const warn = sampleWarnOf(132)!;
    const withWarn = buildBondPrompt('老王', baseMaterial(), warn);
    expect(withWarn).toContain(warn);
    expect(withWarn).toContain('1200 字以内');
  });
});

describe('sampleWarnOf（issue 455 样本警示）', () => {
  it('低于阈值出警示句；阈值以上不出', () => {
    expect(sampleWarnOf(132)).toBe('注意：本次样本仅 132 条消息，素材偏少——证据不足的小节直接写（素材不足），不要脑补。');
    expect(sampleWarnOf(199)).toContain('199 条');
    expect(sampleWarnOf(200)).toBeUndefined();
    expect(sampleWarnOf(18477)).toBeUndefined();
  });
});

describe('buildFace 全流程（假 ask，双卷三调用）', () => {
  it('逐批采集 → 四阶段进度 → 合并去重（kind 回填）→ 其人 + 我们 + 时间线', async () => {
    const messages = [msg(0, false, 'a'), msg(1, true, 'b'), msg(2, false, 'c'), msg(3, true, 'd')];
    // 按批内消息内容区分（不能用时刻判断：渲染时分随本地时区偏移，不一定是 12 点）
    const askExtract = vi.fn(async (prompt: string) =>
      prompt.includes('[我] d')
        ? '{"events":[{"ts":"2024-05-02","kind":"major","summary":"聊项目"}],"traits":["细节控"],' +
          '"quotes":[{"ts":"2024-05-02","who":"我","text":"别熬夜"}],"moments":[{"ts":"2024-05-02","summary":"凌晨的便利店"}], ' +
          '"interests":[{"ts":"2024-05-02","topic":"任天堂"}],"threads":[{"ts":"2024-05-02","text":"下次一起打游戏"}]}'
        : '{"events":[{"ts":"2024-05-01","summary":"约饭"},{"ts":"2024-05-02","summary":"聊项目"}],"traits":["话痨"]}'
    );
    const askPortrait = vi.fn(async (prompt: string) => {
      if (prompt.includes('关系时间线')) return '## 2024 年\n- 第一次说话（2024-05-01）';
      if (prompt.includes('要产出的卷二')) return '## 关系定性\n老友';
      return '## 画像速写\n**热情**开朗\n> 「别熬夜」';
    });
    const onProgress = vi.fn();
    const onMaterial = vi.fn();
    const face = await buildFace(askExtract, askPortrait, messages, '老王', { chunkOpts: { maxCount: 2 }, onProgress, onMaterial });
    expect(askExtract).toHaveBeenCalledTimes(2);
    expect(askPortrait).toHaveBeenCalledTimes(3); // 其人 + 我们 + 时间线各一次
    // 阶段化进度（issue 455 四阶段）：逐批带本批元数据 → person / bond / chronicle 各一步
    const [c1, c2] = chunkMessages(messages, { maxCount: 2 });
    expect(onProgress.mock.calls).toEqual([
      [{ stage: 'extracting', done: 1, total: 2, current: chunkMetaOf(c1) }],
      [{ stage: 'extracting', done: 2, total: 2, current: chunkMetaOf(c2) }],
      [{ stage: 'person', done: 0, total: 1 }],
      [{ stage: 'bond', done: 0, total: 1 }],
      [{ stage: 'chronicle', done: 0, total: 1 }],
    ]);
    // 中间计数（合并去重后、抽样前口径）：events 2（聊项目跨批去重）/ quotes 1 / moments 1 / traits 2
    expect(onMaterial).toHaveBeenCalledWith({ events: 2, quotes: 1, moments: 1, traits: 2 });
    expect(face.events).toEqual([
      { ts: '2024-05-01', summary: '约饭' },
      { ts: '2024-05-02', summary: '聊项目', kind: 'major' }, // 后一批的 kind 回填
    ]);
    expect(face.quotes).toEqual([{ ts: '2024-05-02', who: '我', text: '别熬夜' }]);
    expect(face.person).toContain('画像速写');
    expect(face.bond).toContain('关系定性');
    expect(face.interests).toEqual([{ ts: '2024-05-02', topic: '任天堂' }]);
    expect(face.threads).toEqual([{ ts: '2024-05-02', text: '下次一起打游戏' }]);
    expect(face.chronicle).toContain('2024 年');
  });

  it('时间线生成失败不阻断双卷（次要产物兜底）', async () => {
    const askPortrait = vi.fn(async (prompt: string) => {
      if (prompt.includes('关系时间线')) throw new Error('模型抽风');
      if (prompt.includes('要产出的卷二')) return '## 关系定性\n老友';
      return '## 画像速写\n稳';
    });
    const face = await buildFace(
      async () => '{"events":[{"ts":"2024-05-01","summary":"约饭"}]}',
      askPortrait,
      [msg(0)],
      '老王'
    );
    expect(face.person).toContain('画像速写');
    expect(face.bond).toContain('关系定性');
    expect(face.chronicle).toBe('');
  });

  it('卷一为空抛错；卷二为空抛错（批次文案各自点名）', async () => {
    await expect(buildFace(vi.fn(), vi.fn(), [], '老王')).rejects.toThrow('没有可提炼的文本消息');
    await expect(
      buildFace(
        async () => '{"events":[],"traits":[]}',
        async () => '   ', // 第一调用（其人）返回空白
        [msg(0)],
        '老王'
      )
    ).rejects.toThrow('卷一《其人》生成为空');
    await expect(
      buildFace(
        async () => '{"events":[],"traits":[]}',
        async (p) => (p.includes('要产出的卷二') ? '   ' : '## 画像速写\n稳'),
        [msg(0)],
        '老王'
      )
    ).rejects.toThrow('卷二《我们》生成为空');
  });

  it('prompt 携带人名与对话行；双卷 prompt 各吃对应素材段', async () => {
    const prompt = buildExtractPrompt({ from: '2024-05-01', to: '2024-05-02', count: 1, lines: ['[2024-05-01 12:00][我] 早'] }, '老王');
    expect(prompt).toContain('老王');
    expect(prompt).toContain('[我] 早');

    const material = baseMaterial({
      events: [{ ts: '2024-05-01', summary: '约饭' }],
      traits: ['话痨'],
      quotes: [{ ts: '2024-05-01', who: '对方', text: '你什么星座' }],
      moments: [{ ts: '2024-05-01', summary: '常去的那家店' }],
      interests: [{ ts: '2024-05-01', topic: '五月天' }],
      threads: [{ ts: '2024-05-01', text: '下次一起爬山' }],
    });
    const person = buildPersonPrompt('老王', material);
    expect(person).toContain('2024-05-01：约饭');
    expect(person).toContain('话痨');
    expect(person).toContain('你什么星座'); // 原话进素材才有证据可引
    expect(person).toContain('五月天');
    expect(person).not.toContain('下次一起爬山'); // 未竟线索归卷二

    const bond = buildBondPrompt('老王', material);
    expect(bond).toContain('下次一起爬山');
    expect(bond).not.toContain('话痨'); // 特质线索归卷一

    const chronicle = buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }]);
    expect(chronicle).toContain('2024-05-01：第一次说话');
    expect(chronicle).toContain('关系时间线');
  });

  it('样本警示：消息 < 200 条自动注入两卷 prompt 头部；opts.sampleWarn 可覆盖', async () => {
    const seen: string[] = [];
    await buildFace(
      async () => '{"events":[],"traits":[]}',
      async (p) => (seen.push(p), p.includes('要产出的卷二') ? '## 关系定性\n老友' : '## 画像速写\n稳'),
      [msg(0)],
      '老王'
    );
    expect(seen.some((p) => p.includes('本次样本仅 1 条消息'))).toBe(true);
    expect(seen.filter((p) => p.includes('本次样本仅 1 条消息'))).toHaveLength(2); // 其人 + 我们共用同一段

    seen.length = 0;
    await buildFace(
      async () => '{"events":[],"traits":[]}',
      async (p) => (seen.push(p), p.includes('要产出的卷二') ? '## 关系定性\n老友' : '## 画像速写\n稳'),
      [msg(0)],
      '老王',
      { sampleWarn: '自定义警示' }
    );
    expect(seen.filter((p) => p.includes('自定义警示'))).toHaveLength(2);
    expect(seen.every((p) => !p.includes('本次样本仅'))).toBe(true);
  });

  it('profile 进两卷 prompt（素材〇）；样本充足（≥200 条）不出警示', async () => {
    const messages = Array.from({ length: 200 }, (_, i) => msg(i, i % 2 === 0, `m${i}`));
    const seen: string[] = [];
    const face = await buildFace(
      async () => '{"events":[],"traits":[]}',
      async (p) => (seen.push(p), p.includes('关系时间线') ? '## 2024 年' : p.includes('要产出的卷二') ? '## 关系定性\n老友' : '## 画像速写\n稳'),
      messages,
      '老王',
      { profile: { birthday: '1994-02-14', tags: ['同学'] } }
    );
    expect(seen.filter((p) => p.includes('生日：1994-02-14'))).toHaveLength(2);
    expect(seen.every((p) => !p.includes('样本偏少'))).toBe(true);
    expect(face.person).toContain('画像速写');
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

  it('buildPersonPrompt / buildChroniclePrompt：媒体说明进素材清单，缺省不出现', () => {
    const note = '聊天里还有语音 26 条 · 4 分 · 图片 14 张的媒体素材';
    const chronicle = buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }], note);
    expect(chronicle).toContain(`素材说明：${note}`);
    expect(buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }])).not.toContain('素材说明');
  });

  it('buildFace：语音原话进 quotes 与文字原话同池去重；媒体说明缺省自算并进其人 prompt', async () => {
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
      async (p) => (seen.push(p), p.includes('要产出的卷二') ? '## 关系定性\n老友' : '## 画像速写\n稳'),
      messages,
      '老王',
      { chunkOpts: { maxCount: 1 } } // 强制切两批：跨批同池去重
    );
    expect(face.quotes).toEqual([{ ts: '2024-05-01', who: '对方', text: '周末爬山去啊' }]);
    expect(seen[0]).toContain('素材说明');
    expect(seen[0]).toContain('语音 1 条');
  });

  it('buildFace 显式传 mediaNote：其人 / 我们 / 时间线三路 prompt 都带说明', async () => {
    const seen: string[] = [];
    await buildFace(
      async () => '{"events":[{"ts":"2024-05-01","summary":"约饭"}],"traits":[]}',
      async (p) => (
        seen.push(p),
        p.includes('关系时间线') ? '## 2024 年\n- 开头' : p.includes('要产出的卷二') ? '## 关系定性\n老友' : '## 画像速写\n稳'
      ),
      [msg(0, false, '早')],
      '老王',
      { mediaNote: '自定义媒体说明' }
    );
    expect(seen.some((p) => p.includes('素材说明：自定义媒体说明'))).toBe(true);
    expect(seen.filter((p) => p.includes('自定义媒体说明'))).toHaveLength(3); // 其人 + 我们 + 时间线
  });
});

// ---------------- 新对话行语义与互动统计素材（issue 449） ----------------

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

describe('双卷 prompt 的互动统计素材（issue 449 / 455）', () => {
  it('statsNote 进其人（素材六）/ 我们（素材五）/ 时间线三路；缺省整段不渲染', async () => {
    const statsNote = '互动画像：会话我发起 12 次、对方发起 5 次；深夜（0-6 点）消息占 18.0%。';
    expect(buildPersonPrompt('老王', baseMaterial({ statsNote }))).toContain('## 素材六：互动统计');
    expect(buildPersonPrompt('老王', baseMaterial())).not.toContain('素材六');

    const seen: string[] = [];
    const face = await buildFace(
      async () => '{"events":[{"ts":"2024-05-01","summary":"约饭"}],"traits":["话痨"],"quotes":[],"moments":[{"ts":"2024-05-01","summary":"常去的那家店"}]}',
      async (p) => (seen.push(p), p.includes('关系时间线') ? '## 2024 年' : p.includes('要产出的卷二') ? '## 关系定性\n老友' : '## 画像速写\n稳'),
      [msg(0, false, '早')],
      '老王',
      { statsNote }
    );
    expect(face.traits).toEqual(['话痨']);
    expect(face.moments).toEqual([{ ts: '2024-05-01', summary: '常去的那家店' }]);
    expect(seen[0]).toContain('## 素材六：互动统计');
    expect(seen[0]).toContain('深夜（0-6 点）消息占 18.0%');
    expect(seen.filter((p) => p.includes('互动画像：会话我发起 12 次'))).toHaveLength(3); // 其人 + 我们 + 时间线
  });

  it('buildChroniclePrompt：statsNote 进 prompt；沉默期与「关系的季节」引导在场', () => {
    const chron = buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }], undefined, '互动画像：通话 26 次共 3.2 时。');
    expect(chron).toContain('互动画像：通话 26 次共 3.2 时。');
    expect(chron).toContain('沉默期');
    expect(chron).toContain('季节');
    expect(buildChroniclePrompt('老王', [{ ts: '2024-05-01', summary: '第一次说话' }])).not.toContain('互动画像：');
  });
});
