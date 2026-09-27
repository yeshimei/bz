/* ============================================================
 * bz · RSS 源库（core/rss-catalog.ts，单源）——issue 495 / ADR-0208
 *
 * 黄页模型：源库只是一份**可下载的目录资产**（社区维护的中文源清单出版物），
 * 「订阅」= 把条目拷贝进 news.json rssFeeds（ADR-0121），与本模块无关——
 * 本模块只做**资产层**：下载 / 校验 / 查询纯函数，不碰订阅、不碰 UI。
 *
 * 资产链路与 ADR-0204 归物分类表同范本：发布在仓库 `downloads/rss-catalog.json`，
 * 作为一条 doc 条目登记统一清单（`rss-catalog`，build-manifest.mjs DOCS 表），
 * 下载 / 落盘 / sha256 校验复用 `remote-asset.ts`，「有没有更新」交给清单 docStatus，
 * 本层不自出私有清单。
 *
 * 产物形状（scripts/rss-catalog/build.mjs 产出）：
 *   { version, updatedAt, meta: { sources[{id,name,url,license}] },
 *     categories[], feeds[{url, title, site, tags[], cats[], via?}] }
 * `via` 为 RSSHub 路由型源预留（本期恒缺省，ADR-0208 决策 3）。
 * ============================================================ */
import { ensureAssetWithHash, readAsset } from './remote-asset';
import { cachedManifest, refreshManifest } from './download-manifest';

/** 数据本体文件名（相对 `downloads/`；本地落盘为插件目录内同路径） */
export const RSS_CATALOG_FILE = 'rss-catalog.json';
/** 本资源在统一清单里的条目 id（与 scripts/build-manifest.mjs 的 DOCS 表一致） */
export const RSS_CATALOG_MANIFEST_ID = 'rss-catalog';
/** 未命中任何固定大类时的兜底分类（与出版脚本 lib.mjs 的 FALLBACK_CATEGORY 同值） */
export const RSS_CATALOG_FALLBACK_CATEGORY = '综合';

/** 源库条目 */
export interface RssCatalogFeed {
  /** feed 地址（出版期已过测活门禁与 http(s) 形状校验） */
  url: string;
  /** 博客名（上游清单标题；可与 feed 自带标题不同，订阅时作为初始 title） */
  title: string;
  /** 站点首页（可空串） */
  site: string;
  /** 上游原始标签（自由打标，810 个；只作搜索词，不作导航） */
  tags: string[];
  /** 固定大类（出版期关键词映射；非空且 ⊆ categories） */
  cats: string[];
  /** 路由型源预留（RSSHub 路由路径；本期恒缺省，ADR-0208 决策 3） */
  via?: string;
}

/** 上游来源署名（许可证合规：MIT 再分发须保留署名，ADR-0208） */
export interface RssCatalogSource {
  id: string;
  name: string;
  url: string;
  license: string;
}

/** 源库 */
export interface RssCatalog {
  version: number;
  /** 出版日期（YYYY-MM-DD；展示用，「有没有更新」以清单 sha256 为准） */
  updatedAt: string;
  meta: { sources: RssCatalogSource[] };
  /** 固定大类（顺序即 UI chips 顺序，含「综合」兜底位） */
  categories: string[];
  feeds: RssCatalogFeed[];
}

/** 内存缓存（同一次会话内不重复读盘；测试用 resetRssCatalogCache 清） */
let memCache: RssCatalog | null = null;

/** 测试用：清空内存缓存 */
export function resetRssCatalogCache(): void {
  memCache = null;
}

/** 合法 feed 地址（与 clipbook news-data 的 normalizeRssFeedUrl 同口径：http/https 且无空白） */
function isValidFeedUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url);
}

/**
 * 结构 + 唯一性校验：version/updatedAt/meta.sources 形状、categories 非空且唯一、
 * feeds 逐条（url 合法且全表唯一、cats 非空且 ⊆ categories、tags 为字符串数组）。
 * 不合法返回 null，绝不抛——调用方据此走「重新下载」。
 */
export function validateRssCatalog(raw: unknown): RssCatalog | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== 'number' || !Number.isFinite(o.version)) return null;
  if (typeof o.updatedAt !== 'string' || !o.updatedAt) return null;
  const meta = o.meta as Record<string, unknown> | null;
  if (!meta || typeof meta !== 'object' || !Array.isArray(meta.sources)) return null;
  const sources: RssCatalogSource[] = [];
  for (const s of meta.sources as unknown[]) {
    if (!s || typeof s !== 'object') return null;
    const ss = s as Record<string, unknown>;
    if (typeof ss.id !== 'string' || !ss.id) return null;
    if (typeof ss.name !== 'string' || !ss.name) return null;
    if (typeof ss.url !== 'string' || !ss.url) return null;
    sources.push({ id: ss.id, name: ss.name, url: ss.url, license: typeof ss.license === 'string' ? ss.license : '' });
  }
  if (!Array.isArray(o.categories) || o.categories.length === 0) return null;
  const cats = new Set<string>();
  for (const c of o.categories) {
    if (typeof c !== 'string' || !c || cats.has(c)) return null;
    cats.add(c);
  }
  if (!Array.isArray(o.feeds)) return null;
  const feeds: RssCatalogFeed[] = [];
  const urls = new Set<string>();
  for (const f of o.feeds as unknown[]) {
    if (!f || typeof f !== 'object') return null;
    const ff = f as Record<string, unknown>;
    if (typeof ff.url !== 'string' || !isValidFeedUrl(ff.url.trim())) return null;
    const url = ff.url.trim();
    if (urls.has(url)) return null; // url 全表唯一（黄页「已订阅」匹配依赖 url 口径干净）
    urls.add(url);
    if (typeof ff.title !== 'string' || typeof ff.site !== 'string') return null;
    if (!Array.isArray(ff.tags) || !ff.tags.every((t) => typeof t === 'string')) return null;
    if (!Array.isArray(ff.cats) || ff.cats.length === 0) return null;
    for (const c of ff.cats) {
      if (typeof c !== 'string' || !cats.has(c)) return null; // cats ⊆ categories
    }
    const feed: RssCatalogFeed = { url, title: ff.title, site: ff.site, tags: ff.tags as string[], cats: ff.cats as string[] };
    if (typeof ff.via === 'string' && ff.via) feed.via = ff.via;
    feeds.push(feed);
  }
  return { version: o.version, updatedAt: o.updatedAt, meta: { sources }, categories: o.categories as string[], feeds };
}

