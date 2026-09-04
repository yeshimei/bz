/**
 * 影院（cinema）影视分析：完整版（复刻 movie-report/analysis.ts 的 9 类统计 + 15 板块渲染）
 * 数据源：M.items（cinema 已解析条目，含豆瓣字段）；样式用 bz-cinema 自绘主题变量
 * （变量在 src/cinema/styles.css 定义，亮/暗两套）；
 * 图表配色常量收编 core 共享层（src/core/chart-palette.ts，与 movie-report 同一套视觉值）。
 */
import { STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED } from './constants';
import { M } from './state';
import {
  CHART_TYPE_COLORS, CHART_PASTEL_SERIES, CHART_RANK_BADGES,
  CHART_INK, CHART_FALLBACK, CHART_HIGHLIGHT,
} from '../core/chart-palette';

const REVIEW_KEYWORDS = ['好看', '喜欢', '推荐', '经典', '感动', '治愈', '失望', '无聊', '一般', '神作', '烂片', '封神', '震撼', '催泪', '熬夜', '二刷', '满分'];

// ======================= 数据采集 =======================

/** 评分桶（10 分制） */
function ratingBucketOf(r: number): string {
  if (r >= 9) return '≥9';
  if (r >= 8) return '8~9';
  if (r >= 7) return '7~8';
  if (r >= 6) return '6~7';
  if (r >= 5) return '5~6';
  return '<5';
}

/** 空分析数据结构 */
function createEmptyAnalysis(): any {
  return {
    total: 0, watched: 0, watching: 0, want: 0,
    ratingSum: 0, ratingCount: 0,
    doubanSum: 0, doubanCount: 0,
    groups: {}, tags: {}, years: {}, months: {},
    buckets: { '≥9': 0, '8~9': 0, '7~8': 0, '6~7': 0, '5~6': 0, '<5': 0 },
    genres: {}, countries: {}, directors: {}, actors: {},
    topRated: [], wantList: [],
    ageBuckets: { '当年': 0, '1-3年': 0, '4-10年': 0, '≥10年': 0 },
    ageSum: 0, ageCount: 0, eras: {},
    durBuckets: { '<90': 0, '90-120': 0, '>120': 0 },
    durSum: 0, durCount: 0, groupDur: {},
    weekdays: [0, 0, 0, 0, 0, 0, 0],
    monthKeys: new Set(),
    diffSum: 0, diffCount: 0, treasure: [], disappoint: [],
    reviewKeywords: {}, reviewCount: 0, reviewCharSum: 0,
    series: {}, seasonSum: 0, seasonCount: 0, seasons: [],
    wantDoubanSum: 0, wantDoubanCount: 0, wantTags: {},
    yearRating: {},
  };
}

