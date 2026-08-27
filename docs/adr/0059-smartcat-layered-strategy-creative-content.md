# ADR-0059：创作型内容分层策略（引用追踪 + 语义快照）

日期：2026-09-01 ～ 状态：Accepted ～ 关联：ADR-0057（描述生成架构）、ADR-0056（StructuredMeta 契约）

## Context

创作型内容（日记/诗歌/信件）在小橘记忆中占核心地位，但面临两难：
- **全文存 description**：向量检索质量高，但存储膨胀、每次修改都重新向量化
- **只存摘要**：存储干净，但检索质量下降，丢失语义细节

当前 10 分钟结算计时器不够灵敏——用户写了 30 秒就关闭文件，要等 10 分钟才触发观察。

## Decision

**「引用追踪位置，语义快照留住灵魂」**：

### 数据模型扩展

在 StructuredMeta 中新增字段：

```typescript
interface StructuredMeta {
  // ---- 引用追踪 ----
  refPath: string;        // 文件路径
  refHash: string;        // 内容哈希（检测变化）

  // ---- 语义快照 ----
  snapshot: {
    summary: string;      // 摘要（50-100字）
    tags: string[];       // 关键词（3-5个）
    time?: string;        // 日记时间
    length: number;       // 内容长度
    emotion?: string;     // 情绪标签（写入 MemoryItem.emotion）
  };

  // ---- 版本追踪 ----
  version: number;
  lastSnapshotAt: string;
}
```

### 触发机制

**ContentCompletionDetector**（替换旧 10 分钟计时器）：
- 稳定窗口：30 秒无修改
- 会话超时：5 分钟无操作
- 最小内容：≥20 字符
- 触发时机：关闭文件 / 切换文件 / 超时 / 用户手动标记

### 变化检测

```typescript
function shouldUpdateSnapshot(oldContent, newContent, threshold = 0.30): boolean {
  if (hash相同) return false;
  const changeRatio = computeDiff(oldContent, newContent).totalChanged / oldContent.length;
  return changeRatio >= threshold;
}
```

| 修改类型 | 变化比例 | 行为 |
|---|---|---|
| 小改（错别字/标点） | < 30% | 只更新 refHash + version，不更新快照，不重新向量化 |
| 大改（新增段落/重写） | ≥ 30% | 重新生成快照，更新 description，重新向量化 |

### 适用范围

仅限创作型内容（日记/诗歌/信件）。其他类型（电影/聊天/番茄钟等）用模板函数生成描述，不需要快照。

## Consequences

- 引用追踪避免每次修改都触发观察写入（小改动只更新 hash）
- 语义快照提供比纯摘要更丰富的检索信号（summary + tags + emotion）
- 30% 阈值控制存储膨胀和向量化频率
- ContentCompletionDetector 比旧计时器更灵敏（30s vs 10min）
- 需要新增 SnapshotGenerator（AI 调用）和 ContentCompletionDetector 类
- 用户可配置：最小内容长度、稳定窗口、会话超时、快照更新阈值、摘要长度
