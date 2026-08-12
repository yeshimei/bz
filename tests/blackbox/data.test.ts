/**
 * 黑匣子数据层测试（ticket 39 v2 + ticket 01 v3 笔记化）：
 * v1 → v3 全链迁移（幂等/失败重试/落盘断言）/ 笔记读写引擎（frontmatter + 关联区）/ 索引水合容错 /
 * 去重清洗 / addEntry/deleteEntry/backfillRelated 笔记化语义。
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
  normalizeData,
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
import {
  BB_NOTE_ROOT,
  sanitizeFileName,
  noteNameFromPath,
  entryNoteTitle,
  buildNoteContent,
  parseNoteContent,
  parseWikilinkNames,
} from '../../src/blackbox/notes';
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

/** v2 全量样本（三类条目 + related/terms 关联 + 外壳 + toward/links） */
const V2_SAMPLE = {
  version: 2,
  settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动', '温暖'] },
  persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
  entries: [
    { id: 'bb_c1', type: 'concept', createdAt: '2026-08-01T00:00:00.000Z', name: '提喻法', definition: '以部分代整体的修辞', related: ['bb_c2'], emotions: [], people: [], scene: '', toward: '', links: [] },
    { id: 'bb_c2', type: 'concept', createdAt: '2026-08-02T00:00:00.000Z', name: '借代', definition: '用相关事物代替本体', related: ['bb_c1'], emotions: [], people: [], scene: '', toward: '', links: [] },
    { id: 'bb_l1', type: 'literature', createdAt: '2026-08-03T00:00:00.000Z', text: '修辞是语言的弹性，让有限词句装下无限情意。', source: '《诗学》', terms: ['bb_c1'], emotions: ['触动'], people: [], scene: '', toward: '', links: ['https://a.com'] },
    { id: 'bb_t1', type: 'thought', createdAt: '2026-08-04T00:00:00.000Z', text: '给妹妹买吉他，她笑了很久。', emotions: ['温暖', '想念'], people: ['pf_1'], scene: '琴行', toward: 'others', links: [] },
  ],
  profiles: [{ id: 'pf_1', name: '妹妹', relation: '家人', impression: '很要强', aiObservations: [], pinnedEvents: [], createdAt: 't' }],
  events: [{ id: 'ev_1', title: '给妹妹买吉他', time: '2026-08-01', inferred: false, summary: '', people: ['pf_1'], mainPerson: 'pf_1', evidence: ['bb_t1'], emotions: ['温暖'], edited: false }],
  reviews: [],
  chat: [],
  meta: { lastReviewAt: '', totalEntries: 4, totalEvents: 1 },
};

function blackboxNoteFiles(vault: MockVault): string[] {
  return [...vault.files.keys()].filter((p) => p.startsWith(`${BB_NOTE_ROOT}/`)).sort();
}

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

  it('migrateV1Impression：空素材/感受或非法结构 → null', () => {
    expect(migrateV1Impression({ id: 'x', ts: 't', material: '', feeling: 'f' })).toBeNull();
    expect(migrateV1Impression({ id: 'x', ts: 't', material: 'm', feeling: '' })).toBeNull();
    expect(migrateV1Impression(null)).toBeNull();
    expect(migrateV1Impression('str')).toBeNull();
  });
});

