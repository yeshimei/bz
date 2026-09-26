# ARCHIVE —— 数据盘散装工具收编去向表（issue 463）

收编源：`E:\Obsidian\微信脸谱数据\tools\`（只读原样保留，本票未动其中任何文件）。
本票（463）只收「解密链条」（取密钥 → 解密 → 读库 → 导 CSV/JSON）+ `doctor` 自检；
`sync` / `prep` 的 CLI 接线是后续票（464 / 468）。

## 散装脚本去向

| 原文件 | 去向 | 说明 |
|---|---|---|
| `bz_export.py` | **已收编** → `python/bz_export.py` | 解密链本体（info/decrypt/contacts/export/dump）。唯一改动：上游库路径 → `vendor/WeChatMsg_Lite`；密钥与产物暂落脚本旁，464/468 接数据根 |
| `export_all.py` | 留给 **464**（sync） | text/voice/media 三段原始导出；自带 yara 空模块注入与独立 decrypt_dat 装载器，接线时按包内正规路径重整 |
| `voice_transcribe_all.py` | 留给 **468**（prep） | SenseVoice 全量转写（funasr），断点续跑语义保留 |
| `wxgf_decode.py` | 留给 **464**（sync） | wxgf(.bin) → jpg/gif（ffmpeg 解 HEVC），媒体导出段 |
| `image_ct_map.py` | 留给 **464**（sync） | 图片消息 ↔ 磁盘文件关联（packed_info_data 32hex = 文件名 md5） |
| `voice_writeback.py` | 留给 **464/468** | voice.json 回填 chat.json；按 460 spec，「语音/表情标签化」并入包内 chat.json 生成的正规实现 |
| `emoticon_writeback.py` | 留给 **464** | 表情命名回填；同上，并入 chat.json 生成（修 460 记录的「两侧对不上」事故的正解） |
| `synthesize.py` | **不收** | 连发归组（120s 合并）已确认退役（460 Out of Scope） |
| `yara.py`（空垫片） | **不收** | 见下节 |
| `key.json` | **绝不收** | 真实账号密钥缓存（包内不得出现任何真实数据） |
| `decrypted/`、`media_out/`、`tmp/`、`__pycache__/` | **不收** | 解密产物 / 导出产物 / 一次性脚本与缓存（tmp/ 内 89 个文件按 460 留原地当历史；其中被验证过的「上下文批次格式、批合并」逻辑由 468 收进包的正规实现） |

### yara.py 空垫片为何不收编

数据盘的 `yara.py` 是个只有两行注释的空模块，作用是在 Python 3.14（无 yara-python
预编译 wheel）下让 `import yara` 通过。收编它会：

1. 把「缺依赖」伪装成运行时 `AttributeError`（垫片没实现 `yara.compile`）；
2. 若用户装了真 yara-python，同名垫片还会遮蔽真实现。

本包的处理：`requirements-decrypt.txt` 收**真** `yara-python`；装不上的环境由
`bz-face doctor` 报缺失并给命令（附 3.14 wheel 坑提示）；只走已缓存密钥的解密链
（不重新取密钥）确实不需要 yara，与数据盘注释的结论一致。

## vendored WeChatMsg_Lite 裁剪账（236MB → 368KB，62 个文件）

上游为 MIT（Copyright (c) 2024 SiYuan），`LICENSE` 与各源文件头部版权声明**连文件保留**。

### 收进来的（`python/vendor/WeChatMsg_Lite/`）

| 内容 | 理由 |
|---|---|
| `LICENSE`、`readme.md` | 许可与上游署名（ADR-0195 决策 1 的硬要求） |
| `wxManager/` 源码整包（`__init__` / `db_main` / `manager_v4` / `decrypt_runner` / `merge` / `log/` / `model/` / `db_v4/` / `parser/` / `decrypt/`） | **整包耦合，裁不动**：`wxManager/__init__` → `manager_v4` → `db_v4` 全部模块 + `parser` 全部模块（`FACTORY_REGISTRY` 一次拉全），`merge.py` 更是被 `db_v4` 十个模块引用。动任何子包都会出「import 才炸」的残废；净源码合计约 310KB，整收比硬裁便宜 |
| `exporter/__init__.py` / `config.py` / `exporter.py` / `exporter_csv.py` | `bz_export.py export`（CSV 留痕老路径）的实际依赖；Lite 版上游本就只剩 CSV 一个导出器 |
| `exporter/resources/default_avatar.png` | `exporter.py` 运行时引用（联系人无头像兜底） |
| `wxManager/decrypt/version_list.json`、`parser/util/protocbuf/*.proto` | decrypt 包内引用 / pb2 生成码的原始 schema（各 <2.3KB，留作对照） |

### 剔出去的

| 内容 | 体积 | 理由 |
|---|---|---|
| `.git` | 30MB | 不随包分发版本史 |
| `exporter/ffmpeg.exe`、`exporter/resources/ffmpeg.exe` | 73MB | 两份 ffmpeg 二进制；工具统一用系统 ffmpeg（后续票接插件「外部工具」设置路径），二进制绝不随包 |
| `exporter/resources/emoji/`（114 个 png） | 57MB | 全库 grep 无任何 py 引用（表情 XML 解析不走本地图）；收编日核对后剔除 |
| `exporter/resources/template.html` | 425KB | HTML 导出器遗物，Lite 版已无该导出器 |
| `decrypt/wxinfo.py`、`decrypt/get_wx_info.py`、`decrypt/get_bias_addr.py` | 约 40KB | 3.x 时代遗物（读 biz.db / 偏移推算），解密链 import 闭包内无任何引用，且 `get_wx_info.py` 拖 pythoncom/win32com 额外依赖 |
| 根目录 `member.py`、`msg.py` | 约 8KB | 上游示例脚本，非库 |
| 根目录 `requirements.txt` | — | 被本包分层 requirements（decrypt / transcribe 两组）取代；原文件含大量解密链用不到的项（lz4、requests、bs4、openpyxl、python-docx 等），照抄会诱导多装 |
| 全部 `__pycache__/` | 5MB | 编译缓存 |

### 收编后校验

- `import wxManager` / `wxManager.decrypt_runner` / `decrypt.wx_info_v4.dump_wechat_info_v4`
  / `DatabaseConnection` / `exporter.exporter_csv.CSVExporter` 全部可导入
  （Python 3.14.6 实测；进程内临时垫 `sys.modules['yara']` 验证闭包完整，垫片未随包分发）。
- 包内无 `.git`、无 `.db`、无 `.exe`、无 HTML 模板；无任何真实聊天数据。
- 已知上游瑕疵（原样收编、不代改）：若干 `return` 出现在 `finally` 块，
  Python 3.14 下有 SyntaxWarning，不影响行为；升级上游版本时一并消化。
