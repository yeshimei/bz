/**
 * 人物档案扩维度 UI 测试（issue 487）：编辑器十维字段渲染与结构行增删、saveProfile 解析
 * （数组顿号 / 逗号切分去重去空、结构行半行过滤、全空清档案）、AI 补充回填新维度且手填不覆盖、
 * persistJobDone 把 job.aiProfile 合并回档案（fillProfile 只填空白）。
 * issue 505 相册簿口径：墙上抓 [data-people-pocket] 抽出照片（240ms）翻到详情页，
 * 补充背景 / 记一笔 / 统计是册子里的一页（[data-people-sub]）不再是浮层。
 * 引擎用假件注入（setJobsModuleForTests）；core/ai 打桩供 AI 补充；测试数据全构造。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import * as aiMod from '../../src/core/ai';
import {
  closePeoplePanel,
  openPeoplePanel,
  setJobsModuleForTests,
  startGeneration,
  type GenTarget,
  type JobsApi,
} from '../../src/people/ui';
import type { PersonJob, JobView, JobsSnapshot } from '../../src/people/jobs';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { FaceDigest, PersonEntry } from '../../src/people/types';

vi.mock('../../src/core/ai', () => ({
  createAI: vi.fn(),
  DEFAULT_AI_PROVIDER: 'zhipu',
  getProviderDescriptor: () => ({ label: '智谱 Plan', model: 'glm-test' }),
}));
const createAI = vi.mocked(aiMod.createAI);
const jsonMock = vi.fn();

const T0 = new Date('2026-09-25T08:00:00').getTime();
const PW = 'profile-dims-ui-pw';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let lastSafe: PeopleSafeStore | null = null;
const disk = async (): Promise<{ people: PersonEntry[] }> =>
  lastSafe ? { people: [...(await lastSafe.readAll()).values()].map((r) => r.person) } : { people: [] };

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** 497：startGeneration 起引擎前翻一次开工单页（505：册子里的 `[data-people-sub="gen"]`）——等它出现并点「开始生成」放行 */
async function confirmGen(): Promise<void> {
  await vi.waitFor(() => expect(document.querySelector('[data-people-sub="gen"]')).toBeTruthy());
  click('[data-people-gen-start]');
}

function inputVal(sel: string, value: string): void {
  const inp = document.querySelector<HTMLInputElement>(sel)!;
  inp.value = value;
}

/** 构造已有档案 + 脸谱素材的人物 */
function person(over: Partial<PersonEntry> = {}): PersonEntry {
  const digest: FaceDigest = {
    portrait: '## 画像\n构造画像',
    events: [
      { ts: '2026-05-01', summary: '构造大事', kind: 'major' },
      { ts: '2026-05-02', summary: '构造小事' },
    ],
    quotes: [{ ts: '2026-05-01', who: '对方', text: '构造原话' }],
    moments: [{ ts: '2026-05-01', summary: '构造场景' }],
    traits: ['构造特质'],
    interests: [{ ts: '2026-05-01', topic: '构造兴趣' }],
    threads: [{ ts: '2026-05-01', text: '构造未竟' }],
    generatedAt: '2026-09-01T00:00:00.000Z',
  };
  return {
    id: 'wxid_a',
    name: '陈默',
    createdAt: '2026-03-01T00:00:00.000Z',
    imports: [],
    digest,
    profile: { birthday: '1990-01-01', job: '设计师' },
    ...over,
  };
}

async function boot(seed?: PersonEntry[]): Promise<void> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  lastSafe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(lastSafe);
  for (const p of seed ?? []) {
    await lastSafe.write(p.id, (rec) => {
      rec.person = p;
    });
  }
}

/** 面板开到人物详情的补充背景编辑态（issue 505：抽照片 → 详情页「补充背景」小签 → 档案页） */
async function openEditor(seed?: PersonEntry[]): Promise<void> {
  await boot(seed);
  setJobsModuleForTests(new FakeEngine());
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(document.querySelector('[data-people-pocket="wxid_a"]')).toBeTruthy());
  click('[data-people-pocket="wxid_a"]'); // 抽出照片（240ms 动画后详情页翻开在对面）
  await vi.waitFor(() => expect(document.querySelector('[data-people-detail="wxid_a"]')).toBeTruthy());
  click('[data-people-act="prof"]'); // 详情页「补充背景」小签 → 册子里翻出档案页
  await vi.waitFor(() => expect(document.querySelector('[data-people-sub="prof"]')).toBeTruthy());
  // 有档案走「编辑档案」，无档案走入口行的「补人物档案」
  click('[data-people-prof-edit], [data-people-prof-new]');
  await vi.waitFor(() => expect(document.querySelector('.bz-people-prof-edit')).toBeTruthy());
}

