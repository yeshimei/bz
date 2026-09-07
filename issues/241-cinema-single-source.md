# issue 241 — 影院（cinema）markup 单源 + 布局分层迁移（ADR-0104/0105）

## 战果

照 bookshelf（238）/ belongings（240）同款三件套套路落 cinema：

- `src/cinema/shared.ts`（新，288 行）：跨布局共享层——ICON/格式化口径（typeColor/statusColor/statusText/stars）、doubanSearchUrl、CM3 稳定键（itemKey/itemByKey）、posterInner/pcardHtml、视图快照 `CinemaView`、共享弹窗（详情/表单/确认/设置）、AI 荐片页（`AiPageInput` 显式入参）、菜单/抽屉行（`actionRowsHtml`）。
- `src/cinema/layouts/midnight/render.ts`（新，189 行）：午夜场布局差异层——desk/mob 壳骨架、rail/chips、d-head/d-tools、空态、渲染胶水 `renderMidnightDesk/renderMidnightMob`（输入快照 `MidnightRenderInput`，海报解析以 `poster(it)` 回调入参）。
- `src/cinema/render.ts`（新，15 行）：域入口聚合（`export * from './shared'` + 布局层命名再导出）。
- `src/cinema/ui.ts`：997 → 732 行。markup 全部改走纯层；行为/core 接线（落盘 persistItem、域事件、AI/分析/海报守护、ESC、全屏、防抖搜索、长按绑定）原样保留。`cinemaStyleOf()` 从 constants.ts 迁入（读设置属行为层，见坑 2）。
- `src/cinema/prototype.html`：684 → 589 行。午夜场组件 HTML 全出自 `window.BZR_cinema`（prototype-render.js）；壳只留演示层（演示数据/localStorage、主题与风格切换、自绘弹窗基座与 toast、场刊/放映室探索稿、`?style=`/`?selftest=1` 钩子）。AI 荐片页演示走 `R.aiPageHtml` 同一单源（模拟失败按钮随 ADR-0103 退役）。
- `src/cinema/prototype-icons.js`（新）：壳基座图标表（data-lucide 物化，对齐 core/ui icons.ts 口径）。
- `scripts/build-preview.mjs`：PREVIEW_DOMAINS 加 `"cinema"`；产物 prototype-render.js（424 行）同 commit 入库。
- 守卫测试改指：walkthrough-fix-c 三条 markup 扫描（`class="add j-add"` / `m-tool j-mgear` / `cn-modal cn-confirm`）由 ui.ts 改指 layouts/midnight/render.ts 与 shared.ts；render-purity.test.ts 经 PREVIEW_DOMAINS 自动纳管 cinema。

## 门禁

- `pnpm exec tsc --noEmit` 干净。
- `pnpm test` 全量 255 文件 / 4146 用例全绿。
- 原型 `?selftest=1` headless（Edge）：`SELFTEST OK 16/16`（壳骨架/侧栏/稳定键/chips 筛选/详情·表单·设置弹窗单源/分析页/AI 待机与结果 5 条）。

## 坑

1. **constants.ts 不纯**：`cinemaStyleOf()` 读 `tryGetSettings`，把 `core/settings-provider` 拖进纯层 import 图 → render-purity 守卫红。读设置属行为层，函数迁 ui.ts，constants 保持纯常量（bookshelf constants 无此依赖，cinema 特有）。
2. **长按绑定原藏在渲染胶水里**：旧 renderMidnightMob 末尾调 attachLongPress，拆层后改由 ui.ts renderAll 在 mob 分支显式重挂——漏挂则长按抽屉测试红。
3. **弹窗宿主挂点**：壳 ovl/toast 最初把 display:contents 锚类宿主挂到 .demo-dt（面板外），querySelector 找不到 .cn-ovl；对齐插件 ovHost 挂面板根内即好。
4. **relDate 留行为层**：其实现包 core formatRelativeTime（moment），纯层禁入；该函数不参与 markup，留 ui.ts（data.test 引用不变）。
5. **演示数据字段兼容**：AI 推荐 name/meta（`aiRecName/aiRecMeta`）、itemKey 回退 `new:name`、海报 URL 直读字段——纯层取值处全部给了兼容回退。

## 行数前后

| 文件 | 前 | 后 |
|---|---|---|
| ui.ts | 997 | 732 |
| shared.ts | — | 288 |
| layouts/midnight/render.ts | — | 189 |
| render.ts | — | 15 |
| prototype.html | 684 | 589 |
| prototype-render.js | — | 424（构建产物） |
