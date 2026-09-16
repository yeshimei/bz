/**
 * clipbook 阅读报告·统计纯函数（issue 358）。
 *
 * 数据源 = clipbook.json 侧写 readLog 段（ClipReadLogEntry：一次封存的连续阅读段）。
 * 全部无 DOM / 无 obsidian 依赖，node 可测；now 显式入参供测试固定周期边界。
 * 口径：
 * - 篇数 = 按条目 key 去重（同篇多次会话不重复计篇）；
 * - 总时长 = 各会话段 minutes 求和；
 * - 来源分布 = src（ClipArticle.srcName：B站 UP 名 / 平台 / 剪藏站点）分组；
 * - 时段分布 = 会话封存时刻 ts 的小时桶（每桶 = 该时段阅读分钟数，读多久权重落在哪一刻）。
 */
import type { ClipReadLogEntry } from './data';

/** 报告周期：本周（周一起）/ 本月（1 日起） */
export type ReportPeriod = 'week' | 'month';

/** 周期起点（本地时区 00:00）：week = 本周一；month = 本月 1 日。 */
export function periodStartTs(period: ReportPeriod, now: Date): number {
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  // 周一为一周之始：getDay() 周日=0 → 平移成周一=0
  const offset = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset).getTime();
}

/** 周期过滤（ts ∈ [周期起点, +∞)；未来时间不裁——钟差容错，报告口径不变） */
export function filterReadLogByPeriod(log: ClipReadLogEntry[] | null | undefined, period: ReportPeriod, now: Date): ClipReadLogEntry[] {
  const start = periodStartTs(period, now);
  return (log || []).filter((e) => e && typeof e.ts === 'number' && isFinite(e.ts) && e.ts >= start);
}

/** 来源分布行 */
export interface ClipSrcRow {
  name: string;
  /** 去重篇数（该来源读过的不同条目数） */
  articles: number;
  /** 累计分钟 */
  minutes: number;
}

/** 报告聚合结果（report-ui 分段渲染的单一数据形状） */
export interface ClipReportData {
  period: ReportPeriod;
  /** 去重篇数（按 key） */
  articles: number;
  /** 会话段数（同篇多次打开分段计） */
  sessions: number;
  totalMinutes: number;
  /** 来源分布（分钟降序，分钟同则篇数降序），调用方自取 Top N */
  bySrc: ClipSrcRow[];
  /** 24 小时桶：每桶 = 该小时（本地时区）阅读分钟数 */
  hours: number[];
  /** 本期读得最久的条目（分钟降序 Top 5） */
  topArticles: Array<{ key: string; title: string; src: string; minutes: number }>;
  /** 有阅读的天数（本地日去重） */
  activeDays: number;
}

/** 来源分布 / 最长阅读榜取前 N（对齐 reading-report 作者 Top 5 口径） */
export const REPORT_TOP_N = 5;

function hourOf(ts: number): number {
  const h = new Date(ts).getHours();
  return h >= 0 && h < 24 ? h : 0;
}

function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 聚合一份周期报告（log 空或全被过滤 → 零值结果，调用方按 articles/totalMinutes 判空态） */
export function buildClipReport(log: ClipReadLogEntry[] | null | undefined, period: ReportPeriod, now: Date = new Date()): ClipReportData {
  const entries = filterReadLogByPeriod(log, period, now);

  const minutesByKey = new Map<string, { entry: ClipReadLogEntry; minutes: number }>();
  const srcMap = new Map<string, ClipSrcRow>();
  const hours = new Array<number>(24).fill(0);
  const days = new Set<string>();
  let totalMinutes = 0;

  for (const e of entries) {
    const m = Math.max(0, Math.round(Number(e.minutes) || 0));
    if (m <= 0) continue;
    totalMinutes += m;
    hours[hourOf(e.ts)] += m;
    days.add(dayKeyOf(e.ts));
    const key = String(e.key || '');
    const src = String(e.src || '').trim() || '未知';
    const prev = minutesByKey.get(key);
    if (prev) prev.minutes += m;
    else minutesByKey.set(key, { entry: e, minutes: m });
    let row = srcMap.get(src);
    if (!row) {
      row = { name: src, articles: 0, minutes: 0 };
      srcMap.set(src, row);
    }
    row.minutes += m;
  }

  // 篇数按 key 归组后逐篇计一次（同篇分段不重复计）
  for (const { entry } of minutesByKey.values()) {
    const src = String(entry.src || '').trim() || '未知';
    const row = srcMap.get(src);
    if (row) row.articles += 1;
  }

  const bySrc = [...srcMap.values()].sort((a, b) => b.minutes - a.minutes || b.articles - a.articles || a.name.localeCompare(b.name));
  const topArticles = [...minutesByKey.entries()]
    .map(([key, v]) => ({ key, title: v.entry.title || '(无标题)', src: String(v.entry.src || '').trim() || '未知', minutes: v.minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.key.localeCompare(b.key))
    .slice(0, 5);

  return {
    period,
    articles: minutesByKey.size,
    sessions: entries.length,
    totalMinutes,
    bySrc,
    hours,
    topArticles,
    activeDays: days.size,
  };
}

/** 分钟 → 人话时长（75 → 「1 小时 15 分钟」；45 → 「45 分钟」） */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} 分钟`;
  return r > 0 ? `${h} 小时 ${r} 分钟` : `${h} 小时`;
}
