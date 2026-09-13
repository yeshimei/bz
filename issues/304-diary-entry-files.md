# issue-304：日记一目一文件迁移——条目独立成笔记 + 单源格式契约

- 分支：feat/diary-split ｜ 日期：2026-09-13
- 来源：grill-with-docs 多轮拍板（2026-09-12~13，属性清单/全域影响勘察/英文冒号实测）
- 关联：ADR-0130 / ADR-0115（日记本媒体墙）/ ADR-0030（小橘 per-entry 结算）/ ADR-0054（日记体检退役重定义）

## 背景

现行日记是「一天一文件多条目」：`我的/日记/YYYY-MM-DD.md` 内以 `# emoji序列 HH:mm` 一级标题切条目。用户拍板迁移为**一目一文件**：每条日记独立成一篇笔记，标题/文件名即日期时间，类型进笔记属性，正文原样保留。全库盘点：522 个日期文件（2023-04~2026-08）、1241 条日记（单日最多 14 条）、84 条多类型、464 行 #人名/书名 行、加密日记条目 0 条、同刻重复 3 例（2024-08-22 00:00 / 2023-11-30 00:00 / 2024-03-30 00:49）；`CONFIG/STORAGE/smartcat-memory.json` 有 2476 条日记引用需重写路径段。

## 用户拍板记录

1. 属性只有两个：`日期`（合并日期+时间，值 `YYYY-MM-DD HH:mm` 英文冒号）+ `类型`（**多值** YAML 列表，存标签名不带 emoji）。
2. 不需要 `标签`/`星期`/`来源` 属性；正文中的 #人名/#书名 行**留在正文**；正文除去掉一级标题外原样不动。
3. 文件名按 `2026-03-23 12:32` 模式；英文 `:` 在 NTFS 非法（实测 ENOENT），文件名用 `-` 连接、**属性值保留英文 `:`**。
4. 原日期文件迁移后归档至 `归档/日记/`；`我的/其他/` 下 5 篇非日期笔记不动。
5. 日记墙必须继续显示全部条目 → 插件解析/写层随格式重构（不是纯脚本迁移）。
6. 解析层**不做**旧格式兼容、不做双分隔符兼容。

## 方案

1. **契约单源 `src/core/diary-format.ts`（新）**：`DIARY_ENTRY_FILE_RE`（`^(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})(?:-(\d+))?\.md$`）、`diaryEntryBaseName/diaryEntryPath/diaryDateFromEntryPath`、`isValidDiaryDate/isValidDiaryTime`、`serializeDiaryEntryFile`（`---\n日期: D T\n类型:\n  - tag\n---\n\nbody\n`）、`parseDiaryEntryFile`（meta 日期非法 → null 但仍提取类型；容 CRLF/引号/行内数组）。落 core 依据 ADR-0002（6 消费方 diary/smartcat/recap/home/encrypt/path-classify 全在其下游）。
2. **diary 域**：parser 增 `parseEntryFile`（日期时间 = frontmatter ?? 文件名降级；标签 = frontmatter ?? ['日记']；emoji 由标签派生；lineNumber=0）；store 重写为条目文件粒度（addEntry/removeDiaryEntries/updateDiaryTags/listDateEntries/findDiaryEntry；每路径串行队列 + 队内撞名复检，同刻第二篇 `-2` 后缀）；encrypt 块格式 v2 `# 标签名/标签名 HH:mm`（加密/解密/还原对齐）；repair 改只读体检（unparsable/legacy/name-mismatch），修复面板退役为体检面板；跳转/复制链接改文件级锚点。
3. **跨域**：encrypt `mergeDiaryBlock`（还原日记 → 条目文件序列化 + 后缀让位 + 同内容幂等跳过）；smartcat 四文件（diary-source/index/note-memory/dashboard）改走新契约，记忆 ref `path#HH:mm` 只重写路径段、定位符保留；recap（aggregate/summarize/ui）AI 摘要写回改 addEntry + 旧摘要清理；home/river streak 按日文件名前缀判定。
4. **迁移脚本 `scripts/diary-split.mjs`（dry-run 默认）**：拆分 522→1241 + smartcat-memory.json 引用重写（去重）+ 报告落 `.scratch/`；`--apply` 实写。**必须关 Obsidian 执行**（插件运行时会竞写 smartcat-memory.json 并对新文件重复入库）。顺序：先迁移后部署（解析层无旧格式兼容）。
5. **测试**：core/diary-format 契约组 + diary parser/store/encrypt/repair/data + smartcat diary-source/note-memory/diary-action/index-cov + recap summarize/aggregate/ui + smoke 同步。

## 验收

- 迁移后日记墙 1241 条全显示、点击跳对应条目文件；写入/改标签/删除/加密/解密全链路走新格式。
- 小橘记忆面板引用可打开对应条目文件；首页 streak/周报不回退。
- 全库迁移 dry-run 报告零丢失（条目数 1241、字数守恒）；原文件归档 `归档/日记/`。
- 门禁全绿（pnpm test + tsc --noEmit + 自审 + diff 审查 + 主仓构建）。
