/**
 * 自动摘要（ticket 10）
 * 事件常驻域（无命令）：vault create 监听 归档/网页剪藏 → AI 摘要写回。
 * 占位骨架：幂等初始化已就位，实现随 ticket 10 填充。
 */
import type { App } from 'obsidian';

let initialized = false;

/** 幂等初始化（按设置 autoSummaryEnabled 开关注册，ADR-0003 懒加载） */
export function ensureAutoSummary(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 10): vault.on('create') 监听 + AI 摘要写回 frontmatter
}

export function isAutoSummaryInitialized(): boolean {
  return initialized;
}
