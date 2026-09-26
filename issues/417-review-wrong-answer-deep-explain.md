# 417 · review 错题讲解改版：去简要 explain，按钮按需详细讲解

- 状态：待实现（2026-09-23 用户拍板采纳，**含改动**）
- 用户拍板原话：「16（llm 不带简要的错题讲解，而是给一个按钮，用户点击了才给详细的错题讲解）」
- 来源：`.scratch/jev-llm-智能化切入点清单.md` 第 16 号（第二梯队）按上述改动执行
- 关联：issue 416（同文件族）；详细讲解是纯生成任务，不走 Jev、无回落编排
- 号位说明：416 之后取 417

## 现状

`generator.ts buildPrompt` 产 difficulty/多选/explain；`sprint.ts sprintQuestionHtml` 答错时渲染一行 `q.explain`（生成即定死，无法深挖）。

## 方案（按拍板改动）

1. **生成端去掉简要 explain**：prompt 不再要求、schema 去字段（省输出 token）；存量题已落的 explain 字段**留存不清洗、渲染不再消费**（旧 quiz.json 兼容）。
2. **答错 → 「详细讲解」按钮**：点击才 `createAI()` 以**原笔记全文 + 本题**为材料生成详细讲解，就地展开；等待态、失败降级提示；同会话同题缓存，不重复请求。

## 落地

- [ ] generator prompt/schema 去 explain；解析兼容存量题（带 explain 不炸、忽略之）；
- [ ] sprint 答错分支渲染「详细讲解」按钮：按需生成 + 等待态 + 会话内缓存 + 失败降级（可重试）；
- [ ] 渲染移除一行 `q.explain`。

## 测试

存量题兼容（旧 quiz.json 带 explain 正常加载）、按钮触发仅一次请求/缓存命中零请求/失败重试、无 explain 新题解析正常。
