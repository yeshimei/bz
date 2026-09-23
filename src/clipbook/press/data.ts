/**
 * 读报特刊 · 数据派生（纯函数，零 DOM 零 obsidian）
 *
 * 口径（2026-09-23「我读了什么」重做拍板）：**全史总账**，没有周期窗口——
 *   阅读行为来自 clipbook.json readLog（会话流水），报库来自 news.json 未读流，
 *   只认真实字段，缺了不造数（影院观影分析 data.ts 同纪律）。
 * 影院那本是「观影志」，本报是「读报特刊」：世界观的词都在报馆——期号/工班/压库/收录。
 */
import type { ClipReadLogEntry } from '../data';
import { buildLibraryStats, shiftBuckets, streakDays, type ClipLibraryStats, type ClipShift } from '../report-stats';
import { pad2 } from '../../core/ui/str';

/** 读得最久的一篇 */
export interface PressTopRow { title: string; src: string; minutes: number }
/** 来源榜一行 */
export interface PressSrcRow { name: string; articles: number; minutes: number }
/** 热力带一天（近 14 天，旧 → 今；hours = 24 小时分钟桶） */
export interface PressDay { label: string; minutes: number; hours: number[] }
/** 日历格（近 56 天，旧 → 今） */
export interface PressCalDay { label: string; minutes: number }
/** 词云词条 */
export interface PressWord { w: string; n: number }
/** 班次 × 来源一行 */
export interface PressSrcShift { name: string; shifts: number[] }
/** 最近会话（号外幕） */
export interface PressRecent { title: string; src: string; minutes: number; ago: string }
/** 压库一行 */
export interface PressOld { title: string; src: string; days: number }

export interface PressData {
  /** 期号 = news 在流总条数（与头行戳章同源） */
  issue: number;
  sessions: number;
  articles: number;
  totalMinutes: number;
  activeDays: number;
  /** 连续阅读天数（今天没读不打断） */
  streak: number;
  busiest: { date: string; minutes: number } | null;
  /** 读得最久 Top5 */
  top: PressTopRow[];
  /** 来源榜（分钟降序，前 6） */
  sources: PressSrcRow[];
  hours: number[];
  peakHour: number;
  shifts: ClipShift[];
  /** 热力带：近 14 天 × 24 小时（旧 → 今） */
  matrix: PressDay[];
  /** 词云：标题高频词（前 26） */
  words: PressWord[];
  /** 驻留日历：近 56 天（旧 → 今） */
  cal: PressCalDay[];
  /** 班次 × 来源（Top6） */
  srcShift: PressSrcShift[];
  /** 最近会话流水（最近 8 段，新 → 旧） */
  recent: PressRecent[];
  /** 今天已读分钟（号外幕「今晨已读」注记；本地日口径） */
  todayMinutes: number;
  /** 今天的会话段数 */
  todaySessions: number;
  /** 单段最长分钟（速览幕「最深一段」） */
  deepMinutes: number;
  /** 压库三甲（待读压最久） */
  oldest3: PressOld[];
  /** 未读版图（来源待读篇数 Top6） */
  unreadTop: Array<{ name: string; n: number }>;
  /** 总账（news.stats / 入册数可得时才有；缺 → null） */
  totals: { totalRead: number; inStream: number; saved: number; perDay: number } | null;
  /** 报库盘点（news 不可用 → null，相关幕改演提示行） */
  lib: ClipLibraryStats | null;
}

export interface PressExtra {
  /** 入册数（sidecar.savedArchive.length） */
  savedCount?: number;
  /** news.stats.totalRead（累计已读，含已被保留策略清掉的） */
  totalRead?: number;
  /** news.stats.byDate 天数（每日平均的分母） */
  byDateDays?: number;
}

function hourOf(ts: number): number {
  const h = new Date(ts).getHours();
  return h >= 0 && h < 24 ? h : 0;
}

function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const CN_STOPWORDS = new Set(['我们', '一个', '什么', '这个', '自己', '没有', '就是', '为什么', '怎么', '可以', '不是', '还是', '已经', '如何', '评价', '看待', '为啥', '你的', '他们的']);

