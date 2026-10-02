# ADR-0231 · 影院与日记本首屏提速：先绘壳、窗口化渲染、后台分片让出

日期：2026-10-02 · 状态：已采纳 · 关联：ADR-0170（日记本墙预热与会话缓存）、ADR-0171（日记本首帧让位）、
ADR-0130（一目一文件）、ADR-0230（日记本「桌上那本」书页 UI）、ADR-0020（样式按域拆分）、
issue 539 · 调研：`.scratch/memo-suite-plugin/research/539-cinema-diary-first-paint.md`

## 背景

### 两个域各自卡在哪

**影院（`src/cinema/`）——卡在同步链，不是卡在数据量。**
`createOverlay`（`ui.ts:2568`）把空壳 `appendChild` 之后，**同一个 tick 内**同步跑完
`rebuildItems(app)`（`ui.ts:2625`：`getMarkdownFiles()` 前缀过滤 + 820 次
`metadataCache.getFileCache` 同步解析）与 `renderAll(app)`（`ui.ts:2626`：820 张卡 HTML 拼串 +
整写 `.grid` 的 `innerHTML`）。全链路**零 `await`** ⇒ 浏览器从未得到绘制空壳的机会，首帧 =
全部工作做完。用户任何一次筛选 / 搜索 / 排序也整刷 820 张（`renderAll` 靠 `scrollMemo` 事后
补回 `scrollTop`，说明卡顿此前已被感知）。

**日记本（`src/diary/`）——卡在读盘与全量测量。**
回忆墙聚合四类内容（`readWallEntriesFresh`，`data.ts:277`），其中日记正文 1243 篇走
`vault.read`（`data.ts:237`，**磁盘读**），`READ_BATCH_SIZE = 10`（`data.ts:94`）意味着
**125 个串行批次**；信另走 `parser.ts:191` 的 `vault.read`。读毕再一次性全量离线测高 +
`paginateFlow` 切页 + `buildBook` 建 StPageFlip（`ui.ts:589-595`、`ui.ts:689`）。

### 实测规模（真实 vault `E:\Obsidian\叫我包仔`）

| 目录 | .md 数 | 备注 |
|---|---|---|
| `我的/影视` | 820 | 其中带 `影评` 的 156 条进墙 |
| `我的/日记` | 1243 | 23 年 190 / 24 年 285 / 25 年 301 / **26 年 467** |
| `我的/信` | 15 | |
| `书库` | 72 | 其中带 `bookReview` 的 29 条进墙 |

日记正文平均 306 B（总 380 KB），影视平均 1 038 B（总 851 KB），最大单篇 8 KB。

### 一手依据（调研笔记 A/C 节，均带来源链接）

- 官方 `obsidian.d.ts` 对 `read` / `cachedRead` 的注释：`read` = 「directly from disk. Use this if
  you intend to modify the file content afterwards. Use `Vault.cachedRead` otherwise for better
  performance.」⇒ **只展示**的批量读取应走 `cachedRead`。
- `metadataCache.getFileCache` 在冷启动 / `onload` 期间对尚未解析的文件**返回 `null`**；
  `resolved` 事件两阶段触发，且大库上**常驻订阅它是洪水式触发**（obsidian-task-center 自述的
  启动回归根因）。
- `requestIdleCallback` 在 Safari 桌面与 iOS 全部不存在（有插件因此加载失败的真实事故）；
  `scheduler.yield()` 仅 Chromium，Obsidian 桌面自 1.8.3（Electron 33 / Chromium 129+）内置。
- Safari **没有** scroll anchoring，Chromium 有。
- 社区：dataview / obsidian-tasks 都**不做虚拟化**，把限流推给用户写 `LIMIT` 或给容器加
  `max-height + overflow:auto`，大结果集在移动端会崩；notebook-navigator 用
  `@tanstack/react-virtual` 真虚拟滚动，但那是 React + 文件列表场景。

## 决策

