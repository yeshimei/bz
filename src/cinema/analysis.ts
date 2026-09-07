/**
 * 影院（cinema）影视分析：完整版（原独立观影报告 19 板块全部并入，ADR-0090）
 * 数据源：M.items（cinema 已解析条目，含豆瓣/片长/季集字段）；
 * 渲染类名对齐域内原型（issue 236 / ADR-0103），共享样式 scoped 在 .bz-cinema--midnight。
 */
import { STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED } from './constants';
import { M } from './state';
import { escapeHtml } from '../core/utils';

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

  // ② 片长（ADR-0090 自独立报告并入：按分钟分桶 + 分组均长）
  const durMatch = String(it.duration || '').match(/^(\d+)/);
  if (durMatch) {
    const mins = Number(durMatch[1]);
    if (mins < 90) data.durBuckets['<90']++;
    else if (mins <= 120) data.durBuckets['90-120']++;
    else data.durBuckets['>120']++;
    data.durSum += mins; data.durCount++;
    const gd = data.groupDur[group] = data.groupDur[group] || { sum: 0, count: 0 };
    gd.sum += mins; gd.count++;
  }

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

  // ⑦ 季集（首个数字；ADR-0090 自独立报告并入）
  const seasonMatch = String(it.seasonText || '').match(/(\d+)/);
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

/** 汇总派生字段 */
function finalizeAnalysis(data: any): void {
  data.topRated.sort((a: any, b: any) => b.rating - a.rating);
  data.topRated = data.topRated.slice(0, 10);
  data.wantTotal = data.wantList.length;
  data.wantList = data.wantList.slice(0, 10);
  data.treasure = data.treasure.sort((a: any, b: any) => b.rating - a.rating).slice(0, 10);
  data.disappoint = data.disappoint.sort((a: any, b: any) => a.rating - b.rating).slice(0, 10);
  data.seasons = data.seasons.sort((a: any, b: any) => b.seasons - a.seasons).slice(0, 5);
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

// ======================= 渲染（午夜场分析页语言，原型 statPageHTML 同构；ADR-0103） =======================
// 数据采集半段（buildAnalysisData）不动；渲染类名对齐域内原型（stat-cards/sec/bar-row/soft-row/
// top-row/tag-cloud/kv-inline/cn-empty），共享样式 scoped 在 .bz-cinema--midnight（弹窗宿主承接）。

function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}

function emptyHTML(): string {
  return '<div class="cn-empty">暂无数据</div>';
}

/** 水平条形行（原型 bar-row；opt.color 覆盖金色默认） */
function barHTML(entries: { label: string; value: number }[], opt?: { color?: string }): string {
  if (!entries || !entries.length) return emptyHTML();
  const max = Math.max(1, ...entries.map((e) => e.value));
  return entries.map((e) =>
    `<div class="bar-row"><span class="bar-label">${esc(e.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round((e.value / max) * 100)}%;${opt?.color ? 'background:' + opt.color + ';' : ''}"></span></span><span class="bar-num">${e.value}</span></div>`).join('');
}

/** 柔和条形行（原型 soft-row） */
function softHTML(entries: { label: string; value: number }[]): string {
  if (!entries || !entries.length) return emptyHTML();
  const max = Math.max(1, ...entries.map((e) => e.value));
  return entries.map((e) =>
    `<div class="soft-row"><span class="bar-label">${esc(e.label)}</span><span class="soft-track"><span class="soft-fill" style="width:${Math.round((e.value / max) * 100)}%"></span></span><span class="bar-num">${e.value}</span></div>`).join('');
}

function secHTML(title: string, icon: string, body: string): string {
  return `<div class="sec"><div class="sec-title"><i data-lucide="${icon}" class="bz-ic"></i>${esc(title)}</div>${body}</div>`;
}

function kvInline(items: string[]): string {
  return `<div class="kv-inline">${items.map((s) => `<span>${s}</span>`).join('')}</div>`;
}

