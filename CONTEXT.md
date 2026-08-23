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

**剪藏本 (Clipping)**: `我的/文章` 的剪藏文章展示面板——搜索、站点过滤、排序、反链笔记名显示（metadataCache.getBacklinksForFile）。交互（ticket 69 重构）：**单击整卡直接打开**文章（五域首例单击直开）、**移动端长按整卡弹统一抽屉**（打开/复制双链/复制原文链接/删除）；反链📌保留列表直点跳转；桌面右键弹跟手菜单（全局组件）。

**聚合讯 (News Aggregator)**: 抓取新闻写入 `归档/网页剪藏`（CLIP_DIR），管理 `CONFIG/STORAGE/news.json`、`news-stats.json`；把 `dataviewjs` 代码块（`dv.view('CONFIG/SCRIPTS/DataView/摘要')`）写进笔记由 **Dataview 插件**渲染。

**数据源守护 (News Source Watcher)**: 聚合讯数据源的抓取守护进程（PM2 托管 `obsidian-news watch`，ADR-0008）——每 30 分钟抓取最近 24 小时文章（果壳科学人 + 知乎日报），URL + 标题双去重后入库 `CONFIG/STORAGE/news.json`，入库即未读。命名区分：**包** `@jwbz/obsidian-news`（npm 分发单元）≠ **CLI 命令** `obsidian-news`（bin 入口，六子命令 watch/fetch/start/stop/status/logs）≠ **PM2 进程名** `news-watcher`（历史名，引用不破）≠ 仓库目录 `tools/news-watcher/`。配置走 **rc 配置** `~/.news-watcherrc`（vaultPath 指向 vault 根）或 `NEWS_PATH` 环境变量；旧 vault 内嵌部署（`CONFIG/SCRIPTS/NodeJs/news-watcher`）已废弃（legacy）。与 bz 插件完全分离：插件不含抓取逻辑，只读 news.json 渲染阅读流。
_Avoid_: 新闻抓取、新闻爬虫、news watcher 进程

**密码本 (Password Vault)**: 密码管理，存储路径可配置（storagePath）。样式在 `src/password/styles.css`（铁律 9 按域拆分，原「含样式注入」口径废止）。

**收藏本 (Favorites)**: 通用链接收藏管理（GitHub 🐙/桌面软件 💻/网站 🌐/大模型 🧠 等 9 类固定标签），数据 `CONFIG/STORAGE/favorites.json`；大模型条目带余额查询（5 分钟缓存）。列表手势收敛为**仅整卡长按弹统一抽屉**（动作序：打开 → 置顶 → 跳转笔记 → 刷新余额 → 编辑 → 删除；标题纯文本、余额纯展示）；添加/编辑共用一个弹窗，保存后若从抽屉进入则连抽屉一并关闭。
_Avoid_: GitHub 收藏管理（旧口径，实际已泛化到全部链接类型）

**AI 整理 (AI Tidy)**: 收藏本添加弹窗内的字段整理动作（按钮 ✨ AI 整理）——按已输入内容补全标题/链接/简介并从固定标签中选标签；GitHub 仓库链接先经 GitHub API 取真实仓库信息（仓库名预填标题、简介忠实翻译成中文、强制含 GitHub 标签）。反馈走动态消息模板（progress「AI 分析中…」→ 阶段 setMessage → success/error），与影视 AI 荐片同一套。
_Avoid_: AI 推荐（旧名，名不符实——它整理字段而非推荐内容）

**书库 (Library)**: 读书笔记管理，`书库/` 目录 + `我的/读书笔记`。

**书库 EPUB 条目**: 书库中由 Weave 阅读数据文件（`weave-data.json`）驱动的 EPUB 书目条目，与 markdown 书目条目**并列、互不影响**（同名书不合并）。数据不经现场解析 EPUB，直接读数据文件；字段契约以 Weave 侧为准（见 fork-weave-src `docs/adr/043`）。
_Avoid_: EPUB 电子书条目——指聚合列表中的书目条目（不要与「影视条目/信条目」混淆）

**Weave 数据路径**: bz 设置中指向 Weave 阅读数据文件（`weave-data.json`）所在数据路径的设置项；书库据此读取 EPUB 书目数据。Weave 未启用或路径失效时 EPUB 条目静默缺省，markdown 部分照常。

**阅读数据分析报告 (Reading Analytics)**: 基于 metadataCache 统计的阅读报告生成器（年度统计、热力图、习惯分析等），无 __utils 依赖。自 ADR-0013 扩展一起，报告已并入 EPUB 书目（全库 weave 书、不筛目录；缺字段按报告口径补齐后并入同一张报告）。

**EPUB 读书笔记**: 书库 EPUB 条目的读书笔记弹窗——划线（`text`）+ 想法（`commentText`）按章节（`chapterTitle`，缺省「第 N 章」）分组的只读视图。单击封面打开；双击划线块经 `weave-cfi` 深链跳回原书；长按内容编辑想法、长按日期删除划线（见「EPUB 想法编辑」）。
_Avoid_: 与 markdown 读书笔记（读 `我的/读书笔记` 笔记文件建树）混淆——EPUB 版直接读 weave-data

**EPUB 想法编辑**: 修改/删除 EPUB 划线想法时 bz **直接改 weave-data.json**（ADR-0013 的唯一写例外，不动其他结构；写前重读最新文档）。用户决策：不走 Weave 命令桥。
_Avoid_: 把「想法编辑」当成 bz 直写的一般能力——只此两处写入口，其余仍只读

**影视 (Movies)**: `我的/影视` 目录管理，frontmatter 处理（fileManager.processFrontMatter），状态常量（想看/在看/已看等）。

