/**
 * AIPromptGenerator（移植自 SmartCatPluginMood.js AIPromptGenerator L4274-4652）
 * 生成聊天/书评/自动陪伴的 system prompt；字数公式与模板逐字保留。
 * currentPersonality 原版恒 undefined（只读不写，铁律 4 保留）→ 本版显式接 config.personality 回落 lively。
 */
import type { MoodDimensions, Personality } from './types';
import { getPersonalityPrompt } from './config';

export type InteractionType =
  | 'talk' | 'pet' | 'learn' | 'note_create' | 'note_edit' | 'note_read'
  | 'casual_chat' | 'book_review' | 'welcome_back' | 'settings_updated' | 'auto_companion';

/** 最大字数配置（原 initializeMaxWordLimits 逐字） */
const MAX_WORD_LIMITS = {
  baseMax: 180,
  personalityMultipliers: { lively: 1.2, quiet: 0.9, wise: 1.3, cute: 1.2, mentor: 1.25 },
  interactionWeights: {
    pet: 0.8, learn: 1.3, note_create: 1.15, note_edit: 0.95, note_read: 1.1,
    casual_chat: 1.0, book_review: 1.35, welcome_back: 0.9, settings_updated: 0.95,
  },
  absoluteMax: 265,
} as const;

/** 计算动态最大字数（原 calculateMaxWordLimit 逐字；缺省人格 lively） */
export function calculateMaxWordLimit(interactionType: string, userMessageLength = 0, dimensions?: MoodDimensions | null, personality?: Personality): number {
  try {
    let maxWords: number = MAX_WORD_LIMITS.baseMax;
    const p = personality || 'lively';
    const personalityMultiplier = (MAX_WORD_LIMITS.personalityMultipliers as Record<string, number>)[p] || 1.0;
    maxWords *= personalityMultiplier;
    const interactionWeight = (MAX_WORD_LIMITS.interactionWeights as Record<string, number>)[interactionType] || 1.0;
    maxWords *= interactionWeight;
    const userMessageFactor = Math.min(1.2, 1 + (userMessageLength / 100) * 0.2);
    maxWords *= userMessageFactor;
    if (dimensions) {
      const moodFactor = calculateMoodFactor(dimensions);
      maxWords *= moodFactor;
    }
    maxWords = Math.min(MAX_WORD_LIMITS.absoluteMax, Math.round(maxWords)) as number;
    return Math.max(80, maxWords);
  } catch (e) {
    return 180;
  }
}

/** 心情影响因子（原 calculateMoodFactor 逐字） */
export function calculateMoodFactor(dimensions: MoodDimensions): number {
  let moodFactor = 1.0;
  if (dimensions.happiness > 70) moodFactor *= 1.1;
  if (dimensions.energy < 30) moodFactor *= 0.9;
  if (dimensions.curiosity > 70) moodFactor *= 1.1;
  if (dimensions.creativity > 70) moodFactor *= 1.15;
  return moodFactor;
}

/** 人格描述（原 getPersonalityDescription 逐字） */
export function getPersonalityDescription(personality?: Personality): string {
  const p = personality || 'lively';
  const descriptions: Record<string, string> = {
    lively: '活泼友好，喜欢互动，充满能量，容易兴奋也容易无聊',
    quiet: '安静专注，善于思考，享受独处，状态稳定持久',
    wise: '聪明好奇，热爱学习，思维敏锐，善于分析',
    cute: '可爱粘人，需要关注，情感丰富，反应热烈',
    mentor: '专业指导，关注进度，目标导向，注重效率',
  };
  return descriptions[p] || '活泼友好';
}

/** 当前心情文本（原 getCurrentMoodText 逐字；'content' 等未命中 → '平静'） */
export function getCurrentMoodText(currentMood?: string): string {
  if (!currentMood) return '平静';
  const moodTexts: Record<string, string> = {
    excellent: '非常开心', good: '良好', neutral: '平静', low: '有点低落', poor: '不佳',
  };
  return moodTexts[currentMood] || '平静';
}

/** 心情 emoji（原 getMoodEmoji：≥70 高 / ≥40 中 / 否则低） */
export function getMoodEmoji(value: number, high: string, mid: string, low: string): string {
  if (value >= 70) return high;
  if (value >= 40) return mid;
  return low;
}

/** 心情详情块（原 formatMoodDetails 逐字结构） */
export function formatMoodDetails(dimensions: MoodDimensions): string {
  if (!dimensions) return '### 心情状态\n暂时无法获取详细心情数据';
  const d = dimensions;
  const highlights = getMoodHighlights(d);
  return `### 心情状态分析
${highlights}

详细维度：
- 愉悦度：${Math.round(d.happiness)}/100 ${getMoodEmoji(d.happiness, '😊', '😐', '😔')}
- 活力值：${Math.round(d.energy)}/100 ${getMoodEmoji(d.energy, '⚡', '🔋', '😴')}
- 好奇心：${Math.round(d.curiosity)}/100 ${getMoodEmoji(d.curiosity, '🔍', '🤔', '😑')}
- 亲密度：${Math.round(d.affection)}/100 ${getMoodEmoji(d.affection, '💕', '❤️', '💔')}
- 专注度：${Math.round(d.focus)}/100 ${getMoodEmoji(d.focus, '🎯', '📝', '🌫️')}
- 创造力：${Math.round(d.creativity)}/100 ${getMoodEmoji(d.creativity, '🎨', '💡', '📚')}
- 生产力：${Math.round(d.productivity)}/100 ${getMoodEmoji(d.productivity, '🚀', '📈', '📉')}
- 放松度：${Math.round(d.relaxation)}/100 ${getMoodEmoji(d.relaxation, '🌿', '☕', '😣')}`;
}

