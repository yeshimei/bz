# bili-downloader 剪辑功能增强（多段 / 联动 / 时间格式 / 手动输入 + 长视频 bug 修复）

- **范围**：`tools/bili-downloader`（npm 包 `@jwbz/bili-downloader`，与 bz 插件正交，ADR-0011）。
- **状态**：grilling 共识已达成（Round 1 + Round 2 全按推荐采纳）；**实现已完成**（工具版本 1.1.0，`npm test` 38 全绿，含真实 ffmpeg 端到端）。本 spec 是唯一事实源——后续改动先改 spec 再改码。
- **术语**：已同步 `tools/bili-downloader/CONTEXT.md`（段落/剪辑/合并/交付模式/激活段）；本 spec 只用 CONTEXT.md 术语。

---

## 1. 需求（用户原话）

1. 拖动剪辑的进度条，视频也要同步显示对应的范围，可以正常播放。
2. 剪辑的进度条显示的时间也应按 小时:分钟:秒 方式显示。
3. 用户可以手动输入剪辑对应的开始 / 结束时间点。
4. 支持同一个视频剪辑多个段落：用户可选择**分开多个（多个双链）**或**最终合并成一个视频**。
5. bug：视频过长时剪辑，产物只有 3 秒且无法播放。

## 2. 现状事实（已调查，`tools/bili-downloader/`）

| 需求 | 现状 | 证据 |
|---|---|---|
| 1 拖动联动 | 已有两端滑块 + seek；但 `seekPreview` 有 `readyState>=1` 静默守门、长文件走字节 Range 伺服 seek 慢、无缓冲反馈、播放中拖动会抖动 | `public/app.js:186-217`、`server.js:129-149` |
| 2 时间格式 | `MM:SS` 无小时位，分钟可裸奔过 59（`fmtDuration(6000)='100:00'`），前后端两处 | `public/app.js:9-12`、`core.js:89-97`、`tests/core.test.js:52-53` |
| 3 手动输入 | 不存在，只有滑块 | `public/index.html:61-64` |
| 4 多段 | 不存在；前后端各一对 `S.start/S.end` / `T.start/T.end`，一次只出一个交付文件 | `public/app.js:36`、`server.js:25`、`server.js:80-97` |
| 5 三秒 bug | 全程秒单位无混用、无硬编码 3、无截断；最强根因候选：`-ss`/`-to` 都在 `-i` 之前（输入级）+ `-c copy` + `-movflags +faststart`，长视频 moov 回写易截断/损坏 | `core.js:273-303` |

## 3. 决策记录

### Round 1（Q1-Q8，全按推荐采纳）

| # | 决策 |
|---|---|
| Q1 | 一条 ticket 全做，实现顺序 **5→1→2→3→4**（先修可靠性，再上多段） |
| Q2 | 域模型：剪辑 = 对一个「下载原件」定义 0..N 个「段落 {开始, 结束}」；现有单段裁切 = N=1 特例；段落只作用在已下载原件上 |
| Q3 | 时间精度 **0.1s**（滑块步进 0.1s、输入允许 1 位小数）；显示**恒显小时位** `HH:MM:SS(.S)` |
| Q4 | 开始/结束文本框与滑块/视频**双向同步**；越界硬钳制（<0→0、>时长→时长、开始≥结束红框 `hint err` 不应用） |
| Q5 | 时间轴 UI = **主时间轴色块模式**（点段激活→拖手柄）+ 下方段落列表（起止/上移/下移/删除） |
| Q6 | 分开交付 = 每段一个交付文件 + 完成时剪贴板**多行 wikilink** + 历史逐产物记录；**不自动生成 md 汇总笔记** |
| Q7 | 合并 = 段序拼接 + `-c copy` 优先、失败自动重编码兜底；产物 = 单文件 + 单条 wikilink |
| Q8 | bug 修法：`-ss X -i 源 -t (end-start)`、去输入级 `-to`、大文件去 `+faststart`；产物 **ffprobe 校验 + 异常自动重编码重试**（合并复用） |

### Round 2（R1-R8，全按推荐采纳）

