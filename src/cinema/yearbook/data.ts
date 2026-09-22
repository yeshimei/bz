/**
 * 观影志 · 数据派生（纯函数，零 DOM）
 *
 * 口径来源：**只认笔记 frontmatter 里真有的字段**（`我的/影视/*.md`，686 篇实测）——
 *   观影日期 / 评分（我的） / 豆瓣评分 / 片长 / 季集 / 类型 / 制片国家·地区 /
 *   上映日期 / 导演 / 主演 / 影评 / 热门短评 / 海报 / tags（→ typeTag·group）
 * 缺字段一律返回 null/空，不补默认值、不造数（旧稿曾对没有的字段编数据，已废弃）。
 * 与 analysis 的旧口径无关：本层是新写的，字段解析在 data.ts parseMovieFile 之后。
 */
import type { CinemaItem } from '../state';
import { STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED } from '../constants';

/* ─────────── 类型 ─────────── */

/** 上屏片名（01 开卷的粒子第二靶点 + 26 落款副题共用一份）。
 *  2026-09-21 用户拍板：原来的三字改「观影分析」四字——代码域名词仍留 yearbook / 观影志。 */
export const YB_TITLE = '观影分析';

export interface YbYear { y: number; films: CinemaItem[] }
export interface YbRank { name: string; films: CinemaItem[] }
export interface YbSeries { base: string; films: CinemaItem[] }
export interface YbEps { base: string; ep: number; films: CinemaItem[] }
export interface YbBin { label: string; lo: number; hi: number; films: CinemaItem[] }
export interface YbText { name: string; text: string; rating: number | null }
export interface YbDiff { it: CinemaItem; diff: number }
export interface YbTool { label: string; films: CinemaItem[] }
export interface YbMatrix { cols: string[]; rows: string[]; n: number[][]; max: number }
/** 评分散点：一部片一个点（x = 观影年，y = 我的评分） */
export interface YbScatter { y: number; r: number; it: CinemaItem }
/** 片龄点：观影年 − 上映年（片龄横轴上的一枚海报刻度） */
export interface YbAgeDot { age: number; it: CinemaItem }
/** 类型共现对（同一部片同时挂两个类型） */
export interface YbPair { a: string; b: string; n: number }
/** 单片片长（胶片盘按真实比例绕） */
export interface YbDur { min: number; it: CinemaItem }

export interface YbData {
  /* 总量 */
  total: number;
  watchedCount: number;
  wantCount: number;
  watchingCount: number;
  typeGroups: YbRank[];
  ratedCount: number;

  /* 时间 */
  years: YbYear[];
  yearMin: number;
  yearMax: number;
  months: number[];
  peakMonth: number;
  weekN: number[];
  peakDay: number;
  weekendN: number;
  days: Map<string, CinemaItem[]>;
  busiest: { date: string; films: CinemaItem[] };
  streak: { days: number; from: string; to: string; films: CinemaItem[] };
  spanDays: number;
  monthFreq: string;

  /* 片长 */
  minutes: number[];
  totalMinutes: number;
  avgMinutes: number;
  bins: YbBin[];
  longest: CinemaItem | null;
  longestMin: number;
  shortest: CinemaItem | null;
  shortestMin: number;

  /* 口味 */
  genres: YbRank[];
  regions: YbRank[];
  matrix: YbMatrix;
  releaseYears: { y: number; n: number }[];
  oldest: CinemaItem | null;
  newest: CinemaItem | null;
  ageBuckets: YbTool[];
  avgAge: string;

  /* 评分 */
  rated: CinemaItem[];
  myHist: number[];
  dbHist: number[];
  avgMine: number;
  avgDb: number;
  avgDiff: number;
  diffs: YbDiff[];
  treasure: CinemaItem[];
  disappoint: CinemaItem[];
  top3: CinemaItem[];
  nineUp: CinemaItem[];
  tenUp: number;

