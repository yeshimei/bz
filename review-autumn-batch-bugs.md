# 秋季批审查报告 · bug 线（2026-09-17）

范围：秋季批 12 功能票 + 回归修复批 5 票涉及域（diary/belongings/pomodoro/clipbook/secondbrain/favorites/memo/review）。
基准：AGENTS.md 铁律 + docs/ui-design-manual.md + docs/ui-kit-manual.md + CONTEXT.md。
严重级：P0 丢数据 / P1 功能错 / P2 硬伤 / P3 瑕疵。

（审查进行中，逐节回填）

## memo（353 周期重复 / 354 清单 / 355 月历 + 修复批）

1. `src/memo/data.ts:241`（nextRecurDue data.ts:94-110）**P1** — 月末锚点跨代漂移：钳制后的 due 成为下代锚点，「每月 31 号」两代后永久退化成 28 号（yearly 2/29 同理）；commit 文案与 CONTEXT.md「锚定不漂移」不符。修法：completeItem 传递未钳制锚（recur 内记 anchorDay，或 nextRecurDue 返回 {due, anchor} 链式）。待验证：补「连两代完成 1/31 月重复」用例即复现。
2. `src/memo/ui.ts:961-970` + `data.ts:230-258` **P2** — 已完成周期条目「恢复未完成」后再完成会再生成一期，与首期下期并存重复。修法：restoreItem 检测链上已有未完成下期，提示或一并撤链。
3. `src/memo/data.ts:105` **P2** — days 小间隔且 due 落后超 366 周期时生成「过去到期」的下一期。修法：guard 耗尽后以 now 为锚兜底。
4. `src/memo/ui.ts:1499,1578-1581` **P2** — 编辑器把合法的 `kind:'days'` 回填进四档 uiChoice，保存被静默清 null。修法：days 无档时保存保留原值。
5. `src/memo/data.ts:73-85` **P2** — Unix 绝对路径 token（/etc/nginx.conf）被收编进清单词条。修法：含第二个 `/` 的 token 不收。
6. `src/memo/ui.ts:826-831` **P2** — 月历统计行翻到非当月仍显「今日 N 条」；伪场景/搜索滤空时「本月没有到期事项」文案失真。修法：非当月隐藏今日计数；空态文案附筛选上下文。
7. `styles.css:8244` + `src/core/styles.css:530` **P2（待验证）** — 编辑弹窗 80vh 封顶全链无 overflow-y，小屏多子任务时保存钮可能不可达。验证：375×667 加 8 行子任务。修法：.bz-dialog-body 补 overflow-y:auto。
8. `src/memo/ui.ts:933-941` **P3** — 幂等短路时 UI 仍无条件发 completed 域事件，行为流双记。修法：数据层返回是否实际完成。
9. `src/memo/ui.ts:679-687` **P3** — 已完成周期条目 meta 仍显「每周」标签，语义误导。修法：completed 不注入 recur 文案。
10. `src/memo/ui.ts:1016-1019` **P3** — 无 due 条目「排到选中日期」无入口。修法：默认 09:00 时刻支持排期。
11. `src/memo/ui.ts:1130` **P3** — 「移到选中日期」跨年时 sub 无年份有歧义。
12. `src/memo/ui.ts:998-1013` **P3** — postpone 周期条目静默改系列锚，无提示。

已核验无问题：幂等短路本体、逾期补完保星期时刻、清单全勾×recur 链式与重置不共享引用、取消勾选恢复、编辑同步、composer URL/24/7 边界、月历补位/3 条上限/跨月清选中/非法月防御、moveToDay 保时刻、postpone Date 进位、脏数据回落、checkup 镜像 16 字段一致、markup 全 esc 无 XSS、date-only 状态判断。

## memo（体验线）

