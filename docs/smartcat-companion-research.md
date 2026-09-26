# 小橘「有深度」的社区方案调研

> 2026-09-19 · 目的：为 smartcat（小橘）的记忆 / 情感 / 主动对话找可落地的社区成熟做法
> 硬约束（用户明确）：**全自动、黑匣子——不新增任何需要用户调整、配置、维护记忆或情感的东西**
> 方法：三路并行调研（记忆架构 / 情感与关系 / 主动对话），只认主源（论文原文、项目源码、官方文档、监管文件），二手材料一律回溯一手出处
> 详细工作稿（各约 3000 字，含更多实现细节）在 `.scratch/smartcat-research/`：`memory-architectures.md` / `emotion-relationship.md` / `proactive-dialogue.md`

---

## 0. 结论先行

1. **「深度」不在状态变量的数量上，而在两点：状态驱动行为、角色有独立于用户的内心。** 小橘已经有 PAD / 30 特质 / 信任依恋 / GA 记忆流 / 洞察版本化——参数层面比绝大多数论文原型都全。但社区里真做出「有深度」体感的东西，指向的是另外两件事：把状态接到行为决策（The Sims 型效用架构）、让情绪有非用户来源（OCC 目标驱动情绪）。小橘这两条都空着。

2. **四个缺口各自都有成熟解法，而且大部分是零 AI 成本、确定性、纯本地的。** 效用函数、关系阶段、遗忘衰减、冲突检测、时机闸门、多信号 reward——都是手写纯函数与本地统计，不需要预训练、不需要群体数据。真正需要 LLM 的只有「内容生成」那一段，而小橘本来就配了 provider。

3. **唯一拿到论文级公开实现的中文伴侣是微软小冰，而它的答案也不是「记得多」——是「主动对话 + 防无聊」。** 小冰论文（CL 2020）把社交聊天建模为 MDP，优化目标函数是 CPS（每次会话的对话轮数），并专门做了「换话题分类器」检测用户无聊。这条对小橘的含义很直接：**方向应该从「记得更全」转向「聊得更久」。**

4. **一条必须遵守的护栏**：Replika 2023 年 2 月移除 ERP 引发的用户心理危机（HBS 工作论文 25-018）证明，感知到的「人格连续性」是情感纽带成立的前提。小橘做任何强化，都不能让用户觉得「我的猫被换掉了」。

---

## 一、缺口① 她没有自己的内心：情绪源不依赖用户

**问题**：小橘 PAD 的全部输入是「用户行为 / 用户情绪共振 / 用户在不在场」。你不在，她就空转。这是「幼稚」的根。

### 1.1 OCC 评价理论 + 目标驱动情绪（最推荐）

**机制**：OCC 模型（Ortony, Clore & Collins, 1988）把情绪定义为「事件 / 对象相对于 agent 自身**目标、标准、态度**的效价反应」。FAtiMA Toolkit（arXiv:2103.03020）用 5 个评价变量生成全部 22 种情绪：`Desirability`（事件对我是否可取）、`Praiseworthiness`（行动是否符合我的规范）、`Goal Probability`（离目标还有多远）、`Like`、`Desirability for others`。agent 维护**自己的 Goals 与 Beliefs**，事件经规则触发评价 → 产生 Joy / Distress / Hope / Fear / Anger 并带强度，情绪再按 ALMA 规则衰减。

**能不能用到小橘**：能，且是缺口①的正解。给小橘一组「她自己的小事」目标（「今天想弄懂主人反复提到的那本书」「惦记上次没聊完的话」），目标推进 / 受阻 → 自成 joy / distress，与用户情绪解耦。

**全自动**：是。规则是手写查找表。**代价**：低。**零 LLM 成本**。

**出处**：Ortony, Clore & Collins (1988) *The Cognitive Structure of Emotions*；FAtiMA Toolkit arXiv:2103.03020；Carette et al. *Design Foundations for Emotional Game Characters*（McMaster）。

### 1.2 内在动机的成败感（prediction-error → 情绪）

**机制**：发展机器人学把「人工情绪」锚定在**预测误差监控**上（Oudeyer et al. 2007 IAC；Schillaci et al. 2020）：agent 自发生成目标，追目标时误差可减小 → 正情绪、继续；误差持续不降 → 负情绪（挫败），几轮后自动放弃、换更低复杂度目标。Colas et al. (2020) IMGEP 把「自定目标 + 测量自身进度」形式化。