describe('笔记引擎纯函数', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('sanitizeFileName：非法字符清洗 + 空回退', () => {
    expect(sanitizeFileName('提喻法')).toBe('提喻法');
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
    expect(sanitizeFileName('  多  个   空格  ')).toBe('多 个 空格');
    expect(sanitizeFileName('???')).toBe('未命名');
  });

  it('noteNameFromPath：去 .md 与去重后缀 -N', () => {
    expect(noteNameFromPath('黑匣子/概念/提喻法.md')).toBe('提喻法');
    expect(noteNameFromPath('黑匣子/概念/提喻法-2.md')).toBe('提喻法');
    expect(noteNameFromPath('黑匣子/想法/标题-10.md')).toBe('标题');
  });

  it('entryNoteTitle：概念=名；文献/想法=正文前 20 字去空白', () => {
    const c = createEntry({ type: 'concept', name: '提喻法' });
    expect(entryNoteTitle(c)).toBe('提喻法');
    const t = createEntry({ type: 'thought', text: '  给妹妹\n\n买吉他，她笑了很久，还说要学弹唱。  ' });
    expect(entryNoteTitle(t)).toBe('给妹妹 买吉他，她笑了很久，还说要学弹唱。'.slice(0, 20));
    const l = createEntry({ type: 'literature', text: 'x' });
    expect(entryNoteTitle(l).length).toBe(1);
  });

  it('parseWikilinkNames：[[名]] / [[名|别名]] / [[名#锚点]]', () => {
    expect(parseWikilinkNames('- 关联：[[提喻法]] [[借代|别名]] [[修辞#锚点]]')).toEqual(['提喻法', '借代', '修辞']);
    expect(parseWikilinkNames('无链接')).toEqual([]);
  });

  it('三类笔记 roundtrip：frontmatter + 正文 + 关联区双向一致', () => {
    const nameById = new Map([
      ['bb_c2', '借代'],
      ['bb_c1', '提喻法'],
      ['bb_l1', '修辞是语言的弹性'],
    ]);
    const concept = createEntry({ type: 'concept', name: '提喻法', definition: '以部分代整体的修辞', related: ['bb_c2'] });
    const lit = createEntry({ type: 'literature', text: '修辞是语言的弹性，让有限词句装下无限情意。', source: '《诗学》', terms: ['bb_c1'], emotions: ['触动'], links: ['https://a.com'] });
    const thought = createEntry({ type: 'thought', text: '给妹妹买吉他，她笑了很久。', emotions: ['温暖'], people: ['pf_1'], scene: '琴行', toward: 'others' });
    const litPath = '黑匣子/摘抄/修辞是语言的弹性.md';
    const thoughtPath = '黑匣子/想法/给妹妹买吉他，她笑了很久。.md';
    const cContent = buildNoteContent(concept, (id) => nameById.get(id));
    expect(cContent).toContain('- 关联：[[借代]]');
    const cBack = parseNoteContent(cContent, '黑匣子/概念/提喻法.md')!;
    expect(cBack.entry.name).toBe('提喻法');
    expect(cBack.entry.definition).toBe('以部分代整体的修辞');
    expect(cBack.relatedNames).toEqual(['借代']);

    const lContent = buildNoteContent(lit, (id) => nameById.get(id));
    expect(lContent).toContain('来源：《诗学》');
    expect(lContent).toContain('关联概念：[[提喻法]]');
    const lBack = parseNoteContent(lContent, litPath)!;
    expect(lBack.entry.text).toBe('修辞是语言的弹性，让有限词句装下无限情意。');
    expect(lBack.entry.source).toBe('《诗学》');
    expect(lBack.entry.links).toEqual(['https://a.com']);
    expect(lBack.entry.emotions).toEqual(['触动']);
    expect(lBack.termsNames).toEqual(['提喻法']);

    const tContent = buildNoteContent(thought, (id) => nameById.get(id));
    const tBack = parseNoteContent(tContent, thoughtPath)!;
    expect(tBack.entry.text).toBe('给妹妹买吉他，她笑了很久。');
    expect(tBack.entry.emotions).toEqual(['温暖']);
    expect(tBack.entry.people).toEqual(['pf_1']);
    expect(tBack.entry.scene).toBe('琴行');
    expect(tBack.entry.toward).toBe('others');
  });

  it('解析容错：frontmatter 缺 id/type/createdAt 或类型非法 → null', () => {
    expect(parseNoteContent('# 无 frontmatter', '黑匣子/概念/x.md')).toBeNull();
    expect(parseNoteContent('---\nid: bb_x\ntype: concept\n---\n正文', '黑匣子/概念/x.md')).toBeNull(); // 缺 createdAt
    expect(parseNoteContent('---\nid: bb_x\ntype: foo\ncreatedAt: t\n---\n正文', '黑匣子/概念/x.md')).toBeNull();
    expect(parseNoteContent('---\nid: \ntype: concept\ncreatedAt: t\n---\n正文', '黑匣子/概念/x.md')).toBeNull();
  });

  it('解析容错：正文末尾「来源：」行（引用归属）不被当作关联区剥离（需空行分隔）', () => {
    const content = '---\nid: bb_l1\ntype: literature\ncreatedAt: t\n---\n引用文字\n来源：某书';
    const p = parseNoteContent(content, '黑匣子/摘抄/x.md')!;
    expect(p.entry.text).toBe('引用文字\n来源：某书'); // 无空行 → 全为正文
    const content2 = '---\nid: bb_l1\ntype: literature\ncreatedAt: t\n---\n引用文字\n\n来源：[[某笔记]]';
    const p2 = parseNoteContent(content2, '黑匣子/摘抄/x.md')!;
    expect(p2.entry.text).toBe('引用文字');
  });
});

