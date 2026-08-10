/**
 * 番茄钟历史聚合（ticket 30）：今日计数 + 近 7 天滚动窗口（含今天，最左 6 天前）。
 * 纯函数，无 DOM 依赖；本地时区按日聚合（ts = 完成时刻时间戳）。
 */
import type { HistoryEntry } from './state';

export interface DayCount {
  /** YYYY-MM-DD（本地时区） */
  date: string;
  count: number;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 今日完成番茄数 */
export function todayCount(history: HistoryEntry[], now: number): number {
  const today = dayKey(now);
  return history.filter((h) => dayKey(h.ts) === today).length;
}

/** 今日读书分钟数（任务关联：按 target.type=book 聚合，取整分钟） */
export function bookMinutesToday(history: HistoryEntry[], now: number): number {
  const today = dayKey(now);
  const secs = history
    .filter((h) => dayKey(h.ts) === today && h.target?.type === 'book')
    .reduce((s, h) => s + h.duration, 0);
  return Math.round(secs / 60);
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
