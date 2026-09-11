# 剪藏流家族修复批收尾（review-all-bugs.md 第四节 F1-F15）

worktree：`D:\Obsidian\.dsh-worktrees\sweep-clip`（分支 `fix/sweep-clip`，基于 master `09ce3fb9`）。
门禁：`tsc --noEmit` 0 错误；全量 274 文件 4296 测试全绿（基线 4280 + 新增回归 16 例）；
原型快照随源重出（`node scripts/build-preview.mjs`，仅写 `prototypes/`，非部署构建）。

| 编号 | 位置 | 状态 | 说明 | 测试文件 |
|---|---|---|---|---|
| F1 | `src/clipbook/loader.ts` × `news-data.ts` | 已修 | 被清理的超期条目 key 收进 `removeArticleKeys`，合并写按磁盘并集不再复活；二次装载不再反复空写 | tests/review-fix-clip.test.ts |
| F2 | `src/clipbook/ui.ts` × `flow.ts` | 已失效 | 每日简报已整体退役（afcfee40，ADR-0121）：briefs 段与假删除路径均已不存在 | — |
| F3 | `src/clipbook/ui.ts` + `flow.ts` | 已修 | `doMarkRead` 加 `st!=='unread'` 守卫；`markHandledAndBump` 对 `read===true` 不改写不计数——不重复计统计、不发重复 news:read、saved 态不被覆盖 | tests/review-fix-clip.test.ts、tests/review-fix-clip-ui.test.ts |
| F4 | `src/clipbook/ui.ts` | 已修 | clip 源分支重选 `M.cur` 后补 `renderReader`——搜索重选后右栏同步，不再「高亮 A 读 B」 | tests/review-fix-clip-ui.test.ts |
| F5 | `src/clipbook/flow.ts` | 已修 | `markHandledAndBump` 加 touched 守卫：条目未命中（守护刚清掉）不加统计、不空写 | tests/review-fix-clip.test.ts |
| F6 | `src/clipbook/news-data.ts` | 已失效 | `normalizeBrief` 随简报退役删除（全仓 grep 无），字段绞肉机不复存在 | — |
| F7 | `src/clipbook/ui.ts` | 已失效 | 「重新抓取本期」入口随简报退役删除，无该路径可触发误删 | — |
| F8 | `src/clipbook/news-data.ts` | 已修（证实） | `writeNewsDataMerged` 损坏（ok=false）直接 return 不落盘——代码推演证实以空库为基底会销毁「不清盘」现场 | tests/review-fix-clip.test.ts |
| F9 | `src/auto-summary/processor.ts` + `index.ts` | 已修 | 重试改走域队列 `retrySummaryWithAI`（复用 processingPaths 去重），force 语义与 AI 实例透传不变；processor←→index 环按规约函数级动态 import | tests/review-fix-clip-ui.test.ts |
| F10 | `src/attach/data.ts` | 已修 | md 链接剥尾标题（`path "标题"`）与尖括号路径（`<path with spaces>`）两种形态可收集；外链行为不变 | tests/review-fix-clip.test.ts |
| F11 | `src/pomodoro/ui.ts` | 已修 | reset 生效（`r.state !== prev`，forceFocus 拦下不写）即落盘——重启不再复活旧计时弹「番茄钟继续」 | tests/review-fix-clip-ui.test.ts |
| F12 | `src/pomodoro/ui.ts` | 已修（证实） | `applyAction` 内 paused 被清除即清 `autoPauseMain`——hidden 期间（popout 窗口等入口）resume 后再手动 pause，visible 不被静默续跑 | tests/review-fix-clip-ui.test.ts |
| F13 | `src/pomodoro/data.ts` + `ui.ts` | 已修 | 新增 `trimHistory`（近 7 个日历日，与 last7Days 同起点），save/initData 双接入——pomodoro.json 不再线性膨胀 | tests/review-fix-clip.test.ts、tests/review-fix-clip-ui.test.ts |
| F14 | `src/favorites/ui.ts` | 已修（证实） | openExternal 补 window.open 兜底 + 全失败「无法打开链接」提示——代码推演证实两层落空原为静默 | tests/review-fix-clip-ui.test.ts |
| F15 | `src/favorites/ui.ts` | 已修 | openForm 单例守卫：已存在表单先 `closeForm` 收掉，不再多层叠加 | tests/review-fix-clip-ui.test.ts |

统计：已修 12 · 已失效 3（F2/F6/F7，简报退役）· 证伪 0 · UI样式-跳过 0 · 产品拍板-移交 0 · 未处理 0。

提交：`git log --oneline` 见 fix(clipbook) 批修提交（src + prototypes 快照 + 两个回归测试文件）。
