# Spec: QuickAdd 全脚本独立插件化（memo-suite）

Status: `ready-for-agent`
Type: spec
Feature: memo-suite-plugin

## Problem Statement

用户（叫我包仔）的 vault 依赖 16 个 QuickAdd 宏脚本（约 21,000 行）完成日常管理：待办（备忘录）、物品（归物本）、密码、剪藏、新闻聚合、收藏、读书、观影、复习、做题、闪念、AI 同步等。这些脚本依赖 QuickAdd 运行时与 Q3.js 挂载到 `window.__utils` 的共享工具（21 个导出），且脚本间存在命令互调（影视.js → `movie-analysis-open`）与全局状态共享（`window.__MOVIE_FOLDER_PATH`）。

用户已通过「日记本」迁移验证了 QuickAdd → 标准 Obsidian 插件的可行路径（TS + esbuild、UI/逻辑逐字一致、数据格式零迁移、裸命令 id 保留热键）。现在要把**剩余 15 个脚本合并为一个插件** `memo-suite`（显示名「备忘录」），功能与样式完全复刻。B站下载排除（后续独立插件）。

## Solution

标准 Obsidian 插件 `memo-suite`：`src/core/` 完整移植 Q3/__utils（内部模块，不挂 window），15 个域（备忘录、归物本、剪藏本、聚合讯、密码本、收藏本、书库、阅读数据分析报告、影视、影视数据分析、自动摘要、AI Agent、复习计划、做题家、闪念）按模块化单向依赖组织；命令全部裸注册且不绑默认快捷键；AI 配置（DeepSeek/OpenCode Go）迁入插件设置页；聚合讯保留 dv.view（Dataview 插件渲染）；闪念经 HTTP 调 Ollama；外部进程能力（child_process）在桌面端可用。构建产物输出到 vault 插件目录，用户手动启用。

## User Stories

### 共享层与插件骨架（第 0 批）

1. 作为用户，我希望启用插件后原 QuickAdd 宏仍可继续使用（不冲突、不破坏原数据），以便平滑切换、随时回退。
2. 作为用户，我希望 Q3 的 21 个工具（escManager、confirm、notice、generateId、jsonStore、longPress、injectStyles、createSiteIcon、createIconBtn、formatRelativeTime、formatFileSize、displayChangelog、checkAndShowChangelog、AIService、createAI、extractUrlAndDisplay、getPlatformName、getCurrentNoteInfo、getCurrentCursorPosition、fetchPageTitle、createOverlay）全部可用，以便 15 个域移植时逐字保留调用。
3. 作为用户，我希望 jsonStore 对 `CONFIG/STORAGE/*.json` 的读写（原子写、锁、迁移兼容）与原脚本完全一致，以便备忘录/归物本/密码本/复习计划的数据零迁移。
4. 作为用户，我希望插件设置页包含 AI 配置（provider：deepseek / opencode-go、apiKey、endpoint/model 覆盖），以便沿用原 Q3 设置语义。
5. 作为用户，我希望各脚本的 changelog（更新日志弹窗）机制保留（localStorage 已读版本），以便迁移后同样能看到更新说明。
6. 作为用户，我希望插件命令全部沿用原脚本命令 id 且不带插件前缀，以便既有热键绑定（设置 → 快捷键）可继续使用。
7. 作为用户，我希望插件不注册任何默认快捷键，以便不干扰我已有的热键方案。
8. 作为开发者，我希望 core 层有完整测试覆盖（escManager/jsonStore/AIService/changelog/样式注入），以便后续域移植有可信底座。

### 备忘录（Todo）

9. 作为用户，我希望打开「备忘录」面板（ribbon 主入口）后界面与原脚本一致（#todo-popup 弹窗、场景分类筛选），以便沿用使用习惯。
10. 作为用户，我希望待办支持场景分类（剪藏/工作/学习/生活/代码/公开课），以便按场景组织任务。
11. 作为用户，我希望待办支持截止时间（日期选择器）、完成勾选、新增/编辑/删除，以便完整管理任务。
12. 作为用户，我希望待办数据读写 `CONFIG/STORAGE/memo.json`（jsonStore），以便与 QuickAdd 时代数据无缝衔接。
13. 作为用户，我希望待办逾期状态有醒目显示（getDueStatus/formatDueText 语义：逾期、今日截止等），以便一眼看出紧急任务。
14. 作为用户，我希望输入/粘贴 URL 时自动提取页面标题生成待办（fetchPageTitle/extractUrlAndDisplay 语义），以便快速记录。
15. 作为用户，我希望备忘录设置保留 5 项：todoFilePath（数据路径）、scenarios（场景列表）、platformMapping（平台映射）、showFileName（是否显示文件名）、autoPopupOnStart（启动自动弹出），以便与原脚本配置一致。
16. 作为用户，我希望 AI 推荐场景分类（✨ AI 推荐按钮 + ⏳ 推荐中… 加载态），以便新增待办时自动归类。
17. 作为用户，我希望已完成待办可归档（归档按钮），以便从主列表隐藏历史任务。
18. 作为用户，我希望学习/公开课场景的待办有课程字段（courseInput），以便记录课程归属。
19. 作为用户，我希望可从当前笔记（📌 笔记名）或光标选中内容创建待办（getCurrentNoteInfo/getCurrentCursorPosition 语义），以便快速录入。
20. 作为用户，我希望截止时间输入支持清除（dueClear）、位置按钮（posBtn）、焦点粘贴自动提取 URL（clipboardFocusHandler），以便与原脚本交互一致。

