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
 * `via` 为路由型源的路由路径（ADR-0209 RSSHub 上游）：url 出版期已用默认实例拼好，
 * 订阅时经 resolveCatalogFeedUrl 按用户实例设置重拼（订阅=拷贝当时 URL）。
 * ============================================================ */
import { ensureAssetWithHash, readAsset, DOWNLOADS_CHANGED_EVENT } from './remote-asset';
import { cachedManifest, refreshManifest } from './download-manifest';
import { onDomainEvent } from './domain-bus';

/** 数据本体文件名（相对 `downloads/`；本地落盘为插件目录内同路径） */
export const RSS_CATALOG_FILE = 'rss-catalog.json';
/** 本资源在统一清单里的条目 id（与 scripts/build-manifest.mjs 的 DOCS 表一致） */
export const RSS_CATALOG_MANIFEST_ID = 'rss-catalog';
/** 未命中任何固定大类时的兜底分类（与出版脚本 lib.mjs 的 FALLBACK_CATEGORY 同值） */
export const RSS_CATALOG_FALLBACK_CATEGORY = '综合';

/** RSSHub 路由条目 url 的出版期默认实例（ADR-0209 用户拍板）——插件侧单源，
 *  与出版脚本 lib.mjs 同名常量同值（测试对齐）；用户可在 news.json rsshubInstance 段改自建实例 */
export const RSS_HUB_DEFAULT_INSTANCE = 'https://rsshub.rssforever.com';

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
  /** 固定大类（出版期关键词映射 / RSSHub 官方分类直映射；非空且 ⊆ categories） */
  cats: string[];
  /** 路由型源的完整路由模板（含 ns 前缀与 :参数段，如 `/bilibili/user/video/:uid/:embed?`，
   *  ADR-0209）——url 出版期已用默认实例拼好（校验与全表唯一性零改动）；无 :参数段 = 开箱直订
   *  （订阅时按实例重拼），有 :参数段 = 走参数表单（buildRouteUrl 产出订阅地址） */
  via?: string;
  /** 带参数路由的示例路径（上游文档演示值，参数表单的预填素材；仅带参数条目携带） */
  viaExample?: string;
  /** 带参数路由的参数说明表（参数名 → 中文说明；表单输入框的 placeholder 素材） */
  params?: Record<string, string>;
  /** 路由描述（上游文档截断 200 字；表单顶部提示素材） */
  desc?: string;
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

/**
 * 缓存随落盘事件失效（幂等单例订阅）：下载资产统一从 `writeAssetText` 落盘并派发
 * `downloads:asset-changed`，设置面板行的「下载/更新」走 `ensureAssetWithHash` 直写磁盘、
 * **不经** downloadRssCatalog——没有这条失效链，更新后整条会话都会命中旧 memCache
 * （issue 495 复检 P1-1）。
 */
let subscribed = false;
function subscribeOnce(): void {
  if (subscribed) return;
  subscribed = true;
  onDomainEvent(DOWNLOADS_CHANGED_EVENT, (evt: { fileName?: string }) => {
    if (evt && evt.fileName === RSS_CATALOG_FILE) memCache = null;
  });
}

/** 合法 feed 地址（与 clipbook news-data 的 normalizeRssFeedUrl 同口径：http/https 且无空白） */
function isValidFeedUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url);
}

/** 实例地址 + 路由路径 → 完整 feed 地址（实例去尾斜杠；形状不对返回空串）。
 *  与出版脚本 lib.mjs 的同名纯函数同口径（测试对齐）。 */
