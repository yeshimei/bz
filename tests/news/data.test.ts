// @vitest-environment node
/**
 * 聚合讯数据层测试（ticket 124，ADR-0060）：news.json 四段迁移（纯数组→四段、旧 news-stats.json
 * 并入）、保留策略清理（未读不处理/已保存 3 天/已跳过 7 天/无 state 兜底）、uid/bvid 解析纯函数、
 * 保留天数归一化。
 */
import { describe, it, expect } from 'vitest';
import {
  wrapArrayToNewsData, parseNewsFileContent, mergeStatsInto, statsHasData,
  applyRetention, parseUidFromText, parseBvidFromText, normalizeRetentionDays,
  parseBilibiliUpInfo,
} from '../../src/news/data';

describe('news.json 四段结构', () => {
  it('wrapArrayToNewsData：旧纯数组包裹为四段（articles 原样，stats 默认，名单空，源全开）', () => {
    const data = wrapArrayToNewsData([{ title: 'A', url: 'u' }]);
    expect(data.articles).toEqual([{ title: 'A', url: 'u' }]);
    expect(data.bilibiliUps).toEqual([]);
    expect(data.sources).toEqual({ zhihu: true, guokr: true, bilibili: true });
    expect(data.stats.totalRead).toBe(0);
  });

  it('parseNewsFileContent：兼容旧纯数组 / 四段对象 / 空对象 / 非合法 JSON', () => {
    expect(parseNewsFileContent('[{"title":"A"}]')!.articles).toHaveLength(1);
    const four = parseNewsFileContent(
      JSON.stringify({
        articles: [{ title: 'A' }],
        stats: { totalRead: 3, totalSaved: 1, totalSkipped: 2, byPlatform: { x: 3 }, byDate: {} },
        bilibiliUps: ['546195', ' abc '],
        sources: { zhihu: false, guokr: true, bilibili: true },
      })
    )!;
    expect(four.articles).toHaveLength(1);
    expect(four.stats.totalRead).toBe(3);
    expect(four.bilibiliUps).toEqual(['546195', 'abc']); // 空白清理
    expect(four.sources.zhihu).toBe(false);
    // 空对象：articles 缺失 → 空数组，其余默认
    const empty = parseNewsFileContent('{}')!;
    expect(empty.articles).toEqual([]);
    expect(empty.sources.bilibili).toBe(true);
    // 损坏：null
    expect(parseNewsFileContent('{broken')).toBeNull();
  });

  it('bilibiliUpInfo 段（ticket 126）：解析 uid→{name?,avatar?}（头像转 https），缺失/损坏 → 空对象', () => {
    const parsed = parseNewsFileContent(
      JSON.stringify({
        articles: [],
        stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
        bilibiliUps: ['1'],
        sources: { zhihu: true, guokr: true, bilibili: true },
        bilibiliUpInfo: {
          '1': { name: '老番茄', avatar: 'http://i0.hdslb.com/bfs/face/a.jpg' },
          '2': 'bad',
          '3': { name: 'x' },
        },
      })
    )!;
    expect(parsed.bilibiliUpInfo).toEqual({
      '1': { name: '老番茄', avatar: 'https://i0.hdslb.com/bfs/face/a.jpg' }, // http → https
      '3': { name: 'x' },
    });
    // 段缺失 → 空对象；wrapArrayToNewsData（旧纯数组）→ 空对象
    expect(parseNewsFileContent('{"articles":[]}')!.bilibiliUpInfo).toEqual({});
    expect(wrapArrayToNewsData([]).bilibiliUpInfo).toEqual({});
    // 纯函数容错
    expect(parseBilibiliUpInfo(undefined)).toEqual({});
    expect(parseBilibiliUpInfo([])).toEqual({});
    expect(parseBilibiliUpInfo('bad')).toEqual({});
  });

  it('mergeStatsInto / statsHasData：仅 stats 段无真实数据时并入旧文件', () => {
    const base = wrapArrayToNewsData([]);
    expect(statsHasData(base.stats)).toBe(false);
    const merged = mergeStatsInto(base, { totalRead: 7, totalSaved: 2, totalSkipped: 5, byPlatform: { a: 1 }, byDate: { d: 2 } });
    expect(merged.stats.totalRead).toBe(7);
    expect(merged.stats.byPlatform['a']).toBe(1);
    expect(statsHasData(merged.stats)).toBe(true);
    // 已有数据不覆盖
    const already = wrapArrayToNewsData([]);
    already.stats.totalRead = 9;
    expect(mergeStatsInto(already, { totalRead: 100 }).stats.totalRead).toBe(9);
    // 旧文件损坏（非对象）忽略
    expect(mergeStatsInto(wrapArrayToNewsData([]), 'bad').stats.totalRead).toBe(0);
  });
});