1. `src/memo/render.ts:159` **P2** — composer `/词条` 语法零曝光，核心特性不可发现。修法：placeholder 轮换或聚焦浮提示。
2. `src/memo/styles.css:339-342` **P2** — 移动端月历 chip 7px 色点热区 16px<44px 手册下限、间距 2px<8px；点色点直开编辑器主次颠倒。修法：::after 外扩热区（域内有先例），点格看清单为主、chip 长按编辑。
3. `styles.css:92-97` **P3** — chip 长标题无省略号；「还有 N 条」无可点感。修法：ellipsis + hover 态。
4. `render.ts:317-320` **P3** — 统计行与头行信息重复且常驻；翻月时「今日」语义漂移。修法：并入 cal-head 或仅当月显示。
5. `render.ts:286-293` **P3** — 「回到今天」只翻月不选中。修法：同时选中今日。
6. `ui.ts:691-697` **P3** — 月历视图下 composer 仍在，录无 due 条目无去向反馈。修法：月历收起 composer 或保存提示。
7. `ui.ts:977-996` **P3** — 完成反馈链过长（父项完成+下期 toast+行为流三条）。修法：合并单条。
8. `render.ts:170-216` **P3** — meta 标签可叠 9 枚两行起，窄栏挤。修法：弱信息标签窄栏折叠。

已核验无问题：「还有 N 条」点击闭环、页签两端同源、空月人话、状态色 token、两皮肤兼容、「移到选中日期」出现条件、面板重开无残留。

## clipbook（358 阅读报告 + 修复批）

1. `src/clipbook/flow.ts:244`（+76-91、ui.ts:1080-1082）**P1（功能口径近 P0）** — 「打开即已读」主动线时长系统性不入账：markReadOnOpen 异步续断点的 flushReadingSession 清零新篇刚开的计时器，此后该篇时长在切篇时以 total=0 丢弃；每篇未读条首次阅读（核心场景）全丢。修法：清零后若会话未结束重启 openedAt，或该路径不做尾置 flush。验证：点开未读停 2 分钟切篇查 readLog。
2. `src/clipbook/ui.ts:1390-1402`（+376/426/483）**P2** — 移动端详情动线完全不计时（不走 setReadingSession/pause/flush），移动 readLog 近乎恒空，而移动头行有「报告」入口承诺。修法：openMobDetail/closeMobDetail 接入同一套会话计时。
3. `src/clipbook/report-ui.ts:47-53`（+140-146）**P2** — 弹层重入时旧「正在统计…」常驻 toast 泄漏（activeProgress 易主致 finishAbort 不回收）。修法：openClipbookReport 先 releaseProgress（对照 reading-report index.ts:66-73）。
4. `src/clipbook/render.ts:359-361` **P2（待验证）** — 验收写「周期切换（本周/本月/自定义）」实现只有两档，Resolution 未记录裁自定义。修法：查拍板记录，无则补齐或回填口径。
5. `report-ui.ts:49` **P3** — 开报告 fire-and-forget flush 后立刻读旧侧写，刚读段本次不显示。修法：flush 暴露 promise await。
6. `render.ts:176-179` **P3** — rail 脚注入口 chevron 图标永不兑现（railFootEl 无 mountIcons）。修法：赋值后补 mountIcons。
7. `render.ts:176` **P3** — 入口 role=button tabindex=0 无 Enter/Space 键处理，假可达。修法：补 keydown 或去 tabindex。
8. `flow.ts:90` **P3** — readLog 写盘失败静默丢段。修法：失败段暂存下次补写。

已核验无问题：readLog 容错解析、180 天/5000 上限、去重篇数/时长求和/周期界、本期空态短路三路、事件委托契约、seg 高亮同步、ESC/遮罩/关闭钮三路、renderSeq+alive 作废、unload 顺序、移动 mtop 规范、命令/smoke 锚、XSS 面、串行队列、flowSave 时序。

## clipbook（体验线）

1. `report-ui.ts:174-178` **P2** — 本期没读时复用「还没有阅读记录」文案，用户误以为数据丢了。修法：区分「还没有记录」与「本周/本月还没读过 · 切到本月看看」。
2. `render.ts:376-382` **P3** — 空态未用 core uiEmpty 标准件（手册 §8.3 要求空态带动作；自造 empty 正是上次图标失控根因）。修法：改 uiEmpty + 动作。
3. `report-ui.ts:140-143,190-197` **P3** — 秒开场景仍双 toast 偏噪。修法：小数据量（<500 条）跳过 toast，与 reading-report 同判据。

已核验无问题：入口三通道、报告层级段序、formatMinutes 人话、分段懒生成与 reading-report 同构、周期切换零 IO、错误人话页、域皮肤一致性、原型指纹同步。

## secondbrain（359 对话收编 / 360 本周知识动态 + 修复批）

