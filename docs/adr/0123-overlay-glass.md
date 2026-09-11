# ADR-0123：遮罩层毛玻璃统一（--bz-overlay-blur 单源）

日期：2026-09-11 ｜ 状态：已采纳 ｜ 关联：issue 282、ADR-0080/0122（滚动条单源同类范式）、手册 §5.2/§11 同步改写

## 背景

手册 §5.2 原有禁令「毛玻璃明确不采用」（Apple HIG Materials 推导：网页拿不到原生 vibrancy；`backdrop-filter` 对比度不可控）。全仓遮罩底色三态并存（`--bz-overlay` / 硬编码 rgba / Obsidian 原生 cover），零 blur，仅 password-vault(3px)、diary(2px) 局部先例。用户 2026-09-11 拍板「遮罩层换成毛玻璃，支持明暗模式」，推翻该禁令。

## 决策

1. **单源 token**：`src/core/ui/tokens.css` `:root` 新增 `--bz-overlay-blur: 8px`（结构量，明暗同值）。域内禁止自写 blur 像素值，一律 `backdrop-filter: blur(var(--bz-overlay-blur))`（对齐铁律 4 滚动条单源范式）。
2. **作用域 = 遮罩层（挡界面的半透明层），不含内容黑底**：`.bz-panel-overlay`/`.bz-overlay-mask`/`.bz-sheet-mask`/`.bz-item-sheet-mask`/`#__shared_confirm_mask__` 及各域语义相同的自建遮罩收编；灯箱/播放器黑底（`--bz-scrim` 语义「看内容」）**不适用**。
3. **底色两类**：非品牌域统一 `var(--bz-overlay)`（亮 rgba(0,0,0,0.35) / 暗 rgba(0,0,0,0.6)，明暗自适应即用户「支持明暗模式」的落点）；**品牌底色域豁免**（favorites 暖纸 `--mask`、secondbrain `#2a261e4d`、settings-panel 暖黑、password-vault 暖黑）——保留域底色只加 blur，防品牌观感被冲掉。
4. **防串色口径**：blur 只作用于遮罩本职（弱化背后界面内容），遮罩自身底色不透明度不变——暗色下降可读性的 HIG 顾虑由「底色不透明度不降 + blur 量固定」对冲；真机观感若需微调只动 token 一个值。

## 后果

- 新增遮罩 = 类名语义对齐 + 走两行（底色 var + blur token），`tests/core/overlay-glass.test.ts` 清单化守卫（新增遮罩须入清单）。
- 手册 §5.2「毛玻璃明确不采用」改写为「遮罩例外」；§11 对应行同步。
- TS 内联遮罩（diary datetime-picker、clipbook save）为存量债务，后续清理。
