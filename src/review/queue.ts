/**
 * 复习队列口径（item 6/9 拍板，2026-09）：三区列与「开始本轮」同一套纯函数。
 *
 * 统一前的问题：列表三区按「时刻已过 = 逾期 / 日历日 = 今天 / 其余 = 未来」分区，
 * 而「开始本轮」（dueItems）只含 逾期 + R<阈值提前逾期——「今日到期但时刻未到」的
 * 中列条目点「开始本轮」不带，两套口径打架。
 *
 * 统一后（全部走本模块，互斥分区）：
 * - 逾期列 = isOverdue（时刻已过）
 * - 今天列 = isDueToday（日历日含逾期早段外的今日；提前卡落此列）
 * - 未来列 = 其余未完成
 * - 「开始本轮」= 逾期 ∪ R 阈值提前 ∪ 今日到期（item 9：今日到期时刻未到 → 允许提前开始今天全部）
 * 依赖方向：只依赖 data/fsrs 类型（纯数据层，可 node 环境直测）。
 */
import type { ReviewItem } from './data';
import { FSRS, DEFAULT_W } from './fsrs';
import { dateKey } from './stats';

/** 是否今日到期（nextReviewDate 落在今日本地日内；与 isOverdue 正交的日历口径）。
 *  自 ui.ts 迁入（item 6 口径统一）：纯函数下沉 queue.ts，ui.ts re-export 保持签名。 */
export function isDueToday(item: ReviewItem): boolean {
  if (!item.nextReviewDate) return false;
  return dateKey(new Date(item.nextReviewDate)) === dateKey(new Date());
}

/** R 阈值提前复习判定：fsrs 相位 + 可算 R + R<threshold（与 markReview 放行、调度排期同口径） */
export function isEarlyDue(item: ReviewItem, rThreshold: number, w: number[]): boolean {
  if (item.phase !== 'fsrs' || !item.stability || !item.lastReviewed) return false;
  const t = (Date.now() - new Date(item.lastReviewed).getTime()) / 86400000;
  if (!(t > 0)) return false;
  return new FSRS(w).R(t, item.stability) < rThreshold;
}

/** 队列条目可用性：非完成非挂起（分区前置过滤） */
function active(i: ReviewItem): boolean {
  return !i.isCompleted && !i.completed && !i.isMissing;
}

/** 三区列分区（互斥）：逾期 → 今天（日历日 ∪ R 阈值提前卡，拍板：提前卡落「今天」列）→ 未来；done 独立 */
export interface QueueColumns {
  overdue: ReviewItem[];
  today: ReviewItem[];
  future: ReviewItem[];
  done: ReviewItem[];
}

export function partitionQueue(items: ReviewItem[], rThreshold = 0.9, w: number[] = DEFAULT_W): QueueColumns {
  const overdue: ReviewItem[] = [];
  const today: ReviewItem[] = [];
  const future: ReviewItem[] = [];
  const done: ReviewItem[] = [];
  for (const i of items) {
    if (!active(i)) {
      done.push(i);
      continue;
    }
    if (i.isOverdue) overdue.push(i);
    else if (isDueToday(i) || isEarlyDue(i, rThreshold, w)) today.push(i);
    else future.push(i);
  }
  return { overdue, today, future, done };
}

/**
 * 「开始本轮」集合（未排序、未截断）：逾期 ∪ R 阈值提前 ∪ 今日到期。
 * 与三区列同源（partitionQueue 的 overdue+today 再并入提前卡）——列表看到什么本轮就复习什么。
 */
export function roundQueue(items: ReviewItem[], rThreshold: number, w: number[]): ReviewItem[] {
  return items.filter((i) => {
    if (!active(i)) return false;
    if (i.isOverdue) return true;
    if (isDueToday(i)) return true;
    return isEarlyDue(i, rThreshold, w);
  });
}

/** R 阈值提前卡（挂「提前」tag 用；在 roundQueue 集合内但既非逾期也非今日到期） */
export function earlyDueOnly(items: ReviewItem[], rThreshold: number, w: number[]): ReviewItem[] {
  return items.filter((i) => active(i) && !i.isOverdue && !isDueToday(i) && isEarlyDue(i, rThreshold, w));
}
