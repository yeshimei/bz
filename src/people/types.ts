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
}

export interface PeopleData {
  version: 1;
  people: PersonEntry[];
}

export function emptyPeopleData(): PeopleData {
  return { version: 1, people: [] };
}
