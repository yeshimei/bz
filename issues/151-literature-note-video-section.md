# 151 — 修复：生成的文献笔记没有视频（视频双链缺失）

**状态**：✅ 已完成

## 现象（用户实测）

批量处理后生成的视频文献笔记**只有 frontmatter 九键 + 润色正文**，没有视频（交付的 mp4 明明已落到
`CONFIG/APPENDIX/…_clip_00-01-10-00-01-30.mp4`，任务记录 videoPath 也有值）。

## 根因

ADR-0066 明确定义「保留视频原件（默认开；关 = 跳过交付，只出文献笔记**且无视频双链**，video:null）」、
ADR-0073 定义视频文献「正文 = 润色正文 + 视频双链」——但 **ticket 136 AI 回迁时实现漏掉了视频部分**：
`generateVideoNote` 从不接收 videoPath，正文只拼 `frontmatter + 润色正文`，交付的视频从未进笔记。

## 修复（ticket 151）

- **note-gen.ts `generateVideoNote`**：opts 增 `videoPath?: string | null`；非空时正文尾部加
  `## 视频\n\n![[<vault相对路径>]]`（反斜杠归一正斜杠）——Obsidian 对 mp4 双链渲染内嵌播放器；
  空/未交付（keepVideo=false）→ 无视频段。frontmatter 九键不动（冻结）。
- **processor.ts `_aiStep`**：`generateVideoNote` 调用传 `videoPath`（CLI `[bz-result]` 解析出的交付路径，
  `_aiStep` 已有该参数，此前被丢弃）。

## 验收

- note-gen.test.ts +1 用例（videoPath → 正文含 `## 视频` 与 `![[…]]`；反斜杠归一）；既有用例补
  「未传 videoPath → 无视频段」断言。
- processor.test.ts 成功链路用例断言补 `videoPath` 键。
- tsc + 全量测试 + 构建不回归。