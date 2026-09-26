# 478 · 归物本分类表——远端可下载的物品分类表 + 两次 Jev 归类

- 状态：**已完成（2026-09-27）**
- 域：belongings（新 `catalog/`、新 `catalog-suggest.ts`、改 `ai.ts`、改 `shared.ts` / `ui.ts`）+ core（新 `category-table.ts`、新 `ui/catpicker.ts`、`ui/components.css`、`ui/index.ts`）+ settings-panel（通用页新增「数据资产」组一行）+ scripts（新 `build-catalog.mjs`）+ tests
- 来源：用户要求「提供一张归物本的分类表，可供用户在设置面板中自行下载；一个图标配一个分类名，把这些分组；使用 Jev 模型调用两次，第一次只给分组、第二次给分组中的具体分类，一次最多 255 个选项，可处理 65025 个分类」。
- 关联：**ADR-0202（本票决策）** / ADR-0201（本票**限定**而非推翻：分类仍是自由字符串）/ ADR-0173（Jev 决策通道 + 失败回落纪律）/ ADR-0199（皮肤包远端分发——本票照其范式）/ ADR-0200（文档资产新鲜度，本票**不**扩张到本表）/ ADR-0122（滚动条单源）/ ADR-0002（依赖方向）

## 问题

归物本的 AI 归类（issue 231/ADR-0102 起）走「LLM 自由生成分类名 + 从 118 条冻结图标菜单里挑一枚图标」：分类名不受约束、图标池极小、每次结果不可复现。用户要的是一张**可下载的固定分类表**，把归类从「模型自由发挥」收敛成「从表里选」。

四项先期调研（并行子代理）决定了形状：

| 调研问题 | 结论 |
|---|---|
| GitHub 上有现成中文家庭物品分类表吗 | **没有**。最接近是 UNSPSC（5 级 / 8 万+ 条 / 官方中文）与 GS1 GPC（4 级 / 36 段），但粒度是采购供应链，对个人归物过粗过密 |
| Jev 能不能「生成」分类 | **不能**。Jev 是判定通道（ADR-0173），`choice` 只从注入清单里选一个 ⇒「两次 Jev」只能是**运行期归类**，不是造表 |
| Obsidian 图标全集怎么拿 | 唯一权威是运行时 `getIconIds()`。本机 `obsidian@1.13.4` 的 `app.asar` 可抽出 **1675 规范名 + 252 别名**，逐条在 `app.js` 可搜到、零假阳性 |
| lucide 够用吗 | **不够**。`kettle`/`mug`/`oven`/`iron`/`vacuum`/`curtain`/`glove`/`socks`/`tie`/`shelf` 等在 lucide **官方最新版也不存在** ⇒「一图标一分类」有天花板 |

## 决策要点（详见 ADR-0202）

1. 表为真两层：**26 组 / 515 条**，组 ≤255、组内 ≤255（两次 `choice` 各一层候选），不拆、不加第三层。
2. 表是**建议来源**，不是唯一合法分类——`category` 仍是自由字符串（ADR-0201 结论不动）。
3. 图标按语义择优、**允许重复**（含组内）；行数由收纳体系定，不为塞图标而造分类。
4. 两次 `choice` 各带哨兵 `__other__`「以上都不合适」；哨兵命中 / Jev 未配置 / 请求失败 / 答案畸形 → 回落 LLM，**但候选集仍取自表、返回值必须落在候选集内**（有表时绝不造表外分类）；`signal.aborted` → 抛 AbortError 且**不回落**。
5. 别名直配（精确名 → 最长别名包含匹配）短路，命中即**零网络**。
6. 资产照皮肤包范式：源在 `src/belongings/catalog/`，`pnpm catalog` 出版到 `manual/`（sha256 清单 + `--check`）；**只在点按钮时联网**，不做启动静默同步。
7. 两个消费面共用同表：表单 AI 按钮（两次 Jev）+ 表单分类选择器（`core/ui/catpicker.ts`，以 `openPathPicker` 为骨架 + 分组头 + 每行图标 + 搜索命中分类名与别名，非搜索态全量渲染，1200 条防呆阈值）。

## 落地

**表与资产**
- `src/belongings/catalog/categories.json`（新，26 组 / 515 条，含别名；人工三轮复审定稿）
- `src/belongings/catalog/icon-pool.json`（新，1675 规范名 + 来源与导出方法）
- `scripts/build-catalog.mjs`（新，出版 + 全量校验 + `--check`）、`package.json`（加 `catalog` 脚本）
- `manual/belongings-categories.json` + `manual/belongings-categories.index.json`（出版产物）

