// @vitest-environment node
/**
 * 游戏架数据层测试（issue 368）：对账纯函数（buildSyncPlan 四分支 + 恢复在架）、
 * 文件名清洗与冲突消歧、Steam 响应归一（缺省/坏条目）、lastPlayed 与 tags 归并。
 */
import { describe, it, expect } from 'vitest';
import { buildSyncPlan, sanitizeFileName, notePathFor, lastPlayedStr, mergeTags, managedFm, GAME_TAG } from '../../src/gameshelf/reconcile';
import { parseOwnedGames, parseRecentGames, steamCoverUrl, isValidSteamId } from '../../src/gameshelf/steam';
import { isSyncDue, lastSyncedAt, AUTO_SYNC_INTERVAL_MS } from '../../src/gameshelf/sync';

const g = (appid: number, name: string, playtimeMin: number, lastPlayedTs = 0) => ({ appid, name, playtimeMin, lastPlayedTs });

describe('buildSyncPlan 对账（issue 368 核心机制）', () => {
  it('Steam 有库内无 → toCreate；两边都有且时长变 → toUpdate；一致 → unchanged', () => {
    const notes = [
      { path: '我的/游戏/《B》.md', appid: 2, playtimeMin: 100, offShelf: false },
      { path: '我的/游戏/《C》.md', appid: 3, playtimeMin: 50, offShelf: false },
    ];
    const plan = buildSyncPlan([g(1, 'A', 10), g(2, 'B', 100), g(3, 'C', 80)], notes);
    expect(plan.toCreate.map((x) => x.appid)).toEqual([1]);
    expect(plan.toUpdate.map((u) => u.game.appid)).toEqual([3]);
    expect(plan.unchanged).toBe(1);
    expect(plan.toOffShelf).toEqual([]);
  });

  it('Steam 消失的游戏 → toOffShelf 标记（笔记保留不删）；已标过的不重复进', () => {
    const notes = [
      { path: '我的/游戏/《A》.md', appid: 1, playtimeMin: 10, offShelf: false },
      { path: '我的/游戏/《Gone》.md', appid: 9, playtimeMin: 5, offShelf: true },
    ];
    const plan = buildSyncPlan([g(1, 'A', 10)], notes);
    expect(plan.toOffShelf).toEqual([]); // 9 已是 offShelf，不重复
    const plan2 = buildSyncPlan([g(1, 'A', 10)], [notes[0], { ...notes[1], offShelf: false }]);
    expect(plan2.toOffShelf.map((n) => n.appid)).toEqual([9]);
  });

  it('offShelf 游戏重新出现 → 归入 toUpdate（恢复在架），不算 unchanged', () => {
    const plan = buildSyncPlan([g(1, 'A', 10)], [{ path: 'p', appid: 1, playtimeMin: 10, offShelf: true }]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.unchanged).toBe(0);
  });

  it('playtimeMin 未知（null）→ 视为变化走 toUpdate；Steam 侧重复 appid 首见优先', () => {
    const plan = buildSyncPlan([g(1, 'A', 10)], [{ path: 'p', appid: 1, playtimeMin: null, offShelf: false }]);
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
    const game = { appid: 42, name: 'POOLS', playtimeMin: 0, lastPlayedTs: 0 };
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

  it('managedFm：六管辖键齐全，cover 直拼 header.jpg', () => {
    const fm = managedFm(g(548430, 'Deep Rock Galactic', 65214, new Date(2026, 1, 24).getTime()), '2026-09-17T00:00:00Z');
    expect(fm).toMatchObject({
      appid: 548430,
      playtimeMin: 65214,
      lastPlayed: '2026-02-24',
      cover: steamCoverUrl(548430),
      syncedAt: '2026-09-17T00:00:00Z',
      offShelf: false,
    });
  });
});

describe('Steam 响应归一（真机实测形态，347-steam-live-test）', () => {
  it('parseOwnedGames：playtime_forever=分钟、rtime_last_played=秒×1000；空库 games 缺省 → []', () => {
    const raw = { response: { game_count: 2, games: [
      { appid: 548430, name: 'Deep Rock Galactic', playtime_forever: 65214, rtime_last_played: 1771948800 },
      { appid: 632360, name: 'Risk of Rain 2', playtime_forever: 36066 },
    ] } };
    const games = parseOwnedGames(raw);
    expect(games).toHaveLength(2);
    expect(games[0]).toMatchObject({ appid: 548430, playtimeMin: 65214 });
    expect(new Date(games[0].lastPlayedTs).getTime()).toBe(1771948800000);
    expect(games[1].lastPlayedTs).toBe(0);
    expect(parseOwnedGames({ response: {} })).toEqual([]);
    expect(parseOwnedGames(null)).toEqual([]);
  });

  it('parseOwnedGames：坏条目（无 appid）跳过；无名兜底 App <appid>', () => {
    const games = parseOwnedGames({ response: { games: [{ name: 'no id' }, { appid: 7 }] } });
    expect(games).toEqual([{ appid: 7, name: 'App 7', playtimeMin: 0, lastPlayedTs: 0 }]);
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
