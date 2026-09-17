// @vitest-environment node
/**
 * 游戏架数据层测试（issue 368）：对账纯函数（buildSyncPlan 四分支 + 恢复在架）、
 * 文件名清洗与冲突消歧、Steam 响应归一（缺省/坏条目）、lastPlayed 与 tags 归并。
 */
import { describe, it, expect } from 'vitest';
import { buildSyncPlan, sanitizeFileName, notePathFor, lastPlayedStr, mergeTags, managedFm, migrateLegacyKeys, GAME_TAG } from '../../src/gameshelf/reconcile';
import { parseOwnedGames, parseRecentGames, steamCoverUrl, steamIconUrl, isValidSteamId, parseAchievementSummary, parseStoreMeta, parseReviews } from '../../src/gameshelf/steam';
import { isSyncDue, lastSyncedAt, AUTO_SYNC_INTERVAL_MS } from '../../src/gameshelf/sync';

const g = (appid: number, name: string, playtimeMin: number, lastPlayedTs = 0) => ({
  appid, name, playtimeMin, lastPlayedTs,
  iconUrl: steamIconUrl(appid, 'hash'),
  windowsMin: playtimeMin, macMin: 0, linuxMin: 0, deckMin: 0,
  hasAchievements: true,
});

describe('buildSyncPlan 对账（issue 368 核心机制）', () => {
  it('Steam 有库内无 → toCreate；两边都有且时长变 → toUpdate；一致 → unchanged', () => {
    const notes = [
      { path: '我的/游戏/《B》.md', appid: 2, playtimeMin: 100, offShelf: false, legacy: false },
      { path: '我的/游戏/《C》.md', appid: 3, playtimeMin: 50, offShelf: false, legacy: false },
    ];
    const plan = buildSyncPlan([g(1, 'A', 10), g(2, 'B', 100), g(3, 'C', 80)], notes);
    expect(plan.toCreate.map((x) => x.appid)).toEqual([1]);
    expect(plan.toUpdate.map((u) => u.game.appid)).toEqual([3]);
    expect(plan.unchanged).toBe(1);
    expect(plan.toOffShelf).toEqual([]);
  });

  it('Steam 消失的游戏 → toOffShelf 标记（笔记保留不删）；已标过的不重复进', () => {
    const notes = [
      { path: '我的/游戏/《A》.md', appid: 1, playtimeMin: 10, offShelf: false, legacy: false },
      { path: '我的/游戏/《Gone》.md', appid: 9, playtimeMin: 5, offShelf: true, legacy: false },
    ];
    const plan = buildSyncPlan([g(1, 'A', 10)], notes);
    expect(plan.toOffShelf).toEqual([]); // 9 已是 offShelf，不重复
    const plan2 = buildSyncPlan([g(1, 'A', 10)], [notes[0], { ...notes[1], offShelf: false, legacy: false }]);
    expect(plan2.toOffShelf.map((n) => n.appid)).toEqual([9]);
  });

  it('offShelf 游戏重新出现 → 归入 toUpdate（恢复在架），不算 unchanged', () => {
    const plan = buildSyncPlan([g(1, 'A', 10)], [{ path: 'p', appid: 1, playtimeMin: 10, offShelf: true, legacy: false }]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.unchanged).toBe(0);
  });

  it('playtimeMin 未知（null）→ 视为变化走 toUpdate；Steam 侧重复 appid 首见优先', () => {
    const plan = buildSyncPlan([g(1, 'A', 10)], [{ path: 'p', appid: 1, playtimeMin: null, offShelf: false, legacy: false }]);
    expect(plan.toUpdate).toHaveLength(1);
    const dup = buildSyncPlan([g(1, 'First', 1), g(1, 'Second', 2)], []);
    expect(dup.toCreate).toHaveLength(1);
    expect(dup.toCreate[0].name).toBe('First');
  });
});