1. `src/secondbrain/weekly-ui.ts:147,149` **P1** — 周报弹层遮罩永不显示（ensureModal 只 appendChild 未置 display:block），「遮罩点击关闭」是死代码，点弹层外落到下层主面板。修法：show/close 补 mask display 切换（对齐 chat-panel.ts:132）。
2. `src/secondbrain/weekly-ui.ts:132-136` **P1** — 复用重开不重发 z 号，主面板重开后弹层被面板遮罩盖住「点了没反应」，ESC 先关面板才露出。修法：ensureModal 首开与复用统一 topifyZ(mask, popup)。两 P1 同处一并修。
3. `src/secondbrain/store-file.ts:148` **P3** — normalizeWeekly 接受 lastRunAt≤0，自动聚合永久 not-due。修法：≤0 按 null 冷启动重立基线。
4. `src/secondbrain/store-file.ts:353-355` **P3** — Syncthing 合并 knownPaths 只取获胜侧，败侧独有存量下轮被误报「新增」。修法：knownPaths 取两侧并集。
5. `src/secondbrain/weekly.ts:244` **P3** — 时钟回拨后摘要区间倒置渲染。修法：since=min(prev.lastRunAt, now)。
6. `store-file.ts:154-157` **P3** — knownPaths 无上限（核为可接受，补段注释即可）。
7. `weekly.ts:232-238` **P3（待验证）** — 空库立基线后首次向量化全库被误报「新增」。修法：空索引延迟立基线或空 knownPaths 视同 baseline。
8. `weekly-ui.ts:52-78` **P3** — 卸载撤不掉在途聚合 promise，卸载后 notify 仍弹。修法：generation 旗标。

已核验无问题：359 透传链路（signal/onDelta 逐行为一致）、四调用方归宿、provider 失败人话、旧单例零残留、模型语义一致；360 周界含等号/回拨不误跑、撞车阈值边界、调度幂等与 unload 完整、ESC 层级先周报后面板、移动端 mtop 同构无桌面副作用、成本护栏。

## secondbrain（体验线）

1. `weekly-ui.ts:110-112` **P3** — 通知文案「·」连接违文案规范③。修法：自然句。
2. `weekly-ui.ts:268-279` **P3** — 列表只显前 30 条无截断提示（撞车节有脚注，不一致）。
3. `render.ts:383` **P3** — 撞车行「整行不跳转」注释与委托行为矛盾（点箭头跳的是新笔记）。修法：data-path 只留名字段。
4. `weekly.ts:272` **P3** — 空轮后入口卡长期回放旧区间。修法：前缀「最近一份」或超 14 天隐藏。
5. `CONTEXT.md:222` **P3** — 词条未同步 issue 360（weekly 段/命令/形态）。修法：补一句。
6. `mobile-panel.ts` **P3** — 移动端参考抽屉无周报入口，只能命令面板。修法：抽屉工具行补钮或接受单入口。

已核验无问题：头行入口形制/锚、信息层级（撞车卡置顶）、空态与静默门、--sb-* token 明暗双皮、跳转兜底人话、AI 失败降级。

## favorites（363 + data.json 修订）/ review（361 拟合 / 362 做题面板）

### favorites（全 P3）
1. `src/favorites/ui.ts:963-968` P3 — 改名先 bulk 后 saveTags，落盘抛错时条目与定义脱钩。修法：失败反向 bulk 回滚。
2. `src/favorites/data.ts:159-162` P3 — type===from 但 tags[] 不含的脏条目不被 bulk 触达。修法：条件改 or。
3. `src/favorites/data.ts:116-147` P3 — 迁移双入口（app.init/设置面板）可并发。修法：入 enqueueFileTask 或 in-flight promise。
4. `src/favorites/config.ts:78-80` P3 — newTagId 毫秒时间戳同毫秒重复。修法：加计数器/随机后缀。
5. `src/favorites/shared.ts:94-96` P3 — hueOf('') 恒红。修法：空 label 返回中性色相 210。
6. `src/favorites/config.ts:49-55` P3 — getTags 运行时缓存不感知外部改 data.json。修法：注释言明或重播种。
已核验：迁移幂等/坏 JSON 留档/失败保旧件/键优先级/GitHub 特判（data.test.ts:133-231 锚定）。

