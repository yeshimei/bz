/**
 * 番茄钟历史聚合（ticket 30）：今日计数 + 近 7 天滚动窗口（含今天，最左 6 天前）。
 * ticket 63：移除读书统计（readingSecondsToday 与完整番茄口径），恢复纯计数。
 * 纯函数，无 DOM 依赖；本地时区按日聚合（ts = 完成时刻时间戳）。
 * 口径：今日总分钟数（今日行）+ 近 7 天每日计数与分钟数（柱高/柱 title）。
 * （今日 12 槽时段分布已随弹窗降噪整行删除，2026-09-11 拍板——生产侧零消费者的 todayHourBuckets 一并退役。）
 */
import type { HistoryEntry } from './state';
import { localDayKey } from '../core/utils';

export interface DayCount {
  /** YYYY-MM-DD（本地时区） */
  date: string;
  count: number;
  /** 当日专注总分钟数（HistoryEntry.duration 秒求和折分钟，四舍五入） */
  minutes: number;
}

function dayKey(ts: number): string {
  return localDayKey(ts);
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
