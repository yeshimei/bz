/**
 * 备忘录（memo）截止日期工具
 * 自 memo/due.ts 迁移（备忘录.js 逐字移植语义）。
 * getDueStatus：overdue（已过期）/ today（今日到期）/ future（未来）/ null（无截止）
 * formatDueText：逾期文案（N天前已过期/今天 HH:mm 已过期/今天 HH:mm 到期/明天 HH:mm 到期/MM/DD HH:mm 到期）
 * 口径固定相对（2026-09-12 用户拍板：原 memoDueFormat 设置与其 absolute 分支一并退役）。
 */
import moment from 'moment';
import { localDayKey } from '../core/utils';

/** 当前时刻（'YYYY-MM-DD HH:mm'，getDueStatus 内部用） */
function getNowStr(): string {
  return moment().format('YYYY-MM-DD HH:mm');
}

/** 今日日期（YYYY-MM-DD） */
function getTodayStr(): string {
  return localDayKey();
}

export type DueStatus = 'overdue' | 'today' | 'future' | null;

export function getDueStatus(due: string | null): DueStatus {
  if (!due) return null;
  const now = getNowStr(); // 'YYYY-MM-DD HH:mm'
  const dueNorm = due.replace('T', ' ');
  const dueDate = due.slice(0, 10);
  const today = getTodayStr();
  if (dueDate < today) return 'overdue';
  if (dueDate > today) return 'future';
  // 同一天，比较时间
  if (dueNorm <= now) return 'overdue';
  return 'today';
}

export function formatDueText(due: string): string {
  const status = getDueStatus(due);
  const dueMoment = moment(due.replace('T', ' '));
  const timeStr = dueMoment.format('HH:mm');
  const dateStr = dueMoment.format('MM/DD');
  const today = getTodayStr();
  const dueDate = due.slice(0, 10);

  if (status === 'overdue') {
    if (dueDate === today) return `今天 ${timeStr} 已过期`;
    const days = moment().diff(moment(dueDate), 'days');
    return `${days}天前已过期`;
  }
  if (status === 'today') return `今天 ${timeStr} 到期`;
  const days = moment(dueDate).diff(moment(today), 'days');
  if (days === 1) return `明天 ${timeStr} 到期`;
  return `${dateStr} ${timeStr} 到期`;
}