**影视数据分析 (Movie Analytics)**: 影视数据分析弹窗，命令 id `movie-analysis-open`，由影视.js 调用；共享状态 `window.__MOVIE_FOLDER_PATH`。

**海报抓取 (Poster Fetch)**: 由独立守护进程（PM2 托管 `douban-poster watch`，ADR-0007）完成：监听影视文件夹新建/改动（10s 防抖）→ 全目录遍历缺「海报」字段的笔记 → 按创建时间倒序入队 → 每 15s 串行抓取「豆瓣搜索 → 高清海报下载 → 13 个 frontmatter 字段补全 → 正文海报 embed」。与 bz 插件完全分离：插件不含抓取逻辑，设置页仅提供安装与运行指引；脚本源码在 `tools/obsidian-douban-poster/`（npm 包 `@jwbz/obsidian-douban-poster`）。
_Avoid_: 抓海报、豆瓣补全、poster fetch

**桌面端专属能力 (Desktop-only Capability)**: 依赖 Node.js 外部进程（child_process）、移动端（Capacitor）不可用的功能。门禁：`window.require('child_process')` 为 null 即非桌面端；移动端不注册事件监听，设置项置灰标注「仅桌面端可用」，不静默降级。（当前实例：B站下载等外部工具；海报抓取已移出插件，由独立守护进程承担）


**自动摘要 (Auto Summary)**: 常驻监听 `归档/网页剪藏` 新文件 → AI（deepseek-v4-flash）生成摘要/标签写回 frontmatter。

**B站下载 (Bilibili Downloader)**: 输入链接 → B站 API 解析（封面/标题/清晰度）→ 下载合并（ffmpeg spawn）→ 多段剪辑（对一个下载原件定义 0..N 段落，时间 0.1s/HH:MM:SS(.S)）/合并（段序拼接）/压缩（ffmpeg，产物 ffprobe 校验兜底，交付模式：分开、每段一个；合并、单文件）→ 转文字（faster-whisper，python -c 内嵌代码）。**用户决策：独立 NodeJS Web 工具（`tools/bili-downloader/`，bin `bili-dl`），不并入 bz 插件**——运行即起本地网页，网页内完成全部操作，设置图标可改交付目录。术语见 `tools/bili-downloader/CONTEXT.md`（ADR-0011）。

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

**后台自动暂停 (Auto-pause on Hide)**: 番茄钟设置开关（默认开，ticket 62）——Obsidian 窗口因 `visibilitychange` 进入 hidden（最小化/遮挡/系统休眠）时，主番茄钟暂停冻结；恢复 visible 且原本运行中 → 自动继续。仅认 hidden，blur 失焦不触发（锁屏/全屏切走等 hidden 抓不到的缝隙接受，记已知限制）。手动暂停永不被自动覆盖。

**不补算 (No Backfill)**: 番茄钟恢复规则（ticket 62）——Obsidian 关闭/重启期间的时间一律不折算成历史：运行中状态重开时 endTime 已超时 → 主番茄钟回空闲（剩余作废、不记历史）。暂停态不超时 → 保持暂停不受影响。取代旧「逐段补算」语义（recover 不再编造历史）。

### 附件搬移域（ticket 65）

**附件 (Attachment)**: vault 内被笔记引用的非 .md 文件（图片/音视频/PDF/压缩包等）；只要当前笔记引用了它（wikilink 嵌入或 Markdown 链接）即算。.md 笔记与外链不计。
_Avoid_: 资源文件、素材、媒体文件（指附件时）

### 保险箱域（encrypt，新域）

**保险箱 (Encrypted Safe)**: bz 的加密容器整体——加密清单 + 密文镜像的集合。作用是把用户选中的整篇笔记及其双链图片/视频附件**移出 vault**（原路径消失，Obsidian 内"直接不见"），以密文落盘到 `encryptRoot`。复用 `src/password/crypto.ts` 的 `CryptoService` 与密码本主密码范式。区别于既有「加密条目(🔐 仅隐藏)」——那是伪加密，本域是真·密文。密文镜像采用**平铺点前缀布局**（ADR-0016）：`encryptRoot`（默认 `CONFIG/.ENCRYPT`）内所有密文文件 `.随机名.enc` 平铺，Obsidian 侧栏不可见，防误删；还原/删除靠清单映射。
_Avoid_: 加密罐、保险柜、安全箱（指本域时）

**加密清单 (Safe Manifest)**: `<encryptRoot>/.safe.enc`——整库唯一加密配置文件（点前缀，侧栏隐藏），记录每篇加密笔记的原路径、状态、正文/附件镜像引用与文件密钥（主密钥包裹）。清单本身整体 AES-GCM 加密，内部字段（含原路径）在解锁前不可见。
_Avoid_: 配置文件、清单文件（泛指时）

**加密笔记 (Encrypted Note)**: 移入保险箱的整篇笔记，清单内一条记录（SafeNote）。正文 100% 密文化。
_Avoid_: 加密条目（指保险箱内时，避免与 🔐 仅隐藏混淆）

**附件加密 (Attachment Encryption)**: 入库的图片/视频 blob，含**原始层**（原质量密文）与**预览层**（压缩/抽帧密文）；每层一个独立 `.随机名.enc` 平铺镜像文件存放于 `encryptRoot`（点前缀，侧栏隐藏）。

**清单解锁 (Manifest Unlock)**: 两段式解锁的层面 1——输入主密码，解密加密清单，在主面板列出加密笔记列表。

**笔记还原 (Note Restore)**: 两段式解锁的层面 3——解出笔记原文 + 原质量附件，写回原路径，笔记与附件在 vault 复活（"借出来用"）。还原成功即删除本文全部密文镜像与清单条目（取出即删，ADR-0016）。
_Avoid_: 解密、恢复（指还原整篇时，术语要区分于单附件）

