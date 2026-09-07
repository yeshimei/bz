# issue 242：收藏本接入 markup 单源 + 布局分层（ADR-0104/0105）

- 三件套（照 bookshelf/belongings 套路）：
  - `src/favorites/shared.ts`（新增，跨布局共享层）：ICON / FavView / localNow / relTime / hueOf /
    派生管道（visibleItems/archivedItems/poolOf/tagCount/filteredItems）/ cardHtml / emptyHtml /
    行操作集（FavActionSpec{act 语义键} + actionSpecs）/ ctxMenuHtml / sheetHtml / formHtml /
    pickChipsHtml；esc/iconSpan/FavoritesItem 再导出。
  - `src/favorites/layouts/board/render.ts`（新增，「亚麻板」布局差异层）：panelHtml(mobile) /
    chipsHtml(items, view, mobile) / boardHtml / renderTagsInto / renderBoardInto /
    renderPanelView 胶水 + FavRenderHooks{mountIcons, mobile}（jsdom 无布局值，移动态显式入参）。
  - `src/favorites/render.ts`（新增，域入口）：`export * from './shared'` + 布局层命名再导出，无环。
- `ui.ts` 919→710 行：markup/口径全迁纯层，只留生命周期/事件委托/core 服务/AI 整理/保存；
  buildActions 改为 actionSpecs + runAction（act→core 服务映射），归档/删除确认文案逐字保留。
- **命名还债**：renderTagsInto（壳）↔ renderTags（插件）统一为纯层唯一出口 `renderTagsInto`，
  调用面（ui.ts renderAll/原型壳）全改走 renderPanelView。
- 壳 `prototype.html` 384→431 行：消费 `window.BZR_favorites`，只留演示层（localStorage 假数据/
  自绘 toast/确认框/mountIcons/主题钮/手机框）；磁贴单行横滑/新收藏置首经 hooks.mobile 保持；
  prototype-icons.js 补 sparkles（formHtml AI 钮同源后需要）。C5 视觉零改动（styles.css 未触碰）。
- `scripts/build-preview.mjs`：PREVIEW_DOMAINS +favorites；`prototype-render.js` 产物同 commit。
- 守卫测试改指新文件：review-fix-b（mob-close 触控档）/ enh-sweep-c（面板壳类/触控档/磁贴计数）/
  favorites/styles.test（C8 fz-ai、C12 fz-cancel/fz-save 单源串改指 shared.ts，新增 favShared/favRender 取材）。
- 新增壳自检 ?selftest=1（31 断言：磁贴行/归档视图/标签筛/表单新增/右键置顶/删除撤销/移动抽屉）。
- 门禁：tsc 干净；全量 4146/4146；headless Edge 自检 SELFTEST OK 31/31。
- 坑：演示数据含置顶条目，新增条目按「置顶恒最前」不排首位——自检断言改查指定卡在场。
