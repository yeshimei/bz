/**
 * 游戏架（gameshelf）域详情数据装配（2026-09-17 全量化）：
 * 点开卡片才拉 —— 商店元数据（appdetails + appreviews）与成就明细（Schema × Player × 全局解锁率）。
 *
 * 缓存两级（口径与取舍写在这里，别再各写一套）：
 * - **frontmatter 标量回写**（持久）：商店元数据的展示标量与成就三键。价值 = 断网/代理没开时
 *   详情弹窗仍能显示上次看到的资料，而不是一片空白；
 * - **会话内存缓存**（不落盘）：截图 URL 列表与成就逐条明细。这两项体积不可控
 *   （截图 8 张、成就可上百条），塞进 frontmatter 会让笔记头部膨胀十倍，故只活在本次会话里，
 *   重开面板即重拉。取舍理由：详情是「看一眼」的场景，不是要长期归档的数据。
 */
import type { App, TFile } from 'obsidian';
import { readDetailFm, upsertDetail } from './notes';
import { readSteamConfig } from './sync';
import { fetchAchievementDetail, fetchStoreMeta, steamStoreUrl, type AchievementDetail, type StoreMeta } from './steam';
import type { GameItem } from './state';

/** 会话级缓存（应用卸载/面板关闭时清） */
const storeCache = new Map<number, StoreMeta>();
const achCache = new Map<number, AchievementDetail>();

/** 会话缓存清理（unloadGameshelf 调用） */
export function clearDetailCache(): void {
  storeCache.clear();
  achCache.clear();
}

/** 单段加载结果（error 非空 = 该段取不到数据，弹窗按错误文案呈现，不阻塞另一段） */
export interface SectionResult<T> {
  data: T | null;
  error: string | null;
  /** 数据来自 frontmatter 缓存（拉取失败时的兜底），弹窗加「缓存」标记 */
  fromCache: boolean;
}

/** 前端展示用的商店段（合并新鲜拉取与缓存兜底） */
export interface StoreSection {
  meta: Partial<StoreMeta>;
  error: string | null;
  fromCache: boolean;
  /** 会话内拉到的截图（缓存兜底时为空） */
  screenshots: string[];
}

/** 成就段 */
export interface AchSection {
  detail: AchievementDetail | null;
  /** frontmatter 里已有的摘要（拉取失败也能显示进度条） */
  summary: { total: number; unlocked: number; rare: string } | null;
  error: string | null;
  fromCache: boolean;
}

/* ---------- frontmatter 读写（键名 = 展示口径，和 notes.ts 的管辖键同一套中文习惯） ---------- */

const one = (v: unknown): string => String(v ?? '').replace(/\s*\n+\s*/g, ' ').trim();

/** StoreMeta → frontmatter 标量（截图/成就明细不落盘——见文件头取舍） */
export function storeToFm(s: StoreMeta): Record<string, unknown> {
  const out: Record<string, unknown> = {
    类型: one(s.genres),
    开发商: one(s.developers),
    发行商: one(s.publishers),
    发行日期: one(s.releaseDate),
    价格: one(s.price),
    平台: one(s.platforms),
    玩法分类: one(s.categories),
    好评率: one(s.reviewDesc),
    简体中文支持: s.zhSupported,
    简介: one(s.shortDescription),
    官网: one(s.website),
    详情时间: new Date().toISOString(),
  };
  if (s.metacritic !== null) out['Metacritic'] = s.metacritic;
  if (s.reviewsTotal !== null) out['评测数'] = s.reviewsTotal;
  if (s.reviewsPositive !== null) out['好评数'] = s.reviewsPositive;
  if (s.reviewsNegative !== null) out['差评数'] = s.reviewsNegative;
  if (s.recommendations !== null) out['推荐数'] = s.recommendations;
  if (s.achievementsTotal !== null) out['商店成就数'] = s.achievementsTotal;
  if (s.dlcCount !== null && s.dlcCount > 0) out['DLC数'] = s.dlcCount;
  return out;
}

