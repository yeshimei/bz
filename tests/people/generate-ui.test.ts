/**
 * 生成进度块接线测试（issue 450 E2）：ui.ts 生成链改走 jobs 引擎后的面板行为——
 * 开面板恢复任务态（resumeJobs 重建 + 快照渲染）、订阅驱动原位刷新、
 * done 落盘（PeopleStore / ImportRecord 口径）、暂停 / 继续 / 删除任务按钮派发、
 * 关面板转后台、skip 预筛不进引擎。
 * 引擎用假件注入（setJobsModuleForTests），形状对齐 jobs.ts 真实契约；测试数据全构造。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  closePeoplePanel,
  isPeopleOpen,
  mergedMonthlyOf,
  openPeoplePanel,
  setJobsModuleForTests,
  startGeneration,
  type GenTarget,
  type JobsApi,
} from '../../src/people/ui';
import { DRIFT_ERROR, type PersonJob, type JobView, type JobsSnapshot } from '../../src/people/jobs';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { PersonEntry, UnifiedMessage } from '../../src/people/types';
import type { StoreContact } from '../../src/people/datasource';

const T0 = new Date('2026-09-25T08:00:00').getTime();
const PW = 'gen-test-pw';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
/** 盘上人物卡（467）：保库记录 person 段投影（供 disk() 断言） */
let lastSafe: PeopleSafeStore | null = null;
const disk = async (): Promise<{ people: PersonEntry[] }> =>
  lastSafe ? { people: [...(await lastSafe.readAll()).values()].map((r) => r.person) } : { people: [] };

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** 三条消息的构造素材（ts 升序；kindCounts 对齐文本口径） */
function msgs(): UnifiedMessage[] {
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
    skippedCount: 1,
    fileLabel: '数据源:陈默',
    ...over,
  };
}

function meta(from = '2026-09-01', to = '2026-09-30', count = 397) {
  return { from, to, count };
}

/** 构造引擎任务（PersonJob 必填面 + 常用可选项；person / bond 是新引擎双卷字段——worktree 内 jobs.ts 尚为旧版，形状先于实现） */
function fakeJob(over: Partial<PersonJob> & { person?: string; bond?: string } = {}): PersonJob {
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
    importRecord: { fileLabel: '数据源:陈默', skippedCount: 1, messageCount: 3, timeFrom: new Date(T0).toISOString(), timeTo: new Date(T0 + 120_000).toISOString() },
    message: '消息 3 条 → 1 批（每批 ≤400 条 · ≤12000 字），共 3 次 AI 调用',
    startedAt: new Date(T0).toISOString(),
    updatedAt: new Date(T0).toISOString(),
    ...over,
  };
}

/** 假引擎：记录调用 + 手动推快照（形状对齐 jobs.ts：queue / currentIndex / running） */
class FakeEngine implements JobsApi {
  items: PersonJob[] = [];
  calls = {
    start: [] as Array<{ targets: GenTarget[]; opts: unknown }>,
    resumeJobs: 0,
    pause: 0,
    resume: [] as string[],
    remove: [] as string[],
  };
  private listeners: Array<(s: JobsSnapshot) => void> = [];