/** 三条消息的构造素材 */
function msgs(): GenTarget['msgs'] {
  return [
    { ts: T0, isSender: true, text: '早' },
    { ts: T0 + 60_000, isSender: false, text: '早呀' },
    { ts: T0 + 120_000, isSender: true, text: '中午吃什么' },
  ];
}

function target(over: Partial<GenTarget> = {}): GenTarget {
  return {
    talker: 'wxid_a',
    name: '陈默',
    msgs: msgs(),
    kindCounts: { 文本: 3 },
    skippedCount: 0,
    fileLabel: '数据源:陈默',
    ...over,
  };
}

function meta(from = '2026-09-01', to = '2026-09-30', count = 397) {
  return { from, to, count };
}

function fakeJob(over: Partial<PersonJob> = {}): PersonJob {
  return {
    talker: 'wxid_a',
    name: '陈默',
    mode: 'full',
    fileLabel: '数据源:陈默',
    status: 'running',
    stage: 'extracting',
    msgCount: 3,
    contentHash: 'fakehash',
    chunks: [meta()],
    batchesDone: 0,
    results: [],
    material: { traits: [], moments: [] },
    importRecord: { fileLabel: '数据源:陈默', skippedCount: 0, messageCount: 3, timeFrom: new Date(T0).toISOString(), timeTo: new Date(T0 + 120_000).toISOString() },
    startedAt: new Date(T0).toISOString(),
    updatedAt: new Date(T0).toISOString(),
    ...over,
  };
}

class FakeEngine implements JobsApi {
  items: PersonJob[] = [];
  private listeners: Array<(s: JobsSnapshot) => void> = [];
  startJobs = async (_app: unknown, targets: GenTarget[]): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }> =>
    ({ queued: targets.map((t) => t.name), skipped: [], resumed: [] });
  resumeJobs = async (): Promise<void> => {};
  resume = (): boolean => true;
  pauseJobs = (): void => {};
  removeJob = (talker: string): boolean => {
    const before = this.items.length;
    this.items = this.items.filter((j) => j.talker !== talker);
    if (this.items.length < before) { this.emit(); return true; }
    return false;
  };
  subscribe = (fn: (s: JobsSnapshot) => void): (() => void) => {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
  };
  snapshot = (): JobsSnapshot => this.snap();
  push(items: PersonJob[]): void {
    this.items = items;
    this.emit();
  }
  private snap(): JobsSnapshot {
    const currentIndex = this.items.findIndex((j) => j.status === 'running');
    const queue: JobView[] = this.items.map((job, i) => ({
      ...job,
      batchesTotal: job.chunks?.length ?? 0,
      queueIndex: i + 1,
      queueTotal: this.items.length,
    }));
    return { queue, currentIndex, running: currentIndex >= 0 };
  }
  private emit(): void {
    const s = this.snap();
    for (const fn of [...this.listeners]) fn(s);
  }
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  createAI.mockReturnValue({ json: jsonMock } as never);
});

afterEach(() => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setPeopleSafeStoreForTests(null);
  lastSafe = null;
});

