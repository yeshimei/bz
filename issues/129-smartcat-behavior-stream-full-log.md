# Ticket 129：行为流全量双写 + 时间线面板（ADR-0062，修订 ADR-0055 分流拍板）

- 状态：进行中（worktree W2）
- 域：smartcat（小橘）
- 来源：grill-with-docs 拍板 + 原型验收（用户：「任何行为都记录到行为流，包括记忆流中的行为（两边都有）」「文案不用展现 news:skipped 类似事件名」「最近行为使用时间线」）
- 关联：`src/smartcat/memory.ts`（addObservation/writeBehaviorStream/promoteToMemory）、`src/smartcat/routing.ts`、`src/smartcat/dashboard.ts`（renderBehavior）、`src/smartcat/description-generators.ts`、`src/smartcat/types.ts`、`src/settings.ts`（behaviorMaxCount）、`src/smartcat/news-source.ts`

## 拍板

1. **双写机制**：`addObservation` 一律**先写行为流**（全量日志，所有结构化事件）；routing 命中 memory 的再写记忆流条目——两条独立（id/时间戳各自生成，不互相标记来源；用户拍板「看起来是独立添加的，只是方便管理」）。`ROUTING_RULES` 表本身不动（importance/emotion/credibility 语义保持）。旧签名 addObservationLegacy 路径同样先进行为流（保持全量口径）。
2. **文案渲染时生成**：行为流条目存结构化数据（`metadata = StructuredMeta`，`description` 字段保持 `source:action 名称` 兜底不迁移）；dashboard 渲染时按 `entityType:action` 分派模板函数生成人类文案（如 news:saved → 「你保存了《标题》（平台·读了 N 分钟）」）。模板**全覆盖**：news/movie/memo/favorites/belongings/pomodoro/library/chat/diary 等全部结构化域；无模板命中兜底旧式 `source:action 名称`。**最近行为列表不显示事件名**。
3. **面板（时间线 + 筛选 + 滚动加载）**：
   - 列表改时间线式（左侧竖线 + 圆点节点，原型 C 样式基准）；
   - 来源统计块可点击筛选（点某来源块 = 筛选该来源；点「全部」还原；再点已选块还原亦可，实现自选但语义必须闭环）；
   - 滚动加载（批次 50，与现截断值对齐；触底加载或「加载更多」按钮均可）；
   - 时长入文案（news 类 `extras.durationMin` →「·读了 N 分钟」）。
4. **提升按钮**：去掉行为条目「提升为记忆」按钮（UI 移除）；`promoteToMemory` 函数接口保留不删（测试改直接调用）。
5. **容量**：`DEFAULT_SETTINGS.behaviorMaxCount` 1000→2000（`behaviorMaxDays` 30 不变）；已有 data.json 值尊重、零迁移。滚动清理逻辑不变。
6. **防重维持**：B6 300ms 同事件守卫、news 保存近 20 条防重不变；双写不产生额外去重需求（行为流写入幂等性由既有守卫保证）。
7. **边界保持**：行为流仍不向量化、不入 prompt 槽位（ADR-0055 边界不动，只改「分流二选一」为「全量 + 记忆流子集」）。

## 验收标准

- a) diary/movie 等记忆流事件同时出现在行为流（两条独立条目，无关联标记）；news:saved/skipped 照旧仅行为流；
- b) 行为面板时间线样式；点击「聚合讯」统计块只显示 news 条目、点「全部」还原；滚动加载生效；
- c) news 条目文案含「读了 N 分钟」，列表无 `news:skipped` 式事件名；无模板域兜底旧式文案；
- d) 面板无「提升为记忆」按钮，promoteToMemory 直接调用仍工作；
- e) 默认 behaviorMaxCount=2000（新装），旧 data.json 值不被覆盖；
- f) 数据层（双写/清理/模板）+ UI 层（面板渲染/筛选/加载）测试 + smoke；全量测试绿 + tsc + 构建。
