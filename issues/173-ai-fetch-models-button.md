# Ticket 173 — 设置页「获取模型名」按钮（拉取模型列表 + 选择器回填）

> 备忘：`memo.json`「添加一个获取模型名的按钮」。
> 设计经 grill-with-docs 会话收敛（Q1–Q4 用户拍板）：**拉列表 + 弹选择器回填**；覆盖全部 16 家注册表提供商（统一 OpenAI 兼容 /models 逻辑，Ollama 特判 /api/tags）；**写 per-provider 覆盖**（`aiModelOverrides[provider]`，custom 写 `aiCustomModel`）；失败 toast 报错、按钮常亮。

## 背景

ticket 172 的模型名是文本输入框，用户要自己知道服务商有哪些模型可用。本票在「模型名称」行内嵌「获取模型名」按钮：点击拉取当前服务商的模型列表，弹选择器，选中写回 per-provider 覆盖。

## 交互（用户拍板）

1. 按钮点击 → 异步拉取当前服务商模型列表（按钮进入加载态，禁用防连点）。
2. 成功 → 弹选择器弹窗（模型名列表，当前生效值置顶；`info` 行展示来源/条目数；列表为空显示空态「该服务商未返回可用模型」）。
3. 选中 → 写回模型名输入框 + 立即落盘（`setProviderValue('aiModelOverrides', …)`，custom 写 `aiCustomModel`）+ success toast「模型已设为 <name>」；不选直接关闭 = 不改动。
4. 失败/无 key → error toast（文案见表），按钮恢复可用。
5. 拉取全程选择器未打开：失败或用户关掉选择器均不改动任何设置。

## 拉取实现

- 新文件 `src/core/ai-models.ts`：`fetchProviderModels(providerId): Promise<ModelOption[]>`。
  - 解析目标端点：custom 用 `aiCustomEndpoint`，其余用注册表 `desc.endpoint`（`getAIProvider` 同口径）；Ollama 用 `http://localhost:11434`（去掉 `/v1` 后缀）。
  - HTTP 通道：**fetch 优先 + requestUrl 回退**（对齐 `ai.ts` streamChatCompletions 的 noCors 处理：`desc.noCors` 直接走 requestUrl；fetch 失败自动回退 requestUrl）；8s 超时（AbortController，回退路径不中止）；Ollama 30s。
  - 请求：OpenAI 兼容 = GET `{endpoint}/models`，`Authorization: Bearer <key>`（Ollama 无 key）；Ollama = GET `{base}/api/tags`。
  - 解析：`data.data[].id`（兼容 `data.models[].name` 与 Ollama `data.models[].name`），空列表抛「该服务商未返回可用模型」。
  - 报错文案（正文不带 emoji，铁律 7）：
    - 缺 key：`未配置 <label> API Key：插件设置 → AI 配置 → <apiKeyLabel>`
    - 401/403：`<label> 拒绝访问（401）：请检查 API Key 是否有效`
    - 404/不支持：`<label> 不支持模型列表接口（404）`
    - 超时：`<label> 无响应（超过 8s 未应答）`
    - 网络/其他：`获取模型列表失败：<message>`
  - 依赖注入：`fetchFn` / `requestUrlFn` 可注入（测试桩），签名带 `desc` 供测试构造（`fetchProviderModels` 接受 `AIProviderDescriptor` 覆盖注册表查找，custom 测试无需注入 settings）。

## 设置页接入

- `src/core/settings-main-schema.ts`「模型名称」custom 行内嵌按钮（输入框右侧，`extraButton` 模式 → `setting.addButton`）：文案「获取模型名」，点击 `openModelPicker(desc)`（新文件 `src/core/settings-model-picker.ts`）。
- 选择器弹窗局部实现（不并入 settings-modal.ts）：`createOverlay` + escManager（id `bz-model-picker`），当前值 `providerValue('model')` 置顶展示，点击行回填（`providerValue` 语义：custom 走 `aiCustomModel`）。
- 打开弹窗前 `saveSettings()` 已把先前防抖输入落盘（对齐 ticket 172 防抖口径）。

## 测试

- 新 `tests/core/ai-models.test.ts`（`@vitest-environment node`）：端点解析（custom/ollama 去 `/v1`）、`/models` 解析（`data[].id`）、Ollama `/api/tags` 解析、空列表抛错、缺 key 报错、fetch 失败回退 requestUrl、noCors 直走 requestUrl、超时报错文案。
- `tests/core/settings-schema-ui.test.ts`：模型行内按钮渲染（`bz-setting-action-row`）+ 点击拉取（桩 fetch 成功）+ 选择器行点击回填 `aiModelOverrides` + 落盘 + toast；失败路径 toast 报错、设置不动。
- `tests/core/settings-schema.test.ts` 行序/名称断言不变（模型行仍 custom，按钮在行内不新增行）。
- 全量门禁：tsc 0 错；全量测试绿；构建通过（main.js 同步仓库根目录）。

## 冻结确认

- 不新增 notice 类型（error/success/info 均在 ICONS 表）。
- 不新增设置键（复用 `aiModelOverrides` / `aiCustomModel` / `aiCustomEndpoint` / `aiCustomApiKey` / 各 `*ApiKey`）。
- 不新增命令（按钮仅设置页内嵌，无裸命令 id）。
