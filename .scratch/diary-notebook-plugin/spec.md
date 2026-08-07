# Spec: QuickAdd「日记本」独立插件化

Status: `ready-for-agent`
Type: spec
Feature: diary-notebook-plugin

## Problem Statement

用户（叫我包仔）的日记本功能目前是一个 QuickAdd 宏脚本（`CONFIG/SCRIPTS/Quickadd/日记本.js`，4146 行 / 140KB），依赖 QuickAdd 运行时和 Q3.js 挂载到 `window.__utils` 的共享工具（escManager、confirm）。脚本把浮层面板注入 DOM，聚合 `我的/日记`、`我的/影视`、`我的/信` 三个目录的条目，提供标签筛选、写日记、写摘抄、删除、日期筛选、搜索等能力。

用户希望把它变成独立的标准 Obsidian 插件：**UI 与逻辑完全一致**（不是重写，是逐字移植），并且**架构要为后续把其余 QuickAdd 脚本（收藏本、影视、备忘录、密码本等）全部迁移进来预留清晰的扩容写法**。本次只迁移「日记本」一个，先看效果。

## Solution

标准 Obsidian 插件 `diary-notebook`（TS + esbuild 官方样板），安装到 vault 的 `.obsidian/plugins/diary-notebook/`。功能面板、交互、数据格式与原脚本逐字一致；CSS 单独提取为 `styles.css`（不再内联注入）；共享工具（escManager/confirm）从 Q3 移植到独立模块，供后续迁移的脚本复用。

## User Stories

1. 作为日记本用户，我希望启用插件后打开的面板与原 QuickAdd 宏完全一致（布局、样式、交互），以便沿用既有使用习惯，零学习成本。
2. 作为日记本用户，我希望我的 `Alt+A` 热键（绑定 `diary-open-add-dialog`）继续有效，以便不重新设置热键。
3. 作为日记本用户，我希望侧边栏有 ribbon 图标可打开日记面板，以便一键进入。
4. 作为日记本用户，我希望命令面板中能搜到「打开日记本面板」「打开写日记弹窗」「写摘抄」，以便用命令触发。
5. 作为日记本用户，我希望主标签/二级标签筛选（emoji 编码、单选互斥、计数显示）行为与原脚本一致。
6. 作为日记本用户，我希望写日记弹窗支持自然语言时间（`昨天 23:00`、`1分钟前`、`前天 21:30`）与「此刻」，以便快速回填时间。
7. 作为日记本用户，我希望滚轮日期时间选择器（年/月/日/时/分五列、随月份天数联动、双击切手动输入）与原脚本一致。
8. 作为日记本用户，我希望「写摘抄」命令（选中文本 → 生成块引用双链 → 摘抄预览 → 保存到日记）与原脚本一致。
9. 作为日记本用户，我希望 `我的/影视`、`我的/信` 的条目（影评 frontmatter、信件）仍聚合显示在日记流中。
10. 作为日记本用户，我希望删除日记前有确认弹窗（原 `__.confirm` 样式），确认后删除文件中的条目。
11. 作为日记本用户，我希望点击卡片 emoji 可修改条目标签，保存后 emoji 序列与文件内容同步更新。
12. 作为日记本用户，我希望双击卡片内容可跳转到日记文件中对应标题位置（`# emoji HH:mm` 锚点），并自动关闭面板。
13. 作为日记本用户，我希望长按卡片内容可复制双链引用（`[[日期#emoji 时间]]`）。
14. 作为日记本用户，我希望日期筛选（按年/按月、计数、重置）与搜索行为与原脚本一致。
15. 作为日记本用户，我希望无限滚动分批加载（每批 20 条）与"已显示所有日记"提示一致。
16. 作为日记本用户，我希望日记文件在外部被修改时面板自动刷新，且插件自身写入不触发重复刷新。
17. 作为日记本用户，我希望加密条目（内容含 🔐）在面板中隐藏，但写入文件时不丢失。
18. 作为日记本用户，我希望设置页包含原宏的 11 项设置：日记/影视/信目录、批量加载数、长按时长、文件变更延迟、启用长按、显示标签计数、默认标签、使用文件日期、标签配置文本（`标签 emoji` / `主标签 emoji > 子标签 emoji, ...` 格式），以便不丢失任何可配置项。
19. 作为日记本用户，我希望修改设置后立即生效（无需重启），标签配置解析失败时回退默认配置。
20. 作为日记本用户，我希望 ESC 分层关闭（日期选择器 → 标签选择器 → 写日记弹窗 → 删除确认 → 主面板）与原脚本一致。
21. 作为日记本用户，我希望卸载/重载插件时 DOM 清理干净（无残留弹窗、无残留事件监听）。
22. 作为开发者，我希望共享工具（escManager、confirm、utils）是独立模块，以便后续迁移其他脚本时直接复用。
23. 作为开发者，我希望每个脚本对应一个功能域目录（本次 `diary/`），以便后续新增 `favorites/`、`movies/` 等域时不影响已有代码。
24. 作为开发者，我希望构建命令一键产出（`npm run build` → vault 插件目录），以便迭代验证。