**压缩预览 (Compressed Preview)**: 预览层产物——图片 canvas 缩小（体积小但看得清）+ 视频抽帧成图（零外部依赖）。预览层本体密文存储，预览窗纯查看。

**模糊预览 (Blurred Preview)**: 压缩前议称（用户后改为"压缩但看得清"）；现以压缩预览为准。
_Avoid_: 模糊预览（历史草案，不再使用）

**密文孤儿 (Orphan Ciphertext)**: `encryptRoot` 内已存在的密文文件，却不在任何清单条目的 `contentRef/blobRef/previewRef` 引用集内——移动端加密中途闪退的历史残留（ADR-0018 之前）。提交式加密后不再新增；存量只能靠**手动清理**入口处置，不做自动清理（用户拍板）。
_Avoid_: 垃圾文件、残留密文（指本域时）

**加密暂存区 (Encryption Staging)**: 提交点之前密文的隐藏工作区——`<encryptRoot>/.staging/`（点前缀、侧栏隐藏、与正式镜像同盘）。加密阶段密文逐件流式写入此处，提交序列再把它们整体搬入 `encryptRoot` 顶层成为正式镜像；中途任何意外不产生正式镜像，暂存残留下次解锁清空（ADR-0018）。

**提交点 (Commit Point)**: 一次加密事务的提交——`saveManifest()` 写入清单（ADR-0018 起**清单先行**，先引用将存在的镜像名）。提交点之前任何意外都不产生正式镜像、笔记保持未加密（原文件未动）；提交点之后才允许删除原文件。

**挂起标记 (Pending Marker)**: 标识某加密事务处于「清单已引用、原文件未删」挂起态的标记（存于暂存区）。提交段开始写入、删除原文件前清除；其存在与否供解锁区分「挂起（可安全回滚）」与「已提交（不再回滚）」（ADR-0018）。

**自愈回滚 (Self-heal Rollback)**: 提交式加密的崩溃自我修复——解锁时对挂起标记仍在的条目判定「半提交」：把已搬入的镜像移回暂存区、丢弃该条目并清空标记与暂存。因原文件在提交完成前从不删除，回滚永远安全、不产生密文孤儿（ADR-0018）。

**附件搬移 (Move Attachments)**: 命令 `bz-attach-move`（中文名「移动附件」）的语义——把当前笔记引用的附件移动到指定文件夹：弹文件夹选择器选目标（记忆上次 `attachLastFolder`）；**仅当目标文件夹已存在同名文件时才给被移动文件改名**（`原名 (N).ext`，Obsidian 同名惯例）；**不删除原空目录**、**无预览确认直接执行**；结束后 toast 汇总（移动/改名/失败数）。移动与链接更新走 Obsidian 内建 `app.fileManager.renameFile`。目标文件夹为 vault 内任意目录。
_Avoid_: 搬附件、整理附件、资源整理

**链接改写 (Link Rewrite)**: 附件搬移全库引用被移动附件的 wikilink / Markdown 链接自动更新，由 **Obsidian 内建 `app.fileManager.renameFile`** 完成（ADR-0014）——移动文件的同时按 Obsidian 自身消歧规则更新全库指向它的链接，插件不自研全库改写（v1 自研全库扫描 + 逐个 modify 因大库卡顿弃用）。插件自研解析逻辑仅用于「收集当前笔记附件」与「算去重后的目标路径」。
_Avoid_: 链接修复、改链接（泛指时）

### 小橘域（smartcat，桌面宠物猫）

**小橘 (SmartCat)**: bz 的桌面宠物猫 + 笔记 AI 陪伴域（命令 `bz-smartcat-open/chat/hide/dashboard`；数据 `CONFIG/STORAGE/smartcat.json`）——CSS 绘制猫本体悬浮页角（13 种外观皮肤），气泡对话框（打字机/点按固定/双击转聊天），基于当前笔记上下文 + 对话历史 + PAD 心情的 AI 聊天（AI 走 bz core/ai，无独立 apiKey），常驻行为（自言自语/心情衰减/动画状态机/书评/欢迎回来）。**用户拍板三项**：① AI 走 bz 内置；② 所有数据一个 json（原 localStorage 3 key + 原 CONFIG/SMART CAT 3 文件 + 原 memories 4 层一次性迁移），apiKey 不迁移；③ 面板样式布局统一 bz（聊天面板 bz-win-head，设置走域设置弹窗）。原 30 分钟空闲跟随已按用户要求删除。**ticket 073 二次拍板（2026-08-23）**：手势桌面/移动统一同套——**双击=聊天、长按=设置**（五击设置已并入长按）；聊天头行不放 ⚙️（设置唯一入口=长按）；聊天/设置/数据面板三窗**合并一套**、共用 `smartcatMobileDefaultFullscreen` 一个「移动端默认全屏」开关（原数据面板独立键删除，旧值残留忽略）；设置弹窗「每周懂你报告」行替换为「打开数据面板」，周报全文移入数据面板「报告」页签；拖出屏幕边缘松手**过冲回弹**（四边统一，底边回到 bottom:-10px 默认蹲姿）；气泡检测屏幕边缘不出界（--bz-sc-shift 水平夹紧）。
_Avoid_: 猫咪、宠物、陪伴猫（指本域时）；五击手势（已删）、数据面板独立全屏键（已删）

