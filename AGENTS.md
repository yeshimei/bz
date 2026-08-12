# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，18 个功能域：日记本、备忘录、归物本、剪藏本、聚合讯、密码本、收藏本、书库、阅读报告、影视（含分析）、复习计划、做题家、闪念、自动摘要、AI Agent、入口页、番茄钟、B 站下载。数据沿用既有格式（`CONFIG/STORAGE/*.json`、`我的/*.md`、frontmatter），旧数据直接可读。**项目语言：中文**（注释/提交/issue/文档）。

## 命令

- `npm install` 首次安装；`npm run dev` 监听重建；`npm run build` 生产构建；`npm test` vitest run；`npm run test:watch` 监听；`npx tsc --noEmit` 类型检查。
- 产物直出 `E:/Obsidian/叫我包仔/.obsidian/plugins/bz/`（esbuild.config.mjs 硬编码勿改）。测试经 vitest.config.ts alias 把 `obsidian` 替换为 `tests/mock-obsidian-entry.ts`。

## 架构

- `src/main.ts`：命令裸注册表、设置页、懒加载开关、onunload 清理（37 命令）
- `src/core/`：共享层（不挂 window）——app/settings-provider/ai/json-store/esc-manager/confirm/utils/dom/changelog/notice（自绘 toast，ADR-0010）/settings-modal（域设置弹窗）
- `src/<域>/`：index.ts + data + ui（+ state/types/config）；`src/diary/ui/` 已拆 panel/entries/dialogs/quote/datetime-picker/filter-shared/ui-settings
- 其余：`src/settings.ts`（MemoSettings + DEFAULT_SETTINGS）；`styles.css`（676 行，各域样式收敛处）+ `styles/<域>.css`（中间态）；`docs/adr/`（0001-0012）；`CONTEXT.md`（术语表）；`.scratch/<feature>/`（spec.md + issues/NN-*.md）
- **依赖方向（ADR-0002）**：`core ← config/state ← parser ← store ← ui ← main`。store 无 DOM；UI 刷新靠回调（onFullRefresh/onLightRefresh）订阅；UI 内部函数级引用环允许，但须在函数体内延迟解析，禁止模块顶层互访。

## 铁律

1. **数据格式稳定**：`CONFIG/STORAGE/*.json` 字段、`我的/*` 格式、frontmatter 一律不改（改 = 用户数据损坏）。
2. **命令裸注册**：id `bz-<域>-<动作>` 三段式（第 9 轮统一，如 bz-flash-open/bz-diary-write）；不设默认快捷键；只在 main.ts COMMANDS 表注册一次，域内不重复 addCommand；卸载全量 removeCommand。id 是外部裸调用约定（launcher.json/热键/主页.js），改名需同步。
3. **DOM id/类名稳定**：外部依赖此约定（如 `#add-diary-mask`、`#todo-popup`），新增 UI 保持既有风格。
4. **实现稳定性**：文案/CSS/公式（FSRS 幂律、香农多样性、基尼平衡）保持既有；已知缺陷不动（多选计数 bug、主演计数取单次、flash refresh 不清理已删文件向量条目）。
5. **懒加载（ADR-0003）**：UI 域 `ensureXxx` 幂等初始化（首次命令触发）；事件常驻域（auto-summary/ai-agent/flash）按设置开关注册（ensureAutoSummary/ensureAIAgent/ensureFlashOnReady）。
6. **域间共享**：经显式 import 或 core 层（getApp/getSettings/createAI），不挂 window（`__MOVIE_FOLDER_PATH` 为兼容遗留，勿新增）。
7. **架构决策**：设置页单页（ADR-0009，仅 AI + 共享 storagePath，域设置走 ⚙️ 弹窗）；通知用自绘 toast（ADR-0010，`notice(msg, type?, duration?)`，不用原生 Notice）；外部依赖（ADR-0005/0006/0008/0011）——AI 配置在 data.json、聚合讯 dataviewjs 由 Dataview 渲染、闪念走 Ollama HTTP、B 站下载/海报抓取走外部 npm。
8. **通知写法**：消息正文一律**不带 emoji 前缀**（类型图标即视觉前缀，重复）；新语义先查 `src/core/notice.ts` ICONS 表（11 类型：info/success/warning/error/pause/accept/delete/confirm/restore/skip/archive），确无匹配才新增（ICONS 项 + 颜色 class + 默认时长），不得把 emoji 写进正文；规范详见 CONTEXT.md「通知类型规范」。

