# Ticket 165：通知 z-index 与小橘对齐 + 桌面端位置下移

## 需求

备忘（todo-1788084774918-5xpecy，场景「通知」）：「固定 z-index 和小橘一样。桌面端位置下移」。

## 调研结论

- **z-index**：toast 已接入 ADR-0067 动态层级制——`src/core/notice.ts:447` 每次弹出调 `allocZ()` 抬顶，小橘猫本体经 `registerAlwaysOnTop`（`src/smartcat/ui.ts:68`）恒压最新档之上（`z-order.ts:25-29`）。「固定 z-index 和小橘一样」的诉求（toast 不被小橘挡住）**现状已满足**：toast 永不钻底，小橘恒在最高层但不与 toast 重叠（猫在底部中央 `bottom:-10px; left:50%`，toast 在右上角）。
- **若改成静态 100000** 反而倒退：静态值会被动态 overlay（>100000）盖住，与 ADR-0067 决策 6 矛盾。故不改 z-index。

## 改动

- `src/core/styles.css:190`：`#bz-notice-container` 桌面端 `top: calc(16px + env(safe-area-inset-top, 0px))` → `calc(56px + env(safe-area-inset-top, 0px))`——下移 40px，避开 Obsidian 顶部栏/标题区。
- 移动端断点（34px）不动；根 `styles.css` 由构建聚合产物自动更新。

## 测试

- `tests/core/notice.test.ts` 无位置/z-index 断言，改动无测试破坏
- `pnpm exec tsc --noEmit` 0 错；全量 221 文件 3563 用例绿；构建通过，产物已同步仓库根目录与 E 盘

## 状态

- [x] 调研（ADR-0067 机制确认，z-index 无需改）
- [x] 实现（styles.css top 16→56px）
- [x] tsc + 全量测试 + 构建验证
- [x] 部署产物同步
