# 533 · 导入一次增量后，全库图片描述与语音转写全变「待转」（用户实测：鸩 840 张待描述 / 68 条待转写）

## 用户报的

> 超级严重bug，导入一次增量消息后（比如，鸩）图片描述和语音都变成待转了

截图口径：`68 条待转写 / 840 张待描述 / 聊天记录 74 条 · 仓内 9,219 条`。

**触发链**（issue 532 修完后的必然结果）：532 让「源比仓新」的联系人重走 export →
鸩的 `chat.json` 从 09-26 全量刷成 10-01 全量（9,219 条）→ 导入轮拿**整份新 chat.json**
重归一 → 同键 upsert 把仓里已经画好的描述与转写全抹掉。

## 盘上实测（2026-10-01 10:40，`export_full/鸩`）

| 项 | 实数 | 结论 |
|---|---|---|
| `chat.json` 图片条 | 840 | img 形如 `2026-09/8fcdf6e82f2032ba670b4de9f3c4b1ef`（**不带扩展名**） |
| `image_desc*.json` 文件键 | 698 | 形如 `2026-09/8fcdf6e82f2032ba670b4de9f3c4b1ef.jpg`（**带扩展名**） |
| img ↔ desc **精确**命中 | **0 / 840** | 一串扩展名之差，精确比对比不上任何一张 |
| img ↔ desc **词干**命中 | 698 / 840 | 剥掉扩展名才对得上（余 142 张旁路表里确实没有描述） |
| `chat.json` 语音条 | 68 | 只有 `sid`、**没有 wav**（导出工具不写 wav） |
| `voice.json` 条目 | 68 | 有 `sid` + `wav` + `text`；sid 交集 **68 / 68** |
| 按 `wav` 查表命中 | **0 / 68** | chat 侧 wav 是空串 → 查表恒落空 |

## 三个成因（叠在一起才是这场事故）

1. **图片：img 缺扩展名 vs desc.file 带扩展名。** `matchImageDesc` 只做精确匹配
   （`descByFile.get(img)`），0/840 → 840 张全部回落空标签 = 「待描述」。
2. **语音：chat 条只有 sid、没有 wav。** `normalizeChatJson` 的 case 34 只查
   `voiceByWav.get(raw.wav)`，而 raw.wav 是空串 → 0/68 → 68 条全部「待转写」。
   （讽刺的是 prep 侧的 `applyVoiceToMsgs` 早就有 sid 兜底了，归一这一路没有。）
3. **导入是「整份重算 + 同键整体覆盖」。** 前两条让这一轮归一产出的派生文本**全是空**，
   `mergeStore` 忠实地把仓里已有的非空文本覆盖成空 —— 这才是「变回待转」的致命一步。
   只修 1/2 能让重导**重新恢复**旁路表里有的那些；要保证**将来任何重导都不再抹掉**，
   必须同时让合并层非破坏。
   附带隐患：`descSkip` 终态标注（敏感 / 源图损坏缺失）normalize 从不产出，同键覆盖会把它丢掉；
   而插件 AI 描述段的产出**只进聊天仓、不落任何旁路表**（`readPrepSidecars` 只读
   voice / image_map / media_fail）——那部分描述一旦被抹就无从恢复。

另有一处放大：聚合表 `image_desc.json` 落后于分月表 `image_desc.<YYYY-MM>.json`（637 vs 698，
差 61 条全是 2026-08 的），而 `readContactBundle` 只读聚合表 —— 即使词干容错到位，那 61 张也恢复不出来。

## 修法（`src/people/datasource.ts` 为主）

- **词干容错**：新增 `keyStem()`（统一分隔符 + 剥尾段扩展名）与 `stemIndex()`（复用
  `quantKeyMap` 的歧义拒配：同词干撞上不同条目 → 拒配，宁缺不错）。`matchImageDesc`、
  `applyImageDescToMsgs`、`applyMediaFailToMsgs` 三处 `img ↔ file` 匹配统一改成
  「精确优先，落空再走词干」。
