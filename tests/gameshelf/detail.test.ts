// @vitest-environment node
/**
 * 详情属性读写测试（2026-09-18「全量落盘」用户拍板）：
 * - 成就全量列表的序列化/反序列化（行序、解锁态、全球率、日期格式）；
 * - 截图两数组（`截图源` 远端 / `截图` 本地）的写入与对齐；
 * - 新鲜度判定（成就 24h / 商店 14d）；
 * - 商店写入**绝不碰**本地键（否则每次同步都会把本地路径冲回远端）。
 */
import { describe, it, expect } from 'vitest';
import {
  ACH_STALE_MS, STORE_STALE_MS, achRefreshDue, achToFm, fmToAchDetail, fmToAchSummary, fmToShots,
  hasStoreFm, storeRefreshDue, storeToFm,
} from '../../src/gameshelf/detail';
import { parseAchievementRows, parseStoreMeta } from '../../src/gameshelf/steam';

/** 两款成就：A1 已解锁且常见，A2 未解锁且稀有（用于钉行序与「稀有只挑已解锁」） */
function detail() {
  return parseAchievementRows(
    { game: { availableGameStats: { achievements: [
      { name: 'A1', displayName: '初次挖掘', description: '挖一下', icon: 'https://i/1.jpg', icongray: 'https://i/1g.jpg' },
      { name: 'A2', displayName: '全成就大佬', description: '全拿到' },
    ] } } },
    { playerstats: { achievements: [
      { apiname: 'A1', achieved: 1, unlocktime: 1693890347 },
      { apiname: 'A2', achieved: 0 },
    ] } },
    { achievementpercentages: { achievements: [{ name: 'A1', percent: 42.5 }, { name: 'A2', percent: 0.4 }] } },
  )!;
}

describe('成就全量落盘', () => {
  it('写入 → 读回：行序、解锁态、全球率、稀有成就都还原', () => {
    const fm = achToFm(detail());
    const lines = fm['成就'] as string[];
    expect(lines).toHaveLength(2);
    // 行按稀有度升序（0.4% 在前），且已解锁的日期是真日期
    expect(lines[0]).toContain('全成就大佬');
    expect(lines[0]).toContain('0.4');
    expect(lines[1]).toContain('初次挖掘');
    // 日期只钉格式不钉具体值：落盘走本地时区，同一时间戳在不同机器上可能差一天
    expect(lines[1]).toMatch(/\| \d{4}-\d{2}-\d{2} \|/);
    expect(fm['成就已解']).toBe(1);
    expect(fm['成就总数']).toBe(2);
    expect(String(fm['稀有成就'])).toContain('初次挖掘');
    expect(fm['成就更新']).toBeTruthy();

    const back = fmToAchDetail(fm)!;
    expect(back).toMatchObject({ total: 2, unlocked: 1, percent: 50, rarestName: '初次挖掘', rarestPercent: 42.5 });
    expect(back.rows.map((r) => r.name)).toEqual(['全成就大佬', '初次挖掘']);
    expect(back.rows.map((r) => r.unlocked)).toEqual([false, true]);
    expect(back.rows[0].unlockedAt).toBeNull();
    expect(back.rows[1].unlockedAt).toBeTruthy(); // 未解锁不编日期
  });

  it('没有 `成就` 列表 → null；只有三键的旧数据仍能出摘要', () => {
    expect(fmToAchDetail({})).toBeNull();
    expect(fmToAchDetail({ 成就: ['坏行', '也是坏行'] })).toBeNull();
    expect(fmToAchSummary({ 成就总数: 69, 成就已解: 30, 稀有成就: '硬核（全球 0.2% 拥有）' }))
      .toMatchObject({ total: 69, unlocked: 30, rare: '硬核（全球 0.2% 拥有）' });
    expect(fmToAchSummary({})).toBeNull();
  });

  it('坏行跳过而不是带崩整段：混一行手改坏的，其余照常渲染', () => {
    const fm = achToFm(detail());
    (fm['成就'] as string[]).splice(1, 0, '这行被手改坏了');
    const back = fmToAchDetail(fm)!;
    expect(back.total).toBe(2);
    expect(back.rows.map((r) => r.name)).toEqual(['全成就大佬', '初次挖掘']);
  });
});

describe('截图两数组', () => {
  it('写入只落 `截图源`，`截图`（本地）一个字都不碰', () => {
    const meta = parseStoreMeta({ '1': { success: true, data: {
      screenshots: [{ path_full: 'https://s/1.jpg' }, { path_full: 'https://s/2.jpg' }],
    } } }, 1)!;
    const fm = storeToFm({ ...meta, reviewDesc: null, reviewsTotal: null, reviewsPositive: null, reviewsNegative: null });
    expect(fm['截图源']).toEqual(['https://s/1.jpg', 'https://s/2.jpg']);
    expect(fm['截图更新']).toBeTruthy();
    expect(fm).not.toHaveProperty('截图');
  });

  it('没有截图 → 不写这两个键（避免空数组盖掉已有本地路径）', () => {
    const meta = parseStoreMeta({ '1': { success: true, data: { name: 'A' } } }, 1)!;
    const fm = storeToFm({ ...meta, reviewDesc: null, reviewsTotal: null, reviewsPositive: null, reviewsNegative: null });
    expect(fm).not.toHaveProperty('截图源');
    expect(fm).not.toHaveProperty('截图');
  });

  it('对齐：两数组长度取较长，缺位补空串（下标就是位置，不能压缩）', () => {
    expect(fmToShots({ 截图: ['a.jpg', '', 'c.jpg'], 截图源: ['r1', 'r2'] }))
      .toEqual({ local: ['a.jpg', '', 'c.jpg'], remote: ['r1', 'r2', ''] });
    expect(fmToShots({})).toEqual({ local: [], remote: [] });
  });
});

describe('新鲜度判定', () => {
  const now = Date.parse('2026-09-18T00:00:00.000Z');

  it('成就：没有全量列表 → 该拉；有但超 24h → 该拉；新鲜 → 不拉', () => {
    expect(achRefreshDue({}, now)).toBe(true);
    const fresh = achToFm(detail());
    expect(achRefreshDue(fresh, now)).toBe(false);
    const stale = { ...fresh, 成就更新: new Date(now - ACH_STALE_MS - 1000).toISOString() };
    expect(achRefreshDue(stale, now)).toBe(true);
    // `成就更新` 缺失/非法 → 当作过期（老数据要补时间戳）
    expect(achRefreshDue({ ...fresh, 成就更新: 'bad' }, now)).toBe(true);
  });

  it('商店：没有标量 → 该拉；超 14 天 → 该拉；新鲜 → 不拉', () => {
    expect(hasStoreFm({})).toBe(false);
    expect(storeRefreshDue({}, now)).toBe(true);
    const fresh = { 开发商: 'A', 详情时间: new Date(now - 1000).toISOString() };
    expect(storeRefreshDue(fresh, now)).toBe(false);
    expect(storeRefreshDue({ ...fresh, 详情时间: new Date(now - STORE_STALE_MS - 1000).toISOString() }, now)).toBe(true);
  });
});
