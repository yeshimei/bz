# AGENTS.md — 包仔（bz）Obsidian 插件

## 项目概述

「包仔」（bz）是一个独立的 Obsidian 插件，包含以下功能域：日记本、备忘录、归物本、剪藏本、聚合讯、密码本、收藏本、书库、阅读数据分析报告、影视（含影视分析）、复习计划、做题家、闪念、自动摘要、AI Agent。数据文件沿用既有格式（`CONFIG/STORAGE/*.json`、`我的/日记/*.md`、frontmatter 字段），旧数据直接可读。

**项目语言：中文**——代码注释、提交信息、issue、文档一律用中文。

## 常用命令

```bash
npm install        # 首次安装
npm run dev        # esbuild 监听重建（产物直出 vault 插件目录）
npm run build      # 一次性生产构建
npm test           # vitest 全量测试（约 500 测试）
npx tsc --noEmit   # 类型检查
```

- 构建产物直出 `E:/Obsidian/叫我包仔/.obsidian/plugins/bz/`（esbuild.config.mjs 硬编码，勿改路径）。
- 测试通过 `vitest.config.ts` 的 resolve.alias 把 `obsidian` 模块替换为 `tests/mock-obsidian-entry.ts`。

## 架构

```
src/main.ts                 装配：命令裸注册表、设置页（14 个 tab）、懒加载开关、onunload 清理
src/core/                   共享层（内部工具模块，不挂 window）：
                           app（getApp/setApp）、settings-provider（getSettings/tryGetSettings）、
                           ai（createAI/AIService）、json-store、esc-manager、confirm、
                           utils、dom、changelog
src/<域>/                   每域独立：index.ts（入口）+ data + ui（+ state/types/config）
src/diary/ui/               日记本 UI 拆分（panel/entries/dialogs/quote/datetime-picker/filter-shared/ui-settings）
src/settings.ts             MemoSettings 接口 + DEFAULT_SETTINGS（全量设置项）
tests/                      mock-obsidian-entry.ts + mock-vault.ts + 每域测试 + smoke.test.ts
styles.css                  各域样式最终收敛于此（styles/<域>.css 为中间态）
docs/adr/                   架构决策记录（0001-0005）
CONTEXT.md                  领域术语表（Domain glossary）+ 规则
.scratch/<feature>/         spec.md + issues/NN-<slug>.md（issue tracker）
```

**依赖方向（ADR-0002，勿破坏）**：`core ← config/state ← parser ← store ← ui ← main`。store 层无 DOM 依赖；UI 刷新通过回调注册（`onFullRefresh`/`onLightRefresh` 等）由 ui 层订阅。UI 内部的函数级引用环允许，但环内引用必须发生在函数体内（延迟解析），禁止模块顶层互相访问。

## 铁律（不可破坏的约定）

1. **数据格式稳定**：读写格式保持既有约定——`CONFIG/STORAGE/*.json` 字段名、`我的/*` 笔记格式、frontmatter 字段。改字段 = 用户数据损坏。
2. **命令裸注册**：命令 id 统一 `bz-` 前缀（ADR-0004 修订：2025 用户决策品牌统一，推翻不带前缀约定）；**不设置默认快捷键**；命令只在 `src/main.ts` 的 COMMANDS 表注册一次，域内**不重复 addCommand**；卸载时 removeCommand 全量清理。
3. **面板 DOM id/类名稳定**：外部依赖此约定（如 `#add-diary-mask`、`#todo-popup`）。新增 UI 保持既有 id/类名风格。
4. **实现稳定性**：UI 文案、CSS、公式（FSRS 幂律、香农多样性、基尼平衡等）保持既有实现；已知缺陷保持不动（如多选计数 bug、主演计数取单次）。
5. **懒加载（ADR-0003）**：UI 域 `ensureXxx` 幂等初始化（首次命令触发）；事件常驻域（auto-summary/ai-agent/flash）按设置开关注册（`ensureAutoSummary`/`ensureAIAgent`/`ensureFlashOnReady`）。
6. **域间共享**：经显式 import 或 core 层（`getApp()`/`getSettings()`/`createAI()`），不挂 `window` 全局（`__MOVIE_FOLDER_PATH` 为兼容遗留，新代码不要新增 window 状态）。
7. **外部依赖按 ADR-0005**：AI 配置在插件设置（data.json）；聚合讯继续写 dataviewjs 代码块由 Dataview 渲染（不自渲染）；闪念走 Ollama HTTP。

## 领域清单（src/<域>/ 与数据文件）

