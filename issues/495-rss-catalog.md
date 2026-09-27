# 495 · RSS 源库：社区清单出版为在线资源 + RSS 管理弹窗大改（我的订阅 / 源库双页签）

- 状态：已实现（2026-09-27；worktree 门禁：tsc 绿 + 547 文件 8179 用例全绿；出版定稿：解析 1349 / 剔除 197 / 存疑保留 315 / 收录 1152，归类覆盖 97.7%；pomodoro 392Hz 一条全量并行下计时抖动为存量 flake，单跑 80/80 过）
- 域：scripts（`rss-catalog/` 出版管线新增）+ core（`rss-catalog` 资产层新增）+ clipbook（RSS 管理弹窗大改）+ settings-panel（在线资源组描述补充）
- 来源：用户提案「内置 RSS 源，社区有相关维护项目，评估作为在线资源提供下载」→ grill-with-docs 两轮拍板
- 关联：ADR-0208（黄页订阅模型，本票决策）· ADR-0203 / 0205 / 0207（在线资源与清单驱动行集合）· ADR-0121（RSS 订阅源）· ADR-0128（抓取内置）· issue 494（清单驱动机制——本票第五行零代码直接受益）

## 拍板记录（grill 两轮，用户「全部按照你来的」×2）

1. **上游**：首期只接 timqian/chinese-independent-blogs（MIT，约 1350 条带 feed 地址），脚本留多上游适配位；CC0 的 awesome-rss-feeds-list 列二期。
2. **死链门禁**：出版期并发测活；剔除口径收窄为**确定性死亡**（404/410、200 但非 feed 结构），403/429/5xx/超时/连不上**保留并在报告标记**（防反爬与环境性误杀）；报告随仓库提交。
3. **订阅语义**：黄页模型——订阅 = 拷贝进 `rssFeeds`，与手动添加同权同生命周期；已订阅态按归一 URL 匹配，不存来源字段；删库/更新库不影响已订阅。
4. **下载触点**：设置面板在线资源组一行（ADR-0207 清单驱动，零代码）+ RSS 弹窗源库页签就地下载，`downloads:asset-changed` 同步。
5. **信息架构**：弹窗双页签「我的订阅 / 源库」；源库 = 搜索框（防抖、命中计数、无结果空态）+ 分类 chips（固定大类 + 计数徽标）+ 列表（名称 + 域名 + 标签 + 订阅钮三态）；弹窗 560 → 720（仅桌面）。
6. **RSSHub 本期不做**：schema 预留 `via` 字段，下期单独立项。
7. **分类体系**：固定约 10 个大类 + 脚本内置「原始标签 → 大类」关键词映射表（首中归类、可多类、未命中入「综合」），810 个原始标签全保留只作搜索词；出版报告报未命中率。
8. **「专业」下限**：搜索细节（防抖/命中计数/空态）、订阅即时反馈（按钮态机/通知/列表即时插入）、分类导航（chips + 计数）、列表信息密度（名称+域名+标签一行）、源库未下载空态引导——五条全做；**不做**每源最近文章预览（每行一次网络请求）。

## 改动

### 仓库与构建

- `scripts/rss-catalog/`（新增）：
  - `upstream/timqian-chinese-independent-blogs.md`——上游快照入库（`rss-upstream` 脚本刷新，出版可离线复现）；
  - `lib.mjs`——纯函数：markdown 表格解析、原始标签 → 大类映射、目录对象组装（vitest 直测）；
  - `fetch-upstream.mjs`——拉上游 README 刷新快照（`pnpm rss-upstream`）；
  - `build.mjs`——出版：快照 → 转换 → 并发测活（16 并发 8s 超时重试一次）→ `downloads/rss-catalog.json` + `liveness-report.json`（`pnpm rss-catalog`）；发布顺序在 `catalog` 之后、`manifest` 之前。
- `scripts/build-manifest.mjs`：DOCS 登记 `{ id: 'rss-catalog', name: 'RSS 源库', file: 'rss-catalog.json' }` + `ROW_ORDER` 加 id（反向守卫本来就强制）。
- `package.json`：`rss-upstream` / `rss-catalog` 两条脚本。

### core 层

- **`core/rss-catalog.ts`（新增）**，仿 `category-table.ts` 范本：`validateRssCatalog`（形状 + URL 去重 + cats ⊆ categories）、`loadRssCatalog`（内存缓存）、`downloadRssCatalog`（统一清单条目 → `ensureAssetWithHash`）、查询纯函数 `catalogCategoryCounts` / `filterCatalogFeeds`（query 命中 title/site/tags、按大类过滤）、`feedDomainOf`。

### clipbook 层

- `news-sources-group.ts` 大改：
  - 弹窗改双页签「我的订阅 / 源库」，宽度 560 → 720（`maxWidth` 仅桌面生效，移动端沿用现状）；
  - 「我的订阅」= 现有 schema 原样搬入，空态文案引导去源库；
  - 「源库」= 域内自绘面板（搜索框 + chips + 列表；未下载空态给就地下载钮走 `downloadRssCatalog`）；
    订阅动作 = `addRssFeed(url, title)`（出版期已测活，跳过试拉——与自定义添加的试拉口径分叉已在 ADR 记账）；
    订阅按钮三态（订阅 / 订阅中 / 已订阅禁用），订阅成功即时刷新我的订阅列表与行数；
  - 监听 `downloads:asset-changed`：设置面板侧下载落盘后，开着的源库页签自动重算状态。
- `styles.css`（clipbook）：`bz-rss-cat-*` 系列样式（页签条 / chips / 列表行）；不碰滚动条（ADR-0122 通杀）。

### settings-panel 层

- `online-resources.ts`：`DESC_EXTRAS` 加 `'rss-catalog'` 一条（就绪描述捎带「N 类 M 源」）——本票在该文件唯一改动。

### 文档

- ADR-0208（黄页订阅模型）；CONTEXT.md 词条「RSS 源库」+「RSS 订阅源」来路注记。

## 非目标

- RSSHub 支持（实例地址设置 + 路由型条目）——schema `via` 字段预留，下期立项。
- per-feed 健康度展示——直连源死链由出版期测活兜底，抓取失败仍走既有静默语义。
- 每源最近文章预览、批量按类订阅（一次订阅一个，防灌库）。
- CC0 第二上游（awesome-rss-feeds-list）——适配位留好，二期接。

## 测试

- `tests/scripts/rss-catalog-lib.test.mjs`：表格解析（含 None 行/坏行跳过）、标签映射（首中/多类/未命中→综合）、目录组装与去重。
- `tests/core/rss-catalog.test.ts`：validate 合法/畸形矩阵、真源校验（读 `downloads/rss-catalog.json`）、清单链路下载（mock，同 category-table 口径）、查询纯函数（计数/过滤/域名提取）。
- `tests/clipbook/rss-catalog-ui.test.ts`：源库面板状态机（未下载空态/就绪）、订阅动作（入库/去重/已订阅态）、搜索过滤与命中计数、chips 计数；既有 `rss-ui.test.ts` 回归。
- `tests/settings-panel/online-resources.test.ts`：DESC_EXTRAS 新条目形状。
- `tests/smoke.test.ts`：清单含 rss-catalog 条目的行呈现（若该测试钉行集合则同步）。

## 门禁

worktree 内 `pnpm exec tsc --noEmit` + 全量 `pnpm test` + 自审 + diff 审查；出版链（`rss-upstream` → `rss-catalog` → `manifest`）全量真跑；主仓合并后构建部署 + changelog + 子代理 review。
