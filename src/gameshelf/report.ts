/**
 * 游戏架（gameshelf）域统计纯函数（issue 368；数据统计面板 2026-09-17 扩口径）：
 * 库总览 / 时长排行 / 时长档位分布 / 最后游玩年份分布 / 平台分项 / 最近玩过 / 口径诚实注记。
 * 口径（票 368 拍板）：Steam 只提供 lastPlayed（最后游玩日期），无逐日历史游玩记录——
 * 「游玩分布」按 lastPlayed 年份/月份呈现，不做无法兑现的每日时长曲线。
 * 零 IO、零 DOM、无 obsidian 依赖——node 环境可测。
 */
import { displayNameOf, type GameItem, type GameshelfBucket } from './state';

/** 时长档位（游戏墙筛选与统计面板分布共用同一份口径——单源，禁止两处各写一套） */
export interface BucketDef {
  key: GameshelfBucket;
  label: string;
  /** 档位内计数（含区间上界，左闭右开；idle 单独一档） */
  test: (it: GameItem) => boolean;
}

const hours = (it: GameItem): number => (it.playtimeMin || 0) / 60;

export const BUCKETS: BucketDef[] = [
  { key: 'all', label: '全部', test: () => true },
  { key: 'b200', label: '200 小时以上', test: (it) => hours(it) >= 200 },
  { key: 'b50', label: '50 到 200 小时', test: (it) => hours(it) >= 50 && hours(it) < 200 },
  { key: 'b10', label: '10 到 50 小时', test: (it) => hours(it) >= 10 && hours(it) < 50 },
  { key: 'b1', label: '10 小时以内', test: (it) => it.playtimeMin > 0 && hours(it) < 10 },
  { key: 'idle', label: '从未启动', test: (it) => !it.playtimeMin },
];

/** 命中档位定义（未知 key 回落「全部」——状态持久化读到旧值时不会筛出空列表） */
export function bucketOf(key: string): BucketDef {
  return BUCKETS.find((b) => b.key === key) ?? BUCKETS[0];
}

export interface GameshelfReport {
  /** 在架游戏数（offShelf 不计） */
  total: number;
  /** 下架保留数（offShelf） */
  offShelfCount: number;
  /** 至少启动过一次 */
  played: number;
  /** 从未启动 */
  neverPlayed: number;
  /** 有社区成就页 */
  achCount: number;
  /** 累计时长小时（一位小数） */
  totalHours: number;
  /** 折合天数（一位小数） */
  days: number;
  /** 平均每款小时（一位小数） */
  avgHours: number;
  /** 近两周有动静（lastPlayed 距今 ≤14 天） */
  recent: GameItem[];
  /** 最近玩过（按最后游玩倒序，最多 8 款；口径放宽到「有记录」——Steam 近两周常为空） */
  latest: GameItem[];
  /** 时长排行 Top N（在架；Top 10） */
  top: Array<{ appid: number; name: string; hours: number }>;
  /** 时长档位分布（不含 all） */
  buckets: Array<{ key: GameshelfBucket; label: string; count: number }>;
  /** 最后游玩年份分布（升序；无记录的不计） */
  years: Array<{ year: string; count: number }>;
  /** 平台分项（分钟；只列有过时长的平台，降序） */
  platforms: Array<{ label: string; min: number }>;
  /** 最近游玩月份分布（近 6 个自然月，含空月） */
  months: Array<{ month: string; count: number }>;
}

/** 报告口径注记（面板数据统计页原文展示；诚实说明数据边界） */
export const REPORT_CAVEAT =
  'Steam 只提供累计时长和最后游玩日期，没有逐日游玩时长，所以这里没有每日曲线；年份分布按最后游玩日期归年，不代表当年新增。';

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const TOP_N = 10;
const LATEST_N = 8;
const MONTH_WINDOW = 6;

/** 报告构建（nowMs 注入可测；offShelf 条目只进 offShelfCount，不进任何排行/统计） */
export function buildReport(items: GameItem[], nowMs = Date.now()): GameshelfReport {
  const active = items.filter((it) => !it.offShelf);
  const totalMin = active.reduce((sum, it) => sum + (it.playtimeMin || 0), 0);
  const totalHours = round1(totalMin / 60);
  const withDate = active.filter((it) => lastPlayedMs(it.lastPlayed) > 0);
  const recent = active
    .filter((it) => lastPlayedMs(it.lastPlayed) >= nowMs - RECENT_WINDOW_MS)
    .sort((a, b) => lastPlayedMs(b.lastPlayed) - lastPlayedMs(a.lastPlayed));
  const latest = [...withDate].sort((a, b) => lastPlayedMs(b.lastPlayed) - lastPlayedMs(a.lastPlayed)).slice(0, LATEST_N);
  const top = [...active]
    .sort((a, b) => b.playtimeMin - a.playtimeMin)
    .slice(0, TOP_N)
    .map((it) => ({ appid: it.appid, name: displayNameOf(it), hours: round1((it.playtimeMin || 0) / 60) }));
  return {
    total: active.length,
    offShelfCount: items.length - active.length,
    played: active.filter((it) => it.playtimeMin > 0).length,
    neverPlayed: active.filter((it) => !it.playtimeMin).length,
    achCount: active.filter((it) => it.hasAch).length,
    totalHours,
    days: round1(totalMin / 60 / 24),
    avgHours: active.length > 0 ? round1(totalMin / 60 / active.length) : 0,
    recent,
    latest,
    top,
    buckets: BUCKETS.filter((b) => b.key !== 'all').map((b) => ({
      key: b.key,
      label: b.label,
      count: active.filter(b.test).length,
    })),
    years: yearDistribution(active),
    platforms: platformSplit(active),
    months: monthDistribution(active, nowMs),
  };
}

/** 最后游玩年份分布（升序；无效日期不计） */
function yearDistribution(items: GameItem[]): Array<{ year: string; count: number }> {
  const counts = new Map<string, number>();
  for (const it of items) {
    const ms = lastPlayedMs(it.lastPlayed);
    if (ms <= 0) continue;
    const y = String(new Date(ms).getFullYear());
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  return [...counts.keys()].sort().map((year) => ({ year, count: counts.get(year)! }));
}

/** 平台分项（分钟；全 0 的平台不出行，避免 0 值噪音） */
function platformSplit(items: GameItem[]): Array<{ label: string; min: number }> {
  const defs: Array<[string, (it: GameItem) => number]> = [
    ['Windows', (it) => it.windowsMin],
    ['Steam Deck', (it) => it.deckMin],
    ['macOS', (it) => it.macMin],
    ['Linux', (it) => it.linuxMin],
  ];
  return defs
    .map(([label, pick]) => ({ label, min: items.reduce((s, it) => s + (pick(it) || 0), 0) }))
    .filter((p) => p.min > 0)
    .sort((a, b) => b.min - a.min);
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
export function lastPlayedMs(dateStr: string): number {
  if (!dateStr) return 0;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
