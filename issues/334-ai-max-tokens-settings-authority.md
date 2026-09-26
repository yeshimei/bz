# 334 · AI 输出上限面板独裁：调用点私有 max_tokens 全拆除

- 状态：已实现（2026-09-16）
- 关联：ADR-0148 / ticket 172（per-provider 三行）/ ADR-0146（思考档显式优先，不动）/
  ADR-0140 决策 4（满预算条款被取代）/ commit 79f1007f（采样参数组退役，温度不翻案）

## 用户原话拆解

「让 bz 当中的所有 AI 调用的设置项都走设置面板，怎么各自还有自己的私有参数呢？」——设置面板
已有 per-provider「最大输出 token」，但 `createAI()` 注入的 8192 与各调用点私有值（自动摘要
1024/2048、知识盒六档、装配评审 131072、第二大脑 16384、小橘 300）按「显式 > provider 解析」
的旧优先级恒压过用户设置，面板行形同虚设。

拍板（AskUserQuestion）：① max_tokens 全部删除、面板独裁（非「优先级反转保留默认」）；
② temperature 维持 9-08 退役案，不进设置。

## 改动

- `core/ai.ts`：`prompt()` effMaxTokens 恒取 provider 解析（覆盖 > 注册表默认），
  `modelOptions.max_tokens` 传入即忽略；`createAI()` 删第 4 参与注入；`AIInput` 扩展
  `{messages}` 多轮；文件头注释同步。
- 调用点拆参：`auto-summary/processor.ts`（长度档位只留提示词语义）、`knowledge/note-gen.ts`
  六处 + 删从未生效的死参数 `options.model:'deepseek-chat'`、`knowledge/mount-suggest.ts`
  （`SUGGEST_JUDGE_MAX_TOKENS` 删，`reasoning_effort:'low'` 保留）、`secondbrain/ai.ts`。
- smartcat 迁移 core 单通道：`smartcat/api.ts` 重写（删自建报文/超时机械/兜底模型），
  `memory.ts`×4、`dossier.ts`、`report.ts` 的 `callChatJson(…, N)` 删第二参。
- 死键死码：settings.ts 删 `secondBrainChatModel`/`secondBrainDeepseekModel`/
  `secondBrainDefaultUseDeepseek`；`secondbrain/config.ts` 对应常量；`ollama.ts` 死导出
  `ollamaChat`；favorites `isAvailable` 单源 `getAIProvider()`（转 async，ui.ts 调用点 await）。
- 测试：core/ai（面板独裁 + {messages} 回归）、ai-cov（createAI 停注三用例）、auto-summary
  processor（分档断言改温度语义）、mount-suggest（不私传上限）、favorites ai/ui（async 判定
  + QuickAdd 兜底真伪两态）、smartcat api（core 报文新写）、secondbrain ollama（删 ollamaChat
  用例）；原型产物 `build-preview` 重建。

## 验证

- `pnpm test` 326 文件 5206 用例全绿；`pnpm exec tsc --noEmit` 零错误。
- 诊断回路（真实 vault 文章 + 逐字同提示词直调 API）：deepseek-flash reasoning 6011 tok >
  旧 1024/2048 预算必红；8192 绿——拆除后自动摘要落 8192 默认，bug 自愈。
