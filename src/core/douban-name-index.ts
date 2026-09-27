/* ============================================================
 * bz · 豆瓣影视名称索引（core/douban-name-index.ts，单源）——issue 498 / ADR-0209
 *
 * 影院「添加影视」输入框联想的**可下载名称索引**：85,288 条（名称/年份/评分/类别/豆瓣 ID），
 * 选中候选携带 sid → 解析链可跳过按名搜索直取 ApiZero（ADR-0209）。
 *
 * 资产链路与 ADR-0204 归物分类表 / ADR-0208 RSS 源库同范本：发布在仓库
 * `downloads/cinema-douban-index.json`，作为一条 doc 条目登记统一清单
 * （build-manifest.mjs DOCS 表），下载 / 落盘 / sha256 校验复用 `remote-asset.ts`，
 * 「有没有更新」交给清单 docStatus，本层不自出私有清单。
 *
 * 产物形状（scripts/build-cinema-index.mjs 产出；rows 为定长数组省体积，ADR-0209 决策 2）：
 *   { version, updatedAt, stats: { total, kinds: [[类别, 条数]]（按条数降序） },
 *     rows: [[名称, 年份, 评分, 类别, 豆瓣ID], ...] }
 *
 * 合规注记（ADR-0209）：索引只含事实性元数据（名称/年份/评分/类别/ID），
 * 不含简介、海报、短评等血肉字段；上游为自抓 2026 表 + Kaggle 豆瓣数据（CC BY-NC-SA）。
 * ============================================================ */
import { ensureAssetWithHash, readAsset, DOWNLOADS_CHANGED_EVENT } from './remote-asset';
import { cachedManifest, refreshManifest } from './download-manifest';
import { onDomainEvent } from './domain-bus';

/** 数据本体文件名（相对 `downloads/`；本地落盘为插件目录内同路径） */
export const DOUBAN_NAME_INDEX_FILE = 'cinema-douban-index.json';
/** 本资源在统一清单里的条目 id（与 scripts/build-manifest.mjs 的 DOCS 表一致） */
export const DOUBAN_NAME_INDEX_MANIFEST_ID = 'cinema-douban-index';

/** 索引行（数组行解析后的对象形；rows 在产物里是定长数组省体积） */
export interface DoubanIndexRow {
  /** 名称 */
  n: string;
  /** 年份（可空串：部分 search 来源的剧集条目上游就没有） */
  y: string;
  /** 评分（可空串） */
  s: string;
  /** 类别（电影/电视剧/综艺/动画/纪录片/剧集综艺） */
  k: string;
  /** 豆瓣 subject ID */
  id: string;
}

/** 名称索引 */
export interface DoubanNameIndex {
  version: number;
  /** 出版日期（YYYY-MM-DD；展示用，「有没有更新」以清单 sha256 为准） */
  updatedAt: string;
  stats: {
    total: number;
    /** 类别 → 条数（出版期按条数降序） */
    kinds: Array<[string, number]>;
  };
  rows: DoubanIndexRow[];
}

/** 内存缓存（同一次会话内不重复读盘；测试用 resetDoubanNameIndexCache 清） */
let memCache: DoubanNameIndex | null = null;

/** 测试用：清空内存缓存 */
export function resetDoubanNameIndexCache(): void {
  memCache = null;
  normCache = new WeakMap();
}

/** 缓存随落盘事件失效（与 rss-catalog 同款幂等单例订阅，issue 495 复检 P1-1 先例） */
let subscribed = false;
function subscribeOnce(): void {
  if (subscribed) return;
  subscribed = true;
  onDomainEvent(DOWNLOADS_CHANGED_EVENT, (evt: { fileName?: string }) => {
    if (evt && evt.fileName === DOUBAN_NAME_INDEX_FILE) {
      memCache = null;
      normCache = new WeakMap();
    }
  });
}

/**
 * 结构校验：version/updatedAt/stats 形状与 total 一致、rows 定长数组行（5 列全字符串）、
 * 豆瓣 ID 全表唯一。不合法返回 null，绝不抛——调用方据此走「重新下载」。
 * kinds 与 rows 的一致性不在加载期复核（DESC 小字用 indexKindCounts 现数，不信任存量）。
 */
export function validateDoubanNameIndex(raw: unknown): DoubanNameIndex | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== 'number' || !Number.isFinite(o.version)) return null;
  if (typeof o.updatedAt !== 'string' || !o.updatedAt) return null;
  const stats = o.stats as Record<string, unknown> | null;
  if (!stats || typeof stats !== 'object') return null;
  if (typeof stats.total !== 'number' || !Number.isFinite(stats.total)) return null;
  if (!Array.isArray(stats.kinds)) return null;
  for (const pair of stats.kinds as unknown[]) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    if (typeof pair[0] !== 'string' || typeof pair[1] !== 'number') return null;
  }
  if (!Array.isArray(o.rows)) return null;
  const rows: DoubanIndexRow[] = [];
  const ids = new Set<string>();
  for (const r of o.rows as unknown[]) {
    if (!Array.isArray(r) || r.length !== 5) return null;
    if (!r.every((cell) => typeof cell === 'string')) return null;
    const id = r[4];
    if (ids.has(id)) return null;
    ids.add(id);
    rows.push({ n: r[0], y: r[1], s: r[2], k: r[3], id });
  }
  if (rows.length !== stats.total) return null;
  return {
    version: o.version,
    updatedAt: o.updatedAt,
    stats: { total: stats.total, kinds: stats.kinds as Array<[string, number]> },
    rows,
  };
}