  startJobs = async (app: unknown, targets: GenTarget[], opts: unknown): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }> => {
    void app;
    this.calls.start.push({ targets, opts });
    return { queued: targets.map((t) => t.name), skipped: [], resumed: [] };
  };
  resumeJobs = async (): Promise<void> => { this.calls.resumeJobs++; };
  resume = (talker: string): boolean => { this.calls.resume.push(talker); return true; };
  pauseJobs = (): void => { this.calls.pause++; };
  removeJob = (talker: string): boolean => {
    this.calls.remove.push(talker);
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
  /** 引擎推一帧快照（ui 订阅回调同步收到） */
  push(items: PersonJob[]): void {
    this.items = items;
    this.emit();
  }
  private snap(): JobsSnapshot {
    const currentIndex = this.items.findIndex((j) => j.status === 'running');
    // 真引擎快照附派生字段（batchesTotal / queueIndex / queueTotal）——假件同构补齐
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

const inject = (engine: FakeEngine): void => setJobsModuleForTests(engine);

async function boot(seed?: PersonEntry[]): Promise<{ vault: MockVault; safe: PeopleSafeStore; sm: SafeManager }> {
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
  return { vault, safe: lastSafe, sm };
}

/** 聊天仓种子（467：写进保库记录 store 段） */
async function seedStore(safe: PeopleSafeStore, talker = 'wxid_a', count = 2): Promise<void> {
  const store: StoreContact = {
    msgs: Array.from({ length: count }, (_, i) => ({ key: `s${i + 1}:${T0 + i * 60_000}`, ts: T0 + i * 60_000, isSender: i % 2 === 0, type: 1, text: i === 0 ? '早' : '早呀' })),
    watermarkSid: count,
    stats: { msgCount: count, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 },
    updatedAt: new Date(T0).toISOString(),
  };
  await safe.write(talker, (rec) => {
    rec.store = store;
  });
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setPeopleSafeStoreForTests(null);
  lastSafe = null;
});

describe('开面板恢复任务态（450 状态恢复）', () => {
  it('打开面板：resumeJobs 重建一次；进度块只在对应联系人的详情页显示（455 评审），主文案一行 + 暂停钮', async () => {
    await boot([drawnPerson()]);
    const engine = new FakeEngine();
    engine.items = [
      fakeJob({ talker: 'wxid_x', name: '占位甲', status: 'paused', message: '已暂停（0/1 批）' }),
      fakeJob({ talker: 'wxid_a', name: '陈默', message: '第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条', chunks: Array.from({ length: 60 }, () => meta()), batchesDone: 12 }),
      fakeJob({ talker: 'wxid_y', name: '占位乙', status: 'paused', message: '' }),
    ];
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card="wxid_a"]')).toBeTruthy());
    expect(document.querySelector('[data-people-jobs]')).toBeNull(); // 墙上不显示进度块
    click('[data-people-card="wxid_a"]'); // 进陈默详情
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs]')).toBeTruthy());
    expect(engine.calls.resumeJobs).toBe(1); // 每会话只重建一次
    expect(document.querySelector('.bz-people-jobs-main')!.textContent).toBe('正在生成 · 第 13/60 批'); // 455 评审：状态一行
    expect(document.querySelector('.bz-people-jobs-pct')!.textContent).toBe('19%'); // 12/63（455 三段成文分母 +3）
    expect(document.querySelector('[data-people-jobs-pause]')).toBeTruthy();
  });

  it('中断任务恢复：出「继续生成」按钮，块根带 talker', async () => {
    await boot([drawnPerson()]);
    const engine = new FakeEngine();
    engine.items = [fakeJob({ status: 'interrupted', message: '上次未完成，可从断点继续' })];
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card="wxid_a"]')).toBeTruthy());
    click('[data-people-card="wxid_a"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs-resume]')).toBeTruthy());
    expect(document.querySelector('[data-people-jobs]')!.getAttribute('data-people-jobs-talker')).toBe('wxid_a');
    expect(document.querySelector('[data-people-jobs-resume]')!.textContent).toBe('继续生成');
  });

  it('无任务时进度块隐藏；done 任务也不再出块（完成时有通知）', async () => {
    await boot();
    inject(new FakeEngine());
    openPeoplePanel(getApp());
    await tick();
    expect(document.querySelector<HTMLElement>('[data-people-jobs-slot]')!.hidden).toBe(true);
    expect(document.querySelector('[data-people-jobs]')).toBeNull();
  });
});

