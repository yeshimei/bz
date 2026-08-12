# PROGRESS — 黑匣子域（blackbox-suite-plugin）

> 进度恢复点。每次重要节点更新。唯一事实源 = `.scratch/blackbox-suite-plugin/spec.md`（v3 笔记化）。

## 2026-08 · grilling 会话落盘（v3 笔记化架构）

**会话产出**：spec.md 重写为 v3（笔记化 + 双链 + 实时同步）、ADR-0015、CONTEXT.md 更新（黑匣子/来源笔记/三类条目词条）、本文件。

**最终决策速记**（详见 spec.md）：

- 三类条目笔记化落盘 `黑匣子/概念|摘抄|想法/*.md`，**笔记即事实源**（ADR-0015）；blackbox.json v3 = 派生层 + id→路径索引
- 双链：摘抄→`[[来源]]`+`[[概念]]`、概念↔关联、想法→`[[摘抄]]`；来源笔记选区内原位注入 `[[目标|原文字]]`（铁律 #1 显式豁免 + 四重守卫）
- 标题：摘抄/想法 AI 生成（失败降级前 20 字），概念 = 概念名；文件名冲突 `-N`
- 实时同步：metadataCache changed + vault rename/delete/create → 索引重建 + 面板 refreshAll
- 录入：概念双输入（名 + 文本，文本空→生成卡片 / 非空→确定录入）、正文 textarea 自适应 ≤8 行、选中文字自动填充锁定（只读）
- 命令：+3 直达命令 `bz-blackbox-capture-concept/-literature/-thought`（保存即关）；`bz-blackbox-capture` 保留
- 面板：标题「黑匣子」；搜索框默认隐藏、🔍 在 ⚙️设置 前切换、隐藏即清空关键词
- 定位（loc 行级跳转）与悬浮回显**砍掉**（双链替代，用户决策）
- 迁移：v2 → v3 load 时自动、幂等（entries → 笔记，概念=名/其余=前 20 字，失败条目重试）

**待实现 tickets**（已落盘 `issues/01-06`，依赖序）：

```
01 数据层笔记化（expand，无依赖）
 ├─ 02 概念录入改造（双输入/按钮判定/锁定/直达命令）
 ├─ 03 摘抄/想法录入（AI 标题/两直达命令/旧命令收尾）
 ├─ 04 主面板微调（标题「黑匣子」/搜索切换）
 └─ 05 实时同步（metadataCache/vault 事件）
06 来源笔记原位注入（依赖 02+03）
```

前沿 = 01；01 完成后 02/03/04/05 并行；最后 06。

## 2026-08 · ticket 01 数据层笔记化完成（1069 测试全绿）

- **v3 数据层**（`src/blackbox/data.ts` 重写 + 新 `notes.ts` 笔记引擎）：blackbox.json v3 = 派生层 + `index`（id→路径），entries 不落盘；load 时 v1/v2 自动迁移为笔记（幂等、单条失败留原数据段下次重试、崩溃孤儿同 id 跳过重写），v3 按索引水合条目（缺失文件/解析失败跳过保留索引）+ 孤儿自愈（黑匣子/ 下手写 bb 笔记自动入索引并持久化）。
- **笔记引擎**（`src/blackbox/notes.ts`）：frontmatter（id/type/createdAt/外壳 + toward/links 兼容扩展 + 卡片盒可选字段）冻结格式；正文关联区 = 与正文空行分隔的末尾连续行块（`- 关联：`/`来源：`/`关联概念：`/`来自：`）；`[[名]]` 解析回 id（概念名→id 反查，未解析 → pendingLinks 待补链）；文件名非法字符清洗 + `-N` 去重；标题 = 概念名 / 正文前 20 字（AI 标题 ticket 03）。
- **写入路径全笔记化**：addEntry/addEntries（批量导入）写笔记+索引；deleteEntry 删笔记 + 引用清理（related/terms/from）重写相关笔记；backfillRelated 反向关联重写既有概念笔记；resolvePendingLinks 改为水合推导（pending 名已随关联区落盘）。
- **内存接口不变**：主面板/对话/复盘/事件提炼/AI 零改动（除 import-cardbox 写路径），既有测试在笔记数据源下保持绿色。
- 测试：tests/blackbox 120→137（+17：迁移落盘断言/幂等/失败重试/孤儿自愈/pendingLinks/去重清洗/roundtrip/delete 引用清理）。

