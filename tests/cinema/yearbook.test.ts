/**
 * 观影志（cinema/yearbook）· 数据层 + 版式层 + 引擎契约
 *
 * 三件事各钉一层：
 *  1. 派生只认 frontmatter 真有的字段（片长/季集/评分的解析口径与缺值行为）；
 *  2. 版式 26 幕、骨架齐整、用户文本转义；
 *  3. 引擎「一滚一幕」+ 翻幕即激活 + stop 后不再响应（这几条是用户当场拍板的交互）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deriveYb, parseMinutes, parseEpisodes, humanMinutes, dayOf, YB_WEEK } from '../../src/cinema/yearbook/data';
import { yearbookHtml, YB_SCENES } from '../../src/cinema/yearbook/scenes';
import { bindYearbook } from '../../src/cinema/yearbook/engine';
import { STATUS_WATCHED, STATUS_WANT, STATUS_WATCHING } from '../../src/cinema/constants';
import type { CinemaItem } from '../../src/cinema/state';

/** 夹具：字段按真库口径写（片长「124分钟」/ 季集「13」/ 观影日期带不带时刻都有） */
function item(p: Partial<CinemaItem> & { name: string }): CinemaItem {
  return {
    file: null,
    name: p.name,
    typeTag: p.typeTag ?? '电影',
    group: p.group ?? '电影',
    watchDate: p.watchDate ?? null,
    rating: p.rating ?? null,
    status: p.status ?? STATUS_WATCHED,
    poster: p.poster ?? null,
    review: p.review ?? null,
    genre: p.genre ?? null,
    director: p.director ?? null,
    actors: p.actors ?? null,
    region: p.region ?? null,
    year: p.year ?? null,
    releaseDate: p.releaseDate ?? null,
    doubanRating: p.doubanRating ?? null,
    doubanUrl: p.doubanUrl ?? null,
    synopsis: p.synopsis ?? null,
    duration: p.duration ?? null,
    seasonText: p.seasonText ?? null,
    hotComment: p.hotComment ?? null,
  };
}

const FIXTURE: CinemaItem[] = [
  item({ name: '长片', watchDate: '2024-04-08', rating: 9.5, doubanRating: '8.5', duration: '124分钟', genre: '剧情 / 科幻', region: '美国 / 日本', director: '甲', actors: 'A / B', year: '2023', review: '喜欢这部片子的每一个镜头', hotComment: '这条短评够长了可以进弹幕' }),
  item({ name: '短片', watchDate: '2024-04-09', rating: 5, doubanRating: '8.6', duration: '4分钟', genre: '剧情', region: '美国', director: '甲', actors: 'B', year: '2020' }),
  item({ name: '老片', watchDate: '2024-04-10', rating: 3, doubanRating: '9.1', duration: '201分钟', genre: '动画', region: '日本', director: '乙', actors: 'C', year: '1915' }),
  item({ name: '剧集 第一季', watchDate: '2024-05-01', rating: 8, doubanRating: '7.9', duration: '45分钟/集', seasonText: '13', genre: '剧情', region: '中国大陆', director: '丙', actors: 'A', typeTag: '美剧', group: '美剧' }),
  item({ name: '剧集 第二季', watchDate: '2024-05-02', rating: 8.5, doubanRating: '8.1', duration: '45分钟/集', seasonText: '10X', genre: '剧情', region: '中国大陆', director: '丙', actors: 'A', typeTag: '美剧', group: '美剧' }),
  item({ name: '想看片', status: STATUS_WANT, rating: -1, watchDate: '2024-05-03', genre: '喜剧' }),
  item({ name: '在看片', status: STATUS_WATCHING, rating: 0, watchDate: '2024-05-04', genre: '喜剧' }),
  item({ name: '没片长', watchDate: '2024-06-01', rating: 7, genre: '喜剧', region: '法国' }),
];

