/**
 * smartcat 域配置（原 SmartCat.js ConfigManager：默认值 + 归一化；存储改走 smartcat.json）
 * ADR-0023：预设人格（personality/customPersonality）已删除——人格由性格系统（character.ts
 * OCEAN 种子 + 30 特质成长）承担，config 只留外观/行为参数。
 */
import type { Appearance, SmartCatConfig } from './types';

/** 默认配置（原 ConfigManager.defaultConfig 逐字，移除 apiKey 与 personality） */
export function defaultConfig(): SmartCatConfig {
  return {
    appearance: 'orange',
    customColors: { primary: '#FF6B35', secondary: '#F7931E' },
    speakInterval: 5,
    speakProbability: 0.3,
    responseSensitivity: 'medium',
    contextLength: 500,
    contextSplitRatio: 0.5,
    conversationHistory: [],
    shortTermMemory: 50,
  };
}

/** 容错归一：非法字段回退默认（原 loadConfig 合并 + shortTermMemory 越界强制 50 语义） */
export function normalizeConfig(raw: any): SmartCatConfig {
  const def = defaultConfig();
  if (!raw || typeof raw !== 'object') return def;
  const c: SmartCatConfig = { ...def, ...raw };
  if (!c.shortTermMemory || c.shortTermMemory < 50 || c.shortTermMemory > 200) c.shortTermMemory = 50;
  if (typeof c.speakInterval !== 'number') c.speakInterval = def.speakInterval;
  if (typeof c.speakProbability !== 'number') c.speakProbability = def.speakProbability;
  if (typeof c.contextLength !== 'number') c.contextLength = def.contextLength;
  if (typeof c.contextSplitRatio !== 'number') c.contextSplitRatio = def.contextSplitRatio;
  if (!Array.isArray(c.conversationHistory)) c.conversationHistory = [];
  // 外观不在合法表内回退默认（原版读任意字符串只是 CSS 类名不匹配，这里兜底防样式失效）
  const appearances: Appearance[] = ['orange','gray','black','white','calico','neon','galaxy','liquidMetal','fire','crystal','cyberpunk','rainbow','hologram'];
  if (!appearances.includes(c.appearance as Appearance)) c.appearance = def.appearance;
  // 历史裁剪（原 ConfigManager.saveConfig 语义：超 shortTermMemory*2 截尾）
  if (c.conversationHistory.length > c.shortTermMemory * 2) {
    c.conversationHistory = c.conversationHistory.slice(-Math.min(c.shortTermMemory * 2, c.conversationHistory.length));
  }
  return c;
}