# ADR-0043：多路召回联想检索（槽位保留制 + 情绪/时间 rerank 修饰）

日期：2026-08-24 ～ 状态：Accepted ～ 关联：ticket 096（086 v4 方向一裁决 + H3 前置重建）、ADR-0021（记忆流 GA 四因子）、ADR-0022（PAD 心情）、ADR-0025（情绪闭环）、ADR-0036（credibility）、ADR-0037（记忆内容安全契约）、ADR-0039（洞察版本化前置剔除）

## Context

方向一要求「多路召回联想检索」：单路相似度让小橘的「想起」像查字典——准但不通人情。v2 设想三路各取 top-N 后统一重排进 GA 分，被 v4 裁决否决重构为「槽位保留」：
1. **语义为主 + 情绪/时间 rerank 修饰 + 槽位保底**——GA 公式是 RL 校准资产（αR=0.66/αI=0.95/αRel=1.5/αc=0.3，decay=0.982），任何非语义项直接进加法分空间都会污染已校准的权重语义；
2. **H3 前置**（同票先行提交）：情绪路原设计「8 标签硬匹配」是伪路——EMOTION_VAD 缺 5 类致 upset 共振差量=0、流内情绪大面积 calm。已重建为 EMOTION_VAD 补全 + VAD 连续距离评分 + reflect 证据池 LLM 情绪追标（emotionBackfilledAt）；
3. **冻结 retrieve 契约**：topN=10 与调用点不改；≤6 收缩只落 interaction 侧 formatMemoriesForPrompt 的 maxEntries 参数。

## Options

**O1 多路合并的落点**
- A. 三路分数并入 GA 加法分空间 ❌（v4 明否：αRel=1.5 下线性减项盖不住；污染 RL 校准资产）
- B. retrieve() 返回后、formatMemoriesForPrompt 内做槽位保留子集选择 ✅
- C. 各路独立 LLM 召回再融合 ❌（token 成本失控，且情绪/时间路均可纯本地计算）

选 B。rerank 是**子集级成员修饰**：从 topN=10 里挑 ≤6 条入 prompt，不重排展示顺序、不碰 GA 公式、不碰 topN。

**O2 槽位分配**
- A. 语义 ≤4 席 + 情绪 ≥1 + 时间 ≥1，总 ≤6；保底席位无合格候选时让渡给语义序 ✅
- B. 固定 4+1+1 硬凑 ❌（流内情绪密度不足时硬凑会选中无关条目）
- C. 不设总上限只设各路配额 ❌（token 预算失控——086 强制项 2 要求截断策略明确）

选 A。「≥1 保底」语义 = **有候选必保**（带 emotion 标注的候选 / 锚点命中的候选），不是无中生有；剩余名额一律按 GA 序回填，语义主路在任何退化场景下都占满预算。

**O3 情绪路评分**
- A. VAD 连续距离（复用 emotionToVAD/vadAffinity 余弦，「相反」=负距离，取 |affinity| 排序）✅
- B. 8 标签硬匹配 ❌（H3 已废：标签粒度太粗且词表覆盖不了连续情感）
- C. 只取同向、丢弃反向 ❌（「你上次难过时…」类联想恰是最有陪伴价值的召回）

选 A。当前心情 PAD(0-100) 经 padToVadVector 归一到 [-1,1] 与记忆 emotion 的 VAD 向量算余弦；|cos| 相同/反向同权重（平局取 GA 序更前者）。这是 **rerank 修饰非硬过滤**：只决定谁进情绪席，不把任何记忆踢出候选池。

**O4 时间路粒度**
- A. 只留「星期几」（同星期几、距今 [1,42] 天）与「周年/去年同期」（往年同月日 ±3 天）两类强锚点 ✅
- B. 保留小时钟点粒度 ❌（与 recency 衰减和作息画像 buildRhythmProfile 冗余——v4 明砍，消融对照后再定去留）
- C. 全日期精确锚点 ❌（「去年的今天」±3 天容差已覆盖人文意义上的周年）

