# ADR-0020: 样式按域拆分（src/<域>/styles.css + 构建聚合）

## Context

ticket 60 起，全部视觉样式收敛到根 `styles.css` 单文件（约 100KB / 2979 行、22 个分节），构建时整体复制到插件目录。问题：

- 单文件过大，各域样式混在一起，定位与多任务并行修改互相踩踏；
- 分节归属只靠注释自觉维护，新增 UI 只能往文件尾追加；
- 域自洽性断裂——代码、数据、UI 都在 `src/<域>/`，唯独样式在外面。

Obsidian 约束：每个插件只加载插件目录下**一个** `styles.css`，无法按域多文件加载；运行时注入 `<style>` 已被铁律 9 废止（ticket 60），不能回退到注入模式。

## Options

1. 维持单文件收敛（现状）——不解决上述问题。
2. 恢复旧 `styles/<域>.css` 多文件 + 运行时注入——被 ticket 60 明确废止，否决。
3. **样式源按域拆分 + 构建期聚合**：每个域一个 `src/<域>/styles.css`，共享层/跨域样式放 `src/core/styles.css`；新增 `scripts/build-css.mjs` 按 SOURCES 清单顺序聚合成根 `styles.css` 并同步插件目录；`npm run dev` 监听 src/**/*.css 自动重新聚合。

## Consequences

- 采用方案 3（ticket 70）。根 `styles.css` 变为**构建聚合产物，勿手改**；改样式一律改对应源文件。
- 拼接顺序 = 原 styles.css 文档顺序（共享节前置、域间相对次序不变）。顺序安全性经全量审计：跨节选择器仅有两类——win-head/core 层/移动端全屏节的 `!important` 支配对（与位置无关必胜出）、互不冲突的复合选择器（`.active`/`.overdue`/`.bz-item-sheet-head` 等均无裸规则重复定义）；`@keyframes slideUp` 五处定义语义相同。级联行为与拆分前一致。
- 无损校验：22 个分节切块逐字搬运，按原序重组与原文件逐字节一致（byte-identical）；去注释规则行排序后 2664 = 2664 一致。
- 域内样式就近可查：改某域视觉只动 `src/<域>/styles.css`；共享规范（`.bz-win-head`/`.bz-win-close`/`.bz-win-mfs`/统一右键菜单·长按抽屉等）集中在 `src/core/styles.css`。
- 新增有样式的域时：建 `src/<新域>/styles.css` 并在 `scripts/build-css.mjs` SOURCES 清单对应位置插入一行。
- AGENTS.md 铁律 9 同步改写为「样式按域拆分」，CONTEXT.md 增术语「样式按域拆分 (Domain-split Styles)」。