describe('BlackBoxDataManager load 迁移（v1/v2 → v3 笔记化）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('v1 文件加载不再自动迁移（用户决策）：派生层可读，entries 残留不水合、不写笔记', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/blackbox.json', JSON.stringify(V1_SAMPLE));
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.version).toBe(3);
    expect(data.entries).toEqual([]); // 未迁移：无笔记可水合（一次性迁移走 tools/migrate-blackbox-v3.mjs）
    expect(data.persona.selfViews).toEqual([{ ts: 't0', view: '我认识主人了' }]);
    expect(data.reviews.length).toBe(1);
    expect(data.reviews[0].text).toBe('复盘一');
    expect(data.chat.length).toBe(2);
    expect(blackboxNoteFiles(vault)).toEqual([]); // 不写任何笔记
    expect(data.settings.words.length).toBe(24);
  });

  it('v2 文件加载不再自动迁移：residual entries 被忽略，仅水合 index/孤儿', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/blackbox.json', JSON.stringify(V2_SAMPLE));
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.entries).toEqual([]); // entries 残留不水合
    expect(data.index).toEqual({});
    expect(blackboxNoteFiles(vault)).toEqual([]); // 不自动写笔记
    expect(data.profiles[0].name).toBe('妹妹'); // 派生层照常
    expect(data.events[0].evidence).toEqual(['bb_t1']);
  });

  it('笔记水合：frontmatter 完整字段读回（name/related/terms/source/links/标题）', async () => {
    const vault = new MockVault();
    vault.files.set(
      '黑匣子/概念/提喻法.md',
      '---\nid: bb_c1\ntype: concept\ncreatedAt: "2026-08-01T00:00:00.000Z"\nname: 提喻法\nrelated:\n  - 借代\n---\n以部分代整体的修辞\n'
    );
    vault.files.set(
      '黑匣子/概念/借代.md',
      '---\nid: bb_c2\ntype: concept\ncreatedAt: "2026-08-02T00:00:00.000Z"\nname: 借代\n---\n用相关事物代替本体\n'
    );
    vault.files.set(
      '黑匣子/摘抄/修辞的弹性.md',
      '---\nid: bb_l1\ntype: literature\ncreatedAt: "2026-08-03T00:00:00.000Z"\ntitle: 修辞的弹性\nsource: "《诗学》"\nterms:\n  - 提喻法\nlinks:\n  - https://a.com\n---\n修辞是语言的弹性。\n'
    );
    vault.files.set(
      '黑匣子/想法/夏夜的吉他声.md',
      '---\nid: bb_t1\ntype: thought\ncreatedAt: "2026-08-04T00:00:00.000Z"\ntitle: 夏夜的吉他声\n---\n给妹妹买吉他，她笑了很久。\n'
    );
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({
        version: 3, settings: {}, persona: {}, entries: [], profiles: [], events: [], reviews: [], chat: [], meta: {},
        index: {
          bb_c1: '黑匣子/概念/提喻法.md',
          bb_c2: '黑匣子/概念/借代.md',
          bb_l1: '黑匣子/摘抄/修辞的弹性.md',
          bb_t1: '黑匣子/想法/夏夜的吉他声.md',
        },
      })
    );
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.entries.length).toBe(4);
    expect(data.entries[0].name).toBe('提喻法');
    expect(data.entries[0].related).toEqual(['bb_c2']); // fm.related 名字 → id
    const lit = data.entries.find((e) => e.type === 'literature')!;
    expect(lit.title).toBe('修辞的弹性'); // fm.title 权威（不被文件名剥离）
    expect(lit.source).toBe('《诗学》');
    expect(lit.terms).toEqual(['bb_c1']);
    expect(lit.links).toEqual(['https://a.com']);
    const thought = data.entries.find((e) => e.type === 'thought')!;
    expect(thought.title).toBe('夏夜的吉他声');
  });

  it('LK-99 场景：概念名含「-数字」不被去重后缀剥离（frontmatter name 权威）', async () => {
    const vault = new MockVault();
    vault.files.set(
      '黑匣子/概念/LK-99.md',
      '---\nid: bb_lk\ntype: concept\ncreatedAt: "2026-08-01T00:00:00.000Z"\nname: LK-99\n---\n铜掺杂铅磷灰石化合物\n'
    );
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({ version: 3, settings: {}, persona: {}, entries: [], profiles: [], events: [], reviews: [], chat: [], meta: {}, index: { bb_lk: '黑匣子/概念/LK-99.md' } })
    );
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.entries[0].name).toBe('LK-99'); // 不再被 noteNameFromPath 剥成 LK
  });

  it('load：文件不存在 → 默认数据（v3 结构，种子包仔）', async () => {
    const { app } = setup();
    const data = await new BlackBoxDataManager(app).load();
    expect(data.version).toBe(3);
    expect(data.persona).toEqual(DEFAULT_PERSONA);
    expect(data.entries).toEqual([]);
    expect(data.index).toEqual({});
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
});

