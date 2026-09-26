# issue 282：遮罩层统一毛玻璃（--bz-overlay-blur 单源，明暗自适应）

日期：2026-09-11 ｜ memo：item-1789106289860（用户原话「遮罩层换成毛玻璃，支持明暗模式」）｜ 关联：ADR-0123（推翻手册 §5.2 毛玻璃禁令的决策记录）、ADR-0080/0122（滚动条单源同类范式）

## §1 现状

全仓遮罩底色三态并存：`var(--bz-overlay)`（明暗两值已有）、硬编码 rgba（`.bz-item-sheet-mask` 0.4、`#__shared_confirm_mask__` 0.3、secondbrain `#2a261e4d`）、Obsidian 原生 `--background-modifier-cover`（knowledge/pomodoro）。**零 backdrop-filter**（仅 password-vault blur(3px) 与 diary blur(2px) 局部先例）。手册 §5.2 明令「毛玻璃明确不采用」、encrypt 头注同口径——本次用户拍板推翻。

## §2 修法（token 单源 + 三类处理）

1. `src/core/ui/tokens.css` `:root` 新增 `--bz-overlay-blur: 8px`（结构量，明暗同值）；`--bz-overlay` 明（rgba(0,0,0,0.35)）暗（rgba(0,0,0,0.6)）两值复用不动。
2. core 共享遮罩加 blur：`.bz-panel-overlay` / `.bz-overlay-mask` / `.bz-sheet-mask`（components.css）+ `.bz-item-sheet-mask` / `#__shared_confirm_mask__`（core/styles.css 硬编码同步收编 var(--bz-overlay)）。
3. **非品牌域**遮罩统一 var(--bz-overlay) + blur：encrypt×3、knowledge、review×3、pomodoro、diary×2（blur(2px) 换 token）、password-vault（blur(3px) 换 token）、diary `.bz-diary-datefilter`（review 补漏）。
4. **品牌底色域**只加 blur 不动底色：favorites（暖纸 `--mask`）、secondbrain（`#2a261e4d`）、settings-panel（暖黑两态）。
5. 豁免口径记录：password-vault×3 暖黑底（rgba(20,18,12,0.45)）与 settings-panel 暖黑同待遇，归「暖色系品牌底色豁免」，只统一 blur。
6. **不动**：`.bz-lightbox`/`.bz-diary-lb` 等灯箱黑底（`--bz-scrim` 语义是「看内容」不是「挡界面」）。
7. encrypt「毛玻璃明确不采用」头注如实改写；手册 §5.2/§11 由本批文档统一改（ADR-0123）。
8. 守卫：`tests/core/overlay-glass.test.ts`（新建）——token 单源 + 明暗两值 + 共享遮罩 blur + 域遮罩全量清单文本断言。

## §3 交付与后续清理项

- commit `fac22f71`（core 单源）+ `2ad6e117`（域散点）+ `01e5f443`（datefilter 补漏，review P2）；review 通过（R3：.bz-overlay-mask 新旧规则级联核实无回归）。
- 后续清理（不阻塞）：`src/diary/ui/datetime-picker.ts` 与 `src/clipbook/save.ts` 两处 TS 内联遮罩仍走原生 cover；`src/core/styles.css:486` `.bz-overlay-mask` 旧基线死声明；diary 灯箱硬编码 rgba(0,0,0,0.9) 未走 `--bz-scrim` token。