| # | 决策 |
|---|---|
| R1 | 段命名：**自动** `标题_clip_<起>-<止>`（时间戳唯一），不手动起名；**合并**产物命名 `标题_merge_<段数>段` |
| R2 | 「✂ 应用裁切」只作用于**激活段**（保留单段手感）；「✓ 完成」按交付模式**批量产出全部交付物** |
| R3 | 压缩在**最终交付物层面**：分开=每段各压一次；合并=合并完成后只压一次；压缩回退规则对每产物独立生效 |
| R4 | 转文字仍**任务级、对整段原件一次**；剪贴板 = wikilink（分开多行/合并单条）→ 空行 → 转录全文一次 |
| R5 | 「↩ 原视频」= **清空全部段落 + 关闭压缩 + 恢复下载原件**；已交付后按钮禁用（交付即终局） |
| R6 | 取消 = kill + 删除**全部临时产物**（含未交付片段/合并件）；**已交付文件不受影响** |
| R7 | 历史**每个交付物一条**，复用现有 schema |
| R8 | 交付模式切换：预览区顶部**两态切换**「分开交付 / 合并成一个视频」，**默认分开**；切模式不丢段落 |

---

## 4. 域模型（对齐 CONTEXT.md）

- **下载任务**：解析→下载→（剪辑）→（压缩）→（转文字）→完成。同一时刻一个任务；中止删全部临时产物。
- **段落 (Segment)**：{开始, 结束}，0.1s 精度，源恒为下载原件。
- **剪辑 (Clipping)**：圈一个或多个段落并决定交付形态（分开 / 合并）。
- **裁切 (Trim)**：对单个段落做 ffmpeg 提取（`core.trimVideo` 语义保留，参数重写见 §5.5）。
- **合并 (Merge)**：段序 concat，流复制优先 + 重编码兜底 + ffprobe 校验。
- **交付模式 (Delivery Mode)**：分开交付 | 合并成一个视频。
- **激活段 (Active Segment)**：当前预览/校验/「✂ 应用裁切」作用对象。

---

## 5. 功能规格

### F1 拖动联动（req 1）

- 滑块 `oninput` → 更新起始/终止文本（HH:MM:SS.S）+ 节流 seek 预览视频（节流 ~150-250ms；`v.currentTime = t` 仅当 `readyState >= HAVE_CURRENT_DATA`，否则挂 `loadedmetadata` 后补 seek）。
- 拖动期间不改播放态破坏：按下开始拖动时若在播则暂停，`mouseup` 恢复播放态（`seeked` 后再 `play()`）；跨 `S.end` 的现有「pause+回跳」逻辑保留。
- 长视频 seek 慢：接 `waiting`/`seeked` 事件显示缓冲态（复用 `hint`/进度样式），不黑屏无反馈。
- 服务器 `/media/current` 的字节 Range 伺服保留（无需改协议；若实测不足再优化 range 粒度）。

### F2 时间格式（req 2）

- 统一显示**恒显小时位** `HH:MM:SS`，输入/激活段可显示一位小数 `HH:MM:SS.S`。
- 改三处：`public/app.js:fmtDuration`、`core.js:fmtDuration`（进度文本用）、`core.js:fmtTime`（文件名用，保持 `-` 分隔）。
- 边界：`fmtDuration(65)='00:01:05'`、`fmtDuration(3600)='01:00:00'`、`fmtDuration(6000)='01:40:00'`；同步修 `tests/core.test.js:52-53` 及新增断言。
- 新增纯函数 `parseTimeInput(str)`（解析 `HH:MM:SS.S`/`MM:SS`/裸秒 → 秒，失败返回 null），供手动输入与测试复用。

### F3 手动输入（req 3）

- `index.html`：主时间轴正下方放「开始」「结束」两个文本框 + 起/止/共 标签。
- 双向同步：拖滑块→文本实时更新；改文本（`change`/防抖 `input`）→ 解析并写激活段起/止 → 滑块跳 → `seekPreview(开始)`。
- 校验：`<0→0`、`>时长→时长`（硬钳制）；`开始≥结束` 时输入框 `hint err` 红描并阻止「✂ 应用裁切」，不清空用户输入。

### F4 多段与交付（req 4）

**状态模型**

