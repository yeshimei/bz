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
  openPeoplePanel,
  setJobsModuleForTests,
  startGeneration,
  type GenTarget,
  type JobsApi,
} from '../../src/people/ui';
import type { PersonJob, JobView, JobsSnapshot } from '../../src/people/jobs';
import { getPeopleFilePath } from '../../src/people/data';
import { getPreviewFilePath } from '../../src/people/datasource';
import type { PersonEntry, UnifiedMessage } from '../../src/people/types';

const T0 = new Date('2026-09-25T08:00:00').getTime();
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const disk = (vault: MockVault): { people: PersonEntry[] } =>
  JSON.parse(vault.files.get(getPeopleFilePath()) ?? '{ "people": [] }');

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

/** 构造引擎任务（PersonJob 必填面 + 常用可选项） */
function fakeJob(over: Partial<PersonJob> = {}): PersonJob {
  return {
    talker: 'wxid_a',
    name: '陈默',
    mode: 'full',
    fileLabel: '数据源:陈默',
    status: 'running',
    stage: 'extracting',
    msgCount: 3,
    lastMsgKey: `${T0 + 120_000}|abc`,
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

  startJobs = async (app: unknown, targets: GenTarget[], opts: unknown): Promise<{ queued: string[]; skipped: string[] }> => {
    void app;
    this.calls.start.push({ targets, opts });
    return { queued: targets.map((t) => t.name), skipped: [] };
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

async function boot(seed?: PersonEntry[]): Promise<MockVault> {
  const vault = new MockVault();
  if (seed) vault.files.set(getPeopleFilePath(), JSON.stringify({ version: 1, people: seed }));
  setApp(makeApp(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
  return vault;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
});

describe('开面板恢复任务态（450 状态恢复）', () => {
  it('打开面板：resumeJobs 重建一次 + 快照渲染进度块（主文案 / 百分比 / 队列副文案 / 暂停钮）', async () => {
    await boot();
    const engine = new FakeEngine();
    engine.items = [
      fakeJob({ talker: 'wxid_x', name: '占位甲', status: 'paused', message: '已暂停（0/1 批）' }),
      fakeJob({ talker: 'wxid_b', name: '大琳', message: '第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条', chunks: Array.from({ length: 60 }, () => meta()), batchesDone: 12 }),
      fakeJob({ talker: 'wxid_y', name: '占位乙', status: 'paused', message: '' }),
    ];
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs]')).toBeTruthy());
    expect(engine.calls.resumeJobs).toBe(1); // 每会话只重建一次
    expect(document.querySelector('.bz-people-jobs-main')!.textContent).toBe('第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条');
    expect(document.querySelector('.bz-people-jobs-pct')!.textContent).toBe('19%'); // 12/62
    expect(document.querySelector('.bz-people-jobs-queue')!.textContent).toBe('（2/3 人）当前：大琳');
    expect(document.querySelector('[data-people-jobs-pause]')).toBeTruthy();
  });

  it('中断任务恢复：出「继续生成」按钮，块根带 talker', async () => {
    await boot();
    const engine = new FakeEngine();
    engine.items = [fakeJob({ status: 'interrupted', message: '上次未完成，可从断点继续' })];
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs-resume]')).toBeTruthy());
    expect(document.querySelector('[data-people-jobs]')!.getAttribute('data-people-jobs-talker')).toBe('wxid_a');
    expect(document.querySelector('[data-people-jobs-resume]')!.textContent).toBe('继续生成');
  });

  it('无任务时进度块隐藏', async () => {
    await boot();
    inject(new FakeEngine());
    openPeoplePanel(getApp());
    await tick();
    expect(document.querySelector<HTMLElement>('[data-people-jobs-slot]')!.hidden).toBe(true);
    expect(document.querySelector('[data-people-jobs]')).toBeNull();
  });
});

describe('订阅驱动渲染（450 后台化）', () => {
  it('引擎推快照 → 进度块原位刷新（文案与百分比跟帧走）', async () => {
    await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    engine.push([fakeJob({ batchesDone: 1, chunks: [meta(), meta()], message: '第 1/2 批 · 2026-01-01 ~ 2026-06-30 · 400 条' })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs]')).toBeTruthy());
    expect(document.querySelector('.bz-people-jobs-pct')!.textContent).toBe('25%'); // 1/4
    engine.push([fakeJob({ batchesDone: 2, chunks: [meta(), meta()], stage: 'portrait', message: '素材采集完成：事件 214 · 原话 63 · 场景 88 · 特质 41 → 正在生成画像' })]);
    await vi.waitFor(() => expect(document.querySelector('.bz-people-jobs-pct')!.textContent).toBe('50%')); // 2/4
    expect(document.querySelector('.bz-people-jobs-main')!.textContent).toContain('正在生成画像');
  });
});

describe('startGeneration → 引擎 → done 落盘', () => {
  it('targets 交 startJobs；done 推送写 people.json（导入记录 / 脸谱 / 锚点）+ 完成通知 + 清队列', async () => {
    const vault = await boot();
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
      portrait: '## 画像\n陈默说话简短。',
      events: [{ ts: '2026-09-25', summary: '聊了早饭' }],
      quotes: [{ ts: '2026-09-25', who: '我', text: '中午吃什么' }],
      material: { traits: ['简短'], moments: [{ ts: '2026-09-25', summary: '午饭决策现场' }] },
      chronicle: '## 时间线\n2026-09 仍常聊。',
    })]);
    await vi.waitFor(() => expect(disk(vault).people[0]?.digest?.portrait).toContain('陈默说话简短'));
    const p = disk(vault).people[0];
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
    const vault = await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target()]);
    const done = fakeJob({ status: 'done', stage: 'done', message: '', batchesDone: 1, portrait: '画像', events: [] });
    engine.push([done]);
    await vi.waitFor(() => expect(disk(vault).people[0]?.digest?.portrait).toBe('画像'));
    engine.push([done]); // 引擎侧若仍带着 done 任务再推一帧
    await tick(); await tick();
    expect(disk(vault).people[0].imports).toHaveLength(1);
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
    const vault = await boot([existing]);
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target({ name: '陈默' })]); // 同一条数 + 同跨度 → 指纹命中
    expect(engine.calls.start).toHaveLength(0); // 全员 skip → 引擎根本不启动
    const p = disk(vault).people[0];
    expect(p.name).toBe('陈默'); // skip 也应用改名（441 语义保留）
    expect(p.imports).toHaveLength(1);
    expect(getNoticeMessages().some((m) => m.includes('没有新消息、无需重画'))).toBe(true);
  });
});

