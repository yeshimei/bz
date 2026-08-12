# 0016 书内选区录入——黑匣子 × EPUB 阅读器跨插件契约（附冻结格式显式扩展）

黑匣子（bz 第 19 域）与 EPUB 阅读器（weave-epub-reader / fork 构建）之间的跨插件集成（grilling 会话 2026-09 定稿，ticket 07）：阅读器**选区工具栏**常驻「🧩 概念」「📎 摘抄」两按钮，点击打开黑匣子录入弹窗（文字锁定、来源=阅读器双链 `[[书路径#weave-cfi=…|书名]]`）；黑匣子主面板列表中来源可点击跳回书内原文位置。方向：**weave 是提供方，bz 是消费方，weave 不依赖 bz**（bz 缺失时按钮置灰不隐藏）。

**Considered Options**：
- ① 挪用现有 host 契约（`openCreateCardModal` / `openIRReadingPointFromExternalSelection`）→ 语义不同（属主 weave 插件的卡片/阅读点系统），且 `composeEpubHost` 按 key 第一个 host 优先，bz 注册会抢占主 weave 能力。否，改**新增两个 capability key**（`captureConceptFromEpub` / `captureExcerptFromEpub`，共用输入 `{filePath, selectedText, sourceLink}`），主 weave 无此 key 天然隔离。
- ② 按钮显隐：能力探测隐藏 vs **常驻置灰**（用户拍板：不隐藏，bz 缺失 disabled + tooltip）。
- ③ 概念来源：新字段 vs **复用冻结字段 `links`（单值约定）**——ADR-0013 字段冻结不可破；links 语义（URL 或 [[笔记]]）天然匹配 epub 双链。笔记关联区在 `- 关联：` 下方新增 `来源：` 行（ADR-0015 冻结笔记格式的**显式扩展**，build/parse 成对修改保 round-trip 无损——解析器现状会剥离 `来源：` 行而不回写，手改即丢，必须修对）。
- ④ 列表跳转：bz 自写 subpath 解析 vs **weave 公开 API**（接收完整双链，内部解析 + 校验 + NavigationHub 定位，复用现有 `navigateToEpubLocation`）——`weave-cfi=` / compact 两种定位符归 weave 一处解析，避免双份实现漂移。

**Consequences**: 新契约 key 与公开跳转 API 属 weave 公共表面，命名/签名变动影响 bz，改动需两仓库同步；概念来源单值约定 = links[0] 为「来源」，其余 links 保持原语义；摘抄 `source` 字段新增「epub 双链」第三种取值形态（URL / `[[笔记]]` / epub 双链），旧数据零迁移；书内录入无原位注入（epub 不可写，注入逻辑不改，依赖编辑器选区快照为 null 自然跳过）。
