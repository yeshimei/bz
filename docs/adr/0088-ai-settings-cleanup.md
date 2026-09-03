# ADR-0088：AI 设置补全与旧 AIAgent 残留退役

- 状态：已接受（2026-09-04）
- 关联：ADR-0086/0087（旧域退役序列）、issue 186/187、ticket 170~173（AI 服务商注册表与 per-provider 覆盖）

## 背景
设置面板 AI 域拆出（issue 186）后用户复核发现四类问题（2026-09-04 grill 会话拍板）：
1. 旧 AIAgent（ticket 19 域，早已删）残留没删干净：`clip-archive`（剪藏 AI 匹配归档）+ `clip-archive-dialog` 仍活跃，`aiAgentEnabled/aiAgentWatchedFolders/aiAgentModel/enableAIClipMatch` 四键无 UI 只能手改 data.json；
2. 全局 `aiMaxTokens` 键仍在请求链生效且优先级高于 per-provider「最大输出 token」行（ticket 172 改 per-provider 方案时的孤儿键，无任何 UI）；
3. custom 服务商下「自定义模型」与「模型名称」两行并存且手输写键错位（手输写 `aiModelOverrides[custom]`，读取只认 `aiCustomModel`——手输无效，仅「获取模型名」按钮写对键）；
4. 请求体无温度等采样参数，且从未有设置入口。

## 决策
1. **旧 AIAgent 残留彻底退役**：删除 `src/memo/clip-archive.ts`、`src/memo/clip-archive-dialog.ts` 与四键 `aiAgentEnabled/aiAgentWatchedFolders/aiAgentModel/enableAIClipMatch`（含 URL 精确匹配归档——用户拍板不留非 AI 链路）。剪藏内容进备忘录改由用户手动添加。
2. **引用同步无条件常驻**：`memo/file-sync` 与 `favorites/file-sync`（笔记 rename/delete 引用同步）是非 AI 的数据完整性功能，脱离 `aiAgentEnabled` 开关，main.ts onLayoutReady 无条件启动，不设新开关。监听范围键删除后固定为 `SYNC_WATCHED_FOLDERS`（core/settings-common，值 = 原默认「卡片盒,归档/网页剪藏」，与用户存量值一致，行为不变）。
3. **删全局 aiMaxTokens 孤儿键**：请求链 max_tokens 解析收敛为 `modelOptions.max_tokens ?? provider 解析（per-provider 覆盖 > 注册表默认）`。用户存量值 0（未生效），零迁移。
4. **custom 模型行统一**：删「自定义模型」schema 行（`aiCustomModel` 键保留为存储格式）；「模型名称」行为全服务商唯一模型入口，`setProviderValue` 对 `(custom, aiModelOverrides)` 特判直写 `aiCustomModel`，修手输无效 bug；「获取模型名」按钮 custom 下照常可用（fetchProviderModels 原生支持 custom 端点）。
5. **新增采样参数组**（AI 域第二组，⚙️ 主设置页同步三区块）：`aiTemperature/aiTopP/aiFrequencyPenalty/aiPresencePenalty` 四键（string 键数字项，'' = 不发该字段用 API 默认）；请求链在 modelOptions 透传后注入，modelOptions 同名字段优先，非法数字静默跳过，温度 0 合法发送。行名「采样温度/核采样上限/频率惩罚/存在惩罚」过文案 lint（≥4 字、无符号）。

## 理由
- 「设置键全集 = UI 可见全集」应成立：无 UI 的活跃键是隐性配置漂移源（aiMaxTokens >0 会静默压过界面值）。
- 引用同步是数据完整性而非偏好，不设开关（用户 vault 该开关本就为 true，行为零变化）。
- 每服务商一个模型入口消除 custom 双行歧义；写键统一走 setProviderValue 单点。
- 采样参数为全局键（非 per-provider）：调用方已可经 modelOptions 按功能覆盖，全局值即兜底偏好，符合用户极简口味。

## 后果
- 设置面板 AI 域徽标 = AI 组（5~7 项随 provider）+ 采样参数组 4 项；⚙️ 主设置页两区块 → 三区块。
- settings-schema `TextRow` 增可选 `num` 修饰（面板渲染器右对齐窄框；core 渲染器忽略）。
- 旧 data.json 残留 aiAgent*/enableAIClipMatch/aiMaxTokens 键被接口收窄后自然忽略（无害死数据）。
- 测试：clip-archive×2 测试文件删除；smoke/entries-extra/ai-cov/settings-schema/settings-tab/settings-copy-lint/settings-panel/favorites-file-sync 同步；ai-cov 新增采样参数透传 4 断言用例。
