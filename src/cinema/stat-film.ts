/**
 * 影院（cinema）观影分析 · 滚动放映室（issue 405）
 *
 * 分析页整页是一部影片：四本 22 幕，覆盖 analysis.ts 19 板块的真实数据维度。
 * 放映模型（用户拍板）：**没有全程自动放映**——滚轮拨到哪一幕，就从那一幕的开头
 * 放到它的 sticky 末端，放完即停；再拨一次进下一幕。每幕独立速率（SCENE_RATE，
 * 信息密的幕放慢、简单幕放快），恒 2× 基准再乘幕系数。字幕卡常驻不淡出。
 *
 * 三层结构：
 * - `deriveFilmData(items)` 纯函数：从 M.items 现算全部幕数据（口径对齐 analysis.ts，
 *   但形状为「聚合→作品列表」，供各幕直接渲染）；
 * - `statFilmHtml(data, posterOf)` 纯字符串：22 幕静态 DOM（用户文本全部 escapeHtml）；
 * - `bindStatFilm(root, app, data)` 引擎：挂在 stat 页滚动容器 `.sp-body` 上，
 *   rect 测每幕进度、滚轮翻幕（惯性节流 + 缓动 snap）、幕内 scrollTop 推进放映，
 *   22 幕逐幕驱动；画布（颗粒/尘埃/划痕/星云/浪潮/玫瑰/弹幕）只在可见时绘制。
 *
 * 生命周期：renderAll 整刷会连根重建影片 DOM——引擎在 `!root.isConnected` 时自灭，
 * 另以模块级 activeEngine 兜底掐掉上一条 rAF；无 window 级监听（滚轮挂在 sp-body 上）。
 * 主题随壳：配色经 `--sf-*-rgb` CSS 变量读取（午夜场壳 = 暗调；亮色壳上岸只补变量层）。
 */
import type { CinemaItem } from './state';
import { STATUS_WATCHED, STATUS_WANT } from './constants';
import { escapeHtml as esc } from '../core/utils';

/* ═══════════════════ 幕目录（顺序即影片顺序） ═══════════════════ */

export const FILM_SCENES = [
  's0', 'i1', 's1', 'i2', 's2', 's10', 's3', 's11', 's12', 'i3',
  's4', 's13', 's14', 's15', 's16', 's17', 's18', 's19', 'i4', 's5', 's6', 's7',
] as const;
export type FilmSceneId = (typeof FILM_SCENES)[number];

/** 幕高（× --film-unit，即 sp-body 客户高） */
export const FILM_SCENE_H: Record<FilmSceneId, number> = {
  s0: 2, i1: 2.2, s1: 4.4, i2: 2.2, s2: 3, s10: 2.4, s3: 4.4, s11: 2.4, s12: 2.4,
  i3: 2.2, s4: 2.8, s13: 2.8, s14: 2.8, s15: 2.2, s16: 2.8, s17: 2.4, s18: 2.2,
  s19: 2.8, i4: 2.2, s5: 2.8, s6: 2.8, s7: 2,
};

/** 每幕放映速率（×2× 基准）：信息密的幕放慢、简单幕放快 */
export const FILM_SCENE_RATE: Record<FilmSceneId, number> = {
  s0: .7, i1: .9, s1: 1.15, i2: .9, s2: .9, s10: 1.05, s3: .8, s11: .95, s12: 1.35,
  i3: .9, s4: 1, s13: 1.05, s14: 1.1, s15: 1.15, s16: 1.4, s17: 1.2, s18: 1.3,
  s19: .85, i4: .9, s5: .8, s6: .7, s7: 1,
};
export const filmRateOf = (id: string): number => (FILM_SCENE_RATE as Record<string, number>)[id] ?? 1;

export const FILM_SCENE_NAMES: Record<string, string> = {
  s0: '倒计时', i1: '入座', s1: '馆藏长廊', i2: '光影', s2: '评分星云', s10: '年份浪潮',
  s3: '放映编年', s11: '十二档期', s12: '本周排片', i3: '偏爱', s4: '霓虹片街', s13: '修片馆',
  s14: '导演特展', s15: '群像长卷', s16: '打分天平', s17: '连映夜', s18: '追剧深度',
  s19: '弹幕影评', i4: '散场', s5: '年度名人堂', s6: '片尾致谢', s7: '下档预告',
};

/* ═══════════════════ 数据派生（纯函数；口径对齐 analysis.ts） ═══════════════════ */

const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const CN_NUM: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const cnToNum = (s: string): number => CN_NUM[s] ?? (parseInt(s, 10) || 0);
const REVIEW_KEYWORDS = ['好看', '喜欢', '推荐', '经典', '感动', '治愈', '失望', '无聊', '一般', '神作', '烂片', '封神', '震撼', '催泪', '熬夜', '二刷', '满分'];

export interface FilmPerson { name: string; count: number; films: CinemaItem[] }
export interface FilmSeries { base: string; films: CinemaItem[] }
export interface FilmTv { base: string; seasons: number }
export interface FilmLine { text: string; hit: boolean }
export interface FilmData {
  total: number; watchedCount: number; wantCount: number;
  rated: CinemaItem[]; avgRating: number;
  timeline: CinemaItem[];
  yearMin: number; yearMax: number;
  weekN: number[]; peakDay: number; weekendN: number;
  yearArr: [string, number][]; peakYear: [string, number];
  monthN: number[]; peakMonth: number;
  ageGroups: [string, CinemaItem[]][]; avgAge: string;
  directors: FilmPerson[]; actors: FilmPerson[];
  diffPairs: CinemaItem[]; avgDiff: number;
  treasure: CinemaItem[]; disappoint: CinemaItem[];
  seriesList: FilmSeries[];
  tvItems: FilmTv[]; avgSeason: string;
  dmLines: FilmLine[]; reviewCount: number;
  want: CinemaItem[];
  monthFreq: string;
  topGenres: [string, number][]; topRegions: [string, number][];
}

