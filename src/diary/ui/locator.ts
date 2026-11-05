/**
 * 条目写层定位谓词（issue 256 / ADR-0131）。
 * entry 格式「一条目一文件、同刻独占」：定位 = filePath + time；
 * day 格式一天多块共用 filePath：再叠 lineNumber（块头行号），同刻两条也不会串。
 * 改标签（dialogs）与删除确认（entry-actions）共用，保证两路动作对同一条目的定位一致。
 */
import type { DiaryEntry } from '../types';
import type { DiaryEntryLocator } from './dialogs';

/** 写层定位谓词：filePath 缺省（旧定位面/兜底调用方）时不按路径过滤，行为同旧版 */
export function buildLocatorPredicateFor(_dateStr: string, loc: DiaryEntryLocator): (e: DiaryEntry) => boolean {
  return (e) =>
    (!loc.filePath || e.filePath === loc.filePath) &&
    e.time === loc.time &&
    (loc.lineNumber == null || e.lineNumber === loc.lineNumber);
}
