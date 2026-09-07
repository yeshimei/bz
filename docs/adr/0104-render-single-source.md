# ADR-0104：原型 × 插件 markup 单源（域 render.ts 渲染纯层范式）

## 背景

原型先行铁律此前只做到**样式单源**（原型 `<link>` 共用 `styles.css`），markup 仍靠「同步」轮人肉照搬：域原型是 JS 渲染式（模板字符串拼 HTML），与 `ui.ts` 的渲染函数逐字同构却各持一份（归物本实测 `panelHtml()` 两侧逐字相同、32 个同名函数），每轮 UI 迭代后同步都是纯机械且易漂移的照搬——归物本 `itemEmHtml` 兜底链两侧已实测漂移（插件 📦→package 兜底，原型停在旧版）。

## 决策

在样式单源之上把 markup 也单源：**每个带自绘 UI 的域新增 `render.ts` 渲染纯层**，作为 markup、视图口径计算、行操作序列的唯一事实源。

1. **render.ts 契约**（`tests/core/render-purity.test.ts` 守卫，违规门禁红）：
   - import 白名单：`core/ui/str`（新增零依赖字符串工具：esc/escapeHtml/iconSpan）、`./types`、`./emoji-icon-map`（等纯数据文件）；禁 obsidian / moment / core 服务 / 组件库 barrel（barrel 拖 obsidian）；
   - 禁模块级可变状态：数据与视图状态显式入参（`items + BelViewState`）；
   - 图标一律 `<i data-lucide>` 占位串，由两侧各自 mountIcons 兑现（插件 setIcon / 壳内联 SVG——壳层差异表既有约定）；
   - 唯一 DOM 副作用点：`renderPanelView` 胶水（对入参 root 做六步渲染：hero/chips/年份/KPI/排序/内容；年份悬空回写、量列补 filler jsdom 安全退化）。
2. **预览管线**：`scripts/build-preview.mjs` 把 render.ts 打成 IIFE 单文件 `src/<域>/prototype-render.js`（挂 `window.BZR_<域>`），**产物提交入 git**（`prototype-icons.js`/`prototype-data.js` 生成物入库先例），保「双击原型零依赖」；输出确定性（静态 banner、无时间戳）防 git 噪音。`esbuild.config.mjs` dev watch 监听 render.ts 重出预览包；脚本只写 `src/**` 不触 vault，可在 worktree 安全执行（主构建/部署仍按铁律只在主仓库跑）。
3. **行为层不单源（有意的壳层差异）**：事件绑定、core 服务（esc-manager/topifyZ/flow-dialog/notice/item-actions）、数据读写留在 `ui.ts` 与壳各自实现；`actionSpecs` 单源动作序列（图标/文案/keepOpen/danger + act 标识），onClick 两侧各自映射。chips/segmented/空态在 render.ts 串里沿用组件库皮类名（bz-chip/bz-segmented/bz-empty，ADR-0094 视觉不破），插件侧对应三处从工厂切到「串 + 委托」。
4. **口径单源**：原 data.ts 纯函数（calculateDaysUsed/Until/DailyCost，moment 实现）收编进 render.ts（plain Date 逐语义等价实现），data.ts 三函数退役、用例随迁 render.test.ts——计算口径不再有第二份实现。
5. **迁移策略**：新域落域必带 render.ts；存量域重设计时顺带迁移。试点：**belongings**（同构度最高，panelHtml 逐字）。已勘测待迁：bookshelf（15 同名函数+注释自证逐字）、home（4 构建器+面板骨架）、favorites（44/46 类名同，函数名微漂移需先对齐）；**settings-panel 例外**（schema 驱动并行实现非模板串孪生，需先拆 renderer 值层，缓行）；**cinema 用户拍板跳过**（迭代中）。

## 归物本试点结果（issue 237）

- `render.ts` 新增（~430 行）：常量/格式化/口径/markup 构建器/actionSpecs/renderPanelView；
- `ui.ts` 1280 → ~660 行：行为层原样（生命周期/绑定/服务契约/脏表单/撤销链），markup 全部切 render.ts；桌面 chips + 排序段从 uiChip/uiSegmented 工厂切「串 + 委托」（与原型逐字同构；方向键循环为工厂附加件，原型基线无此交互，随之退役——如需回补可在 ui.ts 对注入后 DOM 挂 keydown，不动单源）；
- `prototype.html` 内联脚本 ~945 → ~380 行：只剩演示层（假数据/localStorage、演示绑定、自绘 toast/confirm、演示钩子与自检）；
- selftest 29/29（headless Edge 实测）；`pnpm test` 4146/4146 全绿（ui.test 86 例零改语义，仅排序段控点击从「捕获节点」改「现查现点」——胶水每次重渲段控，委托在 overlay）；tsc 干净。

## 后果

- 「同步」轮从「人肉照搬 ~700 行渲染层」缩成「绑定验收 + 测试 + 部署」，markup 漂移 bug 类别（同构翻译错/兜底链漂移/口径二份实现）整体消失；
- 迭代轮隔离效果与旧「ui.ts 冻结」等效（Obsidian 不重载不加载新 markup），迭代节奏不变；
- 代价：render.ts 纯度靠守卫测试纪律维持；预览包有陈旧窗口（dev watch 自动重出 + build 兜底，文档注明）；已迁移域的 ui.ts 渲染代码读者需先读 render.ts。
