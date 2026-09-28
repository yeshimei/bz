# 509 · 脸谱补充素材：详情页导入入口（文本/图片/录音）

决策文档：ADR-0212（入口与数据路径）、ADR-0213（录音分离管线与轮次进仓）。
评审记录：grill 两轮拍板（2026-09-28，用户逐条确认）。

## 拍板摘要

- 详情页「记一笔」→「**补充素材**」，三页签：文本 / 图片 / 录音。
- 文本 = 原 ManualEvent 功能原样收编；**聊天文本导入取消**（评审 Q1/Q1r2）。
- 图片：`desc/<月>/<YYYYMMDDHHmm>_<序号>.<ext>` 带扩展名落盘；img 同格式；归属批量二选默认对方；
  ts=mtime 可改；显式「生成描述」按钮走引擎 describe 段（AI 通道）；完成自动并仓 `[图片] 描述`。
- 录音：`recordings/<原名>` 落位；ts 文件名解析 → mtime → 可改；管线 = 方案 C
  （tools/rec_slide_hmm.py：VAD 门控 + CAM++ 1s/0.25s 滑窗 + Viterbi(k10,C3) + SenseVoice），
  真值 97.6%；质心降级阶梯「非我即对方 → 0/1」；轮次一轮一消息
  （type=9001、isSender、`[录音 N分NN秒·情感]`、kindCounts「录音」）。
- 断点一次做齐：phase 账本 + turns.json sidecar，续跑只补缺口；进度挂画谱进度块位置。
- 原件一律落数据根（vault 外），派生文本进加密保库记录（口径不变）。
- python 走现有 `pythonPath` 设置键，首次录音处理前校验引导。

## 任务切分

- [ ] T1 数据层：StoreMsg 录音轮次形态（type 9001）+ `applyRecordingTurnsToMsgs` 单源合并 + media.ts「录音」标签解析 + kindCounts「录音」计数（带测试）
- [ ] T2 工具接线：spawn pythonPath + tools/rec_slide_hmm.py 的会话管理（phase sidecar 读写、断点续跑、杀/重启）
- [ ] T3 补充素材页：三页签骨架 + 文本页签（ManualEvent 原功能迁入）+ 按钮改名
- [ ] T4 图片页签：多选复制落盘（带扩展名命名）+ 归属/时间编辑 + 「生成描述」按钮接引擎 describe + 并仓
- [ ] T5 录音页签：多选复制落位 + 文件名时间解析 + 质心构建/降级判断 + 任务行（进度挂画谱块位置）+ 轮次并仓
- [ ] T6 smoke/回归 + 门禁全绿 + worktree 合并部署

## 依赖与注

- 方案 C 工具脚本已就位并经真值校准（`E:\Obsidian\微信脸谱数据\tools\rec_slide_hmm.py`、`voiceprint_refs.py`、`rec_groundtruth.py`）。
- 引擎 describe 段读派生档依赖 img 带扩展名——**仅新导入图片满足**；旧库图片仍走旁路表兜底。
- 鸩批量描述的 1301 排雷经验（frontier 跳过 + 「（描述跳过）」登记）是子代理批量描述线的运维口径，与本票无关但记录在案。
