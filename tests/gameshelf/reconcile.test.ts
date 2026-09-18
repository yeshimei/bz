// @vitest-environment node
/**
 * 游戏库数据层测试（issue 368）：对账纯函数（buildSyncPlan 四分支 + 恢复在架）、
 * 文件名清洗与冲突消歧、Steam 响应归一（缺省/坏条目）、lastPlayed 与 tags 归并。
 */
import { describe, it, expect } from 'vitest';
import { buildSyncPlan, sanitizeFileName, notePathFor, lastPlayedStr, mergeTags, managedFm, migrateLegacyKeys, GAME_TAG } from '../../src/gameshelf/reconcile';
import { parseOwnedGames, parseRecentGames, steamCoverUrl, steamIconUrl, isValidSteamId, parseAchievementSummary, parseAchievementRows, achRowText, achRowFromText, parseStoreMeta, parseReviews, parseZhName, type AchievementRow } from '../../src/gameshelf/steam';
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
    // 回归钉（2026-09-17 真机「商店数据拉到了但解析不出 / 没有中文名」）：
    // 真实 Steam 的 appdetails 外层键是 **appid 字符串**，不是数组下标 0 —— 旧实现只认
    // `raw[0].data`，对象形态下恒 undefined，商店资料与中文名因此双双落空。
    const real = parseStoreMeta({ '548430': { success: true, data: {
      name: '深岩银河',
      developers: ['Ghost Ship Studios'],
      release_date: { date: '2020 年 5 月 13 日' },
    } } }, 548430)!;
    expect(real).toMatchObject({ name: '深岩银河', developers: 'Ghost Ship Studios', releaseDate: '2020 年 5 月 13 日' });
    // success:false = Steam 明确说查不到（下架/地区限制）→ 同样解析不出，但文案要区分
    expect(parseStoreMeta({ '548430': { success: false } }, 548430)).toBeNull();
    expect(parseZhName({ '548430': { success: true, data: { name: '深岩银河' } } }, 548430)).toBe('深岩银河');
    const r = parseReviews({ query_summary: { review_score_desc: '特别好评', total_reviews: 123456 } });
    expect(r).toMatchObject({ reviewDesc: '特别好评', reviewsTotal: 123456 });
    expect(parseReviews({}).reviewsTotal).toBeNull();
  });
});

describe('成就属性行（2026-09-18 全量落盘）', () => {
  // 用**正午 UTC**的时间戳：本地时区换算后日期仍是 9-04（UTC-12 ~ UTC+11 都成立），
  // 断言不受跑测试的机器时区影响（`最后游玩` 同口径，走本地时区）
  const row = (over: Partial<AchievementRow> = {}): AchievementRow => ({
    apiName: 'APPROVED_GREENBEARD',
    name: '合格菜鸟',
    desc: '完成你的第一个战役任务。',
    hidden: false,
    unlocked: true,
    unlockedAt: '2021-09-04T12:00:00.000Z',
    globalPercent: 45,
    icon: 'https://cdn/on.jpg',
    iconGray: 'https://cdn/off.jpg',
    ...over,
  });

  it('序列化：6 段齐全，未解锁与未知全球率都写 `-`，全球率一位小数', () => {
    expect(achRowText(row())).toBe('合格菜鸟 | 完成你的第一个战役任务。 | 1 | 2021-09-04 | 45.0 | APPROVED_GREENBEARD');
    expect(achRowText(row({ unlocked: false, unlockedAt: null, globalPercent: null, desc: '' })))
      .toBe('合格菜鸟 |  | 0 | - | - | APPROVED_GREENBEARD');
  });

  it('往返：序列化 → 反解字段一致，空描述不丢段', () => {
    const back = achRowFromText(achRowText(row()))!;
    expect(back).toMatchObject({ name: '合格菜鸟', desc: '完成你的第一个战役任务。', unlocked: true, date: '2021-09-04', percent: 45, apiName: 'APPROVED_GREENBEARD' });
    const empty = achRowFromText(achRowText(row({ desc: '', unlocked: false, unlockedAt: null, globalPercent: null })))!;
    expect(empty).toMatchObject({ desc: '', unlocked: false, date: '', percent: null, apiName: 'APPROVED_GREENBEARD' });
  });

  it('竖线净化：文案带 `|` 也不会切错段（格式契约不能靠「真实数据没出现」活着）', () => {
    const t = achRowText(row({ name: 'A|B', desc: '隔着 | 的说明' }));
    expect(t).toBe('A¦B | 隔着 ¦ 的说明 | 1 | 2021-09-04 | 45.0 | APPROVED_GREENBEARD');
    expect(achRowFromText(t)).toMatchObject({ name: 'A¦B', desc: '隔着 ¦ 的说明', apiName: 'APPROVED_GREENBEARD' });
  });

  it('换行折成空格：属性行是单行，不能把 YAML 列表撑成多行', () => {
    expect(achRowText(row({ desc: '第一行\n第二行' }))).toContain('第一行 第二行');
  });

  it('坏行跳过：段数不足 / 无 apiname → null，不把整段渲染带崩', () => {
    expect(achRowFromText('只有一段')).toBeNull();
    expect(achRowFromText('a | b | 1 | - | - | ')).toBeNull();
  });

  it('双色图标：Schema 的 icon 与 icongray 都读进来（缺 icongray → null）', () => {
    const schema = { game: { availableGameStats: { achievements: [
      { name: 'A1', displayName: '中文名', description: '中文描述', icon: 'https://cdn/on.jpg', icongray: 'https://cdn/off.jpg' },
      { name: 'A2', displayName: '没灰图', icon: 'https://cdn/on2.jpg' },
    ] } } };
    const player = { playerstats: { achievements: [{ apiname: 'A1', achieved: 0 }, { apiname: 'A2', achieved: 0 }] } };
    const d = parseAchievementRows(schema, player)!;
    expect(d.rows.find((r) => r.apiName === 'A1')).toMatchObject({ name: '中文名', desc: '中文描述', icon: 'https://cdn/on.jpg', iconGray: 'https://cdn/off.jpg' });
    expect(d.rows.find((r) => r.apiName === 'A2')!.iconGray).toBeNull();
  });
});
