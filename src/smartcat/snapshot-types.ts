/**
 * P2c 创作型内容分层策略——共享类型（ticket 123）
 *
 * 独立于 types.ts，避免修改既有文件。
 * 主线程合入后可将这些类型提升到 types.ts 的 StructuredMeta.snapshot。
 */

// ==================== ContentCompletionDetector ====================

/** 完成原因 */
export type CompletionReason = 'stable' | 'timeout' | 'manual';

/** 创作完成检测结果 */
export interface CompletionResult {
  /** 文件路径 */
  path: string;
  /** 完成时的内容 */
  content: string;
  /** 从首次刷新到完成的毫秒数 */
  settledMs: number;
  /** 触发完成的原因 */
  reason: CompletionReason;
}

// ==================== SnapshotGenerator ====================

/** 快照生成输入 */
export interface SnapshotInput {
  path: string;
  content: string;
  /** 上一次快照的 hash（用于 shouldRegenerateSnapshot 比较） */
  baseHash?: string;
}

/** 语义快照（对齐 StructuredMeta.snapshot 字段） */
export interface SemanticSnapshot {
  /** 内容摘要（50-100 字） */
  summary: string;
  /** 关键词标签（3-5 个） */
  tags: string[];
  /** 快照生成时间（ISO） */
  time?: string;
  /** 内容长度（字符数） */
  length: number;
  /** 情绪标签（白名单枚举） */
  emotion?: string;
}

/** AI 生成函数签名（可注入 mock） */
export type SnapshotAIFn = (
  content: string,
  prompt: string,
) => Promise<{ summary: string; tags: string[]; emotion?: string } | null>;

/** generateSnapshot 选项 */
export interface SnapshotOptions {
  /** AI 生成函数（可选；不提供则走非 AI 兜底） */
  aiFn?: SnapshotAIFn;
  /** 摘要最大长度（默认 100） */
  maxSummaryLength?: number;
}
