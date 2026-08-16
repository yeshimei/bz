/**
 * 番茄钟域入口（ticket 26-32）：命令回调与生命周期清理。
 * 命令 bz-pomodoro-open 在 main.ts COMMANDS 表注册（域内不重复 addCommand）。
 */
export { openPomodoro, closePomodoro, unloadPomodoro, ensurePomodoro } from './ui';
export { mountPomodoroStatusBar, unmountPomodoroStatusBar } from './statusbar';
export { playSound } from './sound';
export { PomodoroDataManager, getPomodoroFilePath } from './data';
export { transition, recover, DEFAULT_DURATIONS, DEFAULT_OPTIONS, createInitialState, phaseDurationSec } from './state';
export {
  emptyReadingSession,
  startReadingSession,
  switchReadingBook,
  endReadingSession,
  tickReadingSession,
  recoverReadingSession,
  settleReadingSegment,
  isReadingActive,
  normalizeReadingSession,
} from './reading';
export type { ReadingSession } from './reading';
export { ensurePomodoroEpubLink, unloadPomodoroEpubLink, getEpubBook, decideReadingAction, checkReadingNow, readingModePopupEnabled } from './epub-link';
export { startReadingFocus, switchReadingFocus, closeReadingSession, exitReadingMode, showReadingConfirm } from './ui';
