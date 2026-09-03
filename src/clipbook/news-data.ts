/**
 * 聚合讯数据层（ticket 124，ADR-0060；自旧 news 域迁入 clipbook，ADR-0085）：news.json
 * 四段对象结构 { articles, stats, bilibiliUps, sources } 的读/写/迁移，UP 主名单 uid 解析，
 * 保留策略清理（未读不处理 / 已保存 N 天 / 已跳过 M 天）。
 * 纯数据层（无 DOM、无事件），node 环境可测。
 */
import { TFile } from 'obsidian';
import { getApp } from '../core/app';
import { jsonFileStore, storageFile } from '../core/storage';

export const NEWS_JSON_PATH = 'CONFIG/STORAGE/news.json';
export const STATS_JSON_PATH = 'CONFIG/STORAGE/news-stats.json';

/** 聚合讯数据文件路径（统一数据读写层：跟随 storagePath；默认值下与 NEWS_JSON_PATH 一致） */
export function getNewsFilePath(): string {
  return storageFile('news.json');
}

export const DEFAULT_SOURCES = { zhihu: true, guokr: true, bilibili: true };
export const DEFAULT_STATS = () => ({ totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {} as Record<string, number>, byDate: {} as Record<string, number> });

export interface NewsSources {
  zhihu: boolean;
  guokr: boolean;
  bilibili: boolean;
}

/** UP 主资料（ticket 126：后台抓到消息后回填名字/头像；缺失时 UI 回退显示 uid） */
export interface BilibiliUpInfo {
  name?: string;
  avatar?: string;
}

/** 四段对象结构（ADR-0060）；articles 为原纯数组内容，stats 由 news-stats.json 并入。
 *  bilibiliUpInfo 为第五段（可选，ticket 126 新增）：uid → {name?, avatar?}，后台回填、插件只读展示；
 *  bilibiliMaxItems/bilibiliCookie 为第六段（可选，ticket 127 新增）：每 UP 最近 N 条 + 用户配置的 B 站 Cookie */
export interface NewsData {
  articles: any[];
  stats: { totalRead: number; totalSaved: number; totalSkipped: number; byPlatform: Record<string, number>; byDate: Record<string, number> };
  bilibiliUps: string[];
  bilibiliUpInfo: Record<string, BilibiliUpInfo>;
  bilibiliMaxItems: number;
  bilibiliCookie: string;
  sources: NewsSources;
}

/** 读取失败 / 文件缺失的区分（首用引导 vs 错误态沿用 reader 语义） */
export interface ReadNewsResult {
  ok: boolean;
  missing: boolean;
  data: NewsData;
}

function emptyData(): NewsData {
  return { articles: [], stats: DEFAULT_STATS(), bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: { ...DEFAULT_SOURCES } };
}

/** 纯函数：bilibiliUpInfo 段容错解析（uid → {name?, avatar?}；非对象/数组/空 → {}；头像统一转 https） */
export function parseBilibiliUpInfo(raw: unknown): Record<string, BilibiliUpInfo> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, BilibiliUpInfo> = {};
  for (const [uid, v] of Object.entries(raw as Record<string, any>)) {
    if (!v || typeof v !== 'object') continue;
    const info: BilibiliUpInfo = {};
    if (v.name) info.name = String(v.name);
    if (v.avatar) info.avatar = String(v.avatar).replace(/^http:/, 'https:');
    out[uid] = info;
  }
  return out;
}

/** 纯函数：B 站每 UP 抓取条数容错解析（默认 10，夹取 1..50；非法回退 10） */
export function parseBilibiliMaxItems(raw: unknown): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : 10;
}