describe('档案编辑器新字段渲染（issue 487）', () => {
  it('十维输入行齐备：自由文本 / 数组切分行 / 身边人与重要日子的容器与添加钮', async () => {
    await openEditor([person()]);
    for (const f of ['birthday', 'nickname', 'metVia', 'metAt', 'hometown', 'job', 'personality', 'interests', 'quote', 'likes', 'dislikes', 'habits', 'recentLife', 'note']) {
      expect(document.querySelector(`[data-people-prof-field="${f}"]`), `字段 ${f}`).toBeTruthy();
    }
    expect(document.querySelector('[data-people-prof-rel-list]')).toBeTruthy();
    expect(document.querySelector('[data-people-prof-date-list]')).toBeTruthy();
    expect(document.querySelector('[data-people-prof-add-rel]')!.textContent).toBe('+ 身边人');
    expect(document.querySelector('[data-people-prof-add-date]')!.textContent).toBe('+ 重要日子');
    // 已有档案回显：数组维度以顿号串回显
    expect((document.querySelector<HTMLInputElement>('[data-people-prof-field="birthday"]')!.value)).toBe('1990-01-01');
  });

  it('结构行行内增删：+ 身边人 / + 重要日子追加行，× 就地移除（不动其他行）', async () => {
    await openEditor([person()]);
    click('[data-people-prof-add-rel]');
    click('[data-people-prof-add-rel]');
    click('[data-people-prof-add-date]');
    expect(document.querySelectorAll('[data-people-prof-rel-list] .bz-people-prof-subrow')).toHaveLength(2);
    expect(document.querySelectorAll('[data-people-prof-date-list] .bz-people-prof-subrow')).toHaveLength(1);
    // 删第一条身边人行
    document.querySelector('[data-people-prof-rel-list] [data-people-prof-rel-del]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelectorAll('[data-people-prof-rel-list] .bz-people-prof-subrow')).toHaveLength(1);
    // 删重要日子行
    document.querySelector('[data-people-prof-date-list] [data-people-prof-date-del]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelectorAll('[data-people-prof-date-list] .bz-people-prof-subrow')).toHaveLength(0);
  });
});

describe('saveProfile 解析新字段（issue 487）', () => {
  it('自由文本 + 数组顿号 / 逗号切分去重去空 + 结构行落盘；半行过滤并提示', async () => {
    await openEditor([person({ profile: undefined })]);
    inputVal('[data-people-prof-field="nickname"]', '老猫');
    inputVal('[data-people-prof-field="personality"]', '外冷内热');
    inputVal('[data-people-prof-field="interests"]', '爬山、爬山、 电影，摇滚、'); // 重复 + 空段 + 逗号混排
    inputVal('[data-people-prof-field="likes"]', '手冲咖啡');
    inputVal('[data-people-prof-field="dislikes"]', '香菜');
    inputVal('[data-people-prof-field="habits"]', '早睡早起');
    inputVal('[data-people-prof-field="recentLife"]', '在备考');
    inputVal('[data-people-prof-field="quote"]', '问题不大');
    click('[data-people-prof-add-rel]');
    inputVal('[data-people-prof-rel-list] [data-people-prof-rel-who]', '阿珍');
    inputVal('[data-people-prof-rel-list] [data-people-prof-rel-relation]', '女朋友');
    click('[data-people-prof-add-rel]'); // 半行：只填 who
    inputVal('[data-people-prof-rel-list] .bz-people-prof-subrow:nth-child(2) [data-people-prof-rel-who]', '老张');
    click('[data-people-prof-add-date]');
    inputVal('[data-people-prof-date-list] [data-people-prof-date-date]', '05-20');
    inputVal('[data-people-prof-date-list] [data-people-prof-date-what]', '领养猫');
    click('[data-people-prof-save]');
    await vi.waitFor(async () => expect((await disk()).people[0]?.profile?.nickname).toBe('老猫'));
    const prof = (await disk()).people[0].profile!;
    expect(prof.personality).toBe('外冷内热');
    expect(prof.interests).toEqual(['爬山', '电影', '摇滚']); // 去重去空，逗号也切
    expect(prof.likes).toEqual(['手冲咖啡']);
    expect(prof.dislikes).toEqual(['香菜']);
    expect(prof.habits).toBe('早睡早起');
    expect(prof.recentLife).toBe('在备考');
    expect(prof.quote).toBe('问题不大');
    expect(prof.relationships).toEqual([{ who: '阿珍', relation: '女朋友' }]); // 半行（老张）被过滤
    expect(prof.importantDates).toEqual([{ date: '05-20', what: '领养猫' }]);
    // 落盘可见（保库记录缓存）先于保存流程收尾，通知等它落地再断言
    await vi.waitFor(() => expect(getNoticeMessages().some((m) => m.includes('1 行没填完整'))).toBe(true));
  });

  it('编辑卡全空 = 清档案（落盘 undefined）', async () => {
    await openEditor([person()]);
    // 编辑卡预填了已有档案：清空全部输入再保存
    for (const inp of Array.from(document.querySelectorAll<HTMLInputElement>('[data-people-prof-field]'))) inp.value = '';
    click('[data-people-prof-save]');
    await vi.waitFor(async () => expect((await disk()).people[0]?.profile).toBeUndefined());
    await vi.waitFor(() => expect(getNoticeMessages().some((m) => m.includes('档案已清空'))).toBe(true));
  });
});

describe('AI 补充回填新维度（issue 487）', () => {
  it('契约扩到新维度：只填空白输入行，手填生日不覆盖；数组与结构行回填；保存后落盘', async () => {
    await openEditor([person({ profile: { birthday: '1990-01-01', job: '设计师' } })]);
    jsonMock.mockResolvedValue(JSON.stringify({
      birthday: '1994-02-14', // 手填过：不覆盖
      personality: '外冷内热',
      nickname: '老猫',
      interests: ['爬山', '摇滚'],
      quote: '问题不大',
      likes: ['手冲咖啡'],
      dislikes: ['香菜'],
      habits: '早睡早起',
      recentLife: '在备考',
      tags: ['同学'],
      relationships: [{ who: '阿珍', relation: '女朋友' }],
      importantDates: [{ date: '05-20', what: '领养猫' }],
    }));
    click('[data-people-prof-ai]');
    await vi.waitFor(() => expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="personality"]')!.value).toBe('外冷内热'));
    // 手填不动，空白全补
    expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="birthday"]')!.value).toBe('1990-01-01');
    expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="nickname"]')!.value).toBe('老猫');
    expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="interests"]')!.value).toBe('爬山、摇滚');
    expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="likes"]')!.value).toBe('手冲咖啡');
    expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="dislikes"]')!.value).toBe('香菜');
    expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="quote"]')!.value).toBe('问题不大');
    expect(document.querySelectorAll('[data-people-prof-tag-list] .bz-people-prof-tag-text')).toHaveLength(1);
    expect(document.querySelectorAll('[data-people-prof-rel-list] .bz-people-prof-subrow')).toHaveLength(1);
    expect(document.querySelectorAll('[data-people-prof-date-list] .bz-people-prof-subrow')).toHaveLength(1);
    expect(getNoticeMessages().some((m) => m.includes('AI 已补'))).toBe(true);
    // 保存后全部落盘
    click('[data-people-prof-save]');
    await vi.waitFor(async () => expect((await disk()).people[0]?.profile?.personality).toBe('外冷内热'));
    const prof = (await disk()).people[0].profile!;
    expect(prof.birthday).toBe('1990-01-01'); // 手填优先
    expect(prof.job).toBe('设计师'); // 编辑卡里原有的值不丢
    expect(prof.interests).toEqual(['爬山', '摇滚']);
    expect(prof.tags).toEqual(['同学']);
    expect(prof.relationships).toEqual([{ who: '阿珍', relation: '女朋友' }]);
    expect(prof.importantDates).toEqual([{ date: '05-20', what: '领养猫' }]);
  });

  it('结构行已有内容 / AI 无据可填：不追加行、提示未作补充', async () => {
    await openEditor([person({ profile: { birthday: '1990-01-01', relationships: [{ who: '老张', relation: '同事' }] } })]);
    jsonMock.mockResolvedValue(JSON.stringify({ birthday: '', personality: '', interests: [] }));
    click('[data-people-prof-ai]');
    await tick();
    await vi.waitFor(() => expect(getNoticeMessages().some((m) => m.includes('未作补充'))).toBe(true));
    expect(document.querySelectorAll('[data-people-prof-rel-list] .bz-people-prof-subrow')).toHaveLength(1); // 已有行不动
    expect(document.querySelectorAll('[data-people-prof-date-list] .bz-people-prof-subrow')).toHaveLength(0);
  });
});