1. **首屏只渲窗口；扫描保持同步。** 影院的 `rebuildItems + renderAll` **不改成异步**。账要算对：
   820 次 `getFileCache` 是**纯内存查表**（`parseMovieFile` 只吃 frontmatter，不读正文），
   实测量级几十毫秒，不是首屏的病根；病根是 `renderAll` 一次拼 820 张卡的 HTML 再整写 DOM
   （外加 820 张海报的布局与绘制）。所以 `createOverlay` 里仍是**同步** `rebuildItems(app)` +
   `renderAll(app)`——同步语义是既有契约（测试「开面板即断言」、写后回刷都依赖它），**真正的
   改动落在渲染窗口**：首屏只渲 `FIRST_PAINT_CARDS` 张，其余交给空闲追加。不需要为扫描引入
   `afterPaint` 让位——窗口本身已把首帧的渲染成本砍到 1/40。
   冷启动守卫（决策 8）须在**首次渲染之前**判定并置好 `M.loading`，否则首渲会带 `loading=true`
   先出一帧骨架，而空库分支又不重渲 ⇒ 骨架永久留在屏上（`view-fix #1` 回归即此成因）。
2. **首屏数量按各域版式定，不与批粒度共用。**
   - 影院 `FIRST_PAINT_CARDS = 20`：网格桌面 5 列 / 移动 3 列；卡片按 `aspect-ratio: 2/3`
     随面板宽等比缩放 ⇒ **不论面板拉多大，可视区始终约 2 行**。20 张 = 5 列 × 4 行 ≈ 两屏，
     首屏填满且向下滚一段不见底。
   - 日记本 `FIRST_PAINT_ENTRIES = 30`：书页 520×700、正文可用高 546 px，一个跨页约 6 则。
     30 则 ≈ 5 个跨页 ≈ 最近半个月，像一本有厚度的册子。
   - 首批之外的**后台批粒度统一 50**（`src/core/paging.ts` 的 `LIST_BATCH_SIZE`）。
3. **计数一律按全量。** 窗口只决定「渲染多少」，不改变任何计数口径：影院 `· N 部`、侧栏分组计数、
   搜索命中数，日记的日戳「当天几则」等，全部继续读全量集合。
4. **后台不阻塞。** 影院空闲时每批 50 张 `insertAdjacentHTML` **追加到 `.grid` 尾部**，不走
   `renderAll`（避免整刷 + 避免 `scrollTop` 复原 + 避免重算网格动效）；日记本后台**只把正文推进
   内存，绝不重排**。
5. **交互即让路。** 影院空闲追加循环每批之间 `await yieldToMainThread()`；打字静默期（复用影院
   已有心跳 `M.lastInputAt`，400ms）或滚动刚动过（`M.lastScrollAt`，220ms）时**先等不追**——
   手一停就自行续。作废靠 `appendSeq` 编号：`renderAll`（含筛选/搜索/排序）与 `closeOverlay`
   各递增一次，在飞的旧循环下一次醒来即发现编号不符而退场（避免「整刷已重建网格，旧循环还按
   旧 from 往后塞」）。日记本的窗口成册是一次性闸门（`firstPaintDone`），进度订阅在
   `loadEntries` 的 `finally` 里退订——**不做**常驻订阅，读盘结束就没有回调可能再触发重排。
