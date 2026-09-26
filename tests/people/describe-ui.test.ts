/**
 * 图片描述 UI 层测试（issue 470 / ADR-0196 决策 8）：确认弹窗（body 级，面板可不开）的
 * 文案契约与按钮解析、确认门经 startGeneration 注入引擎、进度块 / 印章的 describe 段呈现。
 * 引擎用假件注入（setJobsModuleForTests 先例）；测试数据全构造。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closePeoplePanel, setJobsModuleForTests, startGeneration, type GenTarget, type JobsApi } from '../../src/people/ui';
import { describeConfirmModal, foldSeal, progressBlock, type JobsBlockState } from '../../src/people/render';
import type { DescribeConfirmInfo } from '../../src/people/types';
import type { PersonJob, JobView, JobsSnapshot } from '../../src/people/jobs';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';

const T0 = Date.UTC(2024, 4, 1, 12, 0, 0);

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const info: DescribeConfirmInfo = {
  provider: '智谱 Plan',
  model: 'glm-5.3-flash',
  name: '陈默',
  totalImages: 82,
  doneImages: 3,
  calls: 4,
  batchSize: 20,
};

describe('describeConfirmModal 确认弹窗（ADR-0196 决策 8）', () => {
  it('文案报清服务商 / 模型 / 张数 / 调用数 / 起始位置，不出现金额字样', () => {
    const node = describeConfirmModal(info, () => {});
    const line = node.querySelector<HTMLElement>('.bz-people-desc-line')!.textContent ?? '';
    expect(line).toContain('智谱 Plan / glm-5.3-flash');
    expect(line).toContain('陈默');
    expect(line).toContain('82 张图片');
    expect(line).toContain('约 4 次调用');
    expect(line).toContain('已完成 3 张');
    expect(line).toContain('从第 4 张开始');
    expect(line).not.toMatch(/元|￥|¥|\$/);
    expect(node.querySelector('[data-people-desc-start]')?.textContent).toBe('开始');
    expect(node.querySelector('button[data-people-desc-skip]')?.textContent).toBe('跳过图片描述');
  });

  it('点「开始」/「跳过」各回调一次；遮罩点击 = 跳过（不花钱的路）', () => {
    const answers: Array<'start' | 'skip'> = [];
    const node = describeConfirmModal(info, (a) => answers.push(a));
    document.body.appendChild(node);
    click('[data-people-desc-start]');
    expect(answers).toEqual(['start']);
    click('button[data-people-desc-skip]');
    expect(answers).toEqual(['start', 'skip']);
    // 遮罩（第一个 data-people-desc-skip 命中 dim 层）
    node.querySelectorAll<HTMLElement>('[data-people-desc-skip]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(answers).toEqual(['start', 'skip', 'skip']);
    node.remove();
  });
});

/** 假引擎：只记录 startJobs 的 opts（确认门注入断言用） */
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

describe('确认门接线（startGeneration → 引擎 askDescribeConfirm）', () => {
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

  it('startGeneration 把确认门带给引擎；门回调弹 body 级弹窗，开始 / Esc 分别解析', async () => {
    const { engine, calls } = fakeEngine();
    setJobsModuleForTests(engine);
    await startGeneration([genTarget()]);
    expect(calls.length).toBe(1);
    const gate = calls[0].opts.askDescribeConfirm as (i: DescribeConfirmInfo) => Promise<'start' | 'skip'>;
    expect(typeof gate).toBe('function');
    // 门回调 → 弹窗挂 body（面板可以没开）；点「开始」解析 start
    const p1 = gate(info);
    const modal = document.querySelector('[data-people-desc-confirm]');
    expect(modal).toBeTruthy();
    click('[data-people-desc-start]');
    await expect(p1).resolves.toBe('start');
    expect(document.querySelector('[data-people-desc-confirm]')).toBeNull(); // 解析后弹层摘除
    // Esc = 跳过（不花钱的那条路）
    const p2 = gate(info);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(p2).resolves.toBe('skip');
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

  it('暂停 / 失败断面同样带阶段信息', () => {
    const paused = progressBlock(blockState({ status: 'paused' }));
    expect(paused.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('已暂停 · 图片描述 3/82 批');
    const failed = progressBlock(blockState({ status: 'error', errorText: '构造失败' }));
    expect(failed.querySelector<HTMLElement>('.bz-people-jobs-main')!.textContent).toBe('生成失败 · 图片描述 3/82 批');
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