**运行时**
- `src/core/category-table.ts`（新：`validateCategoryTable` / `hasCategoryTable` / `loadCategoryTable`（内存缓存）/ `downloadCategoryTable`（sha256 不符即抛）/ `refreshCategoryTable`（静默）/ `matchByAlias` / `groupMenu` / `itemMenu` / `iconOf`；复用 `core/remote-asset.ts`，不另造下载与落盘）
- `src/belongings/catalog-suggest.ts`（新：编排；`null` = 无表走不了、抛错 = 有表本轮失败，语义严格区分）
- `src/belongings/ai.ts`（改：`suggestCategoryByCatalog` 优先，无表回落旧 LLM 自由生成路径；**对外签名不变，`ui.ts` 未动**）
- `src/core/ui/catpicker.ts`（新）+ `src/core/ui/components.css` + `src/core/ui/index.ts`
- `src/belongings/shared.ts`（改：`#bm-cat` 与 `#bm-ai` 之间加 `#bm-catpick` 按钮）
- `src/belongings/ui.ts`（改：绑定选择器；回填复用 AI 按钮同一条 `catInput/formIcon/drawIconChip` 通道）
- `src/settings-panel/ui.ts`（改：通用页新增「数据资产」组 + 「归物分类表」下载行，状态从本地文件现推、busy 禁点防重入）

**测试（新增 5 个文件 / 51 条用例）**
- `tests/belongings/catalog-table.test.ts`（103）——盯表源的完整性回归（组/类 ≤255、id 与名唯一、图标 ∈ 池、别名不跨分类重复），表被手改即红
- `tests/core/category-table.test.ts`（276）——校验/查询/sha256 不符抛错
- `tests/belongings/catalog-suggest.test.ts`（175）+ `tests/belongings/ai-catalog.test.ts`（64）——10 条分支：别名零网络、两段命中返表内 name/icon、两层哨兵各自回落、Jev 未配置/抛错/畸形键转 LLM、LLM 给表外分类抛错、无表返 null、aborted 不回落
- `tests/core/catpicker.test.ts`（282）——真实表源硬断言（非搜索态组分区 = 26、条目 = 515、无截断提示）+ 1300 条合成用例 + 别名搜索 + 图标兜底
- `tests/settings-panel/bd-cat-download-row.test.ts`（157）——未下载态 / 成功 / 失败 / 防重入

## 过程账（诚实记录）

- 表初稿由子代理生成后经**三轮人工返修**：占位图标（`image`/`box`/`tag` 类）**104 条 → 1 条**；语义错指派（`内衣→heart`、`轮胎→ship-wheel`、`登山杖→tree-pine` 等）**34 条 → 0**；期间发现「初稿 523 条 → 定稿 515 条」的 8 条差额来自组间合并去重（过程文件被覆盖、无 git 留痕，无法逐条比对，已在交付时向用户披露）。
- 两处**我的 spec 拍错、事后修正**：① 选择器原定 300 条全局截断，在 515 条真实表上会让第 16–26 组（11 个组）在默认视图里根本看不见 → 改为非搜索态全量渲染 + 1200 条防呆阈值；② Jev 未配置时回落给 LLM 的候选集是全表 515 条（约 4k token），能跑但偏贵 → 记账未改，留待日后决定是否把 LLM 回落也改两步。
- 实现期两个子代理因**配额 429**（非实现失败）中断，剩余阶段由主代理直接完成。
- **交付前独立核验抓到的一个真 bug（子代理全部漏掉、且不报错的那种）**：`getIconIds()` 对内置 lucide 返回的是**带 `lucide-` 前缀**的 id（实测 1.13.4 的 `app.js`：`Object.keys(<内置表>).map(e => 'lucide-'+e)`），而表里存的是不带前缀的规范名。原实现只判一种形态 ⇒ **515 条 + 26 个组图标会被全部判成「未知」，每行静默退化成组图标、组头退化成 `package`，零报错**。已改为两形态都认并补回归断言（`fix(core/ui)` 提交）。教训：既然兜底逻辑的存在理由是「未知名会被静默忽略」，它自己出错也必然是静默的——兜底必须配「正向也能过」的断言，只测「不在池里会回落」是测不出这一类错的。
- 另一处小账：通用页新增「数据资产」组后，既有测试里写死的「通用页 3 组」断言必红，已改为按组名整列比对（4 组）。

## 门禁

- `pnpm exec vitest run`：**538 文件 / 8064 用例全绿**（含本票新增 53 条）。
- `pnpm exec tsc --noEmit` 通过；`node scripts/build-catalog.mjs --check` 通过（26 组 / 515 条，sha256 `5033b95d806e`）。
- 独立端到端探针（临时用例，核验后删）：出版产物经运行时 `validateCategoryTable` 通过且与表源同构（26/515）；`manual/` 出版文本换行归一后的 sha256 与清单一致；全表图标 ∈ 图标池；`groupMenu`=26、各组 `itemMenu` ≤255、键形态 `g\d{3}` / `c\d{4}` 且分类键全表唯一；别名直配真实命中（充电宝→移动电源、power bank→移动电源、手机→智能手机）。
- 自审 + diff 审查（改动面 44 文件，未触碰 `main.js` / 根 `styles.css`）；主仓 `pnpm run build` 并部署（worktree 内不构建）。
