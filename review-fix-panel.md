# review-fix-panel：面板/入口/归物（settings-panel + home + belongings）修复收口

来源：`review-all-bugs.md` 第六节 H1-H20。分支 `fix/sweep-panel`（worktree sweep-panel，基于最新 master）。
门禁：`pnpm exec tsc --noEmit` 0 错误；三域相关测试 147 条全绿（新增回归 19 条）；全量测试除「原型产物新鲜度守卫」外全绿（见末尾说明）。

| 编号 | 位置 | 状态 | 说明 | 测试文件 |
|---|---|---|---|---|
| H1 | `src/settings-panel/renderer.ts` | 已修 | 域内 SpCommitWarn（比照 core CommitWarn 语义逐字收口）接入 text/textarea/number/path 四分支，落盘点 fire；备忘录场景列表（textarea 钩子）等恢复生效且有重载提示 | tests/review-fix-panel-a.test.ts（2 条） |
| H2 | `src/settings-panel/renderer.ts` | 已修 | renderPanelSchema 按 core ticket 170 同口径合成：组内首个键直绑 toggle = 组级父项，isChild 行显隐与自身 visibleWhen 取与（encrypt 预览三行回归） | 同上 |
| H3 | `src/settings-panel/ui.ts` | 已修 | open() 桌面已开分支：重绘导航 + renderDomain 落到深链域 | 同上（H9 场景间接覆盖深链重绘） |
| H4 | `src/settings-panel/renderer.ts` | 已修 | select closeMenu 还原组卡 overflow 前先查本组是否还有打开菜单，B 菜单不再被裁剪 | tests/review-fix-panel-a.test.ts |
| H5 | `src/settings-panel/renderer.ts` | 已修 | toggle/select/choiceCards 改「先写后翻 UI」：绑定写入抛错不翻显示值、弹「设置写入失败」 | 同上 |
| H6 | `src/settings-panel/renderer.ts` | 已修 | refresh 的 visibleWhen 求值包 try/catch（异常保守视为可见，与 ui.ts visibleItemCount 同口径），单行异常不再中断整轮 | 同上 |
| H7 | `src/settings-panel/dir-picker.ts` | 已修 | 目录扫描 catch 置失败态：「目录读取失败」+ 重试按钮，不再永挂「正在读取目录…」 | 交互路径由现有 dir-picker 测试回归兜底，失败态为纯层新增分支（代码审查） |
| H8 | `src/settings-panel/ui.ts` | 已修 | 移动端搜索空态 query 经 R.esc 转义，自注入 XSS 面关闭 | tests/review-fix-panel-a.test.ts |
| H9 | `src/settings-panel/ui.ts` | 已修 | 徽标 0 项口径统一为「—」（renderDomain 原「·」漂移点收口）；open() 已开分支重跑 preloadAllBadges，会话内改设置后重开不再吃首开快照 | 同上 |
| H10 | `src/settings-panel/renderer.ts` | 已修（待验证→证实） | 代码推演证实：存量脏 layout 值（如换版退役）会使 filter 全排除渲染空白卡组；修复为空时回退全量 options | tests/review-fix-panel-a.test.ts |
| H11 | `src/home/shared.ts` | 已修 | 预告卡「今日日记已写」分支去掉 `+1`（diaryStreak 已含今天，与未写分支/buildNotes 口径一致） | tests/home/review-fix-panel-b.test.ts |
| H12 | `src/home/ui.ts` + `state.ts` | 已修（待验证→证实） | 机制证实：collectRiver 为 async，聚合层未被内层兜住的异常会被 `.catch(() => null)` 吞成 null → renderAll 永挂骨架；新增 H.riverFailed，失败出「采集失败+重试」空态（uiEmpty+uiBtn），closeOverlay 清标记 | 同上 |
| H13 | `src/home/entry-editor.ts` | 已修 | persist 的 `.catch(() => undefined)` 改 notice「入口顺序保存失败…」 | 同上 |
| H14 | `src/belongings/ui.ts` | 已修 | 防叠开记录表单目标 id：同一物品保持聚焦；另一物品出 warning 提示，不再把 B 的内容误填进 A | tests/belongings/panel-fix.test.ts |
| H15 | `src/belongings/ui.ts` | 已修 | 两处 notifyUndo 回调体 try/catch：写盘失败 notifySaveError + 从盘回滚（防撤销补刀持久化） | 同上 |
| H16 | `src/belongings/ui.ts` | 已修 | 保存前校验出离日期（exitVal 或 today）不得早于购买日期，倒挂 fail 不落盘 | 同上 |
| H17 | `src/belongings/ui.ts` | 已修 | closePanel disconnect 主题 MutationObserver（cleanupBelongings 原有断开保留，幂等） | 同上 |
| H18 | `src/belongings/ui.ts` | 已修 | 新物品 id 拼随机后缀（`item_<ts>_<rand>`），同毫秒批量不再互相覆盖；ui.test.ts 原 `/^item_\d+$/` 断言同步放宽 | 同上 + tests/belongings/ui.test.ts |
| H19 | `src/belongings/data.ts` | 已修（待验证→证实） | 证实：顶层校验只拦 raw，`items` 为字符串/数组时拦不住（Object.values(字符串) 按字符拆、数组元素对象会派生垃圾分类）；补 typeof/Array.isArray 校验重置 | 同上 |
| H20 | `src/belongings/ai.ts` | 已修 | 分类合法但图标非法 → 保留分类、图标回退 AI_FALLBACK_ICON（'package'，在菜单内），不再「全有或全无」报无法解析 | 同上 |

## 统计

- 已修 20 / 已失效 0 / 证伪 0 / UI样式-跳过 0 / 产品拍板-移交 0 / 未处理 0。
- 【待验证】三条（H10/H12/H19）均验证证实后修复。
- 新增回归测试：tests/review-fix-panel-a.test.ts（9 条）、tests/home/review-fix-panel-b.test.ts（3 条）、tests/belongings/panel-fix.test.ts（7 条）。

## 遗留说明（非本组改动引入的部分如实标注）

- `tests/preview-freshness.test.ts`（原型产物新鲜度守卫）：master 基线本就挂 6 个（home/pomodoro/memo/settings-panel 原型产物与昨晚 home、pomodoro 功能提交不同步——合并前已存在，stash 验证确证）；本组改动净新增 1 个（belongings/prototype-behavior.js，因改了 belongings 行为层，属预期过期）。原型产物由构建生成，worktree 严禁 `pnpm run build`，合并回主仓库构建部署时统一刷新。
- H7 失败态分支无独立自动化断言（dir-picker 弹层依赖 core 路径聚合，现有测试以真实链路兜底），已代码走查 + 现有 34 条面板测试回归确认无破化。