describe('订阅驱动渲染（450 后台化）', () => {
  it('引擎推快照 → 进度块原位刷新（百分比跟帧走，主文案一行）', async () => {
    await boot([drawnPerson()]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card="wxid_a"]')).toBeTruthy());
    click('[data-people-card="wxid_a"]'); // 455 评审：进度块只在该联系人详情页显示
    engine.push([fakeJob({ batchesDone: 1, chunks: [meta(), meta()], message: '第 1/2 批 · 2026-01-01 ~ 2026-06-30 · 400 条' })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs]')).toBeTruthy());
    expect(document.querySelector('.bz-people-jobs-pct')!.textContent).toBe('20%'); // 1/5（455 分母 +3）
    engine.push([fakeJob({ batchesDone: 2, chunks: [meta(), meta()], stage: 'person', message: '素材采集完成：事件 214 · 原话 63 · 场景 88 · 特质 41 → 正在生成《其人》' })]);
    await vi.waitFor(() => expect(document.querySelector('.bz-people-jobs-pct')!.textContent).toBe('40%')); // 2/5
    expect(document.querySelector('.bz-people-jobs-main')!.textContent).toBe('正在生成 · 第 2/2 批');
  });
});

describe('startGeneration → 引擎 → done 落盘', () => {
  it('targets 交 startJobs；done 推送写 people.json（导入记录 / 脸谱 / 锚点）+ 完成通知 + 清队列', async () => {
    await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target()]);
    expect(engine.calls.start).toHaveLength(1);
    expect(engine.calls.start[0].targets).toHaveLength(1);
    expect(engine.calls.start[0].targets[0].talker).toBe('wxid_a');

    engine.push([fakeJob({ batchesDone: 1, message: '第 1/1 批 · 2026-09-25 ~ 2026-09-25 · 3 条' })]);
    engine.push([fakeJob({
      status: 'done',
      stage: 'done',
      message: '「陈默」脸谱已生成',
      batchesDone: 1,
      person: '## 画像\n陈默说话简短。',
      events: [{ ts: '2026-09-25', summary: '聊了早饭' }],
      quotes: [{ ts: '2026-09-25', who: '我', text: '中午吃什么' }],
      material: { traits: ['简短'], moments: [{ ts: '2026-09-25', summary: '午饭决策现场' }] },
      chronicle: '## 时间线\n2026-09 仍常聊。',
    })]);
    await vi.waitFor(async () => expect((await disk()).people[0]?.lastProcessedTs).toBe(T0 + 120_000)); // 锚点是落盘链最后一环，等它落地
    expect((await disk()).people[0]?.digest?.person).toContain('陈默说话简短');
    const p = (await disk()).people[0];
    const d = p.digest!;
    expect(p.name).toBe('陈默');
    expect(p.imports).toHaveLength(1);
    expect(p.imports[0].file).toBe('数据源:陈默');
    expect(p.imports[0].messageCount).toBe(3); // 引擎 importRecord 口径（实际进提炼条数）
    expect(p.imports[0].skippedCount).toBe(1);
    expect(p.imports[0].stats!.kindCounts).toEqual({ 文本: 3 });
    expect(d.events[0].summary).toBe('聊了早饭');
    expect(d.quotes![0].text).toBe('中午吃什么');
    expect(d.moments![0].summary).toBe('午饭决策现场'); // material.moments
    expect(d.traits).toEqual(['简短']); // material.traits
    expect(d.chronicle).toContain('时间线');
    expect(p.lastProcessedTs).toBe(T0 + 120_000); // 锚点 = 计划内末条
    expect(getNoticeMessages().some((m) => m.includes('陈默」的脸谱已生成'))).toBe(true);
    expect(engine.calls.remove).toEqual(['wxid_a']); // 产物入 people.json 后清出引擎队列
  });

  it('引擎保留 done 任务重复推送 → 不重复落导入记录（幂等）', async () => {
    await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target()]);
    const done = fakeJob({ status: 'done', stage: 'done', message: '', batchesDone: 1, person: '画像', events: [] });
    engine.push([done]);
    await vi.waitFor(async () => expect((await disk()).people[0]?.lastProcessedTs).toBe(T0 + 120_000)); // 等落盘链走完
    expect((await disk()).people[0]?.digest?.person).toBe('画像');
    engine.push([done]); // 引擎侧若仍带着 done 任务再推一帧
    await tick(); await tick();
    expect((await disk()).people[0].imports).toHaveLength(1);
    expect(engine.calls.remove).toHaveLength(1);
  });

  it('skip 预筛：同一导出再导（指纹命中）不进引擎，改名照常应用、不落新记录', async () => {
    const from = new Date(T0).toISOString();
    const to = new Date(T0 + 120_000).toISOString();
    const existing: PersonEntry = {
      id: 'wxid_a',
      name: '老陈',
      createdAt: '2026-01-01T00:00:00.000Z',
      imports: [{ file: '数据源:陈默', importedAt: '2026-09-01T00:00:00.000Z', messageCount: 3, skippedCount: 0, timeFrom: from, timeTo: to }],
      lastProcessedTs: T0 + 120_000,
    };
    await boot([existing]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target({ name: '陈默' })]); // 同一条数 + 同跨度 → 指纹命中
    expect(engine.calls.start).toHaveLength(0); // 全员 skip → 引擎根本不启动
    const p = (await disk()).people[0];
    expect(p.name).toBe('陈默'); // skip 也应用改名（441 语义保留）
    expect(p.imports).toHaveLength(1);
    expect(getNoticeMessages().some((m) => m.includes('没有新消息、无需重画'))).toBe(true);
  });
});

