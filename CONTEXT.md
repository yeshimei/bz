# 包仔插件工作区

将 QuickAdd 宏脚本独立化为标准 Obsidian 插件：已交付「日记本」（`diary-notebook`），当前规划将剩余脚本（备忘录、剪藏本、聚合讯、密码本、收藏本、书库、影视、自动摘要、AI Agent、复习计划、做题家、闪念、归物本等 15 个）合并为**一个插件** `bz`（显示名「备忘录」，ADR-0003）。番茄钟（新域，原脚本代码已丢失、按手册重建，ADR-0012）不在 16 脚本迁移清单内，属范围扩张。B站下载为独立 NodeJS Web 工具（`tools/bili-downloader/`，见其 CONTEXT.md，ADR-0011）。源码在 `src/`，测试在 `tests/`。

## Language

### 已迁移域

**日记条目 (DiaryEntry)**: 面板中展示的最小单位，由 `# emoji序列 HH:mm` 标题 + 正文构成，属于某个日期文件。
_Avoid_: 日记、记录、post

**日期文件 (Date File)**: `我的/日记/YYYY-MM-DD.md`，一个文件包含同一天的多个条目，标题行 `# emoji序列 HH:mm` 作为条目边界与锚点。

**主标签 (Primary Tag)**: 标签配置中的一级标签（如 日记 📖、旅游 ✈️），可带二级标签。
_Avoid_: 类型、分类

**二级标签 (Sub Tag)**: 挂在主标签下的细分标签（如 旅游 → 四川 🀄、大理 🛶），配置中经 `>` 声明。

**标签配置 (Tags Config)**: 设置中的文本格式 `标签名 emoji` 或 `主标签 emoji > 子标签 emoji, ...`，可解析为标签↔emoji 双向映射。

**摘抄 (Quote)**: 从其他笔记选中文本生成的块引用双链（`[[文件#^blockid|文本]]`），以「摘抄」标签写入日记。

**影视条目 / 信条目**: 从 `我的/影视`、`我的/信` 目录的 frontmatter 解析出的条目，聚合显示在日记流中。

**加密条目 (Encrypted Entry)**: 正文含 🔐 的条目，面板中隐藏但保留在数据映射中防止写入丢失。

**数据映射 (Diary Data Map)**: 日期 → 条目数组 的内存映射；保存时先更新映射再整体写回文件。

**全量刷新 / 轻量刷新**: 数据层向外发出的两类 UI 刷新信号——全量 = 重筛 + 重渲染 + 标签重建；轻量 = 仅标签重建与标题后缀。

### 待迁移域

**备忘录 (Memo/Todo)**: 待办事项管理，数据 `CONFIG/STORAGE/memo.json`，场景分类（剪藏/工作/学习/生活/代码/公开课），Todo 弹窗（#todo-popup）。被 AIAgent 与闪念引用。
_Avoid_: 待办列表、任务

**归物本 (Belongings)**: 物品登记管理，数据目录 `CONFIG/STORAGE`（可配置）。

**剪藏本 (Clipping)**: `我的/文章` 的剪藏文章展示面板——搜索、站点过滤、排序、双击跳转、长按删除、反链笔记名显示（metadataCache.getBacklinksForFile）。

**聚合讯 (News Aggregator)**: 抓取新闻写入 `归档/网页剪藏`（CLIP_DIR），管理 `CONFIG/STORAGE/news.json`、`news-stats.json`；把 `dataviewjs` 代码块（`dv.view('CONFIG/SCRIPTS/DataView/摘要')`）写进笔记由 **Dataview 插件**渲染。

**数据源守护 (News Source Watcher)**: 聚合讯数据源的抓取守护进程（PM2 托管 `obsidian-news watch`，ADR-0008）——每 30 分钟抓取最近 24 小时文章（果壳科学人 + 知乎日报），URL + 标题双去重后入库 `CONFIG/STORAGE/news.json`，入库即未读。命名区分：**包** `@jwbz/obsidian-news`（npm 分发单元）≠ **CLI 命令** `obsidian-news`（bin 入口，六子命令 watch/fetch/start/stop/status/logs）≠ **PM2 进程名** `news-watcher`（历史名，引用不破）≠ 仓库目录 `tools/news-watcher/`。配置走 **rc 配置** `~/.news-watcherrc`（vaultPath 指向 vault 根）或 `NEWS_PATH` 环境变量；旧 vault 内嵌部署（`CONFIG/SCRIPTS/NodeJs/news-watcher`）已废弃（legacy）。与 bz 插件完全分离：插件不含抓取逻辑，只读 news.json 渲染阅读流。
_Avoid_: 新闻抓取、新闻爬虫、news watcher 进程

