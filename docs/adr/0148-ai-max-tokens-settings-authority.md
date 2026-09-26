# ADR-0148 AI 输出上限面板独裁与调用点参数拆除

- 状态：已接受（2026-09-16，用户拍板「所有 AI 调用的设置项都走设置面板」）
- 关联：issue 334 / ticket 172（per-provider 三行）/ issue 187、ADR-0088（设置键全集=UI 全集）/
  ADR-0146（思考档位，显式优先条款不动）/ ADR-0140 决策 4（装配评审满预算条款被本票取代）/
  commit 79f1007f（采样参数组退役，温度不翻案）
- 影响：`src/core/ai.ts`、`src/auto-summary/processor.ts`、`src/knowledge/note-gen.ts`、
  `src/knowledge/mount-suggest.ts`、`src/secondbrain/ai.ts`、`src/secondbrain/config.ts`、
  `src/secondbrain/ollama.ts`、`src/settings.ts`、`src/smartcat/api.ts`、`src/smartcat/memory.ts`、
  `src/smartcat/dossier.ts`、`src/smartcat/report.ts`、`src/favorites/ai.ts`、`src/favorites/ui.ts`

## 背景

设置面板本就有 per-provider「最大输出 token」（aiMaxTokensOverrides，ticket 172），但两条
私有链把它架空：① `createAI()` 工厂向 defaultOptions 注入 `max_tokens: 8192`，而 prompt() 的
优先级是「调用方显式 > provider 解析」——注入值恒压过用户设置；② 各调用点又自带更小的私有值
（自动摘要 1024/2048、知识盒六档 80~8192、装配评审 131072、第二大脑 16384、小橘 300）。
用户设置的输出上限对所有 createAI 系调用**从未生效**。

实际恶果（诊断实例）：模型覆盖切到推理模型 `deepseek-flash` 后，自动摘要的 1024 预算被思考
全部吃光（实测单篇 reasoning 6011 tok），content 恒空串 → 摘要必败且静默（流式 200 无异常，
连 console warn 都没有）。知识盒转写润色注释里的同类坑（reasoning 吃光预算 → content 空串）
早在 issue 334 之前就复现过。

用户拍板：max_tokens 全部删除、面板独裁；temperature 维持 9-08 退役案不进设置。

## 决策

1. **输出上限唯一权威 = provider 解析链**：设置「最大输出 token」per-provider 覆盖 >
   注册表 defaultMaxTokens。`prompt()` 不再读 `modelOptions.max_tokens`（传入即忽略，透传
   循环跳过该键）；`createAI()` 删除第 4 参 defaultMaxTokens 与内部注入。
2. **调用点私有 max_tokens 全拆**：自动摘要（长度档位只留提示词语义）、知识盒六处、装配评审
   `SUGGEST_JUDGE_MAX_TOKENS(131072)`、第二大脑 16384、小橘 300 全部移除。装配评审的
   `reasoning_effort: 'low'` 保留（ADR-0146 显式优先条款；ADR-0140 的「满预算」条款自此由
   设置面板承载——推理模型大思考量由用户按需调高上限）。
3. **temperature 维持调用点任务语义**（自动摘要 0.3 / 小橘 0.7），不进设置面板——采样参数组
   2026-09-04 进过设置、9-08 全链退役（79f1007f），本票不翻案。
4. **smartcat 迁移 core 单通道**：`AIInput` 扩展 `{messages}` 多轮报文（原自建请求体的根因是
   prompt 只收单条 user 字符串）；smartcat/api.ts 删除自建 fetch/requestUrl/超时机械
   （core 同款兜底 + 空闲超时已覆盖），`callChatJson` 的 maxTokens 形参废除。
5. **死键死码清除**：`secondBrainChatModel` / `secondBrainDeepseekModel` /
   `secondBrainDefaultUseDeepseek`（ticket 108 起 zero 消费）+ config 常量 +
   `ollamaChat` 死导出；favorites `isAvailable` 的第二套 provider 判定复刻改单源
   `getAIProvider()`（转 async，deepseek 缺 key 的「恒真」宽松口径随之修正）。
6. **顺带修正**：知识盒转写润色处的 `{model: 'deepseek-chat'}` 是从未生效的死参数
   （prompt 只认第二位置参数），随拆参一并移除——模型选择自此只认设置面板。

## 后果

- 设置面板「最大输出 token」行真实生效；推理模型（deepseek-flash 等）场景下用户调高该值即可
  避免「思考吃光预算 → content 空」一类失败（自动摘要必败 bug 随 8192 默认自愈）。
- 注册表 defaultMaxTokens 成为大数兜底（anthropic 64000、kimi 131072 等）：上限只是封顶，
  非目标消耗，正常短输出成本不变。
- 未来需要新 AI 参数档位时，先问「是否基础设施参数」：是 → 面板 per-provider 行；否（任务
  语义）→ 调用点 modelOptions，二者不再混居。