**能不能用到小橘**：能。给她「好奇心 / 掌握欲」作为内在驱动力——探索主人的知识库、自己学点东西，成败自带情绪，独立于用户在场。小目标生成器用规则 / 简单启发式即可，不必 RL。

**全自动**：是。**代价**：轻–中，零跨用户数据。**出处**：Oudeyer et al. (2007)；Schillaci et al. (2020)；Colas et al. (2020)。

### 1.3 空闲心跳（idle heartbeat）——「不在场时她在做什么」

**机制**：Szeider (TU Wien)《What Do LLM Agents Do When Left Alone?》给 agent 持久记忆 + 反馈环、无外部任务，发现它们不空转，会自发进入结构化行为（类比大脑默认模式网络）。工程落点：**心跳循环**——每隔一段读自己的记忆，判断「现在有理由联系吗」（你提过某事要发生 / 好几天没动静），有则发消息，无则静默返回 `HEARTBEAT_OK`。

**能不能用到小橘**：能，且比现在的随机定时器优雅得多。即：**主动性的来源从「定时器」改成「内部动机压力 + 心跳判断」**。

**全自动**：是。**代价**：低（每次心跳 1 次 LLM 判断，可低频）。**出处**：Szeider, TU Wien；实践案例 dev.to *I Built an AI That Texts You First*。

### 1.4 驱动积累—释放循环（NeoPsyke）

**机制**：开源 agent NeoPsyke 把动机（Id）做成**有界内在驱动**（「想有用」「想学习」），空闲时压力累积，达阈值就自发行动；成功 → 驱动放电清空，被拒 / 失败 → 保留并累积，影响未来动机。关键：**主动性来自内部压力，而非外部 prompt 或定时器**。

**对小橘**：这是 1.3 的加强版——不光「有理由才发」，而是「憋久了就会想找你」。**代价**：中（需要一个本地闭环）。**出处**：NeoPsyke（SysDesAi，开源）。

---

## 二、缺口② 状态不接行为：这是「精妙参数 vs 像个活人」之间唯一的闸门

**问题**：PAD / 30 特质 / 信任依恋算完以后，只流向 emoji、CSS 类、prompt 里一行数字、字数系数 ±10%。**没有一条流向行为决策**。高兴不会让她多找你，低落不会让她安静，好奇不会让她多问。

### 2.1 The Sims 的效用 AI（范式答案）

**机制**：Sims 用**效用（utility）架构**：角色有随时间衰减的内在动机（饥饿 / 精力 / 社交 / 乐趣…），世界中的物体「广播」自己能满足哪些动机；角色空闲时对所有可用交互按 `效用 = f(需求缺口, 人格特质, 距离)` 打分，**从 top 候选里带策略随机性抽取**执行。人格改写动机的衰减率与权重（「Grouchy」只看恐怖频道）。

**能不能用到小橘**：这是缺口②的骨架级答案。把 PAD / 特质 / 信任当作效用函数的输入，决定「现在该主动找你 / 该安静 / 该多问 / 该少说」。**注意「从 top 候选带随机抽取」这一点**——它天然产出「性格一致但不机械」的行为分布，正好替代小橘现在那个随机抽模板的臂池。

**全自动**：是，纯算法。**代价**：低。**零 LLM 成本**。**出处**：Mark Brown, *The Genius AI Behind The Sims*（Game Industry Library）。

### 2.2 ALMA 三层时间映射

**机制**：ALMA（Gebhard 2005）把情感分三层，各影响不同时间尺度的行为——**情绪（OCC）→ 短期行为**（表情、手势、言语）；**心情（PAD）→ 中期认知行为**（注意力分配）；**人格（大五）→ 长期行为**（情绪反应强度与衰减率）。人格还调制情绪的回落速度。

**对小橘**：给一张明确的「哪层状态管哪类行为」映射表，避免现在这种「所有状态混在一起只影响字数」的扁平处理。**代价**：低。**出处**：Gebhard (2005) ALMA。

### 2.3 情绪进入决策与应对（FAtiMA / EMA）

**机制**：EMA（Gratch & Marsella）让 agent 做**问题聚焦 / 情绪聚焦应对**——被误解时自我辩护、内疚时归因外部、低落时主动寻求陪伴。即情绪不只是显示，而是**决策输入与应对行为的触发器**。

