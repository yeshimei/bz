// @vitest-environment node
/**
 * 剪藏本·每日简报（ADR-0119 / issue 263）数据层与 AI 环节测试。
 * 覆盖：简报条目派生（clipBrief / queryBriefs / 按天分节）、容错解析与保留策略、
 * briefKeyOf 稳定键、要点生成（pendingBriefs / prompt / 清洗 / runBriefSummaries 三种结果）。
 */
import { describe, it, expect } from 'vitest';
import { briefKeyOf, excerpt } from '../../src/clipbook/constants';
import { normalizeBrief, parseBriefs, applyBriefRetention } from '../../src/clipbook/news-data';
import { clipBrief, queryBriefs, groupBriefsByDay, briefTimeTs, briefDayKey } from '../../src/clipbook/store';
import { pendingBriefs, buildBriefPrompt, cleanPoints, runBriefSummaries } from '../../src/clipbook/brief';
import type { ClipbookData } from '../../src/clipbook/data';

const emptySidecar = (): ClipbookData => ({ articleOverrides: {}, savedArchive: [], order: [] });

/** 一条正常简报条目（body 已出稿） */
function brief(over: any = {}) {
  return {
    bvid: 'BV1rHYx6fEzy',
    title: '走向灭亡！Anthropic 员工警告',
    url: 'https://www.bilibili.com/video/BV1rHYx6fEzy',
    upMid: '3706929260006322',
    upName: '黑鸦Heya',
    duration: 173,
    pubdate: 1788951454,
    date: '2026-09-09 10:00:00',
    fetchedAt: '2026-09-10 12:00:00',
    body: '## 人事变动\n- Anthropic 员工公开警告\n- 涉及 ASI 风险',
    src: 'transcript',
    transcriptPath: 'C:/tmp/resume-brief-BV1rHYx6fEzy.txt',
    read: false,
    state: 'unread',
    ...over,
  };
}

describe('briefKeyOf（稳定标识键）', () => {
  it('bvid 优先，其次 url，最后 title|fetchedAt', () => {
    expect(briefKeyOf({ bvid: 'BV1' })).toBe('bv:BV1');
    expect(briefKeyOf({ url: 'https://x' })).toBe('url:https://x');
    expect(briefKeyOf({ title: 'T', fetchedAt: 'F' })).toBe('td:T|F');
    expect(briefKeyOf(null)).toBe('td:|');
  });
});

describe('normalizeBrief / parseBriefs（容错解析）', () => {
  it('丢弃无 bvid 与非对象项', () => {
    expect(normalizeBrief({ title: 'x' })).toBeNull();
    expect(normalizeBrief('x')).toBeNull();
    expect(normalizeBrief(null)).toBeNull();
    expect(parseBriefs('nope')).toEqual([]);
    expect(parseBriefs([null, { title: '无 bvid' }, { bvid: 'BV1' }]).length).toBe(1);
  });

  it('字段归一：url 缺失按 bvid 补全；read/state 缺省未读；body/src/error 缺省省键', () => {
    const b = normalizeBrief({ bvid: 'BV9' }) as any;
    expect(b.url).toBe('https://www.bilibili.com/video/BV9');
    expect(b.read).toBe(false);
    expect(b.state).toBe('unread');
    expect('body' in b).toBe(false);
    expect('error' in b).toBe(false);
    expect(b.duration).toBe(0);
  });

  it('state 归一：read=true → read；state=saved 保留', () => {
    expect(normalizeBrief({ bvid: 'BV1', read: true })!.state).toBe('read');
    expect(normalizeBrief({ bvid: 'BV1', state: 'saved' })!.state).toBe('saved');
    expect(normalizeBrief({ bvid: 'BV1', state: 'saved', read: true })!.state).toBe('saved');
  });
});

describe('applyBriefRetention（保留策略，ADR-0119 §13）', () => {
  const now = new Date('2026-09-10 12:00:00').getTime();
  it('未读永不清理（含待出稿与错误条目）', () => {
    const old = brief({ read: false, fetchedAt: '2020-01-01 00:00:00' });
    const oldErr = brief({ bvid: 'BV2', error: '转写失败', fetchedAt: '2020-01-01 00:00:00' });
    expect(applyBriefRetention([old, oldErr], 30, now).length).toBe(2);
  });
  it('已读骨架超期删除、未超期保留', () => {
    const stale = brief({ bvid: 'BV_A', read: true, state: 'read', fetchedAt: '2026-01-01 00:00:00' });
    const fresh = brief({ bvid: 'BV_B', read: true, state: 'read', fetchedAt: '2026-09-09 00:00:00' });
    const kept = applyBriefRetention([stale, fresh], 30, now);
    expect(kept.map((b) => b.bvid)).toEqual(['BV_B']);
  });
  it('天数非法 → 全保留；起算时间非法 → 保守保留', () => {
    expect(applyBriefRetention([brief({ read: true })], 0, now).length).toBe(1);
    expect(applyBriefRetention([brief({ read: true, fetchedAt: '', date: '' })], 30, now).length).toBe(1);
  });
});