/** 纯函数：B 站 Cookie 容错解析（字符串去空白；非字符串 → 空串） */
export function parseBilibiliCookie(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

/** 纯函数：旧纯数组 → 四段包裹（articles 原样，stats 默认，名单空，源全开） */
export function wrapArrayToNewsData(articles: any[]): NewsData {
  const data = emptyData();
  data.articles = Array.isArray(articles) ? articles : [];
  return data;
}

/** 纯函数：并入旧 stats（news-stats.json 内容）→ 四段的 stats 段；非对象/损坏忽略。
 *  仅当 stats 段确无真实数据（全零且无分布）时才并入，防止反复覆盖插件新统计。 */
export function mergeStatsInto(data: NewsData, oldStats: any): NewsData {
  if (statsHasData(data.stats)) return data; // 已有真实统计不覆盖
  const s = oldStats && typeof oldStats === 'object' ? oldStats : null;
  if (!s) return data;
  return {
    ...data,
    stats: {
      totalRead: Number(s.totalRead) || 0,
      totalSaved: Number(s.totalSaved) || 0,
      totalSkipped: Number(s.totalSkipped) || 0,
      byPlatform: s.byPlatform && typeof s.byPlatform === 'object' ? s.byPlatform : {},
      byDate: s.byDate && typeof s.byDate === 'object' ? s.byDate : {},
    },
  };
}

/** stats 段是否已有真实数据（任一计数非 0 或任一分布非空） */
export function statsHasData(stats: NewsData['stats']): boolean {
  if (!stats || typeof stats !== 'object') return false;
  return (Number(stats.totalRead) || 0) > 0
    || (Number(stats.totalSaved) || 0) > 0
    || (Number(stats.totalSkipped) || 0) > 0
    || (stats.byPlatform && Object.keys(stats.byPlatform).length > 0) === true
    || (stats.byDate && Object.keys(stats.byDate).length > 0) === true;
}

/** 解析 news.json 文件内容 → 四段（兼容旧纯数组）；返回 null = 内容错误（reader 走错误态） */
export function parseNewsFileContent(raw: string): NewsData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) return wrapArrayToNewsData(parsed);
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, any>;
    return {
      articles: Array.isArray(obj.articles) ? obj.articles : [],
      stats: obj.stats && typeof obj.stats === 'object' ? obj.stats : DEFAULT_STATS(),
      bilibiliUps: Array.isArray(obj.bilibiliUps) ? obj.bilibiliUps.map((u: any) => String(u ?? '').trim()).filter(Boolean) : [],
      bilibiliUpInfo: parseBilibiliUpInfo(obj.bilibiliUpInfo),
      bilibiliMaxItems: parseBilibiliMaxItems(obj.bilibiliMaxItems),
      bilibiliCookie: parseBilibiliCookie(obj.bilibiliCookie),
      sources: obj.sources && typeof obj.sources === 'object'
        ? { ...DEFAULT_SOURCES, ...(obj.sources as Record<string, boolean>) }
        : { ...DEFAULT_SOURCES },
    };
  }
  return null;
}

/** 读 news.json → 四段（含旧数组自动包裹迁移）；采用磁盘为基底，双写者各自保留非本域段。
 *  统一数据读写层：缺失 → 建空数据文件但 missing:true（首用引导）；
 *  损坏 → 不清盘（保持原文件原样——崩溃半截 JSON 保护既有设计），返回错误态 */
export async function readNewsData(): Promise<ReadNewsResult> {
  const missing = !getApp().vault.getAbstractFileByPath(getNewsFilePath());
  let corrupt = false;
  const parsed = await jsonFileStore<any>(getNewsFilePath(), {
    defaultValue: () => emptyData(),
    onCorrupt: () => {
      corrupt = true;
      return false;
    },
  }).read().catch(() => null);
  if (parsed === null || corrupt) return { ok: false, missing: false, data: emptyData() };
  // 走 parseNewsFileContent 做各段归一（parseBilibiliUpInfo 统一 https、parseBilibiliMaxItems 夹取 1-50 等）。
  // stringify 再 parse 会丢 articles 里 body:undefined 的键——但 body 本就是 delete 后的预期状态，无碍。
  const content = parseNewsFileContent(JSON.stringify(parsed));
  if (!content) return { ok: false, missing: false, data: emptyData() };
  return { ok: true, missing, data: content };
}

