# ADR-0021 小橘记忆重构——单层记忆流（GA 三因子检索 + 反思 + LLM 打分 + 向量豁免单 json）

状态：已采纳（grilling 定稿）
日期：2026-08

## 背景

smartcat 域（小橘）原记忆系统为多层「文件柜」式：shortTerm(100)/longTerm(500)/permanent/index 四层，
重要性 0-1 规则打分（词数/情绪关键词/手动标记），检索为关键词×0.4+主题×0.3+线性时间×0.2+使用×0.05 线性求和，
importance≥0.7 由 24h 调度固化进长期，「反思」层完全缺失。

用户拍板（grilling 逐轮）：按照 Generative Agents（Park et al., UIST 2023）论文与社区成熟算法严格重构——
单层记忆流、检索时三因子分级、写入时 LLM 打分、反思归纳洞察；且**明确不做任何数据迁移与兼容
（smartcat 尚无真实数据产生）**，旧迁移路径整体删除。

## 决策

1. **单层记忆流（Memory Stream）**：`smartcat.json` 的 `memory` 段整体替换为
   `{ version, lastUpdated, stream: MemoryStreamEntry[], reflection: { lastReflectAt, count } }`；
   `MemoryStreamEntry = { id, created, lastAccessed, description, importance(0-1), type: 'observation'|'insight', evidenceIds?, source? }`。
   删除四层结构、timeIndex/topicIndex/emotionIndex/usageStats 四索引、以及整条迁移路径
   （localStorage 3 key + CONFIG/SMART CAT 3 文件 + CONFIG/SMART_CAT/memories 4 层），旧文件不再读取。
2. **检索：GA 三因子加权**：`score = α1·recency + α2·importance + α3·relevance`，默认 α 全 1.0（对齐论文）；
   recency = `decay^距上次访问小时数`（decay 默认 0.995，指数衰减）；importance 为写入时打分的 0-1 分；
   relevance 语义模式为 bge-m3 余弦，词法兜底为关键词/主题命中。检索即更新 lastAccessed（自增强），取 top N（保留 10）。
3. **写入时 LLM 打分（importance）**：新记忆写入时经结构化 JSON 通道让 LLM 评 0-10 → 归一 0-1；
   AI 未配置/调用失败时退回规则打分（0.5+词数/情绪强度/手动标记，保留原语义），保证降级可运行。
4. **反思（Reflection）**：触发 = 距上次 24h **或** 新增记忆 ≥ 20 条（先到先触发）；evidence = 最近 100 条中
   importance 前 50；一次 LLM 生成 3 条洞察（带证据编号）写回流（type=insight + evidenceIds）；
   可递归一级形成洞察树（观察→洞察→高层洞察，树深默认 2，可关）。AI 未配置时反思跳过。
5. **记忆流上限 500 条**：超出淘汰 importance×使用度最低者（复用原 removeLeastImportance 评分思路）。
   **【修订 085，ADR-0036 追加拍板】上限取消**：检索走向量库 top-N 相关召回不把全量记忆发在线 AI，历史记忆全量保留不淘汰。
6. **向量存储豁免「单 json」**：bge-m3 向量存独立文件 `smartcat-memory-vectors.vec`
   （dim uint32 LE + float32 平铺，行序对齐 stream；flash 域同款格式），`smartcat.json` 不内联向量，
   保持小体积。Ollama 不可用（`checkRemoteOllama` 失败）→ 词法 relevance，插件永远可用。
7. **结构化 JSON 通道**：core/ai 的 `AIService.json()` 支持 response_format，但 smartcat 自建 `callChat`
   为固定 body（无该字段）→ api.ts 新增 `callChatJson`（body 加 `response_format:{type:'json_object'}`）供
   importance 打分与反思使用。
8. **写入面最小化**：仅聊天对话后写入 observation（source=chat）；打开笔记/书评/互动/自动陪伴暂不接入。
9. **范围**：只做算法/数据层；不接 UI、不联动 personalityGrowth/emotionalMemory（下一轮心情情感讨论再做）。

## 权衡

- **单层 vs 四层**：论文是检索时分级；四层是写时决定去向。单层+检索分级保留全部信息、避免固化误判，
  但每次检索全扫描（500 条 × 3 因子，本地毫秒级，可接受）；四层写法有信息丢失且「固化阈值」武断。
- **LLM 打分 vs 规则**：论文是 LLM 打分；规则省成本但「奶茶 vs 考六级」区分不出。取 LLM 优先 + 规则兜底。
- **向量存 .vec vs 内联 json**：bge-m3 1024 维 ≈4KB/条，500 条约 2MB；内联 json 每次全量 stringify
  成本高且单 json 臃肿。独立 .vec（flash 同款）豁免单 json 拍板（用户明确同意）。
- **语义 vs 词法**：bge-m3 召回好（「压力大」→「焦虑」）；纯词法零依赖。取探测优先 + 词法兜底，
  Ollama 缺失插件不残废。
- **删除迁移**：无真实数据时保留迁移是死代码 + 误导（旧结构永远读不进来）；用户拍板直接删。
  旧文件留在用户 vault 不删（防回滚），只是不再读取。

## 已知限制

- 语义检索依赖本机 Ollama（localhost:11434 + bge-m3）；未配置时词法召回质量下降。
- importance 打分与反思依赖 AI provider（bz 内置）；未配置时反思不可用（记忆基本功能正常）。
- .vec 为扁平文件：记忆增删后重写全量文件（≤2MB，可接受）；无分块增量。
- 500 条上限为软上限：反思压缩是次要手段，淘汰是最主要手段（重要性×使用度评分）。
- 二次记忆树/反思频率参数为默认值，后续可按观测成本微调（不改结构）。