describe('进度块按钮派发（450）', () => {
  it('运行中「暂停」→ pauseJobs；暂停「继续」→ resume(talker)；error「删除任务」→ removeJob(talker)', async () => {
    await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
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

    engine.push([fakeJob({ status: 'error', message: '第 1 批提炼失败：AI 调用超时', error: 'AI 调用超时' })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs-dismiss]')).toBeTruthy());
    expect(document.querySelector('.bz-people-jobs-err')!.textContent).toBe('AI 调用超时');
    click('[data-people-jobs-dismiss]');
    await tick();
    expect(engine.calls.remove).toEqual(['wxid_a']);
  });
});

describe('关面板转后台（450）', () => {
  it('生成中关面板：面板关闭 + 转后台通知；订阅仍在，重开面板渲染最新快照', async () => {
    await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    engine.push([fakeJob({ message: '第 1/2 批', chunks: [meta(), meta()] })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs]')).toBeTruthy());
    closePeoplePanel();
    expect(isPeopleOpen()).toBe(false);
    expect(getNoticeMessages().some((m) => m.includes('已转后台继续生成'))).toBe(true);
    // 面板关着引擎照推（不抛错、快照留在缓存）
    engine.push([fakeJob({ message: '第 2/2 批', batchesDone: 2, chunks: [meta(), meta()] })]);
    await tick();
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('.bz-people-jobs-main')!.textContent).toBe('第 2/2 批'));
    expect(engine.calls.resumeJobs).toBe(1); // 重开不重建引擎（内存队列还在跑）
  });

  it('面板关着时 done → 照常落盘（引擎独立于面板生命周期）', async () => {
    const vault = await boot();
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await tick();
    await startGeneration([target()]);
    closePeoplePanel();
    engine.push([fakeJob({ status: 'done', stage: 'done', message: '', batchesDone: 1, portrait: '后台画完', events: [] })]);
    await vi.waitFor(() => expect(disk(vault).people[0]?.digest?.portrait).toBe('后台画完'));
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
    expect(sealNode().textContent).toBe('画谱中\n25%'); // (3+0)/(10+2)
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

  it('未画谱印章「画脸谱」：有预览素材即交引擎（talker 与素材条数对齐）', async () => {
    const vault = await boot([undrawn()]);
    vault.files.set(getPreviewFilePath(), JSON.stringify({
      version: 1,
      contacts: {
        wxid_a: {
          msgs: [
            { key: 's1:1', ts: T0, isSender: true, text: '早' },
            { key: 's2:2', ts: T0 + 60_000, isSender: false, text: '早呀' },
          ],
          watermarkSid: 2,
          stats: { msgCount: 2, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 },
          updatedAt: new Date(T0).toISOString(),
        },
      },
    }));
    const engine = new FakeEngine();
    inject(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-seal-act="draw"]')).toBeTruthy());
    click('[data-people-seal-act="draw"]');
    await vi.waitFor(() => expect(engine.calls.start).toHaveLength(1));
    expect(engine.calls.start[0].targets[0].talker).toBe('wxid_a');
    expect(engine.calls.start[0].targets[0].msgs).toHaveLength(2);
  });

  it('未画谱印章「画脸谱」但预览桶空：提示先走数据源，不进引擎', async () => {
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
