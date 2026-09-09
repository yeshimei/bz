# 原型先行 · UI 开发通用指导

域 UI 的唯一真理源是**与插件共用的实现源码**：`styles.css`（样式）、`render.ts`（markup/口径）、`ui.ts`（行为，经公共假层，ADR-0106，行为域全覆盖）。`prototype.html` 评审壳与插件是同一份代码的两个运行端——改源码一处两侧生效，无「同步/追赶」环节；两侧表现不一致 = 缺陷，修复改源码（或假层），禁止任一侧私改遮盖。迭代遵循「改源码 → 原型评审 → 构建」单向流程，评审以双击 `prototype.html` 实跑为准，禁止目测调参。行为单源域以 `scripts/build-preview.mjs` 的 `BEHAVIOR_DOMAINS` 为准（belongings/bookshelf/cinema/clipbook/favorites/home/knowledge/password-vault/review/secondbrain/settings-panel）。

## 总则

- 共享源码是唯一基准：任何 UI/行为改动先落源码，在 `prototype.html` 实跑评审，禁止绕过评审目测调参。
- 两侧表现不一致 = 缺陷：修复改共享源码（或假层），禁止反向适配或任一侧私改。
- 拿不准的问用户，绝不擅自替原型或域做取舍。

## 机制：共用实现，无需同步

| 单源 | 内容 | 生效 |
|---|---|---|
| `styles.css` | 样式 | 原型 × 插件 |
| `render.ts`（产物 `prototype-render.js`） | markup / 视图口径 | 原型 × 插件 |
| `ui.ts`（产物 `prototype-behavior.js`，ADR-0106） | 交互行为 | 原型 × 插件 |

改一处两侧自动生效，无二次同步。行为单源 = 原型直接运行插件同款 ui.ts：宿主差异由构建期 esbuild alias 换成公共假层 `prototypes/<域>/fake/`——零依赖 core 服务（notice/flow-dialog 等）真身打进；setIcon/Platform 用假 obsidian 覆盖共用；数据/AI/设置写接口一致的假函数（localStorage 假库/抛错降级/注入默认值）。

## 文件约定（2026-09-09 起分两处：域源码 `src/<域>/`，评审工件根级 `prototypes/<域>/`）

`src/<域>/`（插件源码，构建/聚合入口依赖）：

| 文件 | 作用 |
|---|---|
| `styles.css` | 唯一样式源（`bz-<域>-*` 前缀；评审壳经 `../../src/<域>/styles.css` 相对链引用同一份） |
| `render.ts` | markup 单源（面板/弹窗/行操作序列） |
| `ui.ts` | 行为单源：生命周期/事件委托/数据流（markup 只出自 render.ts） |
| `layouts/<布局>/render.ts` | 布局差异层（有则） |

`prototypes/<域>/`（评审工件；产物入库保双击零依赖）：

| 文件 | 作用 |
|---|---|
| `prototype.html` | 评审壳：双 iframe（桌面 / 移动 396 各跑一份真行为）+ 自检 |
| `prototype-view.html` | iframe 视图页：boot + 面板入口（各域一份） |
| `fake-sim.ts` | 行为产物入口：种子数据 + 注入 + 导出面板入口（各域一份；import 上溯 `../../src/…`） |
| `fake/fake-obsidian.ts` | 公共假 obsidian：Platform 视口判定 / setIcon（X_ICONS）/ FakeVault（localStorage + storage 桥） |
| `prototype-render.js` / `prototype-behavior.js` | 构建产物（入库，勿手改；`render.ts`/`fake-sim.ts` 经 build-preview 打出） |
| `prototype-data.js` / `prototype-icons.js` | 演示数据/图标（生成物） |
| `PROTOTYPE.md` | 域评审文档（有则） |

原型历史版本在 `.zcode/ui-prototypes/`（不入 git）；`prototypes/<域>/prototype.html` 始终是当前定稿。

## 流程（单向）

1. **改源码**：样式改 `styles.css`；结构/交互/markup 改 `render.ts`（改后重出 `prototype-render.js`）；**行为逻辑改 `ui.ts`（改后重出 `prototype-behavior.js`）**；演示外景/自检改 `prototype.html`。禁止手改任何构建产物，禁止往 `ui.ts` 手写 markup。
2. **评审**：双击 `prototype.html`，两端 × 亮暗各过一遍。1:1 复刻以浏览器实跑为准，**禁止目测调参**（残留规则污染 computed）。
3. **构建**：`pnpm test` + `tsc --noEmit` + `pnpm run build`。

## 快速原型模式（2026-09-10 用户拍板）

用户说「**走快速原型**」时，UI 迭代走轻量闭环，不套全量门禁：

1. **worktree**：从最新 master 开 worktree（`../.dsh-worktrees/<名>`），在其中起 `node scripts/preview-live.mjs` 服务迭代（改 `.ts` 自动重出行为/预览包并推浏览器刷新，改 `.css/.html` 推刷新）。
2. **迭代期三不**：不构建（不 `pnpm run build`/不部署）、不提交、不跑全量门禁——服务热重载即评审，反复改到用户满意。
3. **测试口径**：只改样式和 UI → 不测试；涉及功能代码（ui.ts/data 等行为链）→ 只跑当前域测试文件（如 `pnpm exec vitest run tests/knowledge`）。
4. **收尾（用户说「同步」）**：恢复全流程——worktree `git merge master` 同步底 → 全量 `pnpm test` + `tsc --noEmit` → 提交 → 合并回主仓库 → 主仓库 `pnpm run build` 部署（提交产物）→ 清 worktree。
5. 种子数据改动在浏览器里不生效 = localStorage 种子标记未清：点评审壳「重置演示数据」或清 `bz-sim:*` 后刷新。

## 一致性守卫（自动化强制）

- 两侧消费同一份 `render.ts`（ADR-0104 结构性保证）。
- `render-purity.test.ts` 守纯层契约（import 白名单、禁 obsidian/moment、禁模块级可变状态）。
- UI 测试锚（`bz-<域>-*` 类 / `data-*` 钩子）同源 `render.ts`，断言通用。
- 评审壳自检（`?selftest=1` / CDP）：跑同一份 ui.ts（真交互真断言）。

## 壳层差异（允许不同，组件层禁止分叉）

| 评审壳 | 插件 |
|---|---|
| `body.theme-dark` 手动切 | 跟随 Obsidian `.theme-dark` |
| 移动端 396px iframe（容器查询出移动布局） | `Platform.isMobile` + `applyMobileWindowFullscreen` |
| FakeVault：localStorage + storage 桥 | 真 vault 文件 + modify 监听 |
| setIcon 用 BLG_ICONS 内联 SVG | `setIcon` 原生 lucide |
| localStorage 假数据 + 注入默认设置 | DataManager / settings |
| `window.BZR_/BZW_<域>`（产物） | `render.ts`/`ui.ts` 直接 import |

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