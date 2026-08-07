/**
 * AI Agent（ticket 19）
 * 事件常驻域（无命令）：笔记 rename/delete/create/open 同步备忘录/收藏本 + AI 剪藏匹配。
 * 依赖：memo（ticket 04）、favorites（ticket 11）、core AI（ticket 03）。
 * 占位骨架：幂等初始化已就位，实现随 ticket 19 填充。
 */
import type { App } from 'obsidian';

let initialized = false;

/** 幂等初始化（按设置 aiAgentEnabled 开关注册，ADR-0003 懒加载） */
export function ensureAIAgent(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 19): vault rename/delete/create/open 监听 + enqueue 队列 + AI 剪藏匹配
}

export function isAIAgentInitialized(): boolean {
  return initialized;
}
