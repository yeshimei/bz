/**
 * 影视（ticket 14）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 14 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureMovie(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 14): 影视数据层 + UI 初始化
}

export function openMovieManager(app: App): void {
  ensureMovie(app);
  new Notice('「影视」正在迁移中（ticket 14）');
}

export function addMovieItem(app: App): void {
  ensureMovie(app);
  new Notice('「影视」正在迁移中（ticket 14）');
}
