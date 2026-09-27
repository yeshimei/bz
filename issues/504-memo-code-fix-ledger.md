# 504 memo-code-fix 核账批：剪藏 UI 三连实现对账 + 备忘录代码条目全量清账回写（40 真积压 + 6 误报）

- 状态：已交付（2026-09-27，memo-code-fix 流程）
- 提出：2026-09-27 用户「执行 Skills Memo Code Fix」
- 相关：剪藏 UI 三连 = memo item-1789788619092-hzvfqs，实现为 commit `628aaf013`（当时未开票未回写）

## 背景

用户备忘录 scene=代码 未完成条目积压 46 条（后核实为 40 条真积压 + 6 条旧 `done` 字段残留
误报），其中相当一部分实际已交付但流程未回写
`completed`（历史各轮 memo-code-fix 均只修代码不勾条目，包括 issue 332/379/384/385 各票）。
本轮无新增代码缺陷——逐条对账后补开票存档 + 批量回写。

## 主线：剪藏 UI 三连（item-1789788619092-hzvfqs，2026-09-19 提出）

用户原话三条 → `628aaf013`（2026-09-19 12:38）逐条对应：

1. 「鼠标放到搜索框上不再显示白色背景」→ 头部搜索框补 `:hover/:focus` 同形态伪类选择器，
   `background: transparent` 反压 Obsidian app.css 表单底色（特异性 0,2,1；
   `src/clipbook/styles.css` `.bz-clip-head-search .bz-input:hover`）。
2. 「去掉鼠标放到左侧列表上出现的全部已读的快捷按钮」→ rail 源行 hover 浮出「✓✓」批量已读
   小钮退役（用户拍板），源级批量已读只剩右键菜单；移动章头常驻钮不在「鼠标放到」范围，保留
   （`src/clipbook/render.ts` railUnreadN 段注释）。
3. 「选中文字的工具栏和我读了什么弹窗被主弹窗遮挡，改为动态 z-index」→ openClipbookReport 与
   showTextSelBar/showImageSelBar 显示时 `topifyZ` 发号（ADR-0067）：此前只有 CSS 注释没有接线，
   `z-index:auto` 被已发号的主面板遮罩压住（`src/clipbook/report-ui.ts`、`src/clipbook/ui.ts`）。

回归已随该提交入绿：tests/clipbook/report-ui、toolbar、views-fix-d。本轮零代码改动，
门禁（tsc/全量测试/构建部署）不适用。

## 全量清账（46 条 → 40 勾 6 留）

逐条以「issue 引用 / 提交对应 / 代码现状」三路查证，回写 `completed` 的 40 条对应：

- item-18 条：issue 384、385、379×2、332、301、300、286~280、c8182b9d7（时间线新到旧）、
  bc9f739a9（时间线字号降档）、issue 290 批（首页秒开+关面板保 DOM）、ADR-0124（lock-stats 落盘）
- todo-22 条：ticket 170（10 分制半星）、issue 430/457 批（AI provider 注册表）、46eb65767+578c3a968
  （做题家末题卡死/结算面板）、ticket 156（0.8s 跳题+去统计+出新题）、578c3a968（逾期常驻+隐自动
  标记）、ticket 154（索引改文献+数字点击，vault 主页.js 仓库外）、ticket 155（术语窗自动生成/
  重新生成/总结）、ticket 158/160/162（小橘记忆流水线断粮修复）、memo deleted 事件入行为流
  （`emitDomainEvent('memo', deleted)` + smartcat memo 别名模板）、入口页退役（ADR-0093，条目
  作废）、ADR-0088/issue 187（AIAgent 解散）、7b0e262f8（影院保存即齐，刷新钮随其后退役）、
  ADR-0082（聚合讯并剪藏本：移动 100vh+关闭钮；抓取只入未读流、保存剪藏时才 AI=条目所求架构）、
  memo 编辑保存 finalTitle（ui.ts edited 事件）、剪藏备忘 url 独立字段、clipTitleHint 切场景清空、
  统一抽屉重构（长按日期删除/场景标签编辑旧交互随之退役，f3171fd0f 同批口径）

「积压 46 条」实为 40 + 6 误报：初筛按旧域残留字段 `done` 过滤，而 memo 域完成标记是
`completed`（types.ts 14 字段规范）。以下 6 条用户 2026-07~08 已自行勾掉，`done: null` 系
残留脏字段造成未完成假象，本轮未重复动：

1. todo-1788095674787 密码本搜索框点两次才打开——completed 2026-08-31
2. todo-1785302102709 备忘录关窗/切场景留存输入——completed 2026-07-29
3. todo-1785119750376 备忘录 github 平台识别——completed 2026-07-27
4. todo-1785033020537 auto_git commit 标题追加 README 时间轴——completed 2026-07-26
5. todo-1785032966554 auto_git >100MB 自动 .gitignore——completed 2026-07-26
6. todo-1784823833765 dataview 内联改脚本——外部 Obsidian 剪藏插件配置，completed 2026-07-22

回写后 scene=代码 未完成条目清零。遗留观察（非条目）：若旧 `done` 字段确认无读者，可在
memo 域后续数据卫生批里考虑剥离。

## 交付物

- issues/504（本文件，存档对账）
- memo.json 40 条 `completed` 回写（vault 数据，不入 git；改动前备份
  `.scratch/memo-backup-20260927.json`）
