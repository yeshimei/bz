// @vitest-environment jsdom
/**
 * 剪藏本（clipbook）· 生命周期收口可翻转钉死（review-deep clipbook-arch 测试缺口 3/6，随 A1/A7 立项）
 *
 * 【可配置期望约定】（写明以防无意识漂移，勿删用例）：
 * 两个开关钉死的是本批基线（master @ 92dba387，批 E 零源码改动）的「现状行为」。
 * 对应并行修复批：
 *   - OVERLAY_SWEEP_ON_UNLOAD   → 批 A（覆盖确认迁 flow-dialog / 路径单源 / 卸载收口，clipbook-arch A1）：
 *     unloadClipbook 收口 UP 主管理 / RSS 订阅管理 / 同名覆盖确认三类自建 body 级浮层；
 *   - UNSUBSCRIBE_ON_UNLOAD     → 批 A（同批，clipbook-arch A7）：registerAutoRefresh 四个
 *     clipping:file-* 订阅在 unloadClipbook 内逐个退订（+ setNewsFetchDoneListener 清槽），
 *     重复 open/unload 循环订阅不叠加。
 * 并行修复合并进 master 后，主线程把对应开关翻 true 即断言翻转为「必须」语义
 * （修复后行为成为契约）；开关值必须始终与被钉死的可观测行为一致。
 * 参考先例：tests/memo/flip-switches-fix-e.test.ts、tests/diary/wall-event-contract.test.ts。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { clearDomainEvents, emitDomainEvent } from '../../src/core/domain-bus';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { getNewsFilePath } from '../../src/clipbook/news-data';
import { readDataSourceState } from '../../src/clipbook/news-source-settings';
import { dataSourceGroupRows } from '../../src/clipbook/news-sources-group';
import type { SettingsRow } from '../../src/core/settings-schema';

/** 【期望配置】见文件头「可配置期望约定」：现状全部 false（钉旧基线行为），批 A 合并后翻转 */
const OVERLAY_SWEEP_ON_UNLOAD = false; // unloadClipbook 收口三类自建浮层（批 A，A1）
const UNSUBSCRIBE_ON_UNLOAD = false; // 域事件订阅随 unloadClipbook 退订（批 A，A7）

/** 旁路记录：域总线订阅表（真实总线委托 + 记账；T6 断言订阅叠加用） */
const mocks = vi.hoisted(() => ({
  reloadIfOpen: vi.fn(),
  subs: [] as Array<{ channel: string; off: () => void }>,
}));

vi.mock('../../src/clipbook/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/clipbook/ui')>();
  return { ...actual, reloadIfOpen: mocks.reloadIfOpen };
});
vi.mock('../../src/core/domain-bus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/domain-bus')>();
  return {
    ...actual,
    onDomainEvent: (((channel: string, handler: (e: unknown) => void) => {
      const off = actual.onDomainEvent(channel as never, handler as never);
      mocks.subs.push({ channel, off });
      return off;
    }) as typeof actual.onDomainEvent),
  };
});

const maskIds = ['bz-up-manager-mask', 'bz-up-manager-popup', 'bz-rss-manager-mask', 'bz-rss-manager-popup'] as const;

/** 弹窗行 onClick 的最小 ctx（本组 onClick 只用到 rowEl/refreshVisibility，review-fix-clip2 同款） */
const fakeCtx = () => ({ rowEl: document.createElement('div'), refreshVisibility: () => {} }) as any;
const rowByName = (rows: SettingsRow[], name: string) => rows.find((r) => (r as { name?: string }).name === name) as any;

function seedVault(over: Record<string, unknown> = {}): MockVault {
  const vault = new MockVault();
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles: [
        { platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', author: '果壳', date: '2026-09-01 08:00:00', body: '正文' },
      ],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: ['11'],
      bilibiliUpInfo: {},
      bilibiliMaxItems: 10,
      bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true, rss: true },
      rssFeeds: [{ url: 'https://a.com/rss.xml', title: 'A 源' }],
      // lastFetchAt 顶到未来：openClipbook 的 maybeFetchNews 间隔判定直接跳过（测试不触网）
      lastFetchAt: Date.now() + 24 * 60 * 60 * 1000,
      fetchIntervalMin: 360,
      ...over,
    })
  );
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

async function openPanelLoaded(): Promise<void> {
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBeGreaterThan(0));
}

