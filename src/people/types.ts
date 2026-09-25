/**
 * 脸谱域（people）数据模型（issue 435 / ADR-0191）。
 *
 * 隐私口径（ADR-0191 §2）：微信聊天**原文不落盘**——导入解析与 AI 提炼全程在内存，
 * people.json 只存人物卡、提炼出的事件、脸谱画像与导入元数据；原始消息用完即弃。
 */

/** 统一消息（解析层输出；ts = 毫秒时间戳） */
export interface UnifiedMessage {
  ts: number;
  isSender: boolean;
  text: string;
}

/** 交往事件（LLM 从聊天片段提炼；ts = 日期字符串 YYYY-MM-DD，字典序即时间序） */
export interface FaceEvent {
  ts: string;
  summary: string;
  /** 轻重：major = 大事（约定 / 见面 / 冲突 / 承诺），minor = 小事（日常片段）；旧数据无此字段 */
  kind?: 'major' | 'minor';
}

/** 代表性原话（画像的证据层：口头禅 / 典型语气 / 冲突时的说法） */
export interface QuoteItem {
  /** 日期 YYYY-MM-DD */
  ts: string;
  /** 说话人：'对方' 或 '我' */
  who: string;
  /** 原话（提炼时要求不改写） */
  text: string;
}

/** 场景与细节（反复出现的地点 / 物件 / 习惯动作 / 难忘画面） */
export interface MomentItem {
  ts: string;
  summary: string;
}

/**
 * 人物档案（手动填写）。ADR-0191 背景即写明「聊天记录是素材来源**之一**而非全部」，
 * 本结构承载聊天之外的信息：社交账号、生日、怎么认识的、标签、备注。
 */
export interface PersonProfile {
  /** 社交账号：平台 + 账号（微信 / QQ / 微博 / 小红书 / Telegram…） */
  socials?: Array<{ platform: string; handle: string }>;
  /** 生日（YYYY-MM-DD；年份不明可只写 MM-DD） */
  birthday?: string;
  /** 怎么认识的 */
  metVia?: string;
  /** 什么时候认识的（自由文本，如「2023 年夏天」） */
  metAt?: string;
  /** 家乡 / 现居 */
  hometown?: string;
  /** 职业 */
  job?: string;
  /** 关系标签（家人 / 同学 / 同事 / 网友…） */
  tags?: string[];
  /** 一句话备注 */
  note?: string;
}

/** 随手记的一笔（手动事件；重画画像时与导入提炼的事件合并） */
export interface ManualEvent {
  id: string;
  /** YYYY-MM-DD */
  ts: string;
  summary: string;
  /** 记录时间 ISO */
  createdAt: string;
}

/**
 * 互动统计（纯本地计算，零 AI 成本）。落盘的是**聚合结果**，不含聊天原文——
 * 与 ADR-0191 §2 的隐私口径一致。
 */
export interface ContactStats {
  /** 按月消息量（升序）：[['2026-03', 1234], ...] */
  monthly: Array<[string, number]>;
  /** 会话发起数（相邻消息间隔 ≥ 30 分钟视为新会话） */
  initiatedByMe: number;
  initiatedByOther: number;
  /** 平均回复时延（秒；0 = 无样本） */
  myAvgReplySec: number;
  otherAvgReplySec: number;
  /** 24 小时活跃分布（消息条数，索引 = 小时） */
  myHourly: number[];
  otherHourly: number[];
  /** 消息形态计数：文本 / 图片 / 语音 / 视频 / 表情 / 通话 / 文件 / 引用 / 分享 / 系统 */
  kindCounts: Record<string, number>;
  /** 媒体素材：语音条数（标签带转写的；issue 445，旧数据无此字段） */
  voiceCount?: number;
  /** 媒体素材：语音总时长（秒；标签没写时长的不计入） */
  voiceTotalSec?: number;
  /** 媒体素材：图片张数（带画面描述的） */
  imageCount?: number;
}

/** 一次导入的元数据 */
export interface ImportRecord {
  /** 源文件名（不含路径） */
  file: string;
  /** 导入时间 ISO */
  importedAt: string;
  /** 解析得的文本消息条数（进提炼的） */
  messageCount: number;
  /** 被过滤的非文本 / 空消息条数 */
  skippedCount: number;
  /** 消息时间跨度 ISO */
  timeFrom: string;
  timeTo: string;
  /** 本次导入的互动统计（旧数据无此字段） */
  stats?: ContactStats;
}

/** 脸谱（AI 生成产物，重新导入可覆盖重画） */
export interface FaceDigest {
  /** 画像 markdown——受限语法：## 小节 / - 列表 / **粗体** / > 引用块（ui 层迷你渲染器消费） */
  portrait: string;
  events: FaceEvent[];
  /** 画像引用的代表性原话（证据层；旧数据无此字段） */
  quotes?: QuoteItem[];
  /** 关系时间线（编年史 markdown，从认识到现在；旧数据无此字段） */
  chronicle?: string;
  /** 生成时间 ISO */
  generatedAt: string;
}

/** 人物卡 */
export interface PersonEntry {
  /** 稳定 id：优先 talker（wxid），缺省回落文件名去扩展名 */
  id: string;
  /** 称呼（默认取 id，可改） */
  name: string;
  /** 建卡时间 ISO */
  createdAt: string;
  imports: ImportRecord[];
  digest?: FaceDigest;
  /** 手动档案（聊天之外的补充信息） */
  profile?: PersonProfile;
  /** 随手记的事件（与导入提炼的事件并存） */
  manualEvents?: ManualEvent[];
  /** 增量提炼锚点：上次提炼过的最大消息时间戳（毫秒）；更早的消息不再重复送 AI */
  lastProcessedTs?: number;
}

export interface PeopleData {
  version: 1;
  people: PersonEntry[];
}

export function emptyPeopleData(): PeopleData {
  return { version: 1, people: [] };
}
