# PROGRESS — 包仔（bz）插件开发进度

> 进度同步总表（AGENTS.md）。每票一节，状态：计划中 → 进行中 → 门禁 → 已交付。

## Ticket 136 — 文献盒改版（literature 域 / 术语生成 / AI 回迁 / 去网页版）

**状态：已交付（含终审全项闭环）**

- [x] 设计定稿（grill-with-docs 五轮拍板，契约见 `issues/136-literature-box-redesign.md`）
- [x] 文档：ADR-0071（AI 回迁+去网页版）/ ADR-0072（新域迁出+literature.json）/ ADR-0073（type+domain）
- [x] CONTEXT.md 词条更新（文献盒/B站下载/快速流程/文献笔记/文献类型/领域/术语文献/文献目录）
- [x] Worktree A `worktree/tools-literature`：CLI 去 AI 去网页版、转录临时文件、压缩步骤 → 已合并 master（531bcd2）
- [x] Worktree B `worktree/literature-domain`：src/literature 域全量实现 + 集成 + 测试 + 构建 → 已合并 master（77e9222）
- [x] 全量测试绿 + tsc 0 错 + 构建通过 + 部署产物与仓库一致
- [x] 命令：bz-literature-open（文献盒）/ bz-literature-note-term（术语生成文献笔记）；移除 bz-bili-open / bz-bili-tasks-open
- [x] 独立终审（46172556）：P1×4（bz-bili 样式恢复/backfill type 回滚/instanceof 字符串/术语确认重跑 AI）+ P2×4 + P3×5 全部闭环

## Ticket 138 — 文献盒 UX 修复与增强（用户实测反馈）

**状态：已交付**

- [x] 规格：`issues/138-literature-ux-fixes.md`
- [x] 硬 bug：openTermNote 改 getActiveViewOfType(MarkdownView)（修 instanceof）；ensureLiterature 失败可重试 + createMainUI 自愈（点两次才打开）；backfill AI 25s 超时跳过（补全不卡批）
- [x] 术语流程：generateTermDraft 纯 AI 预览不落盘；确认写入 generateTermNote 传面板值所见即所得、不重跑 AI
- [x] 主面板 UI：emoji 按钮 📝🎬、🔍 前移、去类型分类栏、去类型徽章、样式对齐日记本、loadNotes 递归
- [x] worktree/literature-ux 3 提交合并 master（dc8728e）+ 全量 218 文件/3468 用例绿 + 构建部署

## Ticket 139 — 文献盒 UX 二轮（用户清单拍板 10 项 + 关闭按钮统一）

**状态：进行中（worktree/literature-ux-139）**

- [ ] 规格：`issues/139-literature-ux-round2.md`（spec.md「文献盒 UX 二轮」节同步）
- [ ] 交互：📝/🎬 子面板叠开不隐藏主面板（关闭子面板回列表）；openNote 收起文献盒全部窗口
- [ ] 增量刷新：新增 core/list-patch.ts 键控卡片 diff；literature + clipping 文件事件只 patch 差异卡片（滚动不跳顶）；diary/movie 单列后续
- [ ] 视频队列：失败原因白话化（humanizeError，原文在 title）+ 失败卡片点击进编辑弹窗带原因提示条；移动端仅 ➕ + ❌；移动端默认全屏补齐
- [ ] 弹窗：添加任务「整片/剪辑」分段开关 + 校验失败聚焦 + Enter 提交；术语面板重设计（输入同行/状态行/预览卡片化）+ 重新生成手改确认
- [ ] 样式：筛选/搜索留白 16px 对齐卡片；关闭按钮 ✕→❌ 三处统一；加载中占位
- [ ] 全量测试绿 + tsc + 构建部署
