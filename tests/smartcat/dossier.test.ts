/**
 * 关系史沉淀测试（ticket 094，方向八）：
 * 数据层——白名单判别/eventId 幂等/环形截断/deriveTimeline 纯函数重建（空表兜底陪伴天数行、
 * 排序、周聚合模板）/陪伴天数/情绪标签变化日检测/叙事周键推进与退避独立性/LLM 润色失败静默；
 * UI 层——「一起的日子」区块渲染（周时间线/关键时刻当日备忘/空态）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dossierEventFromMemory,
  appendDossierEvent,
  getDossierEvents,
  DOSSIER_EVENTS_CAP,
  countCompanionDays,
  deriveTimeline,
  majorityEmotionByDay,
  detectEmotionShiftDays,
  shouldScanDossierNarrative,
  advanceDossierScanKey,
  buildNarrativeInput,
  generateDossierNarrative,
  buildDossierNarratives,
} from '../../src/smartcat/dossier';
import { defaultSmartCatData, getSmartcatFilePath } from '../../src/smartcat/data';
import type { SmartCatData, MemoryStreamEntry } from '../../src/smartcat/types';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { requestUrl } from '../mock-obsidian-entry';
import { openSmartcatDashboard, closeSmartcatDashboard } from '../../src/smartcat/dashboard';

/** 本地日键（与 dossier.dayKeyOf 同口径；断言动态日期用） */
function dkey(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 构造观察条目 */
let seq = 0;
function obs(description: string, source: string, opts: Partial<MemoryStreamEntry> = {}): MemoryStreamEntry {
  seq++;
  return {
    id: `memory_test_${seq}`,
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    description,
    importance: 0.5,
    type: 'observation',
    source,
    ...opts,
  };
}

beforeEach(() => {
  (globalThis as any).fetch = undefined;
  vi.mocked(requestUrl).mockReset();
  resetAIProviderCache();
});

afterEach(() => {
  delete (globalThis as any).fetch;
});

describe('dossierEventFromMemory 白名单判别（只留正性）', () => {
  it('五类正性来源命中并映射类型/标题', () => {
    const book = dossierEventFromMemory(obs('你读完了《小王子》', 'domain:library'))!;
    expect(book.type).toBe('book');
    expect(book.title).toBe('小王子');
    expect(book.eventId).toBeTruthy();

    const letter = dossierEventFromMemory(obs('你在 2026-08-20 写了一封信「给未来的我」：见字如面', 'letter'))!;
    expect(letter.type).toBe('letter');
    expect(letter.title).toBe('给未来的我');

    const poem = dossierEventFromMemory(obs('你在 2026-08-21 写了一首现代诗《x》《y》'.replace('《x》《y》', '「夜航」') + '：星光落在铁轨上', 'poem'))!;
    expect(poem.type).toBe('poem');
    expect(poem.title).toBe('夜航');

    const rate1 = dossierEventFromMemory(obs('你给《星际穿越》评了 9 分', 'movie'))!;
    expect(rate1.type).toBe('movie');
    expect(rate1.title).toBe('星际穿越');
    const rate2 = dossierEventFromMemory(obs('你把《盗梦空间》的评分从 8 改为 9', 'movie'))!;
    expect(rate2.type).toBe('movie');
    expect(rate2.title).toBe('盗梦空间');

    const diary = dossierEventFromMemory(obs('你在 2026-08-24 09:30 写了一篇日记（分类：生活）：今天天气很好', 'diary'))!;
    expect(diary.type).toBe('diary');
    expect(diary.title).toBeUndefined();
  });

  it('非白名单来源/句式不入（负面与中性一律 null）', () => {
    // 其他来源
    expect(dossierEventFromMemory(obs('用户说：今天好累', 'chat'))).toBeNull();
    expect(dossierEventFromMemory(obs('备忘录完成了：买书', 'memo'))).toBeNull();
    expect(dossierEventFromMemory(obs('你剪藏了文章', 'clipping'))).toBeNull();
    // 书库非「读完」句式
    expect(dossierEventFromMemory(obs('你把《A》加入了书架', 'domain:library'))).toBeNull();
    expect(dossierEventFromMemory(obs('你开始读《A》', 'domain:library'))).toBeNull();
    expect(dossierEventFromMemory(obs('你把《A》移出了书架', 'domain:library'))).toBeNull();
    expect(dossierEventFromMemory(obs('你读了《A》约 12 分钟（读到 40%）', 'domain:library'))).toBeNull();
    // 影视非打分句式
    expect(dossierEventFromMemory(obs('你看完了《B》，给了 0 分', 'movie'))).toBeNull(); // 0 分文案不带分值段
    expect(dossierEventFromMemory(obs('你写了《B》的影评：不错', 'movie'))).toBeNull();
    expect(dossierEventFromMemory(obs('你删除了《B》的影视记录', 'movie'))).toBeNull();
    // 日记更新/删除句式
    expect(dossierEventFromMemory(obs('你更新了日记（2026-08-24 09:30）：改内容', 'diary'))).toBeNull();
    expect(dossierEventFromMemory(obs('你删除了 2026-08-24 09:30 的日记', 'diary'))).toBeNull();
    // 三域 diff/删除句式
    expect(dossierEventFromMemory(obs('你删除了信「X」', 'letter'))).toBeNull();
    expect(dossierEventFromMemory(obs('卡片盒「X」第 1 段有修改', 'flash'))).toBeNull();
    // 洞察不入
    const insight = obs('【洞察】反思产物', 'reflection');
    insight.type = 'insight';
    expect(dossierEventFromMemory(insight)).toBeNull();
    // 缺 id / 缺时间
    const noId = obs('你读完了《C》', 'domain:library');
    noId.id = '';
    expect(dossierEventFromMemory(noId)).toBeNull();
    const noAt = obs('你读完了《C》', 'domain:library');
    noAt.created = '';
    expect(dossierEventFromMemory(noAt)).toBeNull();
  });
});

describe('appendDossierEvent 即写（幂等/环形/兼容）', () => {
  it('eventId 幂等：同条目二次写入不重复', () => {
    const d = defaultSmartCatData();
    const m = obs('你读完了《小王子》', 'domain:library');
    expect(appendDossierEvent(d, m)).toBe(true);
    expect(appendDossierEvent(d, m)).toBe(false);
    expect(getDossierEvents(d).length).toBe(1);
    // 不同 eventId 的同文案事件各自保留（幂等键是记忆条目 id 而非文案）
    const m2 = obs('你读完了《小王子》', 'domain:library');
    expect(appendDossierEvent(d, m2)).toBe(true);
    expect(getDossierEvents(d).length).toBe(2);
  });

  it(`环形截断：超过 ${DOSSIER_EVENTS_CAP} 条丢最旧保最新`, () => {
    const d = defaultSmartCatData();
    for (let i = 0; i < DOSSIER_EVENTS_CAP + 5; i++) {
      appendDossierEvent(d, obs(`你读完了《书${i}》`, 'domain:library'));
    }
    const evts = getDossierEvents(d);
    expect(evts.length).toBe(DOSSIER_EVENTS_CAP);
    expect(evts.some((e) => e.title === '书4')).toBe(false); // 最旧的被挤出
    expect(evts[evts.length - 1].title).toBe(`书${DOSSIER_EVENTS_CAP + 4}`); // 最新在尾部
  });

  it('editingData 兼容：null 兜底展开、既有字段全保留、非白名单不建对象', () => {
    const d1 = defaultSmartCatData();
    d1.editingData = null;
    expect(appendDossierEvent(d1, obs('你读完了《X》', 'domain:library'))).toBe(true);
    expect(Object.keys(d1.editingData.dossierEvents).length).toBeGreaterThan(0);

    const d2 = defaultSmartCatData();
    d2.editingData = { weeklyReport: { weekKey: '2026-W34', at: 123 }, lastPresenceAt: 456 };
    appendDossierEvent(d2, obs('你读完了《Y》', 'domain:library'));
    expect(d2.editingData.weeklyReport).toEqual({ weekKey: '2026-W34', at: 123 });
    expect(d2.editingData.lastPresenceAt).toBe(456);
    expect(d2.editingData.dossierEvents.length).toBe(1);

    const d3 = defaultSmartCatData();
    d3.editingData = null;
    expect(appendDossierEvent(d3, obs('用户说：聊天不算', 'chat'))).toBe(false);
    expect(d3.editingData).toBeNull(); // 未写入不落对象
  });

  it('getDossierEvents 防御归一：非法元素过滤、缺字段容忍', () => {
    const d = defaultSmartCatData();
    d.editingData = {
      dossierEvents: [
        { eventId: 'a', type: 'book', at: new Date().toISOString(), title: 'A' },
        { eventId: 'b', type: 'negative', at: new Date().toISOString() }, // 类型非法
        { eventId: '', type: 'book', at: new Date().toISOString() }, // 空 id
        { eventId: 'c', type: 'diary' }, // 缺 at
        null,
        'junk',
      ],
    };
    expect(getDossierEvents(d).length).toBe(1);
    expect(getDossierEvents(d)[0].eventId).toBe('a');
    const dNull = defaultSmartCatData();
    dNull.editingData = null;
    expect(getDossierEvents(dNull)).toEqual([]);
  });
});

describe('countCompanionDays / deriveTimeline 纯函数重建', () => {
  it('陪伴天数 = 观察去重日本地日计数（洞察不计、同日多条归一）', () => {
    const now = new Date(2026, 7, 24, 12, 0, 0).getTime();
    const stream: MemoryStreamEntry[] = [
      obs('a', 'chat', { created: new Date(now).toISOString() }),
      obs('b', 'chat', { created: new Date(now + 3600e3).toISOString() }), // 同日
      obs('c', 'diary', { created: new Date(now - 86400e3).toISOString() }), // 前一日
      { ...obs('i', 'reflection'), type: 'insight' }, // 洞察不计
    ];
    expect(countCompanionDays(stream)).toBe(2);
    expect(countCompanionDays([])).toBe(0);
  });

  it('空表兜底：仅统计行含陪伴天数与零计数', () => {
    const rows = deriveTimeline([], { companionDays: 42 });
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('summary');
    expect(rows[0].lines[0]).toContain('已陪伴 42 天');
    expect(rows[0].lines[0]).toContain('0 件温暖小事');
  });

  it('周聚合：跨两周排序最新在前、类型短语按固定顺序拼接', () => {
    const nowT = new Date(2026, 7, 24, 12, 0, 0).getTime(); // 周一
    const thisWeek = new Date(nowT).toISOString();
    const lastWeek = new Date(nowT - 10 * 86400e3).toISOString(); // 上上周
    const events = [
      { eventId: 'l1', type: 'letter' as const, at: lastWeek },
      { eventId: 'l2', type: 'letter' as const, at: lastWeek },
      { eventId: 'b1', type: 'book' as const, at: thisWeek, title: '小王子' },
      { eventId: 'm1', type: 'movie' as const, at: thisWeek, title: '星际穿越' },
    ];
    const rows = deriveTimeline(events, { companionDays: 5 });
    expect(rows[0].kind).toBe('summary');
    expect(rows[0].lines[0]).toContain('4 件温暖小事');
    const weeks = rows.filter((r) => r.kind === 'week');
    expect(weeks.length).toBe(2);
    expect(weeks[0].lines[0]).toContain('读完了《小王子》'); // 本周在前
    expect(weeks[0].lines[0]).toContain('给《星际穿越》打了分');
    expect(weeks[0].title).toMatch(/^\d+ 月 \d+ 日 ~ \d+ 月 \d+ 日$/);
    expect(weeks[1].lines[0]).toBe('写了 2 封信'); // 上周在后
    // 无效时间防御过滤
    expect(deriveTimeline([{ eventId: 'x', type: 'book', at: 'not-a-date', title: 'X' }], {}).filter((r) => r.kind === 'week').length).toBe(0);
  });

  it('buildNarrativeInput：近 8 周、超长裁剪', () => {
    const base = new Date(2026, 7, 24, 12, 0, 0).getTime();
    const events = Array.from({ length: 12 }, (_, i) => ({
      eventId: `e${i}`,
      type: 'book' as const,
      at: new Date(base - i * 7 * 86400e3).toISOString(),
      title: `书${i}`,
    }));
    const input = buildNarrativeInput(events);
    expect(input).toContain('书0');
    expect(input.split('\n').length).toBeLessThanOrEqual(8); // 近 8 周
    expect(input.length).toBeLessThanOrEqual(1200);
  });
});

describe('情绪标签变化日（关键时刻检测）', () => {
  function obsAt(desc: string, t: number, emotion: string): MemoryStreamEntry {
    return obs(desc, 'chat', { created: new Date(t).toISOString(), emotion });
  }
  it('多数标签判定 + 与前一有标注日比较 + 无标注日不断链', () => {
    const base = new Date(2026, 7, 24, 12, 0, 0).getTime();
    const day = 86400e3;
    const stream = [
      obsAt('a', base, 'happy'),
      obsAt('b', base + 3600e3, 'happy'), // day0 多数 happy
      obsAt('c', base + day, 'happy'),    // day1 happy → 不变
      obsAt('d', base + 2 * day, 'sad'),  // day2 sad → 变化日
      // day3 无标注（跳过不断链）
      obsAt('e', base + 4 * day, 'sad'),  // day4 sad → 与前有标注日相同不变
      obsAt('f', base + 5 * day, 'calm'), // day5 calm → 变化日
    ];
    const shifts = detectEmotionShiftDays(stream);
    expect(shifts.map((s) => s.dayKey)).toEqual([dkey(base + 2 * day), dkey(base + 5 * day)]);
    expect(shifts[0].emotion).toBe('sad');
    // 多数标签：day0 若混入一个 sad 仍为 happy（2:1）
    const mixed = detectEmotionShiftDays([
      obsAt('a', base, 'happy'),
      obsAt('b', base + 1800e3, 'sad'),
      obsAt('c', base + 3600e3, 'happy'),
    ]);
    expect(mixed.length).toBe(0); // 单日无「前日」可比
    expect(majorityEmotionByDay([
      obsAt('a', base, 'happy'),
      obsAt('b', base + 1800e3, 'sad'),
      obsAt('c', base + 3600e3, 'happy'),
    ])[0].emotion).toBe('happy');
  });

  it('并列标签取当日最先出现者（确定性）', () => {
    const base = new Date(2026, 7, 24, 9, 0, 0).getTime();
    const perDay = majorityEmotionByDay([
      obsAt('a', base, 'curious'),
      obsAt('b', base + 60e3, 'focused'),
    ]);
    expect(perDay[0].emotion).toBe('curious');
  });
});

describe('叙事周键推进与退避独立性', () => {
  const nowT = new Date(2026, 7, 24, 12, 0, 0).getTime();
  it('shouldScanDossierNarrative：本周已生成 false；新周+本周有事件 true；仅旧事件 false', () => {
    const wkThis = '2026-W35';
    expect(shouldScanDossierNarrative(wkThis, wkThis, [{ eventId: 'a', type: 'book', at: new Date(nowT).toISOString() }], nowT)).toBe(false);
    expect(shouldScanDossierNarrative('2026-W34', wkThis, [{ eventId: 'a', type: 'book', at: new Date(nowT).toISOString() }], nowT)).toBe(true);
    expect(shouldScanDossierNarrative('', wkThis, [{ eventId: 'a', type: 'book', at: new Date(nowT - 30 * 86400e3).toISOString() }], nowT)).toBe(false);
    expect(shouldScanDossierNarrative('2026-W34', wkThis, [], nowT)).toBe(false);
  });

  it('advanceDossierScanKey 只动 dossierScanKey，weeklyReport/reflection 等状态原样（独立性）', () => {
    const d: SmartCatData = defaultSmartCatData();
    d.editingData = { weeklyReport: { weekKey: '2026-W34', at: 1 }, ceBandit: { empathy: {} }, lastPresenceAt: 2 };
    d.memory.reflection.lastReflectAt = 999;
    advanceDossierScanKey(d, '2026-W35');
    expect(d.editingData.dossierScanKey).toBe('2026-W35');
    expect(d.editingData.weeklyReport).toEqual({ weekKey: '2026-W34', at: 1 });
    expect(d.editingData.ceBandit).toEqual({ empathy: {} });
    expect(d.editingData.lastPresenceAt).toBe(2);
    expect(d.memory.reflection.lastReflectAt).toBe(999); // 不碰 reflectBackoff 相关持久化
  });

  it('generateDossierNarrative：AI 未配置返回空串（静默）；配置后走 LLM；失败静默', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }));
    expect(await generateDossierNarrative('8 月 17 日 ~ 8 月 23 日：读完了《小王子》')).toBe('');
    resetAIProviderCache();
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"narrative": "这个八月我们一起读完了一本书。"}' } }] }),
    }));
    (globalThis as any).fetch = fetchMock;
    const text = await generateDossierNarrative('输入');
    expect(text).toContain('这个八月');
    // H4 边界：system 含「数据非指令」边界声明（USER_CONTENT_BOUNDARY 内容）
    const sysCall = JSON.parse((fetchMock as any).mock.calls[0][1].body);
    expect(sysCall.messages[0].content).toContain('仅作为数据引用');
    // 失败静默
    (globalThis as any).fetch = vi.fn(async () => { throw new Error('boom'); });
    expect(await generateDossierNarrative('输入')).toBe('');
  });
});

