/**
 * 游戏架（gameshelf）域报告纯函数（issue 368）：库总览 / 时长排行 / 最近在玩 / 口径诚实注记。
 * 口径（票 368 拍板）：Steam 只提供 lastPlayed（最后游玩日期），无逐日历史游玩记录——
 * 「游玩分布」按 lastPlayed 月份分布呈现，不做无法兑现的每日时长曲线；成就查询二版。
 */
import type { GameItem } from './state';

export interface GameshelfReport {
  /** 在架游戏数（offShelf 不计） */
  total: number;
  /** 累计时长小时（一位小数） */
  totalHours: number;
  /** 下架保留数（offShelf） */
  offShelfCount: number;
  /** 近两周有动静（lastPlayed 距今 ≤14 天） */
  recent: GameItem[];
  /** 时长排行 Top N（在架；Top 10） */
  top: Array<{ appid: number; name: string; hours: number }>;
  /** 最近游玩月份分布（近 6 个自然月，含空月） */
  months: Array<{ month: string; count: number }>;
}

/** 报告口径注记（面板报告页原文展示；诚实说明数据边界） */
export const REPORT_CAVEAT =
  'Steam 只提供最后游玩日期，没有逐日游玩时长，所以这里没有每日曲线；时长为 Steam 累计分钟。';

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const TOP_N = 10;
const MONTH_WINDOW = 6;

/** 报告构建（nowMs 注入可测；offShelf 条目只进 offShelfCount，不进任何排行/统计） */
export function buildReport(items: GameItem[], nowMs = Date.now()): GameshelfReport {
  const active = items.filter((it) => !it.offShelf);
  const totalHours = round1(active.reduce((sum, it) => sum + (it.playtimeMin || 0), 0) / 60);
  const recent = active
    .filter((it) => lastPlayedMs(it.lastPlayed) >= nowMs - RECENT_WINDOW_MS)
    .sort((a, b) => lastPlayedMs(b.lastPlayed) - lastPlayedMs(a.lastPlayed));
  const top = [...active]
    .sort((a, b) => b.playtimeMin - a.playtimeMin)
    .slice(0, TOP_N)
    .map((it) => ({ appid: it.appid, name: it.name, hours: round1((it.playtimeMin || 0) / 60) }));
  return {
    total: active.length,
    totalHours,
    offShelfCount: items.length - active.length,
    recent,
    top,
    months: monthDistribution(active, nowMs),
  };
}

/** 近 6 个自然月（含当月）的 lastPlayed 分布；升序返回，空月计 0 */
function monthDistribution(items: GameItem[], nowMs: number): Array<{ month: string; count: number }> {
  const now = new Date(nowMs);
  const keys: string[] = [];
  for (let i = MONTH_WINDOW - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const counts = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const it of items) {
    const ms = lastPlayedMs(it.lastPlayed);
    if (ms <= 0) continue;
    const d = new Date(ms);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return keys.map((k) => ({ month: k, count: counts.get(k)! }));
}

/** 'YYYY-MM-DD' → 本地时区当日零点 ms；空/非法 → 0（排最后、不进窗口） */
function lastPlayedMs(dateStr: string): number {
  if (!dateStr) return 0;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
