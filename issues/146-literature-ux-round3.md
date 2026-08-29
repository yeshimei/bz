# Ticket 146 — 文献盒交互第三轮（用户三条拍板：列表间距+相对日期 / 批量按钮单钮态机，走 worktree）

> 用户三条要求：① 主界面列表的标题、简介内容、下面的时间再加大间距；② 日期用 BZ 的相对日期函数；
> ③ 视频录入批量按钮单钮态机（去独立「终止」钮；点击「批量处理」变「终止」；处理完成有失败可再点续跑、
> 再点变「终止整批」；移动端不显示）。
> 不改数据格式（literature.json / 笔记 frontmatter 五键）、不改命令与域事件契约。

## 1. 主面板列表：间距 + 相对日期

- **间距**（`src/literature/styles.css`）：`.bz-lit-card-summary` margin-top 6→10px（标题↔简介）、
  `.bz-lit-card-date` margin-top 6→12px（简介↔时间）；卡片内边距与徽章不变。
- **日期**（`src/literature/ui.ts` renderNoteCard）：`formatRelativeTime(n.date)` 相对显示（与历史弹窗同口径）；
  无效日期回退原文、空日期不显示（`.bz-lit-card-date` 文案由原始字符串改为相对时间）。

## 2. 视频录入批量按钮单钮态机（去独立 ⏹）

- **删**：`#lit-btn-video-abort` 标记与按钮、`_bindVideoHeaderEvents` 中 abort 绑定、移动端 abort 隐藏分支。
- **单钮** `#lit-btn-video-run`（`.bz-lit-run-btn` 文本钮，覆盖头行图标钮 22px 固定宽）：
  - 空闲：`▶️ 批量处理`——无待处理/失败任务时禁用；处理完成仍有失败 → 自动可再点续跑；
  - 运行中：该按钮即终止控制——整批（含待处理项）`⏹ 终止`（`batchAbortLabel='终止'`）；
    **仅失败项续跑** → `⏹ 终止整批`（`work.every(failed)`，`batchAbortLabel='终止整批'`）；点击走原中止确认；
  - runAll 开始同步段已置 running=true → `onRunBatch` 内立即刷新一次按钮态（点击即变化不等事件）；
  - 移动端：整钮隐藏（isMobileEnv 隐藏 run，历史按钮一并隐藏，仅 ➕ + ✕）。

## 3. 测试

- `tests/literature/ui.test.ts`：
  - 改写「视频录入面板」用例：无 `#lit-btn-video-abort`、run 按钮初始「▶️ 批量处理」+ 无工作禁用；
  - 改写移动端用例：隐藏 run/history、无 abort；
  - 新增主面板日期用例：相对时间 = formatRelativeTime 同参结果；空日期不显示、无效日期回退原文；
  - 新增单钮态机用例：无工作禁用 → 有工作启用 → 点击变「⏹ 终止」→ close 失败收尾恢复「▶️ 批量处理」且
    可再点 → 再点（仅失败项）变「⏹ 终止整批」→ 收尾恢复；
  - 批量处理既有用例补「运行中按钮 = ⏹ 终止」断言。

## 4. 文档

- `spec.md` 追加「文献盒交互第三轮（ticket 146）」节；`PROGRESS.md` Ticket 146 交付节。

## 5. 验收

- a) 主列表日期 = formatRelativeTime 结果（UI 测试断言）、间距 CSS 加大；b) 视频头部无 abort 钮，三态
  按钮文案/禁用正确；c) 移动端按钮隐藏；d) tools `node --test`（ticket 145 同票验证）+ tsc + 全量测试 + 构建全绿（worktree 流程）。