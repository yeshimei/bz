# ADR-0065: 视频转文献——待转列表与无头批处理（bili-downloader 域升级）

日期: 2026-08-28
状态: 已采纳
前置: ADR-0011（B站下载独立 Web 工具）；ADR-0049（工具直读 bz AI 配置/缓存/文献笔记快速流程）；ADR-0019（移动端默认全屏跨域开关）

## 背景

用户需求：把 B站视频按「链接 + 起止时间」批量转成文献笔记。最初设想挂备忘录场景，grilling 后拍板**不走备忘录域**——因为 B站下载服务是桌面端专属（spawn 本地 Node 服务 + 开浏览器，移动端 Capacitor 不可用），移动端只能**暂存录入**，桌面端才有能力**批量处理**；且处理产出（文献笔记）是工具既有能力，与备忘录语义不匹配。

## 决策

1. **平台分治（移动端暂存 / 桌面端处理）**：面板在移动端仅提供录入（隐藏处理/中止/清空按钮，`isMobileEnv()` 判断）；桌面端显示「批量处理」。与 ADR-0019 的「桌面端专属能力」口径一致。
2. **处理引擎 = 外部工具无头批处理命令**：给 `tools/bili-downloader/cli.js` 新增 `--batch '<json>'` 模式（任务 JSON：`{url, start, end}`），复用 core.js 既有流水线（parseVideo/downloadVideo/trimVideo/runPython/aiJson/buildLiteratureNote 等），逐步向 stdout 打 `[bz-step] 名称` 行、成功末尾 `[bz-result] {"note","video"}`、失败 stderr 给中文原因 + exit 1。插件 spawn + 解析，**不引入 HTTP/SSE、不 require core.js**（保持「插件只 spawn 外部命令」的既有边界）。网页版行为不受影响。
3. **产出形态 = 既有「快速流程」文献笔记**：每部视频走 解析→下载→剪辑（起止有值才跑，ffprobe 校验兜底）→转文字（faster-whisper）→AI（直读 bz data.json 配置）→交付→写「文献盒」；**不做简易降级**（whisper/AI 缺失即该项失败，原因带安装引导）。
4. **归属 = 并入 bili-downloader 域**：薄启动器（仅 `bz-bili-open`）升级为完整域（data + ui + 设置 + processor）。新增面板「待转文献」+ 命令 `bz-bili-tasks-open`；`bz-bili-open` 及其 id/名称/图标**契约不变**（smoke 白名单冻结）。
5. **数据**：新文件 `CONFIG/STORAGE/bili-tasks.json`（新数据格式，不涉及兼容性冻结）。条目字段：`id/url/start/end/status(pending|processing|success|failed)/reason/remark/notePath/videoPath/created/processedAt`。
6. **批次语义**：按列表顺序**串行逐部**（一次一部）；单部失败 → 继续剩余、失败项可重试；全部成功才算批次完成；「中止整批」= 杀死当前子进程 + 当前项标记「已中止」+ 未开始项保持待处理。
7. **进度展示**：不做独立顶栏进度条，进度直接显示在列表行上——当前项显示「第 i/N 部 + 当前步骤文案」，前置项显示状态徽标（待处理/处理中/成功/失败）。
8. **点击分流**：成功项 → 打开文献笔记 .md；失败项 → 查看原因（可重试）；待处理项 → 编辑（链接/起止/备注）。

## Consequences

- 工具侧：core.js 新增导出 `runBatch(task, deps)`（全依赖注入，含缓存命中检测/回写、vault 相对路径 + wiki 等价副本）；cli.js 新增 `--batch` 分支（惰性 require server，服务模式不动）；`tests/batch.test.js` 8 用例（真实 ffmpeg 剪辑集成）。
- 插件侧：`src/bili-downloader/` 从 1 文件扩为 6 文件（types/data/processor/index/ui/styles）；main.ts 命令表 +1、onunload +unloadBiliDownloader；settings.ts +`biliTasksMobileDefaultFullscreen`（默认关）；build-css.mjs SOURCES 登记新样式。
- 测试：数据层（node）/跑批器（jsdom mock spawn）/UI（jsdom）/smoke EXPECTED_COMMAND_IDS 登记 `bz-bili-tasks-open`。
- 文档：AGENTS.md 领域清单 `bili-downloader` 行改 `bili-tasks.json`；CONTEXT.md 术语区新增「待转文献」、桌面端专属能力实例更新、移动端默认全屏域数 11→12。

## 未采纳方案

- **走备忘录场景**：用户拍板（移动端暂存/桌面端处理的平台分治与 memo 语义不符）。
- **起服务后走 HTTP API + SSE**：服务是单任务状态机，批处理需排队改造，端口/状态易碎。
- **插件内 require core.js**：等于在 bz 侧再造任务编排，破坏「插件只 spawn 外部命令」边界。
- **简易交付（不做转文字/AI）**：产出质量不如快速流程；whisper/AI 缺失走失败+引导，不静默降级。