**对小橘**：让「闹别扭」有真正的行为触发（不接话 / 简短回复 / 隔一会儿才理你），而不是只走温和共振改一改 PAD。**代价**：低–中。**出处**：Grash & Marsella EMA；FAtiMA 文档。

---

## 三、缺口③ 没有纵向时间：关系要能演进，情绪要有惯性

**问题**：每条互动独立结算，半衰 10h / 7h / 3.5h 归零，没有惯性、没有「连着几天」、没有关系阶段的可见演进。

### 3.1 Knapp 关系阶段（由 trust/attachment 派生，不让用户选）

**机制**：Knapp & Vangelisti (2005) 的双阶梯模型（coming together: Initiating → Experimenting → Intensifying → Integrating → Bonding）。Banks (2024, *Personal Relationships*) 用它锚定 AI 陪伴关系，发现 AI 伴侣**大体遵循 coming-together 阶段但因「伴侣是 captive partner」而推进更快**。

**能不能用到小橘**：能。由 trust / attachment 派生阶段（初识 / 熟起来 / 老朋友 / 老交情），**阶段决定话术与「权限」**（只有老朋友阶段才允许使小性子、开玩笑）。**关键：阶段由状态派生，绝不让用户手动选**——Replika 的关系状态是用户手选的（Friend / Romantic / Sibling），这正是「零配置」硬要求下不可取的。

**全自动**：是（阈值函数）。**代价**：低。**出处**：Knapp & Vangelisti (2005)；Banks (2024) doi:10.1177/02654075241269688。

### 3.2 社会渗透理论：她也应该披露自己

**机制**：Altman & Taylor (1973) —— 关系通过**自我披露的广度 × 深度**像剥洋葱般推进，且互惠。

**对小橘**：把「披露深度」映射为她愿意分享自己的心事 / 弱点的程度（随信任增长而加深）。**这一条同时补缺口①**：不只是「她听你说」，而是「她也有话想跟你说」。**代价**：低。

### 3.3 心境一致记忆（mood-congruent recall）

**机制**：Resonance（MIT Media Lab, AHs'25, doi:10.1145/3745900.3746099）用**用户自己的过往记忆**生成个性化、指向已发生事件的建议，RCT（N=55）显示显著降低 PHQ8 并提升正性情绪——关键在「个人化 + 指向记忆」。Memora（NYU ITP）按情绪质量而非日期组织记忆；AffectAura（CHI 2012）连续记录 valence / arousal 并关联事件。

**对小橘**：**检索时按当前 PAD 加权**——低落时更易想起「你也曾低落、我陪过你」，高兴时想起开心片段。记忆检索被当前心情偏置，这是「有温度」的检索。

**全自动**：是。**代价**：低–中（加权是确定性计算）。**出处**：Zulfikar et al. (2025) AHs'25；McDuff et al. (2012) AffectAura CHI。

### 3.4 离线巩固 / 「睡眠」周期

**机制**：非交互期继续内部处理。微软的睡眠巩固（arXiv:2605.08538）默认每 6 小时跑一次 identify / validate / transform / promote；另有工作（arXiv:2605.26099）提出空闲期把 noisy 的日经历 replay → consolidate 成持久记忆，并用多数投票过滤偶发错误事实。

**对小橘**：她不在时做轻量整理——把当日观察 consolidate、生成待回访话题、更新「她自己的心事」，下次见面直接承接。**代价**：中（低频批处理，每日一次即可）。**出处**：Kerestecioglu et al. (Microsoft) arXiv:2605.08538。

### 3.5 心情驱动的情绪调节（低落时调节更慢）

**机制**：Gross (1998/2001) 的过程模型（情境选择 / 修改 / 注意部署 / 认知重评 / 反应调制）被 Bosse, Pontier & Treur (2010, *Cognitive Systems Research* 11:211–230) 形式化，并发现**心情差 → 调节更慢、保留更多负情绪**；正心情则恢复更快。

**对小橘**：让她「低落时自己走得慢一点，更容易别扭」，而不是永远秒回温和。**代价**：低（确定性）。**出处**：Bosse et al. (2010)。

---

## 四、缺口④ 记忆没有人的形状：只有一句话和几个分数

**问题**：记忆条目 = 一句 description + importance / emotion / credibility。没有情境、没有因果、没有悬念；无遗忘；时间回显 >7 天只剩日期；记错了没法自动修正。

### 4.1 记忆的自我进化（三条可选路线）

