/**
 * 影视观影数据分析（迁移自 QuickAdd 脚本《影视数据分析.js》→ ticket 23；ADR-0048 迁出为独立域 src/movie-report/）
 * 入口：openMovieReport（bz-movie-report，本域 index.ts）与影视主界面右上角 📊 按钮。
 * 数据采集与渲染逻辑与原脚本一致（公式/配色/文案保持既有实现）；
 * 类型常量显式引用 movie 域 constants（纯数据模块，无环）。
 */
import type { App, TFile } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { ALL_TAGS, getGroupForTag, STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED } from '../movie/constants';
import { getReportFolderPath } from './state';

let analysisOverlay: HTMLElement | null = null;

// 类型颜色（浅色，环形图/图例用）
const TYPE_COLORS: Record<string, string> = {
  '电影': '#FFE5CC',
  '剧集': '#D6E4FF',
  '动漫': '#FADDE1',
  '纪录片': '#D8F3DC',
  '公开课': '#E6DFF5',
};

const R6to10 = 10 / 6; // 个人6分制 → 10分制换算
const REVIEW_KEYWORDS = ['好看', '喜欢', '推荐', '经典', '感动', '治愈', '失望', '无聊', '一般', '神作', '烂片', '封神', '震撼', '催泪', '熬夜', '二刷', '满分'];

// ======================= 数据采集 =======================
function ratingBucketOf(r: number): string {
  if (r >= 5.5) return '≥5.5';
  if (r >= 5) return '5~5.5';
  if (r >= 4) return '4~5';
  if (r >= 3) return '3~4';
  if (r >= 2) return '2~3';
  return '<2';
}

/** 空分析数据结构（buildAnalysisData 拆分） */
function createEmptyAnalysis(): any {
  return {
    total: 0, watched: 0, watching: 0, want: 0,
    ratingSum: 0, ratingCount: 0,
    doubanSum: 0, doubanCount: 0,
    groups: {}, tags: {}, years: {}, months: {},
    buckets: { '≥5.5': 0, '5~5.5': 0, '4~5': 0, '3~4': 0, '2~3': 0, '<2': 0 },
    genres: {}, countries: {}, directors: {}, actors: {},
    topRated: [], wantList: [],
    // ① 片龄
    ageBuckets: { '当年': 0, '1-3年': 0, '4-10年': 0, '≥10年': 0 },
    ageSum: 0, ageCount: 0,
    eras: {},
    // ② 片长
    durBuckets: { '<90': 0, '90-120': 0, '>120': 0 },
    durSum: 0, durCount: 0,
    groupDur: {},
    // ③ 节奏
    weekdays: [0, 0, 0, 0, 0, 0, 0],
    monthKeys: new Set(),
    // ④ 打分习惯（换算10分制）
    diffSum: 0, diffCount: 0,
    treasure: [], disappoint: [],
    // ⑤ 影评
    reviewKeywords: {}, reviewCount: 0, reviewCharSum: 0,
    // ⑥ 系列 ⑦ 季集
    series: {}, seasonSum: 0, seasonCount: 0, seasons: [],
    // ⑧ 想看质量
    wantDoubanSum: 0, wantDoubanCount: 0, wantTags: {},
    // ⑨ 年度评分
    yearRating: {},
  };
}

