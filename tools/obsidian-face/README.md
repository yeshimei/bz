# @jwbz/obsidian-face —— 包仔脸谱工具包（`bz-face`）

微信 4.x 聊天「**取密钥 → 解密 → 原始导出 → 转写**」的外部工具包：Node 外壳 +
随包 vendored Python（自写脚本 + 裁剪版 [WeChatMsg_Lite](#许可证与上游)，MIT）。
为 Obsidian 插件「包仔」的脸谱域服务（issue 463/464 / ADR-0195/0196）。

**本版（issue 464）新增 `bz-face sync`**：微信登录状态下一键取数——取密钥 → 解密 →
逐联系人生成 `chat.json`（文本 + `[表情·名]` + 图片定位 + 语音时长）→ 头像源落位，
进度走四行协议供插件编排消费。`bz-face doctor`（463）照旧；`prep <联系人>`
（媒体导出 / 语音转写）是后续票（468）。

## 为什么不发公开 registry（也永远不会自动发布）

本包的核心能力是**解密微信数据库**：公开分发容易被滥用、踩合规，且与微信版本强绑定
（4.0.3.36 起官方封堵内存取密钥，需退回 4.0.3.19）。这是它与同仓 `@jwbz/bili-downloader`
**有意不同**的地方（ADR-0195 决策 2）。

`package.json` 里声明了 `publishConfig: { "access": "public" }`，但那只是历史兼容的
声明占位——**private 语义靠「不执行 publish」保证**：仓库与工作流里没有任何发布动作，
也没有发布计划。本机装、本机用；换机器重新 link 一次，这是有意接受的代价。

## 安装（本机本地装，零运行时 npm 依赖）

任选其一（包内 Node 侧无任何第三方依赖，装完即用，无需 `npm install`）：

```bash
# 方式一：全局 link（改包源码即时生效，推荐本机开发期）
cd <仓库>/tools/obsidian-face
npm link                      # → 全局出现 bz-face 命令

# 方式二：仓内路径直装（全局固定一份拷贝）
npm install -g <仓库>/tools/obsidian-face

# 方式三：不装，直接跑
node <仓库>/tools/obsidian-face/bin/bz-face.js doctor
```

Python 侧重物（torch、SenseVoice 权重等）**不随包分发**，按需自装，见下节。

## Python 依赖：分层 requirements

| 组 | 文件 | 什么时候需要 | 内容 |
|---|---|---|---|
| 解密组 | `python/requirements-decrypt.txt` | 取密钥 / 解密 / 导出（sync，票 464） | pymem、psutil、pywin32、pycryptodome、zstandard、protobuf、pillow、xmltodict、lxml、dateparser、aiofiles、yara-python |
| 转写组 | `python/requirements-transcribe.txt` | 语音转写 / silk 解码（prep，票 468） | funasr（连带 torch）、pysilk-mod |

```bash
python -m pip install -r <包目录>/python/requirements-decrypt.txt      # 只想解密/导出
python -m pip install -r <包目录>/python/requirements-transcribe.txt   # 还要语音转写
```

**本工具绝不自动执行安装**（不 pip、不 winget）——会污染你的 Python 环境，而我们
不知道你用的是哪个 Python。缺什么由 `doctor` 打出**可直接粘贴**的命令，装不装、
装到哪个环境，由你决定。版本约束照收编源在用口径（详见 `ARCHIVE.md`）。

已知坑：`yara-python` 在 Python 3.14 暂无预编译 wheel（3.12 / 3.13 可直装）；
装不上时仅「取密钥」不可用，用已缓存密钥的解密链不受影响。

## `bz-face sync` —— 一次从微信取数（issue 464）

```bash
bz-face sync --data-root "E:\Obsidian\微信脸谱数据\export_full"
bz-face sync --data-root "E:\根" --python "C:\Python312\python.exe"  # 指定 Python
bz-face sync --data-root "E:\根" --limit 3    # 调试：只处理前 3 位联系人
```

微信登录运行状态下一次跑完四步：**取密钥 → 解密数据库（增量）→ 逐联系人导出
`chat.json` → 头像源落位**。产物全落数据根：

```
<数据根>/<联系人>/chat.json     消息流 [{ct,type,who,msg,sid,dur?,img?}]（4.x 原始码）
<数据根>/<联系人>/avatar.<ext>  头像源（微信头像库原样字节；无头像不落文件）
<数据根>/.bz-face/key.json      密钥缓存（每轮从微信进程新取）
<数据根>/.bz-face/decrypted/    解密库（增量：已解密的库自动跳过）
```

`chat.json` 只含「从微信解出来的事实」：语音保持 `[语音 N秒]`（时长入 `dur`）、
图片保持 `[图片]`（定位入 `img` = `<月>/<文件名>`，文件名是库内 32hex，媒体解码是
468 的事）、表情**当场命名** `[表情·名]`（命不中保持 `[表情]`）——没有转写、没有图片
描述、没有独立回写步骤（460 spec）。

行为约定：

| 项 | 口径 |
|---|---|
| 幂等 | 可重复跑：`chat.json` / 头像按字节比对，没变不写；解密走上游缓存，不重复搬 |
| 微信未运行 | **立即硬失败** + 中文引导，绝不静默降级成读旧目录（否则会误以为同步成功） |
| 微信 ≥ 4.0.3.36 | 预检即失败并给退回 4.0.3.19 指引（同 doctor 口径） |
| 单联系人失败 | 不中断整体，末尾 `[bz-result]` 报 `failed:N` 与失败名单；重跑即只补失败项 |
| stdout | **只有四行协议**（`[bz-step]`/`[bz-p]`/`[bz-info]`/`[bz-result]`），供插件编排消费（465 数据源同步按钮）；人读环境报告请用 `doctor` |
| 退出码 | 0 = 跑完（单联系人失败也算——看结果行 `failed:N`）；1 = 硬失败；2 = 用法错误 |

## `bz-face doctor` —— 环境自检

```bash
bz-face doctor                                   # 基础自检
bz-face doctor --data-root "E:\Obsidian\微信脸谱数据\export_full"
bz-face doctor --python "C:\Python312\python.exe" # 指定 Python（缺省 PATH 上的 python）
```

逐项检查，每行「✓ 通过 / ✗ 缺失 → 可直接粘贴的修复命令」；**任何单项缺失都不抛栈、
不中断其余检查**；退出码 0 = 自检跑完（有缺失也是 0——本命令的产物是报告），
2 = 用法错误。

检查项：

| 项 | 判定口径 |
|---|---|
| Python | `--python` 指定的命令可执行且 ≥ 3.10（上游库用了 3.10 语法） |
| 解密组依赖 | 12 项逐个 `import` 探测；缺哪几项，修复命令就只列哪几项 |
| 转写组依赖 | funasr / pysilk-mod 同上（缺转写组不会连坐解密组） |
| ffmpeg / ffprobe | 本票只查 **PATH**；自定义路径接插件「外部工具」设置组是后续票（ADR-0195 决策 6） |
| 微信进程与版本 | 进程在跑（`Weixin.exe`，4.x）→ 经 PowerShell 读进程 exe 的文件版本；**≥ 4.0.3.36 → 明确提示官方已封堵内存取密钥、需退回 4.0.3.19**；未在跑 → 提示先打开并登录微信；版本读不出 → 提示手动核对（不判死）。进程不在时读不到版本，安装目录探测留给后续票——做到哪档是哪档，如实展示 |
| 数据根可写性 | 不给 `--data-root` → 显示「未配置」（中性项，不算失败）；给了 → 实写一个探针文件验证可写后即删 |

输出样例（缺依赖的机器上）：

```
✗ 解密组依赖缺失：yara-python
    → python -m pip install yara-python
! yara-python 在 Python 3.14 暂无预编译 wheel（3.12/3.13 可直接装）；装不上时仅「取密钥」不可用，用已缓存密钥的解密链不受影响
✓ Python 3.14.6
✗ 未检测到微信进程（Weixin.exe）
    → 请先打开并登录微信（登录后停在主界面），再重跑 bz-face doctor
```

### 为什么 doctor 输出纯文本、sync 走 [bz-*] 四行协议

四行协议（`src/core/external-tool.ts`）是给**插件编排长任务**消费进度/结果用的；
`sync` 正是这种长任务（465 数据源同步按钮驱动），所以 stdout 全程协议行，Python 侧
（`bz_sync.py`）直接产出、Node 原样透传只补预检行与兜底结果行。doctor 则是用户自己
在终端跑的一次性自检，产出是多行判定 + 修复命令，人读优先。

## 目录结构

```
tools/obsidian-face/
├── package.json            # @jwbz/obsidian-face，bin: bz-face（零 npm 依赖）
├── README.md               # 本文件
├── ARCHIVE.md              # 数据盘散装脚本收编去向表 + vendored 裁剪账
├── bin/bz-face.js          # CLI 薄壳（手写 argv 解析，照 bili-dl 先例不起框架）
└── lib/
    ├── doctor-core.js      # doctor 判定层：纯函数、零依赖、注入探测结果即可单测
    ├── doctor-core.d.ts    # 类型声明（仓库 tests/ 消费；使包内 JS 不进 tsc 检查面）
    ├── sync-core.js        # sync 判定层：阶段计划 / 参数解析 / 协议行格式化 / 转发中继 / 预检判定（纯函数）
    ├── sync-core.d.ts
    └── probes.js           # 真探测与子进程管道：child_process / fs，逐项兜错绝不抛栈
└── python/
    ├── bz_export.py        # 解密链本体（收编自数据盘 tools/；464 起 keyinfo/decrypt_db 可显式指路径）
    ├── bz_sync.py          # sync 本体：取密钥 → 解密 → 逐联系人 chat.json + 头像源（四行协议）
    ├── requirements-decrypt.txt
    ├── requirements-transcribe.txt
    └── vendor/WeChatMsg_Lite/   # 裁剪版上游库（236MB → 368KB，LICENSE 保留）
```

设计约定：判定层（`doctor-core.js` / `sync-core.js`）与真探测（`probes.js`）分离——
判定层只吃探测结果对象与预录协议行，仓库 `tests/` 注入假件即可覆盖「单项缺失 → 对应
修复命令」「微信版本判定」「协议行往返」「无结果行兜底」等分支，不真跑子进程。

## 隐私边界

- 工具只写**数据根**（vault 外的明文目录），**永不接触 vault**，也不知道 vault 在哪
  （ADR-0195 决策 4 / ADR-0197）。
- 包内**不得出现任何真实聊天数据**（无 .db、无导出样本、无密钥文件）；加密保护的是
  vault，不是本机磁盘——数据根始终是明文。

## 许可证与上游

- 包外壳（Node 侧）：MIT。仓库内随 bz 插件分发，不公开发布（见上）。
- `python/vendor/WeChatMsg_Lite/`：上游 [WeChatMsg](https://github.com/LC044/WeChatMsg)
  的留痕 4.x 适配 Lite 版，MIT License，Copyright (c) 2024 SiYuan；`LICENSE` 与源文件
  头部版权声明按原样保留。裁剪明细（剔了什么、为什么、236MB → 368KB 怎么算的）
  见 `ARCHIVE.md`。
