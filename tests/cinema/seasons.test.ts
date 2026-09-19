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
import { cardHtml, pcardHtml, facePiecesHtml, seasonDotsHtml, seasonSegState, seriesStatus, seriesCountsText, seriesDetailModalHtml } from '../../src/cinema/shared';
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

describe('cinema 季圆点与合并卡 markup（D1 定稿形态）', () => {
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
    // 圆点带季键属性，故按 class 片段断言 + 独立校验左右顺序（左→右 = 季号升序）
    expect(dots).toContain('<i class="watched"');
    expect(dots).toContain('<i class="watching"');
    expect(dots).toContain('<i class="empty"');
    const order = ['class="watched"', 'class="watching"', 'class="empty"'].map((c) => dots.indexOf(c));
    expect(order).toEqual([...order].sort((x, y) => x - y));
    // 用户 2026-09-18 点名去掉「全 N 季已看」这类注释 → 卡面不再有任何文字，
    // 进度改由 aria-label 供读屏（可见文字里连「季」字都不该出现）
    expect(dots).not.toContain('bar-note');
    expect(dots).not.toContain('>全 ');
    expect(dots).toContain('aria-label="各季进度：共 3 季，已看 1、在看 1、未看 1"');
    // 全部已看 / 无在看季也不改口径（没有文字可改）
    const all = seasonDotsHtml([{ no: 1, item: watched }]);
    expect(all).toContain('aria-label="各季进度：共 1 季，已看 1、在看 0、未看 0"');
  });

  it('季圆点带条目键：悬浮换脸靠它回查那一季', () => {
    const dots = seasonDotsHtml([{ no: 1, item: watched }, { no: 2, item: watching }]);
    expect(dots).toContain('data-cinema-season-key="new:老友记 第一季"');
    expect(dots).toContain('data-cinema-season-key="new:老友记 第二季"');
  });

  it('正脸四件唯一出口（facePiecesHtml）：名字/评分可覆盖；海报按条目出图或首字占位', () => {
    const own = facePiecesHtml(item('犬屋敷', { year: '2017', director: '佐藤敬一', rating: 7.7 }), null);
    expect(own.poster).toBe('<div class="ph">犬</div>');
    expect(own.name).toBe('犬屋敷');
    expect(own.meta).toBe('2017 · 佐藤敬一');
    expect(own.stars).toContain('7.7');
    // 覆盖口径 = 合并卡正脸：名字写归一名称、评分取**最新已评季**（正脸季可能是在看不评分）
    const ov = facePiecesHtml(item('老友记 第三季', { year: '1996', rating: null }), 'res://p.jpg', { name: '老友记', rating: 9.2 });
    expect(ov.name).toBe('老友记');
    expect(ov.stars).toContain('9.2');
    expect(ov.poster).toContain('res://p.jpg');
    // 无年份无导演 → meta 空串（不留孤零零的分隔符）；无评分 → 未评分灰字
    const bare = facePiecesHtml(item('光杆'), null);
    expect(bare.meta).toBe('');
    expect(bare.stars).toContain('未评分');
  });

  it('合并卡：pcard-series + series: 键 + 季圆点在**海报区内**（左下角）+ 聚合角标', () => {
    const card = mergeSeasonCards([watched, watching, want], true)[0] as SeriesCard;
    const html = cardHtml(card, null);
    expect(html).toContain('class="pcard pcard-series"');
    expect(html).toContain('data-cinema-key="series:剧集:老友记"');
    expect(html).toContain('class="season-dots"');
    expect(html).toContain('>在看</span>'); // 聚合角标 = 在看
    expect(html).toContain('<div class="pname">老友记</div>');
    // 圆点与海报内芯是 .pw 内的**兄弟**：悬浮换脸只重写 .pw-face，圆点原地不动
    expect(html).toContain('<div class="pw"><div class="pw-face">');
    expect(html).not.toContain('pw-face"><span class="season-dots"');
    // 圆点必须落在 .pw 内、名字之前——挂在 .pw 之外会多占卡片高度（用户要的就是不占高度）
    const iDots = html.indexOf('season-dots');
    expect(iDots).toBeGreaterThan(html.indexOf('<div class="pw">'));
    expect(iDots).toBeLessThan(html.indexOf('<div class="pname">'));
    // 单条目卡（pcardHtml 老入口）行为不变：无季圆点、键仍是条目键
    const plain = pcardHtml(watched, null, true);
    expect(plain).not.toContain('season-dots');
    expect(plain).toContain('pw-fetch');
  });

  it('合并卡详情：片名带「共 N 季」+ 各季明细行（无分节标题、无操作提示）', () => {
    const card = mergeSeasonCards([watched, watching, want], true)[0] as SeriesCard;
    const html = seriesDetailModalHtml(card, () => null);
    expect(html).toContain('老友记<span class="dm-n">共 3 季</span>');
    expect(html.match(/class="s-row"/g)).toHaveLength(3);
    expect(html).toContain('data-cinema-season-key="new:老友记 第一季"');
    expect(html).toContain('9.2');
    expect(html).toContain('—'); // 想看季无评分
    // 合集上不落 找同类/编辑/删除（都是单季笔记级动作，ADR-0168）
    expect(html).not.toContain('dm-actions');
    // 2026-09-20 用户点名去掉：「各 季 明 细」小标题与「点某一季…」提示都不再出现，
    // 弹窗只留头部 + 行；没有特别篇时头部计数也不带「特别篇」
    expect(html).not.toContain('各 季 明 细');
    expect(html).not.toContain('dm-hint');
    expect(html).not.toContain('特 别 篇');
    expect(html).not.toContain('部电影');
  });
});