/** 解析单文件基础字段（buildAnalysisData 拆分）：非影视类型返回 null */
function parseAnalysisItem(fm: any, file: TFile): { item: any; d: Date | null; db: number } | null {
  const nameMatch = file.basename.match(/《(.+)》/);
  const name = nameMatch ? nameMatch[1] : file.basename;
  const tags = fm.tags || [];
  const tagList = Array.isArray(tags) ? tags : [tags];
  let typeTag: string | null = null;
  for (const t of ALL_TAGS) {
    if (tagList.includes(t)) { typeTag = t; break; }
  }
  if (!typeTag) return null;
  const group = getGroupForTag(typeTag);
  if (!group) return null;

  const watchDate = fm['观影日期'] ? fm['观影日期'].toString() : null;
  // null/空串 = 未打分（显式归已看），避免 Number('')=0 误判在看；undefined 缺省行为不变
  const rawRating = fm['评分'];
  const rating =
    rawRating === undefined || rawRating === null || rawRating === ''
      ? null
      : Number(rawRating);
  // 状态由评分推断（无独立状态字段）：-1=想看 / 0=在看 / 其余（>0 或无评分）=已看
  let status: number;
  if (rating === -1) status = STATUS_WANT;
  else if (rating === 0) status = STATUS_WATCHING;
  else status = STATUS_WATCHED;
  const d = new Date(watchDate as string);
  return {
    item: { file, name, typeTag, group, watchDate, rating, status },
    d: isNaN(d.getTime()) ? null : d,
    db: Number(fm['豆瓣评分']),
  };
}

/** 基础统计 + ①②③⑨（计数/标签/日期/评分桶/类型国家导演主演/片龄/片长/星期/年度评分） */
function accumulateMovieStats(data: any, item: any, fm: any, d: Date | null, db: number): void {
  const { status, typeTag, group, rating } = item;

  data.total++;
  if (status === STATUS_WATCHED) {
    data.watched++;
    if (rating !== null && rating > 0) {
      data.ratingSum += rating;
      data.ratingCount++;
      data.topRated.push(item);
    }
  } else if (status === STATUS_WATCHING) {
    data.watching++;
  } else if (status === STATUS_WANT) {
    data.want++;
    data.wantList.push(item);
  }

  if (group) data.groups[group] = (data.groups[group] || 0) + 1;
  if (typeTag) data.tags[typeTag] = (data.tags[typeTag] || 0) + 1;

  if (d) {
    const y = d.getFullYear();
    data.years[y] = (data.years[y] || 0) + 1;
    const m = d.getMonth() + 1;
    data.months[m] = (data.months[m] || 0) + 1;
  }

  if (rating !== null && rating > 0) {
    data.buckets[ratingBucketOf(rating)]++;
  }

  if (!isNaN(db) && db > 0) { data.doubanSum += db; data.doubanCount++; }

  const splitAdd = (str: any, map: Record<string, number>) => String(str || '').split('/').map((s) => s.trim()).filter(Boolean).forEach((v) => { map[v] = (map[v] || 0) + 1; });
  splitAdd(fm['类型'], data.genres);
  splitAdd(fm['制片国家/地区'], data.countries);
  splitAdd(fm['导演'], data.directors);
  splitAdd(fm['主演'], data.actors);

  // ① 片龄（上映年=上映日期前4位）
  const relMatch = String(fm['上映日期'] || '').match(/^(\d{4})/);
  if (relMatch && d) {
    const diff = d.getFullYear() - Number(relMatch[1]);
    if (diff >= 0) {
      if (diff === 0) data.ageBuckets['当年']++;
      else if (diff <= 3) data.ageBuckets['1-3年']++;
      else if (diff <= 10) data.ageBuckets['4-10年']++;
      else data.ageBuckets['≥10年']++;
      data.ageSum += diff; data.ageCount++;
    }
    const era = Math.floor(Number(relMatch[1]) / 10) * 10;
    data.eras[era] = (data.eras[era] || 0) + 1;
  }

  // ② 片长
  const durMatch = String(fm['片长'] || '').match(/^(\d+)/);
  if (durMatch) {
    const mins = Number(durMatch[1]);
    if (mins < 90) data.durBuckets['<90']++;
    else if (mins <= 120) data.durBuckets['90-120']++;
    else data.durBuckets['>120']++;
    data.durSum += mins; data.durCount++;
    const gd = data.groupDur[group] = data.groupDur[group] || { sum: 0, count: 0 };
    gd.sum += mins; gd.count++;
  }

  // ③ 星期 + 月份键
  if (d) {
    data.weekdays[d.getDay()]++;
    data.monthKeys.add(d.getFullYear() + '-' + (d.getMonth() + 1));
  }

  // ⑨ 年度平均个人评分
  if (rating !== null && rating > 0 && d) {
    const yr = d.getFullYear();
    const yrStat = data.yearRating[yr] = data.yearRating[yr] || { sum: 0, count: 0 };
    yrStat.sum += rating; yrStat.count++;
  }
}

