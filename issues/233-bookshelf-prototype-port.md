# 233 · 书库原型落域——域内评审壳补齐（原型先行扫尾）

## 背景

原型先行全域铁律（`docs/prototype-first.md`，AGENTS 铁律 5）要求各域在 `src/<域>/` 维护
`prototype.html` 评审壳；归物本已立范式（issue 230）。书库域的拍板原型
（`.zcode/ui-prototypes/bookshelf-10/p4-full.html`，issue 218 口径）停留在域外且已落后于
issue 225/226 的域内演化（行内标题/十肤全量/工具行对齐），域内始终没有评审壳——本轮补齐。

## 改动（域代码零改动：ui.ts/styles.css 即当前视觉基准，本任务只补评审壳与生成物）

1. **src/bookshelf/prototype.html** — 评审壳，`ui.ts` 逐字同构
   （`createOverlay` 骨架 / `renderWall` 族 / `packZone` 装箱 / `fitTitle` 双列拆题 /
   `openBookDetail` 只读借书卡 / data.ts 筛选排序管道 / 十肤 `bsSkinClass`）；
   组件样式零内联，共用 `styles.css`（十肤含结构层、`@media` 移动端全量生效）。
   **移动端 = 手机框内嵌本页 `?mob=1` 窄视口 iframe**（396×780 命中同一份 `@media ≤768`
   规则，壳内零复制移动端样式）——书库是视口断点域，容器查询双面板范式（归物）不适用。
   徽牌：十肤下拉热切换（面板 + iframe 同步）/ 隐藏移动端；钩子 `?skin=` `?demo=` `?selftest=1`。
2. **src/bookshelf/prototype-data.js** — 生成物：真实库 md 162 册（books-real.json）+
   EPUB 2 册（真实 vault weave-data.json，`buildEpubItem` 同语义映射）= **164 册
   （在读 9 / 已读 151 / 未读 4，与书库权威口径一致）**；`BookshelfItem` 同构字段，
   `file` → `id` + `ctime`。
3. **src/bookshelf/prototype-icons.js** — 生成物：lucide-static@0.544.0 八图标
   （`window.BS_ICONS`；空态三态 / 借书卡占位 / 报告头行）。
4. **src/bookshelf/PROTOTYPE.md** — 域内专属映射表、壳层差异、iframe 移动端方案、坑清单。
5. 生成器与 CDP 跑批脚本留 `.zcode/ui-prototypes/bookshelf-10/`（_gen-data / _gen-icons /
   _cdp-selftest，不入 git）。

## 刻意不入壳（插件侧语义不变）

- 加载态 loader 占位（B8）：演示数据同步就绪；`applyMobileWindowFullscreen`：`@media` 已全屏。
- 报告视图仅保骨架 DOM 同构（命令专用入口、墙面无入口，内容评审走 reading-report 域）。
- 借书卡封面以分类色 SVG data URI 代真（壳无 vault 资源；`cover` 字段保留真实路径占位）。

## 门禁

- 自检：桌面 `?selftest=1` **30/30 绿**、`?mob=1&selftest=1` **29/29 绿**（CDP 实跑）。
- 截图评审：雪松白整墙 / 黑金夜曲换肤 / 借书卡（纸卡+台账+讫印）/ 移动端全屏，四面过。
- `pnpm test` + `tsc --noEmit` 全绿；`prototype.*` 不进 esbuild/build-css SOURCES，无部署面
  （主仓产物无需重建）。
