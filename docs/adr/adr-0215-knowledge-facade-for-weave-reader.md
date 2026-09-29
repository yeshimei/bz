# ADR-0215 · 知识盒对外最小门面（fork-weave 阅读器调用）

日期：2026-09-29 · 状态：已采纳 · 关联：ADR-0112（知识盒三部枢纽）、ADR-0116（TermSource 来源）、ADR-0144（域内契约 API 模式）、weave 侧 ADR-046

## 背景

bz 历来无跨插件 API：域间复用走动态 import + typeof 守卫，跨插件只有 weave-data.json 文件级盲读（bookshelf/smartcat）。fork-weave（EPUB 阅读器 fork）此前自行复刻文献笔记面板与八键格式，随知识盒域进化开始与 bz 漂移，且复刻代码进入了其公开仓库。

## 决策

在插件实例上挂**最小门面**（onload 时 `plugin.knowledge = { openTermNote, openPassageNote }`，懒初始化）：直接暴露 knowledge 域既有导出，prefill 即 `KnowledgeEntryPrefill`（text/source/onCreated，全可选）；不挂 window 全局、不新增命令、不新增设置。对外契约约定：

- source 以 kind:'note' 传入时，path 是**不透明链接串**——可含 `#` 子路径（weave 传 `书文件路径#weave-cfi=…&chapter=N&eid=…`，实测序列化与点击回跳成立）；bz 不校验 TFile、不解释子路径语义。可选 `name` 透传为展示名（TermSource 本有 name 字段，prefillSource 此前丢弃、随本 ADR 补齐；缺省 bz 侧回退 path 的 basename）。
- onCreated 存在时保存后不自动打开新笔记（既有行为，此处升格为契约）。

## 后果

门面成为对外契约：函数签名与 `KnowledgeEntryPrefill` 字段变更需按破坏性变更对待（调用方以 typeof 守卫 + 版本门禁降级）。不承诺图版/影像/主面板等其他入口对外。weave 侧自此不再复刻 bz 面板，其公开仓库不再含 bz 源码副本。
