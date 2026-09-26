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
| `.scratch/<名>/` | **探索稿**（未定稿的方案对比 / 一次性实验页 / 动效试做 / 探针脚本）：gitignored，不入 git、不参与门禁与新鲜度守卫；拍板后才上岸源与定稿壳 |

`host-base.css` 的来历：评审壳不载宿主 `app.css`，域样式若只写 `display:flex` 而不写 `justify-content`，真机会被宿主基线（`display:inline-flex` + `justify-content:center` + `height:30px`）压成居中，浏览器预览却"一切正常"（2026-09-10 影院右键菜单/长按抽屉/左下角入口实例）。补这一层后，这类宿主基线坑在评审阶段就能暴露。**芯样式仍须自足**：该文件只在壳里补宿主基线，域 CSS 自己该写的 `justify-content` / `text-align` 一条都不能省（否则真机照样跑偏）。

原型历史版本在 `.zcode/ui-prototypes/`（不入 git）；`prototypes/<域>/prototype.html` 始终是当前定稿。

## 快速原型模式（默认迭代方式，用户说「走快速原型」）

1. 从最新 master 开 worktree（`../.dsh-worktrees/<名>`），起 `node scripts/preview-live.mjs`。
2. 迭代三不：不构建、不提交、不跑全量门禁。热重载即评审，反复改到用户满意。
3. 测试：只改样式/UI 不测试；动功能代码只跑当前域测试（如 `pnpm exec vitest run tests/knowledge`）。
4. 用户说「同步」→ 收尾全流程：merge master → 全量 `pnpm test` + `tsc --noEmit` → 提交 → 合并回主仓库 → 主仓库 `pnpm run build` 部署（提交产物）→ 清 worktree。
5. 种子数据改了浏览器没变 = localStorage 种子标记未清：点壳「重置演示数据」或清 `bz-sim:*`。

## 探索稿（未定稿的方案）= `.scratch/<名>/`

「还没拍板进哪一版」的东西——**方案对比、一次性实验页、动效试做、探针脚本**——一律写 `.scratch/<名>/`。

- **为什么**：域 UI 的唯一真理源是 `src/<域>/`（改一处随构建进插件），评审壳 `prototypes/<域>/` 是**定稿态**的另一运行端。把四套候选方案写进这两处，等于让「方案」提前混进真理源与定稿壳——拍板后要么留一堆死代码，要么做一次危险的回退。
- **禁止**：往 `src/<域>/`、`prototypes/<域>/` 写未定稿方案；手改任何构建产物。
- **允许**：从 `src/<域>/styles.css` / `src/core/ui/tokens.css` **摘抄**样式片段与口径（探索稿要「手感贴着真卡判」），但摘抄文件头必须写明「来源 + 版本日期 + 拍板后以 src 为准重写」，**禁止把摘抄回灌源**。
- **预览**：`.scratch/` 不在热更新监听的两棵树内（只 watch `src/` 与 `prototypes/`），由 `preview-live` 静态服务——改完手动刷页面（如 `http://localhost:5177/.scratch/<名>/index.html`）。
- **上岸**：拍板后把入选实现按单源口径落到 `src/<域>/`（行为 `ui.ts` + 样式 `styles.css`）、定稿壳自检与 `tests/<域>/`；探索稿原地留作本地备查（不入 git，无需清理）。
- **git**：`.scratch/` 在 `.gitignore`，不入库、不参与门禁与 `preview-freshness` 守卫（也就没有「产物过期」这类噪音）。

## 注意事项（高频坑）