## Implementation Decisions

- **工程形态**：TS + esbuild 官方样板；`esbuild.config.mjs` 直接输出 `main.js` 到 vault 的 `.obsidian/plugins/diary-notebook/`，并同步 `manifest.json`、`styles.css`；`npm run dev` 监听重建，`npm run build` 一次性构建。
- **模块结构**（依赖单向：core → config/state → parser → store → ui → main/commands）：
  - `core/`：`esc-manager`（自 Q3 移植，含 register/unregister/destroy）、`confirm`（自 Q3 移植，DOM/id 与原版一致，接入本地 escManager）、`utils`（escapeHtml、generateBlockId、sleep）——共享层，后续脚本复用。
  - `diary/`：`config`（目录常量、批量数、标签配置解析 `parseTagConfig`、emoji 双向映射）、`state`（原脚本 state 对象 + diaryDataMap 等模块级数据）、`types`（DiaryEntry 等）、`parser`（`parseFile` 按 `# emoji HH:mm` 标题解析、`parseMovieFile`、`parseLetterFile`、`parseNaturalTime` 等纯函数）、`store`（loadAll 分批并发加载、writeFile 按时间序写回、addEntry/deleteEntry、refreshFile/refreshSpecialFile、onFileChange 节流监听）。
  - `diary/ui/`：`panel`（init 幂等入口、主面板+遮罩创建、头部、标签栏、进度条、ESC 注册）、`entries`（applyFilter、renderEntries 分批渲染、createEntryCard、双击跳转、长按、内联编辑、showConfirm/删除、滚动与 sticky 日期）、`dialogs`（添加日记弹窗、标签选择器、日期筛选弹窗）、`datetime-picker`（五列滚轮选择器）、`quote`（写摘抄命令）。
  - `commands.ts`：命令注册；`settings.ts`：设置类型 + 默认值 + 设置页；`main.ts`：插件装配/生命周期/卸载清理。
