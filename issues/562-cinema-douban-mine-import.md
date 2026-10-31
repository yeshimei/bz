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

## 补记（2026-11-01 用户试用反馈，同日修）

- **中文输入法组字被打断**（用户报：「开中文输入法打，等着下面刷新，输入框被强制关掉，只搜到几个字母」）。两个原因叠在一起：① 组字中的 `input` 事件带的是拼音（`chenxiang`），被当作搜索词跑了一遍；② 组字期间任何 `renderAll` 都会整写 `innerHTML`，把搜索框节点换掉，浏览器随之结束组字会话（候选窗消失、拼音残在框里）。修法：`compositionstart/update/end` 三个监听挂在面板根上，组字期「不搜、不整刷」，打字心跳续上让 `renderSoft` 继续顺延，`compositionend` 才按汉字搜并补刷；另加 15 秒安全阀（输入法异常/组字中关面板时自愈）与开/关面板时的清态。回归用例在 `tests/cinema/ui.test.ts`（拼音阶段 `M.searchKeyword` 必须为空、后台刷新不许换掉输入框节点、定字后按汉字搜）。
- **危险确认框换本域皮**：原来三处确认（删除影视 / 移除片单 / 收录进影院）走 core `openFlowDialog`——挂 `document.body`，而影院样式全在 `.bz-cinema--midnight` 作用域内，只能靠一段 id 选择器手映射纸色，形制仍是宿主通用确认框（用户 2026-11-01：「弹窗风格要和影院一致」，并点名两个弹窗：片单删除确认、海报卡片删除确认）。改为本域 `confirmCinema()`：走面板树内的 `ovl` → `.cn-modal--confirm`（小标 + 片名 + 正文 + `.cf-btn` 按钮条），与「片单改名」「归入片单」同一张纸；ESC / 点遮罩取消仍由 `escManager` + `mask-dismiss` 承担，危险动作焦点落取消钮。影院侧旧的 `#__shared_confirm_popup__.bz-cinema-flow-dialog` 映射段随之退役。
- **移除片单：按影片位置自动分流，一次确认整单办完**（用户 2026-11-01 三次改口径，最终版）。
  确认框不再给用户选「只摘出 / 删影片」（用户原话：「这是什么鬼？自动判断」），只有「取消 / 移除」，正文按两类报数。
  - 影院主列表里也有（无「片单收纳」）→ 只摘掉这个片单的归属，影片留在主列表；
  - 只在片单里（带「片单收纳」，主列表看不见它）→ 移入 Obsidian 回收站（.trash），可恢复；
  - **多片单例外**（用户采纳）：导入条目还挂在别的片单上时只摘本片单归属、不删——它在别的片单里仍可见，删了整个条目就没了，等它从最后一个片单退出才轮得到删除。
  整单逐部容错（某部失败只记一条、不中断），`shelfBusy` 防重入，10 部以上先报一声「正在移除」。
