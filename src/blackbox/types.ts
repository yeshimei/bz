/**
 * 黑匣子类型与常量（ticket 58，schema v4：日记智能分析层，ADR-0017）
 * 铁律（ADR-0017）：字段 v4 冻结，后续只加语义不改字段；v3 存量已删除（无迁移链）。
 * v4 = 派生层：profiles（人物画像）/ mentions（人物提及候选）/ events（事件）/ reviews（复盘）/
 * chat（对话历史）/ cursor（增量游标）/ settings（词表 + 推测显示）。
 */

/** 情绪词表（24 词预置，settings.words 可编辑；AI 推断每条最多 MAX_EMOTIONS 个，无强度） */
export const DEFAULT_EMOTION_TAGS = [
  '触动', '温暖', '喜悦', '平静', '释然', '难过',
  '孤独', '委屈', '焦虑', '愤怒', '敬佩', '想念',
  '遗憾', '感激', '害怕', '心动', '幸福', '骄傲',
  '迷茫', '疲惫', '厌烦', '羞耻', '嫉妒', '希望',
] as const;

/** 单条最多情绪数 */
export const MAX_EMOTIONS = 3;
/** 情绪词表条目上限（防无限膨胀） */
export const MAX_WORDS = 100;

/** 人物画像（派生层，从日记 AI 提炼；provenance 分层：印象区 + AI 观察区） */
export interface Profile {
  id: string;
  /** 名字（现实人物或虚拟角色均可） */
  name: string;
  /** 别名（AI 提炼的称呼变体，如 妈/母亲） */
  aliases: string[];
  /** 印象区（用户主权，字段级锁：AI 从不覆盖，只经采纳写入） */
  impression: string;
  /** AI 观察区（AI 持续追加，可采纳进 impression，上限 5 条裁旧） */
  aiObservations: AIObservation[];
  /** 情绪聚合（{tag, count}，AI 推断累计） */
  emotions: { tag: string; count: number }[];
  /** 提及次数（含建画像前的计数） */
  mentionCount: number;
  /** 首次提及日期 YYYY-MM-DD */
  firstSeen: string;
  /** 最近提及日期 YYYY-MM-DD */
  lastSeen: string;
  /** 用户手动编辑过 → AI 重提炼跳过（humanEdited 锁） */
  humanEdited: boolean;
  createdAt: string;
}

/** AI 观察（画像 AI 观察区条目，带证据链） */
export interface AIObservation {
  ts: string;
  text: string;
  source: DiarySourceRef;
}

/** 日记来源引用（证据链：打开日记文件 + 行号定位，Q7） */
export interface DiarySourceRef {
  path: string;
  lineNumber: number;
  time: string;
}

