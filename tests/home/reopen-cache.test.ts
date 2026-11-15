// @vitest-environment jsdom
/**
 * 首页「每次重开卡一小会儿」回归（2026-11-15）：
 * 数据没变时重开既不重采全库、也不整屏重建；数据变了（域事件）或首次打开仍照常回源重渲。
 * 同时守住 issue 383 的「让出首帧」——打开命令的同步段不许启动采集。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { EMPTY_COUNTS, EMPTY_SUMMARY } from '../../src/home/shared';
import { openHome, unloadHome } from '../../src/home';
import { closeOverlay } from '../../src/home/ui';
import { resetHomeState } from '../../src/home/state';
import { resetRiverCache, loadRiverCached } from '../../src/home/river-cache';
import { emitDomainEvent } from '../../src/core/domain-bus';
import type { RiverData } from '../../src/home/river';

const collectMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/home/river', () => ({
  // 每次回源造一份新对象（真实 collectRiver 的行为）：UI 靠引用是否相同判断要不要重建
  collectRiver: (...args: unknown[]) => collectMock(...args),
}));

function makeRiver(): RiverData {
  const day = (dateStr: string) => ({ dateStr, events: [], summary: { ...EMPTY_SUMMARY }, firstTs: null });
  const days = Array.from({ length: 7 }, (_, i) => day(`2026-11-0${i + 1}`));
  const week = days.map((d, i) => ({ dateStr: d.dateStr, label: d.dateStr.slice(5), dayOfMonth: i + 1, weekday: '一', hit: false }));
  return {
    today: days[0], yesterday: days[1], days, week,
    streak: { diaryStreak: 0, diaryWrittenToday: false },
    counts: { ...EMPTY_COUNTS },
    pomodoroFocusing: false,
  };
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn: () => boolean, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return;
    await tick(20);
  }
  throw new Error('waitFor 超时');
}

function appOf(): any {
  const vault = new MockVault();
  const app = mockAppWithVault(vault) as any;
  setApp(app);
  return app;
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetHomeState();
  resetRiverCache();
  resetObsidianMocks();
  clearNotices();
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, storagePath: 'CONFIG/STORAGE' }));
  collectMock.mockReset();
  collectMock.mockImplementation(async () => makeRiver());
});

afterEach(() => {
  unloadHome();
});

describe('首页重开快路', () => {
  it('数据没变：不重采全库，也不整屏重建（五区节点原样复用）', async () => {
    const app = appOf();
    openHome(app);
    // 首开壳同步就铺好了入口行，结构在场 ≠ 数据已到：要等的是慢数据那一轮补画落地
    await waitFor(() => collectMock.mock.calls.length >= 1
      && !document.querySelector('[data-home-flow]')!.textContent!.includes('正在汇入'));
    // renderAll 重建的是容器内部，容器元素本身始终常驻——要守「不重建」得盯里面的行节点
    const row = document.querySelector('[data-home-entries] .bz-home-erow');
    const flowRow = document.querySelector('[data-home-flow] .bz-home-ev, [data-home-flow] .bz-home-flow-empty');
    expect(collectMock).toHaveBeenCalledTimes(1);

    closeOverlay();
    openHome(app);
    await tick(80);
    expect(collectMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-home-entries] .bz-home-erow')).toBe(row);
    expect(document.querySelector('[data-home-flow] .bz-home-ev, [data-home-flow] .bz-home-flow-empty')).toBe(flowRow);
  });

  it('域数据动作事件置脏后重开：回源一次并重建新节点', async () => {
    const app = appOf();
    openHome(app);
    await waitFor(() => collectMock.mock.calls.length >= 1
      && !document.querySelector('[data-home-flow]')!.textContent!.includes('正在汇入'));
    const row = document.querySelector('[data-home-entries] .bz-home-erow');

    emitDomainEvent('memo', { kind: 'add' });
    closeOverlay();
    openHome(app);
    await waitFor(() => collectMock.mock.calls.length >= 2);
    await tick(30);
    expect(collectMock).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-home-entries] .bz-home-erow')).not.toBe(row);
  });

  it('打开命令的同步段不启动采集（让出首帧，issue 383）', async () => {
    const app = appOf();
    openHome(app);
    expect(collectMock).toHaveBeenCalledTimes(0);
    expect(document.querySelector('.bz-home-overlay')).toBeTruthy(); // 骨架/旧渲染已经显示
    await waitFor(() => collectMock.mock.calls.length >= 1);
  });

  it('预热只填数据：首开命中缓存仍把骨架换成真数据', async () => {
    const app = appOf();
    await loadRiverCached(app); // 等价于启动空闲预热完成
    expect(collectMock).toHaveBeenCalledTimes(1);

    openHome(app);
    await waitFor(() => !document.querySelector('[data-home-flow]')!.textContent!.includes('正在汇入'));
    expect(collectMock).toHaveBeenCalledTimes(1); // 没再扫一遍全库
    expect(document.querySelector('[data-home-flow]')!.textContent).not.toContain('正在汇入今天的痕迹');
  });
});
