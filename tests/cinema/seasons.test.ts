// @vitest-environment node
/**
 * 影院剧集按季合并（issue 376 / ADR-0168）：名称归一 + 分组纯加工层，
 * 以及卡片形态（海报左下角季圆点，无注释文字）与合并卡详情弹窗的 markup 口径。
 *
 * 纯层无 DOM 依赖：seasons.ts 只 import 域内类型，shared.ts 的渲染件只 import
 * core/ui/str 与域内常量——本文件按 node 环境跑，刻意不引入 jsdom（跑得快、也顺带
 * 守住「这批函数不许碰 DOM」）。
 */
import { describe, it, expect } from 'vitest';
import {
  seasonNumber, parseSeasonName, seriesKeyOf, isSeriesKey,
  mergeSeasonCards, cardFace, cardGroup, type SeriesCard,
} from '../../src/cinema/seasons';
import { cardHtml, pcardHtml, seasonDotsHtml, seasonSegState, seriesStatus, seriesDetailModalHtml } from '../../src/cinema/shared';
import type { CinemaItem } from '../../src/cinema/state';

/** 造条目（字段默认值不参与本组断言） */
function item(name: string, opts: Partial<CinemaItem> = {}): CinemaItem {
  return {
    file: null, name, typeTag: '美剧', group: '剧集', watchDate: null, rating: null, status: 2,
    poster: null, review: null, genre: null, director: null, actors: null, region: null, year: null,
    doubanRating: null, doubanUrl: null, synopsis: null, duration: null, seasonText: null,
    ...opts,
  };
}

describe('cinema 季名归一（parseSeasonName / seasonNumber）', () => {
  it('中文数字与阿拉伯数字都认，0~99 之外不认', () => {
    expect(seasonNumber('一')).toBe(1);
    expect(seasonNumber('九')).toBe(9);
    expect(seasonNumber('十')).toBe(10);
    expect(seasonNumber('十一')).toBe(11);
    expect(seasonNumber('二十')).toBe(20);
    expect(seasonNumber('二十三')).toBe(23);
    expect(seasonNumber('3')).toBe(3);
    expect(seasonNumber('12')).toBe(12);
    expect(seasonNumber('百')).toBeNull();
    expect(seasonNumber('')).toBeNull();
  });

  it('「第X季」「Season N」都剥掉，且尾部分隔符一并清掉', () => {
    expect(parseSeasonName('老友记 第一季')).toEqual({ base: '老友记', season: 1 });
    expect(parseSeasonName('瑞克和莫蒂 第九季')).toEqual({ base: '瑞克和莫蒂', season: 9 });
    expect(parseSeasonName('老友记 - 第 2 季')).toEqual({ base: '老友记', season: 2 });
    expect(parseSeasonName('Friends Season 3')).toEqual({ base: 'Friends', season: 3 });
    expect(parseSeasonName('friends season 10')).toEqual({ base: 'friends', season: 10 });
  });

  it('无季标记 / 认不出的季号一律 null（不误合并）', () => {
    expect(parseSeasonName('奥本海默')).toBeNull();
    expect(parseSeasonName('24小时')).toBeNull(); // 片名里的数字不是季
    expect(parseSeasonName('第X季')).toBeNull();
    expect(parseSeasonName('老友记 第零季')).toBeNull(); // 季号必须 > 0
    expect(parseSeasonName('第一季')).toBeNull(); // 剥完没剩片名
  });

  it('稳定键前缀与条目键不相交（file.path / new:name 不会撞 series:）', () => {
    expect(seriesKeyOf('剧集', '老友记')).toBe('series:剧集:老友记');
    expect(isSeriesKey('series:剧集:老友记')).toBe(true);
    expect(isSeriesKey('我的/影视/《老友记 第一季》.md')).toBe(false);
    expect(isSeriesKey('new:奥本海默')).toBe(false);
    expect(isSeriesKey(undefined)).toBe(false);
  });
});