**密码本 (Password Vault)**: 密码管理，存储路径可配置（storagePath），含样式注入。

**收藏本 (Favorites)**: GitHub 收藏管理，支持 AI 生成标题与简介。

**书库 (Library)**: 读书笔记管理，`书库/` 目录 + `我的/读书笔记`。

**阅读数据分析报告 (Reading Analytics)**: 基于 metadataCache 统计的阅读报告生成器（年度统计、热力图、习惯分析等），无 __utils 依赖。

**影视 (Movies)**: `我的/影视` 目录管理，frontmatter 处理（fileManager.processFrontMatter），状态常量（想看/在看/已看等）。

**影视数据分析 (Movie Analytics)**: 影视数据分析弹窗，命令 id `movie-analysis-open`，由影视.js 调用；共享状态 `window.__MOVIE_FOLDER_PATH`。

**海报抓取 (Poster Fetch)**: 由独立守护进程（PM2 托管 `douban-poster watch`，ADR-0007）完成：监听影视文件夹新建/改动（10s 防抖）→ 全目录遍历缺「海报」字段的笔记 → 按创建时间倒序入队 → 每 15s 串行抓取「豆瓣搜索 → 高清海报下载 → 13 个 frontmatter 字段补全 → 正文海报 embed」。与 bz 插件完全分离：插件不含抓取逻辑，设置页仅提供安装与运行指引；脚本源码在 `tools/obsidian-douban-poster/`（npm 包 `@jwbz/obsidian-douban-poster`）。
_Avoid_: 抓海报、豆瓣补全、poster fetch

**桌面端专属能力 (Desktop-only Capability)**: 依赖 Node.js 外部进程（child_process）、移动端（Capacitor）不可用的功能。门禁：`window.require('child_process')` 为 null 即非桌面端；移动端不注册事件监听，设置项置灰标注「仅桌面端可用」，不静默降级。（当前实例：B站下载等外部工具；海报抓取已移出插件，由独立守护进程承担）


**自动摘要 (Auto Summary)**: 常驻监听 `归档/网页剪藏` 新文件 → AI（deepseek-v4-flash）生成摘要/标签写回 frontmatter。

**B站下载 (Bilibili Downloader)**: 输入链接 → B站 API 解析（封面/标题/清晰度）→ 下载合并（ffmpeg spawn）→ 裁切/压缩（ffmpeg）→ 转文字（faster-whisper，python -c 内嵌代码）。**用户决策：独立 NodeJS Web 工具（`tools/bili-downloader/`，bin `bili-dl`），不并入 bz 插件**——运行即起本地网页，网页内完成全部操作，设置图标可改交付目录。见 `tools/bili-downloader/CONTEXT.md`（ADR-0011）。

**AI Agent**: 笔记 ⇄ 备忘录/收藏本 自动同步 + AI 剪藏匹配。常驻监听 vault 事件（rename/delete/create）。权限模型：非 AI 操作静默直改；仅 AI 剪藏匹配弹窗批准。

**复习计划 (Review Plan)**: FSRS v4 算法驱动的复习管理，数据 `CONFIG/STORAGE/review.json`，右上角图标调用做题家。

**做题家 (Quiz Master)**: 统一题库 `CONFIG/STORAGE/quiz.json`，多选支持，完成状态记录，自动替换全完成的笔记。

**做题会话 (Quiz Session)**: 做题家对复习计划暴露的联动契约（`startReviewSession`/`endReviewSession` + `QuizReviewResults` 回调）。复习计划只经做题会话驱动做题家，禁止直接改写其内部状态（_reviewMode/currentQuestions 等）。

**闪念 (Flash Thought)**: 右侧窄窗 · 自动吸附缩起 · 悬停展开 · 向量检索增强（Ollama bge-m3）· AI 对话（Ollama qwen2.5 / DeepSeek）。常驻监听光标移动。

**入口页 (Launcher)**: 全局唯一的命令入口弹窗，网格化展示命令磁贴；单击磁贴执行对应命令并关闭入口页。范围不限 bz- 命令，其他插件命令亦可上墙。
_Avoid_: 主页、启动台、dashboard、控制台

