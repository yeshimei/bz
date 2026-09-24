/**
 * 互动统计（issue 440）：客观数据侧的纯本地计算，零 AI 成本。
 * 输入是内存里的统一消息流（用完即弃）与解析层的形态计数，输出 ContactStats 聚合结果——
 * 落盘只有聚合数字，不含聊天原文（与 ADR-0191 §2 隐私口径一致）。
 */
import type { ContactStats, UnifiedMessage } from './types';

/** 会话切分阈值：相邻消息间隔 ≥ 30 分钟视为新会话 */
const SESSION_GAP_MS = 30 * 60 * 1000;

/** 本地月键：YYYY-MM（字典序即时间序） */
function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 纯函数：消息流 → 互动统计。
 * - monthly：按本地时间归月计数，升序；
 * - 会话发起：首条消息开启首个会话；之后与上一条间隔 ≥ 30 分钟即新会话，看首条是谁发的；
 * - 回复时延：相邻两条异侧（对方→我 / 我→对方）视为一次回复，耗时 = 两者的间隔（即对方「发完」
 *   到我回第一条——连续多条只有异侧切换那一条计入）；无样本记 0；
 * - hourly：24 长度数组，本地小时分布；
 * - kindCounts：透传（形态计数在 parse 层算好）。
 */
export function computeStats(messages: UnifiedMessage[], kindCounts: Record<string, number>): ContactStats {
  const msgs = [...messages].sort((a, b) => a.ts - b.ts);
  const monthly = new Map<string, number>();
  const myHourly = new Array<number>(24).fill(0);
  const otherHourly = new Array<number>(24).fill(0);
  let initiatedByMe = 0;
  let initiatedByOther = 0;
  let myTotalSec = 0;
  let myReplies = 0;
  let otherTotalSec = 0;
  let otherReplies = 0;
  let prev: UnifiedMessage | null = null;
  for (const m of msgs) {
    if (!Number.isFinite(m.ts)) continue;
    const d = new Date(m.ts);
    monthly.set(monthKey(m.ts), (monthly.get(monthKey(m.ts)) ?? 0) + 1);
    myHourly[d.getHours()] += m.isSender ? 1 : 0;
    otherHourly[d.getHours()] += m.isSender ? 0 : 1;
    if (!prev || m.ts - prev.ts >= SESSION_GAP_MS) {
      if (m.isSender) initiatedByMe++;
      else initiatedByOther++;
    }
    if (prev && m.isSender !== prev.isSender) {
      const sec = (m.ts - prev.ts) / 1000;
      if (m.isSender) { myTotalSec += sec; myReplies++; }
      else { otherTotalSec += sec; otherReplies++; }
    }
    prev = m;
  }
  return {
    monthly: [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    initiatedByMe,
    initiatedByOther,
    myAvgReplySec: myReplies ? myTotalSec / myReplies : 0,
    otherAvgReplySec: otherReplies ? otherTotalSec / otherReplies : 0,
    myHourly,
    otherHourly,
    kindCounts: { ...kindCounts }, // 浅拷贝：与调用方数据脱钩，改返回值不伤原对象
  };
}

/** 时延自适应展示：45 秒 / 12 分钟 / 3 小时；0（无样本）显示「无样本」 */
export function formatReplySec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '无样本';
  if (sec < 60) return `${Math.max(1, Math.round(sec))} 秒`;
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))} 分钟`;
  return `${Math.max(1, Math.round(sec / 3600))} 小时`;
}

/** 大数缩写：999 → '999'，1234 → '1.2k'，12345 → '12.3k'，123456 → '123k' */
export function formatCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const s = k >= 100 ? String(Math.round(k)) : String(Math.round(k * 10) / 10);
    return `${s}k`;
  }
  return String(n);
}
