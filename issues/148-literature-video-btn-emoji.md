# 148 — 视频录入批量按钮纯 emoji（去文字）

**状态**：✅ 已完成（commit 待填）

## 用户拍板

> 视频录入界面的批量处理，不要有文字显示，单纯的 emoji 就可以了。

## 改动（src/literature/ui.ts + tests/literature/ui.test.ts）

ticket 146 单钮态机基础上，按钮**去掉全部文字**，只显示 emoji；区分语义移到 `title` hover 提示：

| 状态 | 按钮 | title |
|---|---|---|
| 空闲（有工作） | `▶️` | 批量处理（桌面端） |
| 运行中（整批） | `⏹` | 中止批量处理 |
| 运行中（仅失败项续跑） | `⏹` | 中止整批（处理失败任务中） |

- 移动端整钮隐藏不变（isMobileEnv，ticket 146）。
- `#lit-btn-video-run` id / DOM 契约不变；`batchAbortLabel` 逻辑（终止 vs 终止整批）保留。
- 用例断言改纯 emoji，另补 title 断言区分「中止批量处理 / 中止整批」。

## 验收

- tests/literature/ui.test.ts 全绿（单钮态机用例：空闲▶️ 禁用逻辑、运行⏹、失败续跑⏹+title「中止整批」）。
- tsc + 全量测试 + 构建不回归。