describe('persistJobDone 档案自动回填（issue 487）', () => {
  it('done 任务带 aiProfile：fillProfile 合并落盘，手填字段原样保留', async () => {
    await boot([person({ profile: { birthday: '1990-01-01', interests: ['钓鱼'], job: '设计师' } })]);
    const engine = new FakeEngine();
    setJobsModuleForTests(engine);
    openPeoplePanel(getApp());
    await tick();
    const gen = startGeneration([target()]);
    await confirmGen(); // 497：总确认放行后才起引擎
    await gen;
    engine.push([fakeJob({
      status: 'done',
      stage: 'done',
      message: '「陈默」脸谱已生成',
      batchesDone: 1,
      person: '## 画像\n构造画像',
      events: [],
      aiProfile: {
        birthday: '1994-02-14', // 手填：不覆盖
        personality: '外冷内热',
        quote: '问题不大',
        interests: ['爬山', '摇滚'], // 手填数组：不覆盖
        likes: ['手冲咖啡'],
        relationships: [{ who: '阿珍', relation: '女朋友' }],
        importantDates: [{ date: '05-20', what: '领养猫' }],
      },
    })]);
    await vi.waitFor(async () => expect((await disk()).people[0]?.profile?.personality).toBe('外冷内热'));
    const prof = (await disk()).people[0].profile!;
    expect(prof.birthday).toBe('1990-01-01'); // 手填保留
    expect(prof.job).toBe('设计师');
    expect(prof.interests).toEqual(['钓鱼']); // 手填数组保留
    expect(prof.quote).toBe('问题不大'); // AI 只补空白
    expect(prof.likes).toEqual(['手冲咖啡']);
    expect(prof.relationships).toEqual([{ who: '阿珍', relation: '女朋友' }]);
    expect(prof.importantDates).toEqual([{ date: '05-20', what: '领养猫' }]);
  });

  it('done 任务不带 aiProfile：档案原样不动；aiProfile 全空也不写空档案', async () => {
    // 不带 aiProfile：已有档案原样保留
    await boot([person()]);
    const engine = new FakeEngine();
    setJobsModuleForTests(engine);
    openPeoplePanel(getApp());
    await tick();
    const gen = startGeneration([target()]);
    await confirmGen(); // 497：总确认放行后才起引擎
    await gen;
    engine.push([fakeJob({ status: 'done', stage: 'done', batchesDone: 1, person: '画像', events: [] })]);
    await vi.waitFor(async () => expect((await disk()).people[0]?.digest?.person).toBe('画像'));
    expect((await disk()).people[0]?.profile).toEqual({ birthday: '1990-01-01', job: '设计师' });

    // aiProfile 为空对象 + 本来没档案：防御性不落空 profile（引擎侧已兜 undefined）
    try { closePeoplePanel(); } catch { /* 幂等 */ }
    await boot([person({ profile: undefined })]);
    const engine2 = new FakeEngine();
    setJobsModuleForTests(engine2);
    openPeoplePanel(getApp());
    await tick();
    const gen2 = startGeneration([target()]);
    await confirmGen(); // 497：总确认放行后才起引擎
    await gen2;
    engine2.push([fakeJob({ status: 'done', stage: 'done', batchesDone: 1, person: '画像', events: [], aiProfile: {} })]);
    await vi.waitFor(async () => expect((await disk()).people[0]?.digest?.person).toBe('画像'));
    expect((await disk()).people[0]?.profile).toBeUndefined();
  });
});

