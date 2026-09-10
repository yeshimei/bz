/**
 * 条目写层定位谓词（issue 256）：行号优先、同刻唯一兜底（P1-12 口径）。
 * 改标签（dialogs）与删除确认（entry-actions）共用，保证两路动作对同一条目的定位一致。
 */
import { listDateEntries } from '../store';
import type { DiaryEntry } from '../types';
import type { DiaryEntryLocator } from './dialogs';

/** 行号优先、同刻唯一兜底的写层定位谓词 */
export async function buildLocatorPredicateFor(
  dateStr: string,
  loc: DiaryEntryLocator
): Promise<(e: DiaryEntry) => boolean> {
  let uniqueTime = true;
  try {
    const entries = await listDateEntries(dateStr);
    uniqueTime = entries.filter((e) => e.time === loc.time).length === 1;
  } catch (e) {
    /* 守卫拒读时按严格行号定位 */
  }
  return (e) => e.time === loc.time && (uniqueTime || e.lineNumber === loc.lineNumber);
}