/** frontmatter 标量 → StoreMeta 局部（缓存兜底展示；缺失项不进对象，弹窗自动跳过该行） */
export function fmToStore(fm: Record<string, unknown>): Partial<StoreMeta> {
  const s = (k: string): string | null => (fm[k] === undefined || fm[k] === '' ? null : one(fm[k]));
  const n = (k: string): number | null => (fm[k] === undefined || fm[k] === '' || !Number.isFinite(Number(fm[k])) ? null : Number(fm[k]));
  const out: Partial<StoreMeta> = {
    genres: s('类型'),
    developers: s('开发商'),
    publishers: s('发行商'),
    releaseDate: s('发行日期'),
    price: s('价格'),
    platforms: s('平台'),
    categories: s('玩法分类'),
    reviewDesc: s('好评率'),
    shortDescription: s('简介'),
    website: s('官网'),
    metacritic: n('Metacritic'),
    reviewsTotal: n('评测数'),
    reviewsPositive: n('好评数'),
    reviewsNegative: n('差评数'),
    recommendations: n('推荐数'),
    achievementsTotal: n('商店成就数'),
    dlcCount: n('DLC数'),
  };
  if (fm['简体中文支持'] !== undefined) out.zhSupported = fm['简体中文支持'] === true;
  return out;
}

/** frontmatter 成就摘要（三键；缺失 → null） */
export function fmToAchSummary(fm: Record<string, unknown>): { total: number; unlocked: number; rare: string } | null {
  const total = Number(fm['成就总数']);
  if (!Number.isFinite(total) || total <= 0) return null;
  const unlocked = Number.isFinite(Number(fm['成就已解'])) ? Number(fm['成就已解']) : 0;
  return { total, unlocked, rare: one(fm['稀有成就']) };
}

/** 安全读 frontmatter（文件已被外部删除/缓存未就绪 → 空对象，不抛） */
export function safeDetailFm(app: App, file: TFile | null): Record<string, unknown> {
  if (!file) return {};
  try {
    return readDetailFm(app, file) ?? {};
  } catch {
    return {};
  }
}

/* ---------- 加载器 ---------- */

/**
 * 商店段：会话缓存命中直接回；未命中拉一次 appdetails + appreviews 并写回标量。
 * 拉取失败 → 回落到 frontmatter 缓存（有则 fromCache=true，无则 error 原样抛出）。
 */
export async function loadStore(app: App, item: GameItem, cached: Record<string, unknown>): Promise<StoreSection> {
  const hit = storeCache.get(item.appid);
  if (hit) return { meta: hit, error: null, fromCache: false, screenshots: hit.screenshots };
  const r = await fetchStoreMeta(item.appid);
  if (r.ok) {
    storeCache.set(item.appid, r.data);
    if (item.file) await upsertDetail(app, item.file, storeToFm(r.data));
    return { meta: r.data, error: null, fromCache: false, screenshots: r.data.screenshots };
  }
  const cachedMeta = fmToStore(cached);
  const hasCache = Object.keys(cachedMeta).some((k) => (cachedMeta as Record<string, unknown>)[k] !== null && (cachedMeta as Record<string, unknown>)[k] !== undefined);
  if (hasCache) return { meta: cachedMeta, error: null, fromCache: true, screenshots: [] };
  return { meta: {}, error: r.message, fromCache: false, screenshots: [] };
}

/**
 * 成就段：会话缓存命中直接回；未命中拉三接口（无成就页的游戏直接跳过，省三次请求）。
 * 拉取失败 → 仍有 frontmatter 摘要可显示进度条（error 照实呈现，不让用户以为「没有成就」）。
 */
export async function loadAchievements(app: App, item: GameItem, cached: Record<string, unknown>): Promise<AchSection> {
  const summary = fmToAchSummary(cached);
  const hit = achCache.get(item.appid);
  if (hit) return { detail: hit, summary, error: null, fromCache: false };
  if (!item.hasAch) return { detail: null, summary, error: '这款游戏没有成就页', fromCache: false };
  const { steamId, apiKey } = readSteamConfig();
  if (!steamId.trim() || !apiKey.trim()) {
    return { detail: null, summary, error: '未配置 Steam，无法拉取成就', fromCache: false };
  }
  const r = await fetchAchievementDetail(steamId, apiKey, item.appid);
  if (r.ok) {
    achCache.set(item.appid, r.data);
    if (item.file) {
      await upsertDetail(app, item.file, {
        成就已解: r.data.unlocked,
        成就总数: r.data.total,
        稀有成就: r.data.rarestName ? `${r.data.rarestName}（全球 ${r.data.rarestPercent}% 拥有）` : '',
      });
    }
    return { detail: r.data, summary, error: null, fromCache: false };
  }
  return { detail: null, summary, error: r.message, fromCache: !!summary };
}

/** 商店页地址（弹窗「在商店打开」） */
export function storeUrlOf(appid: number): string {
  return steamStoreUrl(appid);
}
