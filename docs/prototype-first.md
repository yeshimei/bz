# 原型先行 · UI 开发通用指导

适用所有功能域。核心一句话：**域内 `prototype.html` 是该域 UI 的唯一视觉基准，任何 UI/样式修改先改原型、评审通过后逐字同步到域代码，禁止在 styles.css/ui.ts 上直接目测调参。**

## 文件约定

每个有自绘 UI 的域，在 `src/<域>/` 下维护：

- **`prototype.html`** — 该域 UI 原型（单文件自包含：CSS 变量 + HTML + 原生 JS），桌面端与移动端**两端并存**于同一页，含亮暗切换与完整交互。双击即可打开评审，零依赖、不进构建。
- **`prototype-data.js`** — 原型演示数据（优先从真实 vault 导出），由 `prototype.html` 同目录引用。
- **`PROTOTYPE.md`**（可选）— 该域专属的同步映射表与域内特例，通用规则以本文为准。

原型历史版本与评审过程留在 `.zcode/ui-prototypes/`（不入 git），域内 `prototype.html` 始终保持与已部署实现一致的「当前定稿」。

## 铁流程

1. **改原型**：布局、交互、文案先在 `prototype.html` 里改到位（1:1 复刻任务逐字抄 CSS，禁止目测调参——历史教训：算好的值被上游残留规则污染，源码看着对、computed 不对，必须以实跑为准）。
2. **评审**：两端各过一遍（桌面窗口 + 移动端全屏），亮暗各看一遍。
3. **同步**：逐字照搬进 `src/<域>/styles.css`（`bz-<域>-*` 前缀防冲突）与 `ui.ts`；逻辑代码可复用域内既有设施，视觉值不翻译不改写。
4. **门禁**：`pnpm test` + `tsc --noEmit` + 构建。

## 同步规则

| 原型做法 | 插件做法 |
|---|---|
| 手动暗色切换（body.dark 变量组） | `.theme-dark` 下变量组，跟随 Obsidian 主题 |
| lucide `icon(name, px)` 内联 SVG | `<i data-lucide>` 占位 + `mountIcons`（见下） |
| localStorage 持久化 | 域 DataManager / settings 键 |
| toast / 确认框 / Esc / z 序 / 移动全屏 | 走 core 服务（notice、flow-dialog、esc-manager、z-order、mobile），**不照搬原型实现** |
| 固定尺寸演示面板 | 桌面=固定宽高面板；移动=全屏态（`applyMobileWindowFullscreen`） |

## 注意事项（跨域通用坑）

### 图标

- 插件模板里的 `<i data-lucide>` 是**占位符**，任何 innerHTML 渲染后必须调 `mountIcons(容器)`，否则图标**永远不出现**（多个域栽过：磁贴 + 号、关闭钮、右键菜单、抽屉）。
- 每新增一个 innerHTML 渲染点，先问：mountIcons 在哪调。
- 图标名用 Obsidian 内置 lucide 集；新名字先在别的域找先例，没有先例的重载后实测。

### 布局

- **overflow 滚动容器会裁绝对定位装饰**（磁点、磁钉、飘出边界的徽记）：滚动轴方向必须留 padding 容纳 `top:-Npx` 类装饰。
- 去掉容器 padding 解决遮挡后，滚动内容直抵边缘是预期，别把 padding 加回来。
- 面板固定尺寸配 `max-width/max-height: calc(100vw - 48px)` 兜底小窗；窄面板用 container query 退化布局（Obsidian Chromium 支持）。
- 浮层（菜单/抽屉/表单）与面板**同挂 scope 类**携带 CSS 变量，否则变量全丢。
- 核心按钮样式会压 flex 主轴，自绘菜单/抽屉按钮显式写 `justify-content: flex-start`。

### 两端

- 桌面与移动是**两套布局**不是缩放：桌面固定面板+右键菜单，移动全屏+底部抽屉+44px 触控档（`pointer:coarse`）。任何 UI 改动两端都要验。
- 移动端表单/弹窗留边（如 `min(430px, 100vw - 32px)`），不要 100% 贴边；全宽属于底部抽屉。

### 测试

- UI 测试锚 `bz-<域>-*` 类与 `data-*` 钩子，不锚原型类名。
- jsdom 不执行 mountIcons：mock 的 setIcon 记 `dataset.icon`，断言用 `[data-icon]`，不查 svg。
- 颜色断言读 `rgb()` 计算值；改样式后必须重载插件才能看到（CSS 随插件加载）。
