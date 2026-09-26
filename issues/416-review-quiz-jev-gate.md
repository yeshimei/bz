# 416 · review 出题质检（LLM 产题 → Jev 把关）

- 状态：待实现（2026-09-23 用户拍板采纳）
- 来源：`.scratch/jev-llm-智能化切入点清单.md` 第 2 号（第一梯队）
- 关联：ADR-0173 / ADR-0181 / issue 417（同文件族：generator 去 explain 后本项判定材料随之调整，建议同 worktree 批次实现）
- 号位说明：415 之后取 416

## 现状与痛点

`quiz-core/session.ts ensureQuestions`：`generateBatch`/`generate` 返回后只校验 JSON 形状（options 长度 4、correctIndices 越界）即 `mutateQuiz` 写库。语义质量（题干是否忠于原文、答案是否唯一无争议、选项是否重复）无人把关。烂题入库的代价被流程**放大**：答错 → `accuracyToRating` 判低分 → FSRS 短间隔 + pendingRedo → **污染记忆曲线与 `fit.ts` 拟合样本**。

## 方案

写库前逐题判定：Jev noul（「答案唯一且能从原文得出」）+ score（质量分），低分/弃权题丢弃（宁缺勿滥；是否触发补生成实现时定）。后台批量出题 1-2 秒/题可接受。

## 落地

- [ ] `quiz-core` 新增质检步（`ensureQuestions` 写库前），编排走 `judgeOrFallback`；
- [ ] 回落口径（ADR-0181）：Jev 不可用/失败 → **LLM 批量质检**（单次 `createAI().json()`，逐题给 pass/fail，闭集校验）；LLM 也不可用 → 放行入库（两通道全挂的域侧降级，行为同现状）；
- [ ] 一次 `askJev` 批量带该批全部题目，不逐题往返。

## 测试

- 质检判定：Jev 正常过滤 / 弃权丢弃 / 不可用→LLM 回落 / 两通道全挂→放行；
- 写库前拦截生效；批量单请求。
