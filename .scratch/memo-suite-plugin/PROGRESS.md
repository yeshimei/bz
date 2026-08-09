# bz 进度（上下文压缩恢复点）

最后更新：2026-08-09（通知系统修订：显式类型 + emoji 图标 + 位置分端 + 连续任务单框），**788/788 全绿**。仓库 `E:/Obsidian/1`，构建产物直出 `E:/Obsidian/叫我包仔/.obsidian/plugins/bz/`。

- **flash vector-store 既有失败测试已删除**（用户决策）：增量刷新「文件删除清理条目」用例断言 `meta.notes` 清空但源码不清理（ticket 18 暂缓域的真实缺陷），长期挂红。删除后全量 775/775 零失败。缺陷本身仍存在（闪念实现时需修：refresh 应清理已删除文件的向量条目）。

- **ticket 25 通知系统（ADR-0010，grilling 会话 + 样式演示敲定；2026-08-09 修订）**：自绘 toast `src/core/notice.ts` 替代原生 Notice。**修订后**：类型显式指定 `notice(msg, type?, duration?)`（`classifyNoticeType` 已删，消息文本禁 emoji）；类型图标 emoji（info ℹ️/success ✅/warning ⚠️/error ❌/progress 转圈）；位置分端——桌面右上角右滑入（slide-right），移动端（max-width 768px）顶部居中下落入（drop）；dedupeKey 存活期单框合并（同键存活原地更新消息/可切类型/重置计时，已消失 30s 内不新弹防刷屏）；`duration <= 0` = 常驻。堆叠上限 5、点击关闭、错误 5s/其余 3s；动态 setMessage/setProgress（100 变绿、-1 跑马灯）/setType（progress→完成自动接管计时）/title+action；reduced-motion 降级。**连续任务单框约定**：review 复习循环（`_reviewNotice` 句柄 + review-loop 键）、review/quiz 批量出题（progress→success/warning）、auto-summary（auto-summary 键）、movie 海报——统一常驻单框动态替换。**测试**：`getNoticeMessages`/`hasNotice`/`clearNotices` 进 mock-obsidian-entry；`__resetNoticeForTests`（清 live/recent，resetObsidianMocks 内调用防 dedupe 窗口跨测试残留）。演示命令 `bz-notification-demo` 保留（13 场景样式自查）。注意：**edit 工具整批原子性**——一处 oldText 不匹配整批拒绝；脚本改文件时 CRLF 行尾会使 `$` 锚定失效，且 options 分支易丢闭合 `)`，改完必跑 tsc+vitest 校验。tsc 预存 9 文件错误清单（vector-store/extra 测试）仍未清零。

- **ticket 24 设置归属模型（ADR-0009，grilling 会话敲定）**：设置两分——Obsidian 设置页单页化（无 tab，只含 🤖 AI：服务商/两 key + 📂 数据存储路径：共享 storagePath）；10 域面板右上角 ⚙️ 域设置弹窗（备忘录 autoPopupOnStart｜日记本 6 项｜归物本/收藏本空弹窗｜剪藏本仅 3 项（剪藏目录/每批加载/自动摘要开关）｜密码本 3 项｜书库 7 项｜影视 2 项+海报提示｜复习计划 2+做题家 5 项｜闪念 17 项全量）。**筛选/排序统一 🔀**（影视「筛选与排序」、书库「视图与筛选」、归物本排序原 ⚙️ 均改 🔀）。**共享数据路径**：新字段 `storagePath`（默认 CONFIG/STORAGE）收敛旧 7 个 JSON 路径字段（todoFilePath/belongingsDataFolder/pwStoragePath/favoritesStoragePath/reviewStoragePath/META_PATH/VEC_PATH），旧字段仅兼容保留；迁移：首次加载旧字段全同 → seed，参差 → 默认 + Notice 列出被忽略路径（`migrateStoragePath`，用 loadData 原始对象判定，勿用 DEFAULT_SETTINGS 合并后对象——storagePath 恒 truthy 会跳过迁移）。读取点统一 storagePath 优先旧字段兜底（bz/belongings/password/favorites/review/quiz/ai-agent/flash-config 7 处）。AI Agent 4 项设置不暴露 UI（字段保留，运行时读旧值/默认兜底）。入口页不新增设置（编辑模式控件已按平台读写 launcher.json）。新工具 `src/core/settings-modal.ts`（通用设置弹窗：标题/build 回调/空态/✕/遮罩/Esc/幂等替换）+ `setSettingsSaver`/`saveSettings` 保存通道（main.ts 注入）。影视/书库本地筛选弹窗函数改名 openFilterModal/closeFilterModal（避开 core 同名）。测试：settings-tab.test.ts 重写（单页+迁移 9 测试）；新 tests/settings-modal.test.ts（机制+备忘录交互+归物本/收藏本空弹窗 9 测试）；movie/library/review/clipping/password/diary 各补 ⚙️ 弹窗测试。术语入 CONTEXT.md（全局设置页/域设置弹窗/共享数据路径/筛选弹窗）。