// ---------------- UI 层 ----------------

/** UI 夹具：事件表两条（跨两周）+ 情绪变化观察 + 当日备忘 */
function uiFixture(): SmartCatData {
  const d = defaultSmartCatData();
  const nowT = Date.now();
  const day = 86400e3;
  d.editingData = {
    ...d.editingData,
    dossierEvents: [
      { eventId: 'e-book', type: 'book', at: new Date(nowT).toISOString(), title: '小王子' },
      { eventId: 'e-letter', type: 'letter', at: new Date(nowT - 10 * day).toISOString() },
    ],
  };
  const mk = (agoDay: number, emotion: string): MemoryStreamEntry => ({
    id: `m-${agoDay}-${emotion}`,
    created: new Date(nowT - agoDay * day).toISOString(),
    lastAccessed: new Date(nowT - agoDay * day).toISOString(),
    description: `观察 ${agoDay} 天前`,
    importance: 0.5,
    type: 'observation',
    source: 'chat',
    emotion,
  });
  d.memory.memoryStream = [
    mk(0, 'happy'),
    mk(1, 'happy'), // 变化日 = 昨天：前有标注日（前天 sad）多数标签不同
    mk(2, 'sad'),
    { id: 'n1', created: new Date(nowT).toISOString(), lastAccessed: '', description: '【一起的日子】八月的第一个星期我们读完了一本书。', importance: 0.6, type: 'insight', source: 'dossier' },
  ];
  return d;
}

