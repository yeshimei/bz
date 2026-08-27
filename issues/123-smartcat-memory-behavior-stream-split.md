# 123 — 小橘记忆流/行为流重构

> 状态：✅ 完成（master 8f310f0）～ 关联：ADR-0055~0059 ～ 追加拍板：2026-08-27 跳过聚合讯文章也进行为流

## 目标

将小橘单一 `memory.stream` 拆分为 `memoryStream`（情感/认知记忆）+ `behaviorStream`（系统/操作日志），引入 StructuredMeta 域事件契约，创作型内容走分层策略（refPath + snapshot），向量只服务记忆流。

## 设计决策（grill 确认）

1. 记忆流/行为流拆分，同一文件 smartcat.json
2. 小橘 = 情感陪伴；知识内容（memo/news/favorites/belongings/卡片盒）→ 行为流，不向量化
3. 行为流 = 辅助上下文，需时间模式 + 频率统计查询；不参与 prompt 槽位
4. 反思/小结/周报/叙事全部只看记忆流
5. 旧数据重置清空；vec 文件删除重建
6. 各域自行填充 StructuredMeta（12+ 域全部一次适配），SmartCat 接线调用
7. addObservation 简化为只传 source + structured；importance/emotion/stream 由 ROUTING_RULES 按 source:action 静态推导
8. 描述生成双轨：创作型（日记/诗歌/信）走 ContentCompletionDetector + SnapshotGenerator → snapshot → description；非创作型走 entityType 模板函数
9. snapshot.emotion 写入 MemoryItem.emotion；snapshot 含 summary/tags/time/length
10. 变化检测 refHash，≥30% 才重生成快照 + 重向量化
11. 遗忘机制不做
12. 设置项：行为流保留天数(30)/最大条数(1000)/显示行为日志(true)/启用关联自动发现(true)/关联发现窗口(7)
13. P3: 数据面板记忆流+行为日志视图、promote 按钮、pin/unpin、自动关联（同 entityType+name）、conversationId 聚合
14. ContentCompletionDetector 替换旧 10 分钟结算计时器（30s 稳定窗口 + 5min 会话超时 + ≥20 字符）
15. source 保留（路由）+ structured.entityType（描述生成）两字段并存
16. **追加拍板（2026-08-27）**：聚合讯「跳过」（点「下一篇」）也发观察——`news:skipped` 入行为流（轻量记录，不向量化）；保存链路不变（saved 立即形态 + auto-summary 补全）；「阅读」无独立 UI 动作不发

## 阶段划分

- **P1 数据基座**：types + ROUTING_RULES + addObservation 新签名 + 行为流滚动窗口 + 数据层 + 设置键
- **P2 内容生成**：域适配（各域 emit structured）+ SnapshotGenerator + ContentCompletionDetector + 描述模板函数
- **P3 用户体验**：数据面板 + promote/pin + 关联聚合 + 设置 UI

## 验收清单

- pnpm test 全绿 + tsc --noEmit 通过
- 行为流条目不被向量化，向量只对 memoryStream
- 模板措辞冻结规则对新模板重新生效（新措辞一次拍板）
- 命令 id、retrieve topN=10 契约不破坏