# PROGRESS — 包仔（bz）插件开发进度

> 进度同步总表（AGENTS.md）。每票一节，状态：计划中 → 进行中 → 门禁 → 已交付。

## Ticket 167 — 已有 related 不再触发自动双链

**状态：已交付**

- [x] 需求确认（用户拍板，grill-with-docs：三条自动路径统一跳过 / related 非空才算「有」/ 手动重跑豁免 / 加开关默认开）
- [x] 规格：`issues/167-link-agent-respect-related.md` + spec.md v1.7 节（尊重开关 + 自动路径统一跳过）
- [x] 数据层：`link-agent/data.ts` 新增 `hasRelatedEntries`（related 非空判定统一出口）；settings.ts 新增 `linkAgentRespectRelated` 默认 true
- [x] 管线：`pipeline.ts` `processNote` 尊重门（related 非空 → `skipped-related`，不探测不裁判不写入）；`consumeQueue` 已连接条目顺带移除队列；`runBatch` 静默不计
- [x] 手动命令：`index.ts` `rebuildSecondBrainLinks` 传 `respectRelated:false` 豁免（显式意图强制重跑）
- [x] ⚙️ 弹窗：`panel.ts` 自动双链组新增 toggle「已有关联不再建链」
- [x] 测试：数据层 `hasRelatedEntries` + 七键断言；UI 层尊重门/空值语义/豁免/开关关闭恢复旧行为/队列消费移除；既有 3 处幂等重跑用例改豁免模式
- [x] 构建验证 + 部署产物同步（worktree/167 合并 master 后，push origin master）

## Ticket 165 — 通知 z-index 与小橘对齐 + 桌面端位置下移

**状态：已交付**

- [x] 调研：toast 已接入 ADR-0067 动态层级（`notice.ts:447` allocZ 抬顶），小橘猫恒压最高层但不与 toast 重叠（猫底部中央、toast 右上角）——z-index 无需改，改静态反而倒退
- [x] 实现：`src/core/styles.css:190` 桌面端 `#bz-notice-container` top 16px → 56px（下移 40px 避开顶部栏）；移动端断点不动
- [x] 测试：tsc 0 错 + 全量 221 文件 3563 用例绿（notice 无位置/z 断言）
- [x] 构建验证 + 部署产物同步（worktree/165 合并 master 后）

## Ticket 166 — 开始复习双 progress 通知合并为一条

**状态：已交付**

- [x] 根因：`review/app.ts:206`（key `review-generate`）与 `quiz/ui.ts:139`（key `quiz-generate`）两个不同 dedupeKey 的 progress 框并存，去重不生效
- [x] 实现：`review/app.ts:206` dedupeKey 统一为 `'quiz-generate'`，同键原地合并更新文案，只留一条；失败/逐篇降级路径共用同键行为不变
- [x] 测试：tsc 0 错 + 全量 221 文件 3563 用例绿（review/quiz/notice 测试无 key 断言）
- [x] 构建验证 + 部署产物同步（worktree/166 合并 master 后）

## Ticket 164 — 通知操作按钮高度与文字对齐（button → span）

**状态：已交付**

- [x] 需求确认（用户拍板：按钮不用 HTML button，改用 span）
- [x] 根因：Obsidian 核心 `button{height: var(--input-height)}` 32px 硬撑，`.bz-notice-action` 只覆盖 padding 未覆盖 height
- [x] 实现：`core/notice.ts` + `auto-summary/processor.ts` 操作按钮改 span + `role="button"`；`core/styles.css` 补 `line-height: 1`
- [x] 测试：tsc 0 错 + 全量 221 文件 3563 用例绿（既有断言只查文本不查标签类型）
- [x] 构建验证 + 部署产物同步

## Ticket 163 — 洞察条数上限 + 记忆来源分布按追查目录 + 小橘对我的称呼

**状态：门禁（实现/测试全绿，构建部署收尾）**

