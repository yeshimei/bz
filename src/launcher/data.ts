/**
 * 入口页域类型（ticket 23）。
 * 数据格式：CONFIG/STORAGE/launcher.json（铁律 1：格式稳定，字段勿改）。
 */
import type { App } from 'obsidian';

/** 磁贴：入口页上的最小单元，对应一条命令，占据 列×行 个网格单元 */
export interface LauncherTile {
  /** 磁贴唯一 id（generateId 生成，不随命令变化） */
  id: string;
  /** 命令 id（app.commands 注册表中的 id，如 bz-memo-open-panel） */
  commandId: string;
  /** 列（0-based） */
  x: number;
  /** 行（0-based） */
  y: number;
  /** 宽（档位 1|2） */
  w: number;
  /** 高（档位 1|2） */
  h: number;
  /** 自定义图标（lucide 图标名或 emoji 字符，优先于命令自带 icon；缺省用命令 icon/兜底） */
  icon?: string;
  /** 自定义显示名（优先于命令名；缺省用命令名） */
  label?: string;
  /** 隐藏文字：仅显示图标 */
  hideText?: boolean;
}

/** 单个平台的入口页配置（v3：tiles + 列数，桌面/移动互不影响） */
export interface LauncherPlatformConfig {
  tiles: LauncherTile[];
  /** 网格列数（3-8） */
  columns: number;
}

/** launcher.json 根结构（v3：桌面/移动端两套独立配置，各带列数） */
export interface LauncherData {
  version: number;
  /** 桌面端配置 */
  desktop: LauncherPlatformConfig;
  /** 移动端配置 */
  mobile: LauncherPlatformConfig;
}

/** v1 旧格式（仅桌面布局，无平台区分）——读取时自动归入 desktop */
export interface LauncherDataV1 {
  version: number;
  tiles: LauncherTile[];
}

/** 档位清单（列×行，最大 2×2） */
export const TILE_SIZES = [
  { w: 1, h: 1 },
  { w: 2, h: 1 },
  { w: 1, h: 2 },
  { w: 2, h: 2 },
] as const;

export const LAUNCHER_PATH = 'CONFIG/STORAGE/launcher.json';

/** 校验单个磁贴字段合法 */
function isTile(t: any): t is LauncherTile {
  return (
    t &&
    typeof t.id === 'string' &&
    typeof t.commandId === 'string' &&
    typeof t.x === 'number' &&
    typeof t.y === 'number' &&
    typeof t.w === 'number' &&
    typeof t.h === 'number'
  );
}

/** 单个磁贴清洗：非法剔除、w/h 归一 1|2、x/y 取整非负、icon/label/hideText 保留 */
function cleanTile(t: any): LauncherTile | null {
  if (!isTile(t)) return null;
  const w = t.w >= 2 ? 2 : 1;
  const h = t.h >= 2 ? 2 : 1;
  const x = Math.max(0, Math.floor(t.x) || 0);
  const y = Math.max(0, Math.floor(t.y) || 0);
  return {
    id: t.id,
    commandId: t.commandId,
    x,
    y,
    w,
    h,
    ...(typeof t.icon === 'string' && t.icon ? { icon: t.icon } : {}),
    ...(typeof t.label === 'string' && t.label.trim() ? { label: t.label.trim() } : {}),
    ...(typeof t.hideText === 'boolean' ? { hideText: t.hideText } : {}),
  };
}

/** 列数清洗：3-8，缺省桌面 6 / 移动 4 */
function cleanColumns(v: any, fallback: number): number {
  const n = parseInt(v, 10);
  return n >= 3 && n <= 8 ? n : fallback;
}

/** 容错解析：非法字段剔除、缺字段补齐（数据损坏不致命）；v1/v2 旧格式自动迁移 */
export function normalizeData(raw: unknown): LauncherData {
  const empty: LauncherData = {
    version: 3,
    desktop: { tiles: [], columns: 6 },
    mobile: { tiles: [], columns: 6 },
  };
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as any;
  const parsePlatform = (cfg: any, fallbackCols: number, legacyTiles?: any): LauncherPlatformConfig => {
    if (Array.isArray(cfg)) {
      // v2：desktop/mobile 直接是磁贴数组
      return { tiles: cleanTiles(cfg), columns: fallbackCols };
    }
    if (cfg && typeof cfg === 'object') {
      // v3：{ tiles, columns }
      const t = Array.isArray(cfg.tiles) ? cfg.tiles : [];
      return { tiles: cleanTiles(t), columns: cleanColumns(cfg.columns, fallbackCols) };
    }
    return { tiles: cleanTiles(legacyTiles || []), columns: fallbackCols };
  };
  // v1 兼容：顶层 tiles 数组 → desktop
  if (Array.isArray(r.tiles) && !r.desktop && !r.mobile) {
    return { version: 3, desktop: { tiles: cleanTiles(r.tiles), columns: 6 }, mobile: { tiles: [], columns: 6 } };
  }
  return {
    version: 3,
    desktop: parsePlatform(r.desktop, 6),
    mobile: parsePlatform(r.mobile, 6),
  };
}

function cleanTiles(list: any[]): LauncherTile[] {
  const out: LauncherTile[] = [];
  for (const t of list) {
    const c = cleanTile(t);
    if (c) out.push(c);
  }
  return out;
}