/** 扩展统计 ④⑤⑥⑦⑧（打分习惯/影评关键词/系列/季集/想看质量） */
function accumulateMovieExtras(data: any, item: any, fm: any, db: number): void {
  const { status, typeTag, rating, name } = item;

  // ④ 打分习惯（个人6分制 → 10分制换算）
  if (status === STATUS_WATCHED && rating !== null && rating > 0 && !isNaN(db) && db > 0) {
    const r10 = rating * R6to10;
    data.diffSum += r10 - db; data.diffCount++;
    if (r10 >= 8.33 && db < 8) data.treasure.push({ name, typeTag, rating, douban: db });
    if (rating <= 2 && db >= 8.5) data.disappoint.push({ name, typeTag, rating, douban: db });
  }

  // ⑤ 影评关键词
  const review = fm['影评'] ? String(fm['影评']).trim() : '';
  if (review) {
    data.reviewCount++; data.reviewCharSum += review.length;
    REVIEW_KEYWORDS.forEach((w) => { if (review.includes(w)) data.reviewKeywords[w] = (data.reviewKeywords[w] || 0) + 1; });
  }

  // ⑥ 系列基名（尾数字剥离，基名非空过滤《2046》类误伤）
  const serMatch = name.match(/^(.*?)(\d+)$/);
  const serBase = (serMatch && serMatch[1]) ? serMatch[1] : name;
  data.series[serBase] = (data.series[serBase] || 0) + 1;

  // ⑦ 季集（首个数字）
  const seasonMatch = String(fm['季集'] || '').match(/(\d+)/);
  if (seasonMatch) {
    const n = Number(seasonMatch[1]);
    data.seasonSum += n; data.seasonCount++;
    data.seasons.push({ name, seasons: n });
  }

  // ⑧ 想看质量
  if (status === STATUS_WANT && !isNaN(db) && db > 0) {
    data.wantDoubanSum += db; data.wantDoubanCount++;
  }
  if (status === STATUS_WANT && typeTag) {
    data.wantTags[typeTag] = (data.wantTags[typeTag] || 0) + 1;
  }
}

/** 汇总派生字段（排序/均值/趋势/条目化） */
function finalizeAnalysis(data: any): void {
  data.topRated.sort((a: any, b: any) => b.rating - a.rating);
  data.topRated = data.topRated.slice(0, 10);
  data.treasure.sort((a: any, b: any) => b.rating - a.rating);
  data.treasure = data.treasure.slice(0, 10);
  data.disappoint.sort((a: any, b: any) => a.rating - b.rating);
  data.disappoint = data.disappoint.slice(0, 10);
  data.seasons.sort((a: any, b: any) => b.seasons - a.seasons);
  data.seasons = data.seasons.slice(0, 5);
  data.seriesList = Object.entries(data.series).filter(([, v]) => (v as number) >= 2).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10);
  data.avgAge = data.ageCount ? (data.ageSum / data.ageCount).toFixed(1) : '—';
  data.avgDur = data.durCount ? (data.durSum / data.durCount).toFixed(0) : '—';
  data.avgDiff = data.diffCount ? (data.diffSum / data.diffCount).toFixed(2) : '—';
  data.avgSeason = data.seasonCount ? (data.seasonSum / data.seasonCount).toFixed(1) : '—';
  data.monthFreq = data.monthKeys.size ? (data.total / data.monthKeys.size).toFixed(1) : '—';
  data.reviewRate = data.total ? Math.round(data.reviewCount / data.total * 100) : 0;
  data.reviewAvgChars = data.reviewCount ? Math.round(data.reviewCharSum / data.reviewCount) : 0;
  data.wantAvgDouban = data.wantDoubanCount ? (data.wantDoubanSum / data.wantDoubanCount).toFixed(2) : '—';
  data.dirRepeat = Object.values(data.directors).filter((c) => (c as number) >= 3).length;
  data.actRepeat = Object.values(data.actors).filter((c) => (c as number) >= 3).length;
  data.eraEntries = Object.keys(data.eras).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y + 's', value: data.eras[y] }));
  data.yearRatingEntries = Object.keys(data.yearRating).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y, value: Number((data.yearRating[y].sum / data.yearRating[y].count).toFixed(2)) }));
  data.weekdayEntries = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((w, i) => ({ label: w, value: data.weekdays[i] }));
  data.groupDurEntries = Object.entries(data.groupDur).map(([g, v]: any) => ({ label: g, value: Math.round(v.sum / v.count) })).sort((a: any, b: any) => b.value - a.value);
  data.keywordEntries = Object.entries(data.reviewKeywords).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 12);
  data.yearTrend = (() => {
    const ys = Object.keys(data.years).sort((a, b) => Number(a) - Number(b));
    const out: any[] = [];
    for (let i = 1; i < ys.length; i++) {
      const prev = data.years[ys[i - 1]], cur = data.years[ys[i]];
      out.push({ label: ys[i - 1] + '→' + ys[i], value: prev ? Math.round((cur - prev) / prev * 100) : 0 });
    }
    return out;
  })();
}