- [x] 需求确认（用户拍板：洞察上限默认 3 放面板；来源分布洞察计入 + note 按追查目录分行；称呼默认包仔，所有喂记忆/行为流的 AI 调用替换「你/用户」）
- [x] 规格：`issues/163-smartcat-insight-cap-source-dist-nickname.md`（spec.md「洞察上限 + 来源分布按追查目录 + 称呼替换」节同步）
- [x] 文档：ADR-0076（洞察上限 + 来源分布口径 + 称呼替换；CONTEXT.md「三层记忆流水线」词条修订 + 新增「小橘对我的称呼」词条）
- [x] 数据层：settings.ts 两新键；memory.ts getConsolidationConfig.maxInsights + getUserNickname/replaceUserReference + 反思/小结/追标/格式化四处内容替换 + 洞察 `.slice(0,N)` 截断
- [x] UI 层：⚙️ 互动组「小橘对我的称呼」+ 记忆巩固组「反思洞察条数上限」；dashboard 来源分布（洞察单列 + note 按追查目录分行 + 最近记忆列表同口径）
- [x] 测试：memory/dashboard/report/companion-context/settings 新增 + trait-attribution/adr0069-core 断言同步；tsc 0 错 + 全量 221 文件 3563 用例绿
- [x] 构建验证 + 部署 E 盘（worktree/dash-tweaks-163 合并 master 后）

## Ticket 136 — 文献盒改版（literature 域 / 术语生成 / AI 回迁 / 去网页版）

**状态：已交付（含终审全项闭环）**

- [x] 设计定稿（grill-with-docs 五轮拍板，契约见 `issues/136-literature-box-redesign.md`）
- [x] 文档：ADR-0071（AI 回迁+去网页版）/ ADR-0072（新域迁出+literature.json）/ ADR-0073（type+domain）
- [x] CONTEXT.md 词条更新（文献盒/B站下载/快速流程/文献笔记/文献类型/领域/术语文献/文献目录）
- [x] Worktree A `worktree/tools-literature`：CLI 去 AI 去网页版、转录临时文件、压缩步骤 → 已合并 master（531bcd2）
- [x] Worktree B `worktree/literature-domain`：src/literature 域全量实现 + 集成 + 测试 + 构建 → 已合并 master（77e9222）
- [x] 全量测试绿 + tsc 0 错 + 构建通过 + 部署产物与仓库一致
- [x] 命令：bz-literature-open（文献盒）/ bz-literature-note-term（术语生成文献笔记）；移除 bz-bili-open / bz-bili-tasks-open
- [x] 独立终审（46172556）：P1×4（bz-bili 样式恢复/backfill type 回滚/instanceof 字符串/术语确认重跑 AI）+ P2×4 + P3×5 全部闭环

## Ticket 138 — 文献盒 UX 修复与增强（用户实测反馈）

**状态：已交付**

- [x] 规格：`issues/138-literature-ux-fixes.md`
- [x] 硬 bug：openTermNote 改 getActiveViewOfType(MarkdownView)（修 instanceof）；ensureLiterature 失败可重试 + createMainUI 自愈（点两次才打开）；backfill AI 25s 超时跳过（补全不卡批）
- [x] 术语流程：generateTermDraft 纯 AI 预览不落盘；确认写入 generateTermNote 传面板值所见即所得、不重跑 AI
- [x] 主面板 UI：emoji 按钮 📝🎬、🔍 前移、去类型分类栏、去类型徽章、样式对齐日记本、loadNotes 递归
- [x] worktree/literature-ux 3 提交合并 master（dc8728e）+ 全量 218 文件/3468 用例绿 + 构建部署

## Ticket 139 — 文献盒 UX 二轮（用户清单拍板 10 项 + 关闭按钮统一）

**状态：已交付**

