import { describe, it, expect } from 'vitest';
import { STATUS_WATCHED, STATUS_WANT } from '../../src/cinema/constants';
import type { CinemaItem } from '../../src/cinema/state';
import { bindStatFilm, deriveFilmData, statFilmHtml, FILM_SCENES, filmRateOf } from '../../src/cinema/stat-film';

let seq = 0;
const mk = (over: Partial<CinemaItem> = {}): CinemaItem => ({
  file: null,
  name: `片${++seq}`,
  typeTag: '电影',
  group: '电影',
  watchDate: '2024-06-01',
  rating: 8,
  status: STATUS_WATCHED,
  poster: null,
  review: null,
  genre: '剧情',
  director: '导演甲',
  actors: '演员甲',
  region: '日本',
  year: '2020',
  releaseDate: null,
  doubanRating: '8.0',
  doubanUrl: null,
  synopsis: null,
  duration: null,
  seasonText: null,
  hotComment: null,
  ...over,
});

describe('观影分析 · 滚动放映室（issue 405）· 数据派生', () => {
  it('已看/评分/时间线：只数真看过的，想看不进时间线', () => {
    const data = deriveFilmData([
      mk({ name: '甲', watchDate: '2024-06-01', rating: 9 }),
      mk({ name: '乙', watchDate: null, rating: null }), // 已看但无日期 → 不进时间线，进已看
      mk({ name: '丙', status: STATUS_WANT, watchDate: '2024-06-02', rating: null }),
    ]);
    expect(data.total).toBe(3);
    expect(data.watchedCount).toBe(2);
    expect(data.rated).toHaveLength(1);
    expect(data.rated[0].name).toBe('甲');
    expect(data.timeline).toHaveLength(1);
    expect(data.want).toHaveLength(1);
    expect(data.avgRating).toBeCloseTo(9);
  });

  it('星期桶：周一..周日排序（getDay+6)%7，与 analysis.ts 同口径），峰值取最旺日', () => {
    // 2024-06-01 周六、2024-06-02 周日
    const data = deriveFilmData([
      mk({ watchDate: '2024-06-01' }),
      mk({ watchDate: '2024-06-02' }),
      mk({ watchDate: '2024-06-02' }),
    ]);
    expect(data.weekN).toEqual([0, 0, 0, 0, 0, 1, 2]);
    expect(data.peakDay).toBe(6);
    expect(data.weekendN).toBe(3);
  });

  it('片龄四桶 + 平均片龄（观影年 − 上映年）', () => {
    const data = deriveFilmData([
      mk({ name: '当年', watchDate: '2024-06-01', year: '2024' }),
      mk({ name: '近片', watchDate: '2024-06-01', year: '2022' }),
      mk({ name: '中片', watchDate: '2024-06-01', year: '2018' }),
      mk({ name: '老片', watchDate: '2024-06-01', year: '2010' }),
    ]);
    const buckets = Object.fromEntries(data.ageGroups);
    expect(buckets['当年']).toHaveLength(1);
    expect(buckets['1-3年']).toHaveLength(1);
    expect(buckets['4-10年']).toHaveLength(1);
    expect(buckets['≥10年']).toHaveLength(1);
    expect(data.avgAge).toBe('5.5');
  });

  it('导演/主演按人聚合出作品列表', () => {
    const data = deriveFilmData([
      mk({ director: '李安', actors: '甲 / 乙' }),
      mk({ director: '李安 / 张三', actors: '甲' }),
    ]);
    expect(data.directors[0]).toMatchObject({ name: '李安', count: 2 });
    expect(data.directors[0].films).toHaveLength(2);
    expect(data.actors[0]).toMatchObject({ name: '甲', count: 2 });
  });

  it('系列基名聚合：「第X季」后缀剥离，≥2 部算连映', () => {
    const data = deriveFilmData([
      mk({ name: '老友记 第一季' }),
      mk({ name: '老友记 第二季' }),
      mk({ name: '老友记：重聚特辑' }), // 非季号命名 → 不并入
      mk({ name: '孤片 第一季' }),
    ]);
    expect(data.seriesList).toHaveLength(1);
    expect(data.seriesList[0].base).toBe('老友记');
    expect(data.seriesList[0].films).toHaveLength(2);
  });

  it('追剧深度：基名聚合取最大季号', () => {
    const data = deriveFilmData([
      mk({ name: '瑞克和莫蒂 第三季' }),
      mk({ name: '瑞克和莫蒂 第四季' }),
      mk({ name: '地球脉动 第一季' }),
    ]);
    expect(data.tvItems[0]).toEqual({ base: '瑞克和莫蒂', seasons: 4 });
    expect(data.tvItems.map((t) => t.base)).not.toContain('瑞克和莫蒂 第二');
    expect(data.avgSeason).toBe('2.5');
  });

  it('打分天平：宝藏（个人≥9 豆瓣<8）与失望（个人≤4 豆瓣≥8.5）', () => {
    const data = deriveFilmData([
      mk({ name: '宝', rating: 9.6, doubanRating: '6.6' }),
      mk({ name: '常', rating: 8, doubanRating: '8.2' }),
      mk({ name: '失', rating: 3.5, doubanRating: '9.0' }),
    ]);
    expect(data.treasure.map((it) => it.name)).toEqual(['宝']);
    expect(data.disappoint.map((it) => it.name)).toEqual(['失']);
    expect(data.avgDiff).toBeCloseTo((3 - 0.2 - 5.5) / 3, 5);
  });

  it('影评金句：切句、短句丢弃、关键词命中标记', () => {
    const data = deriveFilmData([
      mk({ review: '前面半小时真的挺好看，节奏也不错。后面无聊到睡着。' }),
      mk({ name: '无评' }),
    ]);
    expect(data.reviewCount).toBe(1);
    expect(data.dmLines.map((l) => l.hit)).toEqual([true, true]);
    expect(data.dmLines[0].text).toContain('挺好看');
  });

  it('每幕都有放映速率；信息密的编年慢于简单排片', () => {
    for (const id of FILM_SCENES) expect(filmRateOf(id)).toBeGreaterThan(0);
    expect(filmRateOf('s3')).toBeLessThan(filmRateOf('s12'));
  });
});

