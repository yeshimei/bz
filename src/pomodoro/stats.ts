/**
 * 番茄钟历史聚合（ticket 30）：今日计数 + 近 7 天滚动窗口（含今天，最左 6 天前）。
 * ticket 63：移除读书统计（readingSecondsToday 与完整番茄口径），恢复纯计数。
 * 纯函数，无 DOM 依赖；本地时区按日聚合（ts = 完成时刻时间戳）。
 */
import type { HistoryEntry } from './state';
import { pad2 } from '../core/utils';

export interface DayCount {
  /** YYYY-MM-DD（本地时区） */
  date: string;
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

/** 近 7 天滚动窗口（含今天，最左 6 天前；窗口外不计） */
export function last7Days(history: HistoryEntry[], now: number): DayCount[] {
  const counts = new Map<string, number>();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(day.getDate() - i); // 日历日递减（DST 安全）
    counts.set(dayKey(day.getTime()), 0);
  }
  for (const h of history) {
    const key = dayKey(h.ts);
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}