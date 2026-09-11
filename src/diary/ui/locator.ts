/**
 * 条目写层定位谓词（issue 256）：行号优先、同刻唯一兜底（P1-12 口径）。
 * 改标签（dialogs）与删除确认（entry-actions）共用，保证两路动作对同一条目的定位一致。
 * D2：子目录日期条目按 filePath 定位——同刻兜底只在来源文件的条目集内判定，
 * 不再可能命中顶层同名日期文件的条目（删 A 文件的条目实际删到 B 文件）。
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
    const entries = await listDateEntries(dateStr, { filePath: loc.filePath });
    uniqueTime = entries.filter((e) => e.time === loc.time).length === 1;
  } catch (e) {
    /* 守卫拒读时按严格行号定位 */
  }
  return (e) =>
    // loc 未带 filePath（旧定位面/兜底调用方）：不按路径过滤，行为同旧版；
    // 带了则严格限定来源文件（D2：同刻兜底不跨文件误命中）
    (loc.filePath ? e.filePath === loc.filePath : true) &&
    e.time === loc.time &&
    (uniqueTime || e.lineNumber === loc.lineNumber);
}
