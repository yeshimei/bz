# 187 — AI 设置补全与旧 AIAgent 残留退役（ADR-0088）

## 背景
grill-with-docs 会话（2026-09-04）复核 AI 设置域：界面行数与 schema 一致（无渲染缺失），但设置键全集存在「有消费、无 UI」缺口与一个写键 bug。

## 用户拍板
1. **aiAgent 没删干净，删干净**——clip-archive 剪藏 AI 匹配归档整个下线（含 URL 精确匹配），四键删除。
2. **file-sync 引用同步无条件常驻**（数据完整性，不设开关）。
3. **aiMaxTokens 孤儿键删除**（值迁移承诺无必要：用户 vault 值 = 0）。
4. **custom 模型行统一 + 修写键**——「自定义模型」行退役，「模型名称」行全服务商唯一（手输经 setProviderValue 特判写 aiCustomModel）。
5. **采样参数四键**（temperature/top_p/frequency_penalty/presence_penalty，'' = 不发）。

## 变更
- **删除**：`src/memo/clip-archive.ts`、`src/memo/clip-archive-dialog.ts`；`tests/memo/clip-archive*.test.ts`
- **settings.ts**：删 `aiAgentEnabled/aiAgentWatchedFolders/aiAgentModel/enableAIClipMatch/aiMaxTokens`；加 `aiTemperature/aiTopP/aiFrequencyPenalty/aiPresencePenalty`（string，默认 ''）
- **core/ai.ts**：prompt() 删全局 max_tokens 分支；采样四键注入（modelOptions 优先、非法跳过、0 合法）
- **core/settings-common.ts**：`SYNC_WATCHED_FOLDERS` 常量（两 file-sync 监听范围固定默认值）
- **memo/index.ts**：ensureMemoFileSync 卸下 clip-archive；**main.ts**：引用同步无条件启动
- **core/settings-main-schema.ts**：删「自定义模型」行；setProviderValue 特判 (custom, model) → aiCustomModel（onPick 同路径统一）；新增 `samplingGroup()`（采样温度/核采样上限/频率惩罚/存在惩罚，text+num）并入 aiSettingsSchema
- **core/settings-schema.ts**：TextRow 增可选 `num` 修饰
- **测试**：smoke（引用同步无条件断言）/entries-extra/ai-cov（采样 2 用例替换 aiMaxTokens 2 用例）/settings-schema（三区块 + 行序 -1）/settings-tab（三区块）/settings-copy-lint（删自定义模型、groups[2]）/settings-panel（AI 域 2 组 8 项、sparkles+sliders-horizontal）/favorites-file-sync（删收窄用例）同步

## 门禁
vitest 全量 3678 绿 + tsc 0 错 + diff 自审 + 主仓构建部署。