**猫本体 (Cat Container)**: `#smart-companion-cat` 悬浮容器（id 保留原 SmartCat 外部约定），内部 DOM 结构（#cat-body/.cat-eye/.cat-ear/.cat-tail 等）与气泡/思考/语音指示器。皮肤 = 容器上的 `skin-<外观>` 类（13 种），动画 = CSS 变量驱动的一次性动画（`.bz-sc-anim` + `--bz-sc-anim-name/-dur`）与心情组合类（`.bz-sc-mood-*`）；156 个 keyframes 静态收敛在 `src/smartcat/styles.css`。
_Avoid_: 皮肤内联样式、运行时注入（铁律 9 禁区）

**心情 (Mood)**: 小橘的连续心情层（grilling 拍板 PAD 三维重构，取代原「心情维度」8 维）——`mood.pad` 三维（pleasure/arousal/dominance，0-100），60s 自动衰减 + 人格乘数/抵抗力 + 互动影响 + **ADR-0025 温和共振**（观察情绪差量/情绪趋势回写）；5 档显示位（MOOD_MAP：excellent/good/neutral/low/poor）由 PAD **原型最近邻实时算出**（原 `calculateCompositeMood` 断线缺陷已解除，currentMood 不再恒为 lastMood）。
_Avoid_: 心情维度（8 维，已废弃）、心情状态机（指断线 5 档）

**情绪 (Emotion)**: 小橘的瞬时情绪层（三层模型：情绪→心情→人格）——`mood.currentEmotion` 记录最近的情绪标签（happy/sad/curious/sleepy/playful/focused/calm/upset），由事件/记忆标注；记忆流条目 `emotion` 字段承载情绪归属（LLM 顺带 + 词法兜底）。**ADR-0025 拍板推翻旧「情绪不直接改写 PAD」**：每条观察（日记/闪念/聊天/域事件）经 `memorySystem.onObservation` 钩子 → `registerEmotion` + `applyEmotionResonance`（温和共振，见下）；情绪趋势（近 48h）经 30 分钟节流 `applyTrendDrift` 温和回写心情。
_Avoid_: 情感记忆（EmotionalMemory 类已删除，语义并入记忆流 emotion 字段）

**温和共振 (Emotion Resonance)**: ADR-0025 的情绪→心情闭环机制——`emotionResonanceDelta`（纯函数）把观察情绪经 `emotionToVAD` 换算为 PAD 差量：愉悦按 valence 距中性 0.35 起算（负面增益 6 > 正面 4，共情优先）、calm/neutral 趋近 0（不误动心情）、唤醒/支配按偏移缩放；差量走既有 `updatePad`（人格乘数/抵抗力 + 60s 指数衰减回基线 50），小橘会温和跟随你的近期情绪，但四层约束保证它不是你的情绪镜子。
_Avoid_: 情绪直接镜像（整量复制用户 VAD）、情绪不落心情（旧拍板，已废除）

**懂你上下文块 (Companion Context)**: ADR-0025 的全通道表达机制——`buildCompanionContext`（纯函数，`src/smartcat/companion-context.ts`）把作息（rhythm 画像）+ 情绪趋势（cognitive）+ 信任/依恋（relationship）+ 检索记忆（格式化文本）组装为统一背景知识，经 `generatePrompt` 的 `companionContext` 参数（`## 你了解的用户` 节）注入聊天/自言自语/欢迎回来/书评/主动关心的系统提示——关掉聊天窗口小橘也「记得你」，各通道口径一致。
_Avoid_: 各通道手写零散记忆拼接（2026-08-23 前实现，已收敛）

**人格成长 (Personality Growth)**: 小橘的长期人格层（ADR-0023 对齐 MATE：预设 5 选 1 已删除）——`personalityGrowth` 结构为 `{ocean(OCEAN 五因素 0-1，出生随机 N(0.5,0.15) 落盘一次), traits(30 项 0-1，9 临床群组，logistic 饱和 x+δ(1-x) 永不达 1), relationship(trust/attachment 0-1), behaviorStats(互动计数/情绪基调/活跃时段), growthHistory}`；成长三路：`character_transition`（每条互动微移 δ=δbase×情绪强度×近因(1+(1-trust))）、`character_from_experience`（反思时周统计深更新 δ≤0.01）、`applyReflectionInsights`（洞察 → existential 群组成长）；人格经 `getCharacterModulators` 调制 PAD 心情（成长真的改变心情波动）。设置弹窗展示 OCEAN+关键特质条形，可重置成长。
_Avoid_: 预设人格（5 选 1 已废弃）、personalityGrowth 无人调用（已接线）

