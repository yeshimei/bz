# 332 · 保存/标读后自动前进的下一篇：补换篇语义（打开即已读 + 滚动归零）

- 状态：已实现（2026-09-16，memo-code-fix 闭环；memo item-1789357688430-zrurtk）
- 关联：ADR-0108（会话冻结序）/ issue 206（切换文章从开头读）/ issue 274（正文保留）

## 用户原话拆解

「把一篇文章保存至剪藏，自动打开的下一篇文章未转跳至开头，也未标注已读状态」——两问：
① 自动打开的下一篇不跳开头（滚动位残留前一篇）；② 未标注已读。

## 根因

`refreshAfterAction` 的落位回退分支：保存/标读/删除使当前条目出收件流后，`M.cur` **直接落到邻位**
（`flat[prevIdx]`），绕过 `selectArticle`——换篇语义（`markReadOnOpen` + `resetReadScroll` +
移动详情滚动归零）整段缺失。该自动前进动线（「处理后前进下一篇」，17a1aff9 增强包时代即有）
在 ADR-0108 冻结序重构后仍在，但换篇补齐从未跟上。

## 设计

- `refreshAfterAction` 落位回退时记 `advanced`（id 变化才算换篇）；`advanced` 时在 `renderAll` 前
  `markReadOnOpen(M.cur)`（打开即已读，落盘走既有串行队列），`renderAll` 后 `resetReadScroll()` +
  移动详情 body `scrollTop = 0`。
- 调用方面审计（reviewer 核过）：保存（写笔记 → 出流 → 前进 ✓）；B站分流（markHandled 不写笔记 →
  留流 → 原位，冻结序不破）；标读/全标读（read 位变更不出流 → 原位）；删除（出流 → 前进 ✓）；
  三类撤销（cur 仍在 → 原位，不误触发）。邻位是 clip 来源时 `markReadOnOpen` 的 origin 守卫早退。
- 回归：`tests/clipbook/memo-next-after-save.test.ts` 4 用例（移动保存→前进→已读+归零、续读下一则、
  章末回目录、桌面右键保存→前进→已读+归零）。

## 测试面

- clipbook 全域 24 文件 258 用例全绿；主仓库全量 326 文件 5204 用例全绿；tsc 零错误。
