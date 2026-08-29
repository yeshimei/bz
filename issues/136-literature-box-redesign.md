# Ticket 136 — 文献盒改版（literature 域、术语生成、AI 回迁、去网页版）

> 规格契约（grill-with-docs 五轮拍板，2026-08）。实现按本文件契约走，子代理以本文件为准，勿改契约。

## 0. 目标概述

把「文献盒」从 bili-downloader 域迁出为独立域 `literature`（src/literature）：

1. **主面板改版**：像剪藏本一样列出「文献目录」文件夹里的文献笔记（.md），右上角三按钮：**文字录入 / 视频录入 / 设置**。
2. **新增术语生成流程**：选中词 → 命令预填 → AI 生成一段简介 → 预览可改 → 确认写入。
3. **AI 从外部 CLI 回迁 bz 插件**：CLI 不再调 AI；移除 bili-dl 网页版（server.js/public/bz-bili-open 命令），工具只留无头批处理，产出转录临时文件交插件做 AI 与笔记落盘。
4. **数据收拢**：`CONFIG/STORAGE/literature.json` 单一数据文件；旧 `bili-tasks.json` 不迁移不做兼容。
5. **设置全部并入主面板设置面板**（含工具级配置、领域词表、文献目录、压缩等，参考日记本设置页声明式 schema）。
6. **所有文献笔记统一携带文献类型（type）与领域（domain）**；旧笔记打开面板时自动补全。

## 1. 域与命令

- 域目录 `src/bili-downloader` → `src/literature`（index/data/types/ui/processor/styles）。
- 命令（main.ts 单点注册，id 三段式 `bz-<域>-<动作>`）：
  - `bz-literature-open`（名称「文献盒」，原 bz-bili-tasks-open 改名）
  - `bz-literature-note-term`（名称「术语生成文献笔记」，新增）
  - 删除 `bz-bili-open`（网页版已移除）与旧 `bz-bili-tasks-open`。
- `core/path-classify.ts`：`FileDomainKind` 新增 `'literature'`；按设置键 `literatureDirectory` 匹配（缺省回退 `文献盒`），判定优先级沿用既有顺序（追加到 letter 之后）。
- 域事件通道 `'bili-tasks'` → `'literature:tasks'`；`literature:file-*` 由 path-classify 命中后自动产生。

## 2. 数据（literature.json）

- 文件 `CONFIG/STORAGE/literature.json`，视频任务结构**沿用现 bili-tasks.json 字段**（id/url/start/end/status/reason/remark/notePath/videoPath/created/processedAt/title/uploader/archived/archivedAt/quality/page）——仅文件名与读写域变更，字段形状零改动。
- 术语生成**不留任务记录**（一次性流程）。
- 旧 bili-tasks.json 不迁移、不做兼容（用户拍板）。

## 3. 主面板（文献列表）

- **数据源**：扫描 `literatureDirectory`（默认 `文献盒`）下 .md，`metadataCache` 解析 frontmatter（title/type/domain/summary/date…），列表 = 文件夹实况，**不从 literature.json 派生**。
- **排序**：固定「最近创建降序」（剪藏本同款，无排序选项）。
- **顶部筛选**：领域筛选行（「全部 (N)」+ 各领域按钮带数量标签，剪藏本 rebuildSiteBar 同款，按 count 降序）+ 类型过滤（全部/视频/术语，与领域筛选可叠加）。
- **搜索框**：标题/简介，300ms 防抖，与筛选叠加；**搜索框切换显示按钮放右上角**（剪藏本同款 🔍）。
- **懒加载**：scroll 触底（阈值 50px），批次 ~20，尾部「已显示所有」提示（照抄 clipping initScroll）。
- **自动刷新**：订阅 `literature:file-created/modified/deleted/renamed` 四通道 + 300ms 防抖增量更新（照抄 clipping attachFileListener/scheduleRefreshFlush）；目录设置变更时清缓存全量重载。
- **列表项**：标题 + 类型徽标（视频/术语）+ 领域徽标 + 简介（两行省略）+ 日期。
- **双击打开**：click 计数 300ms（影视先例 movie/ui.ts:155），打开笔记。
- **抽屉**（attachItemActions，桌面右键/移动长按自动分流）：
  - 通用：打开 / 复制双链 / 删除（danger + flow-dialog 确认）
  - 视频笔记：+ 复制原文链接（url）；删除时**同步清理 literature.json 里指向该笔记的成功任务记录**（避免悬挂 notePath）
  - 术语笔记：无「重新生成」动作（重新生成统一走「文字录入」入口）
  - 抽屉顶部 sheetHead：标题 + 简介。
