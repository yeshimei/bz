# 归物本 · 原型评审壳（prototype-first）

通用规则见 `docs/prototype-first.md`，本文只记归物域专属映射与坑。

## 文件

| 文件 | 作用 |
|---|---|
| `prototype.html` | 评审壳。组件样式零内联，按构建同序链接 `../../core/ui/tokens.css → ../../core/ui/components.css → ./styles.css`；演示 JS 与 `ui.ts` 逐字同构 |
| `prototype-data.js` | 演示数据（生成物）：真实库 65 件（belongings.json 同构字段）+ `DEFAULT_CATEGORIES` 全量 1226 条（uiSuggest 候选源） |
| `prototype-icons.js` | 演示图标集（生成物）：`window.BLG_ICONS`，lucide-static@0.544.0 路径数据 |

再生成（仓库根目录执行）：

```bash
node .zcode/ui-prototypes/belongings-redesign20/_gen-data.mjs    # 65 件 + 分类
node .zcode/ui-prototypes/belongings-redesign20/_gen-icons.mjs   # 图标（传名追加）
```

## 同构映射（ui.ts ↔ prototype.html 内联 JS）

| ui.ts | 壳内 |
|---|---|
| `panelHtml()` | `panelHtml()` 逐字（iconSpan → icon；mobhead 仅 ✕、mobsort/mobadd、页脚品牌行） |
| `renderHero/Chips/Years/Kpis/Content` + 双排序段 | 同名函数，双面板（桌面 + 手机框）共用一套 M 状态 |
| `cellHtml` | `cellHtml`（NO.XX + 状态徽章 + 分类 emoji + 名称 + 大字价格 + meta） |
| `openBelDetail` | 同名（bz-bel-detail-*；流转条点击后重开详情同步头行） |
| `openForm` | 同名（bm-* 字段 id、出离行/售价行联动、校验顺序一致；分类联想 = uiSuggest 同语义迷你版） |
| `openRowMenuAt`（core .bz-item-menu + 海报皮 bz-bel-menu） | 同类名 markup + 光标锚定防溢出 |
| `openMobSheet`（core .bz-item-sheet） | 同类名 markup；head = `sheetHeadOf`（emoji + 名称 + 分类·价格·天数） |
| `applyFlowWithUndo / deleteItem` | 同语义（exit_date 闭环 + 撤销 toast） |

**壳层差异（允许，不入域）**：confirm 走壳自绘 confirmDlg（插件 = core flow-dialog）；toast/撤销 = 壳自绘（插件 = core notifyUndo）；删除确认无 confirmDiscard；Esc 分层简化（菜单→详情→表单→抽屉）。

## 演示钩子

- `?demo=idle|detail|form|menu|mobsheet` —— 直开各态供截图/检查。
- `?selftest=1` —— 数值自检（65 件、KPI、筛选 7/65、搜索 6、排序双段同步、增删流转撤销 66→65→66、抽屉开合、chips 零图标、页脚品牌行），结果写在 `document.title`。
- 徽牌按钮：重置演示数据 / 隐藏-显示移动端。

## 域内坑（踩过的）

1. **移动端判定是容器查询，不是 @media**：`.bz-bel-panel / .bz-bel-form-mask / .bz-bel-detail-mask` 挂 `container-type: inline-size`，`@container (max-width:768px)` 承载全部移动端规则。容器查询**不能命中容器自己**——面板与详情的全屏尺寸规则必须留在 `@media`（真实移动端 100vw 命中条件与容器等价；评审壳由 `.demo-mob` 壳规则覆盖尺寸）。
2. 浮层遮罩插件里挂 body（fixed 全屏）；壳内手机框版本要 `.demo-mob .bz-overlay-mask { position:absolute }` 收进框。
3. 分类 emoji 是**数据**（categories 字符串自带前缀），照 `catEmoji` 显示，不换 lucide；界面图标才走 lucide（`BLG_ICONS` + 壳内 mountIcons）。
4. 壳内转义统一走 `esc2`（勿写递归 esc）；数字格式以 ui.ts 为准（`money` 两位小数 / `moneyShort` 整数 / 日均尾零裁剪）。
5. **方向铁律（issue 230）**：p20-full（.zcode）是视觉基准 → 先改原型评审 → 同步 styles.css/ui.ts；禁止拿域现状反向改写本文件。
6. 挂 body 的浮层（菜单/表单/详情）拿不到面板 token——外壳类须自进 styles.css 的 token 作用域名单（`.bz-bel-menu` 教训：var 失效 = 整条声明无效，字面量属性却照活，半样式最难察觉）。
7. 核心带 `!important` 的档（`.bz-choice-btn.is-on` 等）域内覆盖必须同重 + 更高特异性，否则静默落败。
