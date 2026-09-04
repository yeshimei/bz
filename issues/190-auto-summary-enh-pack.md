# 190 — 自动摘要用户增强包（手动重跑 / 批量串行队列 / 完成通知查看）

## 背景

auto-summary 后台链路已完善（监听触发、缺什么补什么、失败人话化+重试、写回前重读防覆盖），
缺口是没有手动重跑入口、批量场景无并发治理。用户逐项拍板「做」。

## 用户拍板（全部「做」）

1. **「重新生成摘要」手动入口**：
   - `processFile` 加 `force` 参数：跳过 missing 检测直接重建；**force 档只重建 summary/tags，
     不动用户自定义标题**（不重命名、不覆盖 fm.title）。
   - 入口挂剪藏本中栏条目右键菜单 / 移动长按抽屉（`buildItemActions` 加一项，仅 `origin==='clip'`
     且有笔记文件的条目显示；动作构建器同源，桌面/移动一处接入全量生效）。
   - 命令 `bz-auto-summary-redo`：对当前打开的笔记重跑摘要；非剪藏笔记（监听目录外）给人话提示。
2. **批量串行队列与通知聚合**：pending 触发改 FIFO 串行队列（限流 1，实现最干净），多篇并发收敛；
   批量（>1 篇）progress 合并为单条「正在生成摘要 k/N…」逐个更新，单篇仍走原逐篇进度通知；
   队列泵 0ms 定时器合并窗，突发内全部入队落位后再开跑（批次总数/静音判定准确）。
3. **完成通知带「查看」**：AI 摘要完成通知挂「查看」action，点击打开剪藏本面板并选中该条
   （clipbook 暴露 `revealClipArticle(notePath)`：切「剪藏本」源 → 装载完成后选中该条）；
   通知去重合并（progress→结果原地更新）路径补挂 action 按钮（core/notice 小幅追加）。

## 已到位勿动

失败人话化+通知内重试、rename 失败回退、写回前重读防并发覆盖、设置三项级联显示——全部保留。

## 落点

- `src/auto-summary/processor.ts`：ProcessOptions（force/quiet）、force 目标字段固定 summary(+tags)、
  重试保留 force、成功通知挂「查看」（clipbook 环引用 → 函数级动态 import 延迟解析）。
- `src/auto-summary/index.ts`：FIFO 队列 + 串行泵 + 批次聚合通知 + regenerateSummary/redoSummaryForActiveFile。
- `src/core/notice.ts`：去重合并路径补挂 action（appendActionBtn 抽取共用）。
- `src/clipbook/ui.ts`：buildItemActions 加「重新生成摘要」（clip 条目）；导出 revealClipArticle。
- `src/main.ts`：命令 `bz-auto-summary-redo`（sparkles 图标）。

## 门禁

vitest 全量 + tsc --noEmit 全绿；数据层 + UI 层回归测试（force 语义、队列 FIFO 顺序、批量聚合
各有专门用例）；worktree 开发合并回 master。
