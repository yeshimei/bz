# 书库 · 原型评审壳（prototype-first）

通用规则见 `docs/prototype-first.md`，本文只记书库域专属映射与坑。

## 文件

| 文件 | 作用 |
|---|---|
| `prototype.html` | 评审壳。组件样式零内联，按构建同序链接 `../core/styles.css → ../core/ui/tokens.css → ../core/ui/components.css → ../reading-report/styles.css → ./styles.css`；演示 JS 与 `ui.ts` 逐字同构 |
| `prototype-data.js` | 演示数据（生成物）：真实库 md 162 册 + EPUB 2 册 = 164 册（在读 9 / 已读 151 / 未读 4）。`BookshelfItem` 同构字段；`file` → `id`（md = `书库/<title>.md`，EPUB = vault 路径）+ `ctime`（无日期书兜底排序） |
| `prototype-icons.js` | 演示图标集（生成物）：`window.BS_ICONS`，lucide-static@0.544.0 路径数据（library / bar-chart-3 / x / library-big / search-x / funnel / loader / search） |

再生成（目标仓库根目录执行）：

```bash
node /d/Obsidian/bz/.zcode/ui-prototypes/bookshelf-10/_gen-data.mjs    # books-real.json + 真实 vault weave-data.json → 164 册
node /d/Obsidian/bz/.zcode/ui-prototypes/bookshelf-10/_gen-icons.mjs   # 图标（传名追加）
node /d/Obsidian/bz/.zcode/ui-prototypes/bookshelf-10/_cdp-selftest.mjs "<file://…/prototype.html?selftest=1>" 1400 1000  # CDP 自检跑批
```

## 同构映射（ui.ts ↔ prototype.html 内联 JS）

| ui.ts / data.ts / constants.ts | 壳内 |
|---|---|
| `createOverlay` innerHTML | `panelHtml()` 逐字（id 全同：`bz-bs-labels / bz-bs-dsearch / bz-bs-sortseg / bz-bs-hint / bz-bs-shelf`） |
| `renderLabels / renderSortSeg / renderWall` | 同名函数 |
| `rescaleWall / spineVars / fitTitle / spineHTML / packZone` | 同名（墙内标尺、`--c1/--c2` 内联变量、「：」双列拆题、逐条装箱） |
| `wallEmptyHTML` + core `uiEmpty` | 同类名 markup（`.bz-empty > .bz-empty-ic/.bz-empty-title/.bz-empty-desc`） |
| `openBookDetail`（issue 223 只读借书卡） | 同名（`uiModal` 结构同构：`.bz-overlay-mask > .bz-overlay-popup.bz-bs-d-popup + 皮肤类 > .bz-dialog-body > .bz-bs-detail`） |
| `getDisplayItems`（data.ts 管道） | `currentSideItems → catFilterItems → kwFilter → sortItems` 同语义 |
| `SKIN_IDS / bsSkinClass` | 同名（十肤；`applySkin` 同步面板根 + 开着的借书卡） |
| `SORT_LABEL / STATUS_COLORS / EMPTY_*_ICON` | 同值常量 |

## 壳层差异（允许，不入域）

- 本域是**只读域**（issue 223）：无表单/右键菜单/抽屉/撤销，壳内唯一浮层 = 借书卡；无 localStorage（无写路径）。
- 插件的加载态（B8 loader 占位）未入壳：演示数据同步就绪。
- `applyMobileWindowFullscreen`（bz-win-mfs）未入壳：`@media` 已令面板全屏，设置键语义见插件。
- 报告视图仅保 `bz-bs-view-report` 骨架 DOM 同构（命令 `bz-reading-report-open` 专用、墙面无入口，内容评审走 reading-report 域）。
- 借书卡封面：插件走 vault resource URL；壳无 vault 资源，`cover` 字段保留真实路径占位、运行时以分类色 SVG data URI 代真（无封面书仍走 `bz-bs-d-cover-ph` 占位路径）。
- toast / Esc 分层壳自绘（插件 = core notice / esc-manager）。

## 移动端：iframe 窄视口方案（本域特有，@media 域通用）

书库移动端是**视口断点**（`@media (max-width:768px)`，同构缩距不换形），不是容器查询——手机框内直接放面板吃不到媒体查询。壳内做法：右下手机框（396×780）内嵌 **本页 `?mob=1`** 的 iframe，窄视口命中同一份 `styles.css` 移动端规则，**壳内零复制移动端样式**（禁止把 `@media` 规则抄进壳，会二次同步）。`?mob=1` 页面即移动端视口：隐藏桌面外景与徽牌，overlay > 全屏面板，与插件 DOM 同构。

## 演示钩子

- `?skin=<id>` —— 十肤直达（nordic/dark/noir/wabi/bauhaus/blueprint/neon/kraft/velvet/mono）；徽牌下拉热切换（面板 + iframe 同步）。
- `?demo=detail|unread` —— 直开借书卡 / 未读倒叠态。
- `?selftest=1` —— 数值自检，结果写 `document.title`：桌面 30 项（164 册、9/151/4、隔板 15 类+倒叠区、讫印 151、书签带 9、EPUB 标记 2、厚度 22~64 / 高度 150~230、筛选/搜索/排序/借书卡/换肤），`?mob=1&selftest=1` 29 项（含 `@media` 全屏命中断言）。

## 域内坑（踩过的）

1. **`packZone` 每排一个 `.bz-bs-zone`**：大类（文学 56 册）拆多排，zone 数 ≠ 分类数；分区口径看 `.bz-bs-divider` 文本（`X 区` + `倒 叠 区`）。
2. **`fitTitle` / `packZone` 依赖布局量测**（`parseFloat(spine.style.height)`、`scrollWidth > clientWidth`）：jsdom 测不了，自检必须真浏览器（CDP）。
3. **自检里 `renderLabels` 会重建 DOM**：点击筛选后旧节点引用 detach，二次点击前必须重新 `querySelector`（本次自检抓过）。
4. 书脊颜色走内联 `--c1/--c2`：皮肤结构层接管书脊背景（nordic 平涂 / bauhaus 纯分类色块 / neon 描边发光）仍消费这两个变量，生成书脊时不可省。
5. 状态筛激活时「全馆藏书」恒亮作回全出口（issue 226 口径），壳内 `.off` 弱化断言锚这条。
6. 面板全 token 自给（十肤层全量覆盖 `--bz-*` + `--bsw-*`）：Obsidian 亮暗主题对面板无差，壳 `body.theme-light` 仅兜底演示页。
