# ADR-0024：小橘动力学 RL 校准配方（真实库默认值）

- 日期：2026-08-23（正式强化学习收敛日）
- 状态：Accepted（用户拍板「落实代码吧」）
- 关联：ADR-0021（记忆流）、ADR-0022（PAD 心情）、ADR-0023（MATE 人格）；R5 校准环（真实事件流回放训练）

## Context

小橘的记忆/心情/人格动力学参数此前为手工初始值（character_transition δbase=0.003、trustUpdate 0.01/0.003、记忆流 GA 三因子 α=1.0、decay=0.995）。本轮以「强化学习 + 一年模拟 + 真实库校准环」对配方做正式优化：

1. 环境：合成节律流（6248 事件/年）与真实 vault 事件流（过去 365 天真实使用，3447 事件/年）；
2. 算法：L1 = CMA-ES（11 维参数静态配方），L2 = 演化策略元控制（对照）；
3. 奖励：多目标加权（0.25 陪伴 + 0.25 情绪健康 + 0.2 记忆质量 + 0.3 人格自洽），R2 起按 §11 验收口径收紧（信任过冲惩罚、好心情带、均值居中、洞察封顶）；
4. 验收：5 种子多种子稳定性（波动 <2%）+ §11 指标区间。

收敛结果（R2 终值，训练已停止）：
- **真实库配方（生产采用）** reward 0.606±0.005（波动 0.8%，7/7 验收通过）：deltaBase=0.00083、alphaI=0.73、alphaR=0.5、alphaRel=0.5、decay=0.986、trustWarm=0.824（对应增益 0.0082）、trustErode=0.973（对应 0.0029）；
- 合成对照配方 reward 0.729±0.013（波动 1.8%，除信任外全达标）：deltaBase=0.0096、alphaI=1.5、alphaR=1.27、alphaRel=0.52、decay=0.991、trustWarm=0.25。

诊断结论：
1. **真实环境信任锁 50%**：过去一年几乎无聊天/抚摸 → 环境瓶颈（产品决策：写日记/闪念是否计入信任成长，另立 ticket 评估）；
2. **合成信任冲 99%**：现有 trustUpdate 单调上升无均衡，RL 在「达标快 vs 稳定 55-85%」权衡下必然选快速暖熟（慢速方案实测 reward 更低）→ 生产引入可选的信任饱和钩子 TRUST_CAP（默认关，行为不变）；
3. 优化器曾越界利用负 charSens/零 trustErode（搜索边界 bug，已修并加约束 [0.5,1.5]，不影响生产公式）。

## Options

1. **仅迁移 1:1 参数**（采纳）：真实库配方直接映射生产名实相符的参数——δbase、trust 增益、α 三因子、decay；模拟器独有旋钮（effectScale/decayScale/emoGain/charSens）不迁移（它们是模拟器「时间单位折算+映射」产物，生产已有自身公式与语义）。
2. 全量迁移（含 sim 旋钮）：会改写生产 mood/效果表/调制公式，属行为重构而非参数标定，风险高，否决；
3. 信任封顶直接实现：改变现有单调上升行为（铁律 4 冲突），需产品决策 → 以 TRUST_CAP 钩子（默认 null）承载，行为不变，随决策启用；
4. 不迁移只存档：校准成果不落地，浪费（否决）。

## Consequences

- 正向：生产默认配方由 RL 在真实数据密度下标定；信任/人格/记忆权重可解释；TRUST_CAP 钩子为「信任封顶」产品决策留好接口。
- 注意：记忆检索权重变化（recency 减半、importance 0.73、relevance 减半、decay 更陡 0.986）→ 检索结果排序有实际改变，需上线观察；
- 训练与模拟资产（sim-core.mjs/实时服务/live 观测页/验收脚本 accept.mjs）存 `.scratch/smartcat-integration/`（gitignored），配方 JSON 同目录存档；
- 后续：真实接入（integration 路线 1）后按新事件流再校准（闭环）；信任封顶与否另立产品 ticket。

## 用户追加决策（2026-08-23，ticket 025）

- **写日记/闪念计入信任成长**：`PersonalityGrowth.developBasedOnInteraction(kind, 0.3, 0.02, 0.15)`——轻质量 0.15，不聊天时陪伴也能在「共享生活」中生长（修复真实库信任锁 50% 结构性问题）；
- **笔记库内容 = 小橘信息来源**：新增 `src/smartcat/context-source.ts`——vault create/modify 实时事件分类器（diary/flash/clipping/movie/reading），观察文本隐私分级（日记仅标题计数、flash 首行、clipping 取 auto-summary 的 AI 摘要、movie 片名+评分；**不读私人正文**）；
- **隐私红线（红队审查结论）**：vault 观察一律本地规则打分（`addObservation(…,{importance:0.55, emotion:词法})`），**不走 LLM**——记忆层不得成为把笔记内容外发云端 AI 的管道；LLM 打分仅限用户主动 chat；
- config 新增 `noteSource` 开关（默认开，normalize 兜底；设置界面临时放开，后续随路线 1 设置收敛）。