/** 构建分析数据（纯函数，供测试直接调用） */
export function buildAnalysisData(app: App): any {
  const data = createEmptyAnalysis();
  const folderPath = getReportFolderPath();
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folderPath + '/'));
  for (const file of files) {
    const cache = (app.metadataCache as any).getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm) continue;

    const parsed = parseAnalysisItem(fm, file);
    if (!parsed) continue;

    accumulateMovieStats(data, parsed.item, fm, parsed.d, parsed.db);
    accumulateMovieExtras(data, parsed.item, fm, parsed.db);
  }

  finalizeAnalysis(data);
  return data;
}

// ======================= 渲染辅助（浅色风格） =======================
const PASTEL_CARDS = [
  '#D6E4FF',
  '#D8F3DC',
  '#CDF0EA',
  '#FADDE1',
  '#FFE5CC',
  '#E6DFF5',
];

function emptyHTML(): string {
  return '<p style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:12px 0;">暂无数据</p>';
}

// 浅色统计卡
function statCardHTML(label: string, value: any, idx: number): string {
  const bg = PASTEL_CARDS[idx % PASTEL_CARDS.length];
  return `<div style="flex:1;min-width:100px;padding:14px 8px;background:${bg};border-radius:12px;text-align:center;border:1px solid rgba(0,0,0,0.06);">
        <div style="font-size:1.35rem;font-weight:700;color:#3D4456;line-height:1.2;">${value}</div>
        <div style="font-size:.7rem;color:rgba(61,68,86,0.65);margin-top:3px;">${label}</div>
    </div>`;
}

// 竖向浅色柱状图
function barChartHTML(entries: any[], opt?: any): string {
  if (!entries || !entries.length) return emptyHTML();
  const o = opt || {};
  const color = o.color || '#D6E4FF';
  const max = Math.max(...entries.map((e) => e.value), 1);
  const minH = 26, maxH = 92;
  return `
    <div style="overflow-x:auto;margin:8px 0 4px;">
        <div style="display:flex;align-items:flex-end;gap:10px;min-width:${Math.max(entries.length * 46, 230)}px;padding:0 4px;">
        ${entries.map((e, i) => {
    const h = max > 0 ? minH + (e.value / max) * (maxH - minH) : minH;
    const hl = o.highlight !== undefined ? o.highlight === i : false;
    const fill = hl ? '#FFE5CC' : color;
    return `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
                <div style="width:100%;min-width:30px;height:${h}px;background:${fill};border-radius:6px 6px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:3px;color:#3D4456;font-weight:700;font-size:.75rem;">${e.value || ''}</div>
                <div style="margin-top:6px;font-size:.72rem;color:var(--text-muted);text-align:center;white-space:nowrap;">${e.label}</div>
            </div>`;
  }).join('')}
        </div>
    </div>`;
}

