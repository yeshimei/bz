# ADR-0013 书库 EPUB 条目——统一列表 + 读 Weave 数据文件

状态：已实现（bz 1.0.0，2026-08）
日期：2026-08

## 背景

书库（Library）原只支持 markdown 书目（`书库/*.md` frontmatter）。用户决策：书库同时支持 EPUB 书目条目，展示卡片/列表与 markdown 一致；同名书与 markdown 条目**并列、互不影响**（不合并）。EPUB 数据从 Weave 阅读数据文件（`weave-data.json`）直读，不现场解析 EPUB。EPUB 侧缺的字段由 Weave 侧补齐（生产侧契约见 fork-weave-src `docs/adr/043`），bz 零推导直接消费。

## 决策

1. **数据通道**：设置项「Weave 数据路径」指向 weave-data.json 所在目录（默认值取 Weave 默认数据路径 `CONFIG/STORAGE`）；bz 直接读该 JSON，**不另建副本**。Weave 未启用或路径失效 → EPUB 条目部分静默缺省，markdown 部分照常。
2. **条目模型**：EPUB 条目复用 `BookItem`。字段来源：title/author/cover ← Weave（cover 用封面输出目录文件或数据文件中的封面路径）；status/readingProgress/readingTimeFormat/highlights/thinks ← Weave `.reading` / `.notes`；category 无来源 → 默认「未分类」；bookReview/readingDate/completionDate 无 → 空；sizeBytes ← EPUB 文件大小。
3. **并列语义**：与 markdown 同书并列、互不影响；本 ADR 不引入按书名合并/匹配逻辑。
4. **交互**：单击 EPUB 条目 → `workspace.openLinkText(epubVaultPath)`，由 Obsidian 按扩展名路由进 Weave 阅读视图（零耦合；`obsidian://weave-epub-reader?filePath=…` 为备选）。长按删除不作用于 EPUB 条目（不碰库内 epub 文件）；markdown 专属操作（复习/跳高亮）对 EPUB 条目不渲染。
5. **刷新**：监听 weave-data.json 的 vault 文件事件，变更即刷新 EPUB 条目。

## 实现位置

- `src/library/items.ts` — `getBookItems` 双源扩展（markdown + EPUB 条目）或新增 EPUB 条目构建
- `src/library/ui.ts` — 卡片渲染统一（EPUB 条目同一套字段）、单击跳转分支
- `src/settings.ts` / 书库域设置 — 新增「Weave 数据路径」

## 权衡

- **直接读 weave-data.json vs 自建副本**：选单源（无副本同步问题）；代价是耦合 Weave（未启用/路径失效时 EPUB 部分静默缺省，不崩溃）。
- **并列而非合并**：简化（无需书名匹配/映射）；代价是同书可能出现两个条目，用户已明确接受（互不影响）。

---

# 扩展一（2026-08）：阅读报告并入 EPUB + EPUB 读书笔记

状态：已实现（bz 1.0.0 fork）

## 背景

阅读数据分析报告（`bz-reading-report-open`）原只统计 markdown 书目（`getAllBookNotes`）。用户决策：报告并入 EPUB 书（全库 weave 书、不筛目录），缺字段由 Weave 补齐后 bz 直接消费；书库 EPUB 条目新增「读书笔记」（划线+想法按章节分组，双击跳原文、长按编辑想法/删除）。

## 决策

1. **报告并入**：报告数据采集层新增 `getEpubBookNotes`，把 weave 聚合映射为与 frontmatter 同形状的 book-note 条目后与原 `getAllBookNotes` 结果合并，`calculateReadingStats` 等纯函数零改动。映射口径：readingProgress ← percent；readingTime ← totalReadTime；readingSessions ← `reading.sessions`（Weave 只留 ≥5 分钟的会话，时长单位秒）；pages ← `floor(wordCount/500)`；highlights/thinks ← notes 计数；dialogue/outlinks ← 0；category ← 未分类；readingDate/completionDate ← lastReadTime/completedTime。
2. **读写边界**：报告/读书笔记**只读** weave-data（覆盖 md+epub 统计）；**修改/删除想法与划线 = bz 直改 weave-data.json**（用户决策 Q16——不走 Weave 命令桥）。这是 ADR-0013「bz 只读消费」的**唯一例外**：仅 `updateEpubNoteComment` / `deleteEpubNote` 两个写入口，只动目标高亮的 commentText / 整条高亮，其余文档结构原样写回。**竞态例外**：书正开着且 Weave 有未落盘内存态时可能被覆盖，属已知限制（写前重新读最新文档）。
3. **读书笔记交互（EPUB）**：单击封面 → 读书笔记弹窗（划线 `text` + 想法 `commentText` 按 `chapterTitle` 分组，缺省回退「第 N 章」）；双击划线块 → `openLinkText('<epub>#weave-cfi=<cfi>&chapter=<n>&sid=<sid>')` 跳原书；长按内容 → 编辑想法；长按日期 → 删除高亮。标题行单击/双击封面 → 打开阅读器（原交互保留）。
4. **深链格式**：与 Weave 溯源链接一致（`weave-cfi` 参数、`[`/`]`/`|` 做 wikilink 编码），bz 现算不依赖 Weave 导出。

## 实现位置

- `src/reading-report/stats.ts` — `getEpubBookNotes` / `mapWeaveSessionToReport` / `buildEpubBookNoteEntry`
- `src/reading-report/index.ts` — 报告前合并 EPUB 条目
- `src/library/epub-notes.ts` — 读书笔记数据加载 + `buildEpubJumpLink` + 直改 weave-data（编辑想法/删除划线）
- `src/library/ui.ts` — EPUB 封面单击 → 读书笔记弹窗、双击封面/标题单 → 阅读器；`showEpubBookNotes` / 章节分组渲染 / 双跳 / 长按编辑删除

## 权衡

- **直改 weave-data.json vs 命令桥**：用户选直改（最简单）；代价是与 Weave 内存态可能的竞态覆盖（已记录，不做锁）。
- **报告口径独立**：报告总时长（累计 totalReadTime）与 heatmap 会话时长（只留 ≥5 分钟）天然略有差异，属正常现象不修。
