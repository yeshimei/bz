# 265 模型选择器弹窗移动端错乱（黑底黑字）+ 面板 44px 错位

状态：已完成
类型：fix（样式 / 可读性）
涉及域：settings-panel（弹窗 token 与移动端定位）、core/settings-model-picker

## 现象（用户报告，2026-09-10）

移动端设置面板 → AI → 点「获取模型名」，弹出「选择模型（DeepSeek）」：

1. **弹窗黑底、文字看不清**：深色主题下弹窗壳是纯黑，行内模型名几乎不可读，
   无法判断列表是否正确。
2. **面板顶部有 44px 上边距错位**：全屏面板顶部出现一块空白，
   弹窗相对视口偏移、贴顶。

## 根因

### A. 暗色 token 选择器断链（黑底黑字的直接原因）

`src/settings-panel/styles.css` 暗色 token 块：

```css
.theme-dark .bz-sp-desk,
.theme-dark .bz-sp-mobile,
.theme-dark .bz-sp-mobile,            /* 复制粘贴残留 */
.theme-dark .bz-sp-picker-mask,
.theme-dark #bz-up-manager-popup, #bz-model-picker-popup {   /* ← 逗号后丢了 .theme-dark */
```

`#bz-model-picker-popup` 这条**没有 `.theme-dark` 前缀**，成为一条无条件命中的普通选择器，
把浅色 token 覆写进了暗色块。弹窗随即退回 Obsidian 原生变量
（`.bz-overlay-popup` 的 `--background-primary` 黑底 / 行 hover 用 `--background-modifier-hover` /
名称与来源用 `--text-muted`）→ 黑底黑字。

### B. 移动端定位与 core 居中链叠加（44px 错位的原因）

`createOverlay` 产出的 popup 是 `position: fixed; top:50%; left:50%;
transform: translate(-50%,-50%)`。移动端 `.bz-sp-mobile` 只给了 `height:100%`，
没有脱开这条居中链；配合 Obsidian 移动端头部安全区，面板与弹窗都被压出顶部空白。
且面板未挂全站统一的移动端顶距类 `.bz-panel-mtop`。

## 修复

1. **token 选择器**：补齐 `.theme-dark` 前缀、删除重复的 `.bz-sp-mobile` 条目。
2. **弹窗内部皮收口**：头部描边 / 内容区 / 列表行 hover·选中 / 名称·来源 / 空态
   全部改挂 `--sp-*`，与面板同皮（暗色下即炭黑夜航皮）。
3. **移动端定位**：
   - `.bz-sp-mobile` 改为 `inset:0` 真全屏铺满，脱开居中链（`transform:none`）；
   - 面板挂 `.bz-panel-mtop`（全站统一档，`max(44px, 安全区)`），域内不再重复声明 44px；
   - 模型选择器弹窗保持「居中卡片」形态（用户拍板），仅用 `max-height`
     把卡片夹进顶部安全区（44px）～底部安全区之间，使居中落在可视区内；宽度放开到 94vw。

## 守卫（防回归）

`tests/core/settings-model-picker-ui.test.ts` 新增样式源静态断言：

- 暗色 token 块内**每条**选择器都必须带 `.theme-dark ` 前缀
  （含 `#bz-model-picker-popup` / `#bz-up-manager-popup`）；
- 弹窗皮收口段内不得再出现 Obsidian 原生变量
  （`--background-modifier-hover` / `--background-modifier-active-hover` / `--text-muted`）。

`tests/settings-panel.test.ts` 新增：移动端面板挂 `bz-panel-mtop`。

## 验收

- 移动端 AI 组 → 获取模型名：弹窗为浅色亚麻皮 / 深色炭黑皮，模型名与来源小字清晰可读；
- 弹窗居中落在可视区内，不贴顶、不被裁；
- 设置面板顶部无多余空白；
- `pnpm test`（4104 通过）+ `tsc --noEmit` 全绿。