### 归物本（Belongings）

13. 作为用户，我希望物品登记面板（列表、搜索、新增/编辑/删除、图片展示）与原脚本一致，以便继续登记我的物品。
14. 作为用户，我希望数据目录默认 `CONFIG/STORAGE`（可在设置中配置 dataFolder），以便沿用原存储布局。
15. 作为用户，我希望启用时显示归物本 changelog（identifier 'belongings'），以便看到更新说明。
16. 作为用户，我希望归物本支持自定义分类（customCategories 设置）与排序弹窗（按分类/时间等排序，showSortModal 语义），以便整理物品。
17. 作为用户，我希望归物本有统计显示（按分类统计等），以便掌握物品分布。
18. 作为用户，我希望物品卡片支持点击展开详情/操作、列表有刷新按钮（refreshBtn），以便与原脚本交互一致。

### 密码本（Password Vault）

16. 作为用户，我希望密码管理面板（条目列表、加密存储、样式注入 data-pw-styles）与原脚本一致，以便继续管理密码。
17. 作为用户，我希望存储路径可配置（storagePath），以便沿用原路径。
18. 作为用户，我希望密码本内置密码生成器（passwordCharset 字符集/passwordLength 长度/securityMode 安全模式三项设置），以便生成强密码。
19. 作为用户，我希望密码条目加密存储、支持点击复制密码，以便安全使用。
20. 作为用户，我希望主密码机制完整保留：首次设置主密码（含再次输入确认）、解锁流程（输入主密码解锁密码本）、主密码驱动全部数据加密，以便与原脚本一致。
21. 作为用户，我希望密码条目字段（账号/密码/链接/日期/备注）与 👁 显示切换、搜索过滤、生成按钮，以便与原脚本一致。

### 剪藏本（Clipping）

18. 作为用户，我希望剪藏文章面板（`我的/文章` 目录）支持搜索、站点过滤（单选）、排序、双击跳转、长按删除，以便浏览剪藏文章。
19. 作为用户，我希望面板中显示反链笔记名并支持点击跳转（metadataCache.getBacklinksForFile），以便发现文章被哪些笔记引用。
20. 作为用户，我希望剪藏本设置保留 articleDirectory（文章目录）、batchSize（批量大小）、longPressDuration（长按时长），以便沿用原配置。
21. 作为用户，我希望 `我的/文章` 下文章被修改时面板自动刷新（vault modify 监听），以便内容保持最新。
22. 作为用户，我希望站点栏（createSiteBar/rebuildSiteBar 语义）显示全部站点并可单选过滤，以便按来源浏览。
23. 作为用户，我希望剪藏本可跳转到聚合讯阅读器（互调 `news-reader-open`），以便剪藏与阅读联动。
24. 作为用户，我希望文章卡片显示作者（✍️）、反链笔记名（去《》书名号显示，📌）、站点计数（全部 (N)），以便与原脚本一致。
25. 作为用户，我希望列表滚动到底自动加载更多（initScroll）、无文章时显示空态（renderEmpty），以便与原脚本一致。

### 聚合讯（News Aggregator）

