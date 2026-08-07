/**
 * 聚合讯（ticket 09）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 09 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureNews(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 09): 聚合讯数据层 + UI 初始化
}

export function openNewsReader(app: App): void {
  ensureNews(app);
  new Notice('「聚合讯」正在迁移中（ticket 09）');
}