- [x] 规格：`issues/139-literature-ux-round2.md`（spec.md「文献盒 UX 二轮」节同步）
- [x] 交互：📝/🎬 子面板叠开不隐藏主面板（关闭子面板回列表）；openNote 收起文献盒全部窗口
- [x] 增量刷新：新增 core/list-patch.ts 键控卡片 diff；literature + clipping 文件事件只 patch 差异卡片（滚动不跳顶）；diary/movie 单列后续
- [x] 视频队列：失败原因白话化（humanizeError，原文在 title）+ 失败卡片点击进编辑弹窗带原因提示条；移动端仅 ➕ + ❌；移动端默认全屏补齐
- [x] 弹窗：添加任务「整片/剪辑」分段开关 + 校验失败聚焦 + Enter 提交；术语面板重设计（输入同行/状态行/预览卡片化）+ 重新生成手改确认
- [x] 样式：筛选/搜索留白 16px 对齐卡片；关闭按钮 ✕→❌ 三处统一；加载中占位
- [x] worktree/literature-ux-139 合并 master（1e340df）+ 全量 219 文件/3484 用例绿 + tsc + 构建部署

## Ticket 140 — 收藏本抽屉归档（纯冷存，ADR-0074）

**状态：已交付**

- [x] 规格：`issues/140-favorites-archive.md`（grill-with-docs 五轮拍板 Q1-Q8）
- [x] 抽屉动作序：打开 → 置顶 → 跳转笔记 → 刷新余额 → 编辑 → 归档 → 删除；归档 openFlowDialog 确认 → archived+archivedAt 落盘 → 冷存消失 + 📁 toast + 观察流「你归档了收藏《X》」
- [x] 冷存全排除：主列表/搜索/标签计数/批量余额（refreshData 唯一装载点过滤，data.ts 零改动零迁移）
- [x] 文档：ADR-0074（归档=纯冷存不可见）+ CONTEXT.md「归档」词条 + 收藏本动作序更新
- [x] worktree/favorites-archive 合并 master（263b47e）+ 全量 219 文件/3493 用例绿 + tsc + 构建部署


## Ticket 141 — 小橘「对话即操作」助手（待实现计划）

**状态：计划中**（仅记录需求 + 设计概要 + 待拍板项，未实施）

- [ ] 需求：小橘聊天说一句话（如「添加关于黑洞的文献笔记」）→ 直接调用对应域函数生成产物，无需打开域面板
- [ ] 设计：三层结构——① 技能注册表（每域动作 = 一条技能：detect/execute/confirm?/summary，新域接入零改聊天主流程）② 意图识别（词法快路径 + AI 慢路径兜底，不命中则照常聊天）③ 执行与反馈（复用域既有函数落盘 + emit 域事件入行为流 + 结果注入 AI 回复 + 自动打开产物）
- [ ] 边界：数据格式零变化、域事件契约复用（与 UI 手动生成同口径）、命令单点不动、纯增量
- [ ] 待拍板：直接执行 vs 预览确认／参数缺失行为（多轮追问/开面板/不执行）／V1 范围（文献盒+备忘录 / 仅文献盒 / 多域）
- [ ] 详细记录：`issues/141-smartcat-agent-assistant-plan.md`

## Ticket 142 — 术语生成文献笔记面板简洁版（用户逐条拍板）

**状态：已交付**

- [x] 规格：`issues/142-term-note-panel-simple.md`（spec.md「术语生成面板简洁版」节同步）；原型 `.scratch/term-note-panel/index.html`（方案 A 属性表定稿，.scratch 不入库）
- [x] 删：弹窗标题（bz-win-head 整行）/「术语」label / 输入框 placeholder / 输入框下红色提示小字（生成中状态行并入按钮「生成中…」，输入行下方无文字）；「类型」行不展示
- [x] 预览只读：领域 input / 简介 textarea 删除，上属性卡（术语/领域/日期）下内容卡，无「属性/内容」区标题
- [x] 「重新生成」手改守卫删除（ticket 139 的 flow-dialog 确认随预览只读一并移除）；确认写入仍传面板 term+预览值（所见即所得不重跑 AI）
- [x] 测试改写：无标题/label/placeholder/状态行断言 + 预览只读 input/textarea 为空断言 + 重新生成直接覆盖无守卫用例；全量测试绿 + tsc 0 错 + 构建部署

## Ticket 143 — 文献盒桌面窗口简洁版（用户拍板：主面板/视频录入保留标题；worktree 交付）

**状态：进行中 → 已交付**

