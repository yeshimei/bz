# 小橘机制与表现审计：移除 / 调整 / 融合

> 2026-09-19 · 方法：四路并行盘点（记忆链路 / 情感人格 / 主动调度 / 表现层），覆盖 `src/smartcat/` 47 个文件 16810 行，得约 200 条机制
> 代理结论已逐条 grep 复核，剔除了 1 条误报（`animation.greet()` 实际由 `index.ts:313` 调用，不是死代码）
> 配套：`docs/smartcat-companion-research.md`（社区调研）、`review-smartcat-depth.md`（深度缺口清单）
> 三条硬约束（用户已明确）：记忆与情感全自动黑匣子、不新增需用户维护的东西、不推翻已拍板口径

---

## 零、总账与最短结论

| 类别 | 条数 | 说明 |
|---|---|---|
| **移除** | 10 组 | 死代码、死表现、死数据、假开关 |
| **调整** | 14 条 | 接通 / 改口径 / 收敛 |
| **融合** | 10 组 | 同一件事两套实现 |
| **保留不动** | 10 条 | 已拍板口径，审计中确认不必动 |

**最短结论——如果只做三件：**

1. **拆掉那个假开关**（`enableAutoLinking`）——设置面板里「启用关联自动发现」是**用户可见的开关，拨了什么都不发生**（唯一实现 `linkRelatedMemories` 零调用点）。这是整套系统里最伤信任的一处。
2. **人格展示收敛**——代码定义 32 个特质键，**只有 13 个会被写入，19 个出生后永不变化（其中 11 个恒为 0.5）**。数据面板的「30 特质」卡里，用户看到的一多半是永不动的横线。这很可能就是「幼稚」的一个直接来源。
3. **让 6 处自发行为过门控**——自言自语 / 欢迎回来 / 周报 / 叙事 / 书评 / 抚摸**全部不过 quiet-gate 也不读作息**，只有主动关心一处过双闸门。这是「忽冷忽热」的机制来源。

---

## 一、移除

### M1. memory.ts 尾部 5 个 P3 遗留死函数（批量删）

**现状**：`promoteToMemory`(memory.ts:1765)、`queryBehavior`(1823)、模块级 `summarizeBehavior`(1863)、`linkRelatedMemories`(1915)、`buildStoryline`(1975) —— 逐个 grep 确认**零生产调用点**，只有 `tests/smartcat/memory-p3.test.ts` 与 `behavior-stream.test.ts` 在养着它们。注释自认「面板按钮已移除，保留接口」。

**处置**：删除函数 + 同步删测试用例 + 顺手清掉只为它们存在的常量与类型字段。
**注意**：模块级 `summarizeBehavior` 与类内同名方法（memory.ts:1385，反思前置日小结）**同名不同职责**，删的时候别删错——保留类内那个。
**代价**：S。**顺带收益**：`memory.ts` 2292 行里能减掉约 250 行。

### M2. 5 个零消费消息库（约 13 个 key、全库 1146 条里的多数）

**现状**：`messages.ts` 共 18 个 key、1146 条文案。其中**只有测试引用、生产零消费**的有：

| 库 | key | 条数 |
|---|---|---|
| `SMART_CAT_PET_MESSAGES` | 5（按心情分） | 约 250 |
| `SMART_CAT_MOOD_MESSAGES` | 6 | 300 |
| `SMART_CAT_MESSAGES.LITTLE_ORANGE_COMPLAINTS` | 1 | 100 |
| `SMART_CAT_MESSAGES.THINKING_MESSAGES` | 1 | 50 |
| `getPetMessage` + `PET_MOOD_KEYS` | — | 取用函数，无调用 |

**注意别删错**：`SMART_CAT_MESSAGES.PET_MESSAGES` 是**在用**的（单击猫 → `interaction.ts:341`），与死掉的 `SMART_CAT_PET_MESSAGES` 是两个不同的东西——这正是命名灾难，融合一节会处理。

**处置**：删死库 + 同步改 `messages.test.ts`（它现在断言的是这些死库的长度）。
**代价**：S。

