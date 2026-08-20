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