- [x] 规格：`issues/143-literature-simple-layouts.md`（spec.md「文献盒桌面窗口简洁版」节同步）；原型 `.scratch/literature-minimal/index.html` 每窗 4 套布局走查后全部拍板 A（.scratch 不入库）
- [x] 主面板/视频录入：**保留原标题**（用户拍板），仅搜索框简洁化（去 placeholder，盒内 🔍 图标）
- [x] 历史：去标题，工具栏 = 「🕘 历史 · 共 N 条」+ ❌；组头去「UP主」前缀与「N 条笔记」计数；笔记行 `shortNoteName` 去目录去 .md；时间 `formatRelativeTime` 相对显示
- [x] 添加任务：去 h4 标题（编辑态右上角 `#lit-add-mode` 标签）；链接输入 label + 整片/剪辑开关同行；新任务默认剪辑片段（编辑按 start/end 回显）；分P 去括号；去 placeholder；失败提示条红色 → 中性化
- [x] 移动端：表单行 / 链接行折单列，每行一个输入框
- [x] 测试：新增 4 用例 + 改写默认剪辑/mode 标签/历史路径与标题断言；全量测试绿 + tsc 0 错 + 构建部署（worktree/literature-simple → master 合并）

## Ticket 144 — 全站 UX/UI 批次第一波（19 域审查拍板，分波交付）

**状态：第一波已交付；待办归档见 issues/144-ux-batch.md**（原编号 141 与并行会话撞号重编；代码提交信息保留旧号）

- [x] core：notifyUndo/notifySaveError/confirmDiscard helper + toast action 按钮减重
- [x] review：flow-dialog 迁移 / ESC 层级 / 搜索防抖 / 移出可撤销 / 通知类型修复 / 样式收敛
- [x] quiz：普通模式删除（纯复习会话语义）/ 键盘快捷键 / 去 800ms 强制跳题 / 对错计数 / 样式收敛
- [x] secondbrain：对话可取消+流式 / 历史持久化+清空 / 多行输入 / 移动端吞错修复 / 移除 AI 生成概括 / ESC 层级
- [x] favorites：分页 / 排序（favoritesSortKey 设置键）/ 搜索空态区分 / 删除可撤销 / 保存防假死 / 脏表单拦截 / 样式收敛
- [x] 全量 221 文件 / 3528 用例绿 + tsc 零错误；待办（真 Bug 剪藏/影视、通病接入、加密盒/密码/番茄钟/聚合讯/小橘/自动摘要/影视报告/阅读报告）见 issues/144-ux-batch.md

## Ticket 146 — 文献盒交互第三轮（用户三条拍板；worktree 交付）

**状态：进行中 → 已交付**

- [x] 规格：`issues/146-literature-ux-round3.md`（spec.md「文献盒交互第三轮」节同步）
- [x] 主面板列表：标题↔简介↔时间分档加大间距（summary 6→10px、date 6→12px）；日期改 `formatRelativeTime` 相对显示（无效回退原文、空不显示）
- [x] 视频录入单钮态机：删独立 `#lit-btn-video-abort`；空闲「▶️ 批量处理」（无工作禁用）↔ 运行中「⏹ 终止」（仅失败项续跑「⏹ 终止整批」）；完成有失败可再点续跑；移动端整钮隐藏（`.bz-lit-run-btn` 文本钮）
- [x] 测试：改写视频面板/移动端用例（无 abort、三态断言）+ 新增主面板日期用例 + 新增单钮态机用例（含失败续跑）；全量测试绿 + tsc 0 错 + 构建部署（worktree → master 合并）

## Ticket 145 — bili-dl 压缩回退（压缩件比原文件大则采纳原文件；用户拍板，tools 交付）

**状态：进行中 → 已交付**

- [x] 规格：`issues/145-bili-downloader-compress-fallback.md`（spec.md「压缩回退」节同步；CONTEXT/README/cli.js 注释同步）
- [x] tools/bili-downloader core.js ③.5：`needsCompressFallback`（压缩件严格更大 → 删压缩件沿用输入、不写压缩缓存、交付文件名不带 `_crf` 标记）；断点续跑命中缓存恒为采纳
- [x] 测试：`needsCompressFallback` 单测（更大回退/更小·相等·stat 异常不回退）；tools `node --test` 49 全绿
- [x] bz 侧 tsc + 全量测试 + 构建不回归；全局安装副本 core.js/文档同步生效

