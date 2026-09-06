# issue 228：收藏本 C5 原型后轮改动回灌插件

日期：2026-09-06　|　状态：已完成　|　前置：issue 227 / ADR-0101

## 背景

issue 227 部署后，原型 `c5-linen-full.html` 又迭代了一轮（两端并存评审），用户拍板「把新的原型复刻到 bz」。本轮为纯样式/布局回灌，无数据与契约变化。

## 改动清单（原型 → src/favorites）

1. 主背景 `--bg`：`#e9e4d8` → `#fffcf6`（织纹透明度随之 .5/.1）
2. 面板内边距：桌面 `26px 30px 0`、移动 `16px 14px 0`（去底部内边距，原型固定高面板下底部曾遮挡）
3. 头行 `margin-bottom: 20px`、标题 `16px → 14px`（桌面 .head 与移动 .m-head 一致）
4. 磁贴行 `margin-bottom: 22px → 20px`；卡墙 `padding-top: 6px`
5. 移动端磁贴行：平铺单行横向滑动（`nowrap + overflow-x:auto`，`padding: 5px 0 6px` 防磁点被裁，按钮 `white-space: nowrap`），「新收藏」chip 置首（桌面仍行尾）
6. 移动端关闭钮：30×30 → 24×24（圆角 7px），× 图标 12px

## 门禁

tsc 干净；vitest 4150/4150 全绿（favorites 96 例未动全过）。