### M3. 死表现：voice-indicator / voice-feedback

**现状**：`ui.ts:26-27` 建了两个 DOM 节点，`styles.css:254-274` 配了样式 + `voiceIndicatorPulse` keyframes（551）——但**全代码没有任何 JS 写它的 active 类或文本**，永久空置不可见（语音功能应该是历史上砍掉的）。

**处置**：删 DOM + 样式 + keyframes。**代价**：S。

### M4. 死样式与死数据

- `happyBouncePulse` keyframe（styles.css:546）——注释自认「保留占位，未用」
- `bz-sc-mood-*` 心情组合动画类——styles.css:363 注释说是已删除，只剩注释残留
- `customColors`（config.ts:12 默认值 + types.ts:113 字段）——设置里的自定义颜色控件早已移除，无任何读取点

**处置**：全删。**代价**：S。

### M5. thinking-indicator 的冗余生成路径

**现状**：`ui.ts` 自带 `thinking-indicator` 节点，`state.ts:45-73` 又用 `bz-sc-thinking` 类**另起一套**创建路径。同一功能两条路。

**处置**：保留一条（建议保留 ui.ts 静态节点 + 只切类，省去动态创建）。**代价**：S。

### M6. 旧签名兼容路径 —— ❌ 执行时判定为**误判，保留**

**盘点结论**：`addObservationLegacy`(memory.ts:602) 与只服务它的 `chatKeepImportance=0.55` 阈值（memory.ts:615/625）。

**执行核实（2026-09-19）**：**这条不是死代码**——`index.ts:2236` 的域数据观测仍在用它：

```
const texts = DOMAIN_FILES[key].extract(raw, domainPrev);   // 返回 string/数组，没有 structured 可传
for (const t of ...) if (t) await mem.addObservation(t, { source: 'domain:' + key });
```

且 `absence` / `adr0069-core` / `behavior-stream` / `emotion-recall` / `insight-version`
五个测试文件大量使用旧签名 `addObservation(描述文本, { importance, emotion, source })`。

**处置改为保留**：要删它得先把 `domain:` 观测改成新签名（需给 `DOMAIN_FILES` 补 structured 抽取），
收益不足、风险不小。→ **不做**。

### M7. 两套随机动作调度（同时跑）

**现状**：`startRandomActions`（animation.ts:296，8 秒 / 30% 概率 / 5 个固定动作）与 `startEnhancedRandomActions`（animation.ts:401，6 秒 / 40% / 89 动作池）**同时运行**。两个定时器各自掷骰子，必然互相打断，也是「动作看起来随机但很碎」的机制原因。

**处置**：删前者，只留 89 动作池那套。**代价**：S。

### M8. 假开关 `enableAutoLinking`（**必须先二选一**）

**现状**：设置面板「启用关联自动发现」+「关联窗口天数」（ui.ts:344-350，settings.ts:498/874）——**用户能拨，但零消费**：唯一实现 `linkRelatedMemories` 是 M1 里的死代码，`relatedIds` 字段除死代码外无写入点。

**处置（二选一，不能搁着）**：
- **(a) 接线**：按调研的 A-MEM 思路重做（写入时检索相似记忆建链 + 反向更新旧条目属性），而不是复活旧死代码；调研结论支持链接机制（A-MEM, arXiv:2502.12110）。工作量 M。
- **(b) 拆掉**：删 UI 项 + 字段 + 死代码，回到「不假装有这功能」。

**建议 (a)**，但前提是它是**全自动**的——如果做不到自动建链，宁可 (b)。
**代价**：M（a）/ S（b）。

### M9. 19 个永不演化的特质（**建议收敛而非删除**）

**现状（本次审计最硬的发现）**：`TRAIT_GROUPS` 定义了 **32 个特质键**（注释称 30 项 MATE）。全库特质写入点只有三处：

