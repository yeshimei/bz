# 075 — smartcat 备忘录观察域（memo 动作观察 + 每日到期扫描）

Status: done（2026-08-23 实现完成，worktree/memo-observation 提交）

## 需求 → 观察文本（用户拍板定稿）

观察只来自 **memo UI 确认回调**（方法监听，对齐影视样板 notifyMovieAction）；AIAgent 同步等非 UI 写入天然不收（用户拍板「不收批量同步」）。

| 动作 | 挂点（src/memo/ui.ts） | 观察文本 |
|---|---|---|
| 添加 | `_handleAddSave` 添加分支（约 586 行 addItem） | `你添加了待办「<title>」（场景：<scene>，脚本：<scriptName>，课程：<courseName>，优先级：<重要/次要>，截止：<MM-DD HH:mm>，笔记：<notePath 路径尾名>）` —— 键值式，**有才加**，键顺序：场景→脚本→课程→优先级→截止→笔记 |
| 编辑 | `_handleAddSave` 编辑分支（约 558 行 updateItem） | **方案 α 合并一条**，见下 |
| 完成 | 卡片复选框（978）+ 抽屉「标记完成」（1035） | `你完成了待办「<title>」` |
| 恢复未完成 | 抽屉（1046） | `你把待办「<title>」恢复为未完成` |
| 延后 | 抽屉 延后 1/3 天（1055） | `你把待办「<title>」延后到了 <MM-DD HH:mm>` |
| 切换优先级 | 抽屉（1073） | `你把待办「<title>」转为<重要/次要>` |
| 删除 | 确认弹窗 onConfirm（1097） | `你删除了待办「<title>」` |

### 编辑的 α 合并摘要（一次保存一条）

对比保存前后条目（旧值来自 editItem/保存前读取）：
- **标题变了** → 主句 `你编辑了待办「新标题」`，其余变更并入 `（变更列表）`。
- **标题没变** → 主句 `你更新了待办「X」` + `：` + 变更列表（无变更不产出）。
- 变更项（列表，`、` 分隔）：
  - 标题：`改题为「新标题」`（仅标题变且无其他变更时为主句）
  - 场景：`场景改为「工作」`
  - 课程：`添加课程「X」` / `课程改为「X」` / `删除课程`
  - 脚本：`添加脚本「X」` / `脚本改为「X」` / `删除脚本`
  - 定位 notePath：`关联笔记 <名>` / `笔记改为 <名>` / `删除笔记关联`
  - 截止 due：`设截止 <MM-DD HH:mm>` / `截止延到 <MM-DD HH:mm>` / `清除截止日期`
  - 优先级：`优先级改为<重要/次要>`（抽屉快捷「切换优先级」才单列，编辑弹窗并入 α）
- 示例：`你编辑了待办「写周报」（课程改为「算法」，场景改为「工作」，关联笔记 书库/1984.md）`
  `你更新了待办「重构 AIAgent」：课程改为「算法」、删除脚本「主页」、截止延到 09-01 12:00、清除截止日期`

### 每日到期扫描（用户拍板：每天只扫描一次，合并成一条观察）

- smartcat 侧定时扫描 `CONFIG/STORAGE/memo.json`（不动 memo 域），每天一次：
  - 挑「今天到期（getDueStatus==='today' 语义）且未完成」的条目（复用 or 对齐 src/memo/due.ts 的 getDueStatus 逻辑：dueDate == 今天 且 dueNorm > now）；
  - **合并一条观察**：`你有 N 个待办今天到期：<title1>（HH:mm）、<title2>（HH:mm）…`（条目 ≤5 截断，多出 `等 N 个`；N=0 不产出）；
  - **每日一次去重跨重启**：扫描日期持久化在 smartcat.json `editingData.dueScan = {date: 'YYYY-MM-DD'}`（同 proactiveCare 先例）；仅当记录日期 != 今天 且 今天已过凌晨（默认任意时刻首次检查即扫）才扫描并更新日期；editingData 缺省兼容。
  - 触发时机：并入现有 30s 反射调度（startReflectionScheduler）或独立每日 timer——**推荐**：刷新调度里每天检查一次（当天已扫过则跳过，不空转）。

## 接线与收口

- 新增 `src/smartcat/memo-source.ts`（movie-source 同款：文案构造纯函数 + `MemoActionEvent` 联合类型 + `buildMemoActionText`；含到期扫描的 `memoDueObservation(items)` 纯函数，可单测）。
- `src/smartcat/index.ts` 新增 `notifyMemoAction(evt)`（对齐 `notifyMovieAction`：未初始化 / `data.config.noteSource` 关 → 静默；fire-and-forget addObservation，source `memo`）/ `maybeMemoDueScan()` 调度与 `editingData.dueScan` 读写。
- `src/smartcat/domain-source.ts`：**移除 memo extract**（`DOMAIN_FILES.memo` 删除或 extract 返回 null），防 JSON 事件通道双记录。
- memo 域（src/memo/ui.ts）挂点 7 处调 `notifyMemoAction`；completed/priority/due 等字段变化由各挂点显式传参（参照影视挂点模式：事件带结构化数据，文案构造在 memo-source）。
- smartcat `unloadSmartCat` 清理到期扫描 timer。

## 观望不做的

- AIAgent 同步 / 非 UI 写入 → 不收（方法监听天然排除）。
- 归档视图切换、复制内容 → 不观察。
- 旧「完成了一项待办（累计 N 件）」记忆不迁移（兼容冻结）。

## 测试

- `tests/smartcat/memo-source.test.ts`：buildMemoActionText 全动作（添加键值式有才加/编辑 α 合并各变更项/完成恢复延后优先级删除）、memoDueObservation（合并一条/截断/空不产出/日期语义）。
- `tests/smartcat/memo-action.test.ts`（集成，仿 movie-action.test.ts）：ensureSmartCat 后 notifyMemoAction → stream 断言；noteSource 关静默；maybeMemoDueScan 当日去重（editingData.dueScan 写入、第二天重置后可再扫——用可注入 now 或直接改 editingData 模拟）。
- `src/memo/ui.ts` 挂点不破坏既有 movie/ui.test.ts；全量 npm test + tsc --noEmit。

## 文档

- `docs/adr/0028-smartcat-memo-observation.md`（Context/Options/Consequences：方法监听 + 每日到期扫描合并一条）。
- spec.md 备忘录 US 23 + 事件监听小节（domain-source memo 移除）；CONTEXT.md 记忆流词条补 memo 观察；PROGRESS.md 追加条目。

## 兼容

- memo.json / smartcat.json 数据格式零改动（editingData.dueScan 为新字段，与 proactiveCare 并列，旧数据缺省容忍）；MemoryStreamEntry source `memo`。
- domain-source memo extract 移除 = 行为变更（旧计数观察被 UI 动作观察取代），旧记忆不迁移。