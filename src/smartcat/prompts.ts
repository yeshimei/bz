/**
 * AIPromptGenerator（移植自 SmartCatPluginMood.js；ADR-0023 对齐 MATE）
 * 生成聊天/书评/自动陪伴的 system prompt。预设人格（5 选 1）已删除——
 * 人格由性格系统（OCEAN + 30 特质成长）提供：
 *  - 字数乘数由 traits 动态推导（外向/多巴胺高 → 话多）
 *  - 性格描述由 traits 合成（替代 5 套静态文案）
 *  - MATE 式 XML 数字状态向量注入（§7：内核决定 if/when/how，LLM 只读数值）
 */
import type { PadDimensions, SmartCatData, CharacterTraits } from './types';
import { formatStateVector } from './character';

export type InteractionType =
  | 'talk' | 'pet' | 'learn' | 'note_create' | 'note_edit' | 'note_read'
  | 'casual_chat' | 'book_review' | 'welcome_back' | 'settings_updated' | 'auto_companion';

/** 最大字数配置（基础值 + 互动权重；人格乘数改 traits 推导） */
const MAX_WORD_LIMITS = {
  baseMax: 180,
  interactionWeights: {
    pet: 0.8, learn: 1.3, note_create: 1.15, note_edit: 0.95, note_read: 1.1,
    casual_chat: 1.0, book_review: 1.35, welcome_back: 0.9, settings_updated: 0.95,
  },
  absoluteMax: 265,
} as const;

/** 计算动态最大字数（人格乘数 = traits 推导：外向/多巴胺高话多，神经质/焦虑波动） */
export function calculateMaxWordLimit(
  interactionType: string,
  userMessageLength = 0,
  pad?: PadDimensions | null,
  traits?: CharacterTraits | null,
): number {
  try {
    let maxWords: number = MAX_WORD_LIMITS.baseMax;
    const dopamine = traits?.dopamine ?? 0.5;
    const extraversion = dopamine; // 近似：dopamine 基线代表外向性
    const anxiety = traits?.anxiety ?? 0.5;
    // 外向高 → 话多；焦虑高 → 话短（MATE：内向低 self_worth 分享欲低）
    const personalityMultiplier = 0.9 + (extraversion - 0.5) * 0.8 - (anxiety - 0.5) * 0.4;
    maxWords *= Math.max(0.7, Math.min(1.4, personalityMultiplier));
    const interactionWeight = (MAX_WORD_LIMITS.interactionWeights as Record<string, number>)[interactionType] || 1.0;
    maxWords *= interactionWeight;
    const userMessageFactor = Math.min(1.2, 1 + (userMessageLength / 100) * 0.2);
    maxWords *= userMessageFactor;
    if (pad) {
      const moodFactor = calculateMoodFactor(pad);
      maxWords *= moodFactor;
    }
    maxWords = Math.min(MAX_WORD_LIMITS.absoluteMax, Math.round(maxWords)) as number;
    return Math.max(80, maxWords);
  } catch (e) {
    return 180;
  }
}

/** 心情影响因子（PAD 版：愉悦高话多、唤醒低话少） */
export function calculateMoodFactor(pad: PadDimensions): number {
  let moodFactor = 1.0;
  if (pad.pleasure > 70) moodFactor *= 1.1;
  if (pad.arousal < 30) moodFactor *= 0.9;
  if (pad.pleasure < 30) moodFactor *= 0.9;
  if (pad.dominance > 70) moodFactor *= 1.05;
  return moodFactor;
}

/** 由 traits 动态合成性格描述（替代 5 套静态文案；MATE：性格由经历涌现） */
export function getCharacterDescription(traits?: CharacterTraits | null): string {
  if (!traits) return '安静友善，偶尔撒娇的陪伴猫咪';
  const parts: string[] = [];
  const warmth = traits.warmth ?? 0.5;
  const dopamine = traits.dopamine ?? 0.5;
  const anxiety = traits.anxiety ?? 0.5;
  const humor = traits.humor ?? 0.5;
  const selfWorth = traits.self_worth ?? 0.5;
  if (warmth >= 0.65) parts.push('温暖粘人，喜欢依偎和陪伴');
  else if (warmth <= 0.35) parts.push('有些疏离，保持距离感');
  if (dopamine >= 0.6) parts.push('活泼好动，喜欢互动');
  else if (dopamine <= 0.4) parts.push('安静沉稳，享受独处');
  if (anxiety >= 0.6) parts.push('有点敏感，需要温柔对待');
  else if (anxiety <= 0.4) parts.push('大大咧咧，情绪稳定');
  if (humor >= 0.6) parts.push('会讲冷笑话，爱卖萌');
  if (selfWorth >= 0.6) parts.push('自信阳光');
  return parts.length ? parts.join('，') + '的猫咪' : '安静友善，偶尔撒娇的陪伴猫咪';
}

/** personalities 旧文案全面废弃——保留函数名兼容导出（返回动态描述） */
export function getPersonalityDescription(): string {
  return getCharacterDescription();
}

/** 性格 prompt（旧接口，返回动态描述 + MATE 数值角色行） */
export function fallbackPersonalityPrompt(): string {
  return getCharacterDescription();
}

/** 生成 prompt 主方法（MATE：注入状态向量 + traits 推导字数/描述；
   *  ADR-0025：companionContext 携带「懂你上下文块」——作息/情绪趋势/关系/相关记忆） */
