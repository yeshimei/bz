# ADR-0052: 第二大脑对话与概括统一走 core AI，Ollama 专注嵌入

日期: 2026-08-26
状态: accepted（ticket 108，用户拍板「统一使用 ai」）
前置: ADR-0051（第二大脑正名接管与架构）；ADR-0002（core ← 域 依赖方向）

## 背景

ticket 103~107 期间第二大脑保持 QA 双通道语义：对话/概括可选 DeepSeek（core/ai）或本地 Ollama 对话模型（qwen2.5），设置弹窗因此暴露「Ollama 对话模型 / DeepSeek 模型 / 默认使用 DeepSeek」三个键。用户反馈：「去掉对话中的对话模型和 deepseek 模型、默认使用 DeepSeek 三个选项，统一使用 ai」。同时「生成概括由 ai 生成」。

## 决策

1. **对话与概括统一走主设置页「🤖 AI」服务商**（aiProvider：DeepSeek / OpenCode Go，经 core/ai createAI 注入，模型取 provider 配置或『deepseek-v4-flash』冻结默认）。`AI.ask(prompt)` 单参，失败直接抛出由调用方 toast 报错。
2. **Ollama 只负责嵌入**（bge-m3 /api/embeddings、/api/embed），不再承载任何对话/概括流量；不再静默回退 Ollama 对话模型。
3. **旧三键不迁移不删除**：secondBrainChatModel / secondBrainDeepseekModel / secondBrainDefaultUseDeepseek 保留在 data.json 但不再被消费（CONCURRENCY 死配置同款先例——避免再动 onload 迁移链路）。
4. **界面收敛**：设置弹窗删三行并加「前往配置」直达主设置页；桌面与移动端聊天区的 DeepSeek 复选框一并删除；`ollamaChat()` 函数与其两份直测保留、标注「预留未接线」。

## 后果

- 正面：模型与服务商单一心智模型；少三个设置键的维护面；概括/对话质量与其它域（小橘/做题等）一致，服务商统一后可复用密钥与限流治理。
- 代价：本地无网/无 API 配置时对话与概括不可用（此前 Ollama 可兜底）；这是用户明确接受的（设置页已有 AI 服务商区块）。
- 中性：嵌入仍依赖本机 Ollama，与 QA 时代一致；若未来要恢复本地对话通道，ollamaChat 与测试仍在。