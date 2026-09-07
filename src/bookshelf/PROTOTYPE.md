# 书库 · 原型评审壳（prototype-first）

通用规则见 `docs/prototype-first.md`，本文只记书库域专属映射与坑。

## 文件

| 文件 | 作用 |
|---|---|
| `prototype.html` | 评审壳。组件样式零内联，按构建同序链接 `../core/styles.css → ../core/ui/tokens.css → ../core/ui/components.css → ../reading-report/styles.css → ./styles.css`；演示壳只留演示层（数据/皮肤/toast/钩子），markup 与筛选排序管道消费 `prototype-render.js`（`window.BZR_bookshelf`，ADR-0104 markup 单源，源 `render.ts`）；`ui.ts` 只留行为层（生命周期/绑定/core 服务，657→353 行） |
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
| `createOverlay` innerHTML | `panelHtml()` 逐字（id 全同：`bz-bs-labels / bz-bs-dsearch / bz-bs-sortseg / bz-bs-hint / bz-bs-shelf`；匾额挂 `data-bs-plaque`） |
| `renderLabels / renderSortSeg / renderWall` | 同名函数（状态签直挂标签行、分类签装 `.bz-bs-cats` 子容器——桌面 `display:contents` 隐身，移动端随头行横滑） |
| `rescaleWall / spineVars / fitTitle / spineHTML / packZone` | 同名（墙内标尺、`--c1/--c2` 内联变量、「：」双列拆题、逐条装箱） |
| `wallEmptyHTML` + core `uiEmpty` | 同类名 markup（`.bz-empty > .bz-empty-ic/.bz-empty-title/.bz-empty-desc`） |
| `openBookDetail`（issue 223 只读借书卡） | 同名（`uiModal` 结构同构：`.bz-overlay-mask > .bz-overlay-popup.bz-bs-d-popup + 皮肤/模式类 > .bz-dialog-body > .bz-bs-detail`；✕ 关闭钮在左上角净位） |
| `getDisplayItems`（data.ts 管道） | `currentSideItems → catFilterItems → kwFilter → sortItems` 同语义 |
| `SKIN_IDS / bsSkinClass`（五肤×亮暗） | 同名（`bz-bs-skin-{id} bz-bs-mode-{light|dark}`；壳内 themeBtn 模拟 `body.theme-dark`） |
| `SORT_LABEL / STATUS_COLORS / EMPTY_*_ICON` | 同值常量 |

## 面板皮肤：五肤×亮暗双模式（issue 235 拍板）

保留雪松白(nordic)/黑金夜曲(noir)/牛皮手帐(kraft)/丝绒剧院(velvet)/极简黑白(mono)五肤，
每肤配亮暗两套（基础观感 = 招牌侧，另一侧由 `.bz-bs-skin-{id}.bz-bs-mode-{light|dark}`
变体层补 token + 结构位，见 styles.css「亮暗模式变体」节）；Obsidian 主题切模式，
设置选肤只定风格；退役肤值（dark/wabi/bauhaus/blueprint/neon）读取回落雪松白。
暗木书房/侘寂素麻/包豪斯/工程蓝图/霓虹夜馆及其预览卡样式已退役清零。

## 壳层差异（允许，不入域）

- 本域是**只读域**（issue 223）：无表单/右键菜单/抽屉/撤销，壳内唯一浮层 = 借书卡。
- 插件的加载态（B8 loader 占位）未入壳：演示数据同步就绪。
- 报告视图仅保 `bz-bs-view-report` 骨架 DOM 同构（命令 `bz-reading-report-open` 专用、墙面无入口，内容评审走 reading-report 域）。
- 借书卡封面：插件走 vault resource URL；壳无 vault 资源，`cover` 字段保留真实路径占位、运行时以分类色 SVG data URI 代真（无封面书仍走 `bz-bs-d-cover-ph` 占位路径）。
- toast / Esc 分层壳自绘（插件 = core notice / esc-manager）。

## 移动端：iframe 窄视口方案（本域特有，@media 域通用）

书库移动端是**视口断点**（`@media (max-width:768px)`，同构缩距不换形），不是容器查询——手机框内直接放面板吃不到媒体查询。壳内做法：右下手机框（396×780）内嵌 **本页 `?mob=1`** 的 iframe，窄视口命中同一份 `styles.css` 移动端规则，**壳内零复制移动端样式**（禁止把 `@media` 规则抄进壳，会二次同步）。`?mob=1` 页面即移动端视口：隐藏桌面外景与徽牌，overlay > 全屏面板，与插件 DOM 同构。

移动端专项（styles.css `@media` 块）：
- 头行（匾+状态签+分类签）单行横滑、滚动条隐藏；分类签尺寸回归本脸（不缩档）；
- 借书卡**留边浮卡**（`min(430px, 100vw-32px)`，流程口径：弹窗不全屏贴边），✕ 在左上角净位，点 ✕/遮罩/Esc 三路可关；
- 关闭出口 = 点「书库」匾收面板（桌面不响应；插件端 `isMobileEnv()` 才 `closeOverlay()`）；
- 安全区顶垫（core `.bz-panel-mtop` 44px）**域内接管**：面板顶距清零、头行等值 margin 避让，墙纸连纹理满铺到面板顶边（注意：core 会 `!important` 清面板首子 padding，顶垫补位不能写在墙纸上）。

## 演示钩子

- `?skin=<id>` —— 五肤直达（nordic/noir/kraft/velvet/mono）；徽牌下拉热切换（面板 + iframe 同步）。
- `?theme=light|dark` —— 亮暗模式直达（徽牌「切暗色/切亮色」模拟 Obsidian 主题热切换）。
- `?demo=detail|unread` —— 直开借书卡 / 未读倒叠态。
- `?selftest=1` —— 数值自检，结果写 `document.title`：桌面 38 项、`?mob=1` 38 项（164 册口径、筛选/搜索/排序/借书卡、五肤 mode 切换、滑轨 overflow、避让 ≥44px、匾额关闭闭环）。

## 域内坑（踩过的）

1. **`packZone` 每排一个 `.bz-bs-zone`**：大类（文学 56 册）拆多排，zone 数 ≠ 分类数；分区口径看 `.bz-bs-divider` 文本（`X 区` + `倒 叠 区`）。
2. **`fitTitle` / `packZone` 依赖布局量测**（`parseFloat(spine.style.height)`、`scrollWidth > clientWidth`）：jsdom 测不了，自检必须真浏览器（CDP）。
3. **自检里 `renderLabels` 会重建 DOM**：点击筛选后旧节点引用 detach，二次点击前必须重新 `querySelector`（本次自检抓过）。
4. **core `.bz-panel-mtop` 的顶垫补位不能写在墙纸上**：core 用 `!important` 清「面板首子元素」padding-top，补位会被静默吃掉而负 margin 生效 → 内容整体上移 44px（自检避让断言抓过）。现方案 = 域内接管：面板 `padding-top: 0 !important` 中和 + 头行等值 margin。
5. 书脊颜色走内联 `--c1/--c2`：皮肤结构层接管书脊背景（平涂/色块/描边发光）仍消费这两个变量，生成书脊时不可省。
6. 状态筛激活时「全馆藏书」恒亮作回全出口（issue 226 口径），壳内 `.off` 弱化断言锚这条。
7. 面板全 token 自给（皮肤层全量覆盖 `--bz-*` + `--bsw-*`）：壳 `body.theme-light/dark` 由 themeBtn 切换，同时驱动模式类与演示外景。