export function generatePrompt(
  interactionType: InteractionType,
  userMessage = '',
  opts: {
    pad?: PadDimensions | null;
    data?: SmartCatData | null;
    currentMood?: string;
    currentEmotion?: string | null;
    companionContext?: string;
  } = {},
): string {
  const traits = opts.data?.personalityGrowth?.traits;
  const maxWords = calculateMaxWordLimit(interactionType, userMessage.length, opts.pad, traits);
  const prompt = `# 角色设定
你是一只智能陪伴猫咪"小橘"，性格由与用户的相处经历自然养成，没有固定模板。

## 性格
${getCharacterDescription(traits)}

## 回复字数要求
### 字数限制
- 最大字数：${maxWords}字
- 要求：回复要贴合当前性格，保持内容质量的同时控制字数。

请确保回复长度不超过${maxWords}字。

## 当前状态详情
${opts.pad ? formatMoodDetails(opts.pad, opts.currentMood, opts.currentEmotion) : ''}
${opts.data ? '\n## 内核状态向量（只读参考，勿复述）\n' + formatStateVector(opts.data.personalityGrowth, opts.pad || { pleasure: 55, arousal: 50, dominance: 50 }, opts.currentEmotion ?? null) : ''}
${opts.companionContext ? '\n## 你了解的用户（背景知识：作息/情绪趋势/关系/相关记忆。自然地用在表达里，不要逐条复述）\n' + opts.companionContext : ''}

## 回复要求
${getResponseRequirements(interactionType, maxWords)}

## 用户消息
${userMessage ? `用户说："${userMessage}"` : '用户正在与你互动'}

请根据以上状态信息，用符合当前性格和心情的语气进行回复，回复长度不超过${maxWords}字。`;
  return prompt;
}

/** 心情详情块（PAD 版：三维 + 5 档 + 瞬时情绪） */
export function formatMoodDetails(pad: PadDimensions, currentMood?: string, currentEmotion?: string | null): string {
  if (!pad) return '### 心情状态\n暂时无法获取详细心情数据';
  const d = pad;
  const highlights = getMoodHighlights(d);
  return `### 心情状态分析
${highlights}

详细维度（PAD）：
- 愉悦度：${Math.round(d.pleasure)}/100 ${getMoodEmoji(d.pleasure, '😊', '😐', '😔')}
- 唤醒度：${Math.round(d.arousal)}/100 ${getMoodEmoji(d.arousal, '⚡', '🔋', '😴')}
- 支配度：${Math.round(d.dominance)}/100 ${getMoodEmoji(d.dominance, '👑', '🧭', '🌊')}
- 整体心情：${currentMood ? MOOD_STATE_TEXT[currentMood] || currentMood : '平静'}
${currentEmotion ? `- 当前情绪：${currentEmotion}` : ''}`;
}

/** 5 档心情文案 */
const MOOD_STATE_TEXT: Record<string, string> = {
  excellent: '超开心', good: '心情好', neutral: '平常心', low: '小低落', poor: '不开心',
};

/** 心情亮点（PAD 版） */
export function getMoodHighlights(pad: PadDimensions): string[] {
  const highlights: string[] = [];
  if (pad.pleasure > 80) highlights.push('当前非常开心');
  else if (pad.pleasure < 30) highlights.push('心情有些低落');
  if (pad.arousal > 80) highlights.push('精力充沛');
  else if (pad.arousal < 30) highlights.push('有些疲惫');
  if (pad.dominance > 80) highlights.push('掌控感强');
  else if (pad.dominance < 30) highlights.push('有些无力感');
  return highlights;
}

/** 心情 emoji */
export function getMoodEmoji(value: number, high: string, mid: string, low: string): string {
  if (value >= 70) return high;
  if (value >= 40) return mid;
  return low;
}

/** 当前心情文本 */
export function getCurrentMoodText(currentMood?: string): string {
  if (!currentMood) return '平静';
  return MOOD_STATE_TEXT[currentMood] || '平静';
}

/** 互动类型显示名 */
export function getInteractionDisplayName(type: string): string {
  const names: Record<string, string> = {
    pet: '抚摸互动', click: '点触互动', learn: '学习陪伴', note_create: '笔记创建',
    note_edit: '笔记编辑', note_read: '笔记阅读', note_open: '笔记打开',
    casual_chat: '日常聊天', book_review: '书评交流', welcome_back: '欢迎回来',
    settings_updated: '设置更新', talk: '对话', auto_companion: '自动陪伴',
  };
  return names[type] || '常规互动';
}

/** 回复要求 */
export function getResponseRequirements(interactionType: string, maxWords: number): string {
  const base = [
    `1. 回复长度不超过${maxWords}字`,
    '2. 保持小橘的猫咪角色设定，不要跳出角色',
    '3. 语气自然，不要机械',
    '4. 如果用户提到笔记内容，结合上下文回应',
    '5. 适当使用猫咪表情（如 ~、喵、咕噜）但不要过度',
    '6. 回复要有温度，让用户感到被陪伴',
    '7. 用符合当前性格的方式回应（性格见上，随相处成长，不要千篇一律）',
  ];
  return `### 回复要求
${base.map((b) => `- ${b}`).join('\n')}`;
}