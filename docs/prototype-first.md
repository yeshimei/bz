# 原型先行 · UI 开发通用指导

原型是该域 UI 的唯一真理源，差异即缺陷，修复只能改原型再让域追赶。域与原型共用样式和渲染实现，内容一致性由自动化测试强制；迭代遵循「改原型→评审→构建」单向流程，禁止反向适配或私改。

## 总则

- `prototype.html` 是唯一视觉基准，改 UI 必须先改原型并评审，禁止绕过原型目测调参。
- 域与原型不一致 = 域缺陷，修复方向只有「原型写进域」，禁止反向适配或域侧私改。
- 拿不准的问用户，绝不擅自替原型或域做取舍。

## 机制：共用实现，无需同步

| 单源 | 内容 | 生效 |
|---|---|---|
| `styles.css` | 样式 | 原型 × 插件 |
| `render.ts`（产物 `prototype-render.js`） | markup / 视图口径 | 原型 × 插件 |

改一处两侧自动生效，无二次同步。

## 文件约定（`src/<域>/`）

| 文件 | 作用 |
|---|---|
| `styles.css` | 唯一样式源（`bz-<域>-*` 前缀） |
| `render.ts` | markup 单源（面板/弹窗/行操作序列） |
| `prototype-render.js` | 构建产物（入库，勿手改） |
| `prototype.html` | 评审壳：消费 `prototype-render.js`，桌面/移动两端并存 |
| `prototype-data.js` / `prototype-icons.js` | 演示数据/图标（生成物） |

原型历史版本在 `.zcode/ui-prototypes/`（不入 git）；域内 `prototype.html` 始终是当前定稿。

## 流程（单向）

1. **改原型**：样式改 `styles.css`；结构/交互/markup 改 `render.ts`（改后重出 `prototype-render.js`）；演示逻辑改 `prototype.html`。禁止手改 `prototype-render.js`，禁止往 `ui.ts` 手写 markup。
2. **评审**：双击 `prototype.html`，两端 × 亮暗各过一遍。1:1 复刻以浏览器实跑为准，**禁止目测调参**（残留规则污染 computed）。
3. **构建**：`pnpm test` + `tsc --noEmit` + `pnpm run build`。

## 一致性守卫（自动化强制）

- 两侧消费同一份 `render.ts`（ADR-0104 结构性保证）。
- `render-purity.test.ts` 守纯层契约（import 白名单、禁 obsidian/moment、禁模块级可变状态）。
- UI 测试锚（`bz-<域>-*` 类 / `data-*` 钩子）同源 `render.ts`，断言通用。
- 评审壳自检（`?selftest=1` / CDP）跑同一份渲染实现。

## 壳层差异（允许不同，组件层禁止分叉）

| 评审壳 | 插件 |
|---|---|
| `body.theme-dark` 手动切 | 跟随 Obsidian `.theme-dark` |
| 移动端手机演示框 | `applyMobileWindowFullscreen` 全屏 |
| 自绘 toast/确认框 | core 服务 |
| lucide 内联 SVG | `<i data-lucide>` + `mountIcons` |
| localStorage 假数据 | DataManager / settings |
| `window.BZR_<域>`（产物） | `render.ts` 直接 import |

## 注意事项（通用坑）

### 图标
- `<i data-lucide>` 是占位符，任何 innerHTML 渲染后必须调 `mountIcons(容器)`，否则图标不出现。
- 图标名用 Obsidian 内置 lucide 集，拿不准查 `obsidian.asar`。

### 布局
- **overlay 弹性子项必须显式宽高**：移动全屏面板显式 `100vw/100vh`；grid 用 `minmax(0,1fr)` + 卡片 `min-width:0`。
- **overflow 容器裁绝对定位装饰**：滚动轴留 padding 容纳 `top:-Npx` 装饰。
- 面板固定尺寸配 `max-width/height: calc(100vw - 48px)` 兜底；窄面板用 container query。
- 浮层与面板**同挂 scope 类**，否则 CSS 变量全丢。
- 自绘按钮显式 `justify-content: flex-start`（核心按钮样式压 flex 主轴）。
- **单类按钮规则被 reset 压掉**：自绘按钮一律带容器前缀（`.bz-<域>-panel .xxx`）。
- **变体类必须追加基础类，不许三选一**：基础类写结构/尺寸，变体类只换色。
- **头行固定、内容区滚动**：面板 `flex-column`，头 `flex:none`，内容 `flex:1; min-height:0; overflow:auto`。

### 两端
- 桌面与移动两套布局，任何改动两端都验。
- 移动端表单/弹窗留边（`min(430px, 100vw - 32px)`），全宽仅限底部抽屉。

### 测试
- UI 测试锚用 `bz-<域>-*` 类 / `data-*` 钩子。
- jsdom 不执行 `mountIcons`：mock `setIcon` 记 `dataset.icon`，断言用 `[data-icon]`。
- 颜色断言读 `rgb()` 计算值，改样式后需重载插件。