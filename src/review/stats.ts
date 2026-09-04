/**
 * 复习统计与负载计算（ADR-0077，ticket 174）
 *
 * 统计弹窗数据源：全局指标（总复习次数/streak/评级分布/逾期率/平均 R 趋势）+ 单条时间线。
 * 负载：各条目 nextReviewDate 落在某天的数量（未来 N 天分布 / 日历热力图 / 今日明日预告）。
 *
 * streak 口径（用户拍板宽松）：所有评级都算，同一天多次复习算 1 次（仅去重，防刷指标）。
 */

import type { ReviewItem } from './data';
import { FSRS, DEFAULT_W } from './fsrs';

/** 评级 → 中文/颜色（UI 共用） */
export const RATING_NAMES: Record<string, string> = { again: '忘了', hard: '困难', good: '一般', easy: '简单' };
export const RATING_COLORS: Record<string, string> = { again: '#ff4757', hard: '#ff9f43', good: '#2ed573', easy: '#7bed9f' };

export interface ReviewStats {
  /** 总复习次数（按评级记录去重同日） */
  totalReviews: number;
  /** 连续复习天数 streak（宽松口径：所有评级都算，同日去重） */
  streak: number;
  /** 今日复习次数 */
  todayReviews: number;
  /** 评级分布 { rating: count } */
  ratingDist: Record<string, number>;
  /** 逾期率（逾期条目 / 未完成条目） */
  overdueRate: number;
  /** 平均记忆保留度 R（FSRS 相位条目当前 R 的均值；无可算条目为 null） */
  avgR: number | null;
  /** 复习过的笔记数（去重 filePath） */
  reviewedNotes: number;
  /** 最早复习日期（reviewHistory 最早 timestamp；无则 null） */
  firstReviewAt: string | null;
  /** 最近 7 天每日复习次数（补零，键 YYYY-MM-DD） */
  daily7: Array<{ date: string; count: number }>;
}

/** 把 timestamp 转本地日期键 YYYY-MM-DD */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 解析 reviewHistory 成 { timestamp, rating, stage, stability, R? } 列表 */
export interface HistoryEntry {
  timestamp: string;
  rating: string;
  stage: number;
  stability?: number;
  difficulty?: number;
  R?: number;
  /** 所属笔记路径（flatten 时注入） */
  filePath?: string;
}

export function historyOf(item: ReviewItem): HistoryEntry[] {
  return ((item.reviewHistory as any[]) || []).map((h) => ({
    timestamp: h.timestamp,
    rating: h.rating,
    stage: h.stage,
    stability: h.stability,
    difficulty: h.difficulty,
    R: h.R,
  }));
}

/** 全部条目的历史拍平（用于全局统计） */
export function flattenHistory(items: ReviewItem[]): HistoryEntry[] {
  return items.flatMap((i) => historyOf(i).map((h) => ({ ...h, filePath: i.filePath })));
}

/**
 * 全局统计。streak 宽松口径：
 * - 所有评级都计入
 * - 同一天多次复习算 1 次（按日期去重）
 * - streak = 从最近一次复习日往前连续的天数（断一天即停）
 * @param opts.w R 口径权重（拟合优先；缺省回退 DEFAULT_W——与调度排期同口径，item 12 拍板）
 */
