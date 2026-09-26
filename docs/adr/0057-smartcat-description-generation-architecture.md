# ADR-0057：描述生成架构（模板函数 + 分层策略）

日期：2026-09-01 ～ 状态：Accepted ～ 关联：ADR-0056（StructuredMeta 契约）、小橘分层策略

## Context

当前描述生成全部是硬编码中文模板（9 个 `*-source.ts`），措辞冻结。拆分记忆流/行为流后，需要新的描述生成机制。

两种内容类型有不同需求：
- **创作型内容**（日记/诗歌/信件）：原文较长，需要语义快照用于检索，但全文存 description 太重
- **非创作型内容**（电影/聊天/番茄钟等）：短文本，模板函数直接生成即可

## Decision

采用**双轨描述生成**架构：

### 轨道一：模板函数（非创作型内容）

每种 `entityType` 注册独立的描述生成器（策略模式）。新增类型只需注册新函数。

```typescript
const descriptionGenerators: Record<string, (s: StructuredMeta) => string> = {
  movie: generateMovieDescription,
  book: generateBookDescription,
  chat_message: generateChatDescription,
  // ...
};
```

### 轨道二：分层策略（创作型内容：日记/诗歌/信件）

用 **snapshot** 作为 description 的数据源：

1. `ContentCompletionDetector` 检测创作完成（30s 稳定窗口 + 5min 会话超时）
2. `SnapshotGenerator` 调用 AI 生成 snapshot（summary + tags + emotion）
3. 模板函数从 snapshot 生成 description
4. `snapshot.emotion` 自动写入 `MemoryItem.emotion`，消除冗余

**变化检测**：refHash 比对，变化 ≥30% 才重新生成 snapshot + 重新向量化；<30% 只更新 hash。

### description 字段

description 仍为自然语言文本（用于向量检索和对话展示），snapshot 是结构化中间层。创作型内容的 description 由 snapshot.summary 生成；非创作型由模板函数直接生成。

## Consequences

- 创作型内容获得语义快照能力（摘要+关键词+情绪），检索质量高
- 非创作型内容保持轻量模板，无 AI 成本
- ContentCompletionDetector 替换旧 10 分钟结算计时器（更灵敏：30s vs 10min）
- 旧 `*-source.ts` 文件废弃
- 需要新增 SnapshotGenerator（AI 调用）和 ContentCompletionDetector 类
