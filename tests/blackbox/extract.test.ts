/**
 * 黑匣子提炼核心测试（ticket 59）：一次 AI 调用批量提炼 {people, events, emotions}。
 * parseExtractJson 容错 / applyExtraction 应用（mentions 合并、跨日期门槛建画像、事件分级去重、情绪合并）。
 */
import { describe, it, expect } from 'vitest';
import { parseExtractJson, applyExtraction, buildExtractPrompt } from '../../src/blackbox/extract';
import { defaultBlackBoxData } from '../../src/blackbox/types';
import type { BlackBoxData, DiarySourceEntry } from '../../src/blackbox/types';

const ENTRIES: DiarySourceEntry[] = [
  { date: '2026-08-10', time: '08:30', content: '和妈妈搬完家，累但踏实。', filename: '2026-08-10', lineNumber: 1 },
  { date: '2026-08-11', time: '09:00', content: '妈妈来新家帮忙收拾。', filename: '2026-08-11', lineNumber: 1 },
  { date: '2026-08-12', time: '21:00', content: '一个人看电影。', filename: '2026-08-12', lineNumber: 3 },
];

// ===== parseExtractJson =====

describe('parseExtractJson', () => {
  it('正常 JSON → 结构化结果', () => {
    const text = JSON.stringify({
      people: [{ name: '妈妈', aliases: ['妈'], dates: ['2026-08-10', '2026-08-11'] }],
      events: [{ title: '搬家完成', confidence: 0.9, emotion: '疲惫', people: ['妈妈'], date: '2026-08-10', time: '08:30' }],
      emotions: [{ entry: '2026-08-10 08:30', tags: ['疲惫', '释然'] }],
    });
    const r = parseExtractJson(text);
    expect(r).not.toBeNull();
    expect(r!.people).toEqual([{ name: '妈妈', aliases: ['妈'], dates: ['2026-08-10', '2026-08-11'] }]);
    expect(r!.events).toHaveLength(1);
    expect(r!.events[0].confidence).toBe(0.9);
  });
  it('代码块包裹的 JSON → 剥离后解析', () => {
    const text = '```json\n{"people":[{"name":"妈妈"}],"events":[],"emotions":[]}\n```';
    const r = parseExtractJson(text);
    expect(r).not.toBeNull();
    expect(r!.people).toEqual([{ name: '妈妈', aliases: [], dates: [] }]);
  });
  it('损坏 JSON → null（不抛错）', () => {
    expect(parseExtractJson('不是 JSON')).toBeNull();
    expect(parseExtractJson('')).toBeNull();
    expect(parseExtractJson('{"people":')).toBeNull();
  });
  it('字段缺失 → 空数组默认', () => {
    const r = parseExtractJson('{"people":[{"name":"妈妈"}]}');
    expect(r!.events).toEqual([]);
    expect(r!.emotions).toEqual([]);
  });
  it('非法项过滤：缺 name/confidence 非法 → 丢弃', () => {
    const text = JSON.stringify({
      people: [{ name: '' }, { name: '妈妈' }],
      events: [{ title: '好', confidence: 0.3 }, { title: '坏' }, { title: '事件', confidence: 0.8 }],
    });
    const r = parseExtractJson(text)!;
    expect(r.people).toEqual([{ name: '妈妈', aliases: [], dates: [] }]);
    expect(r.events.map((e) => e.title)).toEqual(['事件']);
  });
});

// ===== applyExtraction =====

