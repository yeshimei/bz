/**
 * 黑匣子数据层（ticket 39 v2 + ticket 01 v3 笔记化）：blackbox.json v3 读写 + 无损迁移链
 * v1 → v2 → v3（v3 = ADR-0015 笔记即事实源：entries 不落盘，落盘派生层 + id→路径索引）。
 * load 时：v1/v2 自动迁移为笔记（幂等，单条失败留在原数据段下次重试）；v3 按索引水合条目，
 * 并扫描 `我的/黑匣子/` 下未索引笔记自愈（崩溃孤儿/用户手建）。内存条目接口保持既有形状不变
 * （主面板/对话/复盘/AI 零改动）；save 只写派生层 + index。
 * 文件不存在/解析失败 → 默认数据（懒创建：save 时建目录建文件）；坏 JSON 先改名备份 .bak 保留现场。
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
import {
  BB_NOTE_ROOT,
  buildNoteContent,
  entryNoteTitle,
  isBlackBoxNotePath,
  noteNameFromPath,
  parseNoteContent,
  parseWikilinks,
  sanitizeFileName,
  typeDir,
  type LinkRef,
} from './notes';

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

/** 笔记名映射（写笔记时 id → `[[名]]`）：概念 = 概念名；文献/想法 = 笔记标题 */
export function buildNameById(entries: Entry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entries || []) {
    if (!e || !e.id) continue;
    const name = noteNameOf(e);
    if (name) map.set(e.id, name);
  }
  return map;
}

/** 条目 → 展示名（概念 = name；文献/想法 = title 或正文前 20 字） */
export function noteNameOf(entry: Entry): string {
  return entry.type === 'concept' ? (entry.name || '').trim() : entryNoteTitle(entry);
}