选 A。周年(score=2) > 星期几(score=1)，同类按新近优先；纯函数 weekdayAnchorHit / anniversaryAnchorHit 可测可调。

**O5 空 query 分支（显式定义）**

query 为空（主动关心/自言自语等无检索词通道）时 relevance 恒 0，GA 加法分退化为 **αR·recency + αI·importance + αc·credibility——即既有 recency+importance 行为，行为冻结**。情绪/时间两路仍可在 prompt 子集层生效（它们不依赖 query），这正是「无检索词也有联想」的入口。

**O6 三路权重归一化公式 + 路由权重上限**

当前实现是槽位制（O1-B），不直接做分数加权；但 v4 要求归一化公式与上限先于三路落地成文，作为未来 score-fusion 升级路径的约束框架：

```
S_final(m) = ( w_sem·GA(m) + w_emo·|aff_emo(m)| + w_time·anchor(m) ) / ( w_sem + w_emo + w_time )
```

- `GA(m)` ∈ [0, ~3.4]：现有四因子加权和（αR·recency + αI·importance + αRel·relevance + αc·credibility），不再改权重；
- `aff_emo(m)` = vadAffinity(emotionToVAD(m.emotion), currentVad) ∈ [-1,1]，取绝对值入式（同向反向皆正贡献）；
- `anchor(m)` ∈ {0, 1, 2}：星期几=1、周年=2、未命中=0；
- 默认路由权重（晨起可调）：**w_sem=0.70 / w_emo=0.20 / w_time=0.10**（归一化后即各路影响占比）；
- **路由权重上限（硬约束）**：w_emo ≤ 0.35 且 w_time ≤ 0.25——任何调参不得使非语义两路合计超过 0.5，语义主路地位不可动摇；超限配置视为非法（实现时应 clamp 并告警）。当前槽位制的席位配比（4/1/1 ≈ 0.67/0.17/0.17 名额占比，情绪/时间席合计 ≤1/3 预算）即为该上限的成员级投影。

## Consequences

- 兼容冻结全部守住：retrieve() 签名/topN=10/调用点零改动；GA 公式与 α 权重零改动；smartcat.json 仅新增可选字段 `emotionBackfilledAt`（H3 追标时间戳，旧数据零迁移容忍）。
- formatMemoriesForPrompt 加可选第二参 maxEntries：不传保持既有全量行为（向后兼容）；聊天与主动关心两个注入点传 PROMPT_SLOTS.maxEntries=6。
- 情绪席质量受流内情绪密度制约（H3 密度指标 `emotionDensityStats` 只汇报不阻断——「未达标不宣称三路」）；追标随反思节奏逐步提高密度，情绪席在密度达标前自动让渡给语义序。
- 时间锚点窗口常量（weekdayWindowDays=42 / anniversaryToleranceDays=3）与槽位常量（PROMPT_SLOTS）均为出厂常量，「晨起可调」= 改常量一行；设置面板零新项（体验原则 5：涌现不可配置）。
- 已知边界：① selectSlotMemories 在 pool ≤ maxEntries 时整体直通（不收缩也不重排）；② 洞察条目不参与情绪/时间席（emotionBackfilledAt/锚点均只认 observation）；③ rerank 不改变 lastAccessed 自增强口径——自增强仍由 retrieve() 统一写。

## 测试

tests/smartcat/multi-recall.test.ts：槽位分配（语义满/不满、情绪席 |affinity| 挑选含反向、时间席周年>星期几、总数 ≤6、无候选让渡、保序、去重）、空 query 退化行为、锚点命中（星期几窗口边界/周年 ±3 容差/闰年安全/今年不算周年）、formatMemoriesForPrompt 兼容（不传 maxEntries 行为不变、superseded 先剔后收缩）、padToVadVector 归一。H3 部分见 tests/smartcat/emotion-recall.test.ts。