- **ticket 23 增量 2（用户 8 问）**：① **双平台独立配置**——launcher.json 升 v2 `{version, desktop:{tiles}, mobile:{tiles}}`，v1 旧格式自动归入 desktop；平台判定 `window.Capacitor`（项目惯例 IS_MOBILE）。② **隐藏文字 + emoji 图标**——磁贴 `hideText` 字段（改名弹窗内开关）；图标选择器支持 emoji/任意字符（lucide 清单外走文本渲染，`LUCIDE_ICONS.includes` 判定）。③ **去标题栏**——toolbar 整体移除，常态零按钮（遮罩点击/ESC 关闭）。④ **编辑模式空白格「＋」**——长按空白区域（含空态）进编辑模式，空白单元格渲染 + 占位（含末尾追加行，全满可继续添加），点击弹命令选择器；「完成」按钮改悬浮右上角（编辑模式唯一显式出口）。⑤ 遮罩关闭补测试。⑥ 完成按钮语义=退出编辑模式。⑦ 网格间距 12→8（拖拽步长同步）。⑧ **手势触发**——`src/launcher/gestures.ts` 双击/连续三击/双指下滑（触屏双触点同向位移 + 滚轮 300px 累积兜底），绑定命令 id；三击配置时双击延迟判定（TAP_WINDOW 内无第三击才触发）；设置页入口页 tab 三组下拉（off + 5 常用命令），`syncGestures` 幂等重注册（设置变更/onload），onunload 清理。60 测试（数据 23 + UI 27 + 手势 10）。

- **ticket 23 命令入口页（Launcher）**（issue 23，grilling 会话 10 问封板）：`bz-launcher-open` 裸注册；全局唯一单例弹窗（自建 DOM + escManager，z-index 10100）；网格列数设置项 `launcherColumns`（默认 6，设置页新 tab「入口页」）；磁贴档位 {1×1,1×2,2×1,2×2}；长按 0.5s 进编辑模式（iOS 式：拖主体移动/右下角手柄调档位/左上角×删除/顶部+添加/✓完成）；添加走自建命令选择器（listCommands 全命令模糊搜）→ 1×1 落末尾空位；点击磁贴先关入口页再 executeCommandById；幽灵磁贴（命令失效灰色保留可删，复活自动恢复）；磁贴自定义 lucide 图标（内置 ~140 图标清单 + 选择器，优先于命令自带 icon）；推挤碰撞（pushMove 纯函数：目标被占 → 行优先顺移，行扩展兜底永不失败）；数据 `CONFIG/STORAGE/launcher.json`（{version, tiles:[{id,commandId,x,y,w,h,icon?}]}，normalizeData 容错）。术语已入 CONTEXT.md（入口页/磁贴/档位/编辑模式/推挤/幽灵磁贴）。36 测试（数据层 19 + UI 17）；smoke 命令 30→31；设置页 tab 12→13。**ADR 评估：全部决策为既有模式/用户偏好，不写 ADR。**

- **ticket 22 自动摘要：create/open 双触发 + 逐字段补全 + 通知**（issue 22，用户问答确认）：`ensureAutoSummary` 注册 `vault.on('create')` + `workspace.on('file-open')`（watchDir 前缀边界一致；1500ms 延迟窗口 pending Set 去重；open 传 null 跳过；unload 双向 offref）。`processFile` 缺什么补什么（title/summary/tags，空串/空数组视为缺失；字段齐全跳过不 notify）；**缺 title → AI 标题重命名笔记文件**（非法字符清理/截断 80/防重名 (1)(2)，rename 失败回退仅写 frontmatter）；author 不再生成。`aiProcess(ai, bodyText, missing)` 提示词 JSON 模板按缺失字段裁剪（规则文案逐字保留，不含 author）。通知两条：调用 AI 前 `正在为《xx》生成摘要…`(3s，xx 用已有 title 或文件名) + 成功后 `notice(msg, 8000)` 格式《title》+空行+summary+空行+#tags。MockVault 补 rename。34 测试。spec.md 需求 30-34/事件监听/事件清单表/frontmatter/提示词结构/事件触发缝已同步。

