# 444 — 语音转写引擎二选一（SenseVoice-Small 主力 + faster-whisper 备选）

用户对比定版：SenseVoice-Small 为主力转写引擎、faster-whisper 为备选。AI 设置面板新增
「语音转写」组（引擎下拉 + Whisper 档位下拉），知识盒视频录入转文字（bili-dl --batch）按新组下发，
工具侧内嵌 Python 加 SenseVoice 分支（funasr AutoModel）。

## 背景

- faster-whisper 档位下拉原在知识盒设置「工具」组，2026-09-16 该组移除后设置键
  `knowledgeWhisperModel` 成为无 UI 的隐形键（消费链保留）。
- 本票把「转写引擎 + 档位」升格为 AI 面板一级配置：两种引擎共用 `knowledgePythonPath`
  （Python 路径继续沿用，不新增键）。

## 改动

### bz 侧

1. **设置键**（src/settings.ts）：
   - 新增 `asrEngine`（'sensevoice' 缺省 | 'faster-whisper'）与 `asrWhisperModel`（缺省 'small'）；
   - `knowledgeWhisperModel` 退役：一次性迁移到 `asrWhisperModel`（migrateAsrKeys，C16 口径），
     退役键注释区登记；
   - main.ts onload 迁移链接线。
2. **主设置 schema**（src/core/settings-main-schema.ts）：AI 区块新增「语音转写」组
   （icon mic，位于 JEV 之后、数据源凭据之前）：
   - 「转写引擎」下拉：SenseVoice-Small（缺省）/ faster-whisper；
   - 「Whisper 档位」下拉：tiny/base/small/medium/large-v2/large-v3，visibleWhen 仅
     引擎 = faster-whisper 时显示。
3. **下发链路**（src/knowledge/processor.ts）：options 按新组下发——`engine` 恒下发；
   `whisperModel` 仅 faster-whisper 时下发（保留 nonEmpty 留空不下发口径）。

### 工具侧（tools/bili-downloader，junction 挂全局 @jwbz/bili-downloader）

4. **core.js**：内嵌 Python 加 `PY_TRANSCRIBE_SENSEVOICE`（funasr AutoModel，
   model="iic/SenseVoiceSmall"，disable_update=True，CPU）；输出清洗 `<|zh|><|NEUTRAL|>` 类标签；
   engine 分支选脚本与报错口径（funasr 未装引导 `pip install funasr torch torchaudio`，
   仿 faster-whisper 口径）；runBatch 读 `conf.engine`（缺省 sensevoice），args 形状不变
   （argv[1] 档位对 SenseVoice 无效但占位，保 runPythonImpl 打桩契约）。
5. **config.js / cli.js**：rc 新键 `engine`（留空 = sensevoice，插件恒下发覆盖）；
   options 覆盖链照旧（`{...conf, ...options}`）。
6. **package.json**：1.3.0 → 1.4.0。

## 测试

- bz vitest：新键默认值、knowledgeWhisperModel→asrWhisperModel 迁移、processor 下发矩阵
  （engine 恒在 / whisperModel 组合）、主设置 schema 新组与 visibleWhen；smoke 同步。
- 工具侧 node --test：引擎选择与参数透传（runPythonImpl 收 engine/args 矩阵）、
  SenseVoice 报错口径、内嵌脚本内容断言（funasr 引入 + 标签清洗）。

## 文案

设置名称/描述按 issue 434 精简口径（8 字下限、不用顿号缀语）；通知/错误文案不带 emoji。
