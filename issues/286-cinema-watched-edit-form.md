# issue 286：影院「标记已看」改走编辑窗（评分影评由用户输入）

日期：2026-09-11 ｜ memo：item-1789105594322 ｜ 关联：issue 279 同款抽屉链路、cinema 三分状态口径（评分 -1 想看 / 0 在看 / >0 已看）

## §1 现状

影院动作集单源 `itemActions()`（移动长按抽屉与桌面右键菜单共同消费）的「标记已看」run 直调 `markStatus`——直接改状态 + 写默认评分（DEFAULT_RATING=5）+ 刷观影日期 + 落盘。用户语义：不该静默定分，应打开编辑窗让用户输入评分和影评。

## §2 修法

1. `openForm(sec, item, app)` 加可选参数 `presetSt`，透传 `formModalHtml` 的 `stText`——预选「已看」时状态 chip 选中 + 评分滑杆（预填当前评分，无则 DEFAULT_RATING）与影评框自动展开；shared.ts 纯层零改动（stText 本就是入参）。
2. 「标记已看」run 改 `openForm(sec, it, app, '已看')`——用户确认后走既有 `saveEdit`（重名校验、观影日期流转、域事件全复用）；**取消不落盘**。
3. `saveEdit` 补发 status/rated 域事件（与 markStatus 逐字同口径：仅 persist 成功后发、status 仅变化时发、失败完整回滚不发）——承接原快速标记的事件语义，smartcat 消费方 300ms 防重既有。
4. 「标记在看」保持 `markStatus` 快速语义（无评分输入诉求）；桌面右键同款动作集自动同改（itemActions 单源）。
5. 测试：原「直接写 frontmatter」用例改写为「弹表单预选已看 + fmBefore 全文相等 + 事件数 0（不落盘）→ 模拟保存 → 断言 frontmatter/双事件/内存态」；补移动长按抽屉整条路径用例。

## §3 交付与遗留

- commit `6cb2ac88`（worktree/4）；review 通过（R2：事件无重复无漏发、取消路径干净、跨域消费方覆盖完整）。
- 行为流口径说明：saveEdit 统一补发事件后，普通编辑弹窗改状态/评分也会进小橘行为流（原仅快速标记发）——「与 markStatus 同口径」的有意扩展、语义更完备；若后续嫌条目偏多再收。
- 遗留 P3：`markStatus` 的「已看」分支成死代码（唯一调用点只传「在看」），下次顺手收窄签名删冗余分支。