export function deriveFilmData(items: CinemaItem[]): FilmData {
  const watched = items.filter((it) => it.status === STATUS_WATCHED);
  const rated = watched.filter((it) => (it.rating ?? 0) > 0).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const avgRating = rated.length ? rated.reduce((s, it) => s + (it.rating ?? 0), 0) / rated.length : 0;
  const timeline = watched.filter((it) => !!it.watchDate).sort((a, b) => (a.watchDate! < b.watchDate! ? -1 : 1));
  const years = timeline.map((it) => Number(it.watchDate!.slice(0, 4)));
  const yearMin = years.length ? Math.min(...years) : 0;
  const yearMax = years.length ? Math.max(...years) : 0;
  const wantList = items.filter((it) => it.status === STATUS_WANT).slice(0, 3);

  // 星期（周一..周日，与 analysis.ts 的 (i+1)%7 同口径）
  const weekN = [0, 0, 0, 0, 0, 0, 0];
  timeline.forEach((it) => { weekN[(new Date(it.watchDate!).getDay() + 6) % 7]++; });
  const peakDay = weekN.indexOf(Math.max(...weekN));
  const weekendN = weekN[5] + weekN[6];

  const yearCnt: Record<string, number> = {};
  timeline.forEach((it) => { const y = it.watchDate!.slice(0, 4); yearCnt[y] = (yearCnt[y] || 0) + 1; });
  const yearArr = Object.entries(yearCnt).sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const monthN = Array<number>(12).fill(0);
  timeline.forEach((it) => { monthN[Number(it.watchDate!.slice(5, 7)) - 1]++; });
  const peakMonth = monthN.indexOf(Math.max(...monthN));

  // 片龄（观影年 − 上映年；同 analysis.ts 四桶）
  const ageOf = (it: CinemaItem): number | null =>
    it.watchDate && it.year ? Number(it.watchDate.slice(0, 4)) - Number(it.year) : null;
  const AGES: Record<string, CinemaItem[]> = { 当年: [], '1-3年': [], '4-10年': [], '≥10年': [] };
  watched.forEach((it) => {
    const a = ageOf(it);
    if (a === null || isNaN(a)) return;
    const k = a <= 0 ? '当年' : a <= 3 ? '1-3年' : a <= 10 ? '4-10年' : '≥10年';
    AGES[k].push(it);
  });
  const ageList = watched.map(ageOf).filter((a): a is number => a !== null && !isNaN(a));
  const avgAge = ageList.length ? (ageList.reduce((s, a) => s + a, 0) / ageList.length).toFixed(1) : '0';

  // 导演 / 主演：按人聚合出作品
  const entityMap = (field: 'director' | 'actors'): FilmPerson[] => {
    const m: Record<string, CinemaItem[]> = {};
    items.forEach((it) => String(it[field] || '').split(/\s*\/\s*/).forEach((x) => {
      if (!x) return;
      const key = x.trim();
      (m[key] = m[key] || []).push(it);
    }));
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length)
      .map(([name, films]) => ({ name, count: films.length, films }));
  };

  // 打分天平（个人 − 豆瓣）
  const diffPairs = rated.filter((it) => !!it.doubanRating);
  const avgDiff = diffPairs.length
    ? diffPairs.reduce((s, it) => s + (it.rating ?? 0) - parseFloat(it.doubanRating!), 0) / diffPairs.length
    : 0;

  // 系列（基名 = 去掉「第X季…」后缀；≥2 部算连映）
  const seriesMap: Record<string, CinemaItem[]> = {};
  items.forEach((it) => {
    const m = String(it.name).match(/^(.*?)\s*第[一二三四五六七八九十0-9]+\s*季/);
    if (!m || !m[1]) return;
    (seriesMap[m[1]] = seriesMap[m[1]] || []).push(it);
  });
  const seriesList = Object.entries(seriesMap).filter(([, v]) => v.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([base, films]) => ({ base, films }));

  // 追剧深度：按「第X季」命名识别、同一基名取追到的最大季号
  const tvItems = items.filter((it) => /第[一二三四五六七八九十0-9]+\s*季/.test(String(it.name)))
    .map((it) => {
      const m = String(it.name).match(/第([一二三四五六七八九十0-9]+)\s*季/);
      return { base: String(it.name).replace(/\s*第[一二三四五六七八九十0-9]+\s*季.*/, ''), sn: m ? cnToNum(m[1]) : 1 };
    })
    .reduce<FilmTv[]>((acc, it) => {
      const got = acc.find((x) => x.base === it.base);
      if (got) got.seasons = Math.max(got.seasons, it.sn);
      else acc.push({ base: it.base, seasons: it.sn });
      return acc;
    }, [])
    .sort((a, b) => b.seasons - a.seasons);

  // 影评金句（按句切，取 ≤26 字，命中关键词的放大）
  const dmLines: FilmLine[] = [];
  items.filter((it) => !!it.review).forEach((it) => {
    String(it.review).split(/[。！？!?\n]+/).forEach((sen) => {
      const s = sen.trim();
      if (s.length >= 6) dmLines.push({ text: s.slice(0, 26), hit: REVIEW_KEYWORDS.some((k) => s.includes(k)) });
    });
  });

  const topOf = (field: 'genre' | 'region', n: number): [string, number][] => {
    const m: Record<string, number> = {};
    items.forEach((it) => String(it[field] || '').split(/\s*\/\s*/).forEach((x) => {
      if (!x) return; m[x] = (m[x] || 0) + 1;
    }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
  };
  const monthKeys = new Set(timeline.map((it) => it.watchDate!.slice(0, 7)));

  return {
    total: items.length,
    watchedCount: watched.length,
    wantCount: items.filter((it) => it.status !== STATUS_WATCHED).length,
    rated,
    avgRating,
    timeline,
    yearMin, yearMax,
    weekN, peakDay, weekendN,
    yearArr,
    peakYear: yearArr.length ? yearArr.reduce<[string, number]>((b, x) => (x[1] > b[1] ? x : b), ['', 0]) : ['', 0],
    monthN, peakMonth,
    ageGroups: Object.entries(AGES),
    avgAge,
    directors: entityMap('director').slice(0, 6),
    actors: entityMap('actors').slice(0, 6),
    diffPairs, avgDiff,
    treasure: diffPairs.filter((it) => (it.rating ?? 0) >= 9 && parseFloat(it.doubanRating!) < 8),
    disappoint: diffPairs.filter((it) => (it.rating ?? 10) <= 4 && parseFloat(it.doubanRating!) >= 8.5),
    seriesList,
    tvItems, avgSeason: tvItems.length ? (tvItems.reduce((s, it) => s + it.seasons, 0) / tvItems.length).toFixed(1) : '0',
    dmLines, reviewCount: items.filter((it) => !!it.review).length,
    want: wantList,
    monthFreq: monthKeys.size ? (timeline.length / monthKeys.size).toFixed(1) : '0',
    topGenres: topOf('genre', 5), topRegions: topOf('region', 3),
  };
}

/* ═══════════════════ 静态 DOM（纯字符串；用户文本全部转义） ═══════════════════ */

const hashHue = (s: string): number => { let h = 0; for (const c of s) h = (h * 31 + (c.codePointAt(0) ?? 0)) % 360; return h; };

/** 海报位：有图出 img，没图出色块卡（色相由片名散列）——比原型的 onerror 兜底更早定型 */
function posterTag(it: CinemaItem, posterOf: (it: CinemaItem) => string | null): string {
  const src = posterOf(it);
  if (src) return `<img src="${esc(src)}" alt="${esc(it.name)}" loading="lazy" decoding="async">`;
  const h = hashHue(it.name);
  return `<i class="bz-film-ph" style="--pc1:hsl(${h} 30% 17%);--pc2:hsl(${(h + 46) % 360} 38% 8%)"><span>${esc(it.name)}</span></i>`;
}

const NEON_COLORS = { gold: '#ffd98a', warm: '#ff9d7a' };

export function statFilmHtml(data: FilmData, posterOf: (it: CinemaItem) => string | null): string {
  const H = (id: FilmSceneId): string => `style="height:calc(var(--film-unit) * ${FILM_SCENE_H[id]})"`;
  const scene = (id: FilmSceneId, inner: string, tag = ''): string =>
    `<section class="bz-film-scn" data-scene="${id}" ${H(id)}><div class="bz-film-pin">${inner}</div>${tag}</section>`;
  const scnTag = (no: string, title: string, cap: string): string =>
    `<div class="bz-film-tag"><span class="no">${no}</span><h2>${esc(title)}</h2><span class="cap">${esc(cap)}</span></div>`;
  const inter = (id: FilmSceneId, vol: string, title: string, sub: string): string =>
    scene(id, `<div class="bz-film-inter"><div class="vol">${vol}</div><h2>${esc(title)}</h2><div class="rule"></div><div class="sub">${esc(sub)}</div></div>`);

  // 序幕 · 倒计时
  const s0 = scene('s0', `
    <canvas class="bz-film-cv" data-cv="beam"></canvas>
    <div class="bz-film-count">
      <div class="dial"></div><div class="ccross"></div><div class="ccross h"></div>
      <div class="cring"></div><div class="cring r2"></div>
      <div class="cdiv" data-c="0"><b>叁</b></div>
      <div class="cdiv" data-c="1"><b>贰</b></div>
      <div class="cdiv" data-c="2"><b>壹</b></div>
    </div>
    <div class="bz-film-hero">
      <h1>观影年鉴</h1><div class="rule"></div>
      <p class="sub">私人放映史 · 馆藏 <b>${data.total}</b> 部</p>
      <p class="meta">四本胶片 · 滚轮翻幕 · 每幕自头放映</p>
    </div>
    <div class="bz-film-hint">拨动滚轮 · 翻到下一幕</div>`);

  // 第一本 · 馆藏长廊
  const corridorPosters = Array.from({ length: 18 }, (_, i) => {
    const it = data.timeline[i % data.timeline.length];
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    return `<figure class="bz-film-p3" style="transform:translate(-50%,-50%) translate3d(var(--x),0,var(--z)) rotateY(var(--a));--x:${side * 34}%;--z:${-(300 + row * 470)}px;--a:${side * -62}deg">${posterTag(it, posterOf)}</figure>`;
  }).join('');
  const s1 = scene('s1', `
    <div class="bz-film-corr"><div class="bz-film-corr-inner" data-ref="corr">${corridorPosters}
    <div class="bz-film-end-sign" data-ref="sign" style="--z:-3220px"><div class="big">馆藏长廊</div><div class="small">${data.total} 部 · 已放映 ${data.watchedCount} 部</div></div></div></div>
    <div class="bz-film-ground"></div><div class="bz-film-fog"></div>`,
    scnTag('第一本', '馆藏长廊', `馆藏 ${data.total} 部 · 每一格座位都有主`));

  // 第二本 · 星云 / 年份浪潮 / 编年 / 档期 / 排片
  const s2 = scene('s2', `
    <canvas class="bz-film-cv" data-cv="nebula"></canvas>
    <div class="bz-film-axis x"><span>${data.yearMin}</span><span>观影年份 →</span><span>${data.yearMax}</span></div>
    <div class="bz-film-axis y">评分 →</div>
    <div class="bz-film-neb-meta"><div class="num" data-ref="avg">0.0</div><div class="lbl">平均评分 · 十分制</div></div>
    <div class="bz-film-neb-top">${data.rated.slice(0, 3).map((it) =>
      `<figure class="bz-film-mini">${posterTag(it, posterOf)}<figcaption>${esc(it.name)}</figcaption></figure>`).join('')}</div>`,
    scnTag('第二本', '评分星云', '每星一部 · 亮度即偏爱'));

  const s10 = scene('s10', `
    <canvas class="bz-film-cv" data-cv="wave"></canvas>
    <div class="bz-film-wave-meta"><div class="num" data-ref="wave">0</div><div class="lbl">最旺一年 · 部</div></div>`,
    scnTag('第二本', '年份浪潮', '一年一浪 · 越滚越高'));

  const frames = data.timeline.slice(-24).map((it) =>
    `<figure class="bz-film-frame">${posterTag(it, posterOf)}<figcaption><span class="yy">${esc(it.watchDate!.slice(0, 4))}.${esc(it.watchDate!.slice(5, 7))}</span>${esc(it.name)}</figcaption></figure>`).join('');
  const s3 = scene('s3', `
    <div class="bz-film-filmwrap"><div class="perf-strip"></div><div class="bz-film-strip" data-ref="strip">${frames}</div><div class="perf-strip b"></div></div>`,
    scnTag('第二本', '放映编年', `${data.timeline.length} 次落座 · 按观影日期走片`));

  const s11 = scene('s11', `
    <canvas class="bz-film-cv" data-cv="dial"></canvas>
    <div class="bz-film-dial-meta"><div class="num" data-ref="dial">${data.peakMonth + 1} 月</div><div class="lbl">最旺档期 · ${data.monthN[data.peakMonth]} 部</div></div>`,
    scnTag('第二本', '十二档期', '一月一扇 · 档期玫瑰'));

  const dayCards = WEEK_NAMES.map((nm, i) => {
    const stubs = Array.from({ length: data.weekN[i] }, () => '<i class="bz-film-stub"></i>').join('');
    return `<div class="bz-film-day${i >= 5 ? ' is-wknd' : ''}${i === data.peakDay ? ' is-peak' : ''}">
      <span class="peak">最旺</span><div class="dn">${nm}</div><div class="dc">${data.weekN[i]}<small>场</small></div>
      <div class="stubs">${stubs}</div></div>`;
  }).join('');
  const s12 = scene('s12', `<div class="bz-film-week">${dayCards}</div>`,
    scnTag('第二本', '本周排片', `周末 ${data.weekendN} 场（${data.timeline.length ? Math.round(data.weekendN / data.timeline.length * 100) : 0}%）· 最旺在${WEEK_NAMES[data.peakDay]}`));

  // 第三本 · 霓虹 / 修片馆 / 导演 / 群像 / 天平 / 连映 / 追剧 / 弹幕
  const neonCols = [...data.topGenres.map(([label, n]) => ({ label, n, c: NEON_COLORS.gold })),
                    ...data.topRegions.map(([label, n]) => ({ label, n, c: NEON_COLORS.warm }))]
    .map(({ label, n, c }) => `<div class="bz-film-neon-col" style="--nc:${c}"><div class="txt">${esc(label)}</div><div class="cnt">${n} 部</div><div class="ref" aria-hidden="true">${esc(label)}</div></div>`).join('');
  const s4 = scene('s4', `<div class="bz-film-street">${neonCols}</div><div class="bz-film-street-glow"></div>`,
    scnTag('第三本', '霓虹片街', '类型与产地 · 灯牌亮度即场次'));

  const shelves = data.ageGroups.map(([label, list]) => {
    const tint = label === '当年' ? 0 : label === '1-3年' ? .35 : label === '4-10年' ? .7 : 1;
    const posters = list.length ? list.slice(0, 4).map((it) => posterTag(it, posterOf)).join('') : '<span class="bz-film-none">空</span>';
    return `<div class="bz-film-shelf" data-tint="${tint}"><div class="sn">${esc(label)}</div>
      <div class="sc">${list.length}<small> 部</small></div><div class="sp">${posters}</div>
      <div class="oldest">${list.length ? `最早《${esc(list[list.length - 1].name)}》` : ''}</div></div>`;
  }).join('');
  const s13 = scene('s13', `
    <canvas class="bz-film-cv" data-cv="agefx"></canvas>
    <div class="bz-film-age-head"><div class="num" data-ref="age">0</div><div class="lbl">平均片龄 · 年</div></div>
    <div class="bz-film-vault">${shelves}</div>`,
    scnTag('第三本', '修片馆', '越老的片子 · 越接近胶片的颜色'));

  const plaques = data.directors.map((p, i) => `<article class="bz-film-plaque${i === 0 ? ' master' : ''}">
    ${i === 0 ? '<span class="tag">御用</span>' : ''}<h3>${esc(p.name)}</h3>
    <div class="pn">${p.count} 部 · 全看过</div><div class="pp">${p.films.slice(0, 4).map((it) => posterTag(it, posterOf)).join('')}</div></article>`).join('');
  const s14 = scene('s14', `<div class="bz-film-spot" data-ref="spot"></div><div class="bz-film-gallery">${plaques}</div>`,
    scnTag('第三本', '导演特展', '一遍不够 · 就多来几遍'));

  const starCards = data.actors.map((p) => `<div class="bz-film-star"><div class="nm">${esc(p.name)}<small><b>${p.count}</b> 部</small></div>
    <div class="ims">${p.films.slice(0, 2).map((it) => posterTag(it, posterOf)).join('')}</div></div>`).join('');
  const s15 = scene('s15', `
    <div class="bz-film-parade"><div class="bz-film-ghost" data-ref="ghost"></div><div class="bz-film-parade-strip" data-ref="parade">${starCards}</div></div>`,
    scnTag('第三本', '群像长卷', '常来串门的那些脸'));

  const cmpRow = (it: CinemaItem): string =>
    `<div class="row"><span class="nm">《${esc(it.name)}》</span><span class="vv">我 ${(it.rating ?? 0).toFixed(1)} · 豆 ${esc(it.doubanRating ?? '—')}</span></div>`;
  const s16 = scene('s16', `
    <div class="bz-film-diff-head"><div class="num" data-ref="diff">+0.0</div><div class="lbl">打分天平 · 个人 − 豆瓣</div></div>
    <div class="bz-film-balance"><div class="arm" data-ref="arm"><i class="l"></i><i class="r"></i></div><div class="ful"></div></div>
    <div class="bz-film-scale">
      <div class="pan left" data-ref="panL"><div class="pt">宝藏片 · 个人≥9 豆瓣&lt;8</div>
        ${data.treasure.length ? data.treasure.map(cmpRow).join('') : '<div class="empty">暂无 —— 眼光与大众还算合拍</div>'}</div>
      <div class="pan right" data-ref="panR"><div class="pt">失望榜 · 个人≤4 豆瓣≥8.5</div>
        ${data.disappoint.length ? data.disappoint.map(cmpRow).join('') : '<div class="empty">暂无 —— 没有错杀的「神作」</div>'}</div>
    </div>`,
    scnTag('第三本', '打分天平', '宝藏与失望 · 都有名单'));

  const maros = data.seriesList.slice(0, 4).map((s) => `<div class="bz-film-maro">
    <div class="info"><div class="marq"></div><h3>《${esc(s.base)}》</h3><div class="n">${s.films.length} 部连映</div></div>
    <div class="stack">${s.films.map((it) => posterTag(it, posterOf)).join('')}</div></div>`).join('');
  const s17 = scene('s17', `<div class="bz-film-marathon">${maros}</div>`,
    scnTag('第三本', '连映夜', '同一个世界 · 一晚看穿'));

  const bingeRows = data.tvItems.slice(0, 6).map((t) => `<div class="bz-film-brow">
    <span class="bn">《${esc(t.base)}》</span><span class="reels">${'<i class="rl"></i>'.repeat(Math.min(t.seasons, 8))}</span>
    <span class="bn2">追到第 ${t.seasons} 季</span></div>`).join('');
  const s18 = scene('s18', `
    <div class="bz-film-binge"><div class="wm" data-ref="wm">${data.tvItems[0]?.seasons ?? ''}</div>
      <div class="binge-head"><div class="num" data-ref="binge">0</div><div class="lbl">平均追到 · 季</div></div>
      <div data-ref="bingerows">${bingeRows}</div></div>`,
    scnTag('第三本', '追剧深度', '第几季弃的 · 都记着'));

  const s19 = scene('s19', `
    <canvas class="bz-film-cv" data-cv="dm"></canvas>
    <div class="bz-film-dm-meta"><div class="num" data-ref="dm">0</div><div class="lbl">影评手记 · 篇</div></div>`,
    scnTag('第三本', '弹幕影评', '散场之后 · 你留下的那句话'));

  // 第四本 · 名人堂 / 致谢 / 预告
  const MEDALS = ['榜首之作', '榜眼之作', '探花之作'];
  const awardCards = data.rated.slice(0, 3).map((it, i) => `<article class="bz-film-award">
    <span class="poster">${posterTag(it, posterOf)}</span>
    <span class="medal ${i ? `m${i + 1}` : ''}">${MEDALS[i]}</span>
    <h3>《${esc(it.name)}》</h3>
    <div class="meta">${esc(it.year ?? '—')} 年 · ${esc(it.director ?? '')}<br>${esc(it.genre ?? '')}</div>
    <div class="stars"><span class="my">${(it.rating ?? 0).toFixed(1)}</span>
      <span class="db">豆瓣 ${esc(it.doubanRating ?? '—')}</span><span class="cap">我的评分</span></div></article>`).join('');
  const s5 = scene('s5', `<div class="bz-film-hall"><div class="bz-film-rays" data-ref="rays"></div>${awardCards}</div>`,
    scnTag('第四本', '年度名人堂', '你的评分 · 最高敬意'));

  const fav = (list: FilmPerson[], tag: string): string => list[0]
    ? `<div class="role"><div class="r">${tag}</div><div class="n">${esc(list[0].name)} <small>· ${list[0].count} 部</small></div></div>` : '';
  const s6 = scene('s6', `
    <div class="bz-film-rollbox"><div class="bz-film-roll" data-ref="roll">
      <div class="role"><div class="r">出品</div><div class="n">包仔影业</div></div>
      <div class="role"><div class="r">领衔主演</div><div class="n">${data.watchedCount} 部影片 <small>· 全员本色出演</small></div></div>
      ${fav(data.directors, '御用导演')}${fav(data.actors, '座上常客')}
      <div class="role"><div class="r">最旺一年</div><div class="n">${esc(data.peakYear[0])} 年 <small>· ${data.peakYear[1]} 部</small></div></div>
      <div class="role"><div class="r">最旺档期</div><div class="n">${data.peakMonth + 1} 月 <small>· ${data.monthN[data.peakMonth]} 部</small></div></div>
      <div class="role"><div class="r">最常落座</div><div class="n">${WEEK_NAMES[data.peakDay]} <small>· ${data.weekN[data.peakDay]} 场</small></div></div>
      <div class="role"><div class="r">月均场次</div><div class="n">${data.monthFreq} 部</div></div>
      <div class="role"><div class="r">影评手记</div><div class="n">${data.reviewCount} 篇</div></div>
      <div class="role"><div class="r">平均片龄</div><div class="n">${data.avgAge} 年</div></div>
      <div class="role"><div class="r">特别鸣谢</div><div class="n">每一个愿意看完字幕的你</div></div>
    </div></div>
    <div class="bz-film-theend" data-ref="theend"><div class="ring"></div><div class="t">剧 终</div></div>`);

  const nextCards = data.want.map((it) => `<figure class="bz-film-next">
    ${posterTag(it, posterOf)}<span class="stamp">待映</span>
    <figcaption><div class="nm">${esc(it.name)}</div><div class="db">${it.doubanRating ? `豆瓣 ${esc(it.doubanRating)}` : '片源锁定中'}</div></figcaption></figure>`).join('');
  const s7 = scene('s7', `
    <div class="bz-film-cone l"></div><div class="bz-film-cone r"></div>
    <div class="bz-film-next-attr"><div class="soon">下 档 预 告</div>
      <div class="bz-film-next-row" data-ref="next">${nextCards}</div>
      <button class="bz-film-replay" data-ref="replay">重 映</button></div>`);

  // 顶栏常驻层：颗粒画布 + 细轨导航（sticky 钉在滚动容器可视区）
  const fixed = `<div class="bz-film-fixed">
    <canvas class="bz-film-cv bz-film-grain" data-cv="grain"></canvas>
    <div class="bz-film-nav"><div class="bz-film-track" data-ref="track"><i class="bz-film-dot" data-ref="dot"></i></div>
    <span class="bz-film-now" data-ref="now">倒计时</span></div></div>`;

  const interCard = (id: FilmSceneId, vol: string, title: string, sub: string): string =>
    scene(id, `<div class="bz-film-inter"><div class="vol">${vol}</div><h2>${esc(title)}</h2><div class="rule"></div><div class="sub">${esc(sub)}</div></div>`);

  return `<div class="bz-stat-film">${fixed}${s0}
    ${interCard('i1', '第 一 本', '入座', '灯暗下来 · 馆藏各就各位')}${s1}
    ${interCard('i2', '第 二 本', '光影', '光打在墙上 · 时间有了形状')}${s2}${s10}${s3}${s11}${s12}
    ${interCard('i3', '第 三 本', '偏爱', '看什么 · 重复看什么 · 打几分')}${s4}${s13}${s14}${s15}${s16}${s17}${s18}${s19}
    ${interCard('i4', '第 四 本', '散场', '把最好的几部 · 再放一遍')}${s5}${s6}${s7}</div>`;
}


/* ═══════════════════ 引擎（挂 stat 页滚动容器 .sp-body） ═══════════════════ */

const SPEED = 420; // 幕内放映基准速度（2× 档，px/s），再乘每幕速率

export interface FilmHandle {
  film: { playing: boolean; scene: FilmSceneId; sceneDone: boolean };
  playScene(id: FilmSceneId): void;
  stop(): void;
}

interface SceneUnit {
  id: FilmSceneId;
  el: HTMLElement;
  update: (p: number, r: DOMRect, vh: number) => void;
}

let activeEngine: { dead: boolean } | null = null;

/** 把影片引擎挂到 stat 页：root = .bz-stat-film（滚动容器取最近的 .sp-body） */
export function bindStatFilm(root: HTMLElement, data: FilmData): FilmHandle {
  if (activeEngine) activeEngine.dead = true; // 整刷重建：上一条引擎就地处决
  const scroller = root.closest<HTMLElement>('.sp-body');
  const engine = { dead: !scroller };
  activeEngine = engine;
  const handle: FilmHandle = {
    film: { playing: false, scene: 's0', sceneDone: false },
    playScene(id: FilmSceneId) { playScene(id); },
    stop() { engine.dead = true; scroller?.removeEventListener('wheel', onWheel); },
  };
  if (!scroller) return handle;
  const sc = scroller;

  const q = <T extends HTMLElement>(sel: string): T | null => root.querySelector<T>(sel);
  const all = <T extends HTMLElement>(sel: string): T[] => [...root.querySelectorAll<T>(sel)];

  // 画布与幕高单位：跟随 sp-body 可视区
  const size = (): void => {
    root.style.setProperty('--film-unit', `${sc.clientHeight}px`);
    all<HTMLCanvasElement>('[data-cv]').forEach((cv) => {
      cv.width = sc.clientWidth;
      cv.height = sc.clientHeight;
    });
  };
  size();

  // 画布配色从壳变量读（午夜场 = 暗调；亮色壳上岸只补变量层）
  const cs = getComputedStyle(root);
  const V = (n: string, fb: string): string => cs.getPropertyValue(n).trim() || fb;
  const PAL = {
    ink: V('--sf-ink-rgb', '239,230,208'), dim: V('--sf-dim-rgb', '154,140,114'),
    faint: V('--sf-faint-rgb', '92,81,64'), gold: V('--sf-gold-rgb', '201,153,47'),
    star: V('--sf-star-rgb', '255,217,138'), star2: V('--sf-star2-rgb', '159,192,232'),
    core: V('--sf-core-rgb', '255,246,228'), dust: V('--sf-dust-rgb', '239,230,208'),
  };

  const sceneEl = (id: FilmSceneId): HTMLElement | null => root.querySelector<HTMLElement>(`[data-scene="${id}"]`);
  const absTop = (el: HTMLElement): number =>
    el.getBoundingClientRect().top - root.getBoundingClientRect().top + sc.scrollTop;

  const film = handle.film;
  const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
  const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3);
  const easeOutBack = (x: number): number => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const ref = <T extends HTMLElement>(name: string): T | null => root.querySelector<T>(`[data-ref="${name}"]`);
  const cv = (name: string): CanvasRenderingContext2D | null => q<HTMLCanvasElement>(`[data-cv="${name}"]`)?.getContext('2d') ?? null;

  function playScene(id: FilmSceneId): void {
    const el = sceneEl(id);
    if (!el) return;
    film.scene = id; film.sceneDone = false;
    sc.scrollTop = absTop(el);
    film.playing = true;
  }
  handle.playScene = playScene;

  // ── 滚轮翻幕：惯性节流 + 680ms 缓动 snap，落定即从头放映该幕 ──
  const nextFrame = (cb: (t: number) => void): void => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb);
    else cb(performance.now()); // 无 rAF 环境（jsdom/老宿主）：即时落位
  };
  let snapping = false;
  let lastWheelAt = 0;
  function snapTo(id: FilmSceneId): void {
    if (snapping) return;
    const el = sceneEl(id);
    if (!el) return;
    snapping = true;
    film.playing = false;
    const from = sc.scrollTop;
    const to = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, absTop(el)));
    const t0 = performance.now();
    const DUR = 680;
    const step = (): void => {
      const k = Math.min(1, (performance.now() - t0) / DUR);
      const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      sc.scrollTop = from + (to - from) * e;
      if (k < 1 && !engine.dead) nextFrame(step);
      else { snapping = false; playScene(id); }
    };
    nextFrame(step);
  }
  function wheelSnap(dir: number): void {
    const idx = FILM_SCENES.indexOf(film.scene);
    const next = FILM_SCENES[dir > 0 ? idx + 1 : idx - 1];
    if (next) snapTo(next);
  }
  function onWheel(e: WheelEvent): void {
    e.preventDefault(); // 原生滚动让位给翻幕，否则双重滚动
    const now = performance.now();
    if (snapping || now - lastWheelAt < 650) return; // 翻幕中 / 触控板惯性：吞掉
    lastWheelAt = now;
    wheelSnap(e.deltaY);
  }
  scroller.addEventListener('wheel', onWheel, { passive: false });

  // ── 逐幕注册（只驱动可见幕；几何全部走 rect，不依赖窗口尺寸） ──
  const scenes: SceneUnit[] = [];
  const scene = (id: FilmSceneId, update: SceneUnit['update']): void => {
    const el = sceneEl(id);
    if (el) scenes.push({ id, el, update });
  };

  // 序幕：放映机光束 + 尘埃 + 倒计时三拍 + 片名
  const t0 = performance.now();
  const t0f = (): number => (performance.now() - t0) / 1000;
  const beamCtx = cv('beam');
  const dust = Array.from({ length: 64 }, () => ({
    x: Math.random(), y: Math.random(), r: .6 + Math.random() * 1.6,
    v: .0004 + Math.random() * .0011, ph: Math.random() * 7,
  }));
  const cdivs = all<HTMLElement>('[data-scene="s0"] .cdiv');
  scene('s0', (p, r, vh) => {
    cdivs.forEach((el, i) => {
      const seg = clamp01(p * 3 - i);
      const open = clamp01(seg / .32);
      const shut = i === cdivs.length - 1 ? 1 : 1 - clamp01((seg - .8) / .2);
      el.style.clipPath = `circle(${(easeOut(Math.min(open, shut)) * 74).toFixed(1)}% at 50% 50%)`;
    });
    const hp = clamp01((p - .82) / .18);
    const heroEl = q<HTMLElement>('[data-scene="s0"] .bz-film-hero');
    if (heroEl) {
      heroEl.style.opacity = String(hp);
      heroEl.style.transform = `translateY(${((1 - easeOut(hp)) * 26).toFixed(1)}px)`;
    }
    const countEl = q<HTMLElement>('[data-scene="s0"] .bz-film-count');
    if (countEl) countEl.style.opacity = String(1 - clamp01((p - .78) / .12));
    const hintEl = q<HTMLElement>('[data-scene="s0"] .bz-film-hint');
    if (hintEl) hintEl.style.opacity = String(p > .1 ? clamp01((p - .1) / .2) * .9 : 0);
    if (!beamCtx) return;
    const w = r.width, h = vh;
    beamCtx.clearRect(0, 0, w, h);
    const flick = .9 + .1 * Math.sin(t0f() * 17.3) * Math.sin(t0f() * 5.1);
    const dim = 1 - hp * .45;
    const cx = w / 2, cy = -h * .12;
    const g = beamCtx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(${PAL.gold},${.2 * flick * dim})`);
    g.addColorStop(.55, `rgba(${PAL.gold},${.09 * flick * dim})`);
    g.addColorStop(1, `rgba(${PAL.gold},0)`);
    beamCtx.beginPath();
    beamCtx.moveTo(cx - w * .015, cy);
    beamCtx.lineTo(cx - w * .62, h);
    beamCtx.lineTo(cx + w * .62, h);
    beamCtx.lineTo(cx + w * .015, cy);
    beamCtx.closePath();
    beamCtx.fillStyle = g;
    beamCtx.fill();
    for (const d of dust) {
      const yy = ((d.y - t0f() * d.v) % 1 + 1) % 1;
      const x = d.x + Math.sin(t0f() * .5 + d.ph) * .012;
      const a = (.28 + .3 * Math.sin(t0f() * 1.7 + d.ph * 3)) * dim;
      beamCtx.beginPath();
      beamCtx.arc(x * w, yy * h, d.r, 0, 7);
      beamCtx.fillStyle = `rgba(${PAL.dust},${Math.max(0, a)})`;
      beamCtx.fill();
    }
  });

  // 分本字幕卡：进场后常驻（淡出会让幕尾空场，用户点名修过）
  for (const id of ['i1', 'i2', 'i3', 'i4'] as FilmSceneId[]) {
    scene(id, (p) => {
      const box = q<HTMLElement>(`[data-scene="${id}"] .bz-film-inter`);
      if (!box) return;
      box.style.opacity = String(easeOut(clamp01(p / .2)));
      box.style.transform = `translateY(${((1 - easeOut(clamp01(p / .3))) * 18).toFixed(1)}px) scale(${(1 + p * .05).toFixed(3)})`;
      const h2 = box.querySelector<HTMLElement>('h2');
      if (h2) h2.style.letterSpacing = `${lerp(.9, .5, easeOut(clamp01(p / .35))).toFixed(2)}em`;
    });
  }

  // 馆藏长廊：相机推进（行程 = 12 行 × 470 − 620，与 HTML 里 --z 分布一致）
  scene('s1', (p) => {
    const inner = ref('corr');
    if (inner) inner.style.transform = `translate3d(0,0,${(p * 2940).toFixed(0)}px)`;
  });

  // 评分星云：星落位 → 高分轨迹连线 → 平均分翻牌 + 前三升起
  const nebCtx = cv('nebula');
  const NEB_RMIN = Math.min(...data.rated.map((it) => it.rating ?? 0), 10) - .4;
  const nebStars = data.rated.map((it) => ({
    it,
    nx: data.yearMin === data.yearMax ? .5 : (Number((it.watchDate ?? '').slice(0, 4)) - data.yearMin) / Math.max(1, data.yearMax - data.yearMin),
    ny: 1 - clamp01(((it.rating ?? 5) - NEB_RMIN) / Math.max(.5, 10.2 - NEB_RMIN)),
    r: 1.1 + (it.rating ?? 5) * .3,
    gold: !/[剧漫]/.test(it.typeTag),
    ph: Math.random() * 7,
    sx: Math.random() - .5, sy: (Math.random() - .5) * 1.4,
  }));
  const nebMinis = all<HTMLElement>('.bz-film-mini');
  const avgEl = ref('avg');
  scene('s2', (p, r, vh) => {
    if (!nebCtx) return;
    const w = r.width, h = vh;
    nebCtx.clearRect(0, 0, w, h);
    const land = easeOut(clamp01(p / .55));
    const px = (s: (typeof nebStars)[number]): number => w * (.12 + s.nx * .76) + s.sx * (1 - land) * w * .5;
    const py = (s: (typeof nebStars)[number]): number => h * (.16 + s.ny * .58) + s.sy * (1 - land) * h * .5;
    const lineA = clamp01((p - .38) / .22);
    if (lineA > 0) {
      const path = [...nebStars].sort((a, b) => (a.it.watchDate ?? '') < (b.it.watchDate ?? '') ? -1 : 1).slice(0, 10);
      nebCtx.beginPath();
      path.forEach((s, i) => { const X = px(s), Y = py(s); i ? nebCtx.lineTo(X, Y) : nebCtx.moveTo(X, Y); });
      nebCtx.strokeStyle = `rgba(${PAL.gold},${.28 * lineA})`;
      nebCtx.lineWidth = 1;
      nebCtx.stroke();
    }
    const tn = performance.now() / 1000;
    for (const s of nebStars) {
      const X = px(s), Y = py(s);
      const tw = .72 + .28 * Math.sin(tn * 2.1 + s.ph);
      const a = clamp01(p * 3) * tw;
      const R = 9 + (s.it.rating ?? 5) * 2.2;
      const g = nebCtx.createRadialGradient(X, Y, 0, X, Y, R);
      const col = s.gold ? PAL.star : PAL.star2;
      g.addColorStop(0, `rgba(${col},${a * .8})`);
      g.addColorStop(.4, `rgba(${col},${a * .2})`);
      g.addColorStop(1, `rgba(${col},0)`);
      nebCtx.beginPath(); nebCtx.arc(X, Y, R, 0, 7); nebCtx.fillStyle = g; nebCtx.fill();
      nebCtx.beginPath(); nebCtx.arc(X, Y, s.r * .8, 0, 7);
      nebCtx.fillStyle = `rgba(${PAL.core},${a})`; nebCtx.fill();
    }
    if (avgEl) avgEl.textContent = (data.avgRating * easeOut(clamp01((p - .55) / .45))).toFixed(1);
    nebMinis.forEach((el, i) => {
      const rp = clamp01((p - (.6 + i * .1)) / .22);
      el.style.opacity = String(rp);
      el.style.transform = `translateY(${((1 - easeOut(rp)) * 24).toFixed(1)}px)`;
    });
  });

  // 年份浪潮：浪体填充 + 浪脊线 + 浪尖光点 + 年份标签
  const waveCtx = cv('wave');
  const waveNum = ref('wave');
  scene('s10', (p, r, vh) => {
    if (!waveCtx || !data.yearArr.length) return;
    const w = r.width, h = vh;
    waveCtx.clearRect(0, 0, w, h);
    const n = data.yearArr.length;
    const vmax = Math.max(...data.yearArr.map(([, v]) => v));
    const X = (i: number): number => w * .1 + (i / Math.max(1, n - 1)) * w * .8;
    const Y = (v: number): number => h * .8 - (v / vmax) * h * .48;
    const reach = easeOut(p) * (n - 1);
    const full = Math.floor(reach);
    waveCtx.beginPath();
    waveCtx.moveTo(X(0), h * .8);
    for (let i = 0; i <= full; i++) waveCtx.lineTo(X(i), Y(data.yearArr[i][1]));
    if (full < n - 1) {
      const frac = reach - full;
      waveCtx.lineTo(lerp(X(full), X(full + 1), frac), lerp(Y(data.yearArr[full][1]), Y(data.yearArr[full + 1][1]), frac));
    }
    waveCtx.lineTo(X(full), h * .8);
    waveCtx.closePath();
    const gf = waveCtx.createLinearGradient(0, h * .3, 0, h * .8);
    gf.addColorStop(0, `rgba(${PAL.gold},.3)`);
    gf.addColorStop(1, `rgba(${PAL.gold},.02)`);
    waveCtx.fillStyle = gf;
    waveCtx.fill();
    waveCtx.beginPath();
    for (let i = 0; i <= full; i++) { const X2 = X(i), Y2 = Y(data.yearArr[i][1]); i ? waveCtx.lineTo(X2, Y2) : waveCtx.moveTo(X2, Y2); }
    if (full < n - 1) {
      const frac = reach - full;
      waveCtx.lineTo(lerp(X(full), X(full + 1), frac), lerp(Y(data.yearArr[full][1]), Y(data.yearArr[full + 1][1]), frac));
    }
    waveCtx.strokeStyle = `rgba(${PAL.star},.9)`;
    waveCtx.lineWidth = 2;
    waveCtx.stroke();
    waveCtx.font = '11px "Noto Serif SC",serif';
    waveCtx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const passed = i <= reach;
      waveCtx.fillStyle = passed ? `rgba(${PAL.dim},.95)` : `rgba(${PAL.faint},.6)`;
      waveCtx.fillText(data.yearArr[i][0], X(i), h * .8 + 24);
      if (passed) {
        waveCtx.fillStyle = `rgba(${PAL.ink},.9)`;
        waveCtx.fillText(String(data.yearArr[i][1]), X(i), Y(data.yearArr[i][1]) - 14);
      }
    }
    if (waveNum) waveNum.textContent = String(Math.round(data.peakYear[1] * easeOut(clamp01(p / .8))));
  });

  // 放映编年：胶片卷横移
  scene('s3', (p) => {
    const strip = ref('strip');
    if (!strip) return;
    const over = Math.max(0, strip.scrollWidth - strip.clientWidth);
    strip.style.transform = `translateX(${(-p * over).toFixed(1)}px)`;
  });

  // 十二档期：玫瑰扫开
  const dialCtx = cv('dial');
  const dialNum = ref('dial');
  scene('s11', (p, r, vh) => {
    if (!dialCtx) return;
    const w = r.width, h = vh;
    dialCtx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * .52, Rmax = Math.min(w, h) * .34;
    const vmax = Math.max(...data.monthN, 1);
    const sweep = easeOut(p) * Math.PI * 2;
    for (let i = 0; i < 12; i++) {
      const a0 = -Math.PI / 2 + i * Math.PI / 6;
      const a1 = a0 + Math.PI / 6;
      if (sweep <= a0 + .01) break;
      const end = Math.min(a1, sweep);
      const rad = Rmax * (.3 + .7 * (data.monthN[i] / vmax));
      const hot = data.monthN[i] === Math.max(...data.monthN);
      dialCtx.beginPath();
      dialCtx.moveTo(cx, cy);
      dialCtx.arc(cx, cy, rad, a0, end);
      dialCtx.closePath();
      dialCtx.fillStyle = hot ? `rgba(${PAL.star},.55)` : `rgba(${PAL.gold},${.12 + .3 * (data.monthN[i] / vmax)})`;
      dialCtx.fill();
      dialCtx.strokeStyle = `rgba(${PAL.ink},.14)`;
      dialCtx.stroke();
      const am = (a0 + a1) / 2;
      dialCtx.font = '12px "Noto Serif SC",serif';
      dialCtx.textAlign = 'center';
      dialCtx.fillStyle = hot ? `rgba(${PAL.star},.95)` : `rgba(${PAL.dim},.75)`;
      dialCtx.fillText(`${i + 1}月`, cx + Math.cos(am) * (Rmax + 26), cy + Math.sin(am) * (Rmax + 26) + 4);
      if (data.monthN[i]) {
        dialCtx.fillStyle = `rgba(${PAL.ink},.85)`;
        dialCtx.fillText(String(data.monthN[i]), cx + Math.cos(am) * (rad - 14), cy + Math.sin(am) * (rad - 14) + 4);
      }
    }
    if (dialNum) dialNum.textContent = `${data.peakMonth + 1} 月`;
  });

  // 本周排片：柱逐日翻入 + 票根逐张落位
  const dayEls = all<HTMLElement>('.bz-film-day');
  scene('s12', (p) => {
    dayEls.forEach((d, i) => {
      const rp = easeOut(clamp01((p - (.12 + i * .09)) / .22));
      d.style.opacity = String(rp);
      d.style.transform = `translateY(${((1 - rp) * 30).toFixed(1)}px)`;
      d.querySelectorAll<HTMLElement>('.bz-film-stub').forEach((s, k) => {
        const sp = clamp01((p - (.2 + i * .09) - k * .012) / .1);
        s.style.opacity = String(sp);
        s.style.transform = `rotate(${((k * 37) % 13) - 6}deg) scale(${sp.toFixed(2)})`;
      });
    });
  });

  // 霓虹片街：逐块点亮
  const neonCols = all<HTMLElement>('.bz-film-neon-col');
  scene('s4', (p) => {
    neonCols.forEach((col, i) => col.classList.toggle('is-lit', p > (i + .5) / (neonCols.length + 1)));
  });

  // 修片馆：尘屑划痕画布 + 「修复」褪色
  const ageCtx = cv('agefx');
  const ageNum = ref('age');
  const AGEDUST = Array.from({ length: 42 }, () => ({
    x: Math.random(), y: Math.random(), r: .5 + Math.random() * 1.4,
    v: .0003 + Math.random() * .0009, ph: Math.random() * 7,
  }));
  const SCRATCHES = Array.from({ length: 4 }, (_, i) => ({ x: .12 + i * .22 + Math.random() * .1, ph: Math.random() * 7 }));
  const shelves = all<HTMLElement>('.bz-film-shelf');
  scene('s13', (p, r, vh) => {
    if (ageNum) ageNum.textContent = (Number(data.avgAge) * easeOut(clamp01(p / .6))).toFixed(1);
    shelves.forEach((sh, i) => {
      const rp = easeOut(clamp01((p - (.2 + i * .15)) / .25));
      sh.style.opacity = String(rp);
      sh.style.transform = `translateY(${((1 - rp) * 26).toFixed(1)}px)`;
      const tint = Number(sh.dataset.tint ?? .5);
      sh.querySelectorAll<HTMLElement>('.sp img, .sp .bz-film-ph').forEach((im) => {
        im.style.filter = `sepia(${lerp(1, tint, rp).toFixed(2)}) contrast(.96)`;
      });
    });
    if (!ageCtx) return;
    const w = r.width, h = vh, t = performance.now() / 1000;
    ageCtx.clearRect(0, 0, w, h);
    for (const d of AGEDUST) {
      const yy = ((d.y - t * d.v) % 1 + 1) % 1;
      const a = .16 + .2 * Math.sin(t * 1.4 + d.ph * 3);
      ageCtx.beginPath();
      ageCtx.arc(d.x * w, yy * h, d.r, 0, 7);
      ageCtx.fillStyle = `rgba(${PAL.dust},${Math.max(0, a)})`;
      ageCtx.fill();
    }
    for (const s of SCRATCHES) {
      const a = Math.max(0, Math.sin(t * .8 + s.ph)) ** 6 * .3;
      if (a < .02) continue;
      ageCtx.fillStyle = `rgba(${PAL.dust},${a})`;
      ageCtx.fillRect(s.x * w + Math.sin(t + s.ph) * 2, 0, 1, h);
    }
  });

  // 导演特展：追光走位
  const spot = ref('spot');
  const plaques = all<HTMLElement>('.bz-film-plaque');
  scene('s14', (p) => {
    if (!plaques.length) return;
    const lit = Math.min(plaques.length - 1, Math.max(0, Math.floor(easeOut(clamp01((p - .18) / .72)) * plaques.length)));
    plaques.forEach((el, i) => {
      const rp = easeOut(clamp01((p - (.1 + i * .12)) / .24));
      el.style.opacity = String(rp * (i === lit ? 1 : .62));
      el.style.transform = `translateY(${((1 - rp) * 30).toFixed(1)}px)`;
      el.classList.toggle('is-lit', i === lit);
    });
    if (spot) {
      const rr = plaques[lit].getBoundingClientRect();
      spot.style.transform = `translateX(${(rr.left + rr.width / 2 - innerWidth * .5).toFixed(1)}px)`;
      spot.style.opacity = String(clamp01(p * 2.5));
    }
  });

  // 群像长卷：幽灵大字 + 领头卡翻正
  const paradeStrip = ref('parade');
  const ghost = ref('ghost');
  const starCards = all<HTMLElement>('.bz-film-star');
  scene('s15', (p) => {
    if (!paradeStrip) return;
    const over = Math.max(0, paradeStrip.scrollWidth - sc.clientWidth);
    paradeStrip.style.transform = `translateX(${(-easeOut(p) * over).toFixed(1)}px)`;
    for (const el of starCards) {
      const left = el.getBoundingClientRect().left;
      const k = easeOut(clamp01((innerWidth * 1.06 - left) / (innerWidth * .55)));
      el.style.transform = `perspective(900px) rotateY(${((1 - k) * 26).toFixed(1)}deg)`;
    }
    const lead = starCards.find((el) => el.getBoundingClientRect().right > innerWidth * .4);
    if (lead && ghost) {
      const nm = lead.querySelector<HTMLElement>('.nm')?.textContent ?? '';
      if (ghost.textContent !== nm) ghost.textContent = nm;
    }
  });

  // 打分天平：衡器起摆
  const armEl = ref('arm');
  const panL = ref('panL');
  const panR = ref('panR');
  const diffNum = ref('diff');
  scene('s16', (p) => {
    if (diffNum) diffNum.textContent = (data.avgDiff >= 0 ? '+' : '') + (data.avgDiff * easeOut(clamp01(p / .6))).toFixed(1);
    if (armEl) {
      const tilt = Math.max(-12, Math.min(12, (data.disappoint.length - data.treasure.length) * 5));
      armEl.style.transform = `rotate(${(tilt * easeOutBack(clamp01(p / .5))).toFixed(2)}deg)`;
    }
    if (panL) {
      panL.style.opacity = String(easeOut(clamp01((p - .15) / .25)));
      panL.style.transform = `translateX(${((1 - easeOut(clamp01((p - .15) / .3))) * -40).toFixed(1)}px)`;
    }
    if (panR) {
      panR.style.opacity = String(easeOut(clamp01((p - .4) / .25)));
      panR.style.transform = `translateX(${((1 - easeOut(clamp01((p - .4) / .3))) * 40).toFixed(1)}px)`;
    }
  });

  // 连映夜：海报堆展开成扇面
  const maroEls = all<HTMLElement>('.bz-film-maro');
  scene('s17', (p) => {
    maroEls.forEach((el, i) => {
      const rp = easeOut(clamp01((p - (.15 + i * .18)) / .3));
      el.style.opacity = String(rp);
      el.style.transform = `translateX(${((1 - rp) * -40).toFixed(1)}px)`;
      const stack = el.querySelector<HTMLElement>('.stack');
      const kids = stack ? ([...stack.children] as HTMLElement[]) : [];
      kids.forEach((c, k) => {
        const off = k - (kids.length - 1) / 2;
        c.style.transform = `rotate(${(off * rp * 8).toFixed(1)}deg) translateY(${(Math.abs(off) * rp * 5).toFixed(1)}px)`;
      });
    });
  });

  // 追剧深度：胶片圈逐颗点亮
  const bingeNum = ref('binge');
  const bingeRows = all<HTMLElement>('.bz-film-brow');
  scene('s18', (p) => {
    if (bingeNum) bingeNum.textContent = (Number(data.avgSeason) * easeOut(clamp01(p / .6))).toFixed(1);
    bingeRows.forEach((el, i) => {
      const rp = easeOut(clamp01((p - (.15 + i * .13)) / .28));
      el.style.opacity = String(rp);
      el.style.transform = `translateX(${((1 - rp) * -30).toFixed(1)}px)`;
      el.querySelectorAll<HTMLElement>('.rl').forEach((c, k) => {
        const kp = easeOut(clamp01((p - (.18 + i * .13) - k * .045) / .1));
        c.style.opacity = String(kp);
        c.style.transform = `scale(${(.5 + .5 * kp).toFixed(2)})`;
      });
    });
  });

  // 弹幕影评：金句横飞
  const dmCtx = cv('dm');
  const dmNum = ref('dm');
  scene('s19', (p, r, vh) => {
    if (!dmCtx) return;
    const w = r.width, h = vh;
    dmCtx.clearRect(0, 0, w, h);
    if (dmNum) dmNum.textContent = String(Math.round(data.reviewCount * easeOut(clamp01(p / .5))));
    const n = data.dmLines.length;
    if (!n) return;
    const rows = 9;
    for (let i = 0; i < n; i++) {
      const line = data.dmLines[i];
      if (i / n >= p * 1.15) continue;
      const row = i % rows;
      const cycle = (p * 2.2 + i * .618) % 1;
      const x = w * .92 - cycle * w * 1.5;
      const y = h * .3 + row * (h * .56 / rows);
      const alpha = Math.min(1, Math.sin(cycle * Math.PI) * 1.6) * clamp01(p * 2);
      dmCtx.font = `${line.hit ? 21 : 14}px "Noto Serif SC",serif`;
      dmCtx.fillStyle = line.hit ? `rgba(${PAL.star},${alpha})` : `rgba(${PAL.ink},${alpha * .8})`;
      if (line.hit) {
        dmCtx.shadowColor = `rgba(${PAL.gold},.8)`;
        dmCtx.shadowBlur = 18;
      }
      dmCtx.fillText(`「${line.text}」`, x, y);
      dmCtx.shadowBlur = 0;
    }
  });

  // 名人堂：金色光芒 + 卡面掠金
  const rays = ref('rays');
  const awards = all<HTMLElement>('.bz-film-award');
  scene('s5', (p) => {
    if (rays) {
      rays.style.opacity = String(clamp01(p * 2.2) * .9);
      rays.style.transform = `rotate(${(p * 150).toFixed(1)}deg)`;
    }
    awards.forEach((el, i) => {
      const rp = easeOut(clamp01((p - .02 - i * .2) * 3));
      el.style.opacity = String(rp);
      el.style.transform = `rotateX(${((1 - rp) * -62).toFixed(1)}deg) translateY(${((1 - rp) * 30).toFixed(1)}px)`;
      el.style.setProperty('--sh', `${(125 - rp * 250).toFixed(0)}% 0`);
    });
  });

  // 片尾致谢：字幕上滚 + 剧终圆擦
  const roll = ref('roll');
  const theend = ref('theend');
  scene('s6', (p, _r, vh) => {
    if (roll) {
      const rollH = roll.offsetHeight;
      roll.style.transform = `translateY(${lerp(vh * .75, -(rollH + 80), p * p).toFixed(1)}px)`;
    }
    if (theend) {
      const ep = clamp01((p - .88) / .12);
      theend.style.opacity = String(ep);
      theend.style.clipPath = `circle(${(easeOut(ep) * 74).toFixed(1)}% at 50% 50%)`;
    }
  });

  // 下档预告：探照灯（CSS）+ 卡片升起 + 待映邮戳砸落
  const nextCards = all<HTMLElement>('.bz-film-next');
  const replayBtn = ref('replay');
  scene('s7', (p) => {
    nextCards.forEach((el, i) => {
      const rp = easeOut(clamp01((p - .12 - i * .14) / .3));
      el.style.opacity = String(rp);
      el.style.transform = `translateY(${((1 - rp) * 40).toFixed(1)}px) rotateX(${((1 - rp) * 14).toFixed(1)}deg)`;
      const st = el.querySelector<HTMLElement>('.stamp');
      if (st) {
        const kp = easeOutBack(clamp01((p - (.3 + i * .14)) / .18));
        st.style.opacity = String(clamp01(kp * 1.4));
        st.style.transform = `rotate(-14deg) scale(${lerp(3, 1, kp).toFixed(2)})`;
      }
    });
    if (replayBtn) replayBtn.style.opacity = String(clamp01((p - .6) / .25));
  });

  // 重映按钮：回到片头放倒计时
  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-ref="replay"]')) playScene('s0');
  });

  // ── 主循环：幕内放映 + 逐幕驱动 + 颗粒；root 脱离 DOM 即自灭 ──
  const grainCtx = cv('grain');
  let grainPat: CanvasPattern | null = null;
  const grainCv = q<HTMLCanvasElement>('[data-cv="grain"]');
  {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    if (x) {
      const d = x.createImageData(128, 128);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = Math.random() * 255;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 26;
      }
      x.putImageData(d, 0, 0);
      grainPat = grainCtx ? grainCtx.createPattern(c, 'repeat') : null;
    }
  }

  let lastT = 0;
  let grainFrame = 0;
  let lastVh = -1;
  const tick = (): void => {
    if (engine.dead || !root.isConnected) {
      if (activeEngine === engine) activeEngine = null;
      return; // 整刷重建 / 面板关闭：引擎自灭
    }
    const now = performance.now();
    const dt = Math.min(.05, lastT ? (now - lastT) / 1000 : 0);
    lastT = now;
    const vh = sc.clientHeight;
    if (vh !== lastVh) { lastVh = vh; size(); }
    // 幕内放映：从当前幕的开头放到它的 sticky 末端，放完即停
    if (film.playing) {
      const el = sceneEl(film.scene);
      if (el) {
        const end = Math.min(sc.scrollHeight - vh, absTop(el) + el.offsetHeight - vh);
        const target = sc.scrollTop + SPEED * filmRateOf(film.scene) * dt;
        if (target >= end) {
          sc.scrollTop = end;
          film.playing = false;
          film.sceneDone = true;
        } else sc.scrollTop = target;
      } else film.playing = false;
    }
    // 逐幕驱动（只驱动可见幕）
    let active: FilmSceneId = film.scene;
    for (const s of scenes) {
      const r = s.el.getBoundingClientRect();
      const total = r.height - vh;
      const p = total > 0 ? clamp01(-r.top / total) : 0;
      if (r.top < vh && r.bottom > 0) {
        s.update(p, r, vh);
        active = s.id;
      }
    }
    const nowEl = ref('now');
    if (nowEl && nowEl.textContent !== (FILM_SCENE_NAMES[active] ?? '')) nowEl.textContent = FILM_SCENE_NAMES[active] ?? '';
    const dot = ref('dot');
    const totalScroll = sc.scrollHeight - vh;
    if (dot) dot.style.top = `${((totalScroll ? sc.scrollTop / totalScroll : 0) * 100).toFixed(2)}%`;
    // 颗粒：每 3 帧换一次噪声底
    if (++grainFrame % 3 === 0 && grainCtx && grainPat && grainCv) {
      grainCtx.save();
      grainCtx.translate(Math.random() * 128 | 0, Math.random() * 128 | 0);
      grainCtx.fillStyle = grainPat;
      grainCtx.fillRect(-128, -128, grainCv.width + 256, grainCv.height + 256);
      grainCtx.restore();
    }
    nextFrame(tick);
  };
  nextFrame(tick);

  return handle;
}
