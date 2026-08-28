# ADR-0069: 行为流全量补齐 + 记忆流转型笔记记忆库 + 存储 sidecar 化

日期：2026-08-29
状态：已实施（2026-08-29 三 worktree 流并行实施并合并：smartcat-memory-core / smartcat-memory-dirs / smartcat-coverage）

## 背景

小橘（smartcat）现状（ticket 123/129/ADR-0062）：

- **行为流**（behaviorStream）是全量行为日志，但仍有明确豁免（B站条目「保存至文献」「下一篇/完成阅读」不进行为流），且 password/encrypt/launcher 等域从未接入观察。
- **记忆流**（memoryStream）是可向量化检索、进 prompt 的记忆层，事件经 routing 双写进入；条目本体存 `smartcat.json`，向量在 `smartcat-memory-vectors.vec`。
- 行为流滚动上限 2000 条 / 30 天，存于 `smartcat.json` memory 段。

用户提出：①所有事件都进行为流；②小橘设置面板增加记忆目录（多文件夹）全量载入。

## 决策

### 1. 行为流：全面盘点补齐 + 豁免 + 扩容

- **全面盘点补齐**：逐域盘点所有目前不发 addObservation 的用户动作/域事件，补齐到行为流（含反转 CONTEXT.md 在案的 B站「保存至文献」「完成阅读」豁免）。
- **隐私豁免（用户新拍板）**：**密码域、加密域动作不进行为流**（避免敏感操作留痕：何时查看了哪个密码条目、加密/解密了什么）。此为对「所有事件」的显式例外。
- **扩容**：`behaviorMaxCount` 2000→**10000**，`behaviorMaxDays` 30→**60**。

### 2. 记忆流转型：事件全退出，变为「笔记记忆库」

- **routing 不再把任何事件自动写入记忆流**；addObservation 只进行为流。记忆流的新来源 = 用户在设置中配置的**记忆目录**内的笔记。
- 存量事件类记忆条目：升级时**一次性清空**（清空重建，不做迁移保留）。
- **日记特殊处理（按日期拆段）**：日记文件一篇=一天，但文内有多个时间段（`# <emoji> HH:MM` 标题行）——复用 diary 域 parser（`src/diary/parser.ts`），**一个时间段 = 一条记忆**；条目 `created` = 文件名日期 + 段落时间（而非入库时间），保证 decay 衰减按真实日记日期计算，老日记不会被当成新记忆。其余目录笔记一篇一条。
- 记忆目录笔记入库条目 **description 存引用（笔记路径 + 定位符）而非全文**，prompt 拼装用到时当场读文件；**向量走全量**（对笔记全文做 embedding）。收益：sidecar 不膨胀、长文无存储压力。配套规则见 §6-R3。
- **importance/emotion 沿用现有打分链**——入库/增量变更时 LLM 打分（AI 未配置降级规则分），每次增量更新重打一次。

### 3. 记忆目录：多文件夹 + 增量同步

- 设置入口：⚙️ 小橘域设置弹窗，使用既有 `core/path-picker.ts` **多选文件夹选择器**配置多个 vault 目录。
- 同步机制：**首启全量扫描建库 + 运行中监听 vault 增删改**——改：按路径定位对应记忆条目，重写 description 并重向量化；删：移除条目及向量；新增：入库。
- 向量化节奏：**逐篇增量**（每次只向量化新增/变更的笔记，走 core AI embedding；失败条目下次启动补跑）。

### 4. 存储 sidecar 化（不走 smartcat.json）

记忆数据从 `smartcat.json` 拆出，三层布局：

| 文件 | 内容 | 状态 |
|---|---|---|
| `smartcat.json` | meta/config（人格、动力学、设置） | 瘦身 |
| `smartcat-memory.json`（新） | 记忆流条目（笔记记忆库） | 新建 |
| `smartcat-behavior.json`（新） | 行为流条目（日志） | 新建，滚动清理时整文件重写 |
| `smartcat-memory-vectors.vec` | bge-m3 向量 | 沿用 |

一致性对账复用现有 vectorIndexMap 机制（条目删除同步删向量）。

### 5. 行为流 AI 日小结 → 记忆流（反思独立保留）

- **动机**：事件全退记忆流后，"用户做过的事"从记忆消失（行为流不向量化不进 prompt）。AI 定期把行为流蒸馏成「你最近在做什么」摘要入库——原始杂讯关在门外，只有蒸馏结果进检索池。
- **机制拍板（定稿）**：日小结与反思**不合并、各自独立**——
  - **反思保持现状**（每 24h 或新增≥20 条，LLM 归纳 3 条洞察，原料=记忆流观察），零改动；
  - **日小结为纯新增**：每天一次（挂同一 30s tick 调度线），LLM 把上次摘要以来未消化的行为流条目蒸馏成 200-400 字「你最近在做什么」摘要入库；AI 未配置则跳过；
  - **周报告保留，输入改为只读日层产出**（本周行为摘要+洞察），不再统计原始观察，切断自指套娃路径；定位不变（唯一给人看的气泡输出）。