/** 读本地 → 校验（不缓存）；无库/读失败/校验不过 → null */
async function readLocalValidated(app: unknown): Promise<DoubanNameIndex | null> {
  const text = await readAsset(app, DOUBAN_NAME_INDEX_FILE);
  if (text === null) return null;
  try {
    return validateDoubanNameIndex(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * 读本地 → validate → 内存缓存（同一次会话内不重复读盘）；无库返回 null——
 * 调用方（表单联想、设置行小字）都按「null = 功能静默缺席」处理，不报错。
 */
export async function loadDoubanNameIndex(app: unknown): Promise<DoubanNameIndex | null> {
  subscribeOnce();
  if (memCache) return memCache;
  const idx = await readLocalValidated(app);
  if (idx) memCache = idx;
  return idx;
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
  return m?.docs.find((d) => d && d.id === DOUBAN_NAME_INDEX_MANIFEST_ID) ?? null;
}

/**
 * 从统一清单取条目 sha256 → `ensureAssetWithHash`（本地已匹配则复用，否则双源下载并校验落盘）
 * → validate → 更新缓存。任一步失败**原文抛错**（设置行动作方决定怎么提示），不静默返回空库。
 */
export async function downloadDoubanNameIndex(app: unknown): Promise<DoubanNameIndex> {
  subscribeOnce();
  const entry = await manifestEntry(app);
  if (!entry) {
    throw new Error('豆瓣影视索引尚未登记到下载清单（可能网络不通，或插件版本过旧）');
  }
  const text = await ensureAssetWithHash(app, entry.file, entry.sha256, '豆瓣影视索引');
  if (text === null) throw new Error('豆瓣影视索引数据拉取失败');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('豆瓣影视索引数据解析失败：' + ((e as Error)?.message || String(e)));
  }
  const idx = validateDoubanNameIndex(parsed);
  if (!idx) throw new Error('豆瓣影视索引数据校验失败（产物异常或本地文件损坏）；重装下载仍失败请反馈');
  memCache = idx;
  return idx;
}

// ---------- 查询纯函数（表单联想、设置行小字与测试共用） ----------

/** 类别计数（按出版期 kinds 的顺序与数值现数；不修改缓存对象） */
export function indexKindCounts(index: DoubanNameIndex): Array<{ k: string; count: number }> {
  return index.stats.kinds.map(([k, count]) => ({ k, count }));
}

/**
 * 名称归一（检索键）：小写 + 去空白与常见标点（全半角括号/引号/连接符/间隔号）。
 * 「三体（2023）」「三体 2023」「三体」都归到同一前缀。
 */
function normName(s: string): string {
  return s.toLowerCase().replace(/[\s:：·・（）()【】\[\]「」『』《》,_\-~～'""]+/g, '');
}

/** 归一名称缓存（loadDoubanNameIndex 失效时同步清；避免每次击键对 8.5 万行做正则） */
let normCache = new WeakMap<DoubanNameIndex, string[]>();
function normsOf(index: DoubanNameIndex): string[] {
  let norms = normCache.get(index);
  if (!norms) {
    norms = index.rows.map((r) => normName(r.n));
    normCache.set(index, norms);
  }
  return norms;
}

/**
 * 名称检索（纯函数，每击键一次）：前缀命中优先于包含命中，同档按评分降序（空评分殿后）
 * 再按名称长度升序（短名更常见更具体），截取前 limit 条。query 归一后为空 → 空数组。
 */
export function searchDoubanNameIndex(index: DoubanNameIndex, query: string, limit = 12): DoubanIndexRow[] {
  const q = normName(query);
  if (!q) return [];
  const norms = normsOf(index);
  const prefix: DoubanIndexRow[] = [];
  const contains: DoubanIndexRow[] = [];
  for (let i = 0; i < index.rows.length; i++) {
    const key = norms[i];
    if (!key) continue;
    if (key.startsWith(q)) prefix.push(index.rows[i]);
    else if (key.includes(q)) contains.push(index.rows[i]);
  }
  const byRank = (a: DoubanIndexRow, b: DoubanIndexRow): number => {
    const sa = a.s ? Number(a.s) : -1;
    const sb = b.s ? Number(b.s) : -1;
    if (sb !== sa) return sb - sa;
    return a.n.length - b.n.length;
  };
  prefix.sort(byRank);
  contains.sort(byRank);
  return [...prefix, ...contains].slice(0, limit);
}
