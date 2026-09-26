# ADR-0182：向量化模型配置归 AI 面板（LLM / Embedding / JEV 三组）+ 换模型维度守卫

- 日期：2026-09-24
- 状态：已采纳（用户拍板四问，见 issue 422）
- 相关：issue 422（本票）/ ADR-0179（AI 提供商三通道收口）/ ADR-0002（依赖方向）/ ADR-0141（三盒恒含）/ ADR-0009（storagePath 单源）/ ticket 173（「获取模型名」范式）/ ticket 107（引导态与空库语义）

## 背景

第二大脑的「Embedding 模型」设置行一直挂在域设置弹窗的「服务」组里——服务地址（Ollama URL / 移动端远程地址 / 本机局域网 IP）与模型选择混排。用户视角里「用哪个向量化模型」是 AI 侧配置，与 LLM / JEV 是同一类事，故要求：**模型配置迁入 AI 面板**，并把 AI 面板按「LLM / Embedding / JEV」三种模型配置**分组化**（原「服务商」「模型配置」两组语义重叠，合成一组）。

同时暴露两个实存问题：

1. **模型发现缺失**：模型名只能手输，用户无「本机已装哪些向量化模型」的通道；新模型（Qwen3-Embedding）要靠自己记名拼全（含 tag）。
2. **换模型会写坏向量库**：`secondbrain.vec` 是「uint32LE dim 头 + float32 平铺」，行偏移由 meta 键序 × chunks 数决定。不同模型维度不同（bge-m3 1024 维 / qwen3-embedding:8b 4096 维），换模型后走增量 refresh 会把新维度向量按旧维度行偏移写入 → 后续行全部错位（**静默写坏**，不是报错）；查询侧也会拿新模型的查询向量在旧维度空间里算距离，出垃圾结果。

## 决策

1. **AI 面板四组：LLM / Embedding / JEV / 数据源凭据**。原「服务商」组撤销——AI 服务商下拉与各家密钥行并入「LLM」组首部（保留「AI 服务商」行的行名，各方密钥紧随其后），原「模型配置」组更名「LLM」；原「Jev 决策通道」更名「JEV」；「数据源凭据」不动。分组名不参与文案 lint（行名/行 desc 仍受约束），故更名无文案负担。

   **键位与值零迁移**：迁移只发生在渲染结构层，`secondBrainEmbeddingModel` 等键名、默认值、读写路径一律不变。

2. **只搬「Embedding 模型」一行**，服务地址三行（Ollama 本地 URL / 移动端远程地址 / 本机局域网 IP）留在第二大脑域。「哪个服务」是域自己的部署问题（含移动端局域网拓扑），「哪个模型」是 AI 侧选择——按此线切割，避免整组搬迁后服务地址行的 desc（本机 IP 探测、远程 URL 填入）与 AI 面板语境冲突。

3. **换模型 = 清库 + 全量重建（不可静默增量）**。守卫落在三处：

   | 入口 | 行为 |
   |---|---|
   | `load()` | 库内记录模型 ≠ 当前配置 → **不装载**（清空内存 meta/vectors/dim）、置 `modelChangedOnLoad` |
   | `needsModelRebuild()` | 面板 `render()` 据此自动走全量重建 + 通知「Embedding 模型已更换，正在重建向量索引」 |
   | `doRefresh()` | 非面板入口（后台防抖刷新 / 启动静默补齐）兜底清库，本轮转全量重嵌 |

   `load()` 期已清库仍置标志的理由：否则会落进「空库引导态」等用户点按钮（首次向量化的产品语义），而这次不是首次、是换模型——用户刚在设置里换的模型，应自动生效。

4. **meta 记 `_model`（有向量即记）**：`saveStore()` 在 `dim > 0` 时写入当前配置模型；`clearStore()` 一并抹掉（空库无产出模型可言，判定只认「有向量」的库）。**旧库缺字段按历史默认 `bge-m3` 推断**——默认值自始未变，故推断安全：真换过模型的老库会判不一致，多跑一次重建；绝不会因推断错误而混存。

