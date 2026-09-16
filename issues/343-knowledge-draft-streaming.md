# Issue 343 — 知识盒录入草稿流式成形（点下即开界面 + 正文逐字长出）

**状态：已实现，待合并**（2026-09-16；分支 `feat/kb-draft-streaming`，门禁 test + tsc + 自审 + diff 审查全绿）

## 用户诉求

原话：「ai 支持流，是否可以把知识化名词，点击生成后，立马先显示界面，然后依次动态显示呢」。

即：点「生成」后界面**立刻在位**，正文**依次长出来**，而不是盯着「生成中…」的按钮等整段返回。
范围拍板为**名词 / 段落 / 图版三态统一**（三态汇到同一个预览出口 `presentTermPreview`，
一处改动三态同时生效）；「总结」按钮与视频转写链路不在本次范围。

## 拦路石（已核实）

1. **传输层已经是流式**：`prompt()` 无条件 `stream: true`（`core/ai.ts:732`），SSE 解析带
   `onDelta` + `signal`（`core/ai.ts:480`），但全插件只有第二大脑聊天面板在用
   （`chat-panel.ts:257`）。名词生成今天已经在收 SSE，增量被丢掉而已。
2. **JSON 模式挡住了渲染**：三态都走 `ai.json()`（`note-gen.ts:199/290/392`），delta 拼起来是
   未闭合的 JSON 前缀，不能直接当正文写。
3. **首字延迟由思考期主导**：默认模型是思考模型，`enable_thinking:false` 对它无效（实测），
   流式只保证「界面立刻在位」，缩不掉思考时间。

## 探针证据

`.scratch/partial-json-probe.mjs`（不进库）：把最终 JSON 文本切成 1 字符的伪 delta 逐段喂给
`partialStringField()`，6 个用例全过——朴素逐字、`\u201c` 被劈成 6 片、字段顺序颠倒、
带前言 + markdown 围栏、键未出现、模拟 `max_tokens` 截断。要点：

- **解析器无需状态机**：每帧拿累积前缀重算，转义被切段自然自愈（这一帧丢掉孤 `\`，下一帧就完整）。
- 前导前言 / 围栏 / 字段顺序颠倒都不影响抽取（靠键名定位，不靠偏移）。
- 截断抽取器发现不了，但收尾的 `JSON.parse` 会抛错——正好接上现有报错路径。

## 实现清单

| # | 事项 | 位置 |
|---|---|---|
| 1 | 新增无状态前缀抽取器（收尾仍走 `parseAiJson`） | `src/knowledge/note-gen.ts` 或 `src/knowledge/` 新模块 |
| 2 | 三态生成入口接 `onDelta` + `AbortController`，逐字写 `#lit-term-content` | `src/knowledge/ui.ts::onTermGenerate / onImageGenerate` |
| 3 | 点下即 `setTermPreviewVisible(true)`、属性行「分析中…」、正文区「正在生成…」 | `ui.ts`（新渲染出口，与 `presentTermPreview` 分工） |
| 4 | 草稿加**完整度**维度（成形中 / 已完整 / 中断），中断 → 保留文字 + `确认写入` 禁用 | `ui.ts` 草稿态 + `onTermConfirm` 守卫 |
| 5 | 再次点「生成」立刻清空正文并 abort 上一轮；关窗二次确认**确认后**才 abort | `ui.ts::requestTermClose` / `onTermGenerate` |
| 6 | 收紧空正文口子（`generateTermDraft` 原本无守卫，半篇能被确认写入） | `note-gen.ts:200-204` |
| 7 | **标题行改只读**（推翻 issue 309「属性行可改标题」）：`#lit-entry-meta-title` 由 input 改展示行；`onTermConfirm` 标题改读草稿（空标题守卫保留） | `ui.ts:2435 / 3153 / 3183-3184` |
| 8 | 三态录入 prompt 字段顺序调成 `{"domain":…,"summary":…}`（领域行早早出值） | `note-gen.ts::termPrompt / passagePrompt / imagePrompt` |
| 9 | title 走同一抽取器、到达即填（段落/图版只读属性行） | 同 #1/#2 |

## 落地记录（2026-09-16）

