# 440 · 脸谱域增强（三）：互动统计面板 + 关系温度曲线

- 状态：待开发（2026-09-25）
- 用户原话：「我需要……详细地总结」+ 全域增强拍板「全做」
- 关联：issue 435 / 438 / ADR-0191

## 背景

AI 提炼会漏、会偏；数字不会。此票补上**客观侧**：纯本地统计，**零 AI 调用成本**。
落盘的只有聚合结果（`ContactStats`），不含聊天原文——与 ADR-0191 §2 隐私口径一致。

## 范围

1. **统计计算**：新增纯函数模块 `src/people/stats.ts`，从 `UnifiedMessage[]` + 形态计数算出 `ContactStats`：
   - 按月消息量（`monthly`）→ 关系温度曲线的数据源
   - 会话发起数（`initiatedByMe` / `initiatedByOther`；相邻消息间隔 ≥ 30 分钟视为新会话）
   - 平均回复时延（`myAvgReplySec` / `otherAvgReplySec`）
   - 24 小时活跃分布（`myHourly` / `otherHourly`）
   - 消息形态计数（`kindCounts`：文本/图片/语音/视频/表情/通话/文件/引用/分享/系统）
2. **形态计数来源**：在 `parse.ts` 的 `GroupBuilder.offer` 里按 `typeName`（CSV 的中文类型列）/ `typeNum`（JSON 的 type）/ 文本标签（`[图片]` 这类导出侧标签）归一后累计到 `ContactGroup.kindCounts`。
3. **落盘**：导入生成时把 `ContactStats` 写进 `ImportRecord.stats`（schema 已在批次 1 地基定好）。
4. **展示**：详情页新增「互动数据」区块：
   - 温度曲线：按月消息量的折线或柱条（纯 CSS/SVG，**不引新依赖**）
   - 谁主动、平均回复时延、活跃时段
   - 形态占比（文本/图片/语音/通话…）
   - 只展示最近一次导入的统计，并注明时间范围；无统计的旧数据显示占位说明。

## 技术要点

- 纯函数模块首行加 `// @vitest-environment node` 的测试；统计边界要有用例（空数组 / 单条 / 跨时区无关的本地时间）。
- 图表用 CSS 实现（柱条用高度百分比，折线可用 `clip-path` 或 SVG polyline）；不自造滚动条。
- 数值展示注意可读性：时延用「秒 / 分钟 / 小时」自适应，条数用千分位或 `k` 缩写。
