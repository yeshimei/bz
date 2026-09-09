# 归物本 · 原型评审壳（prototype-first）

通用规则见 `docs/prototype-first.md`，本文只记归物域专属映射与坑。

## 文件

| 文件 | 作用 |
|---|---|
| `prototype.html` | 评审壳。组件样式零内联，按构建同序链接 `../../src/core/styles.css → ../../src/core/ui/tokens.css → ../../src/core/ui/components.css → ../../src/belongings/styles.css`；内联脚本只剩演示层（假数据/localStorage、演示事件绑定、自绘 toast/确认框、演示钩子与自检） |
| `prototype-render.js` | **构建产物（提交入库，勿手改）**：`render.ts` 经 `node scripts/build-preview.mjs` 打成 IIFE 挂 `window.BZR_belongings`——与插件 ui.ts 消费同一份 markup/口径/行操作序列（issue 237/ADR-0104） |
| `render.ts` | 渲染纯层（markup 单源）：常量/格式化/口径计算/markup 构建器/renderPanelView 胶水；纯度由 `tests/core/render-purity.test.ts` 守卫 |
| `prototype-data.js` | 演示数据（生成物）：真实库 65 件（belongings.json 同构字段）+ `DEFAULT_CATEGORIES` 全量 1226 条（uiSuggest 候选源） |
| `prototype-icons.js` | 演示图标集（生成物）：`window.BLG_ICONS`，lucide-static@0.544.0 路径数据 |

再生成（仓库根目录执行）：

```bash
node .zcode/ui-prototypes/belongings-redesign20/_gen-data.mjs    # 65 件 + 分类
node .zcode/ui-prototypes/belongings-redesign20/_gen-icons.mjs   # 图标（传名追加）
```

## 单源映射（issue 237/ADR-0104：改 markup 改 render.ts，两侧即时生效）

插件 ui.ts 与本壳消费同一批 `render.ts` 导出（经构建 → `window.BZR_belongings`）：

| render.ts | 两侧用途 |
|---|---|
| `panelHtml / chipsHtml / mobChipsHtml / yearsOptionsHtml / kpisHtml / segmentedHtml / emptyHtml / cellHtml` | 面板六步渲染（`renderPanelView` 胶水一次做齐，jsdom 无布局时 filler 量列自动退化为不补） |
| `belDetailHtml / flowBtnsHtml / belFormHtml / statusPickHtml / sheetHeadHtml` | 详情/表单/抽屉头 markup；`bm-*` `bd-*` `data-status` id 与钩子契约不变 |
| `actionSpecs` | 行操作序列（四态流转→编辑→删除）；onClick 行为两侧各自实现（插件走 core/item-actions，壳自绘演示） |
| `filtered / daysUsed / dailyCostOf / avgDailyCost / totalAssets / stockCount / resolveYear / heroTitleText / heroSubText` | 计算口径唯一实现（原 data.ts 纯函数与壳内副本全部收编） |
| `esc / iconSpan / splitEmojiCategory` | 演示层 toast/确认框/菜单 markup 与迁移同源复用 |

壳内事件绑定与 ui.ts 同语义：chips/排序/KPI 一处委托（`data-bel-st` / `.bz-segmented-btn` / `data-bel-statclick`）、搜索防抖 180ms、年份 change、内容区点卡（桌面详情/移动抽屉）+ 右键菜单。

**壳层差异（允许，不入域）**：confirm 走壳自绘 confirmDlg（插件 = core flow-dialog）；toast/撤销 = 壳自绘（插件 = core notifyUndo）；删除确认无 confirmDiscard；Esc 分层简化（菜单→详情→表单→抽屉）。

## 演示钩子

- `?demo=idle|detail|form|menu|mobsheet` —— 直开各态供截图/检查。
- `?selftest=1` —— 数值自检（65 件、KPI、筛选 7/65、搜索 6、排序首位、增删流转撤销 66→65→66、抽屉开合、chips 零图标、无页脚/移动排序残留），结果写在 `document.title`。
- 徽牌按钮：重置演示数据 / 隐藏-显示移动端。

## 域内坑（踩过的）

1. **移动端判定是容器查询，不是 @media**：`.bz-bel-panel / .bz-bel-form-mask / .bz-bel-detail-mask` 挂 `container-type: inline-size`，`@container (max-width:768px)` 承载全部移动端规则。容器查询**不能命中容器自己**——面板与详情的全屏尺寸规则必须留在 `@media`（真实移动端 100vw 命中条件与容器等价；评审壳由 `.demo-mob` 壳规则覆盖尺寸）。
2. 浮层遮罩插件里挂 body（fixed 全屏）；壳内手机框版本要 `.demo-mob .bz-overlay-mask { position:absolute }` 收进框。**壳 body 须挂 `theme-light`**：色彩 token 全在 theme-dark/light 作用域（tokens.css），Obsidian 宿主由 body 提供，裸壳不挂则 `--bz-surface-4` 等解析失败 → 联想浮层透明（.bz-popover 教训，surface-4 已同时钉进海报 token 名单防真机暗色翻色）。
3. 分类视觉走 `render.itemEmHtml` 单源兜底链（item.icon → emoji 映射 → 📦→package → 首字文本，issue 231）；界面图标 = `<i data-lucide>` 占位 + 壳内 mountIcons（`BLG_ICONS`）兑现——插件端同占位、core mountIcons（setIcon）兑现（壳层差异表）。
4. 壳内转义/图标占位统一走 `R.esc` / `R.iconSpan`（勿再本地实现）；数字格式以 render.ts 为准（`money` 两位小数 / `moneyShort` 整数 / 日均尾零裁剪）。**改过 render.ts 必须重跑 `node scripts/build-preview.mjs`（dev watch 自动）再评审**，否则壳吃旧包。
5. **方向铁律（issue 230）**：p20-full（.zcode）是视觉基准 → 先改原型评审 → 同步 styles.css/ui.ts；禁止拿域现状反向改写本文件。
6. 挂 body 的浮层（菜单/表单/详情）拿不到面板 token——外壳类须自进 styles.css 的 token 作用域名单（`.bz-bel-menu` 教训：var 失效 = 整条声明无效，字面量属性却照活，半样式最难察觉）。
7. 核心带 `!important` 的档（`.bz-choice-btn.is-on` 等）域内覆盖必须同重 + 更高特异性，否则静默落败。
