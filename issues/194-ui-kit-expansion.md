# issue 194：组件库扩充批次——面板壳/头行/侧栏等 40+ 类与 9 工厂（ADR-0094）

## 范围

### ① 样式库（已随本票先行并入，ADR-0094 批次）
- `src/core/ui/tokens.css`：+`--bz-control-h-md`（30px 中档）、`--bz-head-h`（44px）/`--bz-head-h-lg`（50px）
- `src/core/ui/components.css` 扩充批次：
  - A 面板壳 `.bz-panel-overlay/.bz-panel-frame`
  - B 窗口头行 `.bz-panel-head` 族（品牌块/标题/竖线副题/钮组，`--tall` 50px 档）
  - C 主头行 `.bz-main-head`；D 工具行 `.bz-toolrow`；E 搜索 `.bz-search`
  - F 状态侧栏 `.bz-rail` 族（前缀四槽/计数两档/未读/二级子列表/foot，`--wide` 216px 档）
  - G 移动横滑条 `.bz-mobstrip`；H 统计卡 `.bz-stat` 族（语义档 + 网格列数档）
  - I 候选浮层 `.bz-popover`；J 进度条 `.bz-progress`
  - K 变体预留（`.bz-chip--lg`/`.bz-badge--brand`/`.bz-btn--md` 等）
  - L/M 扩充组件：alert/msg/kbd/skeleton/tabs/menu/sheet/taginput/rating/ring/desc-list/divider/checkbox/radio/input-number/status/crumbs/steps/table/card/list/media/avatar/fab/data-tip/multiselect/monthpicker/strength/stat-trend/pagination/collapse/timeline/popconfirm/quote/mark/code

### ② 组件库（本票主体）
- 新工厂 8 文件 9 导出：`icons.ts`（uiIconSpan + mountIcons）、`search.ts`、`mainhead.ts`、`rail.ts`、`mobstrip.ts`、`stat.ts`、`progress.ts`、`popover.ts`
- `resize.ts`：`uiResizable` 增可选 `persist: { load?, save? }`——挂载 load 恢复（钳 min/max + 视口 92%）、onChange 防抖 300ms save、detach flush 尾值；不传行为不变
- `types.ts` +9 类型；`index.ts` 转发桶同步

### ③ 文档
- `docs/ui-kit-manual.md`：§3.1 token 表、§3.2 组件类表（+40 行）、§4 工厂表（+9 行 + uiResizable persist）、§5 域接入规范补「新域主面板一律 .bz-panel-overlay/.bz-panel-frame + .bz-panel-head」
- `docs/ui-design-manual.md` §6.4：控件高度补 30px 中档；补整宽头行 44/50px 两行

### ④ 明确不做（本批）
- 不动存量域（全域替换另票）；不动 `select.ts`/`.bz-select-menu`（A4 合并延后）；不新增工厂范围外的空壳工厂（skip 理由见 ADR-0094）

## 验收
- [x] `pnpm vitest run tests/core/ui.test.ts` 单文件绿（89 用例，净增 31：结构/类名/事件回调/setValue/persist 防抖）
- [x] `pnpm exec tsc --noEmit` 干净
- [x] `pnpm test` 全量绿
- [x] 手册三处回写 + ADR-0094 + CONTEXT.md 共享层同步
