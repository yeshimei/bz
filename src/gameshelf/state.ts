/**
 * 游戏库（gameshelf）域状态：模块级可变对象 M（影院同范式）。
 * 数据 = `我的/游戏/*.md` 一作一笔记（票 368：影院范式，frontmatter Steam 管辖字段）。
 */
import type { App, TFile } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';

/** 游戏目录默认值（gameshelfFolderPath 未配置时回落） */
export const DEFAULT_FOLDER = '我的/游戏';

/**
 * 游戏目录解析（目录唯一真理跨域化范式，ADR-0115 同款）：显式配置优先，缺省回落默认。
 * 尾斜杠归一（func F11）：配置 `我的/游戏/` 时扫描前缀会拼成 `我的/游戏//` 恒零匹配——
 * 面板空态 + 同步链全库判新建。设置面板 renderer 不规范化该键（全仓口径如此），此处兜一手。
 */
export function resolveGameshelfFolderPath(): string {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    const raw = typeof s.gameshelfFolderPath === 'string' ? s.gameshelfFolderPath.trim() : '';
    if (!raw) return DEFAULT_FOLDER;
    return raw.replace(/[/\\]+$/, '');
  } catch {
    return DEFAULT_FOLDER;
  }
}

/**
 * Steam 配置读取（同步与详情按需拉取共用；无配置 → 空串）。
 * 正典落此（深审 A4：此前在 sync.ts，detail 装配层越层去 sync 编排层拿它，方向倒置）——
 * sync/detail 都向下取本函数。sync.ts 暂留同名转发保 detail.ts:21 既有 import 兼容
 * （detail 属批 B 辖区，改线后删转发）。
 */
export function readSteamConfig(): { steamId: string; apiKey: string } {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    return {
      steamId: typeof s.gameshelfSteamId === 'string' ? s.gameshelfSteamId : '',
      apiKey: typeof s.gameshelfSteamApiKey === 'string' ? s.gameshelfSteamApiKey : '',
    };
  } catch {
    return { steamId: '', apiKey: '' };
  }
}

/** 游戏条目（笔记解析产物；展示名 = 文件名剥《》） */
export interface GameItem {
  file: TFile | null;
  appid: number;
  name: string;
  /** 中文名（frontmatter `中文名`；Steam 库只给英文名，中文名由 names.ts 从商店接口回填） */
  zhName: string | null;
  /** 累计游玩分钟 */
  playtimeMin: number;
  /** YYYY-MM-DD 或空（从未玩） */
  lastPlayed: string;
  /** 封面现值（frontmatter `封面`：本地 vault 路径，或还没本地化时的远端地址） */
  cover: string | null;
  /** 封面远端地址（frontmatter `封面源`；同步管辖，本地化后仍在，供删缓存后重下） */
  coverSrc: string | null;
  /** 图标现值（frontmatter `图标`：本地路径或远端） */
  icon: string | null;
  /** 图标远端地址（frontmatter `图标源`；hash 拼不出来，只有同步能刷新它） */
  iconSrc: string | null;
  /** 平台分项分钟（frontmatter 四键；老笔记缺键 → 0） */
  windowsMin: number;
  deckMin: number;
  macMin: number;
  linuxMin: number;
  /** 有社区成就页（frontmatter 有成就） */
  hasAch: boolean;
  offShelf: boolean;
  /** 最近一次同步时刻 ISO 串 */
  syncedAt: string | null;
}

/** 展示名：中文名优先，缺则回原名（卡片/门面/弹窗标题都用它，禁止各处自己拼） */
export function displayNameOf(it: GameItem): string {
  const zh = (it.zhName ?? '').trim();
  return zh || it.name;
}

/** 原名与中文名都在搜索命中范围内（用户可能记得任一语言的名字） */
export function nameMatches(it: GameItem, query: string): boolean {
  const k = query.trim().toLowerCase();
  if (!k) return true;
  return it.name.toLowerCase().includes(k) || (it.zhName ? it.zhName.toLowerCase().includes(k) : false);
}

/** 面板视图：shelf=游戏墙 / stats=数据统计 */
export type GameshelfViewKind = 'shelf' | 'stats';

/** 时长档位筛选（游戏墙工具行） */
export type GameshelfBucket = 'all' | 'b200' | 'b50' | 'b10' | 'b1' | 'idle';

/** 排序键 */
export type GameshelfSort = 'hours' | 'last' | 'name';

export interface GameshelfState {
  currentOverlay: HTMLElement | null;
  items: GameItem[];
  view: GameshelfViewKind;
  /** 搜索词（名称模糊，实时过滤） */
  query: string;
  /** 时长档位筛选 */
  bucket: GameshelfBucket;
  /** 排序键 */
  sort: GameshelfSort;
  /** 同步进行中（防重入 + 按钮态） */
  syncing: boolean;
  /** 状态行文案（上次同步时刻/进行中提示） */
  statusMsg: string;
  appRef: App | null;
  folderPath: string;
  renderFn: (() => void) | null;
  /** 详情弹窗的重画钩子（媒体队列下完图后调它，否则弹窗里第一次看到的是占位图，
   *  关掉重开才出真图 —— 真机上首次打开某款的详情就撞这个）。弹窗关了就自清。 */
  modalRepaintFn: (() => void) | null;
}

export const M: GameshelfState = {
  currentOverlay: null,
  items: [],
  view: 'shelf',
  query: '',
  bucket: 'all',
  sort: 'hours',
  syncing: false,
  statusMsg: '',
  appRef: null,
  folderPath: DEFAULT_FOLDER,
  renderFn: null,
  modalRepaintFn: null,
};

/** 测试/卸载用：整体重置模块状态 */
export function resetGameshelfState(): void {
  M.currentOverlay = null;
  M.items = [];
  M.view = 'shelf';
  M.query = '';
  M.bucket = 'all';
  M.sort = 'hours';
  M.syncing = false;
  M.statusMsg = '';
  M.appRef = null;
  M.folderPath = DEFAULT_FOLDER;
  M.renderFn = null;
  M.modalRepaintFn = null;
}