- **ticket 21 海报抓取方案反转（ADR-0007）**：抓取逻辑移出插件——`src/movie/poster.ts` 与 `tests/movie/poster.test.ts` 删除，设置项 `doubanPosterEnabled` 删除，影视设置 tab 改为纯文字指引（安装 npm 包 + `douban-poster start` PM2 守护）。脚本侧 2.1.0：`watcher.js`（扫描缺海报笔记 + birthtime 倒序 + 串行队列 15s 间隔 + 10s 事件防抖），cli.js watch 改监听 add/change → 扫描；工具 README 恢复 PM2 说明。28 个 node 测试。

**⚠️ 发布事故（见 incidents/2026-08-08-npm-publish-without-verification.md）**：2.1.0 未运行验证即发布（cli.js 缺 switch 行语法损坏）→ 2.1.1 又漏 files 白名单（缺 watcher.js）→ 2.1.2 修复。教训：发版前必须 `npm test`（已加 node --check 门禁）+ `node cli.js` 冒烟 + `npm pack --dry-run` 核对清单 + 发布后全局安装实测。
## 最近一次架构深化（未提交，待 commit）

- **ticket 21 海报抓取**：`src/movie/poster.ts` 新建影视笔记自动调全局 npm 包 `@jwbz/obsidian-douban-poster`（ADR-0006）。桌面端 `vault.on('create')` → 延迟 3s → 串行队列 spawn `node cli.js fetch`；结果解析 stdout（[完成]/[跳过]/[失败]）；60s 超时 kill；`npm root -g` 探测安装状态（未装 → 设置开关禁用 + 安装指引）；移动端不注册监听 + 设置项置灰「仅桌面端可用」；设置 `doubanPosterEnabled`（默认关）。**mock-vault offref 已实现真实移除语义**（on 返回 {event, cb}）。21 测试。
  - **追加修复（用户反馈）**：① spawn 改传磁盘绝对路径（`vault.adapter.getFullPath`）——脚本 fetch 对相对路径 `path.join(movieFolder, input)` 重复拼接导致「笔记不存在」；② 新增 `workspace file-open` 维度：打开影视笔记且 frontmatter 无「海报」→ 触发抓取；create/open 双触发经 60s 冷却（`FETCH_COOLDOWN`）去重。28 测试（+7）。
- **复习⇄做题家联动契约化**：`src/quiz/ui.ts` 新增 `startReviewSession`/`endReviewSession` + 导出 `QuizReviewResults`；`src/review/app.ts` 的 quizReviewLoop 不再直写 quizUI 私有状态（_reviewMode/currentQuestions/onComplete 等），只调契约方法。新增契约测试（tests/quiz/ui.test.ts「复习联动契约」）；review 测试 mock 按契约实现。术语「做题会话 (Quiz Session)」已入 CONTEXT.md。
- **AI Agent 路径去硬编码**：`src/ai-agent/index.ts` 删 `MEMO_PATH`/`FAVORITES_PATH` 常量，改为 `getMemoPath()`（todoFilePath 目录 + memo.json，与 bz DataManager 同源）/`getFavoritesPath()`（favoritesStoragePath，默认 CONFIG/STORAGE/favorites.json）。新增「设置路径生效」测试。
- **侦察发现（文档过时）**：AGENTS.md 称闪念约 2311 行——实际 `src/flash/index.ts` 仅 24 行占位骨架（ticket 18 未实现）；文档已修正。

## 已完成（git 已提交）

| ticket | 域 | 说明 |
|---|---|---|
| 01 | 骨架 | esbuild→bz、manifest、设置页全量、25 命令裸注册、ribbon、懒加载 |
| 02 | core | Q3 21 工具移植：`src/core/`（utils/dom/json-store/changelog/ai/app/esc-manager/confirm/settings-provider） |
| 03 | AI/changelog | AIService+createAI（deepseek/opencode-go、override、noCors、fallback）；CHANGELOGS 8 identifier |
| 04/05 | 备忘录 | `src/bz/`（types/due/data/ui/app/index），37 测试 |
| 06 | 归物本 | `src/belongings/`（default-categories.gen.ts 1226 条已落盘），18 测试 |
| 07 | 密码本 | `src/password/`（crypto/data/ui/index），22 测试 |
| 19 | AIAgent | `src/ai-agent/`（sync/dialog/index），16 测试 |