6. **日记本窗口化与页索引锁定。** `relayout` 只吃窗口内条目（`all.slice(0, shown)`），**计数类
   一律按 `all`**（日戳「当天几则」、年份范围、灯箱索引、查找）。用户**翻到书尾**才把窗口推宽一批
   50，`relayout(false, true)` 的 `keepPage` **钉住当前页索引**
   ——总页数变了，按比例映射会把读者往前推，而续叠时位置本该纹丝不动。
   **「书尾」不是 `pages.length - 1`**（回修，见下）：StPageFlip 跨页模式的 `flip` 事件给的是
   **当前跨页的左页号**（`showSpread()`：`currentPageIndex = spread[0]`），`showCover: false`
   从 0 起配对 ⇒ **偶数页数**时最后一跨是 `[n-2, n-1]`、左页号止于 `n-2`，`n-1` 永远到不了；
   奇数页数时最后一跨是 `[n-1]`；单页模式每页自成跨、恒 `n-1`。判据抽成纯函数
   `lastReachableCursor(pageCount, single)`（`src/diary/ui.ts`，可脱开书实例单测）。
   代价要说清：续叠是**整窗重排**（`paginateFlow` 对加宽后的窗口重跑一次 + 一次 reflow 量高 +
   `buildBook` 重建 StPageFlip 实例），**不是**「只测新增部分」。之所以接受：① 成本以**窗口**
   为界（不是 1243 全量）；② 只在「用户主动翻到书尾」这一刻发生，不是后台自动；③ StPageFlip
   v2.0.7 无 `addPage`（只 vendored 的 `page-flip.browser.js`），动态加页本就得整实例重建。
   真要做成「只测新增」需要按条目 id 缓存块高并只对新增分页，属另立 issue 的优化空间。
   两条触发路径：「下一页」钮走 `turnPage`（在书尾直接续叠，不翻）；
   拖拽 / 键盘翻到书尾走库的 `flip` 回调——**延后一拍**（`setTimeout 0`）再续，
   因为续叠会 `destroy` 当前 StPageFlip 实例，不能在库自己的回调栈里把它拆了。
7. **日记本读盘换 API。** `vault.read` → `vault.cachedRead`（纯展示，官方口径）；并发批
   10 → 50（复用 `LIST_BATCH_SIZE`）；批间让出。**写后回刷路径保持 `read` 与
   `invalidateWallCache` 回源语义**（`cachedRead` 在「外部改动 → 通知」之间有陈旧窗口）。
8. **冷启动守卫。** 扫描前等 `metadataCache` 就绪：`workspace.onLayoutReady` 已就绪即回调，
   否则**一次性** `metadataCache.on('resolved')`，配超时兜底；拿到即退订，**不作常驻订阅**。
9. **跳过屏外渲染（只做影院）。** 影院卡片加 `content-visibility: auto;
   contain-intrinsic-size: auto 320px`。Chromium（桌面 / Android）支持，iOS < 18 自动降级。
   `contain-intrinsic-size` **必须同配**，否则屏外元素按 0 高估算、入视口瞬间跳动。
   **日记本不加**：书页排版是**离屏测高**做的（`.bz-diary-probe` 里读 `offsetHeight` 切页），
   `content-visibility: auto` 会让屏外元素返回估值而非真实高度，切页直接算错；而且
   StPageFlip 自己就在操纵页元素的 transform，再叠一层渲染包含风险不可控。
10. **首开骨架。** 本会话首次打开、数据尚未就绪时，影院 list 视图出骨架页，而不是
    `emptyPageHtml`（「影片空空如也」是**语义错误**——库不空，是还没读完）。
    骨架与网格同构（同列数、同 `aspect-ratio`），数据到了原位换人不跳版；静态不闪动。
11. **预热仍读全量，但不阻塞。** `prewarmDiary`（ADR-0170）保留全量读的理由：墙缓存存的是
    **整墙的 promise**，只温首批就无法缓存，第二次开册又会重新读一遍、丢掉「开册秒开」。
    这次改的是**读法**（`cachedRead` + 50 并发 + 批间让出）而不是**读多少**——它在空闲时
    逐批推进，用户一有动作就被让路，所以不再有「预热把主线程占住」的观感。