- **循环依赖处理**：原脚本中 store 层函数内联调用 UI 刷新（applyFilter/rebuildTags/updateTitleSuffix）。移植为：store 暴露 `onFullRefresh`/`onLightRefresh` 回调注册，由 ui/panel 层注册（全量刷新 = cancelEdit + applyFilter + rebuildTags + updateTitleSuffix；轻量刷新 = rebuildTags + updateTitleSuffix），刷新时机与顺序与原脚本一致。
- **命令兼容**：`diary-open-add-dialog`、`diary-create-quote` 通过 `app.commands.addCommand` 注册（不加插件 id 前缀，保证用户 `Alt+A` 热键绑定继续生效）；新增 `diary-open-panel`（面板开关）。ribbon 图标打开面板。
- **全局依赖替换**：`obsidian`/`app`/`moment`/`Notice` 从 obsidian 包导入；`window.__utils` → `core/`；`window._diarySettings` → 插件设置实例；`window.diaryDataMap` → state 模块级变量；`window._refreshTimer`、`window._diaryCommandRegistered`、`window.isProcessingRemainingFiles` → 模块级变量；`window.__utils.checkAndShowChangelog`（Q3 专属）删除。
- **数据格式**：完全保持原格式——`我的/日记/YYYY-MM-DD.md`，条目为 `# emoji序列 HH:mm` 标题 + 正文；影视/信条目从各自目录 frontmatter 解析。不迁移、不改写既有数据。
- **CSS**：原 `DIARY_CSS` 常量（494 行）原样提取为 `styles.css`，不再运行时注入 `<style>`；保留原 id/类名与全局 keyframes 名称（视觉一致优先）。
- **启动行为**：与原宏一致——插件加载即打开面板；另有 ribbon + 命令可随时重开/重显。
- **卸载清理**：移除全部注入 DOM（主面板、各弹窗遮罩、confirm）、注销 escManager 层级与全局 keydown 监听、移除已注册命令。

## Testing Decisions

- **测试 seam（已确认，含 UI 层）**：两层自动化测试——
  - **纯函数层**（node:test，无 DOM 依赖）：`parser.ts` 与 `config.ts`。
    - `parseFile`：标准标题行、无 emoji 回退「日记」、时间越界跳过、空行分段、向后兼容 `type` 字段、emoji 序列 → 多标签。
    - `parseMovieFile`/`parseLetterFile`：frontmatter 缺失/无效日期/readonly 忽略 等分支。
    - `parseNaturalTime`：`1分钟前`/`昨天 23:00`/`前天 21:30`/标准格式/非法输入。
    - `parseTagConfig`：主标签行、含 `>` 二级标签行、非法行跳过。
  - **UI 层**（jsdom + vitest）：DOM/交互行为测试。
    - 环境：jsdom 提供 `document`/`window`；`obsidian` 模块整体 mock（`Notice`、`MarkdownRenderer`、`Component`、`moment` 等）；`app.vault`/`app.workspace` 用内存 mock（可读写的虚拟文件树）。
    - 模块形态要求：`diary/ui/*` 的创建函数（panel/dialogs/datetime-picker/entries）必须可在 jsdom 中独立实例化，不隐式依赖 Obsidian 运行时全局（全局 `app` 引用通过模块级注入函数赋值，测试中替换为 mock）。
    - 测什么（外部行为，不测实现细节）：面板创建后 DOM 结构与可见性；点击标签按钮 → 筛选结果/计数更新；主标签 → 二级标签联动显示；打开/关闭添加弹窗与默认标签；滚轮选择器五列渲染与月份天数联动；写摘抄流程（选中文本 → 预览 → 保存调用 addEntry 并写回 mock 文件）；删除确认 → 条目移除与文件写回；ESC 分层关闭顺序；onFileChange 外部修改 → 面板刷新。
    - 验收：`npm test` 全部通过作为门禁（连同纯函数层）。
- **构建验证**：`npx tsc --noEmit` 类型检查 + esbuild 构建成功作为门禁。

## Out of Scope

- 其余 QuickAdd 脚本（收藏本、影视、备忘录等）的迁移——仅架构预留，不实现。
- 数据格式迁移或改写——严格保持现有 `我的/日记` 格式。
- 面板外观/交互的改进或主题化调整——逐字一致优先。
- 自动化 UI 测试框架引入。

## Further Notes

- 待用户确认：测试 seam 是否接受（纯函数层单测 + UI 目测验收）；如用户期望更高覆盖，可后续引入 jsdom 层测试，但会显著增加工程量。
- 待用户确认：插件 id `diary-notebook`、显示名「日记本」、ribbon 图标（notebook-pen）是否满意。
- 插件启用方式：构建产物已就位后，需在 Obsidian 设置 → 第三方插件中手动启用「日记本」。