  /* 人 */
  directors: YbRank[];
  actors: YbRank[];
  series: YbSeries[];
  episodes: YbEps[];
  /** 季集字段有值的条目数（真库 205 部） */
  epItems: number;
  /** 集数合计：所有有季集的条目相加（不是「每组取最大」——那会漏掉中间的季） */
  epTotal: number;

  /* 文字 */
  reviews: YbText[];
  hotComments: YbText[];

  /* 海报 */
  posters: CinemaItem[];

  /* 升级批新增（布局/动效要用） */
  /** 评分散点（有日期 + 有分的已看） */
  scatter: YbScatter[];
  /** 片龄点（有上映年 + 有观影日期），按片龄降序 */
  ageDots: YbAgeDot[];
  /** 类型共现对（n ≥ 2，取前 12） */
  genrePairs: YbPair[];
  /** 单片片长（有片长的条目，升序） */
  durFilms: YbDur[];
}

const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const YB_WEEK = WEEK_NAMES;

/** 片长原文 → 分钟（「124分钟」「45分钟/集」「1小时30分」；取不到返回 null，不猜） */
export function parseMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw);
  const hm = s.match(/(\d+)\s*小时\s*(\d+)?\s*分?/);
  if (hm) return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
  const m = s.match(/(\d+)\s*分/);
  if (m) return Number(m[1]);
  const bare = s.match(/^\s*(\d+)\s*$/);
  return bare ? Number(bare[1]) : null;
}

/** 季集原文 → 集数（「13」= 13 集；「622X」= 622 集（X 表抓取存疑，仍按数）；取不到 null） */
export function parseEpisodes(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** 观影日（YYYY-MM-DD；带时刻的只取日期位） */
export const dayOf = (it: CinemaItem): string | null =>
  it.watchDate ? String(it.watchDate).slice(0, 10) : null;

const byDate = (a: CinemaItem, b: CinemaItem): number =>
  (dayOf(a) ?? '') < (dayOf(b) ?? '') ? -1 : 1;

/** 计数降序（同数按名称稳定） */
const rankOf = (m: Map<string, CinemaItem[]>): YbRank[] =>
  [...m.entries()].map(([name, films]) => ({ name, films }))
    .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name, 'zh'));

const splitList = (raw: string | null | undefined): string[] =>
  String(raw ?? '').split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);

