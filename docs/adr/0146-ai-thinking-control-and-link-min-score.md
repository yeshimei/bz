# ADR-0146 AI 思考设置与自动关联候选相似度下限

- 状态：已接受（2026-09-16，AI 省 token 讨论拍板）
- 关联：issue 330 / ADR-0141（自动关联）/ ticket 170（provider 注册表）/ ticket 172（per-provider 三行）
- 影响：`src/settings.ts`、`src/core/ai.ts`、`src/core/settings-main-schema.ts`、
  `src/secondbrain/link-agent/pipeline.ts`、`src/knowledge/ui.ts`、相关测试

## 背景

省 token 排查结论：自动关联的候选召回走本地 Ollama 嵌入（零 API token），真正的消耗是
每篇一次 AI 裁判，而裁判通道 `AI.ask` 固定 `deepseek-v4-flash`（带思考），reasoning token
比判定输出本身更贵。知识盒名词/段落等入口均为单次调用，属零头。用户拍板两刀：

1. 「思考」做成 AI 设置（含强度档，非单纯开关）；
2. 双链候选分数低于下限的直接丢弃，不送 AI。

「思考强度能否像模型一样从 API 动态获取」：否——`/models` 只返回模型名列表，不带能力
元数据（仅 OpenRouter 返回 supported_parameters，其余 16 家无统一标准），故用内置静态映射。

## 决策

1. **思考 = 全局单值设置 `aiThinking`**（`auto|off|low|medium|high`，默认 `auto`）：
   `auto` 不注入任何参数，现状零变化；显式选档才注入。
2. **per-provider 静态风格映射**（内置表，不动态探测）：
   - `effort`：openai / openrouter / anthropic / google / groq / xai / together / mistral /
     siliconflow → `reasoning_effort: low|medium|high`（Anthropic、Google 走 OpenAI 兼容层支持）；
     `off` 不注入（effort 家族无法用参数关思考）；
   - `enable`：deepseek / opencode-go / dashscope → `enable_thinking: true|false`（无强度档）；
   - `zhipu`：zhipu / zhipu-plan → `thinking: { type: 'enabled' | 'disabled' }`（无强度档）；
   - `none`：moonshot / ollama / custom → 永不注入（custom 端点未知，冒进发参数有 400 风险）。
3. **显式优先**：modelOptions 已含 `enable_thinking` / `thinking` / `reasoning_effort` 时
   不覆盖——`reason()` / `reasonAndSearch()` 等既有调用行为零变化。
4. **候选相似度下限 `linkAgentMinScore`**（默认 0.65，0 = 不过滤）：`findCandidates` 在
   范围过滤后、TopK 截断前按分数剔除；分数与参考面板百分比同尺（`score^0.35` 锐化后），
   0.65 ≈ 原始余弦 0.30。存疑仍交裁判，「宁缺勿滥」判定标准不变。

### 被否的备选

- **动态获取思考能力**（像「获取模型名」按钮）：`/models` 无能力元数据，仅一家支持，不通用；
- **per-provider 思考覆盖 map**（仿 aiModelOverrides）：单用户单 provider 主用，全局单值够用，
  先不做键位膨胀；
- **对 enable/zhipu 家族映射强度档为预算参数**（thinking_budget 等）：各家语义与量纲不一，
  v1 只发开关，避免参数拼凑出 400。

## 后果

- 裁判类小任务把 `aiThinking` 设为「关闭」即可省 reasoning token（opencode-go 的
  `enable_thinking: false` 实测生效路径与 `reason()` 的 true 对称）；
- effort 家族选「关闭」不会真正关思考（模型默认思考的仍会思考），文案须如实说明；
- 未知模型对注入参数的兼容性由映射表保守口径兜底（custom / moonshot / ollama 不注入）；
- 分数下限会同时作用于自动关联三条触发路径与预演（同一 `findCandidates` 单源），
  参考面板 / 对话检索不受影响（它们不过 findCandidates）。
