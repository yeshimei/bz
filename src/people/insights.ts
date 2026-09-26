/**
 * 互动画像聚合（issue 449 A 部分）：从归一化后的时间线（过滤后 msgs，与 stats.ts 同口径）
 * 与 normalize 过程采集的语义信号（表情 / 分享 / 通话 / 撤回 / 语音情感）汇总出
 * InsightsSummary——数据源层随导入落盘到预览桶，提炼层把 buildStatsNote 的文案拼进
 * prompt 的「互动统计」素材段喂 AI。只产聚合数字与一段中文自然句，不含聊天原文
 * （与 ADR-0191 §2 隐私口径一致）。纯函数、零 DOM。
 */
import { formatReplySec, medianOf } from './stats';

/** 会话切分阈值：与 stats.ts 同口径（相邻消息间隔 ≥ 30 分钟视为新会话） */
const SESSION_GAP_MS = 30 * 60 * 1000;

/** 回复时延封顶：相邻间隔 > 3600 秒不当作回复样本（会话切分 30 分钟先截断，此为双保险） */
const REPLY_CAP_SEC = 3600;

/** 沉默段阈值：相邻消息间隔 ≥ 14 天记一段 */
const SILENCE_GAP_MS = 14 * 24 * 3600 * 1000;

/** 沉默段最多记录段数（超限取最长的前 N 段） */
export const SILENCE_GAP_MAX = 12;

/** 深夜时段：本地 0:00–5:59 */
const NIGHT_HOURS = new Set([0, 1, 2, 3, 4, 5]);

/** normalize 过程采集的语义信号（计数原料；会话 / 时延 / 夜间 / 沉默类由时间线现算） */
export interface InsightSignals {
  /** type 49 中 [分享] / [小程序] 条数 */
  shareCount: number;
  /** type 47 表情总条数（含未命名的） */
  emojiCount: number;
  /** type 47 中带名称的 [表情·名] 条数 */
  emojiNamedCount: number;
  /** type 50 通话总条数（含未接通） */
  callCount: number;
  /** 通话时长累计（秒；只累计解析出时长的） */
  callTotalSec: number;
  /** 未接通类条数（拒绝 / 无应答 / 取消 / 忙线等） */
  callMissedCount: number;
  /** 撤回系统消息按 who 归属：我撤回条数 */
  recantByMe: number;
  /** 撤回系统消息按 who 归属：对方撤回条数 */
  recantByOther: number;
  /** 语音情感词计数（如 平静 / 开心；来自进时间线的语音标签） */
  voiceEmotion: Record<string, number>;
}

export function emptyInsightSignals(): InsightSignals {
  return {
    shareCount: 0,
    emojiCount: 0,
    emojiNamedCount: 0,
    callCount: 0,
    callTotalSec: 0,
    callMissedCount: 0,
    recantByMe: 0,
    recantByOther: 0,
    voiceEmotion: {},
  };
}

/** 互动画像汇总（供预览桶落盘与提炼 prompt 消费；数字口径见各字段注释） */
export interface InsightsSummary {
  /** 我发起的会话数（30 分钟切分，首条开启会话者计数） */
  sessionStartedByMe: number;
  /** 对方发起的会话数 */
  sessionStartedByOther: number;
  /** 我回复时延中位数（秒；0 = 无样本） */
  myReplyMedianSec: number;
  /** 对方回复时延中位数（秒；0 = 无样本） */
  otherReplyMedianSec: number;
  /** 进时间线消息里深夜（0:00–5:59 本地）占比百分数（0–100，一位小数） */
  nightSharePct: number;
  /** 通话总条数 */
  callCount: number;
  /** 通话总时长（秒） */
  callTotalSec: number;
  /** 未接通条数 */
  callMissedCount: number;
  /** 我撤回条数 */
  recantByMe: number;
  /** 对方撤回条数 */
  recantByOther: number;
  /** 语音情感词计数 */
  voiceEmotion: Record<string, number>;
  /** 沉默段（相邻消息间隔 ≥ 14 天；最多 12 段，取最长前 12，按时间升序） */
  silenceGaps: Array<{ from: string; to: string; days: number }>;
  /** 分享 / 小程序条数 */
  shareCount: number;
  /** 表情总条数 */
  emojiCount: number;
  /** 带名称表情条数 */
  emojiNamedCount: number;
}

