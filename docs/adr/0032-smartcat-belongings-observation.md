# ADR-0032：smartcat 归物本观察（方法监听，ticket 079）

Status: accepted（2026-08-24，ticket 079，用户拍板）

## Context

归物本（belongings）观察原先只有 blind 事件渠道：`src/smartcat/domain-source.ts` 里 `belongings` extract 按 `items` 键数增长发「你登记了一件新物品」——无名称、只增不减、状态流转/编辑不反映、删除后计数失真（删除导致 count 回落时根本不会触发）。按影视（ADR-0026/0027）/备忘录（ADR-0028）/聚合讯（ADR-0029）的方法监听先例，改为**方法监听**：归物本 UI 成功回调通知 smartcat，域 JSON 事件渠道 extract 移除。

## Options

- A（采纳）方法监听：belongings 域 UI 四个确认回调（添加保存 / 编辑保存 / 抽屉状态流转 / 删除确认）调 `notifyBelongingsAction(事件)`，事件带结构化数据（add=完整 item、edit=title+changes、status=title+新状态、delete=title），文案构造集中 `belongings-source.ts` 纯函数。
- B 保留计数 extract 补丁（事件 diff）：只能表达「数量增长」，编辑/状态流转/删除语义仍表达不了；删除后计数回落无法触发——用户已拍板放弃 blind 渠道。

## Decisions

- **观察集**：添加 / 编辑 / 状态流转 / 删除 4 类（用户 2026-08-24 拍板）。
- **添加文案**（键值式完整信息，字段顺序固定、有才加）：`你登记了新物品《名称》` + 顺序追加（顿号分隔）：`分类（category 原文含 emoji）`、`价格 ￥X`、`购买于 YYYY-MM-DD`、`状态 <值>`（**仅当 current_status 非「使用中」才写**——表单默认使用中，避免噪音）、`描述「…」`；name 必填（UI 已校验）。
- **状态流转**：4 态都发、不防抖，各态动词化——→闲置 `你把《X》标记为闲置`；→已转卖 `你转卖了《X》`；→已丢弃 `你丢弃了《X》`；→使用中 `你重新用起了《X》`。
- **编辑**：α 变化列表，弹窗打开时 `const snapshot = { ...item }`（旧值快照，保存时直接改 item 引用），保存后 `belongingsEditChanges(snapshot, item)` 比较——参与：name/category/purchase_price/purchase_date/current_status/description；不参与：id/created_date/last_updated；变化项名：改了名称/分类/价格/购买日期/状态/描述，'、' 分隔；**全不变 → 只发 `你编辑了物品《X》`（不带尾冒号）**。
- **删除**：`你删除了物品《X》`。
- **事件通道短路**：`onVaultActivity` 遇 `classifyPath==='belongings'` 直接 return（防 UI 动作「方法一条 + 事件一条」双记录）；`DOMAIN_FILES.belongings` 移除（「你登记了一件新物品」不再产）。
- 守卫：`notifyBelongingsAction` 在 smartcat 未初始化或 `data.config.noteSource` 关闭时静默（与 movie/memo/news 一致）；即时同步观察，无 timer/map 需清理。
- 兼容冻结：不改 belongings.json 格式、UI 结构、命令、文案；仅加 notify 挂点。

## Consequences

- 观察粒度从「物品数增长计数」细化为「4 类动作详细语义」（含名称/分类/价格/日期/状态/描述），状态流转与编辑落流，删除准确。
- smartcat 与 belongings 域产生新依赖边：src/belongings/ui.ts → src/smartcat（notifyBelongingsAction / belongingsEditChanges）。方向单向（smartcat 不 import belongings UI / 数据），符合 ADR-0002。
- 行为变更：domain:belongings 计数观察移除——旧记忆不迁移（兼容冻结：旧数据直接可读）。
- 数据零改动：belongings.json / smartcat.json 字段与格式均不动。
- 已知边界：方法监听只覆盖 UI 动作——手改 belongings.json（vault 外编辑）不再产生观察（与 movie/memo/news 同取舍）；`classifyPath` 目前对 belongings.json（非 .md）恒返回 null，短路为防御性代码（对齐影视先例）。