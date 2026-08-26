# bili-downloader 体验优化（ticket 117）

用户采纳清单的落地 spec。范围：`tools/bili-downloader`（npm 包 `@jwbz/bili-downloader`，ADR-0011 独立边界不变）+ 插件侧启动器 `src/bili-downloader/index.ts`。

## 1. 采纳范围（用户拍板）

- **P1 全部 6 项**：① 转文字进度反馈；② 刷新恢复任务；③ 取消任务确认；④ 重复启动实例复用；⑤ 插件启动即时反馈 + 失败提示升级；⑥ 交付后「打开所在文件夹」。
- **P3 三项**：⑦ `fmtPrec` 0.95~0.99 秒进位显示 bug；⑧ 时间轴手柄命中区加大；⑨ 下载后空段落引导提示。
- **新增（用户补充）**：⑩ AI 润色期间要有显式进度反馈（进度条 + 阶段 + 计时），不再让用户「干等无感」。
- **P3-13（设置页新键说明）核实后剔除**：`index.html` 已有 `cacheDir/cacheRetentionDays/literatureFolder` 三键的中文说明文案，属误报。

## 2. 现状事实（已核实）

| 项 | 现状 | 位置 |
|---|---|---|
| 转录反馈 | Python 逐文件一次性输出（`sys.stdout.write` 在整段循环后），仅 file 粒度 `diag` 广播且落在隐藏的下载区；前端 ts-status 只有静态「转录中…」文案，无阶段/无计时 | core.js:477-492、server.js:531-548、app.js:555-584 |
| 刷新丢任务 | 任务态全在服务端内存 `T`，无快照端点；SSE 重连仅推 cookie 状态 | server.js:20-35、:614-622 |
| 取消无确认 | `cancel-btn` 直接 POST /api/cancel，删除全部临时产物 | app.js:817-823 |
| 重复启动 | 每次 spawn 新进程 + 随机端口 + 自动开新标签 | cli.js:37-48、src/bili-downloader/index.ts:44 |
| 启动反馈 | spawn 后无即时提示；6s 兜底 `done()` 直接 settle，后续 close/error 被吞 | src/bili-downloader/index.ts:49-79 |
| 交付后 | result-path 纯文本多行，无定位/打开入口 | server.js:203-204、app.js:594-607 |
| AI 润色 | `note-progress` 只有文字（`#flow-status` 是页面底端一行 `.hint` 小字），元数据调用可能数分钟无更新，无进度条/无计时 | server.js:213-254、app.js:104-106、index.html:132 |
| fmtPrec | `ds = Math.round((s - ss) * 10)` 在 x.95~x.99 时进位不上秒，显示成 `00:00:01.10` 错觉 | app.js:14-18 |
| 手柄 | `.range .blk .handle` 仅 7×12px，长视频几乎点不中 | style.css:191-196 |
| 空段落引导 | 仅 toast 一句话，预览区无常驻提示 | app.js:234、index.html:54-91 |
| 设置页说明 | cacheDir/cacheRetentionDays/literatureFolder 已有中文 label 说明 | index.html:167-174 |

## 3. 术语（同步 tools/bili-downloader/CONTEXT.md）

- **实例复用 (Instance Reuse)**：`bili-dl` 启动时先探测端口文件 `~/.bilibili-dl-port` 记录的旧实例；存活则复用其地址（只开浏览器后退出），不重复起服务。
- **任务快照 (Task Snapshot)**：`GET /api/state` 返回的当前任务 UI 恢复数据（解析信息/段落/交付结果/转录），页面刷新后据此重建界面。
- **AI 润色进度 (Polish Progress)**：`note-progress` 事件携带 `phase/done/total`，前端渲染进度条 + 阶段文案 + 已用计时。

## 4. 决策

- **Q1 转录进度粒度**：不做「百分比」（Whisper CPU 无总时长锚点，假百分比违背项目不假报原则）。改**三态 + 计数 + 计时**：模型加载中 → 逐段文本流式到达（感知在动）→ 每完成一段文件报 i/N。Python 侧每 segment 识别完即 flush 一行（`\x1e<file>\x1f<segText>\x1f\n`），同文件多行由 `parseTranscriptUnits` 聚合（改聚合语义，文件末尾空行哨兵 `\x1e<file>\x1f\x1f\n` 标记完成，不产生文本）。
- **Q2 刷新恢复范围**：`/api/state` 只回传 UI 所需字段（info/quality/分P/段落/mode/crf/转录/lastFiles/curDur/delivered），**不回传** cookie、prepared 临时路径、originalPath/curPath（服务端自查）；`lastFiles` 补存 `finalPath` 供恢复后「打开所在文件夹」。
- **Q3 取消确认**：前端 `confirm()`，文案明确「将中止并删除全部未交付临时产物」；不做「保留原件」两档（scope 收敛，确认即达安全目的）。
- **Q4 实例复用实现地**：放 cli.js（端口文件 + 存活探测），插件侧零逻辑改动；并发竞争（两进程同时起）不特殊处理——最坏退回现状双实例。
- **Q5 打开所在文件夹**：`POST /api/reveal {path}`，win32 用 `spawn('explorer', ['/select,' + path])`（无 shell、免引号坑）；非 win32 报「仅支持 Windows」。`revealImpl` 导出可替换，测试打桩用。
- **Q6 AI 润色进度 UI**：`#flow-status` 升级为「进度条 + 文案 + 已用计时」一行（`#flow-bar`/`#flow-elapsed`）；`note-progress` 广播加 `phase('meta'|'polish')/done/total`；meta 阶段不定进度（indet 条）+ 文案「生成标题/标签/简介…」；polish 按块 `done/total` 实进度；计时由前端本地 `setInterval` 每秒刷新，结束清除。
- **Q7 插件启动反馈**：spawn 成功即 `notice('正在启动 B站下载器…')`；6s 兜底改**软超时**（提示「启动中…若浏览器未自动打开请重新执行命令」，不永久 settle）；此后 `close` 码非 0 / `error` 事件仍可升级为失败提示（原「已退出」文案保留给正常退出）。

