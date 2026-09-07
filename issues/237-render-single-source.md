# 237 · 原型 × 插件 markup 单源——belongings 试点（render.ts 渲染纯层范式）

## 背景

原型先行此前只单源了样式（共用 styles.css），markup 靠「同步」轮人肉照搬：归物本原型壳
~700 行渲染 JS 是 ui.ts 渲染层的手工镜像（`panelHtml()` 逐字相同、32 个同名函数），且已实测
漂移（`itemEmHtml` 兜底链：插件 📦→package，原型停在旧版）。决策见 `docs/adr/0104-render-single-source.md`。

## 改动（ADR-0104 试点域：belongings）

1. **`src/core/ui/str.ts` 新增**：零依赖字符串工具（escapeHtml/esc/iconSpan）——render 纯层
   共用；刻意不 import 任何模块（预览包依赖图必须绝对干净），域 render.ts 须直连引入、禁走
   barrel。
2. **`src/belongings/render.ts` 新增（~430 行）**：常量（ICON/STATUS/SORT_OPTS）+ 格式化
   （money/moneyShort/todayStr/catEmoji 族）+ 口径计算（filtered/daysUsed/avgDailyCost/
   totalAssets 等，items+view 显式入参）+ markup 构建器（panel/cell/chips/kpis/detail/form/
   statusPick/sheetHead/empty/segmented）+ `actionSpecs`（行操作序列）+ `renderPanelView`
   （六步渲染胶水，年份悬空回写、量列补 filler jsdom 安全退化）。纯度由守卫测试锁死。
3. **`src/belongings/ui.ts` 1280 → ~660 行**：行为层原样保留（生命周期/ESC 分层/自动刷新/
   主题监听/脏表单 confirmDiscard/notifyUndo 撤销链/smartcat 事件），markup 全部切 render.ts；
   桌面 chips + 排序段从 uiChip/uiSegmented 工厂切「串 + 委托」（与原型逐字同构；方向键循环
   系工厂附加件、原型基线无此交互，随之退役）；`daysUsed` 口径改用 render.ts（plain Date，
   data.ts moment 版三函数退役，用例随迁）。
4. **`src/belongings/prototype.html` 壳重写**：内联脚本 ~945 → ~380 行——只剩演示层
   （localStorage 假数据、演示事件绑定、自绘 toast/confirm、演示钩子与自检），markup/口径/
   行操作序列全部消费 `window.BZR_belongings`；`<script src="./prototype-render.js">` 新挂点。
5. **预览管线**：`scripts/build-preview.mjs`（PREVIEW_DOMAINS 清单）+ `esbuild.config.mjs`
   接线（dev watch 监听 render.ts 重出）；`prototype-render.js` 构建产物**提交入 git**（生成物
   入库先例，保双击零依赖；输出确定性无时间戳）。
6. **测试**：`tests/core/render-purity.test.ts`（import 图守卫 + 预览包在库断言）+
   `tests/belongings/render.test.ts` 新增（口径用例自 data.test.ts 随迁 + markup 钩子契约 +
   胶水冒烟）；ui.test 86 例零改语义（排序段控点击改「现查现点」：胶水每次重渲段控、委托在
   overlay，旧捕获节点已 detach）；enh-sweep-c / review-fix-b 三个扫源守卫改指 render.ts。
7. **文档**：AGENTS.md 铁律 5（单源范式 + 新域必带 + 未迁移域照旧）、
   `docs/prototype-first.md`（markup 单源节 + 壳层差异表行）、`src/belongings/PROTOTYPE.md`
   （单源映射表替旧同构映射表）。

## 验证

- `pnpm test` 全量 4146/4146 绿；`tsc --noEmit` 干净；`node scripts/build-preview.mjs` 出包；
- 原型 selftest 29/29（headless Edge `?selftest=1`）；双端截图目检与 P20 拍板稿一致。

## 后续（待拍板，本批不动）

bookshelf / home / favorites 按同法迁移（favorites 先统一函数命名）；settings-panel 需先拆
renderer 值层、缓行；cinema 用户拍板跳过。
