/**
 * 番茄钟历史聚合（ticket 30）：今日计数 + 近 7 天滚动窗口（含今天，最左 6 天前）。
 * ticket 62 统计口径：book 条目仅 duration ≥ 读书专注满时长（45min）才算「一个番茄」；
 * 中途关书/换书按实读结算的部分条目只进时长（readingSecondsToday）不计个数。
 * 纯函数，无 DOM 依赖；本地时区按日聚合（ts = 完成时刻时间戳）。
 */
import type { HistoryEntry } from './state';
import { PRESETS } from './config';
import { pad2 } from '../core/utils';

/** 完整读书番茄阈值（秒）= 读书预设「阅读沉浸」专注时长 45min */
const FULL_READING_SEC = PRESETS.reading.workMin * 60;

/** 是否计为一个「完整番茄」：book 条目须 duration ≥ 满段时长；非 book 条目（主番茄钟 tick 完成）恒计 */
function isFullPomodoro(h: HistoryEntry): boolean {
  if (h.target?.type === 'book') {
    return typeof h.duration === 'number' && h.duration >= FULL_READING_SEC;
  }
  return true;
}

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

/** 今日完成番茄数（ticket 62：仅计完整番茄） */
export function todayCount(history: HistoryEntry[], now: number): number {
  const today = dayKey(now);
  return history.filter((h) => dayKey(h.ts) === today && isFullPomodoro(h)).length;
}

/** 今日读书时长（秒）：target.type=book 历史条目的实读秒数之和（ticket 56——统计改为时长，不再按完成番茄个数） */
export function readingSecondsToday(history: HistoryEntry[], now: number): number {
  const today = dayKey(now);
  return history
    .filter((h) => dayKey(h.ts) === today && h.target?.type === 'book')
    .reduce((sum, h) => sum + (typeof h.duration === 'number' ? h.duration : 0), 0);
}

/** 近 7 天滚动窗口（含今天，最左 6 天前；窗口外不计；ticket 62：仅计完整番茄） */
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
    if (counts.has(key)) counts.set(key, counts.get(key)! + (isFullPomodoro(h) ? 1 : 0));
  }
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}
