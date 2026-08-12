/**
 * 黑匣子域入口（ticket 33-45）：命令回调与生命周期清理。
 * 命令在 main.ts COMMANDS 表注册（域内不重复 addCommand）：
 * bz-blackbox-capture（录入）/ bz-blackbox-open（黑匣子）/ bz-blackbox-review（复盘）/ bz-blackbox-panel（黑匣子面板）。
 */
import { openBlackBoxCapture, closeBlackBoxCapture, unloadBlackBoxCapture } from './capture';
import { openBlackBoxChat, closeBlackBoxChat, unloadBlackBoxChat } from './chat';
import { openBlackBoxPanel, closeBlackBoxPanel, unloadBlackBoxPanel } from './panel';
import { manualReview, triggerAutoReview, unloadBlackBoxReview } from './review';
import { openCardboxImport, closeCardboxImport, unloadCardboxImport } from './import-ui';
import { ensureBlackBoxSync, unloadBlackBoxSync, setBlackBoxSyncNotify } from './sync';

export { openBlackBoxCapture, closeBlackBoxCapture, unloadBlackBoxCapture, openBlackBoxCaptureConcept, openBlackBoxCaptureLiterature, openBlackBoxCaptureThought } from './capture';
export { openBlackBoxChat, closeBlackBoxChat, unloadBlackBoxChat } from './chat';
export { openBlackBoxPanel, closeBlackBoxPanel, unloadBlackBoxPanel } from './panel';
export { manualReview, triggerAutoReview, unloadBlackBoxReview } from './review';
export { openCardboxImport, closeCardboxImport, unloadCardboxImport } from './import-ui';
export { ensureBlackBoxSync, unloadBlackBoxSync, setBlackBoxSyncNotify } from './sync';
export { BlackBoxDataManager, getBlackBoxFilePath, createEntry, createProfile, createEvent, buildNameById } from './data';
export {
  BB_NOTE_ROOT,
  TYPE_DIR,
  typeDir,
  isBlackBoxNotePath,
  sanitizeFileName,
  noteNameFromPath,
  entryNoteTitle,
  notePathOf,
  parseWikilinkNames,
  parseFrontmatterBlock,
  buildNoteContent,
  parseNoteContent,
} from './notes';
export {
  BlackBoxAI,
  buildPersonaPrompt,
  buildReviewPrompt,
  buildEventExtractPrompt,
  buildProfilesSummary,
  buildEventTitlesByEntry,
  searchEntries,
  parseReviewJson,
  parseEventExtractJson,
  parseProfileJson,
  parseConceptJson,
  parseLiteratureJson,
  fallbackAsk,
} from './ai';
export {
  DEFAULT_EMOTION_TAGS,
  MAX_EMOTIONS,
  MAX_PEOPLE,
  MAX_WORDS,
  DIRECTION_OPTIONS,
  DEFAULT_PERSONA,
  shouldAutoReview,
  trimChat,
  sanitizeWords,
  sanitizeEmotions,
  sanitizePeople,
  resolveReviewThreshold,
  resolveShowSpeculative,
  groupEventsByMonth,
  aggregateEmotions,
  findProfileHints,
  buildEventReport,
  filterEventsByPerson,
  personLabel,
} from './types';
export type {
  BlackBoxData,
  Entry,
  EntryType,
  Profile,
  EventItem,
  Persona,
  Review,
  ChatMsg,
  Direction,
  SelfView,
  BlackBoxSettings,
} from './types';
export { openBlackBoxSettings } from './settings-ui';

/** onunload 全量清理 */
export function unloadBlackBox(): void {
  unloadBlackBoxCapture();
  unloadBlackBoxChat();
  unloadBlackBoxPanel();
  unloadBlackBoxReview();
  unloadCardboxImport();
  unloadBlackBoxSync();
}
