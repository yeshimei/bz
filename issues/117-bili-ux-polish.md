# 117：bili-downloader 体验优化（P1 六项 + P3 三项 + AI 润色进度反馈）

## Status
ready-for-agent

## Related
- ADR-0011（独立 NodeJS Web 工具边界不变）；`tools/bili-downloader/CONTEXT.md` 术语同步
- 范围仅体验层：不做并行润色/并行下载/断点续传等实现层优化（另立票）

## What to build

`tools/bili-downloader` + 插件启动器 `src/bili-downloader/index.ts` 十项体验优化（用户采纳）：

1. **转文字进度反馈**：Python 逐段 flush（`\x1e<file>\x1f<seg>\x1f\n`）+ 文件结束空行哨兵；`parseTranscriptUnits` 同文件聚合；服务端广播 `transcribe-phase`（model/work + done/total）；前端 ts-status 三态 + 已用计时。
2. **刷新恢复任务**：`GET /api/state` 快照（info/quality/分P/segments/mode/crf/transcript/transcriptSig/lastFiles(含 finalPath)/curDur）；前端 DOMContentLoaded 重建界面。
3. **取消确认**：前端 `confirm()`，文案点明删除未交付临时产物。
4. **实例复用**：cli.js 端口文件 `~/.bilibili-dl-port` + 存活探测（`GET /` 2xx），复用则打印地址并开浏览器后退出。
5. **插件启动反馈**：spawn 即 `notice('正在启动 B站下载器…')`；6s 软超时（不 settle），close/error 可升级失败提示。
6. **打开所在文件夹**：`POST /api/reveal`（win32 explorer /select，`revealImpl` 可打桩）；交付结果与文献笔记加按钮。
7. **fmtPrec 进位修复**：先归一 0.1s 再拆位，消除 `00:00:01.10` 错觉。
8. **手柄命中区**：`.handle::after` 透明热区 ≥18×26px。
9. **空段落引导**：预览区常驻 `#seg-hint`，首个段落添加后隐藏。
10. **AI 润色进度**：`note-progress` 加 phase/done/total；`#flow-status` 升级为进度条 + 文案 + 计时。

剔除：P3-13（设置页新键说明）核实已具备（index.html:167-174）。

## Files

- `tools/bili-downloader/core.js`（PY_TRANSCRIBE / parseTranscriptUnits）
- `tools/bili-downloader/server.js`（/api/state、/api/reveal、transcribe-phase、note-progress 增强、lastFiles+finalPath）
- `tools/bili-downloader/cli.js`（端口文件实例复用）
- `tools/bili-downloader/public/app.js`（十项前端对应）
- `tools/bili-downloader/public/index.html`（#seg-hint、#flow-wrap）
- `tools/bili-downloader/public/style.css`（handle 热区、flow 行）
- `src/bili-downloader/index.ts`（启动即时提示 + 软超时升级）
- 测试：`tools/bili-downloader/tests/core.test.js`、`tests/server.test.js`、`tests/bili-downloader.test.ts`
- 文档：`.scratch/bili-downloader-ux/spec.md`（本票唯一事实源）、tools/bili-downloader/README.md + CONTEXT.md、`.scratch/memo-suite-plugin/PROGRESS.md`

## Commits

1. `feat(bili-dl): 体验优化十项（ticket 117）` — 工具前后端 + 核心逻辑 + 测试
2. `feat(bili): 启动器即时反馈与软超时失败升级（ticket 117）` — 插件侧 + 测试
3. `docs(bili-dl): README/CONTEXT 体验优化词条与进度沉淀（ticket 117）`

## Gate

- 工具：`npm test`（tools/bili-downloader）全绿（含新增用例）
- 插件：`pnpm test` + `pnpm exec tsc --noEmit` 全绿
- 构建：`pnpm run build` 直出 vault（插件侧启动器变更生效）
- 合并：worktree/bili-ux → master ff-only 复核全绿后清理 worktree