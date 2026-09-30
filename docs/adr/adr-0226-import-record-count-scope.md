# ADR-0226 · 导入记录的条数是「这份导出有多少条」，不是「这次提炼了多少条」

日期：2026-09-30 · 状态：已采纳 · 关联：ADR-0196（任务链 / 逐批原子落盘）、
ADR-0197（聊天仓唯一写者）、ADR-0225（本次同批实测的另一半）、issue 523

## 背景

用户实测（承 521）：「我重跑了一遍丘羽的脸谱生成，待描写的图片清零了，但是新素材一条是什么？
正常情况下，应该是清空直接开始生成按钮就禁止点击了。」

保库解锁后核丘羽记录，看到的事实：

```
lastProcessedTs: 1772842528000            (= 2026-03-07T00:15:28，导出末条)
imports: [
  { messageCount: 1, timeFrom: 2025-07-29T09:12:02, timeTo: 2026-03-07T00:15:28 },
  { messageCount: 1, timeFrom: 2025-07-29T09:12:02, timeTo: 2026-03-07T00:15:28 },
]
聊天仓 msgs: 2434
```

两次运行都写下了 `messageCount: 1`——而跨度是整整七个月。落盘处三写三错，口径都一样：

| 位置 | 条数取 | 跨度取 |
|---|---|---|
| `jobs.importRecordOf(t, digestMsgs)` | `digestMsgs.length`（本次提炼子集） | `t.msgs`（全量） |
| `jobs` 引擎 refresh 路径 | `digestMsgs.length` | `bucketMsgs`（全量） |
| `ui.persistJobDone` | 优先 `job.importRecord.messageCount` | `msgs`（全量） |

`ImportRecord.messageCount` 有两个消费者，**都要求全量口径**：

1. **界面「消息总数」**：`render.ts` 三处 `imports.reduce((s, r) => s + r.messageCount, 0)`。
   记 1 条 ⇒ 界面说「共 2 条消息」——数据本身就是错的。
2. **`incremental.planIncremental` 判「同一导出再导」的整份指纹**（`messageCount` + `timeFrom` + `timeTo`
   三项全同才算命中，评审 P2-1 加的条数一半）：子集条数永远对不上全量条数 ⇒ 指纹永不命中 ⇒
   每次再导都落到 `newer` ⇒ 同秒容差（评审 P2-1b，`m.ts > anchor - 1`）又把锚点那条再算一次
   ⇒ 开工单次次报「新增素材 1 条」、按钮次次可点，还白烧一遍 AI。

> 关键：**off-by-one 不是要在 `planIncremental` 里改**。`m.ts > anchor - 1` 是评审 P2-1b 明确拍板的
> `同秒容差`（秒级导出里与锚点同秒的消息不能丢）；改成严格 `> anchor` 会让「结尾重合但内容不同」
> 的补充导出（`incremental.test.ts` 的「skip 误伤修复」场景）掉进 `older`，把整份历史当补录重烧。

## 决策

**`ImportRecord.messageCount` 恒等于「这一份导出的可消费消息条数」**，与 `timeFrom` / `timeTo` 同源、
与导入路径（`ui` 层 `importMsgs` 用 `msgs.length`）同义。「本次提炼了多少条」不进这个字段——
它属于 `job.batchesDone` / 任务进度，不属于导入记录。

三处落盘点统一：

- `jobs.importRecordOf(t)` 去掉 `digestMsgs` 入参，`messageCount: t.msgs.length`；
- 引擎 refresh 路径 `messageCount: bucketMsgs.length`（与它已经取的跨度同源）；
- `ui.persistJobDone` 有目标时取 `msgs.length`，只有「重启续跑」无目标那条路才回落到引擎落盘值。

## 后果

- 界面「消息总数」恢复正确；同一导出再导 → 指纹命中 → `planIncremental` 返回 `skip` →
  开工单出「没有新的素材」且「开始生成」置灰（issue 523 的用户诉求）。
- **在写坏之前落过盘的记录不会自愈**：丘羽现有两条 `messageCount: 1` 的记录要等它下次跑完
  （按新口径重写）才命中指纹。这是数据修复的正常代价——不用脚本直接改加密保库
  （ADR-0197：插件是唯一写入者）。
- `estimateDescribeCallsOf` / `estimatePortraitCallsOf*` 在 523 精简后失去 UI 消费者，
  保留为 jobs 的导出能力（引擎侧成本预告仍在用同源常量）。

## 关联改动（同批）

- `genPage` 只说素材：总览只列「聊天记录 N 条 / 图片 N 张 / 录音 N 条」（为零的不出）+ 逐人明细；
  砍掉服务商 / 模型 / 调用次数与长说明（用户原话：什么调用 AI 呀？调用多少次呀？这些都不需要说）。
- `GenerationConfirmInfo` 相应减肥：去掉 `provider` / `model` / `describeCalls` / `batchSize` /
  `portraitCalls`，加 `materials` / `empty` / `skipped`。
- `startGeneration` 无新素材时**照旧翻开工单**（旧行为只弹一条通知就 return，用户看不到为什么
  点了没反应）：首行「没有新的素材」+ 点名说明 +「开始生成」置 `disabled`；
  `answerGenConfirm` 兜底——合成点击派发到 `start` 也按取消结，绝不返回一个空转的「开始」。