describe('clipBrief（简报条目 → ClipArticle 派生）', () => {
  it('基本字段与状态映射', () => {
    const a = clipBrief(brief());
    expect(a.id).toBe('bv:BV1rHYx6fEzy');
    expect(a.origin).toBe('brief');
    expect(a.title).toBe('走向灭亡！Anthropic 员工警告');
    expect(a.url).toBe('https://www.bilibili.com/video/BV1rHYx6fEzy');
    expect(a.site).toBe('B站');
    expect(a.domain).toBe('bilibili.com');
    expect(a.author).toBe('黑鸦Heya');
    expect(a.st).toBe('unread');
    expect(a.body).toContain('Anthropic 员工公开警告');
    expect(a.summary).toBe(excerpt(brief().body, 110));
  });

  it('UP 名回退链：upName → bilibiliUpInfo → upMid', () => {
    expect(clipBrief(brief({ upName: '' }), { upInfo: { '3706929260006322': { name: '黑鸦' } } }).author).toBe('黑鸦');
    expect(clipBrief(brief({ upName: '', upMid: '3706929260006322' })).author).toBe('3706929260006322');
    expect(clipBrief(brief({ upName: '', upMid: '' })).srcName).toBe('每日简报');
  });

  it('状态机：saved > read > unread；侧写归档同样折 saved', () => {
    expect(clipBrief(brief({ read: true, state: 'read' })).st).toBe('read');
    expect(clipBrief(brief({ read: true, state: 'saved' })).st).toBe('saved');
    const side = emptySidecar();
    side.savedArchive = [{ url: brief().url, title: 'x', savedAt: '' }];
    expect(clipBrief(brief({ read: false }), { savedKeys: new Set([brief().url]) }).st).toBe('saved');
  });

  it('失败条目：标题回退 bvid、summary 用错误原因（列表可见）', () => {
    const a = clipBrief(brief({ title: '', body: undefined, error: '转文字失败：未配置 pythonPath' }));
    expect(a.title).toBe('BV1rHYx6fEzy');
    expect(a.summary).toBe('转文字失败：未配置 pythonPath');
  });
});

describe('queryBriefs / groupBriefsByDay（时间降序 + 按天分节）', () => {
  it('时间降序（pubdate 优先）', () => {
    const list = queryBriefs([
      brief({ bvid: 'BV_OLD', pubdate: 1788000000 }),
      brief({ bvid: 'BV_NEW', pubdate: 1789000000 }),
    ], emptySidecar());
    expect(list.map((a) => a.raw.bvid)).toEqual(['BV_NEW', 'BV_OLD']);
  });

  it('briefTimeTs：pubdate 缺失回退 fetchedAt；非法回退当前时刻', () => {
    expect(briefTimeTs({ pubdate: 1788951454 })).toBe(1788951454000);
    expect(briefTimeTs({ fetchedAt: '2026-09-10 12:00:00' })).toBe(new Date('2026-09-10 12:00:00').getTime());
    expect(Number.isFinite(briefTimeTs({}))).toBe(true);
  });

  it('briefDayKey：pubdate → 本地日；无则取 date 前 10 位；都无 → 未知日期', () => {
    expect(briefDayKey({ pubdate: new Date(2026, 8, 10, 9, 0, 0).getTime() / 1000 })).toBe('2026-09-10');
    expect(briefDayKey({ date: '2026-09-09 10:00:00' })).toBe('2026-09-09');
    expect(briefDayKey({})).toBe('未知日期');
  });

  it('按天分节：同日成组、节序按时间降序、节内保序', () => {
    const d1 = new Date(2026, 8, 10, 9, 0, 0).getTime() / 1000;
    const d0 = new Date(2026, 8, 9, 9, 0, 0).getTime() / 1000;
    const list = queryBriefs([
      brief({ bvid: 'BV_A', pubdate: d1 }),
      brief({ bvid: 'BV_B', pubdate: d0 }),
      brief({ bvid: 'BV_C', pubdate: d1 - 60 }),
    ], emptySidecar());
    const groups = groupBriefsByDay(list);
    expect(groups.map((g) => g.day)).toEqual(['2026-09-10', '2026-09-09']);
    expect(groups[0].items.map((a) => a.raw.bvid)).toEqual(['BV_A', 'BV_C']);
    expect(groups[1].items.map((a) => a.raw.bvid)).toEqual(['BV_B']);
  });
});

