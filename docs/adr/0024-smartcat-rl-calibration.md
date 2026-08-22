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

## 用户追加决策 2（2026-08-23，进化第 1 轮红队裁决，ticket 027）

三路红队对抗审查（A 数据可靠性 / B 行为合规 / C 动力学-RL）后用户拍板三项，全部落地：

1. **信任封顶 TRUST_CAP=0.85 软收拢**（红队三路一致裁决「纯线性增益在真实密度下必然顶格 0.999」）：
   - `character.ts` 新增 `TRUST_SOFT_K=0.98`——`trustUpdate` 由硬钳改为软收拢 `v=cap+K·(v−cap)`（双向指数趋近，平衡点 v*=cap+49·gain≈0.91，终态 91% 落 55-92 验收带）；
   - 真实库 5 种子 reward 0.5649±0.0029（前代无 cap 0.6157→硬钳 0.823→**软收拢 v2 口径 0.565**——注意口径 v2 同步调低情绪带后数值不可跨代直接比较），波动 0.5%，7/7 验收；
2. **PAD 生产补接线 + 验收口径 v2 同步校准**（红队 C G1/G2 揭穿「情绪健康 PASS 是 sim 专属通道假阳性」——域事件→PAD 直加愉悦值 + 指数回摆 + effectScale 1.831 托底，生产端域事件根本不碰 PAD，真实流 pets=0 → 生产真心情不可达标）：
   - `index.ts` onVaultActivity 新增 PAD 补接线：vault 正向活动（diary→note_create/flash→note_edit/其余→note_read）→ `mood.handleInteraction(type, 0.5)`（VAULT_PAD_GAIN），生产 EFFECTS 表不改公式；
   - `mood.ts` 衰减由「60s 线性 −0.02/min 向 0 无吸引子」改为「指数回摆向中性基线 50（λ=0.07/0.10/0.20/h 半衰 10/7/3.5h，浮点精度防 60s 微移被 round 吞），与 sim DECAY_LAMBDA 一致」；
   - 验收口径 v2（accept.mjs + sim computeMetrics rMood）：情绪带改为**生产可达** meanPle 45-65（中心 55）/ 好心情 0-40%（中心 18%）——原 62.5/45-70% 标注为「生产补接线前的模拟通道口径」，互动接入（chat/pet 高频）后重校准；
   - 诚实结果：纯笔记陪伴（无抚摸/聊天）下小橘全年心情平淡（好心情 0-5%），属**环境瓶颈**（与真实库信任锁 50% 同类），不是参数缺陷；
3. **数据链诚实化（红队 A P0 全采纳）**：
   - sim 内核新增 `dedupeEvents`（A 队 P0-1 去弹跳镜像）：同 (day,kind) 分钟簇 ≥10 条折叠为 1 条 mechanical（diary 651+flash 884 中 243 条 ≥10 簇被折叠）；同 kind 10 分钟滑窗去重（对齐生产 lastActivity 语义）；
   - `mechanical` 事件不计信任成长（developInteraction 跳过）、观察 importance 降权 0.55→0.3（A 队 P1-6）；
   - extractor news 分桶（A 队 P0-2）：news 删除伪造钟点（原 sampleHour+rng 分钟 100% RNG），改为当日 12:00 固定针（无行为语义）；
   - 命名诚实化（A 队 P0-4）：事件流定性为「一年文件变更流（含机械痕迹）」，RL 校准结论标注「实验校准，接入后按真实交互流重校准」；
   - 判定：实施 P0 后真实事件流从 C 级升 B（条件可信）。

其他工程级修复（红队 B，ticket 026 已提交）：反思 evidence 白名单（insight 不作证据，防自引用膨胀）、反思失败指数退避（5min→30min 封顶，防空转写盘）、衰减落盘限流（变化 ≥0.5 才写）、vault 批量导入机械去簇（1 分钟 ≥5 路径折叠）、diary 观察 0→1 谎报修复。

**已知标定缺口（诚实声明）**：
- rMood v2 的口径（45-65/0-40%）基于「生产补接线 0.5 强度」标定；若后续调 VAULT_PAD_GAIN 或接入 chat/pet 高频互动，需重校准；
- movie 事件仍用 mtime 兜底（A 队 P1-5 换 frontmatter 源未实施——观影日期解析已在 extractor 优先，但 74% 窗口外观影日期被 mtime 顶替的残余仍在）；
- 反思 production 侧节奏仍是 24h/20 条走 LLM，与 sim 的 7 天/60 条规则模板不一致（A 队 P1-7/红队 C G9 的 source 白名单与节奏对齐未实施，留接入后校准）；
- trustErode 在真实流零触发（无冷互动路径），erode 相关参数未得到真实验证。

## 用户追加决策 3（2026-08-23，进化第 3 轮，自主采纳）

红队 C 遗留 P1（数据 frontmatter 源 + 记忆 α 死参数）落地：

1. **数据源换 frontmatter（红队 A P1-5）**：extractor movie/reading 优先 `观影日期`/`completionDate`/`readingDate` frontmatter，窗口外显式丢弃并计数——movie 668 条/2 天塌缩 → **172 条/108 天真实分布**（74% 窗口外观影日期不再被 mtime 顶替）；reading 240 → 396 条/88 天；事件流从 3447 → 3107 条（干净去重后），覆盖 314 天；
2. **rMem 接回周检索项（红队 C C3.3）**：sim 每 7 天以本周 diary/flash 观察主题词为 query 调 retrieveTop，top3 importance 均值计入 rMem（25% 权重）——**αR/αI/αRel/decay 第一次进入优化目标**（此前零梯度死参数，学出的 alphaI 系随机游走）；
3. **α 重标定（ticket 028）**：重训后 RL 学到 αR=0.66/αI=0.95/αRel=1.5/decay=0.982（相关度权重大幅上调——小橘更重视「记忆与当下话题贴合度」），生产同构验证 reward 0.5209→0.5285（+1.5%，波动 0.5%），双环境 7/7；采纳进 `MEMORY_CONFIG`；
4. L2 4 维化（红队 C C4）暂缓：rMem 检索项已撤销 alphaI 死维前提，effectScale/decayScale 中心与生产对偶配方已一致（1.0/1.0），激进裁剪推迟到接入后验证。

**收敛判据核对（§11）**：① 多轮 reward 平台期（0.5256→0.5285，+0.6% 增量递减）；② 多种子波动 <2%（真实 0.5%、合成 0.9%）；③ 双环境指标全落验收区间（7/7）；④ 产品故事对照自洽（信任暖熟有过程、心情平淡=无互动诚实值、检索更贴话题）。**判定：收敛，停止训练，进入接入前待命**。