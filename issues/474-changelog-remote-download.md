# 474 · 更新日志改为在线下载（照搬使用手册口径）

- 状态：已完成（2026-09-26）
- 域：core（remote-asset / changelog / manual）+ settings-panel（changelog 弹窗 + 入口 + 样式）+ scripts（生成器）
- 来源：用户要求「把更新日志也改成使用手册在线下载的方式」；拍板两件事——**产物形态 = 自包含 HTML**、
  **失败不兜底（只给通知）**。
- 关联：ADR-0198（本票决策）/ issue 473（手册在线下载，本票照办其范式）/ issue 472（更新日志弹窗立票）/
  `docs/changelog.md`（规范改写）

## 需求与拍板

同放侧栏 footer 的两个入口必须是同一种活法：issue 473 之后使用手册已改为「不随构建分发 → 点入口现场从 GitHub 下载 →
OB 内弹窗 iframe srcdoc 内嵌」，更新日志仍是「生成器产 TS 常量 → 打包进 main.js → 弹窗本地渲染」。
用户要求拉齐，并在开工前拍板：

1. **产物形态** = 自包含单文件 HTML（不是「远端 JSON + 本地渲染」）——完全照搬手册，一次到位；
   代价是日志版式此后属生成器模板，不再走 `src/settings-panel/styles.css` 单源。
2. **失败不兜底** = 下载失败不退回编译期内置快照，只出人话通知且不弹窗——与手册一致，
   避免「内置旧快照悄悄生效」这种更难排查的假象。

## 改动

### 生成器（`scripts/_gen-changelog.mjs`）

- 停写 `src/settings-panel/changelog-data.ts`，改产 **`manual/bz-changelog.html`**（单文件自包含，实测 70.4KB）：
  与手册同一套 `--sp-*` 令牌与亮/暗两套皮肤；上方头行（标题 + `v当前版本 · 25 个版本 · 2026.08–2026.09` + 生成日期）、
  左版本栏（最新在前、当前版带「当前」签、MM-DD）、右版本内容（版本头 + 三个计数签 + 三段：新功能主色 / 修复优化灰调，
  条目 = 域标签 + 主题句 + 弱化副行）；`localStorage['bz-changelog-theme']` 记主题。
- 数据以 `const DATA = {...}` 内联（`</` 转义防提前闭合脚本）；版本合成/内容改写口径**一字未动**（25 版本 / 512 条，与改造前同）。

### 下载内核（新增 `src/core/remote-asset.ts` + `src/core/changelog.ts`）

- `remote-asset.ts`：把 issue 473 里 `core/manual.ts` 的整条链上提为通用内核——`remotesFor`（raw.githubusercontent 主 →
  jsDelivr 备）、`assetVaultPath`（`<configDir>/plugins/bz/<file>`）、`hasAsset/readAsset`、`downloadAsset(app, file, validate, label)`、
  `ensureAssetReady`（无则下载 → 再读 → 读空/读异常视同未下载自愈重下）。
- `core/changelog.ts`：钉 `CHANGELOG_FILENAME = 'bz-changelog.html'`；内容校验 = HTML 文档头 **且** 含 `const DATA =`（防 CDN 错误页与半截文件）；
  `ensureChangelogReady` 失败抛「更新日志下载失败：<最后失败远端> → <原因>」。
- `core/manual.ts`：收敛为内核薄封装（文件名 + `looksLikeManual` + 四个转发），对外 API 不变，`tests/manual.test.ts` 原样通过。

### 弹窗与入口（`src/settings-panel/`）

- `changelog.ts` 重写为手册同款壳：`openChangelogModal(html)` → `iframe.srcdoc = html`；hide 型常驻层范式
  （topifyZ 抬顶 + ESC 栈序重放注册 + trapPanelFocus + `.bz-sp-skin` 同皮）保留；关闭清 srcdoc 释放渲染树；
  `unloadChangelog` 幂等不变。头行副标改静态「包仔 · 逐版本变更记录」（版本号随 HTML 走，弹窗头不再重复报数）。
- `ui.ts`：入口从同步 `openChangelogModal()` 改为 `runChangelogOpen(btn)`——`.is-loading` + 图标 `loader` 转圈防重入，
  `finally` 复原 `history`；失败 notice 透 `core/changelog` 的人话原因。
- `styles.css`：`.bz-chg-*` 段从 ~130 行缩到 30 行（只留 `.bz-chg-popup/.bz-chg-body/.bz-chg-frame`）。
- 退役：`src/settings-panel/changelog-data.ts`、`tests/settings-panel/changelog-data.test.ts`。

### 连带

- 原型假层 `prototypes/settings-panel/fake/fake-obsidian.ts` 的 `requestUrl` 补两条真产物回放（`/manual/bz-manual.html`、
  `/manual/bz-changelog.html` 按需 fetch 后回放）——**此前手册在评审壳里其实走不到**（`requestUrl` 一律抛错），本票顺手补齐。
- 文档：`docs/changelog.md` 全面改写（产出物变更、分发口径、生成后须 push、**原型新鲜度指纹不再受影响**）。

## 非目标

- 移动端入口（弹窗本体仍带 ≤768 回退；日志 HTML 自带窄屏排版：版本栏转顶部横向签排）。
- 不改版本合成与内容改写规则（口径与改造前逐字一致）。

## 测试

