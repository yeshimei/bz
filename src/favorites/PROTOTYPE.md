# 收藏本 · UI 原型基准（PROTOTYPE.md）

> 通用规则（铁流程/同步规则/跨域通用坑）见 `docs/prototype-first.md`；本文件只写收藏本域的映射与特例。

## 基准文件

- **`prototype.html`** — 收藏本唯一视觉基准（源自 `.zcode/ui-prototypes/favorites-cork-5/c5-linen-full.html`，C5 亚麻磁贴方案，2026-09-06 拍板）。桌面端（900×620 固定面板）与移动端（396×780 面板，全屏态）两端并存，含亮暗切换、完整交互（磁贴筛选 / 右键菜单 / 底部抽屉 / 添加编辑表单 + AI 整理 / 撤销 toast）。
- **`prototype-data.js`** — 原型演示数据（真实 vault 导出 51 条），`prototype.html` 同目录引用。

改 UI 前直接双击打开 `prototype.html` 即可评审，无任何依赖。

## 铁流程：原型先行

**任何涉及 UI 和样式的修改，必须先改 `prototype.html`，再同步到域代码**，禁止直接在 `styles.css`/`ui.ts` 上目测调参（issue 227 系列教训：1:1 任务目测调参必返工）。

1. 改 `prototype.html`（布局/交互先在原型里评审到位）；
2. 逐字照搬同步到 `src/favorites/styles.css`（bz-fav-* 前缀）与 `src/favorites/ui.ts`；
3. 两端各验一遍（桌面窗口 + 移动端全屏），跑 `pnpm test` + `tsc --noEmit` 门禁。

## 同步映射

| 原型 | 域代码 | 说明 |
|---|---|---|
| `body.dark` 变量组 | `.theme-dark .bz-fav-scope` | 原型手动暗色钮 → 跟随 Obsidian 主题 |
| `.frame`（900×620） | `.bz-fav-panel:not(.bz-fav-mob)` | 固定宽高 + 边框/圆角/投影 |
| `.phone`（396×780） | `.bz-fav-panel.bz-fav-mob` | 插件里是全屏态，非固定尺寸 |
| `.ctx` / `.sheet` / `.mask+.form` | `.bz-fav-ctx` / `.bz-fav-sheet` / `.bz-fav-form` | 浮层同挂 `.bz-fav-scope` 携带变量 |
| lucide `icon(name, px)` | `iconSpan(name)` + `mountIcons` | **见下「图标」** |
| toast / 确认框 | core `notifyUndo` / `flow-dialog` | 不照搬，走跨域服务 |

## 注意事项（踩过的坑）

### 两端

- **图标必须 `mountIcons`**：插件里模板用 `<i data-lucide>` 占位，任何 innerHTML 渲染后**不调 `mountIcons` 图标就永远不出现**（新收藏 +/关闭钮/菜单/抽屉各栽过一次）。新加模板渲染点，先问 mountIcons 在哪。
- **overflow 容器会裁磁点**：磁贴顶部的圆钉（`::before` `top:-4px`）会被 `overflow-x:auto` 裁掉，滚动容器必须留 `padding-top: 5px`。
- **fixed 尺寸与遮挡**：面板固定高下去掉底部 padding 后，滚动区直抵底边是预期；若底部出现遮挡，先查容器 padding 而不是加回来。
- **浮层同挂 scope**：菜单/抽屉/表单都挂 `.bz-fav-scope`，否则 CSS 变量全丢（白底黑字裸奔）。

### 桌面端

- 面板固定 900×620，`max-width/max-height: calc(100vw - 48px)` 兜底小窗；窄于 520px 时 container query 切双列平摊。
- 点遮罩 / Esc 关面板；关闭钮只在移动端显示。

### 移动端

- 磁贴行平铺单行横滑，「新收藏」chip 置首（桌面行尾）；触屏 44px 触控档（`pointer:coarse`）。
- 点卡片弹底部抽屉（不是右键）；表单宽 `min(430px, 100vw - 32px)` 留边。
- 关闭钮在头行右端（24×24，图标 12px），跟随 `applyMobileWindowFullscreen` 全屏态。

### 测试

- UI 测试锚 `.bz-fav-*` 类与 `data-fav-*` 钩子；jsdom 不跑 mountIcons（mock setIcon 记 `dataset.icon`，断言用 `[data-icon]`）。
