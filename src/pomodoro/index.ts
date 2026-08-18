/**
 * 番茄钟域入口（ticket 26-32）：命令回调与生命周期清理。
 * 命令 bz-pomodoro-open 在 main.ts COMMANDS 表注册（域内不重复 addCommand）。
 * ticket 63：移除读书番茄钟与专注目标（导出面同步清理）。
 */
export { openPomodoro, closePomodoro, unloadPomodoro, ensurePomodoro } from './ui';
export { mountPomodoroStatusBar, unmountPomodoroStatusBar } from './statusbar';
export { playSound } from './sound';
export { PomodoroDataManager, getPomodoroFilePath } from './data';
export { transition, recover, DEFAULT_DURATIONS, DEFAULT_OPTIONS, createInitialState, phaseDurationSec } from './state';