- `characterTransition`(character.ts:142) → warmth, self_worth, others_trust, exist_depth, optimism, humor
- `characterFromExperience`(character.ts:178-186) → warmth, others_trust, optimism, self_worth, anxiety, cortisol, dopamine, creativity
- `applyReflectionInsights`(mood.ts:325 `TRAIT_ATTRIBUTION_CANDIDATES`) → exist_depth, familiarity, concern, creativity, oxytocin

**去重后只有 13 个特质会被写入。其余 19 个出生后永不变化**：
- 8 个有 OCEAN 出生映射但之后不动：`reflectiveness` `analytical` `separation_tol` `serotonin` `self_efficacy` `locus_control` `directness` `support`
- 11 个连出生映射都没有、**恒为 0.5 常量**：`avoidance` `world_safety` `intellectual` `def_avoidance` `self_esteem` `enhancement` `transcendence` `change` `conservation` `beh_depth` `conflict`

**更要命的是**：注入 prompt 的 8 个关键特质（`formatStateVector`, character.ts:210）里，`directness` 和 `beh_depth` 正是死的（一个不变、一个恒 0.5）。

**处置（两方案）**：
- **A（推荐，零迁移）**：字段全留，但**停止把它们当「成长」展示**——数据面板「30 特质」卡只显示会变的 13 个；`formatStateVector` 把 `directness`/`beh_depth` 换成在演化的键。成本 S。
- **B（彻底）**：`TRAIT_GROUPS` 收敛到 13 个 → 数据结构迁移 + 「30 特质」相关文案全改。成本 M，收益是概念诚实。

**建议 A**。理由：MATE 全量对齐是 ADR-0023 拍板，砍维度会推翻它；但让它「假装在长」是负资产。
**注意**：`characterHomeostasis`（回归种子）会把 19 个中的 8 个缓缓拉向 seed —— 这不算演化，只是回归，别把它当活性。

### M10. 三处「定义了但没人读」的残留

- `moodHistory`（mood.ts:125 注释确认已删，字段无消费）
- `selfEvents`（absence.ts:197）—— 只有 dashboard 卡片消费，prompt 与主动关心都不读（见 A4）
- `resonanceAmplitudeOf` / `absencePadDelta` 的参数（0.7/0.6 份额）无面板暴露且无人调

**处置**：前两者并入 A4 处理（接线则保留，不接线则删）；第三项保留（是算法参数，不是残留）。**代价**：S。

---

## 二、调整

### A1. PAD 接进行为决策（调研路线第一刀）

**现状**：PAD 算完只流向 5 档 emoji、CSS 类、prompt 数字块、字数系数 ±10%（prompts.ts:57）。**零条流向行为决策**。
**调整**：加一层 `mood → behavior` 纯函数表，接到「发不发 / 发哪类 / 说多长 / 多快出现」四个决策点。
**代价**：L。**依据**：The Sims 效用架构（Mark Brown）；ALMA 三层映射（Gebhard 2005）。

### A2. 30 特质（13 个活的）接触发消费端

**现状**：特质只进 prompt 数字块 + 一句人设描述（prompts.ts:67 五阈值档）+ 字数乘子。
**调整**：挑 3–4 个在演化的特质做行为开关（creativity↑ → 主动分享；anxiety↑ → 少开口且更短）；补一句「这周我好像变…了」的成长叙事，挂在周报旁边。
**代价**：M。

### A3. trust / attachment 派生关系阶段

**现状**：两个小数直接印在界面上（dashboard.ts:156-159、496-497），prompt 里 `trust=0.82 attach=0.41`；「老朋友」只是硬编码话术（index.ts:718）。**无阶段概念**。
**调整**：由 trust/attachment 派生四段（初识 / 熟起来 / 老朋友 / 老交情），阶段决定话术与「权限」，跃迁给一次仪式感表达。
**代价**：M。**依据**：Knapp 阶段模型 + Banks (2024)。

### A4. 缺席状态机接进对话