/** 基础统计 + ①②③⑨ */
function accumulateStats(data: any, it: any): void {
  const { status, group, typeTag, rating } = it;
  data.total++;
  if (status === STATUS_WATCHED) {
    data.watched++;
    if (rating !== null && rating > 0) {
      data.ratingSum += rating;
      data.ratingCount++;
      data.topRated.push(it);
    }
  } else if (status === STATUS_WATCHING) data.watching++;
  else if (status === STATUS_WANT) { data.want++; data.wantList.push(it); }

  if (group) data.groups[group] = (data.groups[group] || 0) + 1;
  if (typeTag) data.tags[typeTag] = (data.tags[typeTag] || 0) + 1;

  const d = it.watchDate ? new Date(it.watchDate) : null;
  const validD = d && !isNaN(d.getTime()) ? d : null;
  if (validD) {
    const y = validD.getFullYear();
    data.years[y] = (data.years[y] || 0) + 1;
    data.months[validD.getMonth() + 1] = (data.months[validD.getMonth() + 1] || 0) + 1;
    data.weekdays[validD.getDay()]++;
    data.monthKeys.add(y + '-' + (validD.getMonth() + 1));
  }

  if (rating !== null && rating > 0) data.buckets[ratingBucketOf(rating)]++;

  const db = it.doubanRating ? Number(it.doubanRating) : NaN;
  if (!isNaN(db) && db > 0) { data.doubanSum += db; data.doubanCount++; }

  const splitAdd = (str: any, map: Record<string, number>) => String(str || '').split('/').map((s) => s.trim()).filter(Boolean).forEach((v) => { map[v] = (map[v] || 0) + 1; });
  splitAdd(it.genre, data.genres);
  splitAdd(it.region, data.countries);
  splitAdd(it.director, data.directors);
  splitAdd(it.actors, data.actors);

  // ① 片龄（上映年份 = it.year）
  const relYear = it.year ? Number(it.year) : NaN;
  if (!isNaN(relYear) && validD) {
    const diff = validD.getFullYear() - relYear;
    if (diff >= 0) {
      if (diff === 0) data.ageBuckets['当年']++;
      else if (diff <= 3) data.ageBuckets['1-3年']++;
      else if (diff <= 10) data.ageBuckets['4-10年']++;
      else data.ageBuckets['≥10年']++;
      data.ageSum += diff; data.ageCount++;
    }
    const era = Math.floor(relYear / 10) * 10;
    data.eras[era] = (data.eras[era] || 0) + 1;
  }

  // ② 片长（cinema 条目无片长字段——从 doubanRating 无；跳过，保持结构）
  // ③ 星期已在上方

  // ⑨ 年度平均个人评分
  if (rating !== null && rating > 0 && validD) {
    const yr = validD.getFullYear();
    const yrStat = data.yearRating[yr] = data.yearRating[yr] || { sum: 0, count: 0 };
    yrStat.sum += rating; yrStat.count++;
  }
}

/** 扩展统计 ④⑤⑥⑦⑧ */
function accumulateExtras(data: any, it: any): void {
  const { status, typeTag, rating, name } = it;
  const db = it.doubanRating ? Number(it.doubanRating) : NaN;

  // ④ 打分习惯
  if (status === STATUS_WATCHED && rating !== null && rating > 0 && !isNaN(db) && db > 0) {
    data.diffSum += rating - db; data.diffCount++;
    if (rating >= 9 && db < 8) data.treasure.push({ name, typeTag, rating, douban: db });
    if (rating <= 4 && db >= 8.5) data.disappoint.push({ name, typeTag, rating, douban: db });
  }

  // ⑤ 影评关键词
  const review = it.review ? String(it.review).trim() : '';
  if (review) {
    data.reviewCount++; data.reviewCharSum += review.length;
    REVIEW_KEYWORDS.forEach((w) => { if (review.includes(w)) data.reviewKeywords[w] = (data.reviewKeywords[w] || 0) + 1; });
  }

  // ⑥ 系列基名
  const serMatch = name.match(/^(.*?)(\d+)$/);
  const serBase = (serMatch && serMatch[1]) ? serMatch[1] : name;
  data.series[serBase] = (data.series[serBase] || 0) + 1;

  // ⑦ 季集（cinema 条目无季集字段——保持结构）
  // ⑧ 想看质量
  if (status === STATUS_WANT && !isNaN(db) && db > 0) {
    data.wantDoubanSum += db; data.wantDoubanCount++;
  }
  if (status === STATUS_WANT && typeTag) {
    data.wantTags[typeTag] = (data.wantTags[typeTag] || 0) + 1;
  }
}