/**
 * 特别篇前缀并入（2026-09-20 用户拍板「只按前缀认」）：电影版 / 特别篇 / 外传按
 * 「<剧名>：<副标题>」的片名前缀并进同名剧集的合并卡，不占季号、不进季圆点；
 * 「之」刻意不作分隔符（复合词误合比漏合更伤）。
 */
describe('cinema 特别篇前缀并入（只按片名前缀认）', () => {
  const s1 = item('老友记 第一季', { watchDate: '2026-06-18', rating: 9.2, status: 2 });
  const s2 = item('老友记 第二季', { watchDate: '2026-08-18', rating: 0, status: 1 });
  const film = (name: string, opts: Partial<CinemaItem> = {}) =>
    item(name, { group: '电影', typeTag: '电影', ...opts });

  it('「剧名：副标题」并入（全角/半角冒号、空格都认），且不再单独出卡', () => {
    for (const name of ['老友记：重聚特辑', '老友记:重聚特辑', '老友记 重聚特辑']) {
      const sp = film(name, { watchDate: '2026-09-19', rating: 8.0, status: 2 });
      const cards = mergeSeasonCards([s1, sp, s2], true);
      expect(cards.map((c) => c.kind)).toEqual(['series']); // 特别篇不再出普通卡
      const series = cards[0] as SeriesCard;
      expect(series.specials.map((x) => x.name)).toEqual([name]);
      expect(series.seasons.map((x) => x.no)).toEqual([1, 2]); // 不占季号
    }
  });

  it('副标题不能为空、必须带分隔符：「老友记：」/「老友记重聚」都不算', () => {
    const bad = [film('老友记：'), film('老友记重聚'), film('老友记')];
    const cards = mergeSeasonCards([s1, s2, ...bad], true);
    expect((cards[0] as SeriesCard).specials).toEqual([]);
    expect(cards).toHaveLength(4); // 合集 + 3 张普通卡
  });

  it('分隔符不含「之」：「老友记之重聚特辑」保持普通卡（复合词误合比漏合更伤）', () => {
    const zhi = film('老友记之重聚特辑');
    const cards = mergeSeasonCards([s1, s2, zhi], true);
    expect((cards[0] as SeriesCard).specials).toEqual([]);
    expect(cards.map((c) => (c.kind === 'single' ? c.item.name : c.name))).toEqual(['老友记', '老友记之重聚特辑']);
  });

  it('孤立特别篇（库内无同名 ≥2 季剧集）照旧出普通卡——与「单季回退」同口径', () => {
    const lonely = [film('心灵猎人：重聚特辑'), item('心灵猎人 第一季')];
    expect(mergeSeasonCards(lonely, true).map((c) => c.kind)).toEqual(['single', 'single']);
  });

  it('剧集/动漫组里认不出季号的条目也能并入（「老友记 特别篇」）；认得出季号的归季路径', () => {
    const tag = item('老友记 特别篇', { group: '剧集' }); // 无「第X季」→ 走特别篇候选
    const dup = item('老友记 第1季', { group: '剧集' }); // 季号重复：被去重丢掉，但**不算**特别篇
    const cards = mergeSeasonCards([s1, dup, s2, tag], true);
    const series = cards[0] as SeriesCard;
    expect(series.specials.map((x) => x.name)).toEqual(['老友记 特别篇']);
    expect(series.seasons.map((x) => x.no)).toEqual([1, 2]);
    expect(cards).toHaveLength(1); // 重复季与特别篇都不出卡
  });

  it('最长 base 优先：同名更长的那张合并卡吃特别篇', () => {
    const rm3 = item('瑞克和莫蒂 第三季');
    const rm4 = item('瑞克和莫蒂 第四季');
    const sp1 = item('瑞克和莫蒂 外传 第一季');
    const sp2 = item('瑞克和莫蒂 外传 第二季');
    const special = item('瑞克和莫蒂 外传：花絮', { group: '纪录片', typeTag: '纪录片' });
    const cards = mergeSeasonCards([rm3, special, sp1, sp2, rm4], true);
    const host = cards.find((c): c is SeriesCard => c.kind === 'series' && c.name === '瑞克和莫蒂 外传');
    const main = cards.find((c): c is SeriesCard => c.kind === 'series' && c.name === '瑞克和莫蒂');
    expect(host?.specials.map((x) => x.name)).toEqual(['瑞克和莫蒂 外传：花絮']);
    expect(main?.specials).toEqual([]);
    expect(cards).toHaveLength(2); // 两张合并卡，特别篇不单独出卡
  });

  it('评分与聚合状态都含特别篇（badge 读作「最近在追的那部」）', () => {
    const sp = film('老友记：重聚特辑', { watchDate: '2026-09-19', rating: 8.6, status: 2 });
    const series = mergeSeasonCards([s1, s2, sp], true)[0] as SeriesCard;
    expect(series.rating).toBe(8.6); // 最新已评 = 特别篇（第一季 9.2 更早；第二季在看 0 分不算）
    // 聚合含特别篇：在看季仍压得住已看特别篇
    expect(seriesStatus(series.seasons, series.specials)).toBe(1);
    // 特别篇是唯一「想看」的那条 → 聚合变想看（不含特别篇时会是「全已看」）
    const wantSp = film('老友记：重聚特辑', { status: 0 });
    const s = mergeSeasonCards([s1, { ...s1, name: '老友记 第二季' }, wantSp], true)[0] as SeriesCard;
    expect(seriesStatus(s.seasons)).toBe(2); // 只看季：全已看
    expect(seriesStatus(s.seasons, s.specials)).toBe(0); // 带上特别篇：想看
  });

  it('关闭合并：特别篇与各季一一对应出卡，顺序不变', () => {
    const sp = film('老友记：重聚特辑', { watchDate: '2026-09-19' });
    const cards = mergeSeasonCards([s1, sp, s2], false);
    expect(cards.map((c) => cardFace(c).name)).toEqual(['老友记 第一季', '老友记：重聚特辑', '老友记 第二季']);
  });

  it('头部计数按并入条目的类型分组（同类合并、异类分列；空类型回落组）', () => {
    const spFilm = film('老友记：重聚特辑');
    const spFilm2 = film('老友记：日本版');
    const spDoc = film('老友记 幕后纪录片', { group: '纪录片', typeTag: '纪录片' });
    const series = mergeSeasonCards([s1, s2, spFilm, spFilm2, spDoc], true)[0] as SeriesCard;
    expect(seriesCountsText(series)).toBe('共 2 季 · 2 部电影 · 1 部纪录片');
    // 没并入条目 → 只有季数
    const none = mergeSeasonCards([s1, s2], true)[0] as SeriesCard;
    expect(seriesCountsText(none)).toBe('共 2 季');
    // 类型为空 → 用所属组兜底
    const bare = mergeSeasonCards([s1, s2, film('老友记 番外', { typeTag: '' })], true)[0] as SeriesCard;
    expect(seriesCountsText(bare)).toBe('共 2 季 · 1 部电影');
  });

  it('季圆点只算季（特别篇不进圆点）；弹窗里特别篇顺在季后面，不分区段', () => {
    const sp1 = film('老友记：重聚特辑', { watchDate: '2026-09-19', rating: 8.6, status: 2 });
    const sp2 = film('老友记 演唱会', { watchDate: null, rating: null, status: 0 });
    const series = mergeSeasonCards([s1, sp1, sp2, s2], true)[0] as SeriesCard;
    // 卡面：本组 2 季 → 2 个圆点，特别篇一个都不算
    const html = cardHtml(series, null);
    expect(html.match(/class="(watched|watching|empty)" data-cinema-season-key/g)).toHaveLength(2);

    const modal = seriesDetailModalHtml(series, () => null);
    expect(modal).toContain('老友记<span class="dm-n">共 2 季 · 2 部电影</span>');
    expect(modal.match(/class="s-row s-row-special"/g)).toHaveLength(2);
    // 不分节：行序 = 季在前（季号升序）→ 特别篇顺其后；小标题/提示一律不出现
    const keys = [...modal.matchAll(/data-cinema-season-key="([^"]+)"/g)].map((m) => m[1]);
    expect(keys).toEqual([
      'new:老友记 第一季', 'new:老友记 第二季', 'new:老友记：重聚特辑', 'new:老友记 演唱会',
    ]);
    expect(modal).not.toContain('特 别 篇');
    expect(modal).not.toContain('各 季 明 细');
    expect(modal).not.toContain('dm-hint');
    // 特别篇行标出组（看着不像「某一季」），季行不标（与卡片同组，本就是同一部剧）
    expect(modal).toContain('<div class="s-sub">电影 · 观影 2026-09-19</div>');
    expect(modal).toContain('<div class="s-sub">观影 2026-06-18</div>');
  });
});