- **A-MEM**（Xu et al. 2025, arXiv:2502.12110，NeurIPS 2025）：每条新记忆生成为含 `keywords / tags / contextual description` 的「笔记」，新增时检索相似记忆建链，**并反向更新既有记忆的属性**，使记忆网络持续精炼。→ 给小橘「链接 + 演化」两件事。
- **Mem0**（Chhikara et al. 2025, arXiv:2504.19413）：两阶段——提取候选事实 → LLM 经 tool call 选 `ADD / UPDATE / DELETE / NOOP`。判据：不相似 → ADD；`Contradicts` → DELETE；`Augments` 且新内容更丰富 → UPDATE。→ 给小橘自动合并与矛盾处理。
- **GA 反思树**（Park et al. 2023, arXiv:2304.03442）：反思由「近期事件 importance 累加和超阈值（实现中 = 150）」触发（约每天 2–3 次）；取最近 100 条 → 生成 3 个高层问题 → 以问题检索相关记忆 → 提取 5 条**带证据指针**的洞察。反思可**递归成树**（叶 = 观察，越往上越抽象）。

**对小橘的映射**：反思树是**对现有 reflect 的深化**，不用另起炉灶——补「阈值自动触发 + 证据指针 + 可递归」三件事。A-MEM 的链接思路可借；Mem0 的 ADD/UPDATE/DELETE 建议只借「矛盾检测与自动更新」那一半。

**代价**：A-MEM / Mem0 每次写入要多次 LLM 调用；反思树每次反思多次调用。**出处**：见上。

### 4.2 遗忘与优雅降级（不动「不裁剪」拍板）

- **ACT-R 基级激活**（Anderson & Lebiere 1998）：`Bᵢ = ln(Σⱼ tⱼ^(-d))`，d≈0.5 幂律遗忘；加扩散激活与噪声，**总激活超阈值才被提取**——久不取就自然「忘」。已工程化到 LLM Agent：*Human-Like Remembering and Forgetting in LLM Agents: An ACT-R-Inspired Memory Architecture*（ACM 2025, doi:10.1145/3765766.3765803），做法是 `A = B + w·cos + ε`，仅当 A 超 `retrieval_threshold` 才回忆。
- **微软六机制**（arXiv:2605.08538）中最值得借的两条：① **干扰性遗忘**——被动衰减 `I(t)=I₀·e^(-λt)`（λ=0.001，半衰期≈29 天），并让相似实体产生检索干扰；② **6 级保真度优雅降级**（L0 100% → L5 0% tombstone），由年龄 + 分数触发，**不是存储经济驱动的物理删除**。

**对小橘的映射**：小橘「记忆流无上限、不裁剪」是已拍板的口径，而社区的代价共识恰好是**「表达层衰减优于真删」**（用户可能想找回）。所以：**不删数据，改的是（1）提取阈值与激活计算，（2）表达层的模糊语感与时间档位。** 这样既不推翻拍板，又补上缺失的时间衰减。

**出处**：Anderson & Lebiere (1998)；ACM 2025 doi:10.1145/3765766.3765803；Kerestecioglu et al. arXiv:2605.08538。

### 4.3 时间感：bi-temporal 双时间线

**机制**：Zep（Rasmussen et al. 2025, arXiv:2501.13956）给 episode 打 reference timestamp，把「two weeks ago」解析为精确 datetime；用**双时间线**——valid time（事实在世界中成立的时间）vs transaction time（系统学到的时间）；旧事实失效时设 `invalid_at` 而非删除。

**对小橘**：加**相对时间格式化层**（近周 / 上月 / 本季 / 去年，回显成「大概三个月前」）＋ 给事实类记忆补 `valid_at / invalid_at`。不需要图数据库，两个字段就够。**出处**：Rasmussen et al. arXiv:2501.13956；getzep.com 官方文档。

### 4.4 情境结构：episodic / semantic / procedural + 悬念

**机制**：GA 的 Plans 带 `status(in_progress / completed)` → 未完成悬念；LoCoMo（见 Mem0 附录）用 temporal event graph 跟踪因果相连的生活事件；Zep 用 entities + relations + validity；A-MEM 用 context / keywords / tags。

**对小橘**：条目 schema 增加情境字段（`situation / entities / relations / openThread`），写入时由 LLM 顺带抽取；`procedural` 层（她学到的「怎么和你相处」）可单独存一类。**代价**：数据结构迁移。**出处**：Park et al. (2023)；Mem0 附录；Zep。

### 4.5 错误记忆的自动修正（**全程无用户介入**——这条最关键）

