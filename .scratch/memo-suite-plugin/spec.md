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

### 归物本（Belongings）

13. 作为用户，我希望物品登记面板（列表、搜索、新增/编辑/删除、图片展示）与原脚本一致，以便继续登记我的物品。
14. 作为用户，我希望数据目录默认 `CONFIG/STORAGE`（可在设置中配置 dataFolder），以便沿用原存储布局。
15. 作为用户，我希望启用时显示归物本 changelog（identifier 'belongings'），以便看到更新说明。

### 密码本（Password Vault）

16. 作为用户，我希望密码管理面板（条目列表、加密存储、样式注入 data-pw-styles）与原脚本一致，以便继续管理密码。
17. 作为用户，我希望存储路径可配置（storagePath），以便沿用原路径。

### 剪藏本（Clipping）

18. 作为用户，我希望剪藏文章面板（`我的/文章` 目录）支持搜索、站点过滤（单选）、排序、双击跳转、长按删除，以便浏览剪藏文章。
19. 作为用户，我希望面板中显示反链笔记名并支持点击跳转（metadataCache.getBacklinksForFile），以便发现文章被哪些笔记引用。

### 聚合讯（News Aggregator）

20. 作为用户，我希望新闻抓取（站点列表、platform map、news.json/news-stats.json 统计）与原脚本一致，以便继续聚合阅读。
21. 作为用户，我希望聚合讯生成的笔记保留 dataviewjs 代码块（`dv.view('CONFIG/SCRIPTS/DataView/摘要')`），由 Dataview 插件渲染，以便摘要视图行为不变。
22. 作为用户，我希望剪藏内容写入 `归档/网页剪藏`（CLIP_DIR），以便与自动摘要共享数据源。

### 收藏本（Favorites）

23. 作为用户，我希望 GitHub 收藏管理（列表、AI 生成标题/简介、打开链接）与原脚本一致，以便管理我的 GitHub stars。

### 书库（Library）与阅读数据分析报告（Reading Analytics）

24. 作为用户，我希望书库面板（`书库/` 目录 + `我的/读书笔记` 聚合、搜索/排序/跳转）与原脚本一致，以便管理读书笔记。
25. 作为用户，我希望阅读数据分析报告（年度统计、阅读热力图、习惯分析、读书笔记互动分析、聚焦分析）与原脚本一致，以便生成我的阅读报告。
26. 作为用户，我希望阅读报告可写入笔记或复制（原脚本行为），以便保存报告。

### 影视（Movies）与影视数据分析（Movie Analytics）

27. 作为用户，我希望影视管理（`我的/影视` 目录、frontmatter 读写 fileManager.processFrontMatter、类型/状态筛选、排序、添加/编辑/删除）与原脚本一致，以便管理观影记录。
28. 作为用户，我希望影视.js 通过 `app.commands.executeCommandById('movie-analysis-open')` 打开影视数据分析，以便互调链路与原来一致。
29. 作为用户，我希望影视数据分析弹窗（状态分布、趋势等，`window.__MOVIE_FOLDER_PATH` 语义改为模块共享）与原脚本一致，以便分析观影数据。

### 自动摘要（Auto Summary）

30. 作为用户，我希望插件启用后自动监听 `归档/网页剪藏` 新文件，AI 生成摘要与标签写回 frontmatter，以便剪藏内容自动整理。
31. 作为用户，我希望 AI 处理失败时静默降级（console.warn，不打断使用），以便不影响日常浏览。
32. 作为用户，我希望自动摘要可在设置中开关（常驻监听默认开启？以原脚本行为为准），以便控制资源占用。

### AI Agent（AIAgent）

33. 作为用户，我希望笔记 rename/delete 自动同步到备忘录/收藏本（引用路径/标题更新、关联清空），以便引用不失效。
34. 作为用户，我希望笔记 create/open 自动关联收藏本同名条目，以便减少手动维护。
35. 作为用户，我希望 AI 剪藏匹配（URL 精确匹配不中时）弹出批准确认，非 AI 操作静默直改，以便保持原权限模型。

### 复习计划（Review Plan）与做题家（Quiz Master）

36. 作为用户，我希望复习计划面板（FSRS v4 算法、review.json 数据、每日复习队列）与原脚本一致，以便按记忆曲线复习。
37. 作为用户，我希望复习时支持「再次/困难/良好/简单」评级并更新下次复习时间，以便算法生效。
38. 作为用户，我希望复习计划右上角图标可调用做题家，以便复习做题一体化。
39. 作为用户，我希望做题家（quiz.json 统一题库、多选、完成状态、全完成自动替换笔记内容）与原脚本一致，以便继续做题。
40. 作为用户，我希望复习与做题共用数据文件（CONFIG/STORAGE/review.json、quiz.json），以便数据零迁移。

### 闪念（Flash Thought）

41. 作为用户，我希望右侧窄窗（自动吸附缩起、悬停展开）与原脚本一致，以便快速记录闪念。
42. 作为用户，我希望相关笔记随光标浮现（向量检索，Ollama bge-m3 嵌入），以便写作时发现关联。
43. 作为用户，我希望闪念支持 AI 对话（Ollama qwen2.5 本地 / DeepSeek 远程，可配置 URL 与模型），以便与笔记对话。
44. 作为用户，我希望 Ollama 服务不可用时有明确提示而非崩溃，以便知道是环境问题。
45. 作为用户，我希望闪念的常驻监听可按设置开关，以便不需要时节省资源。

### 全局

46. 作为用户，我希望所有域的面板 DOM id/类名与原脚本一致，以便样式与既有习惯不变。
47. 作为用户，我希望所有域的数据读写格式与原脚本一致（零迁移），以便随时回退到 QuickAdd。
48. 作为用户，我希望插件在未配置 AI key / 未装 Dataview / 无 Ollama 时各域优雅降级（禁用或提示），以便不拖垮主应用。

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

### 已知待收集信息（实现时从源码提取，不阻塞本 spec）

- 各脚本的完整命令 id 清单、设置项清单、changelog identifier 清单
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
