# ARCHIVE —— 数据盘散装工具收编去向表（issue 463 / 464 / 468）

收编源：`E:\Obsidian\微信脸谱数据\tools\`（只读原样保留，收编未动其中任何文件）。
463 收「解密链条」（取密钥 → 解密 → 读库 → 导 CSV/JSON）+ `doctor` 自检；
464 收 `sync`（取密钥 → 解密 → 逐联系人 chat.json + 头像源，四行协议）；
468 收 `prep <联系人>`（媒体导出 + wxgf 解码 + 派生图片档 + 图片关联表 + 语音转写，
四行协议 + 协作式暂停 / 中断——控制文件 `.bz-face/control.json`，收编源里没有的机制，
契约权威表述在 `lib/prep-core.js` 的 `parseControlAction` 与 Python 侧 `read_action`）。

## 散装脚本去向

| 原文件 | 去向 | 说明 |
|---|---|---|
| `bz_export.py` | **已收编** → `python/bz_export.py` | 解密链本体（info/decrypt/contacts/export/dump）。463 改动：上游库路径 → `vendor/WeChatMsg_Lite`；464 改动：`keyinfo` / `cmd_info` / `decrypt_db` 增 `key_path` 显式路径参数（缺省仍脚本旁，老用法零变化），供 sync 把密钥 / 解密库落数据根 |
| `export_all.py` | **已收编（464 text 段并入 `bz_sync.py`；468 voice / media 段并入 `bz_prep.py`）** | text 段（ct/type/who/msg/sid/dur 消息流、zstd 解压与解压失败跳过、字段口径）逐条落实；voice 段（VoiceInfo.silk → pysilk 44100Hz wav）与 media 段（.dat 三级解密 V2 派生密钥 → V1 → 单字节 XOR、视频明文直拷 / 加密头试解、文件直拷、缩略图导出、`_t` 缩略图分类与「stem 取 `_` 前段」命名口径）随 468 收编。**收编改动**：① wav 路径**不回写 chat.json**（原 cmd_voice 写 `m["wav"]`——464 报告「wav 写回随 468」的说法作废，以票 468 为准），只进转写表 `voice.json`（加 sid 字段）；② 解密失败的源不再拷 `pending/`——源 .dat 留在 attach 原处，计失败数，重跑即重试；③ V2 派生密钥的 wxid 显式传入（prep 用数据根 key.json，绝不读包旁脚本目录的密钥缓存）；④ 密钥 / 解密库从数据根解析，不再依赖脚本旁目录；⑤ 逐条协议行 + 协作式让行暂停（原脚本无进度、不可暂停）。464 记录的重组点（目录名去重顺序无关、产物幂等）继续有效 |
| `voice_transcribe_all.py` | **已收编（468，语义并入 `python/bz_prep.py` 转写段）** | SenseVoice 全量转写（funasr，CPU），断点续跑语义原样保留：`voice.json` 已有 wav 键即跳过、每条转完立即落盘（崩溃最多丢一条；写盘升级为原子写）。**收编改动**：① 单联系人面（prep）而非全库遍历；② 每条记录加 `sid` 字段（从 wav 文件名 `<时间戳>_<sid>.wav` 解出——原 voice_writeback 靠文件名字符串反解的同款信息，现在显式落表，插件按消息 sid 精确对齐）；③ 失败记录带进 `[bz-result].failed / failures`（原脚本只打印）；④ 加 `--asr-engine` 备选 faster-whisper（whisper 无情感输出 → `emotion` 留空不假报）；⑤ 转写标签清洗 TAG_RE 加 `/?`——闭合标签 `<|/zh|>` 原式剥不掉、会留在文本尾巴；⑥ 引擎加载失败 = 硬失败 + doctor 指引（原脚本裸抛栈） |
| `wxgf_decode.py` | **已收编（468，语义并入 `bz_prep.py` 媒体段）** | wxgf(.bin) → jpg/gif（截首个 Annex-B 起始码到文件尾，ffmpeg `-f hevc` 解码；单帧 jpg / 多帧 gif；.bin 保留）。**收编改动**：① 随图片导出逐条就地转码（.dat 解出 ext='bin' 即转），历史遗留未解码 .bin 重跑时补上，不再独立二遍扫；② ffmpeg 路径 `--ffmpeg` 显式传参（原硬编码 PATH）；③ 起不动 / 解码失败计失败数并给指引（原只打印 `[败]`） |
| `image_ct_map.py` | **已收编（464 定位并入 `bz_sync.py` 生成；468 关联表落 `bz_prep.py`）** | packed_info_data 32hex = 文件名 md5 → 图片定位：464 已把 `img = <月>/<hex>` 在 chat.json 生成时写入（月取消息本地时间）；468 落旁路表 `image_map.json = [{file, ct, sid?}]`（ct 升序、同图去重、file 相对联系人目录、只收有磁盘文件的引用；sid 为新增字段）。**`chat.json` 一字不动**——原脚本「回写 chat.json 的 img 字段」这一步退役（460 spec：chat.json 是只读一次性产物，合并进聊天仓由插件执行）；关联按 hex 解析不按月份——媒体落盘月份跟 attach 目录名、消息 img 月份跟消息 ct，两者本就不同源 |
| `voice_writeback.py` | **不收（职责拆散、回写退役）** | 它干两件事：「wav 路径写回 chat.json」随 468 语音导出直接落 wav + voice.json（**不回写** chat.json）；「转写文本回填 chat.json（`[语音 N秒·情感] 转写`）」按 460 spec 退役——转写是插件侧 AI 产物，只进聊天仓旁路表，情感中文映射（平静/开心/…）归插件侧合成 |
| `emoticon_writeback.py` | **已收编（464，语义并入 `bz_sync.py` 生成）** | 表情命名（商店名优先 / 收藏名兜底、caption 清洗、md5 负向后顾防子串误配）改在 chat.json 生成时一次写入——修 460 记录的「chat.json 28 条 vs 仓 52 条对不上且修不回来」事故的正解；独立回写步骤退役。emoticon_map.json（收藏表情底表）随画脸谱侧需要时再收 |
| `synthesize.py` | **不收** | 连发归组（120s 合并）已确认退役（460 Out of Scope）；chat.json 一条条存 |
| `yara.py`（空垫片） | **不收** | 见下节 |
| `key.json` | **绝不收** | 真实账号密钥缓存（包内不得出现任何真实数据；sync 的密钥落 `<数据根>/.bz-face/key.json`，不入包不入 git） |
| `decrypted/`、`media_out/`、`tmp/`、`__pycache__/` | **不收** | 解密产物 / 导出产物 / 一次性脚本与缓存（tmp/ 内 89 个文件按 460 留原地当历史；其中被验证过的「上下文批次格式、批合并」逻辑由 468 收进包的正规实现） |

### 468 新增（收编源里没有的机制）

| 机制 | 说明 |
|---|---|
| 派生图片档 `desc/` | 460 spec：AI 描述输入用**原图**生成的降采样档（长边 1280 / JPEG 质量 80，`--derive-edge` / `--derive-quality` 可配；EXIF 转正、透明通道垫白底、只缩不放）；微信自带缩略图（约 120px，读不出截图里的字）仅留档，绝不当 AI 输入、绝不当派生源 |
| 协作式控制文件 | `<数据根>/.bz-face/control.json`（464 预留的路径）：`{"action":"pause"}` 在步骤边界与每条媒体之间让行待命（进程不退出不丢进度——语音模型冷加载按分钟计，绝不硬杀）；`{"action":"stop"}` 留状态退出（`[bz-result].stopped:true`，退出码 0）；坏 JSON / 未知 action 一律无指令。契约权威表述：`lib/prep-core.js` 的 `parseControlAction`（Node / 插件侧）与 `bz_prep.py` 的 `read_action`（Python 侧），轮询 1s 两端同源 |
| 阶段进度 | `[bz-p] {"phase":"media|derive|map|transcribe","pct":0-100|null}`（媒体 / 派生档 / 转写按条数估，关联表不可估给 null——绝不假报）；暂停 / 恢复发 `[bz-info] {"status":"paused"/"resumed"}` 事件；`[bz-result]` 报 `media/derive/transcribe` 分段计数与 `failed` 总数、`failures` 明细（≤20 条） |

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
