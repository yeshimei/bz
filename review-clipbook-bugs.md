# review-clipbook-bugs.md — 剪藏本（clipbook）域 bug 线审查

- 日期：2026-09-13
- 方法：3 个只读审查代理并行（抓取侧 / UI 侧 / 存储状态侧），按 `bz-domain-review` 流程缩窄为单域
- 范围：`src/clipbook/` 全部实现源码约 4700 行（TS 19 文件 + styles.css 489 行 + prototype-render.js 孤本核查）
- 门禁佐证：`tsc --noEmit` 0 错误；`pnpm test` 300 文件 4619 测试全绿（审查期间基线）
- 总账：**新发现 32 条 = P1×2 + P2×10 + P3×20**；旧报告条目全部复核在位，1 条 open「待确认」已关闭

---

## 一、旧报告复核结论（review-all-bugs.md 第四节 F1-F8）

| 旧条目 | 复核结论 |
|---|---|
| F1 loader 清理条目复活 | 已修在位：`removeArticleKeys` 机制（loader.ts:64-71,83-88），同 key 幂等 |
| F2 简报假删除 | 已失效：简报整体退役（briefs 段不存在） |
| F3 重复计统计/覆盖 saved | 已修在位：`doMarkRead` 的 `st!=='unread'` 守卫 |
| F4 搜索重选右栏不同步 | 已修在位：clip 源分支补 `renderReader` |
| F5 markHandledAndBump 未命中加统计 | 已修在位：touched 守卫 |
| F6 normalizeBrief 字段绞肉机 | 已失效：已删除 |
| F7 移动端重新抓取本期 | 已失效：入口已删 |
| F8 writeNewsDataMerged 损坏落盘空库 | 已修在位：ok=false 直接 return（news-data.ts:256-259） |
| 【open】loader.ts:64-73 合并写窗口重推同 URL 误剔 | **已关闭：误剔方向不可达**。纯插件架构下唯一重推者 fetcher 只在快照无该 url 时新增，且 loader 的 W1 是唯一移除者、毫秒级执行；但同一读写窗口存在**反向真实风险**——fetcher 旧快照补集追加会复活刚被保留策略删掉的条目，即本轮新发现 C2 变体 c。 |

---

## 二、新发现

### P1（2 条）

**C1** `src/clipbook/ui.ts:591-595` | P1 | rail 源行动作的 source 映射三元链缺 `'site'` 分支，站点行落进 `{ kind:'all' }` 兜底
- 影响：站点行右键/长按「全部标为已读（N 篇）」实际查询口径是**全库未读**（`queryBySource` 的 all 仅过滤 `!a.read`），确认框却写「把"某站点"的 N 篇…」——N 是全库数、标签是站名，一次确认把整个未读流标读，批量路径无撤销、统计虚增。
- 修法：补 `sel.kind === 'site' ? { kind:'site', site: String(sel.site||'') }` 分支（移动端章头 ui.ts:1159 已是正确写法，两端对照可证为笔误）。
- 验证：rail 任一站点行右键，比较菜单项计数与该站未读数。

**C2** `src/clipbook/news-fetcher.ts:576,643,652-663`（配合 news-data.ts:269-281）| P1 | 抓取轮把「队列外旧快照的 articles 全集」声明为写意图，合并写"声明条目胜出 + 补集追加"会回退/复活网络窗口期内的所有并发用户写
- 机制：`runNewsFetchRound` 队列外读盘快照（:576）→ 四源抓取（窗口常态 10 秒到分钟级）→ `finalArticles = [...remaining, ...newArticles]`（:643）整集声明写盘（:652-663）。合并写对同 key 声明值胜出（news-data.ts:273）、对磁盘没有的声明条目追加（:275-281）。
  - 变体 a（状态回退）：窗口内用户标已读/已收/跳过 → 被旧快照未读版覆盖回退；stats 段未声明保留 +1，重标后再 +1（重复计统计）。
  - 变体 b（删除复活）：窗口内用户删单篇（removeArticleKeys）→ `remaining` 含该条 → 补集追加复活。
  - 变体 c（保留清理复活）：loader 保留清理删的超期条目同被复活。
- 这是旧 F1（已修）的**同类新变体**：病灶从 loader 换成 fetcher 的全量声明。守护进程退役（ADR-0008）后双写者变成「插件抓取 vs 插件用户」，"守护只增不改"前提不成立，全量声明不再安全。自动抓取挂 onload/openClipbook，抓完经 `onFetched→reloadIfOpen` 把回退态刷给用户——「边抓边读」是常态路径。
- 修法：抓取写只声明 `newArticles` + 窗口裁剪的 `removeArticleKeys`（未声明磁盘条目本就由合并写保留，`remaining` 无收益只有风险）；或把快照读取挪进串行队列与写紧邻执行。