describe('applyExtraction', () => {
  it('people → mentions 合并（count+1，同日不建画像留在 mentions）', () => {
    const data = defaultBlackBoxData();
    data.mentions = [{ name: '老张', count: 1, firstSeen: '2026-08-10', lastSeen: '2026-08-10' }];
    // 批次条目全在 08-10（同一天）→ count 2 但不跨日期 → 留在 mentions
    const sameDay = [ENTRIES[0]];
    applyExtraction(data, { people: [{ name: '老张', aliases: [] }], events: [], emotions: [] }, sameDay);
    expect(data.mentions).toEqual([{ name: '老张', count: 2, firstSeen: '2026-08-10', lastSeen: '2026-08-10' }]);
    expect(data.profiles).toHaveLength(0);
  });

  it('跨不同日期 ≥2 次 → 自动建画像 + 从 mentions 移除', () => {
    const data = defaultBlackBoxData();
    data.mentions = [{ name: '妈妈', count: 1, firstSeen: '2026-08-10', lastSeen: '2026-08-10' }];
    // 本批 entries 跨 08-10 ~ 08-12，妈妈再次出现 → count 2 且跨日期
    applyExtraction(data, { people: [{ name: '妈妈', aliases: ['妈'] }], events: [], emotions: [] }, ENTRIES);
    expect(data.mentions).toEqual([]);
    expect(data.profiles).toHaveLength(1);
    expect(data.profiles[0].name).toBe('妈妈');
    expect(data.profiles[0].aliases).toEqual(['妈']);
    expect(data.profiles[0].mentionCount).toBe(2);
  });

  it('单次出现不建画像（留在 mentions，日期=批次范围）', () => {
    const data = defaultBlackBoxData();
    applyExtraction(data, { people: [{ name: '新朋友', aliases: [] }], events: [], emotions: [] }, ENTRIES);
    expect(data.profiles).toHaveLength(0);
    expect(data.mentions).toEqual([{ name: '新朋友', count: 1, firstSeen: '2026-08-10', lastSeen: '2026-08-12' }]);
  });

  it('events：置信度分级入库（≥0.7 confirmed / 0.5-0.7 speculative / <0.5 丢弃）', () => {
    const data = defaultBlackBoxData();
    applyExtraction(
      data,
      {
        people: [],
        events: [
          { title: '搬家完成', confidence: 0.9, date: '2026-08-10', time: '08:30' },
          { title: '可能的计划', confidence: 0.6, date: '2026-08-11', time: '09:00' },
          { title: '流水账', confidence: 0.3, date: '2026-08-12', time: '21:00' },
        ],
        emotions: [],
      },
      ENTRIES
    );
    expect(data.events).toHaveLength(2);
    expect(data.events[0].status).toBe('confirmed');
    expect(data.events[1].status).toBe('speculative');
    expect(data.events[0].title).toBe('搬家完成');
  });

  it('humanEdited 锁：用户改过的画像 AI 不更新 aliases（统计仍更新）', () => {
    const data = defaultBlackBoxData();
    const profile = { id: 'pf_1', name: '妈妈', aliases: ['母亲'], impression: '我的印象', aiObservations: [], emotions: [], mentionCount: 3, firstSeen: '2026-08-01', lastSeen: '2026-08-10', humanEdited: true, createdAt: '' };
    data.profiles.push(profile);
    applyExtraction(
      data,
      { people: [{ name: '妈妈', aliases: ['妈'], dates: ['2026-08-12'] }], events: [], emotions: [] },
      ENTRIES
    );
    // 统计更新（mentionCount+1、lastSeen 更新）
    expect(data.profiles[0].mentionCount).toBe(4);
    expect(data.profiles[0].lastSeen).toBe('2026-08-12');
    // aliases 不被 AI 追加（锁）
    expect(data.profiles[0].aliases).toEqual(['母亲']);
    // impression 不被覆盖
    expect(data.profiles[0].impression).toBe('我的印象');
  });

  it('events：source 证据链绑定（date+time → 条目 lineNumber）', () => {
    const data = defaultBlackBoxData();
    applyExtraction(
      data,
      { people: [], events: [{ title: '搬家完成', confidence: 0.9, date: '2026-08-10', time: '08:30' }], emotions: [] },
      ENTRIES
    );
    expect(data.events[0].source).toEqual({ path: '2026-08-10', lineNumber: 1, time: '08:30' });
    expect(data.events[0].date).toBe('2026-08-10T08:30');
  });

  it('events：标题+证据双重去重（同标题同条目不重复入库）', () => {
    const data = defaultBlackBoxData();
    const result = { people: [], events: [{ title: '搬家完成', confidence: 0.9, date: '2026-08-10', time: '08:30' }], emotions: [] };
    applyExtraction(data, result, ENTRIES);
    applyExtraction(data, result, ENTRIES);
    expect(data.events).toHaveLength(1);
  });

  it('events：情绪合并（候选 emotion → 事件 emotions，限 3 词）', () => {
    const data = defaultBlackBoxData();
    applyExtraction(
      data,
      {
        people: [],
        events: [{ title: '搬家完成', confidence: 0.9, emotion: '疲惫', date: '2026-08-10', time: '08:30' }],
        emotions: [],
      },
      ENTRIES
    );
    expect(data.events[0].emotions).toContain('疲惫');
  });

  it('无事件无人物 → 无副作用', () => {
    const data = defaultBlackBoxData();
    applyExtraction(data, { people: [], events: [], emotions: [] }, ENTRIES);
    expect(data.profiles).toEqual([]);
    expect(data.mentions).toEqual([]);
    expect(data.events).toEqual([]);
  });

  it('emotions → entryEmotions 落盘（v4 修订：日记条目情绪推断）', () => {
    const data = defaultBlackBoxData();
    applyExtraction(
      data,
      {
        people: [],
        events: [],
        emotions: [
          { entry: '2026-08-10 08:30', tags: ['疲惫', '释然'] },
          { entry: '2026-08-11 09:00', tags: ['温暖'] },
          { entry: '非法格式', tags: ['孤独'] },
        ],
      },
      ENTRIES
    );
    expect(data.entryEmotions).toHaveLength(2);
    expect(data.entryEmotions[0]).toEqual({ date: '2026-08-10', time: '08:30', tags: ['疲惫', '释然'] });
    expect(data.entryEmotions[1]).toEqual({ date: '2026-08-11', time: '09:00', tags: ['温暖'] });
  });

  it('emotions 重复条目 → 合并标签不重复（限 3 词）', () => {
    const data = defaultBlackBoxData();
    const result = {
      people: [],
      events: [],
      emotions: [{ entry: '2026-08-10 08:30', tags: ['疲惫', '希望'] }],
    };
    applyExtraction(data, result, ENTRIES);
    applyExtraction(data, result, ENTRIES);
    expect(data.entryEmotions).toHaveLength(1);
    expect(data.entryEmotions[0].tags).toEqual(['疲惫', '希望']);
  });
});

// ===== buildExtractPrompt =====

describe('buildExtractPrompt', () => {
  it('包含条目内容与 JSON 结构说明', () => {
    const prompt = buildExtractPrompt(ENTRIES);
    expect(prompt).toContain('2026-08-10 08:30');
    expect(prompt).toContain('和妈妈搬完家');
    expect(prompt).toContain('people');
    expect(prompt).toContain('events');
    expect(prompt).toContain('emotions');
    expect(prompt).toContain('confidence');
  });
  it('空条目 → 返回 null（不调 AI）', () => {
    expect(buildExtractPrompt([])).toBeNull();
  });
});