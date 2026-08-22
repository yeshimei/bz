# 69 — 剪藏本接入统一抽屉：单击直开 + 统一抽屉（桌右移/移长按；桌面继承全局右键方案）

**What to build:** 剪藏本接入跨域统一抽屉（`core/item-actions.ts`），手势模型重构为五域首例「单击直开」：
1. **双击整卡打开文章**（ticket 69 初版做单击直开，用户试用后反馈回退——单击误触多；单击无操作；jumpToArticle 语义不变：openLinkText + 关主面板；反链📌 stopPropagation 不受影响）。
2. **移动端长按整卡弹底部抽屉**（整卡长按，无排除区；抽屉头部**两行精简**——标题 + 简介（文章摘要，最多两行超出省略号截断，CSS `.bz-item-sheet-head .article-entry-summary` 承载），meta 行不在头部显示）。
3. 抽屉动作：**打开 / 复制双链（`[[完整路径|标题]]`）/ 复制原文链接（小字=域名）/ 删除**（danger + 既有「确认删除」弹窗复用）。
4. **桌面端**：合并 master 已落地的全局右键菜单方案（fbf7830）——桌面右键弹跟手菜单、移动端长按弹底部抽屉；旧 `desktopActions` 选项（旧 API 补丁，临时空窗用）在合并时**作废删除**，未入 master。
5. 移除旧手写「双击跳转」「长按日期→删除」代码；卡片禁选字（user-select:none，styles.css 收敛）。

**Status:** done

## 变更面

- `src/clipping/view.ts`（单击打开、buildTitleDiv/buildSummaryEl/buildMetaRow 提取共用、buildSheetHead 两行、buildArticleActions、copyWikilink/copyOriginalLink/findCardByPath；删 addLongPress/LONG_PRESS_DURATION）
- `styles.css`（.article-entry-card 禁选字 + `.bz-item-sheet-head .article-entry-summary` 两行省略）
- 文档：spec.md 剪藏本节、CONTEXT.md 剪藏本词条 + 新增共享术语「条目抽屉」、AGENTS.md 域清单行、本 issue
- `tests/clipping/view.test.ts`（重写双击/长按日期两测 → 单击/桌面右键菜单/移动端抽屉全流程/复制双链/复制原文链接/反链直点）
- merge 侧：`src/core/item-actions.ts` 与 `tests/core/item-actions.test.ts` 采用 master 右键版（fbf7830），desktopActions 补丁与用例作废

## 决策要点（grilling 会话定稿）

- Q1：用户所指「日历抽屉」实为**日记本抽屉**（参考基准=日记本 + 备忘录，影视/收藏本作旁证）。
- Q2/Q7（修订）：**双击整卡打开文章**（用户试用后回退——单击直开误触多），右键菜单/移动端抽屉照常；反链📌除外不受影响。
- Q3：反链📌**保留列表直点**，抽屉不放反链动作（stopPropagation 已防误触整卡打开）。
- Q4：抽屉动作=打开/复制双链/复制原文链接/删除（4 项）。
- Q5：整卡长按 + 卡片禁选字（对齐 memo/日记先例）。
- Q6（修订）：抽屉头部**两行精简**——标题 + 简介（摘要两行省略号截断），meta 行不在头部（用户拍板）。
- Q8/Q9：桌面端**不自己实现**——master 先行合并了全局右键菜单（fbf7830）；合并时剪藏本直接继承（右键→跟手菜单），`desktopActions` 临时补丁作废删除。

## 测试

- `tests/clipping/view.test.ts`：重写双击/长按日期两测；新增 双击打开+关面板（单击无操作）、桌面右键菜单（defaultPrevented + 四动作 + 双击仍开）、移动端抽屉全流程（头部两行+动作顺序+删除确认）、复制双链写剪贴板+通知、复制原文链接（sub=域名+写剪贴板）、反链直点（不触发整卡打开、抽屉无反链动作）。
- `tests/core/item-actions.test.ts`：采用 master 右键版（原 desktopActions 两用例删除）。
- 全量跑绿 + tsc 0 错误后提交（单 ticket 一次提交）并合并回 master、构建部署核对。