### P2（10 条）

**C3** `src/clipbook/news-fetcher.ts:594-609,639-641` | P2 | allFailed 检测是死逻辑：四源把失败吞成空数组，`guarded` 只计抛错
- 影响：断网轮被当成功，`allFailed` 恒 false，lastFetchAt 照常推进 → 自动抓取被压满整个档位（30-360 分钟）不重试；手动抓取断网弹「已抓取，暂无新文章」假成功（:727-728）。
- 修法：列表级请求失败要进入 `failedSources`（httpGet 返回 null 时各源抛错或返回失败标志）。fetchZhihu:489 注释声称的"外层按失败源计数"契约实际不存在。

**C4** `src/clipbook/news-source-settings.ts:59-63,82-149` + `news-sources-group.ts:193-204,226-229,353-391` | P2 | news.json 损坏期间全部设置写静默丢弃且 UI 给假反馈
- 影响：writeSources/writeBilibiliMaxItems/writeBilibiliCookie/writeFetchInterval 遇 `!res.ok` 直接 return，字盒已改、磁盘未写、重开回弹；add 动作用同一 `false` 表达「已存在」与「读盘失败」误导；remove 先弹「已移除」成功后静默 no-op，重开复活。损坏是持久态（onCorrupt 不清盘），期间设置组永久失效无告警。
- 修法：写路径对 !ok 返回失败并 notice；remove 以磁盘写结果决定成功通知；add 返回值区分两义。

**C5** `src/clipbook/ui.ts:838,845,874-880`（配合 render.ts:230）| P2 | MarkdownRenderer 追加语义违规：剪藏正文懒加载路径渲染前容器非空
- 影响：`renderReader` 以「正在读取剪藏正文…」预填 `[data-clip-md]`，`loadClipBody` 读盘成功后不清空占位直接水合 → 正文**追加**在占位之后。每篇剪藏首次阅读正文顶部永久残留占位一行（AGENTS.md 铁律 6 违例）。
- 修法：水合前 `md.innerHTML = ''`（占位只承担"无正文"终态，不与水合共存）。
- 验证：重载插件后首次点开任一剪藏条目看正文首行。

**C6** `src/clipbook/ui.ts:847-850,872-880,1239-1242` | P2 | `bindImgFallback` 在异步水合之前执行，容器里还没有任何 img，之后插入的图片永远挂不上 error 监听
- 影响：issue 206「外链图加载失败由 JS 摘除」全链路失效（styles.css:257 注释承诺不再成立），断网/防盗链留裂图。
- 修法：水合完成、alive 校验通过后对容器补跑一次 `bindImgFallback`。

**C7** `src/clipbook/ui.ts:169-176,1197-1198,408-411` | P2 | 移动详情 overlay 的 DOM 显示态与 `M.mobDetailOpen` 不同步
- 影响：`openMobDetail` 置 `style.display='flex'`，`closePanel`/`selectSource` 只复位布尔不复位 DOM；移动端读完一篇 → 关面板 → 重开，直接落在**上次的详情屏**（旧正文盖住列表），须手动点返回。
- 修法：`closePanel` 内（或 `renderAll` else 分支）同步 `mobDetailEl.style.display='none'`。

**C8** `src/clipbook/ui.ts:906-914` | P2 | `stepArticle`（←→/jk）不感知搜索态与剪藏源
- 影响：搜索态按未读快照原序步进，可切到不在命中列表的条目且目录无高亮（列表与阅读区脱钩）；剪藏源 `dirFor().unread` 恒空 → j/k 静默无效。
- 修法：搜索态在 `M.list` 命中集内步进；clip 源按平铺列表步进。

**C9** `src/clipbook/loader.ts:48-55` + `ui.ts:131-137,1050`（news-data.ts:223）| P2 | news.json 损坏被静默吞掉，面板假空态【UI/抓取两代理独立发现，合并】
- 影响：`readNewsAndSidecar` 返回 `status:'corrupt'` 被 `loadIfNeeded` 丢弃，无任何通知；面板呈现「全部未读 0/0 · 暂无内容」假空态，用户误以为数据全丢。`PanelData.status`（ok/missing/corrupt）全仓零消费者，missing 分支实际死路（maybeFetchNews 预读已先建骨架落盘）。
- 修法：消费 status（corrupt 给 error 通知）；或删死状态。

