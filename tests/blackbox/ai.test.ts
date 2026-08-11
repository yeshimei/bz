/**
 * 黑匣子 AI 纯函数测试（ticket 39/41/42/45）：人设 prompt v2（画像概要/事件标题）/复盘/事件提炼/
 * 画像提炼/三类录入辅助/JSON 容错/条目检索。
 */
import { describe, it, expect } from 'vitest';
import {
  buildPersonaPrompt,
  buildReviewPrompt,
  buildEventExtractPrompt,
  buildProfileExtractPrompt,
  buildProfileObservationPrompt,
  buildAssistPrompt,
  parseReviewJson,
  parseEventExtractJson,
  parseProfileJson,
  parseConceptJson,
  parseLiteratureJson,
  searchEntries,
  buildProfilesSummary,
  buildEventTitlesByEntry,
  fallbackAsk,
  FALLBACK_ASK_PROMPTS,
} from '../../src/blackbox/ai';
import { DEFAULT_PERSONA } from '../../src/blackbox/types';
import type { Entry, Profile } from '../../src/blackbox/types';
import { createEntry, createEvent } from '../../src/blackbox/data';

const thought = (id: string, text: string, extra?: Partial<Entry>): Entry =>
  createEntry({ id, type: 'thought', text, createdAt: '2026-07-21T02:06:00.000Z', ...extra });
const concept = (id: string, name: string, definition: string): Entry =>
  createEntry({ id, type: 'concept', name, definition, createdAt: '2026-07-21T02:06:00.000Z' });

describe('buildPersonaPrompt 三层记忆组装（v2）', () => {
  it('包含种子/计数/相关条目/历史/当前消息', () => {
    const p = buildPersonaPrompt(
      {
        persona: DEFAULT_PERSONA,
        related: [thought('i1', '茉莉花的香气', { emotions: ['温暖'] })],
        entryCount: 5,
        history: [{ role: 'user', text: '你还记得茉莉花吗', ts: 't1' }],
        profilesSummary: [],
        eventTitlesByEntry: new Map(),
      },
      '我今晚又闻到了'
    );
    expect(p).toContain('包仔');
    expect(p).toContain(DEFAULT_PERSONA.seed);
    expect(p).toContain('5 条内容');
    expect(p).toContain('茉莉花的香气');
    expect(p).toContain('你还记得茉莉花吗');
    expect(p).toContain('我今晚又闻到了');
  });

  it('画像概要进入上下文；命中条目附事件标题', () => {
    const p = buildPersonaPrompt(
      {
        persona: DEFAULT_PERSONA,
        related: [thought('i1', '给妹妹买吉他')],
        entryCount: 3,
        history: [],
        profilesSummary: ['妹妹（家人）；印象：很要强；最近事件：给妹妹买吉他'],
        eventTitlesByEntry: new Map([['i1', ['给妹妹买吉他']]]),
      },
      '妹妹最近好吗'
    );
    expect(p).toContain('你认识的人');
    expect(p).toContain('妹妹（家人）');
    expect(p).toContain('最近事件：给妹妹买吉他');
    expect(p).toContain('这些内容对应的事件');
  });

  it('画像/事件缺失时（尚未提炼）省略对应区块（v1 行为兼容）', () => {
    const p = buildPersonaPrompt(
      { persona: DEFAULT_PERSONA, related: [], entryCount: 0, history: [], profilesSummary: [], eventTitlesByEntry: new Map() },
      '你好'
    );
    expect(p).not.toContain('你认识的人');
    expect(p).not.toContain('这些内容对应的事件');
    expect(p).not.toContain('最近的对话');
    expect(p).toContain('0 条内容');
  });
});

describe('buildReviewPrompt 复盘 prompt', () => {
  it('列出最近条目并要求 JSON 输出（text/newSelfView）', () => {
    const p = buildReviewPrompt(DEFAULT_PERSONA, [thought('i1', 'A'), thought('i2', 'B')], 12);
    expect(p).toContain('12 条内容');
    expect(p).toContain('最近 2 条');
    expect(p).toContain('"text"');
    expect(p).toContain('"newSelfView"');
  });
});

describe('buildEventExtractPrompt 事件提炼', () => {
  it('包含条目列表、既有事件标题去重指令与 inferred 语义', () => {
    const p = buildEventExtractPrompt([thought('i1', '给妹妹买了吉他')], ['给妹妹买吉他'], 30);
    expect(p).toContain('30 条');
    expect(p).toContain('已经记录过的事件标题');
    expect(p).toContain('给妹妹买吉他');
    expect(p).toContain('"inferred"');
    expect(p).toContain('"events"');
  });
});

describe('画像 prompt', () => {
  it('buildProfileExtractPrompt：初始印象', () => {
    const p = buildProfileExtractPrompt('妹妹', [thought('i1', '她考上了')]);
    expect(p).toContain('妹妹');
    expect(p).toContain('她考上了');
    expect(p).toContain('"impression"');
  });

  it('buildProfileObservationPrompt：观察增量（第一人称）', () => {
    const pf: Profile = { id: 'pf_1', name: '妹妹', relation: '家人', impression: '', aiObservations: [], pinnedEvents: [], createdAt: 't' };
    const p = buildProfileObservationPrompt(pf, [thought('i1', '想她')]);
    expect(p).toContain('妹妹');
    expect(p).toContain('"observation"');
  });
});

