# bz 进度（上下文压缩恢复点）

最后更新：2026-08-07（海报抓取），655 测试全过。仓库 `E:/Obsidian/1`，构建产物直出 `E:/Obsidian/叫我包仔/.obsidian/plugins/bz/`。

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
