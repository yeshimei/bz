# 425 · 向量检索改为精确全扫余弦（VP-Tree 退役 + 分数去锐化 + 坏向量双重防线）

- 状态：已实现（2026-09-24）
- 用户原话①：「为什么几乎所有向量化查询中都有这个，都是 78%，向量查询的写法是不是有误？」
  （截图 = 参考面板结果列表，第一张卡恒为「卢曼卡片盒中篇编码让卡片生长」78% + 进度条）
- 用户原话②：「去查询社区，然后使用正确的算法查询，我觉得写的这个算法是有问题的」
- 用户原话③：「是不是什么查询算法都可以不用写，直接去查询不可以吗？不需要做任何的干涉」
- 用户拍板（AskUserQuestion）：修复范围 = **「全套 + 去分数锐化」**；数据修复 = **面板「重新索引」全量重建**（用户自己点，agent 不碰真实数据文件）
- 关联：ADR-0185（本票决策固化）/ ticket 103（检索链路原实现，VP-Tree 出处）/ ticket 46（检索级超时降级）/ issue 330 + ADR-0146（`linkAgentMinScore` 阈值出处，本票换算）/ issue 360（每周撞车阈值出处，本票换算）/ issue 422 + ADR-0182（Embedding 模型与查询指令前缀）
- 号位说明：424 之后取 425；ADR 取 0185

## 现象与根因（探针实测，非推测）

**现象**：几乎每条查询的结果列表里都混着同一张卡，分数恒定 78%（截图中的「卢曼卡片盒中篇编码让卡片生长」）。

**根因链**（三段，缺一不可）：

1. `secondbrain.vec` 里有 **5 条全零行**（模长 0）：行号 707 / 1470 / 1489 / 1977 / 2040，分布在 4 篇剪藏里，全部出自 `2026-08-25T08:00:26` 同一次嵌入（段文本正常，今日重嵌这 5 段都返回正常的单位向量 → 当时是**瞬时写入故障**，而 `mergeWrite` 对本轮未变文件按源偏移拷贝旧段，坏行就此长期留存、增量刷新永远修不掉）。
2. VP-Tree 按**距离**选候选，而距离→余弦的换算是 `cos = max(0, 1 − d²/2)`——**这只对单位向量成立**。零向量到任意单位向量的距离恒为 1.0，于是公式反推出 `cos = 0.5` 的**假高分**：任何查询、任何查询词，它都排在同一位置。
3. 收尾再做 `score = score^0.35` 锐化：`0.5^0.35 = 0.7846` → **78%**（锐化把「假 50%」抬进前排，用户才肉眼可见）。

**实测证据**（`.scratch/sb-probe/`，把生产 VP-Tree 实现用 esbuild 原样打包后喂 40 条真实查询嵌入、并对同一份向量库做暴力全扫对照）：

| 指标 | VP-Tree（旧） | 暴力全扫 |
|---|---|---|
| 坏行进入候选窗口（topK×3=60） | 37/40 | 0/40 |
| 坏行出现在最终 top20 | **33/40** | 0/40 |
| 候选窗口内重复节点（VP 被复制进自己的左子树） | ~31.4/60 | 0 |
| 单查询耗时（3192 chunk × 4096 维） | 95–122 ms | **27.5 ms** |

即：**近似召回 + 换算公式的适用前提被破坏** 共同造成幽灵卡；且 VP-Tree 在这份库规模上比全扫还慢约 3.5 倍。

**社区口径核对**（Qwen3-Embedding 官方 README / 检索惯例）：查询侧加 `Instruct: …\nQuery: …`、文档侧不加前缀（bz 已按 issue 422 落地，本票不动）；检索用**余弦相似度**，标准做法里**没有**对分数做幂次变换这一步（锐化是 bz 自创的显示压缩，代价是阈值语义被拧成非线性尺）。

## 决策（详见 ADR-0185）