describe('观影志 · 片长/季集解析（只认字段里真有的数）', () => {
  it('parseMinutes：分钟 / 分钟每集 / 小时分 / 纯数字 / 取不到给 null', () => {
    expect(parseMinutes('124分钟')).toBe(124);
    expect(parseMinutes('45分钟/集')).toBe(45);
    expect(parseMinutes('1小时30分')).toBe(90);
    expect(parseMinutes('90')).toBe(90);
    expect(parseMinutes('')).toBeNull();
    expect(parseMinutes(null)).toBeNull();
    expect(parseMinutes('未公开')).toBeNull();
  });

  it('parseEpisodes：数字与「622X」同取数；无值 null', () => {
    expect(parseEpisodes('13')).toBe(13);
    expect(parseEpisodes('622X')).toBe(622);
    expect(parseEpisodes('"11"')).toBe(11);
    expect(parseEpisodes(null)).toBeNull();
  });

  it('humanMinutes：天/小时/分钟三档', () => {
    expect(humanMinutes(61598)).toBe('42 天 18 小时');
    expect(humanMinutes(150)).toBe('2 小时 30 分');
    expect(humanMinutes(40)).toBe('40 分钟');
  });

  it('dayOf 只取日期位（观影日期有带时刻的）', () => {
    expect(dayOf(item({ name: 'x', watchDate: '2026-09-22 02:39:25' }))).toBe('2026-09-22');
    expect(dayOf(item({ name: 'x' }))).toBeNull();
  });
});

describe('观影志 · 派生（deriveYb）', () => {
  const d = deriveYb(FIXTURE);

  it('总量与类型分组只数真实条目（想看/在看不进已看统计）', () => {
    expect(d.total).toBe(8);
    expect(d.watchedCount).toBe(6);
    expect(d.wantCount).toBe(1);
    expect(d.watchingCount).toBe(1);
    expect(d.typeGroups.map((t) => `${t.name}:${t.films.length}`)).toEqual(['电影:6', '美剧:2']);
  });

  it('片长：合计/均值/分箱/两端，缺字段的条目不参与', () => {
    expect(d.minutes.length).toBe(5); // 没片长那条不算
    expect(d.totalMinutes).toBe(124 + 4 + 201 + 45 + 45);
    expect(d.longest?.name).toBe('老片');
    expect(d.longestMin).toBe(201);
    expect(d.shortest?.name).toBe('短片');
    expect(d.shortestMin).toBe(4);
    expect(d.bins.map((b) => b.films.length)).toEqual([3, 0, 0, 1, 1]); // ≤59（4/45/45） / 60-89 / 90-119 / 120-149（124） / ≥150（201）
  });

  it('时间：年份桶只收已看且有日期的；月份/星期/连续天数/单日之最', () => {
    expect(d.years.map((y) => `${y.y}:${y.films.length}`)).toEqual(['2024:6']);
    expect(d.months[3]).toBe(3); // 4 月
    expect(d.months[4]).toBe(2); // 5 月
    expect(d.months[5]).toBe(1); // 6 月
    expect(d.weekN.reduce((s, n) => s + n, 0)).toBe(6);
    expect(YB_WEEK[d.peakDay]).toMatch(/^周[一二三四五六日]$/);
    expect(d.busiest.date).toBe('2024-04-08');
    expect(d.busiest.films.length).toBe(1);
    expect(d.streak.days).toBe(3); // 04-08 / 04-09 / 04-10
    expect(d.streak.from).toBe('2024-04-08');
    expect(d.streak.to).toBe('2024-04-10');
    expect(d.spanDays).toBe(55); // 04-08 → 06-01（含首尾）
  });

  it('口味：类型/国家按「/」拆开计数，矩阵维度取前 6，早年上映年份进河流', () => {
    expect(d.genres.find((g) => g.name === '剧情')?.films.length).toBe(4);
    expect(d.regions.find((r) => r.name === '美国')?.films.length).toBe(2);
    expect(d.regions.find((r) => r.name === '日本')?.films.length).toBe(2);
    expect(d.matrix.max).toBeGreaterThan(0);
    expect(d.releaseYears[0].y).toBe(1915);
    expect(d.oldest?.name).toBe('老片');
    expect(d.ageBuckets.map((b) => b.films.length)).toEqual([0, 1, 1, 1]); // 当年 / 1-3 / 4-10 / ≥10
  });

  it('评分：直方 11 箱、均值、与豆瓣的差值、宝藏与失望、9 分以上', () => {
    expect(d.ratedCount).toBe(6);
    expect(d.myHist[10]).toBe(1); // 9.5 四舍五入进 10 分箱
    expect(d.myHist[9]).toBe(1); // 8.5 进 9 分箱
    expect(d.myHist[5]).toBe(1); // 5 → 箱 5
    expect(d.avgMine).toBeCloseTo((9.5 + 5 + 3 + 8 + 8.5 + 7) / 6, 5);
    expect(d.avgDb).toBeCloseTo((8.5 + 8.6 + 9.1 + 7.9 + 8.1) / 5, 5);
    expect(d.treasure.map((x) => x.name)).toContain('长片'); // 9.5 vs 8.5
    expect(d.disappoint.map((x) => x.name)).toContain('老片'); // 3 vs 9.1
    expect(d.nineUp.map((x) => x.name)).toEqual(['长片']);
    expect(d.top3[0].name).toBe('长片');
  });

  it('人：导演/演员按「/」拆、只留 ≥2 部；系列按「第X季」并；集数取同基名最大', () => {
    expect(d.directors.map((p) => p.name)).toContain('甲'); // 长片 + 短片
    expect(d.directors.every((p) => p.films.length >= 2)).toBe(true);
    expect(d.actors.find((p) => p.name === 'A')?.films.length).toBe(3);
    expect(d.series.map((s) => s.base)).toEqual(['剧集']);
    expect(d.series[0].films.length).toBe(2);
    expect(d.episodes[0].ep).toBe(13); // 同一剧名取追到的最多集
    expect(d.epItems).toBe(2); // 两部都有季集字段
    expect(d.epTotal).toBe(23); // 13 + 10：有值的条目相加（不是每组取最大）
  });

  it('文字：影评与短评各自成列表；空数据不炸', () => {
    expect(d.reviews.map((r) => r.name)).toContain('长片');
    expect(d.hotComments.map((c) => c.name)).toContain('长片');
    const empty = deriveYb([]);
    expect(empty.total).toBe(0);
    expect(empty.years).toEqual([]);
    expect(empty.totalMinutes).toBe(0);
    expect(empty.streak.days).toBe(0);
    expect(empty.matrix.max).toBe(1); // 除零保护
  });
});

