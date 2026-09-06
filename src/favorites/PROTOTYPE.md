# 收藏本 · UI 原型基准（PROTOTYPE.md）

> 通用规则见 `docs/prototype-first.md`；本文件只写收藏本域的落地形态。

## 基准文件（共用 CSS，单源）

- **`prototype.html`** — 收藏本 UI 的评审壳。组件样式**零内联**，`<link>` 引用同目录 `./styles.css`——与插件构建是**同一份源文件**。改样式只改 `styles.css`，刷新本页即见，`pnpm run build` 自动带走插件侧，**不存在二次同步**。
- **`styles.css`** — 唯一样式源（bz-fav-* 前缀，变量组 `.bz-fav-scope` / `.theme-dark .bz-fav-scope`）。
- **`prototype-data.js`** — 演示数据（真实 vault 导出 51 条）。

评审壳内**只允许**写：演示壳样式（页面底色、396×780 手机框、徽牌/主题钮）与演示逻辑（JS）。组件 markup 与 `ui.ts` 保持同构（类名、`data-fav-*` 钩子一致）。

## 铁流程

1. **改 `styles.css`**（或原型 markup/JS）→ 双击 `prototype.html` 刷新评审；
2. 两端各过一遍（桌面面板 + 手机框内移动面板），亮暗各一遍（右上角主题钮切 `body.theme-dark`）；
3. 改了 markup 同步 `ui.ts`；跑 `pnpm test` + `tsc --noEmit` + `pnpm run build`。

## 原型 ↔ 插件差异（仅剩演示壳层）

| 评审壳 | 插件 |
|---|---|
| `body.theme-dark` 手动切换 | 跟随 Obsidian `.theme-dark` |
| `.demo-mob` 把 100vw/100vh 全屏态缩进 396×780 手机框 | `applyMobileWindowFullscreen` 全屏 |
| 抽屉遮罩收在手机框内（absolute） | 挂 body（fixed 全屏） |
| toast/确认框/主题钮自绘 | core notice / flow-dialog / esc-manager |
| lucide 内联 SVG（`FAV.icon`） | `<i data-lucide>` + `mountIcons` |

## 域内注意事项（踩过的坑）

- **移动端面板必须显式 `100vw/100vh`**：overlay 弹性子项不定宽，line-clamp 卡片的 max-content 会把面板撑到两倍屏宽（右列出屏）；grid 轨道用 `minmax(0,1fr)` + 卡片 `min-width:0` 双保险。
- **overflow 容器裁磁点**：磁贴行滚动容器留 `padding: 5px 0 6px`。
- **移动端磁贴行**：单行横滑、「新收藏」置首（桌面行尾）；关闭钮在头行右端 24×24（图标 12px）。
- **图标渲染点必须调 `mountIcons`**（磁贴行/头行/菜单/抽屉四处都栽过）。
- 桌面固定 900×620 + `max-width/max-height: calc(100vw - 48px)` 兜底；面板窄于 520px 时 container query 切双列。
