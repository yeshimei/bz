# ADR-0066: 文献盒 v2——面板正名、进度细化、设置提取与域事件分发

日期: 2026-08-28
状态: 已采纳
前置: ADR-0065（视频转文献面板与批量处理）；ADR-0062（小橘行为流全量日志）；ADR-0047（域事件总线）；ADR-0064（声明式设置 schema 渲染器）

## 背景

用户实测 ADR-0065 批量处理后提出四项诉求（grilling 拍板）：

1. **UI 进度滞后**：「解析中后，json 里已是下载中，但面板没更新」——根因是进度事件先落库、UI 整表重读 storage 渲染，落库与重读存在竞态，且长步骤（下载/转写/生成）期间 UI 长时间静态。
2. **更详细的进度提示**：百分比 + 步骤时间线全都要（Q5 最详尽选项）。
3. **面板整顿**：起正式名字、把原有「B站下载」入口放进右侧按钮、设置收敛进 ⚙️ 弹窗并提取设置项。
4. **接入小橘**：添加分发事件，接入小橘行为流（Q6 只收「添加任务」+「单条成功」；Q7 全部仅行为流；Q8 静默记录不开口）。

## 决策

1. **面板正名「文献盒」**：命令 `bz-bili-tasks-open` 显示名、面板标题、⚙️ 弹窗标题、术语表统一改「文献盒」（任务名词 = 转文献任务）；**命令 id 与数据文件不变**（外部契约冻结）。与工具 `literatureFolder` 缺省「文献盒」呼应。
2. **下载入口并入右侧按钮区**：头部新增 ⬇️ 按钮（按钮秩序 功能 → ⚙️ → 关闭），点击弹出原 `bz-bili-open` 单条下载弹窗（完整复用既有弹窗契约，零重写）；移动端隐藏（child_process 桌面端专属）。
3. **实时进度修复**：`[bz-step]/[bz-p]` 事件到达即更新内存进度态 + **行内定点刷新 DOM**（不再整表重读 storage），UI 与工具输出同步；步骤文案仍落库（面板重开/刷新可读）。另修 refreshPanel 在 await 后 DOM 已销毁的竞态（二次判空）。
4. **行内详细进度**（设置「详细进度提示」，默认开）：✓已完成步骤时间线 → 当前步骤 + 阶段百分比 + 进度条 + ⌛耗时（1s 秒针）；关闭则仅回退步骤徽章（旧行为）。简要/详细互不影响数据。
5. **工具层进度协议**：core.js `runBatch` 新增 `onProgress({phase, pct})`（download 字节比 / trim ffmpeg time= / transcribe 文件哨兵计数 / ai 分块 i/N，`pct=null` 表示不确定、绝不假报），cli.js `--batch` 输出 `[bz-p] {"phase","pct"}` 行（每阶段 300ms 节流，按 phase 独立计时——快速衔接阶段不吞行）；同时补齐「交付中」「笔记落盘中」两个 `[bz-step]`。
6. **设置提取（⚙️ 弹窗「文献盒处理」组五项，默认值 = 既存行为，零迁移）**：
   - 详细进度提示（toggle，默认开）；
   - 保留视频原件（toggle，默认开；关 = 跳过交付，只出文献笔记且无视频双链，`video:null`）；
   - 下载清晰度（select 最高/1080P/720P，默认最高；经任务 JSON `options.quality` 透传，低档命中独立缓存键）；
   - 遇错即停（toggle，默认关=失败后继续；开 = 当前失败后停止整批，未开始项保持待处理，`onBatchDone` 报 `stopped`）；
   - 输出目录（text，默认空=跟随工具配置 `~/.bilibili-dl.json`；非空经 `options.outputDir` 覆盖交付目录）。
   设置项全部「键直绑」（settings-schema `{key}` → data.json），透传通道 = 任务 JSON 新增 `options` 字段（向后兼容，旧 CLI 忽略未知字段按默认走）。
7. **域事件分发（接入小橘行为流）**：保留既有 `'bili-tasks'` 通道（添加 / 编辑 / 转换成功 / 失败 四 kind），**只把 added/converted 两个节点接进小橘**（用户拍板；edited/failed 由 `buildBiliStructured` 返回 null 跳过）。smartcat 侧走六域样板：订阅 `'bili-tasks'` → `buildBiliStructured`（entityType 'bili'，name = BV 号 / 文献标题）→ `addObservation('bili-downloader', {structured})`。
8. **小橘路由 = 仅行为流**（`bili-downloader:added` / `bili-downloader:converted` → behavior）：不向量化、不进记忆流、聊天不召回（ticket 123 知识内容口径）；行为流来源标签「文献盒」；面板文案模板注册（`bili:added`「你添加了转文献任务（BV…）」/ `bili:converted`「你把《标题》转成了文献」+ routing 别名双注册）；静默记录，小橘不气泡（用户拍板）。

## Consequences

- 工具侧：core.js `runBatch` 增 `onProgress` 与 `options` 支持（quality/keepVideo/outputDir）+ 2 个新步骤行；cli.js 增 `[bz-p]` 协议；`tests/batch.test.js` 12 用例（进度行/keepVideo/quality 缓存键/outputDir 覆盖）。
- 插件侧：settings.ts +5 键（`biliProgressDetail/biliKeepVideo/biliQuality/biliStopOnFailure/biliOutputDir`，默认保现状）；processor.ts 解析 `[bz-p]` + 设置透传 + 遇错即停；ui.ts 正名/下载按钮/行内详细进度/⚙️ 五设置项；smartcat 新增 bili-source.ts + 订阅 + 路由 2 条 + 来源标签 + 文案模板。
- 测试：processor 9 用例（含进度行/遇错即停/透传）、ui 11 用例（含进度渲染/下载钩子/schema）、smartcat bili-action 5 用例 + routing/wording 扩充。
- 兼容性：`bili-tasks.json` 格式不变；`bz-bili-open`/`bz-bili-tasks-open` id 不变；旧 CLI（无 options 支持）收到 options 字段按默认行为执行，无破坏。

## 未采纳方案

- **进度事件逐条进小橘行为流**：行为流是终态痕迹不是进度日志，会刷爆 2000 条滚动窗口（用户拍板只收两个节点）。
- **文献完成进记忆流**（对标 movie:watched 重要度 0.8+）：用户拍板严守 ticket 123「知识内容 → 行为流不向量化」。
- **小橘气泡播报**（批量完成时开口）：用户拍板静默记录。
- **面板内嵌下载表单 / 并入主设置页**：分别违背「复用弹窗契约」与「设置页单页、域设置走 ⚙️ 弹窗」惯例。
- **SSE/HTTP 进度通道**：批处理保持无头 stdin/stdout 协议，插件只 spawn 外部命令的边界不动。