describe('观影志 · 版式（26 幕共用一套骨架）', () => {
  const data = deriveYb(FIXTURE);
  const html = yearbookHtml(data, () => null);

  it('幕数 = YB_SCENES；每幕只有主构图（顶部/底部文字已去），幕名与口径留在 data-*', () => {
    expect(YB_SCENES.length).toBe(26);
    const scn = html.match(/class="bz-yb-scn"/g) ?? [];
    expect(scn.length).toBe(26);
    // 2026-09-22 用户拍板：每页顶部/底部的文字整段去掉，幕里只有主构图
    expect(html).not.toContain('class="yb-hd"');
    expect(html).not.toContain('class="yb-ft"');
    YB_SCENES.forEach((s) => {
      expect(html).toContain(`data-id="${s.id}"`);
      expect(html).toContain(`data-name="${s.name}"`);
    });
  });

  it('开卷不上任何 DOM 文字（标题与总数都由中间那团粒子画出来）', () => {
    const open = html.slice(html.indexOf('data-id="open"'), html.indexOf('data-id="years"'));
    expect(open).toContain('data-cv="open"');
    expect(open).not.toContain('观影志'); // 片名只在画布粒子里
    expect(open).not.toContain('部影视');
    expect(open).not.toContain('<h1');
    expect(open).not.toContain('<p');
  });

  it('固定层：刻度尺 26 格 + 底栏 + 自动按钮', () => {
    expect(html.match(/class="yb-rail-t"/g)?.length).toBe(26);
    expect(html).toContain('data-r="barI"');
    expect(html).toContain('data-r="pb"');
    // 底栏只留「幕号 / 幕名 / 进度 / 总数 / 自动」：重看钮随底栏文字一并去掉，
    // 回开卷走 Home 键或点第 1 格刻度（engine 里已无 again 分支）
    expect(html).toContain('data-r="barN"');
    expect(html).toContain('data-r="barLine"');
    expect(html).not.toContain('data-r="again"');
  });

  it('用户文本一律转义（片名/影评/短评/导演都不许漏标签进来）', () => {
    const nasty = deriveYb([
      item({ name: '<img src=x onerror=alert(1)>', watchDate: '2024-01-01', rating: 8, review: '<b>粗</b>', hotComment: '<script>alert(1)</script> 够长的短评', director: 'a<b>', genre: '<i>怪</i>', region: 'x&y', duration: '90分钟' }),
    ]);
    const out = yearbookHtml(nasty, () => null);
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).not.toContain('<img src=x');
    expect(out).not.toContain('<b>粗</b>');
    expect(out).toContain('&lt;b&gt;粗&lt;/b&gt;');
    expect(out).toContain('&amp;');
  });

  it('空库也能出片（幕数与骨架齐，不出现 undefined/NaN）', () => {
    const out = yearbookHtml(deriveYb([]), () => null);
    expect(out.match(/class="bz-yb-scn"/g)?.length).toBe(26);
    expect(out).not.toContain('undefined');
    expect(out).not.toContain('NaN');
  });

  it('海报位：有海报出 img，没有出散列色块（不留空框）', () => {
    const withPoster = yearbookHtml(deriveYb([item({ name: '有图', watchDate: '2024-01-01', rating: 8, poster: 'CONFIG/x.jpg' })]), () => 'app://x.jpg');
    expect(withPoster).toContain('<img');
    const noPoster = yearbookHtml(deriveYb([item({ name: '没图', watchDate: '2024-01-01', rating: 8 })]), () => null);
    expect(noPoster).toContain('class="yb-ph"');
  });
});

