# 411 · AI 服务商收敛三条通道 × 思考档位按 provider 单源

- 状态：已实现（2026-09-23，用户拍板；ADR-0179）
- 关联：ADR-0179 / ADR-0146（取代其 §2 与全局 aiThinking）/ ADR-0148 / ADR-0151 / ticket 170-173

## 用户原话拆解

1. 「设置面板 ai 关闭思考，对 deepseek 是不是不生效？」→ 核实：**不生效**。插件对 deepseek 发
   `enable_thinking: false`（Qwen/自建 vLLM 的词表），DeepSeek 官方 V4 的开关是
   `{"thinking": {"type": "disabled"}}`；未知字段「不报错也不生效」（官方文档对 temperature 等即此口径），
   故 bug 是静默的——`reasoning_content` 照旧长出来、照旧计费。
2. 「只保留 deepseek 和智谱套餐即可，其他的用到了再添加」→ 注册表收敛为三条通道。
3. 「也要保留 ollama」→ 加上本地通道（三家：deepseek / zhipu-plan / ollama）。
4. 「deepseek 和智谱的思考参数和强度各不相同，在设置面板正确显示，而不是一律几个档位省事」
   → 档位表做成 provider 自带（descriptor.thinking），面板只列该家真支持的档，值也按 provider 分开存。

## 参数核对（2026-09-23，各家官方文档）

| 通道 | 开关 | 强度 | 面板档位 |
|---|---|---|---|
| DeepSeek（官方 V4） | `thinking:{type:enabled\|disabled}`，默认开 | `reasoning_effort: low\|high\|max`（medium→high 由服务端折） | 跟随默认 / 关闭 / 低 / 高 / 最高 |
| 智谱 Plan（glm-5.3-flash） | `thinking.type` 开关存在，但 5.3 系**强制思考**（disabled 无效） | `reasoning_effort: low\|high\|max`（默认 max） | 跟随默认 / 低 / 高 / 最高（**不给关闭档**） |
| Ollama（OpenAI 兼容层） | 无独立开关：`reasoning_effort` 映射内部 `Think` | `none`=关、`low\|medium\|high`=开且分档；省略字段 = 有能力则开 | 跟随默认 / 关闭(none) / 低 / 中 / 高 |

## 落地

- [x] `core/ai.ts`：注册表收敛三条（含 `DEFAULT_AI_PROVIDER` 导出）；新增 `AIThinkingLevel/Spec` +
      每条通道 `thinking` 档位表；`thinkingLevelsOf` / `thinkingBodyFor` 纯函数；删除
      `AI_THINKING_STYLE` / `thinkingOptionsFor` 与死 API `reason()` / `search()` / `reasonAndSearch()`；
      `prompt()` 按 `aiThinkingOverrides[provider.id]` 注入（显式 modelOptions 优先不变）
- [x] `core/ai-models.ts`：去 custom 分支与缺端点守卫，默认 provider 改 `DEFAULT_AI_PROVIDER`
- [x] `settings.ts`：接口/DEFAULT 收敛（只留 deepseekApiKey / zhipuPlanApiKey / ollamaApiKey +
      `aiThinkingOverrides`）；`migrateRetiredAIKeys` 扩写为五步（退役键 / 服务商回落 / 覆盖表清理 /
      思考档位迁移 / 幂等）
- [x] `core/settings-schema.ts`：`SelectRow.options` 收函数形式 + `refreshKey`；select 行按选项签名重建
- [x] `settings-panel/renderer.ts`：select 分支改「可重建」实现（换表重建 + 监听/ESC 层收尾），
      面板侧与 core 渲染器同口径
- [x] `core/settings-main-schema.ts`：服务商组去 custom 两行；思考行改 per-provider（三函数绑定 +
      函数型 options + refreshKey）
- [x] `core/model-limits.ts`：补 glm-5.3 系（131072 / 1M）；`zhipu-plan` 注册表默认 max_tokens 8192→131072
- [x] 测试：`ai.test.ts`（档位矩阵 ×3 家 + 纯函数自洽）、`ai-cov.test.ts`、`retired-ai-keys-migration.test.ts`
      （8 例）、`settings-schema.test.ts` / `settings-schema-ui.test.ts`（含「思考行随服务商换表」）、
      `settings-panel.test.ts`（面板换表 + 值按家存 + 切回不丢）、`ai-models` / `favorites` /
      `settings-copy-lint` / `settings-input-modes` / `sweep-core-ai` / `review-fix-panel-a` / `model-limits`
- [x] 原型产物重出（`node scripts/build-preview.mjs`）
- [ ] 门禁：`pnpm test` + `tsc --noEmit` + 自审 + diff 审查 → 合并回主仓 → 主仓构建部署

## 明确不做（另行开 issue）

- 思考档位按模型名查表（glm-5.3 与 glm-5.2 档位不同，最准确但维护面大）
- `knowledge/mount-suggest` 改走面板档位（其 low 档是 ADR-0140 实测决策，见 ADR-0179「已知遗留」）
- `desc.noCors` 机制清理（当前三条通道都不需要，保留给下一条通道）
- DeepSeek 的 `reasoning_content` 增量渲染（插件只读 `delta.content`，思考内容本就丢弃）
