/**
 * 黑匣子数据层（ticket 58，schema v4 日记智能分析层）：blackbox.json v4 读写 + 内存缓存。
 * v4 = 派生层（profiles/mentions/events/reviews/chat/cursor/settings），日记是唯一事实源。
 * 无迁移链（v3 存量已删）：version !== 4 → 空库初始化；坏 JSON 先改名备份 .bak 保留现场。
 * load 内存缓存（cachedData）：首次 load 读盘后缓存，后续 load 直接命中；save 末尾同步缓存。
 */
import type { App } from 'obsidian';
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';
import type { BlackBoxData, Cursor, DiarySourceRef, EventItem, Profile } from './types';
import {
  classifyEventConfidence,
  defaultBlackBoxData,
  sanitizeEmotions,
  sanitizeMentions,
  sanitizePeople,
  sanitizeWords,
} from './types';

/** 黑匣子数据文件路径（storagePath 优先，未注入回退默认；尾斜杠清理与全仓一致） */
export function getBlackBoxFilePath(): string {
  const s = tryGetSettings() as any;
  const dir = ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/blackbox.json`;
}

/** 域内 id 生成（spec 约定：pf_<ts>_<rand> / ev_<ts>_<rand> / rv_<ts>_<rand>） */
export function genId(prefix: 'pf' | 'ev' | 'rv'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建人物画像（构造器：id/createdAt/humanEdited 初值） */
export function createProfile(name: string, firstSeenDate: string): Profile {
  return {
    id: genId('pf'),
    name,
    aliases: [],
    impression: '',
    aiObservations: [],
    emotions: [],
    mentionCount: 0,
    firstSeen: firstSeenDate,
    lastSeen: firstSeenDate,
    humanEdited: false,
    createdAt: new Date().toISOString(),
  };
}

/** 创建事件（构造器：置信度分级 → status） */
export function createEvent(title: string, dateIso: string, confidence: number, source: DiarySourceRef): EventItem {
  const status = classifyEventConfidence(confidence);
  return {
    id: genId('ev'),
    title,
    date: dateIso,
    datePrecision: 'time',
    people: [],
    emotions: [],
    source,
    confidence,
    status: status === 'discard' ? 'speculative' : status,
    humanEdited: false,
  };
}

// ---------------- 数据清洗（v4 容错） ----------------

function sanitizeProfile(raw: any): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    id: raw.id,
    name: raw.name.trim(),
    aliases: Array.isArray(raw.aliases) ? raw.aliases.filter((a: any) => typeof a === 'string' && a.trim()) : [],
    impression: typeof raw.impression === 'string' ? raw.impression : '',
    aiObservations: Array.isArray(raw.aiObservations)
      ? raw.aiObservations
          .filter((o: any) => o && typeof o.text === 'string')
          .slice(0, 5)
          .map((o: any) => ({
            ts: typeof o.ts === 'string' ? o.ts : '',
            text: o.text,
            source: sanitizeSource(o.source),
          }))
      : [],
    emotions: Array.isArray(raw.emotions)
      ? raw.emotions
          .filter((e: any) => e && typeof e.tag === 'string' && typeof e.count === 'number')
          .slice(0, 24)
          .map((e: any) => ({ tag: e.tag, count: Math.max(0, Math.floor(e.count)) }))
      : [],
    mentionCount: typeof raw.mentionCount === 'number' ? Math.max(0, Math.floor(raw.mentionCount)) : 0,
    firstSeen: typeof raw.firstSeen === 'string' ? raw.firstSeen : '',
    lastSeen: typeof raw.lastSeen === 'string' ? raw.lastSeen : '',
    humanEdited: raw.humanEdited === true,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
  };
}

function sanitizeSource(raw: any): DiarySourceRef {
  return {
    path: raw && typeof raw.path === 'string' ? raw.path : '',
    lineNumber: raw && typeof raw.lineNumber === 'number' ? raw.lineNumber : 0,
    time: raw && typeof raw.time === 'string' ? raw.time : '',
  };
}

function sanitizeEvent(raw: any): EventItem | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string' || !raw.title.trim()) return null;
  const status = raw.status === 'speculative' ? 'speculative' : 'confirmed';
  return {
    id: raw.id,
    title: raw.title.trim(),
    date: typeof raw.date === 'string' ? raw.date : '',
    datePrecision: raw.datePrecision === 'day' ? 'day' : 'time',
    people: sanitizePeople(raw.people),
    emotions: sanitizeEmotions(raw.emotions),
    source: sanitizeSource(raw.source),
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
    status,
    humanEdited: raw.humanEdited === true,
  };
}

function sanitizeReview(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string') return null;
  const r = raw.report || {};
  return {
    id: raw.id,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    period: {
      from: raw.period && typeof raw.period.from === 'string' ? raw.period.from : '',
      to: raw.period && typeof raw.period.to === 'string' ? raw.period.to : '',
    },
    report: {
      profileUpdates: Array.isArray(r.profileUpdates) ? r.profileUpdates.filter((x: any) => typeof x === 'string') : [],
      eventSummary: Array.isArray(r.eventSummary) ? r.eventSummary.filter((x: any) => typeof x === 'string') : [],
      emotionTrend: typeof r.emotionTrend === 'string' ? r.emotionTrend : '',
      reflections: Array.isArray(r.reflections) ? r.reflections.filter((x: any) => typeof x === 'string') : [],
    },
    newPeople: Array.isArray(raw.newPeople) ? raw.newPeople.filter((x: any) => typeof x === 'string') : [],
  };
}

function sanitizeChat(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.role !== 'user' && raw.role !== 'assistant') return null;
  if (typeof raw.content !== 'string') return null;
  return { role: raw.role, content: raw.content, ts: typeof raw.ts === 'string' ? raw.ts : '' };
}

function sanitizeCursor(raw: any): Cursor | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.file !== 'string' || !raw.file) return null;
  const idx = typeof raw.entryIndex === 'number' && raw.entryIndex >= 0 ? Math.floor(raw.entryIndex) : 0;
  return { file: raw.file, entryIndex: idx };
}

/** 全量清洗（load 容错：非法项丢弃，不抛错） */
export function normalizeData(raw: any): BlackBoxData {
  const def = defaultBlackBoxData();
  if (!raw || typeof raw !== 'object') return def;
  return {
    version: 4,
    settings: {
      showSpeculativeEvents:
        raw.settings && typeof raw.settings.showSpeculativeEvents === 'boolean'
          ? raw.settings.showSpeculativeEvents
          : def.settings.showSpeculativeEvents,
      words: sanitizeWords(raw.settings && raw.settings.words, 100).length
        ? sanitizeWords(raw.settings && raw.settings.words, 100)
        : def.settings.words,
    },
    profiles: (Array.isArray(raw.profiles) ? raw.profiles : []).map(sanitizeProfile).filter((p): p is Profile => !!p),
    mentions: sanitizeMentions(raw.mentions),
    events: (Array.isArray(raw.events) ? raw.events : []).map(sanitizeEvent).filter((e): e is EventItem => !!e),
    entryEmotions: (Array.isArray(raw.entryEmotions) ? raw.entryEmotions : [])
      .filter((e: any) => e && typeof e.date === 'string' && typeof e.time === 'string')
      .map((e: any) => ({ date: e.date, time: e.time, tags: sanitizeEmotions(e.tags) })),
    reviews: (Array.isArray(raw.reviews) ? raw.reviews : []).map(sanitizeReview).filter(Boolean),
    chat: (Array.isArray(raw.chat) ? raw.chat : []).map(sanitizeChat).filter(Boolean),
    cursor: sanitizeCursor(raw.cursor),
    processedKeys: Array.isArray(raw.processedKeys)
      ? raw.processedKeys.filter((k: any) => typeof k === 'string' && k.length > 0).slice(0, 20000)
      : [],
  };
}

// ---------------- 数据管理器（load/save + 内存缓存） ----------------

export class BlackBoxDataManager {
  private cachedData: BlackBoxData | null = null;

  /** 读取派生层数据（缓存命中直接返回；未缓存读盘 + 水合） */
  async load(): Promise<BlackBoxData> {
    if (this.cachedData) return this.cachedData;
    const app = getApp();
    const path = getBlackBoxFilePath();
    let raw: any = null;
    try {
      const exists = await app.vault.adapter.exists(path);
      if (exists) {
        const text = await app.vault.adapter.read(path);
        if (text && text.trim()) {
          raw = JSON.parse(text);
        }
      }
    } catch (e) {
      // 坏 JSON：备份现场后空库初始化
      try {
        const bak = `${path}.bak`;
        const exists = await app.vault.adapter.exists(path);
        if (exists) {
          const text = await app.vault.adapter.read(path);
          await app.vault.adapter.write(bak, text);
        }
      } catch {}
      raw = null;
    }
    // 版本不符（含 v3 残留）→ 空库初始化（无迁移链）
    if (raw && raw.version === 4) {
      this.cachedData = normalizeData(raw);
    } else {
      this.cachedData = defaultBlackBoxData();
    }
    return this.cachedData;
  }

  /** 写回派生层（v4 落盘 + 同步缓存） */
  async save(data: BlackBoxData): Promise<void> {
    const app = getApp();
    const path = getBlackBoxFilePath();
    const payload: any = {
      version: 4,
      settings: data.settings,
      profiles: data.profiles,
      mentions: data.mentions,
      events: data.events,
      entryEmotions: data.entryEmotions,
      reviews: data.reviews,
      chat: data.chat,
      cursor: data.cursor,
      processedKeys: data.processedKeys || [],
    };
    await app.vault.adapter.write(path, JSON.stringify(payload, null, 2));
    this.cachedData = data;
  }

  /** 失效缓存（外部编辑/移动/删除后强制重扫） */
  invalidate(): void {
    this.cachedData = null;
  }
}

/** 测试用：重置缓存（setup.ts 全局 beforeEach 调用，防跨测试泄漏） */
export function resetBlackBoxCache(): void {
  // 单例缓存已在实例内；测试新建实例即隔离。保留导出兼容旧调用点。
}
