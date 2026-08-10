/**
 * 黑匣子域入口（ticket 33-38）：命令回调与生命周期清理。
 * 命令在 main.ts COMMANDS 表注册（域内不重复 addCommand）：
 * bz-blackbox-capture（写感触）/ bz-blackbox-open（黑匣子）/ bz-blackbox-review（复盘）。
 */
import { openBlackBoxCapture, closeBlackBoxCapture, unloadBlackBoxCapture } from './capture';
import { openBlackBoxChat, closeBlackBoxChat, unloadBlackBoxChat } from './chat';
import { manualReview, triggerAutoReview, unloadBlackBoxReview } from './review';

export { openBlackBoxCapture, closeBlackBoxCapture, unloadBlackBoxCapture } from './capture';
export { openBlackBoxChat, closeBlackBoxChat, unloadBlackBoxChat } from './chat';
export { manualReview, triggerAutoReview, unloadBlackBoxReview } from './review';
export { BlackBoxDataManager, getBlackBoxFilePath, createImpression } from './data';
export { BlackBoxAI, buildPersonaPrompt, buildReviewPrompt, searchImpressions, parseReviewJson, fallbackAsk } from './ai';
export { EMOTION_TAGS, MAX_EMOTIONS, MAX_INTENSITY, DIRECTION_OPTIONS, DEFAULT_PERSONA, shouldAutoReview, trimChat } from './types';
export type { BlackBoxData, Impression, Persona, Review, ChatMsg, Direction, Emotion, SelfView } from './types';
export { openBlackBoxSettings } from './settings-ui';

/** onunload 全量清理 */
export function unloadBlackBox(): void {
  unloadBlackBoxCapture();
  unloadBlackBoxChat();
  unloadBlackBoxReview();
}
