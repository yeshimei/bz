# issue 238：书库接入 markup 单源（ADR-0104）

- `src/bookshelf/render.ts`（新增）：面板骨架/头行标签/排序 segmented/书脊墙装箱/空态/借书卡 HTML
  + 筛选排序管道（primaryDate/sortItems/currentSideItems/categoryLabel/catFilterItems/kwFilter/getDisplayItems）
  + 书脊视觉（CAT 色板/spineVars/fitTitle/spineHTML）+ packZone/renderWallInto 胶水。
  模块级 wallMax* 换成 BsWallScale 显式入参（wallScale() 计算）——纯层禁模块级可变状态。
- `data.ts`：管道纯函数迁 render.ts，此处 re-export 兼容（data.test 引用面零改动）；getDisplayItems() 读 M 包装。
- `ui.ts` 657→353 行：只留生命周期/事件委托/core 服务/皮肤类/vault 封面/报告视图。
- 壳 `prototype.html`：消费 `window.BZR_bookshelf`，只留演示层；itemId 回退 `id` 字段兼容演示数据。
- 守卫升级：render-purity 扫描剥 `import type` 行（编译期擦除不算依赖）；PREVIEW_DOMAINS +bookshelf。
- 测试：walkthrough-fix-c 源码扫描改指 render.ts；C-5 面板类断言放宽 esc(skinClass)；belongings 副题期望补齐（b8152ba 遗漏）。
- 门禁：tsc 干净；全量 4146/4146；原型自检桌面/移动各 38/38。
