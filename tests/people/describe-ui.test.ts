/**
 * 画谱总确认 UI 层测试（issue 497：两次确认合一 + 进度细化）：
 * 总确认弹窗（body 级，面板可不开）的文案契约与按钮解析、startGeneration 起引擎前
 * 恰好弹一次总确认、确认后引擎两道门自动放行（不再弹窗）、取消不起引擎；
 * 进度块主行阶段标签与引擎细文案副行。引擎用假件注入（setJobsModuleForTests 先例）；
 * 测试数据全构造。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closePeoplePanel, setJobsModuleForTests, startGeneration, type GenTarget, type JobsApi } from '../../src/people/ui';
import { foldSeal, generationConfirmModal, jobsStageLabel, progressBlock, type JobsBlockState } from '../../src/people/render';
import type { GenerationConfirmInfo } from '../../src/people/types';
import type { PersonJob, JobView, JobsSnapshot } from '../../src/people/jobs';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';

const T0 = Date.UTC(2024, 4, 1, 12, 0, 0);

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const info: GenerationConfirmInfo = {
  provider: '智谱 Plan',
  model: 'glm-5.3-flash',
  items: [
    { name: '陈默', materials: 2, images: 0, voices: 0 },
    { name: '大琳', materials: 20773, images: 1615, voices: 1289 },
  ],
  images: 1615,
  describeCalls: 81,
  batchSize: 20,
  voices: 1289,
  portraitCalls: 8,
};

describe('generationConfirmModal 总确认弹窗（issue 497）', () => {
  it('一次报清：人数 / 图片与描述调用 / 语音本地转写 / 画像调用 / 逐人明细，不出现金额字样', () => {
    const node = generationConfirmModal(info, () => {});
    const line = node.querySelector<HTMLElement>('.bz-people-desc-line')!.textContent ?? '';
    expect(line).toContain('为 2 位联系人生成脸谱');
    expect(line).toContain('图片 1615 张用 智谱 Plan / glm-5.3-flash 描述');
    expect(line).toContain('约 81 次调用');
    expect(line).toContain('每批 20 张');
    expect(line).toContain('语音 1289 条在本地离线转写，不联网不花钱');
    expect(line).toContain('画像由 智谱 Plan / glm-5.3-flash 生成，约 8 次调用');
    const items = [...node.querySelectorAll('.bz-people-gen-item')].map((n) => n.textContent ?? '');
    expect(items[0]).toContain('「陈默」· 素材 2 条');
    expect(items[1]).toContain('「大琳」· 素材 20773 条 · 图片 1615 张 · 语音 1289 条');
    expect(line + items.join('')).not.toMatch(/元|￥|¥|\$/);
    expect(node.querySelector('[data-people-gen-start]')?.textContent).toBe('开始生成');
    expect(node.querySelector('button[data-people-gen-cancel]')?.textContent).toBe('取消');
    expect(node.querySelector<HTMLElement>('.bz-people-desc-note')!.textContent).toContain('中途不再询问');
    node.remove();
  });

  it('零图片零语音：总览只报画像一段；点开始 / 取消 / 遮罩各回调一次', () => {
    const answers: Array<'start' | 'cancel'> = [];
    const node = generationConfirmModal({ ...info, images: 0, voices: 0, describeCalls: 0, items: [{ name: '陈默', materials: 5, images: 0, voices: 0 }] }, (a) => answers.push(a));
    document.body.appendChild(node);
    const line = node.querySelector<HTMLElement>('.bz-people-desc-line')!.textContent ?? '';
    expect(line).not.toContain('图片');
    expect(line).not.toContain('语音');
    click('[data-people-gen-start]');
    expect(answers).toEqual(['start']);
    click('button[data-people-gen-cancel]');
    expect(answers).toEqual(['start', 'cancel']);
    // 遮罩（第一个 data-people-gen-cancel 命中 dim 层）= 取消（不花钱的那条路）
    node.querySelectorAll<HTMLElement>('[data-people-gen-cancel]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(answers).toEqual(['start', 'cancel', 'cancel']);
    node.remove();
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

describe('总确认接线（startGeneration → 一次确认 → 引擎自动放行）', () => {
  beforeEach(async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(makeApp(new MockVault()));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
    // planTargets 经 PeopleStore.list 读保库记录索引——需要解锁的共锁单例（generate-ui 先例）
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('desc-ui-pw');
    const safe = new PeopleSafeStore(sm);
    setPeopleSafeStoreForTests(safe);
  });

  afterEach(() => {
    try { closePeoplePanel(); } catch { /* 幂等 */ }
    setJobsModuleForTests(null);
    setPeopleSafeStoreForTests(null);
  });

  it('startGeneration 先弹一次总确认；点「开始生成」才起引擎，两道门自动放行且不再弹任何窗', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-gen-confirm]')).toBeTruthy());
    expect(calls.length).toBe(0); // 确认前不起引擎
    click('[data-people-gen-start]');
    await gen;
    expect(calls.length).toBe(1);
    // 确认后弹层摘除；两道门都是自动放行件（调了就放行，不弹窗）
    expect(document.querySelector('[data-people-gen-confirm]')).toBeNull();
    const descGate = calls[0].opts.askDescribeConfirm as (i: never) => Promise<'start' | 'skip'>;
    const portraitGate = calls[0].opts.askPortraitConfirm as (i: never) => Promise<'start' | 'cancel'>;
    await expect(descGate({} as never)).resolves.toBe('start');
    await expect(portraitGate({} as never)).resolves.toBe('start');
    expect(document.body.querySelector('[data-people-desc-confirm], [data-people-portrait-confirm], [data-people-gen-confirm]')).toBeNull();
  });

  it('Esc / 取消 = 不起引擎', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    const gen = startGeneration([genTarget()]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-gen-confirm]')).toBeTruthy());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await gen;
    expect(calls.length).toBe(0);
    expect(document.querySelector('[data-people-gen-confirm]')).toBeNull();
  });
});