- **抽取器单独成模块** `src/knowledge/partial-json.ts`（不塞进 note-gen）：纯函数、无依赖，单测 12 项
  （转义跨段自愈、`\uXXXX` 逐片、代理对、字段顺序、围栏前言、键未出现、截断、值不回退、终值同源）。
  已知边界：只取**扁平结构**的顶层同名键，若模型输出嵌套同名键会取到内层——三态 prompt 均要求扁平 JSON。
- **三态生成函数加 `DraftHooks { onProgress, signal }`**（`note-gen.ts`）：`draftAiOptions` 把 core/ai 的
  `onDelta` 增量累积成前缀，每帧抽 `title/domain/summary` 三字段回调；不传 hooks 时连 `onDelta` 都不接。
  新增 `requireSummary` 守卫（空 / 纯空白正文一律抛错）。三态 prompt 字段顺序统一为 domain → title → summary。
- **UI 三段切开**（`ui.ts`）：`beginTermPreview`（点下即开：属性行占位 + 正文「正在生成…」）→
  `applyDraftFields`（字段到达即填，值没变不动 DOM）→ `finishTermPreview`（终值落定 + 起关联预演）；
  失败走 `handleTermGenFailure`（有半篇 → 记中断；一个字没到 → 常规报错）。
- **忙态拆成三份**：`termGenerating`（生成流）/ `termSaving`（落盘）/ `termSummarizing`（总结），
  `termBusy` 三者合一；按钮文案与 disabled 的**唯一出口**是 `refreshTermActions`（原 `setTermGenLoading` 退役）。
  生成期间「生成」键**保持可点**（再点 = 中止重开），只锁「总结」「确认写入」。
- **中止与作废**：`termGenAbort` 句柄 + `this.termGenAbort !== ac` 守卫——被新一轮取代或被主动中止的那股流，
  结果与收尾一律丢弃，不会解错忙态、也不会误报「生成中断」。关窗仍走二次确认，**确认之后**才 abort。
- **标题行改只读**：DOM 由 `input` 改 `<span>`；`entryHeadTitle` 与 `onTermConfirm` 都改从草稿取标题，
  空标题守卫保留。
- 新增测试 26 项（抽取器 12 + note-gen 7 + ui 7），知识盒全域 508 项全绿。
- **未做**（本次范围外）：「总结」按钮的流式化、视频转写链路。

## 测试要点

- 抽取器单测：`\uXXXX` / `\n` / `\"` 跨 delta 切段；字段顺序颠倒；前言 + 围栏；键未出现；
  截断。**并钉住「抽取终值 == `JSON.parse` 终值」**（防预览与落盘静默不一致）。
- UI 测试：点下即展开（预览区可见、属性行「分析中…」）；逐字追加后正文终值正确；
  再次点生成 → 旧流 abort + 正文先清空；中断 → 文字保留 + `确认写入` 禁用 + 报错提示；
  非流式降级（不传 `onDelta`）→ 界面契约不变；关窗取消时请求不被中止。

## 拍板记录（2026-09-16，即共识）

| 决策点 | 结论 |
|---|---|
| 范围 | 名词 + 段落 + 图版三态统一（「总结」按钮与视频转写链路不在范围）|
| 即时界面 | 点下即展开预览区；属性行「分析中…」；正文区「正在生成…」 |
| 正文来源 | 单次 JSON + 无状态前缀抽取（**否决**拆两次调用：思考开销翻倍、且丢掉截断检出）|
| 流式交互 | 生成中「确认写入」「总结」保持禁用；再点生成 = 中止重开；关窗**二次确认后**才中止 |
| 中断收场 | 保留已流入文字 + 报「生成中断」+ 确认写入保持禁用 |
| 非流式降级 | 界面契约不变，正文区挂「正在生成…」到整段填入 |
| 观感 | 不加光标、不自动跟随滚动 |
| 标题行 | **AI 产出只读**（推翻 issue 309「可改标题」；规则统一为「用户输入可编辑、AI 产出只读」）|
| 领域行出值 | prompt 字段顺序调成 domain 在前 |
| title 增量 | 走同一抽取器、到达即填 |

## 被本次推翻/改写的既有决定

- **issue 309「AI 自动标题写进属性首行（可改）」→ 改为只读**（ADR-0152 决策 9）。
  CONTEXT.md 三处已同步（段落文献 / 图版文献 / 录入草稿）。
- 三态 prompt 的 JSON 字段顺序（原 summary 在前）。
- `generateTermDraft` 对空 summary 无守卫（原行为）→ 收紧（ADR-0152 决策 6）。
