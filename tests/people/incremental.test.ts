// @vitest-environment node
/**
 * 脸谱域增量提炼纯逻辑测试（issue 441 / 评审 443）：增量四模式（full / newer / older / skip）、
 * 同秒容差与整份指纹（skip 误伤修复）、素材合并去重 + 均匀抽样（新素材不被旧素材挤出）、
 * 手动随手记并入。（纯函数，无 DOM）
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildFaceIncremental,
  dedupeByText,
  mergeManualEvents,
  mergeWithOld,
  planIncremental,
} from '../../src/people/incremental';
import { chunkMessages, chunkMetaOf } from '../../src/people/digest';
import type { FaceDigest, FaceEvent, ImportRecord, ManualEvent, PersonEntry, QuoteItem, UnifiedMessage } from '../../src/people/types';

/** 秒级粒度（与真实导出一致）：基准 2024-05-01 12:00:00 UTC 起第 n 秒 */
const BASE = Date.UTC(2024, 4, 1, 12, 0, 0);
const msg = (sec: number, text = '嗯'): UnifiedMessage => ({ ts: BASE + sec * 1000, isSender: false, text });
const iso = (sec: number): string => new Date(BASE + sec * 1000).toISOString();
const person = (partial: Partial<PersonEntry> = {}): PersonEntry =>
  ({ id: 'wxid_a', name: '老王', createdAt: '2026-01-01T00:00:00.000Z', imports: [], ...partial });
const importRec = (messageCount: number, fromSec: number, toSec: number): ImportRecord =>
  ({ file: '老王.csv', importedAt: '2026-01-02T00:00:00.000Z', messageCount, skippedCount: 0, timeFrom: iso(fromSec), timeTo: iso(toSec) });

