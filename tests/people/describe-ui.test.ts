/**
 * 画谱总确认与进度便签 UI 层测试（issue 497 语义沿用；505 起确认是册子里翻出来的一页）：
 * 开工单册页（genPage）的文案契约、startGeneration 起引擎前恰好翻一次开工单、
 * 三种「不生成」的答复（开工前的取消 / 合上这页 / Esc）都不起引擎且不卡住确认锁；
 * 进度便签（jobsNote）主行阶段标签与引擎细文案、照片角上印的 describe 段百分比口径。
 * 引擎用假件注入（setJobsModuleForTests 先例）；测试数据全构造。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { getApp, setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  closePeoplePanel,
  openPeoplePanel,
  setJobsModuleForTests,
  startGeneration,
  type GenTarget,
  type JobsApi,
} from '../../src/people/ui';
import { albumSealOf, genPage, jobsNote, jobsStageLabel, type JobsBlockState } from '../../src/people/render';
import type { GenerationConfirmInfo, ImportRecord, PersonEntry } from '../../src/people/types';
import type { JobView, JobsSnapshot } from '../../src/people/jobs';
import { getPeopleSafeStore, PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';

const T0 = Date.UTC(2024, 4, 1, 12, 0, 0);
const PW = 'desc-ui-pw';

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const info: GenerationConfirmInfo = {
  items: [
    { name: '陈默', materials: 2, images: 0, voices: 0 },
    { name: '大琳', materials: 20773, images: 1615, voices: 1289, mode: 'older' },
  ],
  materials: 20775,
  images: 1615,
  voices: 1289,
  empty: false,
};

describe('开工单册页（genPage，issue 505：确认是册子里翻出来的一页；523：只报素材）', () => {
  it('只报素材：三类条数（聊天记录 / 图片 / 录音）+ 逐人明细（含补录标识），不出现 AI 通道与调用次数', () => {
    const page = genPage(info);
    expect(page.dataset.peopleSub).toBe('gen');
    expect(page.querySelector('.bz-people-head-label')!.textContent).toBe('开始生成脸谱');
    const line = page.querySelector<HTMLElement>('.bz-people-gen-line')!.textContent ?? '';
    expect(line).toContain('为 2 位联系人生成脸谱');
    // 总览行式：一项一类素材，为零的整行不出
    const rows = [...page.querySelectorAll('.bz-people-gen-row')].map((n) => n.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('聊天记录');
    expect(rows[0]).toContain('20775 条');
    expect(rows[1]).toContain('图片');
    expect(rows[1]).toContain('1615 张');
    expect(rows[2]).toContain('录音');
    expect(rows[2]).toContain('1289 条');
    const items = [...page.querySelectorAll('.bz-people-gen-item')].map((n) => n.textContent ?? '');
    expect(items[0]).toContain('「陈默」 · 聊天记录 2 条');
    expect(items[1]).toContain('「大琳」 · 聊天记录 20773 条 · 图片 1615 张 · 录音 1289 条 · 补录 · 与已有画像合并重画');
    expect(items[0]).not.toContain('补录');
    // 523 用户拍板：调用什么 AI、调用多少次都不告诉用户；也不报金额
    const allText = [line, ...rows, ...items, page.querySelector('.bz-people-pop-note')?.textContent ?? ''].join('');
    expect(allText).not.toContain('调用');
    expect(allText).not.toContain('模型');
    expect(allText).not.toMatch(/元|￥|¥|\$/);
    // 有素材就不出置灰说明；按钮照样可点
    expect(page.querySelector('.bz-people-pop-note')).toBeNull();
    expect(page.querySelector('[data-people-gen-start]')?.textContent).toBe('开始生成');
    expect(page.querySelector<HTMLButtonElement>('[data-people-gen-start]')!.hasAttribute('disabled')).toBe(false);
    expect(page.querySelector('button[data-people-gen-cancel]')?.textContent).toBe('取消');
    expect(page.querySelector('[data-people-close]')).toBeTruthy(); // 「合上这页」＝取消那条路
  });

  it('零图片零录音：总览只剩聊天记录一行，逐人行也只剩聊天记录', () => {
    const page = genPage({ ...info, images: 0, voices: 0, items: [{ name: '陈默', materials: 5, images: 0, voices: 0 }], materials: 5 });
    const rows = [...page.querySelectorAll('.bz-people-gen-row')].map((n) => n.textContent ?? '');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('聊天记录');
    expect(page.querySelector<HTMLElement>('.bz-people-gen-item')!.textContent).toBe('「陈默」 · 聊天记录 5 条');
  });

  it('增量只报增量（issue 514）：newer 素材 = 新增集条数，逐人行标「新增聊天记录」', () => {
    const page = genPage({
      ...info,
      images: 0,
      voices: 0,
      materials: 12,
      items: [{ name: '大琳', materials: 12, images: 0, voices: 0, mode: 'newer' }],
    });
    const rows = [...page.querySelectorAll('.bz-people-gen-row')].map((n) => n.textContent ?? '');
    expect(rows).toHaveLength(1);
    const item = page.querySelector<HTMLElement>('.bz-people-gen-item')!.textContent ?? '';
    expect(item).toBe('「大琳」 · 新增聊天记录 12 条 · 增量提炼');
    expect(item).not.toContain('20773'); // 全量数字不再出现
  });

  it('没有新素材（issue 523）：只出一句说明并点名联系人，不出素材行与明细，开始生成置灰', () => {
    const page = genPage({ items: [], materials: 0, images: 0, voices: 0, empty: true, skipped: ['丘羽'] });
    expect(page.querySelector<HTMLElement>('.bz-people-gen-line')!.textContent).toBe('没有新的素材');
    expect(page.querySelector('.bz-people-gen-row')).toBeNull();
    expect(page.querySelector('.bz-people-gen-item')).toBeNull();
    expect(page.querySelector<HTMLElement>('.bz-people-pop-note')!.textContent).toBe('「丘羽」没有新消息，也没有待描述 / 待转写的素材，无需重新生成。');
    expect(page.querySelector<HTMLButtonElement>('[data-people-gen-start]')!.hasAttribute('disabled')).toBe(true);
    expect(page.querySelector('button[data-people-gen-cancel]')?.textContent).toBe('取消');
  });
});

/** 假引擎：只记录 startJobs 的 opts（自动放行门断言用） */
function fakeEngine() {
  const calls: Array<{ opts: Record<string, unknown> }> = [];
  const engine: JobsApi = {
    startJobs: async (_app, _targets, opts) => {
      calls.push({ opts: (opts ?? {}) as Record<string, unknown> });
      return { queued: ['陈默'], skipped: [], resumed: [] };
    },
    resumeJobs: async () => {},
    resume: () => false,
    pauseJobs: () => {},
    removeJob: () => false,
    subscribe: () => () => {},
    snapshot: () => ({ queue: [] as JobView[], currentIndex: -1, running: false }) as JobsSnapshot,
  };
  return { engine, calls };
}

