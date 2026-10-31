# 562：从豆瓣导入「我账号的」三份片单 + 片单整单动作补齐二次确认

日期：2026-11-01 ｜ 分支：feat/cinema-douban-mine ｜ worktree：bz-wt-douban-mine ｜ ADR-0278

## 背景

用户两条需求：① 把个人豆瓣账号的想看 / 在看 / 看过整份导进影院（评分按 5 星 → 10 分制映射、带标记日期、本地已有多少部要看得见、可整组勾选批量同步），建档后**不进任何片单**；② 侧栏片单行的整单动作（收录进影院 / 改名 / 移除）要两步确认，弹窗跟影院一个皮。

期间踩到一个前置故障：按 sid 直取字段只有 ApiZero 一条路，未配 key 时整批 105 部全失败——这条顺带被 ADR-0278 的字段来源切换解决。

## 决策（详见 ADR-0278）

- 字段主通道改豆瓣自己的移动端详情接口（免密钥），ApiZero 降为可选、只补热门短评，设置里挪到豆瓣 Cookie 之后。
- 个人片单不引第三方服务：`people/<uid>/{wish|do|collect}`，账号由设置里已有的豆瓣 Cookie 定位（`dbcl2` → uid）。
- 抓完落本地缓存；「重新导入」只读缓存不重抓。
- 建档不归片单、不打「片单收纳」；已看写 `评分 = 星 × 2` 与豆瓣标记日。
- 整单动作一律两步，确认框穿本域皮。

## 改动

**`src/cinema/douban-fetcher.ts`**
- 新增 `parseRexxarSubject` / `fetchRexxarSubject`（movie → tv 兜底，按 `title` 判成败），`queryDoubanByName` / `queryDoubanBySid` 改为 rexxar 主、ApiZero 兜底；`fetchSubjectPoster` 复用同一出口。
- `ApizeroInfo` → `SubjectInfo`（加 `posterUrl`）；检索失败时按 sid 再补一次（名称检索空手不等于没有这部片）。

**`src/cinema/douban-queue.ts`**
- `IMPORT_GAP_MS = 4000`、`BLOCK_BACKOFF_MS = 45000`（+ 测试用的 `blockBackoffMs` 覆盖）；`QueueEntry` 加 `gapMs / retried`；新增 `currentFetchPath()` / `pauseDoubanQueue()` / `resumeDoubanQueue()`。

**`src/cinema/douban-mine-cache.ts`（新）**
- `readDoubanMineCache` / `writeDoubanMineCache` → `<数据目录>/cinema-douban-mine.json`（`core/storage` 的 `jsonFileStore`）。形状不对一律当「没有缓存」，不能当空清单。

**`src/cinema/ui.ts`**
- 新弹层 `openDoubanMineImport` / `openDoubanMineSync`：三态顶栏（想看 / 在看 / 已看 + 动态计数）、合并滚动清单、全选默认开、本地已有置灰不计入、抓取与同步动画、同步完只留五个流动窗口。
- 弹层容器挂 `data-mine-g`（不复用侧栏轨的 `data-g`）并在挂载时 `stopPropagation`——修「点弹层把主界面切到「已看 · 0 部」」的冒泡事故。
- 片单整单动作：`shelfMembers` / `admitShelfToCinema` / `removeShelf` / `openShelfRename` / `shelfActs` / `shelfSheetHead`；收录补二次确认（本域皮，主钮不挂危险色）。
- 「去设置」改指设置面板 **AI 页**的 `cinemaDoubanCookie` 行并高亮（原先指影院页，锚点不存在，用户被丢进一张没有目标框的表）。

**`src/cinema/recommend.ts`**
- `quickAddFromDouban(app, name, type, status, opts?)`：按状态建档，已看写评分与标记日，不进任何片单。

**`src/cinema/styles.css` / `layouts/midnight/render.ts` / `shared.ts`**
- 两个导入钮（`j-import` 贴链接 / `j-import-mine` 我账号的），图标 `ICON.mine = 'user-round'`；弹层样式全部走域内既有 token，零新样式体系。

**`src/core/settings-main-schema.ts`**
- 凭据组行序改 B站 Cookie → 豆瓣 Cookie → ApiZero Key；ApiZero 描述改为「可选，补热门短评的第三方密钥」，豆瓣 Cookie 描述改为「抓取豆瓣字段与导入片单的登录凭据」。

**测试**
- 新增 `tests/cinema/douban-mine.test.ts`（建档/评分/日期/缓存）、`tests/cinema/douban-mine-ui.test.ts`（cookie 守卫、三份名单、全选与同步、弹层不冒泡、整单动作二次确认）。
- 同步 `douban-fetcher` / `douban-queue` / `motion-ledger` / `settings-schema` 等既有用例。

## 验收

- 主库实测：三份名单（408 / 15 / 0）抓取完成 → 缓存落盘 → 关层再开秒出清单；「重新导入」不再打豆瓣。
- 批量同步按 4 秒 1 部建档，被限流 45 秒后自动重试一次并成功。
- 已看条目带 10 分制评分与豆瓣标记日；导入的影片不出现在任何片单、不带「片单收纳」。
- 整单动作：收录 / 移除都先出确认框（`bz-cinema-flow-dialog`），取消则一部不动。
- 门禁：`tsc --noEmit` 干净；`test-affected --since master` 9522/9526 通过（失败 2 个均在 `tests/review`，单独跑该域 506 全绿，属多 worker 并发抖动，与本改动无关）。

## 已知缺口

- 批量导入的类型判定仍硬编码「电影」，未接 `type-decide` 的三级链（jev → LLM → 静态）——剧集与纪录片会被落成电影。