describe('保留策略清理（applyRetention）', () => {
  const NOW = new Date('2026-08-27T00:00:00Z').getTime();
  const DAY = 24 * 60 * 60 * 1000;
  const mk = (extra: any = {}) => ({
    title: 'T', url: 'u', platform: 'B站', date: '2026-08-20 10:00:00',
    fetchedAt: '2026-08-20 10:00:00', ...extra,
  });

  it('未读（read 非 true）永不清理，无论多旧', () => {
    const old = mk({ fetchedAt: '2020-01-01 00:00:00' });
    const kept = applyRetention([old], 3, 7, NOW);
    expect(kept).toHaveLength(1);
  });

  it('已保存骨架（state=saved）超 savedDays 删除；未超保留', () => {
    const fresh = mk({ read: true, state: 'saved', fetchedAt: new Date(NOW - DAY).toISOString().substring(0, 19) });
    const aged = mk({ read: true, state: 'saved', fetchedAt: new Date(NOW - 4 * DAY).toISOString().substring(0, 19) });
    const kept = applyRetention([fresh, aged, mk({ read: true, state: 'saved', fetchedAt: '2026-08-20 10:00:00' })], 3, 7, NOW);
    expect(kept).toHaveLength(1); // 只有 1 天内那份
  });

  it('已跳过（state=skipped）超 skippedDays 删除；旧数据无 state 按 skipped 档（保守 7 天）', () => {
    const skippedAged = mk({ title: 'SKIP_AGED', read: true, state: 'skipped', fetchedAt: new Date(NOW - 8 * DAY).toISOString().substring(0, 19) });
    const noStateFresh = mk({ title: 'FRESH', read: true, fetchedAt: new Date(NOW - 5 * DAY).toISOString().substring(0, 19) }); // 无 state → skipped 档，5<7 保留
    const noStateAged = mk({ title: 'AGED', read: true, fetchedAt: new Date(NOW - 9 * DAY).toISOString().substring(0, 19) }); // 无 state → 9>7 删
    const kept = applyRetention([skippedAged, noStateFresh, noStateAged], 3, 7, NOW);
    expect(kept.map((a) => a.title)).toEqual(['FRESH']);
  });

  it('上次清理：正常数据 assemble（避免前例残留断言混淆）', () => {
    const list = [
      mk({ read: true, state: 'saved', title: 'SAVED_FRESH', fetchedAt: new Date(NOW - DAY).toISOString().substring(0, 19) }),
      mk({ read: true, title: 'NOSKIP_FRESH', fetchedAt: new Date(NOW - 5 * DAY).toISOString().substring(0, 19) }),
      mk({ read: true, state: 'skipped', title: 'SKIP_AGED', fetchedAt: new Date(NOW - 8 * DAY).toISOString().substring(0, 19) }),
      { title: 'NO_DATE', read: true, url: 'u2' }, // 无 fetchedAt/date → 保守保留
    ];
    const kept = applyRetention(list, 3, 7, NOW);
    expect(kept.map((a) => a.title)).toEqual(['SAVED_FRESH', 'NOSKIP_FRESH', 'NO_DATE']);
  });

  it('保留天数非法（≤0/NaN）→ 不清理（防御）', () => {
    const aged = mk({ read: true, state: 'saved', fetchedAt: new Date(NOW - 30 * DAY).toISOString().substring(0, 19) });
    expect(applyRetention([aged], 0, 7, NOW)).toHaveLength(1);
    expect(applyRetention([aged], NaN, 7, NOW)).toHaveLength(1);
  });
});

describe('UP 主 uid / bvid 解析（纯函数）', () => {
  it('parseUidFromText：纯数字 / 主页链接（协议/尾斜杠/参数变体）', () => {
    expect(parseUidFromText('546195')).toBe('546195');
    expect(parseUidFromText('https://space.bilibili.com/546195')).toBe('546195');
    expect(parseUidFromText('space.bilibili.com/546195/')).toBe('546195');
    expect(parseUidFromText('https://space.bilibili.com/546195?spm_id_from=333.999')).toBe('546195');
    expect(parseUidFromText('不是链接')).toBeNull();
    expect(parseUidFromText('')).toBeNull();
  });

  it('parseBvidFromText：视频链接提取 bvid；主页/垃圾返回 null', () => {
    expect(parseBvidFromText('https://www.bilibili.com/video/BV1q28V6VEYU')).toBe('BV1q28V6VEYU');
    expect(parseBvidFromText('bilibili.com/video/BV1xx?p=2')).toBe('BV1xx');
    expect(parseBvidFromText('https://space.bilibili.com/546195')).toBeNull();
  });

  it('normalizeRetentionDays：数字字符串归一化；非法返回 null', () => {
    expect(normalizeRetentionDays('3')).toBe(3);
    expect(normalizeRetentionDays(' 7 ')).toBe(7);
    expect(normalizeRetentionDays('abc')).toBeNull();
    expect(normalizeRetentionDays('')).toBeNull();
    expect(normalizeRetentionDays('-1')).toBeNull();
    expect(normalizeRetentionDays('0')).toBeNull();
  });
});