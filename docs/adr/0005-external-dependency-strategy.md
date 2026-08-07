# 0005 — 外部依赖策略：AI 配置入插件设置；Dataview 渲染保留；Ollama 走 HTTP

memo-suite 涉及三类外部依赖，分别定策：

## 1. AI 配置（DeepSeek / OpenCode Go）

QuickAdd 时代 key 存在 Q3 宏设置（`aiProvider`、`opencodeGoApiKey`）。插件化后迁移至**插件设置页**（data.json），AIService 从 core 读取；保留 override 机制（endpoint/apiKey/model 自由指定）。localStorage 缓存（如站点图标 dataUrl）保留现状即可，不迁移。

## 2. Dataview 依赖（聚合讯）

聚合讯把 ` ```dataviewjs await dv.view('CONFIG/SCRIPTS/DataView/摘要') ``` ` 代码块写进笔记，由 **Dataview 插件**渲染。用户决策「按源码的方式写」——**保留此方案**：插件继续生成 dataviewjs 代码块，不自行渲染。

## 3. Ollama / 本地服务（闪念）

闪念通过 `window.fetch` 调 Ollama HTTP API（`/api/embeddings`、`/api/embed`、`/api/chat`），OLLAMA_URL/EMBEDDING_MODEL/CHAT_MODEL 可配置（含远程地址）。插件化后原样保留，URL/模型进插件设置。

## Considered Options

- 聚合讯改为插件自渲染摘要 → 偏离原实现，且笔记里已有的 dataviewjs 块需兼容；用户否决
- AI key 存 localStorage → 与 QuickAdd 一致但跨设备不可同步；插件设置（data.json）随 vault 同步更稳

## Consequences

- 用户需在插件设置中重新填写 AI key（一次性成本）
- 聚合讯功能依赖 Dataview 插件存在；文档与设置页需注明
- 闪念依赖 Ollama 服务运行；无服务时优雅降级（显示连接失败提示，不崩溃）
