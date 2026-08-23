/**
 * smartcat 域类型（移植自 SmartCat 8 个 JS 文件，字段名/枚举逐字保留）
 */
import type BzSettings from '../settings';

/** 外观皮肤枚举（13 种：基础 5 + 高级 8） */
export type Appearance =
  | 'orange' | 'gray' | 'black' | 'white' | 'calico'
  | 'neon' | 'galaxy' | 'liquidMetal' | 'fire' | 'crystal'
  | 'cyberpunk' | 'rainbow' | 'hologram';

/** 性格枚举已废弃（预设人格退役，ADR-0023 对齐 MATE：OCEAN+30 特质成长） */

/** 离散心情状态（MOOD_MAP 5 级；currentMood 初始 'content' 不在枚举内，按原样保留） */
export type MoodLevel = 'excellent' | 'good' | 'neutral' | 'low' | 'poor';

/** 心情 PAD 三维（Mehrabian PAD 模型：愉悦/唤醒/支配，0-100；社区对齐，ADR-0021 后心情重构） */
export interface PadDimensions {
  pleasure: number;
  arousal: number;
  dominance: number;
}

/** 负面状态 4 项（只展示，原版从不写入） */
export interface NegativeStates {
  boredom: number;
  fatigue: number;
  distraction: number;
  loneliness: number;
}

/** 对话消息（role 原样透传 OpenAI 兼容） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/** 主动关心状态（存 data.editingData.proactiveCare；不进 config——属运行状态） */
export interface ProactiveCareState {
  /** 本周 ISO 周键（如 2026-W34） */
  week: string;
  /** 本周已主动次数 */
  count: number;
  /** 上次主动时间戳 */
  lastAt: number;
}

/** 云端 LLM 打分范围（ADR-0025 追加决策，2026-08-23 用户拍板「智能」默认）：
 *  all=全部走 LLM（现状）；smart=智能（日记/反省/闪念恒 LLM + 长内容 ≥30 字，聊天/域事件本地）；
 *  diary=仅日记恒 LLM；local=全本地（规则分+词法情绪，零在线调用） */
export type CloudScoringMode = 'all' | 'smart' | 'diary' | 'local';

/**
 * 域配置（原 localStorage 'smart-cat-config' 全字段；
 * apiKey 不迁移——AI 走 bz core/ai，用户拍板）
 */
export interface SmartCatConfig {
  appearance: Appearance;
  customColors: { primary: string; secondary: string };
  speakInterval: number;
  speakProbability: number;
  responseSensitivity: string;
  contextLength: number;
  contextSplitRatio: number;
  conversationHistory: ChatMessage[];
  shortTermMemory: number;
  /** 笔记库接入总开关（ADR-0024 决策：写日记/闪念计入信任成长 + 笔记库内容 = 信息来源；默认开） */
  noteSource: boolean;
  /** 主动关心开关（2026-08-23 用户拍板：每周温和主动搭话；默认开） */
  proactiveCare: boolean;
  /** 每周主动上限（1-7，默认 2） */
  proactiveWeeklyCap: number;
  /** 云端 LLM 打分范围（ADR-0025 追加决策：智能默认——聊天/域事件本地打分省调用，日记/反省/闪念恒 LLM 保质量） */
  cloudScoring: CloudScoringMode;
}

/** 心情持久化（PAD 三维 + 5 档显示位 + 瞬时情绪；情绪标注经记忆条目/currentEmotion） */
export interface MoodData {
  pad: PadDimensions;
  lastUpdate: number;
  lastMood: string;
  currentEmotion: string | null;
}

/** OCEAN 五因素人格（0-1，出生随机种子；MATE character_seed 输入） */
export interface OceanProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

/** 30 特质性格（MATE 论文 Table 2，9 临床群组全量；0-1，logistic 饱和
 *  冲突键名加群组前缀：def_avoidance/beh_depth/exist_depth） */
export interface CharacterTraits {
  // attachment (Bowlby)
  anxiety: number; avoidance: number; separation_tol: number;
  // coreBeliefs (Young)
  self_worth: number; world_safety: number; others_trust: number;
  // cognitive
  reflectiveness: number; analytical: number; creativity: number;
  // defense (Vaillant)
  humor: number; intellectual: number; def_avoidance: number; support: number;
  // selfConcept (Rotter/Bandura)
  locus_control: number; self_esteem: number; self_efficacy: number;
  // values (Schwartz)
  enhancement: number; transcendence: number; change: number; conservation: number;
  // behavioral
  warmth: number; directness: number; beh_depth: number; conflict: number; optimism: number;
  // neuro (Cloninger)
  serotonin: number; dopamine: number; oxytocin: number; cortisol: number;
  // existential (Yalom)——出生 0.0，仅反思成长
  exist_depth: number; familiarity: number; concern: number;
}

/** 性格成长（对齐 MATE：OCEAN 种子 + 30 特质 + 关系张量 + 周统计） */
export interface PersonalityGrowthData {
  ocean: OceanProfile;
  traits: CharacterTraits;
  relationship: { trust: number; attachment: number };
  behaviorStats: {
    interactionCount: number;
    emotionalTone: number;        // 累计情绪基调 -1..1
    preferredHour: number;        // 活跃时段众数 0-23
    sessionCount: number;
  };
  growthHistory: any[];
  lastSave: number;
  version: string;
}

