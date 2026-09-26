# issue 284：备忘录移动抽屉头接勾选圈（已完成备忘可视化）

日期：2026-09-11 ｜ memo：item-1789105770207（用户原话「已完成的备忘勾上单选框」）｜ 关联：ADR-0104（markup 单源）、core item-actions sheetClass 皮肤机制

## §1 现状

memo 主列表完成态勾选圈已实现（`cardHtml` 的 `.bz-memo-check`/`.bz-memo-checked`，品牌底白勾 + 划线暗淡）。**真实缺口在移动抽屉头**：`buildSheetHead` 完成态只加死类 `.done`（无任何 CSS 规则）——长按已完成的备忘弹抽屉看不到完成态。

## §2 修法

1. `src/memo/render.ts`：勾选圈 markup 抽成导出 `checkHtml(it)`，cardHtml 与抽屉头共用单源。
2. `src/memo/ui.ts`：buildSheetHead 头部插勾选圈（完成态 `bz-memo-checked` + 头 `bz-memo-done`）+ `.bz-memo-body-text` 横排结构；点圈接与列表同源的 `toggleCheck`（完成→恢复、未完成→300ms 防抖完成，共享 `M.completeTimers` 防抖窗口内仍可反悔），先 `closeItemMenu()` 再执行（与动作项「先关再执行」同款收束）。
3. `attachItemActions` 补传 `sheetClass: skinClass()`——抽屉挂 body，不传皮肤类则纸感/编辑部样式不随行（cinema 同款先例）。
4. `src/memo/styles.css`：补 `.bz-memo-sheet-entry` 完成态口径（整体 opacity 0.62 + 标题划线，对齐列表 `.bz-memo-card.bz-memo-done`）；移动段补 44px 触控热区（::after inset -13px）+ 视觉尺寸对齐列表 19px（review P3 回补）。
5. 测试：render.test 补 checkHtml 两态与 cardHtml 单源一致性断言；ui.test 补两个抽屉头用例（真实长按触发、越过静置窗口，断言落盘与防抖时序）。

## §3 交付

- commit `a4a17726`（主体）+ `aad8b587`（热区回补，worktree/2）；review 通过（R1：sheetClass 皮肤机制核实成立、防抖共享正确）。