## Ticket 152 — secondbrain Syncthing 冲突文件自动自愈（worktree 交付）

**状态：进行中 → 已交付**

- [x] 诊断：冲突文件 `.sync-conflict-20260830-*.json/.vec` 为双设备并发 refresh 索引不同新笔记的真实分叉（conf 多 1 篇 + vec 恰好多 1 行，见 issues/152）；写前比对（2026-08-29 止血）挡不住「两端真写不同内容」
- [x] 设计：store-file 每次读取扫描 `*.sync-conflict-*` —— JSON 段级 union（meta.notes 键并集取 mtime 大者 / panel 取 generatedAt 大者 / queue-state-chatHistory 并集去重）+ .vec 按合并后 meta 键序行级重排（meta 未变则主 .vec 复用）；兜底删向量走 indexIncomplete 全量重建（ticket 107）；损坏冲突 JSON 保留待人工处置
- [x] 规格：`issues/152-secondbrain-syncthing-conflict-selfheal.md`；spec.md「冲突文件自愈」节（v1.6）同步；CONTEXT 第二大脑词条补冲突自愈
- [x] 代码：`src/secondbrain/store-file.ts`（mergeStoreWithConflict / mergeVecByMeta / reconcileConflicts / reconcileVecConflicts / nukeVectorsForRebuild + readStoreRaw 出口统一收敛）；`tests/mock-vault.ts` adapter 补 readBinary/writeBinary + list 纳入 binaryFiles
- [x] 测试：store-file 冲突自愈 7 用例（段级 union / vec 行级重排 / meta 未变复用 / 损坏保留 / 无冲突零行为 / 纯函数 / 无 list 降级）；全量 221 文件 3542 用例绿 + tsc 0 错
- [x] 构建部署：worktree → master 合并后构建，产物同步 E 盘插件目录与仓库根目录三件套

## Ticket 153 — 通知「去复习」走做题流程 + 做题答对自动跳下一题

**状态：已交付**（2026-08-30；worktree/review-notify-quiz）

- [x] 规格：`issues/153-review-notify-quiz-flow.md`（CONTEXT.md 词条「到期提醒」同步）
- [x] **bug 修复**：逾期通知「去复习」action 由「裸开最早逾期笔记」改为 `reviewApp.autoJumpOverdue()`——按「用做题测难度」（forceQuizForReview）分流：开启 → 批量出题做题；关闭 → 普通复习；删单篇跳转与 earliest 目标计算（newly diff 去重语义保留）
- [x] **交互拍板**：做题答对（单选/多选）持久化成功后自动 `showQuestion()` 进入下一题，不再挂「下一题」按钮；答错才显示按钮（点按或 Enter）；删 `_enableNextButton`/`_removeNextButton`/disabled 占位参数与 `.quiz-next-btn--pending` 样式
- [x] 测试：review/app.test.ts ticket 58 两用例改写 153 语义（「去复习」触发 autoJumpOverdue、不裸开单篇）；quiz/ui.test.ts 答对类用例改自动跳题断言 + 新增键盘 Enter 答错跳题用例；全量 3536 绿 + tsc 0 错 + 构建部署

## Ticket 154 — 主页统计条「索引」改「文献」开文献盒

**状态：已交付**（2026-08-30；vault 主页.js 仓库外改动）

- [x] 规格：`issues/154-home-index-to-literature.md`（CONTEXT.md「主页统计条」词条同步）
- [x] vault `CONFIG/SCRIPTS/DataView/主页.js`：计数 `indexCount`→`literatureCount`（`文献盒/` 笔记数，与卡片/主题口径一致）；点击动作 `__homeActions.文献` → `bz-literature-open` 开主面板
- [x] 插件侧零改动（`bz-literature-open` → `openLiteraturePanel` 既有）；文档型提交

## Ticket 155 — 术语窗口自动生成 + 生成/重新生成/总结按钮

