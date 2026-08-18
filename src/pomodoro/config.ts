/**
 * 番茄钟预设方案（ticket 31）：11 个科学预设 + 自定义（手册《CODE/obsidian 插件/番茄钟.md》）。
 * 时长单位：分钟。
 */
export interface PomodoroPreset {
  label: string;
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
}

export const PRESETS: Record<string, PomodoroPreset> = {
  classic: { label: '经典标准', workMin: 25, shortBreakMin: 5, longBreakMin: 15 },
  neuro: { label: '神经专注', workMin: 30, shortBreakMin: 7, longBreakMin: 20 },
  flow: { label: '深度心流', workMin: 50, shortBreakMin: 10, longBreakMin: 25 },
  creative: { label: '创意激发', workMin: 40, shortBreakMin: 12, longBreakMin: 20 },
  beginner: { label: '初学入门', workMin: 15, shortBreakMin: 5, longBreakMin: 12 },
  study: { label: '高效学习', workMin: 30, shortBreakMin: 5, longBreakMin: 15 },
  sprint: { label: '敏捷冲刺', workMin: 20, shortBreakMin: 4, longBreakMin: 12 },
  marathon: { label: '马拉松式', workMin: 45, shortBreakMin: 15, longBreakMin: 30 },
  recovery: { label: '疲劳恢复', workMin: 20, shortBreakMin: 10, longBreakMin: 20 },
  intense: { label: '高强度', workMin: 50, shortBreakMin: 5, longBreakMin: 15 },
  balanced: { label: '平衡模式', workMin: 35, shortBreakMin: 7, longBreakMin: 18 },
};

/** 自定义方案 id（设置下拉第 12 档） */
export const CUSTOM_PRESET_ID = 'custom';