**C10** `src/clipbook/save.ts:55-56` | P2 | 正文「剥 frontmatter」正则带 `m` 标志，正文含 `---` 分隔线时静默丢段
- 机制：`/^\s*---[\s\S]*?---\s*/m` 的 `^` 因 m 标志匹配任意行首，命中正文第一对 `---` 行，两条分隔线之间整段删除（已 node 复现：`intro\n\n---\n\n中段\n\n---\n\noutro` → `intro\noutro`）。:56 的 dataviewjs 围栏同病。
- 影响：保存到剪藏本的 .md 笔记正文静默缺段（news.json 原文仍在故 P2 不到 P0）。
- 修法：去 m 锚定串首 `/^---[\s\S]*?---/`，或按行解析 frontmatter 边界。

**C11** `src/clipbook/flow.ts:100-105` | P2 | skipped→saved 升级路径 byPlatform/byDate 重复计数
- 影响：常见动线「打开未读（byDate+1）→ 保存到剪藏本（升级路径 byDate 再 +1）」rail 脚注「今日已读」一篇计两次，平台分布同理；与 :87 注释意图相悖（totalRead 有 upgraded 守卫，分布桶没有）。
- 修法：`if (!upgraded)` 同时包住 byPlatform/byDate 递增；补分布断言测试（flow.test.ts:73 现有用例未覆盖）。

**C12** `src/clipbook/ui.ts:99,1330-1336` + `loader.ts:93` | P2 | 剪藏目录 `M.dir` 缓存不随设置面板变更刷新，读写路径不对称
- 影响：扫描用缓存 `M.dir`（仅 initPanel 与域内设置弹窗 onClose 赋值），设置面板域改「剪藏文件夹」后无任何通知机制——新保存落新目录，剪藏本源/site 聚合仍显示旧目录内容，重载也扫不到，直到开域内设置弹窗或重载插件才自愈。
- 修法：loader 直接用 `clipDir()` 删缓存，或 settings 变更处发域通知重设 M.dir。
- 验证：设置面板改剪藏文件夹 → 保存一篇 → 新目录有文件、面板剪藏本源无条目。

### P3（20 条）

**C13** `ui.ts:1191-1194,1233-1234` | P3 | 移动详情「第 X 则 / N」对未读条目恒失效：`queryBySource` 每次新建实例，`mobItemOrder.indexOf(a)` 身份失配返回 -1；已读/已收段（按 id 查）才正常。修法：统一按 id 查。

**C14** `ui.ts:793` vs `944-948` | P3 | 已读条目右键菜单仍提供「标记为已读」，点击被 `st!=='unread'` 守卫静默吞掉（无反馈）。修法：buildItemActions 对非 unread 不挂该项。

**C15** `ui.ts:646-653` | P3 | 剪藏源搜索零命中空态文案走「剪藏本为空」（news 源同态是「查无此条」），搜索态误报库为空。修法：searchKw 非空时用「查无此条」。

**C16** `ui.ts:217,394` vs `512-516` | P3 | 折叠态记忆两端不对称：桌面每次 beginSession 复位、移动 `expandedMobArch` 只在插件卸载复位，与「每次打开=新会话」相悖。修法：beginSession 一并 clear。

**C17** `ui.ts:581-583,1213-1216`（flow.ts:78-108）| P3 | rail 脚注「今日已读」在静默打开即读后不刷新：`markHandledAndBump` 只落盘不回写内存 `M.stats`。修法：完成回调补增量回写。

**C18** `index.ts:103` + `ui.ts:884-887` | P3 | `clipping:file-renamed` 只失效 `newPath`，缓存键是旧 path → 失效无效 + 旧键常驻内存。修法：rename 同时失效 oldPath。

**C19** `ui.ts:330-335` | P3 | ESC 只注册面板一个层级：移动详情屏按 ESC 直接关整个面板而非先返回列表。修法：escManager 层内先判 `M.mobDetailOpen`。

**C20** `ui.ts:408-411,1048-1059` | P3 | 详情开着且 refreshAfterAction 后 `M.cur` 变 null（当前条目被删）时 renderAll 不收起详情 overlay，残留已删文章详情屏（窄路径）。

**C21** `styles.css:225-241` + `render.ts:126-135` + `ui.ts:100-101` | P3 | 死样式/死代码：`.bz-clip-favchip`、`.bz-clip-art-flag`、`.bz-clip-dot` 及 `dotHtml/stateFlag` 零调用方；`M.isMobile` 赋值后无消费。随下次视觉迭代清理。

