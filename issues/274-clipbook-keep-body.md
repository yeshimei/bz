# issue 274：剪藏本已读/已收正文保留（可再阅）

日期：2026-09-11 ｜ 用户拍板（一句话需求）：已读的正文不会被清空，已读和已收的可以在剪藏本当中打开查看，使用 Obsidian 内部的 Markdown 渲染 ｜ 关联：issue 273（正文 MarkdownRenderer 化，本票在其上补数据层）

## §1 语义变更

- **正文保留（核心）**：标已读/已收（`markHandledAndBump`）与批量已读（`flowMarkAllRead`）不再 `delete body`——旧「已处理 → 清正文（防 news.json 膨胀骨架）」语义退役。news.json 体积增长由既有保留策略兜底（saved/skipped 超 N 天整条清理，逻辑不动，注释语义更新）。
- **打开查看**：会话目录（ADR-0108）已读段/已收段条目点开 → 右栏/移动详情直接渲染保留的正文；渲染走 issue 273 已落位的 Obsidian `MarkdownRenderer` 异步水合（本票零渲染层改动）。已收段命中剪藏目录的条目仍由剪藏笔记承接（懒加载 md 正文），未命中的（B 站转文献盒等）走 news body。
- **历史数据**：改动前已处理条目的 body 已被删、不可恢复，右栏/移动详情保留「正文已清空（已处理条目）」兜底文案。
- **收件流口径不变**：已处理条目仍不进收件流（`queryBySource` 过滤 `!a.read`）；仅会话目录分桶可再阅。
- **死代码同步**：`store.ts writeNewsState`（无插件内调用方）删 `body: undefined` 覆盖，语义对齐。

## 改动清单

- **数据层**：`flow.ts` 两处删 `delete next.body` + 顶部/函数注释更新；`store.ts` `writeNewsState` 删 body 覆盖 + 顶部注释更新；`news-data.ts` `applyRetention` 注释（骨架 → 整条清理含正文）；`types.ts` `ClipArticle.body` 注释。
- **UI 层**：`ui.ts` `markReadOnOpen` 注释（磁盘正文保留）；渲染与兜底文案零改动。
- **原型**：`prototypes/clipbook/prototype-behavior.js` 重出（行为单源，clipbook 域源指纹更新）。
- **测试**：`flow.test.ts` 三处断言翻转（body 保留）+ 新增「已处理正文保留（issue 274）」2 例（单篇已读 → 会话目录已读段可取正文 + 收件流口径不变；已收态未命中剪藏 → 已收段可取正文）；`write-queue.test.ts` 三处断言翻转（合并快照构造贴新行为）。

## 验收

- [x] 已读（单篇/批量）/已收/B 站分流回写后磁盘 body 保留；统计与状态位不受影响
- [x] 会话目录已读段/已收段条目派生携带正文（打开即渲染，MarkdownRenderer 水合既有链路）
- [x] 收件流仍只出未处理条目；保留策略超龄整条清理语义不变
- [x] 门禁：clipbook 域 135 例全绿；全量 pnpm test 4186 过 / 4 失败均为 preview-freshness 既有陈旧（diary/favorites/memo/settings-panel，干净 master HEAD 同样红，属并行会话进行中域，非本票引入）；tsc --noEmit 0 错；自审 + diff 审查完成
