# 569 · 第二大脑面板图标缺失：引导 / 进度态停在空方块

- 状态：已交付（2026-11-15，worktree `D:\Obsidian\bz-wt-sb-icons`，分支 `fix/sb-icons`）
- 提出：2026-11-15 用户报「图标不见了，第二大脑」，要求桌面端与移动端都查

## 根因

`src/secondbrain/panel.ts` 的 `createUI()` 把 `panelShellHtml()` 写进 `popup.innerHTML` 后**没有物化图标**。
全文件只有两处 `mountIcons`：

- `renderStats()` 末尾（内容态统计渲染完顺手挂一次）；
- `renderDist()` 末尾（来源树重渲）。

而 `render()` 在引导态 / 进度态提前 return（`showInitGuidance()` / `enterProgressView()`），
根本走不到这两处。于是头行 glyph、引导页大图标、头行功能钮与移动关闭钮的 ×
全部停在空的 `<i data-lucide>` 占位上——视觉上就是几个空方块。

桌面与移动共用 `openSecondBrainPanel()`（`index.ts`，无端分支），所以两端同症状。

## 真机证据（修复前）

实例 `sb-icon-check`（空库 → 引导态），桌面 1024×800 与移动 390×844@3x 实测一致：

- `.bz-sb-panel` 内 14 个 `[data-lucide]`、**0 个 `.bz-ic`**；
- 截图：`shots/03-desktop-before.png`、`shots/07-mobile-panel-before.png`（头行与引导页都是空红方块）。

## 修法

| 位置 | 改了什么 |
|---|---|
| `panel.ts` `createUI()` | `popup.innerHTML = panelShellHtml()` 之后立即 `mountIcons(popup)`——一处修好引导 / 进度 / 内容三态；内容态原有的动态物化（`renderStats` / `renderDist`）保留不删 |
| `chat-panel.ts` | `addChatMessage()` 两个气泡壳与检索中态气泡（局部 `innerHTML` 重写）补 `mountIcons`——who 行的 send / brain 此前也停在占位 |
| `weekly-ui.ts` | 本周动态弹层 `ensureModal()` 建壳后补 `mountIcons(popup)`——头行 glyph 与关闭钮同属一类漏挂 |
| `styles.css` | 新增「图标尺寸」段：按容器把 `ic()` 的像素值补回（头行 19 / 引导页 34 / 功能钮 14 / 分节标题 13 / 来源树箭头 12 / 周报头 17 / 对话返回 15 · 发送 14 · who 行 10），14px 兜底 |

### 为什么不改全局 `mountIcons`

`core/ui/icons.ts` 的 `mountIcons` 替换占位时只复制 `className`，`ic()` 写在内联 `style` 上的宽高
会一起丢——这是**全仓现状**，别的域靠各自的 `容器 svg {}` 规则兜着。改它去搬 `style`
会波及所有域的图标尺寸（有的域恰恰想用容器尺寸覆盖内联值），所以只在第二大脑域内补。

### 逐点核对过、但不需要补的地方

- `mobile-panel.ts:307/314/360`：三处都是 `innerHTML = ''` 清空，不含 `ic()` 占位；
- `panel.ts` 的趋势 / 日志 / 最近列表 / 库摘要四处 `innerHTML`：模板本身不含 `ic()`；
- `reference-panel.ts`、`float-window.ts`：各自的 `mountIcons` 已在位。

## 验收

- `tsc --noEmit` 干净；`test-affected --since master` 546 文件 / 8437 例全绿。
- 新增 `tests/secondbrain/shell-icons.test.ts` 5 例（先红后绿）：引导态占位清零且 glyph / 引导页 /
  移动关闭钮 / 四枚功能钮都有 `.bz-ic`；内容态同样；周报弹层头行；对话气泡 who 行；
  样式里四档容器尺寸在场。
- 真机双端复验（同一实例、同一空库，可与基线对比）：
  - 桌面：`[data-lucide]` 0 / `.bz-ic` 14；`shots/08-desktop-after.png`
  - 移动：`[data-lucide]` 0 / `.bz-ic` 14；`shots/09-mobile-panel-after.png`
  - 移动端引导态右上关闭钮的 × 同时恢复（`#bz-sb-mb-close` 内 `.bz-ic` 在位、未被收起）。

## 代价与暂缓

- 内容态建壳时会先物化一次、`renderStats()` 再扫一次（`querySelectorAll` 空集，开销可忽略）；
- 对话 who 行与周报弹层的真机验证受「空库时对话命令会转向主面板引导态」限制，由单测覆盖，
  真实库（有索引）打开对话即可见。
