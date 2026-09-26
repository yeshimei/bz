/* ============================================================
 * bz · 归物本物品分类表（core/category-table.ts，单源）——issue 478 阶段 A
 *
 * 两层分类表（组 → 分类）的**资产层**运行时：下载 / 校验 / 查询。
 * 表不随插件构建分发（main.js 里不含它），发布在仓库 `downloads/`，用户在设置面板
 * 「在线资源」组点按钮现场拉取，落盘插件安装目录（<configDir>/plugins/bz/）。
 *
 * 下载 / 落盘 / hash 校验全部复用 `remote-asset.ts`（与手册、皮肤包同一条路），
 * 不另造一套——这是铁律口径（issue 476：local-asset 单源）。
 *
 * **sha256 与版本来自统一清单**（issue 480 / ADR-0203 之后）：本表作为一条 doc 条目
 * 登记在 `downloads/manifest.json`（`core/download-manifest.ts` 是「全插件在线资源的
 * 单一事实源」）。本模块**不再自出私有清单**——那正是统一清单要消灭的重复事实源；
 * 「有没有更新」也交给清单的 docStatus 三态，不在本层另立一套判定。
 *
 * 本模块**只做资产层**：不碰 UI、不接 Jev。阶段 B 的两段 Jev choice 与阶段 C
 * 的文件选择器在别处编排；这里只产出纯数据查询与菜单形状（无业务哨兵）。
 *
 * 设计口径：
 * - 文件名是**相对 `downloads/` 的路径**（ADR-0203 口径），本地落盘同路径镜像。
 * - `validateCategoryTable` 只校验**形状 + id/name 唯一性**（不读图标池——
 *   池是构建期产物，运行期不随包下发）；不合法返回 null，绝不抛。
 * - `downloadCategoryTable` 任一步失败**原文抛错**（调用方决定怎么提示），
 *   不静默返回空表。
 * ============================================================ */
import { ensureAssetWithHash, readAsset } from './remote-asset';
import { cachedManifest, refreshManifest } from './download-manifest';

/** 数据本体文件名（相对 `downloads/`；本地落盘为插件目录内同路径） */
export const CATEGORY_TABLE_FILE = 'belongings-categories.json';
/** 本资源在统一清单里的条目 id（与 scripts/build-manifest.mjs 的 DOCS 表一致） */
export const CATEGORY_MANIFEST_ID = 'belongings-categories';

/** 分类条目（表源形状；构建脚本 `scripts/build-catalog.mjs` 产出） */
export interface CategoryItem {
  /** 全表唯一分类 id（如 c0123） */
  id: string;
  /** 分类名（2–8 个汉字，全表唯一） */
  name: string;
  /** lucide 图标名（须 ∈ 图标池） */
  icon: string;
  /** 别名（不含自身名、全表不跨分类重复） */
  aliases: string[];
}

/** 分类组（一级） */
export interface CategoryGroup {
  /** 组 id（全表唯一，如 g001） */
  id: string;
  /** 组名 */
  name: string;
  /** 组图标（须 ∈ 图标池） */
  icon: string;
  /** 组内分类 */
  items: CategoryItem[];
}

/** 分类表（两层结构） */
export interface CategoryTable {
  version: string;
  groups: CategoryGroup[];
}

/** 清单条目形状（摘自 `download-manifest.ts` 的 ManifestDocEntry；这里只声明用到的字段） */
interface CatalogManifestEntry {
  id: string;
  name: string;
  file: string;
  sha256: string;
}

/** 内存缓存（同一次会话内不重复读盘；测试用 resetCategoryTableCache 清） */
let memCache: CategoryTable | null = null;

/** 测试用：清空内存缓存 */
export function resetCategoryTableCache(): void {
  memCache = null;
}

/**
 * 统一清单里本表的条目：先读缓存清单，没有（从未核对过）就现场拉一次清单。
 * 拉不到/未登记 → null（调用方给「网络不通」类的人话提示）。
 */
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
  return m?.docs.find((d) => d && d.id === CATEGORY_MANIFEST_ID) ?? null;
}

/**
 * 结构 + 唯一性校验（运行期口径：不读图标池，只验形状与 id/name 唯一）。
 * 不合法返回 null，绝不抛——调用方据此决定「本地文件可疑 → 走重下」。
 */
export function validateCategoryTable(raw: unknown): CategoryTable | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== 'string' || !Array.isArray(o.groups)) return null;

  const groupIds = new Set<string>();
  const itemIds = new Set<string>();
  const itemNames = new Set<string>();
  const groups: CategoryGroup[] = [];

  for (const g of o.groups as unknown[]) {
    if (!g || typeof g !== 'object') return null;
    const gg = g as Record<string, unknown>;
    if (typeof gg.id !== 'string' || !gg.id) return null;
    if (groupIds.has(gg.id)) return null; // 组 id 唯一
    groupIds.add(gg.id);
    if (typeof gg.name !== 'string' || typeof gg.icon !== 'string') return null;
    if (!Array.isArray(gg.items)) return null;

    const items: CategoryItem[] = [];
    for (const it of gg.items as unknown[]) {
      if (!it || typeof it !== 'object') return null;
      const ii = it as Record<string, unknown>;
      if (typeof ii.id !== 'string' || !ii.id) return null;
      if (itemIds.has(ii.id)) return null; // 分类 id 全表唯一
      itemIds.add(ii.id);
      if (typeof ii.name !== 'string' || !ii.name) return null;
      if (itemNames.has(ii.name)) return null; // 分类名全表唯一
      itemNames.add(ii.name);
      if (typeof ii.icon !== 'string') return null;
      if (!Array.isArray(ii.aliases)) return null;
      items.push({ id: ii.id, name: ii.name, icon: ii.icon, aliases: ii.aliases as string[] });
    }
    groups.push({ id: gg.id, name: gg.name, icon: gg.icon, items });
  }
  return { version: o.version, groups };
}