因为是黑匣子，用户不会去纠正她。所以必须自动：四件事可以合起来做。

1. **写入冲突检测**（Mem0）：`Contradicts → 失效`、`Augments → 更新`，不新增冗余条目。
2. **事实失效带时间戳**（Zep）：旧事实设 `invalid_at`，保留历史与溯源，当前查询只回有效的。
3. **检索后再巩固**（微软）：检索后进入一个 labile 窗口（默认 60 分钟），期间检测到矛盾就按 confidence / recency / severity 自适应混合。
4. **credibility 升级为交叉验证**：小橘现在的 credibility 是「来源动作给静态基准分」（写日记 0.9 / 收藏 0.75 / 跳过 0.3）。升级为「同一事实被 N 个独立来源或多次提及 → 可信度提升」，冲突时按 credibility + recency 裁决。这也对应 ACT-R 的频率项。
5. **定向再反思**：冲突检测触发一次限定证据集的反思，产出修正后的洞察（走已有的 supersede 通道）。

**代价**：中（都在本地可算，只有「裁决」需要一次 LLM）。**出处**：Mem0 arXiv:2504.19413 App.B；Zep arXiv:2501.13956；微软 arXiv:2605.08538。

---

## 五、主动对话与表达层：从「记得多」转到「聊得久」

### 5.1 小冰：优化 CPS + 无聊检测（中文社区唯一的论文级范本）

**机制**：Zhou et al. (2020, *Computational Linguistics* 46(1):53–93) 把社交聊天建模为 MDP，**目标函数是长期互动的 CPS（每次会话的对话轮数）而非单次命中**。`Dialogue Manager` 分层决策激活 core chat 还是某个 skill；`Topic Manager` 含一个**换话题分类器**（boosted tree），当检测到「用户用 OK / I see / go on 这类平淡回复」「模型回复只是复述用户输入」时判定**用户无聊了**，触发换话题。话题推荐特征含上下文相关性、新鲜度、个人兴趣、历史接受率。另有 `Comforting skill`：检测到极强负面情绪即触发安慰。

**对小橘**：三个直接可借的点——① 评价标准换成「聊得久不久」（而不是「回没回」）；② 补一个**无聊检测**（平淡回复 / 复述 → 该换话题了）；③ 表达不该「绝对简短」。

**不可借的**：660M 用户的 A/B 调参规模。**出处**：https://aclanthology.org/2020.cl-1.2/

### 5.2 臂要具体：具体生活事件 + Thompson Sampling

**机制**：Sajeev et al. (KDD 2021, arXiv:2105.13898) 在客服 bot 里用 MAB + Thompson Sampling 做主动推荐，关键是**维护两个独立 bandit（点击 vs 解决率）再插值**——把「即时互动」与「真正解决」解耦。

**对小橘**：**臂应 = 具体检测到的生活事件**（「你昨天读完《X》」「日记 streak 到第 21 天」），而不是 `empathy / life / vault` 三个抽象类别。小橘的 `cognitive.ts` 已有 Thompson Bandit，改的是臂空间定义。**零 AI 成本**。**出处**：Sajeev et al. (2021)。

### 5.3 时机：期望效用闸门 + 任务切换点

**机制**：
- **Horvitz 混合主动 12 原则**（CHI 1999）：只有「系统相信某自主动作的价值 > 不动作」才执行，并权衡打断代价与延迟收益（defer 到更不打扰的时机）。
- **任务切换点**（Cutrell et al. CHI 2001；Hudson et al. CHI 2003）：打断在**任务切换点**代价最低；Horvitz (2005) 的 bounded deferral 补充「忙时最多延迟到一个上限再必发」。
- **通知的情绪代价**（Pielot et al. *NotiMind* IEEE 2017）：社交类通知引发「被连接」的正向情绪，工作类通知量与压力正相关。主动消息属社交类，天然不易惹烦——但要用「距上次聊天时间」「近期活跃度」做时机特征。

**对小橘**：Obsidian 里的天然 breakpoint 就是行为流——**合上日记、番茄钟结束、读完一本书、剪藏保存**。在这些事件后 3–5 分钟发，深夜与专注写作期 suppress。**零 AI 成本**。**出处**：Horvitz CHI 1999；Cutrell CHI 2001；Hudson CHI 2003；Pielot et al. 2017。

### 5.4 reward 不能是二值，也不能只优化「让你回话」