5. **行内「获取模型」选择器**（照 ticket 173 的 LLM 范式）：`core/ai-models.ts` 出 `fetchEmbeddingModels()` —— Ollama 原生 `GET {服务地址}/api/tags`（无鉴权），按 `capabilities` 含 `embedding` 过滤（聊天模型不进列表）；**旧版 Ollama 不返回 `capabilities`（全为空）→ 不过滤、全量返回**由用户自辨（宁可多列，不可误滤掉用户唯一可用的模型）。保留手输（自建 / 远程模型不在本机列表里）。

6. **Embedding 列表拉取住在 `core/ai-models.ts`**（而非 secondbrain 域）：它是设置面板的行内按钮数据源，与 `fetchProviderModels` 同类；服务地址口径**镜像** `secondbrain/config.ts`（移动端优先「移动端远程地址」，两键留空回落 `http://localhost:11434`），域侧含 UA 兜底的 `IS_MOBILE` 不改（ADR-0002：core 不得 import 域模块）。两处口径如有一日分叉，以域侧为准修 core。

7. **Qwen3-Embedding 走官方查询指令前缀**：`getEmbedding` 查询侧按模型名分派前缀——`qwen3[-_]?embedding`（不区分大小写，覆盖 `0.6b/4b/8b` 全族）用 `Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: `，其余模型保持原 `Represent this sentence for searching relevant passages: `。语料侧（非查询）两族一律不加前缀。**换了模型就是换了整个向量空间**，前缀口径必须与模型族匹配，否则检索质量显著下降（Qwen3 官方明确要求 query 侧带 instruction）。

## 被否的备选

- **整组搬迁（连服务地址三行一起进 AI 面板）**：服务地址行的信息本体是域内拓扑（本机局域网 IP 探测、移动端远程地址填入），搬进 AI 面板后与 LLM 的服务地址语境（云 API endpoint）混淆；用户拍板只搬模型行。
- **换模型走增量重嵌（快）**：见背景 2，行偏移维度不同必然错位，属静默数据损坏——不可接受。全量重建是唯一正确路径，代价（Qwen3-8B CPU 首嵌较慢）由通知文案与进度视图承接。
- **换模型先弹确认框（用户选择何时重建）**：用户拍板「自动重建 + 提示」。理由：用户换模型即表达「我要用它」，让他再点一次是多余摩擦；重建期间进度视图可见、失败可重试。
- **探测模型维度后再决定是否重建**（拉一条探针嵌入比对 `_dim`）：多一次网络往返，且仍需重建，判定信息不比 `_model` 多；`_model` 记录是纯本地读。
- **`fetchEmbeddingModels` 放 secondbrain 域**：设置面板行要 import 域模块，违背 ADR-0002 依赖方向（core 侧设置 schema 不得依赖域）；且它本质是「模型列表拉取」家族第四员，与 `fetchProviderModels` 同住最自然。
- **`capabilities` 缺失时按模型名启发式猜 embedding（如名字含 `embed`）**：启发式会误滤自建模型名（`my-vec-model`），比「不过滤」更危险。

## 后果

- **用户可见**：AI 面板四组（LLM / Embedding / JEV / 数据源凭据），Embedding 组一行一按钮；换模型后打开第二大脑面板自动重建并告知原因。
- **配置面收敛**：模型选择的发现通道（已装列表 + 维度/参数量说明）与设置同屏，Qwen3-Embedding 这类新模型开箱可选。
- **重构面**：`core/settings-main-schema.ts` 的 `aiSettingsSchema()` 组结构变化被两渲染器（设置面板域 + 原生设置页）同源消费，测试结构断言随批更新；`tests/secondbrain/*` 的假向量库补 `needsModelRebuild`。
- **数据面**：`secondbrain.json` meta 段新增 `_model`（可选字段，旧库读入缺省即推断，无需版本号升级——meta v9 不变）。
- **一次性成本**：升级后首次打开第二大脑，若库内模型与当前配置一致则不重建；用户若曾用非默认模型建库且未记名（旧库），会多跑一次全量重建（安全侧代价）。
