/**
 * 游戏库（gameshelf）域详情数据装配。
 *
 * **2026-09-18 起「全量落盘」**（用户拍板：所有数据都进笔记属性，图片图标都进本地文件夹）：
 * - 成就 → `成就` 列表（每行 6 段，格式见 steam.ts::achRowText）+ `成就已解`/`成就总数`/
 *   `稀有成就`/`成就更新`；
 * - 截图 → `截图源`（远端 URL，**同步管辖**）+ `截图`（本地 vault 路径，**媒体队列管辖**）
 *   + `截图更新`，两数组同序同长、下载失败的位置留空串；
 * - 成就图标**不写属性**：本地文件名由 (appid, apiname) 直接推出（见 posters.ts），
 *   写进去纯属冗余。属性里存的是「图在本地文件夹」这件事的**结果**，不是路径清单。
 *
 * 由此详情弹窗**默认零网络**：属性里有的块直接渲染（断网也能看全），只有该块属性缺失
 * 时才拉一次补齐；拉完即写回，下次离线可用。会话缓存退居「同一会话内避免重复拉」的加速层。
 *
 * 图片本体一律在本地文件夹，**属性里不放二进制、也不放 CDN 地址清单**——这条是属性体积的命门：
 * 134 款成就的图标 URL 光地址就要 1.4 MB，而文件名可推导，一分钱都不用花。
 */
import type { App, TFile } from 'obsidian';
import { readDetailFm, upsertDetail } from './notes';
import { ensureAchIcons, ensureShots } from './posters';
import { readSteamConfig } from './sync';
import {
  achRowFromText, achRowText, fetchAchievementDetail, fetchStoreMeta, steamStoreUrl,
  type AchievementDetail, type AchievementRow, type StoreMeta,
} from './steam';
import type { GameItem } from './state';

/** 会话级缓存（应用卸载/面板关闭时清）；只用于「同一会话内别重复拉」，不再是数据来源 */
const storeCache = new Map<number, StoreMeta>();
const achCache = new Map<number, AchievementDetail>();

/** 会话缓存清理（unloadGameshelf 调用） */
export function clearDetailCache(): void {
  storeCache.clear();
  achCache.clear();
}

/** 成就属性的新鲜度窗口：超过则打开详情时后台静默重拉（玩家解锁新成就后属性要跟上） */
export const ACH_STALE_MS = 24 * 60 * 60 * 1000;
/** 商店资料的新鲜度窗口（价格/评价会变；比成就长，改动少） */
export const STORE_STALE_MS = 14 * 24 * 60 * 60 * 1000;

/** 单段加载结果（error 非空 = 该段取不到数据，弹窗按错误文案呈现，不阻塞另一段） */
export interface SectionResult<T> {
  data: T | null;
  error: string | null;
  /** **拉取失败后的兜底**标记（弹窗挂「上次同步缓存」牌子）。注意：属性优先是正式数据源，
   *  走属性路径时这里是 false——这个字段不代表「数据来自属性」 */
  fromCache: boolean;
}

/** 前端展示用的商店段（属性优先；实时拉到则覆盖属性） */
export interface StoreSection {
  meta: Partial<StoreMeta>;
  error: string | null;
  fromCache: boolean;
  /** 截图展示 URL（本地优先、远端兜底；由 posters.ts::resolveShotUrls 解析） */
  screenshots: string[];
}

/** 成就段 */
export interface AchSection {
  detail: AchievementDetail | null;
  /** frontmatter 里已有的摘要（全量列表缺失时也能画进度条） */
  summary: { total: number; unlocked: number; rare: string } | null;
  error: string | null;
  fromCache: boolean;
}

/* ---------- frontmatter 读写（键名 = 展示口径，和 notes.ts 的管辖键同一套中文习惯） ---------- */

const one = (v: unknown): string => String(v ?? '').replace(/\s*\n+\s*/g, ' ').trim();