/** 条目 id → {name, path}（2026-08-12：正文关联双链写完整路径 `[[路径|名]]` 需要 path；path 取自 index） */
export function buildNoteRefs(entries: Entry[], index: Record<string, string>): Map<string, { name: string; path: string }> {
  const map = new Map<string, { name: string; path: string }>();
  for (const e of entries || []) {
    if (!e || !e.id) continue;
    const name = noteNameOf(e);
    const path = index[e.id];
    if (name && path) map.set(e.id, { name, path });
  }
  return map;
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

/** v1 数据整体迁移（幂等：调用方仅当 version===1 时调用；迁移结果再过 normalize 容错） */
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

// ---------------- normalize（容错：非法字段回退默认、数组过滤非法条目） ----------------

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
  if (Array.isArray(e.pendingLinks)) base.pendingLinks = e.pendingLinks.filter((x): x is string => typeof x === 'string' && !!x.trim());
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

/** index 不再持久化（2026-08-12 用户决策）：运行时内存映射，load 全量扫描笔记构建。 */

/** 容错归一（v3）：非法字段回退默认、数组过滤非法条目（不静默改用户数据，只防坏文件）。
 * raw.entries（v2 残留/迁移失败残留）原样归一保留，由 load 决定是否迁移。 */
export function normalizeData(raw: any): BlackBoxData {
  const def = defaultBlackBoxData();
  if (!raw || typeof raw !== 'object') return def;
  return {
    version: 3,
    settings: normalizeSettings(raw.settings),
    persona: normalizePersona(raw.persona),
    entries: Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry).filter((e): e is Entry => !!e) : [],
    // index 不再持久化（2026-08-12 用户决策）：运行时内存映射，load 时全量扫描笔记构建
    index: {},
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

/** 并发 load 互斥：多个 load 并发会竞争水合/孤儿自愈写盘，复用进行中的 promise */
let loadInFlight: Promise<BlackBoxData> | null = null;
/** 水合缓存（笔记即事实源的内存投影）：全量扫描只做一次，后续 load 直接命中；
 *  save 同步缓存；外部改笔记由 vault 事件（sync.ts）触发 invalidateBlackBoxCache 失效。 */
let cachedData: BlackBoxData | null = null;

/** 缓存失效（vault 事件同步触发；插件自身写入会先失效、随后 save 同步恢复，自愈无全扫） */
export function invalidateBlackBoxCache(): void {
  cachedData = null;
}

/** 缓存重置（unload/测试隔离用） */
export function resetBlackBoxCache(): void {
  cachedData = null;
  loadInFlight = null;
}

/** 水合缓存是否已就绪（打开 UI 判断是否显示「正在扫描」提示） */
export function isBlackBoxCacheReady(): boolean {
  return !!cachedData;
}

export class BlackBoxDataManager {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  /** 读取数据（并发安全：进行中的 load 直接复用）
   * 笔记即事实源（ADR-0015）：v2 旧数据不在此自动迁移（用户决策，一次性迁移走 tools/migrate-blackbox-v3.mjs），
   * load 只做：派生层读取 + 索引水合（孤儿自愈）+ 缺失索引清理。 */
  async load(): Promise<BlackBoxData> {
    if (cachedData) return cachedData;
    if (loadInFlight) return loadInFlight;
    loadInFlight = this.doLoad().then((d) => {
      cachedData = d;
      return d;
    });
    try {
      return await loadInFlight;
    } finally {
      loadInFlight = null;
    }
  }

  private async doLoad(): Promise<BlackBoxData> {
    const filePath = getBlackBoxFilePath();
    const f = this.app.vault.getAbstractFileByPath(filePath);
    if (!f) return defaultBlackBoxData();
    let raw: any;
    try {
      raw = JSON.parse(await this.app.vault.read(f as any));
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
    const migrated = raw && raw.version === 1 ? migrateV1ToV2(raw) : raw;
    const data = normalizeData(migrated);
    await this.hydrate(data);
    return data;
  }

  /**
   * 水合：全量扫描 `我的/黑匣子/` 下笔记（frontmatter + 正文关联区）→ 内存条目 + 内存 index（id → 路径）。
   * index 为运行时内存映射，由扫描构建、**不再持久化**（用户 2026-08-12 决策：index 字段冗余——
   * 笔记即事实源，load 每次全扫；笔记删了黑匣子就不显示，无残留索引）。
   * 关联区 `[[名]]` 解析：概念名 → id（related/terms）；解析不到的存入 pendingLinks（待补链）。
   * 解析失败/损坏的笔记跳过（下次 load 重试）。
   */
  private async hydrate(data: BlackBoxData): Promise<void> {
    type Parsed = { entry: Entry; relatedNames: LinkRef[]; termsNames: LinkRef[]; fromName: LinkRef; path: string };
    const parsedList: Parsed[] = [];
    const entries: Entry[] = [];
    const indexAdded: Record<string, string> = {};
    data.index = {};

    // 全量扫描：我的/黑匣子/ 下全部 bb 笔记（含分类子文件夹）→ 解析 → 内存 index
    const indexedIds = new Set<string>();
    for (const f of this.app.vault.getMarkdownFiles() as any[]) {
      if (!isBlackBoxNotePath(f.path)) continue;
      let content = '';
      try {
        content = await this.app.vault.read(f as any);
      } catch (e) {
        continue;
      }
      const p = parseNoteContent(content, f.path);
      if (!p || indexedIds.has(p.entry.id)) continue; // 损坏/重复 id → 跳过
      indexedIds.add(p.entry.id);
      data.index[p.entry.id] = f.path;
      indexAdded[p.entry.id] = f.path;
      parsedList.push({ ...p, path: f.path });
      entries.push(p.entry);
    }
    // 文献/想法标题/概念名已由 parseNoteContent 从 frontmatter 读取（缺省回退文件名）
    // 关联区引用 → id（2026-08-12：正文双链为完整路径 `[[路径|名]]`，先路径精确匹配（同名不歧义）
    // → 名字匹配（旧格式 [[名]] / frontmatter）→ 都未命中 pendingLinks（可读 display））
    const pathToId = new Map<string, string>();
    const conceptNameToIds = new Map<string, string[]>();
    const nameToId = new Map<string, string>();
    for (const p of parsedList) {
      pathToId.set(p.path.replace(/\.md$/, ''), p.entry.id);
      const name = p.entry.type === 'concept' ? (p.entry.name || '').trim() : p.entry.title || '';
      if (!name) continue;
      if (p.entry.type === 'concept') {
        const list = conceptNameToIds.get(name);
        if (list) list.push(p.entry.id);
        else conceptNameToIds.set(name, [p.entry.id]);
      }
      if (!nameToId.has(name)) nameToId.set(name, p.entry.id);
    }
    const resolveIds = (ref: string): string[] => {
      const viaPath = pathToId.get(ref);
      if (viaPath) return [viaPath];
      return conceptNameToIds.get(ref) || [];
    };
    for (const p of parsedList) {
      if (p.entry.type === 'concept') {
        const ids: string[] = [];
        const pending: string[] = [];
        for (const l of p.relatedNames) {
          const all = resolveIds(l.ref).filter((id) => id !== p.entry.id);
          if (all.length) ids.push(...all);
          else if (!pending.includes(l.display)) pending.push(l.display);
        }
        p.entry.related = [...new Set(ids)];
        if (pending.length) p.entry.pendingLinks = pending;
      } else if (p.entry.type === 'literature') {
        const ids: string[] = [];
        const pending: string[] = [];
        for (const l of p.termsNames) {
          const all = resolveIds(l.ref).filter((id) => id !== p.entry.id);
          if (all.length) ids.push(...all);
          else if (!pending.includes(l.display)) pending.push(l.display);
        }
        p.entry.terms = [...new Set(ids)];
        if (pending.length) p.entry.pendingLinks = pending;
      } else if (p.fromName.ref) {
        const viaPath = pathToId.get(p.fromName.ref);
        const id = viaPath || nameToId.get(p.fromName.ref);
        p.entry.from = id && id !== p.entry.id ? id : p.fromName.display;
      }
    }
    data.entries = entries;
    // 笔记增删导致统计过时 → 落盘（无 index 持久化，仅同步派生层统计）
    if (Object.keys(indexAdded).length || data.meta.totalEntries !== entries.length || data.meta.totalEvents !== data.events.length) {
      await this.save(data);
    }
  }

  /** 保存（存在 modify / 不存在 create，建目录兜底）；保存前同步统计与双源设置。
   * v3：entries 与 index 均不落盘（笔记即事实源 + index 为运行时扫描映射），仅写派生层。 */
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
    const payload: any = {
      version: 3,
      settings: data.settings,
      persona: data.persona,
      profiles: data.profiles,
      events: data.events,
      reviews: data.reviews,
      chat: data.chat,
      meta: data.meta,
    };
    const c = JSON.stringify(payload, null, 2);
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
    // 内存缓存与磁盘同步（在 vault 写入之后赋值：插件自身写入触发的失效事件已被本赋值覆盖自愈）
    cachedData = data;
  }

  // ---------------- 笔记写入 ----------------

  /** 文件路径去重（冲突追加 -1/-2…；概念=概念名、文献/想法=标题） */
  private async uniquePath(basePath: string): Promise<string> {
    let path = basePath;
    let n = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = basePath.replace(/\.md$/, `-${n}.md`);
      n += 1;
    }
    return path;
  }

  /** 逐级建目录（Obsidian createFolder 需父级存在；幂等） */
  private async ensureFolder(dir: string): Promise<void> {
    if (this.app.vault.getAbstractFileByPath(dir)) return;
    const parent = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
    if (parent) await this.ensureFolder(parent);
    await this.app.vault.createFolder(dir);
  }

  /** 写单条笔记（建目录兜底 + 去重路径 + 内容组装）；概念有分类 → `我的/黑匣子/概念/<分类>/<名>.md`。返回最终路径。 */
  private async writeNote(entry: Entry, refs: Map<string, { name: string; path: string }>): Promise<string> {
    const catDir =
      entry.type === 'concept' && entry.category && entry.category.trim()
        ? sanitizeFileName(entry.category.trim())
        : '';
    const dir = catDir ? `${BB_NOTE_ROOT}/${typeDir(entry.type)}/${catDir}` : `${BB_NOTE_ROOT}/${typeDir(entry.type)}`;
    await this.ensureFolder(BB_NOTE_ROOT);
    await this.ensureFolder(dir);
    const path = await this.uniquePath(`${dir}/${entryNoteTitle(entry)}.md`);
    const content = buildNoteContent(entry, (id) => refs.get(id));
    await this.app.vault.create(path, content);
    return path;
  }

  /** 重写既有笔记（内容来自内存条目；路径取索引；无笔记/文件缺失静默跳过） */
  async updateEntryNote(data: BlackBoxData, entry: Entry): Promise<void> {
    const path = data.index[entry.id];
    if (!path) return;
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!f) return;
    const refs = buildNoteRefs(data.entries, data.index);
    await this.app.vault.modify(f as any, buildNoteContent(entry, (id) => refs.get(id)));
  }

  /** 新增条目（三类均计入复盘阈值）：写笔记 + 索引 + 派生层落盘。返回录入后的条目总数与是否应自动触发静默复盘 */
  async addEntry(data: BlackBoxData, entry: Entry): Promise<{ count: number; shouldReview: boolean }> {
    const threshold = resolveReviewThreshold(data, tryGetSettings() as any);
    const refs = buildNoteRefs([...data.entries, entry], data.index);
    const path = await this.writeNote(entry, refs);
    data.index[entry.id] = path;
    data.entries.push(entry);
    await this.save(data);
    return { count: data.entries.length, shouldReview: shouldAutoReview(data.entries.length, threshold) };
  }

  /** AI 分类落位（2026-08-12 需求：分类由 AI 自动生成）：移动笔记到 `我的/黑匣子/<类型>/<分类>/<名>.md`
   *   + 内存条目 category + 重写笔记 frontmatter + 更新 index + 持久化。已在目标分类文件夹时仅补 fm。返回是否成功。 */
  async applyCategory(data: BlackBoxData, id: string, category: string): Promise<boolean> {
    const entry = data.entries.find((e) => e.id === id);
    const oldPath = data.index[id];
    if (!entry || !oldPath) return false;
    // 分类目录名：清洗非法字符；空 → 拒绝（不走 sanitizeFileName 的「未命名」兜底）
    const cat = category.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '');
    if (!cat) return false;
    const dir = `${BB_NOTE_ROOT}/${typeDir(entry.type)}/${cat}`;
    await this.ensureFolder(BB_NOTE_ROOT);
    await this.ensureFolder(dir);
    const base = oldPath.slice(oldPath.lastIndexOf('/') + 1);
    const stem = base.replace(/\.md$/, '');
    let target = `${dir}/${base}`;
    if (target !== oldPath) {
      let n = 1;
      while (this.app.vault.getAbstractFileByPath(target)) {
        target = `${dir}/${stem}-${n}.md`;
        n += 1;
      }
      const f = this.app.vault.getAbstractFileByPath(oldPath);
      if (!f) return false;
      await this.app.vault.rename(f as any, target);
    }
    entry.category = cat;
    data.index[id] = target;
    await this.updateEntryNote(data, entry);
    await this.save(data);
    return true;
  }

  /** 摘抄关联概念追加（ticket 50 新概念流转回填）：terms 去重追加 + 重写笔记（frontmatter + 正文关联区）+ 持久化。返回是否发生变更 */
  async appendEntryTerms(data: BlackBoxData, entryId: string, conceptIds: string[]): Promise<boolean> {
    const entry = data.entries.find((e) => e.id === entryId);
    if (!entry || entry.type !== 'literature') return false;
    const terms = entry.terms || [];
    const before = terms.length;
    for (const id of conceptIds) {
      if (id && !terms.includes(id)) terms.push(id);
    }
    entry.terms = terms;
    if (terms.length === before) return false;
    await this.updateEntryNote(data, entry);
    await this.save(data);
    return true;
  }

  /** 文献/想法 AI 标题后台补全（保存即关后生成）：更新 title + 笔记重命名（去重冲突）+ 重写内容 + 持久化。
   *  目标名与现路径一致 → 仅补 frontmatter title（文件名已是该标题）；返回是否成功。概念名即文件名，不走此方法。 */
  async renameEntryNote(data: BlackBoxData, entryId: string, newTitle: string): Promise<boolean> {
    const entry = data.entries.find((e) => e.id === entryId);
    const oldPath = data.index[entryId];
    const title = (newTitle || '').trim();
    if (!entry || !oldPath || !title || entry.type === 'concept') return false;
    const dir = oldPath.slice(0, oldPath.lastIndexOf('/'));
    const base = `${dir}/${sanitizeFileName(title)}.md`;
    entry.title = title;
    if (base === oldPath) {
      // 文件名已是该标题：仅重写 frontmatter（title 字段兜底同步）
      await this.updateEntryNote(data, entry);
      await this.save(data);
      return true;
    }
    // 目标路径冲突去重（-1/-2…；先于 rename 判定，避免同名现路径被误判冲突）
    const target = await this.uniquePath(base);
    const f = this.app.vault.getAbstractFileByPath(oldPath);
    if (!f) return false;
    try {
      await this.app.vault.rename(f as any, target);
    } catch (e) {
      return false; // 重命名失败：本次内存对象即弃，下次 load 由笔记自愈
    }
    data.index[entryId] = target;
    await this.updateEntryNote(data, entry);
    await this.save(data);
    return true;
  }

  /** 批量新增（卡片盒导入）：一次写全部笔记 + 索引 + 单次派生层落盘（不走 addEntry，不触发自动复盘） */
  async addEntries(data: BlackBoxData, entries: Entry[]): Promise<void> {
    if (!entries.length) return;
    const refs = buildNoteRefs(data.entries, data.index);
    for (const entry of entries) {
      const path = await this.writeNote(entry, refs);
      data.index[entry.id] = path;
      data.entries.push(entry);
      refs.set(entry.id, { name: noteNameOf(entry), path });
    }
    await this.save(data);
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

  /** 删除条目（概念/文献/想法通用）：删笔记 + 索引；顺带清理其它条目对该 id 的 related/terms/from 引用并重写对应笔记 */
  async deleteEntry(data: BlackBoxData, entryId: string): Promise<void> {
    const before = data.entries.length;
    const removed = data.entries.find((e) => e.id === entryId);
    data.entries = data.entries.filter((e) => e.id !== entryId);
    if (data.entries.length === before) return;
    if (removed) {
      const path = data.index[entryId];
      if (path) {
        const f = this.app.vault.getAbstractFileByPath(path);
        if (f) {
          try {
            await this.app.vault.delete(f as any);
          } catch (e) {
            /* 删除失败不阻断（孤儿由 hydrate 自愈逻辑跳过） */
          }
        }
        delete data.index[entryId];
      }
    }
    // 引用清理（related/terms/from）+ 对应笔记重写
    const nameById = buildNameById(data.entries);
    for (const e of data.entries) {
      let changed = false;
      if (Array.isArray(e.related) && e.related.includes(entryId)) {
        e.related = e.related.filter((r) => r !== entryId);
        changed = true;
      }
      if (e.type === 'literature' && Array.isArray(e.terms) && e.terms.includes(entryId)) {
        e.terms = e.terms.filter((t) => t !== entryId);
        changed = true;
      }
      if (e.from === entryId) {
        e.from = undefined;
        changed = true;
      }
      if (changed) await this.updateEntryNote(data, e);
    }
    await this.save(data);
  }

  /**
   * 动态双向关联：新概念录入后，让关联的既有概念也反向指向新概念（关联是相互的，动态维护）。
   * relatedIds：新概念关联的既有概念 id（仅对既有概念回填，新概念自身不动）；回填后重写对应笔记。
   */
  async backfillRelated(data: BlackBoxData, newEntryId: string, relatedIds: string[]): Promise<void> {
    let changed = false;
    for (const e of data.entries) {
      if (e.type !== 'concept' || e.id === newEntryId) continue;
      if (relatedIds.includes(e.id) && !(e.related || []).includes(newEntryId)) {
        e.related = [...new Set([...(e.related || []), newEntryId])];
        changed = true;
      }
    }
    if (changed) {
      for (const e of data.entries) {
        if (e.type === 'concept' && e.id !== newEntryId && (e.related || []).includes(newEntryId)) {
          await this.updateEntryNote(data, e);
        }
      }
      await this.save(data);
    }
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

/** 构造事件 */export function createEvent(partial: Partial<EventItem> & { title: string }): EventItem {  return {
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
