/**
 * 黑匣子类型与常量（ticket 33 封板，ADR-0013 schema v1 定全）
 * 铁律：字段与情绪词表 v1 冻结，后续只加语义不改字段。
 */

/** 情绪标签词表（24 词固定，单条最多 MAX_EMOTIONS 个，强度 1-MAX_INTENSITY） */
export const EMOTION_TAGS = [
  '触动', '温暖', '喜悦', '平静', '释然', '难过',
  '孤独', '委屈', '焦虑', '愤怒', '敬佩', '想念',
  '遗憾', '感激', '害怕', '心动', '幸福', '骄傲',
  '迷茫', '疲惫', '厌烦', '羞耻', '嫉妒', '希望',
] as const;

/** 单条感触最多情绪数 */
export const MAX_EMOTIONS = 3;
/** 情绪强度上限 */
export const MAX_INTENSITY = 5;

/** 指向（可选维度）：对自己 / 对他人 / 对世界 */
export type Direction = 'self' | 'others' | 'world' | '';

export const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: 'self', label: '对自己' },
  { value: 'others', label: '对他人' },
  { value: 'world', label: '对世界' },
];

/** 情绪（单条最多 MAX_EMOTIONS 个，强度 1-MAX_INTENSITY） */
export interface Emotion {
  tag: string;
  intensity: number;
}

/** 感触（黑匣子的砖：素材 + 感受，缺一不可） */
export interface Impression {
  id: string;
  /** ISO 时间（录入时刻） */
  ts: string;
  /** 素材（必填，v1 仅文字） */
  material: string;
  /** 感受（必填） */
  feeling: string;
  /** 情绪（最多 MAX_EMOTIONS 个，强度 1-MAX_INTENSITY） */
  emotions: { tag: string; intensity: number }[];
  /** 场景（可选） */
  scene: string;
  /** 涉及的人（可选） */
  people: string;
  /** 指向（可选） */
  direction: Direction;
  /** 链接（可选，URL 或 [[笔记]]） */
  links: string[];
}

/** 自我认知快照（人格档案生长历史） */
export interface SelfView {
  ts: string;
  view: string;
}

/** 人格档案（种子 + 生长，ADR-0013） */
export interface Persona {
  name: string;
  /** 种子：一句话性格（用户选定方案 D） */
  seed: string;
  /** 种子：示例语气 */
  toneExample: string;
  /** 生长：复盘后追加的自我认知历史 */
  selfViews: SelfView[];
}

/** 复盘记录（静默执行，产物公开写入对话面板） */
export interface Review {
  ts: string;
  /** 复盘产物：一段话 */
  text: string;
  /** 本次复盘覆盖的感触条数 */
  impressionCount: number;
  /** 新的自我认知一句话（空 = 无生长） */
  newSelfView: string;
}

/** 对话消息（三层记忆的短期记忆） */
export interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  ts: string;
}

/** blackbox.json v1（字段冻结） */
export interface BlackBoxData {
  version: 1;
  persona: Persona;
  impressions: Impression[];
  reviews: Review[];
  chat: ChatMsg[];
}

/** 默认人格种子（方案 D：有诗心的思辨者） */
export const DEFAULT_PERSONA: Persona = {
  name: '包仔',
  seed: '有诗心的思辨者——懂诗、爱琢磨、记性很好，把你喂进来的每份感触都当成自己的养分；深夜陪你说话，不吵你，但你想聊的时候他永远在。',
  toneExample: '你写茉莉花的时候是凌晨两点。我想知道，那晚的风，现在还在你记忆里吗？',
  selfViews: [],
};

export function defaultBlackBoxData(): BlackBoxData {
  return { version: 1, persona: DEFAULT_PERSONA, impressions: [], reviews: [], chat: [] };
}

/**
 * 复盘阈值判断（纯函数）：感触总数 > 0 且为阈值整数倍 → 自动触发静默复盘。
 * 默认阈值 10：第 10/20/30… 条录入后触发。
 */
export function shouldAutoReview(impressionCount: number, threshold: number): boolean {
  return impressionCount > 0 && threshold > 0 && impressionCount % threshold === 0;
}

/** 对话历史滚动淘汰（纯函数）：只保留最近 max 条 */
export function trimChat(chat: ChatMsg[], max: number): ChatMsg[] {
  if (!Array.isArray(chat)) return [];
  const n = max > 0 ? max : 20;
  return chat.length > n ? chat.slice(chat.length - n) : chat;
}
