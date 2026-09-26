# 325 — 自动关联迁入知识盒：三盒为界、三盒恒含索引

- 日期：2026-09-15
- 用户拍板：**正名「自动关联」并迁入知识盒**；**范围恒为三个盒子**（两端都限、手动不豁免）；
  **三个盒子主动进第二大脑向量化、无需指定**；**挂载建议召回改卡片盒白名单**
- 关联：ADR-0141（主设计）/ ADR-0142（建议范围）/ ADR-0137（挂载点）/ ADR-0138（AI 建议不挂 related）/
  ADR-0140（三段式，范围闸被 0142 修订）/ ADR-0002（域隔离）/ ADR-0112（知识盒三部）/
  issue 298（link agent 迁移搁置——本 issue 复活并落地）/ issue 309（LinkBridge 三段通道）/
  ticket 111·115·116·119·128·167
- 状态：**已实现**（2026-09-15；实现见 commit「feat(knowledge): 自动关联迁入知识盒」）。
  实现期与设计的偏差：
  ① `core/link-now.ts` 的 LinkBridge 增两段——`now(path, { force })`（手动命令强制重跑用，
     保住 v1.7/ticket 167 的「手动豁免尊重门」）与 `backfill()`（批量补链归知识盒命令，引擎仍在本域）；
     `LinkNowOutcome` 增 `out-of-scope`（盒外拒绝要有独立提示，不能冒充「文件缺失」）。
  ② 盒界卫在 `processNote` 中置于 encrypt 硬跳过**之后**——锁定目录文件仍报 `skipped`，不报盒外。
  ③ 队列消费遇 `out-of-scope` 就地出队（范围不可配 → 该条目永远跑不了，避免滞留）。
  ④ `secondbrain/config.parseAllowPaths` 改为复用 `whitelist.parsePathList`（同一存储格式只留一个解析器）。
  ⑤ 知识盒 schema 顺带纳入文案 lint（域组 C 注册表），存量文案零违规。
  ⑥ 删除 `watch.ts` 的 `__resetLinkAgentGuideForTests`（引导提示退役后无标志可复位）。
  ⑦ **双轴 review 后的三处修正**（2026-09-15，独立提交 `fix: review 修正`）：
     · 范围判定**真走 core 单源**——原 `data.ts` 的 `getLinkAgentScopes()` + `matchesScope(scopes, path)`
       门面删除，改 `inLinkScope(path)` 直转 `core.inKnowledgeBoxes`（此前 `inKnowledgeBoxes` 只有测试在用，
       宣称的「单源」是摆设）；pipeline 5 处 + watch 2 处调用点随之收敛。
     · 逗号目录串解析**收进 core** `parseDirList`：`config.resolveAllowPaths`（域）与
       `settings.migrateAutoLinkSettings`（根配置层）不再各自内联归一化；`whitelist.parsePathList`
       降为一行转发（同一存储格式只剩一个解析器）。`config.parseAllowPaths` 作为纯转发壳删除（Middle Man）。
     · 入口守卫**合并**为 `LinkAgent.resolveTarget(path)`（processNote / applyLinks 共用）——原两处判定顺序
       相反（盒界↔文件门），同一「不存在的盒外 .md」会一处 `out-of-scope`、一处 `skipped`；
       现统一为 文件门 → encrypt 硬跳过 → 盒界，并加回归用例逐组合对齐两处返回值。

## §1 背景

issue 298 搁置「整体迁移到知识盒」的卡点是**候选索引归属**：知识盒没有索引能力（切块/嵌入/向量检索
约 2000 行内核全在 secondbrain），自建要把内核上提共享层（已否），借用第二大脑索引又会在
「`secondBrainAllowPaths` 未含文献目录」时静默失效。

2026-09-15 用户给出「**三盒主动进第二大脑向量化、无需指定**」——白名单不再是用户手配项，
借用索引不再静默失效，于是迁移只剩**归属**（设置组 + 命令）可迁，内核不迁。

## §2 设计

### 2.1 范围恒为三盒（两端都限）

- 三盒 = `knowledgeDirectory` + `knowledgeCardboxDirectory` + `knowledgeTopicDirectory`
  （默认 文献盒 / 卡片盒 / 主题盒），解析单源 = 新增 `core/knowledge-boxes.ts`（ADR-0141 §4）。
- 被处理端（落盘监听 / 存量补链 / 死链清理）与候选端（近邻召回）**都**只认三盒。
- `getLinkAgentScopes()` 改为「三盒」，`linkAgentScopes` 键读点全删；onload 忽略旧值（本机旧值「文献盒」）。
- 手动命令与知识盒显式通道**不再豁免范围**：`createLinkBridge` 的 now/apply 与两条命令入口加三盒卫，
  盒外路径直接拒绝并提示。

