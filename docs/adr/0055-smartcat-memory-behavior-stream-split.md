# ADR-0055：小橘记忆流/行为流拆分

日期：2026-09-01 ～ 状态：Accepted ～ 关联：小橘记忆与行为流重构

## Context

当前小橘将所有感知事件统一存入 `memory.stream`（类型均为 `observation`），导致：
- 系统行为（文件重命名、点击、待办操作）与情感内容（日记、对话）混杂，检索噪声大
- 基于混杂数据生成的洞察缺乏情感深度
- 小橘作为「情感陪伴猫咪」，却频繁提及知识管理行为（卡片盒、剪藏）
- `importance`、`emotion`、`credibility` 等字段对系统行为无意义

小橘的核心定位是情感陪伴。需要将数据流按语义拆分。

## Decision

将单一 `memory.stream` 拆分为 `memoryStream`（情感/认知记忆）和 `behaviorStream`（系统/操作日志），存储在同一文件 `smartcat.json` 中。

**记忆流（memoryStream）**：日记、对话、诗歌、信件、电影观看/评分、图书完成、反思洞察、周报等具有情感或认知价值的内容。

**行为流（behaviorStream）**：待办操作、收藏管理、物品登记、闪念/笔记、新闻消费、书架增删、删除操作等系统行为。行为流仍写入 smartcat.json（可查可用），但不参与向量化和 prompt 构建。

**行为流定位**：辅助上下文，小橘偶尔参考（如「你最近经常在深夜编辑文件」），不是纯调试日志。需要支持时间模式检测和频率统计查询。

**反思/小结/周报/对话 prompt**：全部只从 memoryStream 取证据，行为流不参与。

## Consequences

- 向量存储只服务 memoryStream，vec 文件删除重建
- 行为流有滚动窗口清理（behaviorMaxCount=1000, behaviorMaxDays=30）
- 路由规则按 `source:action` 静态指定目标流和默认参数
- 现有 `MemoryStreamEntry` 格式变更，旧数据重置清空