20. 作为用户，我希望新闻抓取（站点列表、platform map、news.json/news-stats.json 统计）与原脚本一致，以便继续聚合阅读。
21. 作为用户，我希望聚合讯生成的笔记保留 dataviewjs 代码块（`dv.view('CONFIG/SCRIPTS/DataView/摘要')`），由 Dataview 插件渲染，以便摘要视图行为不变。
22. 作为用户，我希望剪藏内容写入 `归档/网页剪藏`（CLIP_DIR），以便与自动摘要共享数据源。
23. 作为用户，我希望聚合讯注册 `news-reader-open` 命令（阅读器入口），以便剪藏本互调。
24. 作为用户，我希望阅读统计（news-stats.json：记录/统计每篇文章的阅读行为，loadStats/saveStats/recordStat 语义）与原脚本一致，以便掌握阅读量。
25. 作为用户，我希望文章支持已读标记（markAsRead）、跳过（skipArticle）、检查新文章（checkNewArticles）、剪藏保存（saveToClip），以便完整管理阅读流。
26. 作为用户，我希望阅读器内的摘要以 markdown 渲染（renderMarkdown），以便排版与原脚本一致。
27. 作为用户，我希望聚合讯的约 196 行注入样式（弹窗/列表/统计）原样保留，以便视觉一致。
28. 作为用户，我希望阅读器显示作者（👤）与日期（📅）、全部读完显示完成态（renderDoneState），以便与原脚本一致。

### 收藏本（Favorites）

23. 作为用户，我希望 GitHub 收藏管理（列表、AI 生成标题/简介、打开链接、长按操作）与原脚本一致，以便管理我的 GitHub stars。
24. 作为用户，我希望收藏本设置保留 storagePath（数据路径），数据读写 `CONFIG/STORAGE/favorites.json`，以便数据零迁移。
25. 作为用户，我希望收藏支持置顶（📌 置顶）、编辑收藏、标签 emoji 显示、空态（暂无收藏 🎉），以便与原脚本一致。
26. 作为用户，我希望余额查询保留：API Keys（每行一个，第一个用于余额查询）、余额查询 URL（完整 URL）、自动从返回对象查找余额数字、查询中/刷新中/错误状态显示与刷新，以便监控 API 配额。
27. 作为用户，我希望大模型配置弹窗（🧠：API Keys 输入）与 AI 整理加载态（⏳ AI 整理中…），以便配置与反馈与原脚本一致。

### 书库（Library）与阅读数据分析报告（Reading Analytics）

24. 作为用户，我希望书库面板（`书库/` 目录 + `我的/读书笔记` 聚合、搜索/排序/跳转）与原脚本一致，以便管理读书笔记。
25. 作为用户，我希望阅读数据分析报告（年度统计、阅读热力图、习惯分析、读书笔记互动分析、聚焦分析）与原脚本一致，以便生成我的阅读报告。
26. 作为用户，我希望阅读报告可写入笔记或复制（原脚本行为），以便保存报告。
27. 作为用户，我希望报告章节完整保留：年度统计、作者统计、阅读速度分析、时间分布图表、习惯深度分析、阅读趋势（月度/季度平均/完成率/趋势方向）、热力图（月份网格/强度/颜色/tooltip）、聚焦分析（时间模式/一致性/总分/建议）、类别分析（多样性/平衡度/趋势/推荐/分布图）、笔记互动分析（思考比/参与度/模式/深度/连接度/图表/建议）、实用建议——各章节生成函数语义逐字一致。
28. 作为用户，我希望报告以 HTML 弹窗展示（showReportInPopup，含暗色模式适配、进度条与图表组件），以便与原脚本一致。
27. 作为用户，我希望书库设置保留 9 项：folderPath/notePath/bookTag + 显示开关 showFileSize/showReadingTime/showHighlights/showThinks/showReview/showCategory，以便沿用原配置。
28. 作为用户，我希望书库面板内有设置弹窗（openSettingsModal/closeSettingsModal 语义，就地改显示开关），以便不用离开面板调整。
29. 作为用户，我希望读书笔记支持高亮跳转（jumpToHighlight）、评论编辑（openEditCommentModal/updateComment）、删除高亮（deleteHighlight），以便精读管理。
30. 作为用户，我希望书目列表显示状态颜色（getStatusColors）与文件大小/阅读时间（formatFileSize），以便与原脚本一致。
31. 作为用户，我希望书库可生成阅读数据分析报告（互调 `show-reading-report`），以便一键出报告。
32. 作为用户，我希望读书笔记弹窗（📚《书》的读书笔记：高亮 ❝ 列表 + 日期 + 评论，支持跳转/编辑/删除）与原脚本一致，以便精读管理。
33. 作为用户，我希望书目卡片显示阅读进度（📊 %）、阅读时间（⏱️ 格式化）、文件大小（📦）、作者（✍️）、🧮 统计按钮，以便与原脚本一致。

### 影视（Movies）与影视数据分析（Movie Analytics）

