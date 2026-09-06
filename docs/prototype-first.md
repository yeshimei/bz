# 原型先行 · UI 开发通用指导

适用所有功能域。核心两句话：

1. **域内 `prototype.html` 是该域 UI 的唯一视觉基准**，任何 UI/样式修改先过原型评审，禁止绕过原型直接目测调参。
2. **原型与域共用同一份 `styles.css`**（原型 `<link>` 引用），改样式只有一处，刷新原型即见、构建自动带走——**不存在样式二次同步**。

## 文件约定

每个有自绘 UI 的域，在 `src/<域>/` 下维护：

- **`styles.css`** — 唯一样式源（`bz-<域>-*` 前缀；变量组挂 scope 类 + `.theme-dark` 暗 组），构建聚合进根 `styles.css`，同时被 `prototype.html` 引用。
- **`prototype.html`** — 评审壳。组件样式**零内联**，`<link href="./styles.css">`；markup 与 `ui.ts` 渲染结构同构（同类名、同 `data-*` 钩子）。壳内只允许写：演示壳样式（页面底色、手机演示框、徽牌/主题钮）与演示逻辑（JS：localStorage 假数据、自绘确认框/toast、手动亮暗钮）。桌面面板与移动面板**两端并存**，双击打开、零依赖、不进构建。
- **`prototype-data.js`** — 演示数据（优先从真实 vault 导出）。
- **`PROTOTYPE.md`**（可选）— 域内落地形态与特例，通用规则以本文为准。

原型历史版本与评审过程留在 `.zcode/ui-prototypes/`（不入 git）；域内 `prototype.html` 始终是「当前定稿」。

## 铁流程

1. **改**：样式改 `styles.css`（唯一入口）；结构/交互改原型 markup+JS，同步改 `ui.ts`（markup 同构，照搬类名与钩子）。
2. **评审**：双击 `prototype.html`，两端（桌面面板 + 移动演示框）各过一遍，亮暗各一遍。历史教训：1:1 复刻目测调参必错（残留规则污染 computed 值），一切以浏览器实跑为准；重要改动截图存档。
3. **门禁**：`pnpm test` + `tsc --noEmit` + `pnpm run build`。

> **迭代节奏（用户拍板）**：UI/样式快速迭代期**只改原型（含共享 styles.css）并评审，不构建**——构建部署只在用户明说「同步」时执行。源码提交照常。

> 为什么共用 CSS 可行：原型评审壳与插件面板的差异只在**壳层**（亮暗开关方式、移动端是手机框还是全屏、toast/确认框走 core），组件本体（面板/磁贴行/卡片/菜单/抽屉/表单）两侧 DOM 同构、类名一致，同一份 CSS 天然两端通用。

## 壳层差异对照（允许不同，组件层禁止分叉）

| 评审壳 | 插件 |
|---|---|
| `body.theme-dark` 手动切换 | 跟随 Obsidian `.theme-dark` |
| 移动端缩进固定尺寸手机演示框 | `applyMobileWindowFullscreen` 全屏态 |
| toast/确认框/Esc 自绘演示 | core 服务（notice、flow-dialog、esc-manager、z-order、mobile） |
| lucide 内联 SVG（`FAV.icon(name, px)`） | `<i data-lucide>` 占位 + `mountIcons` |
| localStorage 假数据 | 域 DataManager / settings 键 |

## 注意事项（跨域通用坑）

### 图标

- 插件模板里的 `<i data-lucide>` 是**占位符**，任何 innerHTML 渲染后必须调 `mountIcons(容器)`，否则图标**永远不出现**（多个域栽过：磁贴 + 号、关闭钮、右键菜单、抽屉）。每新增一个渲染点，先问 mountIcons 在哪调。
- 图标名用 Obsidian 内置 lucide 集；新名字先在别的域找先例，拿不准就解包 `D:/Apps/Obsidian/resources/obsidian.asar` 查图标表。

### 布局

- **overlay 弹性子项必须显式宽高**：不定宽子项会被 line-clamp（`-webkit-box`）卡片的 max-content 撑爆（移动端曾撑到两倍屏宽）。移动全屏面板显式 `100vw/100vh`；grid 轨道用 `minmax(0,1fr)` + 卡片 `min-width:0` 双保险。
- **overflow 滚动容器会裁绝对定位装饰**（磁点/磁钉/飘出徽记）：滚动轴留 padding 容纳 `top:-Npx` 类装饰；去掉 padding 解决遮挡后别加回来。
- 面板固定尺寸配 `max-width/max-height: calc(100vw - 48px)` 兜底小窗；窄面板 container query 退化布局（Obsidian Chromium 支持）。
- 浮层与面板**同挂 scope 类**携带 CSS 变量，否则变量全丢。
- 核心按钮样式会压 flex 主轴，自绘菜单/抽屉按钮显式 `justify-content: flex-start`。
- **单类按钮规则会被 reset 压掉**：`button:not(.clickable-icon)` 是 `0,1,1`，裸单类（`.xxx-close`）的 `0,1,0` 必输（背景/字色/投影被 unset）。自绘按钮一律带容器前缀（`.bz-<域>-panel .xxx` ≥ `0,2,0`）。
- **头行/工具行必须固定、只有内容区滚动**：面板 `display:flex; flex-direction:column; overflow:hidden`，头行 `flex:none`，内容区 `flex:1; min-height:0; overflow:auto`——面板整体滚动会把头行滚走。

### 两端

- 桌面与移动是**两套布局**不是缩放：桌面固定面板+右键菜单，移动全屏+底部抽屉+44px 触控档（`pointer:coarse`）。任何 UI 改动两端都要验。
- 移动端表单/弹窗留边（如 `min(430px, 100vw - 32px)`），不要 100% 贴边；全宽属于底部抽屉。

### 测试

- UI 测试锚 `bz-<域>-*` 类与 `data-*` 钩子，与原型 markup 同构所以断言通用。
- jsdom 不执行 mountIcons：mock 的 setIcon 记 `dataset.icon`，断言用 `[data-icon]`，不查 svg。
- 颜色断言读 `rgb()` 计算值；改样式后必须重载插件才能看到（CSS 随插件加载）。