**现状**：三阶段状态机 + selfEvents 环（≤20 条）**只进 dashboard 卡片**（dashboard.ts:233-274），prompt 无消费、主动关心无消费；PAD 抖动是唯一间接影响。
**调整**：把阶段 + 距上次在场天数写进聊天 / 欢迎回来 / 主动关心的 prompt；话术随阶段换。
**代价**：S（机制全就绪，只差一根线）。**这条是整份审计里投产比最高的。**

### A5. 5 档显示改「档 + 强度」

**现状**：5 原型点欧氏最近邻（mood.ts:42-54）；`pleasure ∈ [40,60]` 基本全归 neutral。
**调整**：显示改双轴（「心情不错·七分」），或把连续 PAD 直接喂话术选择器。
**代价**：M。

### A6. Bandit reward 从二值改多信号

**现状**：`rewardProactiveArm`（index.ts:605）= `responded ? 1 : 0`，判据仅「10 分钟内发过任意聊天消息」。
**调整**：多信号标量（回应 / 长度 / 情绪 / 是否续成多轮）+ **防刷分项**。
**代价**：M。**依据**：Jaques et al. EMNLP 2020；Meta RLUF（arXiv:2505.14946）的 reward hacking 警告——不加防刷分，小橘会学会刷「我好想你」。

### A7. 臂空间从 3 个抽象类换成具体生活事件

**现状**：`['empathy','life','vault']`（index.ts:654），选完臂的内容是 3 句 styleHint 或每臂 2 条模板。
**调整**：臂 = 行为流识别出的具体事件（读完《X》/ streak 第 21 天 / 番茄破 10h），context 沿用现有 `banditContext`。
**代价**：M。**状态**：issues/369 已拍板、实现票仍 open —— 这条不是新建议，是提醒它没落地。

### A8. 6 处自发行为补门控

**现状**：只有 `maybeProactiveCare` 过 quiet-gate + 作息双闸门。**不过门控的**：自言自语（interaction.ts:378-387，5min×0.3 概率，深夜照发）、欢迎回来（index.ts:433-460）、周报（773）、叙事（821）、书评（847-879）、抚摸（341-361）。
**调整**：全部接同一条闸门；深夜降到极低概率且不提重话题；书评这类「刚好读到」的保留即时性（它天然是 breakpoint）。
**代价**：M。**依据**：Horvitz CHI 1999 期望效用闸门；Cutrell CHI 2001 任务切换点。

### A9. 表达端松绑

**现状**：`absoluteMax=265` / `baseMax=180`（prompts.ts:17-53）+ 重复 3–4 次字数要求 + 主动消息额外要求「温和、简短、像老朋友」（index.ts:718）。
**调整**：删「简短」这类压制词；主动消息放宽到 ~260；system 里加 1–2 条「你们之间具体的梗」当 voice anchor（**必须由系统从 character.ts 自动生成，不能让用户写**）。
**代价**：S。**依据**：小冰优化 CPS（越长越好）与「简短」恰好相反。

### A10. 时间回显分档

**现状**：`formatRelativeTime`（memory.ts:1709-1722）>7 天只剩日期「3月5日」。
**调整**：加档（近周 / 上月 / 本季 / 去年），回显成「大概三个月前」；久远或低可信条目加模糊前缀「好像是…」。
**代价**：S。**依据**：Zep bi-temporal（arXiv:2501.13956）。

### A11. credibility 从静态档升级为交叉验证

**现状**：`CREDIBILITY_TIERS` 按来源动作给静态基准分 + 负向词降档（memory.ts:1663）；LLM 只能在 ±0.2 内微调。
**调整**：加「同一事实被 N 个独立来源 / 多次提及 → 可信度提升」；冲突时按 credibility + recency 裁决。
**代价**：M。**依据**：微软 Human-Inspired Memory（arXiv:2605.08538）的频率信号 + ACT-R 频率项。

### A12. 检索加心境偏置

**现状**：GA 四因子 `αR·decay^h + αI·imp + αRel·relevance + αc·cred`（memory.ts:843，参数硬编码不可调）。
**调整**：检索时按当前 PAD 对候选做情绪一致性加权——低落时更易想起「你也曾低落、我陪过你」。
**代价**：M。**依据**：Resonance（AHs'25, doi:10.1145/3745900.3746099）、AffectAura CHI 2012。

