# ADR-0022 小橘心情/情感重构——PAD 三层模型（情绪/心情/人格）

状态：已采纳（grilling 定稿）
日期：2026-08

## 背景

smartcat 域（小橘）原心情系统为 8 维连续值（happiness/energy/curiosity/affection/focus/
creativity/productivity/relaxation）+ 60s 衰减 + 人格乘数，5 档离散 MOOD_MAP 仅作显示层。
三个问题：① **calculateCompositeMood 断线**（铁律 4 保留缺陷）——5 档与 8 维相互不认，
currentMood 恒为 lastMood 或 'content'；②**三套孤岛**——EmotionalMemory/PersonalityGrowth
有实现零调用；③ 情绪不参与记忆流。

用户拍板（grilling 两轮）：彻底对齐社区方案，重构心情/情感：
- Q1=A 情绪层只做标注（不建 OCC 引擎，事件归因由 LLM/词法顺带）
- Q2=B 心情换 PAD 三维（Mehrabian，彻底对齐社区）
- R3=A 5 档显示位 = PAD **原型最近邻**（5 原型点坐标，欧氏距离最近判档）
- Q4=C 记忆↔情绪标注 = LLM 顺带 {score, emotion} + 词法兜底
- Q8=A mood 段重排：删 emotionalMemory/timeEmotion 孤岛字段与类；解除铁律 4 断线
- R6=A 人格成长反思驱动主 + 互动驱动辅
- R7=去掉昼夜节律（timeEmotion 不接线）
- R9=A 情绪/心情经 prompt 注入（formatMoodDetails PAD 版）

## 决策

1. **PAD 三维心情**：`mood.pad = {pleasure, arousal, dominance}`（0-100），
   取代 8 维 `MoodDimensions`；`updatePad(axis, change)` 带人格乘数/负向抵抗力/
   clamp 0-100/微变化防卡；60s 衰减（三轴各自速率 ÷ 人格乘数）；`MOOD_MAP` 5 档
   （excellent/good/neutral/low/poor）各带 **PAD 原型坐标**，`computeMoodLevel()`
   算当前 PAD 到 5 原型欧氏距离取最近档——**calculateCompositeMood 断线解除，
   currentMood 实时跟随 PAD**。
2. **瞬时情绪层**：`mood.currentEmotion`（happy/sad/curious/sleepy/playful/focused/
   calm/upset）记录最近情绪标签，`registerEmotion()` 写入；情绪不直接改写 PAD，
   由记忆承载、经 prompt 注入影响回复语气。
3. **记忆↔情绪双向**：`MemoryStreamEntry.emotion` 字段；`addObservation` 走
   `scoreImportanceAndEmotion`——LLM 返回 `{score, emotion}`（AI 未配置降级规则分 +
   `detectEmotion` 词法情绪）；反思洞察也带情绪（可选）。
4. **人格成长接通**：互动驱动（`developBasedOnInteraction` 接线）+ 反思驱动
   （`applyReflectionInsights`：记忆流反思洞察按关键字调整 4 特质，growthHistory
   记 source=reflection/interaction）；`memorySystem.onReflect` 回调在 index 层接
   PersonalityGrowth。
5. **孤儿字段删除**：`emotionalMemory`/`timeEmotion` 顶层字段、`EmotionalMemory` 类、
   8 维类型全部删除；情感记忆语义由「记忆条目 emotion + importance」承担。
6. **prompt 注入**：`formatMoodDetails` 改 PAD 版（三维 + 5 档 + 瞬时情绪），
   chat/learn/auto_companion/book_review/casual_chat 全部经 `generatePrompt` 注入。

## 权衡

- **PAD 三维 vs 8 维 vs 保留 8 维+PAD 投影**：用户拍板彻底对齐社区（PAD 三维），
  8 维的对外依赖（UI/衰减表/人格乘数）一并收敛；PAD 是社区情绪空间标准，
  且 5 档原型最近邻有清晰几何语义（「离哪个心情原型最近」）。
- **原型最近邻 vs 关键维阈值**：最近邻三轴全参与、可解释、无阈值调参表；
  阈值法 dominance 变摆设。
- **情绪标注 LLM vs 词法**：LLM 准但每次调用有成本；词法零成本零依赖；
  取 LLM+词法兜底（与 importance 降级链同构，一致性优先）。
- **反思驱动人格**：洞察是「高阶结论」，比单次互动更能反映长期人格；
  互动驱动保留作低频微调。
- **不做昼夜节律**（用户拍板）：timeEmotion 预留字段与文档描述不符，直接删除
  避免死数据。
- **删除 EmotionalMemory**：与记忆流 emotion 字段语义重复（双份孤岛），
  删类腾出接线空间。

## 已知限制

- PAD 原型坐标（5 档）与衰减速率为经验默认值，可按体验微调（不改结构）。
- 情绪标注质量依赖 LLM；词法兜底对反讽/间接表达不敏感。
- `registerEmotion` 只记瞬时情绪不持久化历史——历史情绪以记忆流条目承载，
  不单设情绪时间线。
- currentMood 从「持久化 lastMood」改为「PAD 实时计算」：跨会话心情由
  loadMoodState 24h 内合并 PAD 后重算，语义一致（不存离散档位历史）。