/** 标题切词：中文段滑 2 字窗 + 英文长词；频次排序前 limit（词云幕） */
export function titleWords(titles: string[], limit: number): PressWord[] {
  const map = new Map<string, number>();
  const bump = (w: string): void => {
    if (CN_STOPWORDS.has(w)) return;
    map.set(w, (map.get(w) || 0) + 1);
  };
  for (const t of titles) {
    for (const seg of String(t).match(/[\u4e00-\u9fa5]{2,}/g) || []) {
      for (let i = 0; i + 2 <= seg.length; i++) bump(seg.slice(i, i + 2));
    }
    for (const w of String(t).match(/[A-Za-z]{3,}/g) || []) {
      bump(w[0] + w[1].toLowerCase() + w.slice(2).toLowerCase());
    }
  }
  return [...map.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w, n]) => ({ w, n }));
}

/** 人话相对时间（号外幕）：今天 HH 点 / 昨天 / N 天前 */
function agoOf(ts: number, now: Date): string {
  const d = new Date(ts);
  const dayStart = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (diff <= 0) return `今天 ${d.getHours()} 点`;
  if (diff === 1) return '昨天';
  return `${diff} 天前`;
}

/** 聚合一份特刊总账（log 空 → 零值数据，调用方按 sessions 判空走经典空态） */
export function derivePress(
  log: ClipReadLogEntry[] | null | undefined,
  rawArticles: Array<Record<string, unknown>> | null | undefined,
  extra: PressExtra | undefined,
  now: Date = new Date(),
): PressData {
  const valid = (log || []).filter((e) => e && typeof e.ts === 'number' && isFinite(e.ts) && Math.round(Number(e.minutes) || 0) > 0);
  const minutesByKey = new Map<string, { title: string; src: string; minutes: number }>();
  const srcMap = new Map<string, PressSrcRow>();
  const srcShiftMap = new Map<string, number[]>();
  const hours = new Array<number>(24).fill(0);
  const days = new Set<string>();
  const perDay = new Map<string, number>();
  let totalMinutes = 0;
  /* 号外幕注记与速览幕「最深一段」：全按真实流水派生，缺了就是 0 */
  const todayKey = dayKeyOf(now.getTime());
  let todayMinutes = 0;
  let todaySessions = 0;
  let deepMinutes = 0;

  for (const e of valid) {
    const m = Math.round(Number(e.minutes) || 0);
    totalMinutes += m;
    if (dayKeyOf(e.ts) === todayKey) { todayMinutes += m; todaySessions += 1; }
    if (m > deepMinutes) deepMinutes = m;
    const h = hourOf(e.ts);
    hours[h] += m;
    const k = dayKeyOf(e.ts);
    days.add(k);
    perDay.set(k, (perDay.get(k) || 0) + m);
    const key = String(e.key || '');
    const src = String(e.src || '').trim() || '未知';
    const prev = minutesByKey.get(key);
    if (prev) prev.minutes += m;
    else minutesByKey.set(key, { title: String(e.title || '(无标题)'), src, minutes: m });
    let row = srcMap.get(src);
    if (!row) { row = { name: src, articles: 0, minutes: 0 }; srcMap.set(src, row); }
    row.minutes += m;
    let ss = srcShiftMap.get(src);
    if (!ss) { ss = [0, 0, 0, 0]; srcShiftMap.set(src, ss); }
    ss[h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3] += m;
  }
  for (const { src } of minutesByKey.values()) {
    const row = srcMap.get(src);
    if (row) row.articles += 1;
  }

  let busiest: PressData['busiest'] = null;
  for (const [date, minutes] of perDay) {
    if (!busiest || minutes > busiest.minutes || (minutes === busiest.minutes && date < busiest.date)) {
      busiest = { date, minutes };
    }
  }

  let peakHour = -1;
  for (let h = 0; h < 24; h++) if (hours[h] > 0 && (peakHour < 0 || hours[h] > hours[peakHour])) peakHour = h;

  const top = [...minutesByKey.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  const sources = [...srcMap.values()]
    .sort((a, b) => b.minutes - a.minutes || b.articles - a.articles || a.name.localeCompare(b.name))
    .slice(0, 6);

  /* 热力带：近 14 天 × 24 小时（旧 → 今） */
  const dayStart = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const matrix: PressDay[] = [];
  const cal: PressCalDay[] = [];
  const matrixMinutes = new Map<string, number[]>();
  for (const e of valid) {
    const k = dayKeyOf(e.ts);
    let arr = matrixMinutes.get(k);
    if (!arr) { arr = new Array<number>(24).fill(0); matrixMinutes.set(k, arr); }
    arr[hourOf(e.ts)] += Math.round(Number(e.minutes) || 0);
  }
  for (let i = 13; i >= 0; i--) {
    const d = new Date(dayStart(now) - i * 86400000);
    const k = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const hs = matrixMinutes.get(k) || new Array<number>(24).fill(0);
    matrix.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, minutes: hs.reduce((s, x) => s + x, 0), hours: hs });
  }
  for (let i = 55; i >= 0; i--) {
    const d = new Date(dayStart(now) - i * 86400000);
    const k = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    cal.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, minutes: perDay.get(k) || 0 });
  }

  const srcShift: PressSrcShift[] = sources.map((s) => ({ name: s.name, shifts: srcShiftMap.get(s.name) || [0, 0, 0, 0] }));
  const recent = [...valid]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8)
    .map((e) => ({
      title: String(e.title || '(无标题)'),
      src: String(e.src || '').trim() || '未知',
      minutes: Math.round(Number(e.minutes) || 0),
      ago: agoOf(e.ts, now),
    }));
  const words = titleWords([...minutesByKey.values()].map((x) => x.title), 26);

  /* 报库（news 未读流） */
  let lib: ClipLibraryStats | null = null;
  try {
    lib = rawArticles ? buildLibraryStats(rawArticles as Parameters<typeof buildLibraryStats>[0], now) : null;
  } catch { lib = null; }
  const oldest3: PressOld[] = [];
  const unreadMap = new Map<string, number>();
  if (rawArticles) {
    const cands: Array<{ title: string; src: string; ts: number }> = [];
    for (const a of rawArticles) {
      if (a.read) continue;
      const p = String(a.platform || '').trim() || '未知';
      unreadMap.set(p, (unreadMap.get(p) || 0) + 1);
      const ts = Date.parse(String(a.fetchedAt || a.date || ''));
      if (isFinite(ts)) cands.push({ title: String(a.title || '(无标题)'), src: p, ts });
    }
    cands.sort((a, b) => a.ts - b.ts);
    for (const c of cands.slice(0, 3)) {
      oldest3.push({ title: c.title, src: c.src, days: Math.max(0, Math.floor((now.getTime() - c.ts) / 86400000)) });
    }
  }
  const unreadTop = [...unreadMap.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, 6);

  const totalRead = Math.max(0, Math.round(Number(extra?.totalRead) || 0));
  const inStream = lib ? lib.total : 0;
  const saved = Math.max(0, Math.round(Number(extra?.savedCount) || 0));
  const byDateDays = Math.max(1, Math.round(Number(extra?.byDateDays) || 0));
  const totals = totalRead > 0
    ? { totalRead, inStream, saved, perDay: Math.round((totalRead / byDateDays) * 10) / 10 }
    : null;

  return {
    issue: lib ? lib.total : 0,
    sessions: valid.length,
    articles: minutesByKey.size,
    totalMinutes,
    activeDays: days.size,
    streak: streakDays(log, now),
    busiest,
    top,
    sources,
    hours,
    peakHour,
    shifts: shiftBuckets(hours),
    matrix,
    words,
    cal,
    srcShift,
    recent,
    todayMinutes,
    todaySessions,
    deepMinutes,
    oldest3,
    unreadTop,
    totals,
    lib,
  };
}