- **旧笔记自动补全**：打开面板时对缺 type/domain 的笔记自动补全——type 启发式（frontmatter 有 url/author/videoTitle → video；有 term → term）；domain 用 AI 分类；补过落库不再重复；AI 未配置跳过并提示。

## 4. 右上角三按钮

按钮秩序：功能 → ⚙️ → 关闭（.bz-win-head / .bz-win-close 规范）。

1. **文字录入**：打开术语生成面板（见 §6）。
2. **视频录入**：打开视频录入面板（任务队列，见 §5）。
3. **设置**：打开文献盒设置面板（见 §7）。

## 5. 视频录入面板与批处理

- **面板**：现转文献任务面板整体搬入，**去掉 ⚙️ 设置按钮**（设置已入主面板）、**去掉 ⬇️ 下载按钮**（网页版已删，下载并入批处理）。保留 ➕ 添加 / ▶️ 处理 / ⏹ 中止 / 🕘 历史 / ✕。
- **移动端**：仅保留「添加」和「历史」+ ✕（隐藏 处理/下载/中止——原 isMobileEnv 逻辑扩展）。
- **批处理（AI 回迁后）**：
  1. 插件 spawn 无头批处理 `cli.js --batch '<json>'`，taskJson 下发全部设置（quality/keepVideo/outputDir/compress/crf/vaultPath/ffmpegPath/ffprobePath/pythonPath/whisperModel/cacheDir/cacheRetentionDays + url/start/end/page）。
  2. CLI 步骤：解析中 → 下载中 → 剪辑中（有起止才跑）→ **压缩中（压缩默认开才跑）** → 转文字中 → 交付中（keepVideo 且交付）→ `[bz-result] {"transcript":"<转录临时文件绝对路径>","video":"<vault相对|绝对|null>"}` 并 exit 0。
  3. 插件读转录临时文件（UTF-8 全文）→ **插件侧 AI**：元数据（title/tags/summary）+ type: video + domain + 分块润色正文 → 写笔记（九键 frontmatter，见 §8）→ 更新任务 notePath → 归档。转录临时文件读完插件删除。
  4. UI 步骤时间线连续展示：解析→下载→剪辑→压缩→转文字→交付→**AI 生成文献笔记中→笔记落盘中**（后两步由插件驱动，沿用 STEP_DONE_MAP 完成态文案）。
  5. 插件侧 AI 步骤失败 = 该任务 failed（不落半成品笔记）；重试时 CLI 从缓存续跑（跳过已成功步骤、重产转录临时文件）→ 插件重做 AI。
  6. **断点续跑缓存范围**：CLI 缓存只留机械产物（剪辑件/转写稿等），**移除 AI 元数据/润色分块缓存**。
- **压缩**：默认开（用户拍板）；CRF 默认 23（范围 18–28）；设置项「压缩」toggle +「压缩质量(CRF)」number。

## 6. 术语生成流程（文字录入）

- **词来源**：编辑器选中文本 + 执行命令 `bz-literature-note-term` → 面板输入框预填选中词；无选中则空输入框手动填。命令触发时读当前激活 Markdown 编辑器选区。
- **面板交互**：
  1. 输入框（预填/可改）+「生成」按钮；空术语不生成。
  2. 点「生成」→ AI 生成**一段简介**（百科总结式，不用长文/固定小节）→ 进入预览。
  3. 预览：显示完整笔记（frontmatter 字段 + 简介正文），**术语/领域可改、简介正文可编辑**；「重新生成」= 用当前术语+领域重跑 AI 生成新简介（**丢弃预览手改内容**，未确认不落盘无破坏）；「确认写入」落盘。
  4. 确认写入后**自动打开新笔记**；行为流发 term-generated 观察。
- **frontmatter**：`title`（=术语词）/ `type: term` / `domain`（领域）/ `term`（术语词）/ `date`；正文 = 一段简介。不加 tags/summary。
- **文件命名**：术语词作文件名，重名加序号（uniquePath，永不覆盖）。
- **入口**：命令 + 主面板「文字录入」按钮，同一流程。
- **移动端可用**（纯 AI + 写文件，无 Node 依赖）。

## 7. 设置面板（主面板「设置」按钮，openSettingsModal 声明式 schema）

分组清单（全部设置并入，参考日记本 diarySettingsSchema 结构）：

- **「目录与分类」**（folder-open）：
  - `literatureDirectory` path single（文献目录，默认 `文献盒`）
  - `literatureDomainList` textarea（领域词表，逗号分隔，**可空** = AI 自由写）