27. 作为用户，我希望影视管理（`我的/影视` 目录、frontmatter 读写 fileManager.processFrontMatter、类型/状态筛选、排序、添加/编辑/删除）与原脚本一致，以便管理观影记录。
28. 作为用户，我希望影视.js 通过 `app.commands.executeCommandById('movie-analysis-open')` 打开影视数据分析，以便互调链路与原来一致。
29. 作为用户，我希望影视数据分析弹窗（状态分布、趋势等，目录路径语义改为模块共享）与原脚本一致，以便分析观影数据。
30. 作为用户，我希望数据分析的图表组件完整保留：统计卡片（statCardHTML）、条形图（barChartHTML）、环形图（donutChartHTML）、软条图（softBarHTML）、排行榜（topListHTML）、评分对比（ratingCompareListHTML）、内联统计（statInlineHTML），以便视觉与原脚本一致。
31. 作为用户，我希望评分分桶（ratingBucketOf）、空态（emptyHTML）、ESC 关闭（registerAnalysisEscape）与原脚本一致。
30. 作为用户，我希望影视目录变化（新增/修改/删除）时列表自动刷新（vault 三事件监听），以便无需手动刷新。
31. 作为用户，我希望影视列表支持无限滚动（setupInfiniteScroll）、星级评分（getStarRating）、类型颜色（getTypeColor）、标签分组（getGroupForTag），以便与原脚本一致。
32. 作为用户，我希望影视设置保留 folderPath/pageSize（分页大小）/enableQ3/posterFolder（海报目录），以便沿用原配置。
33. 作为用户，我希望影视数据分析的分析口径配置（groups/buckets/genres/ageBuckets/eras/durBuckets/groupDur/reviewKeywords/series/yearRating 十组）保留为设置项，以便自定义分析维度。
34. 作为用户，我希望 AI 推荐功能完整保留：基于观影历史构建口味画像（buildTasteProfile）→ AI 生成推荐（🧠 正在分析你的观影历史…）→ 推荐弹窗列表（含导演：、加入想看 按钮，quickAddWant 预填添加弹窗）→ 解析失败/生成失败错误提示（⚠️/❌），以便发现新片。
35. 作为用户，我希望影视状态枚举（在看/想看/已看等）、类型分组/颜色映射（TYPE_GROUPS/TYPE_COLORS）、📊 数据分析入口、🤖 AI 推荐入口、⚙️ 设置弹窗，以便与原脚本一致。

### 自动摘要（Auto Summary）

30. 作为用户，我希望插件启用后自动监听 `归档/网页剪藏` 新文件，AI 生成摘要与标签写回 frontmatter，以便剪藏内容自动整理。
31. 作为用户，我希望 AI 处理失败时静默降级（console.warn，不打断使用），以便不影响日常浏览。
32. 作为用户，我希望自动摘要可在设置中开关（常驻监听默认开启？以原脚本行为为准），以便控制资源占用。

### AI Agent（AIAgent）

33. 作为用户，我希望笔记 rename/delete 自动同步到备忘录/收藏本（引用路径/标题更新、关联清空），以便引用不失效。
34. 作为用户，我希望笔记 create/open 自动关联收藏本同名条目，以便减少手动维护。
35. 作为用户，我希望 AI 剪藏匹配（URL 精确匹配不中时）弹出批准确认，非 AI 操作静默直改，以便保持原权限模型。
36. 作为用户，我希望 AIAgent 与备忘录共享数据（memo.json），依赖备忘录实例（原 window.__memo 语义改为模块共享），以便同步可用。
37. 作为用户，我希望同步操作排队执行（enqueue 任务队列语义），以便并发事件不丢不冲突。
38. 作为用户，我希望 AI 剪藏匹配命中后支持归档（archiveItem 语义，归档到备忘录/收藏本），以便剪藏流程闭环。
39. 作为用户，我希望监听目录范围检查（inWatchedFolders 语义）与原脚本一致，以便只同步关注目录。

### 复习计划（Review Plan）与做题家（Quiz Master）

36. 作为用户，我希望复习计划面板（FSRS v4 算法、review.json 数据、每日复习队列）与原脚本一致，以便按记忆曲线复习。
37. 作为用户，我希望复习时支持「再次/困难/良好/简单」评级并更新下次复习时间，以便算法生效。
38. 作为用户，我希望复习计划右上角图标可调用做题家，以便复习做题一体化。
39. 作为用户，我希望做题家（quiz.json 统一题库、多选、完成状态、全完成自动替换笔记内容）与原脚本一致，以便继续做题。
40. 作为用户，我希望复习与做题共用数据文件（CONFIG/STORAGE/review.json、quiz.json），以便数据零迁移。
41. 作为用户，我希望复习计划可调用做题家（互调 `quiz-master-open`、`quiz-master-update`），以便复习做题一体化。
42. 作为用户，我希望复习计划监听相关事件（resolved/modify/rename/quit 四类，语义与原脚本一致），以便数据状态自动同步。
43. 作为用户，我希望移出复习计划时有确认弹窗（「确定移出“xxx”？」），以便防误操作。
44. 作为用户，我希望复习条目状态文案一致：✅ 已完成、R=X% 复习进度、📅 逾期、⏳ 待定/倒计时，以便一眼看出状态。
44. 作为用户，我希望做题家支持 AI 生成题目（createAI 依赖，缺失时提示「未检测到 Q3.js 的 AI 服务」同语义），以便自动出题。
45. 作为用户，我希望做题家设置保留 enableMultipleChoice（多选题开关）/questionsPerNote（每题数量）/difficulty（难度），以便沿用原配置。
46. 作为用户，我希望答题流程与原脚本一致：题目展示 → 提交答案 → 下一题 →（多选支持），以便沿用做题习惯。