describe('v3 水合容错', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('索引指向缺失文件（笔记已删）→ 移除索引并持久化（展示以笔记为主，不残留）', async () => {
    const vault = new MockVault();
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({ version: 3, settings: {}, persona: {}, entries: [], profiles: [], events: [], reviews: [], chat: [], meta: {}, index: { bb_x: '黑匣子/概念/不存在的.md', bb_y: '黑匣子/概念/存在的.md' } })
    );
    vault.files.set('黑匣子/概念/存在的.md', '---\nid: bb_y\ntype: concept\ncreatedAt: t\n---\n存在\n');
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.entries.length).toBe(1);
    expect(data.index['bb_x']).toBeUndefined(); // 缺失索引已移除
    expect(data.index['bb_y']).toBe('黑匣子/概念/存在的.md');
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/blackbox.json')!);
    expect(raw.index['bb_x']).toBeUndefined(); // 持久化
  });

  it('笔记损坏（frontmatter 解析失败）→ 跳过该条保留索引', async () => {
    const vault = new MockVault();
    vault.files.set('黑匣子/概念/坏笔记.md', '没有任何 frontmatter 的内容');
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({ version: 3, settings: {}, persona: {}, entries: [], profiles: [], events: [], reviews: [], chat: [], meta: {}, index: { bb_bad: '黑匣子/概念/坏笔记.md' } })
    );
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.entries).toEqual([]);
    expect(data.index['bb_bad']).toBe('黑匣子/概念/坏笔记.md');
  });

  it('孤儿自愈：黑匣子/ 下手写 bb 笔记（未索引）自动入索引', async () => {
    const vault = new MockVault();
    vault.files.set(
      '黑匣子/概念/我手写的概念.md',
      '---\nid: bb_hand\ntype: concept\ncreatedAt: "2026-08-09T00:00:00.000Z"\n---\n手写定义\n\n- 关联：[[提喻法]]\n'
    );
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({ version: 3, settings: {}, persona: {}, entries: [], profiles: [], events: [], reviews: [], chat: [], meta: {}, index: {} })
    );
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.entries.length).toBe(1);
    expect(data.entries[0].id).toBe('bb_hand');
    expect(data.entries[0].name).toBe('我手写的概念');
    expect(data.index['bb_hand']).toBe('黑匣子/概念/我手写的概念.md');
    // 孤儿已持久化进索引
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/blackbox.json')!);
    expect(raw.index['bb_hand']).toBe('黑匣子/概念/我手写的概念.md');
  });

  it('关联区未解析名字 → pendingLinks（待补链）；解析后补进 related', async () => {
    const vault = new MockVault();
    vault.files.set(
      '黑匣子/概念/新概念.md',
      '---\nid: bb_new\ntype: concept\ncreatedAt: "2026-08-09T00:00:00.000Z"\n---\n定义\n\n- 关联：[[提喻法]] [[未来概念]]\n'
    );
    vault.files.set(
      '黑匣子/概念/提喻法.md',
      '---\nid: bb_c1\ntype: concept\ncreatedAt: "2026-08-01T00:00:00.000Z"\n---\n以部分代整体\n'
    );
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({
        version: 3,
        settings: {},
        persona: {},
        entries: [],
        profiles: [],
        events: [],
        reviews: [],
        chat: [],
        meta: {},
        index: { bb_new: '黑匣子/概念/新概念.md', bb_c1: '黑匣子/概念/提喻法.md' },
      })
    );
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    const c = data.entries.find((e) => e.id === 'bb_new')!;
    expect(c.related).toEqual(['bb_c1']); // 已解析
    expect(c.pendingLinks).toEqual(['未来概念']); // 未解析待补链
  });
});