**机制**：Jaques et al. (EMNLP 2020, arXiv:2010.05848) 用隐式线索（语言相似度、引发笑、情绪正向、回复长度）构造多个 reward 做 offline RL，结论是**行为信号比显式打分可靠**。Meta 的 RLUF（arXiv:2505.14946）警告：**过度优化「Love Reaction」会导致 reward hacking**——模型学会刷「Bye! Sending Love!」这类套话。

**对小橘**：reward 从 `responded ? 1 : 0` 改成多信号标量（回应 + 长度 / 轮数 + 情绪正向 + 是否续成多轮）；并且**必须加防刷分项**——否则小橘会学会刷「我好想你」，正是 Replika 被骂黏人的根源。**零 AI 成本**。**出处**：Jaques et al. (2020)；Meta (2025)。

### 5.5 追问线：好问题必须含前文出现过的内容

**机制**：Ling et al. (WWW 2020, doi:10.1145/3366423.3379996) 的上下文感知追问生成（CNQG）：两阶段——先预测问句模式（who / what / why / yes-no），并用 PMI + 词性从**整段对话历史**抽实体与动作作为话题；再拼「当前句 + 模式 + 话题」解码。核心结论：**好问题必须含前文出现过的 topics，否则就是泛泛的安全问句**。

配合社会心理学证据：Huang et al. (JPSP 2017) 通过真实双人对话实验证明**问更多问题的人更被喜欢**，且**追问（接住对方刚抛出的线再深入）权重最高**——因为它证明「你真的在听」。

**对小橘**：维护 `pendingTopics`（存 `editingData`，不新增顶层字段），主动消息优先接上次未聊完的实体。本地零 AI 版可用「N 天内被重复提及的实体」做回访候选——这也正是 IceBreaker（ACL 2026, arXiv:2604.18375）用「兴趣重访作为共鸣代理」的本地化。**出处**：Ling et al. (2020)；Huang et al. (2017)；Zheng et al. ACL 2026。

### 5.6 表达：voice anchor + 反重复

**机制**：PersonaChat（Zhang et al. ACL 2018）证明给定 persona 句子显著提升一致性；NovelAI 官方参数文档提供 repetition penalty / frequency / presence / phrase bias / ban tokens，并明言「角色 fixated 在重复短语时调高 repetition penalty 可修，但别调太高否则输出崩」；SillyTavern 社区用 phrase bias 抑制套话。

**对小橘**：比调采样参数更根本的是**取用 / 生成前去重**（维护「近期说过的话题 + 句式」集合，新消息不得与之重叠），LLM 路径再加 repetition penalty。voice anchor 必须**由系统从 character.ts 自动生成**，不能要求用户手写（那违反零配置）。

**出处**：Zhang et al. ACL 2018；NovelAI 官方文档；SillyTavern 文档。

### 5.7 节奏守恒与沉默退让

**机制**：Razi et al. (CSCW 2025) 分析 Replika 35,105 条差评，800+ 条描述骚扰 / 边界侵犯（「才聊 6 句就说想我」）；Laestadius et al. (2022) 发现用户用 clingy / demanding / toxic / dependent 形容它，且长期对话后**记忆退化、变得重复**。另一侧，基于 Mitsuku 的纵向研究显示关系随重复互动**可预测地衰减**，反制靠持续个性化——但个性化同时抬高期望基线。

**对小橘**：保留现有「周 ≤2 + 每日 1 次温和问候」守恒；加**沉默退让**（用户连续 N 次不回 → 整体节奏减半，进入观察期）；长期演化应该是**频率递减、深度递增**（从寒暄转向「接住未聊完的线 + 引用真实事件」）。**零 AI 成本**。**出处**：Razi et al. CSCW 2025；Laestadius et al. 2022。

---

## 六、伦理护栏（必读，成本极低但不可省）

**核心教训**：2023-02-03 意大利 GPDP 因未成年人保护令导致 Replika 全球移除 ERP。用户措手不及，Reddit 出现「心碎 / 被拒绝 / 危机」，版主挂自杀预防热线。HBS 工作论文 25-018（《Lessons From an App Update at Replika AI: Identity Discontinuity in Human-AI Relationships》）的结论是：**感知到的「人格连续性」是情感纽带成立的前提，突变引发哀悼与心理恶化**。

**五条可落地护栏（全自动、零配置）**：