/** 写回 news.json 四段（整段覆盖；调用方负责先读盘保留非本域段；静默吞错保持现状） */
export async function writeNewsData(data: NewsData): Promise<void> {
  try {
    await jsonFileStore<NewsData>(getNewsFilePath()).write(data);
  } catch (e) { /* 静默 */ }
}

/**
 * UP 主 uid 解析（纯函数，本地规则部分；网络回填见 resolveUidFromInput）：
 * - 纯数字 uid（"546195"）→ 原样
 * - space.bilibili.com/<uid>（可带 https:// 与尾斜杠/参数）→ uid
 * - /video/BVxxx → 仅视频链接本地无法取 uid，返回 null（由调用方走 view API 回填）
 */
export function parseUidFromText(text: string): string | null {
  const t = String(text || '').trim();
  if (!t) return null;
  const pure = t.match(/^\d{1,10}$/);
  if (pure) return pure[0];
  const space = t.match(/space\.bilibili\.com[\/:]*(\d+)/i);
  if (space) return space[1];
  return null;
}

/** bvid 提取（视频链接）：返回 bvid 或 null */
export function parseBvidFromText(text: string): string | null {
  const t = String(text || '').trim();
  const m = t.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i);
  return m ? m[1] : null;
}

/**
 * 输入（主页链接 / 视频链接 / 纯 UID）→ uid。视频链接需经 B 站 view API 回填 uid，
 * 未登录可读；失败/异常返回 null（调用方提示用主页链接/UID）。
 */
export async function resolveUidFromInput(text: string): Promise<string | null> {
  const local = parseUidFromText(text);
  if (local) return local;
  const bvid = parseBvidFromText(text);
  if (!bvid) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      method: 'GET',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const json = await resp.json();
    const mid = json && json.data && json.data.owner ? String(json.data.owner.mid ?? '') : '';
    return mid || null;
  } catch {
    return null;
  }
}

/** 迁移：读旧 news-stats.json（若存在）并入 stats 段；返回迁移后的四段（无旧文件/已有统计 → 原样返回） */
export async function migrateLegacyStats(data: NewsData): Promise<NewsData> {
  // stats 段已有真实数据则不动（避免反复覆盖）
  if (statsHasData(data.stats)) return data;
  const app = getApp();
  const af = app.vault.getAbstractFileByPath(STATS_JSON_PATH);
  if (!af) return data;
  try {
    const raw = await app.vault.read(af as TFile);
    const old = JSON.parse(raw);
    const merged = mergeStatsInto(data, old);
    return merged === data ? data : merged;
  } catch {
    return data;
  }
}

/**
 * 保留策略清理（纯函数，插件侧；savedDays=已保存骨架天数，skippedDays=已跳过骨架天数）：
 * - read 非 true → 永不处理（未读保留）
 * - state==='saved'（正文已清空）按 fetchedAt ?? date 超 savedDays 天删除
 * - state==='skipped' 或旧数据无 state（保守按已跳过档）按 fetchedAt ?? date 超 skippedDays 天删除
 * - 起算时间解析失败（NaN）→ 保守保留
 */
export function applyRetention(articles: any[], savedDays: number, skippedDays: number, now: number = Date.now()): any[] {
  const DAY = 24 * 60 * 60 * 1000;
  const kept: any[] = [];
  for (const a of articles) {
    if (!a || a.read !== true) { kept.push(a); continue; }
    const state = a.state === 'saved' ? 'saved' : 'skipped';
    const days = state === 'saved' ? savedDays : skippedDays;
    if (!Number.isFinite(days) || days <= 0) { kept.push(a); continue; }
    const t = new Date(a.fetchedAt || a.date || '').getTime();
    if (!Number.isFinite(t)) { kept.push(a); continue; }
    if (now - t > days * DAY) continue; // 超龄删
    kept.push(a);
  }
  return kept;
}

/** 归一化保留天数设置（数字输入容错：非法/负数 → 返回 null，调用方用默认） */
export function normalizeRetentionDays(v: string): number | null {
  const n = Number(String(v || '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}