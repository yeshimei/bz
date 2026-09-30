# 518 · 转写 LLM 校对开关（脸谱语音条 / 脸谱录音 / 知识盒影像三处共用）

来源：SenseVoice 参数修复（f2c9670a）后的在线 LLM 校对实验（2026-09-29，用户拍板产品化）
+ grill 两轮拍板（同日：Round 1 总开关/只修错/原文落库可重试/仅设置面板提示出域；
Round 2 复用全局 LLM/并仓前内嵌/自动重试 1 次）+ 追加拍板：知识盒替换 AI 润色。
关联：ADR-0222、issue 444（语音转写组）、issue 469/470（prep/描述段）、issue 516（录音线二期）。
域：core（新校对模块 + 设置）+ people（两处并仓链）+ knowledge（影像文献）。

## 拍板口径

1. AI 面板「语音转写」组加 toggle「LLM 校对」（键 `asrLlmProofread`，缺省关），三处共用。
2. 只修错不创作：提示词单源 `src/core/asr-proofread.ts`，实验口径收编（同音错字/串音/噪声，
   数字存疑不猜，语序口语原样）。
3. LLM 走 `createAI()` 全局配置；批级请求（约 3500 字/16 条），每批自动重试 1 次。
4. 并仓前内嵌：语音条校对 `voice.json`、录音校对 `.turns.json`、知识盒校对转录分块，均在校对后
   才入库/成文；任务进度有「LLM 校对中」。
5. 失败：整档任一批终败 → 不写回，按原文并仓/成文 + 通知；重跑任务或再点并仓只补校对缺口
   （Python 侧 text 已有不重转，秒级补账）。知识盒失败按原文直出正文，任务不炸。
6. 知识盒 `generateVideoNote` 分块润色退役：开关开 = 校对正文，关 = 原文直出；元数据 JSON 调用保留。
7. 出域提示只写在设置项文案；历史已并仓转写不补校。

## 实现面

- `src/core/asr-proofread.ts`（新）：提示词 + `proofreadPieces(pieces, opts)`（批切分/编号喂入/
  严格 JSON 回解析/批级重试/`failed` 标记）+ 测试注桩。
- `src/settings.ts` + `src/core/settings-main-schema.ts`：键、默认值、toggle 行（出域文案）。
- `src/people/prep.ts`：voice.json 写回（条目加 `proofread` 标记；工具重跑重写即失效，语义自洽）。
- `src/people/jobs.ts`：prep 快路径与 prep 成功后两个并仓点前插入校对步（进度写 `job.message`）。
- `src/people/recording.ts`：`RecordingSidecar.proofread` 解析 + 原始 JSON 写回（snake_case 保真、
  sidecar 缓存失效）。
- `src/people/ui.ts`：`suppMergeRecording` 并仓前校对步（通知 + 失败原文并仓）。
- `src/knowledge/note-gen.ts`：`generateVideoNote` 润色块替换为校对开关分支；`processor.ts` 注释文案同步。

## 门禁

- 数据层：`core/asr-proofread` 批切分/编号解析/批级重试/失败不写回；prep voice.json 写回往返；
  recording turns.json 原始写回（snake_case 保真 + 缓存失效 + 标记）；settings schema 行与默认值。
- UI/链路层：note-gen 开/关两态正文来源与调用计数；jobs/ui 校对步插位（打桩 core 模块）。
- `pnpm test` + `tsc --noEmit` 全绿。