describe('planIncremental', () => {
  it('full：无 existing 或无锚点 → 全量提炼', () => {
    const msgs = [msg(0), msg(1)];
    expect(planIncremental(msgs, undefined)).toEqual({ mode: 'full', msgs, olderCount: 0 });
    expect(planIncremental(msgs, person())).toEqual({ mode: 'full', msgs, olderCount: 0 });
  });

  it('newer：只送锚点之后的消息（含同秒容差），其余计入 olderCount', () => {
    // 上次提炼到第 5 秒（imports 记录 6 条，与新文件 10 条指纹不同）
    const existing = person({ lastProcessedTs: BASE + 5000, imports: [importRec(6, 0, 5)] });
    const msgs = Array.from({ length: 10 }, (_, i) => msg(i, `m${i}`));
    const plan = planIncremental(msgs, existing);
    expect(plan.mode).toBe('newer');
    expect(plan.msgs.map((m) => m.ts)).toEqual(Array.from({ length: 5 }, (_, i) => BASE + (i + 5) * 1000));
    expect(plan.olderCount).toBe(5);
  });

  it('同秒容差：与锚点同秒的消息算新素材，不再被当旧数据丢掉（评审 P2-1b）', () => {
    // 锚点 = 第 5 秒；新文件里有 3 条同在第 5 秒的消息（旧判定 m.ts > anchor 会整批漏掉 → skip）
    const existing = person({ lastProcessedTs: BASE + 5000, imports: [importRec(2, 0, 5)] });
    const msgs = [msg(0), msg(5, 'a'), msg(5, 'b'), msg(5, 'c')];
    const plan = planIncremental(msgs, existing);
    expect(plan.mode).toBe('newer');
    expect(plan.msgs).toHaveLength(3);
    expect(plan.msgs.every((m) => m.ts === BASE + 5000)).toBe(true);
    expect(plan.olderCount).toBe(1);
  });

  it('skip：整份指纹（条数 + 跨度）已在导入记录里 = 同一导出再导 → 不调用 AI', () => {
    const existing = person({ lastProcessedTs: BASE + 4000, imports: [importRec(5, 0, 4)] });
    const msgs = Array.from({ length: 5 }, (_, i) => msg(i));
    const plan = planIncremental(msgs, existing);
    expect(plan.mode).toBe('skip');
    expect(plan.msgs).toEqual([]);
    expect(plan.olderCount).toBe(5);
  });

  it('skip 误伤修复：结尾重合但指纹对不上的导出 → 不再 skip（评审 P2-1a）', () => {
    // 尾锚点与第 9 秒重合，但库里只有另一份 3 条的导入记录——旧判定 maxTs === anchor 直接 skip，
    // 把这份不同的导出静默丢掉；现在先过指纹，对不上就继续往下判
    const existing = person({ lastProcessedTs: BASE + 9000, imports: [importRec(3, 0, 2)] });
    const msgs = Array.from({ length: 10 }, (_, i) => msg(i));
    const plan = planIncremental(msgs, existing);
    expect(plan.mode).not.toBe('skip');
    expect(plan.mode).toBe('newer'); // 同秒容差把锚点同秒的末条当新素材
  });

  it('older：全部严格早于锚点且指纹对不上 → 补录提炼，不静默丢', () => {
    const existing = person({ lastProcessedTs: BASE + 100000, imports: [importRec(3, 50, 60)] });
    const msgs = Array.from({ length: 5 }, (_, i) => msg(i));
    const plan = planIncremental(msgs, existing);
    expect(plan.mode).toBe('older');
    expect(plan.msgs).toHaveLength(5);
    expect(plan.olderCount).toBe(0);
  });

  it('媒体素材照常过水位（issue 445）：早于锚点的语音 / 图片不重复入库', () => {
    // 上次提炼到第 5 秒；新文件 4 条里 2 条是媒体标签，其中 1 条语音早于锚点
    const existing = person({ lastProcessedTs: BASE + 5000, imports: [importRec(2, 0, 5)] });
    const msgs = [
      msg(0, '[语音 12s·平静] 早先说过的话'),
      msg(1, '[图片] 早先发过的图'),
      msg(6, '[语音 8s·开心] 新的语音'),
      msg(7, '[图片] 新的图片描述'),
    ];
    const plan = planIncremental(msgs, existing);
    expect(plan.mode).toBe('newer');
    // 只有锚点之后的媒体 / 文本进提炼，旧媒体不重复烧 token
    expect(plan.msgs.map((m) => m.text)).toEqual(['[语音 8s·开心] 新的语音', '[图片] 新的图片描述']);
    expect(plan.olderCount).toBe(2);
  });

  it('同一份含媒体的导出再导 → 指纹命中 skip，媒体素材不二次入库（issue 445）', () => {
    const msgs = [
      msg(0, '[语音 5s] 一'),
      msg(1, '[图片] 描述'),
      msg(2, '普通文本'),
    ];
    const existing = person({ lastProcessedTs: BASE + 2000, imports: [importRec(3, 0, 2)] });
    expect(planIncremental(msgs, existing).mode).toBe('skip');
  });
});

describe('dedupeByText', () => {
  it('按键去重只留首个，保持输入顺序', () => {
    expect(dedupeByText(['a', 'b', 'a', 'c', 'b'], (t) => t)).toEqual(['a', 'b', 'c']);
    const quotes: QuoteItem[] = [
      { ts: '2024-05-01', who: '对方', text: '口头禅' },
      { ts: '2024-05-02', who: '我', text: '别熬夜' },
      { ts: '2024-05-03', who: '对方', text: '口头禅' },
    ];
    expect(dedupeByText(quotes, (q) => q.text)).toEqual([quotes[0], quotes[1]]);
  });
});

