# 小橘三层记忆流水线：行为流 → 日小结 → 记忆流 → 反思/周报

ticket 158 曾用「派生视图」救反思/周报的饿死：证据池把行为流条目渲染成观察伪条目并池（`behaviorToObservations`）。该补丁能用但方向拧——下游饿了吗？直接伸手到上游原料堆里抓。用户拍板推翻（ticket 160）：**把管道接顺，各层只吃下一层的产出**。

## 流水线

```
行为流（append-only 原始日志，R1 现状不动）
   │  日小结：≥18h 且新增行为 ≥3（可配）
   ▼
日小结产出：type=observation 写入记忆流（source=digest，evidenceIds 溯源行为条目）
   ▼
记忆流（日记本：日小结产出 + 记忆目录引用 + 聊天等遗留观察）
   │  反思：≥24h 且新素材 ≥3（可配，双闸 AND）
   ▼
反思产出 insight → 周报：只吃本周新增 insight（≥3 条可配）→ 报告 insight 写回
```

关键拍板：

- **日小结产出从 insight 改 observation**：insight 被反思防自指闸（红队 B P1-1）挡在证据池外，改 observation 才能成为反思口粮；防自指不受损——行为流本就不含小橘自身产出（R1）。〔今日小结〕前缀取消，source 标签承担辨识。
- **反思只吃记忆流观察**：删并池与按描述去重；触发从「24h OR 新增 ≥20」改「≥24h AND 新素材 ≥3」双闸——20 条快车道随 pending 单义化退役。新素材信号 = max(pendingSinceReflect 计数，created 扫描)：计数覆盖记忆目录回填旧日期的入库（upsertNoteMemory 新建分支计数、日小结批量计数、memory 路由分支计数；behavior 路由与 addInsight 不计），扫描覆盖重启恢复（计数不持久化）。
- **周报只吃洞察**：本周窗口新增 insight（剔除 superseded；只吃本周窗——洞察是长期结论，吃全量则周报周周雷同）。来源/情绪/topMemories 统计随观察原料退役，新形态为主题分组洞察清单；LLM 未配置降级同款清单文本。周报不再触碰 refResolver。
- **反思贴原文**：证据池对带 ref 条目（记忆目录引用，description 存路径）经 refResolver 当场读正文，编号行附「原文摘录」截 `smartcatRefExcerptLimit` 字（0=不附；读失败回退路径显示，失效自愈仍归记忆目录同步——聊天通道 `formatMemoriesForPromptWithRefs` 同款语义）。
- **巩固参数全部上 ⚙️ 设置面板**（「记忆巩固」组 11 滑杆）：反思间隔/新观察阈值/回看条数/证据上限/洞察条数、日小结间隔/行为阈值/证据上限/条数、周报洞察门槛、引用摘录字数。`getConsolidationConfig()` 统一读取：BzSettings `smartcat*` 键覆盖，`MEMORY_CONFIG` 为缺省；GA 检索权重（α/decay，RL 校准）不暴露。
- **冷启动/断粮**：AI 未配置 → 日小结不产出 → 记忆流无新素材 → 反思/周报安静等待（不报错不空转）；行为流照常录像，AI 恢复后日小结自动补课追平。管道各层「没料就不干活」，断粮只在源头发生。

社区对照：此结构即 Generative Agents（Park et al. 2023）「观察 → 反思出高阶洞察」反思树的落地——反思吃观察；Letta sleep-time compute 的离线巩固对应日小结「睡前整理」；Mem0/情景-语义巩固共识的「原始日志 append-only 永不改写、定期分层蒸馏、可溯源」对应行为流/evidenceIds 链。

Considered and rejected：周报吃全量历史洞察（周周重复）；AI 未配置时规则兜底把行为条目逐字搬进记忆流（会稀释语义层，行为流录像 + 补课已兜底）；反思沿用 OR 触发（素材不足时空转打 LLM）。

存量数据兼容：旧 digest insight 条目（〔今日小结〕前缀）原样保留零迁移；旧周报/观察条目不参与新周报统计，随时间自然退出窗口。