/** 汇总派生字段 */
function finalizeAnalysis(data: any): void {
  data.topRated.sort((a: any, b: any) => b.rating - a.rating);
  data.topRated = data.topRated.slice(0, 10);
  data.wantTotal = data.wantList.length;
  data.wantList = data.wantList.slice(0, 10);
  data.treasure = data.treasure.sort((a: any, b: any) => b.rating - a.rating).slice(0, 10);
  data.disappoint = data.disappoint.sort((a: any, b: any) => a.rating - b.rating).slice(0, 10);
  data.seriesList = Object.entries(data.series).filter(([, v]) => (v as number) >= 2).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10);
  data.avgAge = data.ageCount ? (data.ageSum / data.ageCount).toFixed(1) : '—';
  data.avgDiff = data.diffCount ? (data.diffSum / data.diffCount).toFixed(2) : '—';
  data.monthFreq = data.monthKeys.size ? (data.total / data.monthKeys.size).toFixed(1) : '—';
  data.reviewRate = data.total ? Math.round(data.reviewCount / data.total * 100) : 0;
  data.reviewAvgChars = data.reviewCount ? Math.round(data.reviewCharSum / data.reviewCount) : 0;
  data.wantAvgDouban = data.wantDoubanCount ? (data.wantDoubanSum / data.wantDoubanCount).toFixed(2) : '—';
  data.dirRepeat = Object.values(data.directors).filter((c) => (c as number) >= 3).length;
  data.actRepeat = Object.values(data.actors).filter((c) => (c as number) >= 3).length;
  data.eraEntries = Object.keys(data.eras).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y + 's', value: data.eras[y] }));
  data.yearRatingEntries = Object.keys(data.yearRating).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y, value: Number((data.yearRating[y].sum / data.yearRating[y].count).toFixed(2)) }));
  data.weekdayEntries = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((w, i) => ({ label: w, value: data.weekdays[i] }));
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

/** 构建完整分析数据（纯函数，供测试直调） */
export function buildAnalysisData(): any {
  const data = createEmptyAnalysis();
  for (const it of M.items) {
    accumulateStats(data, it);
    accumulateExtras(data, it);
  }
  finalizeAnalysis(data);
  return data;
}

// ======================= 渲染（自绘主题变量；粉彩图表色板 = core/chart-palette） =======================

function emptyHTML(): string {
  return '<p style="text-align:center;color:var(--bz-cinema-muted);font-size:.8rem;padding:12px 0;">暂无数据</p>';
}

function statCardHTML(label: string, value: any, idx: number): string {
  const bg = CHART_PASTEL_SERIES[idx % CHART_PASTEL_SERIES.length];
  return `<div style="flex:1;min-width:100px;padding:14px 8px;background:${bg};border-radius:12px;text-align:center;border:1px solid rgba(0,0,0,0.06);">
    <div style="font-size:1.35rem;font-weight:700;color:${CHART_INK};line-height:1.2;">${value}</div>
    <div style="font-size:.7rem;color:rgba(61,68,86,0.65);margin-top:3px;">${label}</div>
  </div>`;
}

function barChartHTML(entries: any[], opt?: any): string {
  if (!entries || !entries.length) return emptyHTML();
  const o = opt || {};
  const color = o.color || CHART_PASTEL_SERIES[0];
  const max = Math.max(...entries.map((e) => e.value), 1);
  const minH = 26, maxH = 92;
  return `<div style="overflow-x:auto;margin:8px 0 4px;">
    <div style="display:flex;align-items:flex-end;gap:10px;min-width:${Math.max(entries.length * 46, 230)}px;padding:0 4px;">
    ${entries.map((e, i) => {
    const h = max > 0 ? minH + (e.value / max) * (maxH - minH) : minH;
    const hl = o.highlight !== undefined ? o.highlight === i : false;
    const fill = hl ? CHART_HIGHLIGHT : color;
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
      <div style="width:100%;min-width:30px;height:${h}px;background:${fill};border-radius:6px 6px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:3px;color:${CHART_INK};font-weight:700;font-size:.75rem;">${e.value || ''}</div>
      <div style="margin-top:6px;font-size:.72rem;color:var(--bz-cinema-muted);text-align:center;white-space:nowrap;">${e.label}</div>
    </div>`;
  }).join('')}
    </div></div>`;
}

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
      <span style="color:var(--bz-cinema-text);white-space:nowrap;">${e.label}</span>
      <span style="color:var(--bz-cinema-muted);margin-left:auto;">${e.value}</span>
    </div>`).join('');
  return `<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
    <div style="position:relative;width:132px;height:132px;flex-shrink:0;margin:0 auto;">
      <svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg);">
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bz-cinema-border)" stroke-width="11"></circle>
        ${segs}
      </svg>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;">
        <div style="font-size:1.15rem;font-weight:700;color:var(--bz-cinema-text);">${centerLabel !== undefined ? centerLabel : total}</div>
      </div>
    </div>
    <div style="flex:1;min-width:140px;">${legend}</div>
  </div>`;
}