export function joinRssHubUrl(instance: string, routePath: string): string {
  const base = String(instance || '').trim().replace(/\/+$/, '');
  const p = String(routePath || '').trim();
  if (!/^https?:\/\//i.test(base) || !p.startsWith('/') || /\s/.test(p)) return '';
  return base + p;
}

/** 路由模板的 :参数段（`{...}` 正则尾巴与 `?` 可选标记一并解析）。
 *  与出版脚本 lib.mjs 同口径（测试对齐）。 */
export interface RouteTemplateParam {
  name: string;
  optional: boolean;
}

export function parseRouteTemplate(template: string): RouteTemplateParam[] {
  const params: RouteTemplateParam[] = [];
  const re = /:([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]*\})?(\?)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(template || '')))) params.push({ name: m[1], optional: m[3] === '?' });
  return params;
}

/** 模板是否含 :参数段（含 = 订阅必须走参数表单，不能直订） */
export function isParametrizedRoute(template: string): boolean {
  return parseRouteTemplate(template).length > 0;
}

/**
 * 实例 + 路由模板 + 参数值 → 完整 feed 地址（ADR-0209 全参数化：订阅=拷贝用户自己拼出的 URL）。
 * 参数值按段 encode（值内 / 保留段结构——RSSHub 通配段如 category=sy/gzdt_210283 合法）；
 * 可选参数空值整段剥掉；必选参数空值、可选参数乱序填（前空后有值——位置歧义静默错绑）、
 * 正则尾巴含斜杠的参数段（split 切断后无法替换，如 npm 包名段的 `(@x/)?y` 形状）→ 返回空串交调用方拦。
 */
export function buildRouteUrl(instance: string, template: string, values: Record<string, string>): string {
  const base = String(instance || '').trim().replace(/\/+$/, '');
  const tpl = String(template || '').trim();
  if (!/^https?:\/\//i.test(base) || !tpl.startsWith('/') || /\s/.test(tpl)) return '';
  const segRe = /^:([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]*\})?(\?)?$/;
  const out: string[] = [];
  let sawOptionalEmpty = false; // 已出现过空值的可选段（此后再有有值可选段 = 乱序）
  const filled = new Set<string>();
  for (const seg of tpl.split('/')) {
    if (!seg) continue;
    const m = seg.match(segRe);
    if (!m) {
      // 正则尾巴含 `/` 的参数段被 split 切断，两半都不匹配 segRe 且原文含 `:`——守卫拦下
      if (seg.startsWith(':')) return '';
      out.push(seg);
      continue;
    }
    const v = String(values?.[m[1]] ?? '').trim();
    if (v) {
      if (m[3] === '?' && sawOptionalEmpty) return ''; // 前可选空后有值：位置歧义静默错绑
      filled.add(m[1]);
      out.push(v.split('/').map((part) => encodeURIComponent(part)).join('/'));
      continue;
    }
    if (m[3] === '?') {
      sawOptionalEmpty = true;
      continue;
    }
    return '';
  }
  // 守卫复查：任一参数名仍以占位形式残留在产物里（形状怪异的模板）→ 拼失败
  let result = `${base}/${out.join('/')}`;
  for (const name of filled) {
    if (result.includes(`:${name}`)) return '';
  }
  return result;
}

/** 从 example 反解参数预填值（表单默认值）：模板段与示例段按 / 对位取值。
 *  尾部连续可选段在示例里被省略（如 :embed? 没填）时逐个剥离后对齐；
 *  字面段不一致或段数仍不齐 → 回空对象（预填不全无伤，不猜）。
 *  与出版脚本 lib.mjs 同口径（测试对齐）。 */
export function reverseTemplateExample(template: string, example: string): Record<string, string> {
  const tplSegs = String(template || '').split('/').filter(Boolean);
  const exSegs = String(example || '').split('?')[0].split('/').filter(Boolean);
  const segRe = /^:([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]*\})?(\?)?$/;
  const align = (tpl: string[], ex: string[]): Record<string, string> | null => {
    if (tpl.length !== ex.length) return null;
    const values: Record<string, string> = {};
    for (let i = 0; i < tpl.length; i++) {
      const m = tpl[i].match(segRe);
      if (!m) {
        if (tpl[i] !== ex[i]) return null; // 字面段不一致 = 不是同一路由的示例
        continue;
      }
      if (!ex[i] || ex[i].startsWith(':')) return null;
      values[m[1]] = decodeURIComponent(ex[i]);
    }
    return values;
  };
  if (tplSegs.length === exSegs.length) return align(tplSegs, exSegs) || {};
  const t = [...tplSegs];
  while (t.length > exSegs.length) {
    const m = t[t.length - 1].match(segRe);
    if (!m || m[3] !== '?') return {}; // 缺的不是可选段，不对位
    t.pop();
  }
  return align(t, exSegs) || {};
}