describe('mergeWithOld（issue 450 抽出的合并单源：buildFaceIncremental 与 jobs 引擎共用）', () => {
  it('旧在前合并去重：同键旧条目优先、新 kind 回填、事件按日期升序；interests/threads 按键去重旧优先', () => {
    const merged = mergeWithOld(
      {
        events: [{ ts: '2024-05-01', summary: '约饭', kind: 'major' }],
        quotes: [{ ts: '2024-05-01', who: '我', text: '新话' }],
        moments: [{ ts: '2024-05-01', summary: '常去的那家店' }],
        traits: ['热心', '话痨'],
        interests: [{ ts: '2024-05-01', topic: '任天堂' }],
        threads: [{ ts: '2024-05-01', text: '下次一起爬山' }],
      },
      {
        portrait: '旧画像',
        events: [
          { ts: '2024-04-01', summary: '旧事件' },
          { ts: '2024-05-01', summary: '约饭' },
        ],
        quotes: [{ ts: '2024-04-01', who: '对方', text: '旧话' }],
        moments: [{ ts: '2024-03-01', summary: '常去的那家店' }],
        traits: ['话痨'],
        interests: [{ ts: '2024-03-01', topic: '任天堂' }],
        threads: [{ ts: '2024-03-01', text: '说好一起去看海' }],
        generatedAt: '2026-01-01T00:00:00.000Z',
      }
    );
    expect(merged.events).toEqual([
      { ts: '2024-04-01', summary: '旧事件' },
      { ts: '2024-05-01', summary: '约饭', kind: 'major' }, // 同键旧条目保留，新批 kind 回填
    ]);
    expect(merged.quotes.map((q) => q.text)).toEqual(['旧话', '新话']);
    expect(merged.moments.map((m) => m.summary)).toEqual(['常去的那家店']); // 同键旧优先，不重复
    expect(merged.traits).toEqual(['话痨', '热心']); // 旧在前，新批重复项不覆盖
    expect(merged.interests).toEqual([{ ts: '2024-03-01', topic: '任天堂' }]); // 同 topic 旧优先
    expect(merged.threads.map((t) => t.text)).toEqual(['说好一起去看海', '下次一起爬山']);
  });

  it('无旧脸谱（full 补位调用）：合并结果即新批素材', () => {
    const merged = mergeWithOld(
      {
        events: [{ ts: '2024-05-01', summary: '约饭' }],
        quotes: [],
        moments: [],
        traits: ['热心'],
        interests: [],
        threads: [],
      },
      undefined
    );
    expect(merged).toEqual({
      events: [{ ts: '2024-05-01', summary: '约饭' }],
      quotes: [],
      moments: [],
      traits: ['热心'],
      interests: [],
      threads: [],
    });
  });

  it('旧 digest 无 interests/threads 字段（issue 455 前老数据）：从空起并入新批，不丢不炸', () => {
    const merged = mergeWithOld(
      {
        events: [],
        quotes: [],
        moments: [],
        traits: [],
        interests: [{ ts: '2024-05-01', topic: '五月天' }],
        threads: [{ ts: '2024-05-01', text: '有空吗' }],
      },
      {
        portrait: '旧画像',
        events: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
      }
    );
    expect(merged.interests).toEqual([{ ts: '2024-05-01', topic: '五月天' }]);
    expect(merged.threads).toEqual([{ ts: '2024-05-01', text: '有空吗' }]);
  });
});

describe('mergeManualEvents', () => {
  const ev = (ts: string, summary: string): FaceEvent => ({ ts, summary });
  const man = (ts: string, summary: string): ManualEvent => ({ id: `m-${ts}-${summary}`, ts, summary, createdAt: '2026-09-01T00:00:00.000Z' });

  it('无随手记原样返回；有则按 ts|summary 去重并整体按日期升序', () => {
    const events = [ev('2024-06-01', '约饭')];
    expect(mergeManualEvents(events, undefined)).toBe(events);
    expect(mergeManualEvents(events, [])).toBe(events);

    const merged = mergeManualEvents(
      [ev('2024-06-01', '约饭')],
      [man('2024-06-01', '约饭'), man('2024-01-01', '更早的事'), man('2024-06-02', '看电影')]
    );
    expect(merged.map((e) => `${e.ts} ${e.summary}`)).toEqual([
      '2024-01-01 更早的事',
      '2024-06-01 约饭',
      '2024-06-02 看电影',
    ]);
  });

  it('随手记残缺项（缺日期或缺内容）剔除', () => {
    const merged = mergeManualEvents([], [man('', '没日期'), man('2024-05-01', ''), man('2024-05-01', '完整')]);
    expect(merged).toEqual([ev('2024-05-01', '完整')]);
  });
});

