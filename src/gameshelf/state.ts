/**
 * 游戏架（gameshelf）域状态：模块级可变对象 M（影院同范式）。
 * 数据 = `我的/游戏/*.md` 一作一笔记（票 368：影院范式，frontmatter Steam 管辖字段）。
 */
import type { App, TFile } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';

/** 游戏目录默认值（gameshelfFolderPath 未配置时回落） */
export const DEFAULT_FOLDER = '我的/游戏';

/** 游戏目录解析（目录唯一真理跨域化范式，ADR-0115 同款）：显式配置优先，缺省回落默认 */
export function resolveGameshelfFolderPath(): string {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    return typeof s.gameshelfFolderPath === 'string' && s.gameshelfFolderPath.trim()
      ? s.gameshelfFolderPath
      : DEFAULT_FOLDER;
  } catch {
    return DEFAULT_FOLDER;
  }
}

/** 游戏条目（笔记解析产物；展示名 = 文件名剥《》） */
export interface GameItem {
  file: TFile | null;
  appid: number;
  name: string;
  /** 累计游玩分钟 */
  playtimeMin: number;
  /** YYYY-MM-DD 或空（从未玩） */
  lastPlayed: string;
  cover: string | null;
  offShelf: boolean;
  /** 最近一次同步时刻 ISO 串 */
  syncedAt: string | null;
}

/** 面板视图：shelf=游戏墙 / report=报告 */
export type GameshelfViewKind = 'shelf' | 'report';

export interface GameshelfState {
  currentOverlay: HTMLElement | null;
  items: GameItem[];
  view: GameshelfViewKind;
  /** 同步进行中（防重入 + 按钮态） */
  syncing: boolean;
  /** 状态行文案（上次同步时刻/进行中提示） */
  statusMsg: string;
  appRef: App | null;
  folderPath: string;
  renderFn: (() => void) | null;
}

export const M: GameshelfState = {
  currentOverlay: null,
  items: [],
  view: 'shelf',
  syncing: false,
  statusMsg: '',
  appRef: null,
  folderPath: DEFAULT_FOLDER,
  renderFn: null,
};

/** 测试/卸载用：整体重置模块状态 */
export function resetGameshelfState(): void {
  M.currentOverlay = null;
  M.items = [];
  M.view = 'shelf';
  M.syncing = false;
  M.statusMsg = '';
  M.appRef = null;
  M.folderPath = DEFAULT_FOLDER;
  M.renderFn = null;
}
