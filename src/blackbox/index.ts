/**
 * 黑匣子域入口（ticket 58，v4 数据层地基阶段）：
 * 命令在 main.ts COMMANDS 表注册（域内不重复 addCommand）。
 * 58 阶段仅导出数据层与日记读取；对话/面板/复盘 UI 在 ticket 59+ 重建后恢复命令。
 */
export { BlackBoxDataManager, getBlackBoxFilePath, createProfile, createEvent, genId, normalizeData } from './data';
export { isDiaryStreamFile, scanAllDiaryEntries, parseDiaryFile } from './diary-scan';
export {
  DEFAULT_EMOTION_TAGS,
  MAX_EMOTIONS,
  MAX_WORDS,
  defaultBlackBoxData,
  defaultBlackBoxSettings,
  classifyEventConfidence,
  dedupeEvent,
  mergeMention,
  sanitizeMentions,
  shouldBuildProfile,
  cursorEntryIndex,
  filterNewEntries,
  advanceCursor,
  cursorForFile,
  filterEventsByPerson,
  groupEventsByMonth,
  buildEventReport,
  personLabel,
  resolveShowSpeculative,
  trimChat,
  sanitizeWords,
  sanitizeEmotions,
  sanitizePeople,
} from './types';
export type {
  BlackBoxData,
  BlackBoxSettings,
  Profile,
  AIObservation,
  Mention,
  EventItem,
  Review,
  ChatMsg,
  Cursor,
  DiarySourceEntry,
  DiarySourceRef,
} from './types';

/** onunload 清理（v4 数据层无常驻监听，保留空实现供 main 调用） */
export function unloadBlackBox(): void {
  // 58 阶段无注册监听；59+ 增量提炼监听在此清理
}