### A13. 设置面板与黑匣子定位对齐（**这条需要你确认口味**）

**现状**：小橘设置共 8 组约 21 项。按性质可分三类：

| 性质 | 项 | 建议 |
|---|---|---|
| **环境接线**（必须由你提供信息） | 记忆文件夹、向量化模型、分块字符上限、打分范围 | **保留** —— 这不是调小橘，是告诉插件去哪儿读 |
| **行为调参**（黑匣子应内部化） | 反思观察阈值、洞察条数上限、关联窗口天数、说话概率、自言自语间隔 | **建议内部化**，改成内部常量 + 自适应 |
| **人格 / 情感** | 无 | 本来就没暴露，保持现状 |

**调整**：把「行为调参」类收回为内部常量（或只保留总开关）。理由：你刚说过记忆与情感要全自动黑匣子，而这 5 项就是把机制参数摊开让你调。
**代价**：S。
**⚠️ 执行注意**：**改 `src/settings.ts` 的键会触发全部行为包失效**（settings.ts 在每个行为包闭包里）——改完要跑无参 `node scripts/build-preview.mjs` 整体重出，别只重出 smartcat 一份。

### A14. 情绪标注两套入口的合并

**现状**：写入时 LLM 打 emotion（memory.ts:727）+ 反思期 `backfillEmotions` 追标（memory.ts:1099，批 20 条 / 80 字）。
**调整**：保留追标（它补的是历史缺标），但要确认两条路径写同一字段时**不互相覆盖**（追标注释说「只补不覆盖」，加一条测试钉住）。
**代价**：S。

---

## 三、融合

同一件事两套实现，全部是维护风险与表现不一致的来源。**F1–F10 是待融合项（计 10 组）；F11 经核实是同一份 schema 的两处渲染，确认保留，不计入。**

### F1. `summarizeBehavior` 同名两套
类方法（memory.ts:1385，反思前置日小结，**在用**）vs 模块级（memory.ts:1863，P3 统计，**死**）。→ 随 M1 删模块级。

### F2. 检索格式化两套
`formatMemoriesForPrompt`（memory.ts:1448，同步截 200 字）vs `formatMemoriesForPromptWithRefs`（1603，异步读 vault 正文 + 清理失效引用）。→ 收敛成一个（引用版是超集），保留同步降级分支。

### F3. 内容指纹两套
`snapshot-generator` 的 refHash + diff ratio≥0.30（snapshot-generator.ts:75）vs `note-memory` 的 `contentHashOf`（djb2）。→ 确认 `generateSnapshot` 的实际接线点（grep 未见 index 直接调用，**疑仅部分接线**），若真是半死状态，与 M1 一并处理。

### F4. 欢迎回来两套池
`WELCOME_BACK_MESSAGES`（messages.ts，85 条）vs `index.ts:440-442` 内联 `timeBasedMessages` 分时段池（4 条，50/50 随机）。→ 合成一套：按时段分组的单一池。

### F5. 主动关心臂模板 / 风格映射两套
`index.ts:663-676` 内联 `templates{empathy/life/vault}` + `index.ts:686` 字面 `if(armId==='empathy')` vs `quiet-gate.ts:72 GENTLE_TEMPLATES_BY_ARM` + `:88 GENTLE_STYLE_BY_ARM`。→ 单一源（建议都收敛到一处按臂查表）。

### F6. 事件描述两套
`description-generators.ts`（memory 的 description 模板，8 个 entityType）vs `behavior-wording.ts`（行为流文案，19 个 entityType:action）。**重叠 movie / book / diary_entry / letter / poem / flash / chat_message / insight**。→ 抽公共措辞表，两条流共用；差异部分（行为流带 action 徽标）保留。

### F7. 5 档中文名两处
`MOOD_MAP[].state`（mood.ts:30-36）vs `MOOD_STATE_TEXT`（prompts.ts:146-148）。→ 单一源。

