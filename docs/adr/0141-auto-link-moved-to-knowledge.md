# ADR-0141 自动关联迁入知识盒：三盒为界、三盒恒含索引

- 状态：已接受（2026-09-15，grill 评审拍板；**设计定稿，未实现**）
- 关联：ADR-0112（知识盒三部）/ ADR-0137（卡片挂载点）/ ADR-0138（AI 建议不挂 related）/
  ADR-0140（挂载建议三段式，范围闸由 ADR-0142 修订）/ issue 298（link agent 迁移搁置——本 ADR 复活并落地）/
  issue 309（LinkBridge 三段显式通道）/ ticket 111·115·116·119·167（自动双链管线）
- 影响：`src/core/knowledge-boxes.ts`（新增）、`src/secondbrain/{config,vector-store,chunk,index,panel}.ts`、
  `src/secondbrain/link-agent/*`、`src/knowledge/{ui,index}.ts`、`src/settings.ts`、`src/main.ts`、
  `src/core/link-now.ts`、`src/settings-panel/ui.ts`、`prototypes/{knowledge,secondbrain}/*`

## 背景

issue 298 曾把「整体迁移到知识盒」搁置，卡点是**候选索引归属**：知识盒自身没有索引能力，
切块 / 嵌入 / 向量检索内核（约 2000 行）全在 secondbrain——自建索引要把内核上提共享层，
借用第二大脑索引则会在「`secondBrainAllowPaths` 白名单未含文献目录」时**静默失效**
（默认白名单为空 = 什么也不录，用户不配就零关联且毫无提示）。

2026-09-15 用户给出新边界，恰好同时解掉这个两难：**三个盒子主动进第二大脑向量化、无需指定**。
白名单不再是用户手配项，「借用索引会静默失效」的前提消失；于是「改到知识盒中」可以只迁**归属**
（设置组 + 命令），不迁内核。用户同时划了两条线：**自动关联两端都限三个盒子**；**第二大脑自身的检索不做限制**。

## 决策

### 1. 正名「自动关联」，迁归属不迁内核

- 用户概念词从「自动双链」正名为**自动关联**（设置组标题、命令名、文档用词一律改；代码内标识 `linkAgent*` 不变）。
- 迁：`第二大脑设置` 的「自动双链」组 → **知识盒设置页「自动关联」组**；两条建链命令 → 知识盒域
  `bz-knowledge-relink`（重跑当前笔记关联）/ `bz-knowledge-link-all`（为未关联笔记批量补链）。
  `bz-secondbrain-rebuild-index`（重建索引）**留第二大脑**——它是检索本体，不是关联。
- 不迁：引擎代码留 `src/secondbrain/link-agent/`，向量索引留 `src/secondbrain/`，知识盒仍经
  `core/link-now.ts` 的 LinkBridge 消费（issue 309 已建好的接线口）。
- 理由：域隔离（ADR-0002）下搬引擎必须把切块 / 嵌入 / 向量检索内核上提 core（issue 298 已否），
  而迁移的收益（归属感）由设置组与命令的搬迁即已兑现。**「改到知识盒」是功能归属，不是代码位置。**

### 2. 范围恒为三盒，两端都限，手动不再豁免

- 三盒 = `knowledgeDirectory`（文献盒）+ `knowledgeCardboxDirectory`（卡片盒）+ `knowledgeTopicDirectory`（主题盒）。
- **两端都限**：被处理端（落盘监听 / 存量补链 / 死链清理）与候选端（向量近邻召回）都只认三盒。
  候选不再「来自白名单索引库的全部笔记」（ticket 116 口径作废）。
- **口径反转**：手动命令与知识盒显式通道**不再豁免范围**。原注释「手动触发即显式意图：不受范围限制，
  任何笔记可跑」作废——跑盒外笔记（如旧卡片盒）直接拒绝并提示。
- `linkAgentScopes` 键**退役**：范围不再可配，onload 忽略旧值（本机旧值「文献盒」不迁移）。
  设置面板里不再有「关联范围」选择行。
- 旧卡片盒（改名后 `卡片盒2`，1503 篇）在三盒之外，不进索引、不被写 related——它按 ADR-0137 的
  「命名对齐」路径逐步整理进文献盒，不靠自动关联收编。

### 3. 三盒恒含索引，`secondBrainAllowPaths` 降级为「额外目录」

- 向量索引白名单 = **三盒（无条件）+ `secondBrainAllowPaths`（额外目录）**。三盒路径改了自动跟随，
  用户无需指定任何东西。
