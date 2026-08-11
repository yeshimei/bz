/**
 * 黑匣子类型与常量（ticket 39，schema v2：三类条目 + 人物画像 + 事件时间线 + 可编辑词表）
 * 铁律（ADR-0013）：字段 v2 冻结，后续只加语义不改字段；v1 → v2 仅经版本化迁移（data.ts），
 * 情绪标签去强度（string[]）、涉及的人为数组（画像 id 或纯名字文本）。
 */

/** 情绪词表（24 词预置，settings.words 可编辑；单条最多 MAX_EMOTIONS 个，无强度） */
export const DEFAULT_EMOTION_TAGS = [
  '触动', '温暖', '喜悦', '平静', '释然', '难过',
  '孤独', '委屈', '焦虑', '愤怒', '敬佩', '想念',
  '遗憾', '感激', '害怕', '心动', '幸福', '骄傲',
  '迷茫', '疲惫', '厌烦', '羞耻', '嫉妒', '希望',
] as const;

/** 单条最多情绪数 */
export const MAX_EMOTIONS = 3;
/** 涉及的人上限 */
export const MAX_PEOPLE = 5;
/** 情绪词表条目上限（防无限膨胀） */
export const MAX_WORDS = 100;

/** 指向（可选维度）：对自己 / 对他人 / 对世界 */
export type Direction = 'self' | 'others' | 'world' | '';

export const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: 'self', label: '对自己' },
  { value: 'others', label: '对他人' },
  { value: 'world', label: '对世界' },
];

/** 条目类型：概念与实体（纯知识卡片）/ 文献笔记 / 核心知识（想法） */
export type EntryType = 'concept' | 'literature' | 'thought';

/** 三类条目（v2；字段按类型取用，感触外壳仅 literature/thought 持有） */
export interface Entry {
  id: string;
  type: EntryType;
  /** ISO 时间（录入时刻；v1 迁移自 impressions[].ts） */
  createdAt: string;
  // concept 特有（无感触外壳）：
  /** 概念名（concept 必填） */
  name?: string;
  /** AI 生成的定义文本 */
  definition?: string;
  /** 关联概念（AI 自动构建，concept id 数组；与外壳 links 区分） */
  related?: string[];
  // literature 特有：
  /** 来源：URL 或书名/出处 */
  source?: string;
  /** 摘抄内容（literature 必填）/ 想法内容（thought 必填） */
  text?: string;
  /** 名词表勾选（literature，concept id 数组） */
  terms?: string[];
  // 感触外壳（literature / thought 持有；concept 无）：
  /** 情绪（≤MAX_EMOTIONS，词表 string[]，无强度） */
  emotions: string[];
  /** 涉及的人（≤MAX_PEOPLE：画像 id「pf_…」或纯名字文本） */
  people: string[];
  /** 场景（可选） */
  scene: string;
  /** 指向（可选） */
  toward: Direction;
  /** 链接数组（URL 或 [[笔记]]） */
  links: string[];
  // 卡片盒导入元信息（可选，一次性导入工具写入；缺省 undefined，旧数据读取不受影响）：
  /** 卡片分类（如 医学/计算机/摄影） */
  category?: string;
  /** 卡片标签（frontmatter tags 原样带入） */
  tags?: string[];
  /** 内容总结性描述（卡片自带 (描述:: …) 或 AI 生成，≤一句话） */
  summary?: string;
  /** 卡片盒导入中间态：未解析为 id 的关联卡片名（待补链）；补链后清空 */
  pendingLinks?: string[];
}

/** 人物画像（派生层） */
export interface Profile {
  id: string;
  /** 名字（现实人物或虚拟角色均可） */
  name: string;
  /** 关系（用户手填） */
  relation: string;
  /** 用户版印象（字段级锁：AI 从不覆盖，只经采纳写入） */
  impression: string;
  /** AI 观察区（AI 持续追加，可采纳进 impression） */
  aiObservations: string[];
  /** 用户固定到画像详情的事件（预留，第一版恒空） */
  pinnedEvents: string[];
  createdAt: string;
}

