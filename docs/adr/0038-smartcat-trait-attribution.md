# ADR-0038: smartcat 特质归因学习——LLM 归因主 + 词法兜底，mode 标记留痕

日期：2026-08-24
状态：已接受
关联：ticket 091（方向六）、086 v4 裁决、ADR-0023（MATE 人格）、ADR-0037（H4 记忆内容安全契约）

## Context

applyReflectionInsights 原以裸关键词正则猜特质归属（`自我→exist_depth` 等 5 组），词法命中即涨：
1) 任何带「自己」的抱怨都会推 exist_depth（误归因）；2) growthHistory 无解释链，查不到「为什么变了」；
违反体验原则 4「展示即承诺」——不可追溯的因果不该存在。

## Options

- A. 维持纯词法：零成本，但误归因与不可解释照旧。
- B. **LLM 归因主 + 词法兜底，结果带 mode 标记**；配额/来源/降频约束防失控。（采纳）
- C. 全 LLM 无兜底：AI 未配置时特质成长整体停摆。

## Decision

1. **双模式留痕**：反思消费链每批插一次批量 LLM 归因调用；失败/超时/结构异常整批回落词法。
   growthHistory 每个被归因洞察单独留痕，条目带 `attribution: { mode: 'llm'|'lexical', quote? }`——
   llm 必须引用洞察原文片段作依据（quote 经「去空白后为该条原文子串」校验，否则裁剪）；**词法兜底不带 quote（不产伪解释）**。
2. **防失控四约束（v4 裁决逐条落地）**：每批归因总数 ≤2（按洞察顺序截断）；digest 来源只允许非 existential；
   existential 群组（exist_depth/familiarity/concern）增益 ×0.5 降频；LLM 返回 none 不硬挑（本条不归因不涨特质）。
   候选限定 5 特质白名单；增益量级沿用现值（0.01/0.005 × DEEP_DELTA_SCALE）。
3. **H4 继承**：system prompt 追加 USER_CONTENT_BOUNDARY（memory.ts 导出）；响应逐条校验 `{trait,quote}|{trait:'none'}`，
   越权词表/digest 禁选/quote 不实逐条裁剪，不整轮失败。
4. **独立退避**：`editingData.traitAttribution = { backoffUntil, backoffMs }`（5min 起指数递增、30min 封顶、成功重置、
   跨重启生效），不共享 memory.reflectBackoffUntil；窗口内直接走词法不再发请求。
5. **来源元数据透传**：memory.onReflect 增加 `meta.origin: 'reflection'|'digest'`，index 接线原样传给 applyReflectionInsights。

## Consequences

- 正面：「小橘为什么变了」可在 growthHistory 回溯（mode+quote），满足展示即承诺；词表行为完整保留为兜底（回归不变）。
- 取舍：每批最多 2 条特质增益（旧实现无上限）——有意降频，与 072 DEEP_DELTA_SCALE 同向防 existential 顶格；
  反思历史从「一批一聚合条」改为「每归因一条」，insights 字段保留数组形态，dashboard 消费兼容。
- 兼容冻结：smartcat.json 仅新增可选字段（growthHistory 条目 attribution、editingData.traitAttribution），旧数据直读零迁移。