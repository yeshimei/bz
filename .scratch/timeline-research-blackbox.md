# 「黑匣子」事件时间线模块 —— 社区设计调研

> 调研范围：Obsidian 社区（Reddit r/ObsidianMD、Obsidian 论坛、社区插件）、Timeline / Life-logging / Journaling 应用与开源项目。聚焦「从日记条目自动提炼事件并按时间组织成时间线」这一场景。以下每节先给「社区做法」，再附「具体来源 URL」；文末给「推荐设计要点」。

---

## 1. 事件的数据模型（事件是什么 / 字段 / 与日记条目的关系）

### 社区做法

**事件本质是「有明确时间锚点的、可独立呈现的语义单元」，而不是整条日记。** 社区主流不把「一条日记」当作一个事件——因为一条日记通常包含多个不同时刻、不同主题的内容。多份来源都支持「一条日记 → 多个内联事件」。

- **obsidian-auto-timelines（April-Gras）**是事件数据模型的直接范例：事件通过 frontmatter 字段独立声明，核心是「必须有起始日期，可选结束日期」，外加标题、正文、图片覆盖字段。这套字段就是事件的完整骨架：
  - `aat-event-start-date`（必填）、`aat-event-end-date`（可选，`true` 表示贯穿整条时间线）
  - `aat-event-title`（覆盖卡片标题）、`aat-event-body`（覆盖卡片正文）、`aat-event-picture`
  - 关键：**该插件支持「内联事件」（`)%%aat-inline-event %%`）——在一条笔记内部声明多个事件，每个事件以所在位置为起点向下解析**，也就是说同一文件 = 多个事件，这是真实、已被验证的做法。
  - [GitHub: April-Gras/obsidian-auto-timelines](https://github.com/April-Gras/obsidian-auto-timelines)

- **Dataview「track last time an event happened」论坛讨论**直接演示了「一条日记多个事件」的建模惯例：在列表项内联标注 `(event:: litterbox) (time:: 10:30)` 多次重复，用 `filter(file.lists, l => l.event = "litterbox")` 提取。事件是**可重复出现、可按名称聚合的东西**，time 只是它身边的一个属性。
  - [Obsidian Forum: Dataview - track last time an event happened](https://forum.obsidian.md/t/dataview-track-last-time-an-event-happened/48715)

- **simple-graph-builder（junhewk）**从知识图谱角度给事件下了精确定义：`EVENT` 是 10 个固定实体类型之一（"Meetings, conferences, milestones"），与 `PERSON`/`PLACE`/`EMOTION` 等并列。这提示「事件」应当是**带类型的实体**，而不是自由文本标题。它还用**免费的主动关系动词**（develops / causes / leads to / contains）把事件连到人物、地点，`detail` 字段装细粒度上下文——这正是「事件 ⇄ 人物画像」联动的数据模型雏形。
  - [GitHub: junhewk/simple-graph-builder](https://github.com/junhewk/simple-graph-builder)

**事件字段设计共识（跨多来源归纳）**：`标题/类型`、`起始时间`（必须）、`结束时间`（可选）、`参与人物`（复数）、`情绪/情感标签`、`地点`（可选）、`来源笔记引用`。其中「时间」是最容易被类型错配坑到的字段（见第 5 节）。

### 来源 URL
- [GitHub: obsidian-auto-timelines](https://github.com/April-Gras/obsidian-auto-timelines)
- [Obsidian Forum: Dataview - track last time an event happened](https://forum.obsidian.md/t/dataview-track-last-time-an-event-happened/48715)
- [GitHub: simple-graph-builder](https://github.com/junhewk/simple-graph-builder)

---

## 2. 时间线组织（按日/月/年聚合、排序、推测事件的呈现）

### 社区做法

**时间线 = 单一日历时间轴上的卡片流；聚合层次（年/月/日）由渲染层决定，数据层保存最细的「时间戳 + 粒度」即可。**

- **obsidian-auto-timelines** 的时间线本体是 markdown 代码块`aat-vertical`，渲染成纵向卡片。它按**日期令牌（date token）分组优先级**控制展示精度——同一份数据，可显示到 `day` 级，也可（在 fantasy 日历里）显示到 `cycle/moon/phase`。**排序支持升序/降序**，并允许「某条时间线单独覆盖全局日期显示格式」。启示：**聚合层级是视图配置，不是数据建模问题**。
  - [GitHub: obsidian-auto-timelines](https://github.com/April-Gras/obsidian-auto-timelines)
  - [Pkmer 中文解读: April's Automatic Timelines](https://pkmer.cn/Pkmer-Docs/10-obsidian/obsidian%E7%A4%BE%E5%8C%BA%E6%8F%92%E4%BB%B6/readme/aprils-automatic-timelines_readme/)

- **recklyss/markdown-timeline** 是另一种思路：**时间线由自动降级精度的日期渲染**——`YYYY-MM-DD` 完整时显示全格式，只有年/月时自动省略月份和日期（`-500` → 年only，完整 → `March 15, -500`）。这直接回答了「**事件时间不精确时如何呈现**」：**按可用精度渐进显示，不强行补不存在的字段**。
  - [GitHub: recklyss/markdown-timeline](https://github.com/recklyss/markdown-timeline)

- **Vertical Timeline Dataview** 论坛贴展示了一种**纯抓取 + 视图**缝合思路：从笔记 frontmatter 抽日期、在一条专门的时间线笔记里用 Dataview 渲染。社区把它和 Auto Classifier 等结合，形成「数据在 frontmatter、视图在脚本」的轻量分层。

- **Kageetai/obsidian-plugin-journal-review** 提供「On this day / 每年今日」这种**跨年份的周期聚合**（1 个月 / 6 个月 / 每年回顾），说明时间线聚合不仅是线性堆叠，还包括「**同一情感/主题的周期回访**」。
  - [GitHub: Kageetai/obsidian-plugin-journal-review](https://github.com/Kageetai/obsidian-plugin-journal-review)

### 来源 URL
- [GitHub: obsidian-auto-timelines](https://github.com/April-Gras/obsidian-auto-timelines)
- [GitHub: recklyss/markdown-timeline](https://github.com/recklyss/markdown-timeline)
- [Obsidian Forum: Vertical Timeline Dataview](https://forum.obsidian.md/t/vertical-timeline-dataview-pull-dates-from-notes-and-visualize-them-in-a-vertical-timeline-note/115584)
- [GitHub: Kageetai/obsidian-plugin-journal-review](https://github.com/Kageetai/obsidian-plugin-journal-review)


---

## 3. AI 提炼的准确性与防幻觉（推测标记、置信度、用户编辑、改后不被覆盖）

### 社区做法

**这个方向社区的核心共识是：AI 生成物必须可逆、可验证、可分离来源，且绝不静默覆盖用户手改内容。**

- **SANE（Smart AI Note Evolution）**是最完整的范本，直接可搬给「黑匣子」：
  - **所有 AI 生成字段统一加前缀 `sane_`**（`sane_tags/sane_keywords/sane_summary/sane_links`），并且**可以一键整体移除**——AI 输出与用户内容物理隔离。
  - **原始笔记内容绝不被修改**（只写 frontmatter 的独立字段），这是防覆盖的硬保证。
  - 提供**范围限制（只在指定文件夹处理）**、**每日预算与成本实时追踪**、**立即/延时/定时/手动多种触发**——防止无上限 API 烧钱和无差别处理。
  - [GitHub: ChenziqiAdam/SANE](https://github.com/ChenziqiAdam/SANE)

- **journal-recap / Periodic Notes Synthesizer** 透露两点工程细节：AI 摘要**写进 frontmatter 独立字段**，settings 里**允许自定义 prompt 和 response schema（structured output）**；请求用 `store:false` 不给服务商留存。`journal-recap` 明确用「排除 frontmatter 的正文」作为输入、structured schema 约束输出——**「structured output + schema 校验」是防跑偏的第一道闸**。
  - [GitHub: aegerita/journal-recap](https://github.com/aegerita/journal-recap)
  - [GitHub: ibrh96-prog/obsidian-periodic-notes-synthesizer（论坛 Thread）](https://forum.obsidian.md/t/i-shipped-my-5th-obsidian-plugin-it-synthesizes-your-daily-notes/115352)

- **simple-graph-builder** 把「防幻觉/防污染」做到位了，是最值得借鉴的一层：
  - **每次抽取都带 JSON schema，且对返回做 schema 校验，畸形实体直接丢弃而不放进来污染图谱**——「垃圾进库」被硬拦截。
  - **实体消歧/去重是多级管线**：`快速缓存 → 精确名 → 别名哈希 → 嵌入相似度(>0.90 自动合并) → LLM 人工裁决(0.80–0.90 模糊区间) → 新建`。这给出了**置信度区间如何映射到动作**：高置信自动、中置信交给裁决（可人工介入）、低置信新建观察。
  - **手动合并**（把重复实体并作别名）——AI 错了用户可以手工纠。
  - [GitHub: junhewk/simple-graph-builder](https://github.com/junhewk/simple-graph-builder)

关于「用户改过之后 AI 不再覆盖」：社区直接做法有两条兜底——(a) 把 AI 产物放进 `sane_` 之类**独立命名空间字段**，与用户手写内容不冲突；(b) 对已经人工编辑过的条目做**「人工锁定」标记**（如 `human_edited: true`），AI 重跑时跳过。SANE 的「反转化移除」与 simple-graph-builder 的「schema 校验 + drop」结合，就是对「错误项」与「覆盖」两个问题的完整答案。

### 来源 URL
- [GitHub: ChenziqiAdam/SANE](https://github.com/ChenziqiAdam/SANE)
- [GitHub: aegerita/journal-recap](https://github.com/aegerita/journal-recap)
- [GitHub: junhewk/simple-graph-builder](https://github.com/junhewk/simple-graph-builder)
- [Obsidian Forum: I shipped my 5th plugin, synthesizes your daily notes](https://forum.obsidian.md/t/i-shipped-my-5th-obsidian-plugin-it-synthesizes-your-daily-notes/115352)

---

## 4. 事件与人物画像、情绪、复盘的关系（如何联动）

### 社区做法

**事件是「连接器」：一条事件把时间、人物、地点、情绪串联成一个小簇；画像与情绪是事件的聚合视图，复盘是跨事件的周期叙事。**

- **simple-graph-builder** 的事件即图节点，用**带类型的主动关系动词**连到 `PERSON`/`PLACE`/`EMOTION` 等单位，事件上挂 `detail` 上下文。这正是「画像/情绪/事件」联动的最小闭环——**人物画像 = 所有关联事件 + 关系动词的聚合**，情绪可建模为事件的一个属性维度。
  - [GitHub: junhewk/simple-graph-builder](https://github.com/junhewk/simple-graph-builder)

- **Periodic Notes Synthesizer** 提供「**人物/主题的跨时间观点聚合**」与「**said-vs-did**（过去承诺 vs. 后续实际记录）对照」——这是时间线向「复盘」演进的直接路径：把散在多个日期的同一人物/主题事件拉平对比，就能产出矛盾检测与复盘。
  - [Obsidian Forum: I shipped my 5th plugin, synthesizes your daily notes](https://forum.obsidian.md/t/i-shipped-my-5th-obsidian-plugin-it-synthesizes-your-daily-notes/115352)
  - [GitHub: ibrh96-prog/obsidian-meeting-notes-synthesizer](https://github.com/ibrh96-prog/obsidian-meeting-notes-synthesizer)

- **obsidian-emotional-time-capsule** 把情绪做成「**当时 vs. 现在**」的结构化对照（Then and Now）——说明情绪联动不单是打标签，而是**时间线上的前后对照**。这非常贴合「情绪聚合」：同一事件/主题在不同时间被何时提起过、情绪如何变化。
  - [GitHub: ibrh96-prog/obsidian-emotional-time-capsule](https://github.com/ibrh96-prog/obsidian-emotional-time-capsule)

**联动的数据化建议（跨来源归纳）**：事件节点持有 `people[]`（外链到人物画像）、`emotion` / `emotional_tone`（标签或 0-1 倾向）、`source_note`（回链到日记原文）。画像和情绪不做独立存储的第二份拷贝，而是**基于事件的实时聚合视图**——这样事件改了，画像/情绪自动跟随，避免多份数据失同步。

### 来源 URL
- [GitHub: junhewk/simple-graph-builder](https://github.com/junhewk/simple-graph-builder)
- [Obsidian Forum: I shipped my 5th plugin, synthesizes your daily notes](https://forum.obsidian.md/t/i-shipped-my-5th-obsidian-plugin-it-synthesizes-your-daily-notes/115352)
- [GitHub: ibrh96-prog/obsidian-meeting-notes-synthesizer](https://github.com/ibrh96-prog/obsidian-meeting-notes-synthesizer)
- [GitHub: ibrh96-prog/obsidian-emotional-time-capsule](https://github.com/ibrh96-prog/obsidian-emotional-time-capsule)

---

## 5. 社区踩过的坑（重复事件、时间推断错误、事件与笔记脱节）

### 社区做法 / 已知坑

**坑 A：重复事件 / 实体碎片化（最普遍、最致命）**
- simple-graph-builder 作者在升级日志里披露过一个真实的坑：某 141 条笔记的库里，因 wikilink 把每个事件连到每个实体，产生 **188,097 条边（占 98%）**、数据文件高达 115 MB；修正后降到 7,449 条边 / 6.3 MB。**未消歧的朴素抽取会产生平方级冗余。** 另一个典型坑是 Unicode 没归一化导致「同一个中文/韩文实体拆成两个节点」（NFC vs NFD）。结论：**事件必须做去重（人名/事件名归一化 + 消歧管线）**，否则时间线上同一件事出现 N 次。
  - [GitHub: junhewk/simple-graph-builder（Upgrading to 0.5.0）](https://github.com/junhewk/simple-graph-builder)

**坑 B：时间被存成字符串导致排序错误**
- Obsidian 论坛反复出现：**frontmatter 里的 time 本质是文本字符串，`max()`/`min()` 按字母序而非时间序排序**（`"2:30pm"` vs `"10:30"`），导致「最后一次事件」返回错误。用户被迫在外面加 `date("2022-01-01T"+t)` 强转。启示：**AI 提炼事件时间时，必须解析为真正的 ISO/RFC 时间值（含日期），不能保留裸字符串**；「只有时刻没有日期」时要拼当天日期。
  - [Obsidian Forum: Dataview - track last time an event happened](https://forum.obsidian.md/t/dataview-track-last-time-an-event-happened/48715)
  - [Obsidian Forum: Properties: Add "time" as a property type](https://forum.obsidian.md/t/properties-add-time-as-a-property-type/77699)

**坑 C：缺失日期 / 精度不足 / 跨日事件算错**
- 论坛里用户追踪跨午夜事件（如 `11:30 PM to 1:30 AM`）时，必须在公式里手动 `+86400000` 处理跨日，非常易错。同时「没有结束时间」和「结束小于开始」被当成边缘情况手写分支。启示：**事件要有「起始精度」字段（年月日时分），不确定就降级，别猜一个精确时间**；跨日事件需显式处理。
  - [Obsidian Forum: Properties: Add "time" as a property type](https://forum.obsidian.md/t/properties-add-time-as-a-property-type/77699)
  - [GitHub: recklyss/markdown-timeline（自动降精度渲染）](https://github.com/recklyss/markdown-timeline)

**坑 D：事件与笔记脱节（不可溯源）**
- 多插件强调事件必须**回链到来源笔记**（`source_note` / wiki link）。journal-recap 用「排除 frontmatter 的正文」做输入、结果回写 frontmatter；simple-graph-builder 所有 `NOTE` 节点 `mentions` 抽取实体——**每个事件都指向产生它的原文位置**，否则 AI 提炼物变成「悬空数据」，用户无法核对。
  - [GitHub: aegerita/journal-recap](https://github.com/aegerita/journal-recap)
  - [GitHub: junhewk/simple-graph-builder](https://github.com/junhewk/simple-graph-builder)

**坑 E：API 成本失控 / 隐私**
- SANE 明确给「每日预算 + 实时成本 + 只处理指定文件夹 + 手动触发兜底」；多来源都在强调 bring-your-own-key 时「正文会上传服务商」是不可回避的事实边界。启示：**批量提炼要可取消、可限量、可本地（Ollama）**。
  - [GitHub: ChenziqiAdam/SANE](https://github.com/ChenziqiAdam/SANE)

### 来源 URL
- [GitHub: junhewk/simple-graph-builder](https://github.com/junhewk/simple-graph-builder)
- [Obsidian Forum: Dataview - track last time an event happened](https://forum.obsidian.md/t/dataview-track-last-time-an-event-happened/48715)
- [Obsidian Forum: Properties: Add "time" as a property type](https://forum.obsidian.md/t/properties-add-time-as-a-property-type/77699)
- [Obsidian Forum: Need help/advice re Date Property and Timelines](https://forum.obsidian.md/t/need-help-advice-re-date-property-and-timelines/109937)
- [GitHub: aegerita/journal-recap](https://github.com/aegerita/journal-recap)
- [GitHub: recklyss/markdown-timeline](https://github.com/recklyss/markdown-timeline)

---

## 6. 推荐设计要点（结合「黑匣子」：AI 自动提炼、轻量增量 + 手动聚合）

把上述社区做法落到「黑匣子」（只读 `我的/日记/*.md`、事件写入派生层 `blackbox.json` + 回链原文）的具体方案：

### 6.1 事件数据模型（落 `blackbox.json` 派生层，不碰日记原文）
- **一件事 = 一条记录**，核心字段：`id`、`title`（短）、`type`（行动/变化/时刻/里程碑）、`date`（ISO 时间值，**含日期**，裸字符串一律不做排序依据）、`date_precision`(`ymd`/`ym`/`y`，不确定就降级)、`start/end`（跨日事件保留，`end` 可空）、`people[]`（归一化后的人名，外链画像）、`emotion`（标签 / 0-1 倾向）、`tone`（可选）、`place`（可选）、`source_note` + `source_line`（**必填，回链原文可溯源**）、`status`（`ai_draft`/`human_reviewed`/`confirmed`）、`confidence`、`created/modified`。
- **一条日记 → 多个事件**：由 AI 逐段提炼为多条记录，与社区 `(event:: …)` 多内联事件的惯例一致。

### 6.2 时间线组织
- **视图分聚合层**：数据层只按时钟 `date` 排好；UI 提供「日/月/年」三档分组渲染（对齐 auto-timelines 的 date-token 优先级与 markdown-timeline 的自动降精度）。
- **推测呈现**：当 `date_precision` 只有月/年、或 `confidence` 低时，卡片**按可用精度显示、不强补**，并给「推测 / 待确认」视觉标识（如虚线框 + `~` 前缀 + 校验徽标），明确「这是 AI 猜的」。

### 6.3 防幻觉与防覆盖（直接抄 SANE + simple-graph-builder）
- **AI 产物独立命名空间**：所有 AI 生成事件带 `bb_` 前缀标记来源，可在「重置 AI 层」时**整体清除**，绝不改日记原文。
- **schema 强制结构化输出 + 校验**：抽事件用 JSON schema，返回不符合 schema 的畸形事件**直接丢弃**，不静默入库。
- **置信度分级处理**：`>0.9` 自动进入时间线；`0.6–0.9` 标记为「待确认」；`<0.6` 不进时间线，仅入「候选池」供用户勾选。允许用户对去重做**手动合并/删除/改字段**；被人工编辑过的记录写 `human_edited: true`，**AI 增量重跑时跳过**该条，杜绝覆盖用户修改。
- **去重管线**：人名/事件名先做 Unicode 归一化（NFC）再比对，加别名映射，从源头防「同一人拆两个节点」。

### 6.4 与画像 / 情绪 / 复盘联动
- 事件持有 `people[]` 与 `emotion`，**画像与情绪不做第二份拷贝**，而是「按事件实时聚合」：某人物画像 = 该人名下所有事件的时间线 + 情绪走势；复盘 = 周期内选定人物/主题事件的横向叙事 + said-vs-did（先承诺后落地）对照。事件改了，聚合视图自动跟随，不失同步。

### 6.5 增量提炼（贴合「轻量增量 + 手动聚合」）
- **按日增量**：只对 `modified` 变化过的日记条目做抽取（对齐 auto-summary 常驻监听思路），缓存抽取结果，重复项不重抽。
- **手动聚合**：提供「把本批提炼事件确认并沉淀进时间线」的人工闸门，AI 只产出 `ai_draft`，用户点确认才转 `confirmed`——把「自动提炼」与「交给用户裁决」解耦，正是社区的 settled 模式。
- **成本 / 隐私**：批量提炼可取消、可限每日预算，支持本地 Ollama；`date` 字段解析为真 ISO 值，杜绝字母序排序坑。

### 6.6 三条硬底线（社区踩坑的直接映射）
1. **时间必须是类型化时间值 + 精度字段**，不落裸字符串 → 防排序错误（坑 B）。
2. **每个事件必须回链原文行** → 防脱节、可核对（坑 D）。
3. **AI 层可整体回滚 + 人工锁定记录不被覆盖** → 防幻觉污染与用户修改被吞（坑 A/C/E 的一部分）。

---

## 附：调研中反复命中、可继续深挖的真实来源清单
- [GitHub: April-Gras/obsidian-auto-timelines](https://github.com/April-Gras/obsidian-auto-timelines) — 事件 frontmatter + 内联多事件 + 日期令牌聚合
- [GitHub: recklyss/markdown-timeline](https://github.com/recklyss/markdown-timeline) — 自动降精度日期渲染
- [GitHub: junhewk/simple-graph-builder](https://github.com/junhewk/simple-graph-builder) — EVENT 实体、schema 校验、消歧管线、冗余/Unicode 坑
- [GitHub: ChenziqiAdam/SANE](https://github.com/ChenziqiAdam/SANE) — `sane_` 前缀、可逆、成本控制、范围限制
- [GitHub: aegerita/journal-recap](https://github.com/aegerita/journal-recap) — structured schema + frontmatter 回写 + store:false
- [GitHub: ibrh96-prog/obsidian-periodic-notes-synthesizer](https://github.com/ibrh96-prog/obsidian-periodic-notes-synthesizer)（及[论坛 Thread](https://forum.obsidian.md/t/i-shipped-my-5th-obsidian-plugin-it-synthesizes-your-daily-notes/115352)）— 跨词条聚合、said-vs-did、open loops
- [Obsidian Forum: Dataview - track last time an event happened](https://forum.obsidian.md/t/dataview-track-last-time-an-event-happened/48715) — 一记多事件 + 字符串时间排序坑
- [Obsidian Forum: Properties: Add "time" as a property type](https://forum.obsidian.md/t/properties-add-time-as-a-property-type/77699) — 跨日事件 / 期间建模难
- [GitHub: Kageetai/obsidian-plugin-journal-review](https://github.com/Kageetai/obsidian-plugin-journal-review) — 周期回访聚合
- [GitHub: ibrh96-prog/obsidian-emotional-time-capsule](https://github.com/ibrh96-prog/obsidian-emotional-time-capsule) — 情绪前后对照
