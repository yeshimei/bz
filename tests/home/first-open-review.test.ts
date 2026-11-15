// @vitest-environment jsdom
/**
 * 发版前置 review 的几条首页回归（2026-11-15，v1.44.4）：
 *  - 壳阶段彩点不落色（pending），别把「还没采到」画成「今天没动静」；
 *  - 自定义入口顺序：预热缓存让壳按真顺序铺，慢数据不再整屏重排；
 *  - 收起面板时慢数据才落地：重开补画河面（隐藏时量不到尺寸）；
 *  - 壳与采集跨过零点：整屏重建，周历「今天」不留在昨天；
 *  - 采集途中数据又变：这一轮作废但**串行**续采，不并排再跑一轮全库扫描；
 *  - 没有 requestIdleCallback 的宿主：预热让出启动那一拍。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { EMPTY_COUNTS, EMPTY_SUMMARY, dateStrOf, DOMAINS } from '../../src/home/shared';
import { openHome, unloadHome, prewarmHome } from '../../src/home';
import { closeOverlay, showOverlay } from '../../src/home/ui';
import { H, resetHomeState } from '../../src/home/state';
import { loadHomeOrder } from '../../src/home/order';
import { loadRiverCached, resetRiverCache } from '../../src/home/river-cache';
import { emitDomainEvent } from '../../src/core/domain-bus';
import type { RiverData } from '../../src/home/river';

const collectMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/home/river', () => ({
  collectRiver: (...args: unknown[]) => collectMock(...args),
}));

const WD = ['日', '一', '二', '三', '四', '五', '六'];

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
  const week = days.map((d) => {
    const dt = new Date(d.dateStr + ' 12:00:00');
    return { dateStr: d.dateStr, label: d.dateStr.slice(5), dayOfMonth: dt.getDate(), weekday: WD[dt.getDay()], hit: false };
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

const q = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

/** jsdom 里所有元素都量不出尺寸：按「祖先 display:none 就是 0，否则给个像样的盒子」兜住，
 *  这样才分得出「面板藏着时画不出河面」与「显示后补画」两态。 */
function installSizeStub(): () => void {
  const sw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  const sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  const rect = HTMLElement.prototype.getBoundingClientRect;
  // jsdom 的 SVG 元素没实现 getTotalLength：河面描线量长度那一步会抛，
  // 给个固定长度让它走完（本组只验「画出来 / 没画出来」，不验路径几何）。
  const svgProto = (typeof SVGElement === 'undefined' ? null : SVGElement.prototype) as unknown as Record<string, unknown> | null;
  const gtl = svgProto ? svgProto.getTotalLength : undefined;
  if (svgProto) svgProto.getTotalLength = () => 100;
  const hidden = function (el: HTMLElement): boolean {
    return !!el.closest?.('[style*="display: none"]');
  };
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) { return hidden(this) ? 0 : 320; },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) { return hidden(this) ? 0 : 640; },
  });
  HTMLElement.prototype.getBoundingClientRect = function (): DOMRect {
    return { left: 0, top: 0, x: 0, y: 0, right: 320, bottom: 640, width: 320, height: 640, toJSON: () => ({}) } as DOMRect;
  };
  return () => {
    if (sw) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', sw);
    if (sh) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', sh);
    HTMLElement.prototype.getBoundingClientRect = rect;
    if (svgProto) {
      if (gtl) svgProto.getTotalLength = gtl;
      else delete svgProto.getTotalLength;
    }
  };
}

let restoreSize: () => void = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
  resetHomeState();
  resetRiverCache();
  resetObsidianMocks();
  clearNotices();
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, storagePath: 'CONFIG/STORAGE' }));
  collectMock.mockReset();
  collectMock.mockImplementation(async () => makeRiver());
  restoreSize = installSizeStub();
});

afterEach(() => {
  restoreSize();
  unloadHome();
});

function appOf(vault = new MockVault()): any {
  const app = mockAppWithVault(vault) as any;
  setApp(app);
  return app;
}