## 待完成（按序）

1. **08/09 剪藏本+聚合讯**：worker 已交付**完整代码**（9 个文件全文）在
   `E:\Obsidian\1\.pi-subagents\artifacts\7fbec595-deb3-46b9-9714-0f21db4bf584_worker_2_output.md`
   → 落盘 `src/clipping/view.ts`+`index.ts`、`src/news/reader.ts`+`index.ts`、`styles/clipping.css`、`styles/news.css`、`tests/clipping/parse.test.ts`、`tests/clipping/view.test.ts`、`tests/news/reader.test.ts` → tsc + vitest → commit。
   注意：worker 代码中 `getVault()` 辅助需在 setup 内补 `_vault = vault`；main.ts 无需改动（导出名一致）。
2. **10 自动摘要 + 11 收藏本**：蓝图在 `..._worker_3_output.md`（自动摘要 parser/processor 结构、收藏本 DataManager/BalanceService（findNumberInObject/5 分钟缓存）/UIManager DOM id/AI 整理/余额状态机）。
3. **12 书库 + 13 阅读报告**：蓝图在 `..._worker_4_output.md`（getBookItems/parseBookNotes/updateComment/deleteHighlight 用 window.confirm、报告 80+ 生成函数公式：热力图色板/香农多样性/基尼平衡/思考比/趋势方向等，重复函数只保留最终版）。
4. **14 影视 + 15 影视分析**：蓝图在 `..._worker_5_output.md`（TYPE_GROUPS/ALL_TAGS/TYPE_COLORS 常量、排序三键、无限滚动、AI 推荐链路、initQ3 海报整理；分析 48 字段聚合、7 图表组件、ratingBucketOf 6 档、21 section；**movie 域必须导出 getMovieFolderPath() 供 analysis 用**；主演计数源码 bug 取单次）。
5. **16 复习 + 17 做题**：蓝图在 `..._worker_6_output.md`（FSRS 幂律：w=[0.4,0.6,2.4,5.8,4.93,0.94,0.86,0.01,1.49,0.14,1.26,0.07,0.35,2.06,0.57,0.09,0.05,0.33,2.15] d=0.9；R(1,1)=0.5104；阶梯 10 级；review.json 兼容；`window.__quiz`→src/quiz 单例；做题家 quiz.json 结构/3 难度提示词；**「全完成替换」实际是 removeQuestion 机制**）。
6. **18 闪念**：蓝图在 `..._worker_7_output.md`（七模块；两处停用词表 35 字/44 字分别保留；meta.json v7 + vectors.vec 布局 dim(LE uint32)+float32；Ollama 三端点；降级链；17 设置；IS_MOBILE）。源码 2311 行最大域。
7. **20 e2e 验收**：15 域对照原宏、数据零迁移、27 命令、降级链、回退验证。

## 关键约定（勿破坏）

- 命令已在 main.ts 注册（25 个，id 无前缀），域内**不重复 addCommand**；导出名与占位 index.ts 一致
- 域设置经 `getSettings()`（src/core/settings-provider.ts）；AI 经 `createAI()`；app 经 `getApp()`
- 样式写 `styles/<domain>.css`（最终收敛进根 styles.css），域内仍可 injectStyles（data-xxx-styles 幂等）
- 测试：vitest+jsdom，`tests/mock-obsidian-entry.ts`（Notice/requestUrl/moment/Plugin/Setting mock）+ `tests/mock-vault.ts`（MockVault 有 getFiles/createFolder/create/modify/read/getAbstractFileByPath）；`setApp`+`setSettingsProvider` 注入
- 长异步（PBKDF2/crypto）测试用真实 setTimeout 等待；fake timers 下用 advanceTimersByTimeAsync
- 提交信息格式：`bz: ticket NN <域> 完成——<要点>，N 测试`

## 环境注意

- 子代理写操作被环境全局拦截（权限门）——**只能主会话写盘**；worker 蓝图/代码在 `.pi-subagents/artifacts/*.md`
- 编辑器注意：src/bz/ui.ts 等大文件 anchor 易 stale，改动用 python 脚本或 replace_text

---

## 2025-08-07 收尾（ticket 20）

**状态：14/20 域完成（闪念按用户指示暂缓，已 stash）**