**状态：已交付**（2026-08-30）

- [x] 规格：`issues/155-literature-term-autogen-summary.md`（spec.md「术语面板自动生成 + 总结按钮」节同步）
- [x] `showTermEntry(term)` 预填非空自动生成（选中文字打开即生成）；`termHasDraft` 态机：生成成功输入行按钮「生成」→「重新生成」
- [x] 底部按钮「重新生成」→「总结」（`#lit-term-regenerate` id 契约不变）：`summarizeTermSummary` AI 精简预览正文回填，所见即所得落入确认写入；无预览提示先生成，`termSummarizing` 防并发
- [x] 测试：literature 121 用例绿（ui 622/732 改写 + 总结落盘新用例、note-gen 精简用例、index-cov 打桩断言自动生成）+ tsc 0 错

## Ticket 156 — 做题家：答对 0.8s 亮绿跳题 + 去右上角统计 + 逾期复习出新题

**状态：已交付**（2026-08-30）

- [x] 规格：`issues/156-quiz-correct-jump-stats-newq.md`（spec.md「做题家作答节奏与出题语义」节同步）
- [x] 答对延时 800ms 自动跳题（亮绿反馈窗口；放弃/强制关闭清除延时 + `_sessionActive` 守卫防僵尸弹窗）
- [x] 删头部 `.bz-quiz-stats` 对错统计（元素/字段/方法/样式）；结算面板统计保留
- [x] `batchGenerateQuestions` 改「先清后生」：逐笔记清空 quiz.json 存量题再全新生成（上轮错题不再重考）
- [x] 测试：quiz+review 187 用例绿（答对类补延时等待、新增延时竞态用例、批量出题断言先清空）+ tsc 0 错

## Ticket 157 — 入口页：移动端长按无法拖拽图标（长按同手势直接拖）

**状态：已交付**（2026-08-30）

- [x] 规格：`issues/157-launcher-longpress-drag-mobile.md`（spec.md「入口页长按同手势拖拽」节同步）
- [x] 根因（移动端）：长按只进编辑重建 DOM（拖拽需松手重按）+ touchmove 无阻断/touch-action 缺失（滚动抢占 pointercancel 杀手势）+ 系统长按菜单未拦
- [x] 修复：长按触发后同手势延续监听（>10px 直接 startDrag）+ document 非被动 touchmove preventDefault（拖拽全程、抬起解除）+ `.launcher-tile.editing` touch-action:none + grid contextmenu 拦截 + callout 禁用
- [x] 测试：launcher 76 用例绿（helper 补 pointerup 释放防悬空手势、新增同手势拖拽/仅进编辑两用例）+ tsc 0 错

## Ticket 158 — 小橘：日小结/洞察/周报未生效（记忆流断粮饿死修复）

**状态：已交付**（2026-08-30）

- [x] 规格：`issues/158-smartcat-reflect-digest-weekly-starvation.md`（spec.md「小橘反思/日小结/周报饿死修复」节同步）
- [x] 根因：ADR-0069 R2 后记忆流断粮——反思证据<2 静默空转、首次日小结被 `!lastReflect` 卡死、周报门槛/原料读记忆流恒<3
- [x] 修复：`behaviorToObservations` 派生视图（wording+credibility）——反思证据池并入（双写去重）、周报门槛/原料并入；`shouldReflect` 行为流 20 条触发首次反思；`shouldDigest` 首次解耦反思（3 条即触发）；周报 `hour>=10` 防相位跳档
- [x] 测试：smartcat 1137 用例绿（重写 2 旧语义用例 + 新增 4 用例）+ tsc 0 错

## Ticket 159 — 备忘录：删除未入小橘行为流（落盘时序加固）

**状态：已交付**（2026-08-30）

- [x] 规格：`issues/159-memo-delete-behavior-flush.md`（spec.md「备忘录删除行为流落盘加固」节同步）
- [x] 实证：事件链路完整且有测试；真实行为流 added×8/completed×7/edited×3/deleted×0 ⇒ 症状=落盘时序（30s 防抖 + 卸载 fire-and-forget，删除后 30s 内退出即丢）
- [x] 加固：`markBehaviorDirty` 追加 5s 短防抖直写（窗口内合并；与 30s tick 并存）；`stopScheduler` 清定时器
- [x] 测试：新增 5s 直写/合并/停止清理用例；smartcat 1138 用例绿 + tsc 0 错