### 闪念（Flash Thought）

41. 作为用户，我希望右侧窄窗（自动吸附缩起、悬停展开）与原脚本一致，以便快速记录闪念。
42. 作为用户，我希望相关笔记随光标浮现（向量检索，Ollama bge-m3 嵌入），以便写作时发现关联。
43. 作为用户，我希望闪念支持 AI 对话（Ollama qwen2.5 本地 / DeepSeek 远程，可配置 URL 与模型），以便与笔记对话。
44. 作为用户，我希望 Ollama 服务不可用时有明确提示而非崩溃，以便知道是环境问题。
45. 作为用户，我希望闪念的常驻监听可按设置开关，以便不需要时节省资源。
46. 作为用户，我希望闪念的 17 项设置全量迁移：OLLAMA_URL/EMBEDDING_MODEL/META_PATH/VEC_PATH/TOP_K/CHAT_TOP_K/CHUNK_MIN_LENGTH/ALLOW_PATHS/CONCURRENCY/CONTEXT_LIMIT/DEBOUNCE_DELAY/CURSOR_POLL_INTERVAL/OLLAMA_CHAT_MODEL/DEEPSEEK_MODEL/DEFAULT_USE_DEEPSEEK/MAX_HISTORY/OLLAMA_REMOTE_URL，以便精细调优。
47. 作为用户，我希望向量索引持久化（meta.json + vectors.vec 二进制文件，存 CONFIG/STORAGE），以便重启后检索不失效。
48. 作为用户，我希望笔记修改时向量增量重建（vault modify 监听 + 防抖 DEBOUNCE_DELAY），以便索引不过期。
49. 作为用户，我希望闪念的性能参数（chunk 切分长度、并发、光标轮询间隔、上下文限制、聊天历史上限）按设置生效，以便控制开销。
50. 作为用户，我希望移动端检测（IS_MOBILE 语义）与降级行为与原脚本一致，以便移动端可用时行为正确。
51. 作为用户，我希望 TF-IDF 检索保留（「✅ TF-IDF 就绪（N 段）」状态提示，与向量检索协同），以便无 Ollama 时也能基础检索。
52. 作为用户，我希望连接状态提示（✅ 远程 Ollama 已连接）与聊天界面（发送/··· 菜单、📚 🤖 按钮）与原脚本一致。

### 全局

46. 作为用户，我希望所有域的面板 DOM id/类名与原脚本一致，以便样式与既有习惯不变。
47. 作为用户，我希望所有域的数据读写格式与原脚本一致（零迁移），以便随时回退到 QuickAdd。
48. 作为用户，我希望插件在未配置 AI key / 未装 Dataview / 无 Ollama 时各域优雅降级（禁用或提示），以便不拖垮主应用。
49. 作为用户，我希望原脚本的域间全局状态（window.__memo/__quiz/__homeFilmStatus/__MOVIE_FOLDER_PATH/_bookSettings 等）改为模块级共享，语义不变，以便域间协作不受全局污染。
50. 作为用户，我希望原脚本的命令防重注册机制（window.__belongingsCommandRegistered/_newsCommandRegistered 语义）由插件生命周期管理取代（onload 注册一次/onunload 清理），以便无重复注册。

## Implementation Decisions

### 架构（ADR-0003 单插件多域）

- 一个插件 `memo-suite`；`src/core/` 完整移植 Q3（21 导出，内部模块不挂 window）；域间共享状态显式 import（影视数据分析的 folder path 从影视域模块取，取代 `window.__MOVIE_FOLDER_PATH`）
- 模块化单向依赖：core ← 域数据层 ← 域 UI ← main（沿用 ADR-0002）
- 懒加载：事件常驻域（自动摘要/AIAgent/闪念）按设置开关注册；UI 域首次打开初始化（沿用日记本 init 幂等模式）
- 主 ribbon 一个入口打开备忘录面板；其余域命令进入
- 构建：TS + esbuild，产物直出 vault `.obsidian/plugins/memo-suite/`；CSS 单独 `styles.css`

