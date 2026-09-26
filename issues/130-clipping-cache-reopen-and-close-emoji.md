# Ticket 130：剪藏本重开缓存复用 + 关闭按钮 ❌ 统一（ADR-0063，修订 B1）

- 状态：进行中（worktree W3）
- 域：clipping（剪藏本）+ 跨域关闭按钮
- 来源：grill-with-docs 拍板 + 原型验收（用户：「剪藏本每次打开都重新加载数据」；「书库的主面板右上角的关闭按钮应该是 emoji」）
- 关联：`src/clipping/view.ts`（initArticleView/applyArticleSettings/attachFileListener/unloadClipping）、`tests/clipping/view.test.ts`、`src/library/ui.ts`、`src/movie/recommend.ts`、`src/movie/ui.ts`、`src/encrypt/ui.ts`、`src/belongings/ui.ts`、`src/reading-report/index.ts`、`src/movie-report/analysis.ts`

## 拍板

1. **缓存复用**：`initArticleView` 重开路径（窗口已存在）→ 仅 `setArticleViewVisible(true)` + `applyMobileWindowFullscreen`，**不再 `showLoadingHint()` + `loadAllArticles()`**；首开路径保持「先弹窗 + 加载提示 + 全量加载」。模块级 `allArticles` 列表跨重开常驻（现状已是模块变量，直接复用）。
2. **完全信任监听**：modify/delete/rename 三通道域事件监听常驻（首建时挂、`unloadClipping` 才卸、面板隐藏不卸）维护增量刷新，重开零扫描。B1 幽灵卡片防护语义由「重开即重载」改为「常驻监听增量维护」——ticket 125 的「重开先显示加载提示」语义随之作废（首开保留）。
3. **目录变更重载**：`applyArticleSettings`（或设置保存回调）检测 `articleDirectory` 与当前 `ARTICLE_DIRECTORY` 不一致 → 清空模块列表（allArticles/filteredArticles/筛选态）+ 全量重载一次；此后重开零扫描。旧目录文件不留存（防错目录渲染）。
4. **关闭按钮 ✕→❌ 全局统一**：仍用 `✕` 的关闭按钮改 `❌` emoji——重点核查：`src/library/ui.ts`（主面板 + 书籍笔记弹窗 + 批注弹窗）、`src/movie/recommend.ts`、`src/movie/ui.ts`、`src/encrypt/ui.ts`、`src/belongings/ui.ts`、`src/reading-report/index.ts`、`src/movie-report/analysis.ts`（以 grep `bz-win-close` 与 `✕` 全量盘点为准）。**chips 的 ✕ 移除符是功能性删除符，不动**。`bz-win-close` 样式统一（styles.css 已有，确认字号适配 ❌）。

## 验收标准

- a) 首开：弹窗 + 加载提示 + 全量加载（不变）；重开：立即显示旧列表、无加载提示、无重扫（可用测试断言 loadAllArticles 未被再次调用）；
- b) 面板隐藏期间文件删除/改名/移出 → 重开列表无幽灵卡片（监听路径，既有用例保持绿）；
- c) 设置改剪藏目录 → 保存后重开显示新目录内容、旧目录条目清空；
- d) 全库关闭按钮视觉统一为 ❌（盘点清单逐项核过），chips ✕ 不受影响；
- e) clipping 测试更新（重开不重载/目录变更重载新用例）+ 关闭按钮渲染断言；全量测试绿 + tsc + 构建。
