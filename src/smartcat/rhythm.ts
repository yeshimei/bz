/**
 * 作息模型（2026-08-23「懂你」增强：③-5 作息模型 + 主动关心）
 * 从记忆流的 created 时间戳统计用户最近 N 天 24h 活跃分布（纯函数，无 DOM 依赖）：
 *  - buildRhythmProfile：直方图 + 活跃小时集合（计数 ≥ 均值 0.75 倍且 ≥1）
 *  - isActiveNow：当前小时是否活跃（主动关心的时机判据）
 *  - describeRhythm：连续活跃小时合并为区间文本（prompt/气泡用，如「20-1 点」）
 */

/** 活跃小时判定：计数 ≥ 均值 0.75 倍且 ≥1（均值太低时退化为 top 6 小时） */
export interface RhythmProfile {
  /** 24h 直方图（最近 days 天内每条记忆的创建小时计数） */
  buckets: number[];
  /** 总条数 */
  total: number;
  /** 峰值小时（0-23） */
  peakHour: number;
  /** 活跃小时集合（0-23） */
  activeHours: number[];
}

/** 构建作息画像（entries 取自记忆流；days=统计窗口天数） */
export function buildRhythmProfile(entries: { created?: string }[], days = 30, now = Date.now()): RhythmProfile {
  const buckets = new Array(24).fill(0);
  const since = now - days * 24 * 60 * 60 * 1000;
  for (const e of entries) {
    const t = e.created ? new Date(e.created).getTime() : NaN;
    if (!Number.isFinite(t) || t < since || t > now) continue;
    buckets[new Date(t).getHours()]++;
  }
  const total = buckets.reduce((a, b) => a + b, 0);
  let peakHour = 0;
  let peak = 0;
  for (let h = 0; h < 24; h++) {
    if (buckets[h] > peak) { peak = buckets[h]; peakHour = h; }
  }
  let activeHours: number[];
  if (total === 0) {
    activeHours = [];
  } else {
    const mean = total / 24;
    const threshold = Math.max(1, mean * 0.75);
    activeHours = buckets.map((c, h) => ({ c, h })).filter((x) => x.c >= threshold).map((x) => x.h);
    // 分布太稀（活跃小时太多/太少）→ 退化取 top 6
    if (activeHours.length > 12 || activeHours.length < 1) {
      activeHours = buckets.map((c, h) => ({ c, h })).sort((a, b) => b.c - a.c).slice(0, Math.min(6, Math.max(1, Math.ceil(total / 10)))).map((x) => x.h).sort((a, b) => a - b);
    }
  }
  return { buckets, total, peakHour, activeHours };
}

/** 指定小时是否活跃 */
export function isActiveNow(profile: RhythmProfile, hour = new Date().getHours()): boolean {
  return profile.activeHours.includes(hour);
}

/** 连续小时合并为区间文本（如 [20,21,22,23,0,1] → 「20-1 点」；0 点视为 24 接在 23 后） */
export function describeRhythm(profile: RhythmProfile): string {
  if (!profile.activeHours.length) return '作息数据不足';
  const sorted = [...profile.activeHours].sort((a, b) => a - b);
  // 0 点段（0,1,2...到首断点）移到末尾并编号 +24，实现跨日连续
  let seq: number[] = sorted;
  if (sorted.includes(0) && sorted.includes(23)) {
    let cut = 0;
    while (cut < sorted.length - 1 && sorted[cut + 1] === sorted[cut] + 1) cut++;
    const head = sorted.slice(0, cut + 1).map((h) => h + 24);
    seq = [...sorted.slice(cut + 1), ...head];
  }
  const fmt = (h: number) => `${h % 24} 点`;
  const ranges: string[] = [];
  let start = seq[0];
  let prev = seq[0];
  for (let i = 1; i <= seq.length; i++) {
    const h = seq[i];
    if (i < seq.length && h === prev + 1) {
      prev = h;
      continue;
    }
    ranges.push(start === prev ? fmt(start) : `${start % 24}-${prev % 24} 点`);
    start = h;
    prev = h;
  }
  return ranges.join('、');
}

/** 时段文本（prompt 用：当前时刻属于什么时段） */
export function periodText(hour = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return '早晨';
  if (hour >= 12 && hour < 18) return '下午';
  if (hour >= 18 && hour < 23) return '晚上';
  return '深夜';
}

/** ISO 周键（如 2026-W34；按周一首日；主动关心每周计数用） */
export function isoWeekKey(d = new Date()): string {
  const date = new Date(d.getTime());
  const day = (date.getDay() + 6) % 7; // 周一=0
  date.setDate(date.getDate() - day + 3);
  const jan4 = new Date(date.getFullYear(), 0, 4);
  const week = 1 + Math.round(((date.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}