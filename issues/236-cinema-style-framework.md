# 236 · 影院风格化落域：三风格框架 + 午夜场完整版进插件

## 背景

issue 232（原型批 29250cf）后域内原型定稿：三风格（午夜场/场刊/放映室）+ 午夜场完整功能版。
本批落域：把原型 DOM 搬进插件，命令/数据层/smartcat 事件零改动，数据零迁移。

## 契约（PROTOTYPE.md 落域节）

- `CINEMA_STYLES` 清单上岸 `constants.ts`（唯一事实源）；设置单键 `cinemaStyle`（默认 midnight）。
- ui.ts 按风格分支渲染：桌面 = 900×620 desk 壳；移动 = 独立自绘 mob 壳（非 @media），真全屏走 `.bz-win-mfs`。
- 详情/表单/右键菜单/长按抽屉/删除确认/AI 荐片/观影分析/设置弹窗按原型 markup 重建，三风格共用
  （弹窗经 `display:contents` 午夜场锚类宿主承接共享样式）。
- 片卡稳定键沿用 CM3（file.path / new:name）；评分星口径沿用 ui.ts floor 半星=空心。

## 改动（用户拍板：本批仅午夜场上岸，gazette/booth 延后）

1. **constants.ts**：`CINEMA_STYLES` + `CinemaStyle` 类型 + `cinemaStyleOf()`（设置读取，非法值回 midnight）；
   设置 schema 暂不出「风格」行（仅一风格时无选择意义），`cinemaStyle` 键保留为扩展口。
2. **settings.ts**：显示组首行加「风格」三选一；src/settings.ts 默认键 `cinemaStyle: 'midnight'`。
3. **ui.ts** 落域重写：
   - 午夜场 desk：`bz-cinema--midnight` > d-body（d-rail：影院品牌 + 类型/状态行 + AI/观影分析 foot；d-main：d-head 标题=筛选名+计数+添加影片、d-tools 搜索+排序 seg、grid 海报网格）。
   - 午夜场 mob：m-head（标题+计数+✕/AI/分析/设置/添加）+ chips + 搜索 + m-grid；长按抽屉 cn-sheet、右键菜单 cn-menu（域内自绘，豁免铁律 6 先例 issue 227）。
   - 共享弹窗：cn-modal 系（详情 dm-*、表单 f-*、确认 cn-confirm、设置 set-*）、AI 页（ai-guide/ai-pref/rec-list）、分析页（stat-cards + 19 sec）。
   - gazette/booth：延后（原型锚类段与 CINEMA_STYLES 清单已备，落其余风格时补壳与绑定）。
   - 落域适配（文档记录）：移动头行补 ✕ 关闭钮（真全屏无遮罩可点，先例收藏本 issue 228）；演示「模拟失败」按钮退役。
4. **analysis.ts**：数据采集半段不动；渲染半段改原型类名（stat-cards/sec/bar-row/soft-row/top-row/tag-cloud/kv-inline/cn-empty）。
5. **styles.css**：尾部落域适配段（面板居中、mob 全屏去边框；原型不出）。
6. **测试**：ui.test.ts 按新 DOM 重写；settings.test 补风格行；analysis.test 渲染断言对齐；smoke 命令契约不变。

## 零改动清单

命令 id/名称/图标、bz-cinema-open/add/analysis 语义、smartcat movie 事件、frontmatter 字段、
cinemaSortMode/cinemaStatusFilter/cinemaGridColumns/cinemaMobileDefaultFullscreen/cinemaFolderPath 键。

## 1:1 口径（用户拍板）

DOM/类名/交互粒度逐字照 prototype.html，禁止目测调参；仅两类偏离：① lucide+mountIcons 替代内联 SVG（全仓图标惯例）；② 壳层差异（原型-first 文档许可）+ 业务层保留（落盘/事件/重名拦截）。