function topRow(no: string, name: string, val: string): string {
  return `<div class="top-row"><span class="top-no">${no}</span><span class="top-name">${name}</span><span class="top-val">${val}</span></div>`;
}

const topN = (map: Record<string, number>, n: number) =>
  Object.entries(map).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, n).map(([label, value]) => ({ label, value: value as number }));

/** 完整分析页内容（kv 摘要 + 4 统计卡 + 19 板块；页头 sp-head 由 ui.ts 承担） */
export function buildAnalysisHTML(): string {
  const data = buildAnalysisData();
  if (data.total === 0) {
    return `<div class="cn-empty-page"><div class="big">还没有可统计的影视记录</div>
      <div style="font-size:11.5px;color:var(--ink-3)">影视文件夹「${esc(M.folderPath)}」里还没有可分析的条目，添加影视后这里会生成你的观影统计</div>
      <div style="margin-top:8px"><button class="dm-btn" data-cinema-analysis-add>添加影视</button></div></div>`;
  }
  const avgRating = data.ratingCount ? (data.ratingSum / data.ratingCount).toFixed(1) : '';
  const yearEntries = Object.keys(data.years).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y, value: data.years[y] as number }));
  const monthEntries = Array.from({ length: 12 }, (_, i) => ({ label: (i + 1) + '月', value: data.months[i + 1] || 0 }));
  const bucketEntries = ['≥9', '8~9', '7~8', '6~7', '5~6', '<5'].map((b) => ({ label: b, value: data.buckets[b] as number }));
  const ageEntries = Object.entries(data.ageBuckets).map(([label, value]) => ({ label, value: value as number }));
  const durEntries = [['<90分', data.durBuckets['<90']], ['90-120分', data.durBuckets['90-120']], ['>120分', data.durBuckets['>120']]].map(([label, value]) => ({ label: label as string, value: value as number }));
  const weekend = data.weekdays[0] + data.weekdays[6];
  const weekEntries = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((w, i) => ({ label: w, value: data.weekdays[(i + 1) % 7] as number }));
  const cmpRow = (it: any) => topRow('', `《${esc(it.name)}》`, `我 ${Number(it.rating).toFixed(1)} / 豆 ${Number(it.douban).toFixed(1)}`);

  return `${kvInline([`月均 <b>${data.monthFreq}</b> 部`, `周末 <b>${weekend}</b> 部`, `有影评 <b>${data.reviewCount}</b> 篇`])}
  <div class="stat-cards">
    <div class="stat-card"><div class="v">${data.total}</div><div class="k">馆藏总数</div></div>
    <div class="stat-card"><div class="v">${data.watched}</div><div class="k">已放映</div></div>
    <div class="stat-card"><div class="v">${avgRating || '—'}</div><div class="k">平均评分</div></div>
    <div class="stat-card"><div class="v">${data.avgDiff === '—' ? '—' : (Number(data.avgDiff) >= 0 ? '+' : '') + data.avgDiff}</div><div class="k">个人−豆瓣</div></div>
  </div>
  ${secHTML('类型分布', 'clapperboard', softHTML(topN(data.groups, 8)))}
  ${secHTML('年度观影趋势', 'bar-chart-3', barHTML(yearEntries))}
  ${secHTML('片龄画像', 'bar-chart-3', kvInline([`平均片龄 <b>${data.avgAge}</b> 年`, `片龄≥10年 <b>${data.ageBuckets['≥10年']}</b> 部`]) + softHTML(ageEntries) + '<div style="margin-top:10px">' + barHTML(data.eraEntries) + '</div>')}
  ${secHTML('片长画像', 'bar-chart-3', data.durCount ? kvInline([`平均片长 <b>${data.avgDur}</b> 分钟`]) + softHTML(durEntries) : '<div class="cn-empty">暂无片长数据（笔记 frontmatter 未含时长字段）</div>')}
  ${secHTML('月度观影分布', 'bar-chart-3', barHTML(monthEntries))}
  ${secHTML('观影节奏', 'bar-chart-3', kvInline([`月均 <b>${data.monthFreq}</b> 部`, `周末 <b>${weekend}</b> 部（${data.total ? Math.round(weekend / data.total * 100) : 0}%）`]) + barHTML(weekEntries))}
  ${secHTML('个人评分分布', 'bar-chart-3', barHTML(bucketEntries))}
  ${secHTML('评分趋势（个人10分制）', 'bar-chart-3', barHTML(data.yearRatingEntries, { color: '#8fa3bd' }))}
  ${secHTML('打分习惯（个人−豆瓣）', 'bar-chart-3', kvInline([`平均差值 <b>${data.avgDiff === '—' ? '—' : (Number(data.avgDiff) >= 0 ? '+' : '') + data.avgDiff}</b>（个人−豆瓣）`]) + '<div style="font-weight:600;font-size:12px;margin:6px 0 4px">宝藏片（个人≥9 豆瓣&lt;8）</div>' + (data.treasure.length ? data.treasure.map(cmpRow).join('') : emptyHTML()) + '<div style="font-weight:600;font-size:12px;margin:10px 0 4px">失望榜（个人≤4 豆瓣≥8.5）</div>' + (data.disappoint.length ? data.disappoint.map(cmpRow).join('') : emptyHTML()))}
  ${secHTML('题材偏好 TOP10', 'bar-chart-3', softHTML(topN(data.genres, 10)))}
  ${secHTML('制片国家/地区 TOP10', 'bar-chart-3', softHTML(topN(data.countries, 10)))}
  ${secHTML('最爱导演 TOP10', 'bar-chart-3', softHTML(topN(data.directors, 10)))}
  ${secHTML('最爱主演 TOP10', 'bar-chart-3', softHTML(topN(data.actors, 10)))}
  ${secHTML('真爱重复', 'bar-chart-3', kvInline([`导演≥3部 <b>${data.dirRepeat}</b> 人`, `主演≥3部 <b>${data.actRepeat}</b> 人`]) + softHTML([{ label: '导演≥3部', value: data.dirRepeat as number }, { label: '主演≥3部', value: data.actRepeat as number }]))}
  ${secHTML('影评关键词', 'bar-chart-3', kvInline([`有影评 <b>${data.reviewCount}</b> 篇（${data.reviewRate}%）`]) + (data.keywordEntries.length ? `<div class="tag-cloud">${data.keywordEntries.map(([k, v]) => `<span class="tag-pill">${esc(k)} <b>${v as number}</b></span>`).join('')}</div>` : emptyHTML()))}
  ${secHTML('我的高分 TOP10', 'bar-chart-3', data.topRated.length ? data.topRated.map((it: any, i: number) => topRow(String(i + 1), esc(it.name), Number(it.rating).toFixed(1))).join('') : emptyHTML())}
  ${secHTML('系列追踪', 'bar-chart-3', data.seriesList.length ? data.seriesList.map(([k, v]: any, i: number) => topRow(String(i + 1), `《${esc(k)}》`, `${v as number} 部`)).join('') : emptyHTML())}
  ${secHTML('追剧深度', 'bar-chart-3', data.seasons.length ? kvInline([`平均 <b>${data.avgSeason}</b> 季`]) + data.seasons.map((s: any, i: number) => topRow(String(i + 1), `《${esc(s.name)}》`, `${s.seasons} 季`)).join('') : emptyHTML())}
  ${secHTML(`想看清单（${data.wantTotal ?? data.wantList.length}）`, 'bar-chart-3', (data.wantList.length ? data.wantList.map((it: any, i: number) => topRow(String(i + 1), esc(it.name) + (it.douban ? ' · 豆瓣 ' + esc(it.douban) : ''), '')).join('') : emptyHTML()) + (Object.keys(data.wantTags).length ? '<div class="tag-cloud" style="margin-top:10px">' + Object.entries(data.wantTags).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([t, c]) => `<span class="tag-pill">${esc(t)} <b>${c as number}</b></span>`).join('') + '</div>' : ''))}`;
}
