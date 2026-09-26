# 414 · Jev 不可用一律回落 LLM × 判定编排抽通用件

- 状态：已实现（2026-09-23，用户拍板；ADR-0181）
- 关联：ADR-0173 §2（回落总口径）/ **issue 395（本批取代其影院「不回落」口径）** / issue 389（通道）/ 391（设置组）/ 392（关联裁判回落实现）/ 393（影院受限分类接入，命令形态已被 394 删除）
- 号位说明：413 之后取 414

## 用户原话拆解

1. 「jev 如何不能调用的场景，确认都有 llm 做后补」——先按现状审计：**关联裁判有回落、影院没有**
   （issue 395 实现形态：`decideCinemaType` 未配置即抛、失败上抛「不回落 LLM」）。用户随即拍板取消该例外：
   「不用探索，这是我要求的，必须有 llm 回落」。
2. 「可以抽出一个通用，类似 core/ai」——两处接入点各自手写同一套「判配置 → 请求 → 解析 → 失败
   回落」控制流；抽出判定侧的统一编排原语，形态对齐生成通道 `core/ai.ts` 的地位。

## 落地

- [x] 新增 `src/core/jev-fallback.ts`：`judgeOrFallback<T>({ request, parse, fallback, signal?, config? })`
      —— 判可用 → 请求 → 解析 → 失败回落一条龙。四类不可用：① 未启用/未配置 = 不造材料直接回落；
      ② 请求失败 = 回落；③ 答案畸形（`parse` 抛）= 回落；④ `signal` 取消（含在途）= 抛
      `AbortError` 不回落。`fallback()` 自身抛错不吞，交调用点按域降级。
      **单独成件**（不并入 `core/jev.ts`）：通道保持零业务口径；且 vitest 只能拦跨模块调用，
      抽件后调用点可 spy 原语、原语可 spy `askJev`。
- [x] 影院 `src/cinema/type-decide.ts` 重写：`decideCinemaType` 走原语，`fallback` =
      `decideTypeByLlm`（`createAI().json()` + `buildTypeLlmPrompt` / `parseTypeLlmOutput`，接调用方 `signal`）。
      LLM 回执**严格闭集校验**（自有键判定 `∈ criteria` 且 `≠ 哨兵`，否则 `null`）——生成模型无校准概率，
      拿不到 Jev 那样的置信度门槛。**Jev 弃权（哨兵 / 低置信）仍是有效判定，不回落**（否则等于
      绕过受限分类放野值进来）；**取值越界（清单外的词）反过来算畸形 → 回落**。
- [x] 关联裁判 `src/secondbrain/link-agent/pipeline.ts`：`judge()` 改消费原语（行为等价重构），
      材料改**惰性构造**（`request()` 内拼 state，未就绪/已取消时不白读 vault）；
      `src/cinema/ui.ts` 仅注释口径同步；`src/settings.ts` 与 `settings-main-schema.ts` 的 Jev 开关
      文案同步（「/ 不判定」已作废、描述补影院）。
- [x] 测试：新增 `tests/core/jev-fallback.test.ts`（12 例：四类不可用 + 材料构造抛错回落 +
      取消优先于就绪门 + 取消/超时同时发生归一到 AbortError + 回执透传 + fallback 抛错上抛 + config 覆盖）；
      `tests/cinema/type-decide.test.ts`（Jev 正常链 LLM 零调用 / 弃权不回落 / 未启用→LLM / 请求失败→LLM /
      题型不符→LLM / 越界→LLM / 缺单键→LLM / LLM 回执非法→null / 原型链键不算候选 / abort / 两通道全挂→抛 /
      回落透传 signal）；`tests/secondbrain/link-agent-judge-jev.test.ts` 取消用例拆成「在途取消」与「预取消」两条。

## 验证

- worktree：受影响 4 文件全绿；全量套件（除 `preview-freshness`）482 文件 / 7151 例通过；
  `tsc --noEmit` 干净。
- 主仓：`node scripts/build-preview.mjs` 重出原型产物（cinema / secondbrain / settings-panel 等
  行为包随源指纹更新）→ 全量 `pnpm test` 取权威结论 → `pnpm run build` 部署（main.js 已更新）。
- **权威全量**：483 文件 / 7179 例通过（`BZ_TEST_MAX_WORKERS=3 pnpm test`，含 `preview-freshness`）；
  `tsc --noEmit` 干净。注：默认并发下 `tests/pomodoro/ui.test.ts` 的「第 4 个专注完成 → 长休开始声」
  会因**并行会话抢 CPU**（同机另一 worktree 正在跑 vitest）触发 20s 超时——该用例单独跑 6.9s 通过、
  限并发也通过，与本票无关（番茄钟侧零改动）。
- 双轴子代理 review（Standards / Spec）指出并已整改四项：
  ① 闭集校验被原型链键绕过（`in` → `hasOwnProperty.call`）；
  ② 影院侧「取值越界」被算作弃权而漏了回落（与 ADR 第 ③ 类冲突）——改判畸形走回落；
  ③ 回落请求未接 `signal`（在途取消传导不进 LLM 通道）；
  ④ 取消恰与超时同时发生时出口不是 AbortError（归一化）；
  另修：ADR 引用失真（把被取代对象误记成 ADR-0174 §3，实际出处是 issue 395——ADR-0174 全文未涉 Jev）。