/** 人物提及候选（未建画像的人物计数，Q13） */
export interface Mention {
  name: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

/** 事件（派生层，AI 从日记提炼；独立语义单元，一条日记可提炼多个） */
export interface EventItem {
  id: string;
  /** 事件标题（提炼生成） */
  title: string;
  /** 发生时间 ISO（初版用条目记录日期时间） */
  date: string;
  /** 时间精度：time（精确到 HH:mm）/ day（只精确到日） */
  datePrecision: 'time' | 'day';
  /** 参与人物（画像 id 或纯名字文本；≤MAX_PEOPLE） */
  people: string[];
  /** 情绪聚合（AI 推断标签，≤MAX_EMOTIONS） */
  emotions: string[];
  /** 证据链（来源日记条目引用） */
  source: DiarySourceRef;
  /** AI 自评置信度 0-1 */
  confidence: number;
  /** confirmed（≥0.7 入线）/ speculative（0.5-0.7 推测） */
  status: 'confirmed' | 'speculative';
  /** 用户编辑/删除/合并过 → AI 不再碰 */
  humanEdited: boolean;
}

/** 复盘记录（v4：手动触发，四段结构化，JSON 落盘） */
export interface Review {
  id: string;
  createdAt: string;
  period: { from: string; to: string };
  /** 四段报告（事实锚定：每条引用日期+原文片段） */
  report: {
    profileUpdates: string[];
    eventSummary: string[];
    emotionTrend: string;
    reflections: string[];
  };
  /** 新人物提示（mentions 高频未建画像，一键确认建画像） */
  newPeople: string[];
}

/** 对话消息（三层记忆的短期记忆） */
export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

/** 数据内设置段（v4） */
export interface BlackBoxSettings {
  /** 推测事件显示（默认开；全局 blackboxShowSpeculativeEvents 优先） */
  showSpeculativeEvents: boolean;
  /** 情绪词表（预置 24 词，可增删；增删不影响存量 emotions） */
  words: string[];
}

/** 增量游标（Q14：{file, entryIndex}——已处理到的文件路径 + 该文件已处理条目序号） */
export interface Cursor {
  file: string;
  entryIndex: number;
}

/** blackbox.json v4（ADR-0017；字段冻结，落盘即不可改）。
 * 日记是唯一事实源，v4 只存派生层。 */
export interface BlackBoxData {
  version: 4;
  settings: BlackBoxSettings;
  profiles: Profile[];
  mentions: Mention[];
  events: EventItem[];
  reviews: Review[];
  chat: ChatMsg[];
  cursor: Cursor | null;
}

/** 日记源条目（黑匣子只读：复用 diary/parser 产出的 DiaryEntry 形状） */
export interface DiarySourceEntry {
  id?: string;
  date: string;
  time: string;
  content: string;
  filename: string;
  lineNumber: number;
  tags?: string[];
}

// ===== 默认值 =====

export function defaultBlackBoxSettings(): BlackBoxSettings {
  return {
    showSpeculativeEvents: true,
    words: [...DEFAULT_EMOTION_TAGS],
  };
}

export function defaultBlackBoxData(): BlackBoxData {
  return {
    version: 4,
    settings: defaultBlackBoxSettings(),
    profiles: [],
    mentions: [],
    events: [],
    reviews: [],
    chat: [],
    cursor: null,
  };
}

// ---------------- 纯函数（数据校验/派生统计） ----------------

/** 词表清洗（纯函数）：去空、去重、限长 */
export function sanitizeWords(words: unknown, max = MAX_WORDS): string[] {
  if (!Array.isArray(words)) return [];
  const out: string[] = [];
  for (const w of words) {
    if (typeof w !== 'string') continue;
    const t = w.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** 情绪清洗（纯函数）：string[] 去重、限 MAX_EMOTIONS */
export function sanitizeEmotions(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const e of list) {
    if (typeof e !== 'string') continue;
    const t = e.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= MAX_EMOTIONS) break;
  }
  return out;
}

/** 涉及的人清洗（纯函数）：string[] 去重、限 MAX_PEOPLE（v2 沿用） */
export function sanitizePeople(list: unknown, max = 5): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const p of list) {
    if (typeof p !== 'string') continue;
    const t = p.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * 事件置信度分级（纯函数，Q3）：≥0.7 入线 confirmed / 0.5-0.7 推测 speculative / <0.5 不入库 discard。
 */
export function classifyEventConfidence(confidence: number): 'confirmed' | 'speculative' | 'discard' {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return 'discard';
  if (confidence >= 0.7) return 'confirmed';
  if (confidence >= 0.5) return 'speculative';
  return 'discard';
}

/** 事件去重（纯函数，标题 + 证据双重去重）：候选与既有任一事件同标题且同证据（路径+行号）→ 重复 */
export function dedupeEvent(existing: EventItem[], candidate: EventItem): boolean {
  if (!Array.isArray(existing) || !candidate) return false;
  return existing.some(
    (ev) =>
      ev &&
      ev.title === candidate.title &&
      ev.source &&
      candidate.source &&
      ev.source.path === candidate.source.path &&
      ev.source.lineNumber === candidate.source.lineNumber
  );
}

/**
 * mentions 合并（纯函数，Q13）：按名字聚合 {count, firstSeen, lastSeen}。
 * 同日多次 count+1 但 first/last 不变；新日期 lastSeen 更新。
 */
export function mergeMention(mentions: Mention[], name: string, date: string): Mention[] {
  const list = Array.isArray(mentions) ? mentions.slice() : [];
  const n = (name || '').trim();
  if (!n) return list;
  const idx = list.findIndex((m) => m && m.name === n);
  if (idx === -1) {
    list.push({ name: n, count: 1, firstSeen: date, lastSeen: date });
    return list;
  }
  const m = list[idx];
  const last = date > m.lastSeen ? date : m.lastSeen;
  const first = date < m.firstSeen ? date : m.firstSeen;
  list[idx] = { ...m, count: m.count + 1, firstSeen: first, lastSeen: last };
  return list;
}

/** mentions 清洗（纯函数）：过滤非法项、规范化（name 去空、count≥1、日期合法） */
export function sanitizeMentions(raw: unknown): Mention[] {
  if (!Array.isArray(raw)) return [];
  const out: Mention[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    if (!name) continue;
    const count = typeof m.count === 'number' && m.count >= 1 ? Math.floor(m.count) : 1;
    const firstSeen = typeof m.firstSeen === 'string' ? m.firstSeen : '';
    const lastSeen = typeof m.lastSeen === 'string' ? m.lastSeen : '';
    if (out.some((o) => o.name === name)) continue;
    out.push({ name, count, firstSeen, lastSeen });
  }
  return out;
}

/** 画像门槛（纯函数，Q12）：跨不同日期提及 ≥2 次 → 自动建画像 */
export function shouldBuildProfile(mentions: Mention[], name: string): boolean {
  const m = (Array.isArray(mentions) ? mentions : []).find((x) => x && x.name === name);
  if (!m) return false;
  if (m.count < 2) return false;
  return m.firstSeen !== m.lastSeen;
}

// ===== cursor 游标（Q14） =====

/** 取游标在指定文件的起始序号（纯函数）：无游标/文件不匹配 → 0（全量）；匹配 → entryIndex */
export function cursorEntryIndex(cursor: Cursor | null, filePath: string): number {
  if (!cursor || !filePath) return 0;
  if (cursor.file !== filePath) return 0;
  return typeof cursor.entryIndex === 'number' && cursor.entryIndex >= 0 ? cursor.entryIndex : 0;
}

/** 过滤新条目（纯函数）：同文件条目取游标之后；无游标 → 全量（file 为 basename 形态，与 DiaryEntry.filename 一致） */
export function filterNewEntries(entries: DiarySourceEntry[], cursor: Cursor | null): DiarySourceEntry[] {
  if (!Array.isArray(entries)) return [];
  if (!cursor) return entries.slice();
  const idx = cursorEntryIndex(cursor, cursor.file);
  // entries 为同一文件的条目（parseFile 产出顺序 = 序号）；游标之后 = 新条目
  return entries.slice(idx);
}

/** 推进游标（纯函数）：记录文件 + 已处理条目数 */
export function advanceCursor(cursor: Cursor | null, filePath: string, entryIndex: number): Cursor {
  return { file: filePath, entryIndex };
}

/** 游标构造（纯函数） */
export function cursorForFile(filePath: string, entryIndex: number): Cursor {
  return { file: filePath, entryIndex };
}

/** 事件按人过滤（纯函数）：画像时间线 = 全局事件的按人投影（单份存储，无复制） */
export function filterEventsByPerson(events: EventItem[], profile: Profile): EventItem[] {
  if (!Array.isArray(events) || !profile) return [];
  return events.filter((ev) => ev && Array.isArray(ev.people) && ev.people.some((p) => p === profile.id || p === profile.name));
}

/** 按年月分组事件（纯函数）：返回降序（新在前）的 [{key, label, events}] */
export function groupEventsByMonth(events: EventItem[]): { key: string; label: string; events: EventItem[] }[] {
  const map = new Map<string, EventItem[]>();
  for (const ev of events || []) {
    const y = (ev.date || '').slice(0, 7);
    if (!y) continue;
    const arr = map.get(y) || [];
    arr.push(ev);
    map.set(y, arr);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => {
      const [y, m] = key.split('-');
      return { key, label: `${y} 年 ${Number(m)} 月`, events: list };
    });
}

/** 事件汇报一句话（纯函数）：「这周我整理了 N 件新事件（其中 M 件推测）」 */
export function buildEventReport(newEventCount: number, speculativeCount: number): string {
  const head = `这周我整理了 ${newEventCount} 件新事件`;
  return speculativeCount > 0 ? `${head}（其中 ${speculativeCount} 件推测）` : head;
}

/** 人物显示名（纯函数）：画像 id → 画像名；纯名字原样 */
export function personLabel(idOrName: string, profiles: Profile[]): string {
  if (!idOrName) return '';
  if (idOrName.startsWith('pf_')) {
    const pf = (profiles || []).find((p) => p.id === idOrName);
    return pf ? pf.name : idOrName;
  }
  return idOrName;
}

/** 推测事件显示开关解析（纯函数）：全局设置优先，数据内 settings 兜底，默认开 */
export function resolveShowSpeculative(
  data: BlackBoxData,
  globalSettings: { blackboxShowSpeculativeEvents?: boolean }
): boolean {
  if (globalSettings && typeof globalSettings.blackboxShowSpeculativeEvents === 'boolean') {
    return globalSettings.blackboxShowSpeculativeEvents;
  }
  if (data && data.settings) return data.settings.showSpeculativeEvents !== false;
  return true;
}

/** 对话历史滚动淘汰（纯函数）：只保留最近 max 条 */
export function trimChat(chat: ChatMsg[], max: number): ChatMsg[] {
  if (!Array.isArray(chat)) return [];
  const n = max > 0 ? max : 20;
  return chat.length > n ? chat.slice(chat.length - n) : chat;
}