/**
 * 源库条目 → 订阅地址。**只对无参数路由有意义**（ADR-0209 全参数化：带参数条目的
 * 订阅地址由参数表单产出，走 buildRouteUrl；此处对带参数模板原样拼是形状地址，调用方
 * 不得直接入库）——无参数按实例重拼；重拼失败（实例键损坏）回退出版期 url；直连源原样。
 */
export function resolveCatalogFeedUrl(feed: Pick<RssCatalogFeed, 'url' | 'via'>, instance: string): string {
  if (!feed.via) return String(feed.url || '').trim();
  return joinRssHubUrl(instance, feed.via) || String(feed.url).trim();
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
    // 唯一性按去尾斜杠比对（与出版脚本 lib.mjs 的去重 key 同口径）：尾斜杠孪生条目
    // 会让订阅匹配各奔东西、同源双订。url 全表唯一是黄页「已订阅」匹配的口径地基。
    const urlKey = url.replace(/\/+$/, '');
    if (urls.has(urlKey)) return null;
    urls.add(urlKey);
    if (typeof ff.title !== 'string' || typeof ff.site !== 'string') return null;
    if (!Array.isArray(ff.tags) || !ff.tags.every((t) => typeof t === 'string')) return null;
    if (!Array.isArray(ff.cats) || ff.cats.length === 0) return null;
    // 条目内 cats 重复会让 catalogCategoryCounts 计数虚高，一并拦下
    if (new Set(ff.cats).size !== ff.cats.length) return null;
    for (const c of ff.cats) {
      if (typeof c !== 'string' || !cats.has(c)) return null; // cats ⊆ categories
    }
    const feed: RssCatalogFeed = { url, title: ff.title, site: ff.site, tags: ff.tags as string[], cats: ff.cats as string[] };
    if (typeof ff.via === 'string' && ff.via) {
      // via 形状门（ADR-0209）：必须是以 / 开头的路由模板且无空白——它是订阅重拼/填参的素材，
      // 坏形状会让表单产出垃圾地址直插 rssFeeds
      if (!/^\/\S*$/.test(ff.via)) return null;
      feed.via = ff.via;
    }
    // 表单素材三件套（仅带参数条目携带）：示例路径同形状门；params 键非空值字符串；desc 字符串
    if (typeof ff.viaExample === 'string' && ff.viaExample) {
      if (!/^\/\S*$/.test(ff.viaExample)) return null;
      feed.viaExample = ff.viaExample;
    }
    if (ff.params && typeof ff.params === 'object' && !Array.isArray(ff.params)) {
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(ff.params as Record<string, unknown>)) {
        if (!k.trim() || typeof v !== 'string') return null;
        params[k.trim()] = v;
      }
      if (Object.keys(params).length > 0) feed.params = params;
    }
    if (typeof ff.desc === 'string' && ff.desc) feed.desc = ff.desc;
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
  subscribeOnce();
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
  subscribeOnce();
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
  if (!catalog) throw new Error('RSS 源库数据校验失败（产物异常或本地文件损坏）；重装下载仍失败请反馈');
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

/** 搜索过滤（纯函数）：query 命中 title / site / url / 任一标签 / 路由路径 via（不区分大小写的包含匹配），
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
    if (f.via && f.via.toLowerCase().includes(q)) return true;
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
