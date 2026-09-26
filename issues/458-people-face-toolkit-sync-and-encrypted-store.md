# 458 脸谱一期：`@jwbz/obsidian-face` 包成形 + 同步 + 聊天仓入保库

## 背景

脸谱的外部流程现在散落在 `E:\Obsidian\微信脸谱数据\tools\`（`bz_export.py` / `export_all.py` / `voice_transcribe_all.py` / `voice_writeback.py` / `image_ct_map.py` / `emoticon_writeback.py` / `wxgf_decode.py` / `synthesize.py` + vendored `WeChatMsg_Lite` + `tmp/` 几十个一次性脚本），全是人肉 CLI 串，没有包、没有协议。同时数据是明文的（`people.json` / `people-preview.json` / `CONFIG/FACES/<人名>/avatar.jpg`），且聊天仓是有损投影（大琳 20773 → 18477 条，丢 `type/who/sid/dur/wav/img` 六字段）。

一期目标：**把外部流程合包 + 打通「同步」一键 + 数据层换成加密的聊天仓**。决策依据见 ADR-0194 / 0195 / 0196 / 0197。

## 改动

### 1. 工具包 `tools/obsidian-face/`（新建，ADR-0195）

- `package.json`：`@jwbz/obsidian-face`，bin `bz-face`，`publishConfig.access: public` 但**不 npm publish**；零 npm 运行时依赖（node 原生），测试 `node --test`。
- `cli.js`：子命令 `sync` / `prep`（一期只出骨架）/ `doctor`；共性参数走 `--json` 全量下发；stdout 打四行协议 `[bz-step]` / `[bz-p]` / `[bz-info]` / `[bz-result]`。
- `core.js`（Node 侧）：spawn Python、行协议发射、`.bz-face/state.json` 断点读写、`.bz-face/control.json` 轮询（步骤边界 + 每条媒体之间）。
- `python/`：从 `E:\Obsidian\微信脸谱数据\tools\` 收编并整理——`sync` 链 = 取密钥 → 解密 → **表情命名并入 text 导出**（`emoticon_writeback` 并入，不再单独回写）→ 导出 `chat.json`（只含文本 + `[表情·名]` + `img` + `wav`/`dur`）→ **从 `head_image.db` 抽头像**源。
- `vendor/WeChatMsg_Lite/`：**裁剪后 vendored**（去 `.git`、去无关 exporter），**保留 MIT LICENSE 与版权声明**。
- 分层 `requirements.txt`（`decrypt` / `transcribe` 两组）+ `README.md` + 工具侧 `CONTEXT.md`。
- `synthesize.py` 的「连发归组」**不迁**（ADR-0197 后果）；`tmp/` 其余不迁。

### 2. 加密存储（ADR-0194）

- `src/encrypt/data.ts`：`SafeNote.kind` 枚举加 `'people'`。
- `src/people/data.ts` 改造：弃 `jsonFileStore`，改注入**共享 `SafeManager` 单例**（照 `src/password-vault/data.ts`：`getSafeManager()` 注入 + 订阅 `ENCRYPT_CHANGED_CHANNEL` / `ENCRYPT_UNLOCK_CHANGED_CHANNEL` + 上锁清明文缓存并暂停后台任务）。
- **粒度 = 每联系人一条保库记录**：人物卡 + 聊天仓 + 任务条目 + 头像附件合并。
- **索引也加密**；面板打开走 `ensureSafeUnlocked` 门禁。
- 头像从 `CONFIG/FACES/` 迁入保库记录（SafeAttachment，渲染解密成 data URL）；`peopleMediaDir` 键与 `importAvatarToVault` 的明文复制路径**退役**。
- 存量迁移（与 §3 合并为同一次）：`people.json`(3 人) + `people-preview.json`(3 人) + `people-jobs.json` → 每人一条保库记录。
- `checkup`：未解锁时跳过脸谱域而不是报错。

### 3. 聊天仓 v2（ADR-0197）

- `PreviewMsg` 扩为全量原始消息 + 派生 `text`（空串 = 不进时间线）；`PreviewData.version` bump 到 **2**；v1 无就地升级路径，判废后从数据根重导。
- `mergePreview` append-only → **upsert**（同 `key` 覆盖文本、原始字段按新值更新）；`watermarkSid` 与增量逻辑保留。
- **vault 唯一写者是插件**；工具只写数据根。`image_ct_map` 不再回写 `chat.json` 的 `img`（只产 `image_map.json`）；`voice_writeback` 不再回写（只产 `voice.json`）。
- 概念改称**聊天仓**（文件名保留 `people-preview.json`）。

### 4. 同步按钮与设置（ADR-0196）

- 数据源弹窗右上角「重扫」→ **「同步」**（图标 `refresh-cw`，tooltip 写清「从微信重新解密并导出，需要微信已登录」）；点按 → spawn `bz-face sync --json …`；**弹窗内一条进度行**（不占生成进度块）；完成后刷新列表 + 标注更新数、**不自动导入**；运行中该位置**只出「停止」**。
- 前置检查：微信进程不存在 → 硬失败 + 中文引导（**不静默降级成读旧目录**）。
- 设置面板新增**「外部工具」组**：`pythonPath` / `ffmpegPath` / `ffprobePath`（从 `knowledgePythonPath` / `knowledgeFfmpegPath` / `knowledgeFfprobePath` 一次性迁移，`migrateAsrKeys` 同款）；新增 `peopleWechatSrcDir`（默认空 = 自动探测）。
- 文案：`peopleDataDir` 改称「数据根」；两条隐私文案改词为「完整聊天数据入库、媒体**本体**不入库（只存路径）」；补一句数据根明文边界提示。
- `src/core/external-tool.ts`（新建）：四行协议解析 + spawn 壳（knowledge **本次不动**，后续再迁）。

## 验收

- 测试：迁移（3 人 → 3 条保库记录，字段对齐）；upsert 文本升级矩阵（原 append-only 保留旧文本的现网 bug 必须被覆盖掉）；v2 结构读写；解锁门禁（未解锁面板不发数据请求）；头像附件往返（写→锁→解锁→渲染）；`sync` 行协议解析（mock `child_process`）；`peoplePreviewVoice` / `peopleImageDescMode` / `peoplePreviewVideo` / `peopleKeepSystem` 四个开关迁到下游 `text !== ''` 过滤后行为不变；`text` 空串条目不进素材。
- 门禁：`pnpm test` + `tsc --noEmit` + 自审 + diff 审查 + **主仓** `pnpm run build`。
- 人工：微信登录状态下点一次真实「同步」走通；未登录 / 微信未开给中文引导。

## 遗留

- `prep` 与整条画脸谱管线留 **issue 459（二期）**。
- `parse.ts`（留痕 CSV/JSON 嗅探）**冻结不动**，文档标注非主路径。
- `AGENTS.md` 的 `CONFIG/.ENCRYPT/` 路径已在本次修正为 `CONFIG/STORAGE/.ENCRYPT/`，并补了 people 行。
