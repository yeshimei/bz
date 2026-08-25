/**
 * 收藏本入口（ticket 11）
 * 命令（favorites-open-panel/favorites-add-item）由 main.ts 裸注册；
 * 此处提供回调 + 幂等初始化（懒加载：UI 域首次打开初始化）。
 */
import type { App } from 'obsidian';
import { FavoritesApp } from './app';

let initialized = false;

/** 幂等初始化（懒加载） */
export function ensureFavorites(app: App): void {
  if (initialized) return;
  initialized = true;
  void FavoritesApp.getInstance().init();
}

/** 打开收藏面板（favorites-open-panel 命令回调） */
export function openFavoritesPanel(app: App): void {
  ensureFavorites(app);
  void FavoritesApp.getInstance().openPanel();
}

/** 添加收藏（favorites-add-item 命令回调，直接打开添加弹窗） */
export function addFavoriteItem(app: App): void {
  ensureFavorites(app);
  FavoritesApp.getInstance().getUI()?.openAddDialog();
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadFavorites(): void {
  const ui = FavoritesApp.getInstance().getUI();
  if (ui) {
    if (ui._escHandle) { try { ui._escHandle.unregister(); } catch { /* 忽略 */ } }
    ui.mask?.remove();
    ui.addMask?.remove();
  }
  FavoritesApp.instance = null;
  initialized = false;
}

/** 文件同步入口（引用同步 + 同名自动关联，见 ./file-sync） */
export { ensureFavoritesFileSync, unloadFavoritesFileSync } from './file-sync';