describe('观影志 · 引擎（一滚一幕 / 翻幕即激活 / stop 后安静）', () => {
  let ovl: HTMLElement;
  let sc: HTMLElement;
  let handle: { stop: () => void; goTo: (i: number, o?: { replay?: boolean }) => void } | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    // jsdom 没有 2d 上下文：画布取不到就跳过绘制（引擎按 null 处理）
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    ovl = document.createElement('div');
    ovl.className = 'bz-yb';
    ovl.innerHTML = `<div class="bz-yb-scroll">${yearbookHtml(deriveYb(FIXTURE), () => null)}</div>`;
    document.body.appendChild(ovl);
    sc = ovl.querySelector<HTMLElement>('.bz-yb-scroll')!;
  });

  const barI = (): string | null => ovl.querySelector('[data-r="barI"]')!.textContent;
  const railOn = (): number => Array.from(ovl.querySelectorAll('.yb-rail-t')).findIndex((el) => el.hasAttribute('data-on'));

  it('绑定即演第 1 幕：底栏 01、刻度尺第一格点亮', () => {
    handle = bindYearbook(ovl, deriveYb(FIXTURE));
    expect(barI()).toBe('01');
    expect(ovl.querySelector('.bz-yb-film')?.getAttribute('data-cur')).toBe('01'); // 开卷：底栏由 CSS 收掉
    expect(railOn()).toBe(0);
    expect(ovl.querySelector('[data-r="barN"]')!.textContent).toBe('开卷');
    handle.stop();
  });

  it('goTo 翻到第 4 幕：底栏/幕名/刻度尺同步，且被翻过的那幕定格', async () => {
    handle = bindYearbook(ovl, deriveYb(FIXTURE));
    handle.goTo(3);
    await new Promise((r) => setTimeout(r, 60));
    // 过片：换幕前遮片先合上（MOTION.fast = 160ms 后才真正换幕）
    expect(ovl.querySelector('[data-r="shutter"]')?.className).toContain('is-close');
    await new Promise((r) => setTimeout(r, 260));
    expect(barI()).toBe('04');
    expect(railOn()).toBe(3);
    expect(ovl.querySelector('[data-r="barN"]')!.textContent).toBe('星期节律');
    // 目标幕的表演跑到终态：日晷第一根辐条已整根抽出（不是停在 t=0 的半截）
    const bar = ovl.querySelector('[data-id="week"] .yb-spoke-bar') as HTMLElement;
    expect(bar.getAttribute('style') ?? '').toContain('scaleX(1');
    // 第 1 幕底栏整条收掉（开卷只留中间那团粒子）
    expect(ovl.querySelector('.bz-yb-film')?.getAttribute('data-cur')).toBe('04');
    handle.stop();
  });

  it('一次滚轮手势只翻一幕，同手势里的连发被吃掉（触控板惯性不连翻）', async () => {
    handle = bindYearbook(ovl, deriveYb(FIXTURE));
    const wheel = (dy: number): void => { sc.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true })); };
    wheel(120);
    wheel(120);
    wheel(120); // 同一次手势：只认第一下
    await new Promise((r) => setTimeout(r, 260));
    expect(barI()).toBe('02');
    handle.stop();
  });

  it('向右滚不越界（第 1 幕再往上滚仍停在第 1 幕）', async () => {
    handle = bindYearbook(ovl, deriveYb(FIXTURE));
    sc.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 260));
    expect(barI()).toBe('01');
    handle.stop();
  });

  it('刻度尺点击翻幕；stop 之后滚轮不再有任何反应', async () => {
    handle = bindYearbook(ovl, deriveYb(FIXTURE));
    (ovl.querySelectorAll('.yb-rail-t')[5] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 260));
    expect(barI()).toBe('06');
    handle.stop();
    sc.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
    expect(barI()).toBe('06');
  });

  it('结构不齐（没有滚动口）时不抛、也不留监听', () => {
    const bare = document.createElement('div');
    bare.className = 'bz-yb';
    bare.innerHTML = '<div class="bz-yb-film"></div>';
    const h = bindYearbook(bare, deriveYb(FIXTURE));
    expect(() => h.goTo(2)).not.toThrow();
    h.stop();
  });
});