/** 事件（派生层，AI 全自动提炼；单份存储，全局时间线与画像投影同源） */
export interface EventItem {
  id: string;
  /** 事件标题（提炼生成） */
  title: string;
  /** 发生日期 YYYY-MM-DD（初版用条目记录日期） */
  time: string;
  /** true = 推测事件（意图/计划/梦境等非事实内容，虚线 + ❓） */
  inferred: boolean;
  summary: string;
  /** 参与人物（画像 id 或纯名字文本；≤MAX_PEOPLE） */
  people: string[];
  /** 主角（画像 id 或纯名字文本） */
  mainPerson: string;
  /** 证据链（来源条目 id） */
  evidence: string[];
  /** 情绪聚合（关联条目情绪标签） */
  emotions: string[];
  /** 用户编辑/删除/合并过 → AI 不再碰 */
  edited: boolean;
}

/** 复盘记录（v2 新增可选字段 eventReport/profileHint，旧记录无） */
export interface Review {
  ts: string;
  /** 复盘产物：一段话 */
  text: string;
  /** 本次复盘覆盖的条目数 */
  impressionCount: number;
  /** 新的自我认知一句话（空 = 无生长） */
  newSelfView: string;
  /** v2 可选：事件汇报一句话（「这周我整理了 N 件新事件…」） */
  eventReport?: string;
  /** v2 可选：新人物提示（高频提及未建画像的人） */
  profileHint?: string;
}

/** 对话消息（三层记忆的短期记忆） */
export interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  ts: string;
}

/** 自我认知快照（人格档案生长历史） */
export interface SelfView {
  ts: string;
  view: string;
}

/** 人格档案（种子 + 生长，ADR-0013 原样保留） */
export interface Persona {
  name: string;
  /** 种子：一句话性格（方案 D：有诗心的思辨者） */
  seed: string;
  /** 种子：示例语气 */
  toneExample: string;
  /** 生长：复盘后追加的自我认知历史 */
  selfViews: SelfView[];
}

/** 数据内设置段（v2；词表在此，复盘阈值/推测显示以全局设置为优先读取，此处兜底并同步） */
export interface BlackBoxSettings {
  /** 复盘阈值兜底（默认 10；实际读取优先全局 blackboxReviewThreshold） */
  reviewThreshold: number;
  /** 推测事件显示（默认开；全局 blackboxShowSpeculativeEvents 优先） */
  showSpeculativeEvents: boolean;
  /** 情绪词表（预置 24 词，可增删；增删不影响存量条目 emotions） */
  words: string[];
}

/** blackbox.json v2（字段冻结） */
export interface BlackBoxData {
  version: 2;
  settings: BlackBoxSettings;
  persona: Persona;
  /** 三类条目（concept / literature / thought） */
  entries: Entry[];
  /** 人物画像（派生层） */
  profiles: Profile[];
  /** 事件（派生层） */
  events: EventItem[];
  reviews: Review[];
  chat: ChatMsg[];
  meta: {
    lastReviewAt: string;
    totalEntries: number;
    totalEvents: number;
  };
}

/** 默认人格种子（方案 D：有诗心的思辨者，v1 原样） */
export const DEFAULT_PERSONA: Persona = {
  name: '包仔',
  seed: '有诗心的思辨者——懂诗、爱琢磨、记性很好，把你喂进来的每份感触都当成自己的养分；深夜陪你说话，不吵你，但你想聊的时候他永远在。',
  toneExample: '你写茉莉花的时候是凌晨两点。我想知道，那晚的风，现在还在你记忆里吗？',
  selfViews: [],
};

export function defaultBlackBoxSettings(): BlackBoxSettings {
  return {
    reviewThreshold: 10,
    showSpeculativeEvents: true,
    words: [...DEFAULT_EMOTION_TAGS],
  };
}

