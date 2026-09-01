# Ticket 175 — 输入框点击聚焦去强化外轮廓（outline）

> 备忘：用户反馈「每次选中并点击输入框的时候，输入框外围就会有一个加强的、特别明显的边框，必须是外轮廓」。

## 背景

core 层 p3 焦点伞规则（`src/core/styles.css` 的 `:focus-visible` 全站焦点环）给 `input/select/textarea/contenteditable` 统一加 `outline: 2px solid var(--interactive-accent); outline-offset: 2px`。

浏览器基线行为：文本录入元素（text/number/date/textarea/select）**点击聚焦时恒匹配 `:focus-visible`**，因此鼠标点输入框也会出强外轮廓——与键盘 Tab 导航的焦点环难以区分，视觉干扰明显（用户原话「特别明显的边框」）。本票去除文本录入元素点击聚焦时的外轮廓，保留键盘焦点可达性。

## 方案

在 `src/core/styles.css` 伞规则后追加精确覆盖：文本录入元素（`input`、`select`、`textarea`、`[contenteditable="true"]`）在 `:focus-visible` 时去除 `outline`（`outline: none`）。

- 覆盖规则选择器与伞规则同构（`[class*="bz-"]` 伞 + 遗留根 id/类清单），保证特异性不低（`[class*="bz-"]:is(input,...)` 与伞规则 `[class*="bz-"]:is(button,input,...):focus-visible` 特异性对比：伞规则 = 属性选择器(0,1,0) + 伪类 + :is(…, …)（取内部最高 = (0,1,0)），合计约 (0,3,0)；覆盖规则 `[class*="bz-"]:is(input, select, textarea, [contenteditable="true"]):focus-visible` 内部 :is 最高 = `[contenteditable]` 属性 (0,1,0)，合计 (0,3,0) 相同——按源顺序后者胜出，可行）。非 bz 遗留根用显式 id/类清单（与伞规则一致）保证同特异性后置胜出。
- `button`、`a[href]`、`[tabindex]` 等非文本元素**不动**：键盘 Tab 焦点环保留。
- 说明：`input[type="checkbox"]`/`radio` 属 `input` 亦被覆盖（点击不出环；键盘 Tab 仍可聚焦，视觉通过 Obsidian 原生 checked 态反馈，且原规则本就给 checkbox 出环——行为不变，仅去外环）。若需保留可后续细化，当前按用户诉求「输入框外围」整体去环。
- 与既有 `outline: none` 输入框（review 搜索框、settings-panel `.bz-sp-input`、secondbrain 聊天输入等）不冲突：这些元素原本就靠 `:focus border-color` 高亮，伞规则被 `outline: none` 局部覆盖后无环；本覆盖后统一无环，boder 高亮保留。

## 涉及文件

- `src/core/styles.css`：追加覆盖规则 + 更新伞规则注释（原注释「属预期行为，接受」改为「ticket 175 去除文本录入元素点击聚焦外环」）。
- 根 `styles.css`：构建聚合产物，`npm run build` 重新生成（铁律 9：勿手改）。
- `main.js`：无 TS 变更，`npm run build` 一并同步（构建脚本会重建）。

## 测试与门禁

- 纯 CSS 变更：无新增单测；跑全量 `pnpm test` + `pnpm exec tsc --noEmit` 门禁。
- 构建：`pnpm run build`，确认根 `styles.css` 含覆盖规则、vault 插件目录（E:/Obsidian/叫我包仔/.obsidian/plugins/bz）styles.css 同步。
- 人工验证点（用户侧）：点击任一输入框（备忘录搜索/日记添加/设置面板/聊天输入）不再出现外轮廓；Tab 键盘导航按钮/链接仍有焦点环。
