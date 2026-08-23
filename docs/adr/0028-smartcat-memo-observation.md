# ADR-0028：smartcat 备忘录动作观察（方法监听 + 每日到期扫描合并一条）

Status: accepted（2026-08-23，ticket 075 用户拍板定稿）

## Context

影视观察已落地「方法监听」样板（ADR-0027：movie 域 UI 确认回调 → `notifyMovieAction`，文案构造集中 movie-source 纯函数）。备忘录域此前走 domain-source 的 JSON 事件通道计数观察（完成一项待办累计 N 件），既无动作语义、又与 UI 动作天然脱节。用户三轮回合拍板：备忘录同样只走方法监听（观察只来自 memo UI 确认回调；AIAgent 同步等非 UI 写入天然不收），另加 smartcat 侧每日到期扫描（每天只扫一次，合并成一条观察）。

## Options

- A（采纳）方法监听 + 每日到期扫描：memo UI 7 处动作挂点（添加/编辑 α 合并/完成×2/恢复/延后/切换优先级/删除）调 `notifyMemoAction`，文案构造集中 `memo-source.ts` 纯函数（`buildMemoActionText` + `memoDueObservation`）；每日到期扫描并入现有 30s 反射调度 tick，当天已扫过跳过（`editingData.dueScan` 持久化跨重启去重），读 memo.json 不动 memo 域。
- B 保留 domain-source memo extract 计数观察 + UI 挂点双通道：同一动作「方法一条 + JSON 事件一条」双记录（影视 ADR-0027 已踩过的坑），且计数观察无动作语义——弃。
- C 事件快照 diff（vault modify 比对）：逐字输入/自动保存连发会刷屏（影视 ADR-0026→0027 已被用户否决的路线），且 JSON 写入无中间态可辨——弃。

## Decisions

- 观察**只**来自方法调用：memo 域 8 处挂点（`_handleAddSave` 添加/编辑分支、卡片复选框完成、抽屉标记完成、恢复未完成、延后 1/3 天、切换优先级、删除确认）调 `notifyMemoAction`；完成入口去抖 300ms 内、notify 放 completeItem 调用处。
- 文案构造集中 `memo-source.ts`：添加=键值式（场景→脚本→课程→优先级→截止→笔记，有才加）；编辑=α 合并一次保存一条（标题变→「你编辑了待办「新标题」」+（变更列表），仅标题变→「你改题为「新标题」」，标题没变→「你更新了待办「X」：…」，无变化不产出）；完成/恢复/延后/优先级切换/删除仅标题。
- **每日到期扫描**（smartcat 侧，不动 memo 域）：并入 `startReflectionScheduler` 每次 30s tick 检查——`editingData.dueScan.date != 今天` 才扫（当天已扫过跳过不空转）；读 `CONFIG/STORAGE/memo.json`（vault.read）→ `memoDueObservation`（今天到期 `getDueStatus==='today'` 语义：dueDate==今天 且 dueNorm>now，且未完成）→ 合并一条「你有 N 个待办今天到期：<title>（HH:mm）…」（≤5 截断，多出「等 N 个」，N=0 不产出）→ `addObservation(source 'memo')`；扫描日期持久化 `editingData.dueScan = {date: 'YYYY-MM-DD'}`（同 proactiveCare 先例，旧数据缺省容忍）。
- `unloadSmartCat` 随反射调度 `stopScheduler` 一并清理（到期扫描无独立 timer）。
- domain-source 移除 memo extract，防 JSON 事件通道双记录。
- 守卫：`notifyMemoAction` 与到期扫描在 smartcat 未初始化 / `noteSource` 关闭时静默；importance 打分走 addObservation 通用链路（不手动打分）。

## Consequences

- 备忘录动作观察语义化：一条动作一条记忆，无时间窗口、无逐字噪音；每日到期一条合并，不刷屏。
- smartcat 与 memo 域新增依赖边：src/memo/ui.ts → src/smartcat（notifyMemoAction）。方向单向（smartcat 不 import memo），符合 ADR-0002 域间显式 import。
- 行为变更：旧「完成了一项待办（累计 N 件）」计数观察被 UI 动作观察取代（domain-source memo extract 移除）；旧记忆不迁移（兼容冻结）。
- memo.json / smartcat.json 数据格式零改动（editingData.dueScan 为新字段，旧数据缺省容忍）；MemoryStreamEntry source `memo`。
- 代价：手改 memo.json、AIAgent 同步等非 UI 写入不再观察（用户拍板：方法监听天然排除批量同步）；每日到期扫描依赖 smartcat 已初始化。