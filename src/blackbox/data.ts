/**
 * 黑匣子数据层（ticket 39）：blackbox.json v2 读写 + v1 → v2 无损迁移。
 * 文件不存在/解析失败 → 默认数据（懒创建：save 时建目录建文件）；坏 JSON 先改名备份 .bak 保留现场。
 * v1（version===1）加载即自动迁移（impressions → entries type='thought'），save 写 v2；迁移幂等（version 已为 2 不再迁移）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import type { BlackBoxData, Entry, EventItem, Profile, ChatMsg, Persona, Review, EntryType } from './types';
import {
  defaultBlackBoxData,
  resolveReviewThreshold,
  sanitizeEmotions,
  sanitizePeople,
  sanitizeWords,
  shouldAutoReview,
} from './types';

/** 黑匣子数据文件路径（storagePath 优先，未注入回退默认；尾斜杠清理与全仓一致） */
export function getBlackBoxFilePath(): string {
  const s = tryGetSettings() as any;
  const dir = ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/blackbox.json`;
}

/** 域内 id 生成（spec 约定：bb_<ts>_<rand> / pf_<ts>_<rand> / ev_<ts>_<rand>） */
function genId(prefix: 'bb' | 'pf' | 'ev'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------- v1 → v2 迁移（纯函数，决策见 ticket 39） ----------------

/** v1 涉及的人：单行自由文本 → 按顿号/中英文逗号/空格拆分非空段（≤MAX_PEOPLE） */
export function splitV1People(people: unknown): string[] {
  if (typeof people !== 'string') return [];
  return sanitizePeople(people.split(/[，,、\s]+/).map((s) => s.trim()).filter(Boolean));
}

/** v1 链接：字符串按逗号拆数组（v1 实为逗号分隔多链接；已是数组则原样） */
function splitV1Links(links: unknown): string[] {
  if (Array.isArray(links)) return links.filter((l): l is string => typeof l === 'string');
  if (typeof links === 'string') {
    return links.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** v1 感触 → v2 thought 条目（素材+感受合并，语义不丢；情绪去强度；persona/chat/reviews 原样保留） */
export function migrateV1Impression(i: any): Entry | null {
  if (!i || typeof i !== 'object') return null;
  if (typeof i.id !== 'string' || typeof i.ts !== 'string') return null;
  if (typeof i.material !== 'string' || !i.material.trim()) return null;
  if (typeof i.feeling !== 'string' || !i.feeling.trim()) return null;
  const emotions = Array.isArray(i.emotions)
    ? sanitizeEmotions(i.emotions.map((e: any) => (e && typeof e.tag === 'string' ? e.tag : '')).filter(Boolean))
    : [];
  return {
    id: i.id,
    type: 'thought',
    createdAt: i.ts,
    text: `${i.material}\n\n${i.feeling}`,
    emotions,
    people: splitV1People(i.people),
    scene: typeof i.scene === 'string' ? i.scene : '',
    toward: i.direction === 'self' || i.direction === 'others' || i.direction === 'world' ? i.direction : '',
    links: splitV1Links(i.links),
  };
}

/** v1 数据整体迁移（幂等：调用方仅当 version===1 时调用；迁移结果再过 v2 normalize 容错） */
export function migrateV1ToV2(raw: any): any {
  const def = defaultBlackBoxData();
  const impressions = Array.isArray(raw && raw.impressions)
    ? raw.impressions.map(migrateV1Impression).filter((e): e is Entry => !!e)
    : [];
  return {
    version: 2,
    settings: { ...def.settings },
    persona: raw && raw.persona ? raw.persona : def.persona,
    entries: impressions,
    profiles: [],
    events: [],
    reviews: raw && Array.isArray(raw.reviews) ? raw.reviews : [],
    chat: raw && Array.isArray(raw.chat) ? raw.chat : [],
    meta: { lastReviewAt: '', totalEntries: impressions.length, totalEvents: 0 },
  };
}

// ---------------- v2 normalize（容错：非法字段回退默认、数组过滤非法条目） ----------------

function normalizePersona(raw: any): Persona {
  const def = defaultBlackBoxData().persona;
  if (!raw || typeof raw !== 'object') return def;
  const selfViews = Array.isArray(raw.selfViews)
    ? raw.selfViews.filter((v: any) => v && typeof v.ts === 'string' && typeof v.view === 'string')
    : [];
  return {
    name: typeof raw.name === 'string' && raw.name ? raw.name : def.name,
    seed: typeof raw.seed === 'string' && raw.seed ? raw.seed : def.seed,
    toneExample: typeof raw.toneExample === 'string' && raw.toneExample ? raw.toneExample : def.toneExample,
    selfViews,
  };
}

function normalizeSettings(raw: any): BlackBoxData['settings'] {
  const def = defaultBlackBoxData().settings;
  if (!raw || typeof raw !== 'object') return def;
  const n = Number(raw.reviewThreshold);
  return {
    reviewThreshold: Number.isFinite(n) && n > 0 ? Math.floor(n) : def.reviewThreshold,
    showSpeculativeEvents: raw.showSpeculativeEvents !== false,
    words: sanitizeWords(raw.words).length ? sanitizeWords(raw.words) : [...def.words],
  };
}

/** 条目校验（按类型必填字段；三类均要求 id/type/createdAt） */
export function isValidEntry(e: any): e is Entry {
  if (!e || typeof e !== 'object') return false;
  if (typeof e.id !== 'string' || !e.id) return false;
  if (e.type !== 'concept' && e.type !== 'literature' && e.type !== 'thought') return false;
  if (typeof e.createdAt !== 'string' || !e.createdAt) return false;
  if (e.type === 'concept') {
    if (typeof e.name !== 'string' || !e.name.trim()) return false;
  } else {
    if (typeof e.text !== 'string' || !e.text.trim()) return false;
  }
  return true;
}

function normalizeEntry(e: any): Entry | null {
  if (!isValidEntry(e)) return null;
  const base: Entry = {
    id: e.id,
    type: e.type as EntryType,
    createdAt: e.createdAt,
    emotions: sanitizeEmotions(e.emotions),
    people: sanitizePeople(e.people),
    scene: typeof e.scene === 'string' ? e.scene : '',
    toward: e.toward === 'self' || e.toward === 'others' || e.toward === 'world' ? e.toward : '',
    links: Array.isArray(e.links) ? e.links.filter((l): l is string => typeof l === 'string') : [],
  };
  if (e.type === 'concept') {
    base.name = typeof e.name === 'string' ? e.name.trim() : '';
    base.definition = typeof e.definition === 'string' ? e.definition : '';
    base.related = Array.isArray(e.related)
      ? e.related.filter((r): r is string => typeof r === 'string' && r.length > 0)
      : [];
  }
  if (e.type === 'literature') {
    base.text = typeof e.text === 'string' ? e.text : '';
    base.source = typeof e.source === 'string' ? e.source : '';
    base.terms = Array.isArray(e.terms)
      ? e.terms.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : [];
  }
  if (e.type === 'thought') {
    base.text = typeof e.text === 'string' ? e.text : '';
  }
  // 卡片盒导入元信息透传（可选字段，缺省不填；旧数据读取不受影响）
  if (typeof e.category === 'string' && e.category.trim()) base.category = e.category.trim();
  if (Array.isArray(e.tags)) base.tags = e.tags.filter((t): t is string => typeof t === 'string');
  if (typeof e.summary === 'string' && e.summary.trim()) base.summary = e.summary.trim();
  return base;
}

function normalizeProfile(p: any): Profile | null {
  if (!p || typeof p !== 'object') return null;
  if (typeof p.id !== 'string' || !p.id) return null;
  if (typeof p.name !== 'string' || !p.name.trim()) return null;
  return {
    id: p.id,
    name: p.name.trim(),
    relation: typeof p.relation === 'string' ? p.relation : '',
    impression: typeof p.impression === 'string' ? p.impression : '',
    aiObservations: Array.isArray(p.aiObservations)
      ? p.aiObservations.filter((o): o is string => typeof o === 'string')
      : [],
    pinnedEvents: Array.isArray(p.pinnedEvents)
      ? p.pinnedEvents.filter((o): o is string => typeof o === 'string')
      : [],
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
  };
}

function normalizeEvent(ev: any): EventItem | null {
  if (!ev || typeof ev !== 'object') return null;
  if (typeof ev.id !== 'string' || !ev.id) return null;
  if (typeof ev.title !== 'string' || !ev.title.trim()) return null;
  return {
    id: ev.id,
    title: ev.title.trim(),
    time: typeof ev.time === 'string' ? ev.time : '',
    inferred: ev.inferred === true,
    summary: typeof ev.summary === 'string' ? ev.summary : '',
    people: sanitizePeople(ev.people),
    mainPerson: typeof ev.mainPerson === 'string' ? ev.mainPerson : '',
    evidence: Array.isArray(ev.evidence)
      ? ev.evidence.filter((x): x is string => typeof x === 'string')
      : [],
    emotions: sanitizeEmotions(ev.emotions),
    edited: ev.edited === true,
  };
}

function normalizeReview(r: any): Review | null {
  if (!r || typeof r !== 'object') return null;
  if (typeof r.ts !== 'string' || typeof r.text !== 'string') return null;
  return {
    ts: r.ts,
    text: r.text,
    impressionCount: typeof r.impressionCount === 'number' ? r.impressionCount : 0,
    newSelfView: typeof r.newSelfView === 'string' ? r.newSelfView : '',
    eventReport: typeof r.eventReport === 'string' ? r.eventReport : undefined,
    profileHint: typeof r.profileHint === 'string' ? r.profileHint : undefined,
  };
}

function normalizeChatMsg(m: any): ChatMsg | null {
  if (!m || typeof m !== 'object') return null;
  if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.text !== 'string') return null;
  return { role: m.role, text: m.text, ts: typeof m.ts === 'string' ? m.ts : '' };
}

/** 容错归一（v2）：非法字段回退默认、数组过滤非法条目（不静默改用户数据，只防坏文件） */
export function normalizeData(raw: any): BlackBoxData {
  const def = defaultBlackBoxData();
  if (!raw || typeof raw !== 'object') return def;
  return {
    version: 2,
    settings: normalizeSettings(raw.settings),
    persona: normalizePersona(raw.persona),
    entries: Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry).filter((e): e is Entry => !!e) : [],
    profiles: Array.isArray(raw.profiles)
      ? raw.profiles.map(normalizeProfile).filter((p): p is Profile => !!p)
      : [],
    events: Array.isArray(raw.events) ? raw.events.map(normalizeEvent).filter((e): e is EventItem => !!e) : [],
    reviews: Array.isArray(raw.reviews) ? raw.reviews.map(normalizeReview).filter((r): r is Review => !!r) : [],
    chat: Array.isArray(raw.chat) ? raw.chat.map(normalizeChatMsg).filter((m): m is ChatMsg => !!m) : [],
    meta: {
      lastReviewAt: raw.meta && typeof raw.meta.lastReviewAt === 'string' ? raw.meta.lastReviewAt : '',
      totalEntries: raw.meta && typeof raw.meta.totalEntries === 'number' ? raw.meta.totalEntries : 0,
      totalEvents: raw.meta && typeof raw.meta.totalEvents === 'number' ? raw.meta.totalEvents : 0,
    },
  };
}

export class BlackBoxDataManager {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  /** 读取数据（不存在/坏 JSON → 默认数据；version===1 → 自动迁移 v2；坏 JSON 改名备份 .bak 保留现场） */
  async load(): Promise<BlackBoxData> {
    const filePath = getBlackBoxFilePath();
    const f = this.app.vault.getAbstractFileByPath(filePath);
    if (!f) return defaultBlackBoxData();
    try {
      const raw = JSON.parse(await this.app.vault.read(f as any));
      // v1 → v2 无损迁移（幂等：迁移后 version===2，后续加载不再走此分支）
      const migrated = raw && raw.version === 1 ? migrateV1ToV2(raw) : raw;
      return normalizeData(migrated);
    } catch (e) {
      // 坏文件：改名备份（保留现场）再返回默认；下次 save 不覆盖原文件内容
      try {
        const bak = filePath.replace(/\.json$/, '') + `.bak-${Date.now()}.json`;
        await this.app.vault.rename(f as any, bak);
      } catch (e2) {
        /* 备份失败静默（rename 可能因只读/权限失败） */
      }
      return defaultBlackBoxData();
    }
  }

  /** 保存（存在 modify / 不存在 create，建目录兜底）；保存前同步统计与双源设置 */
  async save(data: BlackBoxData): Promise<void> {
    const filePath = getBlackBoxFilePath();
    const s = tryGetSettings() as any;
    data.meta.totalEntries = data.entries.length;
    data.meta.totalEvents = data.events.length;
    // 双源同步：全局设置存在时数据内 settings 兜底跟随（v1 兼容 + 文件自洽）
    data.settings.reviewThreshold = resolveReviewThreshold(data, s);
    if (s && typeof s.blackboxShowSpeculativeEvents === 'boolean') {
      data.settings.showSpeculativeEvents = s.blackboxShowSpeculativeEvents;
    }
    const c = JSON.stringify(data, null, 2);
    const f = this.app.vault.getAbstractFileByPath(filePath);
    if (f) {
      await this.app.vault.modify(f as any, c);
    } else {
      const d = filePath.substring(0, filePath.lastIndexOf('/'));
      if (d && !this.app.vault.getAbstractFileByPath(d)) {
        await this.app.vault.createFolder(d);
      }
      await this.app.vault.create(filePath, c);
    }
  }

  /** 新增条目（三类均计入复盘阈值）；返回录入后的条目总数与是否应自动触发静默复盘 */
  async addEntry(data: BlackBoxData, entry: Entry): Promise<{ count: number; shouldReview: boolean }> {
    const threshold = resolveReviewThreshold(data, tryGetSettings() as any);
    data.entries.push(entry);
    await this.save(data);
    return { count: data.entries.length, shouldReview: shouldAutoReview(data.entries.length, threshold) };
  }

  /** 追加复盘记录（含新的自我认知，非空则同时生长人格档案） */
  async addReview(data: BlackBoxData, review: Review): Promise<void> {
    data.reviews.push(review);
    if (review.newSelfView) {
      data.persona.selfViews.push({ ts: review.ts, view: review.newSelfView });
    }
    data.meta.lastReviewAt = review.ts;
    await this.save(data);
  }

  /** 追加对话消息（保持最近 blackboxMaxHistory 条） */
  async addChat(data: BlackBoxData, role: 'user' | 'assistant', text: string, ts: string): Promise<void> {
    const s = tryGetSettings() as any;
    const max = Number(s && s.blackboxMaxHistory) || 20;
    data.chat.push({ role, text, ts });
    data.chat = data.chat.slice(-max);
    await this.save(data);
  }

  /** 更新画像（用户编辑印象/关系；AI 从不覆盖 impression，此处仅用户路径） */
  async updateProfile(data: BlackBoxData, profile: Profile): Promise<void> {
    const i = data.profiles.findIndex((p) => p.id === profile.id);
    if (i >= 0) data.profiles[i] = profile;
    await this.save(data);
  }

  /** 确认推测事件（inferred → false，转实线；非推测事件无操作） */
  async confirmEvent(data: BlackBoxData, eventId: string): Promise<void> {
    const ev = data.events.find((e) => e.id === eventId);
    if (ev && ev.inferred) {
      ev.inferred = false;
      await this.save(data);
    }
  }

  /** 删除事件（用户纠正权；删除 = 数据删除，不做忽略持久化清单，遗忘权后置） */
  async deleteEvent(data: BlackBoxData, eventId: string): Promise<void> {
    const before = data.events.length;
    data.events = data.events.filter((e) => e.id !== eventId);
    if (data.events.length !== before) await this.save(data);
  }
}

// ---------------- 构造器 ----------------

/** 构造条目（id 生成 + 时间戳；partial 含 type/必填字段，外壳字段兜底默认） */
export function createEntry(partial: Partial<Entry> & { type: EntryType }): Entry {
  return {
    ...partial,
    id: partial.id || genId('bb'),
    createdAt: partial.createdAt || new Date().toISOString(),
    emotions: sanitizeEmotions(partial.emotions),
    people: sanitizePeople(partial.people),
    scene: partial.scene || '',
    toward: partial.toward || '',
    links: Array.isArray(partial.links) ? partial.links : [],
  };
}

/** 构造画像 */
export function createProfile(partial: Partial<Profile> & { name: string }): Profile {
  return {
    ...partial,
    id: partial.id || genId('pf'),
    relation: partial.relation || '',
    impression: partial.impression || '',
    aiObservations: Array.isArray(partial.aiObservations) ? partial.aiObservations : [],
    pinnedEvents: Array.isArray(partial.pinnedEvents) ? partial.pinnedEvents : [],
    createdAt: partial.createdAt || new Date().toISOString(),
  };
}

/** 构造事件 */
export function createEvent(partial: Partial<EventItem> & { title: string }): EventItem {
  return {
    ...partial,
    id: partial.id || genId('ev'),
    time: partial.time || new Date().toISOString().slice(0, 10),
    inferred: partial.inferred === true,
    summary: partial.summary || '',
    people: sanitizePeople(partial.people),
    mainPerson: partial.mainPerson || '',
    evidence: Array.isArray(partial.evidence) ? partial.evidence : [],
    emotions: sanitizeEmotions(partial.emotions),
    edited: partial.edited === true,
  };
}