- 白名单键保留但语义变更：从「唯一语料来源」变成「三盒之外还要纳入检索的目录」（如 `归档/网页剪藏`）。
  onload 时把值里的三盒条目**自动剔除**（幂等，不写回脏值）。
- 连带退役：两处「请去补白名单」引导提示（`maybeGuideAllowPaths` / `guideIndexCoverage`）——
  三盒恒含后再无「目录不在白名单」的场景。
- **第二大脑自身的检索不做限制**：白名单里的额外目录照旧参与参考 / 对话语料；三盒是下限不是上限。

### 4. 三盒解析单源提到 core

- 新增 `core/knowledge-boxes.ts`：读三个 `knowledge*Directory` 设置键 + 目录归一化（反斜杠转正、去首尾斜杠、
  空值回落默认名），导出纯函数供两侧消费。
- 消费方：知识盒（面板展示 / 挂载上下文）、secondbrain（索引白名单 / 关联范围 / canvas 抽取范围）。
  ADR-0002 下 `core ← 域`，两侧零互引。
- 不做目录存在性探测：**空盒是合法状态**（空范围、空索引、不报错）。用户自建卡片盒前后都不该有警告。

### 5. canvas 只作候选来源

- 三盒内的 `.canvas` 抽节点文本进向量索引（可被召回、可当关联目标），**不写回**——canvas 是 JSON、
  没有 frontmatter，无处落 related。
- 索引文件来源从 `getMarkdownFiles()` 扩到「md + canvas」，`whitelistedFiles()` 与增量判据同步。
- 落盘监听只认 `.md`（`computeBackfillTargets` 的 `.endsWith('.md')` 不变）——canvas 不进被处理端。

### 6. 存量补链补「已尝试无关联」标记

- 现状：启动时每轮 `backfillMissingLinks` 的目标谓词是「范围内 `.md` + `related` 为空」，
  于是 **AI 判定「无实质关联」的笔记（related 始终为空）每次启动都会被重跑一遍**。
- 补：在 `link.state`（既有基准哈希机制）记一笔「已尝试且 0 条」——正文未变不再重试，改了自然会重算。

### 7. 保持项（**不动**，防后来者「顺手改」）

- **产出仍是 frontmatter `related`**（整篇↔整篇、单侧、幂等）：自动关联没有正文锚点，它就是整篇对整篇。
  这与「语义建议」不冲突——建议落 `mount-suggest.json`（数据文件）、固定后写**正文双链**，
  两条链路的存储与粒度都不同。
- **7 个设置键名不改**（`linkAgentEnabled` / `Scopes` 除外退役 / `TopK` / `MaxLinks` / `Notify` /
  `AutoClean` / `RespectRelated`）：`linkAgent*` 是管线实现名而非域名，域归属由设置组位置、命令 ID、
  代码位置体现；改键名 = 纯 churn + onload 迁移代码 + 测试面重排。
- **挂载树不区分「AI 写的 related」与「手写/落卡的 related」**：都算 `related` 来源（ADR-0137 §3 口径）。
  理由：挂载树里固定下来的 AI 建议走**正文双链**，本就不进属性；属性里的 related 语义保持「整篇关联」单一。

## 后果

- 触发侧恢复生效：vault md 新建 / 修改 / 删除监听按三盒过滤（范围不再为空），所以在卡片盒手写一张卡、
  改一段正文、在主题盒改一篇 md，防抖 60 秒后都会跑一轮 AI 裁判并往该篇写 related。知识盒录入面板的
  显式通道（preview / apply / now）与之并存。
- 主题盒（部叁）从「仅展示不写作」变成**会被写 related**——这是插件第一次往主题盒写东西；
  但只限 `.md`，canvas 不写。
- 「三盒」概念进入词表（见 CONTEXT.md「三个盒子」），「关联范围」这个词退出（范围不再可配）。
- 用户改盒子目录（知识盒设置页「目录与分类」组）= 索引范围与关联范围一起跟着变，旧盒不再命中白名单的
  条目由既有增量 refresh 清理；全量重建仍走 `bz-secondbrain-rebuild-index`。
- 本机迁移瞬间：卡片盒目录尚未创建（旧盒已改名 `卡片盒2`）→ 卡片盒这一块是静默空态，
  三盒实际生效 = 文献盒 25 篇 + 主题盒 16 篇 md（+ 11 canvas 作候选）。