**C22** `src/clipbook/prototype-render.js`（整文件）| P3 | **陈旧孤本**：停在 issue 273 迁移前（`opts.paras`、缺 markdown-rendered 类、导出已退役函数、无源指纹头）；评审壳实际消费 `prototypes/clipbook/` 那份（有指纹、受 preview-freshness 守卫）。src 下这份无人消费、无守卫，误引用即拿旧 markup。修法：删除孤本并修正 render.ts:8 注释。

**C23** `news-fetcher.ts:42-47` + `news-sources-group.ts:299-311` | P3 | Promise.race 超时胜出后未中止的 requestUrl promise 若 reject 成为 unhandled rejection（控制台噪音）。修法：`req.catch(()=>{})` 兜底。

**C24** `news-data.ts:213-228` | P3 | readNewsData 把一切读异常（如 Syncthing 占用文件的瞬时 IO 错）归并为「损坏」→ 面板空态、弃写、设置写静默丢（放大 C4/C9）。修法：区分「读抛错（可重试）」与「损坏态」。

**C25** `news-sources-group.ts:238-279,400-439` | P3 | UP 主/RSS 管理弹窗无单例守卫，连点叠多层 overlay（各持 escManager 句柄），Esc 只关最上层、遮罩多层。修法：打开前检测 mask 存在即复用或 return。

**C26** `news-fetcher.ts:632-634,655-658` | P3 | 段级声明用旧快照拼整段：窗口期内 removeBilibiliUp 删掉的 UP 资料被复活（孤儿条目）；RSS feed 无 title 遗留数据可触发整段复活。修法：upInfo 只声明本轮 uid、titleUpdates 按条 patch。