describe('cinema 按季分组合并（mergeSeasonCards）', () => {
  const s1 = item('老友记 第一季', { watchDate: '2026-06-18', rating: 9.2, status: 2 });
  const s2 = item('老友记 第二季', { watchDate: '2026-07-18', rating: 8.8, status: 2 });
  const s6 = item('老友记 第六季', { watchDate: '2026-08-18', rating: 0, status: 1 });
  const movie = item('奥本海默', { group: '电影', typeTag: '电影', watchDate: '2026-09-01', rating: 9.0 });

  it('关闭时与入参一一对应（恒 single），顺序不变', () => {
    const cards = mergeSeasonCards([s1, movie, s6], false);
    expect(cards.map((c) => c.kind)).toEqual(['single', 'single', 'single']);
    expect(cards.map((c) => cardFace(c).name)).toEqual(['老友记 第一季', '奥本海默', '老友记 第六季']);
  });

  it('开启时 ≥2 季合成一张，落位 = 该剧首季位置；单季条目照旧一卡', () => {
    const cards = mergeSeasonCards([s1, movie, s6], true);
    expect(cards.map((c) => c.kind)).toEqual(['series', 'single']);
    const series = cards[0] as SeriesCard;
    expect(series.key).toBe('series:剧集:老友记');
    expect(series.name).toBe('老友记');
    expect(series.group).toBe('剧集');
    expect(series.seasons.map((x) => x.no)).toEqual([1, 6]); // 季号升序
    expect((cards[1] as { item: CinemaItem }).item.name).toBe('奥本海默');
  });

  it('正脸 = 观影日期最新的一季；评分取最新已评季（在看季无分不顶掉评分）', () => {
    const series = mergeSeasonCards([s1, s2, s6], true)[0] as SeriesCard;
    expect(series.face.name).toBe('老友记 第六季'); // 08-18 最新
    expect(series.rating).toBe(8.8); // 第六季 0 分不算，故取第二季
    expect(cardFace(series).name).toBe('老友记 第六季');
    expect(cardGroup(series)).toBe('剧集');
  });

  it('组进合并键：同名剧集与动漫不互相吞并', () => {
    const a = item('X 第一季', { group: '剧集' });
    const b = item('X 第二季', { group: '动漫', typeTag: '日漫' });
    expect(mergeSeasonCards([a, b], true).map((c) => c.kind)).toEqual(['single', 'single']);
  });

  it('只有一部剧在库里时不动：单季不塞进合集，电影组不参与合并', () => {
    expect(mergeSeasonCards([item('心灵猎人 第一季')], true).map((c) => c.kind)).toEqual(['single']);
    const films = [item('X 第一季', { group: '电影', typeTag: '电影' }), item('X 第二季', { group: '电影', typeTag: '电影' })];
    expect(mergeSeasonCards(films, true).map((c) => c.kind)).toEqual(['single', 'single']);
  });

  it('同一季的两种写法（第一季 / 第1季）按季号去重，不足 2 季则不合并', () => {
    const dup = [item('X 第一季'), item('X 第1季')];
    expect(mergeSeasonCards(dup, true).map((c) => c.kind)).toEqual(['single', 'single']);
    // 去重后季号仍能凑够 2 季 → 正常合并为 2 段
    const cards = mergeSeasonCards([item('X 第一季'), item('X 第1季'), item('X 第二季')], true);
    expect(cards).toHaveLength(1);
    expect((cards[0] as SeriesCard).seasons.map((s) => s.no)).toEqual([1, 2]);
  });
});

