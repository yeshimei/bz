/**
 * 影视数据分析 analysis（ticket 15：常量 + ratingBucketOf + buildAnalysisData 48 字段聚合）
 */
import type { App, TFile } from 'obsidian';
import { ALL_TAGS, getGroupForTag, STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED, getMovieFolderPath } from '../movie/constants';
import { tryGetSettings } from '../core/settings-provider';

/** 分析域浅色色板（环形图/图例用） */
export const TYPE_COLORS: Record<string, string> = {
  电影: '#FFE5CC',
  剧集: '#D6E4FF',
  动漫: '#FADDE1',
  纪录片: '#D8F3DC',
  公开课: '#E6DFF5',
};

export const R6to10 = 10 / 6;

export const REVIEW_KEYWORDS = ['好看', '喜欢', '推荐', '经典', '感动', '治愈', '失望', '无聊', '一般', '神作', '烂片', '封神', '震撼', '催泪', '熬夜', '二刷', '满分'];

/** 6 档评分桶 */
export function ratingBucketOf(r: number): string {
  if (r >= 5.5) return '≥5.5';
  if (r >= 5) return '5~5.5';
  if (r >= 4) return '4~5';
  if (r >= 3) return '3~4';
  if (r >= 2) return '2~3';
  return '<2';
}

export interface AnalysisData {
  [key: string]: any;
}