- **「视频处理」**（settings-2）：`literatureProgressDetail` toggle / `literatureKeepVideo` toggle / `literatureQuality` select(highest/1080/720) / `literatureStopOnFailure` toggle / `literatureOutputDir` text / `literatureCompress` toggle（默认开）/ `literatureCrf` number（默认 23，18–28）
- **「工具」**（wrench，原网页版配置全并进）：`literatureFfmpegPath` / `literatureFfprobePath` / `literaturePythonPath` / `literatureWhisperModel` / `literatureCacheDir` / `literatureCacheRetentionDays`（path/text 行）
- **「移动端」**：`mobileFullscreenGroup('literatureMobileDefaultFullscreen')`
- **「维护」**（wrench）：清空历史（button 行 + 确认弹窗）

设置键：全部以 `literature` 前缀命名（原 bili* 键随域更名，旧 data.json 键废弃不迁移——用户拍板不做兼容）。`src/settings.ts` 同步声明类型与 DEFAULT_SETTINGS。

**主窗口接入三件事**（AGENTS.md 规范）：`literatureMobileDefaultFullscreen` 布尔键 + 默认值（原 95% 居中卡 → false）；打开路径 `applyMobileWindowFullscreen(popup, tryGetSettings().literatureMobileDefaultFullscreen === true)`（主面板 + 历史弹窗两处）；⚙️ 弹窗挂 mobileFullscreenGroup（仅 isMobileEnv 显示）。

## 8. 文献笔记 frontmatter

- **视频笔记**（九键）：原七键 `title/tags/summary/url/date/author/videoTitle` + `type: video` + `domain`（领域）；正文 = 逐段「润色正文 + 视频双链」。
- **术语笔记**（五键）：`title/type: term/domain/term/date`；正文 = 一段简介。

## 9. 领域分类（domain）

- 词表：设置面板维护（逗号分隔），**不内置默认**；空 = AI 自由写领域词。
- 判定：AI 生成时自动分类（有词表则从词表选、超出可自定义；空词表自由写）；用户在术语预览/编辑时可改。
- 列表按领域筛选 + 数量标签；领域徽标展示。

## 10. smartcat 行为流

- `src/smartcat/bili-source.ts` → `literature-source.ts`：通道 `'literature:tasks'`。
- 观察收敛为两类（移除 added/parsed/edited/failed）：
  - `converted`（视频转文献成功，载荷带 notePath/url）——文案沿用「你把《X》转成了文献」
  - `term-generated`（术语生成成功，载荷带 term/title）——文案「你为〈术语〉生成了一篇术语文献」（措辞可微调，消息正文不带 emoji）
- `behavior-wording.ts` / `routing.ts` / `memory.ts` 的 domain 映射 `'bili-downloader' → 'literature'`；行为流不向量化（维持现状）。

## 11. 聚合讯入口

- `news/reader.ts` 保存至文献（ADR-0068）：B站条目「保存至文献」改为**打开视频录入面板**（任务队列）+ 添加转文献任务弹窗（预填链接/标题/UP主），不落文献列表主面板；底层调用随命令改名（openBiliAddTask → literature 域对应入口）。

## 12. CLI（tools/bili-downloader）改动

- **删除**：`server.js`、`public/`、`tests/server.test.js`、网页相关配置与交付模式/CRF/分段/cookie/端口等网页专用项。
- **去 AI**：删除 `core.js` 的 AI 元数据/润色（aiJson/aiPolish）、`buildLiteratureNote`、literatureFolder 相关；AI 配置读取（data.json 直读）一并删除。
- **保留/改造**：无头批处理 `cli.js --batch`；core.js 的 解析/下载/剪辑/压缩/转文字/交付；产物缓存（机械产物）与断点续跑缓存（去 AI 产物）。
- **新增**：`[bz-result]` 输出转录临时文件路径（见 §5.2）；taskJson options 全量下发插件设置；**压缩步骤**（compress/crf）。
- **rc**（~/.bilibili-dl.json）：保留工具级配置（outputDir/vaultPath/ffmpegPath/ffprobePath/pythonPath/whisperModel/cacheDir/cacheRetentionDays），作为插件未下发时的兜底；网页专用键删除。
- 测试 `tests/batch.test.js` 同步更新（压缩步骤、转录临时文件、无 AI）。

## 13. 测试与门禁

- 数据层（@vitest-environment node）+ UI 层测试 + smoke.test.ts 同步（新域面板/命令/数据管理器）。
- `pnpm test` + `pnpm exec tsc --noEmit` + 构建验证全绿；自审 + diff 审查。
- 命令 id 改名需同步检查 main.ts 单点注册、外部裸调用约定、任何硬编码引用。

## 14. 文档同步

- 新 ADR：AI 回迁+去网页版 / 新域迁出+literature.json / type+domain 契约（docs/adr/0071-0073）。
- CONTEXT.md 词条更新：B站下载、文献盒、快速流程、文献笔记、新增 文献类型/领域/术语文献/文献目录。
- PROGRESS.md 同步进度。