/** 全量派生（items 为 parseMovieFile 之后的影院条目） */
export function deriveYb(items: CinemaItem[]): YbData {
  const watched = items.filter((it) => it.status === STATUS_WATCHED);
  const want = items.filter((it) => it.status === STATUS_WANT);
  const watching = items.filter((it) => it.status === STATUS_WATCHING);

  /* 类型分组（tags → typeTag，真实 12 类） */
  const groupMap = new Map<string, CinemaItem[]>();
  for (const it of items) {
    const k = it.typeTag || '未分类';
    (groupMap.get(k) ?? groupMap.set(k, []).get(k)!).push(it);
  }

  /* 时间轴 */
  const dated = watched.filter((it) => !!dayOf(it)).sort(byDate);
  const years: YbYear[] = [];
  for (const it of dated) {
    const y = Number(dayOf(it)!.slice(0, 4));
    const last = years[years.length - 1];
    if (last && last.y === y) last.films.push(it);
    else years.push({ y, films: [it] });
  }
  const months = Array<number>(12).fill(0);
  for (const it of dated) months[Number(dayOf(it)!.slice(5, 7)) - 1]++;
  const weekN = [0, 0, 0, 0, 0, 0, 0];
  for (const it of dated) weekN[(new Date(`${dayOf(it)}T00:00:00`).getDay() + 6) % 7]++;
  const days = new Map<string, CinemaItem[]>();
  for (const it of dated) {
    const d = dayOf(it)!;
    (days.get(d) ?? days.set(d, []).get(d)!).push(it);
  }
  let busiest = { date: '', films: [] as CinemaItem[] };
  for (const [date, films] of days) if (films.length > busiest.films.length || (films.length === busiest.films.length && date < busiest.date)) busiest = { date, films };
  // 最长连续观影（相邻两天都看过）
  const sortedDays = [...days.keys()].sort();
  let streak = { days: 0, from: '', to: '', films: [] as CinemaItem[] };
  let runStart = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    if (i > 0) {
      const gap = (Date.parse(sortedDays[i]) - Date.parse(sortedDays[i - 1])) / 86400000;
      if (gap !== 1) runStart = i;
    }
    const len = i - runStart + 1;
    if (len > streak.days) {
      const slice = sortedDays.slice(runStart, i + 1);
      streak = { days: len, from: slice[0], to: slice[slice.length - 1], films: slice.flatMap((d) => days.get(d) ?? []) };
    }
  }
  const spanDays = sortedDays.length ? Math.round((Date.parse(sortedDays[sortedDays.length - 1]) - Date.parse(sortedDays[0])) / 86400000) + 1 : 0;
  const monthFreq = new Set(dated.map((it) => dayOf(it)!.slice(0, 7))).size
    ? (dated.length / new Set(dated.map((it) => dayOf(it)!.slice(0, 7))).size).toFixed(1) : '0';

  /* 片长（watch 过的 + 有片长） */
  const minutes: number[] = [];
  let longest: CinemaItem | null = null, longestMin = 0, shortest: CinemaItem | null = null, shortestMin = 0;
  for (const it of items) {
    const m = parseMinutes(it.duration);
    if (m === null) continue;
    minutes.push(m);
    if (m > longestMin) { longestMin = m; longest = it; }
    if (!shortestMin || m < shortestMin) { shortestMin = m; shortest = it; }
  }
  const totalMinutes = minutes.reduce((s, m) => s + m, 0);
  const BIN_DEF: [string, number, number][] = [['≤59 分', 0, 59], ['60–89 分', 60, 89], ['90–119 分', 90, 119], ['120–149 分', 120, 149], ['≥150 分', 150, 1e9]];
  const bins: YbBin[] = BIN_DEF.map(([label, lo, hi]) => ({
    label, lo, hi,
    films: items.filter((it) => { const m = parseMinutes(it.duration); return m !== null && m >= lo && m <= hi; }),
  }));

  /* 口味 */
  const genreMap = new Map<string, CinemaItem[]>(), regionMap = new Map<string, CinemaItem[]>();
  for (const it of items) {
    for (const g of splitList(it.genre)) (genreMap.get(g) ?? genreMap.set(g, []).get(g)!).push(it);
    for (const r of splitList(it.region)) (regionMap.get(r) ?? regionMap.set(r, []).get(r)!).push(it);
  }
  const genres = rankOf(genreMap);
  const regions = rankOf(regionMap);
  const mCols = genres.slice(0, 6).map((g) => g.name);
  const mRows = regions.slice(0, 6).map((r) => r.name);
  const matrix: YbMatrix = {
    cols: mCols, rows: mRows, max: 0,
    n: mRows.map((r) => mCols.map((c) => items.filter((it) => splitList(it.genre).includes(c) && splitList(it.region).includes(r)).length)),
  };
  matrix.max = Math.max(1, ...matrix.n.flat());

  const relYear = (it: CinemaItem): number | null => {
    const y = Number(it.year);
    return Number.isFinite(y) && y > 1800 ? y : null;
  };
  const relCount = new Map<number, number>();
  for (const it of items) { const y = relYear(it); if (y !== null) relCount.set(y, (relCount.get(y) ?? 0) + 1); }
  const releaseYears = [...relCount.entries()].map(([y, n]) => ({ y, n })).sort((a, b) => a.y - b.y);
  let oldest: CinemaItem | null = null, newest: CinemaItem | null = null;
  for (const it of items) {
    const y = relYear(it); if (y === null) continue;
    if (!oldest || y < Number(oldest.year)) oldest = it;
    if (!newest || y > Number(newest.year)) newest = it;
  }
  const TOOLS: [string, (a: number) => boolean][] = [['当年', (a) => a <= 0], ['1–3 年', (a) => a > 0 && a <= 3], ['4–10 年', (a) => a > 3 && a <= 10], ['≥10 年', (a) => a > 10]];
  const ageBuckets: YbTool[] = TOOLS.map(([label, hit]) => ({
    label,
    films: watched.filter((it) => {
      const y = relYear(it), d = dayOf(it);
      if (y === null || !d) return false;
      return hit(Number(d.slice(0, 4)) - y);
    }),
  }));
  const ageVals: number[] = [];
  for (const it of watched) { const y = relYear(it), d = dayOf(it); if (y !== null && d) ageVals.push(Number(d.slice(0, 4)) - y); }
  const avgAge = ageVals.length ? (ageVals.reduce((s, a) => s + a, 0) / ageVals.length).toFixed(1) : '0';

  /* 评分 */
  const rated = items.filter((it) => it.status === STATUS_WATCHED && (it.rating ?? 0) > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byDate(a, b));
  const myHist = Array<number>(11).fill(0), dbHist = Array<number>(11).fill(0);
  for (const it of rated) myHist[Math.max(0, Math.min(10, Math.round(it.rating ?? 0)))]++;
  const withDb = rated.filter((it) => it.doubanRating && Number.isFinite(parseFloat(it.doubanRating)));
  for (const it of withDb) dbHist[Math.max(0, Math.min(10, Math.round(parseFloat(it.doubanRating!))))]++;
  const avgMine = rated.length ? rated.reduce((s, it) => s + (it.rating ?? 0), 0) / rated.length : 0;
  const avgDb = withDb.length ? withDb.reduce((s, it) => s + parseFloat(it.doubanRating!), 0) / withDb.length : 0;
  const diffs: YbDiff[] = withDb.map((it) => ({ it, diff: (it.rating ?? 0) - parseFloat(it.doubanRating!) }))
    .sort((a, b) => b.diff - a.diff);
  const avgDiff = diffs.length ? diffs.reduce((s, d) => s + d.diff, 0) / diffs.length : 0;
  const treasure = diffs.filter((d) => d.diff >= 0.9).slice(0, 4).map((d) => d.it);
  const disappoint = diffs.filter((d) => d.diff <= -1.5).slice(-4).reverse().map((d) => d.it);
  const top3 = rated.slice(0, 3);
  const nineUp = rated.filter((it) => (it.rating ?? 0) >= 9);

  /* 人 */
  const people = (field: 'director' | 'actors'): YbRank[] => {
    const m = new Map<string, CinemaItem[]>();
    for (const it of items) for (const p of splitList(it[field])) (m.get(p) ?? m.set(p, []).get(p)!).push(it);
    return rankOf(m).filter((r) => r.films.length >= 2).slice(0, 6);
  };
  const seriesMap = new Map<string, CinemaItem[]>();
  for (const it of items) {
    const m = String(it.name).match(/^(.*?)\s*第[一二三四五六七八九十0-9]+\s*[季部集]/);
    if (!m || !m[1]) continue;
    (seriesMap.get(m[1]) ?? seriesMap.set(m[1], []).get(m[1])!).push(it);
  }
  const series = [...seriesMap.entries()].map(([base, films]) => ({ base, films }))
    .filter((s) => s.films.length >= 2).sort((a, b) => b.films.length - a.films.length).slice(0, 4);
  const epsMap = new Map<string, { ep: number; films: CinemaItem[] }>();
  for (const it of items) {
    const ep = parseEpisodes(it.seasonText);
    if (ep === null) continue;
    const base = String(it.name).replace(/\s*第[一二三四五六七八九十0-9]+\s*[季部].*/, '');
    const got = epsMap.get(base);
    if (got) { got.ep = Math.max(got.ep, ep); got.films.push(it); }
    else epsMap.set(base, { ep, films: [it] });
  }
  const episodes: YbEps[] = [...epsMap.entries()].map(([base, v]) => ({ base, ep: v.ep, films: v.films }))
    .sort((a, b) => b.ep - a.ep);
  const epVals = items.map((it) => parseEpisodes(it.seasonText)).filter((n): n is number => n !== null);
  const epTotal = epVals.reduce((s2, n) => s2 + n, 0);

  /* 文字（影评取有正文的；短评取 20~90 字，长了放不下） */
  const reviews: YbText[] = items.filter((it) => it.review && String(it.review).trim().length >= 8)
    .sort((a, b) => String(b.review).length - String(a.review).length)
    .slice(0, 8).map((it) => ({ name: it.name, text: String(it.review).trim(), rating: it.rating }));
  const hotComments: YbText[] = items.filter((it) => it.hotComment && String(it.hotComment).trim().length >= 10)
    .map((it) => ({ name: it.name, text: String(it.hotComment).trim(), rating: it.rating }))
    .filter((c) => c.text.length <= 120).slice(0, 60);

  /* 散点 / 片龄点 / 共现对 / 单片片长（升级批） */
  const scatter: YbScatter[] = rated
    .filter((it) => !!dayOf(it))
    .map((it) => ({ y: Number(dayOf(it)!.slice(0, 4)), r: it.rating ?? 0, it }))
    .sort((a, b) => a.y - b.y);
  const ageDots: YbAgeDot[] = [];
  for (const it of watched) {
    const y = relYear(it), d = dayOf(it);
    if (y === null || !d) continue;
    ageDots.push({ age: Number(d.slice(0, 4)) - y, it });
  }
  ageDots.sort((a, b) => b.age - a.age);
  const pairMap = new Map<string, number>();
  for (const it of items) {
    const gs = splitList(it.genre);
    for (let i = 0; i < gs.length; i++) {
      for (let j = i + 1; j < gs.length; j++) {
        const [a, b] = gs[i] < gs[j] ? [gs[i], gs[j]] : [gs[j], gs[i]];
        const k = `${a}|${b}`;
        pairMap.set(k, (pairMap.get(k) ?? 0) + 1);
      }
    }
  }
  const genrePairs: YbPair[] = [...pairMap.entries()]
    .map(([k, n]) => { const [a, b] = k.split('|'); return { a, b, n }; })
    .filter((p2) => p2.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
  const durFilms: YbDur[] = [];
  for (const it of items) {
    const m = parseMinutes(it.duration);
    if (m !== null) durFilms.push({ min: m, it });
  }
  durFilms.sort((a, b) => a.min - b.min);

  return {
    total: items.length, watchedCount: watched.length, wantCount: want.length, watchingCount: watching.length,
    typeGroups: rankOf(groupMap), ratedCount: rated.length,
    years, yearMin: years.length ? years[0].y : 0, yearMax: years.length ? years[years.length - 1].y : 0,
    months, peakMonth: months.indexOf(Math.max(...months)), weekN, peakDay: weekN.indexOf(Math.max(...weekN)),
    weekendN: weekN[5] + weekN[6],
    days, busiest, streak, spanDays, monthFreq,
    minutes, totalMinutes, avgMinutes: minutes.length ? totalMinutes / minutes.length : 0,
    bins, longest, longestMin, shortest, shortestMin,
    genres, regions, matrix, releaseYears, oldest,
    newest, ageBuckets, avgAge,
    rated, myHist, dbHist, avgMine, avgDb, avgDiff, diffs, treasure, disappoint, top3, nineUp,
    tenUp: rated.filter((it) => (it.rating ?? 0) >= 10).length,
    directors: people('director'), actors: people('actors'), series, episodes,
    epItems: epVals.length, epTotal,
    reviews, hotComments,
    posters: items.filter((it) => !!it.poster),
    scatter, ageDots, genrePairs, durFilms,
  };
}

/** 分钟 → 「X 天 Y 小时」（总时长用；不足一天给「Y 小时 Z 分」） */
export function humanMinutes(min: number): string {
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = Math.round(min % 60);
  if (d > 0) return `${d} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分钟`;
}
