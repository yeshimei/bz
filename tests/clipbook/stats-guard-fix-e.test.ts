// @vitest-environment jsdom
/**
 * 剪藏本（clipbook）· T9 批量/撤销 stats 子段守卫（review-deep clipbook-arch 测试缺口 9，随 A10 立项）
 *
 * news.json stats 段是外部写入面（旧版守护/手改透传），部分形态真实可能。
 * 【可配置期望约定】（写明以防无意识漂移，勿删用例）：
 * 开关 STATS_BUCKET_GUARD 钉死的是本批基线（master @ 92dba387，批 E 零源码改动）的「现状行为」。
 * 对应并行修复批：
 *   - STATS_BUCKET_GUARD → 批 B（写失败透传 / 批量撤销 / stats 守卫 / anchor 游标，clipbook-arch A10）：
 *     flowMarkAllRead / flowUndoHandled 对缺 byPlatform/byDate 子段的 stats 补建桶（对齐 bumpStats 守卫）。
 * 并行修复合并进 master 后，主线程把开关翻 true 即断言翻转为「必须」语义
 * （不抛 + 补桶落盘成为契约）；开关值必须始终与被钉死的可观测行为一致。
 * 参考先例：tests/memo/flip-switches-fix-e.test.ts、tests/diary/wall-event-contract.test.ts。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { localDayKey } from '../../src/core/utils';
import { getNewsFilePath } from '../../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { flowMarkAllRead, flowUndoHandled } from '../../src/clipbook/flow';

/** 【期望配置】见文件头「可配置期望约定」：现状 false（钉旧基线行为），批 B 合并后翻转 */
const STATS_BUCKET_GUARD = true; // 批 B 已合并：stats 子桶守卫

const RAW = (over: Record<string, unknown> = {}) => ({
  platform: '果壳科学人',
  title: '守卫探针文',
  url: 'https://gk.com/guard-1',
  author: '果壳',
  body: '守卫探针正文。',
  date: '2026-09-01 08:00:00',
  ...over,
});

/** 种子 news.json（stats 段原样落盘——外部畸形形态透传口） */
function seedDisk(stats: unknown, articles: any[]): MockVault {
  const vault = new MockVault();
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles,
      stats,
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true }, rssFeeds: [], lastFetchAt: 0, fetchIntervalMin: 30,
    })
  );
  setApp(mockAppWithVault(vault));
  return vault;
}

const diskJson = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  document.body.innerHTML = '';
});

describe('T9 stats 子段守卫（开关 STATS_BUCKET_GUARD，批 B / clipbook-arch A10）', () => {
  it('flowMarkAllRead：stats 缺 byPlatform/byDate 时按开关钉死（现状 TypeError / 修复后补桶落盘）', async () => {
    const vault = seedDisk(
      { totalRead: 0 }, // 外部畸形 stats：只有计数、无分布子段
      [RAW({ url: 'https://gk.com/g-1', title: '批量甲' }), RAW({ url: 'https://gk.com/g-2', title: '批量乙' })]
    );

    if (STATS_BUCKET_GUARD) {
      // 修复后（必须）：补建桶守卫对齐 bumpStats——不抛且落盘
      await expect(flowMarkAllRead(diskJson(vault).articles)).resolves.toBeDefined(); // 批 B 返回 {bumped, snapshot}，此处只锁「不抛」
      await drainNewsWritesForTests();
      const disk = diskJson(vault);
      expect(disk.articles.every((a: any) => a.read === true)).toBe(true);
      expect(disk.stats.totalRead).toBe(2);
      expect(disk.stats.totalSkipped).toBe(2);
      expect(disk.stats.byPlatform).toBeTruthy(); // 补桶落盘
      expect(disk.stats.byPlatform['果壳科学人']).toBe(2);
      expect(disk.stats.byDate[localDayKey()]).toBe(2);
    } else {
      // 现状（钉死）：`s.byPlatform[platform]` 直取 → TypeError；批量动作整条静默失败（void 调用无反馈）
      await expect(flowMarkAllRead(diskJson(vault).articles)).rejects.toThrowError(TypeError);
      await drainNewsWritesForTests();
      const disk = diskJson(vault);
      expect(disk.articles.every((a: any) => a.read !== true)).toBe(true); // 未半写
      expect(disk.stats).toEqual({ totalRead: 0 }); // 盘上未被污染
    }
  });

  it('flowUndoHandled：stats 缺子段时按开关钉死（现状 TypeError / 修复后回退不抛）', async () => {
    const vault = seedDisk(
      { totalRead: 1, totalSaved: 0, totalSkipped: 1 }, // 缺 byPlatform/byDate
      [RAW({ read: true, state: 'skipped' })]
    );
    const rawBefore = { ...diskJson(vault).articles[0], read: undefined, state: undefined }; // C32 语义：rawBefore=「处理前」快照（read/state 未置）
    delete rawBefore.read;
    delete rawBefore.state;

    if (STATS_BUCKET_GUARD) {
      // 修复后（必须）：守卫在位——撤销不抛，统计回退 + 补桶
      await flowUndoHandled(rawBefore); // 返回值形态不锁（flowUndoHandled 无返回值），只锁「不抛」
      await drainNewsWritesForTests();
      const disk = diskJson(vault);
      expect(disk.articles[0].read).toBeUndefined();
      expect(disk.stats.totalRead).toBe(0);
      expect(disk.stats.byPlatform).toBeTruthy();
    } else {
      // 现状（钉死）：撤销分支 `s.byPlatform[platform]` 同样无守卫 → TypeError（unhandled rejection 无反馈）
      await expect(flowUndoHandled(rawBefore)).rejects.toThrowError(TypeError);
      await drainNewsWritesForTests();
      const disk = diskJson(vault);
      expect(disk.articles[0].read).toBe(true); // 未半写
    }
  });
});
