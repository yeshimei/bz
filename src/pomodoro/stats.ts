/**
 * 番茄钟历史聚合（ticket 30）：今日计数 + 近 7 天滚动窗口（含今天，最左 6 天前）。
 * ticket 63：移除读书统计（readingSecondsToday 与完整番茄口径），恢复纯计数。
 * 纯函数，无 DOM 依赖；本地时区按日聚合（ts = 完成时刻时间戳）。
 * 增强包：今日总分钟数（今日行）+ 今日 12 槽时段分布（2 小时一格小方柱）+ 近 7 天每日分钟数（柱 title）。
 */
import type { HistoryEntry } from './state';
import { pad2 } from '../core/utils';

export interface DayCount {
  /** YYYY-MM-DD（本地时区） */
  date: string;
  count: number;
  /** 当日专注总分钟数（HistoryEntry.duration 秒求和折分钟，四舍五入） */
  minutes: number;
}

/** 时段分布槽：2 小时一格（hour = 槽起始小时 0/2/…/22） */
export interface HourBucket {
  hour: number;
  count: number;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 今日完成番茄数 */
export function todayCount(history: HistoryEntry[], now: number): number {
  const today = dayKey(now);
  return history.filter((h) => dayKey(h.ts) === today).length;
}

/** 今日专注总分钟数（duration 秒求和折分钟；时长均为整分钟倍数，round 仅防御浮点） */
export function todayMinutes(history: HistoryEntry[], now: number): number {
  const today = dayKey(now);
  return Math.round(history.filter((h) => dayKey(h.ts) === today).reduce((s, h) => s + h.duration, 0) / 60);
}

/** 今日专注时段分布：12 槽每槽 2 小时（[0,2) [2,4) … [22,24)），按完成时刻落槽 */
export function todayHourBuckets(history: HistoryEntry[], now: number): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 12 }, (_, i) => ({ hour: i * 2, count: 0 }));
  const today = dayKey(now);
  for (const h of history) {
    if (dayKey(h.ts) !== today) continue;
    const hour = new Date(h.ts).getHours();
    buckets[Math.min(11, Math.floor(hour / 2))].count += 1;
  }
  return buckets;
}

/** 近 7 天滚动窗口（含今天，最左 6 天前；窗口外不计），每日含计数与总分钟数 */
export function last7Days(history: HistoryEntry[], now: number): DayCount[] {
  const counts = new Map<string, number>();
  const minutes = new Map<string, number>();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(day.getDate() - i); // 日历日递减（DST 安全）
    const key = dayKey(day.getTime());
    counts.set(key, 0);
    minutes.set(key, 0);
  }
  for (const h of history) {
    const key = dayKey(h.ts);
    if (counts.has(key)) {
      counts.set(key, counts.get(key)! + 1);
      minutes.set(key, minutes.get(key)! + h.duration / 60);
    }
  }
  return Array.from(counts.entries()).map(([date, count]) => ({
    date,
    count,
    minutes: Math.round(minutes.get(date) || 0),
  }));
}
