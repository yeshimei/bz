/**
 * 复习计划（ticket 16）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 16 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureReview(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 16): 复习计划数据层 + UI 初始化
}

export function openReviewPanel(app: App): void {
  ensureReview(app);
  new Notice('「复习计划」正在迁移中（ticket 16）');
}

export function reviewAddCurrent(app: App): void {
  ensureReview(app);
  new Notice('「复习计划」正在迁移中（ticket 16）');
}

export function reviewRemoveCurrent(app: App): void {
  ensureReview(app);
  new Notice('「复习计划」正在迁移中（ticket 16）');
}

export function reviewJumpOverdue(app: App): void {
  ensureReview(app);
  new Notice('「复习计划」正在迁移中（ticket 16）');
}

export function reviewMarkDialog(app: App): void {
  ensureReview(app);
  new Notice('「复习计划」正在迁移中（ticket 16）');
}