describe('待出稿扫描与提示词', () => {
  it('pendingBriefs：有 bvid、无 body、无 error、有转录稿路径', () => {
    const list = [
      brief(),                                                  // 已有 body → 不是待出稿
      brief({ bvid: 'BV_P', body: undefined }),                  // 待出稿
      brief({ bvid: 'BV_E', body: undefined, error: 'x' }),       // 失败条目 → 不自动重跑
      brief({ bvid: 'BV_N', body: undefined, transcriptPath: '' }), // 无转录稿 → 跳过
    ];
    expect(pendingBriefs(list).map((b) => b.bvid)).toEqual(['BV_P']);
  });

  it('buildBriefPrompt：含标题/UP/时长/转录；明确不要时间轴', () => {
    const p = buildBriefPrompt(brief({ body: undefined }), '转录正文');
    expect(p).toContain('走向灭亡！Anthropic 员工警告');
    expect(p).toContain('黑鸦Heya');
    expect(p).toContain('173 秒');
    expect(p).toContain('转录正文');
    expect(p).toContain('不要输出时间轴');
  });

  it('buildBriefPrompt：超长转录截断到上限', () => {
    const p = buildBriefPrompt({ title: 't' }, 'x'.repeat(50000));
    expect(p.length).toBeLessThan(20000);
  });

  it('cleanPoints：去代码围栏与首尾空白', () => {
    expect(cleanPoints('```markdown\n## A\n- b\n```')).toBe('## A\n- b');
    expect(cleanPoints('  ## A  ')).toBe('## A');
    expect(cleanPoints('')).toBe('');
  });
});

describe('runBriefSummaries（AI 要点生成与回写）', () => {
  const mk = (over: any = {}) => ({ ...brief({ body: undefined }), ...over });

  it('无待出稿 → 零开销返回', async () => {
    const r = await runBriefSummaries([brief()], {});
    expect(r).toEqual({ done: 0, failed: 0, skipped: 0 });
  });

  it('正常出稿：写 body 并清 error；幂等（不重复处理已有 body 的条目）', async () => {
    const patches: Array<[string, any]> = [];
    const r = await runBriefSummaries([mk()], {
      ai: { chat: async () => '```markdown\n## 小节\n- 要点一\n- 要点二\n```' },
      readText: () => '转录全文',
      writePatch: async (bvid, patch) => { patches.push([bvid, patch]); },
    });
    expect(r).toEqual({ done: 1, failed: 0, skipped: 0 });
    expect(patches[0][0]).toBe('BV1rHYx6fEzy');
    expect(patches[0][1].body).toBe('## 小节\n- 要点一\n- 要点二');
    expect(patches[0][1].error).toBeUndefined();
  });

  it('转录稿取不到 → 记 skip，不写 error', async () => {
    const patches: any[] = [];
    const r = await runBriefSummaries([mk()], {
      ai: { chat: async () => 'x' },
      readText: () => null,
      writePatch: async (bvid, patch) => { patches.push(patch); },
    });
    expect(r).toEqual({ done: 0, failed: 0, skipped: 1 });
    expect(patches.length).toBe(0);
  });

  it('AI 未配置 → 写可见错误条目', async () => {
    const patches: any[] = [];
    const r = await runBriefSummaries([mk()], {
      ai: null,
      readText: () => '转录',
      writePatch: async (bvid, patch) => { patches.push(patch); },
    });
    expect(r).toEqual({ done: 0, failed: 1, skipped: 0 });
    expect(String(patches[0].error)).toContain('AI 未配置');
  });

  it('AI 调用失败 → 写错误、其余条目继续', async () => {
    const patches: any[] = [];
    let n = 0;
    const r = await runBriefSummaries([mk(), mk({ bvid: 'BV_OK' })], {
      ai: { chat: async () => { n++; if (n === 1) throw new Error('429 限流'); return '## A\n- b'; } },
      readText: () => '转录',
      writePatch: async (bvid, patch) => { patches.push({ bvid, ...patch }); },
    });
    expect(r).toEqual({ done: 1, failed: 1, skipped: 0 });
    expect(String(patches[0].error)).toContain('429 限流');
    expect(patches[1].body).toBe('## A\n- b');
  });

  it('AI 产出为空 → 记失败（不写空 body）', async () => {
    const patches: any[] = [];
    const r = await runBriefSummaries([mk()], {
      ai: { chat: async () => '   \n  ' },
      readText: () => '转录',
      writePatch: async (bvid, patch) => { patches.push(patch); },
    });
    expect(r.failed).toBe(1);
    expect(patches[0].body).toBeUndefined();
    expect(String(patches[0].error)).toContain('产出为空');
  });
});