**记忆流 (Memory Stream)**: 小橘的单层记忆（ADR-0021，取代原「分层记忆」四层）——`smartcat.json` memory 段改为 `{version, lastUpdated, stream: MemoryStreamEntry[], reflection}`，`MemoryStreamEntry = {id, created, lastAccessed, description, importance(0-1), type:'observation'|'insight', evidenceIds?, source?, emotion?}`；检索时按 GA 三因子 `α1·decay^小时 + α2·importance + α3·relevance` 分级取 top 10（**RL 进化第 3 轮重标定 α=0.66/0.95/1.5、decay=0.982**，见 RL 校准词条）；写入时 LLM 打分（AI 未配置降级规则分）并顺带标注情绪（词法兜底）——**云端打分范围 `config.cloudScoring`（ADR-0025 追加决策，默认「智能」）**：`shouldCloudScore` 判定——智能档日记/反省/闪念恒 LLM、剪藏/影评/书库/诗/信 ≥30 字走 LLM、聊天/域 JSON/其余恒本地规则分（省大头在线调用，弹窗「记忆打分范围」可切 全部/仅日记/本地）；每条 observation 写入后触发 `onObservation` 钩子（ADR-0025：情绪共振/瞬时情绪接线）；**聊天记忆去重限流（ADR-0025）**：`addObservation(…,{dedupe:true})` 先近 20 条同内容短路（省一次 LLM 打分），再按「非 calm 情绪 or importance≥0.55」限流，低价值「用户说：X」不稀释记忆流；检索 `retrieve(query,topN,{lexicalQuery})` 词法降级用纯用户消息，免「情绪/时段」索引词稀释命中率；反思每 24h 或新增≥20 条触发，LLM 归纳 3 条洞察写回流（带 evidenceIds 溯源）并经 onReflect 喂人格成长；上限 500 条淘汰「importance×使用度」最低；bge-m3 向量存独立 smartcat-memory-vectors.vec（豁免单 json），Ollama 不可用降级词法。旧四层与迁移路径已删除（无数据产生，用户拍板）。**影视动作感知观察（ticket 074，ADR-0026/0027）**：movie 域 UI 确认回调 → `notifyMovieAction(事件)` → 动作语义观察文本（加入想看/开始看/看完了/状态流转/评分改分/写改删影评/删除），文案构造集中 `movie-source.ts` 纯函数；事件通道对影视短路（防双记录）；**方法监听（ADR-0027）**——手改 frontmatter（含回退想看）、正文记内容、自动保存连发一律不观察（用户拍板放弃，防逐字编辑刷屏；观察只来自 UI 确认动作，一次一条零定时器）。**备忘录动作感知观察（ticket 075，ADR-0028）**：memo 域 UI 确认回调 → `notifyMemoAction(事件)` → 动作语义观察文本（添加=键值式有才加「场景/脚本/课程/优先级/截止/笔记」、编辑=α 合并一次保存一条、完成/恢复/延后/优先级切换/删除仅标题），文案构造集中 `memo-source.ts` 纯函数；**每日到期扫描合并一条**——并入 30s 反射调度 tick（当天已扫过跳过），读 memo.json（vault.read，不动 memo 域）→ `memoDueObservation`（今天到期且未完成，≤5 截断多出「等 N 个」，N=0 不产出）→ `你有 N 个待办今天到期：…`；扫描日期持久化 `editingData.dueScan` 跨重启去重；**domain-source memo extract 移除**（JSON 事件通道不再收 memo，防双记录）。
**聚合讯逐篇观察（ticket 076，ADR-0029）**：news 域 reader 方法监听——`markAsRead`（下一篇/保存共用）记录 `openedAt` 算停留时长 → 三态判定（保存优先；跳过 ≥2 分钟升阅读，时长取整分钟 ≥1）→ `notifyNewsRead`（三态文案：阅读/跳过/保存）；保存联动 auto-summary（`notifyNewsSaved` 登记待补全表（内存）→ 剪藏 modify 命中补全完整保存观察（`你保存了《X》（Y·读了 N 分钟）：摘要 #标签…`）并移除登记；2 分钟降级定时器兜底；补全/降级与近 20 条同文案防重）；`onVaultActivity` 对 clipping 短路（剪藏事件观察停用，唯一例外=登记补全）；`DOMAIN_FILES.news` 计数观察移除（「你浏览了今天的资讯」不再产）。
**日记逐条观察（ticket 077，ADR-0030）**：日记从「observationText 快照 + 10 分钟去弹跳」改为**每条独立 10 分钟结算**——`onVaultActivity` 对 `kind==='diary'` 走新链路（替换 observationText 分支；原 diary 去弹跳/信任成长不再执行，其它 kind 不动，PAD 正向轻推照旧）：vault create/modify/delete 监听 `我的/日记/*.md`（纯 smartcat 侧不改 diary 域），per-entry 计时表（内存态，key=`文件路径\u0001日期\u0001HH:mm` → {timer, generated, 上次生成正文基线, 上次生成分类, 累计字数, 上次生成时间}）——该条任何修改重置其 10 分钟计时（各条互不影响）；静置到期 → 读文件解析 → 结算判定纯函数（`src/smartcat/diary-source.ts`，文案构造集中本模块）：首落**有字才生成**（空标题记已见防「标题即存」，补正文走首落）；已有则累计字数（当前长度−上次生成基线，每次结算累加，中文按字符数）**>50 才生成更新观察**并重置基线/累计（≤50 不生成，补写不计入记忆但计累计）；文案（用户八轮拍板）：`你在 <date> <time> 写了一篇日记（分类：<c1>、<c2>）：<正文全量不截断>` / `你更新了日记（<date> <time>）：<新正文>`（分类有变化也更新进括号）/ `你删除了 <date> <time> 的日记`（原观察保留）；**删除感知**：补挂 vault `delete`（diary 目录）按跟踪快照逐条追加删除观察（从未跟踪过 → 文件级单条兜底 `你删除了 <date> 的日记`），条目级删除（md 块消失）由 modify 全量快照 diff 发现「上次快照条目消失」→ 追加删除观察；**重启基线**——ensure 时对当日文件建快照（不产出，防重启后旧条目被当首次）；emoji→分类 import `src/diary/config` 的 `emojiToTagMap`（单向域间 import，无环；分类多个「、」分隔）；观察写入 fire-and-forget（addObservation 尾部 appendVector 探测 Ollama 可能不 resolve，防阻塞事件链与状态提交）；情绪/importance 走 addObservation 通用链路（diary 恒 LLM，AI 未配置降级本地）；`MemoryStreamEntry.source === 'diary'`，smartcat.json/日记 md 零改动。
**收藏本动作观察（ticket 078，ADR-0031）**：favorites 域 UI 确认回调方法监听——`_saveNewItem` 添加/编辑分支、`_deleteItem` 调 `notifyFavoritesAction(事件)`，文案构造集中 `favorites-source.ts` 纯函数：添加=键值式有才加（分类（tags 顿号全列）/简介「…」/链接 url 原文/已置顶（仅 pinned=true）），编辑=α 变化列表只列真正变化（title/description/url/tags，tags join 比较；pinned/created/id/type/llmConfig/balance* 不参与；无变化省略列表），删除仅标题；置顶抽屉动作不观察（置顶变化也不列入编辑列表）；`onVaultActivity` 对 favorites 防御性短接 + `DOMAIN_FILES.favorites` 移除（「你收藏了一条新资源」无标题计数观察不再产）。
**归物本动作观察（ticket 079，ADR-0032）**：belongings 域 UI 确认回调 → `notifyBelongingsAction(事件)` → 动作语义观察文本（添加=键值式完整信息按序有才加——`你登记了新物品《X》` + `：分类（category 原文含 emoji）、价格 ￥X、购买于 YYYY-MM-DD、状态 <值>（仅非「使用中」才写，表单默认使用中避免噪音）、描述「…」`；编辑=α 变化列表——弹窗打开时 `const snapshot = { ...item }` 快照（保存时直接改 item 引用），`belongingsEditChanges` 比较 name/category/purchase_price/purchase_date/current_status/description（不参与 id/created_date/last_updated），变化项「改了名称/分类/价格/购买日期/状态/描述」'、' 分隔，全不变只发主句不带尾冒号；状态流转=4 态动词化不防抖——→闲置 `你把《X》标记为闲置`/→已转卖 `你转卖了《X》`/→已丢弃 `你丢弃了《X》`/→使用中 `你重新用起了《X》`；删除=`你删除了《X》`），文案构造集中 `belongings-source.ts` 纯函数；`onVaultActivity` 对 `classifyPath==='belongings'` 短路；`DOMAIN_FILES.belongings` 计数 extract 移除（「你登记了一件新物品」不再产，防双记录）；即时同步观察无 timer/map 需清理。**RL 校准配方 (RL Calibration)**: 正式强化学习收敛后的动力学默认值（ADR-0024，2026-08-23）——以「真实库事件流（过去 365 天真实使用）」环境最优配方为生产新默认：`characterTransition` 默认 δbase 0.003→0.00083（合成配方 0.0096 作对照）、`trustUpdate` 温暖增益 0.01→0.0082/侵蚀 0.003→0.0029（**ticket 027 追加决策：TRUST_CAP=0.85 软收拢**，`v=cap+K(v−cap)` K=0.98 平衡点≈0.91；**ticket 072 校正：K 0.98→0.85——旧系数不动点 cap+49·gain 在现增益下越过硬顶致 trust 饱和 0.999，新不动点 v\*=cap+gain/(1−K)（聊天档≈0.88），存量饱和值被缓慢拉回**；**ADR-0025：中性事件 neutral 短路连软收拢也不动 trust**）；记忆流 GA 三因子 α 1.0→0.5/0.73/0.5、decay 0.995→0.986（**进化第 3 轮 rMem 接回周检索项后重标定：α=0.66/0.95/1.5、decay=0.982，相关度权重上调最猛**）；模拟器独有旋钮（effectScale/emoGain/charSens/decayScale）不迁移生产。**ticket 025**：写日记/闪念以轻质量 0.15 计入信任成长（`developBasedOnInteraction(kind,0.3,0.02,0.15)`，vault 事件挂钩）+ 笔记库内容为信息来源（`context-source.ts`：diary/flash/clipping/movie/reading 实时分类 + 观察文本，**ticket 029 用户拍板扩展为全内容读取 + LLM 云端打分 + 词法情绪**，AI 未配置降级本地规则分，`config.noteSource` 开关默认开）。