| 域 | 说明 | 数据 |
|---|---|---|
| diary 日记本 | 面板/写日记/写摘抄/标签筛选/滚轮日期 | `我的/日记/*.md` |
| bz 备忘录 | 待办面板/Todo 弹窗/剪贴板监听/启动弹窗 | `CONFIG/STORAGE/memo.json` |
| belongings 归物本 | 物品登记（1226 默认分类已落盘 gen 文件） | `CONFIG/STORAGE/belongings.json` |
| clipping 剪藏本 | 文章列表/站点过滤/长按删除/反链 | `归档/网页剪藏/*.md` |
| news 聚合讯 | 阅读流状态机/统计落盘/dataviewjs 渲染 | `CONFIG/STORAGE/news.json` |
| password 密码本 | AES-GCM 加密/主密码状态机/生成器 | `CONFIG/STORAGE/passwords.json` |
| favorites 收藏本 | GitHub 收藏/AI 标题简介/余额查询 5 分钟缓存 | `CONFIG/STORAGE/favorites.json` |
| library 书库 | book 标签识别/读书笔记树/批注 | `书库/*.md`、`我的/读书笔记` |
| reading-report 阅读报告 | 年度统计/热力图/习惯分析（纯函数） | metadataCache 统计 |
| movie 影视 | 卡片/无限滚动/排序三键/AI 推荐（已含 movie-analysis） | `我的/影视/*.md` |
| review 复习计划 | FSRS v4（19 权重幂律）/阶梯 10 级/逾期轮询 | `CONFIG/STORAGE/review.json` |
| quiz 做题家 | 三难度出题/单多选/复习联动 | `CONFIG/STORAGE/quiz.json` |
| flash 闪念 | 窄窗吸附/向量检索（Ollama bge-m3）/AI 对话 | `CONFIG/STORAGE/ai_completion_meta.json` + `*.vec` |
| auto-summary 自动摘要 | 常驻监听剪藏目录 → AI 摘要写 frontmatter | 剪藏 frontmatter |
| ai-agent AI Agent | 笔记 ⇄ 备忘录/收藏本同步/AI 剪藏匹配 | `CONFIG/STORAGE/ai-agent.json` |

## 测试规范

- vitest + jsdom；`tests/mock-obsidian-entry.ts`（Notice/requestUrl/moment/Plugin/Setting mock）+ `tests/mock-vault.ts`（内存文件树，`files` Map + `modifiedPaths` 记录）；`tests/setup.ts` 补 jsdom 缺失 API。
- 域测试注入：`setApp(mockApp)` + `setSettingsProvider(() => settings)` 后再测数据层/UI 层。
- 分层测试：数据层/纯函数（parser/config/fsrs/crypto）+ UI 层（jsdom 交互、弹窗、长按、防抖、无限滚动）+ mock fetch（AI/余额/Ollama）。
- 长异步（PBKDF2/crypto/网络）用真实 setTimeout 等待；fake timers 下用 `advanceTimersByTimeAsync`。
- 新增域必须带测试：数据层 + UI 层，smoke.test.ts 需同步更新（命令清单）。

## Git / 提交规范

- 分支：master。提交信息格式：`bz: ticket NN <域> 完成——<要点>，N 测试`；chore/fix 前缀用于杂务。
- 每个 ticket 一次提交（完成 + 测试全绿后提交），参考 git log 历史。

## 工作流

1. **spec 驱动**：`.scratch/memo-suite-plugin/spec.md`（49KB，命令 id 全清单/设置项总表/样式规模/降级链）是唯一事实源，改行为先改 spec。
2. **ticket 驱动**：`.scratch/memo-suite-plugin/issues/NN-<slug>.md`（01-20 已发布），issue 头部 `Status:` 行记录 triage 状态（`ready-for-agent`/`resolved` 等，见 docs/agents/triage-labels.md）。
3. **进度恢复点**：`.scratch/memo-suite-plugin/PROGRESS.md` 是上下文压缩恢复点——每次重要节点更新它（已完成表/待办/关键约定/环境注意）。
4. **ADR**：新架构决策写入 `docs/adr/NNNN-<slug>.md`（含 Context/Considered Options/Consequences），并同步 CONTEXT.md。
5. **领域术语**：使用 CONTEXT.md 术语表词汇，避免自造同义词；输出若与 ADR 冲突必须显式标注。

## 陷阱速查

- 测试中 `getVault()` 辅助需在 setup 内补 `_vault = vault`。
- `tryGetSettings()` 未注入时返回空对象（安全读取）；`getSettings()` 未注入时抛错。
- AI provider 有缓存（`resetAIProviderCache`）；测试间需重置。
- esbuild 产物是 CJS、target es2018、external 含 `obsidian/electron/@codemirror/*`。
- 闪念（src/flash/）目前是 24 行占位骨架（ticket 18 未实现，`ensureFlash`/`openFlashReference`/`openFlashChat` 占位）；蓝图称原脚本约 2311 行，两处停用词表（35 字/44 字）分别保留。
- `E:/Obsidian/1` 是源码仓库，`E:/Obsidian/叫我包仔/` 是用户 vault（构建产物落点），不要混淆。

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five default roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
