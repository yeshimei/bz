// @vitest-environment jsdom
/**
 * 首次启动第一次打开首页（2026-11-15 用户报「还是加载很久」）：
 * 上一次的会话缓存只治了「重开」，首开仍在等一整轮全量采集（约 20 轮全库遍历）。
 * 本组守住分段渲染契约：
 *  - 打开命令的同步段：左右入口 / 明天预告 / 周历 / 移动瓦片 全部可见，中间时间线留「正在汇入…」；
 *  - 首屏不得显示假 0 计数（回落域副题），也不得提前启动采集；
 *  - 慢数据到位：只补中间列 + 就地换数字/彩点/周历动静，不整屏重建（节点原地复用）；
 *  - 采集失败沿用既有「失败 + 重试」态，不永挂加载；
 *  - 重开仍走会话缓存快路。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { DOMAINS, EMPTY_COUNTS, EMPTY_SUMMARY, dateStrOf } from '../../src/home/shared';
import { openHome, unloadHome } from '../../src/home';
import { closeOverlay } from '../../src/home/ui';
import { resetHomeState } from '../../src/home/state';
import { resetRiverCache } from '../../src/home/river-cache';
import type { RiverData } from '../../src/home/river';

const collectMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/home/river', () => ({
  collectRiver: (...args: unknown[]) => collectMock(...args),
}));

function makeRiver(): RiverData {
  const now = Date.now();
  const ev = { domain: 'memo', ts: now, timeLabel: '09:00', text: '新增了一条备忘录', kind: 'progress' as const };
  const day = (i: number, events: RiverData['today']['events'] = []) => ({
    dateStr: dateStrOf(now - i * 86400000),
    events,
    summary: { ...EMPTY_SUMMARY },
    firstTs: events.length ? events[0].ts : null,
  });
  const days = [day(0, [ev]), ...Array.from({ length: 6 }, (_, i) => day(i + 1))];
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  const week = days.map((d, i) => {
    const dt = new Date(d.dateStr + ' 12:00:00');
    return { dateStr: d.dateStr, label: d.dateStr.slice(5), dayOfMonth: dt.getDate(), weekday: WD[dt.getDay()], hit: i === 1 };
  });
  return {
    today: days[0], yesterday: days[1], days, week,
    streak: { diaryStreak: 0, diaryWrittenToday: false },
    counts: { ...EMPTY_COUNTS, memoOpen: 7 },
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

describe('首次打开：左右同步秒出，中间后台补画', () => {
  it('同步段：左右入口 / 周历 / 明天预告 / 瓦片全在场，中间仍是「正在汇入」，且不启动采集', () => {
    const app = appOf();
    openHome(app);
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelectorAll('[data-home-entries] .bz-home-erow').length).toBe(DOMAINS.length);
    expect(overlay.querySelectorAll('[data-home-tiles] .bz-home-m-tile').length).toBe(DOMAINS.length);
    expect(overlay.querySelectorAll('[data-home-week] [data-home-weekday]').length).toBe(7);
    expect((overlay.querySelector('[data-home-next]') as HTMLElement).textContent).toContain('明 天 预 告');
    expect((overlay.querySelector('[data-home-flow]') as HTMLElement).textContent).toContain('正在汇入今天的痕迹');
    // 首屏不能拿 0 当真数糊弄：计数未就绪时回落域副题
    expect((overlay.querySelector('[data-home-go="memo"] .bz-home-ect') as HTMLElement).textContent).toBe('随手记与待办');
    expect(collectMock).toHaveBeenCalledTimes(0);
  });

  it('慢数据到位：只补中间列与数字，左右/周历节点原地复用（不整屏重建）', async () => {
    let release!: (v: RiverData) => void;
    collectMock.mockImplementation(() => new Promise<RiverData>((res) => { release = res; }));
    const app = appOf();
    openHome(app);
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    const row = overlay.querySelector('[data-home-go="memo"]');
    const wk = overlay.querySelectorAll('[data-home-weekday]')[1];
    const flow = overlay.querySelector('[data-home-flow]') as HTMLElement;
    expect(flow.textContent).toContain('正在汇入今天的痕迹');

    await waitFor(() => collectMock.mock.calls.length >= 1);
    release(makeRiver());
    await waitFor(() => !flow.textContent!.includes('正在汇入今天的痕迹'));

    expect(overlay.querySelector('[data-home-go="memo"]')).toBe(row);
    expect(overlay.querySelectorAll('[data-home-weekday]')[1]).toBe(wk);
    expect((row!.querySelector('.bz-home-ect') as HTMLElement).textContent).toBe('7 条待办');
    expect(flow.querySelectorAll('.bz-home-timeline .bz-home-ev').length).toBe(1);
    expect((overlay.querySelector('[data-home-next]') as HTMLElement).querySelectorAll('.bz-home-pr').length).toBe(3);
    expect(overlay.querySelectorAll('.bz-home-wk--hit').length).toBe(1);
  });

  it('慢数据失败：出「失败 + 重试」态，不永挂加载文案', async () => {
    collectMock.mockRejectedValue(new Error('aggregate boom'));
    const app = appOf();
    openHome(app);
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    await waitFor(() => !!overlay.querySelector('.bz-empty'));
    expect((overlay.querySelector('[data-home-flow]') as HTMLElement).textContent).not.toContain('正在汇入');
    expect([...overlay.querySelectorAll('button')].some((b) => b.textContent === '重试')).toBe(true);
  });

  it('首开补完数据后重开：仍走会话缓存快路，不重采也不重建', async () => {
    const app = appOf();
    openHome(app);
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    await waitFor(() => !!overlay.querySelector('.bz-home-timeline .bz-home-ev'));
    expect(collectMock).toHaveBeenCalledTimes(1);
    const ev = overlay.querySelector('.bz-home-timeline .bz-home-ev');

    closeOverlay();
    openHome(app);
    await tick(80);
    expect(collectMock).toHaveBeenCalledTimes(1);
    expect(overlay.querySelector('.bz-home-timeline .bz-home-ev')).toBe(ev);
  });
});