describe('首屏壳（发版 review 回归）', () => {
  it('壳阶段彩点不落色（pending），慢数据到了才在同一节点上换成真彩点', async () => {
    let release!: (v: RiverData) => void;
    collectMock.mockImplementation(() => new Promise<RiverData>((res) => { release = res; }));
    const app = appOf();
    openHome(app);
    const overlay = q('.bz-home-overlay');
    const dot = overlay.querySelector('[data-home-go="memo"] .bz-home-dot') as HTMLElement;
    expect(dot.className).toContain('bz-home-dot--pending');

    await waitFor(() => collectMock.mock.calls.length >= 1);
    release(makeRiver());
    await waitFor(() => !dot.className.includes('pending'));
    expect(dot.className).toMatch(/bz-home-dot--(off|ok|warn|hot)/); // 节点没换，就地换上真彩点
  });

  it('自定义入口顺序：壳按真顺序铺，慢数据不整屏重排', async () => {
    const vault = new MockVault();
    // 自定义顺序要写完整一份（applyOrder 只给列出项定位次，其余按默认序补）
    const custom = ['memo', ...DOMAINS.filter((d) => d.id !== 'memo').map((d) => d.id)];
    vault.files.set('CONFIG/STORAGE/home.json', JSON.stringify({
      version: 3, desk: custom, mob: custom, hiddenDesk: [], hiddenMob: [],
    }));
    const app = appOf(vault);
    const loaded = await loadHomeOrder(app); // 预热那一步：把顺序读进同步缓存
    expect(loaded.desk).toEqual(custom);
    openHome(app);
    const overlay = q('.bz-home-overlay');
    const shellRow = overlay.querySelector('[data-home-entries] .bz-home-erow') as HTMLElement;
    expect(shellRow.dataset.homeGo).toBe('memo'); // 壳就是用户自己的顺序，不是默认序

    await waitFor(() => H.river !== null);
    expect(overlay.querySelector('[data-home-entries] .bz-home-erow')).toBe(shellRow);
    expect((overlay.querySelector('[data-home-entries] .bz-home-erow') as HTMLElement).dataset.homeGo).toBe('memo');
  });

  it('收起面板时慢数据才落地：重开补画河面', async () => {
    let release!: (v: RiverData) => void;
    collectMock.mockImplementation(() => new Promise<RiverData>((res) => { release = res; }));
    const app = appOf();
    openHome(app);
    const overlay = q('.bz-home-overlay');
    await waitFor(() => collectMock.mock.calls.length >= 1);

    // 数据没到就收起（等价 closeOverlay 的隐藏态，但不走 240ms 退场动效）
    H.overlayVisible = false;
    overlay.style.display = 'none';
    release(makeRiver());
    await waitFor(() => !!overlay.querySelector('[data-home-flow] .bz-home-timeline'));
    expect(overlay.querySelector('.bz-home-timeline')!.classList.contains('has-river')).toBe(false);

    showOverlay();
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    expect(overlay.querySelector('.bz-home-timeline')!.classList.contains('has-river')).toBe(true);
  });

  it('壳与采集跨过零点：整屏重建，不让周历「今天」留在昨天', async () => {
    let release!: (v: RiverData) => void;
    collectMock.mockImplementation(() => new Promise<RiverData>((res) => { release = res; }));
    const app = appOf();
    openHome(app);
    const overlay = q('.bz-home-overlay');
    const shellRow = overlay.querySelector('[data-home-entries] .bz-home-erow');
    await waitFor(() => collectMock.mock.calls.length >= 1);

    const stale = makeRiver();
    stale.today = { ...stale.today, dateStr: '2000-01-01' }; // 与壳的今天不同天（跨零点）
    release(stale);
    await waitFor(() => H.river !== null);
    // 整屏重建而不是局部补画：入口行节点换新
    expect(overlay.querySelector('[data-home-entries] .bz-home-erow')).not.toBe(shellRow);
  });
});

describe('活动河缓存（发版 review 回归）', () => {
  it('采集途中数据又变：这轮作废并串行续采一次，不并排再跑一轮', async () => {
    const pending: Array<(v: RiverData) => void> = [];
    collectMock.mockImplementation(() => new Promise<RiverData>((res) => { pending.push(res); }));
    const app = appOf();

    const first = loadRiverCached(app);
    await tick();
    expect(pending.length).toBe(1);

    emitDomainEvent('memo', { kind: 'add' }); // 置脏
    const second = loadRiverCached(app);       // 共享在途：不新建
    await tick();
    expect(pending.length).toBe(1);

    pending[0](makeRiver());                    // 第 1 轮落地 → 结果丢弃、续采
    await tick();
    expect(pending.length).toBe(2);

    pending[1](makeRiver());
    await Promise.all([first, second]);
    expect(collectMock).toHaveBeenCalledTimes(2);
  });

  it('没有 requestIdleCallback 的宿主：预热让出启动那一拍（1.2 秒后才跑）', async () => {
    expect(typeof (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback).toBe('undefined');
    vi.useFakeTimers();
    try {
      const app = appOf();
      prewarmHome(app);
      expect(collectMock).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1300);
      await vi.runOnlyPendingTimersAsync();
      expect(collectMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