describe('进度块按钮派发（450）', () => {
  it('运行中「暂停」→ pauseJobs；暂停「继续」→ resume；可续 error「继续生成」→ resume；接不上的 error「删除任务」→ removeJob', async () => {
    await boot([drawnPerson()]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card="wxid_a"]')).toBeTruthy());
    click('[data-people-card="wxid_a"]'); // 455 评审：进度块只在详情页，先进详情
    engine.push([fakeJob()]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs-pause]')).toBeTruthy());
    click('[data-people-jobs-pause]');
    await tick(); // 动作经事件委托同步派发，通知走微任务
    expect(engine.calls.pause).toBe(1);

    engine.push([fakeJob({ status: 'paused', message: '已暂停（1/1 批）' })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs-resume]')).toBeTruthy());
    click('[data-people-jobs-resume]');
    await tick();
    expect(engine.calls.resume).toEqual(['wxid_a']);

    // issue 453：可续 error（非漂移判废）出「继续生成」→ resume；「删除任务」只留给接不上的任务
    engine.push([fakeJob({ status: 'error', message: '第 1 批提炼失败：AI 调用超时', error: 'AI 调用超时' })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs-resume]')).toBeTruthy());
    expect(document.querySelector('.bz-people-jobs-err')!.textContent).toBe('AI 调用超时');
    click('[data-people-jobs-resume]');
    await tick();
    expect(engine.calls.resume).toEqual(['wxid_a', 'wxid_a']); // 暂停那次 + 这次

    engine.push([fakeJob({ status: 'error', message: DRIFT_ERROR, error: DRIFT_ERROR })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs-dismiss]')).toBeTruthy());
    click('[data-people-jobs-dismiss]');
    await tick();
    expect(engine.calls.remove).toEqual(['wxid_a']);
  });
});

describe('关面板转后台（450）', () => {
  it('生成中关面板：面板关闭 + 转后台通知；订阅仍在，重开面板进详情仍渲染最新快照', async () => {
    await boot([drawnPerson()]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card="wxid_a"]')).toBeTruthy());
    click('[data-people-card="wxid_a"]'); // 455 评审：进度块在详情页
    engine.push([fakeJob({ message: '第 1/2 批', chunks: [meta(), meta()] })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs]')).toBeTruthy());
    closePeoplePanel();
    expect(isPeopleOpen()).toBe(false);
    expect(getNoticeMessages().some((m) => m.includes('已转后台继续生成'))).toBe(true);
    // 面板关着引擎照推（不抛错、快照留在缓存）
    engine.push([fakeJob({ message: '第 2/2 批', batchesDone: 2, chunks: [meta(), meta()] })]);
    await tick();
    openPeoplePanel(getApp()); // 重开回落封面墙，进度块不糊墙
    expect(document.querySelector('[data-people-jobs]')).toBeNull();
    await vi.waitFor(() => expect(document.querySelector('[data-people-card="wxid_a"]')).toBeTruthy());
    click('[data-people-card="wxid_a"]');
    await vi.waitFor(() => expect(document.querySelector('.bz-people-jobs-main')!.textContent).toBe('正在生成 · 第 2/2 批'));
    expect(engine.calls.resumeJobs).toBe(1); // 重开不重建引擎（内存队列还在跑）
  });

  it('面板关着时 done → 照常落盘（引擎独立于面板生命周期）', async () => {
    await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target()]);
    closePeoplePanel();
    engine.push([fakeJob({ status: 'done', stage: 'done', message: '', batchesDone: 1, person: '后台画完', events: [] })]);
    await vi.waitFor(async () => expect((await disk()).people[0]?.lastProcessedTs).toBe(T0 + 120_000)); // 等落盘链走完
    expect((await disk()).people[0]?.digest?.person).toBe('后台画完');
    expect(getNoticeMessages().some((m) => m.includes('陈默」的脸谱已生成'))).toBe(true);
  });
});

// ---------------- issue 451：折子印章四态 ----------------

describe('折子印章四态（451）', () => {
  const undrawn = (): PersonEntry => ({
    id: 'wxid_a', name: '陈默', createdAt: '2026-01-01T00:00:00.000Z', imports: [],
  });
  const sealNode = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>('[data-people-seal-act]')!;
  const batches = (n: number) => Array.from({ length: n }, () => meta());

  it('列表印章四态跟帧原位刷新：待画 → 画谱中 → 画谱中断 → 已画谱', async () => {
    await boot([undrawn()]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card]')).toBeTruthy());
    expect(sealNode().textContent).toBe('待画');
    expect(sealNode().dataset.peopleSealAct).toBe('draw');

    engine.push([fakeJob({ batchesDone: 3, chunks: batches(10) })]);
    await vi.waitFor(() => expect(document.querySelector('.bz-people-seal-running')).toBeTruthy());
    expect(sealNode().textContent).toBe('画谱中\n23%'); // (3+0)/(10+3)，455 三段成文口径
    expect(sealNode().dataset.peopleSealAct).toBe('pause');

    engine.push([fakeJob({ status: 'interrupted', batchesDone: 3, chunks: batches(10), message: '上次未完成，可从断点继续' })]);
    await vi.waitFor(() => expect(document.querySelector('.bz-people-seal-halted')).toBeTruthy());
    expect(sealNode().textContent).toBe('画谱中断\n3/10');
    expect(sealNode().dataset.peopleSealAct).toBe('resume');

    // 任务清出队列（done 落盘后 ui 会 removeJob）= 回到脸谱水位判定
    engine.push([]);
    await vi.waitFor(() => expect(sealNode().textContent).toBe('待画'));
  });

  it('印章动作派发：画谱中 → pauseJobs；中断 → resume(talker)', async () => {
    await boot([undrawn()]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card]')).toBeTruthy());

    engine.push([fakeJob()]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-seal-act="pause"]')).toBeTruthy());
    click('[data-people-seal-act="pause"]');
    await tick();
    expect(engine.calls.pause).toBe(1);
    expect(getNoticeMessages().some((m) => m.includes('这一批做完就暂停'))).toBe(true);

    engine.push([fakeJob({ status: 'interrupted', message: '上次未完成，可从断点继续' })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-seal-act="resume"]')).toBeTruthy());
    click('[data-people-seal-act="resume"]');
    await tick();
    expect(engine.calls.resume).toEqual(['wxid_a']);
  });

  it('未画谱印章「画脸谱」：有仓内素材即交引擎（talker 与素材条数对齐）', async () => {
    const { safe } = await boot([undrawn()]);
    await seedStore(safe);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-seal-act="draw"]')).toBeTruthy());
    click('[data-people-seal-act="draw"]');
    await vi.waitFor(() => expect(engine.calls.start).toHaveLength(1));
    expect(engine.calls.start[0].targets[0].talker).toBe('wxid_a');
    expect(engine.calls.start[0].targets[0].msgs).toHaveLength(2);
  });

  it('未画谱印章「画脸谱」但聊天仓空：提示先走数据源，不进引擎', async () => {
    await boot([undrawn()]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-seal-act="draw"]')).toBeTruthy());
    click('[data-people-seal-act="draw"]');
    await vi.waitFor(() => expect(getNoticeMessages().some((m) => m.includes('还没有可画的消息素材'))).toBe(true));
    expect(engine.calls.start).toHaveLength(0);
  });
});

// ---------------- issue 453：批级重试与续跑不重烧 ----------------

describe('生成入口不重烧（453）', () => {
  const undrawn = (): PersonEntry => ({ id: 'wxid_a', name: '陈默', createdAt: '2026-01-01T00:00:00.000Z', imports: [] });
  const batches = (n: number) => Array.from({ length: n }, () => meta());
  const seedPreview = async (safe: PeopleSafeStore): Promise<void> => {
    await seedStore(safe);
  };
  /** 大琳量级的中断任务：47 批、已完成 29 批、AI 调用类失败（可续） */
  const failing = (over: Partial<PersonJob> = {}): Partial<PersonJob> => ({
    status: 'error',
    error: 'AI 调用超时',
    message: '第 30/47 批提炼失败：AI 调用超时；已完成 29/47 批（点「继续生成」从这批重试，不会从头重烧）',
    batchesDone: 29,
    chunks: batches(47),
    ...over,
  });

  it('详情头画笔钮按态：有中断任务时改「继续生成」并带批次进度，点它走 resume——不重烧', async () => {
    await boot([undrawn()]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card]')).toBeTruthy());
    engine.push([fakeJob(failing())]);
    await vi.waitFor(() => expect(document.querySelector('.bz-people-seal-halted')).toBeTruthy());

    click('[data-people-card="wxid_a"]'); // 进详情
    await vi.waitFor(() => expect(document.querySelector('[data-people-generate-one]')).toBeTruthy());
    const btn = document.querySelector('[data-people-generate-one]')!;
    expect(btn.getAttribute('title')).toContain('继续生成');
    expect(btn.getAttribute('title')).toContain('29/47');

    click('[data-people-generate-one]');
    await tick();
    expect(engine.calls.resume).toEqual(['wxid_a']); // 续跑
    expect(engine.calls.start).toHaveLength(0); // 没把 47 批重新排一遍
  });

  it('无任务无脸谱：详情头仍是「画脸谱」（不因 453 改坏原语义）', async () => {
    await boot([undrawn()]);
    inject(new FakeEngine());
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card]')).toBeTruthy());
    click('[data-people-card="wxid_a"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-generate-one]')).toBeTruthy());
    expect(document.querySelector('[data-people-generate-one]')!.getAttribute('title')).toBe('画脸谱（用已导入的消息生成）');
  });

  it('漂移判废（接不上）：印章出「重新生成」，点它才真重画（走 startJobs，不是 resume）', async () => {
    const { safe } = await boot([undrawn()]);
    await seedPreview(safe);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card]')).toBeTruthy());
    engine.push([fakeJob(failing({ error: DRIFT_ERROR, message: DRIFT_ERROR }))]);
    await vi.waitFor(() => expect(document.querySelector('.bz-people-seal-halted')).toBeTruthy());
    expect(document.querySelector<HTMLElement>('[data-people-seal-act]')!.dataset.peopleSealAct).toBe('redraw');

    click('[data-people-seal-act="redraw"]');
    await vi.waitFor(() => expect(engine.calls.start).toHaveLength(1));
    expect(engine.calls.resume).toEqual([]);
  });
});

