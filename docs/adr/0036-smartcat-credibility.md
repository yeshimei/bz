# ADR-0036：smartcat 观察可信度（credibility）——记忆条目加可信度字段 + 按动作给基准分 + 检索/反思/共振加权

Status: accepted（2026-08-24，ticket 085，用户拍板）

## Context

观察记忆的可信度不通过联网 AI 确认时（本地规则分路径），**不同操作动作的默认可信度应该有差异**。现状：MemoryStreamEntry 只有 {importance, emotion}，无 credibility；本地规则分 ruleImportance 完全按「文本长度」驱动（`你收藏了《TokenLedger》`12 字 ≈ 0.51，`你写了一篇日记…`300 字 ≈ 0.61）——动作语义（收藏=兴趣强信号 vs 跳过=负信号）不进重要性，只因为字少就判低。用户拍板：记忆侧补 credibility 字段，检索/反思/情绪共振三处加权，低可信度观察下沉、少进反思结论、不猛推 PAD。

## Options

- A（采纳）**credibility 独立字段 + 集中来源档位表**：`MemoryStreamEntry.credibility?: number`（0-1，旧数据无字段 → 按 0.5 中性处理，零迁移）；本地打分路径 `ruleCredibility(source, description)` 纯函数给基准分，LLM 打分路径可覆盖（省 token）；检索 GA 评分加第四项 +αc·credibility；反思 evidence 排序键改 importance×(0.5+credibility×0.5)；情绪共振差量 ×credibility。
- B credibility 并入 importance（importance = 现打分 × (0.5+cred×0.5)）：污染 importance 语义（检索 recency 相关度与反思/共振无法独立调 credibility 权重），且旧数据 importance 语义漂移——未采纳。
- C 各域入口显式传 credibility：各域 notify 需改动且映射逻辑散落；source 已带来源名，集中 memory.ts 档位表即可（opts 保留透传能力）——未采纳。

## Decisions

- **字段**：`MemoryStreamEntry.credibility?: number`（0-1），smartcat.json 内存态新增可选字段；旧数据无该字段宽容，加权处一律 `?? 0.5` 中性，**不迁移、不重写旧条目**；`addInsight` 不写该字段（洞察按中性处理，与旧数据一致）。
- **档位表**（`ruleCredibility`，memory.ts 纯函数，未知来源缺省 0.5）：
  - 高 0.9：diary/reflection/flash/letter/poem（亲笔心迹）
  - 中高 0.75：memo/favorites/belongings（明确 UI 意图）
  - 中高 0.75/0.70（085 追加拍板上调）：domain:library 想法（excerpts 亲笔批注）0.75、划线（highlights 主动标记重要内容）0.70
  - 中 0.6：movie/pomodoro、domain:library 书架加入/开始读/读完/时长（行为动作）
  - 中低 0.45：news 阅读/保存、domain:library 移出（停留/标记可误触）
  - 低 0.3：news 跳过、移出书架（负向/移除信号 = 0.45 中低档 −0.15 降档得出）
  - **负向词通用降档**：描述含「跳过/移出/移除/删除/删掉/取消」→ 来源档基础 −0.15（下限 0.25），单次不叠加；返回值四位小数取整去浮点残差。
  - **domain:library 内部细分按 description 关键词**（集中 memory.ts，各域 notify/consumeLibraryDiff 零改动）：「想法」→ 0.75、「划了/划线」→ 0.70、「移出/移除」→ 0.45（经负向词降档 → 0.30）、其余（加入/开始读/读完/时长）→ 0.60。
- **打分链**：`scoreImportanceAndEmotion` 返回值加 credibility（本地=ruleCredibility）；LLM prompt 加第 3 项「可信度 0-10」，返回合法数字则覆盖、未返回/非法回落来源档位（省 token）；`shouldCloudScore` 逻辑不动；`addObservation` opts 增 `credibility?` 透传（各域 notify 零改动，source 已够）。
- **加权（三处）**：① 检索 GA 四因子 `αR·recency + αI·importance + αRel·relevance + αc·credibility`，`alphaCredibility = 0.3` 常量起步可调；② 反思 evidence 排序键 `importance × (0.5 + credibility×0.5)`（importance 相同 → 高可信度优先入选）；③ 情绪共振 `applyEmotionResonance(emotion, scale = 1)`，index `onObservation` 传 `m.credibility ?? 0.5`——低可信度观察差量缩量，不猛推 PAD；calm/趋零差量 ×低可信度更不误动。
- **范围外**：个性成长/信任（developBasedOnInteraction 的 trustQuality 按 credibility 修正是 084 题选项，本票不做）；review 面板新域观察展示不涉及。
- **兼容冻结**：smartcat.json 旧数据无 credibility 字段容忍（检索/反思/共振均 `?? 0.5` 兜底）；字段零迁移；各域观察文案、数据格式、命令均不动。

## 追加拍板（2026-08-24 用户三连拍板，追加提交修订）

1. **记忆流取消上限**：`MEMORY_CONFIG.maxStream` 移除、`enforceStreamLimit` 整体删除（addObservation/addInsight 不再调用），任何长度记忆全量保留。理由：检索走**向量库 top-N 相关召回**（retrieve 只把 topN 条拼进 prompt），不会把全量记忆发给在线 AI 浪费 token——历史记忆越长小橘越懂你，不淘汰。性能边界（已评估可接受）：stream/vec 文件随年月增长（年量级万条 × JSON 每条约 0.3KB + 768 维 float32 向量每条约 3KB，vec 峰值数十 MB 级，仍远小于丢弃「懂你」信息的代价）；retrieve 每次聊天 O(n) 全量评分毫秒级；反思/日小结 evidence 窗口本就只取最近 N 条，不受总量影响。
2. **不做入流门槛**：此前讨论的「importance×credibility < 0.25 不入流」**不做**——所有观察照常入流（含低可信度），靠检索 GA 加权 / 反思 evidence 排序 / 情绪共振 scale 区分影响力，不因硬门槛漏掉潜在有用记忆。
3. **书库划线/想法权重上调**（ruleCredibility domain:library 细分，选 description 关键词方案——集中 memory.ts 零域改动，非 consumeLibraryDiff 透传）：划线（highlights「划了条/N 条重点」）0.45 → **0.70**（主动标记重要内容的认知投入）；想法（excerpts 亲笔批注「写了条/N 条想法」）→ **0.75**（与 memo/favorites 明确意图同级，接近心迹类）；书架加入/开始读/时长/读完维持 0.60；移出书架维持 0.45 → 0.30（负向信号）。检索/反思/共振加权随新数值生效。

## Consequences

- 动作语义正式进入记忆打分：收藏/日记类高可信、跳过/移除类低可信，检索排名、反思结论素材、情绪共振幅度三方正确分化。
- 行为变更：本地打分路径（AI 未配置/智能档域 JSON/聊天）的 credibility 由来源档位决定；LLM 路径覆盖后不再逐条语义复核（省 token，覆盖精度以 LLM 为限）。
- 旧数据检索分数会整体带上 +0.3×0.5 常量项（所有旧条目同加，不影响相对排序）；新条目按来源档位差异化。
- 已知边界：负向词集按现有观察文案枚举（跳过/移出/移除/删除/删掉/取消），未来新文案含负向语义需同步扩展；chat 等未列来源按 0.5 中性。