describe('审计批（2026-10-01）：AI 补充防连点 · 补充素材页签跟人走', () => {
  /** 开到某人的详情页（不预设哪只册页） */
  async function openDetail(id: string): Promise<void> {
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector(`[data-people-pocket="${id}"]`)).toBeTruthy());
    click(`[data-people-pocket="${id}"]`);
    await vi.waitFor(() => expect(document.querySelector(`[data-people-detail="${id}"]`)).toBeTruthy());
  }

  it('AI 补充：进编辑态那次重画期间连点第二下，不再发第二次调用（审计 #6）', async () => {
    await boot([person()]);
    setJobsModuleForTests(new FakeEngine());
    await openDetail('wxid_a');
    click('[data-people-act="prof"]'); // 补充背景页（只读态：还没进编辑器）
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-ai]')).toBeTruthy());
    expect(document.querySelector('.bz-people-prof-edit')).toBeNull(); // 确认是只读态
    jsonMock.mockResolvedValue(JSON.stringify({ personality: '外冷内热' }));

    // 两击落在同一 tick：修复前占位在 await renderAlbum() 之后才置位，第二击会被放行 → 两次 AI 调用
    const btn = document.querySelector<HTMLElement>('[data-people-prof-ai]')!;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(jsonMock).toHaveBeenCalled());
    await tick(60);
    expect(jsonMock).toHaveBeenCalledTimes(1);
    // 该补的照补（不是被占位挡死）
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="personality"]')!.value).toBe('外冷内热')
    );
  });

  it('补充素材页签跟人走：上一位停在「留影」，打开下一位回到「记一笔」（审计 #8）', async () => {
    const other: PersonEntry = { id: 'wxid_b', name: '小李', createdAt: '2026-03-02T00:00:00.000Z', imports: [] };
    await boot([person(), other]);
    setJobsModuleForTests(new FakeEngine());

    await openDetail('wxid_a');
    click('[data-people-act="note"]'); // 补充素材
    await vi.waitFor(() => expect(document.querySelector('[data-people-supp-tab]')).toBeTruthy());
    click('[data-people-supp-tab="image"]'); // 切到留影
    await vi.waitFor(() =>
      expect(document.querySelector('[data-people-supp-tab="image"]')!.classList.contains('on')).toBe(true)
    );

    click('[data-people-act="back"]'); // 回墙上，再打开另一位
    await vi.waitFor(() => expect(document.querySelector(`[data-people-pocket="wxid_b"]`)).toBeTruthy());
    click('[data-people-pocket="wxid_b"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-detail="wxid_b"]')).toBeTruthy());
    click('[data-people-act="note"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-supp-tab]')).toBeTruthy());
    const on = [...document.querySelectorAll<HTMLElement>('[data-people-supp-tab]')].find((t) => t.classList.contains('on'));
    expect(on!.getAttribute('data-people-supp-tab')).toBe('text'); // 修复前会停在 image
  });
});
