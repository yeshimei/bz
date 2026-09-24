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
  planIncremental,
} from '../../src/people/incremental';
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

describe('buildFaceIncremental（假 ask）', () => {
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
    const askPortrait = vi.fn(async (p: string) => {
      prompts.push(p);
      return prompts.length === 1 ? '## 画像速写\n稳' : '## 2024 年';
    });
    return { prompts, askExtract, askPortrait };
  }

  it('新素材不再被旧素材挤出：合并抽样后首尾必保，新原话仍进画像 prompt（评审 P1-1）', async () => {
    const { prompts, askExtract, askPortrait } = setupAsk();
    const onProgress = vi.fn();
    const face = await buildFaceIncremental(askExtract, askPortrait, [msg(0, '聊起来')], '老王', oldDigest(), onProgress);

    expect(askExtract).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(1, 1);
    // 落盘事件保持全量 + 新 kind 回填
    expect(face.events).toEqual([
      { ts: '2024-04-01', summary: '旧事件' },
      { ts: '2024-05-01', summary: '约饭', kind: 'major' },
    ]);
    // 原话 70 条去重后均匀抽样 60：首条是旧素材、末条是最新新素材（旧 slice 留头会把新素材全挤掉）
    expect(face.quotes).toHaveLength(60);
    expect(face.quotes[0].text).toBe('旧-0');
    expect(face.quotes[59].text).toBe('新-9');
    // 画像 prompt 吃到了新素材
    expect(prompts[0]).toContain('新-9');
    expect(prompts[0]).toContain('旧-0');
    // 时间线 prompt 吃到合并后的全量事件
    expect(prompts[1]).toContain('旧事件');
    expect(prompts[1]).toContain('约饭');
    expect(face.chronicle).toBe('## 2024 年');
  });

  it('时间线失败不阻断画像；空消息 / 空画像抛错', async () => {
    const { askExtract, askPortrait } = setupAsk();
    const flaky = vi.fn(async (p: string) => {
      if (p.includes('关系时间线')) throw new Error('模型抽风');
      return '## 画像速写\n稳';
    });
    const face = await buildFaceIncremental(askExtract, flaky, [msg(0)], '老王', oldDigest());
    expect(face.portrait).toContain('画像速写');
    expect(face.chronicle).toBe('');

    await expect(buildFaceIncremental(askExtract, askPortrait, [], '老王', undefined)).rejects.toThrow('没有可提炼的文本消息');
    await expect(buildFaceIncremental(askExtract, async () => '   ', [msg(0)], '老王', undefined)).rejects.toThrow('画像生成为空');
  });
});