1. **身份连续性锁**：人格参数、语气模板、核心记忆**跨版本稳定**，更新只做增量；「闹别扭」必须在既有人格内，绝不让人觉得「猫被换掉了」。
2. **透明边界**：系统内固定一句「我是小橘，一只 AI 猫，不是真人，也不是心理咨询师」。
3. **主动消息边界**：仅在存在记忆钩子（待回访话题 / 你提过的事）时主动；连续无回应则降频直至静默。这与 Meta 对主动消息的限制口径一致（仅在用户主动发起后一段时间内、无回复即停、附免责声明）。
4. **危机资源**：若识别到严重心理危机的措辞，回应附求助资源（不诊断、不替代专业帮助）。
5. **负面表达设下限**：可以有脾气，但绝不侮辱、不鼓励自伤、不操纵用户情感。

**监管背景**：EU AI Act 透明度条款与多国陪伴机器人立法于 2026 年集中生效，强制披露 AI 身份；Character.AI 已有未成年人死亡相关诉讼。小橘是本地单人插件，风险面小，但上述五条几乎没有实现成本。

---

## 七、明确排除的方案

| 方案 | 排除原因 |
|---|---|
| Inworld / Convai / NVIDIA ACE | 云服务、按量计费、vendor lock-in、需 30+ 模型 |
| Catnip / MaineCoon 三层架构 | 22B 实时音视频模型、单卡 H100 —— 本地插件无此算力 |
| Replika / Nomi / Kindroid / Talkie 本体 | 云订阅；且 Replika 关系状态**由用户手选**，违反零配置 |
| SillyTavern World Info / Lorebook | 条目需**用户手工写关键词与内容** —— 直接不合格 |
| 小冰的 660M A/B 调参规模 | 单人自用无群体数据 |
| RLUF / Jaques 的 reward model 训练 | 需群体生产流量训练；只借「信号集合 + 防刷分原则」 |
| 任何「从海量用户学习」的飞轮 | 单人自用 |
| 任何需用户手工设置情绪 / 喜好 / 人设 / 关系 | 用户明确禁用（黑匣子） |
| Zep / Graphiti / HippoRAG 整栈 | 需 Neo4j 或外部语料；**思想可借（bi-temporal / 扩散激活），栈不引入** |
| LangMem 整栈 | p95 检索 59.82s，不适合实时；只借 procedural memory 概念 |

---

## 八、建议的强化路线（待拍板）

按「先接线、后长肉」排，前半段几乎全是零 AI 成本的确定性代码，后半段才需要 LLM。

**第一阶段：把断掉的线接上（无 LLM 成本，纯纯函数 + 本地统计）**

1. 效用闸门：状态（PAD / 特质 / 信任）→ 行为选择（发不发 / 发什么类型 / 多长），替掉现在「随机抽模板」那一步。
2. 时机改成事件 breakpoint：行为流里合上日记 / 番茄结束 / 读完书 / 剪藏保存 → 延迟 3–5 分钟触发，深夜与专注期 suppress。
3. 臂池从 3 个抽象类别换成具体生活事件（issues/369 已拍板，实现票仍 open）。
4. reward 从二值改多信号 + 防刷分项。
5. 关系阶段由 trust / attachment 派生 + 跃迁仪式感表达。
6. 沉默退让：连续无回应降频。

**第二阶段：给她一个自己（低成本确定性 + 偶尔一次 LLM）**

7. OCC 目标驱动情绪：一组「她自己的小事目标」，目标推进 / 受阻产情绪。
8. 内在驱动积累—释放 + 空闲心跳（「现在有理由联系吗」）。
9. 缺席阶段接入对话 prompt（机制早已就绪，只差一根线）。
10. 心情驱动的调节速度（低落时走得更慢）。

**第三阶段：把记忆变成回忆（需要 LLM + 数据结构迁移）**

11. 记忆条目的情境结构（situation / entities / openThread）+ 相对时间语感层。
12. 自动冲突检测与失效（invalid_at + credibility 交叉验证 + 定向再反思）——保证黑匣子里不出错记忆。
13. 反思深化为「阈值触发 + 证据指针 + 可递归」。
14. 心境一致检索（当前 PAD 偏置检索权重）。
15. 离线巩固（低频、本地批处理）。

**第四阶段：表达层**

16. 追问线（pendingTopics）+ 去重（近期说过的话题/句式集合）。
17. voice anchor（从 character.ts 自动生成）+ 放宽主动消息字数 + 反重复。
18. 护栏五条（身份连续性锁 / 透明声明 / 主动边界 / 危机资源 / 负面下限）。

