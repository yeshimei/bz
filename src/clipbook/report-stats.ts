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
import { pad2 } from '../core/ui/str';

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
  /** 连续阅读天数（全历史口径，非周期窗口；今天没读不打断） */
  streakDays: number;
}

/** 来源分布 / 最长阅读榜取前 N（对齐 reading-report 作者 Top 5 口径） */
export const REPORT_TOP_N = 5;

function hourOf(ts: number): number {
  const h = new Date(ts).getHours();
  return h >= 0 && h < 24 ? h : 0;
}

function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  // pad2 单源（一致#12）：core/ui/str 零依赖区（与 render.ts 同径，不经 core/utils）
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
    streakDays: streakDays(log, now),
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

/* ================= 原创分析扩展（2026-09-23「我读了什么」重做） =================
 * 自创「报社工班」口径（不借影院放映室语言）：阅读时段按报社排班分四班——
 * 夜班（0-6 点）/ 晨班（6-12 点）/ 午班（12-18 点）/ 晚班（18-24 点）；
 * 报库盘点 = news.json 未读流的真实家底（建库以来），与阅读周期窗口无关。 */

/** 四班时段行 */
export interface ClipShift {
  key: 'night' | 'morning' | 'noon' | 'evening';
  label: string;
  span: string;
  minutes: number;
}

const CLIP_SHIFTS: Array<{ key: ClipShift['key']; label: string; span: string; from: number; to: number }> = [
  { key: 'night', label: '夜班', span: '0-6 点', from: 0, to: 6 },
  { key: 'morning', label: '晨班', span: '6-12 点', from: 6, to: 12 },
  { key: 'noon', label: '午班', span: '12-18 点', from: 12, to: 18 },
  { key: 'evening', label: '晚班', span: '18-24 点', from: 18, to: 24 },
];

/** 24 小时桶 → 四班汇总（各班 = 该班小时桶分钟求和） */
export function shiftBuckets(hours: number[]): ClipShift[] {
  return CLIP_SHIFTS.map((s) => ({
    key: s.key, label: s.label, span: s.span,
    minutes: (hours || []).slice(s.from, s.to).reduce((sum, m) => sum + m, 0),
  }));
}

/** 小时 → 班次名（高峰人话用） */
export function shiftOfHour(h: number): string {
  const s = CLIP_SHIFTS.find((x) => h >= x.from && h < x.to);
  return s ? s.label : '晚班';
}

/** 连续阅读天数：从今天往回逐日数（今天还没读不打断——从昨天起数），断一天即停 */
export function streakDays(log: ClipReadLogEntry[] | null | undefined, now: Date = new Date()): number {
  const days = new Set<string>();
  for (const e of log || []) {
    if (e && typeof e.ts === 'number' && isFinite(e.ts) && (Number(e.minutes) || 0) > 0) days.add(dayKeyOf(e.ts));
  }
  if (!days.size) return 0;
  const keyOf = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(keyOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(keyOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 本期最投入的一天 */
export interface ClipDayRow { date: string; minutes: number }

/** 周期内按日聚合分钟，取最投入的一天（并列取较早日；无有效段 → null） */
export function busiestDay(log: ClipReadLogEntry[] | null | undefined, period: ReportPeriod, now: Date = new Date()): ClipDayRow | null {
  const perDay = new Map<string, number>();
  for (const e of filterReadLogByPeriod(log, period, now)) {
    const m = Math.max(0, Math.round(Number(e.minutes) || 0));
    if (m <= 0) continue;
    const k = dayKeyOf(e.ts);
    perDay.set(k, (perDay.get(k) || 0) + m);
  }
  let best: ClipDayRow | null = null;
  for (const [date, minutes] of perDay) {
    if (!best || minutes > best.minutes || (minutes === best.minutes && date < best.date)) best = { date, minutes };
  }
  return best;
}

/** 收录节奏窗口（近 N 天，今日为窗尾） */
export const LIB_PACE_DAYS = 14;

/** 报库盘点（news.json 未读流家底；articles 为原始 json 条目形状） */
export interface ClipLibraryStats {
  /** 在流总篇数 */
  total: number;
  /** 已读篇数（read 标记） */
  readCount: number;
  /** 待读篇数 */
  unread: number;
  /** 已读率（0-100 整数） */
  readRate: number;
  /** 近 LIB_PACE_DAYS 天收录节奏（label = 'M/D'，今日收尾） */
  byDay: Array<{ label: string; n: number }>;
  /** 窗口内单日收录峰值 */
  byDayPeak: number;
  /** 在流来源 Top（篇数降序前 REPORT_TOP_N） */
  topPlatforms: Array<{ name: string; n: number }>;
  /** 压库最久的待读（fetchedAt 最早；全部无日期 → null） */
  oldestUnread: { title: string; src: string; days: number } | null;
}

/** 聚合报库盘点。日期解析用 Date.parse（fetchedAt = 「YYYY-MM-DD HH:mm:ss」本地口径）；
 *  无 fetchedAt 的条目不参与收录节奏与压库判定（缺字段不造数，yearbook 同纪律）。 */
export function buildLibraryStats(
  articles: Array<{ platform?: string; title?: string; read?: boolean; fetchedAt?: string; date?: string }> | null | undefined,
  now: Date = new Date(),
): ClipLibraryStats {
  const list = articles || [];
  let readCount = 0;
  const platformMap = new Map<string, number>();
  let oldestTs = Infinity;
  let oldest: ClipLibraryStats['oldestUnread'] = null;
  for (const a of list) {
    if (a.read) readCount += 1;
    const p = String(a.platform || '').trim() || '未知';
    platformMap.set(p, (platformMap.get(p) || 0) + 1);
    if (!a.read) {
      const ts = Date.parse(String(a.fetchedAt || a.date || ''));
      if (isFinite(ts) && ts < oldestTs) {
        oldestTs = ts;
        oldest = {
          title: String(a.title || '(无标题)'),
          src: p,
          days: Math.max(0, Math.floor((now.getTime() - ts) / 86400000)),
        };
      }
    }
  }
  const dayStart = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const firstTs = dayStart(now) - (LIB_PACE_DAYS - 1) * 86400000;
  const buckets = new Array<number>(LIB_PACE_DAYS).fill(0);
  for (const a of list) {
    const ts = Date.parse(String(a.fetchedAt || ''));
    if (!isFinite(ts) || ts < firstTs) continue;
    const idx = LIB_PACE_DAYS - 1 - Math.floor((dayStart(new Date(ts)) - firstTs) / 86400000);
    if (idx >= 0 && idx < LIB_PACE_DAYS) buckets[idx] += 1;
  }
  const byDay: Array<{ label: string; n: number }> = [];
  for (let i = 0; i < LIB_PACE_DAYS; i++) {
    const d = new Date(firstTs + i * 86400000);
    byDay.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, n: buckets[i] });
  }
  const topPlatforms = [...platformMap.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, REPORT_TOP_N);
  const total = list.length;
  return {
    total,
    readCount,
    unread: total - readCount,
    readRate: total ? Math.round((readCount / total) * 100) : 0,
    byDay,
    byDayPeak: Math.max(0, ...buckets),
    topPlatforms,
    oldestUnread: oldest,
  };
}
