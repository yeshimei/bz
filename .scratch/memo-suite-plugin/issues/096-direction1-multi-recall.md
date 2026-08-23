# ticket 096 —— 方向一：多路召回联想检索（含 H3 情绪路前置重建）

状态：**done**（2026-08-24，分支 multi-recall 两独立提交：H3 前置 + 方向一主体；ADR-0043）
父文档：086-intelligence-evolution-proposal.md v4「方向一」「H3」
基线：以合并时 master HEAD 为准（本票必须最后实现——其余五方向的 memory.ts/index.ts 改动先行合并）
日期：2026-08-24

> 实现纪要：H3——EMOTION_VAD 补五类（upset 共振差量=0 回归锁解除）/ emotionAffinity·vadAffinity VAD 连续距离评分 / reflect 证据池 LLM 情绪追标 emotionBackfilledAt（只补不覆盖·失败裁剪·独立退避·H4 边界继承）/ emotionDensityStats 密度指标。主体——槽位保留制 selectSlotMemories（语义≤4+情绪≥1+时间≥1，总≤6）落 formatMemoriesForPrompt 可选 maxEntries；情绪路 = |vadAffinity(emotion, 当前PAD-VAD)| rerank 非硬过滤；时间路只留星期几[1,42 天]+周年±3 天强锚点；空 query 显式退化 recency+importance（注释+ADR §O5）；归一化公式与路由权重上限（w_emo≤0.35/w_time≤0.25）写入 ADR-0043。retrieve() 签名/topN/调用点与 GA 权重零改动；仅新增 emotionBackfilledAt 可选字段。测试 emotion-recall.test.ts 15 + multi-recall.test.ts 20 用例。

## H3 前置（先做，独立提交）

1. **EMOTION_VAD 补全 5 类**：curious/sleepy/playful/focused/upset（cognitive.ts ~L14-36，
   现 'upset' 共振差量=0 是现网 bug）——VAD 值按语义合理取，注释标注「晨起可调」
2. **记忆情绪评分改 VAD 连续距离**：scoreImportanceAndEmotion 的 LLM emotion 校验后，
   词法兜底 detectEmotion 保持；情绪强度计算复用 emotionToVAD 距离（'相反'=负距离），废 8 标签硬匹配
3. **LLM 情绪追标**：reflect 的 evidenceTop 窗口内观察若无 emotion 字段 → 批量追标一次
   （写 emotionBackfilledAt 时间戳，只补不覆盖已有值）；失败裁剪不整轮失败、独立退避、H4 边界继承
4. **密度前置检查**：追标上线后流内非 calm 情绪占比作为指标输出到汇报
   （v4：「未达标不宣称三路」——只报告数值，不做门槛阻断）

## 方向一主体（H3 合并后做）

5. **槽位保留制**（formatMemoriesForPrompt / interaction 侧）：语义 ≤4 席 + 情绪 ≥1 + 时间 ≥1，
   总 ≤6 入 prompt（retrieve() topN=10 与三处调用点冻结不改；收缩只落 formatMemoriesForPrompt
   加 maxEntries 参数）
6. **情绪路** = 按 VAD 与当前 PAD 距离排序的 rerank 修饰（非硬过滤）；
   **时间路只留两类强锚点**：「星期几」「周年/去年同期」；小时粒度砍掉（与作息画像冗余）
7. **空 query 分支显式定义**：无检索词时退化为 recency+importance 现行为（文档注明）
8. **三路权重归一化公式 + 路由权重上限**写进 ADR（数值晨起可调，给默认并注明）

## 兼容冻结红线

- retrieve() 签名/topN/调用点不动；GA 公式权重不动（slot/rerank 只影响入 prompt 子集）
- smartcat.json 只加可选字段（emotionBackfilledAt 等）

## 测试要求

- EMOTION_VAD 补类后 upset 共振差量 ≠ 0（回归锁）
- VAD 距离评分单测（正/负距离）；追标只补不覆盖 + 失败静默 + 退避
- 槽位分配（语义满/不满、情绪时间保底、总数 ≤6）；空 query 行为；锚点命中（星期几/周年）
- 既有 memory/interaction 测试全量保留

## 工程规约

同 091 号票（exFAT pwsh 写盘 / git -c safe.directory 双参 / Conventional Commits 中文 /
.scratch add -f / flake 协议 maxWorkers=4 / 完成门禁 test+tsc）。汇报 ≤15 行。