/** 心情亮点（原 getMoodHighlights 逐字） */
export function getMoodHighlights(dimensions: MoodDimensions): string[] {
  const highlights: string[] = [];
  if (dimensions.happiness > 80) highlights.push('当前非常开心');
  else if (dimensions.happiness < 30) highlights.push('心情有些低落');
  if (dimensions.energy > 80) highlights.push('精力充沛');
  else if (dimensions.energy < 30) highlights.push('有些疲惫');
  if (dimensions.curiosity > 80) highlights.push('充满好奇');
  else if (dimensions.curiosity < 30) highlights.push('兴致不高');
  if (dimensions.affection > 80) highlights.push('非常依恋');
  else if (dimensions.affection < 30) highlights.push('有些疏离');
  if (dimensions.focus > 80) highlights.push('高度专注');
  else if (dimensions.focus < 30) highlights.push('难以集中');
  if (dimensions.creativity > 80) highlights.push('灵感充沛');
  else if (dimensions.creativity < 30) highlights.push('创意枯竭');
  if (dimensions.productivity > 80) highlights.push('高效产出');
  else if (dimensions.productivity < 30) highlights.push('效率低下');
  if (dimensions.relaxation > 80) highlights.push('身心放松');
  else if (dimensions.relaxation < 30) highlights.push('有些紧绷');
  return highlights;
}

/** 互动类型显示名（原 getInteractionDisplayName 语义；未命中 → 常规互动） */
export function getInteractionDisplayName(type: string): string {
  const names: Record<string, string> = {
    pet: '抚摸互动', click: '点触互动', learn: '学习陪伴', note_create: '笔记创建',
    note_edit: '笔记编辑', note_read: '笔记阅读', note_open: '笔记打开',
    casual_chat: '日常聊天', book_review: '书评交流', welcome_back: '欢迎回来',
    settings_updated: '设置更新', talk: '对话', auto_companion: '自动陪伴',
  };
  return names[type] || '常规互动';
}

/** 回复要求（原 getResponseRequirements 简化结构，字数要求保留） */
export function getResponseRequirements(interactionType: string, maxWords: number): string {
  const p: Record<string, string> = {
    lively: '用活泼跳跃的语气，可以附带猫咪口癖',
    quiet: '语气温和内敛，点到为止',
    wise: '理性克制，逻辑清晰',
    cute: '萌感十足，多用语气词',
    mentor: '专业靠谱，直接给出要点',
  };
  const base = [
    `1. 回复长度不超过${maxWords}字`,
    '2. 保持小橘的猫咪角色设定，不要跳出角色',
    '3. 语气自然，不要机械',
    '4. 如果用户提到笔记内容，结合上下文回应',
    '5. 适当使用猫咪表情（如 ~、喵、咕噜）但不要过度',
    '6. 回复要有温度，让用户感到被陪伴',
  ];
  return `### 回复要求
- 语气：${p[interactionType] || '自然亲切'}
${base.map((b) => `- ${b}`).join('\n')}`;
}

/** 生成 prompt 主方法（原 generatePrompt 逐字模板结构） */
export function generatePrompt(
  interactionType: InteractionType,
  userMessage = '',
  opts: { dimensions?: MoodDimensions | null; personality?: Personality; currentMood?: string } = {},
): string {
  const maxWords = calculateMaxWordLimit(interactionType, userMessage.length, opts.dimensions, opts.personality);
  const personality = opts.personality || 'lively';
  const prompt = `# 角色设定
你是一只智能陪伴猫咪"小橘"，具有以下特性：

## 基本设定
- 角色：数字宠物猫，能够感知用户状态并给予陪伴
- 性格：${getPersonalityDescription(personality)}
- 当前心情：${getCurrentMoodText(opts.currentMood)}
- 互动类型：${getInteractionDisplayName(interactionType)}

## 回复字数要求
### 字数限制
- 最大字数：${maxWords}字
- 要求：${personalityReq(personality)}

请确保回复长度不超过${maxWords}字，保持内容质量的同时控制字数。

## 当前状态详情
${opts.dimensions ? formatMoodDetails(opts.dimensions) : ''}
- 当前人格：${personalityName(personality)}

## 回复要求
${getResponseRequirements(interactionType, maxWords)}

## 用户消息
${userMessage ? `用户说："${userMessage}"` : '用户正在与你互动'}

请根据以上状态信息，用符合当前性格和心情的语气进行回复，回复长度不超过${maxWords}字。`;
  return prompt;
}

function personalityReq(personality: string): string {
  const p: Record<string, string> = {
    lively: '回复要活泼简短，避免冗长',
    quiet: '语言简洁精炼，点到为止',
    wise: '可以适当详细，但不要啰嗦',
    cute: '保持可爱风格，控制长度',
    mentor: '专业且高效，重点突出',
  };
  return p[personality] || '根据内容需要控制字数';
}

function personalityName(personality: string): string {
  const p: Record<string, string> = {
    lively: '活泼型 🎉', quiet: '安静型 🌿', wise: '智慧型 📚', cute: '萌系型 💕', mentor: '导师型 🎓',
  };
  return p[personality] || '活泼型 🎉';
}

/** 简易性格 prompt（无 MoodSystem 时的兜底，原 SmartCat.js handleCasualChat 语义） */
export function fallbackPersonalityPrompt(personality: Personality, customPersonality?: string): string {
  const base = personality === ('custom' as any) && customPersonality
    ? customPersonality
    : getPersonalityPrompt(personality);
  return `${base}\n\n用户正在和你进行日常聊天，请用友好可爱的语气回复，保持简短自然。`;
}