/** 读本地 → 校验（不缓存）；无表/读失败/校验不过 → null */
async function readLocalValidated(app: unknown): Promise<CategoryTable | null> {
  const text = await readAsset(app, CATEGORY_TABLE_FILE);
  if (text === null) return null;
  try {
    return validateCategoryTable(JSON.parse(text));
  } catch (e) {
    return null;
  }
}

/** 本地是否已有可用表（读本地 + validate 通过） */
export async function hasCategoryTable(app: unknown): Promise<boolean> {
  return (await readLocalValidated(app)) !== null;
}

/**
 * 读本地 → validate → 内存缓存（同一次会话内不重复读盘）；无表返回 null。
 */
export async function loadCategoryTable(app: unknown): Promise<CategoryTable | null> {
  if (memCache) return memCache;
  const t = await readLocalValidated(app);
  if (t) memCache = t;
  return t;
}

/**
 * 从统一清单取本表条目的 sha256 → `ensureAssetWithHash`（本地已匹配则复用，
 * 否则双源下载并校验 sha256 后落盘）→ validate → 更新缓存。
 * 任一步失败**原文抛错**（调用方决定怎么提示），不静默返回空表。
 * @returns 已落盘并校验通过的表
 */
export async function downloadCategoryTable(app: unknown): Promise<CategoryTable> {
  const entry = await manifestEntry(app);
  if (!entry) {
    throw new Error('归物分类表尚未登记到下载清单（可能网络不通，或插件版本过旧）');
  }

  // ensureAssetWithHash：本地已匹配 sha 则复用，否则双源下载并校验 sha256 后落盘
  const dataText = await ensureAssetWithHash(app, entry.file, entry.sha256, '归物分类表');
  if (dataText === null) throw new Error('归物分类表数据拉取失败');
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataText);
  } catch (e) {
    throw new Error('归物分类表数据解析失败：' + ((e as Error)?.message || String(e)));
  }
  const table = validateCategoryTable(parsed);
  if (!table) throw new Error('归物分类表数据校验失败（结构或 id/name 不唯一）');
  memCache = table;
  return table;
}

/**
 * 本地关键词直配：先精确命中分类名，再按别名做**包含匹配、最长别名优先**。
 * 命中多个不同分类时按最长别名取胜、再按 id 升序确定唯一（保证确定性）。
 * @returns 命中 → { 分类名, 图标 }；未命中 → null
 */
export function matchByAlias(name: string, table: CategoryTable): { category: string; icon: string } | null {
  const q = String(name || '').trim();
  if (!q) return null;

  // 1) 精确命中分类名（名称全表唯一，最多一个）
  for (const g of table.groups) {
    for (const it of g.items) {
      if (it.name === q) return { category: it.name, icon: it.icon };
    }
  }

  // 2) 别名包含匹配（输入包含别名即算；最长别名优先 → 并列按 id 升序）
  let bestItem: CategoryItem | null = null;
  let bestLen = 0;
  for (const g of table.groups) {
    for (const it of g.items) {
      let len = 0;
      for (const a of it.aliases) {
        if (q.includes(a) && a.length > len) len = a.length;
      }
      if (len === 0) continue;
      if (len > bestLen) {
        bestLen = len;
        bestItem = it;
      } else if (len === bestLen && bestItem && it.id < bestItem.id) {
        bestItem = it;
      }
    }
  }
  return bestItem ? { category: bestItem.name, icon: bestItem.icon } : null;
}

/**
 * 组菜单：Jev choice 用的 `Record<选项值, 说明>`（键 g001、值中文名）。
 * 不在此加哨兵（哨兵由阶段 B 编排层加）。
 */
export function groupMenu(table: CategoryTable): Record<string, string> {
  const menu: Record<string, string> = {};
  for (const g of table.groups) menu[g.id] = g.name;
  return menu;
}

/**
 * 组内的分类菜单：键 c0123、值中文名。groupId 不存在 → 空对象。
 */
export function itemMenu(table: CategoryTable, groupId: string): Record<string, string> {
  const menu: Record<string, string> = {};
  const g = table.groups.find((x) => x.id === groupId);
  if (!g) return menu;
  for (const it of g.items) menu[it.id] = it.name;
  return menu;
}

/** 按分类名取图标（找不到返回 null） */
export function iconOf(table: CategoryTable, categoryName: string): string | null {
  for (const g of table.groups) {
    for (const it of g.items) {
      if (it.name === categoryName) return it.icon;
    }
  }
  return null;
}