function genTarget(): GenTarget {
  return {
    talker: 'wxid_a',
    name: '陈默',
    msgs: [
      { ts: T0, isSender: true, text: '早' },
      { ts: T0 + 60_000, isSender: false, text: '早呀' },
    ],
    kindCounts: { 文本: 2 },
    skippedCount: 0,
    fileLabel: '数据源:陈默',
  };
}

const GEN_PAGE = '[data-people-sub="gen"]';

describe('总确认接线（startGeneration → 翻开工单 → 引擎自动放行）', () => {
  beforeEach(async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(makeApp(new MockVault()));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
    // planTargets 经 PeopleStore.list 读保库记录索引——需要解锁的共锁单例（generate-ui 先例）
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock(PW);
    const safe = new PeopleSafeStore(sm);
    setPeopleSafeStoreForTests(safe);
    // 开工单摊在册子里（505）：册上得有人，才画得出页
    const p: PersonEntry = { id: 'wxid_b', name: '大琳', createdAt: '2026-09-01T00:00:00.000Z', imports: [] };
    await safe.write(p.id, (rec) => { rec.person = p; });
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-pocket]')).toBeTruthy());
  });

  afterEach(() => {
    try { closePeoplePanel(); } catch { /* 幂等 */ }
    setJobsModuleForTests(null);
    setPeopleSafeStoreForTests(null);
  });

  it('startGeneration 先翻开工单；点「开始生成」才起引擎，两道门自动放行且不再翻任何页', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    expect(document.querySelector('.bz-people-gen-line')!.textContent).toContain('为 1 位联系人生成脸谱');
    expect(calls.length).toBe(0); // 确认前不起引擎
    click('[data-people-gen-start]');
    await gen;
    expect(calls.length).toBe(1);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeNull());
    // 两道门都是自动放行件（调了就放行，不翻页）
    const descGate = calls[0].opts.askDescribeConfirm as (i: never) => Promise<'start' | 'skip'>;
    const portraitGate = calls[0].opts.askPortraitConfirm as (i: never) => Promise<'start' | 'cancel'>;
    await expect(descGate({} as never)).resolves.toBe('start');
    await expect(portraitGate({} as never)).resolves.toBe('start');
    expect(document.querySelector('[data-people-sub="ds"], [data-people-sub="gen"]')).toBeNull();
  });

  it('点「取消」＝不起引擎，开工单合上', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    click('button[data-people-gen-cancel]');
    await gen;
    expect(calls.length).toBe(0);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeNull());
  });

  it('Esc = 不起引擎（取消是唯一不花钱的路）', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await gen;
    expect(calls.length).toBe(0);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeNull());
  });

  it('「合上这页」也按取消结算：等待中的开工单落地，确认锁松开（下一次照样翻得开）', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    click('[data-people-close]');
    await gen; // 卡住的 promise 必须被结算
    expect(calls.length).toBe(0);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeNull());
    const again = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    click('button[data-people-gen-cancel]');
    await again;
    expect(calls.length).toBe(0);
  });

  it('没有新素材（指纹命中 = 同一导出再导）：照样翻开工单，说明 + 开始生成置灰，不起引擎', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    // 同一份导出已提炼过：导入记录（条数 + 跨度）与目标 msgs 完全对齐 → planIncremental 判 skip
    const talker = 'wxid_a';
    const record: ImportRecord = {
      file: '数据源:陈默',
      importedAt: '2026-09-02T00:00:00.000Z',
      messageCount: 2,
      skippedCount: 0,
      timeFrom: new Date(T0).toISOString(),
      timeTo: new Date(T0 + 60_000).toISOString(),
    };
    const p: PersonEntry = { id: talker, name: '陈默', createdAt: '2026-09-01T00:00:00.000Z', imports: [record], lastProcessedTs: T0 + 60_000 };
    await (await getPeopleSafeStore()).write(talker, (rec) => { rec.person = p; });

    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    expect(document.querySelector<HTMLElement>('.bz-people-gen-line')!.textContent).toBe('没有新的素材');
    expect(document.querySelector<HTMLElement>('.bz-people-pop-note')!.textContent).toContain('「陈默」');
    expect(document.querySelector('.bz-people-gen-row')).toBeNull();
    const startBtn = document.querySelector<HTMLButtonElement>('[data-people-gen-start]')!;
    expect(startBtn.textContent).toBe('开始生成');
    expect(startBtn.hasAttribute('disabled')).toBe(true);
    // 置灰钮在真浏览器点不动；这里派发一枚合成点击，证明兜底也按取消结（不起引擎）
    startBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await gen;
    expect(calls.length).toBe(0);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeNull());
  });
});

