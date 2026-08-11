/**
 * 黑匣子数据层测试（ticket 39）：v1 → v2 无损迁移 / 三类条目 normalize / 画像事件派生层 / 阈值与双源设置。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  BlackBoxDataManager,
  getBlackBoxFilePath,
  createEntry,
  createProfile,
  createEvent,
  migrateV1Impression,
  splitV1People,
} from '../../src/blackbox/data';
import {
  defaultBlackBoxData,
  DEFAULT_PERSONA,
  DEFAULT_EMOTION_TAGS,
  sanitizeWords,
  sanitizeEmotions,
  sanitizePeople,
  resolveReviewThreshold,
  resolveShowSpeculative,
  shouldAutoReview,
  trimChat,
  groupEventsByMonth,
  aggregateEmotions,
  findProfileHints,
  buildEventReport,
  filterEventsByPerson,
  personLabel,
  MAX_EMOTIONS,
  MAX_PEOPLE,
} from '../../src/blackbox/types';
import type { BlackBoxData, Entry, Profile } from '../../src/blackbox/types';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

/** v1 存量数据样本（含多链接/多人物/情绪强度） */
const V1_SAMPLE = {
  version: 1,
  persona: {
    name: '包仔',
    seed: '种子',
    toneExample: '语气',
    selfViews: [{ ts: 't0', view: '我认识主人了' }],
  },
  impressions: [
    {
      id: 'bb_i1',
      ts: '2026-07-21T02:06:00.000Z',
      material: '茉莉花的香气',
      feeling: '夏夜凉风，想妈妈了',
      emotions: [
        { tag: '想念', intensity: 5 },
        { tag: '难过', intensity: 2 },
      ],
      scene: '深夜阳台',
      people: '妈妈、妹妹, 老王',
      direction: 'others',
      links: 'https://a.com, [[某篇笔记]]',
    },
    {
      id: 'bb_i2',
      ts: '2026-07-22T08:00:00.000Z',
      material: '量子隧穿',
      feeling: '震撼',
      emotions: [{ tag: '敬佩', intensity: 4 }],
      scene: '',
      people: '',
      direction: '',
      links: [],
    },
  ],
  reviews: [{ ts: 't9', text: '复盘一', impressionCount: 2, newSelfView: '我变得细腻了' }],
  chat: [
    { role: 'user', text: '嗨', ts: 't10' },
    { role: 'assistant', text: '你好呀', ts: 't11' },
  ],
};

describe('getBlackBoxFilePath', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('默认 CONFIG/STORAGE/blackbox.json；storagePath 设置优先', () => {
    expect(getBlackBoxFilePath()).toBe('CONFIG/STORAGE/blackbox.json');
    setSettingsProvider(() => ({ storagePath: 'DATA/私密' } as any));
    expect(getBlackBoxFilePath()).toBe('DATA/私密/blackbox.json');
  });
});

describe('v1 → v2 迁移纯函数', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('splitV1People：顿号/中英文逗号/空格拆分非空段', () => {
    expect(splitV1People('妈妈、妹妹, 老王 小张')).toEqual(['妈妈', '妹妹', '老王', '小张']);
    expect(splitV1People('')).toEqual([]);
    expect(splitV1People(42)).toEqual([]);
    expect(splitV1People('a,b,,， c')).toEqual(['a', 'b', 'c']);
  });

  it('migrateV1Impression：素材+感受合并、情绪去强度、people 拆分、links 数组、指向映射', () => {
    const e = migrateV1Impression(V1_SAMPLE.impressions[0])!;
    expect(e.type).toBe('thought');
    expect(e.createdAt).toBe('2026-07-21T02:06:00.000Z');
    expect(e.text).toBe('茉莉花的香气\n\n夏夜凉风，想妈妈了');
    expect(e.emotions).toEqual(['想念', '难过']); // 强度丢弃
    expect(e.people).toEqual(['妈妈', '妹妹', '老王']);
    expect(e.scene).toBe('深夜阳台');
    expect(e.toward).toBe('others');
    expect(e.links).toEqual(['https://a.com', '[[某篇笔记]]']);
  });

  it('migrateV1Impression：空素材/感受或非法结构 → null（v1 normalize 校验退役）', () => {
    expect(migrateV1Impression({ id: 'x', ts: 't', material: '', feeling: 'f' })).toBeNull();
    expect(migrateV1Impression({ id: 'x', ts: 't', material: 'm', feeling: '' })).toBeNull();
    expect(migrateV1Impression(null)).toBeNull();
    expect(migrateV1Impression('str')).toBeNull();
  });
});