## 5. 实现要点

### core.js
- `PY_TRANSCRIBE`：逐段循环内 `sys.stdout.write('\x1e'+f+'\x1f'+segText+'\x1f\n'); flush`；文件结束写空行哨兵 + flush。
- `parseTranscriptUnits`：同文件多行聚合为一条（`{file, text}`，按出现顺序拼接、空格分隔）；空行哨兵（text 为空）只记完成不计文本；保持乱行容错与 `''`/`abc` 空输入行为。

### server.js
- `GET /api/state`：返回 `{phase, url, info, quality, part, pageCount, partTitle, segments, mode, crf, transcript, transcriptSig, segmentTranscripts, lastFiles(含 finalPath), curDur}`。
- `POST /api/reveal`：`revealImpl(path)`（win32 explorer /select；可替换导出）。
- `/api/transcribe`：开跑前广播 `{type:'transcribe-phase', phase:'model'}`；每文件完成广播 `{type:'transcribe-phase', phase:'work', done, total}`；文本继续走既有 `transcript-chunk`（逐段到达即消费）。
- `runNoteAi`：先算 `total`（各段 chunk 数之和），meta 前广播 `{type:'note-progress', phase:'meta', done:0, total}`，每块广播 `{phase:'polish', done, total, text}`。
- `doDone`：`T.lastFiles` 补存 `finalPath`。

### cli.js
- `PORT_FILE = ~/.bilibili-dl-port`；启动（未指定 `--port` 且文件存在）→ 探测 `http://127.0.0.1:<port>/` 2xx 存活 → 打印同格式 `地址: …` + `openBrowser` + `process.exit(0)`（不开新服务）；探测失败/无文件 → 照常 listen，成功后写端口文件。
- `--no-open` 时复用只打印地址。

### public/app.js
- `fmtPrec`：先 `Math.round(t*10)/10` 归一，再拆 秒/小数位。
- `transcribe`：本地计时器；`transcribe-phase` 事件更新 ts-status（模型加载中/第 i/N 段完成 + 已用 MM:SS）；首段 `transcript-chunk` 到达即视 phase='work'。
- 取消：`confirm('确认取消任务？将中止并删除全部未交付的临时产物（已交付文件不受影响）。')`。
- `DOMContentLoaded` 拉 `/api/state` 恢复：info→卡片/清晰度/分P；curDur>0→预览区（段落/时间轴/模式/CRF/转录/结果卡）；delivered 由 lastFiles 重建结果卡（wiki/路径 + 打开按钮）。
- 交付结果：每条文件行 + 「打开所在文件夹」按钮（`POST /api/reveal {path: finalPath}`）；文献笔记成功后可「打开所在文件夹」（note.path）。
- `gen-note` 步骤 4/5：`flowStatus` 升级为 bar+text；本地计时 `setInterval` 刷新「已用 MM:SS」；`note-progress` 设 bar 宽（meta=indet，polish=done/total%）；结束清除。
- 空段落引导：`#seg-hint` 在下载完成/恢复（无段落）时显示，首个段落添加后隐藏，↩ 原视频后恢复显示。

### public/index.html
- preview-wrap 首行加 `<div class="hint ok" id="seg-hint">…</div>`。
- `#flow-status` 包一层 `#flow-wrap`：进度条 `#flow-bar` + 文案 + `#flow-elapsed`。

### public/style.css
- `.range .blk .handle` 增 `::after` 透明热区（≥18×26px，pointer-events 继承）；不小于现视觉。
- `#flow-wrap` 行内 flex（bar 弹性 + 计时等宽数字）；`#seg-hint` 用现有 `.hint.ok` 即可，微调间距。

### src/bili-downloader/index.ts（插件）
- spawn 成功即 `notice('正在启动 B站下载器…')`。
- 6s 兜底改软超时（不 settle）；close/error 在软超时后仍可覆盖升级失败提示（ENOENT 即时路径不变）。

## 6. 测试计划

- core.test.js：`parseTranscriptUnits` 同文件多行聚合 + 空行哨兵 + 乱行容错（改既有用例语义 + 新增）。
- server.test.js：`GET /api/state` 空闲快照 / set T 后恢复字段；`POST /api/reveal` 缺路径报错 + `revealImpl` 打桩成功/失败分支；`note-progress` 载荷断言（打桩 runNoteAi 场景沿用现有 AI 桩）。
- bz 侧 `tests/bili-downloader.test.ts`：spawn 后立即出现「正在启动」提示；fake timers 推进 6s 出现软超时提示，随后 `close(1)` 升级为失败提示（含安装引导）；既有 9 用例保持全绿。
- 门禁：工具 `npm test`（tools/bili-downloader）+ 插件 `pnpm test` + `pnpm exec tsc --noEmit` + 构建部署（bz 插件 build 直出 vault；工具无构建）。

## 7. 验收

- 转文字/生成文献笔记全程有可见进度（阶段文案 + 计数/进度条 + 计时），中途不再「无感干等」。
- 页面刷新后任务界面（解析卡/段落/转录/已交付结果）恢复如初。
- 取消有确认弹窗；重复执行插件命令不再叠加新实例（提示既有实例地址）。
- 交付后可一键在资源管理器定位文件；`fmtPrec` 无进位错乱；时间轴手柄好拖；下载后有空段落引导。
- 不做：并行化 AI 润色/音视频并行下载/断点续传等实现层优化（不在采纳范围，后续另立票）。