describe('观影分析 · 滚动放映室 · 静态 DOM', () => {
  const data = deriveFilmData([
    mk({ name: '甲' }),
    mk({ name: '乙', watchDate: '2023-03-05' }),
    mk({ name: '<script>alert(1)</script>片' }),
    mk({ name: '待映片', status: STATUS_WANT, rating: null }),
  ]);
  const html = statFilmHtml(data, (it) => (it.name === '乙' ? 'https://x/p.png' : null));

  it('22 幕齐全且带幕高系数', () => {
    for (const id of FILM_SCENES) {
      expect(html).toContain(`data-scene="${id}"`);
    }
    expect(html).toContain('calc(var(--film-unit) * 4.4)'); // 长廊/编年两处 4.4 幕高
  });

  it('用户文本全部转义：片名带 HTML 时不出裸标签', () => {
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('倒计时字与海报占位（无图走色相卡）', () => {
    expect(html).toContain('<b>叁</b>');
    expect(html).toContain('bz-film-ph');
    expect(html).toContain('src="https://x/p.png"');
  });

  it('票根数 = 星期数据合计；credits 含真实峰值', () => {
    const stubCount = (html.match(/bz-film-stub/g) ?? []).length;
    expect(stubCount).toBe(data.weekN.reduce((a, b) => a + b, 0));
    expect(html).toContain(`${data.peakYear[0]} 年`);
  });
});

describe('观影分析 · 滚动放映室 · 引擎（jsdom）', () => {
  const data = deriveFilmData([mk({ name: '甲' }), mk({ name: '乙', watchDate: '2023-03-05' })]);

  function mount(): { host: HTMLElement; root: HTMLElement; scroller: HTMLElement } {
    const scroller = document.createElement('div');
    scroller.className = 'sp-body';
    const root = document.createElement('div');
    root.innerHTML = statFilmHtml(data, () => null);
    scroller.appendChild(root);
    document.body.appendChild(scroller);
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 900 });
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 1200 });
    return { host: scroller, root, scroller };
  }

  it('绑定时把 --film-unit 写成滚动容器可视高', () => {
    const { host, root } = mount();
    const handle = bindStatFilm(root, data);
    expect(root.style.getPropertyValue('--film-unit')).toBe('900px');
    handle.stop();
    host.remove();
  });

  it('滚轮向下翻到下一幕并从头放映（snap 落定后）', async () => {
    const { host, root, scroller } = mount();
    const handle = bindStatFilm(root, data);
    handle.film.playing = false;
    const before = handle.film.scene;
    scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    await new Promise((r) => setTimeout(r, 900)); // snap 680ms 缓动落定
    const idx = FILM_SCENES.indexOf(before);
    expect(handle.film.scene).toBe(FILM_SCENES[idx + 1]);
    // jsdom 无布局几何（scrollHeight=0）：幕内放映「即播即停」是该环境的退化形态，
    // playing/sceneDone 的真实时序由真机验收，这里只钉翻幕落点
    handle.stop();
    host.remove();
  });

  it('stop() 之后滚轮不再翻幕', () => {
    const { host, root, scroller } = mount();
    const handle = bindStatFilm(root, data);
    handle.stop();
    const before = handle.film.scene;
    scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    expect(handle.film.scene).toBe(before);
    host.remove();
  });
});