describe('文件名与 frontmatter 归一', () => {
  it('sanitizeFileName：Windows 非法字符替换为全角横线', () => {
    expect(sanitizeFileName('The Witcher 3: Wild Hunt')).toBe('The Witcher 3－ Wild Hunt');
    expect(sanitizeFileName('a<b>c"d?e*f|g')).toBe('a－b－c－d－e－f－g');
  });

  it('notePathFor：默认《名》.md；同名不同 appid 追加 appid 消歧', () => {
    const game = g(42, 'POOLS', 0);
    expect(notePathFor('我的/游戏', game, new Set())).toBe('我的/游戏/《POOLS》.md');
    expect(notePathFor('我的/游戏', game, new Set(['我的/游戏/《POOLS》.md']))).toBe('我的/游戏/《POOLS》 42.md');
  });

  it('lastPlayedStr：unix 秒→本地 YYYY-MM-DD；0/非法 → 空串', () => {
    expect(lastPlayedStr(new Date(2026, 1, 24, 15, 0).getTime())).toBe('2026-02-24');
    expect(lastPlayedStr(0)).toBe('');
    expect(lastPlayedStr(NaN)).toBe('');
  });

  it('mergeTags：保底 GAME_TAG；用户追加的 tag 保留且去重', () => {
    expect(mergeTags(undefined)).toEqual([GAME_TAG]);
    expect(mergeTags(['独立游戏', '游戏'])).toEqual(['独立游戏', '游戏']);
    expect(mergeTags('roguelike')).toEqual([GAME_TAG, 'roguelike']);
  });

  it('managedFm：中文管辖键齐全（媒体只写源键，本地路径由媒体队列写），直拼 URL', () => {
    const fm = managedFm(g(548430, 'Deep Rock Galactic', 65214, new Date(2026, 1, 24).getTime()), '2026-09-17T00:00:00Z');
    expect(fm).toMatchObject({
      AppID: 548430,
      游玩分钟: 65214,
      最后游玩: '2026-02-24',
      封面源: steamCoverUrl(548430),
      同步时间: '2026-09-17T00:00:00Z',
      已下架: false,
      图标源: steamIconUrl(548430, 'hash'),
      Windows分钟: 65214,
      SteamDeck分钟: 0,
      Mac分钟: 0,
      Linux分钟: 0,
      有成就: true,
    });
  });

  it('migrateLegacyKeys：旧英文键值搬中文键（中文键优先），返回是否迁移', () => {
    const fm: Record<string, unknown> = { appid: 1, playtimeMin: 60, offShelf: false, 自定义: '保留' };
    expect(migrateLegacyKeys(fm)).toBe(true);
    expect(fm).toMatchObject({ AppID: 1, 游玩分钟: 60, 已下架: false, 自定义: '保留' });
    expect('appid' in fm).toBe(false);
    expect('playtimeMin' in fm).toBe(false);
    const fm2: Record<string, unknown> = { AppID: 9 };
    expect(migrateLegacyKeys(fm2)).toBe(false); // 无旧键不迁移
  });
});

describe('Steam 响应归一（真机实测形态，347-steam-live-test）', () => {
  it('parseOwnedGames：playtime_forever=分钟、rtime_last_played=秒×1000、平台分项/图标/成就标记；空库 games 缺省 → []', () => {
    const raw = { response: { game_count: 2, games: [
      {
        appid: 548430, name: 'Deep Rock Galactic',
        playtime_forever: 65214, rtime_last_played: 1771948800,
        img_icon_url: 'abc123', playtime_windows_forever: 60000, playtime_deck_forever: 5000,
        has_community_visible_stats: true,
      },
      { appid: 632360, name: 'Risk of Rain 2', playtime_forever: 36066 },
    ] } };
    const games = parseOwnedGames(raw);
    expect(games).toHaveLength(2);
    expect(games[0]).toMatchObject({
      appid: 548430, playtimeMin: 65214, lastPlayedTs: 1771948800000,
      iconUrl: steamIconUrl(548430, 'abc123'), windowsMin: 60000, deckMin: 5000, hasAchievements: true,
    });
    expect(games[1].lastPlayedTs).toBe(0);
    expect(games[1].iconUrl).toBeNull();
    expect(games[1].hasAchievements).toBe(false);
    expect(parseOwnedGames({ response: {} })).toEqual([]);
    expect(parseOwnedGames(null)).toEqual([]);
  });

  it('parseOwnedGames：坏条目（无 appid）跳过；无名兜底 App <appid>', () => {
    const games = parseOwnedGames({ response: { games: [{ name: 'no id' }, { appid: 7 }] } });
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ appid: 7, name: 'App 7', playtimeMin: 0, lastPlayedTs: 0 });
  });

  it('parseRecentGames：近两周没玩 total_count=0 games 缺省 → []（真机实测边界）', () => {
    expect(parseRecentGames({ response: { total_count: 0 } })).toEqual([]);
    const games = parseRecentGames({ response: { total_count: 1, games: [{ appid: 1, name: 'A', playtime_2weeks: 90 }] } });
    expect(games).toEqual([{ appid: 1, name: 'A', playtime2weeksMin: 90 }]);
  });

  it('封面直拼与 SteamID64 校验', () => {
    expect(steamCoverUrl(548430)).toBe('https://cdn.cloudflare.steamstatic.com/steam/apps/548430/header.jpg');
    expect(isValidSteamId('76561198366147295')).toBe(true);
    expect(isValidSteamId('12345')).toBe(false);
    expect(isValidSteamId('')).toBe(false);
  });
});

