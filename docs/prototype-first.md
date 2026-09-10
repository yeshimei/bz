# 原型先行 · UI 开发通用指导

域 UI 的唯一真理源是**与插件共用的实现源码**（`src/<域>/` 的 `styles.css` / `render.ts` / `ui.ts`）。原型评审壳（`prototypes/<域>/prototype.html`）与插件是同一份代码的两个运行端：改源码一处两侧生效；两侧不一致 = 缺陷，改源码（或假层），禁止任一侧私改、禁止手改构建产物、禁止目测调参。

行为单源域以 `scripts/build-preview.mjs` 的 `BEHAVIOR_DOMAINS` 为准：belongings / bookshelf / cinema / clipbook / diary / favorites / home / knowledge / memo / password-vault / review / secondbrain / settings-panel。

## 文件约定

| 位置 | 内容 |
|---|---|
| `src/<域>/styles.css` | 唯一样式源（`bz-<域>-*` 前缀；评审壳相对链引用同一份） |
| `src/<域>/render.ts` | markup 单源（纯层：禁 obsidian/moment/core 服务、禁模块级可变状态，`render-purity.test.ts` 强制） |
| `src/<域>/ui.ts` | 行为单源（生命周期/事件委托/数据流；禁手写 markup） |
| `prototypes/<域>/prototype.html` + `prototype-view.html` | 评审壳：双 iframe（桌面 920 + 移动 412×915 真机尺寸）跑真行为，可带 `?selftest=1` 自检 |
| `prototypes/<域>/fake-sim.ts` + `fake/fake-obsidian.ts` | 行为产物入口与公共假层（localStorage 假 vault / 假 Platform / setIcon 图标表 / AI 罐头） |
| `prototypes/host-theme.css` / `host-base.css` | 宿主保真层（壳专用，插件内由真宿主提供）：前者是色彩 token，后者是 app.css 的裸 `button` 基线 |
| `prototype-render.js` / `prototype-behavior.js` | 构建产物（入库保双击零依赖；勿手改） |

`host-base.css` 的来历：评审壳不载宿主 `app.css`，域样式若只写 `display:flex` 而不写 `justify-content`，真机会被宿主基线（`display:inline-flex` + `justify-content:center` + `height:30px`）压成居中，浏览器预览却"一切正常"（2026-09-10 影院右键菜单/长按抽屉/左下角入口实例）。补这一层后，这类宿主基线坑在评审阶段就能暴露。**芯样式仍须自足**：该文件只在壳里补宿主基线，域 CSS 自己该写的 `justify-content` / `text-align` 一条都不能省（否则真机照样跑偏）。

原型历史版本在 `.zcode/ui-prototypes/`（不入 git）；`prototypes/<域>/prototype.html` 始终是当前定稿。

## 快速原型模式（默认迭代方式，用户说「走快速原型」）

1. 从最新 master 开 worktree（`../.dsh-worktrees/<名>`），起 `node scripts/preview-live.mjs`。
2. 迭代三不：不构建、不提交、不跑全量门禁。热重载即评审，反复改到用户满意。
3. 测试：只改样式/UI 不测试；动功能代码只跑当前域测试（如 `pnpm exec vitest run tests/knowledge`）。
4. 用户说「同步」→ 收尾全流程：merge master → 全量 `pnpm test` + `tsc --noEmit` → 提交 → 合并回主仓库 → 主仓库 `pnpm run build` 部署（提交产物）→ 清 worktree。
5. 种子数据改了浏览器没变 = localStorage 种子标记未清：点壳「重置演示数据」或清 `bz-sim:*`。

## 注意事项（高频坑）

- 图标：`<i data-lucide>` 是占位，innerHTML 渲染后必须 `mountIcons(容器)`；jsdom 里 mock `setIcon` 记 `dataset.icon`，断言用 `[data-icon]`。
- 布局：overlay 弹性子项显式宽高；grid 用 `minmax(0,1fr)` + 卡片 `min-width:0`；头行固定、内容区 `flex:1; min-height:0; overflow:auto`；浮层与面板**同挂 scope 类**（否则 CSS 变量全丢）；自绘按钮带容器前缀（防 reset 压样式）。
- 两端：桌面 + 移动（412×915 iframe / `Platform.isMobile`）任何改动都验；移动弹窗留边 `min(430px, 100vw - 32px)`。
- **移动外景 = 小米13U 真机尺寸**（412×915 CSS px = 1440×3200 物理 px ÷ dpr 3.5；412 仍 ≤768 → 移动布局命中）；
  13 个行为单源域共用 `prototypes/mob-1to1.css` + `mob-1to1.js`，把外景缩放到屏幕上的
  70.2×155.9mm（= 真机屏幕实测尺寸）。缩放用 `transform`，绝不能改 iframe 的 `width/height`
  （会连内部视口一起改，动到 `@media ≤768` 判据）。换显示器只需改 `mob-1to1.js` 的 `RULER_MM`。
- 测试：UI 锚用 `bz-<域>-*` 类 / `data-*` 钩子；颜色断言读 `rgb()` 计算值。
- 宿主差异（theme 切换 / 假数据 / 图标表 / Platform）全部收敛在 fake 层与评审壳，组件层禁止分叉。
