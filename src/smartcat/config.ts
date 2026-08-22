/**
 * smartcat 域配置（原 SmartCat.js ConfigManager：默认值 + 归一化；存储改走 smartcat.json）
 */
import type { Appearance, Personality, SmartCatConfig } from './types';

/** 默认配置（原 ConfigManager.defaultConfig 逐字，移除 apiKey——AI 走 bz core/ai） */
export function defaultConfig(): SmartCatConfig {
  return {
    appearance: 'orange',
    customColors: { primary: '#FF6B35', secondary: '#F7931E' },
    personality: 'lively',
    customPersonality: '你是一只聪明可爱的小橘助手，喜欢陪伴用户写笔记。回答要简短友好，偶尔可以卖萌。',
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
  // 外观/性格不在合法表内回退默认（原版读任意字符串只是 CSS 类名不匹配，这里兜底防样式失效）
  const appearances: Appearance[] = ['orange','gray','black','white','calico','neon','galaxy','liquidMetal','fire','crystal','cyberpunk','rainbow','hologram'];
  if (!appearances.includes(c.appearance as Appearance)) c.appearance = def.appearance;
  const personalities: Personality[] = ['lively','quiet','wise','cute','mentor'];
  if (!personalities.includes(c.personality as Personality)) c.personality = def.personality;
  // 历史裁剪（原 ConfigManager.saveConfig 语义：超 shortTermMemory*2 截尾）
  if (c.conversationHistory.length > c.shortTermMemory * 2) {
    c.conversationHistory = c.conversationHistory.slice(-Math.min(c.shortTermMemory * 2, c.conversationHistory.length));
  }
  return c;
}

/** 性格提示词（原 ContentMonitor/InteractionManager.getPersonalityPrompt 5 条文案逐字） */
export function getPersonalityPrompt(personality: Personality): string {
  const personalities: Record<string, string> = {
    lively: '你是一只活泼可爱的小橘，热情友好，喜欢互动，用简短活泼的语气说话，偶尔加一些猫咪表情。回答要非常简短，不超过60字。',
    quiet: '你是一只安静温柔的小橘，说话温和简洁，不会过多打扰用户，用平静的语气表达关心。回答要非常简短，不超过40字。',
    wise: '你是一只聪明智慧的小橘，善于思考和分析，能给出有见地的评论，用理性的语气说话。回答要简短有深度，不超过80字。',
    cute: '你是一只超级可爱的小橘，喜欢卖萌，用撒娇的语气说话，经常使用猫咪表情和可爱的词汇。回答要非常简短可爱，不超过50字。',
    mentor: '你是一只经验丰富的导师小橘，能够指导用户写作和思考，用专业但友好的语气给出建议。回答要简短实用，不超过70字。',
  };
  return personalities[personality] || personalities.lively;
}