// SVG 环形图
function donutChartHTML(entries: any[], colors: string[], centerLabel?: number): string {
  if (!entries || !entries.length) return emptyHTML();
  const total = entries.reduce((s, e) => s + e.value, 0);
  if (!total) return emptyHTML();
  const CIRC = 2 * Math.PI * 40;
  let cum = 0;
  const segs = entries.map((e, i) => {
    const pct = e.value / total;
    const dash = pct * CIRC;
    const off = -cum * CIRC;
    cum += pct;
    return `<circle cx="50" cy="50" r="40" fill="transparent" stroke="${colors[i % colors.length]}" stroke-width="11" stroke-dasharray="${dash} ${Math.max(CIRC - dash, 0.1)}" stroke-dashoffset="${off}"></circle>`;
  }).join('');
  const legend = entries.map((e, i) => `
        <div style="display:flex;align-items:center;gap:6px;margin:3px 0;font-size:.76rem;">
            <span style="width:10px;height:10px;border-radius:50%;background:${colors[i % colors.length]};flex-shrink:0;"></span>
            <span style="color:var(--text-normal);white-space:nowrap;">${e.label}</span>
            <span style="color:var(--text-muted);margin-left:auto;">${e.value}</span>
        </div>`).join('');
  return `
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
        <div style="position:relative;width:132px;height:132px;flex-shrink:0;margin:0 auto;">
            <svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg);">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--background-modifier-border)" stroke-width="11"></circle>
                ${segs}
            </svg>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;">
                <div style="font-size:1.15rem;font-weight:700;color:var(--text-normal);">${centerLabel !== undefined ? centerLabel : total}</div>
            </div>
        </div>
        <div style="flex:1;min-width:140px;">${legend}</div>
    </div>`;
}

// 浅色进度条
function softBarHTML(entries: any[], color: string): string {
  if (!entries || !entries.length) return emptyHTML();
  const max = Math.max(...entries.map((e) => e.value), 1);
  return entries.map((e) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
            <span style="width:64px;flex-shrink:0;font-size:.76rem;color:var(--text-muted);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.label}</span>
            <div style="flex:1;height:10px;background:var(--background-modifier-border);border-radius:5px;overflow:hidden;">
                <div style="height:100%;width:${Math.max((e.value / max) * 100, 2)}%;background:${color};border-radius:5px;"></div>
            </div>
            <span style="width:36px;flex-shrink:0;font-size:.76rem;color:var(--text-normal);text-align:right;">${e.value}</span>
        </div>`).join('');
}

// 板块容器（标题带色条）
function sectionHTML(title: string, body: string, accent?: string): string {
  const bar = accent || '#D6E4FF';
  return `<div style="margin-bottom:20px;padding:14px 14px 12px;background:var(--background-secondary);border-radius:12px;border:1px solid var(--background-modifier-border);">
        <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:.92rem;margin-bottom:12px;">
            <span style="width:4px;height:14px;border-radius:2px;background:${bar};flex-shrink:0;"></span>
            <span>${title}</span>
        </div>
        ${body}
    </div>`;
}

// 排名列表（TOP1-3 浅色徽章）
function topListHTML(list: any[], withRating: boolean): string {
  if (!list || !list.length) return emptyHTML();
  const badges = ['#FFF3C4', '#D8F3DC', '#D6E4FF'];
  return list.map((it, i) => {
    const rank = i < 3
      ? `<span style="width:20px;height:20px;flex-shrink:0;border-radius:50%;background:${badges[i]};color:#3D4456;font-size:.68rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,0.06);">${i + 1}</span>`
      : `<span style="width:20px;flex-shrink:0;font-size:.72rem;color:var(--text-muted);text-align:center;">${i + 1}</span>`;
    return `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--background-modifier-border);">
            ${rank}
            <span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${it.name}》</span>
            <span style="font-size:.72rem;color:var(--text-muted);flex-shrink:0;">${it.typeTag}</span>
            ${withRating ? `<span style="font-size:.8rem;font-weight:600;color:var(--text-accent);flex-shrink:0;">${it.rating}</span>` : ''}
        </div>`;
  }).join('');
}

// 双榜（宝藏/失望）: 名称/类型/个人原分+换算/豆瓣
function ratingCompareListHTML(list: any[]): string {
  if (!list || !list.length) return emptyHTML();
  return list.map((it) => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--background-modifier-border);">
            <span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${it.name}》</span>
            <span style="font-size:.72rem;color:var(--text-muted);flex-shrink:0;">${it.typeTag}</span>
            <span style="font-size:.78rem;font-weight:600;color:var(--text-accent);flex-shrink:0;">${it.rating}<span style="font-weight:400;color:var(--text-muted);font-size:.68rem;">(${(it.rating * R6to10).toFixed(1)})</span></span>
            <span style="font-size:.78rem;color:var(--text-muted);flex-shrink:0;">豆瓣${it.douban}</span>
        </div>`).join('');
}