### F8. 情绪中文标签两处
`emoZh`（cognitive.ts:175-182）vs `emotionLabel`（dashboard.ts:118）——**两套近全集中文表**。→ 单一源（放 cognitive，dashboard 转发）。

### F9. 随机动作两套 → 见 M7（删一套）

### F10. 心情 emoji 两处渲染
气泡 duration（`getCurrentMoodEmoji`）与数据面板 hero 各自渲染同一个 `MOOD_MAP` emoji。→ 保留两处渲染（用途不同），但取值必须走同一函数（已经是，确认即可）。

### F11. 设置入口双通道（**保留**）
长按猫开小橘设置 vs 全域设置面板内「小橘陪伴猫」组——两处渲染**同一份 schema**，不算重复实现。保留（长按是快捷路径）。

---

## 四、保留不动（审计中确认不必改的）

| 项 | 原因 |
|---|---|
| 记忆流不裁剪、无上限 | 085 拍板；调研结论「表达层衰减优于真删」与之相容（A10 只动表达层） |
| 洞察 supersede 前置剔除（非乘法惩罚） | ADR-0039 已裁决 |
| 情绪温和共振（观察共振进 PAD） | ADR-0025 已拍板推翻旧口径 |
| 30 特质不砍维度（选 M9 方案 A 时） | ADR-0023 对齐 MATE 全量 |
| quiet-gate 三层结构（门控 / 周上限 / 每日温和问候） | ADR-0042 已定；A8 是补漏接的门，不改结构 |
| 记忆 / 情感不暴露给用户 | 本轮硬约束 |
| 气泡 4 条上限 + 视口夹紧 | 表现层合理约束 |
| 数据面板 6 页签 / 18 张卡 | 信息密度合理，本轮不动 |
| 缺席状态机三阶段图（不加 worry/anxious 中间态） | ADR-0040 已裁决 |
| 记忆流 / 行为流双流拆分 | ADR-0055~0059 已定 |

---

## 五、执行顺序与注意

**第 1 批（纯删除，零风险，可立刻做）**：M1 M2 M3 M4 M5 · F1 F7 F8
**第 2 批（接线，读完即见效果）**：A4（缺席进对话，S）· A10（时间语感，S）· A9（松绑，S）
**第 3 批（需二选一先定）**：M8（假开关：接线还是拆）· M9（特质收敛方案 A/B）· A13（设置收敛）
**第 4 批（工程量大，建议合并成一次主动引擎重构）**：A1 A6 A7 A8 + F5

**执行注意：**

1. **改 `src/settings.ts` 的既有键会触发全部行为包失效** → 整体重出（无参 `node scripts/build-preview.mjs`）。
2. **删死代码必须同步改测试**（`memory-p3.test.ts` / `behavior-stream.test.ts` / `messages.test.ts` 现在断言的是死库长度），否则门禁红。
3. **M2 别删错**：`SMART_CAT_MESSAGES.PET_MESSAGES` 在用，`SMART_CAT_PET_MESSAGES` 是死的。
4. **M1 别删错**：模块级 `summarizeBehavior` 死，类内同名方法活。
5. 涉及数据结构的（A1 / A11 / A12）按项目铁律先出 ADR；M9 若选方案 B 同样需要。
6. 建议的主干顺序：**先做第 1、2 批（全是 S 级、不碰数据结构的），再看第 4 批**——第 4 批是「从陪伴工具变成角色」的那一步，比删除更能改体感，但需要一次性重做调度。

---

## 六、执行记录（2026-09-19）

分支 `wt/smartcat-audit`（worktree `D:/Obsidian/.dsh-worktrees/bz-smartcat-audit`，基于 master 833c9c79）。

### 已执行