/** 原样字符串数组（不去空、不 trim 掉位次——`截图`/`截图源` 靠下标对齐，长度与空位都是信息） */
function rawStrList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')) : [];
}

/** YYYY-MM-DD → 本地正午 ISO（±12 小时内任何时区格式化回来都是同一天，避免跨时区掉一天） */
function dateToLocalNoonIso(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** StoreMeta → frontmatter 标量（截图只写远端源；本地路径由媒体队列写，见 posters.ts） */
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
  // 中文名：商店返回的本地化名（l=schinese）。空值不写——别拿空串盖掉已回填的值
  if (s.name && s.name.trim()) out['中文名'] = one(s.name);
  if (s.metacritic !== null) out['Metacritic'] = s.metacritic;
  if (s.reviewsTotal !== null) out['评测数'] = s.reviewsTotal;
  if (s.reviewsPositive !== null) out['好评数'] = s.reviewsPositive;
  if (s.reviewsNegative !== null) out['差评数'] = s.reviewsNegative;
  if (s.recommendations !== null) out['推荐数'] = s.recommendations;
  if (s.achievementsTotal !== null) out['商店成就数'] = s.achievementsTotal;
  if (s.dlcCount !== null && s.dlcCount > 0) out['DLC数'] = s.dlcCount;
  // 截图源：只在拿到截图时写，且**绝不碰 `截图`**（本地路径归媒体队列，同步写回会把本地冲回远端）
  if (s.screenshots.length > 0) {
    out['截图源'] = s.screenshots;
    out['截图更新'] = new Date().toISOString();
  }
  return out;
}