describe('cinema 季进度条与合并卡 markup（D1）', () => {
  const watched = item('老友记 第一季', { status: 2, rating: 9.2 });
  const watching = item('老友记 第二季', { status: 1, rating: 0 });
  const want = item('老友记 第三季', { status: 0, rating: null });

  it('三态分类：已看 watched / 在看 watching / 想看·未看 empty', () => {
    expect(seasonSegState(watched)).toBe('watched');
    expect(seasonSegState(watching)).toBe('watching');
    expect(seasonSegState(want)).toBe('empty');
    // 演示数据兼容：status 可能是中文串
    expect(seasonSegState({ ...want, status: '想看' as unknown as number })).toBe('empty');
    expect(seasonSegState({ ...watched, status: '已看' as unknown as number })).toBe('watched');
  });

  it('聚合状态：任一看在 → 在看（盖过想看）；否则任一想看 → 想看；全已看 → 已看', () => {
    const slot = (it: CinemaItem) => ({ no: 1, item: it });
    expect(seriesStatus([slot(watched), slot(watching), slot(want)])).toBe(1);
    expect(seriesStatus([slot(watched), slot(want)])).toBe(0);
    expect(seriesStatus([slot(watched), slot({ ...watched, name: 'B' })])).toBe(2);
  });

  it('季圆点：一个圆点 = 一季，类名即状态；**不出任何可见注释文字**', () => {
    const dots = seasonDotsHtml([{ no: 1, item: watched }, { no: 2, item: watching }, { no: 3, item: want }]);
    expect(dots).toContain('class="season-dots"');
    expect(dots).toContain('<i class="watched"></i><i class="watching"></i><i class="empty"></i>');
    // 用户 2026-09-18 点名去掉「全 N 季已看」这类注释 → 卡面不再有任何文字，
    // 进度改由 aria-label 供读屏（可见文字里连「季」字都不该出现）
    expect(dots).not.toContain('bar-note');
    expect(dots).not.toContain('>全 ');
    expect(dots).toContain('aria-label="各季进度：共 3 季，已看 1、在看 1、未看 1"');
    // 全部已看 / 无在看季也不改口径（没有文字可改）
    const all = seasonDotsHtml([{ no: 1, item: watched }]);
    expect(all).toContain('aria-label="各季进度：共 1 季，已看 1、在看 0、未看 0"');
  });

  it('合并卡：pcard-series + series: 键 + 季圆点在**海报区内**（左下角）+ 聚合角标', () => {
    const card = mergeSeasonCards([watched, watching, want], true)[0] as SeriesCard;
    const html = cardHtml(card, null);
    expect(html).toContain('class="pcard pcard-series"');
    expect(html).toContain('data-cinema-key="series:剧集:老友记"');
    expect(html).toContain('class="season-dots"');
    expect(html).toContain('>在看</span>'); // 聚合角标 = 在看
    expect(html).toContain('<div class="pname">老友记</div>');
    // 圆点必须落在 .pw 内、名字之前——挂在 .pw 之外会多占卡片高度（用户要的就是不占高度）
    const iDots = html.indexOf('season-dots');
    expect(iDots).toBeGreaterThan(html.indexOf('<div class="pw">'));
    expect(iDots).toBeLessThan(html.indexOf('<div class="pname">'));
    // 单条目卡（pcardHtml 老入口）行为不变：无季圆点、键仍是条目键
    const plain = pcardHtml(watched, null, true);
    expect(plain).not.toContain('season-dots');
    expect(plain).toContain('pw-fetch');
  });

  it('合并卡详情：片名带「共 N 季」，各季明细行带条目键与状态/评分', () => {
    const card = mergeSeasonCards([watched, watching, want], true)[0] as SeriesCard;
    const html = seriesDetailModalHtml(card, () => null);
    expect(html).toContain('老友记<span class="dm-n">共 3 季</span>');
    expect(html).toContain('各 季 明 细');
    expect(html.match(/class="s-row"/g)).toHaveLength(3);
    expect(html).toContain('data-cinema-season-key="new:老友记 第一季"');
    expect(html).toContain('9.2');
    expect(html).toContain('—'); // 想看季无评分
    // 合集上不落 找同类/编辑/删除（都是单季笔记级动作，ADR-0168）
    expect(html).not.toContain('dm-actions');
  });
});