// ---------------- issue 455：详情页双折（其人/我们）+ 统计与档案弹窗 ----------------

/** 已画谱人物：带导入统计（月度明细）与旧单卷 digest */
function drawnPerson(over: Partial<PersonEntry> = {}): PersonEntry {
  return {
    id: 'wxid_a',
    name: '陈默',
    createdAt: '2026-01-01T00:00:00.000Z',
    imports: [{
      file: '数据源:陈默',
      importedAt: '2026-09-01T00:00:00.000Z',
      messageCount: 10,
      skippedCount: 0,
      timeFrom: '2026-01-01T00:00:00.000Z',
      timeTo: '2026-09-01T00:00:00.000Z',
      stats: {
        monthly: [['2026-01', 30], ['2026-02', 42]],
        initiatedByMe: 2,
        initiatedByOther: 3,
        myAvgReplySec: 10,
        otherAvgReplySec: 20,
        myHourly: [],
        otherHourly: [],
        kindCounts: { 文本: 10 },
      },
    }],
    digest: { portrait: '## 旧画像\n旧单卷数据。', events: [], generatedAt: '2026-03-01T00:00:00.000Z' },
    ...over,
  };
}

describe('双卷落盘（455）', () => {
  it('新引擎 done（person/bond）：各归其卷写入 digest，旧 portrait 字段不再写', async () => {
    await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target()]);
    engine.push([fakeJob({
      status: 'done', stage: 'done', message: '', batchesDone: 1,
      person: '## 其人\n慢热。', bond: '## 我们\n老友。', events: [],
    })]);
    await vi.waitFor(async () => expect((await disk()).people[0]?.digest?.person).toContain('慢热'));
    const d = (await disk()).people[0].digest!;
    expect(d.person).toContain('其人');
    expect(d.bond).toContain('我们');
    expect(d.portrait).toBeUndefined();
  });

  it('done 只有 person（无 bond）：卷一写入、卷二缺省（旧 portrait→person 映射归引擎 resumeJobs）', async () => {
    await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target()]);
    engine.push([fakeJob({ status: 'done', stage: 'done', message: '', batchesDone: 1, person: '旧单卷画像', events: [] })]);
    await vi.waitFor(async () => expect((await disk()).people[0]?.digest?.person).toBe('旧单卷画像'));
    expect((await disk()).people[0].digest!.bond).toBeUndefined();
  });
});