## 领域清单（src/<域>/，数据均在 CONFIG/STORAGE/，表内只写文件名）

| 域 | 数据 |
|---|---|
| diary 日记本（面板/写日记摘抄/标签筛选/滚轮日期） | `我的/日记/*.md` |
| memo 备忘录（待办面板/Todo 弹窗/剪贴板监听/启动弹窗/到期通知） | memo.json |
| belongings 归物本（物品登记，1226 分类已落盘 gen） | belongings.json |
| clipping 剪藏本（列表/站点过滤/长按删除/反链） | `归档/网页剪藏/*.md` |
| news 聚合讯（状态机/统计落盘/dataviewjs 渲染） | news.json |
| password 密码本（AES-GCM/主密码状态机/生成器） | passwords.json |
| favorites 收藏本（GitHub 收藏/AI 简介/余额 5 分钟缓存） | favorites.json |
| library 书库（book 标签识别/笔记树/批注） | `书库/*.md`、`我的/读书笔记` |
| reading-report 阅读报告（年度统计/热力图/习惯，纯函数） | metadataCache 统计 |
| movie 影视（卡片/无限滚动/排序三键/AI 推荐/海报，含 movie-analysis） | `我的/影视/*.md` |
| review 复习计划（FSRS v4 19 权重/阶梯 10 级/逾期轮询） | review.json |
| quiz 做题家（三难度/单多选/复习联动） | quiz.json |
| flash 闪念（窄窗吸附/向量检索 bge-m3/AI 对话，WIP 15 模块） | ai_completion_meta.json + *.vec |
| auto-summary 自动摘要（常驻监听剪藏 → AI 摘要写 frontmatter） | 剪藏 frontmatter |
| ai-agent AI Agent（笔记⇄备忘录/收藏本同步/AI 剪藏匹配） | ai-agent.json |
| launcher 入口页（磁贴网格/编辑模式/手势/双平台配置） | launcher.json |
| pomodoro 番茄钟（状态机/任务关联/设置弹窗/状态栏） | pomodoro.json |
| bili-downloader 下载工具（B 站 web 工具，外部 npm） | —（外部） |

## 测试

- vitest + jsdom，pool: threads；mock-obsidian-entry.ts（Notice→getNoticeMessages/hasNotice/clearNotices/requestUrl/moment/Plugin/Setting）+ mock-vault.ts（内存文件树，files Map + modifiedPaths）+ setup.ts 补 jsdom API。
- 注入：先 `setApp(mockApp)` + `setSettingsProvider(() => settings)` 再测；AI provider 缓存用 `resetAIProviderCache` 重置。
- 分层：数据层/纯函数（parser/config/fsrs/crypto）+ UI 层（jsdom 交互、弹窗、长按、防抖、无限滚动）+ mock fetch（AI/余额/Ollama）。
- 长异步（PBKDF2/crypto/网络）用真实 setTimeout；fake timers 用 `advanceTimersByTimeAsync`。
- 新域必带数据层 + UI 层测试（tests/<域>/），smoke.test.ts（命令清单）同步更新；全量约 1212 测试。

## Git / 工作流

- 分支 master；提交格式 `bz: ticket NN <域> 完成——<要点>，N 测试`；chore/fix 用于杂务；每 ticket 一次提交（测试全绿后）。
- spec 驱动：`.scratch/memo-suite-plugin/spec.md`（59KB，命令 id 全清单/设置项总表/样式/降级链）是唯一事实源，先改 spec。
- ticket 驱动：`.scratch/memo-suite-plugin/issues/NN-<slug>.md`（01-32），头部 `Status:` 记 triage（docs/agents/triage-labels.md）。
- 进度恢复点：`.scratch/memo-suite-plugin/PROGRESS.md`，每次重要节点更新（含待提交架构深化）。
- 新 ADR 写 `docs/adr/NNNN-<slug>.md`（Context/Options/Consequences）并同步 CONTEXT.md；用 CONTEXT.md 术语，勿自造，与 ADR 冲突须标注。