- `tests/core/changelog.test.ts`（新增，11 例）：双远端顺序与路径跟随 configDir；首次打开下载落盘并返回文本；
  已下载不再发请求；主远端不可信 → 备远端接管；两路都不可信 → 抛人话错且不写文件（不兜底）；网络失败透原因；
  内容校验（只有 HTML 头缺数据锚点 → 换远端）；本地空串自愈重下；`ensureAssetReady` 写盘异常 → 「下载后读取失败」；
  `readAsset` 两态。
- `tests/settings-panel/changelog.test.ts`（重写，7 例）：footer 入口在 aside 内且不沾导航契约类；点击未下载 →
  `is-loading` → 写盘 → 弹窗 `iframe.srcdoc` 直灌 → 复原；已下载直接打开 + 防重入（不再发请求）；失败 → notice 出原因 + 不弹窗；
  弹窗头行/ESC 清 srcdoc/重开换内容；遮罩点击关本体不关；`unloadChangelog` 幂等。
- `tests/manual.test.ts`、`tests/settings-panel/manual.test.ts`：**未改一行**，重构后原样通过（内核上提无行为漂移的证明）。

## 门禁

见本票提交信息（worktree 内全量 vitest + `tsc --noEmit`）。`pnpm changelog` 已在 worktree 内试跑验证产物形状；
**正式产物须回主仓库重跑**（生成器读 cwd 的 git 历史，worktree 里跑会生成残缺版本），并随提交 push——
插件是从 GitHub 现场拉这份文件的。

---

## 追加 · 474b 版式打磨（2026-09-26）

用户上手看过第一版产物后提五条，逐条落实（生成器模板 + 产物同步重出）：

1. **去头行副标** —— `v1.24.0 · 25 个版本 · 2026.08 – 2026.09` 整条删除（版本号已在左栏「当前」签上，弹窗头冗余）。
2. **去计数签** —— 版本头下的 `新功能 8 / 问题修复 12 / 体验优化 1` 三枚 `cg-kinds` 全删；三段分组本身已表达分类，签只是重复报数。
3. **去左栏栏头** —— `版本（最新在前）` 的 `cg-sec` 删除，左栏直接起版本列表（顺序本身自明）。
4. **标题改名** —— 头行 `包仔（bz）更新日志` → **`更新日志`**；同时 `<title>包仔（bz）更新日志</title>` → **`<title>更新日志</title>`**（宿主标签页/书签那一层）。
5. **域名中文化 + 对齐** —— 条目左标签走 `DOMAIN_NAMES` 全中文（含 `core→核心` / `ui→界面` / `global→通用` / `ai→人工智能` /
   `settings-panel→设置面板` 等 28 项，`ai` 由 `AI` 改 `人工智能`）；映射表随 payload 下发（`DATA.domainNames`，前端
   `const DOMAIN_NAMES = DATA.domainNames;`）；标签容器改 `.cg-dom{flex:none;width:76px;text-align:right}`（窄屏 62px），
   描述文字左边缘对齐成一条竖线。

死代码清理：`cg-kind` / `cg-kind--add` / `cg-sec` / `cg-kinds` 样式与 `dates` / `span` 局部变量一并删除。
产物重出：`版本数=25 条目=514 当前=1.24.0`，`manual/bz-changelog.html` 70.5KB（72225 字节）。
校验：28 个域名键，514 条条目**零未映射**（全中文覆盖）。

### 连带修复（本次门禁暴露，均非 474 本票引入）

主仓有另一并行改造（「手册/日志入口从底缘 footer 移入导航末尾『文档』组」+ 手册/日志移动端形态），
合并后跑门禁暴露三处缺口，随本次一并补齐：

1. **`src/settings-panel/render.ts` re-export 缺口** —— 布局层 `layouts/jingwei/render.ts` 已定义
   `navDocSecHtml` / `mobDocSecHtml`，但域入口 `render.ts` 的转出清单漏了两个（`ui.ts:477` 调
   `R.navDocSecHtml()` 直接 `TypeError`）。补进转出清单（纯加两个名字，两行）。
2. **`:hover` 触屏粘滞破口** —— `.bz-chg-close:hover` / `.bz-manv-close:hover` 未包 `@media (hover: hover)`
   （移动端关闭钮是本次新增，违反了 `tests/core/bd-paradigm-hover-isolation.test.ts` 的 F4 范式）。两处各包一层。
3. **域计数断言选择器过宽** —— `tests/settings-panel.test.ts` 桌面/移动两条用例用 `.bz-sp-nav-name` /
   `.bz-sp-mob-name` 数域项，而新「文档」组（手册/日志）复用同名 span，导致 20 被撑到 22。
   改为 `.bz-sp-nav-item .bz-sp-nav-name` / `.bz-sp-mob-item .bz-sp-mob-name` —— 只数真域项，
   与 `.bz-sp-nav-doc` 的设计意图（「手册/日志不是域，不得入列」）一致。语义比改数字更准。

### 主仓产物污染处置

合并时发现主仓工作区的 `manual/bz-changelog.html` 被注入 19 处 `data-page-node-id` 属性（外部编辑器所为），
且内容仍是未打磨的旧版。已丢弃该版本（备份在 `D:/Obsidian/_bz474b/mainrepo-changelog-polluted.html`），
以生成器重出的干净产物覆盖；`grep -c data-page-node-id` 现为 0。
