/**
 * 收藏本（ticket 11）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 11 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureFavorites(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 11): 收藏本数据层 + UI 初始化
}

export function openFavoritesPanel(app: App): void {
  ensureFavorites(app);
  new Notice('「收藏本」正在迁移中（ticket 11）');
}

export function addFavoriteItem(app: App): void {
  ensureFavorites(app);
  new Notice('「收藏本」正在迁移中（ticket 11）');
}