describe('生成入参带档案与月度（455）', () => {
  it('mergedMonthlyOf：跨记录同名月相加、按月升序；无明细返回 undefined', () => {
    expect(mergedMonthlyOf([
      { stats: { monthly: [['2026-02', 5], ['2026-01', 3]] } },
      { stats: { monthly: [['2026-01', 4]] } },
      { stats: undefined },
    ])).toEqual([['2026-01', 7], ['2026-02', 5]]);
    expect(mergedMonthlyOf([])).toBeUndefined();
    expect(mergedMonthlyOf([{ stats: {} }, {}])).toBeUndefined();
  });

  it('targets 交引擎时带上 profile 与跨导入合并的 monthly（statsNote 组装在引擎内，入参经此传入）', async () => {
    const existing: PersonEntry = {
      id: 'wxid_a',
      name: '陈默',
      createdAt: '2026-01-01T00:00:00.000Z',
      imports: [
        { file: 'a.csv', importedAt: '2026-08-01T00:00:00.000Z', messageCount: 5, skippedCount: 0, timeFrom: '2026-01-01T00:00:00.000Z', timeTo: '2026-06-30T00:00:00.000Z', stats: { monthly: [['2026-03', 7], ['2026-01', 30]] } },
        { file: 'b.csv', importedAt: '2026-09-01T00:00:00.000Z', messageCount: 5, skippedCount: 0, timeFrom: '2026-06-01T00:00:00.000Z', timeTo: '2026-09-01T00:00:00.000Z', stats: { monthly: [['2026-01', 12], ['2026-02', 5]] } },
      ],
      profile: { tags: ['同学'], note: '旧识' },
    };
    await boot([existing]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target()]);
    expect(engine.calls.start).toHaveLength(1);
    const t0 = engine.calls.start[0].targets[0];
    expect(t0.monthly).toEqual([['2026-01', 42], ['2026-02', 5], ['2026-03', 7]]);
    expect(t0.profile).toEqual({ tags: ['同学'], note: '旧识' });
  });
});

