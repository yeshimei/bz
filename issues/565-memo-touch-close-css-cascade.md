# 565 · 移动端备忘录主界面（编辑部主题）右上角没有关闭按钮

- 状态：已交付（2026-11-15，worktree `.dsh-worktrees/memo-close`，memo `item-1794707517386-c1niyn`）
- 提出：2026-11-15 用户反馈「移动端，备忘录的编辑部主题右上角增加关闭按钮」；追问后确认为**备忘录主界面**

## 不是「没做按钮」，是按钮被级联吃掉

头行那枚 ✕ 一直在 `src/memo/render.ts` 的 `panelShellHtml()` 里（`data-memo-head-close`），
委托也早就接好（`ui.ts` → `closeMemoPanel()`）。两处皮肤规则会把它藏起来：

1. **远端皮肤包反压**：`core/skin-pack.ts` 把「纸感手账」以 `<style>` 注入到 `document.head`，
   排在插件样式**之后**。`src/memo/skins/paper.css` 的
   `.bz-memo-skin-paper .bz-panel-head-btns{display:none}` 与 `memo/styles.css` 收口段的恢复规则
   同特异性 (0,2,0)，后写者赢 → 手机上整组钮（含关闭）被藏。
2. **宽屏触屏不进断点**：平板 / 横屏手机 CSS 宽度超过 768px 时不进移动端收口段，
   「编辑部」皮肤段 `.bz-memo-skin-editorial .bz-panel-head-btns{display:none}` 仍然生效；
   触屏没有偏移指针可点遮罩，同样没有出口。

## 修法

`src/memo/styles.css` 文件末尾追加 `@media (pointer: coarse)` 段，用 (0,3,0) 选择器
`.bz-memo-panel.bz-memo-skin-<paper|editorial> .bz-panel-head-btns{display:flex}` 放回钮组：
特异性压过运行期注入的皮肤包，与文档顺序无关；桌面鼠标端不进该段，原型「头行无钮」口径不变。
关闭钮的 28px 档、44px 命中区与两皮肤贴纸 / 方角形态仍由既有收口段供给，不复制一份。

`tests/memo/touch-close.test.ts` 四条静态守卫：皮肤包确实藏了钮组、补丁段在收口段之后、
两套皮肤都用加特异性选择器、桌面隐藏规则仍在。补丁段刻意不写 `@media (max-width: 768px)` 或
「移动端收口段」字面量 —— 两条既有守卫用 `lastIndexOf` 定位分节，注释里带上会把它们带偏。

## 验收

- `node scripts/test-domain.mjs memo` → 23 文件 / 252 用例全绿；`tsc --noEmit` 干净。
- 合并前 `node scripts/test-affected.mjs --since master` → 27 文件 / 520 用例全绿。
- 未改核心组件、未改皮肤包（不需要重出皮肤包）、桌面观感零变化。