**番茄钟专注完成观察（ticket 080，ADR-0033）**：pomodoro 域方法监听——观察集（用户 2026-08-24 拍板）只观察「专注完成」：`applyAction` 在 focus 阶段 tick 自然完成（写 history 的路径，`phase-completed` 事件且 `historyEntry` 存在）时直接调 smartcat.notifyPomodoroAction({kind:'focus-done', minutes: durations().workMin}) → `你用番茄钟完成了 X 分钟专注`（X=当前配置工作分钟，预设/自定义/默认 25）；开始/暂停/继续/跳过/重置/休息完成一律不观察（skip 无 historyEntry 天然排除）；文案构造集中 `pomodoro-source.ts` 纯函数（PomodoroActionEvent union 对齐先例）；`onVaultActivity` 对 `kind==='pomodoro'` 短路（`classifyPath` 补 pomodoro.json 分类，防域 JSON 事件双记录）、`DOMAIN_FILES.pomodoro` 计数 extract 移除（「你用番茄钟完成了一段专注（+ N 次）」不再产）；无 timer/map 需清理。
**域 JSON 盲通道清空（ticket 082，2026-08-24 用户拍板）**：quiz/review 两个最后的计数 extract 移除——`DOMAIN_FILES` 全清空（「你做了几道题，检验了一下理解」/「你完成了一轮复习，复习计划在推进」不再产）；至此原 CONFIG/STORAGE JSON 盲通道（memo/news/favorites/belongings/pomodoro/quiz/review 共 7 项）全部退役——前 5 项改方法监听（各 notifyXxxAction），quiz/review 直接去掉（无观察价值）；`snapshotDomains`/`onDomainActivity` 机制保留（ticket 081 书库 weave-data.json 数据文件监听合并后以 library 条目重新注入）。
**RL 校准配方 (RL Calibration)**: 正式强化学习收敛后的动力学默认值（ADR-0024，2026-08-23）——以「真实库事件流（过去 365 天真实使用）」环境最优配方为生产新默认：`characterTransition` 默认 δbase 0.003→0.00083（合成配方 0.0096 作对照）、`trustUpdate` 温暖增益 0.01→0.0082/侵蚀 0.003→0.0029（**ticket 027 追加决策：TRUST_CAP=0.85 软收拢**，`v=cap+K(v−cap)` K=0.98 平衡点≈0.91；**ticket 072 校正：K 0.98→0.85——旧系数不动点 cap+49·gain 在现增益下越过硬顶致 trust 饱和 0.999，新不动点 v\*=cap+gain/(1−K)（聊天档≈0.88），存量饱和值被缓慢拉回**；**ADR-0025：中性事件 neutral 短路连软收拢也不动 trust**）；记忆流 GA 三因子 α 1.0→0.5/0.73/0.5、decay 0.995→0.986（**进化第 3 轮 rMem 接回周检索项后重标定：α=0.66/0.95/1.5、decay=0.982，相关度权重上调最猛**）；模拟器独有旋钮（effectScale/emoGain/charSens/decayScale）不迁移生产。**ticket 025**：写日记/闪念以轻质量 0.15 计入信任成长（`developBasedOnInteraction(kind,0.3,0.02,0.15)`，vault 事件挂钩）+ 笔记库内容为信息来源（`context-source.ts`：diary/flash/clipping/movie/reading 实时分类 + 观察文本，**ticket 029 用户拍板扩展为全内容读取 + LLM 云端打分 + 词法情绪**，AI 未配置降级本地规则分，`config.noteSource` 开关默认开）。
_Avoid_: 记忆文件、memories 目录、四层（已废弃）；迁移（已删除）