describe('BlackBoxDataManager load 迁移', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('v1 文件加载自动迁移 v2：persona/reviews/chat 无损，impressions 全为 thought 条目', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/blackbox.json', JSON.stringify(V1_SAMPLE));
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.version).toBe(2);
    expect(data.entries.length).toBe(2);
    expect(data.entries.every((e) => e.type === 'thought')).toBe(true);
    expect(data.entries[0].text).toContain('茉莉花的香气');
    expect(data.entries[0].emotions).toEqual(['想念', '难过']);
    expect(data.entries[0].people).toEqual(['妈妈', '妹妹', '老王']);
    expect(data.entries[0].toward).toBe('others');
    expect(data.persona.selfViews).toEqual([{ ts: 't0', view: '我认识主人了' }]);
    expect(data.reviews.length).toBe(1);
    expect(data.reviews[0].text).toBe('复盘一');
    expect(data.chat.length).toBe(2);
    expect(data.profiles).toEqual([]);
    expect(data.events).toEqual([]);
    // 词表预置 24 词
    expect(data.settings.words.length).toBe(24);
  });

  it('迁移幂等：迁移后保存再加载不再重复迁移（version 已为 2）', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/blackbox.json', JSON.stringify(V1_SAMPLE));
    const { app } = setup(vault);
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    await dm.save(data);
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/blackbox.json')!);
    expect(raw.version).toBe(2);
    const again = await dm.load();
    expect(again.entries.length).toBe(2); // 未重复迁移
    expect(again.entries[0].text).toBe('茉莉花的香气\n\n夏夜凉风，想妈妈了');
  });

  it('load：文件不存在 → 默认数据（v2 结构，种子包仔）', async () => {
    const { app } = setup();
    const data = await new BlackBoxDataManager(app).load();
    expect(data.version).toBe(2);
    expect(data.persona).toEqual(DEFAULT_PERSONA);
    expect(data.entries).toEqual([]);
    expect(data.settings.words).toEqual([...DEFAULT_EMOTION_TAGS]);
  });

  it('load：坏 JSON → 默认数据，且原文件改名备份 .bak 保留现场', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/blackbox.json', '{oops');
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.entries).toEqual([]);
    const baks = [...vault.files.keys()].filter((p) => p.includes('.bak-'));
    expect(baks.length).toBe(1);
    expect(vault.files.get(baks[0])).toBe('{oops');
  });

  it('save：不存在时建目录建文件，可读回；meta 统计同步', async () => {
    const { app, vault } = setup();
    const dm = new BlackBoxDataManager(app);
    const data = defaultBlackBoxData();
    data.entries.push(createEntry({ type: 'thought', text: '你好' }));
    await dm.save(data);
    expect(vault.files.has('CONFIG/STORAGE/blackbox.json')).toBe(true);
    const back = await dm.load();
    expect(back.entries.length).toBe(1);
    expect(back.meta.totalEntries).toBe(1);
  });
});

