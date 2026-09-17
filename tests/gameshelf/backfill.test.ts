// @vitest-environment node
/**
 * 后台全量回填测试（backfill.ts）：商店资料 + 成就三键 → 笔记属性。
 * 幂等（有「详情时间」不入队）、写回内容、连错到上限即停。
 * 落盘只经 fileManager.processFrontMatter（upsertDetail），假 App 记录写入即可；
 * frontmatter 读取走 metadataCache（readDetailFm），假 file 用 __fm 带 frontmatter。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { BACKFILL_MAX_FAILURES, ensureBackfill, setBackfillInterval, unloadBackfill } from '../../src/gameshelf/backfill';
import { clearDetailCache } from '../../src/gameshelf/detail';
import { M, resetGameshelfState, type GameItem } from '../../src/gameshelf/state';

const CONFIG = { gameshelfSteamId: '76561198000000000', gameshelfSteamApiKey: 'KEY' };

function item(appid: number, name: string, hasAch = false, fm?: Record<string, unknown>): GameItem {
  return {
    file: { __fm: fm ?? null } as never, appid, name, zhName: null, playtimeMin: 0, lastPlayed: '',
    cover: null, coverSrc: null, icon: null, iconSrc: null,
    windowsMin: 0, deckMin: 0, macMin: 0, linuxMin: 0, hasAch, offShelf: false, syncedAt: null,
  };
}

/** 记录 frontmatter 写入的假 App（metadataCache 现场读 __fm） */
function recorder(sink: Record<string, unknown>[]): never {
  return {
    metadataCache: { getFileCache: (f: any) => (f?.__fm ? { frontmatter: f.__fm } : null) },
    fileManager: {
      processFrontMatter: async (_f: unknown, cb: (fm: Record<string, unknown>) => void) => {
        const fm: Record<string, unknown> = {};
        cb(fm);
        sink.push(fm);
      },
    },
  } as never;
}

/** appdetails（真实形状：外层键 = appid 字符串）+ appreviews + 成就三接口罐头 */
function mockSteamDetail(opts: { failStore?: boolean } = {}): string[] {
  const calls: string[] = [];
  (requestUrl as any).mockImplementation(async (o: { url: string }) => {
    const url = String(o.url);
    calls.push(url);
    const appid = /appids=(\d+)/.exec(url)?.[1] ?? '0';
    if (url.includes('/api/appdetails')) {
      if (opts.failStore) return { status: 200, json: { [appid]: { success: false } }, text: '' };
      return {
        status: 200,
        json: { [appid]: { success: true, data: {
          type: 'game', name: '深岩银河', developers: ['Ghost Ship Games'], publishers: ['Coffee Stain'],
          release_date: { date: '2020 年 5 月 13 日' }, supported_languages: '英语, 简体中文',
          platforms: { windows: true, mac: false, linux: false }, genres: [{ description: '动作' }],
          categories: [{ description: '单人' }], recommendations: { total: 303148 },
          price_overview: { final_formatted: 'HK$ 50.40', discount_percent: 0 },
          short_description: '多人合作第一人称射击。', screenshots: [{ path_full: 'https://cdn/x.jpg' }],
        } } },
        text: '',
      };
    }
    if (url.includes('/appreviews/')) return { status: 200, json: { query_summary: { review_score_desc: '特别好评', total_reviews: 36619, total_positive: 34365, total_negative: 2254 } }, text: '' };
    if (url.includes('GetSchemaForGame')) return { status: 200, json: { game: { availableGameStats: { achievements: [{ name: 'A1', displayName: '首发日', icon: '' }, { name: 'A2', displayName: '一周目', icon: '' }] } } }, text: '' };
    if (url.includes('GetPlayerAchievements')) return { status: 200, json: { playerstats: { achievements: [{ apiname: 'A1', achieved: 0, unlocktime: 0 }, { apiname: 'A2', achieved: 1, unlocktime: 1700000000 }] } }, text: '' };
    if (url.includes('GetGlobalAchievementPercentagesForApp')) return { status: 200, json: { achievementpercentages: { achievements: [{ name: 'A1', percent: 80 }, { name: 'A2', percent: 0.7 }] } }, text: '' };
    return { status: 200, json: {}, text: '' };
  });
  return calls;
}

beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => CONFIG as any);
  resetGameshelfState();
  clearDetailCache(); // 会话缓存跨用例残留会让「连败停」少算失败（命中缓存的款直接判成功）
  setBackfillInterval(0);
  unloadBackfill();
});

describe('后台全量回填（商店资料 + 成就三键 → 笔记属性）', () => {
  it('缺「详情时间」的条目逐款回填：资料全键 + 成就三键 + 幂等标记落盘', async () => {
    const calls = mockSteamDetail();
    const sink: Record<string, unknown>[] = [];
    M.items = [item(548430, 'Deep Rock Galactic', true)];
    ensureBackfill(recorder(sink), M.items);
    await vi.waitFor(() => expect(sink.some((s) => '详情时间' in s)).toBe(true));
    await vi.waitFor(() => expect(sink.some((s) => '成就总数' in s)).toBe(true));
    expect(calls.filter((u) => u.includes('/api/appdetails')).length).toBe(1);
    const storeFm = sink.find((s) => '详情时间' in s)!;
    expect(storeFm['类型']).toBe('动作');
    expect(storeFm['开发商']).toBe('Ghost Ship Games');
    expect(storeFm['简体中文支持']).toBe(true);
    expect(storeFm['好评数']).toBe(34365);
    const achFm = sink.find((s) => '成就总数' in s)!;
    expect(achFm['成就已解']).toBe(1);
    expect(achFm['成就总数']).toBe(2);
    // 稀有只挑「已解锁」里最稀有的：A1（80%）没解，A2（0.7%）解了 → 一周目
    expect(String(achFm['稀有成就'])).toContain('一周目');
  });

  it('幂等：属性里已有「详情时间」→ 不发请求', async () => {
    const calls = mockSteamDetail();
    const sink: Record<string, unknown>[] = [];
    M.items = [item(1, 'A', false, { 详情时间: '2026-09-18T00:00:00.000Z' })];
    ensureBackfill(recorder(sink), M.items);
    await new Promise((r) => setTimeout(r, 40));
    expect(calls.length).toBe(0);
    expect(sink.length).toBe(0);
  });

  it('无成就页（hasAch=false）→ 只拉商店资料，不碰成就三接口', async () => {
    const calls = mockSteamDetail();
    const sink: Record<string, unknown>[] = [];
    M.items = [item(2, 'B', false)];
    ensureBackfill(recorder(sink), M.items);
    await vi.waitFor(() => expect(sink.some((s) => '详情时间' in s)).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.filter((u) => u.includes('GetSchemaForGame')).length).toBe(0);
  });

  it('商店连败到上限即停（success:false 按失败计，不把 147 款跑成雪崩）', async () => {
    const calls = mockSteamDetail({ failStore: true });
    const sink: Record<string, unknown>[] = [];
    M.items = [1, 2, 3, 4, 5, 6].map((n) => item(n, 'G' + n));
    ensureBackfill(recorder(sink), M.items);
    await vi.waitFor(() => expect(calls.filter((u) => u.includes('/api/appdetails')).length).toBe(BACKFILL_MAX_FAILURES), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 40));
    expect(calls.filter((u) => u.includes('/api/appdetails')).length).toBe(BACKFILL_MAX_FAILURES);
    expect(sink.length).toBe(0);
  });
});
