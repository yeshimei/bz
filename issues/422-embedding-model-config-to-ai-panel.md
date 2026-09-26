# 422 · 向量化模型配置迁入 AI 面板（LLM / Embedding / JEV 三组化）+ Qwen3-Embedding 支持

- 状态：已实现（2026-09-24）
- 用户原话：「把第二大脑中的向量化模型的配置放到ai面板中，embedding 新增对 Qwen3 8b的支持（先安装这个模型）」
  「选择的ai面板分为 LLM Embedding 和 JEV 三种模型配置，合并成组」
- 关联：ADR-0182（本票决策固化）/ ADR-0179（AI 提供商三通道收口）/ ADR-0002（依赖方向）/ ADR-0141（三盒恒含）/ ticket 173（「获取模型名」范式来源）
- 号位说明：421 之后取 422；ADR 取 0182

## 拍板（2026-09-24 四问）

1. **面板分组 = LLM / Embedding / JEV / 数据源凭据**：原「服务商」组撤销，AI 服务商下拉与各家密钥行并入新「LLM」组首部；原「模型配置」更名「LLM」；原「Jev 决策通道」更名「JEV」；「数据源凭据」保持不动。
2. **搬迁范围 = 只搬 Embedding 模型一行**：Ollama 本地 URL / 移动端远程地址 / 本机局域网 IP 三行留在第二大脑「服务」组（它们是服务地址，不是模型选择）。
3. **模型选择 = 行内「获取模型」选择器**（照 LLM「获取模型名」范式）：拉 Ollama 已装模型、按 embedding 能力过滤，含 Qwen3-Embedding；保留手输。
4. **维度守卫 = 自动全量重建 + 提示**：换模型后自动触发全量重建并通知用户（不做静默增量，见 ADR-0182 决策 3 的危害分析）。

## 现状（改动前）

- 「Embedding 模型」行在第二大脑域设置 schema（「服务」组），与向量化的语义归属错位（模型选择属 AI 面板，服务地址属本域）。
- 模型名只有手输；无「已装哪些向量化模型」的发现通道，Qwen3-Embedding 这类新模型要靠用户自己记名。
- 换模型无任何守卫：meta 只记 `_dim`，增量重嵌会把新维度向量按旧维度行偏移写进 .vec → 写坏向量库、检索出垃圾。

## 方案

**AI 面板四组重排**（`core/settings-main-schema.ts`，两渲染器同源：设置面板域 + 原生设置页）

| 组 | 图标 | 行 |
|---|---|---|
| LLM | cpu | AI 服务商下拉 + 各家密钥（原「服务商」组全量）+ 模型配置（原「模型配置」组） |
| Embedding | binary | **Embedding 模型**（自第二大脑迁入；行内「获取模型」） |
| JEV | route | 原「Jev 决策通道」行全量 |
| 数据源凭据 | key-round | 不动 |

**Qwen3-Embedding 支持**（`secondbrain/ollama.ts`）

- 查询侧前缀按模型分派：`qwen3[-_]?embedding`（不区分大小写）→ 官方指令 `Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: `；其余模型保持原 `Represent this sentence for searching relevant passages: `。
- 语料侧（非查询）一律不加前缀（两族模型口径一致）。

**维度守卫**（`secondbrain/vector-store.ts`）

- meta 增 `_model`（有向量即记：`dim > 0` 时写入当前配置模型）；旧库缺字段按历史默认 `bge-m3` 推断。
- `load()`：库内模型 ≠ 当前配置 → 不装载、清库、置 `modelChangedOnLoad`（区别于「空库引导」，见 ADR-0182 决策 3）。
- `needsModelRebuild()`：面板据此自动全量重建；运行中改设置（内存库仍按旧模型）也判得出来。
- `doRefresh()`：非面板入口（后台防抖刷新）兜底清库，本轮转全量重嵌。
- 主面板 `render()` 分派 `runModelRebuild()`：先通知「Embedding 模型已更换，正在重建向量索引」再走重建全流程。

## 落地

- [x] `core/ai-models.ts`：抽 `fetchModelsJson`（fetch→requestUrl 回退 + 超时/状态码文案单源）、`parseOllamaTags` / `pickEmbeddingModels` / `embeddingServiceUrl` / `fetchEmbeddingModels`（新增）。
- [x] `core/settings-main-schema.ts`：`llmGroupRows()` 合组；`embeddingModelRow()` 新行（绑定键 `secondBrainEmbeddingModel` 不变，值零迁移）。
- [x] `secondbrain/panel.ts`：第二大脑设置弹窗删「Embedding 模型」行（服务地址三行保留）。
- [x] `secondbrain/ollama.ts` + `config.ts`：`queryInstruction(model)` + `DEFAULT_EMBEDDING_MODEL` 单一常量。
- [x] `smartcat/ui.ts`：小橘记忆库模型行 desc 改指「AI 面板的 Embedding 模型」。
- [x] 模型安装：`ollama pull qwen3-embedding:8b`（4096 维，CPU 推理较慢，首次重建耗时需预期）。

## 测试

- `tests/core/ai-models.test.ts`：parseOllamaTags（畸形项跳过/旧版服务无 capabilities）、pickEmbeddingModels（能力过滤 / 不过滤两路）、embeddingServiceUrl（桌面忽略远程 / 移动优先远程 / 空回落 localhost）、fetchEmbeddingModels（无鉴权 GET、404 文案、requestUrl 回退、空列表报错）。
- `tests/secondbrain/ollama-cov.test.ts`：queryInstruction（族内变体命中 / 其它模型原前缀）+ Qwen3-8B 设置经 `getEmbedding` 全链生效。
- `tests/secondbrain/embedding-model-switch.test.ts`（新）：recordedModelOf 推断、load 两路（一致装载 / 不一致清库）、needsModelRebuild 三分支、refresh 兜底换模型按新维度落盘、重建后 `_model` 更新。
- 既有结构断言同步：`tests/core/settings-schema*.test.ts`、`tests/settings-panel.test.ts`、`tests/core/settings-input-modes.test.ts`、`tests/secondbrain/*` 假库加 `needsModelRebuild`。