function softBarHTML(entries: any[], color: string): string {
  if (!entries || !entries.length) return emptyHTML();
  const max = Math.max(...entries.map((e) => e.value), 1);
  return entries.map((e) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
      <span style="width:64px;flex-shrink:0;font-size:.76rem;color:var(--bz-cinema-muted);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.label}</span>
      <div style="flex:1;height:10px;background:var(--bz-cinema-border);border-radius:5px;overflow:hidden;">
        <div style="height:100%;width:${Math.max((e.value / max) * 100, 2)}%;background:${color};border-radius:5px;"></div>
      </div>
      <span style="width:36px;flex-shrink:0;font-size:.76rem;color:var(--bz-cinema-text);text-align:right;">${e.value}</span>
    </div>`).join('');
}

function sectionHTML(title: string, body: string, accent?: string, icon?: string): string {
  const bar = accent || CHART_PASTEL_SERIES[0];
  return `<div style="margin-bottom:20px;padding:14px 14px 12px;background:var(--bz-cinema-card);border-radius:12px;border:1px solid var(--bz-cinema-border);">
    <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:.92rem;margin-bottom:12px;">
      <span style="width:4px;height:14px;border-radius:2px;background:${bar};flex-shrink:0;"></span>
      ${icon ? `<i data-lucide="${icon}" class="bz-ic bz-ic--sm" style="color:var(--bz-cinema-muted)"></i>` : ''}
      <span>${title}</span>
    </div>
    ${body}
  </div>`;
}

function topListHTML(list: any[], withRating: boolean): string {
  if (!list || !list.length) return emptyHTML();
  const badges = CHART_RANK_BADGES;
  return list.map((it, i) => {
    const rank = i < 3
      ? `<span style="width:20px;height:20px;flex-shrink:0;border-radius:50%;background:${badges[i]};color:${CHART_INK};font-size:.68rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,0.06);">${i + 1}</span>`
      : `<span style="width:20px;flex-shrink:0;font-size:.72rem;color:var(--bz-cinema-muted);text-align:center;">${i + 1}</span>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--bz-cinema-border);">
      ${rank}
      <span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${it.name}》</span>
      <span style="font-size:.72rem;color:var(--bz-cinema-muted);flex-shrink:0;">${it.typeTag}</span>
      ${withRating ? `<span style="font-size:.8rem;font-weight:600;color:var(--bz-cinema-accent);flex-shrink:0;">${it.rating}</span>` : ''}
    </div>`;
  }).join('');
}

function ratingCompareListHTML(list: any[]): string {
  if (!list || !list.length) return emptyHTML();
  return list.map((it) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--bz-cinema-border);">
      <span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${it.name}》</span>
      <span style="font-size:.72rem;color:var(--bz-cinema-muted);flex-shrink:0;">${it.typeTag}</span>
      <span style="font-size:.78rem;font-weight:600;color:var(--bz-cinema-accent);flex-shrink:0;">${it.rating}</span>
      <span style="font-size:.78rem;color:var(--bz-cinema-muted);flex-shrink:0;">豆瓣${it.douban}</span>
    </div>`).join('');
}

function statInlineHTML(items: string[]): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">${items.map((s) => `
    <span style="font-size:.74rem;color:var(--bz-cinema-muted);background:var(--bz-cinema-panel);border:1px solid var(--bz-cinema-border);border-radius:8px;padding:3px 10px;">${s}</span>`).join('')}</div>`;
}