### review
1. `src/review/fit.ts:105,186` + `fsrs.ts:7,118` **P2（既有缺陷，ticket 174 起）** — W_BOUNDS[4]=[0,1] 与 DEFAULT_W[4]=4.93 冲突：拟合落盘后 D0 从 4.93 钳到 ≤1，间隔系统性变长且似然够不到真值。修法：w[4] 上界放宽 + D0 同口径。
2. `src/review/fit.ts:182,234` + `app.ts:267` **P2** — 拟合纯同步 CPU 每 10 次评级最多 ~3s 主线程冻结。修法：maxMs 降 ~800 或分片让出。
3. `src/review/quiz-panel.ts:89,126-129,171,233-271` **P2** — 关面板只 hide 不取消 in-flight startSession，AI 完成后题面强行弹出；unload 时序更差。修法：cancelled 标志 + await 后检查。
4. `quiz-panel.ts:247` + `quiz-core/session.ts:141-142` **P2** — 「全部」范围单次 AI 调用拼整库全文必超 token/超时，降级成数百次串行。修法：面板侧按批（10 篇）循环。
5. `src/review/data.ts:227-233` P3 — loadFittedParams 不校验有限数，脏值致 markReview RangeError。修法：isFinite 校验+逐维钳制。
6. `quiz-panel-data.ts:59` P3 — 单篇范围不校验存在性，误导提示。修法：过滤空路径。
7. `quiz-panel-data.ts:69-74` P3 — 逐篇 loadQuiz O(N) 次读文件。修法：循环外一次。
8. `quiz-panel.ts:296-298` P3 — 会话在途重开命令静默 no-op。修法：notice「做题进行中」。
已核验：19 维越界不可能落盘、NaN/Inf 防御、v1 文件零迁移、三护栏、round-robin 截断、AI 引导框、ESC 让位、onComplete 三路幂等。

## favorites/review（体验线）

- favorites：① 标签管理入口只在设置面板，面板内不可达（P3，磁贴行尾加「管理」钮）；② 9 类 seed 是作者个人分类（pi/酒馆），新用户困惑且无「恢复默认」（P3）；③ 零计数新标签不显示添加无效感（P3）。
- review：① 档位 chips「全参拟合」是天书（P3，改人话+title）；② 按文件夹未选时 meta 文案与上方矛盾（P3）；③ 成绩小结缺「错题留在题库」去向说明（P3）；④ 中途放弃弹「正确率 0%」像考砸（P3，total=0 改「未答题已保留」）。
- 待验证：迁移双入口竞态无并发测试；整库出题规模上限无测试。

## belongings（356+修复）/ diary（352）/ pomodoro（357）

### belongings
1. `src/belongings/report.ts:480` P3 — 陪伴榜日均无千分位与其他金额不一致。
2. `report.ts:485` P3 — 陪伴榜段注写死「截至年末」，当年实际是截至今日，文案与数据不符。
3. `report.ts:78-88` + `ui.ts:527` P3 — 报告持一次性快照，空态「记一笔」保存后报告仍显示空。修法：保存回调重入 openBelReport。
4. `report-stats.ts:224-225` P3（待验证）— 购入日=截止日时 days=0 日均回退全价。修法：显示 '—' 或按 1 天计。
已核验：as-of 边界、快速翻年竞态、ESC 链 z 序、KPI 与筛选无耦合、回血口径、暗色守卫全覆盖。

### diary
1. `src/diary/ui.ts:109-112` P3（待验证）— memoryExcerpt UTF-16 码元截断，emoji 代理对跨 63/64 位截出乱码。修法：[...flat].slice().join('')。
2. `ui.ts:1084-1087` P3 — 「（已加密）」分支现行链路不可达且零测试。修法：补直测锁行为防泄漏。
已核验：已删文件防御、加密正文双保险不泄漏、空态、跨年排序、不开灯箱、原型单源。

### pomodoro
1. `src/pomodoro/ui.ts:507-514` P3 — 固化 save 失败时内存已裁盘上未裁，重载重复入账；且 void openPomodoro 链上 unhandled rejection。修法：先落盘成功再改内存态。
2. `src/pomodoro/data.ts:92-119` P3 — normalizeArchived 不验真实日期（2026-99-99 常驻）、同周重复行不去重期间双计。修法：按 week key 去重 + Date 反解校验周一。
已核验：跨年周归属、主路径幂等、不足 6 月、损坏归一、tab 重建键、全空 no-op、卸载复位。