describe('同步节律（间隔判定，仿 clipbook fetch）', () => {
  it('无 syncedAt → 必过期；超间隔 → 过期；未超 → 不拉', () => {
    expect(lastSyncedAt([])).toBe(0);
    const now = Date.now();
    expect(isSyncDue([], now)).toBe(true);
    expect(isSyncDue([new Date(now - AUTO_SYNC_INTERVAL_MS - 1).toISOString()], now)).toBe(true);
    expect(isSyncDue([new Date(now - 1000).toISOString()], now)).toBe(false);
    expect(lastSyncedAt(['bad-date', new Date(now).toISOString()])).toBe(now); // 非法串忽略取 max
  });
});

describe('中文化迁移与详情解析（2026-09-17 增补）', () => {
  it('buildSyncPlan：旧英文键笔记（legacy）→ 归入 toUpdate 顺带迁移，数值一致也算', () => {
    const plan = buildSyncPlan([g(1, 'A', 10)], [{ path: 'p', appid: 1, playtimeMin: 10, offShelf: false, legacy: true }]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.unchanged).toBe(0);
  });

  it('parseAchievementSummary：玩家解锁 × Schema 全局解锁率 → 稀有成就取最低', () => {
    const schema = { game: { availableGameStats: { achievements: [
      { name: 'ACH1', displayName: '初次挖掘', globalAchievement: { percent: 80 } },
      { name: 'ACH2', displayName: '全成就大佬', globalAchievement: { percent: 0.7 } },
      { name: 'ACH3', displayName: '未解锁的', globalAchievement: { percent: 0.1 } },
    ] } } };
    const player = { playerstats: { achievements: [
      { apiname: 'ACH1', achieved: 1 },
      { apiname: 'ACH2', achieved: 1 },
      { apiname: 'ACH3', achieved: 0 },
    ] } };
    const s = parseAchievementSummary(schema, player)!;
    expect(s).toMatchObject({ total: 3, unlocked: 2, rarestName: '全成就大佬', rarestPercent: 0.7 });
    expect(parseAchievementSummary({}, {})).toBeNull();
  });

  it('parseStoreMeta/parseReviews：类型/开发商/发行日期/简体中文 + 好评摘要', () => {
    const meta = parseStoreMeta([{ success: true, data: {
      genres: [{ description: '动作' }, { description: '独立' }],
      developers: ['Ghost Ship Studios'],
      release_date: { date: '2020 年 5 月 13 日' },
      supported_languages: '英语, 简体中文, 日语',
    } }])!;
    expect(meta).toMatchObject({ genres: '动作、独立', developers: 'Ghost Ship Studios', releaseDate: '2020 年 5 月 13 日', zhSupported: true });
    expect(parseStoreMeta([{}])).toBeNull();
    const r = parseReviews({ query_summary: { review_score_desc: '特别好评', total_reviews: 123456 } });
    expect(r).toMatchObject({ reviewDesc: '特别好评', reviewsTotal: 123456 });
    expect(parseReviews({}).reviewsTotal).toBeNull();
  });
});