- 前端 `S.segments: [{id, start, end}]`、`S.activeId`、`S.mode: 'split'|'merge'`；`S.start/S.end` 概念废除，由 `segments` 取代。
- 服务端 `T.segments` 同构、`T.mode`；`/api/trim` 改为作用于 `activeId`（或前端传 `segmentId`）。

**UI（时间轴 + 段落列表）**

- 主进度条（现有 `#range-bar` 之上叠加）渲染所有段色块：每块 left%=start/dur、width%=(end-start)/dur；点块→设激活段；块两侧手柄拖动改该段起/止（0.1s）。
- 段落列表：每行 = `N. 起 HH:MM:SS.S 止 HH:MM:SS.S` + 上移/下移/删除按钮；「+ 添加段落」按钮（默认落在播放头或原视频末尾）。
- 交付模式两态切换在预览区顶部，切换不丢段落；切换后剪贴板预览与「完成」行为即时反映。

**「✂ 应用裁切」**：只对激活段生成临时片段并预览/校验（走 §5.5 的裁切+ffprobe 流程，前端复用现有 trim-progress 进度）。
**「✓ 完成」= 批量交付**：

- 分开模式：对每段落按 §5.5 裁切（copy 优先→校验→重编码兜底）到临时 → 各自 `buildFileName` 命名 `标题_clip_<起>-<止>.mp4` → 移入交付目录（重名自动加序号）→ 逐产物 `pushHistory` → 剪贴板 = 逐行 `![[…]]`（vault 外则绝对路径），有转录则 `\n\n` + 转录全文一次。
- 合并模式：每段落先裁到临时 → 按段序 concat（copy 优先→校验→重编码兜底）→ `标题_merge_<段数>段.mp4` 一个交付文件 → 单条 wikilink（+ 转录全文）→ 一条历史。
- 一处失败不中断全部：失败的段落单独 toast 报错、其余照常交付（避免一次坏段毁全批）——**注**：此条为本 spec 补充决策（Round 2 未细问，属交付可靠性），如不接受可在实现 ticket 回退为“整体失败”。

**压缩（R3）**：分开模式每段各压一次（裁切后对该段产物 CRF）；合并模式合并完成后只压一次；压缩回退规则对每个产物独立生效。

**↩ 原视频（R5）**：清空 `segments`、关闭压缩、恢复下载原件、重置时间轴与列表；已交付后按钮禁用。

**取消（R6）**：kill 全部子进程 + 删除全部临时产物（所有未交付片段/合并件）；已交付文件不受影响。

### F5 长视频 bug 修复（req 5）

**参数重写（核心改动）**：

- 裁切 copy 路径（快速无损）：`ffmpeg -y -ss <start> -i <in> -t <dur> -c copy [-movflags +faststart?] <out>`，`start`/`dur` 用 `Math.round(x*10)/10` 的秒字符串（保留 1 位小数，避免浮点尾巴）；`dur = end - start`。
- 裁切重编码路径（帧精确，crf 非 null 或兜底）：`ffmpeg -y -i <in> -ss <start> -to <end> -c:v libx264 -crf N -preset medium -c:a aac [-movflags +faststart?] <out>`（`-ss`/`-to` 置于 `-i` 之后 = 输出级，帧精确）。
- **去掉输入级 `-to`**（根因候选之一）。
- **`+faststart` 策略**：输出预计 >512MB 或时长 >30min 时省略（避免超大 `-c copy` 输出 moov 整文件回写截断/损坏）；小文件保留。阈值实测可调。

**产物校验 + 自动兜底（通用保障，Q7 合并/分开共用）**：

- 裁切完成后 `ffprobe -v error -show_entries format=duration -of json <out>`。
- 通过条件：有 duration 且 `|dur - (end-start)| ≤ 容差`（copy 路径 2s——容忍关键帧吸附偏长；重编码路径 0.5s）且无 error。
- 不通过 → 自动用重编码路径重试一次；再不通过 → 该段落报错 toast，不产出坏文件。

**待运行时验证**（实现期已完成）：