- ✅ ticket 13 阅读报告 `b0686c9`：stats.ts/report.ts/index.ts + 34 测试（香农多样性/基尼/热力图/21 section）
- ✅ ticket 14/15 影视+分析 `74e5626`：src/movie/ 7 文件 + src/movie-analysis/ 3 文件 + 58 测试（排序三键/无限滚动/Q3 海报/AI 推荐/48 字段/6 档评分桶）
- ✅ ticket 16/17 复习+做题 `ae5964c`：FSRS 19 权重/R(1,1)=0.5104/阶梯 10 级/难度弹窗 + QuizManager/三难度生成器 + 40 测试
- ⏸️ ticket 18 闪念：15 文件 + 2 测试已写（vector-store 二进制格式已修好）→ **git stash flash-wip-ticket18**（用户指示暂缓；恢复：`git stash pop`）
- ✅ ticket 20 收尾：README 重写、构建产物输出 vault 插件目录（main.js 774KB/manifest/styles.css）、全量 **478 测试 / 46 文件** 通过、tsc 零错误

**全量命令 25 个**（spec 27 = 25 + 闪念 2，闪念命令占位 Notice 保留在 main.ts 注册表）

**关键实现备注**：
- MockVault 增强：YAML `- item` 列表解析、file parent/extension 通用 basename、workspace.on/getActiveFile、正则放宽 `
---\s*(?:
|$)`（无尾随换行兼容）
- quiz generator：extractJSON 只截对象（源码语义，数组形态 → 报「AI 未返回有效题目数组」）
- review：阶梯分支 again 不可达 fsrs（源码语义）；nextDiff clamp [0,1]（again→1）
- flash（stash 内）：MobileBuffer 固定用于 .vec 写入（避免 Node Buffer 池偏移）；meta.json v7 chunks 只存 {text}
- 停用词表实际长度 29/40（蓝图标注 35/44 有误，以源码字符串为准）

---

## 2026-01-17 主页改造 + 全量改名（ticket 21）

**状态：30 命令全绿（474 测试）**

- ✅ 主页.js 改造：`CONFIG/SCRIPTS/DataView/主页.js`（vault）——点击动作 QuickAdd → bz 命令；卡片无动作；移除 QuickAdd 降级链（QuickAdd 已删除）；统计/HTML 输出逐字保留；movie preset（__homeFilmStatus）保留；dataview-force-refresh-views 保留（dataview 仍渲染）
- ✅ 全量改名 memo → bz（用户决策 Q8C/Q12A/Q13A）：插件目录 `memo-suite` → `bz`（manifest id=bz，esbuild 路径已改）；**全部命令 id 统一 `bz-` 前缀**（30 个）；`src/memo/` → `src/bz/`、`tests/memo/` → `tests/bz/`；`MemoSettings→BzSettings`、`ensureMemo→ensureBz`、`unloadMemo→unloadBz`、`openMemoPanel→openBzPanel`、`setMemoSettingsProvider→setBzSettingsProvider`、`MemoSuitePlugin→BzPlugin`、`MemoSuiteSettingTab→BzSettingTab`、changelog identifier 'memo'→'bz'、CSS 类 `memo-suite-*`→`bz-*`
- ✅ 新增命令 `bz-belongings-open-panel`（归物本面板，主页归物点击需要；openBelongings 函数早已实现，只差注册）
- ✅ 保留不变：`CONFIG/STORAGE/memo.json` 数据路径、DOM id（#todo-popup 等）、中文名（备忘录/归物本等）、changelog localStorage 键（仅 identifier 变 bz）
- ✅ ADR-0004 修订（裸 id → bz- 前缀）、AGENTS.md 铁律 2 更新、CONTEXT.md 术语更新、spec.md 命令清单（30 个）
- ⚠️ 部署注意：Obsidian 视为新插件——**热键全丢需重绑**；需禁用旧插件 `memo-suite`、启用 `bz`；旧目录 `.obsidian/plugins/memo-suite/` 待用户确认后手动删
- ⚠️ 保留：`.scratch/memo-suite-plugin/` 目录名与 `issues/*.md` 历史内容（工作区历史档案，未改名）

---

## 2026-08-07 设置项补全（用户决策）

**状态：483 测试全绿（44 文件），tsc 零错误，构建已产出**

