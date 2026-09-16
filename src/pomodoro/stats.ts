/**
 * 番茄钟历史聚合（ticket 30）：今日计数 + 近 7 天滚动窗口（含今天，最左 6 天前）。
 * ticket 63：移除读书统计（readingSecondsToday 与完整番茄口径），恢复纯计数。
 * 纯函数，无 DOM 依赖；本地时区按日聚合（ts = 完成时刻时间戳）。
 * 口径：今日总分钟数（今日行）+ 近 7 天每日计数与分钟数（柱高/柱 title）。
 * （今日 12 槽时段分布已随弹窗降噪整行删除，2026-09-11 拍板——生产侧零消费者的 todayHourBuckets 一并退役。）
 * issue 357：周归档聚合（weekKeyOf/aggregateWeeks/mergeArchived）+ 月趋势合成（lastNMonths）
 * ——归档行由 data.ts 裁剪时落账，这里只做纯聚合/合并/合成，全部可测。
 */
import type { HistoryEntry, ArchivedWeek } from './state';
import { localDayKey, pad2 } from '../core/utils';

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

// ==================== 周归档聚合（issue 357） ====================

/** 月趋势档位：近 6 个月（含当月，旧→新） */
export const TREND_MONTHS = 6;

/** 月趋势行（YYYY-MM 本地时区） */
export interface MonthCount {
  month: string;
  count: number;
  minutes: number;
}

/**
 * 周 key：条目所属自然周的周一本地日期（YYYY-MM-DD）。周一起始；getDay 周日=0 平移成周一=0。
 */
export function weekKeyOf(ts: number): string {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDayKey(d.getTime());
}

/** 按周 key 升序（旧→新） */
function byWeek(a: ArchivedWeek, b: ArchivedWeek): number {
  return a.week < b.week ? -1 : a.week > b.week ? 1 : 0;
}

/**
 * 明细条目按自然周聚合成归档行（周粒度：总分钟/次数/任务分布）。
 * 任务分布按分钟记账（duration 秒折分钟，round 防浮点）；无归属任务的周不带 tasks 键。
 */
export function aggregateWeeks(entries: HistoryEntry[]): ArchivedWeek[] {
  const acc = new Map<string, { count: number; sec: number; tasks: Map<string, number> }>();
  for (const h of entries) {
    const wk = weekKeyOf(h.ts);
    let row = acc.get(wk);
    if (!row) {
      row = { count: 0, sec: 0, tasks: new Map() };
      acc.set(wk, row);
    }
    row.count += 1;
    row.sec += h.duration;
    if (h.task) row.tasks.set(h.task, (row.tasks.get(h.task) || 0) + h.duration / 60);
  }
  return Array.from(acc.entries())
    .map(([week, r]): ArchivedWeek => ({
      week,
      count: r.count,
      minutes: Math.round(r.sec / 60),
      ...(r.tasks.size
        ? {
            tasks: Object.fromEntries(
              Array.from(r.tasks.entries())
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .map(([t, m]) => [t, Math.round(m)])
            ),
          }
        : {}),
    }))
    .sort(byWeek);
}

/**
 * 归档行合并（issue 357 幂等口径）：同一周不建第二行——以 week key 判重后增量累加
 * （count/minutes 求和、tasks 逐任务求和），结果按周升序。incoming 与 existing 同周重叠时
 * 是「增量合并」而非替换，调用方保证 incoming 只含刚离开保留窗的条目（明细已从 history 移除，
 * 不会二次入账）。
 */
export function mergeArchived(existing: ArchivedWeek[] | undefined, incoming: ArchivedWeek[]): ArchivedWeek[] {
  const merged = new Map<string, ArchivedWeek>();
  for (const row of existing ?? []) merged.set(row.week, { ...row });
  for (const row of incoming) {
    const cur = merged.get(row.week);
    if (!cur) {
      merged.set(row.week, { ...row });
      continue;
    }
    const tasks: Record<string, number> = { ...(cur.tasks || {}) };
    for (const [t, m] of Object.entries(row.tasks || {})) {
      tasks[t] = Math.round((tasks[t] || 0) + m);
    }
    merged.set(row.week, {
      week: row.week,
      count: cur.count + row.count,
      minutes: cur.minutes + row.minutes,
      ...(Object.keys(tasks).length ? { tasks } : {}),
    });
  }
  return Array.from(merged.values()).sort(byWeek);
}

/**
 * 近 N 月趋势合成（issue 357）：归档行 + 当前 7 天明细合成月柱数据，两源不重复累计——
 * 归档行只含已离开保留窗的日子（裁剪时落账），明细只含窗口内日子，按日恒不交。
 * 归档行整周记入其周一所属月（跨月周不拆分）；窗口外月份的归档行不计。
 * 旧文件无 archived 段 → 只有当月明细，首周起算（零迁移）。
 */
export function lastNMonths(
  archived: ArchivedWeek[] | undefined,
  history: HistoryEntry[],
  now: number,
  n: number = TREND_MONTHS
): MonthCount[] {
  const base = new Date(now);
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  const buckets = new Map<string, { count: number; sec: number }>();
  const order: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(base);
    m.setMonth(m.getMonth() - i); // 月初起算，无月末溢出
    const key = `${m.getFullYear()}-${pad2(m.getMonth() + 1)}`;
    buckets.set(key, { count: 0, sec: 0 });
    order.push(key);
  }
  for (const row of archived ?? []) {
    const b = buckets.get(row.week.slice(0, 7));
    if (b) {
      b.count += row.count;
      b.sec += row.minutes * 60;
    }
  }
  for (const h of history) {
    const b = buckets.get(localDayKey(h.ts).slice(0, 7));
    if (b) {
      b.count += 1;
      b.sec += h.duration;
    }
  }
  return order.map((month) => {
    const b = buckets.get(month)!;
    return { month, count: b.count, minutes: Math.round(b.sec / 60) };
  });
}
