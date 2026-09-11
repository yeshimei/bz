# issue 280：diary 抽屉关闭钮退役（对齐 issue 271 全域「遮罩点关」拍板）

日期：2026-09-11 ｜ memo：item-1789106339887（用户原话「去掉抽屉关闭按钮」）｜ 关联：issue 271（弹窗关闭钮全域退役先例）、issue 279（diary 抽屉收编 core）

## §1 现状

issue 279 抽屉收编批给 diary 移动抽屉富媒体头（`mkSheetHead`）加了右上关闭钮（`.bz-diary-sheet-close`），成为 issue 271「非全屏弹窗一律删右上角关闭钮，统一点遮罩关闭」全域拍板后的**唯一残留异类**（favorites/belongings/cinema/knowledge 抽屉头均无关闭钮）。

## §2 修法

- `src/diary/ui.ts`：删 mkSheetHead 内关闭钮整块；**保留 `ACTION_ICON.close` 键**（c80909f9 真机事故修复产物，缺键曾致整条抽屉构建中断）。
- `src/diary/styles.css`：删 `.bz-diary-sheet-close` 三段死样式。
- 关闭途径不补——core item-actions 四条原样生效：遮罩/外点点击、下滑手势、ESC、动作项点击。
- 测试：`tests/diary/ui.test.ts` 断言反转 `toBeNull()`（照 knowledge issue 271 前例）。

## §3 交付

- commit `6ca929a1`（worktree/1）；review 通过（R1：关闭途径逐一核实在位，无死规则残留）。