/**
 * 记忆流条目（GA Memory Object 的 TS 结构，ADR-0021）
 * 单层记忆：所有观察/洞察同构追加入 stream，检索时按三因子分级。
 */
export interface MemoryStreamEntry {
  id: string;
  created: string;        // ISO 创建时间
  lastAccessed: string;   // ISO 最近被检索到时间（检索时更新，自增强）
  description: string;    // 内容本体（一句话）
  importance: number;     // 0-1（写入时 LLM 打分 0-10 归一；未配置 AI 时规则打分）
  type: 'observation' | 'insight'; // 观察 / 反思洞察
  evidenceIds?: string[]; // 仅 insight：由哪些记忆归纳而来（溯源）
  source?: string;        // 写入来源（如 'chat'）
  emotion?: string;       // 情绪标注（LLM 顺带/词法兜底；情感记忆并入记忆流）
  credibility?: number;   // 观察可信度 0-1（ADR-0036：来源档位基准 + LLM 可覆盖；旧数据无该字段 → 0.5 中性）
}

/** 记忆流（单层，检索时分级；ADR-0021 取代原四层） */
export interface MemoryStream {
  version: number;
  lastUpdated: string;
  stream: MemoryStreamEntry[];
  reflection: {
    lastReflectAt: number;
    count: number;
    /** 睡前巩固（digest）：上次日小结时间戳（2026-08-23 增强，可选字段旧数据直读） */
    lastDigestAt?: number;
    /** 睡前巩固次数 */
    digestCount?: number;
  };
}

/**
 * smartcat.json 全量数据（用户拍板：所有数据单 json——
 * 原 localStorage 3 个 key + 原 CONFIG/SMART CAT 3 文件 + 原 memories 4 层，全部收纳）
 */
export interface SmartCatData {
  config: SmartCatConfig;
  mood: MoodData;
  personalityGrowth: PersonalityGrowthData;
  /** 运行状态（不落 config 各域运行字段松散存放，兼容冻结保持 any）：
   *  proactiveCare（主动关心周状态）/dueScan（memo 到期扫描日）/weeklyReport（周报告状态）/
   *  ceBandit（Bandit 臂参数）/lastPresenceAt（在场口径，ticket 088：观察/聊天/主动关心统一刷新，旧数据缺省容忍） */
  editingData: any;
  memory: MemoryStream;
}

/** 域事件名（原 EVENT constants，保留全部） */
export const EVENTS = {
  BUBBLE_SHOWN: 'bubbleShown',
  BUBBLE_QUEUED: 'bubbleQueued',
  BUBBLE_REMOVED: 'bubbleRemoved',
  BUBBLE_PINNED: 'bubblePinned',
  BUBBLE_TO_CHAT: 'bubbleToChat',
  APPEARANCE_CHANGED: 'appearanceChanged',
  APPEARANCE_SELECTED: 'appearanceSelected',
  PERSONALITY_SELECTED: 'personalitySelected',
  SETTINGS_SAVED: 'settingsSaved',
  SETTINGS_OPENED: 'settingsOpened',
  SETTINGS_CLOSED: 'settingsClosed',
  CHAT_OPENED: 'chatOpened',
  CHAT_CLOSED: 'chatClosed',
  MESSAGE_SENT: 'messageSent',
  MESSAGE_ERROR: 'messageError',
  API_CALL_SUCCESS: 'apiCallSuccess',
  API_CALL_ERROR: 'apiCallError',
  COMPANION_MODE_STARTED: 'companionModeStarted',
  PET_INTERACTION: 'petInteraction',
  CONTEXT_LENGTH_UPDATED: 'contextLengthUpdated',
  CONTEXT_RATIO_UPDATED: 'contextRatioUpdated',
  SPEAK_INTERVAL_UPDATED: 'speakIntervalUpdated',
  SPEAK_PROBABILITY_UPDATED: 'speakProbabilityUpdated',
  SHORT_TERM_MEMORY_UPDATED: 'shortTermMemoryUpdated',
  CONTENT_MONITORING_STARTED: 'contentMonitoringStarted',
  FILE_OPENED: 'fileOpened',
  BOOK_REVIEW_GENERATION_STARTED: 'bookReviewGenerationStarted',
  BOOK_REVIEW_GENERATED: 'bookReviewGenerated',
  BOOK_REVIEW_GENERATION_ERROR: 'bookReviewGenerationError',
  INTERACTIONS_INITIALIZED: 'interactionsInitialized',
  CAT_TAPPED: 'catTapped',
  CAT_DRAGGED: 'catDragged',
  LONG_PRESS_DETECTED: 'longPressDetected',
  HISTORY_CLEARED: 'historyCleared',
  APP_INITIALIZED: 'appInitialized',
} as const;

/** 消息类型 key 类型（SmartCatMessages.js 顶层 key 全集） */
export type MessageKey =
  | 'PET_MESSAGES' | 'CONNECTED_MESSAGES' | 'SETUP_MESSAGES' | 'WELCOME_BACK_MESSAGES'
  | 'LITTLE_ORANGE_COMPLAINTS' | 'THINKING_MESSAGES' | 'THINKING_IN_PROGRESS_MESSAGES';

/** 与 bz 设置结构对齐所需的 smartcat 设置窗口形状（域设置弹窗用） */
export interface SmartcatSettingsLike {
  smartcatEnabled?: boolean;
  smartcatMobileDefaultFullscreen?: boolean;
}