- **语音 sid 兜底**：`normalizeChatJson` 新增 `voiceBySid` 索引（`voice.sid` 直取 +
  wav 文件名尾段内嵌 server_id 兜底，与 `applyVoiceToMsgs` 同款），case 34 由
  「只按 wav」改为「wav 优先 → sid 兜底」；**转写失败条目（ERR / `<转写失败`）不入索引**，
  免得失败占位被当成正文并进时间线。
- **非破坏性合并**：`mergeStore` 新增可选第 4 参 `MergeStoreOptions`
  （`{ previewVoice, imageDescMode }`，导入侧传同一份归一选项）：
  - 图片 / 语音的派生文本：新文本为空、仓里同键已有非空文本、且**该媒体开关还开着** → 保留仓里的
    （空 = 本轮没查到，不是「没了」）；开关明确关掉时照旧清空（用户意图优先）；
  - `descSkip` 终态标注：normalize 从不产出 → 一律沿用仓里的，只由 prep 的旁路表权威增删；
  - 不传该参数 = 保持原「整体覆盖」语义（旧调用形态不变）。
- **分月描述表**：`readContactBundle` 除聚合 `image_desc.json` 外，再按名序读
  `image_desc.<YYYY-MM>.json`，**只补聚合表没有的 file**（聚合表仍是权威，不被分月覆盖）。

## 改动面

| 文件 | 改动 |
|---|---|
| `src/people/datasource.ts` | `keyStem` / `stemIndex` 新增；`matchImageDesc` 签名 + 词干；`normalizeChatJson` 建 `descByStem` / `voiceBySid`、case 34 sid 兜底、case 3 传词干索引；`applyImageDescToMsgs` / `applyMediaFailToMsgs` 词干；`mergeStore` 第 4 参 + `mergeStoreMsg` 非破坏合并；`readContactBundle` 读分月表 |
| `src/people/ui.ts` | 导入轮 `mergeStore(existing, norm, now, opts)` 传归一选项 |

## 测试

- 新增 `tests/people/import-derived-recovery-533.test.ts`（22 例）：图片词干容错 6 例
  （含 40 张批量、歧义词干拒配、不借邻居）、语音 sid 兜底 6 例（含 wav 尾段内嵌 id、
  失败条目不入索引、撞键拒配、开关关掉不恢复）、mergeStore 非破坏 6 例（描述 / 转写保住、
  开关关掉照旧清空、空→非空照旧升级、descSkip 跨重导保留、不传 opts 保持旧语义）、
  prep 侧词干 2 例、`readContactBundle` 分月表 2 例。
- 红验：把 `datasource.ts` 回退到改前，这批断言 4/4 全红（缺扩展名与 sid-only 两条）——
  确认测试真的锁在这个 bug 上，不是自说自话。
- 全量：`tsc --noEmit` 干净；`tests/people` 992 passed / 2 skipped。

## 真实数据复演（鸩，改前 → 改后）

```
图片：总数 840   修复前命中 0（840 待描述） → 修复后命中 698（142 待描述）
语音：总数 68    修复前命中 0（ 68 待转写） → 修复后命中  68（0 待转写）
```

**用户侧要做的一步**：装上修复版后**重新导入一次**（导入现在是非破坏且幂等的），
698 张图片描述 + 68 条语音转写会从旁路表恢复进仓。余下 142 张旁路表里本来就没有描述，
若它们在仓里曾有插件 AI 产的描述，那部分只存在于保库记录、无旁路表可依——只能重跑描述段补。

## 不在本轮

- 不改群聊前缀格式、不动 532 的重导出判据。
- 142 张「旁路表本就无描述」的补画不在本轮（那是描述段的正常欠账，不是 bug）。
- 原型产物重出 / 主构建部署产物同步按仓规在合回主仓时做（worktree 内不构建）。