/** 读取 launcher.json（不存在 → 空配置；解析失败 → 空配置，不覆盖文件） */
export async function loadLauncherData(app: App): Promise<LauncherData> {
  try {
    const f = app.vault.getAbstractFileByPath(LAUNCHER_PATH);
    if (!f) return { version: 3, desktop: { tiles: [], columns: 6 }, mobile: { tiles: [], columns: 6 } };
    const text = await app.vault.read(f as any);
    return normalizeData(JSON.parse(text));
  } catch (e) {
    return { version: 3, desktop: { tiles: [], columns: 6 }, mobile: { tiles: [], columns: 6 } };
  }
}

/** 保存 launcher.json（不存在 → 建目录建文件） */
export async function saveLauncherData(app: App, data: LauncherData): Promise<void> {
  const c = JSON.stringify(data, null, 2);
  let f = app.vault.getAbstractFileByPath(LAUNCHER_PATH);
  if (f) {
    await app.vault.modify(f as any, c);
  } else {
    const d = LAUNCHER_PATH.substring(0, LAUNCHER_PATH.lastIndexOf('/'));
    if (d && !app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);
    await app.vault.create(LAUNCHER_PATH, c);
  }
}

/** 两个磁贴区域是否重叠（含边界相切？不相切——严格相交才算重叠） */
export function overlaps(a: LauncherTile, b: LauncherTile): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** tile 是否越界（左/上越界与右/下越界均算） */
export function outOfBounds(tile: LauncherTile, cols: number): boolean {
  return tile.x < 0 || tile.y < 0 || tile.x + tile.w > cols;
}

/** 与指定区域重叠的磁贴（不含 ignoreId） */
export function tilesInRegion(tiles: LauncherTile[], x: number, y: number, w: number, h: number, ignoreId?: string): LauncherTile[] {
  const probe: LauncherTile = { id: ignoreId || '__probe__', commandId: '', x, y, w, h };
  return tiles.filter((t) => t.id !== ignoreId && overlaps(t, probe));
}

/** 布局可容纳（不越界且不与任何磁贴重叠） */
export function canPlace(tiles: LauncherTile[], x: number, y: number, w: number, h: number, ignoreId?: string, cols = 6): boolean {
  const probe: LauncherTile = { id: ignoreId || '__probe__', commandId: '', x, y, w, h };
  if (outOfBounds(probe, cols)) return false;
  return !tiles.some((t) => t.id !== ignoreId && overlaps(t, probe));
}

/** 行优先线性下标 */
function linear(t: { x: number; y: number }, cols: number): number {
  return t.y * cols + t.x;
}

/**
 * 行优先扫描找第一个可放 w×h 的空位（含追加空行：扫描到现有布局最深底边 + 1 行）。
 * 找不到返回 null。
 */
export function findFirstEmptySpot(
  tiles: LauncherTile[],
  cols: number,
  w: number,
  h: number,
  startIndex = 0
): { x: number; y: number } | null {
  const maxBottom = tiles.reduce((m, t) => Math.max(m, t.y + t.h), 0);
  const rows = Math.max(1, maxBottom + 1);
  for (let idx = startIndex; idx < rows * cols; idx++) {
    const x = idx % cols;
    const y = Math.floor(idx / cols);
    if (canPlace(tiles, x, y, w, h, undefined, cols)) return { x, y };
  }
  return null;
}

/** 追加到末尾第一个空位（全满则新起一行） */
export function placeAtEnd(tiles: LauncherTile[], tile: LauncherTile, cols = 6): LauncherTile[] {
  const spot = findFirstEmptySpot(tiles, cols, tile.w, tile.h);
  const placed: LauncherTile = { ...tile, x: spot ? spot.x : 0, y: spot ? spot.y : 0 };
  return [...tiles, placed];
}

/**
 * 推挤（Push）：把 moving 磁贴落位到 (tx, ty)。
 * 1. 目标区空闲 → 直接落位；
 * 2. 目标区被占 → 与目标区重叠的磁贴逐个行优先顺移到其后第一个空位，
 *    每顺移一个即复查目标区；全部顺移后仍不可放 → 返回 null（调用方还原）。
 */
export function pushMove(
  tiles: LauncherTile[],
  movingId: string,
  tx: number,
  ty: number,
  cols = 6
): LauncherTile[] | null {
  const moving = tiles.find((t) => t.id === movingId);
  if (!moving) return tiles;
  const rest = tiles.filter((t) => t.id !== movingId);
  if (canPlace(rest, tx, ty, moving.w, moving.h, undefined, cols)) {
    return [...rest, { ...moving, x: tx, y: ty }];
  }
  // 推挤：与目标区重叠的磁贴按行优先顺序逐个顺移
  const blockers = tilesInRegion(rest, tx, ty, moving.w, moving.h)
    .slice()
    .sort((a, b) => linear(a, cols) - linear(b, cols));
  let work = rest.slice();
  for (const b of blockers) {
    const withoutB = work.filter((t) => t.id !== b.id);
    const spot = findFirstEmptySpot(withoutB, cols, b.w, b.h, linear(b, cols) + 1);
    if (!spot) return null; // 推不动 → 整体失败
    work = [...withoutB, { ...b, x: spot.x, y: spot.y }];
    if (canPlace(work, tx, ty, moving.w, moving.h, undefined, cols)) break;
  }
  if (!canPlace(work, tx, ty, moving.w, moving.h, undefined, cols)) return null;
  return [...work, { ...moving, x: tx, y: ty }];
}
