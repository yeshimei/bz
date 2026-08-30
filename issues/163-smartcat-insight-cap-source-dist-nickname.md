# Ticket 163：洞察条数上限 + 记忆来源分布按追查目录分行 + 小橘对我的称呼（三事合一）

## 需求（用户拍板，逐条对话确认）

1. **洞察数量限制**：AI 一次性生成 10 条洞察太多。默认不超过 3 条，且把该设置放进小橘设置面板，用户可自行选择。
2. **记忆来源分布修复**：
   - 「日记下面怎么是记忆目录呢」——来源分布里 source=note 的引用条目被统标为「记忆目录」，实际数据（`我的/信` 的 14 条笔记）应按设置页「记忆目录」的**追踪目录**分行（跟那个走）；
   - 「还有就是洞察和行为消息」——用户确认：**洞察也要计入分布**（单列一行），行为小结行保留。
3. **称呼设置**：设置页可指定小橘对我的称呼，默认「包仔」；**所有把记忆流/行为流喂给 AI 的调用**里，把「你/用户」这类指代用户的词替换为称呼（用户确认生效范围 = 聊天相关记忆、主动关心、反思证据池、行为小结、周报、懂你上下文块等一切喂记忆/行为内容的地方）。

## 改动面

- `src/settings.ts`：BzSettings + DEFAULT_SETTINGS 新增 `smartcatReflectMaxInsights: 3`、`smartcatUserName: '包仔'`。
- `src/smartcat/ui.ts`：⚙️「互动」组首行「小橘对我的称呼」（text，bindBehavior('smartcatUserName')）；「记忆巩固」组 +1「反思洞察条数上限」（number 1-10，bindBehavior('smartcatReflectMaxInsights')）；DEFAULT_BEHAVIOR 同步两键。
- `src/smartcat/memory.ts`：`getConsolidationConfig` 增 `maxInsights`（负数回退 3、0 钳制 1）；新增 `getUserNickname()`（默认包仔）+ `replaceUserReference(text)`（`你们|你|用户` 单趟替换）；reflect 证据编号行/原文摘录、行为小结行为文案、情绪追标编号行、formatMemoriesForPrompt / WithRefs 内容全部经 replaceUserReference；reflect prompt 改「最多 N 条」+ `insights.slice(0, maxInsights)` 硬截断。候选块头部「你既有的相关洞察」中「你」指小橘——不替换（语义保全）。
- `src/smartcat/dashboard.ts`：`resolveTrackedDirLabel(m, dirs)`（ref 路径/description 路径段前缀匹配首个配置记忆目录）+ `buildSourceDistribution(stream, dirs?)`（洞察单列「洞察」行、note 按追查目录分行、digest 保留「行为小结」行）；renderMemory 传 `normalizeMemoryDirectories(tryGetSettings().memoryDirectories)` 给卡片与最近记忆列表 note 行标签。
- `src/smartcat/report.ts`：formatWeeklyReport 洞察描述行 replaceUserReference。
- `src/smartcat/companion-context.ts`：生成的「你通常在…」「你和小橘的关系」行 replaceUserReference。
- `src/smartcat/mood.ts`：特质归因 numbered 洞察行 replaceUserReference。

## 测试

- memory.test.ts：getConsolidationConfig maxInsights（缺省/覆盖/负回退/0 钳 1）；getUserNickname（缺省/自定义/空回退）；replaceUserReference（你/你们/用户、无指代、自定义称呼）；formatMemoriesForPrompt / WithRefs 替换且存储不变；反思证据行替换 + 洞察原文不替换；洞察 5→3 截断 + prompt「最多 3 条」+ 上限可调。
- dashboard.test.ts：洞察单列、note 按追查目录分行（我的/信、子目录前缀、反斜杠归一、未命中回退、无 ref 从 description 取路径、无 dirs 旧口径）、UI 记忆页来源分布卡与最近记忆列表标签。
- report.test.ts：洞察描述「你/用户」→「包仔」。
- companion-context.test.ts：作息行「包仔通常在…」。
- settings.test.ts：互动组 3→4 项、记忆巩固组 2→3 项徽标。
- trait-attribution.test.ts / adr0069-core.test.ts：prompt 断言同步为称呼文案（「包仔完成了备忘录…」「包仔对天文充满好奇」）。
- 门禁：tsc 0 错 + 全量 221 文件 3563 用例绿 + 构建部署 E 盘。

## 边界（刻意不做）

- 模板/人物设定句（「你是小橘」、候选块头「你既有的相关洞察」）不做称呼替换——「你」指小橘（AI 自身）。
- 存储格式冻结：替换只作用于喂 AI 的 prompt 文本，不写盘；dossier 叙事输入为模板拼装（无「你/用户」），不替换。
- smartcatInsightCount 仍为退役键（ticket 162），新上限键 smartcatReflectMaxInsights 独立存在。

## 状态

- [x] spec 更新
- [x] 数据层实现
- [x] UI 层实现
- [x] 测试全绿
- [x] 构建验证
