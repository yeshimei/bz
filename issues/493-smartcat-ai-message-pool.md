# 493 小橘消息池——SMART_CAT_MESSAGES 退役，AI 动态池化（用一条删一条）

## 设计依据（唯一，已冻结）

ADR-0206（`docs/adr/0206-smartcat-ai-message-pool.md`）+ CONTEXT.md 词条「消息池」「兜底语料」。
本卡不复述设计细节，任何冲突以 ADR 为准；实施会话**不得更改 ADR 拍板**，实现细节自主。

## 落地清单

1. 新模块 `src/smartcat/message-pool.ts`（命名可微调，职责不变）：池消费（shift + 标脏）+
   水位判断 + 补货调度（单飞锁 / 冷却 10min / 日上限 6 批）+ 生成器（`callChatJson`，
   特性快照 prompt + few-shot 风格示例）+ 每类 3~5 条兜底语料常量。
2. `types.ts` / `data.ts`：`SmartCatData.messagePool` 显式段（pet/connected/welcomeBack/thinking
   四 key，缺省容忍零迁移）；写盘走既有标脏 + 30s tick 防抖通道，不新增即时全量写。
3. 消费点换线（4 处）：`interaction.ts` 抚摸 / CONNECTED-SETUP 分叉 / THINKING 占位、
   `index.ts` 欢迎回来；**删除** index.ts 时段欢迎 12 条与 interaction.ts 无 key 兜底 4 条
   内联硬编码（时段改为生成上下文信号）。
4. 退役：`src/smartcat/messages.ts` 整文件删除（437 条语料 git 历史留档）；
   `getSmartCatMessage` / `MESSAGE_KEYS` / recentPicks（ADR-0172 防复读）全部随迁，全库引用清零。
5. setup 兜底：旧 SETUP_MESSAGES 12 条精选 3~5 条入兜底常量，余删。

## 测试

- 数据层：池取用即删、持久化标脏、水位 <3 触发、单飞锁 / 冷却 / 日上限、
  兜底三落水姿势（池空冷启动 / 生成失败 / 未配 AI；mock AI）。
- UI 层：抚摸 / 欢迎回来 / 占位换线后出气泡路径 + 池空降级路径。
- `smoke.test.ts` 同步验证。

## 门禁与交付

- `pnpm test` + `pnpm exec tsc --noEmit` + 自审 + diff 审查全绿。
- worktree 建在 `../.dsh-worktrees/` 从最新 master 分叉；合并回主仓库后主仓库
  `pnpm run build` 部署；feat 提交后立刻 `pnpm changelog`（只在主仓库跑）；部署后清理 worktree。
- 无人值守纪律：门禁反复不过且无法定位时，**停在 worktree 保留 diff 与书面说明，不硬合并**。