/** 聚合 48 字段分析数据（逐字移植源码 buildAnalysisData，主演计数取单次） */
export function buildAnalysisData(app: App): AnalysisData {
  const data: AnalysisData = {
    total: 0,
    watched: 0,
    watching: 0,
    want: 0,
    ratingSum: 0,
    ratingCount: 0,
    doubanSum: 0,
    doubanCount: 0,
    groups: {},
    tags: {},
    years: {},
    months: {},
    buckets: { '≥5.5': 0, '5~5.5': 0, '4~5': 0, '3~4': 0, '2~3': 0, '<2': 0 },
    genres: {},
    countries: {},
    directors: {},
    actors: {},
    topRated: [],
    wantList: [],
    ageBuckets: { 当年: 0, '1-3年': 0, '4-10年': 0, '≥10年': 0 },
    ageSum: 0,
    ageCount: 0,
    eras: {},
    durBuckets: { '<90': 0, '90-120': 0, '>120': 0 },
    durSum: 0,
    durCount: 0,
    groupDur: {},
    weekdays: [0, 0, 0, 0, 0, 0, 0],
    monthKeys: new Set<string>(),
    diffSum: 0,
    diffCount: 0,
    treasure: [],
    disappoint: [],
    reviewKeywords: {},
    reviewCount: 0,
    reviewCharSum: 0,
    series: {},
    seasonSum: 0,
    seasonCount: 0,
    seasons: [],
    wantDoubanSum: 0,
    wantDoubanCount: 0,
    wantTags: {},
    yearRating: {},
  };

  const folderPath = getAnalysisFolderPath();

  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folderPath + '/'));

  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache || !cache.frontmatter) continue;
    const fm = cache.frontmatter;

    const basename = file.basename;
    const name = basename.match(/《(.+)》/)?.[1] ?? basename;

    // tags → typeTag
    let rawTags = fm.tags;
    if (typeof rawTags === 'string') rawTags = [rawTags];
    const tags: string[] = Array.isArray(rawTags) ? rawTags.map((t: any) => String(t)) : [];
    const typeTag = tags.find((t) => ALL_TAGS.includes(t)) ?? null;
    if (!typeTag) continue;
    const group = getGroupForTag(typeTag);
    if (!group) continue;

    const watchDate = fm['观影日期']?.toString() ?? null;
    const rating = fm['评分'] !== undefined ? Number(fm['评分']) : null;

    let status: number;
    if (fm['状态'] !== undefined) {
      status = Number(fm['状态']);
    } else {
      if (rating === -1) status = STATUS_WANT;
      else if (rating === 0) status = STATUS_WATCHING;
      else if ((rating ?? 0) > 0) status = STATUS_WATCHED;
      else status = STATUS_WATCHED;
    }

    const item = { file, name, typeTag, group, watchDate, rating, status };

    data.total++;
    if (status === STATUS_WATCHED) {
      data.watched++;
      if ((rating ?? 0) > 0) {
        data.ratingSum += rating;
        data.ratingCount++;
        data.topRated.push(item);
      }
    } else if (status === STATUS_WATCHING) {
      data.watching++;
    } else {
      data.want++;
      data.wantList.push(item);
    }

    data.groups[group] = (data.groups[group] || 0) + 1;
    data.tags[typeTag] = (data.tags[typeTag] || 0) + 1;

    // 日期 → 年/月
    let wDate: Date | null = null;
    if (watchDate && !isNaN(new Date(watchDate).getTime())) {
      wDate = new Date(watchDate);
      const y = wDate.getFullYear();
      const m = wDate.getMonth() + 1;
      data.years[y] = (data.years[y] || 0) + 1;
      data.months[m] = (data.months[m] || 0) + 1;
    }

    // 评分桶
    if ((rating ?? 0) > 0) {
      data.buckets[ratingBucketOf(rating as number)]++;
    }

    // 豆瓣
    const db = Number(fm['豆瓣评分']);
    if (!isNaN(db) && db > 0) {
      data.doubanSum += db;
      data.doubanCount++;
    }

    // splitAdd 累加（主演取单次——源码重复调用为 bug）
    const splitAdd = (str: any, map: Record<string, number>) => {
      String(str || '')
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((part) => {
          map[part] = (map[part] || 0) + 1;
        });
    };
    splitAdd(fm['类型'], data.genres);
    splitAdd(fm['制片国家/地区'], data.countries);
    splitAdd(fm['导演'], data.directors);
    splitAdd(fm['主演'], data.actors);

    // 片龄
    const relMatch = String(fm['上映日期'] || '').match(/^(\d{4})/);
    if (relMatch && wDate) {
      const relYear = parseInt(relMatch[1]);
      const diff = wDate.getFullYear() - relYear;
      if (diff >= 0) {
        if (diff === 0) data.ageBuckets['当年']++;
        else if (diff <= 3) data.ageBuckets['1-3年']++;
        else if (diff <= 10) data.ageBuckets['4-10年']++;
        else data.ageBuckets['≥10年']++;
        data.ageSum += diff;
        data.ageCount++;
      }
      const era = Math.floor(relYear / 10) * 10;
      data.eras[era] = (data.eras[era] || 0) + 1;
    }

    // 片长
    const durMatch = String(fm['片长'] || '').match(/^(\d+)/);
    if (durMatch) {
      const mins = parseInt(durMatch[1]);
      if (mins < 90) data.durBuckets['<90']++;
      else if (mins <= 120) data.durBuckets['90-120']++;
      else data.durBuckets['>120']++;
      data.durSum += mins;
      data.durCount++;
      if (!data.groupDur[group]) data.groupDur[group] = { sum: 0, count: 0 };
      data.groupDur[group].sum += mins;
      data.groupDur[group].count++;
    }

    // 星期
    if (wDate) {
      data.weekdays[wDate.getDay()]++;
      data.monthKeys.add(`${wDate.getFullYear()}-${wDate.getMonth() + 1}`);
    }

    // 打分习惯
    if (status === STATUS_WATCHED && (rating ?? 0) > 0 && db > 0) {
      const r10 = (rating as number) * R6to10;
      data.diffSum += r10 - db;
      data.diffCount++;
      if (r10 >= 8.33 && db < 8) {
        data.treasure.push({ name, typeTag, rating, douban: db });
      }
      if ((rating as number) <= 2 && db >= 8.5) {
        data.disappoint.push({ name, typeTag, rating, douban: db });
      }
    }

    // 影评
    const review = fm['影评']?.trim();
    if (review) {
      data.reviewCount++;
      data.reviewCharSum += review.length;
      REVIEW_KEYWORDS.forEach((w) => {
        if (review.includes(w)) data.reviewKeywords[w] = (data.reviewKeywords[w] || 0) + 1;
      });
    }

    // 系列（名称尾数字剥离）
    const serMatch = name.match(/^(.*?)(\d+)$/);
    const serBase = serMatch?.[1] ?? name;
    data.series[serBase] = (data.series[serBase] || 0) + 1;

    // 季集
    const seasonMatch = String(fm['季集'] || '').match(/(\d+)/);
    if (seasonMatch) {
      const n = parseInt(seasonMatch[1]);
      data.seasonSum += n;
      data.seasonCount++;
      data.seasons.push({ name, seasons: n });
    }

    // 想看质量
    if (status === STATUS_WANT) {
      if (db > 0) {
        data.wantDoubanSum += db;
        data.wantDoubanCount++;
      }
      if (typeTag) data.wantTags[typeTag] = (data.wantTags[typeTag] || 0) + 1;
    }

    // 年度评分
    if ((rating ?? 0) > 0 && wDate) {
      const y = wDate.getFullYear();
      if (!data.yearRating[y]) data.yearRating[y] = { sum: 0, count: 0 };
      data.yearRating[y].sum += rating;
      data.yearRating[y].count++;
    }
  }

  // ---------- 收尾计算 ----------
  data.topRated = [...data.topRated].sort((a: any, b: any) => b.rating - a.rating).slice(0, 10);
  data.treasure = [...data.treasure].sort((a: any, b: any) => b.rating - a.rating).slice(0, 10);
  data.disappoint = [...data.disappoint].sort((a: any, b: any) => a.rating - b.rating).slice(0, 10);
  data.seasons = [...data.seasons].sort((a: any, b: any) => b.seasons - a.seasons).slice(0, 5);
  data.seriesList = Object.entries(data.series)
    .filter(([, v]) => (v as number) >= 2)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 10);

  data.avgAge = data.ageCount ? (data.ageSum / data.ageCount).toFixed(1) : '—';
  data.avgDur = data.durCount ? (data.durSum / data.durCount).toFixed(0) : '—';
  data.avgDiff = data.diffCount ? (data.diffSum / data.diffCount).toFixed(2) : '—';
  data.avgSeason = data.seasonCount ? (data.seasonSum / data.seasonCount).toFixed(1) : '—';
  data.monthFreq = data.monthKeys.size ? (data.total / data.monthKeys.size).toFixed(1) : '—';
  data.reviewRate = data.total ? Math.round((data.reviewCount / data.total) * 100) : 0;
  data.reviewAvgChars = data.reviewCount ? Math.round(data.reviewCharSum / data.reviewCount) : 0;
  data.wantAvgDouban = data.wantDoubanCount ? (data.wantDoubanSum / data.wantDoubanCount).toFixed(2) : '—';

  data.dirRepeat = Object.values(data.directors).filter((c) => (c as number) >= 3).length;
  data.actRepeat = Object.values(data.actors).filter((c) => (c as number) >= 3).length;

  data.eraEntries = Object.entries(data.eras)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([y, v]) => ({ label: y + 's', value: v }));

  data.yearRatingEntries = Object.entries(data.yearRating)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([y, d]: [string, any]) => ({ label: y, value: (d.sum / d.count).toFixed(2) }));

  data.weekdayEntries = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((label, i) => ({
    label,
    value: data.weekdays[i],
  }));

  data.groupDurEntries = Object.entries(data.groupDur)
    .map(([g, d]: [string, any]) => ({ label: g, value: Math.round(d.sum / d.count) }))
    .sort((a, b) => b.value - a.value);

  data.keywordEntries = Object.entries(data.reviewKeywords)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 12)
    .map(([k, v]) => ({ label: k, value: v }));

  // 年度环比
  const yearTrend: { label: string; value: number }[] = [];
  const yearKeys = Object.keys(data.yearRating).sort((a, b) => Number(a) - Number(b));
  for (let i = 1; i < yearKeys.length; i++) {
    const cur = data.yearRating[yearKeys[i]];
    const prev = data.yearRating[yearKeys[i - 1]];
    const curAvg = cur.sum / cur.count;
    const prevAvg = prev.sum / prev.count;
    const pct = prevAvg > 0 ? Math.round(((curAvg - prevAvg) / prevAvg) * 100) : 0;
    yearTrend.push({ label: `${yearKeys[i - 1]}→${yearKeys[i]}`, value: pct });
  }
  data.yearTrend = yearTrend;

  data.avgRating = data.ratingCount ? ((data.ratingSum / data.ratingCount) * R6to10).toFixed(2) : '—';
  data.avgDouban = data.doubanCount ? (data.doubanSum / data.doubanCount).toFixed(2) : '—';

  return data;
}

/** 分析文件夹路径：settings.analysisFolderPath || movie.getMovieFolderPath() || '我的/影视' */
export function getAnalysisFolderPath(): string {
  const s = tryGetSettings();
  if ((s as any).analysisFolderPath) return (s as any).analysisFolderPath;
  return getMovieFolderPath();
}
