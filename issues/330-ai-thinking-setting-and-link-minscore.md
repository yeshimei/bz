# 330 · AI 思考设置 × 自动关联候选相似度下限

- 状态：实现中（2026-09-16，AI 省 token 讨论拍板，ADR-0146）
- 关联：ADR-0146 / ADR-0141（自动关联）/ ticket 170（provider 注册表）/ ticket 172（per-provider 配置三行）

## 背景与用户原话拆解

1. 「自动双链……自动关联比较耗 token 吧，有什么省 token 的优化方案」→ 澄清：候选召回走本地
   Ollama 嵌入零 API token，耗的是每篇一次 AI 裁判；且裁判通道 `deepseek-v4-flash` 带思考，
   reasoning token 白烧（`note-gen.ts` 已有同款踩坑注释）。
2. 「把思考这个提供成一个 ai 设置」→ 主设置页 AI 组加「思考（reasoning）」下拉，
   不只是开关，含强度档。
3. 「思考强度能不能也像模型一样获取参数」→ 不能动态获取：`/models` 只返回模型名列表，
   不带能力元数据（仅 OpenRouter 返回 supported_parameters，其余 16 家无统一标准）→
   用内置静态映射表按 provider 翻译成各家参数。
4. 「分数低于多少的直接丢弃，不带给 ai，这个有吗」→ 此前没有（findCandidates 只做
   范围/存在性过滤 + TopK 截断，无分数阈值）→ 新增「候选相似度下限」设置。

## 设计

### A. AI 思考设置（全局单值，issue 330 / ADR-0146）

- 设置键 `aiThinking: 'auto' | 'off' | 'low' | 'medium' | 'high'`，默认 `'auto'`
  （不注入任何思考参数，现状零变化；要省 token 用户自选「关闭」）。
- core/ai 新增思考风格映射表（per provider）：
  - `effort`（openai / openrouter / anthropic / google / groq / xai / together / mistral /
    siliconflow）：发 `reasoning_effort: low|medium|high`（Anthropic/Google 走 OpenAI 兼容层，
    支持该参数）；`off` 不注入（effort 家族无法用参数关思考，选非思考模型才是关闭）；
  - `enable`（deepseek / opencode-go / dashscope）：`enable_thinking: true|false`，
    无强度档，低中高都发开；
  - `zhipu`（zhipu / zhipu-plan）：`thinking: { type: 'enabled' | 'disabled' }`，无强度档；
  - `none`（moonshot / ollama / custom）：不注入。
- 注入规则：`auto` 或风格 `none` → 不动；**modelOptions 已有 `enable_thinking` / `thinking` /
  `reasoning_effort` 显式键时调用方优先不覆盖**（`reason()` / `reasonAndSearch()` 现有行为不变）。
- 设置页：AI 组 per-provider 配置三行后加「思考（reasoning）」select 五档
  （跟随模型默认 / 关闭 / 低 / 中 / 高）。

### B. 自动关联候选相似度下限

- 设置键 `linkAgentMinScore: number`，默认 `0.65`，0 = 不过滤。
- 分数语义：vectorSearch 返回锐化后分数（`score^0.35`，与参考面板显示百分比同尺），
  0.65 ≈ 原始余弦 0.30，温和拦掉明显无关候选。
- `findCandidates` 过滤链（去自身/盒外/不存在/加密锁）后、TopK 截断前加
  `minScore > 0 && hit.score < minScore → 剔除`。
- 知识盒设置页「自动关联」组仿 `linkAgentTopK` 行加「候选相似度下限」行
  （text 三函数绑定 + 0~1 钳制 + visibleWhen 总开关 + isChild）。

## 测试

- tests/core/ai.test.ts：各档 × 各风格请求体断言（注入 / auto 不注入 / 显式 modelOptions 优先）。
- tests/core/settings-schema.test.ts：AI 组新行行序同步。
- tests/secondbrain/link-agent-*.test.ts：minScore 过滤（低于剔除 / 0 不过滤 / 边界值）。
- smoke.test.ts 同步；文案过 settings-copy-lint。

## 明确不做（另行开 issue）

- 高分直链免裁判 / 裁判换无思考模型专用通道 / 视频润色快速模式与块级缓存 / 图版降采样。