/** 完整分析页 HTML（15 板块，复刻 movie-report 布局） */
export function buildAnalysisHTML(): string {
  const data = buildAnalysisData();
  if (data.total === 0) {
    return `<div style="padding:64px 20px;text-align:center;color:var(--bz-cinema-muted);">
      <div style="font-size:.95rem;font-weight:600;margin-bottom:10px;color:var(--bz-cinema-text);">还没有可统计的影视记录</div>
      <div style="font-size:.8rem;line-height:1.8;">影视文件夹「${M.folderPath}」里还没有可分析的条目。<br>先去影视面板添加影视条目，或检查设置中的影视文件夹路径。</div>
    </div>`;
  }
  const yearEntries = Object.keys(data.years).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y, value: data.years[y] }));
  const monthEntries = Array.from({ length: 12 }, (_, i) => ({ label: (i + 1) + '月', value: data.months[i + 1] || 0 }));
  const bucketEntries = ['≥9', '8~9', '7~8', '6~7', '5~6', '<5'].map((b) => ({ label: b, value: data.buckets[b] }));
  const topN = (map: any, n: number) => Object.entries(map).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, n).map(([label, value]) => ({ label, value }));
  const typeEntries = Object.entries(data.groups).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([label, value]) => ({ label, value }));
  const typeColors = typeEntries.map((e: any) => CHART_TYPE_COLORS[e.label] || CHART_FALLBACK);
  const tagChips = Object.entries(data.tags).sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([t, c]) => `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:.72rem;background:var(--bz-cinema-panel);color:var(--bz-cinema-text);border:1px solid var(--bz-cinema-border);margin:2px;">${t} ${c}</span>`).join('');

  const avgRating = data.ratingCount ? (data.ratingSum / data.ratingCount).toFixed(2) : '—';
  const avgDouban = data.doubanCount ? (data.doubanSum / data.doubanCount).toFixed(2) : '—';
  const curMonth = new Date().getMonth();

  return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
      ${statCardHTML('收录总数', data.total, 0)}
      ${statCardHTML('已看', data.watched, 1)}
      ${statCardHTML('在看', data.watching, 2)}
      ${statCardHTML('想看', data.want, 3)}
      ${statCardHTML('平均评分（10分制）', avgRating, 4)}
      ${statCardHTML('平均豆瓣', avgDouban, 5)}
    </div>
    ${sectionHTML('类型分布', donutChartHTML(typeEntries, typeColors, data.total), '#FFE5CC', 'pie-chart')}
    ${sectionHTML('年度观影趋势', barChartHTML(yearEntries, { color: '#D6E4FF' }), '#D6E4FF', 'calendar')}
    ${sectionHTML('片龄画像', statInlineHTML([`平均片龄 ${data.avgAge} 年`, `片龄≥10年 ${data.ageBuckets['≥10年']} 部`]) + softBarHTML([{ label: '当年', value: data.ageBuckets['当年'] }, { label: '1-3年', value: data.ageBuckets['1-3年'] }, { label: '4-10年', value: data.ageBuckets['4-10年'] }, { label: '≥10年', value: data.ageBuckets['≥10年'] }], '#E6DFF5') + '<div style="margin-top:10px;">' + barChartHTML(data.eraEntries, { color: '#CDF0EA' }) + '</div>', '#E6DFF5')}
    ${sectionHTML('月度观影分布', barChartHTML(monthEntries, { color: '#CDF0EA', highlight: curMonth }), '#CDF0EA', 'calendar-days')}
    ${sectionHTML('观影节奏', statInlineHTML([`月均 ${data.monthFreq} 部`, `周末 ${data.weekdays[0] + data.weekdays[6]} 部 (${data.total ? Math.round((data.weekdays[0] + data.weekdays[6]) / data.total * 100) : 0}%)`]) + barChartHTML(data.weekdayEntries, { color: '#D6E4FF' }) + (data.yearTrend.length ? '<div style="margin-top:10px;">' + statInlineHTML(data.yearTrend.map((t: any) => `${t.label} ${t.value >= 0 ? '+' : ''}${t.value}%`)) + '</div>' : ''), '#D6E4FF', 'activity')}
    ${sectionHTML('个人评分分布', barChartHTML(bucketEntries, { color: '#FADDE1' }), '#FADDE1', 'star')}
    ${sectionHTML('评分趋势（个人10分制）', barChartHTML(data.yearRatingEntries, { color: '#FFE5CC' }), '#FFE5CC', 'trending-up')}
    ${sectionHTML('打分习惯（个人−豆瓣）', statInlineHTML([`平均差值 ${data.avgDiff >= 0 ? '+' : ''}${data.avgDiff}（个人−豆瓣）`]) + '<div style="font-weight:600;font-size:.8rem;margin:6px 0 4px;">宝藏片（个人≥9 豆瓣&lt;8）</div>' + ratingCompareListHTML(data.treasure) + '<div style="font-weight:600;font-size:.8rem;margin:10px 0 4px;">失望榜（个人≤4 豆瓣≥8.5）</div>' + ratingCompareListHTML(data.disappoint), '#FADDE1', 'list')}
    ${sectionHTML('题材偏好 TOP10', softBarHTML(topN(data.genres, 10), '#E6DFF5'), '#E6DFF5', 'tags')}
    ${sectionHTML('制片国家/地区 TOP10', softBarHTML(topN(data.countries, 10), '#D6E4FF'), '#D6E4FF', 'globe')}
    ${sectionHTML('最爱导演 TOP10', softBarHTML(topN(data.directors, 10), '#D8F3DC'), '#D8F3DC', 'film')}
    ${sectionHTML('最爱主演 TOP10', softBarHTML(topN(data.actors, 10), '#FADDE1'), '#FADDE1', 'users')}
    ${sectionHTML('真爱重复', statInlineHTML([`导演≥3部 ${data.dirRepeat} 人`, `主演≥3部 ${data.actRepeat} 人`]) + softBarHTML([{ label: '导演≥3部', value: data.dirRepeat }, { label: '主演≥3部', value: data.actRepeat }], '#D8F3DC'), '#D8F3DC')}
    ${sectionHTML('影评关键词', statInlineHTML([`有影评 ${data.reviewCount} 篇 (${data.reviewRate}%)`, `平均 ${data.reviewAvgChars} 字`]) + (data.keywordEntries.length ? data.keywordEntries.map(([k, v]) => `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:.72rem;background:${CHART_TYPE_COLORS['公开课']};color:${CHART_INK};margin:2px;">${k} ${v}</span>`).join('') : emptyHTML()), '#E6DFF5', 'message-square')}
    ${sectionHTML('我的高分 TOP10', topListHTML(data.topRated, true), '#FFE5CC', 'trophy')}
    ${sectionHTML('系列追踪', statInlineHTML([`追了 ${data.seriesList.length} 个系列（≥2部）`]) + (data.seriesList.length ? data.seriesList.map(([k, v]: any, i: number) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--bz-cinema-border);"><span style="width:18px;flex-shrink:0;font-size:.72rem;color:var(--bz-cinema-muted);text-align:center;">${i + 1}</span><span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${k}》</span><span style="font-size:.78rem;font-weight:600;color:var(--bz-cinema-accent);flex-shrink:0;">${v} 部</span></div>`).join('') : emptyHTML()), '#D6E4FF', 'link')}
    ${sectionHTML('想看清单（' + (data.wantTotal ?? data.wantList.length) + '）' + (data.wantAvgDouban !== '—' ? ' · 均豆瓣 ' + data.wantAvgDouban : ''), topListHTML(data.wantList, false) + (Object.keys(data.wantTags).length ? '<div style="margin-top:8px;">' + Object.entries(data.wantTags).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([t, c]) => `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:.72rem;background:var(--bz-cinema-panel);color:var(--bz-cinema-text);border:1px solid var(--bz-cinema-border);margin:2px;">${t} ${c}</span>`).join('') + '</div>' : ''), '#FFF3C4', 'bookmark')}
    <p style="text-align:center;font-size:.68rem;color:var(--bz-cinema-muted);margin-top:16px;">个人评分与豆瓣同为 10 分制，可直接对比</p>
  `;
}