- ✅ **新增 5 项设置**（BzSettings + 设置页 + 域内消费 + 测试）：
  - 影视 `moviePageSize`（默认 '20'）：`ensureMovie` 读设置替换硬编码 50（movie/index.ts / state.ts 默认值同步 20）；**海报整理 enableQ3/posterFolder 不提供**（确认无残留代码，仅 frontmatter 海报字段读取展示；main.ts 注释已更新）
  - 日记本 `diaryBatchSize`（默认 '20'）：`applyDirectories` 读设置（diary/config.ts BATCH_SIZE）
  - 剪藏本 `articleBatchSize`（默认 '20'）：`applyArticleSettings` 读设置（clipping/view.ts BATCH_SIZE）
  - 做题家 `quizStoragePath` + 复习计划 `reviewStoragePath`（默认 'CONFIG/STORAGE'）：新增 `getQuizFilePath()`/`getReviewDataPath()`/`getReviewFilePath()` getter（tryGetSettings 安全读取，未注入回退默认路径 → 旧测试不破）；常量 QUIZ_FILE_PATH/REVIEW_FILE_PATH/REVIEW_DATA_PATH 保留为默认值导出
- ✅ **删除日记本默认标签功能**：`getDefaultTagSetting` 移除（ui-settings.ts/panel.ts 导出）；写日记弹窗打开**不预选任何标签**（dialogs.ts 删「默认选中日记」+ defaultTag 回退两处逻辑）；保存仍要求至少选一个类型（校验保留）；长按手势固定启用（getEnableLongPressSetting 保留，不暴露选项）
- ✅ 测试：+7 新测试（clipping 每批 5 条、diary BATCH_SIZE 设置/回退、movie pageSize 设置/回退、quiz/review 路径 getter×3）；改造 3 个旧测试（弹窗默认不预选、保存先手动选日记、getDefaultTagSetting 断言→getEnableLongPressSetting）
- ✅ spec.md「设置页」小节记录决策；构建产物 main.js 907KB 已直出 vault
- ⚠️ 未做（用户未要求）：applyTagsConfig（primaryTagsConfig 解析）仍无调用点；备忘录场景列表/平台映射、归物本自定义分类、剪藏本长按时长仍固定默认

---

## 2026-08-07 设置页重组 + 主页影视过滤修复 + AI Agent 选项（第二批用户决策）

**状态：488 测试全绿（44 文件），并行连续 3 次全绿，tsc 零错误，构建已产出**

- ✅ **设置页重组**（14 tab → 12 tab）：
  - 备忘录：移除「显示文件名」设置项（固定 true，字段保留，bz/app.ts 行为不变）
  - 做题家 tab 删除 → 4 项选项（允许多选题/每笔记题目数量/打乱顺序/题目难度）并入复习计划 tab，**「做题决定难度」开启时才动态显示**（仿 AI tab 的 bz-setting-hidden 模式，helper 改返回 Setting）
  - quizStoragePath 删除 → `getQuizFilePath()` 与 review 共用 `reviewStoragePath`
  - 自动摘要 tab 删除 → 启用开关并入剪藏本 tab；`WATCH_DIR` 改为读 `articleDirectory`（路径与剪藏目录一致）
  - AI Agent tab 新增 3 项：监听文件夹（aiAgentWatchedFolders 逗号分隔，默认 卡片盒,归档/网页剪藏，动态读取）、AI 剪藏匹配开关（enableAIClipMatch，关闭后仅 URL 精确匹配归档）、AI 匹配模型（aiAgentModel，core/ai json() 硬编码模型 → 改 ai.prompt 显式传参）
- ✅ **主页影视过滤 bug 修复**：主页.js（dataviewjs）写 `window.__homeFilmStatus` 遗留全局，插件读模块状态 M.homeFilmStatus（无写入方）→ 永远显示全部。`createOverlay` 现在消费 `window.__homeFilmStatus` 并清除（兼容遗留通道，读完即清防残留）
- ✅ **测试健壮性**（预存在脆弱性，stash 验证与本次改动无关）：password/ui.test.ts 7 处 150ms 固定等待 → 轮询 waitFor（3s 超时）；smoke「域命令回调」超时 5s→15s
- ✅ 新增测试 5 个：ai-agent（enableAIClipMatch=false 不发 AI 请求 / aiAgentWatchedFolders 范围外不监听）、auto-summary（articleDirectory 跟随设置）、movie（window.__homeFilmStatus 在看/想看过滤 + 清除 + 默认全部）
- ⚠️ 注意：`window.__homeFilmStatus` 是唯一新增的遗留全局读取点（AGENTS.md 铁律 6 的例外，主页.js 无法 import 插件模块）