12. **索引与检索吃「已加载全量」，不吃排版窗口（回修，见文末）。** 册页索引 / 检索 / 台历跳日
    三处的口径一律改为 `visibleEntries()`（已加载的全部条目），不再读 `pages`（只排了窗口那一段的
    书页）——**窗口是排版细节，不是数据边界**：
    - **册页索引**改成纯函数 `monthIndex(entries)`（月 → 该月最新一则的 id + 条数），不吃排版；
      表头「自…至… · 凡 N 则 · M 个月」三项同源（原先「则」读全量、「月」读窗口，自相矛盾）。
      **页码只有排过版才知道**，所以行分两种：该月已排进书里 → 印「第 N 页」、点它直接翻；
      还没排 → 印「未展开」、点它先按需推宽再翻。不为了印页码把全量先排一遍。
    - **书口年份染色带**改按**已加载全量的条目数占比**（原先按页码占比）：它是给整本日记看的
      缩影，按页码算会随窗口边长、且与索引纸列出的月份对不上。
    - **检索**判命中改成现算 `entryBlockHTMLs` 的块文本（沿用原先的块级排除：媒体 / 信封 / 日戳
      不参与），命中按**则**计；跳命中时若在窗口外，先推宽再跳。**不看已上屏 DOM**——否则搜老词
      会被判成「整本册子都翻了，没有「X」这个词」（窗口外那 1200 多则根本没搜）。
    - **台历**的「当天几则」与跳日一律走 `visibleEntries()`：原先标记读未过滤的 `entries`（筛选态下
      标着有、点下去说「那天没落笔」）、跳日扫 `pages`（窗口外那天同理）。
    - 「**按需推宽**」是一个共用原语：`revealEntry(eid)` = 把窗口推到盖住目标 → `relayout(false, true)`
      钉住当前页 → 定位该则所在页 → 翻过去。成本 O(目标在 `all` 里的位置)，只在**用户真点过去**
      那一刻发生；跳最旧那一则就是排全量一次。**不**改成「后台一路排到全量」（那会持续重排、
      把正在读的那一页反复重建），**也**不改成滑窗（页码 / 书口年份带 / `keepPage` 保位都要重做）。

## 不做的

- **不引虚拟滚动**（`Clusterize.js` / `@tanstack/react-virtual`）：820 / 1443 规模下
  `content-visibility` 已让浏览器跳过屏外 layout/paint，虚拟化属过度工程。条目破万或单卡极重时再议。
- **不做设置项**：首屏数量与批粒度固化在 `src/cinema/state.ts`、`src/diary/config.ts`、
  `src/core/paging.ts`，不给调节权。
- **不改写层**：`store.ts` 的 `read` 保持（读后要写回）。
- **本次不做「轻元数据全量索引」**：即把日历标记「当天几则」与 `getYearRange` 改成由日记文件名
  `YYMMDDHHmm` + 影视/书/信 frontmatter 全量推算（不读正文）。**决策 12（回修）已把索引/检索的
  数据源从「排版窗口」抬到「已加载全量」**，但**没有**做「不读正文就算出月份/年份」这一层：
  所以索引/检索仍随后台读盘**逐步变准**，过渡窗口 = 后台读盘期。要彻底消掉这个过渡窗口
  （开册那一刻索引就是全的），得让索引不依赖正文读取——按文件名推算，属另立 issue 的事。
- **不接「下一处命中」入口**：检索命中集按 eid 存、`nextHit` 也留了轮转计数，但界面上没有推进它的
  动作——改动前就只跳第一条命中（决策 12 只改检索的**口径**，没改这条）。本次只收掉「跨窗跳转会把
  检索态冲掉」这处耦合：`relayout` 会把 `this.search` 换成空态，而跳窗口外的命中必然走 `relayout`，
  于是 `nextHit` 在跳转后把检索态续回（见回修 2026-10-03）。**新增交互入口属产品决定**，不在本次。

## 后果

- **影院**首次打开：壳 `appendChild` → **同步扫描**（820 次纯内存查表，几十毫秒）→ **只拼 20 张卡**
  上屏 → 空闲逐批 50 张补至全量；打字中或刚滚过先让路，手一停续上。二次打开走同一条路（重扫
  一次，不依赖旧快照）。冷启动（metadataCache 未就绪）出**骨架页**，就绪后重扫出卡。
- **日记本**首次打开：书桌壳先可见 → 影视 / 信 / 书（只读 frontmatter，便宜）与日记正文
  （`cachedRead` + 50 并发 + 批间让出）**并行** → 够 30 则即成册 → 其余后台续读、**不重排**；
  直到用户翻到书尾才整窗续叠一批。缓存命中（二次开册）直接全量成册，不出骨架。
  索引 / 检索 / 台历**按已加载全量**认账（决策 12）：点中窗口外的月份 / 命中 / 那天，按需推宽
  再跳，所以「后台还在读」与「用户已经能用索引找东西」两件事互不阻塞。
