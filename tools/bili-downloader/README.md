# @jwbz/bili-downloader

**B站下载器**——无头批处理 CLI（由 QuickAdd 脚本《B站下载.js》独立化，ADR-0011）。ticket 136 起**网页版已移除**，工具只保留 `--batch` 无头批处理：B站视频**解析、分P 选择、下载、剪辑、压缩、转文字、交付**；**文献笔记的 AI 生成与落盘由 bz 插件完成**（本工具不再调 AI、不再写笔记）。

- 🚀 自研 B站 API（view + playurl，wbi 签名），官方 CDN **多节点切换**（慢节点/死节点自动跳过，绕开 yt-dlp 的 PCDN 死节点问题）
- ⏱ 时间恒显小时位 `HH:MM:SS(.S)`，长视频（100+ 分钟）不再出现分钟裸奔
- ✂ **剪辑**：按起止区间裁切（`-ss … -t` 相对时长 + ffprobe 产物校验，失败自动重编码兜底）
- 🗜 **压缩**（CRF 重编码，默认开，CRF 默认 23、范围 18-28）：步骤「压缩中」，交付文件名带 `_crf<值>`；**压缩后比原文件还大则自动回退用原文件**（不写压缩缓存、文件名不带标记）
- 📚 **分P 支持**：多 P 视频按 `page` 序号选择，交付文件名带 `_N` 标记防同名
- 🎙 **转文字**（faster-whisper）：产出**转录临时文件**（UTF-8 全文，`[bz-result].transcript` 绝对路径）交 bz 插件生成文献笔记
- 🔁 **断点续跑**：剪辑件/压缩件/转写稿机械产物留存缓存，失败重跑从出错步骤继续
- 🔒 零依赖（node 原生，无 npm 运行时依赖），仅 `node --test` 测试

## 用法（无头批处理）

要求 Node.js >= 18，ffmpeg 与 faster-whisper 的 Python 环境（转文字可选）。

```bash
# 仓库内直接跑
node cli.js --batch '{"url":"BV1xx411c7mD","start":null,"end":null}'

# 或安装为全局命令
npm install -g @jwbz/bili-downloader
bili-dl --batch '{"url":"https://www.bilibili.com/video/BV…","start":"0:12","end":"1:30"}'
```

`--batch` JSON：`{url, start?, end?, page?, options?}`——`start/end` 都 null = 整片不剪辑；`options` 由 bz「文献盒」设置全量下发（quality / keepVideo / outputDir / compress(缺省开) / crf(缺省 23) / vaultPath / ffmpegPath / ffprobePath / pythonPath / whisperModel / cacheDir / cacheRetentionDays）。

**协议**（Obsidian 插件「文献盒」面板逐行解析驱动进度）：
- `[bz-step] 名称`：解析中 / 下载中 / 剪辑中(有起止才跑) / 压缩中(缺省开) / 转文字中 / 交付中(keepVideo=false 时跳过)
- `[bz-p] {"phase":"download|trim|compress|transcribe","pct":0-100|null}`
- `[bz-info] {title,uploader,bvid,url,duration}`（解析信息）
- 成功末尾 `[bz-result] {"transcript":"<转录临时文件绝对路径>","video":"<vault相对|绝对|null>"}` 并 exit 0；失败 stderr 给中文原因并 exit 1。

转录临时文件为 UTF-8 全文，**bz 插件读取后自删**；`video=null` = keepVideo=false 未交付。

## 配置

配置文件位于用户目录 `~/.bilibili-dl.json`（bz 插件设置全量下发时以 task.options 为准，rc 仅作独立使用兜底）：

```json
{
  "outputDir": "E:/Obsidian/叫我包仔/CONFIG/APPENDIX",
  "vaultPath": "E:/Obsidian/叫我包仔",
  "ffmpegPath": "ffmpeg",
  "ffprobePath": "ffprobe",
  "pythonPath": "python",
  "whisperModel": "small",
  "cacheDir": "",
  "cacheRetentionDays": 7
}
```

| 字段 | 说明 | 默认值 |
|---|---|---|
| `outputDir` | **交付目录**：视频最终放的位置 | vault 的 `CONFIG/APPENDIX` |
| `vaultPath` | Obsidian vault 根目录；交付目录在其下时生成相对路径 | vault 根 |
| `ffmpegPath` | ffmpeg 可执行文件（可填完整路径） | `ffmpeg` |
| `ffprobePath` | ffprobe 可执行文件（剪辑/压缩产物校验用） | `ffprobe` |
| `pythonPath` | faster-whisper 所在 Python（需 3.11+）。**一般填 `python` 即可**（走系统 PATH，前提已 `pip install faster-whisper`）；填错/不填时会用此默认。Windows 可在命令提示符运行 `where python` 查绝对路径填入 | `python` |
| `whisperModel` | Whisper 模型（tiny/base/small/medium/large-v3） | `small` |
| `cacheDir` | 视频/断点续跑缓存目录（留空 = 系统临时目录/bili-dl-cache） | 系统临时目录 |
| `cacheRetentionDays` | 缓存保留天数 | `7` |

路径可用环境变量覆盖（多配置/测试隔离）：`BILI_DL_CONFIG` / `BILI_DL_COOKIES`。

## Cookie（高清/4K 需要登录态）

Cookie 存于 `~/.bilibili-cookies.json`（格式 `{cookie, savedAt}`）。未配置或失效时只能下载 ≤720P。配置方式：浏览器登录 bilibili.com → F12 → Network → 复制任一请求的 Cookie 整段写入该文件（或由 bz 插件透传）。

## 开发

```bash
npm test        # node:test 全量测试（core 纯函数 + mock 网络 + 批处理端到端）
```

- `core.js` — 零 DOM 核心（wbi 签名、解析、多 CDN 下载、剪辑/压缩、转文字、批处理），网络函数可注入
- `config.js` — rc 配置 / Cookie 存取
- `cli.js` — bin 入口（仅无头批处理）

## License

MIT