describe('v2 normalize 容错', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('三类条目各自必填校验：concept 要 name，literature/thought 要 text；非法条目过滤', async () => {
    const vault = new MockVault();
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({
        version: 2,
        entries: [
          { id: 'bb_c1', type: 'concept', createdAt: 't', name: '提喻法', definition: '一种修辞', related: ['bb_c2'] },
          { id: 'bb_c2', type: 'concept', createdAt: 't', name: '', definition: '缺名字' },
          { id: 'bb_l1', type: 'literature', createdAt: 't', text: '摘抄', source: '书', terms: ['bb_c1'], emotions: ['触动'], people: ['pf_x'] },
          { id: 'bb_t1', type: 'thought', createdAt: 't', text: '想法', emotions: ['难过'] },
          { id: 'bb_bad', type: 'thought', createdAt: 't', text: '' },
          { type: 'thought', createdAt: 't', text: '无 id' },
        ],
      })
    );
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.entries.map((e) => e.id)).toEqual(['bb_c1', 'bb_l1', 'bb_t1']);
    expect(data.entries[0].related).toEqual(['bb_c2']);
    expect(data.entries[1].terms).toEqual(['bb_c1']);
    expect(data.entries[2].emotions).toEqual(['难过']);
  });

  it('profiles/events/settings 非法字段回退默认', async () => {
    const vault = new MockVault();
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({
        version: 2,
        settings: { reviewThreshold: 'abc', showSpeculativeEvents: false, words: ['触动', '触动', '', '  ', 42] },
        profiles: [
          { id: 'pf_1', name: '妹妹', relation: '家人', impression: '锁定的印象', aiObservations: ['观察1'], pinnedEvents: ['ev_1'], createdAt: 't' },
          { id: '', name: '坏画像' },
          { id: 'pf_3' },
        ],
        events: [
          { id: 'ev_1', title: '给妹妹买吉他', time: '2026-08-01', inferred: true, summary: '', people: ['pf_1'], mainPerson: 'pf_1', evidence: ['bb_t1'], emotions: ['温暖'], edited: false },
          { id: 'ev_bad', title: '' },
        ],
      })
    );
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.settings.reviewThreshold).toBe(10); // 非法回退
    expect(data.settings.showSpeculativeEvents).toBe(false); // 合法保留
    expect(data.settings.words).toEqual(['触动']); // 去重去空
    expect(data.profiles.length).toBe(1);
    expect(data.profiles[0].name).toBe('妹妹');
    expect(data.events.length).toBe(1);
    expect(data.events[0].inferred).toBe(true);
  });
});

