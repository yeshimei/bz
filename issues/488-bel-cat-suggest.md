# 488 · 归物本「记一笔」：分类表直接作输入框下拉，模态选择器退役

- 日期：2026-09-27
- 状态：已完成
- 相关：ADR-0204（分类表）/ issue 478（表 + 选择器，本票把选择器形态退役）

## 需求（用户原话口径）

去掉「记一笔」中的「从分类表中选择」按钮，分类表**直接作为分类输入框的下拉列表**使用。

## 落地

- **uiSuggest 扩容**（`src/core/ui/suggest.ts` / `types.ts`，可加不破坏既有三域调用）：
  - `keywordsOf`：额外搜索关键词——别名命中也算匹配（搜「充电宝」出「移动电源」）；
  - `hintOf`：行尾副文本（`.bz-suggest-hint`，右对齐小字弱化）——别名提示。
- **联想源**（`src/belongings/catalog-suggest.ts` 新增纯函数 `buildCatSuggest`）：
  历史分类在前（频次序由 data 层派生）+ 表内分类在后（组序 = 表序）；同名去重（历史优先）；
  图标取数「历史记档 > 表内」；表未下载 = 纯历史模式（不联网，下载仍走设置页）。
- **接线**（`src/belongings/ui.ts`）：表单打开时本地读一次 `loadCategoryTable`
  （失败静默回落纯历史），`#bm-cat` 的 uiSuggest 换用组合源 + keywords/hint。
- **退役**（issue 478 阶段 C 的模态选择器整体退场）：
  `src/core/ui/catpicker.ts`、`tests/core/catpicker.test.ts`、
  `components.css` 的 `.bz-catpick-*` 样式块、`#bm-catpick` 按钮标记全部删除；
  `core/ui/index.ts` 撤导出。退役理由：下拉形态已覆盖「按表选择」全部场景，
  保留双入口 = 双倍维护面（图标前缀坑那类静默 bug 就是双路径养出来的）。

## 测试

- `tests/core/ui.test.ts`：+2（keywordsOf 别名命中 / hintOf 渲染与缺省）。
- `tests/belongings/catalog-suggest.test.ts`：+3（buildCatSuggest 组合序 / 去重 / 图标优先级 / 纯历史模式）。
- 行为包全量重出（catpicker 删除动到 core 源，freshness 30/30）。

## 过程账

- worktree 初建为 issue-487 号，查主仓发现 487 已被占用，改 488 重建（AGENTS.md 占号纪律）。
