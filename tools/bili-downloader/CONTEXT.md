# B站下载器

无头批处理 CLI（`bili-dl --batch '<json>'`）：B站视频解析、分P 选择、下载（多 CDN 节点切换 + 下载原件本地缓存）、多段剪辑/压缩（ffmpeg，产物 ffprobe 校验兜底）、转文字（faster-whisper）、交付（移入交付目录）。由 QuickAdd 脚本《B站下载.js》独立化而来，核心逻辑（CORE）零依赖、可 headless 测试。**ticket 136 起网页版已移除、AI/文献笔记生成回迁 bz 插件**——本工具不再写笔记、不再调 AI。

## Language

**批处理 (Batch)**:
无头处理一条视频任务的完整流水（解析 → 下载 → 剪辑(有起止才跑) → 压缩(缺省开) → 转文字 → 交付），经 `--batch '<json>'` 由 Obsidian 插件「文献盒」面板驱动；stdout 打协议行（`[bz-step]`/`[bz-p]`/`[bz-info]`/`[bz-result]`），stderr 给失败中文原因。
_Avoid_: 会话、作业

**下载原件 (Original)**:
任务中下载合并后的原始视频文件，未被剪辑/压缩；跨任务持久缓存（同 BV+cid+清晰度）命中即跳过下载。
_Avoid_: 原片、原始文件

**剪辑 (Clipping)**:
按起止区间裁出片段（流复制优先 + ffprobe 校验，失败自动重编码兜底）；仅 start/end 都有值才跑，步骤行「剪辑中」。
_Avoid_: 裁切、裁剪

**压缩 (Compression)**:
对源（整片或剪辑后）做 libx264 重编码（CRF 档位，默认 23、范围 18-28）；ticket 136 起**缺省开**，步骤行「压缩中」，交付文件名带 `_crf<值>`；**压缩回退**（ticket 145 补回网页版旧逻辑）：压缩件体积严格大于压缩输入（原件/剪辑件）→ 压缩无收益，丢弃压缩件沿用输入交付（不写压缩缓存、文件名不带 `_crf` 标记）。
_Avoid_: 压缩率、码率压缩

**转录文本 (Transcript)**:
faster-whisper 转出的纯文本（逐段 flush 协议 `\x1e<file>\x1f<seg>\x1f` + 文件结束空哨兵 `\x1e<file>\x1f\x1f`）；完成后写**转录临时文件**（系统临时目录，UTF-8 全文）交 bz 插件做文献笔记 AI，插件读取后自删。
_Avoid_: 字幕、转写稿

**转录临时文件 (Transcript Temp)**:
批处理末尾写给插件读取的转录全文文件（`[bz-result].transcript` 绝对路径，系统临时目录）；**不是**断点续跑缓存，插件读完自删。
_Avoid_: 转写稿缓存（那是 resume 产物）

**交付文件 (Deliverable)**:
移入交付目录的最终视频文件，文件名含标题/BV/剪辑/压缩标记，重名自动加序号；keepVideo=false 时跳过交付。
_Avoid_: 成品、结果文件

**交付目录 (Output Directory)**:
「视频最终放的位置」，默认 `E:/Obsidian/叫我包仔/CONFIG/APPENDIX`（vault 内）；rc `outputDir` 可配，task.options.outputDir 可覆盖。
_Avoid_: 输出文件夹、保存位置

**rc 配置 (rc Config)**:
`~/.bilibili-dl.json`：交付目录、vaultPath、ffmpeg/ffprobe/Python 路径、Whisper 模型、缓存目录与保留天数；bz 插件设置全量下发 task.options 时以 options 为准，rc 仅作独立使用时的兜底。
_Avoid_: 配置文件、config.json

**Cookie 凭据 (Cookie Credential)**:
`~/.bilibili-cookies.json`（格式 `{cookie, savedAt}`）；B站 API 请求由 Node 发起，风控 412 时优先使用。
_Avoid_: Cookie、登录态

**CDN 节点切换 (CDN Failover)**:
下载时按 baseUrl → backupUrl 逐个尝试官方 CDN 节点；连接失败或长时间零字节自动切换（慢速持续有数据不切换）。
_Avoid_: 重试、换线路

**视频缓存 (Video Cache)**:
「下载原件」的跨任务持久缓存——同 BV 同分 P(cid) 同清晰度的重复下载优先复用；超期（默认 7 天，rc `cacheRetentionDays`）由启动清扫删除，目录 rc `cacheDir`（默认系统临时目录下 `bili-dl-cache`）。
_Avoid_: 产物缓存、中间缓存

**断点续跑产物 (Resume Cache)**:
失败重跑从出错步骤继续的机械产物缓存（`resume-clip-*`/`resume-compress-*`/`resume-transcript-*`，键 = BV+cid+起止+清晰度/crf）；ticket 136 起只留机械产物，AI 元数据/润色分块缓存随 AI 回迁 bz 而移除。
_Avoid_: 断点续传、会话恢复

## Rules

- **零依赖**：node 原生，无 npm 运行时依赖，测试 `node --test`（core 纯函数 + mock 网络）。
- **缓存只存下载原件**：剪辑/压缩件不进原件缓存；断点续跑机械产物存 cacheDir，同保留期回收。
- **缓存命中即跳过下载**：解析照跑（拿标题/BV/清晰度），缓存键（BV+cid+清晰度）全同则跳过下载+合并。
- **不写文献笔记、不调 AI（ticket 136）**：AI 与笔记落盘由 bz 插件完成（core/ai + 插件写 frontmatter）；本工具只产「转录临时文件 + 交付视频」。
- **options 全量下发**：bz「文献盒」设置经 task.options 传入（quality/keepVideo/outputDir/compress/crf/vaultPath/ffmpegPath/ffprobePath/pythonPath/whisperModel/cacheDir/cacheRetentionDays），并入 conf 覆盖 rc 兜底。
- **交付即终局**：交付文件移入交付目录（copy + unlink，exFAT 兼容），重名加序号、永不覆盖。
