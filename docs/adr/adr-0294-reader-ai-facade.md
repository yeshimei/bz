# ADR-0294 · 第二大脑对阅读器的检索与嵌入门面（bz-reader AI 知识库 / 全书画像）

日期：2026-11-07 · 状态：已采纳 · 关联：ADR-0215（知识盒门面）、ADR-0185（相似度阈值与显示同尺）、ADR-0293、bz-reader 侧决策文档 `docs/ai-knowledge-decisions.md`

## 背景

bz-reader（原 fork-weave）要做三件事：把划词存进知识盒、在侧栏问答里接上「第二大脑」、把整本书做成可问答的画像。第一件 ADR-0215 已经开了口子（`plugin.knowledge`）；后两件需要**只读算力**：笔记库检索与文本嵌入。

以前仓库没有跨插件 API 的先例，可选项只有两个：让阅读器自己读 `secondbrain.json` / `secondbrain.vec`（等于复制一份索引实现，模型换代、维度、阈值全部要跟着漂）、或者开一道窄门。选后者。

## 决策

1. **另起门面 `plugin.readerAi`**，不塞进 `plugin.knowledge`：知识盒门面是「录入」，检索与嵌入归属第二大脑域，生命周期也不同（知识盒随命令懒初始化、第二大脑随布局就绪初始化）。混在一起，调用方探测「能不能检索」会拿到一个永远存在的函数，探测失去意义。
2. 接口只有五件事：`isIndexReady()` / `embeddingModel()` / `searchNotes(query, topK)` / `embedDocuments(texts, signal)` / `embedQuery(text, signal)`。
3. **嵌入不依赖索引就绪**：用户没建第二大脑索引，同样可以给整本书算向量（消费方的全书画像只需要嵌入服务）；`searchNotes` 才要求索引，未就绪返回空数组而不是抛错——提示文案归消费方，抛错会把「还没建索引」和「检索坏了」混成一件事。
4. 实现走 `src/core/reader-ai.ts`（叶子：只 `import type`，运行时零依赖，范式同 `secondbrain/readonly.ts`）+ `src/secondbrain/reader-ai-bridge.ts`（接线）：`ensureSecondBrain` 注册、`unloadSecondBrain` 置 null。`main.ts` 挂的是**常驻转发对象**——onload 时域还没初始化，转发让调用方永远拿到稳定的面：探测能力看函数在不在，探测就绪看 `isIndexReady()`。
5. 批量嵌入按 `EMBED_BATCH_SIZE` 切段，批失败逐条回退（同 vector-store 口径）：一条畸形不该让整批白跑，也不能把几百块一次塞给本地 Ollama。
6. **来源链接的协议兼容**：`TermSource` 的 note 态 `path` 允许是协议串（阅读器传 `obsidian://bz-reader?book=…&cfi=…`）。三处口径跟着改：点开走 `openExternalUrl` 而不是查 `TFile`；徽标显示「原 文」而不是「内 部」；落盘写成纯值 + `sourceTitle`，不写成 `[[obsidian://…|书名]]`（那是一枚永远点不开的坏链接）。

## 后果

- 门面成为对外契约：五件事的签名变更按破坏性变更对待，调用方以 `typeof` 守卫降级。
- 不承诺暴露 `VectorStore` 本体、不提供任何写入口（`refresh` / `rebuildAll`），阅读器不能借道重建第二大脑索引。
- 检索口径（阈值、重排、降级）仍由第二大脑单一决定，阅读器只消费结果与 `score`。
- 阅读器的全书画像文件由它自己管（跟库走、单独一个文件），**不进 bz 的向量库**——两边的索引生命周期互不牵连。