function makeUiApp(fixture: SmartCatData, memoJson?: string) {
  const vault = new MockVault();
  vault.create(getSmartcatFilePath(), JSON.stringify(fixture));
  if (memoJson !== undefined) vault.create('CONFIG/STORAGE/memo.json', memoJson);
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false }) as any);
  return app;
}

describe('「一起的日子」区块 UI', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    closeSmartcatDashboard();
  });

  it('总览页渲染时间线/兜底统计/叙事/关键时刻（含当日备忘）', async () => {
    const shiftDay = dkey(Date.now() - 1 * 86400e3); // 变化日 = 昨天（sad → happy）
    const memoJson = JSON.stringify([
      { id: 't1', title: '给花浇水', scene: '生活', priority: 'minor', created: `${shiftDay} 08:00:00`, completed: null, due: null, notePath: null, notePosition: null, scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null },
      { id: 't2', title: '别的日子的事', scene: '工作', priority: 'minor', created: '2020-01-01 08:00:00', completed: null, due: null, notePath: null, notePosition: null, scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null },
    ]);
    await openSmartcatDashboard(makeUiApp(uiFixture(), memoJson));
    const overview = document.querySelector('[data-pane="overview"]')!;
    expect(overview.textContent).toContain('一起的日子');
    expect(overview.textContent).toContain('已陪伴');
    expect(overview.textContent).toContain('2 件温暖小事');
    expect(overview.textContent).toContain('读完了《小王子》');
    // 叙事摘要（source=dossier 洞察）
    expect(overview.textContent).toContain('八月的第一个星期');
    // 关键时刻：情绪转向日 + 当日备忘标题
    expect(overview.textContent).toContain('关键时刻');
    expect(overview.textContent).toContain(shiftDay);
    expect(overview.textContent).toContain('给花浇水');
    expect(overview.textContent).not.toContain('别的日子的事'); // 只取当日备忘
  }, 15000);

  it('空数据空态：兜底统计行 + 引导文案，无周行无关键时刻', async () => {
    await openSmartcatDashboard(makeUiApp(defaultSmartCatData()));
    const overview = document.querySelector('[data-pane="overview"]')!;
    expect(overview.textContent).toContain('已陪伴 0 天');
    expect(overview.textContent).toContain('还没有值得纪念的大事小事');
    expect(overview.querySelectorAll('.bz-sc-dash-dossier-week').length).toBe(0);
    expect(overview.querySelectorAll('.bz-sc-dash-dossier-moments').length).toBe(0);
  }, 15000);

  it('buildDossierNarratives 收集：去前缀/新→旧/非 dossier 洞察不收', () => {
    const nowIso = new Date().toISOString();
    const oldIso = new Date(Date.now() - 7 * 86400e3).toISOString();
    const rows = buildDossierNarratives([
      { id: 'a', created: nowIso, lastAccessed: '', description: '【一起的日子】新的小结', importance: 0.6, type: 'insight', source: 'dossier' },
      { id: 'b', created: oldIso, lastAccessed: '', description: '旧的小结', importance: 0.6, type: 'insight', source: 'dossier' },
      { id: 'c', created: nowIso, lastAccessed: '', description: '【本周懂你报告】不是叙事', importance: 0.8, type: 'insight', source: 'weekly-report' },
      { id: 'e', created: nowIso, lastAccessed: '', description: '', importance: 0.6, type: 'insight', source: 'dossier' },
    ] as MemoryStreamEntry[]);
    expect(rows.map((r) => r.text)).toEqual(['新的小结', '旧的小结']);
  });
});