describe('buildFaceIncremental（假 ask，双卷三调用）', () => {
  function oldDigest(): FaceDigest {
    return {
      portrait: '## 画像速写\n旧画像',
      events: [{ ts: '2024-04-01', summary: '旧事件' }],
      quotes: Array.from({ length: 60 }, (_, i) => ({ ts: '2024-04-01', who: '对方', text: `旧-${i}` })),
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
  }
  /** 60 条旧原话 + 10 条新原话：合并去重 70 条，均匀抽样 60 后首尾必保 */
  function setupAsk() {
    const prompts: string[] = [];
    const askExtract = vi.fn(async () =>
      JSON.stringify({
        events: [{ ts: '2024-05-01', kind: 'major', summary: '约饭' }],
        traits: ['热心'],
        quotes: Array.from({ length: 10 }, (_, i) => ({ ts: '2024-05-01', who: '我', text: `新-${i}` })),
        moments: [],
      })
    );
    // 三次文本调用：其人 → 我们 → 时间线（按 prompt 特征分支）
    const askPortrait = vi.fn(async (p: string) => {
      prompts.push(p);
      if (p.includes('关系时间线')) return '## 2024 年';
      if (p.includes('要产出的卷二')) return '## 关系定性\n稳';
      return '## 画像速写\n稳';
    });
    return { prompts, askExtract, askPortrait };
  }

  it('新素材不再被旧素材挤出：合并抽样后首尾必保，新原话仍进其人 prompt（评审 P1-1）', async () => {
    const { prompts, askExtract, askPortrait } = setupAsk();
    const onProgress = vi.fn();
    const onMaterial = vi.fn();
    const face = await buildFaceIncremental(askExtract, askPortrait, [msg(0, '聊起来')], '老王', oldDigest(), { onProgress, onMaterial });

    expect(askExtract).toHaveBeenCalledTimes(1);
    expect(askPortrait).toHaveBeenCalledTimes(3); // 其人 + 我们 + 时间线
    // 阶段化进度（issue 455 四阶段）：单批 extracting → person → bond → chronicle
    const [chunk] = chunkMessages([msg(0, '聊起来')]);
    expect(onProgress.mock.calls).toEqual([
      [{ stage: 'extracting', done: 1, total: 1, current: chunkMetaOf(chunk) }],
      [{ stage: 'person', done: 0, total: 1 }],
      [{ stage: 'bond', done: 0, total: 1 }],
      [{ stage: 'chronicle', done: 0, total: 1 }],
    ]);
    // 中间计数（旧 + 新合并去重后、抽样前口径，issue 450）
    expect(onMaterial).toHaveBeenCalledWith({ events: 2, quotes: 70, moments: 0, traits: 1 });
    // 落盘事件保持全量 + 新 kind 回填
    expect(face.events).toEqual([
      { ts: '2024-04-01', summary: '旧事件' },
      { ts: '2024-05-01', summary: '约饭', kind: 'major' },
    ]);
    // 原话 70 条去重后均匀抽样 60：首条是旧素材、末条是最新新素材（旧 slice 留头会把新素材全挤掉）
    expect(face.quotes).toHaveLength(60);
    expect(face.quotes[0].text).toBe('旧-0');
    expect(face.quotes[59].text).toBe('新-9');
    // 双卷产物各自落位
    expect(face.person).toContain('画像速写');
    expect(face.bond).toContain('关系定性');
    // 其人 prompt 吃到了新素材
    expect(prompts[0]).toContain('新-9');
    expect(prompts[0]).toContain('旧-0');
    // 时间线 prompt 吃到合并后的全量事件
    expect(prompts[2]).toContain('旧事件');
    expect(prompts[2]).toContain('约饭');
    expect(face.chronicle).toBe('## 2024 年');
  });

  it('双卷（issue 455）：旧 interests/threads 并入新批（同键旧优先）随 BuiltFace 返回并进 prompt', async () => {
    const { prompts, askExtract, askPortrait } = setupAsk();
    const old: FaceDigest = {
      portrait: '旧',
      events: [],
      interests: [{ ts: '2024-03-01', topic: '任天堂' }],
      threads: [{ ts: '2024-03-01', text: '说好一起去看海' }],
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    const askExtract2 = vi.fn(async () =>
      JSON.stringify({
        events: [],
        traits: [],
        quotes: [],
        moments: [],
        interests: [
          { ts: '2024-05-01', topic: '任天堂' }, // 与旧重复 → 留旧
          { ts: '2024-05-02', topic: '五月天' },
        ],
        threads: [{ ts: '2024-05-01', text: '下次一起爬山' }],
      })
    );
    const face = await buildFaceIncremental(askExtract2, askPortrait, [msg(0, '聊起来')], '老王', old);
    expect(face.interests.map((i) => i.topic)).toEqual(['任天堂', '五月天']);
    expect(face.interests[0].ts).toBe('2024-03-01'); // 同 topic 旧条目优先
    expect(face.threads.map((t) => t.text)).toEqual(['说好一起去看海', '下次一起爬山']);
    // 卷一 prompt 吃兴趣信号；卷二 prompt 吃未竟线索
    expect(prompts[0]).toContain('五月天');
    expect(prompts[1]).toContain('说好一起去看海');
    expect(prompts[1]).toContain('下次一起爬山');
  });

  it('时间线失败不阻断双卷；空消息 / 空卷一 / 空卷二抛错', async () => {
    const { askExtract, askPortrait } = setupAsk();
    const flaky = vi.fn(async (p: string) => {
      if (p.includes('关系时间线')) throw new Error('模型抽风');
      if (p.includes('要产出的卷二')) return '## 关系定性\n稳';
      return '## 画像速写\n稳';
    });
    const face = await buildFaceIncremental(askExtract, flaky, [msg(0)], '老王', oldDigest());
    expect(face.person).toContain('画像速写');
    expect(face.bond).toContain('关系定性');
    expect(face.chronicle).toBe('');

    await expect(buildFaceIncremental(askExtract, askPortrait, [], '老王', undefined)).rejects.toThrow('没有可提炼的文本消息');
    await expect(buildFaceIncremental(askExtract, async () => '   ', [msg(0)], '老王', undefined)).rejects.toThrow('卷一《其人》生成为空');
    await expect(
      buildFaceIncremental(askExtract, async (p) => (p.includes('要产出的卷二') ? '   ' : '## 画像速写\n稳'), [msg(0)], '老王', undefined)
    ).rejects.toThrow('卷二《我们》生成为空');
  });

  it('mediaNote 传入其人 / 我们 / 时间线 prompt（issue 445）', async () => {
    const { prompts, askExtract, askPortrait } = setupAsk();
    await buildFaceIncremental(askExtract, askPortrait, [msg(0, '聊起来')], '老王', oldDigest(), { mediaNote: '跨导入媒体说明' });
    expect(prompts[0]).toContain('素材说明：跨导入媒体说明');
    expect(prompts[1]).toContain('素材说明：跨导入媒体说明');
    expect(prompts[2]).toContain('素材说明：跨导入媒体说明');
  });

  it('旧 moments / traits 与新批合并去重并随 BuiltFace 返回（issue 449：增量不再丢共同记忆与表达 DNA）', async () => {
    const prompts: string[] = [];
    const old: FaceDigest = {
      portrait: '## 画像速写\n旧画像',
      events: [{ ts: '2024-04-01', summary: '旧事件' }],
      quotes: [],
      moments: [
        { ts: '2024-03-01', summary: '常去的那家店' },
        { ts: '2024-03-02', summary: '凌晨的便利店' },
      ],
      traits: ['话痨', '细节控'],
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    const askExtract = vi.fn(async () =>
      JSON.stringify({
        events: [],
        traits: ['热心', '话痨'], // 话痨与旧重复 → 去重留旧条目
        quotes: [],
        moments: [
          { ts: '2024-05-01', summary: '常去的那家店' }, // 与旧重复
          { ts: '2024-05-02', summary: '一起看过的展' },
        ],
      })
    );
    const askPortrait = vi.fn(async (p: string) => {
      prompts.push(p);
      if (p.includes('关系时间线')) return '## 2024 年';
      if (p.includes('要产出的卷二')) return '## 关系定性\n稳';
      return '## 画像速写\n稳';
    });
    const face = await buildFaceIncremental(askExtract, askPortrait, [msg(0, '聊起来')], '老王', old);
    // 旧素材不丢、新素材并入、重复去重（旧在前故同键留旧）
    expect(face.moments.map((m) => m.summary)).toEqual(['常去的那家店', '凌晨的便利店', '一起看过的展']);
    expect(face.traits).toEqual(['话痨', '细节控', '热心']);
    // 合并后的旧素材也进其人 prompt（重画不丢）
    expect(prompts[0]).toContain('凌晨的便利店');
    expect(prompts[0]).toContain('细节控');
    expect(prompts[0]).toContain('一起看过的展');
  });

  it('旧 + 新合并超上限：均匀抽样到 MATERIAL_LIMITS 首尾必保（旧的首条与最新的末条都在）', async () => {
    const old: FaceDigest = {
      portrait: '旧',
      events: [],
      quotes: [],
      moments: [],
      traits: Array.from({ length: 35 }, (_, i) => `旧特质-${i}`),
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    const askExtract = vi.fn(async () =>
      JSON.stringify({ events: [], traits: Array.from({ length: 5 }, (_, i) => `新特质-${i}`), quotes: [], moments: [] })
    );
    const face = await buildFaceIncremental(askExtract, async () => '## 画像速写', [msg(0, '聊起来')], '老王', old);
    expect(face.traits).toHaveLength(30); // 35 旧 + 5 新去重 40 条 → 抽样到 traits 上限
    expect(face.traits[0]).toBe('旧特质-0');
    expect(face.traits[29]).toBe('新特质-4');
  });

  it('statsNote 透传三路 prompt（issue 449）；profile 进两卷素材〇（issue 455）', async () => {
    const { prompts, askExtract, askPortrait } = setupAsk();
    await buildFaceIncremental(
      askExtract,
      askPortrait,
      [msg(0, '聊起来')],
      '老王',
      oldDigest(),
      {
        mediaNote: '跨导入媒体说明',
        statsNote: '互动画像：会话我发起 12 次、对方发起 5 次。',
        profile: { birthday: '1994-02-14', tags: ['同学'] },
      }
    );
    expect(prompts[0]).toContain('## 素材六：互动统计');
    expect(prompts[0]).toContain('会话我发起 12 次、对方发起 5 次');
    expect(prompts[1]).toContain('## 素材五：互动统计');
    expect(prompts[1]).toContain('互动画像：会话我发起 12 次、对方发起 5 次');
    expect(prompts[2]).toContain('互动画像：会话我发起 12 次、对方发起 5 次');
    expect(prompts[0]).toContain('## 素材〇：档案');
    expect(prompts[0]).toContain('生日：1994-02-14');
    expect(prompts[1]).toContain('生日：1994-02-14');
    expect(prompts[2]).not.toContain('生日：1994-02-14'); // 时间线不吃档案段（口径不变）
  });
});