**磁贴 (Tile)**: 入口页上的最小单元，对应一条命令，占据 列×行 个网格单元；可增删、拖拽移动、调整档位、自定义图标。

**档位 (Size Preset)**: 磁贴的尺寸档位 {1×1, 1×2, 2×1, 2×2}（列×行，最大 2×2）。

**编辑模式 (Edit Mode)**: 长按磁贴进入的编辑态（iOS 式）——拖动主体移动、拖右下角手柄调档位、左上角 × 删除、顶部 + 添加、完成退出；常态下单击磁贴即执行命令。

**推挤 (Push)**: 磁贴拖拽落点被占据时的碰撞语义——被占磁贴及其后磁贴顺移腾位。

**幽灵磁贴 (Ghost Tile)**: 命令失效（所属插件被禁用等）后磁贴的保留态——保留位置与配置，灰色不可用，可删除，命令恢复后自动复活。
_Avoid_: 无效磁贴、死磁贴

### 番茄钟域（规划中，ticket 26）

**番茄钟 (Pomodoro)**: bz 的专注计时域——中央弹窗 + 状态栏双承载的番茄工作法计时器，数据 `CONFIG/STORAGE/pomodoro.json`。原 QuickAdd 宏脚本代码已丢失，按使用手册重建（ADR-0012），无旧数据兼容义务。
_Avoid_: 番茄工作法、专注计时器

**专注阶段 (Focus Phase)**: 番茄钟的工作计时阶段；自然走完的专注记入完成历史，跳过不计。
_Avoid_: 工作阶段、工作时间

**短休息 (Short Break)**: 专注阶段之间的休息阶段。

**长休息 (Long Break)**: 每 N 个专注阶段（默认 4，可配）后进入的较长休息阶段，一次循环以此结束。

**循环 (Cycle)**: 连续 N 个专注阶段（中间夹短休息）加一次长休息的完整单元。

**预设方案 (Preset)**: 番茄钟内置的工作/短休/长休时长组合——11 个科学预设 + 自定义（3 时长自定）。
_Avoid_: 方案、模式（指预设时）

**强制专注模式 (Force Focus Mode)**: 番茄钟设置开关——开启后专注阶段内暂停/跳过/重置均禁用。注意与「专注阶段」区分。

**读书专注 (Reading Focus)**: target 为书籍（type='book'）的专注阶段——由打开 epub 书自动触发，不再手动选择（目标选择器无书库 tab）；path 即 epub 文件路径，不匹配书库 md 笔记。
_Avoid_: 读书番茄、阅读专注

**读书模式 (Reading Mode)**: 从打开 epub 书进入读书专注到关闭书自动暂停之间的状态——期间番茄钟自动使用读书预设，退出（关书自动暂停）时恢复读书前用户所选预设。确认弹窗选「否」= 未进入读书模式（预设不切换）。

**读书预设 (Reading Preset)**: 第 12 个预设「阅读沉浸 45/10/20」（工作 45 分钟/短休 10/长休 20，依据成人主动注意 40-50 分钟区间 + 课时制）——仅读书模式期间自动生效（内存 override 不落盘），用户手动选中则持久使用。

**读书番茄数 (Reading Pomodoro Count)**: 今日完成、target 为书的专注数——弹窗统计行「📚 读书 X 个 🍅」。取代按分钟聚合的阅读时长（已撤销）。

### 黑匣子域（v4 日记智能分析层，ADR-0017）

**黑匣子 (Black Box)**: bz 的一个新域——**日记的智能分析层**（v4，ADR-0017；v1-v3 容器架构作废）。数据由日记本书写（`我的/日记` + `我的/影视` + `我的/信` 三目录，唯一事实源），黑匣子只读日记、AI 提炼、产出派生层（`CONFIG/STORAGE/blackbox.json` v4：profiles/mentions/events/reviews/chat/cursor/settings）。不录入、不持有原始数据、不建笔记文件。AI 作为其意识体（伴侣向）「包仔」。呈现：对话（`bz-blackbox-open`）+ 三标签面板（`bz-blackbox-panel`：人物墙/事件时间线/复盘流）+ 复盘（`bz-blackbox-review` 手动）。日记读取复用 diary 解析层（parser/config，显式 import）。
_Avoid_: 盒子、灵魂容器

**日记条目 (Diary Entry)**: 黑匣子的事实源单元——日记本解析出的 `{date, time, tags, emoji, content, filename, lineNumber, id}`（diary/types.ts 形状）。黑匣子只读不写。