describe('纯函数：词表/情绪/人物校验', () => {
  it('sanitizeWords：去空/去重/限长', () => {
    expect(sanitizeWords(['a', ' a ', 'b', 'a', '', 1])).toEqual(['a', 'b']);
    const big = Array.from({ length: 120 }, (_, i) => `w${i}`);
    expect(sanitizeWords(big).length).toBe(100);
    expect(sanitizeWords('str')).toEqual([]);
  });

  it('sanitizeEmotions ≤3、sanitizePeople ≤5，均去重', () => {
    const emotions = ['触动', '难过', '想念', '孤独', '触动'];
    expect(sanitizeEmotions(emotions)).toEqual(['触动', '难过', '想念']);
    expect(sanitizeEmotions(emotions).length).toBeLessThanOrEqual(MAX_EMOTIONS);
    const people = ['a', 'b', 'c', 'd', 'e', 'f', 'a'];
    expect(sanitizePeople(people)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(sanitizePeople(people).length).toBeLessThanOrEqual(MAX_PEOPLE);
  });

  it('settings.words 增删不影响存量条目 emotions（条目存 plain string）', () => {
    const entry = createEntry({ type: 'thought', text: 't', emotions: ['旧词'] });
    expect(entry.emotions).toEqual(['旧词']);
    expect(sanitizeWords(['新词'])).not.toContain('旧词');
  });

  it('shouldAutoReview：三类均计入，阈值整数倍触发', () => {
    expect(shouldAutoReview(10, 10)).toBe(true);
    expect(shouldAutoReview(11, 10)).toBe(false);
    expect(shouldAutoReview(0, 10)).toBe(false);
    expect(shouldAutoReview(5, 0)).toBe(false);
  });

  it('trimChat：只保留最近 max 条', () => {
    const chat = [
      { role: 'user' as const, text: '1', ts: 'a' },
      { role: 'user' as const, text: '2', ts: 'b' },
      { role: 'user' as const, text: '3', ts: 'c' },
    ];
    expect(trimChat(chat, 2)).toEqual([chat[1], chat[2]]);
    expect(trimChat(chat, 0).length).toBe(3); // 非法 max 兜底
  });

  it('resolveReviewThreshold / resolveShowSpeculative：全局优先、数据兜底', () => {
    const data = defaultBlackBoxData();
    expect(resolveReviewThreshold(data, {})).toBe(10);
    expect(resolveReviewThreshold(data, { blackboxReviewThreshold: '7' })).toBe(7);
    data.settings.reviewThreshold = 3;
    expect(resolveReviewThreshold(data, {})).toBe(3);
    expect(resolveReviewThreshold(data, { blackboxReviewThreshold: '0' })).toBe(3);
    expect(resolveShowSpeculative(data, {})).toBe(true);
    data.settings.showSpeculativeEvents = false;
    expect(resolveShowSpeculative(data, {})).toBe(false);
    expect(resolveShowSpeculative(data, { blackboxShowSpeculativeEvents: true })).toBe(true);
  });
});

describe('派生层纯函数：画像/事件投影', () => {
  const pf: Profile = { id: 'pf_1', name: '妹妹', relation: '家人', impression: '', aiObservations: [], pinnedEvents: [], createdAt: 't' };
  const pf2: Profile = { id: 'pf_2', name: '妈妈', relation: '家人', impression: '', aiObservations: [], pinnedEvents: [], createdAt: 't' };
  const entries: Entry[] = [
    createEntry({ type: 'thought', text: 'a', people: ['pf_1'], emotions: ['温暖', '想念'], createdAt: 't1' }),
    createEntry({ type: 'thought', text: 'b', people: ['妹妹'], emotions: ['温暖'], createdAt: 't2' }),
    createEntry({ type: 'thought', text: 'c', people: ['老王'], emotions: ['难过'], createdAt: 't3' }),
    createEntry({ type: 'thought', text: 'c2', people: ['老王'], emotions: ['疲惫'], createdAt: 't5' }),
    createEntry({ type: 'thought', text: 'd', emotions: [], createdAt: 't4' }),
  ];
  const events = [
    createEvent({ title: '买吉他', time: '2026-08-01', people: ['pf_1'], mainPerson: 'pf_1' }),
    createEvent({ title: '梦到旅行', time: '2026-07-15', inferred: true, people: ['pf_2'] }),
    createEvent({ title: '老友聚会', time: '2026-08-20', people: ['老王'] }),
  ];

  it('aggregateEmotions：画像关联条目情绪计数（id 与冷启动纯名字均命中）', () => {
    const agg = aggregateEmotions(entries, pf);
    expect(agg).toEqual({ 温暖: 2, 想念: 1 });
  });

  it('filterEventsByPerson：按人投影（id/名字/主角）', () => {
    expect(filterEventsByPerson(events, pf).map((e) => e.title)).toEqual(['买吉他']);
    expect(filterEventsByPerson(events, pf2).map((e) => e.title)).toEqual(['梦到旅行']);
    expect(filterEventsByPerson(events, { ...pf2, name: '老王' }).map((e) => e.title)).toEqual(['梦到旅行', '老友聚会']);
  });

  it('groupEventsByMonth：按年月分组降序', () => {
    const groups = groupEventsByMonth(events);
    expect(groups.map((g) => g.key)).toEqual(['2026-08', '2026-07']);
    expect(groups[0].label).toBe('2026 年 8 月');
    expect(groups[0].events.length).toBe(2);
    expect(groupEventsByMonth([{ id: 'ev_x', title: 'x', time: '' } as any]).length).toBe(0);
  });

  it('findProfileHints：高频提及（≥2）未建画像的人名', () => {
    const hints = findProfileHints(entries, [pf, pf2]);
    expect(hints).toEqual(['老王']); // 妹妹已建画像
    expect(findProfileHints(entries.slice(0, 2), [pf])).toEqual([]);
  });

  it('buildEventReport：汇报一句话（含推测计数）', () => {
    expect(buildEventReport(3, 1)).toBe('这周我整理了 3 件新事件（其中 1 件推测）');
    expect(buildEventReport(2, 0)).toBe('这周我整理了 2 件新事件');
  });

  it('personLabel：画像 id → 名，纯名字原样', () => {
    expect(personLabel('pf_1', [pf])).toBe('妹妹');
    expect(personLabel('pf_missing', [pf])).toBe('pf_missing');
    expect(personLabel('老王', [pf])).toBe('老王');
  });
});

describe('BlackBoxDataManager addEntry/addReview/addChat', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('addEntry：三类条目均计入阈值；命中全局阈值触发自动复盘', async () => {
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxReviewThreshold: '3' });
    const dm = new BlackBoxDataManager(app);
    let data = await dm.load();
    for (let i = 0; i < 2; i++) {
      const r = await dm.addEntry(data, createEntry({ type: 'thought', text: `想法${i}` }));
      expect(r.shouldReview).toBe(false);
      data = await dm.load();
    }
    const r = await dm.addEntry(data, createEntry({ type: 'concept', name: '提喻法' }));
    expect(r.count).toBe(3);
    expect(r.shouldReview).toBe(true);
  });

  it('addReview：人格生长 + lastReviewAt；addChat 裁剪', async () => {
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxMaxHistory: '2' });
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    await dm.addReview(data, { ts: 't1', text: '复盘', impressionCount: 2, newSelfView: '我越来越懂主人了' });
    await dm.addChat(data, 'user', 'a', 't2');
    await dm.addChat(data, 'assistant', 'b', 't3');
    await dm.addChat(data, 'user', 'c', 't4');
    const back = await dm.load();
    expect(back.persona.selfViews).toEqual([{ ts: 't1', view: '我越来越懂主人了' }]);
    expect(back.meta.lastReviewAt).toBe('t1');
    expect(back.chat.map((m) => m.text)).toEqual(['b', 'c']);
  });

  it('confirmEvent / deleteEvent：推测确认转实线；删除即数据删除', async () => {
    const vault = new MockVault();
    const { app } = setup(vault);
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    data.events.push(createEvent({ id: 'ev_s', title: '梦', inferred: true }));
    data.events.push(createEvent({ id: 'ev_r', title: '真事' }));
    await dm.save(data);
    await dm.confirmEvent(data, 'ev_s');
    await dm.deleteEvent(data, 'ev_r');
    const back = await dm.load();
    expect(back.events.length).toBe(1);
    expect(back.events[0].id).toBe('ev_s');
    expect(back.events[0].inferred).toBe(false);
  });

  it('updateProfile：用户编辑印象持久化', async () => {
    const vault = new MockVault();
    const { app } = setup(vault);
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    const pf = createProfile({ name: '妹妹', relation: '家人' });
    data.profiles.push(pf);
    await dm.save(data);
    pf.impression = '我的版本';
    await dm.updateProfile(data, pf);
    const back = await dm.load();
    expect(back.profiles[0].impression).toBe('我的版本');
  });

  it('save 同步双源设置：全局阈值/推测开关写入数据段', async () => {
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxReviewThreshold: '7', blackboxShowSpeculativeEvents: false });
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    await dm.save(data);
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/blackbox.json')!);
    expect(raw.settings.reviewThreshold).toBe(7);
    expect(raw.settings.showSpeculativeEvents).toBe(false);
  });
});