### 移动端窗口（ticket 68，跨域）

**移动端默认全屏 (Mobile Default Fullscreen)**: bz 的跨域设置（ticket 68，ADR-0019）——11 个有主窗口的域各一项布尔开关（键 `<域前缀>MobileDefaultFullscreen`，落 data.json），**仅移动端（`Platform.isMobile`）显示与生效**，桌面端不显示不受影响。语义：≤768px 时 **开=真全屏**（主窗口覆盖整个视口 100vw×100vh、去圆角、头部避让安全区、底部 env(safe-area-inset-bottom)，统一类 `.bz-win-mfs`），**关=常规卡**（95%/90vh 圆角卡）；只决定每次打开的**初始形态**，窗口内无手动切换按钮。多窗口域（影视主面板+影视分析+影视报告、书库主面板+读书笔记+阅读报告）一并对控制，筛选/批注等小弹窗不纳入。**聚合讯跟随剪藏本键、阅读报告跟随书库键（2026-08 用户拍板：两域不设独立开关、窗口无 ⚙️ 设置入口）**。默认值=行为保持（原移动端即全屏的域默认开——日记/归物本/剪藏本/密码本/收藏本/书库/影视/复习/保险箱；原居中卡的 2 域默认关——备忘录/番茄钟）。做题家、入口页不设此开关（用户拍板）。
_Avoid_: 窗口最大化、自动全屏（注意区别于闪念 FloatWindow 双击标题栏最大化——那是未接线的桌面窄窗机制，与本设置无关）

### 加密日记条目（日记加密，ticket 67）

**加密日记条目 (Encrypted Diary Entry)**: 日记本中「加密」分类（🔐）的真·密文条目——**整条（含 `# emoji HH:mm` 标题行与正文）从当日 md 文件移出**，作为一篇 `SafeNote` 存入保险箱（复用 `SafeManager.lockNote`；ADR-0017）。区别于既有「加密条目(正文含🔐仅隐藏，伪加密)」——本概念是真·密文，整条不见于 md。解锁后解密成标准 `DiaryEntry` 混排进日记面板（**正文即预览**，无预览弹窗、点击无操作）；未解锁完全不可见（Q21-a）。筛选栏「加密」标签固定排最后。
_Avoid_: 加密条目（指🔐仅隐藏时）、普通加密笔记（保险箱整篇移出式）
_Avoid_: 把「加密日记」当成一个新的独立数据文件——它复用保险箱 `safe.enc` 清单，无独立 .enc

**日记加密入口 (Diary Encryption Entry)**: 加密**只发生在「改类型」时**——写日记弹窗不提供「加密」标签；在日记面板改分类（点 emoji → 标签选择器）时提供「加密」标签。选「加密」→ 若保险箱未解锁先弹主密码 → 因正文将离笔记再二次确认 → 确认后块级移入保险箱。已加密条目改类型=自动降级（Q20-a），不显示「加密」按钮。
_Avoid_: 写日记时直接新建加密条目（不提供该入口）

**日记条目还原 (Diary Entry Restore)**: 加密日记降级回普通的语义——解密写回原日期 md 文件的**对应时间点**（merge，按 date+time 重插 `# emoji HH:mm` 块；md 已删则新建），密文取出即删（复用 `restoreNote`）。附件随还原一并写回原 vault 路径。触发双入口：保险箱面板现成「还原」手势，或日记面板改类型选非加密（自动降级）。
_Avoid_: 整文件覆盖还原（日记条目是日期文件里的一个块，非整篇笔记）

**日记附件随加密**: 加密日记正文里 `![[...]]` 引用的图片/视频附件**一并移入保险箱**（作为 SafeNote 的 attachments 加密镜像），原 vault 附件删除；恢复时按原路径还原，正文里的 `![[原路径]]` 引用文本不变、可直接显示。附件与日记正文同属同一篇 SafeNote（Q25-B 存完整块）。

### 共享层

