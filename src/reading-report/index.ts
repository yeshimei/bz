/**
 * 阅读数据分析报告（ticket 13）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 13 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureReadingReport(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 13): 阅读报告数据层 + 渲染初始化
}

export function showReadingReport(app: App): void {
  ensureReadingReport(app);
  new Notice('「阅读数据分析报告」正在迁移中（ticket 13）');
}
