/**
 * 黑匣子域入口（ticket 59，v4 提炼链路 + 面板骨架阶段）：
 * 命令在 main.ts COMMANDS 表注册（域内不重复 addCommand）。
 * 59 阶段：数据层 + 日记读取 + 提炼链路 + 三标签面板骨架；对话/复盘在 ticket 62/63 恢复。
 */
export { BlackBoxDataManager, getBlackBoxFilePath, createProfile, createEvent, genId, normalizeData } from './data';
export { isDiaryStreamFile, scanAllDiaryEntries, parseDiaryFile } from './diary-scan';
export { buildExtractPrompt, parseExtractJson, applyExtraction } from './extract';
export type { ExtractResult } from './extract';
export {
  ensureBlackBoxExtraction,
  unloadBlackBoxExtraction,
  processPendingEntries,
  runFullExtraction,
  hasPendingEntries,
  collectNewEntries,
  getExtractionInFlight,
} from './sync';
export { openBlackBoxPanel, closeBlackBoxPanel, unloadBlackBoxPanel, getPanelState } from './panel';
import { unloadBlackBoxPanel } from './panel';
import { unloadBlackBoxExtraction } from './sync';
export { manualReview, buildReviewPrompt, parseReviewJson, applyReview, triggerManualReview } from './review';
export type { ReviewResult } from './review';
export { openBlackBoxChat, closeBlackBoxChat, unloadBlackBoxChat, buildChatContext, searchDiaryEntries, profilesSummary, tokenize, DEFAULT_PERSONA } from './chat';
import { unloadBlackBoxChat } from './chat';
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

/** onunload 清理（面板 + 对话 + 提炼监听） */
export function unloadBlackBox(): void {
  unloadBlackBoxPanel();
  unloadBlackBoxChat();
  unloadBlackBoxExtraction();
}