**样式按域拆分 (Domain-split Styles)**: bz 的样式组织方式（ticket 70，ADR-0020，取代 ticket 60「全收敛根 styles.css」）——视觉样式源文件按域拆分：各域样式写 `src/<域>/styles.css`（diary/launcher/memo/news/clipping/password/favorites/review/quiz/pomodoro/library/attach/encrypt/movie），共享层/跨域样式（设置页分页、主窗口头部行统一规范、core 层、移动端主窗口默认全屏、统一右键菜单/长按抽屉）写 `src/core/styles.css`；构建由 `scripts/build-css.mjs` 按 SOURCES 清单顺序聚合生成根 `styles.css`（Obsidian 每插件只加载一个 styles.css；**聚合产物勿手改**），`npm run dev` 监听 src/**/*.css 自动重新聚合。类名仍守 `bz-` 前缀；运行时注入 `<style>` 与内联视觉样式依旧禁止。
_Avoid_: 手改根 styles.css、往根 styles.css 直接追加样式、styles/&lt;域&gt;.css 注入模式

**统一行操作 (Unified Item Actions)**: 跨域列表卡片统一手势组件（`src/core/item-actions.ts`）——列表**不注入任何常驻或 hover 图标排**；桌面端=**右键**弹跟手菜单（preventDefault 拦原生菜单，鼠标长按不触发），移动/触屏端=**长按**弹底部抽屉（遮罩+顶部条目信息+动作逐行）。能力：keepOpen（动作后抽屉保持+refreshItemSheet 原地重建动作与头部）、附属浮层（companion，抽屉之上的域内弹窗点击不误关抽屉）、危险项红色、强调色整行。动作项布局统一：图标左对齐 → 文案 → 小字右对齐。已接入域：备忘录、日记本、剪藏本、影视、收藏本、归物本（含 4 状态流转+数据文件监听自动刷新）、密码本（保留平台链接点击与 👁 显隐）、书库（保留双击转跳书籍，md/EPUB 通用）、复习计划（保留双击打开笔记；开始复习难度弹窗为 companion）、保险箱（双击预览保留）；聚合讯（Dataview 外部渲染阅读流）等无卡片网格域不接入。
_Avoid_: hover 操作条、行内图标排、行内按钮组（指列表卡片时）

**Q3 / __utils**: QuickAdd 共享脚本（`CONFIG/SCRIPTS/Quickadd/Q/Q3.js`，1034 行），挂载 `window.__utils`，21 个导出：escManager、confirm、notice、generateId、jsonStore、longPress、injectStyles、createSiteIcon、createIconBtn、formatRelativeTime、formatFileSize、displayChangelog、checkAndShowChangelog、AIService、createAI、extractUrlAndDisplay、getPlatformName、getCurrentNoteInfo、getCurrentCursorPosition、fetchPageTitle、createOverlay。**新插件移植后为内部共享层（core），不再挂 window**。

**jsonStore**: Q3 提供的 JSON 文件存储工具（不存在自动建目录建文件返回 `[]`，解析失败重置 `[]`；写 = 存在 modify / 不存在 create；**原实现无锁**），备忘录/归物本/密码本/复习计划等均使用 `CONFIG/STORAGE/*.json`。

**条目抽屉 (Item Sheet)**: 跨域统一的条目操作浮层（`core/item-actions.ts`）——移动端长按卡片滑出底部抽屉（遮罩 + 顶部条目信息 + 功能项逐行；顶部精简两行（标题+简介，两行省略号截断）），桌面端右键弹跟手菜单（fbf7830 全局方案，preventDefault 拦原生右键、longPressFilter 让位区放行）。动作随域定义；keepOpen 动作执行后抽屉保持并由域动态刷新；附属浮层（评分/影评等小弹窗）叠于抽屉之上。已接入域：备忘录、日记本、影视、收藏本、剪藏本。两种特例：剪藏本是唯一「单击整卡直接打开」的域（ticket 69，Q7a）；且其桌面端浮层关闭（`desktopActions=false`，右键菜单统一方案落地前接受空窗）。
_Avoid_: 长按菜单、底部菜单（泛指时）、右键菜单（桌面端尚未实现的形态）

**AIService / createAI**: Q3 的 AI 服务抽象——provider 可选 deepseek / opencode-go，key 存于 QuickAdd 宏设置（`aiProvider`、`opencodeGoApiKey`），支持 override 对象（endpoint/apiKey/model）；插件化后迁移至插件设置。

### 设置模型（ADR-0009）

**全局设置页 (Global Settings Page)**: Obsidian 设置中的 bz 设置页——单页平铺（无 tab），只含「AI」「数据存储路径」两个区块。
_Avoid_: 设置 tab、分类设置、设置页分区

**主面板 (Main Panel)**: 功能域的完整主窗口，经命令 `bz-<域>-open` 打开，承载该域列表与全部功能入口；区别于域内小弹窗与快捷创建。
_Avoid_: 大面板、完整面板、功能面板

**快捷创建 (Quick Create)**: 不经主面板、直接弹出某域单条数据新建/录入界面的交互形态（命令 `bz-<域>-add` 与 `bz-diary-write`）。主页统计条曾以数字旁文字承载此形态，2026-08 用户决策全部移除，点击一律改开主面板。
_Avoid_: 创建面板、快捷添加、快速录入

**主页统计条 (Home Stats Bar)**: vault 根 `主页.md` 经 Dataview 渲染的统计区块（外部脚本 `CONFIG/SCRIPTS/DataView/主页.js`，非插件代码）——书库/影视/收藏等各域计数与天数行。点击数字或其后的文字一律打开对应域主面板；仅「N 在看」「N 想看」保留影视筛选预设直达，「索引/主题/卡片」为笔记/文件夹/无动作特例。
_Avoid_: 首页、仪表盘

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
- 样式按域拆分（ADR-0020）：源写 `src/core/styles.css` 与 `src/<域>/styles.css`；根 `styles.css` 是构建聚合产物，勿手改。