### 2.2 三盒恒含索引

- `buildConfig().ALLOW_PATHS` = 三盒 ∪ 白名单额外目录；白名单值里的三盒条目 onload 自动剔除（幂等）。
- `whitelistedFiles()` 文件来源从 `getMarkdownFiles()` 扩到「md + canvas」；
  「白名单空 = 什么也不录」分支删除（三盒恒含，永不为空）。
- 语义：白名单键从「唯一语料来源」降级为「额外目录」；第二大脑自身的检索不受三盒限制。

### 2.3 canvas 只作候选来源

- `chunk.ts` 新增 canvas 抽取：`.canvas` JSON → 节点 `text` 字段按序拼接 → 交既有切块链路；
  `meta.notes` 键容纳 `.canvas` 路径。
- 不写回（canvas 无 frontmatter）；`computeBackfillTargets` 的 `.endsWith('.md')` 不变，canvas 不进被处理端。

### 2.4 存量补链补「已尝试无关联」标记

现状：目标谓词 = 范围内 `.md` + `related` 为空 → **AI 判定无关联的笔记每次启动都重跑**。
补：`link.state` 记一笔「已尝试且 0 条」，正文未变不重试（复用既有基准哈希）。

### 2.5 保持项（勿顺手改）

- 产出仍写 frontmatter `related`（整篇↔整篇、单侧幂等）——与「语义建议」落 `mount-suggest.json` 不冲突。
- 7 个 `linkAgent*` 键名不改（`Scopes` 退役）；挂载树不区分 AI/手写 related。
- 不做盒子目录存在性探测：空盒合法（空范围/空索引/不报错）。

## §3 改动面

| 文件 | 内容 |
|---|---|
| `src/core/knowledge-boxes.ts` | **新增**：三盒解析单源（读三键 + 归一化 + `inBoxes`） |
| `src/secondbrain/config.ts` | `ALLOW_PATHS` = 三盒 ∪ 白名单额外目录；三盒条目剔除 |
| `src/secondbrain/vector-store.ts` | 文件来源扩 canvas；删「白名单空」分支；增量判据同步 |
| `src/secondbrain/chunk.ts` | canvas 节点文本抽取 |
| `src/secondbrain/link-agent/data.ts` | `getLinkAgentScopes` → 三盒；`link.state` 补「已尝试 0 条」 |
| `src/secondbrain/link-agent/pipeline.ts` | `findCandidates` 加三盒过滤；补链 `inScope` 用三盒；零结果标记 |
| `src/secondbrain/link-agent/watch.ts` | 删 `maybeGuideAllowPaths` / `guideIndexCoverage`；三盒守卫 |
| `src/core/link-now.ts` | 通道契约注释更新（三盒守卫在实现侧） |
| `src/secondbrain/index.ts` | 两条命令移出本域；守卫与文案更名 |
| `src/secondbrain/panel.ts` | 删「自动双链」设置组 |
| `src/knowledge/ui.ts` | 新增「自动关联」设置组（删「关联范围」行） |
| `src/settings-panel/ui.ts` | knowledge loader 挂新组 |
| `src/settings.ts` | `linkAgentScopes` 类型/默认值退役；旧值 onload 忽略 |
| `src/main.ts` | 命令注册改 `bz-knowledge-relink` / `bz-knowledge-link-all` |
| `src/knowledge/mount-suggest.ts` | 召回白名单改卡片盒（ADR-0142） |
| `prototypes/{knowledge,secondbrain}/*` | 预览产物重出（回主仓） |

## §4 测试

- 三盒解析单源：归一化 / 空值回落 / 盒内判定（纯函数，`// @vitest-environment node`）。
- 索引：ALLOW_PATHS 含三盒 + 额外目录；白名单三盒条目被剔除且幂等；canvas 进 `whitelistedFiles`。
- 关联：候选限三盒（盒外候选被过滤）；补链目标限三盒；零结果不再重试；盒外路径经命令/桥被拒绝。
- 设置：新组 schema 行数/键绑定；`linkAgentScopes` 旧值被忽略；文案 lint 通过（标题 4-8 字零符号、
  desc 禁 `「」` `/` `（）` `—` `·` `、`）。
- 建议：召回只在卡片盒（盒外笔记不进池）；空卡片盒 = 空建议集且不报错。
- smoke.test.ts 同步。

## §5 不在本轮

- 引擎代码搬进 `src/knowledge/`（ADR-0141 §1 已否）。
- canvas 写回 / 关联（无 frontmatter 落点）；建议的 image / video 目标形态（ADR-0142 §2 刻意缩编）。
- 旧卡片盒（`卡片盒2`，1503 篇）的收编——走 ADR-0137 命名对齐，不靠自动关联。
