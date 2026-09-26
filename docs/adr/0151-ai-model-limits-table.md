# ADR-0151 AI 模型档位表：默认值按「当前模型」取官方最大档

- 状态：已接受（2026-09-16，用户提出「默认都是最大值」）
- 关联：issue 342 / ADR-0148（max_tokens 面板独裁，本 ADR 只改默认档来源，权威链不动）/
  ticket 172（per-provider 三行）
- 影响：`src/core/model-limits.ts`（新增）、`src/core/ai.ts`、`src/core/settings-main-schema.ts`、
  `tests/core/model-limits.test.ts`（新增）、`tests/core/ai.test.ts`、`tests/core/ai-cov.test.ts`、
  `tests/core/settings-schema-ui.test.ts`、`tests/core/settings-copy-lint.test.ts`、
  `tests/settings-panel.test.ts`、`tests/smartcat/api.test.ts`、`CONTEXT.md`

## 背景

设置面板「上下文窗口」「最大输出 token」两行的默认值来自注册表静态常量
（defaultContextWindow / defaultMaxTokens，多数为 8192/65536 保守档）。用户实际在用
DeepSeek 端点 `deepseek-flash`（官方规格：上下文 1M / 最大输出 384K，2026-09-16 核对），
只能手动填覆盖值顶到最大。

「默认都改成最大值」若按服务商逐个改常量不可行：聚合端点（OpenRouter / Together /
SiliconFlow / Ollama / custom）承载任意模型，**per-provider 常量必然对不上「当前这个模型」**；
且 max_tokens 填超模型真实上限会被服务端 400 拒绝——猜大数比保守更危险。

## 决策

1. **新增 `core/model-limits.ts` 模型档位表**：模型名（归一化：小写、去 vendor 前缀、去
   `:tag`）→ { maxOutput, contextWindow }。匹配 = 精确/别名 → 最长包含命中；未收录返回
   null。只收录有据可查的模型（条目注释写核实日期与出处），无依据宁可不收。
2. **解析优先级链**：设置 per-provider 覆盖 > 模型查表 > 注册表默认。`getAIProvider` 与
   面板 `providerValue` 共用查表（单一事实源，禁留第二套判定）。查表输入只用**面板可见的
   模型名**（覆盖 > 注册表默认；custom 用 `aiCustomModel`）——调用点临时传的模型名不参与，
   ADR-0148「面板独裁」口径不变。
3. **注册表兜底档**调为「端点在售主力模型的官方最大档」：deepseek / opencode-go →
   1048576 / 393216；dashscope → 1000000 / 131072。其余承载任意模型的服务商保留保守值。
4. **上限只是封顶、不是目标消耗**（ADR-0148 §后果沿用）：默认顶到最大档不会抬高正常短输出
   的成本；风险敞口只在模型跑飞（循环/幻觉长文）时兑现。

## 后果

- 用户在「模型名称」行换模型时，两行默认值自动跟随该模型的官方档位，无需再手填。
- **「上下文窗口」值当前仍是纯展示**：全插件没有任何请求侧消费点（grep 无
  `provider.contextWindow` 读取者），改它对行为零影响。若未来要做输入侧裁剪/分块预算，
  应消费 `resolveModelLimits().contextWindow` 而不是再造常量。
- 未收录模型回落保守默认：换用新模型想顶到最大时，先在 `MODEL_LIMITS` 补一行（附出处）。

## 补充决策（同日，2026-09-16 用户拍板）：「上下文窗口」行删除

用户指出上下文窗口是**模型固有属性**、不是可调参数——核实属实（零消费点、纯展示），
设置行反而制造「可调」的假象。决策：

1. 设置面板「上下文窗口」行移除；`aiContextOverrides` 设置键退役（类型 + 默认值 + 
   `migrateRetiredAIKeys` onload 迁移清 data.json 残留，口径同 ADR-0141 的 `linkAgentScopes`）。
2. `ai.ts` 全链 `contextWindow` 字段删除（`AIProvider` / `AIOverrideObject` / descriptor
   `defaultContextWindow` 与注册表 17 处条目）。
3. `model-limits.ts` 表内 `contextWindow` 字段保留为**纯参考数据**（请求链只消费 `maxOutput`）；
   未来做输入侧裁剪从这里取窗口值，不再造常量。