### 命令（ADR-0004）

- 全部命令沿用原脚本命令 id、`app.commands.addCommand` 裸注册（含影视数据分析 `movie-analysis-open` 等互调 id），卸载时清理；不设置默认 hotkeys
- 需要收集的原始命令 id 清单：从各脚本源码提取（`app.commands.addCommand` / `addCommand` 调用点）

### 外部依赖（ADR-0005）

- AI 配置（aiProvider/opencodeGoApiKey/override）入插件设置（data.json）；AIService 语义与 Q3 一致（override 字符串 'deepseek'/'opencode-go' 或对象 {endpoint,apiKey,model}）
- 聚合讯保留 dataviewjs 代码块写入，不自行渲染
- 闪念 Ollama：window.fetch 调 /api/embeddings、/api/embed、/api/chat；URL（本地 11434 与远程）与模型（bge-m3、qwen2.5:14b-instruct）可配置
- 自动摘要 AI：`ai.prompt(prompt, 'deepseek-v4-flash')` 语义保留
- 无 child_process 依赖（B站下载已出范围）；桌面/移动端差异无需处理

### 数据（零迁移）

- 全部数据沿用原位置与格式：`CONFIG/STORAGE/*.json`（memo/quiz/review/news/news-stats/belongings/passwords 等）、`我的/文章`、`我的/影视`、`书库/`、`我的/读书笔记`、`归档/网页剪藏`
- jsonStore 行为（原子写、锁）与 Q3 一致

### 事件监听

- 自动摘要：vault.on('create') 监听 `归档/网页剪藏` 新文件（目录前缀边界判断，防误触发）
- AIAgent：vault.on rename/delete/create/open 同步备忘录/收藏本
- 闪念：workspace 光标/活动文件事件驱动右侧窄窗

### 设置页

- 插件设置：AI（provider/key/endpoint/model）、各域路径（dataFolder/storagePath/todoFilePath 等）、常驻监听开关（自动摘要/AIAgent/闪念）、原有各脚本设置项逐一迁移
- 日记本已删除「标签配置/默认标签」设置的先例：设置项迁移以「保留原脚本可配置项」为原则，用户已确认删除的项不恢复

### 命令互调链完整清单（源码提取）

| 命令 id | 注册方 | 调用方 |
|---|---|---|
| `news-reader-open` | 聚合讯 | 剪藏本 |
| `show-reading-report` | 阅读数据分析报告 | 书库 |
| `movie-analysis-open` | 影视数据分析 | 影视 |
| `quiz-master-open`、`quiz-master-update` | 做题家 | 复习计划 |

### 事件监听完整清单（源码提取）

| 域 | 事件 | 行为 |
|---|---|---|
| 剪藏本 | vault modify | 文章修改自动刷新 |
| 影视 | vault modify/create/delete | 列表自动刷新 |
| 自动摘要 | vault create | 剪藏新文件 → AI 摘要写回 |
| AIAgent | vault rename/delete/create | 同步备忘录/收藏本 |
| 复习计划 | vault/workspace resolved/modify/rename/quit | 数据状态自动同步 |
| 闪念 | vault modify | 向量增量重建（防抖） |

### 域间共享状态（原 window.__ 语义 → 模块共享）

| 原全局 | 域 | 迁移方式 |
|---|---|---|
| `window.__memo` | 备忘录（AIAgent 依赖） | memo 域导出单例 |
| `window.__quiz` | 做题家（复习计划依赖） | quiz 域导出单例 |
| `window.__homeFilmStatus` | 影视 | 影视域模块状态 |
| `window.__MOVIE_FOLDER_PATH` | 影视/影视数据分析 | 影视域模块导出 |
| `window._bookSettings` | 书库 | 书库域模块状态 |
| `window.__belongingsCommandRegistered`、`_newsCommandRegistered` 等 | 命令防重 | 插件生命周期管理（onload 注册一次/onunload 清理），不再需要标志位 |

### 设置项总表（源码提取，插件设置页全量迁移）