beforeEach(() => {
  resetObsidianMocks();
  mocks.reloadIfOpen.mockClear();
  mocks.subs.length = 0;
  document.body.innerHTML = '';
});

afterEach(() => {
  // 现状基线下自建浮层不会被 unloadClipbook 收口：逐个点遮罩走自有 close（复位 C25 单例标志）
  for (const id of maskIds) {
    const el = document.getElementById(id) as HTMLElement | null;
    if (el) el.click();
  }
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  // 现状基线下域内订阅不随 unload 退订：跨用例清总线，防残留 handler 污染下一用例计数
  clearDomainEvents();
  document.body.innerHTML = '';
});

describe('T3 卸载弹窗残留（开关 OVERLAY_SWEEP_ON_UNLOAD，批 A / clipbook-arch A1）', () => {
  const expectSwept = (id: string) => {
    if (OVERLAY_SWEEP_ON_UNLOAD) {
      expect(document.getElementById(id), `【必须】卸载后 ${id} 应被收口`).toBeNull();
    } else {
      // 现状（钉死）：unloadClipbook 不认领自建浮层——遮罩/弹卡残留 body（禁用插件即死 UI）
      expect(document.getElementById(id), `【现状残留】${id} 仍在（批 A 合并后把开关翻 true）`).toBeTruthy();
    }
  };

  it('UP 主管理弹窗开着 → unloadClipbook：mask/popup 残留按开关钉死', async () => {
    seedVault();
    await openPanelLoaded();
    const rows = dataSourceGroupRows(await readDataSourceState());
    await rowByName(rows, 'UP 主名单').onClick(fakeCtx());
    await vi.waitFor(() => expect(document.getElementById('bz-up-manager-mask')).toBeTruthy());
    await vi.waitFor(() => expect(document.getElementById('bz-up-manager-popup')).toBeTruthy());

    unloadClipbook();
    expectSwept('bz-up-manager-mask');
    expectSwept('bz-up-manager-popup');
  });

  it('RSS 订阅管理弹窗开着 → unloadClipbook：mask/popup 残留按开关钉死', async () => {
    seedVault();
    await openPanelLoaded();
    const rows = dataSourceGroupRows(await readDataSourceState());
    await rowByName(rows, 'RSS 订阅源').onClick(fakeCtx());
    await vi.waitFor(() => expect(document.getElementById('bz-rss-manager-mask')).toBeTruthy());
    await vi.waitFor(() => expect(document.getElementById('bz-rss-manager-popup')).toBeTruthy());

    unloadClipbook();
    expectSwept('bz-rss-manager-mask');
    expectSwept('bz-rss-manager-popup');
  });
});

describe('T6 域事件退订闭环（开关 UNSUBSCRIBE_ON_UNLOAD，批 A / clipbook-arch A7）', () => {
  it('unloadClipbook 后 emit clipping:file-created：现状仍触发刷新路径（reloadIfOpen）；修复后必须不触发', async () => {
    seedVault();
    await openPanelLoaded();
    unloadClipbook();
    mocks.reloadIfOpen.mockClear();

    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/退订探针.md' });
    await new Promise((r) => setTimeout(r, 450)); // 越过 300ms 防抖窗

    if (UNSUBSCRIBE_ON_UNLOAD) {
      expect(mocks.reloadIfOpen).not.toHaveBeenCalled(); // 修复后（必须）：域内退订闭环
    } else {
      expect(mocks.reloadIfOpen).toHaveBeenCalledTimes(1); // 现状（钉死）：残留订阅仍触发刷新路径
    }
  });

  it('open/unload 循环 N 次：clipping:file-* 订阅数按开关钉死（现状叠加 / 修复后恒 4）', async () => {
    seedVault();
    const before = mocks.subs.filter((s) => s.channel.startsWith('clipping:file-')).length;
    for (let i = 0; i < 3; i++) {
      await openPanelLoaded();
      unloadClipbook();
    }
    const after = mocks.subs.filter((s) => s.channel.startsWith('clipping:file-')).length;
    const delta = after - before;
    if (UNSUBSCRIBE_ON_UNLOAD) {
      expect(delta).toBe(4); // 修复后（必须）：每轮 4 订阅、卸载即退订——循环不叠加
    } else {
      expect(delta).toBe(12); // 现状（钉死）：3 轮 × 4 全部滞留总线
    }
  });
});