/** computeInsights 输入消息的最小结构（StoreMsg / UnifiedMessage 均满足） */
export interface InsightMsgLike {
  /** 毫秒时间戳 */
  ts: number;
  isSender: boolean;
}

/** 本地日期键：YYYY-MM-DD（沉默段端点） */
function dateKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 时间线 + 语义信号 → 互动画像汇总（纯函数）。
 * - 会话切分沿用 30 分钟：首条开启会话者计数（过滤后 msgs 口径，与 stats.ts 一致）；
 * - 回复时延新口径：会话首条不计、间隔 > 3600 秒不计，其余相邻异侧切换记一次，取中位数秒；
 * - nightSharePct：深夜小时占比百分数（一位小数）；
 * - silenceGaps：相邻间隔 ≥ 14 天的区段，端点为本地日期，days 取整天数；超 12 段取最长前 12
 *   （内部按长度筛，输出按时间升序便于阅读）。
 */
export function computeInsights(msgs: InsightMsgLike[], signals: InsightSignals): InsightsSummary {
  const sorted = msgs.filter((m) => m && Number.isFinite(m.ts)).sort((a, b) => a.ts - b.ts);
  let sessionStartedByMe = 0;
  let sessionStartedByOther = 0;
  const mySamples: number[] = [];
  const otherSamples: number[] = [];
  let night = 0;
  const gaps: Array<{ from: string; to: string; days: number }> = [];
  let prev: InsightMsgLike | null = null;
  for (const m of sorted) {
    if (NIGHT_HOURS.has(new Date(m.ts).getHours())) night++;
    if (!prev) {
      // 首条开启首个会话
      if (m.isSender) sessionStartedByMe++;
      else sessionStartedByOther++;
      prev = m;
      continue;
    }
    const gapMs = m.ts - prev.ts;
    if (gapMs >= SESSION_GAP_MS) {
      // 新会话：开启者计数，不计回复时延
      if (m.isSender) sessionStartedByMe++;
      else sessionStartedByOther++;
    } else if (m.isSender !== prev.isSender) {
      const sec = gapMs / 1000;
      if (sec <= REPLY_CAP_SEC) (m.isSender ? mySamples : otherSamples).push(sec);
    }
    // 沉默段独立于会话切分判定（≥14 天必然也是新会话，但两件事都要记）
    if (gapMs >= SILENCE_GAP_MS) {
      gaps.push({
        from: dateKeyOf(prev.ts),
        to: dateKeyOf(m.ts),
        // 日历日差（与 from/to 字面日期自洽；24h 时段的 floor 会出现「01-05 至 01-20（14 天）」式矛盾）
        days: Math.round((Date.parse(dateKeyOf(m.ts)) - Date.parse(dateKeyOf(prev.ts))) / (24 * 3600 * 1000)),
      });
    }
    prev = m;
  }
  const silenceGaps = gaps
    .sort((a, b) => b.days - a.days)
    .slice(0, SILENCE_GAP_MAX)
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return {
    sessionStartedByMe,
    sessionStartedByOther,
    myReplyMedianSec: medianOf(mySamples),
    otherReplyMedianSec: medianOf(otherSamples),
    nightSharePct: sorted.length ? Math.round((night / sorted.length) * 1000) / 10 : 0,
    callCount: signals.callCount,
    callTotalSec: signals.callTotalSec,
    callMissedCount: signals.callMissedCount,
    recantByMe: signals.recantByMe,
    recantByOther: signals.recantByOther,
    voiceEmotion: { ...signals.voiceEmotion },
    silenceGaps,
    shareCount: signals.shareCount,
    emojiCount: signals.emojiCount,
    emojiNamedCount: signals.emojiNamedCount,
  };
}

