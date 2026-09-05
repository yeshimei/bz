# 198 — 长按抽屉共享基线恢复（movie 退役误删）

## 现象
用户报：影院/待办移动端长按条目弹出的动作抽屉「全部拥挤到一行」。

## 根因
`core/item-actions`（右键菜单/长按抽屉）的样式早年散落在各域文件（movie/memo/news/clipping/library/password 各持一份拷贝）。各域退役时逐份删除：

- `49dc17f`（movie 退役 ADR-0087）删 `src/movie/styles.css` 时，把最后一份动作项基线一并带走，未迁回 core。

丢失的 10 条共享规则（逐字恢复自 `49dc17f^`）：
1. `.bz-item-sheet-title` / `.bz-item-sheet-sub`（sheetTitle 路径头部）
2. `.bz-item-sheet button.bz-item-sheet-item`（**flex 纵列 + width:100% + 抗 Obsidian 按钮 !important 组**——挤一行的直接原因：button 默认 inline 排布）
3. `:hover/:active` 无背景反馈
4. `--danger` 危险红（整行 + 图标）
5. `.bz-item-sheet-item-sub` 右对齐小字（省略号、max-width 45%）
6. `.bz-item-sheet-icon` 图标盒子（16×14）
7. `@keyframes bz-sheet-in` / `@keyframes bz-mask-in`（只剩引用无定义，入场动画静默失效）

## 修复
- `d9a540d` fix(core)：10 条规则恢复进 `src/core/styles.css` 长按抽屉分节，注明来源。
- 门禁：tsc 干净，4118/4118 绿。

## 教训
**共享组件样式不得随域文件退役**：退役清理时须先核对域 CSS 是否承载共享组件规则（`.bz-item-*` / `.bz-item-sheet-*` 等 core 前缀类），先迁 core 再删域。