- **备忘录（5）**：todoFilePath、scenarios、platformMapping、showFileName、autoPopupOnStart
- **归物本（2）**：dataFolder、customCategories
- **剪藏本（3）**：articleDirectory、batchSize、longPressDuration
- **密码本（4）**：storagePath、passwordCharset、passwordLength、securityMode
- **收藏本（1+）**：storagePath（favorites.json）
- **书库（9）**：folderPath、notePath、bookTag、showFileSize、showReadingTime、showHighlights、showThinks、showReview、showCategory
- **影视（4）**：folderPath、pageSize、enableQ3、posterFolder
- **影视数据分析（10 组分析配置）**：groups、buckets、genres、ageBuckets、eras、durBuckets、groupDur、reviewKeywords、series、yearRating
- **做题家（3）**：enableMultipleChoice、questionsPerNote、difficulty
- **闪念（17）**：OLLAMA_URL、EMBEDDING_MODEL、META_PATH、VEC_PATH、TOP_K、CHAT_TOP_K、CHUNK_MIN_LENGTH、ALLOW_PATHS、CONCURRENCY、CONTEXT_LIMIT、DEBOUNCE_DELAY、CURSOR_POLL_INTERVAL、OLLAMA_CHAT_MODEL、DEEPSEEK_MODEL、DEFAULT_USE_DEEPSEEK、MAX_HISTORY、OLLAMA_REMOTE_URL
- **AI 全局（Q3 语义）**：aiProvider、opencodeGoApiKey、override（endpoint/apiKey/model）

### 功能实现要点（源码提取）

- **密码生成器**：字符集（passwordCharset）+ 长度（passwordLength）+ 安全模式（securityMode）驱动的密码生成，加密存储（原脚本加密方案逐字移植），点击复制
- **闪念向量索引**：meta.json（文本元数据）+ vectors.vec（二进制向量）持久化于 CONFIG/STORAGE；chunk 切分（CHUNK_MIN_LENGTH）、并发（CONCURRENCY）、防抖（DEBOUNCE_DELAY）、光标轮询（CURSOR_POLL_INTERVAL）、上下文限制（CONTEXT_LIMIT）、聊天历史（MAX_HISTORY）、远程 Ollama（OLLAMA_REMOTE_URL）、DeepSeek 默认开关（DEFAULT_USE_DEEPSEEK）、移动端检测（IS_MOBILE）降级
- **做题家 AI 出题**：依赖 AIService（createAI），缺失时 Notice 提示（与原脚本同语义）
- **聚合讯统计**：news-stats.json 读写（recordStat/loadStats/saveStats），已读/跳过/检查新文章交互，markdown 渲染
- **书库**：面板内设置弹窗、高亮跳转、评论编辑、删除高亮、状态颜色
- **影视**：无限滚动、星级评分、类型颜色、标签分组
- **备忘录**：逾期状态显示、URL 提取/页面标题抓取
- **归物本**：排序弹窗、分类统计
- **样式**：各域注入样式全部收敛到 styles.css（聚合讯 196 行、备忘录 38 行、密码本 data-pw-styles、剪藏本/影视/闪念 injectStyles 等）

### 逐行对比补充要点（源码提取，第二批）

- **密码本主密码流程**：首次设置（再次输入确认）→ 解锁（输入主密码）→ 主密码驱动加密；条目字段（账号/密码/链接/日期/备注）+ 👁 切换 + 搜索 + 生成
- **备忘录**：AI 推荐场景（aiBtn/✨/⏳）、归档（archiveBtn）、课程字段（courseInput）、当前笔记/光标创建（getCurrentNoteInfo/getCurrentCursorPosition）、dueClear/posBtn/clipboardFocusHandler、标签点击
- **收藏本**：置顶（📌 置顶）、余额查询（API Keys 每行一个 + 余额查询 URL + 自动查找余额 + 查询中/刷新中/❌ 错误 + 刷新）、🧠 大模型配置弹窗、⏳ AI 整理中、编辑收藏、标签 emoji
- **影视 AI 推荐**：buildTasteProfile（口味画像）→ buildRecommendPrompt → parseRecommendJson → openRecommendModal（导演：/加入想看 quickAddWant 预填）→ ⚠️ 解析失败/❌ 生成失败；状态枚举（在看/想看/已看）+ TYPE_GROUPS/TYPE_COLORS
- **书库读书笔记弹窗**：showBookNotes（📚《书》❝ 高亮 + 日期 + 评论）+ parseBookNotes + jumpToHighlight + openEditCommentModal/updateComment/deleteHighlight；阅读进度 %/时间格式/🧮 统计
- **阅读数据分析报告章节**（80+ 生成函数，逐字保留）：年度/作者/速度/时间分布/习惯/趋势（月季平均/完成率/方向）/热力图（月份网格/强度/颜色/tooltip）/聚焦（5 维度+总分+建议）/类别（多样性/平衡/趋势/推荐/分布图）/笔记互动（思考比/参与度/模式/深度/连接度/图表/建议）/实用建议；showReportInPopup（HTML 弹窗 + 暗色模式 + 进度条/图表）
- **影视数据分析图表组件**：statCardHTML/barChartHTML/donutChartHTML/softBarHTML/topListHTML/ratingCompareListHTML/statInlineHTML；ratingBucketOf 评分分桶；emptyHTML/registerAnalysisEscape
- **闪念 TF-IDF**：「✅ TF-IDF 就绪（N 段）」——TF-IDF 与向量（bge-m3）协同检索（Ollama 不可用时 TF-IDF 兜底）；✅ 远程 Ollama 已连接提示；聊天 UI（发送/···/📚/🤖）
- **AIAgent**：enqueue 任务队列、archiveItem 归档、inWatchedFolders 监听范围
- **复习计划状态文案**：✅ 已完成/R=X%/📅 逾期/⏳ 待定；难度字段（difficulty）
- **做题家答题流程**：题目展示 → 提交答案 → 下一题 →（多选）
- **剪藏本**：attachFileListener 文件监听、✍️ 作者/📌 反链（去《》书名号）/全部 (N) 计数、initScroll 滚动加载、renderEmpty 空态
- **聚合讯**：👤 作者/📅 日期、renderDoneState 完成态、toDatetime
- **归物本**：refreshBtn 刷新、卡片点击交互