## 2026-08 · ticket 02 概念录入改造完成（1077 测试全绿）

- **直达命令** `bz-blackbox-capture-concept`「概念录入」（icon brain，main.ts COMMANDS + smoke 清单 +1），跳过类型选择直达概念页，保存后直接关闭（可连续快速录入）。
- **双输入**：概念名单行 input（`bz-blackbox-concept-name`）+ 定义 textarea（`bz-blackbox-concept-def`，auto-grow ≤8 行复用 memo 先例）；主按钮按文本输入框内容判定——空→「✨ 生成卡片」/ 非空→「✅ 确定录入」，无 generated 标志、无重新生成入口；清空文本按钮回「生成卡片」。
- **选区锁定**：core 新增 `src/core/selection.ts`（getSelectionSnapshot：选中文字 + 行/列起止快照 + 来源笔记路径；无选区/读取失败 → null，ticket 06 注入复用）；打开时快照一次，概念名自动填充且只读（readonly + `.bz-blackbox-locked` 虚线样式），锁定态 input 事件不生效。
- 生成卡片：AI 写定义进文本输入框（可编辑）；AI 不可用降级定义=概念名可编辑（永不拒收）。引导式 `bz-blackbox-capture` 概念连接展示保留。
- 测试：capture +4（直达保存即关/锁定只读/无选区手动+内容判定/清空回生成）；tests/core/selection.test.ts +4。

## 2026-08 · ticket 03 摘抄/想法录入完成（1083 测试全绿）

- **直达命令** `bz-blackbox-capture-literature`「摘抄录入」(icon bookmark) / `bz-blackbox-capture-thought`「想法录入」(icon lightbulb)，保存后直接关闭；`bz-blackbox-capture-concept` 同批落地（ticket 02）。
- **摘抄**：选区自动填充摘抄文本锁定只读 + 来源自动填 `[[来源笔记]]`；📋分析名词 AI 返回新增 `title`（标题建议，≤20 字）；名词表勾选落盘为正文关联区双链。
- **标题规则**：Entry 新增可选 `title`；保存时解析——分析标题优先 → AI 生成（ai.suggestTitle/buildTitlePrompt，纯文本输出）→ 降级正文前 20 字；文件名清洗 + `-N` 去重沿用引擎；水合时从文件名回填 title（noteNameFromPath）。
- **提炼想法**：非空时同一次保存写独立想法笔记，`from: 摘抄 id` → 笔记底部「来自：[[摘抄标题]]」双链；水合 nameToId 解析回 id。
- 引导式 `bz-blackbox-capture` 保存路径不变（ticket 01 已切笔记），标题生成同样生效。
- 测试：capture +6（摘抄直达填充锁定/分析标题落盘/AI 标题与降级/提炼想法双链/想法直达两路径）；ai +1 断言（parseLiteratureJson title 字段）。

## 2026-08 · ticket 04 主面板微调完成（1086 测试全绿）

- 面板标题只显示「黑匣子」（无 🕳️、无「N 条内容」）；`#bz-blackbox-panel-title` DOM id 保留。
- header 动作区 ✏️👤🕐 → 🔍（⚙️设置 前）→ ⚙️ → ❌；🔍 点击切换搜索框显隐，显示时高亮（.bz-blackbox-icon-on），隐藏即清空已输入关键词并立即重渲染（防抖前也生效）。
- 搜索框默认隐藏（`#bz-blackbox-search-wrap` display none），显示时宽度 100%、自动聚焦；每次打开面板回到默认隐藏（open 两路径均重置 searchVisible）。
- 测试：panel +3（切换显隐高亮/隐藏清空重渲染/防抖过滤语义不变）；旧断言更新（标题/按钮顺序 6 个）。
- **注意**：`notes.ts` 关联区解析约定——正文与关联区以空行分隔（无正文时保留空行），引用归属「来源：」行若与正文无空行分隔则视为正文不被剥离（有专门测试）。