| 编号 | 内容 | 落点 |
|---|---|---|
| M1 | 删 memory.ts 尾部 5 个 P3 死函数（2292 → 2023 行）；删 `memory-p3.test.ts`(391 行)；清理 `behavior-stream.test.ts` 的相关 import 与用例 | memory.ts |
| M2 | 删 13 个零消费消息 key（652 → 485 行）：MOOD 6 / PET 分级 5 / LITTLE_ORANGE_COMPLAINTS / THINKING_MESSAGES + `getPetMessage` / `PET_MOOD_KEYS` | messages.ts |
| M3 | 删 `voice-indicator` / `voice-feedback`（DOM + 样式 + keyframes，全无 JS 驱动） | ui.ts / styles.css |
| M4 | 删 `happyBouncePulse` / `customColors`（config + types + 测试断言） | config.ts / types.ts |
| M5 | thinking-indicator 去掉从未有样式定义的 `bz-sc-thinking` 类 | state.ts |
| M7 | 删 `startRandomActions`（8s/30%）——原与 89 动作池那套**同时跑**、互相打断 | animation.ts |
| F7 | `MOOD_STATE_TEXT` 删除，改读 `MOOD_MAP[x].state` 单源 | prompts.ts |
| F8 | `emoZh` / `EMOTION_LABELS` 两张中文表合一为 `EMOTION_ZH`（原先 `playful` 一处「玩心」一处「玩闹」、`upset` 一处「烦躁」一处「不满」） | cognitive.ts / dashboard.ts |
| A10 | `formatRelativeTime` 长程分档（>7 天：上周 / N 周前 / 上个月 / N 个月前 / 年份） | memory.ts |
| A9 | 删 prompt 里重复三次的字数段；`getResponseRequirements` 7 条精简为 6 条并加「提具体的事」「不确定就说不确定」；主动关心去掉「简短」；`auto_companion` 权重 1.4、absoluteMax 265 → 300 | prompts.ts / index.ts |
| A4 | 缺席状态机接进对话（`companionContext` 加 `editingData`，三处调用点传值） | companion-context.ts / index.ts / interaction.ts |
| M8 | **假开关接线**：`linkRelatedMemories` + `linkedSnippetOf`（同实体双向建链、窗口内、幂等、上限 20）；写入时调用；prompt 1 跳回显；面板「关联 N」徽标；`MemoryStreamEntry.relatedIds` 补字段 | memory.ts / types.ts / dashboard.ts |
| M9 | 定义 `EVOLVING_TRAITS`（13 项）；面板只展示会演化的特质；`formatStateVector` 换掉 `directness` / `beh_depth` 两个死键 | character.ts / dashboard.ts |
| A13 | 撤下「记忆巩固」3 项 +「关联」2 项共 5 个旋钮（键与消费路径保留、取默认值，随时可回退） | ui.ts |
| A8 | 自发行为总闸 `shouldStayQuiet`（安静期 / 深夜 23–7 / 非活跃时段）——自言自语定时器原先完全不过门控 | index.ts / interaction.ts |
| A6 | `proactiveRewardOf` 多信号 reward（回应 0.4 / 长度 +0.3 / 反问 +0.2 / 正向 +0.1；浅附和封顶 0.3 防刷分） | index.ts |

### 未执行（有意留给 issues/369）

- **A7 臂池换具体生活事件**：`bz-369-smartcat` worktree 里已有他人在途文件 `proactive-life-recognizer.ts`(287 行) / `proactive-life-wording.ts`(158 行)，尚未接线进 index.ts。**不碰别人的在途工作**，等 369 落地后在主仓统一做。
- **F5 臂模板与风格映射合一**：369 会重写这批文案，现在做是白做。
- **A1 mood→behavior 效用闸门**：与臂池接线落在同一函数（`maybeProactiveCare`），随 369 一起做冲突面最小。

### 门禁

- `tsc --noEmit`：0 错
- 全量 `vitest run`：见 worktree 内 `.scratch/full-test.log`
- **既存红（已用主仓 master 全目录对照复现，非本次引入）**：多文件并发下 `mood-gating` 等 2 个文件共 2 例失败（`expected 2 to be 1`），单独跑全部通过——属多文件并发污染。