**C27** `save.ts:22-23` | P3 | yamlEscape 不转义反斜杠，url/author/summary 含 `\` 时 frontmatter 值被 YAML 转义序列污染。修法：先转义 `\`。

**C28** `md.ts:15-20` | P3 | stripClipChrome 闭 `---` 按首次出现匹配，frontmatter 值含 `---` 时提前截断，右栏正文顶部露 YAML 残渣。与 C27 写侧同根因链（yamlEscape 不清洗 `---`）。修法：按行锚定闭合，或两处统一按行解析。

**C29** `flow.ts:172-189` | P3 | flowToggleReading 全仓零调用，写入的 articleOverrides.reading 已无消费者（'reading' 桶不再产出）。死代码可落盘侧写。修法：删除或标 @deprecated。

**C30** `data.ts:47-51,59-66` | P3 | updateClipbookData 写失败仍返回成功值（writeClipbookData try/catch 吞错，core jsonFileStore 本会照抛），调用方拿假成功，重载回跳。修法：write 失败上抛或返回带 persisted 标志。

**C31** `data.ts:9-11` vs `loader.ts:57-71` | P3 | savedArchive 段契约无写入方：docstring 承诺的「保留清理后防回落未读」保底语义不存在（全仓无写入方）。修法：loader 清理 saved 态条目时回填，或收敛注释视为遗留兼容。

**C32** `ui.ts:944-953,1207-1217` + `flow.ts:162-168` | P3 | 「打开即已读」落盘窗口内手动标读：flowMarkRead 的 emitReadEvt 不受 changed 守卫 → smartcat 行为流同篇重复喂 news:read；且 rawBefore 在 raw 被污染后拍摄，6 秒内撤销提示「恢复未读」实际仍已读。修法：仅 changed 时 emit；doMarkRead 守卫通过后重取磁盘态作快照。

---

## 三、已核验无问题（三代理汇总）

- **铁律合规**：通知正文无 emoji（均取 core/notice.ts ICONS 既有 type）；styles.css 无自造滚动条（无 scrollbar-width thin/auto、无自绘 thumb）；MarkdownRenderer 主路径（body 就绪/移动详情/纯文本兜底）合规——违例仅 C5 懒加载路径。
- **写队列与合并写**：per-path FIFO、失败不堵队列；全仓无绕过队列的 writeNewsData 直写方（grep 证实）；writeNewsDataMerged 损坏保护（F8）在位；enqueueFileTask 无重入死锁。
- **守卫在位**：doMarkRead 的 st!=='unread'、markHandledAndBump 的 touched/changed/upgraded、removeArticleKeys、flowMarkAllRead 只命中未读、空集不写盘不逐篇发事件。
- **撤销正向对称（正常路径）**：flowUndoHandled 逐桶回退；flowUndoDeleteNews 同 key 防重插；撤销删除剪藏按内容快照原路径重建。
- **卸载清理对称**：escHandle、搜索防抖 timer、clipBodyCache、panelResize/Split detach、模块级集合与 resetClipbookState 全复位；域事件由 main.ts:333 clearDomainEvents 统一回收，无跨生命周期泄漏。
- **抓取细节**：B站翻页上限/风控判定符合 ADR-0128；capRssWindow/pruneBilibiliWindow 纯函数口径正确（缺 date 保守保留、风控 UP 不裁、跨 feed 去重）；窗口裁剪走 removeArticleKeys 正确防自复活；articleKeyOf 口径一致。
- **save 链路**：覆盖确认 + 写前重查 + 失败不标已处理；B站分流回写防重复建任务；设置 path 输入 trim 同口径。
- **依赖方向**：域内 import 全部 core←clipbook 单向；对 knowledge 函数级动态 import（允许）、smartcat 仅 type import。
- **事件委托与层叠**：data-fold 优先于 data-id 不误触；外链放行先于「读下一则」；桌面 mob 层被 min-width:769 压住不漏出；data-src/data-id 经 esc 注入防单引号。
- **其他**：scan.ts created 解析失败回退（不抛 RangeError）；M.dir 赋值时序无错扫窗口；htmlToMarkdown 实体解码顺序正确；标题/URL 去重与守护口径一致；localDayKey/localDatetime 双实现口径一致；`prototypes/clipbook/prototype-render.js` 与 render.ts 逐字同步有指纹守卫。

---

## 四、修复建议分级

- **必修（P1+高危 P2）**：C1（一次确认全库标读）、C2（抓取窗口回退/复活用户写）、C5（铁律违例）、C10（保存丢正文段）、C3（断网不重试+假成功）。
- **建议修（其余 P2）**：C4、C6、C7、C8、C9、C11、C12。
- **可打包批修（P3）**：C13-C32，按「UI 交互 / 抓取健壮性 / frontmatter 链（C27+C28）/ 死代码清理（C21+C22+C29+C31）」分四包。

---

## 五、修复批收尾（2026-09-13，全量 32 条）

按域文件所有权分五组并行/串行修复，各组 worktree 开发 + 回归测试 + 独立提交，主线程串行合并 + 门禁。

| 组 | 条目 | 提交 | 备注 |
|---|---|---|---|
| UI 核心 | C1/C5/C6/C7/C8/C13/C14/C15 | `69f7d3a7` | 含 F3 旧用例同步（C14 拍板冲突）；9 条新回归 + 验红 |
| 存储数据 | C9/C10/C12/C27/C28/C30/C31 | `934bfaa8` | C12 连带清删 M.dir 缓存链（含测试辅助 setClipDir 改走设置 provider）；11 条回归 |
| 抓取侧 | C2/C3/C23/C24/C26 | `f2e46099`（合并 `f3a3555d`） | C2 按第一修法（只声明增量 + 窗口裁剪 removeArticleKeys）；C23 防御性加固（原生 race 未复现 unhandled）；349 行新回归 |
| 设置弹窗 | C4/C25 | `3eb6c3ff` | add 返回值四义（added/exists/invalid/read-failed）；remove 以落盘结果定通知；12 条回归 |
| UI 收尾 | C11/C16/C17/C18/C19/C20/C21/C22/C29/C32 | `bf0a1118`（合并 `9b921321`） | C18 确认事件载荷带 oldPath；C29 连带改写 4 处测试调用点；11 条回归逐条对抗验证 |

**处置统计：32 条 = 已修 30 + 部分保留 2（均在 C21/C32 内说明）**：

- C21 三处保留：`.bz-clip-favchip`（`enh-sweep-c` 断言其 font-size）、`.bz-clip-art-flag` + `stateFlag`（`walkthrough-fix-c` 与 `render.test` 存在性断言）、`.bz-clip-dot`（styles.css 本无该规则，报告行号段有误）；已删 `dotHtml`、`M.isMobile`、`src/clipbook/prototype-render.js` 孤本。
- C32 附带行为（拍板外补充）：盘面已是目标态的重复标读不再弹「已标为已读 + 撤销」假反馈，只刷新收敛显示。

**门禁**：最终树 `tsc --noEmit` 0 错误；`pnpm test` 308 文件 4734 测试全绿（含 preview-freshness 27/27）；`pnpm run build` 部署完成（main.js 产物差异提交）。

**工作流备注**：主仓库在修复期间被并行会话持续推进（diary 契约 v3、issue 304/305 首页时间线等），各修复分支合并前均对齐最新 master；三处原型行为包（clipbook/memo/settings-panel）冲突均以 `scripts/build-preview.mjs` 按最终源码重出解决。