- 图标：`<i data-lucide>` 是占位，innerHTML 渲染后必须 `mountIcons(容器)`；jsdom 里 mock `setIcon` 记 `dataset.icon`，断言用 `[data-icon]`。
- 布局：overlay 弹性子项显式宽高；grid 用 `minmax(0,1fr)` + 卡片 `min-width:0`；头行固定、内容区 `flex:1; min-height:0; overflow:auto`；浮层与面板**同挂 scope 类**（否则 CSS 变量全丢）；自绘按钮带容器前缀（防 reset 压样式）。
- 两端：桌面 + 移动（412×915 iframe / `Platform.isMobile`）任何改动都验；移动弹窗留边 `min(430px, 100vw - 32px)`。
- **移动外景 = 小米13U 真机尺寸**（412×915 CSS px = 1440×3200 物理 px ÷ dpr 3.5；412 仍 ≤768 → 移动布局命中）；
  13 个行为单源域共用 `prototypes/mob-1to1.css` + `mob-1to1.js`，把外景缩放到屏幕上的
  70.2×155.9mm（= 真机屏幕实测尺寸）。缩放用 `transform`，绝不能改 iframe 的 `width/height`
  （会连内部视口一起改，动到 `@media ≤768` 判据）。换显示器只需改 `mob-1to1.js` 的 `RULER_MM`。
- 测试：UI 锚用 `bz-<域>-*` 类 / `data-*` 钩子；颜色断言读 `rgb()` 计算值。
- **假层语义必须与宿主一致**（ADR-0122）：fake 层与测试 mock 里凡是「照宿主 API 写的替身」，语义要与真机逐条对齐。已实例：`MarkdownRenderer.render` 是**追加**语义（类型定义写明 "The element to append to"，不清空容器），而 fake 渲染器（`innerHTML =`）与测试 mock（`el.textContent = md`）都实现成覆盖语义 —— 于是「纯文本预填 + 追加渲染」造成的正文双份只在真机显现，评审壳与单测两侧全绿（issue 275）。改宿主替身前先查官方类型定义的行为描述，再写替身；发现「假层语义与宿主不符且恰好掩盖缺陷」按缺陷处理。
- **弹层隐藏滚动条不自造**（ADR-0080/0122）：bz 界面级单源在 `src/core/ui/components.css`（按 `bz-` 前缀通杀，滚动功能保留）；域内写 `scrollbar-width: thin/auto` 或 `::-webkit-scrollbar` 自绘是违规，评审壳里看见滚动条按缺陷处理。
- 宿主差异（theme 切换 / 假数据 / 图标表 / Platform）全部收敛在 fake 层与评审壳，组件层禁止分叉。
- **worktree 内 `preview-freshness` 假红 = 行尾，不一定是你的改动**（ADR-0104/0133）：源指纹按**磁盘字节**算，
  而 `core.autocrlf=true` 下 worktree 检出 CRLF、主仓库工作区可能被工具写成 LF——**同一提交、`git status`
  两边都干净，指纹却不同**。症状是**你根本没碰的域**（pomodoro / home / memo / settings-panel 等）
  跟着一起红。处理（worktree 内、git 不可见）：先把那批文件对齐成与主仓库**逐字节一致**，
  再 `node scripts/build-preview.mjs` 重出——守卫即全绿，且**重出的产物可安全带回主仓库**
  （指纹由与主仓库相同的字节算出）。反例：不对齐就重出，产物内嵌的是 worktree 的 CRLF 指纹，
  合并回主仓库后必红。实例口径见 `issues/341-clipbook-native-sel-menu.md` 门禁段。
- **省事口径：worktree 内的全量直接跳过该守卫** —— `vitest run --exclude tests/preview-freshness.test.ts`。
  这条守卫的权威判定场景是**主仓库重出产物之后**（无 CRLF 假红）；在 worktree 里跑它只有两种下场：
  逐次对齐字节，或 `git stash` 取基线做差集。前者是给环境做人工补偿、后者白花一轮，都不如不跑。
  worktree 的红线因此收窄为「本域测试 + tsc + 其余全量绿」，重出产物与 `pnpm run build` 一律回主仓做，
  做完在主仓跑该守卫取权威结论（issue 341 后续实证：336 文件 5268 例绿 → 主仓 337/5295 + 27/27 绿）。
- **仓库级遗留**：`.gitattributes` 只固定了 `main.js` 与 `prototypes/**/*.{js,ts}`，`src/**` 未固定行尾——
  全新 clone（autocrlf 检出 CRLF）下这些域的原型新鲜度守卫仍会假红。跨域根治需给 `src/**` 定
  `text eol=lf` 并整仓 renormalize（未做，另议）。