export function computeStats(items: ReviewItem[], opts?: { w?: number[] }): ReviewStats {
  const history = flattenHistory(items);
  const days = new Set<string>();
  for (const h of history) days.add(dateKey(new Date(h.timestamp)));

  // 总复习次数（去重同日）
  const totalReviews = days.size;

  // streak：从今天往前连续复习的天数（宽松口径：今天没复习但昨天有，从昨天起算）
  const todayKey = dateKey(new Date());
  let streak = 0;
  // 若今天没复习，从昨天开始往前找连续段
  let cursor = new Date();
  if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // 今日复习次数（同日去重后今日的条数）
  const todayCount = history.filter((h) => dateKey(new Date(h.timestamp)) === todayKey).length;

  // 评级分布
  const ratingDist: Record<string, number> = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const h of history) {
    if (h.rating in ratingDist) ratingDist[h.rating]++;
  }

  // 逾期率
  const active = items.filter((i) => !i.completed && !i.isCompleted);
  const overdue = active.filter((i) => i.isOverdue);
  const overdueRate = active.length ? overdue.length / active.length : 0;

  // 平均 R（FSRS 相位且有 stability+lastReviewed 的条目；R 公式与调度同源 FSRS.R）
  const rFsrs = new FSRS(opts?.w || DEFAULT_W);
  let rSum = 0;
  let rN = 0;
  for (const i of items) {
    if (i.phase === 'fsrs' && i.stability && i.lastReviewed) {
      const t = (new Date().getTime() - new Date(i.lastReviewed).getTime()) / 86400000;
      if (t > 0) {
        rSum += rFsrs.R(t, i.stability);
        rN++;
      }
    }
  }
  const avgR = rN ? rSum / rN : null;

  // 最早复习日期
  let firstReviewAt: string | null = null;
  if (history.length) {
    const ts = history.map((h) => new Date(h.timestamp).getTime());
    firstReviewAt = new Date(Math.min(...ts)).toISOString();
  }

  // 最近 7 天每日复习次数（补零）
  const daily7: Array<{ date: string; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const count = history.filter((h) => dateKey(new Date(h.timestamp)) === key).length;
    daily7.push({ date: key, count });
  }

  const reviewedNotes = new Set(history.filter((h) => h.filePath).map((h) => h.filePath!)).size;

  return {
    totalReviews,
    streak,
    todayReviews: todayCount,
    ratingDist,
    overdueRate,
    avgR,
    reviewedNotes,
    firstReviewAt,
    daily7,
  };
}

/** 负载分布：返回 { date: YYYY-MM-DD, count } 数组（N 天内，含今天） */
export function loadDistribution(items: ReviewItem[], nDays: number): Array<{ date: string; count: number }> {
  const out: Array<{ date: string; count: number }> = [];
  for (let i = 0; i < nDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({ date: dateKey(d), count: 0 });
  }
  for (const item of items) {
    if (item.completed || item.isCompleted || !item.nextReviewDate || item.isMissing) continue;
    const d = new Date(item.nextReviewDate);
    const key = dateKey(d);
    const slot = out.find((x) => x.date === key);
    if (slot) slot.count++;
  }
  return out;
}

/** 今日/明日预告 */
export function loadPreview(items: ReviewItem[]): { today: number; tomorrow: number } {
  const todayKey = dateKey(new Date());
  const tmrDate = new Date();
  tmrDate.setDate(tmrDate.getDate() + 1);
  const tomorrowKey = dateKey(tmrDate);
  let today = 0;
  let tmr = 0;
  for (const item of items) {
    if (item.completed || item.isCompleted || !item.nextReviewDate || item.isMissing) continue;
    const key = dateKey(new Date(item.nextReviewDate));
    if (key === todayKey) today++;
    else if (key === tomorrowKey) tmr++;
  }
  return { today, tomorrow: tmr };
}

/** 日历热力图：近 N 天（默认 35=5 周）每天负载，补零；含周起始对齐（周一开头） */
export function loadHeatmap(items: ReviewItem[], nDays = 35): Array<{ date: string; count: number; weekday: number }> {
  const out: Array<{ date: string; count: number; weekday: number }> = [];
  const today = new Date();
  // 对齐到本周一（JS getDay: 0=周日）作为起始
  const start = new Date(today);
  const dow = start.getDay(); // 0=Sun..6=Sat
  start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
  const days = Math.max(nDays, 35);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d > today) break;
    out.push({ date: dateKey(d), count: 0, weekday: d.getDay() });
  }
  for (const item of items) {
    if (item.completed || item.isCompleted || !item.nextReviewDate || item.isMissing) continue;
    const key = dateKey(new Date(item.nextReviewDate));
    const slot = out.find((x) => x.date === key);
    if (slot) slot.count++;
  }
  return out;
}
