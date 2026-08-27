/**
 * 行为流滚动窗口（P1 数据基座，ticket 123）
 *
 * 按天数（behaviorMaxDays，默认 30）和条数（behaviorMaxCount，默认 1000）清理最旧条目。
 * 每次写入行为流后调用。记忆流无上限（既有拍板）。
 */
import type { BehaviorItem } from './types';

/** 行为流清理默认参数 */
export const BEHAVIOR_TRIM_DEFAULTS = {
  /** 最大保留天数（超出部分删除） */
  maxDays: 30,
  /** 最大保留条数（超出部分删除最旧） */
  maxCount: 1000,
} as const;

/**
 * 清理行为流：按天数和条数双重约束删除最旧条目。
 * 纯函数，不修改原数组——返回清理后的新数组。
 *
 * @param stream 当前行为流
 * @param opts 配置参数（maxDays / maxCount）
 * @param now 当前时间戳（注入，测试用）
 * @returns 清理后的行为流
 */
export function trimBehaviorStream(
  stream: BehaviorItem[],
  opts: { maxDays?: number; maxCount?: number } = {},
  now = Date.now(),
): BehaviorItem[] {
  const maxDays = opts.maxDays ?? BEHAVIOR_TRIM_DEFAULTS.maxDays;
  const maxCount = opts.maxCount ?? BEHAVIOR_TRIM_DEFAULTS.maxCount;
  const cutoffMs = now - maxDays * 24 * 60 * 60 * 1000;

  // 按时间戳过滤：只保留 cutoffMs 之后的条目
  let result = stream.filter((item) => {
    const t = new Date(item.timestamp).getTime();
    return Number.isFinite(t) && t >= cutoffMs;
  });

  // 按条数截断：只保留最新的 maxCount 条（按 timestamp 降序排列后截断）
  if (result.length > maxCount) {
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    result = result.slice(0, maxCount);
  }

  return result;
}
