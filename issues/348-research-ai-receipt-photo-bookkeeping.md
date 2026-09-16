# 348 · 研究：AI 识图记账的能力与路径（51 账本前置）

> labels: wayfinder:research ｜ map: 346 ｜ status: closed ｜ assignee: research-subagent ｜ blocked-by: —

## Question

新域「账本」用户提议主入口为「发一张账单截图 → AI 自动记账」。在 bz 插件现有 AI 基建下，路径是什么？要回答：

1. **库内现状（先查）**：`src/core/ai.ts` / `ai-models.ts` / `model-limits.ts` 是否已支持图片输入（多模态）？线索——知识盒图版录入「拖图/粘贴 → AI 读图成文」已在用识图，确认其调用通道（接口形态、图片如何传：base64？URL？）、支持识图的模型档位（ADR-0151 模型表里哪些有视觉能力）。给出「账单识图可直接复用哪条通道」的结论。
2. **账单形态**：国内主流账单截图（支付宝账单详情、微信支付账单、银行 App 交易明细、外卖订单页）各自的信息结构与识别要点（金额/日期/商户/分类线索的位置形态）；哪些场景识图易错（优惠拆分、合并支付、跨页账单）。
3. **提取方案参考**：识图 → 结构化 JSON（金额/日期/商户/类型/分类建议）的提示词设计要点、校验兜底（金额校验、日期归一、低置信度转手工确认）。
4. **结论**：「截图自动记账」在现有基建上的实现难度评级（直接复用 / 小改造 / 大改造），以及手工记账通道是否仍需作为主通道兜底。

## Resolution

**结论：直接复用（core AI 层零改造，账本域纯增量）。**

1. 识图通道已在（issue 311）：`ai.json({ text, images })` 收 data URL / https 图，走 OpenAI 多模态 `image_url` content 数组（ai.ts:613、674-685、784-790）；本地图 `imageDataUrl()` 转 base64（ai.ts:655），JPEG/PNG/GIF/WebP、单图 32MiB、带图超时自动放宽 180s。
2. knowledge 图版（issue 312/313）就是完整先例：拖/粘 → 校验（≤9 张）→ `generateImageDraft` → `ai.json({text: 提示词, images})` → parseAiJson → 预览可改 → 确认落盘（note-gen.ts:435-456）；clipbook 已演示跨域懒加载预填（clipbook/ui.ts:1780-1803）。
3. 默认模型 deepseek-v4-flash 即视觉档（model-limits.ts:37-42 别名含 vision-exp）；gpt-4o-mini/gemini/claude 亦多模态，纯文本档（qwen-plus/glm-4-flash）不可识图。
4. 账本域自建：账单提取提示词（JSON 契约 + 防幻觉硬约束「看不见的字段填 null」）+ 金额正则/日期归一兜底 + confidence 低转人工「待确认」（AI 草稿只进预览、确认才落账）；手工记账必须保留为主通道之一。
5. 最大风险：用户配了纯文本模型时识图必败（无视觉能力探测），需人话报错引导换模型；账单截图隐私敏感，UI 须明示「将发送至所配置 AI 服务」。

调研报告：`.scratch/memo-suite-plugin/research/348-vision-bookkeeping.md`

status: closed
