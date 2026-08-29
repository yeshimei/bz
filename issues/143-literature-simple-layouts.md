# Ticket 143 — 文献盒全部窗口简洁布局 A（用户拍板，走 worktree）

> 术语面板简洁版（ticket 142）定稿后，用户要求以同样方式重做文献盒其余全部窗口，
> 原型 `.scratch/literature-minimal/index.html`（.scratch 不入库），每窗 4 套布局走查后**全部拍板选 A**。
> 不改数据格式（literature.json / 笔记 frontmatter 零变化）、不改命令与域事件契约。

## 1. 四窗 A 布局落地

- **主面板**：**保留原标题**（用户拍板——「主面板还是使用之前的标题」）：bz-win-head「文献盒」+ 动作钮不变，
  领域筛选 chips 独立行在标题下方（bz-lit-filterbar 恢复）；仅搜索框简洁化（去 placeholder，
  盒内 🔍 图标 + 无边框输入，`#literature-search-input` id 不变）。
- **视频录入**：**保留原标题**（用户拍板「视频录入也要加标题，不是用状态计数作小标题」，且「去掉后面的灰色小字」）：
  bz-win-head「视频录入」+ ➕▶️⏹🕘❌；标题后的「N 待处理 · N 处理中 · N 失败」灰色计数小字去掉（`#lit-video-counts` 移除，`_syncStatusCounts` 守卫空转）。
- **添加任务弹窗**：h4 标题删除（编辑态改右上角小标签 `#lit-add-mode`「编辑任务」，新增隐藏）；
  链接输入上方 label「视频链接 / BV 号」且与整片/剪辑开关同行（`.bz-lit-url-row`）；**新任务默认剪辑片段**
  （编辑既有任务仍按 start/end 回显）；分P label 去括号说明；全部输入去 placeholder；失败提示条 `.bz-lit-form-alert`
  红色 → 中性化（背景 bg-secondary、文字 muted；文案与 title 原文保留）。
- **历史**：标题删除；工具栏 = 「🕘 历史 · 共 N 条」（`#lit-history-counts`）+ ❌；分组卡结构（按 url 分组）不变，
  组头去掉「UP主」前缀（只留名字）与「N 条笔记」计数；笔记行路径显示改 `shortNoteName`（去目录、兼容反斜杠、
  去 .md 后缀）；时间用 `formatRelativeTime(processedAt || created)` 相对显示。

## 2. 移动端（本次一并收敛）

- 每行一个输入框：`.bz-lit-form-row` / `.bz-lit-url-row` 折单列，URL 与开关分行、开关占满行宽。

## 3. 门禁

- tsc + 全量测试（新增：主面板无标题/搜索无 placeholder、视频简洁工具栏、添加弹窗简洁断言、历史展示新规则；
  改写：默认剪辑、mode 标签、历史路径断言）+ 构建部署（worktree 流程）。