# 418 · cinema 荐片接 Jev 口味把关

- 状态：待实现（2026-09-23 用户拍板采纳）
- 来源：`.scratch/jev-llm-智能化切入点清单.md` 第 3 号（第一梯队）
- 关联：ADR-0173 / ADR-0181 / issue 414（type-decide 同范式，`judgeOrFallback` 消费参照）
- 号位说明：417 之后取 418

## 现状

`recommend.ts refineRecommend`（132 行）：LLM 要 20 部 → `dedupeRecommendations` → `slice(0, 5)` + 不足补问轮。LLM 自产自收，5 个名额无二道闸——「理由吹得好但不对味」的候选照单全收。

## 方案

去重之后、截 5 之前：Jev noul「匹配该用户口味吗」（state = `buildTasteProfile` 画像摘要 + 单条候选：片名/类型/推荐理由），一次 `askJev` 批量问完；低概率剔除，不足 5 走既有补问轮，**补问结果同样过闸**。

## 落地

- [ ] 编排走 `judgeOrFallback`：Jev 不可用/失败 → **LLM 批量判定**（单次 `createAI().json()` 出 id→pass 映射，闭集校验）；两通道全挂 → 跳过过滤（行为同现状，域侧降级）；
- [ ] **弃权 = 保留**：闸的语义是挡明显不对味的，置信不足不误杀（与 ADR-0181「弃权是有效判定」一致）；
- [ ] 复用 recommend 页内状态机（`runAIPage` 骨架），过滤并入现有等待态，不加新开关。

## 测试

过滤/保留/弃权保留、补问轮联动（补问后仍不足 5 的最终形态）、回落链、两通道全挂跳过。
