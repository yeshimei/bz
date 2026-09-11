# review-fix-followup — 收尾批 5 条修复清单（2026-09-12）

worktree：`../.dsh-worktrees/sweep-followup`（分支 `fix/sweep-followup`，基于最新 master）。
门禁：`pnpm exec tsc --noEmit` 0 错误；全量 `pnpm test` 286 文件 / 4430 例全绿；diff 自审完成。

| 编号 | 位置 | 状态 | 一句话说明 | 测试文件 |
|---|---|---|---|---|
| A（D4 diary 半边） | `src/diary/ui/repair-modal.ts` runFix | 已修 | 修复读改写包进与目标文件同路径的 `enqueueFileTask` 队列任务，与 diary 写层/encrypt mergeDiaryBlock 同路径 FIFO 互斥（与已修的 encrypt 侧同队列语义成立），修复不再被旧快照全量重写交错抹掉；同步移除 D3 直写守门白名单过期条目（写已入队，按守门契约收编） | `tests/diary/ui/repair-modal.test.ts`（D4 回归 2 例：写层 addEntry 排队在后、encrypt 同形状裸写方互斥） |
| B（补扫 cinema P2） | `src/cinema/recommend.ts` runAIPage | 已修 | refine（补问轮含第二次 AI 往返）期间保持 `aiRunning=true`，翻 false 推迟到结果/错误落定后——AI 页不回落待机 guide、重入守卫不失效（不触发第二次并发 AI 双倍 token）、两轮结果不互相覆盖 | `tests/cinema/recommend.test.ts`（补问往返挂起期间 aiRunning=true + 重入拦第二发 + 两轮结果合并） |
| C（补扫 cinema P3） | `src/cinema/ui.ts` openRandomMovie | 已修 | 面板已开时补 `renderAll(app)` 再 openDetail（对齐 openCinemaAnalysis「已开则 renderAll」样板），详情弹窗不再叠在旧 ai/stat 页上 | `tests/cinema/ui.test.ts`（已开停在分析页：整刷回落列表页再叠详情；冷开口径不变） |
| D（补扫 home P3） | `src/home/entry-editor.ts` blur 监听 | 已修 | window blur 兜底监听挂 AbortController signal，模块级记录最近一次 mount 的控制器、重建时 abort 旧的，window 上不再逐次叠加 | `tests/home/entry-drag.test.ts`（重 mount 后旧 signal aborted、每次 mount 恰一份、最新兜底仍收尾拖拽） |
| E（补扫 home P3，待验证项） | `src/home/entry-editor.ts` 触屏手势 | 证实并已修 | 代码推演证实：touch-action 在手势起点一次性裁决，进行中手势中途改它不生效——pointerdown 锁 none 后「短滑 endDrag 交还滚动」不可达，移动端可见行上短滑成死手势；改为不抢 touch-action，挂非 passive touchmove 仲裁滚动归属（未 armed 放行原生滚动，armed 后 preventDefault 拦滚动起拖）；jsdom 无法复现浏览器手势裁决，自动化测试钉新契约（不动 touch-action、短滑不 preventDefault、armed 后拦、松手放行） | `tests/home/entry-drag.test.ts`（原「pointerdown 置 none」两例按新契约重写 + armed 拦滚动/短滑放行两例） |

## 随批重出产物
- `node scripts/build-preview.mjs`：preview-freshness 守卫报警后重出（`prototypes/{cinema,home,memo,pomodoro,settings-panel}/prototype-behavior.js`、`prototypes/pomodoro/prototype-render.js`；其中 pomodoro-render 为基线既有陈旧，本次一并归绿）。
- `tests/core/d3-write-gate.test.ts`：移除 `src/diary/ui/repair-modal.ts` 白名单条目（A 修复使写入队列区域，条目按「失去命中即过期」契约移除）。
