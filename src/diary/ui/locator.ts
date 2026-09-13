/**
 * 条目写层定位谓词（issue 256 / ADR-0131）：条目文件化后「一条目一文件、同刻独占」，
 * 定位 = filePath（严格限定来源文件，D2：同刻不跨文件误命中）+ time 双条件；行号退场。
 * 改标签（dialogs）与删除确认（entry-actions）共用，保证两路动作对同一条目的定位一致。
 */
import type { DiaryEntry } from '../types';
import type { DiaryEntryLocator } from './dialogs';

/** 写层定位谓词：filePath 缺省（旧定位面/兜底调用方）时不按路径过滤，行为同旧版 */
export function buildLocatorPredicateFor(_dateStr: string, loc: DiaryEntryLocator): (e: DiaryEntry) => boolean {
  return (e) => (!loc.filePath || e.filePath === loc.filePath) && e.time === loc.time;
}