- **实测结论（ffmpeg 8.1.2 full gyan build）**：用生成的 110 分钟长视频（纯视频 / 含音轨两种）对比新旧参数——旧参数 `-ss <start> -to <end> -i <in> -c copy` 与 新参数 `-ss <start> -i <in> -t <dur> -c copy` 均产出正确时长（330s/100s 等）、exit=0、音视频轨道时长一致；`+faststart` 对 2000s/46MB 的 copy 输出亦正常。**本机环境无法复现「3 秒损坏产物」**——根因指向「不同 ffmpeg 版本的输入级 `-to` 语义差异 + 近片尾 fast-seek 关键帧吸附」这类脆弱组合（在旧版本/真实 B站 合并 mp4 上触发）。
- **对策落地**：新参数（相对 `-t`，无输入级 `-to`）+ 产物 ffprobe 校验（copy 容差 2s / 重编码 0.5s）+ 失败自动重编码重试 + 超长片段省略 `+faststart`——无论用户侧 ffmpeg 版本如何，**短/坏产物都会被校验拦下并自动重建**。若用户仍持真实长视频报障，需提供该文件复跑 `ffmpeg -v verbose` 进一步定位。

---

## 6. 实现落点（按文件）

| 文件 | 改动 |
|---|---|
| `public/index.html` | 起/止文本框；交付模式切换；段落列表容器；时间轴色块层叠加于 `#range-bar` |
| `public/app.js` | state（segments/activeId/mode）；`fmtDuration` 小时位；`parseTimeInput`；`seekPreview` 强化（节流/缓冲态/播放态恢复）；段落 CRUD；时间轴渲染；交付模式切换；交付剪贴板多行 |
| `core.js` | `trimVideo` 参数重写（§5.5）+ ffprobe 校验 + 自动重编码兜底；新增 `mergeSegments`（concat）；`fmtDuration`/`fmtTime` 小时位；时间解析工具可独立导出 |
| `server.js` | `T` 多段化 + `T.mode`；`/api/trim` 作用激活段；「完成」批量交付（split/merge）；`buildClipboard` 多行；`pushHistory` 逐产物 |
| `tests/core.test.js` | `fmtDuration` 小时断言；`parseTimeInput`；`trimVideo` 参数（copy/重编码/无输入级 `-to`）；`mergeSegments` 命令构造与兜底 |
| `tests/server.test.js` | 多段完成→N 交付/合并交付；剪贴板多行；历史逐条；取消清理范围 |

## 7. 测试计划

- 数据层/纯函数（core）：§5.5 命令构造、格式/解析、校验判定、合并构造——全部可 headless。
- 服务层：交付流程 split/merge 冒烟、容错（单段失败不断批）、取消清理。
- 前端：本工具 `public/` 无测试基建；时间解析/格式已下沉为可测纯函数，UI 交互（时间轴拖动、双向同步）用手工验收清单（spec 不扩充测试基建）。
- 回归：既有 `npm test` 全绿为前提；`fmtDuration` 断言的旧值必须同步更新。

## 8. 不改项（明确不 scope）

- 不自动生成 md 汇总笔记（Q6 选项一）。
- 不撑大交付语义：转文字不逐段。
- 不接近逐帧对齐：copy 路径保留关键帧吸附（用户可接受，重编码才帧精确）。
- 不动插件侧 `src/bili-downloader/index.ts`（仅启动器，无剪辑逻辑）。
- 不动交付协议（`/media/current` Range、SSE 结构）。

## 9. 验收清单（手测）

1. 拖动滑块/手柄，视频画面即时跟手、可播放；（长视频）无黑屏无缓冲死区。
2. 所有时间显示为 `HH:MM:SS(.S)`；100 分钟视频显示 `01:40:00`。
3. 输入框改时间 → 滑块/视频联动；越界与 start≥end 出红框且不应用。
4. 加 3 个段落 → 预览分别正确；分开交付出 3 个文件 + 剪贴板 3 行 wikilink + 历史 3 条；合并交付出 1 个 `_merge_3段` 文件 + 1 条 wikilink。
5. 100+ 分钟视频裁长段：产物时长正确、可播放；损坏自动重编码可恢复。
6. ↩ 原视频清空段落列表；取消任务后临时目录无残留；已交付文件不受取消影响。