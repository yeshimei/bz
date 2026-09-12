# 295 — 设置面板快速原型轮：归物本设置补三项（默认排序/新记默认状态/金额单位）

- 日期：2026-09-12
- 用户拍板（快速原型轮）：候选 1/2/5 采纳——默认排序、新增物品默认状态、金额单位统一
- 关联：ADR-0080（设置面板）、ADR-0104（渲染纯净）、issue 246（归物本外观组）、issue 294（上一轮）
- 状态：已完成

## §1 设计决策

### 默认排序（`belongingsDefaultSort`，缺省 `recent`）

- 新 select 行入「显示」组（recent 最近添加 / price 金额从高到低 / daily 日均从高到低，与面板排序器同源）。
- `openPanelInner` 打开面板时按设置播种 `M.sort`，非法值兜底 `recent`；面板内手动切换排序仍即时生效，不回写设置（设置只管「打开时是什么序」）。

### 新增物品默认状态（`belongingsNewStatus`，缺省 `使用中`）

- 新增「记一笔」组（pencil-line 图标），select 两值：使用中 / 闲置。
- 表单新建路径 `it?.current_status || newItemStatus()` 统一走该默认；编辑已有物品不受影响。

### 金额单位统一（`belongingsCurrency`，缺省 `cny`）

- 现状不一致：卡片/统计用 `￥` 前缀，编辑表单价格行标 `（元）` 后缀，同一页面两套口径。
- 纯层新增单位系统（`src/belongings/shared.ts`）：`MoneyUnit = cny|yuan|usd|none`，`moneyWith/money/moneyShort/moneyUnitLabel` 显式传参（渲染纯净契约——纯层不读设置）。
- select 四值：￥（人民币）/ 元（后缀）/ $（美元）/ 不显示（纯数字）。单位贯通海报布局 KPI/统计/格子、详情页、单据头、编辑表单（表单标签动态 `购买价格（￥）` 等）；日均等散点统一改 `moneyWith`。
- `unit` 形参缺省 `'cny'`，老调用点不传参行为不变。

## §2 改动面

| 文件 | 内容 |
|---|---|
| `src/settings.ts` | 三键：`belongingsDefaultSort/belongingsNewStatus/belongingsCurrency` |
| `src/belongings/shared.ts` | 纯层单位系统（moneyWith/money/moneyShort/moneyUnitLabel）；`belDetailHtml/sheetHeadHtml/belFormHtml` 增 `unit` 形参 |
| `src/belongings/layouts/poster/render.ts` | 单位贯通 `kpisHtml/mobStatsText/cellHtml/gridHtml/renderPanelView` |
| `src/belongings/ui.ts` | schema「显示」组补默认排序/金额单位两行 + 新「记一笔」组；`currencyUnit()/newItemStatus()` 辅助（读设置→归一化）；`openPanelInner` 播种排序；渲染调用点全线穿单位 |
| `tests/belongings/ui.test.ts` | schema 断言更新（3 组/显示组 3 行/记一笔组）+ 三条新 describe（排序接线/默认状态/金额单位） |
| `tests/belongings/render.test.ts` | 单位系统用例（moneyWith/moneyUnitLabel/moneyShort 缺省口径） |
| `tests/settings-panel.test.ts` / `tests/settings-modal.test.ts` | 归物本徽标 3→6、schema 组数 2→3 同步 |
| `prototypes/**` | 全量预览产物重出 |

## §3 测试

- 默认排序：schema 行配置 + 打开面板播种 `M.sort` + 非法值兜底。
- 默认状态：新建表单初始状态取设置，编辑已有物品不回退。
- 金额单位：四单位输出口径（￥前缀/元后缀/$前缀/纯数字）+ 渲染贯通（KPI/格子/详情/表单标签）。

## §4 门禁记录

- `pnpm exec vitest run`：294 文件 / 4524 用例全绿。
- `tsc --noEmit`：干净。
- `node scripts/build-preview.mjs`：全量预览产物重出（新鲜度守卫）。