describe('详情折册四折与弹窗（455）', () => {
  /** 开面板 → 进详情（折册可见） */
  async function openDetail(seed: PersonEntry[]): Promise<void> {
    await boot(seed);
    inject(new FakeEngine());
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-card]')).toBeTruthy());
    click('[data-people-card="wxid_a"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-book]')).toBeTruthy());
  }

  it('三折渲染：其人折展开显旧画像（兼容读）；相交折收起，点书脊展开显空态', async () => {
    await openDetail([drawnPerson()]);
    expect([...document.querySelectorAll('[data-people-leaf]')].map((l) => l.getAttribute('data-people-leaf')))
      .toEqual(['p', 'b', 'e']);
    expect(document.querySelector('[data-people-leaf="p"]')!.classList.contains('bz-people-leaf-on')).toBe(true);
    expect(document.querySelector('[data-people-leaf="p"] .bz-people-portrait')!.textContent).toContain('旧画像');
    expect(document.querySelector('[data-people-leaf="b"]')!.classList.contains('bz-people-leaf-on')).toBe(false);
    click('[data-people-leaf-head="b"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-leaf="b"]')!.classList.contains('bz-people-leaf-on')).toBe(true));
    expect(document.querySelector('[data-people-leaf="b"] .bz-people-leaf-body')!.textContent).toContain('还没有关系画像');
  });

  it('新 digest 双卷：其人 / 相交两折各显各卷', async () => {
    await openDetail([drawnPerson({ digest: { person: '## 其人卷', bond: '## 我们卷', events: [], generatedAt: '2026-09-01T00:00:00.000Z' } })]);
    expect(document.querySelector('[data-people-leaf="p"] .bz-people-portrait')!.textContent).toContain('其人卷');
    click('[data-people-leaf-head="b"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-leaf="b"] .bz-people-portrait')!.textContent).toContain('我们卷'));
  });

  it('统计弹窗：详情头图标点开、出月度柱图互动卡、遮罩点击关闭且详情还在', async () => {
    await openDetail([drawnPerson()]);
    click('[data-people-stats-open]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-stats-pop]')).toBeTruthy());
    expect(document.querySelector('[data-people-stats-pop] [role="dialog"]')!.getAttribute('aria-label')).toBe('互动统计');
    expect(document.querySelector('[data-people-stats-pop] .bz-people-chart')).toBeTruthy();
    click('[data-people-stats-pop] [data-people-pop-close]'); // 遮罩（DOM 序在面板前）
    await vi.waitFor(() => expect(document.querySelector('[data-people-stats-pop]')).toBeNull());
    expect(document.querySelector('[data-people-book]')).toBeTruthy();
  });

  it('补充背景弹窗：空档出补档入口，编辑保存落盘且弹窗留查看态；Esc 先关弹窗不关面板', async () => {
    await openDetail([drawnPerson()]);
    click('[data-people-prof-open]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-pop]')).toBeTruthy());
    expect(document.querySelector('[data-people-prof-pop] [role="dialog"]')!.getAttribute('aria-label')).toBe('补充背景');
    click('[data-people-prof-new]'); // 补人物档案 → 编辑态
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-save]')).toBeTruthy());
    const note = document.querySelector<HTMLInputElement>('[data-people-prof-field="note"]')!;
    note.value = '小学同学';
    click('[data-people-prof-save]');
    await vi.waitFor(async () => expect((await disk()).people[0].profile?.note).toBe('小学同学'));
    expect(document.querySelector('[data-people-prof-pop]')).toBeTruthy(); // 弹窗仍开
    expect(document.querySelector('[data-people-prof-pop] [data-people-prof-edit]')).toBeTruthy(); // 回查看态

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-pop]')).toBeNull());
    expect(isPeopleOpen()).toBe(true); // Esc 分层：先关弹窗，面板保留
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(isPeopleOpen()).toBe(false); // 再 Esc 才关面板
  });
});