describe('进度块与印章的 describe 段呈现', () => {
  const job: PersonJob = {
    talker: 'wxid_a',
    name: '陈默',
    mode: 'full',
    fileLabel: '数据源:陈默',
    status: 'running',
    stage: 'describe',
    msgCount: 2,
    contentHash: 'h',
    chunks: [],
    batchesDone: 0,
    results: [],
    describe: { imgCount: 1631, batchSize: 20, totalBatches: 82, doneBatches: 3 },
    startedAt: '',
    updatedAt: '',
  };

  function blockState(over: Partial<JobsBlockState> = {}): JobsBlockState {
    return {
      talker: 'wxid_a',
      name: '陈默',
      status: 'running',
      message: '图片描述 第 4/82 批（20 张）',
      batchesDone: 0,
      batchesTotal: 35,
      stagesDone: 0,
      queueIndex: 1,
      queueTotal: 1,
      describe: { stageText: '图片描述 3/82 批', overall: 4 },
      ...over,
    };
  }

  it('running 主行 = `图片描述 3/82 批`，进度条走段内批进度（不用批口径的 0%）', () => {
    const node = progressBlock(blockState());
    expect(node.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('图片描述 3/82 批');
    expect((node.querySelector<HTMLElement>('.bz-people-jobs-fill')!.getAttribute('style'))).toBe('width:4%');
  });

  it('引擎细文案副行（497）：批详情 / 素材统计上屏；与主行同文时隐藏', () => {
    const node = progressBlock(blockState());
    expect(node.querySelector<HTMLElement>('[data-people-jobs-sub]')!.textContent).toBe('图片描述 第 4/82 批（20 张）');
    // prep 段：message 就是阶段行 → 副行隐藏不重复念
    const prepNode = progressBlock(blockState({
      describe: undefined,
      prep: { stageText: '媒体导出 3/16', overall: 12, failed: 0 },
      message: '媒体导出 3/16',
    }));
    expect(prepNode.querySelector('[data-people-jobs-sub]')).toBeNull();
  });

  it('后段主行走阶段标签（497）：不再停留在过期批号', () => {
    const person = progressBlock(blockState({ describe: undefined, stage: 'person', message: '素材采集完成：事件 214 · 原话 63' }));
    expect(person.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('正在生成《其人》…');
    expect(person.querySelector<HTMLElement>('[data-people-jobs-sub]')!.textContent).toContain('素材采集完成');
    expect(jobsStageLabel('bond')).toBe('正在生成《相交》…');
    expect(jobsStageLabel('chronicle')).toBe('正在生成《纪事》…');
    expect(jobsStageLabel('chunked')).toBe('正在切批组装素材…');
    expect(jobsStageLabel('extracting')).toBeNull();
    const extracting = progressBlock(blockState({ describe: undefined, stage: 'extracting', message: '第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条' }));
    expect(extracting.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('正在生成 · 第 1/35 批');
    expect(extracting.querySelector<HTMLElement>('[data-people-jobs-sub]')!.textContent).toContain('2026-05-01 ~ 2026-05-31 · 397 条');
  });

  it('暂停 / 失败断面同样带阶段信息', () => {
    const paused = progressBlock(blockState({ status: 'paused' }));
    expect(paused.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('已暂停 · 图片描述 3/82 批');
    const failed = progressBlock(blockState({ status: 'error', errorText: '构造失败' }));
    expect(failed.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('生成失败 · 图片描述 3/82 批');
    // 后段暂停也有名有姓（497）
    const pausedPerson = progressBlock(blockState({ status: 'paused', describe: undefined, stage: 'person', message: '' }));
    expect(pausedPerson.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('已暂停 · 正在生成《其人》…');
  });

  it('印章百分比走 describePct（画谱中 4%）', () => {
    const p = { id: 'wxid_a', name: '陈默', createdAt: '', imports: [] };
    const seal = foldSeal(p as never, {
      status: 'running',
      batchesDone: 0,
      batchesTotal: 82,
      stagesDone: 0,
      resumable: true,
      describePct: 4,
    });
    expect(seal.state).toBe('running');
    expect(seal.text).toBe('画谱中\n4%');
  });
});