describe('进度便签与印的 describe 段呈现', () => {
  function blockState(over: Partial<JobsBlockState> = {}): JobsBlockState {
    return {
      talker: 'wxid_a',
      name: '陈默',
      status: 'running',
      message: '本批 20 张',
      batchesDone: 0,
      batchesTotal: 35,
      stagesDone: 0,
      queueIndex: 1,
      queueTotal: 1,
      describe: { stageText: '图片描述 3/82 批', overall: 4 },
      ...over,
    };
  }

  it('running 主行 = `图片描述 3/82 批`（细节挂尾），进度条走段内批进度（不用批口径的 0%）', () => {
    const note = jobsNote(blockState());
    expect(note.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('图片描述 3/82 批 · 本批 20 张');
    expect(note.querySelector<HTMLElement>('.bz-people-jobs-fill')!.getAttribute('style')).toBe('width:4%');
    expect(note.querySelector<HTMLElement>('.bz-people-jobs-pct')!.textContent).toBe('4%');
  });

  it('引擎细节（497 副行 → 同行内次级字）：批详情 / 素材统计挂在主行尾；与主行同文时不出', () => {
    const note = jobsNote(blockState());
    expect(note.querySelector<HTMLElement>('.bz-people-jobs-detail')!.textContent).toBe(' · 本批 20 张');
    // prep 段：message 就是阶段行 → 细节不出，不重复念
    const prepNote = jobsNote(blockState({
      describe: undefined,
      prep: { stageText: '媒体导出 3/16', overall: 12, failed: 0 },
      message: '媒体导出 3/16',
    }));
    expect(prepNote.querySelector('.bz-people-jobs-detail')).toBeNull();
  });

  it('后段主行走阶段标签（497）：不再停留在过期批号', () => {
    const person = jobsNote(blockState({ describe: undefined, stage: 'person', message: '素材：事件 214 · 原话 63' }));
    // 阶段标签《其人》与素材统计各说一层 → 同行两段都留（一行到底）
    expect(person.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('正在生成《其人》… · 素材：事件 214 · 原话 63');
    expect(jobsStageLabel('bond')).toBe('正在生成《相交》…');
    expect(jobsStageLabel('chronicle')).toBe('正在生成《纪事》…');
    expect(jobsStageLabel('chunked')).toBe('正在切批组装素材…');
    expect(jobsStageLabel('extracting')).toBeNull();
    const extracting = jobsNote(blockState({ describe: undefined, stage: 'extracting', message: '第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条' }));
    // 批位锚点与批明细同义 → 只留更详尽的明细那条
    expect(extracting.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条');
  });

  it('暂停 / 失败断面同样带阶段信息', () => {
    const paused = jobsNote(blockState({ status: 'paused' }));
    expect(paused.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('已暂停 · 图片描述 3/82 批 · 本批 20 张');
    const failed = jobsNote(blockState({ status: 'error', errorText: '构造失败' }));
    // error 面不挂细节：原因与「继续生成」由底部错误行 / 按钮承担
    expect(failed.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('生成失败 · 图片描述 3/82 批');
    expect(failed.querySelector('.bz-people-jobs-detail')).toBeNull();
    // 后段暂停也有名有姓（497）
    const pausedPerson = jobsNote(blockState({ status: 'paused', describe: undefined, stage: 'person', message: '' }));
    expect(pausedPerson.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('已暂停 · 正在生成《其人》…');
  });

  it('照片角上的印：describe 段百分比走 describePct（画谱中 4%）', () => {
    const p = { id: 'wxid_a', name: '陈默', createdAt: '', imports: [] };
    const seal = albumSealOf(p as never, {
      status: 'running',
      batchesDone: 0,
      batchesTotal: 82,
      stagesDone: 0,
      resumable: true,
      describePct: 4,
    });
    expect(seal.state).toBe('running');
    expect(seal.text).toBe('画');
    expect(seal.pct).toBe(4);
  });
});
