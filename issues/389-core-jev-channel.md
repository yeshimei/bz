# 389 · core 层 Jev 决策通道

> labels: feature ｜ map: — ｜ status: todo ｜ assignee: — ｜ blocked-by: —
> 上游：ADR-0173（关联判定接入 Jev 决策通道）
> 实现于 `wt/bz-jev-channel`

## 背景

现管线里所有「判定」都是**用生成模型做的**：拼一段 prompt 要模型吐严格 JSON，再解析回来。
自动关联的裁判就是这么干的（`pipeline.ts` 的 `JUDGE_PROMPT_PREFIX` + `parseJudgeOutput`）——
输出要解析、解析失败即整篇失败、还得入队重试；而 prompt 里要的 `reason` 字段
**解析后从未被消费**（只取了 `path`），是纯浪费的输出 token。

2026-09-21 实测 TypeSafe Jev（System One 决策模型，`state + 类型化问题 → 类型化答案 + 校准概率`，
**不生成任何文本**）：硬关系 Noul 0.96–0.99、软关联 0.29–0.39、同领域误建 7%、
单次约 $0.00017 / 1–2 秒。判定本就是它的甜点区。

## 报文契约（2026-09-21 实测确认，**照此实现，勿凭猜测**）

端点 `POST {endpoint}`（默认 `https://api.typesafe.ai/v1/systemone`），
头 `Authorization: Bearer <key>` + `Content-Type: application/json`。

**请求体**：

```jsonc
{
  "model": "jev-1.13.0",
  "state": "……材料全文（字符串）……",
  "questions": {
    // noul：只有 instructions
    "k_noul": { "type": "noul", "instructions": "材料是否提到了嘉靖皇帝？" },
    // choice：criteria 是「字典」（选项值 → 说明）
    "k_choice": {
      "type": "choice",
      "instructions": "这段材料最贴近下列哪个领域？",
      "criteria": { "历史": "朝代、人物、事件", "心理": "认知、情绪、行为", "以上都不是": "都不贴合" }
    },
    // score：criteria 是「有序数组」（低 → 高）
    "k_score": {
      "type": "score",
      "instructions": "材料体现的刚直程度",
      "criteria": ["很低", "较低", "一般", "较高", "很高"]
    }
  }
}
```

> ⚠ `choice.criteria` 是**字典**、`score.criteria` 是**数组**——两者形态不同，写反会被 422 拒。
> 实测第一版把 choice 的 criteria 写成数组，报
> `Input should be a valid dictionary` 于 `body.questions.<k>.choice.criteria`。

**响应体**（实测原文）：

```jsonc
{
  "model": "jev-1.13.0",
  "answers": {
    "k_choice": {
      "type": "choice", "choice": "历史", "confidence": 1.0,
      "probabilities": { "天文": 0.0, "以上都不是": 0.0, "历史": 1.0, "心理": 0.0 }
    },
    "k_score": {
      "type": "score", "score": 3.99, "confidence": 0.99,
      "legend": { "0": "很低", "1": "较低", "2": "一般", "3": "较高", "4": "很高" },
      "probabilities": { "0": 0.0, "1": 0.0, "2": 0.0, "3": 0.01, "4": 0.99 }
    },
    "k_noul": { "type": "noul", "noul": 1.0 }
  },
  "usage": { "input_tokens": 493, "output_tokens": 84 }
}
```

- `score.score` 是**可小数的档位索引**（3.99 落在第 4 档），不是百分比；`legend` 把索引映射回档名。
- 每条答案都带 `type` 回显，解析时可据此校验。
- `usage` 恒返回，但 ADR-0173 §2 定了**不做用量可见性**，故本通道只把它透传给调用方，不自己记账。

## 决策

1. **新增 `src/core/jev.ts`**，封装 Jev 通道：输入 `state` + 类型化 `questions`，输出 `answers`。
   三种题型（`choice` / `score` / `noul`）**原样透传，不做业务语义包装**——原语不认识具体域，
   业务口径留在调用方。
2. **端点默认** `https://api.typesafe.ai/v1/systemone`；**model 默认 `jev-1.13.0`**（固定版本，
   ADR-0173 §5：口径不该由供应商的远端别名决定何时变更；`jev-latest` 作为可配值保留但非默认）。
3. **超时默认 10s**（实测 1–2 秒含跨国网络，留 5x 余量），可配。超时/网络/HTTP 错误一律**抛错**，
   由调用方决定回落——通道层不自己兜底、不静默返回空答案。
4. **必须支持 `AbortSignal`**（`options.signal`）：自动关联的**关联预演**路径带取消通道
   （issue 327，重新生成即断在途裁判），Jev 通道必须同样可取消。取消抛 `AbortError` 语义的错误，
   **与「失败」可区分**——调用方据 `signal.aborted` 判定取消，不把它当成需要回落的失败。
5. **与 `core/ai.ts` 同层且零依赖它**。Jev 是**判定通道**，不走 `AI_PROVIDER_REGISTRY`
   （那是生成通道的注册表，含 max_tokens / 思考档位等生成专用语义）。端点、密钥、模型独立配置。
6. **配置读取走 `core/settings-provider.ts` 的 `tryGetSettings()`**（本层已有惯例，
   `pipeline.ts` 同款），键名固定为：`jevEnabled` / `jevEndpoint` / `jevApiKey` / `jevModel` /
   `jevTimeoutMs`。**未配置（`jevEnabled !== true` 或无 key）时 `askJev` 直接抛错**，
   由调用方回落——通道自己不判断「要不要用 Jev」，那是调用方的门。
7. **一次请求可携带多个问题**（Jev 的并行多问不加价）；把多少候选塞进一次 state 由调用方决定。
   单次 state 过长会拉低精度，调用方负责控制（自动关联侧候选数受 `linkAgentTopK` 约束）。
8. **`questions` 为空时不发请求**，直接返回空 `answers`——省一次注定无意义的往返。

## 测试

`tests/core/jev.test.ts`（纯数据层，首行加 `// @vitest-environment node`）：

- 三种题型的**请求体**构造正确（`choice` 的 `criteria` 是对象、`score` 的是数组、`noul` 仅 `instructions`）——
  这是实测踩过的坑，必须有断言守住；
- 三种题型的**响应解析**正确（`choice` 取 `choice` / `probabilities` / `confidence`；
  `score` 取 `score` / `legend`；`noul` 取 0–1）；
- 超时、HTTP 4xx/5xx、网络异常各自抛出**可识别**的错误（不吞、不转空值）；
- **`signal` abort → 抛 AbortError 语义错误**，且 `signal.aborted` 为真可区分于失败；
- `questions` 为空时不发请求；
- 未配置（`jevEnabled` 关 / 无 key）时抛错；
- 端点/模型/超时可被显式覆盖。

## 遗留

- **用量与额度可见性**不做（ADR-0173 §2：降级不通知不标记）；$5 赠金 30 天过期后的计费口径待用户决定是否要上限保护。
