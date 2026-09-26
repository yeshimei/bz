# 391 · 设置面板 Jev 决策通道配置组

> labels: feature ｜ map: — ｜ status: todo ｜ assignee: — ｜ blocked-by: 389
> 上游：ADR-0173 §6（配置独立成组 + 一个全局总开关）
> 实现于 `wt/bz-jev-settings`

## 背景

Jev 的配置（端点 / 密钥 / 模型 / 超时）不属于**生成通道**，不能挂进 `AI_PROVIDER_REGISTRY`
——那张表的每条描述符都带生成专用语义（`defaultMaxTokens`、思考档位风格映射），
而 Jev 是判定通道、输出不计费、没有 max_tokens 可言。

设置面板的分组是声明式的（ADR-0064）：`core/settings-schema.ts` 定义 `GroupDecl{name, icon?, rows}`，
`settings-panel/renderer.ts` 通用渲染（`renderPanelSchema` → `renderGroup` → `renderRow`）。
**新增一个纯分组只需改一处** ——`core/settings-main-schema.ts` 的 `aiSettingsSchema().groups`。

## 决策

1. **在 `aiSettingsSchema()` 的 `groups` 数组追加一组**，仿 `providerGroupRows()` 的写法加一个
   `jevGroupRows()` 辅助函数保持可读性。**不改 `renderer.ts`、不改 `settings-panel/ui.ts`**
   （schema 懒加载已涵盖，`mainSettingsSchema()` 靠展开自动包含）。
2. **组内五行**：

   | 设置键 | 行型 | 默认 | 说明 |
   |---|---|---|---|
   | `jevEnabled` | toggle | 关 | **全局总开关**，其余行 `visibleWhen` 跟随 |
   | `jevEndpoint` | text | `https://api.typesafe.ai/v1/systemone` | |
   | `jevApiKey` | **secret** | 空 | 见决策 3 |
   | `jevModel` | text | `jev-1.13.0` | 固定版本，不用 `jev-latest`（ADR-0173 §5） |
   | `jevTimeoutMs` | number | `10000` | 毫秒；实测单次 1–2 秒，留 5x 余量 |

3. **密钥行用 `SecretRow` 掩码档位**——`renderer.ts` 已有该行型（约 37/162/405 行），
   但 `providerGroupRows()` 里 AI 提供商的密钥行目前用的是明文 `type:'text'`。本组**刻意选掩码**：
   Jev 密钥是新引入的第三方凭据，没有沿用明文口径的必要。
4. **一个全局总开关，三处接入点不设独立开关**（ADR-0173 §6）。关掉 `jevEnabled` 即三处全部回落 LLM。
5. **文案守规范**（CONTEXT.md「设置项文案规范」）：标题 4–8 字零符号；描述一句话、不写实现细节。

## 测试

- 设置面板里 Jev 组存在且五行齐备，键名与 `data.json` 读写一致；
- `jevEnabled` 关闭时其余四行的显隐（`visibleWhen`）行为正确；
- 密钥值不落日志、不进原型产物（原型 fake 层注入默认值）；
- `smoke.test.ts` 同步：设置面板可正常打开、AI 分区组数变化不破坏既有断言。

## 遗留

- 是否给 Jev 也做「测试连接」按钮（像部分 provider 的连通性检查）——**本票不做**，需要时另开。