- **条目形态**：行为摘要 `type: 'insight'` 或独立 `'digest'`，`evidenceIds` 指向当期行为流条目 id（60 天清理后溯源可断，不影响使用）；importance/emotion 走现有打分链。
- **防自指规则**：type 为 insight/behavior-digest/weekly-report 的条目不进入任何一层 LLM 的统计与总结输入；记忆流自身产出只在检索进 prompt 时使用。
- **可选增强**：摘要 prompt 要求对比前几日摘要，点出跨天连续行为（连续写日记等），前几日摘要本就在记忆流可取。

## 6. 审查修订（对抗性审查结论，实施前必读）

- **R0（致命）钩子上移**：现状 `addObservation` 的行为路由提前 return，`touchPresence`/`onPresence`（缺席状态机）、`onObservation`（情绪共振）、`pendingSinceReflect++`（反思/小结触发计数）全在记忆流分支（memory.ts:341-390）。事件全退记忆流 = 三条生命线全断。**修复**：钩子与计数上移到 `writeBehaviorStream` 之后的公共路径（两种路由都走），向量化/打分等记忆流专属逻辑留在 memory 分支。
- **R1 日小结换源而非新增**：「今日小结」digest 机制已存在（`【今日小结】`、evidenceIds、驱动人格、失败退避）。本 ADR 的"行为摘要"实施为**给现有 digest 换数据源**：原料与触发计数从 memory stream 换成 behaviorStream；喂 LLM 前行为条目 description（机读 `source:action name`）须经 behavior-wording 渲染模板转人类文案。反思 24h 定时兜底不动，≥N 计数同样换源。
- **R2 清空重建范围（拍板）**：清 `type='observation'`（事件类）；insight/digest 条目**保留**，接受 evidenceIds 悬空（溯源可断不影响使用）。
- **R3 引用型条目配套规则**：
  - description 格式 = vault 路径 + 定位符（日记段为 `日期#时间段`，普通笔记为路径）；prompt 拼装命中时当场 `vault.read` 取正文；
  - 文件已删/已移出目录 → 引用失效，静默跳过并安排该条目清理（不阻塞检索）；
  - 全文 embedding 仍受 bge-m3 8192 token 限制：超限笔记**分块**（按标题/段落切块，一笔记多向量、同一条目挂多向量索引），不静默截断；
  - 双通道去重：记忆目录接管日记后，context-source 对日记的实时全文读取**收缩**（情绪/信任钩子保留，正文进 prompt 改由记忆检索承担），避免同段日记一次对话出现两遍。
- **R4 写放大防抖**：日记当天反复保存 → 重打分/重向量化/整文件重写连发。规则：落盘防抖并入既有 30s tick；重打分+重向量化按文件 mtime 节流（如距上次 ≥10min 才跑，期间变更合并为一次）。
- **R5 行为流 sidecar 写放大**：行为流落独立 json 后不再每事件 dataSaver 整写，滚动清理与落盘并入 30s tick。
- **R6 目录操作语义（拍板）**：设置移除目录 → 清其名下全部引用条目及向量；目录嵌套重叠 → 按路径归一去重（一条笔记只属最浅已选目录或首次入库目录）；vault rename → 监听 rename 事件同步改写引用路径（Obsidian `vault.on('rename')`），不拆成 delete+create。
- **R7 老日记导入初值（拍板）**：`lastAccessed` 初值 = `created`（日记日期），不置导入时间——老日记靠语义命中而非 recency 霸榜，符合衰减语义。
- **R8 席位类型匹配**：检索分槽的**时间席扩容**——digest（日摘要）纳入时间席候选（现状只认 observation，而"最近在做什么"恰该占时间席）；情绪席维持只认 observation。

## 7. 待观察项（不阻塞实施）

- **review/quiz/launcher/attach 四域：规则与文案构造已落表（routing + coverage-source），但域侧事件发射未接线**——行为流暂收不到这四域条目，各域后续触碰时补 emitDomainEvent/订阅即可（审查 P1-4 拍板：本 ADR「已实施」不含这四域的端到端）。
- 召回即强化（MemoryBank 式 `lastAccessed` 命中回写 importance 微增益）：字段已有，差一行回写，效果观察后定。
- 周报告统计源切到日层产出（digest+insight）：随 R1 顺带调整，统计口径变化不大。

## 影响

- 记忆流语义从「事件记忆」变为「笔记记忆库」——检索池性质改变，属难逆转决策，已由用户确认。
- `smartcat.json` 体积不再随行为/记忆增长膨胀；行为流 10000 条/60 天的体量落在独立文件。
- 「提升为记忆」手动入口随事件退出而废弃（promoteToMemory 接口一并清理或保留为无调用死码，实施时定）。
- 反思（reflection）/情绪共振等 onObservation 钩子链路仍接行为流写入路径，不受存储拆分影响。

## 关联

- ticket 123 / 129、ADR-0021（记忆流）、ADR-0062（全量行为流）、ADR-0066/0068（行为流豁免，部分被本 ADR 反转）
- 术语：CONTEXT.md「行为流」「记忆流」「记忆目录」
