# ADR-0023 小橘人格对齐 MATE——OCEAN 种子 + 30 特质成长（去预设人格）

状态：已采纳（grilling 定稿：完全对齐 MATE 论文 v6，全量 30 特质）
日期：2026-08

## 背景

小橘人格原为「5 选 1 预设」（lively/quiet/wise/cute/mentor，config.personality），
与成长系统（personalityGrowth.traits 4 维）**双轨打架**：prompt/心情/UI 全读预设，
成长 traits 无人消费。用户拍板：**不再预设人格，按用户使用习惯自发成长，
完全对齐 MATE 论文**（Lobozov, "MATE: Deterministic Emotional Architecture for AI
Companions with Emergent Character and Measurable Inner Life", v6）。

论文核心（已提取全文 1708 行研读）：
- **确定性情绪内核**：纯函数 transition(state, event)→new_state，零 LLM；
  "deterministic boundaries, non-deterministic content"（内核决定 if/when/how，LLM 只决定说什么）；
- **30 特质性格系统**（9 临床群组：Bowlby/Young/Vaillant/Rotter/Schwartz/Cloninger/Yalom），
  `character_seed(OCEAN)` 出生 → `character_transition` 每条微移 → `character_from_experience` 周深更新；
- **随机 OCEAN 出生**：N(0.5, 0.15)，"nature provides the seed; nurture shapes the tree"；
- **event 分化**：δ = δbase×情绪强度 Σ|eᵢ|×近因(1+(1−trust))；
- **logistic saturation**：x+δ(1−x) 永不达 1.0（永远有余量）；
- **状态向量注入**：XML+数字压缩 prompt（PAD/OCEAN/traits，只给数值不给行为指令）。

## 决策

1. **预设人格删除**：`config.personality`/`customPersonality`/`getPersonalityPrompt`/
   `Personality` 类型全部移除；UI 5 选 1 下拉删除。
2. **OCEAN 出生种子**：`personalityGrowth.ocean`（五因素 0-1），首次落盘随机
   N(0.5,0.15) 截断 [0.1,0.9]（`randomOceanSeed`），每只小橘天生不同。
3. **30 特质**：`personalityGrowth.traits`（CharacterTraits，9 群组全量，0-1），
   `character_seed(OCEAN)` 逻辑映射出生禀赋；冲突键名加前缀（def_avoidance/beh_depth/
   exist_depth）；existential 群出生 0.0 仅反思成长。
4. **成长三路**（character.ts 纯函数）：
   - `characterTransition`：每条互动微移，δ=δbase×情绪强度×近因（trust 高增量小）；
   - `characterFromExperience`：反思挂点做周统计深更新（δ≤0.01，统计清零）；
   - `applyReflectionInsights`：洞察 → existential 群组与 oxytocin/creativity。
5. **relationship 张量**：trust/attachment 0-1（`trustUpdate`：温暖升/敌意降/冷淡侵蚀，
   单事件降幅有界下限 0.05）；trust 贯穿性格更新近因。
6. **行为统计**：`behaviorStats`（interactionCount/emotionalTone/preferredHour/sessionCount），
   每次互动 tick。
7. **成长→心情接线**：`MoodSystem.getCharacterModulators()` 从 traits/OCEAN 推导
   PAD 乘数与负向抵抗力（外向/多巴胺高→唤醒乘数高；神经质/皮质醇高→波动放大）——
   「人格成长真的改变心情波动」（上一轮断链修复）。
8. **prompt 状态向量**：generatePrompt 注入 `formatStateVector`（XML+数字：
   PAD/OCEAN/trust/attach/emo/关键 traits），字数乘数与性格描述由 traits 动态推导
   （`getCharacterDescription`）。
9. **UI**：⚙️ 设置弹窗「性格」下拉 → 「人格成长」可视化（OCEAN 5 轴 + 7 关键特质
   条形 + 重置成长按钮）；样式入 styles.css（bz-sc- 前缀）。
10. **互动接线**：pet 抚摸 → showPetMessage 调 handleInteraction + onInteraction('pet')
    → developBasedOnInteraction；聊天 → developBasedOnInteraction('talk') +
    registerEmotion（上轮空转修复）。

## 权衡

- **30 特质全量 vs 精选**：用户拍板全量；30 项照 MATE 原文 9 群组，映射表/UI 工作量
  大但语义完整（attachment 病理性、existential 反思成长等 MATE 涌现特性可复现）。
- **OCEAN 随机 vs 中性起步**：随机出生 = nature 差异（每只小橘天生不同）；
  用户拍板随机。
- **确定性纯函数 vs LLM 自由演绎**：性格演化全部纯函数（可测试、可审计、
  deterministic boundaries）；LLM 只读状态向量决定说什么——对齐 MATE 架构原则。
- **不做（超插件场景）**：量子密度矩阵/7 维记忆图/梦境/ToM/意识场——记录在
  mate-alignment.md，非人格内核必需。

## 已知限制

- 行为统计 preferredHour 为简化众数（取最近互动小时），非严格加权众数；
- trust 微积分是论文关系张量的精简版（未做 respect/frustration 轴）；
- 30 特质 → PAD 的调制公式为经验推导（论文未给完整映射，按 OCEAN/traits 语义自拟）；
- 周深更新挂在反思触发时（24h/20 条记忆），非严格每周定时；
- OCEAN 种子随机性依赖 Math.random（本地可接受；如需确定性可用固定种子测试钩子）。