describe('buildAssistPrompt 录入辅助（v2 三类）', () => {
  it('concept：知识卡片 JSON（含既有概念对照）', () => {
    const p = buildAssistPrompt('concept', '提喻法', [], [concept('c1', '借代', 'x')]);
    expect(p).toContain('提喻法');
    expect(p).toContain('借代');
    expect(p).toContain('"relatedNames"');
  });

  it('literature：名词表分析 JSON（matched/newConcepts）', () => {
    const p = buildAssistPrompt('literature', '某本书', [], [concept('c1', '熵增', 'x')]);
    expect(p).toContain('某本书');
    expect(p).toContain('熵增');
    expect(p).toContain('"newConcepts"');
  });

  it('recall：联想旧内容；ask：温柔追问', () => {
    const p = buildAssistPrompt('recall', '茉莉花', [thought('i1', '茉莉花的香气')]);
    expect(p).toContain('这让我想起');
    const q = buildAssistPrompt('ask', '想妈妈了');
    expect(q).toContain('想妈妈了');
    expect(q.length).toBeGreaterThan(10);
  });
});

describe('JSON 容错解析', () => {
  it('parseReviewJson：首对花括号提取；非 JSON 回退 null', () => {
    expect(parseReviewJson('好的，输出如下：{"text": "你好", "newSelfView": "我成长了"} 完')).toEqual({
      text: '你好',
      newSelfView: '我成长了',
    });
    expect(parseReviewJson('没有 JSON')).toBeNull();
    expect(parseReviewJson('')).toBeNull();
    expect(parseReviewJson('{"text": ""}')).toBeNull();
  });

  it('parseEventExtractJson：数组过滤非法项；confidence<0.6 亦推断为推测', () => {
    const out = parseEventExtractJson(
      '{"events": [{"title": "买吉他", "time": "2026-08-01", "inferred": false, "confidence": 0.9}, {"title": "", "x": 1}, {"title": "想买房", "confidence": 0.3}]}'
    );
    expect(out.length).toBe(2);
    expect(out[0].title).toBe('买吉他');
    expect(out[0].inferred).toBe(false);
    expect(out[1].title).toBe('想买房');
    expect(out[1].inferred).toBe(true);
    expect(parseEventExtractJson('nope')).toEqual([]);
  });

  it('parseProfileJson / parseConceptJson / parseLiteratureJson 容错', () => {
    expect(parseProfileJson('{"impression": "很要强"}')).toEqual({ impression: '很要强' });
    expect(parseProfileJson('{"observation": "我注意到了"}')).toEqual({ observation: '我注意到了' });
    expect(parseProfileJson('x')).toBeNull();
    expect(parseConceptJson('{"definition": "一种修辞", "relatedNames": ["借代"]}')).toEqual({
      definition: '一种修辞',
      relatedNames: ['借代'],
    });
    expect(parseConceptJson('{}')).toBeNull();
    expect(parseLiteratureJson('{"matched": ["熵增"], "newConcepts": ["提喻法"]}')).toEqual({
      matched: ['熵增'],
      newConcepts: ['提喻法'],
    });
    expect(parseLiteratureJson('bad')).toBeNull();
  });
});

describe('searchEntries 条目检索（跨三类）', () => {
  it('concept 按 name+definition 检索；thought 按 text', () => {
    const entries = [
      concept('c1', '提喻法', '以部分代整体的修辞'),
      thought('t1', '茉莉花的香气', { people: ['妹妹'] }),
    ];
    expect(searchEntries(entries, '提喻法', 5).map((e) => e.id)).toEqual(['c1']);
    expect(searchEntries(entries, '茉莉花', 5).map((e) => e.id)).toEqual(['t1']);
    expect(searchEntries(entries, '', 5)).toEqual([]);
  });
});

describe('画像/事件概要（ticket 45 记忆扩展）', () => {
  const pf: Profile = { id: 'pf_1', name: '妹妹', relation: '家人', impression: '很要强', aiObservations: [], pinnedEvents: [], createdAt: 't' };
  const events = [
    createEvent({ id: 'ev_1', title: '买吉他', time: '2026-08-01', people: ['pf_1'] }),
    createEvent({ id: 'ev_2', title: '搬家', time: '2026-07-01', people: ['pf_1'] }),
    createEvent({ id: 'ev_3', title: '旅行', time: '2026-06-01', people: ['pf_1'] }),
    createEvent({ id: 'ev_4', title: '旧事', time: '2026-05-01', people: ['pf_1'] }),
  ];

  it('buildProfilesSummary：印象一句话 + 最近 3 个事件标题；预算截断', () => {
    const s = buildProfilesSummary([pf], events);
    expect(s.length).toBe(1);
    expect(s[0]).toContain('妹妹（家人）');
    expect(s[0]).toContain('印象：很要强');
    expect(s[0]).toContain('买吉他 / 搬家 / 旅行'); // 最近 3 件，旧事被裁
    expect(buildProfilesSummary([], events)).toEqual([]);
  });

  it('buildEventTitlesByEntry：命中条目附事件标题', () => {
    const entries = [thought('t1', '给妹妹买吉他'), thought('t2', '别的')];
    const events2 = [
      createEvent({ id: 'ev_1', title: '买吉他', evidence: ['t1'] }),
      createEvent({ id: 'ev_2', title: '买琴后续', evidence: ['t1'] }),
    ];
    const m = buildEventTitlesByEntry(entries, events2);
    expect(m.get('t1')).toEqual(['买吉他', '买琴后续']);
    expect(m.has('t2')).toBe(false);
  });
});

describe('fallbackAsk', () => {
  it('轮换本地追问文案', () => {
    expect(FALLBACK_ASK_PROMPTS.length).toBe(3);
    expect(fallbackAsk(0)).toBe(FALLBACK_ASK_PROMPTS[0]);
    expect(fallbackAsk(3)).toBe(FALLBACK_ASK_PROMPTS[0]);
    expect(fallbackAsk(1)).toBe(FALLBACK_ASK_PROMPTS[1]);
  });
});