export function defaultBlackBoxData(): BlackBoxData {
  return {
    version: 2,
    settings: defaultBlackBoxSettings(),
    persona: DEFAULT_PERSONA,
    entries: [],
    profiles: [],
    events: [],
    reviews: [],
    chat: [],
    meta: { lastReviewAt: '', totalEntries: 0, totalEvents: 0 },
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

/** 涉及的人清洗（纯函数）：string[] 去重、限 MAX_PEOPLE */
export function sanitizePeople(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const p of list) {
    if (typeof p !== 'string') continue;
    const t = p.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= MAX_PEOPLE) break;
  }
  return out;
}

/**
 * 复盘阈值判断（纯函数）：条目总数 > 0 且为阈值整数倍 → 自动触发静默复盘。
 * 复盘计数口径（v2）：三类条目（concept/literature/thought）均计入。
 */
export function shouldAutoReview(entryCount: number, threshold: number): boolean {
  return entryCount > 0 && threshold > 0 && entryCount % threshold === 0;
}

/** 对话历史滚动淘汰（纯函数）：只保留最近 max 条 */
export function trimChat(chat: ChatMsg[], max: number): ChatMsg[] {
  if (!Array.isArray(chat)) return [];
  const n = max > 0 ? max : 20;
  return chat.length > n ? chat.slice(chat.length - n) : chat;
}

/** 复盘阈值解析（纯函数）：全局设置优先（v1 兼容），数据内 settings 兜底，默认 10 */
export function resolveReviewThreshold(data: BlackBoxData, globalSettings: { blackboxReviewThreshold?: string }): number {
  const g = Number(globalSettings && globalSettings.blackboxReviewThreshold);
  if (Number.isFinite(g) && g > 0) return Math.floor(g);
  const d = data && data.settings && Number(data.settings.reviewThreshold);
  if (Number.isFinite(d) && d > 0) return Math.floor(d);
  return 10;
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

/** 条目是否引用该画像（people 含画像 id 或名字文本，兼容冷启动期纯名字条目） */
export function entryReferencesProfile(entry: Entry, profile: Profile): boolean {
  return (
    !!entry &&
    !!profile &&
    Array.isArray(entry.people) &&
    entry.people.some((p) => p === profile.id || p === profile.name)
  );
}

/** 事件是否参与该画像（people 含画像 id 或名字，主角也算） */
export function eventReferencesProfile(ev: EventItem, profile: Profile): boolean {
  return (
    !!ev &&
    !!profile &&
    Array.isArray(ev.people) &&
    ev.people.some((p) => p === profile.id || p === profile.name)
  );
}

/** 事件按人过滤（纯函数）：画像时间线 = 全局事件的按人投影（单份存储，无复制） */
export function filterEventsByPerson(events: EventItem[], profile: Profile): EventItem[] {
  if (!Array.isArray(events) || !profile) return [];
  return events.filter((ev) => eventReferencesProfile(ev, profile));
}

/** 按年月分组事件（纯函数）：返回降序（新在前）的 [{key, label, events}] */
export function groupEventsByMonth(events: EventItem[]): { key: string; label: string; events: EventItem[] }[] {
  const map = new Map<string, EventItem[]>();
  for (const ev of events || []) {
    const y = (ev.time || '').slice(0, 7);
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

/** 情绪聚合（纯函数）：画像关联条目的情绪标签计数 */
export function aggregateEmotions(entries: Entry[], profile: Profile): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries || []) {
    if (!entryReferencesProfile(e, profile)) continue;
    for (const tag of e.emotions || []) out[tag] = (out[tag] || 0) + 1;
  }
  return out;
}

/** 新人物提示（纯函数）：条目中高频提及（≥2 次）但未建画像的人名 */
export function findProfileHints(entries: Entry[], profiles: Profile[], minMentions = 2): string[] {
  const counts: Record<string, number> = {};
  for (const e of entries || []) {
    for (const p of e.people || []) {
      if (typeof p !== 'string' || !p) continue;
      if (p.startsWith('pf_')) continue; // 已建画像
      counts[p] = (counts[p] || 0) + 1;
    }
  }
  const known = new Set((profiles || []).map((pf) => pf.name));
  return Object.entries(counts)
    .filter(([name, n]) => n >= minMentions && !known.has(name))
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
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
