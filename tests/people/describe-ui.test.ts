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

/** 大琳的真账（issue 530 实测蓝本，与用户拍板的示意图同数）：1,289 条语音全部转写完、
 *  全部待 LLM 校对——这一整类此前在开工单上一个字都没有。 */
const info: GenerationConfirmInfo = {
  materials: 1,
  materialsTotal: 20773,
  images: 2,
  imagesDescribed: 1564,
  voices: 0,
  voiceProofread: 1289,
  recs: 0,
  recProofread: 0,
  mediaFail: 21,
  batches: 1,
  empty: false,
};

/** 一行的四格：序号 | 名称 | 本次工作量 | · 对账数 */
function rowCells(r: Element): string {
  return [...r.querySelectorAll('span')].map((s) => s.textContent ?? '').join('|');
}

describe('开工单册页（genPage，issue 505：确认是册子里翻出来的一页；530：按示意图重排成账单）', () => {
  it('四组一条流水线、一行一项：序号 + 名称 + 本次工作量 + · 对账数（530 的核心修复）', () => {
    const page = genPage(info);
    expect(page.dataset.peopleSub).toBe('gen');
    expect(page.querySelector('.bz-people-head-label')!.textContent).toBe('开始生成脸谱');
    // 530 拍板：删掉「为 N 位联系人生成脸谱」那行
    expect(page.querySelector('.bz-people-gen-line')).toBeNull();
    const groups = [...page.querySelectorAll('.bz-people-gen-group')].map((n) => n.textContent ?? '');
    expect(groups).toEqual(['本趟要处理的素材', '中间工序', '重画', '落盘']);
    const rows = [...page.querySelectorAll('.bz-people-gen-row')];
    expect(rows.map(rowCells)).toEqual([
      '1|微信语音条|0 条待转写|· 1,289 条待 LLM 校对',
      '2|图片|2 张待描述|· 1,564 张已描述',
      '3|聊天记录|1 条|· 仓内共 20,773 条',
      '4|源图损坏/缺失|21 张',
      '5|并仓|',
      '6|采集提炼|1 批',
      '7|三卷|《其人》《相交》《纪事》',
      '8|补充背景|十维档案回填',
      '9|账|',
    ]);
    // 素材组序号实心红章，工序 / 重画 / 落盘空圈
    expect(rows[0].classList.contains('bz-people-gen-row-a')).toBe(true);
    expect(rows[4].classList.contains('bz-people-gen-row-a')).toBe(false);
    // 录音待转写 / 待校对都是 0 → 整行不出（用户拍板：不为「0」占一行）
    expect(rows.some((r) => rowCells(r).includes('录音'))).toBe(false);
    // 按钮那行也占一个序号位（接着往下数）
    expect(page.querySelector('.bz-people-gen-actions .bz-people-gen-no')!.textContent).toBe('10');
    // 523 / 530 用户拍板：调用什么 AI、调用多少次都不告诉用户；也不报金额
    const allText = page.textContent ?? '';
    expect(allText).not.toContain('调用');
    expect(allText).not.toContain('模型');
    expect(allText).not.toMatch(/元|￥|¥|\$/);
    // 逐人明细也删了；只剩一枚按钮——反悔走右上「合上这页」（530 拍板：取消钮删掉）
    expect(page.querySelector('.bz-people-gen-item')).toBeNull();
    expect(page.querySelector('[data-people-gen-start]')?.textContent).toBe('开始生成');
    expect(page.querySelector<HTMLButtonElement>('[data-people-gen-start]')!.hasAttribute('disabled')).toBe(false);
    expect(page.querySelector('button[data-people-gen-cancel]')).toBeNull();
    expect(page.querySelector('[data-people-close]')).toBeTruthy();
  });

  it('待转写 / 待校对 都有数时逐格报；录音线有欠账就出一行（issue 530）', () => {
    const page = genPage({
      ...info, materials: 0, materialsTotal: 1204, images: 8, imagesDescribed: 0,
      voices: 120, voiceProofread: 40, recs: 5, recProofread: 2, mediaFail: 0, batches: 6,
    });
    expect([...page.querySelectorAll('.bz-people-gen-row')].map(rowCells)).toEqual([
      '1|微信语音条|120 条待转写|· 40 条待 LLM 校对',
      '2|图片|8 张待描述',
      '3|聊天记录|0 条|· 仓内共 1,204 条',
      '4|录音|5 条|· 2 条待校对',
      '5|并仓|',
      '6|采集提炼|6 批',
      '7|三卷|《其人》《相交》《纪事》',
      '8|补充背景|十维档案回填',
      '9|账|',
    ]);
  });

  it('其余素材全为 0 时只剩聊天记录一行，工序 / 重画 / 落盘照旧（一路往下排号）', () => {
    const page = genPage({
      ...info, materials: 5, materialsTotal: 5, images: 0, imagesDescribed: 0,
      voices: 0, voiceProofread: 0, mediaFail: 0, batches: 1,
    });
    expect([...page.querySelectorAll('.bz-people-gen-row')].map(rowCells)).toEqual([
      '1|聊天记录|5 条|· 仓内共 5 条',
      '2|并仓|',
      '3|采集提炼|1 批',
      '4|三卷|《其人》《相交》《纪事》',
      '5|补充背景|十维档案回填',
      '6|账|',
    ]);
  });

  it('没有新素材（issue 523）：只出一句说明并点名联系人，不出分组 / 行，开始生成置灰', () => {
    const page = genPage({
      materials: 0, materialsTotal: 0, images: 0, imagesDescribed: 0,
      voices: 0, voiceProofread: 0, recs: 0, recProofread: 0, mediaFail: 0, batches: 0,
      empty: true, skipped: ['丘羽'],
    });
    expect(page.querySelector<HTMLElement>('.bz-people-gen-none')!.textContent)
      .toBe('「丘羽」没有新消息，也没有待描述 / 待转写 / 待校对的素材，无需重新生成。');
    expect(page.querySelector('.bz-people-gen-group')).toBeNull();
    expect(page.querySelector('.bz-people-gen-row')).toBeNull();
    expect(page.querySelector<HTMLButtonElement>('[data-people-gen-start]')!.hasAttribute('disabled')).toBe(true);
    expect(page.querySelector('button[data-people-gen-cancel]')).toBeNull();
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
    expect(document.querySelector('.bz-people-gen-group')!.textContent).toBe('本趟要处理的素材');
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

  it('点右上「合上这页」＝不起引擎，开工单合上（530 拍板：页上不再有「取消」钮）', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    click('[data-people-close]');
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
    click('[data-people-close]');
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
    expect(document.querySelector<HTMLElement>('.bz-people-gen-none')!.textContent).toContain('「陈默」没有新消息');
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

  it('旧版记下的子集条数（如丘羽：跨度覆盖到导出末尾、条数却只有 1）也不再误报「新增素材」', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    // 523 之前 importRecordOf 记的是「本次提炼子集条数」：增量只跑 1 条就写 1，跨度却是全量
    // → 指纹（条数 + 跨度）永不命中 → 同秒容差又把锚点那条自身算成候选。这层要判回「没有新素材」。
    const talker = 'wxid_a';
    const stale: ImportRecord = {
      file: '数据源:陈默',
      importedAt: '2026-09-02T00:00:00.000Z',
      messageCount: 1,
      skippedCount: 0,
      timeFrom: new Date(T0).toISOString(),
      timeTo: new Date(T0 + 60_000).toISOString(),
    };
    const p: PersonEntry = { id: talker, name: '陈默', createdAt: '2026-09-01T00:00:00.000Z', imports: [stale], lastProcessedTs: T0 + 60_000 };
    await (await getPeopleSafeStore()).write(talker, (rec) => { rec.person = p; });

    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    expect(document.querySelector<HTMLElement>('.bz-people-gen-none')!.textContent).toContain('没有新消息');
    expect(document.querySelector<HTMLButtonElement>('[data-people-gen-start]')!.hasAttribute('disabled')).toBe(true);
    click('[data-people-close]');
    await gen;
    expect(calls.length).toBe(0); // 候选全停在锚点一秒内 = 上次已处理过的，不白烧一遍
  });

  it('候选里只要有一条严格晚于锚点（真新消息），照常进引擎', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    // 锚点停在第 1 条：第 2 条严格晚于锚点 → 是真新素材，必须跑
    const talker = 'wxid_a';
    const p: PersonEntry = {
      id: talker,
      name: '陈默',
      createdAt: '2026-09-01T00:00:00.000Z',
      imports: [{ file: '数据源:陈默', importedAt: '2026-09-02T00:00:00.000Z', messageCount: 1, skippedCount: 0, timeFrom: new Date(T0).toISOString(), timeTo: new Date(T0).toISOString() }],
      lastProcessedTs: T0,
    };
    await (await getPeopleSafeStore()).write(talker, (rec) => { rec.person = p; });

    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    expect(document.querySelector<HTMLElement>('.bz-people-gen-row .bz-people-gen-v')!.textContent).toBe('2 条');
    click('[data-people-gen-start]');
    await gen;
    expect(calls.length).toBe(1);
  });

  it('旧记录条数口径 + 有未描述图片：不判「没有新素材」，照常起引擎（描述欠账不能被这层闸连带关掉）', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    // 同上一条的旧记录（候选全停在锚点内），但仓里压着 3 张没描述的图——那些图 text 还空着，
    // 不进文本时间线、也就进不了候选。旧版记错条数时这些人本来会照跑一趟顺手把图描述掉，
    // 这层闸只该拦「真的什么都没有」的人。照片欠账另有留影页「生成描述」入口，但不是把
    // 画脸谱这条路堵死的理由。
    const talker = 'wxid_a';
    const stale: ImportRecord = {
      file: '数据源:陈默',
      importedAt: '2026-09-02T00:00:00.000Z',
      messageCount: 1,
      skippedCount: 0,
      timeFrom: new Date(T0).toISOString(),
      timeTo: new Date(T0 + 60_000).toISOString(),
    };
    const p: PersonEntry = { id: talker, name: '陈默', createdAt: '2026-09-01T00:00:00.000Z', imports: [stale], lastProcessedTs: T0 + 60_000 };
    await (await getPeopleSafeStore()).write(talker, (rec) => { rec.person = p; });

    const t = genTarget();
    const gen = startGeneration([{ ...t, pending: { images: 3, described: 0, voices: 0, mediaFail: 0, total: 2 } }]);
    await vi.waitFor(() => expect(document.querySelector(GEN_PAGE)).toBeTruthy());
    // 开工单照旧只说素材：图片 3 张如实报出（聊天记录走 514 的增量口径）
    const rows = [...document.querySelectorAll('.bz-people-gen-row')].map((n) => n.textContent ?? '');
    expect(rows.some((r) => r.includes('图片') && r.includes('3 张待描述'))).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-people-gen-start]')!.hasAttribute('disabled')).toBe(false);
    click('[data-people-gen-start]');
    await gen;
    expect(calls.length).toBe(1);
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