// 行内小统计（板块头部 chips）
function statInlineHTML(items: string[]): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">${items.map((s) => `
        <span style="font-size:.74rem;color:var(--text-muted);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;padding:3px 10px;">${s}</span>`).join('')}</div>`;
}

function buildAnalysisHTML(data: any): string {
  const yearEntries = Object.keys(data.years).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y, value: data.years[y] }));
  const monthEntries = Array.from({ length: 12 }, (_, i) => ({ label: (i + 1) + '月', value: data.months[i + 1] || 0 }));
  const bucketEntries = ['≥5.5', '5~5.5', '4~5', '3~4', '2~3', '<2'].map((b) => ({ label: b, value: data.buckets[b] }));
  const topN = (map: any, n: number) => Object.entries(map).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, n).map(([label, value]) => ({ label, value }));
  const typeEntries = Object.entries(data.groups).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([label, value]) => ({ label, value }));
  const typeColors = typeEntries.map((e: any) => TYPE_COLORS[e.label] || '#95a5a6');
  const tagChips = Object.entries(data.tags).sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([t, c]) => `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:.72rem;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);margin:2px;">${t} ${c}</span>`).join('');

  const avgRating = data.ratingCount ? (data.ratingSum / data.ratingCount * R6to10).toFixed(2) : '—';
  const avgDouban = data.doubanCount ? (data.doubanSum / data.doubanCount).toFixed(2) : '—';
  const curMonth = new Date().getMonth(); // 0-11

  return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
        ${statCardHTML('收录总数', data.total, 0)}
        ${statCardHTML('已看', data.watched, 1)}
        ${statCardHTML('在看', data.watching, 2)}
        ${statCardHTML('想看', data.want, 3)}
        ${statCardHTML('平均评分', avgRating, 4)}
        ${statCardHTML('平均豆瓣', avgDouban, 5)}
    </div>
    ${sectionHTML('🎬 类型分布', donutChartHTML(typeEntries, typeColors, data.total), '#FFE5CC')}
    ${sectionHTML('📅 年度观影趋势', barChartHTML(yearEntries, { color: '#D6E4FF' }), '#D6E4FF')}
    ${sectionHTML('🕰️ 片龄画像', statInlineHTML([`平均片龄 ${data.avgAge} 年`, `片龄≥10年 ${data.ageBuckets['≥10年']} 部`]) + softBarHTML([{ label: '当年', value: data.ageBuckets['当年'] }, { label: '1-3年', value: data.ageBuckets['1-3年'] }, { label: '4-10年', value: data.ageBuckets['4-10年'] }, { label: '≥10年', value: data.ageBuckets['≥10年'] }], '#E6DFF5') + '<div style="margin-top:10px;">' + barChartHTML(data.eraEntries, { color: '#CDF0EA' }) + '</div>', '#E6DFF5')}
    ${sectionHTML('⏱️ 片长画像', statInlineHTML([`平均片长 ${data.avgDur} 分钟`, data.groupDurEntries.map((g: any) => `${g.label} ${g.value}分`).join(' · ')]) + softBarHTML([{ label: '&lt;90分', value: data.durBuckets['<90'] }, { label: '90-120分', value: data.durBuckets['90-120'] }, { label: '&gt;120分', value: data.durBuckets['>120'] }], '#D8F3DC'), '#D8F3DC')}
    ${sectionHTML('🗓️ 月度观影分布', barChartHTML(monthEntries, { color: '#CDF0EA', highlight: curMonth }), '#CDF0EA')}
    ${sectionHTML('📆 观影节奏', statInlineHTML([`月均 ${data.monthFreq} 部`, `周末 ${data.weekdays[0] + data.weekdays[6]} 部 (${data.total ? Math.round((data.weekdays[0] + data.weekdays[6]) / data.total * 100) : 0}%)`]) + barChartHTML(data.weekdayEntries, { color: '#D6E4FF' }) + (data.yearTrend.length ? '<div style="margin-top:10px;">' + statInlineHTML(data.yearTrend.map((t: any) => `${t.label} ${t.value >= 0 ? '+' : ''}${t.value}%`)) + '</div>' : ''), '#D6E4FF')}
    ${sectionHTML('⭐ 个人评分分布', barChartHTML(bucketEntries, { color: '#FADDE1' }), '#FADDE1')}
    ${sectionHTML('📈 评分趋势（个人6分制）', barChartHTML(data.yearRatingEntries, { color: '#FFE5CC' }), '#FFE5CC')}
    ${sectionHTML('⚖️ 打分习惯（换算10分制）', statInlineHTML([`平均差值 ${data.avgDiff >= 0 ? '+' : ''}${data.avgDiff}（个人−豆瓣）`]) + '<div style="font-weight:600;font-size:.8rem;margin:6px 0 4px;">💎 宝藏片（个人≥5 豆瓣&lt;8）</div>' + ratingCompareListHTML(data.treasure) + '<div style="font-weight:600;font-size:.8rem;margin:10px 0 4px;">🌧️ 失望榜（个人≤2 豆瓣≥8.5）</div>' + ratingCompareListHTML(data.disappoint), '#FADDE1')}
    ${sectionHTML('🎭 题材偏好 TOP10', softBarHTML(topN(data.genres, 10), '#E6DFF5'), '#E6DFF5')}
    ${sectionHTML('🌍 制片国家/地区 TOP10', softBarHTML(topN(data.countries, 10), '#D6E4FF'), '#D6E4FF')}
    ${sectionHTML('🎥 最爱导演 TOP10', softBarHTML(topN(data.directors, 10), '#D8F3DC'), '#D8F3DC')}
    ${sectionHTML('👥 最爱主演 TOP10', softBarHTML(topN(data.actors, 10), '#FADDE1'), '#FADDE1')}
    ${sectionHTML('❤️ 真爱重复', statInlineHTML([`导演≥3部 ${data.dirRepeat} 人`, `主演≥3部 ${data.actRepeat} 人`]) + softBarHTML([{ label: '导演≥3部', value: data.dirRepeat }, { label: '主演≥3部', value: data.actRepeat }], '#D8F3DC'), '#D8F3DC')}
    ${sectionHTML('💬 影评关键词', statInlineHTML([`有影评 ${data.reviewCount} 篇 (${data.reviewRate}%)`, `平均 ${data.reviewAvgChars} 字`]) + (data.keywordEntries.length ? data.keywordEntries.map(([k, v]) => `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:.72rem;background:#E6DFF5;color:#3D4456;margin:2px;">${k} ${v}</span>`).join('') : emptyHTML()), '#E6DFF5')}
    ${sectionHTML('🏆 我的高分 TOP10', topListHTML(data.topRated, true), '#FFE5CC')}
    ${sectionHTML('🔗 系列追踪', statInlineHTML([`追了 ${data.seriesList.length} 个系列（≥2部）`]) + (data.seriesList.length ? data.seriesList.map(([k, v]: any, i: number) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--background-modifier-border);"><span style="width:18px;flex-shrink:0;font-size:.72rem;color:var(--text-muted);text-align:center;">${i + 1}</span><span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${k}》</span><span style="font-size:.78rem;font-weight:600;color:var(--text-accent);flex-shrink:0;">${v} 部</span></div>`).join('') : emptyHTML()), '#D6E4FF')}
    ${sectionHTML('📺 追剧深度', statInlineHTML([`平均 ${data.avgSeason} 季`]) + (data.seasons.length ? data.seasons.map((s: any, i: number) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--background-modifier-border);"><span style="width:18px;flex-shrink:0;font-size:.72rem;color:var(--text-muted);text-align:center;">${i + 1}</span><span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${s.name}》</span><span style="font-size:.78rem;font-weight:600;color:var(--text-accent);flex-shrink:0;">${s.seasons} 季</span></div>`).join('') : emptyHTML()), '#CDF0EA')}
    ${sectionHTML('📌 想看清单（' + data.wantList.length + '）' + (data.wantAvgDouban !== '—' ? ' · 均豆瓣 ' + data.wantAvgDouban : ''), topListHTML(data.wantList, false) + (Object.keys(data.wantTags).length ? '<div style="margin-top:8px;">' + Object.entries(data.wantTags).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([t, c]) => `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:.72rem;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);margin:2px;">${t} ${c}</span>`).join('') + '</div>' : ''), '#FFF3C4')}
    <p style="text-align:center;font-size:.68rem;color:var(--text-muted);margin-top:16px;">个人评分 6 分制 ⇄ 豆瓣 10 分制，换算 ×${R6to10.toFixed(2)}</p>
    `;
}

// ======================= 打开/关闭分析页 =======================
/** 关闭分析窗口（ESC 与 ❌ 共用） */
export function closeAnalysis(): void {
  if (analysisOverlay) {
    analysisOverlay.remove();
    analysisOverlay = null;
  }
}

/** 打开观影数据分析窗口（已开 → 关闭；幂等） */
export function openAnalysisModal(app: App): void {
  if (analysisOverlay) {
    closeAnalysis();
    return;
  }
  const data = buildAnalysisData(app);

  const overlay = document.createElement('div');
  overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 1200;
        display: flex; align-items: center; justify-content: center;
    `;
  const modal = document.createElement('div');
  modal.style.cssText = `
        background: var(--background-primary); color: var(--text-normal);
        border-radius: 12px; width: 100%; max-width: 600px; height: 90vh;
        display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    `;
  // 移动端默认全屏（沿用影视 movie 键控制——2026-08 用户拍板：跟随窗口不设独立开关；顶部避让由 .bz-win-mfs 统一提供，基样式不再自带 34px 防双重垫顶）
  applyMobileWindowFullscreen(modal, tryGetSettings().movieMobileDefaultFullscreen === true);

  const header = document.createElement('div');
  header.className = 'bz-win-head';
  header.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        padding: 0 26px; flex-shrink: 0;
    `;
  const titleEl = document.createElement('p');
  titleEl.textContent = '📊 观影数据分析';
  titleEl.style.cssText = 'font-size:.9rem;font-weight:600;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '❌';
  closeBtn.title = '关闭';
  closeBtn.className = 'bz-win-close';
  closeBtn.style.cssText = `
        background: none; border: none; font-size: 0.55rem;
        cursor: pointer; color: var(--text-muted); box-shadow: none;
        padding: 0; margin-left: 15px;
    `;
  closeBtn.addEventListener('click', closeAnalysis);
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px 16px 16px;';
  content.innerHTML = buildAnalysisHTML(data);

  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  analysisOverlay = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAnalysis();
  });

  // ESC 层级关闭（bz esc-manager 注册，可重复覆盖）
  escManager.register('movie-analysis', { isVisible: () => !!analysisOverlay, close: () => closeAnalysis() });
}
