# 511 · 脸谱录音处理：完整进度与过程信息

来源：用户实测（2026-09-29）——录音转写在插件里「启动模型…」停留分钟级（像卡死），完成后行状态悄悄切换（观感「进度条消失了」）；要求录音处理有**完整的进度和详细的进度过程信息**。无新架构决策，不开 ADR。

## 背景

- sidecar（`.turns.json`）已逐阶段落账：`phase`（vad / voiceprint / transcribe / done / error）+ `progress{text,done,total}`；UI 轮询只把 `progress.text` 单行 + 段内百分比原位刷进行。
- 模型冷加载期（起跑 → 脚本写第一笔账之间，分钟级）sidecar 无本轮账本，UI 只有「启动模型…」兜底文案，无耗时、无预期——观感即卡死。
- 转写完成（done）→ 行从 running 切到 awaiting-merge / merged，只换一行小字，无强反馈；对「账本已 done 的重复起跑」脚本幂等秒退，UI 同样无交代（起跑 → 秒退 → 行状态复原，像任务凭空消失）。

## 拍板摘要

**阶段单源（recording.ts 纯函数，可测）**
- `RECORDING_STAGES`：阶段链常量——启动模型 → VAD 切窗 → 声纹分离 → 逐轮转写（done 后「并仓」由插件紧随，不在链内显）。
- `recordingStageOf(side, sidecarFresh)`：当前阶段判定——进程在跑由 UI 保证；sidecar 缺席 / 非本轮账本（mtime 早于起跑时刻，UI 以 fs 判后传布尔）→ `load`。
- `formatRecElapsed(ms)`：耗时人话（`45s` / `3m12s`）。

**注册表（recording.ts）**
- `running` 条目加 `startedAt`；`runningRecordingItems()` 带出，供行渲染与进度块算耗时。

**UI（ui.ts）**
- running 行：阶段链（当前段高亮）+ `progress.text` + 段内百分比 + `已 {耗时}`；load 段附「首次冷加载约 1-2 分钟」预期，消除「像卡死」。
- `tickRecRows` 轮询帧同步刷新耗时数字（每秒有变化 = 进度感）与阶段链高亮。
- 起跑预检：sidecar 已 done 且有轮次 → 不起进程，notice 交代「已转写完成 N 轮」（重复起跑不再凭空消失；重转 = 删 sidecar，极低频不给按钮）。
- 进度块（recNoteRows）同口径渲染。

**测试**
- recording 域测试补 `recordingStageOf`（各 phase / 缺账 / 陈账）/ `formatRecElapsed` 用例；smoke 同步。

## 验收口径

1. 起跑后 load 段：行上有「启动模型 + 已耗时 + 冷加载预期」，每秒跳动。
2. 三段处理期：行上能看出「现在哪段、整链几段、段内 done/total、已耗时」。
3. 对已完成录音再点处理：立刻得到「已转写完成 N 轮」的 notice，不起进程。
4. 门禁全绿（pnpm test / tsc --noEmit / 自审 / diff 审查）。

## 备注

- bz-face 包 v0.5.0 的 `bz_refs.py` 有 `out_path` 未定义必崩 bug（本机已热修 npm 全局包脚本，`NameError` → 校验准确率 100% 通过）；包源仓修复 + 发版另行跟，不入本票。
- sidecar 若能加 `load` 相位（脚本起跑先落一笔账）可免 mtime 判定——脚本在 npm 包侧，发版流程另行走，本票不依赖。