- **已知代价**：① 日记光箱「下一张 / 上一张」只在**已加载**条目内轮转（窗口外未上屏时不在
  轮转序列里）；② 书尾续叠是一次**整窗重排**（`paginateFlow` 重跑 + StPageFlip 整实例重建），
  成本 O(窗口) 且只发生在用户主动翻到书尾那一刻；③ 影院的后台刷新（vault 事件 / 豆瓣逐部落盘）
  仍走**同步**扫描——纯内存、几十毫秒量级；若日后条目量涨到扫描进秒级，再考虑分片让出。
- **门禁口径**：本次改到 `core`（新增 `paging.ts`）⇒ 增量选择器自行升格为全量。
  原型产物（`prototypes/**`）按仓内既有口径**在主仓库重出**，不在 worktree 重出。

## 回修

- **2026-10-02 · 书尾判据（决策 6 的缺陷修正）。** 原实现把「翻到书尾」落成
  `this.cursor < this.pages.length - 1`。**偶数页数**下跨页最后一跨是 `[n-2, n-1]`、库报回来的
  左页号止于 `n-2`，该条件恒成立 ⇒ 续叠一次都不触发。真机症状：日记本翻到首屏那批的末页就翻不动，
  后台读进来的一千多则再也出不来（正是 issue 539 的验收 5「翻到书尾 → 窗口推宽一批」失效）。
  修法：判据抽成纯函数 `lastReachableCursor(pageCount, single)`（决策 6 括注）。测试配
  4 条纯函数用例（单页 / 跨页奇 / 跨页偶 / 空书）+ 1 条控制器级复现；**夹具（30 则窗口）实际排出
  59 页即奇数**，旧判据在里面碰巧成立，故偶数页数那一支必须显式构造，不能靠夹具。

- **2026-10-03 · 索引与检索改吃「已加载全量」（决策 12）。** 用户报回：「其余数据后台不阻塞加载，
  而不是翻到某页才加载，会导致索引和搜索失真」。核到的三处失真都是同一个成因——**读的是「已排版的
  窗口」，而不是「已加载的全量」**：① `monthMarksOf()` 拿书页汇月份 ⇒ 窗口外的月份整行消失，
  且表头「凡 N 则」是全量、「M 个月」是窗口，自相矛盾；② `runSearch()` 遍历 `this.pages` ⇒
  搜老词会弹「整本册子都翻了，没有「X」这个词」；③ `jumpToDay()` 扫 `this.pages` ⇒ 台历标着
  「那天有 N 则」（标记读全量）却回「这一册里，那天没落笔」。另有一处同族：`renderCal` 的
  「当天几则」读未过滤的 `this.entries` ⇒ 筛选态下标着有、点下去说没有。
  修法见决策 12。**影院不动**：`getDisplayItems()` 本就吃全量 `M.items`，侧栏计数与搜索命中集
  都不受渲染窗口影响（ADR-0231 决策 3），只有渲染是窗口化的。
  测试配 4 条控制器级用例（索引列全量月 / 点窗口外的月 / 检索命中窗口外那一则 / 台历跳窗口外那天）
  + 1 条筛选态台历标记 + 3 条 `monthIndex` 纯函数；**都做了证伪**：把口径退回窗口时逐条变红
  （`expected 1 to be 3` / `expected '4' to be '1'` 等）。
  `monthMarks(pages, entries)` 与只服务它的 `pageDateOf(pages)` 随之无消费者，一并删除
  （它们的「页码口径」已被 `monthIndex` + `pageOfMonth` 取代）。

  **评审跟进（同日）**：三条 P2 收口——① `nextHit` 跨窗跳转后把检索态续回（`relayout` 会换掉
  `this.search`；不续回的话将来接「下一处」入口会从第 2 条起就断）；② 检索命中若真落不到页上，
  改为与索引行同口径地说一句「这一则翻不到页上」，不再静默；③ 修正用例夹具注释里「窗口恰是
  整个 3 月」的差一天（`seedManyEntries(90)` 的窗口实为 3/31…3/2，2026-03-01 落在窗口外）。
