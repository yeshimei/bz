# 496 转写引擎设置入口 + prep 软跳过 + 解锁即快照（2026-09-27 用户反馈批）

## 用户反馈

1. 「转写引擎不应该使用的是设置面板 AI 当中所对应的吗，现在指定的是 faster-whisper」
   ——代码读 `asrEngine` 设置键（jobs → prep --asr-engine），但设置面板**没有这一行的入口**，
   指定无处落地；prep 实跑恒用默认 sensevoice。
2. 画脸谱时「转写引擎（sensevoice）加载失败：No module named 'funasr'」——引擎缺失
   **一票否决整场画谱**（prep fail_hard），用户被卡死在语音转写 0/2。

## 修复（worktree fix/asr-engine-and-unlock-stats）

1. **src/people/settings.ts**：聊天仓组新增「转写引擎」select（sensevoice | faster-whisper，
   binding `asrEngine`）与「Whisper 档位」select（base/small/medium/large-v3，binding
   `asrWhisperModel`）。注：两者都是**本地模型**（离线免费），与 AI 通道（云端文本模型）无关；
   首次使用需 bz-face doctor 转写组装依赖。
2. **tools/.../bz_prep.py**：`load_transcribe_engine` 引擎缺失/加载失败由 fail_hard 改为
   返回 None；转写段软跳过（transcribe.fail = 待转写数，进度照走 100，语音本轮暂无文字）——
   画谱链不再被转写卡死，媒体/派生/关联产物照常保留，装好后重跑 prep 只补转写。
3. **src/encrypt/ui.ts**：解锁成功分支即时 `captureLockStats()`（492 的续命）——解锁那一刻
   manifest 在内存，快照立即写 lock-stats.json；硬退/重载/上锁之后，下次解锁屏都有真实数字，
   不再恒「—」。

## 测试

- tests/encrypt/lock-stats-unlock-capture.test.ts：建 people 记录（带头像）→ 上锁 → 解锁屏
  解锁成功 → readLockStats('people') 回落「联系人 1 / 随记录附件 1」。
- face-toolkit-prep / review-fix-lock-ui 既有门禁全绿；tsc 干净。
