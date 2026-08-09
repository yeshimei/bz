# @jwbz/bili-downloader

**B站下载器**——独立 NodeJS Web 工具（由 QuickAdd 脚本《B站下载.js》独立化，ADR-0011）。运行 `bili-dl` 启动本地服务并自动打开网页，在网页内完成 B站视频的**解析、下载、裁切、压缩、转文字、交付**全流程。

- 🚀 自研 B站 API（view + playurl，wbi 签名），官方 CDN **多节点切换**（慢节点/死节点自动跳过，绕开 yt-dlp 的 PCDN 死节点问题）
- ✂ 裁切（流复制快速无损）+ 🗜 压缩（CRF 重编码，显示体积变化）
- 🎙 转文字（faster-whisper），转录完成**自动复制到剪贴板**
- 📦 交付：文件移入交付目录，剪贴板复制 **wikilink**（已转文字时 = wikilink + 空行 + 转录全文）
- ⚙️ 网页内设置图标：可改「视频最终放的位置」等全部配置
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
| `pythonPath` | faster-whisper 所在 Python（需 3.11+） | 本机 Python |
| `whisperModel` | Whisper 模型（tiny/base/small/medium/large-v3） | `small` |

路径可用环境变量覆盖（多配置/测试隔离）：`BILI_DL_CONFIG` / `BILI_DL_COOKIES` / `BILI_DL_HISTORY`。

## Cookie（高清/4K 需要登录态）

Cookie 存于 `~/.bilibili-cookies.json`（服务器端持有，**不进浏览器、网页不回显明文**）。未配置或失效时只能下载 ≤720P，页面会提示引导：浏览器登录 bilibili.com → F12 → Network → 复制任一请求的 Cookie 整段 → 粘贴到「设置 → Cookie」保存。

## 使用流程

1. 粘贴 B站链接或 BV 号 → 解析（封面/标题/UP/清晰度列表）
2. 选清晰度 → 下载（进度条 + 节点诊断；慢节点自动切换）
3. 预览区拖动双滑块实时裁切 → ✂ 应用裁切；选 CRF 档位 → 🗜 压缩（压缩后反而更大时自动保留原文件并提醒）；裁切/压缩后可「↩ 原视频」返回下载原件重新裁切
4. 转文字（可选）：转录文本自动复制到剪贴板
5. 完成 → 文件移入交付目录，剪贴板 = `![[CONFIG/APPENDIX/xxx.mp4]]`（+ 空行 + 转录全文），可「新建任务」
6. 「✕ 取消任务」= 中止并删除全部产物；历史页可一键复制既往 wikilink

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