### 已知待收集信息（实现时从源码提取，不阻塞本 spec）

- 各脚本 changelog identifier 清单（已确认：belongings；其余实现时收集）
- 备忘录场景列表/平台映射（DEFAULTSCENARIOS/DEFAULT_PLATFORM_MAP）与 Q3 常量定义位置
- 各域 DOM id/类名清单（面板容器、弹窗、按钮）

## Testing Decisions

延续日记本测试栈（用户已确认的缝布局）：

- **测试栈**：vitest + jsdom；resolve.alias 将 `obsidian` 指向 mock 入口（命名导出）；MockVault 内存文件树（dirs.add 显式注册空目录区分「空目录」与「不存在」）
- **纯函数缝**：FSRS v4 算法（评级→状态/间隔/下次复习时间流转，错一天边界）、做题家全完成替换逻辑、各域 parser、Q3 工具（formatRelativeTime/formatFileSize/extractUrlAndDisplay）
- **数据层缝**：各域 store（目录扫描、jsonStore 读写、frontmatter 解析、事件回调注册）
- **mock fetch 缝**（新增）：AIService 请求（DeepSeek/OpenCode 端点）、Ollama /api/embeddings、/api/embed、/api/chat——mock 响应断言调用参数与降级行为
- **事件触发缝**（新增）：MockVault 触发 create/rename/delete 事件，断言自动摘要（新文件→摘要写回）与 AIAgent（rename→引用更新、delete→关联清空）
- **UI jsdom 缝**：各域面板渲染 + 交互（备忘录 todo 增删勾选、剪藏本筛选排序、闪念窄窗吸附/展开）
- **真实数据集成缝**：真实 vault 文件跑通核心链路（剪藏本读 `我的/文章`、书库读 `书库/`、备忘录读 memo.json）
- **测试原则**：只测外部行为（渲染结果、数据落盘、事件副作用），不测实现细节；每批交付时 UI 与逻辑对照原脚本逐项验收

## Out of Scope

- **B站下载**：独立插件另行规划（源码调研已完成：child_process 机制、ffmpeg/whisper 集成已验证可行）
- **QAI.js、写诗.js、工具箱.js、番茄钟.js、卢曼卡片笔记.js**：不在清单，本次不迁移
- **Dataview 渲染本身**：聚合讯生成的代码块由 Dataview 插件渲染，不测试/不实现渲染层
- **日记本（diary-notebook）**：已交付，本次仅共享 core 演进时保持兼容（core 复制到 memo-suite，暂不抽公共包）
- **移动端**：不做移动端专项适配（原脚本亦无）
- **快捷键迁移**：不自动迁移用户热键（Obsidian 层面无法迁移），用户自行在设置中绑定

## Further Notes

- 迁移批次（每批交付即对照原宏验收）：0) core+骨架；1) 备忘录/归物本/密码本；2) 剪藏本/聚合讯/自动摘要/收藏本；3) 书库/阅读数据分析/影视/影视数据分析；4) 复习计划/做题家/闪念/AIAgent
- 原脚本与 QuickAdd 环境在迁移期间并存：验收完成前用户可随时回退
- core 层的 AIService/changelog/jsonStore 是 B站下载独立插件与后续任何脚本迁移的共享基础，移植时保持 Q3 语义逐字一致
- 闪念依赖 Ollama 服务，验收需用户本机 Ollama 运行（bge-m3 + qwen2.5 模型）
