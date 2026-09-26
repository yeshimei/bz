# 158 — 小橘：日小结 / 洞察 / 本周报告未生效（记忆流断粮饿死修复）

**状态**：✅ 已完成

## 用户拍板

> 日小结，洞察和本周报告好像未生效

## 根因（ADR-0069 断粮级联）

R2 迁移清空记忆流 observation、此后用户动作按 ROUTING_RULES 只进行为流（唯一新来源「记忆目录」默认未配置）→

1. **洞察**：`reflect()` 证据只取记忆流非 insight 条目，`evidence.length < 2` 每 30s 静默空转；从未反思时 `shouldReflect` 只看 `pendingSinceReflect`（观察计数，断粮后恒 0）→ 永不触发。
2. **日小结**：`shouldDigest` 首次门槛 `!lastReflect → false`——R1 只换了原料没换门槛，行为流再有数据也不触发。
3. **周报**：`maybeWeeklyReport` 门槛与原料仍读记忆流 `type==='observation'`，恒 <3 静默跳过；且 `hour === 10` 严格相等在 1h 节拍相位漂移时可能整点跳档。

## 改动（src/smartcat/memory.ts + index.ts + tests/smartcat/memory.test.ts）

- **`behaviorToObservations`**（新导出纯函数）：行为条目 → 观察伪条目（`buildBehaviorWording` 渲染人类文案 + `ruleCredibility` 来源档位）——不入流不落盘的派生视图；`behaviorEarliestBase` 辅助（最早条目 -1ms 含首条）。
- **反思证据池**：记忆流非 insight 条目 + 行为流渲染观察合并取 top；legacy 双写同文案按描述去重（优先记忆流原件）。
- **`shouldReflect`**：从未反思时行为流攒够 `reflectionMinNew`（20）也触发。
- **`shouldDigest`**：首次日小结与反思解耦——无反思基线时行为流攒够 `digestMinNew`（3）即触发；`digest()` 证据基线回退行为流最早条目。
- **周报**：门槛计数与 `buildWeeklyReportData` 原料并入行为流周内条目；`hour === 10` → `hour >= 10`（weekKey 去重保证当周首个 tick 生成，相位漂移不跳档）。
- 测试：重写「从未反思不触发」「P0-6 首次解锁」两用例为新语义；新增反思证据池并入行为流（wording 渲染）/ shouldReflect 行为触发 / behaviorToObservations 纯函数（credibility 档位）/ 双写去重断言。

## 验收

- tests/smartcat 1137 用例全绿；tsc 0 错。
- 行为：反思/日小结不再依赖记忆流新观察；周报原料含行为流；三者恢复生效。