/** 读本地 → 校验（不缓存）；无库/读失败/校验不过 → null */
async function readLocalValidated(app: unknown): Promise<RssCatalog | null> {
  const text = await readAsset(app, RSS_CATALOG_FILE);
  if (text === null) return null;
  try {
    return validateRssCatalog(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * 读本地 → validate → 内存缓存（同一次会话内不重复读盘）；无库返回 null。
 */
export async function loadRssCatalog(app: unknown): Promise<RssCatalog | null> {
  if (memCache) return memCache;
  const c = await readLocalValidated(app);
  if (c) memCache = c;
  return c;
}

/** 清单条目形状（摘自 `download-manifest.ts` 的 ManifestDocEntry；这里只声明用到的字段） */
interface CatalogManifestEntry {
  id: string;
  file: string;
  sha256: string;
}

/** 统一清单里本库条目：先读缓存清单，没有（从未核对过）就现场拉一次。拉不到/未登记 → null */
async function manifestEntry(app: unknown): Promise<CatalogManifestEntry | null> {
  let m = await cachedManifest(app);
  if (!m) {
    try {
      await refreshManifest(app);
      m = await cachedManifest(app);
    } catch {
      return null;
    }
  }
  return m?.docs.find((d) => d && d.id === RSS_CATALOG_MANIFEST_ID) ?? null;
}

/**
 * 从统一清单取条目 sha256 → `ensureAssetWithHash`（本地已匹配则复用，否则双源下载并校验落盘）
 * → validate → 更新缓存。任一步失败**原文抛错**（调用方决定怎么提示），不静默返回空库。
 */
export async function downloadRssCatalog(app: unknown): Promise<RssCatalog> {
  const entry = await manifestEntry(app);
  if (!entry) {
    throw new Error('RSS 源库尚未登记到下载清单（可能网络不通，或插件版本过旧）');
  }
  const text = await ensureAssetWithHash(app, entry.file, entry.sha256, 'RSS 源库');
  if (text === null) throw new Error('RSS 源库数据拉取失败');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('RSS 源库数据解析失败：' + ((e as Error)?.message || String(e)));
  }
  const catalog = validateRssCatalog(parsed);
  if (!catalog) throw new Error('RSS 源库数据校验失败（结构或条目不合法）');
  memCache = catalog;
  return catalog;
}

// ---------- 查询纯函数（弹窗源库页签与测试共用） ----------

/** url → 展示域名（小写、去 www.、去端口与路径）；解析不出 → 空串 */
export function feedDomainOf(url: string): string {
  const m = String(url || '').trim().match(/^https?:\/\/([^/?#]+)/i);
  if (!m) return '';
  return m[1].toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
}

/** 分类计数（按 categories 顺序；0 条的分类也在列，UI 自行决定是否隐藏） */
export function catalogCategoryCounts(catalog: RssCatalog): Array<{ cat: string; count: number }> {
  const counts = new Map<string, number>(catalog.categories.map((c) => [c, 0]));
  for (const f of catalog.feeds) {
    for (const c of f.cats) counts.set(c, (counts.get(c) || 0) + 1);
  }
  return catalog.categories.map((cat) => ({ cat, count: counts.get(cat) || 0 }));
}

/** 搜索过滤（纯函数）：query 命中 title / site / url / 任一标签（不区分大小写的包含匹配），
 *  cat 非空时再按大类过滤；序沿用库内原序（上游订阅量粗排）。 */
export function filterCatalogFeeds(catalog: RssCatalog, opts?: { query?: string; cat?: string }): RssCatalogFeed[] {
  const q = String(opts?.query || '').trim().toLowerCase();
  const cat = String(opts?.cat || '').trim();
  return catalog.feeds.filter((f) => {
    if (cat && !f.cats.includes(cat)) return false;
    if (!q) return true;
    if (f.title.toLowerCase().includes(q)) return true;
    if (f.site.toLowerCase().includes(q)) return true;
    if (f.url.toLowerCase().includes(q)) return true;
    return f.tags.some((t) => t.toLowerCase().includes(q));
  });
}

/** 已订阅判定用的 url 集合（trim 归一；rssFeeds 内 url 本已归一，此处只防手写空白） */
export function subscribedUrlSet(urls: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const u of urls || []) {
    const t = String(u || '').trim();
    if (t) set.add(t);
  }
  return set;
}
