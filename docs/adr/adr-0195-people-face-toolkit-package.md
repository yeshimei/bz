# ADR-0195：脸谱工具包——单包 `@jwbz/obsidian-face`，边界到「转写」为止，不发公开 registry

- 日期：2026-09-26
- 状态：已采纳
- 相关：ADR-0011（bili-downloader 独立化，本票照办其形态）/ ADR-0071（AI 回迁插件）/ ADR-0191（外部力量模式）/ ADR-0196（本工具的调用协议与状态机）/ ADR-0197（产物归属）

## 背景

脸谱的全部外部流程现在是 `E:\Obsidian\微信脸谱数据\tools\` 下的一堆散装东西：`bz_export.py`（取密钥 / 解密 / 导 CSV / 导 JSON）、`export_all.py`（text / voice / media 三段）、`voice_transcribe_all.py` + `voice_writeback.py`、`image_ct_map.py`、`emoticon_writeback.py`、`wxgf_decode.py`、`synthesize.py`，外加 vendored 的 `WeChatMsg_Lite`（MIT，236MB 含 `.git`）和 `tmp/` 里几十个一次性脚本。没有包、没有版本、没有协议，全靠人肉 CLI 串。

用户要求合并成 npm 包形式（照知识盒的 `@jwbz/bili-downloader` 先例）。

## 决策

1. **单包** `@jwbz/obsidian-face`，bin **`bz-face`**，放仓库 `tools/obsidian-face/`（与 bili-downloader 同处）。形态 = **Node 外壳 + 随包 vendored Python**（自写脚本 + 裁剪版 `WeChatMsg_Lite`：去掉 `.git` 与无关 exporter，**保留 MIT LICENSE 与版权声明**）。不搞装包时 clone（依赖网络，且上游随时可能消失）。
2. **不发布公开 registry**——`package.json` 写 `publishConfig: { access: "public" }` 但**不执行 `npm publish`**，走仓库内本地 link / 全局安装。**此处与 bili-downloader 有意不同**：本包的核心能力是**解密微信数据库**，公开分发既容易被滥用、又踩合规，且与微信版本强绑定（4.0.3.36 起内存取密钥已被官方封堵，需退回 4.0.3.19）。
3. **边界切在「转写」为止**：工具做「取密钥 → 解密 → 原始导出 → `chat.json`（含表情命名回写）→ 媒体导出（含 `desc/` 派生档）→ 语音转写」；**AI 不做**。
   - 理由一：ADR-0071/0191 已定「AI 回迁插件、服务商凭据不进外部进程」。
   - 理由二（否决逐条 spawn 方案的硬约束）：SenseVoice / funasr 模型冷加载按分钟计，插件逐条 spawn Python = 每条语音重载一次模型，实际不可跑；转写必须**一个进程吃完全量**并自带断点续跑。媒体导出同理（9.8GB 级 IO 不适合高频跨进程往返）。
4. **工具只写数据根，永不写 vault**；它不知道 vault 在哪，也不需要知道（见 ADR-0197）。
5. **重物用户自装**：`pymem` / `zstandard` / `pycryptodome` / `pysilk-mod` / `funasr` / `pywin32` 与 SenseVoice 权重都不随包分发；包内带**分层 `requirements.txt`**（`decrypt` / `transcribe` 两组），`bz-face doctor` 自检缺什么并打**可直接粘的一行 `pip install`**。**绝不自动 pip install**——会污染用户环境，且我们不知道他用的是哪个 Python。
6. 运行时路径（Python / ffmpeg / ffprobe）**升格为域无关设置组**：从 knowledge 的 `knowledgePythonPath` / `knowledgeFfmpegPath` / `knowledgeFfprobePath` 提成共享的「外部工具」组（`pythonPath` / `ffmpegPath` / `ffprobePath`），旧键走 `migrateAsrKeys` 同款一次性搬值。道理：脸谱与知识盒用的是同一个 Python 环境，两个键迟早不同步。
7. 语音转写**复用 AI 面板「语音转写」组**（`asrEngine` = SenseVoice-Small 缺省 / faster-whisper 备选，`asrWhisperModel`），不新增第二套引擎设置。

## 后果

- 不分发意味着只有本机能装；换机器要重新 link。这是有意接受的代价。
- 微信版本升级导致取密钥失效时，`bz-face doctor` 负责给人话（而不是把 Python traceback 抛给用户）。
- 工具侧「谁调 AI」从此有明确答案：**没有人**。所有模型调用都在插件侧，凭据面收敛在 `core/ai.ts` 一处。
- `tools/` 下新增第三个外部工具包；`tmp/` 里被验证过的逻辑（上下文批次格式、批合并）收进包的正规实现，其余不迁、留在原地当历史。