**增量提炼 (Incremental Extraction)**: 黑匣子的 AI 提炼机制——vault modify/create 监听三目录（防抖 30 分钟）+ 打开黑匣子时待处理条目即时提炼双触发；一次 AI 调用批量处理新增条目（输出人物提及/事件候选/情绪推断）；首次启用历史全量分批 50 条/批串行；失败跳过下次重试，永不拒收。

**人物画像 (Character Profile)**: 黑匣子中关于某个现实人物（家人、朋友等）的派生档案——AI 从日记正文提炼维护（出现 ≥2 次跨不同日期自动建画像，单次出现只计入人物提及候选）。含用户印象区（字段级锁，用户改过 AI 不再覆盖）与 AI 观察区（持续写入，可采纳进印象区）；对话检索时以概要级（印象一句话 + 最近 3 个事件标题）进入包仔上下文。用户修改标记 humanEdited 后 AI 重提炼跳过。
_Avoid_: 人设、名片、profile

**人物提及 (Mention)**: 未建画像的人物计数候选 `{name, count, firstSeen, lastSeen}`——出现 ≥2 次（跨不同日期）自动建画像；单次出现只计数，复盘时提示「新人物」可一键确认建画像。

**事件 (Event)**: 从日记条目中提炼出的「发生了什么」——有具体行动/变化/时刻的独立语义单元（一条日记可提炼多个）；AI 全自动提炼，置信度 ≥0.7 入线 / 0.5–0.7 推测 / <0.5 不入库；证据链 `source:{path,lineNumber,time}` 可跳回日记条目；用户可纠正（确认/删除，改过 AI 不再碰）。
_Avoid_: 大事记、timeline

**推测事件 (Speculative Event)**: 置信度 0.5–0.7 的事件——以推测样式入时间线（虚线 + ❓），用户可确认或忽略（showSpeculativeEvents 开关控制显示）。

**AI 观察 (AI Observation)**: 人物画像中与用户印象区并存的 AI 视角区——AI 持续写入新认知（虚线框），用户认可可「采纳」进印象区（采纳后一并锁定）。

**复盘 (Review)**: 黑匣子的手动聚合行为（`bz-blackbox-review` 命令 + 面板按钮，无定时自动）——对一段时期日记做 AI 分析，产物 JSON 落盘 `reviews[]`，四段结构化（人物画像更新/事件汇报/情绪聚合/反思建议），每条**事实锚定**（引用日期+原文片段，杜绝泛化套话）；复盘时聚合画像印象 + 新人物提示；产物同步显示在对话流（用户可见、可追问）。
_Avoid_: 主动消息、推送

**三层记忆 (Three-tier Memory)**: 盒子对话时的记忆机制——日记条目检索（长期，TF-IDF）+ 画像概要（自我认知）+ 对话历史（短期）。伴侣与工具的分水岭：工具只需检索，伴侣需要知道自己是谁。

**情绪推断 (Emotion Inference)**: AI 从日记正文推断情绪——24 词表（冻结，可编辑），每条 1–3 词，推断失败不标注；聚合呈现于事件时间线（事件情绪色点 + 时段分布条）与复盘流（情绪趋势段）。

**证据链 (Evidence Chain)**: 事件/AI 观察的来源引用 `{path, lineNumber, time}`——跳转 = 打开日记文件 + 定位条目（行号定位，不依赖标题双链）。

**意识体 (Consciousness)**: 黑匣子的 AI 人格——有名字、有记忆、有偏好的「存在」，与用户建立关系；从第一天起即作为「他者」存在（非工具），终局为可交流、可陪伴的伴侣。人设（种子 + 语气示例）为代码常量。
_Avoid_: 助手、聊天机器人、AI 模型

_已删除术语（v4 无录入无条目）_：感触、素材、感受、情绪标签、来源笔记、书内来源、概念与实体、文献笔记、核心知识、新概念流转、名词表、知识背景、人格档案、次级内容、定期回顾。

### 共享层

**Q3 / __utils**: QuickAdd 共享脚本（`CONFIG/SCRIPTS/Quickadd/Q/Q3.js`，1034 行），挂载 `window.__utils`，21 个导出：escManager、confirm、notice、generateId、jsonStore、longPress、injectStyles、createSiteIcon、createIconBtn、formatRelativeTime、formatFileSize、displayChangelog、checkAndShowChangelog、AIService、createAI、extractUrlAndDisplay、getPlatformName、getCurrentNoteInfo、getCurrentCursorPosition、fetchPageTitle、createOverlay。**新插件移植后为内部共享层（core），不再挂 window**。