/**
 * InsightsSummary → 中文自然句一段（供提炼 prompt 的「互动统计」素材段）。
 * 无样本的维度自动略过不写废话；全空返回空串（prompt 不加该段）。
 * monthly（issue 455，可选）：全量月度消息密度（stats.monthly 口径），非空时在末尾追加
 * 「消息密度」段——按月升序全列；月份数 > 12 时按年合并求和（「2025 年合计 15000 条」式）。
 */
export function buildStatsNote(i: InsightsSummary, monthly?: Array<[string, number]>): string {
  const parts: string[] = [];
  const sessions = [
    i.sessionStartedByMe ? `我发起 ${i.sessionStartedByMe} 次` : '',
    i.sessionStartedByOther ? `对方发起 ${i.sessionStartedByOther} 次` : '',
  ].filter(Boolean);
  if (sessions.length) parts.push(`会话${sessions.join('、')}`);
  const replies = [
    i.myReplyMedianSec ? `我中位 ${formatReplySec(i.myReplyMedianSec)}` : '',
    i.otherReplyMedianSec ? `对方中位 ${formatReplySec(i.otherReplyMedianSec)}` : '',
  ].filter(Boolean);
  if (replies.length) parts.push(`回复时延${replies.join('、')}`);
  if (i.nightSharePct > 0) parts.push(`深夜（0-6 点）消息占 ${i.nightSharePct}%`);
  if (i.callCount > 0) {
    let call = `通话 ${i.callCount} 次`;
    if (i.callTotalSec > 0) call += `（累计 ${formatReplySec(i.callTotalSec)}）`;
    if (i.callMissedCount > 0) call += `，其中未接通 ${i.callMissedCount} 次`;
    parts.push(call);
  }
  const recants = [
    i.recantByMe ? `我撤回 ${i.recantByMe} 条` : '',
    i.recantByOther ? `对方撤回 ${i.recantByOther} 条` : '',
  ].filter(Boolean);
  if (recants.length) parts.push(recants.join('、'));
  const emotions = Object.entries(i.voiceEmotion)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (emotions.length) parts.push(`语音情感 ${emotions.map(([k, n]) => `${k} ${n}`).join('、')}`);
  const shares: string[] = [];
  if (i.shareCount > 0) shares.push(`分享链接 ${i.shareCount} 条`);
  if (i.emojiCount > 0) {
    shares.push(`表情包 ${i.emojiCount} 个${i.emojiNamedCount > 0 ? `（其中 ${i.emojiNamedCount} 个带名称）` : ''}`);
  }
  if (shares.length) parts.push(shares.join('，'));
  if (i.silenceGaps.length) {
    const top3 = [...i.silenceGaps].sort((a, b) => b.days - a.days).slice(0, 3);
    parts.push(`最长的沉默 ${top3.map((g) => `${g.from} 至 ${g.to}（${g.days} 天）`).join('、')}`);
  }
  if (monthly?.length) parts.push(monthlyDensity(monthly));
  return parts.length ? `互动画像：${parts.join('；')}。` : '';
}

/**
 * 月度密度段（issue 455）：「消息密度：2026-03 6221 条、2026-04 4239 条」式，按月升序全列；
 * 月份数 > 12 时按年合并求和（「2025 年合计 15000 条」式）——演变真信号，密到逐月失焦就不如按年。
 */
function monthlyDensity(monthly: Array<[string, number]>): string {
  const asc = [...monthly].sort((a, b) => a[0].localeCompare(b[0]));
  if (asc.length > 12) {
    const byYear = new Map<string, number>();
    for (const [m, n] of asc) {
      const y = m.slice(0, 4);
      byYear.set(y, (byYear.get(y) ?? 0) + n);
    }
    return `消息密度：${[...byYear.entries()].map(([y, n]) => `${y} 年合计 ${n} 条`).join('、')}`;
  }
  return `消息密度：${asc.map(([m, n]) => `${m} ${n} 条`).join('、')}`;
}
