# 159 — 备忘录：删除未入小橘行为流（落盘时序加固）

**状态**：✅ 已完成

## 用户拍板

> 删除备忘录未入小橘行为流

## 实证结论

- **源码链路完整且有测试**：删除（memo/ui.ts:1160-1162，全仓唯一 deleteItem 调用点）→ `emitDomainEvent('memo', {kind:'deleted'})` → `notifyMemoAction`（总闸 `noteSource=true` 实测开启）→ `buildMemoStructured` deleted 分支 → `memo:deleted` 路由行为流 → 三套注册表（wording「你删除了备忘录」/徽标「删除」/来源「备忘录」）齐全；memo-action.test 覆盖。
- **真实数据佐证**：行为流 memo 条目 added×8 / completed×7 / edited×3 / **deleted×0**——链路通、唯独 deleted 缺失 ⇒ 症状指向**落盘时序**而非事件丢失：R5 设计行为流只标脏，30s tick 合并落盘 + 卸载冲刷 fire-and-forget——删除后 30s 内退出（移动端关后台尤其快）条目确定丢失，且删除恰是低频动作（不像 news 浏览持续续窗）。

## 改动（src/smartcat/memory.ts + tests/smartcat/behavior-stream.test.ts）

- `markBehaviorDirty` 追加 **5s 短防抖直写**：标脏即排程 5s 后 `flushSidecars()`（窗口内连续事件合并为一次写，与 30s tick 并存）——低频动作（删除/完成）落盘窗口 30s → 5s；`stopScheduler` 一并清定时器（卸载冲刷仍走快照路径，不受影响）。
- 新增用例：5s 触发直写 / 窗口内合并 / stopScheduler 清定时器。

## 验收

- tests/smartcat 1138 用例全绿；tsc 0 错。
- 行为：删除备忘录后 ≤5s 行为流落盘，退出应用不再丢条目。
