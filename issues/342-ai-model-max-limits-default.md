# Issue 342 — AI 模型配置两行默认值改为「按当前模型查官方最大档」

**状态：已实现，测试全绿**（2026-09-16）

## 用户诉求

设置面板「模型配置」组里「上下文窗口」「最大输出 token」两行的默认值想直接用**当前模型的
最大值**（此前是 8192 / 65536 这类保守档），用户实测 DeepSeek 端点在售模型就是
上下文 1M、最大输出 384K，手动填了 `aiContextOverrides.deepseek = 1048576` /
`aiMaxTokensOverrides.deepseek = 393216` 才生效——希望不用手填，默认就顶到最大。

## 为什么不能直接改 17 个常量了事

1. **per-provider 静态值对「可换模型」的端点必然不准**：OpenRouter / Together / SiliconFlow /
   Ollama / 自定义端点承载任意模型，聚合平台根本没有「这个服务商的最大值」。
2. **填超模型真实上限会被服务端拒绝**（400），猜大数比保守更危险。
3. 用户真实的诉求是「**对应模型**的最大值」——解析输入必须是模型名，不是服务商 id。

## 实现（ADR-0151）

1. 新增 `src/core/model-limits.ts`：`MODEL_LIMITS` 模型档位表（模型名 → 官方最大输出 /
   上下文窗口）+ `resolveModelLimits()`（归一化 → 精确/别名 → 最长包含命中 → 未收录返回 null）。
   只收录有据可查的模型（DeepSeek 系 2026-09-16 官方核对；Qwen3.7 系官方帮助中心核对），
   无依据的宁可不收。
2. 解析优先级链更新（ADR-0148「面板独裁」不动）：**设置覆盖 > 模型查表 > 注册表默认**，
   `ai.ts::getAIProvider` 与 `settings-main-schema.ts::providerValue` 两处共用查表（单一事实源）。
   查表输入 = 面板可见的模型名（覆盖 > 注册表默认；custom 用 `aiCustomModel`）。
3. 注册表兜底档同步调为「端点在售主力模型的官方最大档」：deepseek / opencode-go →
   1048576 / 393216；dashscope → 1000000 / 131072。其余服务商承载任意模型，保守值保留。
4. 两行 desc 更新：「留空时取该模型官方窗口 / 上限」。

## 测试

- 新增 `tests/core/model-limits.test.ts`：归一化、精确/别名/包含命中、未收录 null、表自洽。
- `ai.test.ts` 新增「按当前模型名解析」用例（openai 端点挂 deepseek-flash → 384K ≠ openai
  注册表默认 16K，钉住查表优先级）；其余 8192 断言随兜底档更新为 393216。
- `settings-schema-ui` / `settings-panel` / `settings-copy-lint` / `smartcat/api` 断言同步。

## 后续（同日追加，2026-09-16）：「上下文窗口」行删除

用户指出：上下文窗口是**模型固有属性**，不是可调参数——核实属实，该值在全插件**零消费点**
（不发请求、不参与输入裁剪，纯展示），留着只会制造「调大它 AI 就能读更多内容」的假象。已删：

- 设置面板「上下文窗口」行移除，`aiContextOverrides` 键退役（`settings.ts` 类型 + 默认值 +
  `migrateRetiredAIKeys` onload 迁移清 data.json 残留，口径同 `linkAgentScopes` 先例）；
- `ai.ts`：`AIProvider.contextWindow` / `AIOverrideObject.contextWindow` / descriptor
  `defaultContextWindow` 及注册表 17 处条目全链删除；
- `core/model-limits.ts` 表内的 `contextWindow` 字段**保留**为纯参考数据（模型档位事实，
  未来做输入侧裁剪时从这里取），请求链只消费 `maxOutput`。

## 遗留

- 表未收录的模型回落各服务商保守默认（防 400）；用户换用新模型时按官方文档补一行即可。
- 「上下文窗口」值当前**无消费点**（纯展示，请求侧不用它裁剪输入）——见 ADR-0151 后果节。
