# review-fix-media.md — 书影阅家族（G1-G12）修复批报告

分支 `fix/sweep-media`（worktree sweep-media，基于最新 master 09ce3fb9）。基线：tsc 0 错误、273 文件 4300 测试全绿（含本批新增用例）。preview-freshness 因四域源码改动重出 prototypes 快照（`node scripts/build-preview.mjs`，仓库惯例）。

| 编号 | 位置 | 状态 | 说明 | 测试文件 |
|---|---|---|---|---|
| G1 | `src/review/app.ts`（markReview 门禁 + onPassed）× `src/review/sprint.ts`（passNote 消费） | 已修 | 门禁放行条件对齐 roundQueue（`!isEarlyDue && !isDueToday` 才拒，今日到期时刻未到的「已提前纳入本轮」条目评级放行写盘）；onPassed 按 lastReviewed 变化检测真正写盘，未写盘返回 undefined；sprint 结果卡不再回退快照旧排期展示假「下次 1 天后」 | tests/review/app.test.ts（G1 门禁放行 + 旧「未到期」用例改未来日历日）、tests/review/sprint.test.ts（G1 结果卡两用例） |
| G2 | `src/review/sprint.ts`（handleKey） | 已修 | 焦点在 `.bz-sprint-opt` 上按 Enter/空格：document 层 handleKey 直接放行（选项自身 keydown 已作答），不再双命中跳过答错反馈/解析、末题直接结算 | tests/review/sprint.test.ts（G2 回归） |
| G3 | `src/review/quiz-core/manager.ts` × `session.ts` | 已修（验证属实） | quiz.json RMW 收编 `enqueueFileTask`（新 `mutateQuiz`，fn 返回 false 跳过写盘保「无改动不写盘」语义）；ensureQuestions 批量写回/fallback 逐篇/updateQuiz 清理全部走 RMW 基于磁盘现值合并——AI 长耗时窗口内并发删题不再被陈旧快照覆盖复活 | tests/review/quiz-core/manager.test.ts（并发串行 + 无改动不写盘）、tests/review/quiz-core/session.test.ts（在途删题竞态端到端） |
| G4 | `src/review/render.ts`（sortColumn × queueViewHtml） | 已修 | sortColumn 增 `w` 参数透传 ctx.w，列内排序与卡片 R 展示同权重源（当前 FSRS.R 不读 w，行为等价，属口径对齐——防未来 R 引入 w 依赖时排序漂移）；另补 render 纯层测试文件 | tests/review/render.test.ts（新建，3 用例） |
| G5 | `src/review/quiz-core/generator.ts` | 已修（验证属实） | 批量提示词示例键不再用自造 `noteId1`（改为 `<笔记ID>` 占位 + 强调逐字复制真实路径）；generateBatch 返回键归一（剥「笔记ID:」前缀/去空白后须命中已知 id，否则丢弃）——垃圾键不写库、「已为 N 篇生成」不再假成功 | tests/review/quiz-core/generator.test.ts（提示词断言更新 + 归一两用例） |
| G6 | `src/cinema/index.ts`（ensureCinema） | 已修 | 目录同步提到幂等闸门外，每次 ensureCinema 经 `resolveCinemaFolderPath()`（唯一单源）刷新 M.folderPath——会话内改「影视文件夹」立即生效，与日记本口径一致 | tests/cinema/index.test.ts（G6 回归） |
| G7 | `src/cinema/ui.ts`（markStatus） | 已修 | 快速标记先记 status/rating/watchDate 快照，persistItem 失败回滚内存（saveEdit 同法），面板不再与磁盘相反 | tests/cinema/ui.test.ts（G7 回滚） |
| G8 | `src/cinema/ui.ts`（openConfirm）× `douban-queue.ts` | 已修 | 新增 `dequeueDoubanFetch(path)`：未开始条目移出队列、pending 撤销；取消集合让在抓条目完成后不记失败——删除影片不再十几秒后弹「获取失败」且「重启后自动重试」文案不实。附带：shutdownDoubanQueue 重置 pumping（旧 pump 挂死在永完不成的 spawn 时新会话可重新泵） | tests/cinema/douban-queue.test.ts（G8 两用例） |
| G9 | `src/cinema/analysis.ts`（想看清单行） | 已修 | `it.douban` → `it.doubanRating`（wantList 条目是原始 CinemaItem，无 douban 字段）——豆瓣评分恢复显示 | tests/cinema/analysis.test.ts（G9 回归） |
| G10 | `src/reading-report/index.ts`（navHeatmap） | 已修 | 末尾同步 ‹ › 两按钮 disabled——点一次 ‹ 后 › 不再永久失效回不去 | tests/reading-report/index.test.ts（热力图用例内补断言） |
| G11 | `src/bookshelf/notes-ui.ts`（showEpubBookNotes） | 证伪 | 严格推演 + vitest 实证：uiModal.close 同步 remove 壳、showEpubBookNotes 开新书必先关旧壳、每壳独享容器——旧书在途 async 后到只渲染进已随壳移除的孤立容器，块不可交互、onChanged 重开旧书盖新书的链路不可达。验证用例保留作行为锚（防未来壳复用重构引入真竞态） | tests/bookshelf/notes-ui.test.ts（G11 验证用例） |
| G12 | `src/bookshelf/notes.ts`（updateComment + deleteHighlight） | 已修 | vault.process 重放未命中（并发改动高亮原文）走失败路径返回 false + notice，不再「批注已更新」假成功关弹窗；deleteHighlight 同型假成功一并修（G12 同函数同形态，修法同源） | tests/bookshelf/notes.test.ts（G12 两用例） |

## 统计

- 已修 10 条：G1、G2、G3、G4、G5、G6、G7、G8、G9、G10、G12（11 条，G12 含 deleteHighlight 同型扩展）
- 证伪 1 条：G11（验证用例已固化行为）
- 未处理 / 产品拍板-移交：0

## 门禁

- `pnpm exec tsc --noEmit`：0 错误
- `pnpm test`：273 文件 / 4300 测试全绿
- preview-freshness：`node scripts/build-preview.mjs` 重出快照后通过（非部署构建）
- 未触碰任何 *.css；未改四域之外源码（prototypes 快照为构建产物重出）