1. **检索改为精确全扫余弦**：查询嵌入归一化 → 与库内归一化行逐行点积 → 去重 → topK。VP-Tree 与 `vptree.ts` 整体退役（`euclideanSq` / `vptree_*` 无其他消费点）。归一化矩阵按「来源数组身份 + 维度 + 行数」缓存，内容变更（重建 / 增量写回 / 清库）必换新缓冲 → 缓存自然失效。
2. **坏向量双重防线**：入库侧 `getEmbedding` 拒收零向量/非有限分量，`getEmbeddingsBatch` 另查「条数是否等于输入」「批内是否含零向量或维度不齐」（任一不符 → 整批失败交逐条回退逐条把关，坏段不登记、下轮按 mtime 重试）；检索侧**整行跳过**无效行（存量库已带病，不抛错、不阻塞，`console.warn` 记数）。
3. **查询向量维度不符即抛错**（如换模型未重建 / 远程端模型不同）：点积无意义——三处调用方（`search` / `searchMobile` / 建链管线）都有 catch，抛错会走既有降级文本路径并给降级提示；返回空数组则会被当成「没有相关结果」，用户拿不到降级信号也拿不到文本结果。
4. **分数去锐化，分数即原始余弦 [0,1]**（负数归零，显示层不出现负百分比），与参考面板百分比同尺。两处阈值同语义换算：
   - `linkAgentMinScore` 默认 0.65 → **0.30**（0.65^2.857），并做一次性设置迁移（`migrateLinkMinScoreScale`，`old^(1/0.35)` 取两位小数、下限 0.01，留内部标记键 `linkAgentMinScoreScale: 'cos'` 作幂等凭据；**`0 = 不过滤` 原样保留**——换算会被下限抬成 0.01，等于替用户把过滤打开）；**标记须同时进 `DEFAULT_SETTINGS`**（见「review 复审」）;
   - `WEEKLY_COLLISION_SCORE` 0.85 → **0.63**（0.85^2.857），档位关系（撞车严于建链）不倒挂；
   - **存量周摘要**的撞车分同批收口：`WeeklyDigest` 增口径标记 `scale: 'cos'`，无标记的旧摘要由显示层（`collisionPctOf`）换算后再渲染，且**只换算 `mode === 'vector'` 的条目**（TF-IDF 通道分数是覆盖率，本就有绝对标尺）。换算公式的单一真理源是 `vector-math.ts::unsharpenScore`，设置迁移与摘要显示共用。
5. **数据修复不由代码代劳**：坏行由用户点面板「重新索引」全量重建清除（本票只保证「重建后不会再产生坏行」且「未重建期间坏行不参与检索」）。

## 落地

- [x] `src/secondbrain/vector-math.ts`（新增）：`normalizeVec`（退化输入兜底零向量）+ `isValidVector`（非空、全有限、模 > 0）；`Vec` 类型随迁。
- [x] `src/secondbrain/vptree.ts`：**删除**（`euclideanSq` / `vptree_build` / `vptree_search` / `VPNode` 全链退役）。
- [x] `src/secondbrain/vector-store.ts`：`buildVPIndex` → `buildNormCache`（扁平归一化矩阵 + 有效行掩码 + 来源身份校验）；`vectorSearch` 重写为全扫点积（行序不变量 = meta.notes 键序 × chunks，边扫边定位所属笔记）；删除 `1 − d²/2` 换算与 `score^0.35`；`clearStore` 清缓存。
- [x] `src/secondbrain/ollama.ts`：`getEmbedding` / `getEmbeddingsBatch` 加坏向量校验（见决策 2）。
- [x] `src/secondbrain/link-agent/pipeline.ts`：`minScore` 默认 0.65 → 0.3（注释换算）。
- [x] `src/settings.ts`：`linkAgentMinScore` 默认 0.3 + `migrateLinkMinScoreScale` + 内部标记键类型与缺省值（标记进 `DEFAULT_SETTINGS`，见 review 复审）；`src/main.ts` onload 接入迁移与落盘调度。
- [x] `src/secondbrain/weekly.ts`：`WEEKLY_COLLISION_SCORE` 0.85 → 0.63（头注换算）；新摘要落 `scale: 'cos'` 口径标记。
- [x] `src/secondbrain/store-file.ts`：`WeeklyDigest.scale?: 'cos'`（存量摘要无此标记 → 显示侧按旧尺换算）。
- [x] `src/secondbrain/weekly-ui.ts`：`collisionPctOf`（旧摘要向量通道分数换算后再渲染；TF-IDF 不换算）。
- [x] `src/secondbrain/vector-store.ts`：`buildNormCache` 行数不一致 warn；`doRefresh` 读取失败早退分支补落盘（行序不变量）；`normCache.skipped` 死字段清除。
- [x] `prototypes/*/prototype-behavior.js`：6 域重出（gameshelf / home / memo / review / secondbrain / settings-panel，源指纹守卫）。

