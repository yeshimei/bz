/* ============================================================
 * bz · 归物本物品分类表（core/category-table.ts，单源）——issue 478 阶段 A
 *
 * 两层分类表（组 → 分类）的**资产层**运行时：下载 / 校验 / 查询。
 * 表不随插件构建分发（main.js 里不含它），发布在 `manual/`，用户点在
 * 通用设置页的按钮现场拉取，落盘插件安装目录（<configDir>/plugins/bz/）。
 *
 * 下载 / 落盘 / hash 校验全部复用 `remote-asset.ts`（与手册、皮肤包同一条路），
 * 不另造一套——这是铁律口径（issue 476：local-asset 单源）。
 *
 * 本模块**只做资产层**：不碰 UI、不接 Jev。阶段 B 的两段 Jev choice 与阶段 C
 * 的文件选择器在别处编排；这里只产出纯数据查询与菜单形状（无业务哨兵）。
 *
 * 设计口径：
 * - 文件名用扁平名（remote-asset 的 remotesFor 只支持 flat）：数据本体
 *   `belongings-categories.json`、清单 `belongings-categories.index.json`。
 * - `validateCategoryTable` 只校验**形状 + id/name 唯一性**（不读图标池——
 *   池是构建期产物，运行期不随包下发）；不合法返回 null，绝不抛。
 * - `downloadCategoryTable` 任一步失败**原文抛错**（调用方决定怎么提示），
 *   不静默返回空表。
 * - `refreshCategoryTable` 是后台口径（照 `refreshAsset`）：失败静默，只认
 *   版本号或 sha256 变化才落盘，返回是否更新。
 * ============================================================ */
import {
  ensureAssetWithHash,
  fetchAssetText,
  readAsset,
} from './remote-asset';

/** 数据本体文件名（相对插件安装目录；与 remote-asset 的 manual/ 口径一致） */
export const CATEGORY_TABLE_FILE = 'belongings-categories.json';
/** 清单文件名（相对插件安装目录） */
export const CATEGORY_INDEX_FILE = 'belongings-categories.index.json';

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

/** 清单（与 `manual/belongings-categories.index.json` 形状对齐） */
export interface CategoryIndex {
  version: string;
  file: string;
  /** 归一换行后数据文本的 sha256（64 位小写） */
  sha256: string;
  count: number;
  groups: number;
}

/** 内存缓存（同一次会话内不重复读盘；测试用 resetCategoryTableCache 清） */
let memCache: CategoryTable | null = null;

/** 测试用：清空内存缓存 */
export function resetCategoryTableCache(): void {
  memCache = null;
}

/** 清单解析（纯函数；形状不对/JSON 崩 → null，调用方静默跳过） */
export function parseCategoryIndex(text: string | null): CategoryIndex | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return null;
  }
  const o = raw as Partial<CategoryIndex> & Record<string, unknown>;
  if (!o || typeof o.version !== 'string' || typeof o.file !== 'string') return null;
  if (typeof o.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(o.sha256.toLowerCase())) return null;
  if (typeof o.count !== 'number' || typeof o.groups !== 'number') return null;
  return {
    version: o.version,
    file: o.file,
    sha256: o.sha256.toLowerCase(),
    count: o.count,
    groups: o.groups,
  };
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
 * 拉清单 → 校验 sha256 → 拉数据（顺带落盘）→ validate → 更新缓存。
 * 任一步失败**原文抛错**（调用方决定怎么提示），不静默返回空表。
 * @returns 已落盘并校验通过的表
 */
export async function downloadCategoryTable(app: unknown): Promise<CategoryTable> {
  const indexText = await fetchAssetText(
    CATEGORY_INDEX_FILE,
    (t) => parseCategoryIndex(t) !== null,
    '物品分类表清单',
    '',
  );
  const index = parseCategoryIndex(indexText);
  if (!index) throw new Error('物品分类表清单解析失败（远端内容可疑）');

  // ensureAssetWithHash：本地已匹配 sha 则复用，否则双源下载并校验 sha256 后落盘
  const dataText = await ensureAssetWithHash(app, CATEGORY_TABLE_FILE, index.sha256, '物品分类表');
  if (dataText === null) throw new Error('物品分类表数据拉取失败');
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataText);
  } catch (e) {
    throw new Error('物品分类表数据解析失败：' + ((e as Error)?.message || String(e)));
  }
  const table = validateCategoryTable(parsed);
  if (!table) throw new Error('物品分类表数据校验失败（结构或 id/name 不唯一）');
  memCache = table;
  return table;
}

/**
 * 后台核对新版（版本号或 sha256 变化才落盘），失败静默（照 refreshAsset 取舍）。
 * @returns 是否更新了本地表
 */
export async function refreshCategoryTable(app: unknown): Promise<boolean> {
  try {
    const localIndex = parseCategoryIndex(await readAsset(app, CATEGORY_INDEX_FILE));
    const remoteText = await fetchAssetText(
      CATEGORY_INDEX_FILE,
      (t) => parseCategoryIndex(t) !== null,
      '物品分类表清单',
      '',
    );
    const remote = parseCategoryIndex(remoteText);
    if (!remote) return false;
    const localSha = localIndex?.sha256;
    const localVer = localIndex?.version;
    const needUpdate =
      !localIndex || localVer !== remote.version || (localSha && localSha !== remote.sha256);
    if (!needUpdate) return false;
    await downloadCategoryTable(app); // 内部已落盘 + 更新缓存；失败向上抛 → 下面吞
    return true;
  } catch (e) {
    return false;
  }
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
