# ADR-0056：StructuredMeta 作为域事件契约

日期：2026-09-01 ～ 状态：Accepted ～ 关联：小橘记忆与行为流重构

## Context

当前各域（diary、movie、library 等）通过 domain bus 发出事件，SmartCat 以 `source` 字符串标签接收。描述生成由 SmartCat 侧的 9 个 `*-source.ts` 硬编码模板函数完成，措辞被 CONTEXT.md 冻结（「用户拍板不得自改」）。

问题：
- 各域不携带结构化元数据，SmartCat 无法精确过滤、统计和去重
- 描述模板分散在 9 个文件中，维护成本高
- 新增来源需要修改 SmartCat 侧模板，违反开闭原则

## Decision

各域在发出事件时自行填充 `StructuredMeta`，SmartCat 不再解析事件内容，只做路由和描述生成。

```typescript
// 各域发出事件时自带 structured
emitDomainEvent('diary', {
  action: 'created',
  structured: {
    entityType: 'diary_entry',
    action: 'created',
    name: '2024-01-15 日记',
    tags: ['心情'],
    extras: { time: '14:30', content: '...' }
  }
});
```

`source` 字段保留，用于路由分流（ROUTING_RULES 的 key）。`entityType` 用于描述生成。两者各司其职：source = 数据来源渠道，entityType = 实体语义类型。

**addObservation API 简化**：调用方只传 `source` + `structured`，`importance`/`emotion`/`stream` 由 ROUTING_RULES 自动推导。

12+ 域全部一次适配，一步到位。旧 `*-source.ts` 文件逐步废弃。

## Consequences

- 各域需要 import StructuredMeta 类型并填充（工作量分散到各域）
- SmartCat 的路由逻辑集中化（ROUTING_RULES 配置表）
- 旧描述模板废弃，新模板从 StructuredMeta 生成
- 旧数据重置清空，不需迁移
