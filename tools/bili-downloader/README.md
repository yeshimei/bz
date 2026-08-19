# @jwbz/bili-downloader

**B站下载器**——独立 NodeJS Web 工具（由 QuickAdd 脚本《B站下载.js》独立化，ADR-0011）。运行 `bili-dl` 启动本地服务并自动打开网页，在网页内完成 B站视频的**解析、下载、裁切、压缩、转文字、交付**全流程。

- 🚀 自研 B站 API（view + playurl，wbi 签名），官方 CDN **多节点切换**（慢节点/死节点自动跳过，绕开 yt-dlp 的 PCDN 死节点问题）
- ✂ **多段落剪辑**：一个视频可圈 0..N 个段落（拖动时间轴色块/滑块 或 手动输入 `HH:MM:SS.S`，0.1s 精度）；交付模式二选一——**分开交付（每段一个文件 + 剪贴板多行 wikilink）** 或 **合并成一个视频**（段序拼接，单文件单链）
- ⏱ 时间恒显小时位 `HH:MM:SS(.S)`，长视频（100+ 分钟）不再出现分钟裸奔
- 🔒 裁切可靠性：改 `-ss … -t` 相对时长传参 + ffprobe 产物校验，失败自动重编码兜底，规避长视频「只出几秒且无法播放」的 ffmpeg 坑
- 📚 分批/分P 支持：多 P 视频解析后列出全部 P（`P1 标题…`）供选择下载哪一批，默认第一批；交付文件名带 `_P2` 等标记防同名
- 🗜 压缩（CRF 重编码，显示体积变化，无收益自动回退保留原文件）
- 🎙 转文字（faster-whisper），转录完成**自动复制到剪贴板**
- 📦 交付：文件移入交付目录，剪贴板复制 **wikilink**（分开=每段一行；已转文字时 = wikilink + 空行 + 转录全文）
- ⚙️ 网页内设置图标：可改「视频最终放的位置」等全部配置（含 ffprobe 路径）
- 🔒 零依赖（node:http + SSE + vanilla 前端，无构建步骤）；仅绑定 127.0.0.1

## 安装与运行

要求 Node.js >= 18，ffmpeg 与 faster-whisper 的 Python 环境（转文字可选）。

```bash
# 本地运行（仓库 tools/bili-downloader）
node .

# 或安装为全局命令
npm install -g @jwbz/bili-downloader
bili-dl

# 指定端口 / 不开浏览器
bili-dl --port 8080
bili-dl --no-open
```

启动后自动打开浏览器（`http://127.0.0.1:<随机端口>`），`Ctrl+C` 退出并清理临时文件。

## 配置

配置文件位于用户目录 `~/.bilibili-dl.json`（网页「设置」图标可改，即改即生效）：

```json
{
  "outputDir": "E:/Obsidian/叫我包仔/CONFIG/APPENDIX",
  "vaultPath": "E:/Obsidian/叫我包仔",
  "ffmpegPath": "ffmpeg",
  "pythonPath": "C:/Users/PC/AppData/Local/Programs/Python/Python312/python.exe",
  "whisperModel": "small"
}
```

| 字段 | 说明 | 默认值 |
|---|---|---|
| `outputDir` | **交付目录**：视频最终放的位置（设置图标中修改） | vault 的 `CONFIG/APPENDIX` |
| `vaultPath` | Obsidian vault 根目录；交付目录在其下时生成 wikilink，留空则复制普通路径 | vault 根 |
| `ffmpegPath` | ffmpeg 可执行文件（可填完整路径） | `ffmpeg` |
| `ffprobePath` | ffprobe 可执行文件（裁切/合并产物校验用） | `ffprobe` |
| `pythonPath` | faster-whisper 所在 Python（需 3.11+） | 本机 Python |
| `whisperModel` | Whisper 模型（tiny/base/small/medium/large-v3） | `small` |

路径可用环境变量覆盖（多配置/测试隔离）：`BILI_DL_CONFIG` / `BILI_DL_COOKIES` / `BILI_DL_HISTORY`。

## Cookie（高清/4K 需要登录态）

Cookie 存于 `~/.bilibili-cookies.json`（服务器端持有，**不进浏览器、网页不回显明文**）。未配置或失效时只能下载 ≤720P，页面会提示引导：浏览器登录 bilibili.com → F12 → Network → 复制任一请求的 Cookie 整段 → 粘贴到「设置 → Cookie」保存。

## 使用流程

1. 粘贴 B站链接或 BV 号 → 解析（封面/标题/UP/清晰度列表；**多 P 视频列出全部 P**）
2. **点选要下载的那一批 P（默认第一批）** → 选清晰度 → 下载（进度条 + 节点诊断；慢节点自动切换）
3. 剪辑：下载后默认一个「整片」段落；拖时间轴色块手柄/两端滑块、或直接改「开始/结束」时间框（`HH:MM:SS.S`，0.1s 精度）圈范围；「+ 添加段落」支持多段，点段行选中、可上移/下移/删除；顶部切换**交付模式**（分开交付 / 合并成一个视频）
4. 「✂ 应用裁切」对该段做 校验（ffprobe 验证时长与可播放性，失败自动重编码重试）；选 CRF 档位可「🗜 压缩」预编码该段；「↩ 原视频」清空段落回到整片
5. 转文字（可选）：转录文本自动复制到剪贴板（对整片一次）
6. 完成 → 按交付模式批量产出全部交付文件并移入交付目录；剪贴板 = 分开时逐行 `![[CONFIG/APPENDIX/xxx.mp4]]`（有转录则末尾空行+全文）、合并时单条；「新建任务」
7. 「✕ 取消任务」= 中止并删除全部临时产物（已交付文件不受影响）；历史页可一键复制既往 wikilink

## 开发

```bash
npm test        # node:test 全量测试（core 纯函数 + mock 网络 + 服务冒烟）
```

- `core.js` — 零 DOM 核心（wbi 签名、解析、多 CDN 下载、合并、裁切/压缩、转文字），网络函数可注入
- `server.js` — 零依赖 HTTP 服务（API + SSE 进度推送 + 静态前端 + 视频 Range 伺服）
- `config.js` — rc 配置 / Cookie / 历史存取
- `public/` — vanilla 前端单页
- `cli.js` — bin 入口（自动开浏览器、退出清理）

## License

MIT
