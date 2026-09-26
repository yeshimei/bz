# 457 AI 输出上限护栏：按 provider × 模型取真上限

## 背景

用户报「LLM 的智谱 Plan 测试失败」。复现（真实 key 打 coding 端点）定位到唯一根因：

| max_tokens | 结果 |
|---|---|
| 200000（面板当时值） | `400 / 1210 max_tokens参数非法：限制数值范围[1,131072]` |
| 131072（注册表默认） | `200`，回复 `OK` |
| 4096 | `200`，回复 `OK` |

链路本身（密钥 / coding 端点 / glm-5.3-flash / reasoning_effort / 流式 + requestUrl 兜底）全通。
问题只在面板「最大输出 token」那格填了 200000，超过 glm-5.3-flash 的 131072。

失败面比「测试红✕」大得多：`prompt()` 每次请求都带这个 max_tokens，`aiProvider=zhipu-plan` 时
**全域 AI 调用**（日记 / 小橘 / 知识库 / 剪藏摘要…）都是同一个 400。

面板的上界自身也是假的：2026-09-23 补的 `max: 200000` 是全局硬编码常量，对 DeepSeek（393216）
偏小、对智谱（131072）越界——上限是模型属性，model-limits 里早有数据，只是没用上。

## 改动

- `core/ai.ts`：新增导出 `maxOutputCapOf(providerId?, modelName?)` —— 两级取基准：① model-limits
  按当前生效模型命中；② 注册表新字段 `maxOutputCap`（deepseek 393216 / zhipu-plan 131072 显式声明，
  ollama 有意留空）；③ 皆无 → `undefined` = **不设围栏**（本地无官方档可依）。
  `getAIProvider` 内就地封顶：未填覆盖走「基准优先、无基准回落兜底档」，填了覆盖走
  `min(覆盖值, 基准)`（0 / 负数 / 非数按「未填」）。
- `core/settings-schema.ts`：`NumberRow.max` 扩为 `number | ((snapshot) => number | undefined)`；
  新增导出 `resolveNumberBound` 作为唯一求值口（非有限数 / undefined 不钳制）；commit 与 onChange
  两处钳制、inputEl.max 属性、函数型上界挂 `customRefreshes` 刷新链。
- `settings-panel/renderer.ts`：number 分支同口径接入（`bound()` 求值、函数型上界注册刷新重设 max）。
- `core/settings-main-schema.ts`：新增 `providerMaxOutputCap()`（与 maxOutputCapOf 同源）；
  「最大输出 token」行 `max: () => providerMaxOutputCap()`；`providerValue('maxTokens')` 改按
  生效模型名查表（消掉「显示 393216 / 实发 16384」的分叉）；退役的 `resolveModelLimits` 直接导入移除。

## 验收

- `tests/core/ai-max-tokens-cap.test.ts`（新，12 条）：上限取值按 provider、按模型覆盖、未收录 →
  undefined；封顶（智谱 200000→131072、DeepSeek 200000 不动、500000→393216、
  deepseek+gpt-4o-mini+200000→16384）；Ollama 32000 不封顶（既有口径）；0 / 负数 / NaN 按未填；
  端到端断言真正发出的 `max_tokens` 是封顶后的值。
- `tests/core/settings-schema-ui.test.ts`（+3 条）：`resolveNumberBound` 求值语义；
  主设置面板「最大输出 token」上界随服务商切换 393216 ↔ 131072；随模型覆盖 → 16384。
- 门禁：`pnpm exec vitest run`（全量）+ `tsc --noEmit` 全绿。

## 遗留

- 存量超限值不自动迁移（本次已在盘上手工修正那一处）；解析层封顶保证运行期正确。
- settings-panel 渲染器的函数型上界只覆盖了 max（min 仍为静态数值）；日后若 min 也要动态，
  照 `resolveNumberBound` 同一入口扩即可。
- 测试按钮「失败静默」（issue 434 拍板）带来的排查盲区仍在：本次靠代码侧复现才拿到 1210 报文。