/** frontmatter 标量 → StoreMeta 局部（缺失项不进对象，弹窗自动跳过该行） */
export function fmToStore(fm: Record<string, unknown>): Partial<StoreMeta> {
  const s = (k: string): string | null => (fm[k] === undefined || fm[k] === '' ? null : one(fm[k]));
  const n = (k: string): number | null => (fm[k] === undefined || fm[k] === '' || !Number.isFinite(Number(fm[k])) ? null : Number(fm[k]));
  const out: Partial<StoreMeta> = {
    name: s('中文名'),
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

/** 属性里有没有可展示的商店资料（一条都没有 → 该拉一次） */
export function hasStoreFm(fm: Record<string, unknown>): boolean {
  const m = fmToStore(fm);
  return Object.values(m).some((v) => v !== null && v !== undefined && v !== false);
}

/** 截图两数组（同序同长，缺位补空串；长度取两者较长） */
export function fmToShots(fm: Record<string, unknown>): { local: string[]; remote: string[] } {
  const local = rawStrList(fm['截图']);
  const remote = rawStrList(fm['截图源']);
  const n = Math.max(local.length, remote.length);
  const pad = (a: string[]) => Array.from({ length: n }, (_, i) => a[i] ?? '');
  return { local: pad(local), remote: pad(remote) };
}

/** 成就明细 → frontmatter（全量列表 + 四键；图标不进属性——文件名可推导） */
export function achToFm(d: AchievementDetail): Record<string, unknown> {
  return {
    成就: d.rows.map(achRowText),
    成就已解: d.unlocked,
    成就总数: d.total,
    稀有成就: d.rarestName ? `${d.rarestName}（全球 ${d.rarestPercent}% 拥有）` : '',
    成就更新: new Date().toISOString(),
  };
}

/**
 * frontmatter → 成就明细（全量列表反解；没有 `成就` 列表 → null）。
 * 行序原样保留（写入时已按稀有度升序排过），不再重排——属性里看到的顺序就是界面顺序。
 * `icon`/`iconGray` 留空：本地图路径由 ui 侧按 (appid, apiname) 解析（posters.ts）。
 */
export function fmToAchDetail(fm: Record<string, unknown>): AchievementDetail | null {
  const lines = rawStrList(fm['成就']).filter((l) => l !== '');
  if (lines.length === 0) return null;
  const rows: AchievementRow[] = [];
  for (const line of lines) {
    const r = achRowFromText(line);
    if (!r) continue; // 手改坏的行跳过，不带崩整段渲染
    rows.push({
      apiName: r.apiName,
      name: r.name,
      desc: r.desc,
      // 属性里不存「隐藏」：隐藏成就解锁前 Steam 本就不给描述，界面按「描述为空 + 未解锁」呈现即可
      hidden: false,
      unlocked: r.unlocked,
      unlockedAt: r.date ? dateToLocalNoonIso(r.date) : null,
      globalPercent: r.percent,
      icon: null,
      iconGray: null,
    });
  }
  if (rows.length === 0) return null;
  const unlocked = rows.filter((r) => r.unlocked).length;
  let rarestName: string | null = null;
  let rarestPercent: number | null = null;
  for (const r of rows) {
    // 稀有成就只在**已解锁**里挑（未解锁的 0.1% 成就算不上「我的稀有」）
    if (r.unlocked && r.globalPercent !== null && (rarestPercent === null || r.globalPercent < rarestPercent)) {
      rarestPercent = r.globalPercent;
      rarestName = r.name;
    }
  }
  return {
    total: rows.length,
    unlocked,
    percent: Math.round((unlocked / rows.length) * 1000) / 10,
    rows,
    rarestName,
    rarestPercent,
  };
}

/** frontmatter 成就摘要（优先由全量列表派生；只有三键的旧数据也认） */
export function fmToAchSummary(fm: Record<string, unknown>): { total: number; unlocked: number; rare: string } | null {
  const detail = fmToAchDetail(fm);
  if (detail) return { total: detail.total, unlocked: detail.unlocked, rare: one(fm['稀有成就']) };
  const total = Number(fm['成就总数']);
  if (!Number.isFinite(total) || total <= 0) return null;
  const unlocked = Number.isFinite(Number(fm['成就已解'])) ? Number(fm['成就已解']) : 0;
  return { total, unlocked, rare: one(fm['稀有成就']) };
}

/**
 * 成就属性是否该刷新：没有全量列表 → 该拉；有但 `成就更新` 早于窗口 → 该拉。
 * 只判属性，不看网络（调用方先确认 item.hasAch）。
 */
export function achRefreshDue(fm: Record<string, unknown>, now = Date.now()): boolean {
  if (!fmToAchDetail(fm)) return true;
  const t = Date.parse(String(fm['成就更新'] ?? ''));
  return !Number.isFinite(t) || now - t > ACH_STALE_MS;
}

/** 商店资料是否该刷新（没有标量或 `详情时间` 过老） */
export function storeRefreshDue(fm: Record<string, unknown>, now = Date.now()): boolean {
  if (!hasStoreFm(fm)) return true;
  const t = Date.parse(String(fm['详情时间'] ?? ''));
  return !Number.isFinite(t) || now - t > STORE_STALE_MS;
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

/* ---------- 加载器（属性优先；刷新走 refresh*） ---------- */

/** 属性里的商店段（零网络；截图 URL 由调用方按 app 解析成本地优先的展示地址） */
function storeSectionFromFm(fm: Record<string, unknown>, shots: string[]): StoreSection | null {
  if (!hasStoreFm(fm)) return null;
  // fromCache 留 false：属性是本域的**正式数据源**，不是「拉不到时的兜底」，
  // 弹窗因此不挂「以下为上次同步缓存」的牌子（那个标只在真兜底时出现）
  return { meta: fmToStore(fm), error: null, fromCache: false, screenshots: shots };
}

/** 属性里的成就段（零网络；无全量列表但有摘要 → 也返回，让进度条先出来） */
function achSectionFromFm(fm: Record<string, unknown>): AchSection | null {
  const detail = fmToAchDetail(fm);
  const summary = fmToAchSummary(fm);
  if (!detail && !summary) return null;
  return { detail, summary, error: null, fromCache: false };
}

/**
 * 商店段：会话缓存 → 属性 → 网络。
 * 属性优先是本域「全量落盘」的兑现方式：断网/代理没开时详情依然完整。
 */
export async function loadStore(app: App, item: GameItem, cached: Record<string, unknown>): Promise<StoreSection> {
  const hit = storeCache.get(item.appid);
  if (hit) return { meta: hit, error: null, fromCache: false, screenshots: hit.screenshots };
  const fromFm = storeSectionFromFm(cached, fmToShots(cached).remote);
  if (fromFm) return fromFm;
  return refreshStore(app, item);
}

/**
 * 成就段：会话缓存 → 属性 → 网络。属性里有全量列表时**不发任何请求**。
 * 新鲜度不在这里管（拉长打开时间是坏事）——调用方用 achRefreshDue 决定要不要后台静默刷。
 */
export async function loadAchievements(app: App, item: GameItem, cached: Record<string, unknown>): Promise<AchSection> {
  const hit = achCache.get(item.appid);
  if (hit) return { detail: hit, summary: fmToAchSummary(cached), error: null, fromCache: false };
  const fromFm = achSectionFromFm(cached);
  if (fromFm) return fromFm;
  if (!item.hasAch) return { detail: null, summary: null, error: '这款游戏没有成就页', fromCache: false };
  return refreshAchievements(app, item);
}

/** 强制拉商店资料并写回属性（含截图源）；失败 → 属性兜底 → 原样报错 */
export async function refreshStore(app: App, item: GameItem): Promise<StoreSection> {
  const r = await fetchStoreMeta(item.appid);
  if (r.ok) {
    storeCache.set(item.appid, r.data);
    if (item.file) await upsertDetail(app, item.file, storeToFm(r.data));
    // 截图入本地队列（缺哪张下哪张；下完由媒体队列把 `截图` 数组写回）
    ensureShots(app, {
      appid: item.appid,
      file: item.file,
      remote: r.data.screenshots,
      prevLocal: fmToShots(safeDetailFm(app, item.file)).local,
    });
    return { meta: r.data, error: null, fromCache: false, screenshots: r.data.screenshots };
  }
  const cached = safeDetailFm(app, item.file);
  return storeSectionFromFm(cached, fmToShots(cached).remote) ?? { meta: {}, error: r.message, fromCache: false, screenshots: [] };
}

/** 强制拉成就并写回属性（全量列表）；失败 → 属性兜底 → 原样报错 */
export async function refreshAchievements(app: App, item: GameItem): Promise<AchSection> {
  const cached = safeDetailFm(app, item.file);
  const summary = fmToAchSummary(cached);
  if (!item.hasAch) return { detail: fmToAchDetail(cached), summary, error: '这款游戏没有成就页', fromCache: !!summary };
  const { steamId, apiKey } = readSteamConfig();
  if (!steamId.trim() || !apiKey.trim()) {
    return { detail: fmToAchDetail(cached), summary, error: '未配置 Steam，无法拉取成就', fromCache: !!summary };
  }
  const r = await fetchAchievementDetail(steamId, apiKey, item.appid);
  if (r.ok) {
    achCache.set(item.appid, r.data);
    if (item.file) await upsertDetail(app, item.file, achToFm(r.data));
    // 成就图标入本地队列（两色都下；状态翻转时零下载）。图标不写属性，故不入 frontmatter
    ensureAchIcons(app, item.appid, r.data.rows.map((row) => ({ apiName: row.apiName, on: row.icon, off: row.iconGray })));
    return { detail: r.data, summary, error: null, fromCache: false };
  }
  return { detail: fmToAchDetail(cached), summary, error: r.message, fromCache: !!summary };
}

/** 商店页地址（弹窗「在商店打开」） */
export function storeUrlOf(appid: number): string {
  return steamStoreUrl(appid);
}