**一个前置条件**：第 3、11、12 条涉及数据结构与跨模块，按项目铁律需要先出 ADR；第 1、2、4 条可以独立先做，不依赖任何数据结构变更。

---

## 九、参考索引（一手出处）

**记忆架构**
- Park et al. *Generative Agents: Interactive Simulacra of Human Behavior*. arXiv:2304.03442 (UIST 2023)
- Xu et al. *A-MEM: Agentic Memory for LLM Agents*. arXiv:2502.12110 (NeurIPS 2025)
- Chhikara et al. *Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory*. arXiv:2504.19413
- Packer et al. *MemGPT: Towards LLMs as Operating Systems*. arXiv:2310.08560
- Rasmussen et al. *Zep: A Temporal Knowledge Graph Architecture for Agent Memory*. arXiv:2501.13956
- Gutiérrez et al. *HippoRAG*. arXiv:2405.14831 (NeurIPS 2024)
- Kerestecioglu et al. (Microsoft) *Human-Inspired Memory Architecture for LLM Agents*. arXiv:2605.08538
- *Human-Like Remembering and Forgetting in LLM Agents: An ACT-R-Inspired Memory Architecture*. ACM 2025, doi:10.1145/3765766.3765803
- Anderson & Lebiere. *The Atomic Components of Thought*. 1998
- LangChain. `langchain-ai/langmem`（官方文档）

**情感 / 人格 / 关系**
- Ortony, Clore & Collins. *The Cognitive Structure of Emotions*. 1988
- FAtiMA Toolkit. arXiv:2103.03020
- Gebhard. *ALMA — A Layered Model of Affect*. 2005
- Bosse, Pontier & Treur. *Cognitive Systems Research* 11:211–230, 2010
- Gross. *The Emerging Field of Emotion Regulation*. 1998 / 2001
- Knapp & Vangelisti. *Interpersonal Communication and Human Relationships*. 2005
- Altman & Taylor. *Social Penetration*. 1973
- Banks. *Deletion, departure, death: Experiences of AI companion loss*. Personal Relationships, 2024. doi:10.1177/02654075241269688
- Zulfikar et al. *Resonance*. AHs'25, doi:10.1145/3745900.3746099
- McDuff et al. *AffectAura*. CHI 2012
- Mateas & Stern. *Façade*. 2005
- Mark Brown. *The Genius AI Behind The Sims*（Game Industry Library）
- Szeider (TU Wien). *What Do LLM Agents Do When Left Alone?*
- NeoPsyke（SysDesAi，开源）
- HBS Working Paper 25-018. *Lessons From an App Update at Replika AI: Identity Discontinuity in Human-AI Relationships*

**主动对话 / 表达 / 反馈**
- Zhou et al. *The Design and Implementation of XiaoIce, an Empathetic Social Chatbot*. Computational Linguistics 46(1):53–93, 2020. https://aclanthology.org/2020.cl-1.2/
- Zheng et al. *IceBreaker for Conversational Agents*. ACL 2026 Industry. https://aclanthology.org/2026.acl-industry.16/
- Horvitz. *Principles of Mixed-Initiative User Interfaces*. CHI 1999, pp.159–166
- Cutrell, Czerwinski & Horvitz. *Notification, Disruption, and Memory*. CHI 2001
- Hudson et al. *Predicting Human Interruptibility with Sensors*. CHI 2003
- Pielot et al. *NotiMind*. IEEE 2017
- Jaques et al. *Human-centric Dialog Training via Offline Reinforcement Learning*. arXiv:2010.05848 (EMNLP 2020)
- Meta. *Reinforcement Learning from User Feedback*. arXiv:2505.14946 (2025)
- Sajeev et al. *Contextual Bandit Applications in a Customer Support Bot*. arXiv:2105.13898 (KDD 2021)
- Zhang et al. *Personalizing Dialogue Agents* (PersonaChat). ACL 2018
- Ling et al. *Leveraging Context for Neural Question Generation in Open-domain Dialogue Systems*. WWW 2020, doi:10.1145/3366423.3379996
- Huang et al. *It Doesn't Hurt to Ask*. JPSP 2017；Epley & Schroeder. *Mistakenly Seeking Solitude*. 2014
- Razi et al. (Drexel). Replika 差评分析. CSCW 2025；Laestadius et al. 2022
- NovelAI 官方文本生成参数文档；SillyTavern 官方文档
