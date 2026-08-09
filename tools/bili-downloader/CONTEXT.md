# B站下载器

交互式本地 Web 工具：`bili-dl` 启动本地服务并打开网页，在网页内完成 B站视频的解析、下载、裁切/压缩、转文字与交付（移入交付目录 + 剪贴板）。由 QuickAdd 脚本《B站下载.js》独立化而来，核心逻辑（CORE）零依赖、可 headless 测试。

## Language

**下载任务 (Download Task)**:
从解析链接到交付的完整处理流程（解析 → 下载 → 裁切/压缩 → 转文字 → 完成）。同一时刻只有一个任务；任务中止时删除全部产物。
_Avoid_: 会话、作业

**产物 (Artifact)**:
任务过程中生成的视频文件（下载原件、裁切片段、压缩件），存于系统临时目录，任务中止或窗口清理时删除。
_Avoid_: 临时文件、中间文件

**交付文件 (Deliverable)**:
点「完成」后移入交付目录的最终视频文件，文件名含标题/BV/裁切/压缩标记，重名自动加序号。
_Avoid_: 成品、结果文件

**交付目录 (Output Directory)**:
设置图标中可配置的「视频最终放的位置」，默认 `E:/Obsidian/叫我包仔/CONFIG/APPENDIX`（vault 内）。
_Avoid_: 输出文件夹、保存位置

**rc 配置 (rc Config)**:
`~/.bilibili-dl.json`，网页设置图标背后的存储：交付目录、ffmpeg/Python 路径、Whisper 模型等。
_Avoid_: 配置文件、config.json

**Cookie 凭据 (Cookie Credential)**:
`~/.bilibili-cookies.json`（格式 `{cookie, savedAt}`），服务器端持有；B站 API 请求由 Node 发起，Cookie 不进浏览器，网页不回显明文。
_Avoid_: Cookie、登录态

**转录文本 (Transcript)**:
faster-whisper 转出的纯文本（一段文字，无换行），转录完成后自动复制到剪贴板。
_Avoid_: 字幕、转写稿

**CDN 节点切换 (CDN Failover)**:
下载时按 baseUrl → backupUrl 逐个尝试官方 CDN 节点；连接失败或前 6 秒速度 < 0.4MB/s 自动切换。
_Avoid_: 重试、换线路

## Rules

- **单任务语义**：任务进行中禁用操作按钮，「取消任务」= kill 子进程 + 删除全部产物。
- **中间产物不落交付目录**：一律先落系统临时目录，交付时才移入。
- **交付即终局**：「完成」= 文件移入交付目录 + 复制 wikilink 到剪贴板 + 写入下载历史。
- **服务只绑 127.0.0.1**：随机空闲端口，无鉴权，启动自动开浏览器。
- **零依赖**：node:http 原生服务器 + SSE 进度推送 + vanilla JS 前端，无构建步骤。
