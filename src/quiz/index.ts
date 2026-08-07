/**
 * 做题家（ticket 17）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 17 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureQuiz(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 17): 做题家数据层 + UI 初始化
}

export function quizUpdate(app: App): void {
  ensureQuiz(app);
  new Notice('「做题家」正在迁移中（ticket 17）');
}

export function quizOpen(app: App): void {
  ensureQuiz(app);
  new Notice('「做题家」正在迁移中（ticket 17）');
}