## 测试

- `tests/secondbrain/pure.test.ts`：`vptree` 块 → `vector-math` 块（归一化不改入参 / 退化兜底；`isValidVector` 空、零向量、NaN、Infinity、非数组全拒）；`unsharpenScore` 换算表（0.65→0.29 / 0.85→0.63 / 0.91→0.76 / 0.1→下限 0.01）。
- `tests/secondbrain/vector-store.test.ts`：同向 1 / 正交 0 口径改写；归一化缓存复用与引用失效（日志锚）；**零向量整行跳过回归**（坏行不占位、旧的恒定 78% 不再出现、warn 记数）；NaN 行出局；查询维度不符 → **抛错**且 `search` 承接后降级文本（onDegraded 收到原因）；**读取失败早退分支落盘对齐行序**（行数不变量，回退实现即红）。
- `tests/secondbrain/ollama-cov.test.ts`：零向量/NaN/Infinity 单条拒收；批量条数不符、批内零向量、批内维度不齐 → 整批抛错。
- `tests/core/link-min-score-scale-migration.test.ts`（新增）：0.65→0.29、自定义值换算表（0.9→0.74 / 0.5→0.14 / 0.3→0.03 / 0.1→下限 0.01）、标记幂等、未落盘键不迁移、**0 原样保留**、**落盘过的默认设置再启动不改值**（标记随缺省值落盘，改前红）、脏值回落默认、畸形入参。
- `tests/secondbrain/weekly-ui.test.ts`：存量摘要（无 `scale`）向量通道 0.91 → 显示 76%，TF-IDF 0.85 原样显示。
- `tests/secondbrain/link-agent-ui.test.ts`：下限用例改新尺（0.3 边界保留 / 0.299 剔除）。
- `tests/secondbrain/weekly.test.ts`：撞车阈值用例改 0.63（0.6299 不算 / 0.5 不覆盖结论）。
- 门禁：`pnpm test`（7261 例，含 28 条原型新鲜度）+ `tsc --noEmit` 全绿。

## review 复审（2026-09-24，修复后）

子代理复审全批（实现 + 收口，`git diff` 逐条核验 + 读当前版本判断可达性），出一条高优缺陷，已修并落回归：

**换算标记必须随缺省值落盘**（`DEFAULT_SETTINGS.linkAgentMinScoreScale: 'cos'`）。原实现只在「迁移真跑了」时落标记，但插件自身的保存路径（桌面端 `ensureRemoteOllamaUrl` 自动跟随本机 IP / 设置页任意一键 / 域设置弹窗）写的是整份 `Object.assign({}, DEFAULT_SETTINGS, loaded)`：**全新安装或从未落盘过该键的用户**首次保存后，data.json 里就是 `linkAgentMinScore: 0.3` 且无标记 → 第二次启动 `migrateLinkMinScoreScale` 把它当旧锐化尺值换算成 **0.03**，候选下限静默失效（全部候选直送 AI 裁判），与文档化的 0.30 悄悄矛盾。标记进缺省值安全——迁移读的是合并缺省值**之前**的 raw `loaded`，存量旧库（0.65）仍照常换算。用户本机 data.json 复核：已是 `0.29` + 标记在册，未被该缺陷波及。

其余各问（行序不变量、NormCache 身份失效、坏向量掩码、迁移 `0`/脏值、周摘要口径与 `0.63` 档位、dedup/topK/维度抛错）经逐条验证**未发现实质问题**。
