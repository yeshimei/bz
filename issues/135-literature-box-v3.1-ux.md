# Ticket 135: 文献盒 v3.1 UX 整改（ADR-0070）

状态：已完成（2026-08-29，worktree/literature-box-ux）
前置：ticket 134（聚合讯预填入口）、ADR-0067（文献盒 v3）

## 需求（2026-08-29 用户逐项拍板）

1. 去掉失败行内/菜单「重试」按钮——重试 = 再次点击 ▶️ 批量处理（处理范围本就含待处理+失败）。
2. 主面板头部加状态计数：N 待处理 · N 处理中 · N 失败（非零项）。
3. 步骤时间线已完成步骤文案改完成态「已…」（解析中→已解析、AI 生成文献笔记中→已生成文献笔记等）。
4. 未解析任务行显短链接（BV 号/短码优先，其余截断），完整链接悬浮可见。
5. 添加/编辑弹窗加遮罩层、去「取消」按钮（遮罩/ESC 关闭，与其他域一致）。
6. 🕘 历史改独立弹窗；去「历史 · N 条」条带行；条目去「成功」徽标；同视频多条文献笔记归并一张卡片分组列出；「清空历史」移入 ⚙️ 设置面板（确认弹窗）。

## 不采纳/不改

- 面板内粘贴直达添加、未保存防关闭、断点续跑缓存标注：不采纳。
- ESC 双层同关：复核确认并无此问题，不改。

## 实施

- `src/bili-downloader/ui.ts`：历史弹窗独立生命周期（createHistoryUI/showHistory/hideHistory + ESC 分层：历史→添加→主面板）；移除 mode/toggleMode；`biliTasksSettingsSchema(opts)` 增可选「清空历史」按钮行；头部 `#bili-status-counts`；`stepDoneLabel` 完成态映射；`shortUrlText` 短链接；添加弹窗 `bili-add-mask`、去取消按钮；buildCardActions 去重试项。
- `src/bili-downloader/styles.css`：去 `.bz-bili-retry-btn`/`.bz-bili-hstrip`；增 `.bz-bili-counts`/`.bz-bili-hgroup .bz-bili-hnote(-time)`。
- `CONTEXT.md` 词条 102 同步；`docs/adr/0070-literature-box-v3.1-ux-refinements.md`。
- 测试：`tests/bili-downloader/ui.test.ts` 全面更新（22 用例），域测试 73/73 绿。

## 验收

- [x] 域测试全绿；全量 vitest + tsc + build 通过（见合并记录）
- [x] 数据格式/命令 id/既有 DOM id 契约不变
