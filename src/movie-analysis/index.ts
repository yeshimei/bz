/**
 * 影视数据分析（ticket 15）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 15 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureMovieAnalysis(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 15): 影视数据分析初始化
}

export function openMovieAnalysis(app: App): void {
  ensureMovieAnalysis(app);
  new Notice('「影视数据分析」正在迁移中（ticket 15）');
}
