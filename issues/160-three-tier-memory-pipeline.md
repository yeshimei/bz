# Ticket 160：三层记忆流水线 + 巩固参数面板

## 需求（用户拍板，推翻 ticket 158 合并池方案）

1. **日小结接行为流**（维持 R1 现状），但产出改为 observation 写入记忆流——成为反思/周报的口粮（管道接通）。
2. **反思只接记忆流**：证据池只吃记忆流观察，删 behaviorToObservations 并池与描述去重；触发改「≥间隔 且 新素材≥阈值」。
3. **周报只吃洞察**：本周窗口内新增 insight（剔除 superseded），门槛 weeklyMinInsights；不再吃具体记忆/观察。
4. **引用贴原文**：反思证据池对带 ref 条目经 refResolver 读 vault 正文，编号行附原文摘录（字数可配，0=不附）；周报只吃洞察后不再需要。
5. **巩固参数上面板**：反思/日小结/周报/摘录共 11 参数进 ⚙️ 设置弹窗「记忆巩固」组；清点无既有重叠设置，删除的废弃面为内部常量语义与死代码。

## 改动面

- `src/settings.ts`：BzSettings +11 键与默认值。
- `src/smartcat/memory.ts`：getConsolidationConfig；shouldReflect 重写（混合新素材信号）；reflect 证据池重写 + ref 原文摘录；digest 产出 makeDigestObservation；upsertNoteMemory 新建补计数；删 behaviorToObservations；SOURCE_LABELS 补标签。
- `src/smartcat/report.ts`：WeeklyReportData 收敛 + format/generate 重写（洞察清单）。
- `src/smartcat/index.ts`：maybeWeeklyReport 门槛与原料改洞察。
- `src/smartcat/ui.ts`：「记忆巩固」组 11 滑杆 + DEFAULT_BEHAVIOR 补缺省。
- `src/smartcat/dashboard.ts`：情绪分布口径注释更新（不再对齐 report）。

## 测试

- memory.test.ts：158 三用例改写/删除；digest 产出断言改 observation；新增 ref 原文（命中/失效回退）、digest→reflect 链路、getConsolidationConfig 覆盖、shouldReflect 新闸门用例；settings-provider mock（mockSettings 可变）。
- report.test.ts：build/format/generate 三段重写洞察语义。
- index-cov.test.ts：周报链路用例种子改洞察。
- adr0069-core.test.ts：pendingSinceReflect 断言保留（计数器语义延续）。

## 状态

- [x] spec 更新
- [x] 数据层实现
- [x] 设置面板
- [x] 测试改写 + 新增
- [x] tsc + 全量测试 + 构建
- [x] ADR-0075 + CONTEXT + PROGRESS
