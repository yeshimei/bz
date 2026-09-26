# 415 · secondbrain 对话检索接 Jev 相关性过滤

- 状态：待实现（2026-09-23 用户拍板采纳）
- 来源：`.scratch/jev-llm-智能化切入点清单.md` 第 1 号（第一梯队）
- 关联：ADR-0173（判定通道总口径）/ ADR-0181（`judgeOrFallback` 编排原语）/ issue 392（关联裁判——同构范式与工具函数来源）
- 号位说明：414 之后取 415

## 现状与痛点

`chat-panel.ts sendChatMessage` 每问独立 `store.search(userMsg, CHAT_TOP_K)` → 拼含【参考内容】的提示词 → `AI.ask` 流式。命中 chunk **不分好坏全量进 prompt**：弱相关噪声直接诱发幻觉，引用卡把弱相关当引用展示。移动端 `mobile-panel.ts:451` AI tab 同构同病。

## 方案（拍板原案）

检索之后、拼 context 之前，对每条 hit 问 Jev noul（「该片段与用户问题相关吗」），一次 `askJev` 批量问完，低于阈值的剔除后再拼 prompt。LLM 生成侧零改动。判定延迟并入现有「检索中」呼吸点等待态。

## 落地

- [ ] 抽共享过滤函数（桌面/移动两处复用）：`filterHitsByJev(hits, question, signal)`，编排走 `judgeOrFallback`；
- [ ] 回落口径（ADR-0181「凡 Jev 不可用一律 LLM 补位」）：Jev 未配置/请求失败/解析畸形 → **LLM 批量判定**（单次 `createAI().json()` 出各 hit 相关与否，闭集校验）；LLM 也不可用 → 全量进 context（行为同现状，域侧降级）；`signal` 取消 → 抛出不回落；
- [ ] 阈值独立常量：对话相关性与建链强度（`JUDGE_DIM_MIN`）语义不同，不共用；
- [ ] 桌面 `chat-panel.ts` 与移动 `mobile-panel.ts` 接同一函数；不加新开关（全局 `jevEnabled` 门）。

## 测试

- 数据层：全留/全滤/部分滤、Jev 不可用→LLM 回落、LLM 也不可用→全量放行、取消不回落、阈值边界；
- UI 层：chat-panel 冒烟（引用卡只含过滤后 hits）。