## Ticket 160 — 小橘：三层记忆流水线 + 巩固参数设置面板（推翻 158 合并池）

**状态：已交付**（2026-08-30）

- [x] 规格：`issues/160-three-tier-memory-pipeline.md`（spec.md「三层记忆流水线 + 巩固参数面板」节同步；ADR-0075）
- [x] 数据层：digest 产出 `makeDigestObservation`（observation/source=digest/evidenceIds 溯源，〔今日小结〕前缀取消）；reflect 证据池只吃记忆流观察（删 behaviorToObservations 并池与描述去重）+ ref 条目贴「原文摘录」（refResolver，读失败回退路径）；shouldReflect 改「≥间隔 且 新素材≥阈值」双闸（新素材=max(pending 计数, created 扫描)，计数落 memory 路由分支/日小结批量/记忆目录新建）；周报只吃本周新增 insight（buildWeeklyReportData 重写：themeDist/insights/padAvg，统计字段退役）；SOURCE_LABELS 补 digest/weekly-report/note
- [x] 设置层：BzSettings +11 键（smartcatReflect*/smartcatDigest*/smartcatWeeklyMinInsights/smartcatRefExcerptLimit）+ ⚙️ 弹窗「记忆巩固」组 11 滑杆；getConsolidationConfig 统一读取（MEMORY_CONFIG 缺省，非法值回退）；旧设置清点：无既有键重叠，废弃面为内部常量语义与死代码
- [x] 测试：memory.test 158 三用例改写（行为流不再直进反思证据/首反思只看记忆流）+ ref 原文（截断/失效回退/0 关闭）+ digest→reflect 全链路 + getConsolidationConfig 覆盖 + shouldReflect 双闸；report.test 重写洞察语义；adr0069-core 计数语义更新；index-cov 周报链路种子加洞察；settings.test 九组快照
- [x] 门禁：tsc 0 错 + 全量 221 文件 3557 用例绿 + 构建部署 E 盘

## Ticket 161 — 小橘：巩固参数滑杆改输入框

**状态：已交付**（2026-08-30）

- [x] 规格：`issues/161-smartcat-consolidation-number-input.md`（spec.md「巩固参数滑杆改输入框」节同步）
- [x] 实现：src/smartcat/ui.ts 17 处 slider 行改 number 行（min/max/step/绑定/文案不变）；设置面板下滑误触滑杆问题消除
- [x] 测试：smartcat ui/settings + settings-schema-ui 用例绿 + tsc 0 错 + 构建部署 E 盘

## Ticket 162 — 小橘：巩固语义重定义（行为小结并入反思 + 阈值精简 + 周报锚定首洞察）

**状态：已交付**（2026-08-30）

- [x] 规格：`issues/162-consolidation-semantics-simplify.md`（spec.md「巩固语义重定义」节同步；CONTEXT.md「三层记忆流水线」词条改写）
- [x] 语义：反思只看素材阈值（默认 20，无间隔闸）；「日小结」更名「行为小结」并改为反思前置步骤（上次反思以来全部行为流 →1 条 observation，首次 24h，不占素材额度）；反思证据池全量按重要度排序（洞察条数 AI 自定）；周报窗口锚定第一条洞察按 7 天链式推进（空窗静默推进、洞察门槛退役）
- [x] 设置：巩固参数 11 → 2（反思观察阈值 + 引用摘录字数）；「移动端默认全屏」组挪面板最下；6 个退役设置键 data.json 残留值忽略
- [x] 测试：memory.test「睡前巩固」describe 整体重写为「行为小结」+ routedFetch 路由 mock；insight-version/emotion-recall/adr0069-core/trait-attribution/index-cov/behavior-wording/settings 同步
- [x] 门禁：tsc 0 错 + 全量 221 文件 3553 用例绿 + 构建部署 E 盘