**jsonStore**: Q3 提供的 JSON 文件存储工具（不存在自动建目录建文件返回 `[]`，解析失败重置 `[]`；写 = 存在 modify / 不存在 create；**原实现无锁**），备忘录/归物本/密码本/复习计划等均使用 `CONFIG/STORAGE/*.json`。

**AIService / createAI**: Q3 的 AI 服务抽象——provider 可选 deepseek / opencode-go，key 存于 QuickAdd 宏设置（`aiProvider`、`opencodeGoApiKey`），支持 override 对象（endpoint/apiKey/model）；插件化后迁移至插件设置。

### 设置模型（ADR-0009）

**全局设置页 (Global Settings Page)**: Obsidian 设置中的 bz 设置页——单页平铺（无 tab），只含「AI」「数据存储路径」两个区块。
_Avoid_: 设置 tab、分类设置、设置页分区

**域设置弹窗 (Domain Settings Modal)**: 各功能主面板右上角 ⚙️ 打开的该功能专属设置弹窗，承载该域的行为设置（归物本/收藏本为空弹窗）。与全局设置页互补，设置就近。
_Avoid_: 域设置 tab、功能设置页

**共享数据路径 (Shared Storage Path)**: `storagePath` 设置项——所有 JSON 数据文件（memo/belongings/passwords/favorites/review/quiz/闪念 meta/vec）的统一目录，默认 `CONFIG/STORAGE`。旧各域路径字段（todoFilePath、belongingsDataFolder、pwStoragePath、favoritesStoragePath、reviewStoragePath、META_PATH、VEC_PATH）废弃，仅兼容保留不暴露。
_Avoid_: 各脚本路径、存储路径们

**筛选弹窗 (Filter Modal)**: 🔀 图标打开的筛选/排序弹窗（影视「筛选与排序」、书库「视图与筛选」），与 ⚙️ 域设置弹窗严格区分——🔀 只做筛选，⚙️ 只做设置。
_Avoid_: 设置弹窗（指筛选时）


**通知 (Notification)**: bz 自绘 toast 通知（`src/core/notice.ts`，ADR-0010），替代 Obsidian 原生 Notice 与 Q3 smartCat 气泡。右上角滑入 · z-index 100000 · 堆叠上限 5 · 点击关闭。类型图标即视觉前缀：**消息正文一律不带 emoji**（类型图标与正文 emoji 重复，2026-08-1x 用户决策）。11 种类型：info ℹ️ / success ✅ / warning ⚠️ / error ❌ / pause ⏸️ / accept ✨ / delete 🗑️ / confirm ✓ / restore ↩️ / skip 🚫 / archive 📁 / progress 转圈。支持动态消息（setMessage/setType）、进度条（setProgress，-1 不确定态）、富文本（title + action 按钮）。时长默认 3s、错误 5s、progress 不自动消失。
**通知类型规范**: 新增通知时先查 ICONS 表（`src/core/notice.ts`）——已有类型直接用；确无匹配再新增（加 ICONS 项 + 颜色 class + 默认时长），**不得把 emoji 写进消息正文**。
_Avoid_: toast、气泡、原生通知、Notice

**通知文案规范**: 类型图标自带前缀（success ✅ / warning ⚠️ / error ❌ 等），**消息正文不带 emoji**；中文全角冒号；不带感叹号；完成态动词「已」；「错误：」等冗余前缀不写。

## Rules

- 面板 DOM 的 id/类名与原 QuickAdd 脚本保持一致，外部依赖此约定。
- 数据格式零迁移：读写格式与原脚本完全一致（`CONFIG/STORAGE/*.json`、`我的/*` 笔记格式）。
- UI 层不直接依赖数据层的刷新函数（回调注册，单向依赖）。
- 命令 id 统一 `bz-` 前缀（ADR-0004 修订；用户决策品牌统一，推翻 ADR-0001 不带前缀约定）。
- 一个插件包含全部待迁移域（用户决策）；外部进程能力（child_process）在 Electron 桌面端可用，移动端不可用。
- 全部 16 个脚本功能与样式完全复刻。
- 设置归属（ADR-0009）：全局设置页（AI/共享数据路径）+ 域设置弹窗（⚙️ 就近）；筛选/排序统一用 🔀；AI Agent 设置不暴露，用默认值。