describe('v2 normalize 容错（迁移前过滤）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('normalizeData：非法 entries 残留过滤（concept 缺名/literature 缺文本/无 id），合法保留', () => {
    const data = normalizeData({
      version: 2,
      entries: [
        { id: 'bb_c1', type: 'concept', createdAt: 't', name: '提喻法', definition: '一种修辞', related: ['bb_c2'], emotions: [], people: [], scene: '', toward: '', links: [] },
        { id: 'bb_c2', type: 'concept', createdAt: 't', name: '', definition: '缺名字' },
        { id: 'bb_l1', type: 'literature', createdAt: 't', text: '摘抄', source: '书', terms: ['bb_c1'], emotions: ['触动'], people: ['pf_x'], scene: '', toward: '', links: [] },
        { id: 'bb_t1', type: 'thought', createdAt: 't', text: '想法', emotions: ['难过'], people: [], scene: '', toward: '', links: [] },
        { id: 'bb_bad', type: 'thought', createdAt: 't', text: '' },
        { type: 'thought', createdAt: 't', text: '无 id' },
      ],
    });
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

describe('BlackBoxDataManager 笔记化写入', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('addEntry：写笔记 + 索引 + 派生层落盘；重载后水合一致', async () => {
    const vault = new MockVault();
    const { app } = setup(vault);
    const dm = new BlackBoxDataManager(app);
    let data = await dm.load();
    const r = await dm.addEntry(data, createEntry({ type: 'concept', name: '提喻法', definition: '以部分代整体' }));
    expect(r.count).toBe(1);
    expect(r.shouldReview).toBe(false);
    const notePath = '黑匣子/概念/提喻法.md';
    expect(vault.files.has(notePath)).toBe(true);
    expect(vault.files.get(notePath)).toContain('id: ' + data.entries[0].id);
    expect(vault.files.get(notePath)).toContain('以部分代整体');
    // JSON 只落派生层 + 索引，无 entries 段
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/blackbox.json')!);
    expect(raw.entries).toBeUndefined();
    expect(Object.keys(raw.index)).toEqual([data.entries[0].id]);
    // 重载水合
    const back = await dm.load();
    expect(back.entries.length).toBe(1);
    expect(back.entries[0].name).toBe('提喻法');
    expect(back.meta.totalEntries).toBe(1);
  });

  it('标题冲突 -N 去重 + 非法字符清洗', async () => {
    const vault = new MockVault();
    const { app } = setup(vault);
    const dm = new BlackBoxDataManager(app);
    let data = await dm.load();
    await dm.addEntry(data, createEntry({ type: 'concept', name: '提喻法' }));
    data = await dm.load();
    await dm.addEntry(data, createEntry({ type: 'concept', name: '提喻法' }));
    expect(vault.files.has('黑匣子/概念/提喻法.md')).toBe(true);
    expect(vault.files.has('黑匣子/概念/提喻法-1.md')).toBe(true);
    // 非法字符清洗
    const weird = createEntry({ type: 'concept', name: 'a/b:c' });
    await dm.addEntry(data, weird);
    expect(vault.files.has('黑匣子/概念/abc.md')).toBe(true);
    const back = await dm.load();
    const w = back.entries.find((e) => e.id === weird.id)!;
    expect(w.name).toBe('a/b:c'); // frontmatter name 权威（文件名只是载体，不再被清洗影响）
  });

  it('addEntry 阈值：三类条目均计入，命中全局阈值触发自动复盘', async () => {
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

  it('backfillRelated：既有概念反向关联新卡并重写笔记关联区', async () => {
    const vault = new MockVault();
    const { app } = setup(vault);
    const dm = new BlackBoxDataManager(app);
    let data = await dm.load();
    await dm.addEntry(data, createEntry({ id: 'bb_old', type: 'concept', name: '提喻法' }));
    data = await dm.load();
    const fresh = await dm.load();
    await dm.addEntry(fresh, createEntry({ id: 'bb_new', type: 'concept', name: '隐喻', related: ['bb_old'] }));
    data = await dm.load();
    await dm.backfillRelated(data, 'bb_new', ['bb_old']);
    // 旧概念笔记关联区补上 [[隐喻]]
    expect(vault.files.get('黑匣子/概念/提喻法.md')).toContain('- 关联：[[隐喻]]');
    const back = await dm.load();
    const old = back.entries.find((e) => e.id === 'bb_old')!;
    expect(old.related).toContain('bb_new');
  });

  it('deleteEntry：删笔记 + 索引 + 其它条目引用清理（相关笔记重写）', async () => {
    const vault = new MockVault();
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({
        version: 3,
        settings: {},
        persona: {},
        entries: [],
        profiles: [],
        events: [],
        reviews: [],
        chat: [],
        meta: {},
        index: { bb_a: '黑匣子/概念/A.md', bb_b: '黑匣子/概念/B.md' },
      })
    );
    vault.files.set('黑匣子/概念/A.md', '---\nid: bb_a\ntype: concept\ncreatedAt: t\n---\n定义A\n\n- 关联：[[B]]\n');
    vault.files.set('黑匣子/概念/B.md', '---\nid: bb_b\ntype: concept\ncreatedAt: t\n---\n定义B\n\n- 关联：[[A]]\n');
    const { app } = setup(vault);
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    expect(data.entries.length).toBe(2);
    await dm.deleteEntry(data, 'bb_a');
    expect(vault.files.has('黑匣子/概念/A.md')).toBe(false);
    expect(data.index['bb_a']).toBeUndefined();
    expect(data.entries.length).toBe(1);
    // B 的关联区引用 A 被清理
    expect(vault.files.get('黑匣子/概念/B.md')).not.toContain('[[A]]');
    const back = await dm.load();
    expect(back.entries.length).toBe(1);
    expect(back.entries[0].related).toEqual([]);
  });

  it('addReview：人格生长 + lastReviewAt；addChat 裁剪（派生层不变）', async () => {
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

describe('frontmatter 关联权威（用户需求：正文关联区被手动修改/误删不丢数据）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  async function loadWithNotes(vault: MockVault, c1Body: string) {
    vault.files.set(
      '黑匣子/概念/提喻法.md',
      '---\nid: bb_c1\ntype: concept\ncreatedAt: "2026-08-01T00:00:00.000Z"\nname: 提喻法\nrelated:\n  - 借代\n  - 隐喻\n---\n' + c1Body
    );
    vault.files.set(
      '黑匣子/概念/借代.md',
      '---\nid: bb_c2\ntype: concept\ncreatedAt: "2026-08-02T00:00:00.000Z"\nname: 借代\n---\n用相关事物代替本体\n'
    );
    vault.files.set(
      '黑匣子/概念/隐喻.md',
      '---\nid: bb_c3\ntype: concept\ncreatedAt: "2026-08-03T00:00:00.000Z"\nname: 隐喻\n---\n暗含的比喻\n'
    );
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({
        version: 3, settings: {}, persona: {}, entries: [], profiles: [], events: [], reviews: [], chat: [], meta: {},
        index: { bb_c1: '黑匣子/概念/提喻法.md', bb_c2: '黑匣子/概念/借代.md', bb_c3: '黑匣子/概念/隐喻.md' },
      })
    );
    const { app } = setup(vault);
    return new BlackBoxDataManager(app).load();
  }

  it('正文关联区被误删 → frontmatter related 兜底，关联不丢', async () => {
    const vault = new MockVault();
    const data = await loadWithNotes(vault, '只剩定义，关联区被删了\n');
    const c1 = data.entries.find((e) => e.id === 'bb_c1')!;
    expect(c1.related).toEqual(['bb_c2', 'bb_c3']); // fm.related 权威
  });

  it('正文关联区新增 [[新名]] → 与 frontmatter 合并（用户手动增链生效）', async () => {
    const vault = new MockVault();
    const data = await loadWithNotes(vault, '定义\n\n- 关联：[[借代]] [[隐喻]] [[新概念X]]\n');
    const c1 = data.entries.find((e) => e.id === 'bb_c1')!;
    expect(c1.related).toEqual(['bb_c2', 'bb_c3']); // 已解析的合并去重
    expect(c1.pendingLinks).toEqual(['新概念X']); // 未解析名待补链
  });

  it('用户改 frontmatter related（增删）→ 以 frontmatter 为准', async () => {
    const vault = new MockVault();
    const data = await loadWithNotes(vault, '定义\n\n- 关联：[[借代]]\n');
    const c1 = data.entries.find((e) => e.id === 'bb_c1')!;
    // fm.related 只有借代+隐喻；正文只有借代 → 合并 = 借代+隐喻
    expect(c1.related).toEqual(['bb_c2', 'bb_c3']);
  });
});

describe('AI 自动分类落位（2026-08-12 需求）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  async function seedOne(vault: MockVault) {
    vault.files.set(
      '黑匣子/概念/提喻法.md',
      '---\nid: bb_c1\ntype: concept\ncreatedAt: "2026-08-01T00:00:00.000Z"\nname: 提喻法\n---\n以部分代整体的修辞\n'
    );
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({
        version: 3, settings: {}, persona: {}, entries: [], profiles: [], events: [], reviews: [], chat: [], meta: {},
        index: { bb_c1: '黑匣子/概念/提喻法.md' },
      })
    );
    const { app } = setup(vault);
    return { app, vault, dm: new BlackBoxDataManager(app) };
  }

  it('applyCategory：移动笔记到分类子文件夹 + fm category + index 更新 + 持久化', async () => {
    const vault = new MockVault();
    const { dm } = await seedOne(vault);
    let data = await dm.load();
    expect(data.entries[0].category).toBeUndefined();
    expect(await dm.applyCategory(data, 'bb_c1', '文学')).toBe(true);
    const moved = '黑匣子/概念/文学/提喻法.md';
    expect(vault.files.has(moved)).toBe(true);
    expect(vault.files.has('黑匣子/概念/提喻法.md')).toBe(false);
    expect(vault.files.get(moved)!).toContain('category: 文学'); // quoteScalar：纯中文不加引号
    // index 与内存条目同步
    data = await dm.load();
    expect(data.index['bb_c1']).toBe(moved);
    expect(data.entries[0].category).toBe('文学');
    // 持久化：blackbox.json index 已更新
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/blackbox.json')!);
    expect(raw.index['bb_c1']).toBe(moved);
  });

  it('applyCategory：已在目标分类文件夹 → 不移动仅补 fm；非法分类/未知 id → false', async () => {
    const vault = new MockVault();
    const { dm } = await seedOne(vault);
    const data = await dm.load();
    expect(await dm.applyCategory(data, 'bb_x', '文学')).toBe(false); // 未知 id
    expect(await dm.applyCategory(data, 'bb_c1', '  ')).toBe(false); // 空分类
    expect(await dm.applyCategory(data, 'bb_c1', '文学')).toBe(true);
    expect(vault.files.has('黑匣子/概念/文学/提喻法.md')).toBe(true);
    // 重复应用：已在文学/ → 原地补 fm 不报错
    expect(await dm.applyCategory(data, 'bb_c1', '文学')).toBe(true);
    expect(vault.files.get('黑匣子/概念/文学/提喻法.md')!).toContain('category: 文学');
  });
});
