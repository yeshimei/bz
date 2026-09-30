# 523 · 开工单只说人话：素材清单 + 无新素材置灰开始

## 背景（用户原话）

> 「开始生成画谱的界面描述得太啰嗦了，要简洁一下，简明地告诉用户有几张图片、聊天记录或者录音等，
> 哪些素材要走这个补画布流程即可，其他都不需要告诉用户，什么调用 AI 呀？调用多少次呀？这些都不需要说，
> 如果没有任何新的素材，那就显示一个说明，把『开始生成』按钮禁用掉」

前置的同一条反馈（实测）：

> 「我重跑了一遍丘羽的脸谱生成，待描写的图片清零了，但是新素材一条是什么？
> 正常情况下，应该是清空直接开始生成按钮就禁止点击了。」

## 问题

### 一、开工单太啰嗦

`genPage`（render.ts）报的东西里只有「有几张图片 / 几条语音」是用户要的：

- 「图片描述 · 待描述 1615 张 · 已描述过的自动跳过 · 至多 81 次调用（每批 20 张）」
- 「语音转写 · 待转写 1289 条 · 本地离线不花钱，已转写的自动跳过」
- 「画像生成 · 智谱 Plan / glm-5.3-flash · 约 8 次调用」
- 长说明「确认后自动完成全部步骤——媒体预处理、图片描述、语音转写、素材采集与画像，中途不再询问；每批原子落盘、可随时暂停。」

调用次数 / 通道 / 幂等语义都是实现细节，用户拍板：不要。

### 二、没有新素材时按钮照旧可点（且开工单根本不翻）

`startGeneration` 在 `runnable` 为空时只弹一条通知就 return，用户看不到「为什么点了没反应」；
「开始生成」按钮也没有任何置灰逻辑。

### 三、「新增素材 1 条」——真根因不在 `planIncremental` 的 off-by-one

实测（丘羽保库记录）：

```
lastProcessedTs: 1772842528000   (2026-03-07T00:15:28 = 导出末条)
imports: [
  { cnt: 1, from: 2025-07-29T09:12:02, to: 2026-03-07T00:15:28 },   ← 两次运行都记了 1 条
  { cnt: 1, from: 2025-07-29T09:12:02, to: 2026-03-07T00:15:28 },
]
聊天仓 msgs: 2434
```

导入记录的 `messageCount` 记的是**本次提炼子集条数**（增量只跑 1 条就记 1），而 `timeFrom` / `timeTo`
用的是全量跨度：

- `jobs.importRecordOf(t, digestMsgs)` → `messageCount: digestMsgs.length`，跨度却取 `t.msgs`；
- 引擎 refresh 路径（jobs.ts）同样 `messageCount: digestMsgs.length`，跨度取 `bucketMsgs`；
- `ui.persistJobDone` 优先取 `job.importRecord.messageCount`。

而 `messageCount` 有两个消费者，都要**全量口径**：

1. 界面的「消息总数」（`render.ts` 多处 `imports.reduce((s, r) => s + r.messageCount, 0)`）；
2. `incremental.planIncremental` 判「同一导出再导」的整份指纹（条数 + 跨度）→ 命中则 `skip`。

记成子集条数 ⇒ 指纹永不命中 ⇒ 每次再导都落到 `newer`（同秒容差又把锚点那条再算一次）
⇒ 开工单永远报「新增素材 1 条」、按钮永远可点、还白烧一遍 AI。

> 注：`planIncremental` 的 `m.ts > anchor - 1`（同秒容差）**不动**——它是评审 P2-1b 明确拍板的行为
> （秒级导出里与锚点同秒的消息不能丢），把它改成 `> anchor` 会让「结尾重合但内容不同」的补充导出
> 掉进 `older` 整个重烧。修条数口径即可让指纹重新命中。

## 方案

1. **条数口径统一为全量**：`jobs.importRecordOf(t)` 取 `t.msgs.length`；引擎 refresh 路径取
   `bucketMsgs.length`；`ui.persistJobDone` 取 `msgs.length`。与导入路径（`msgs.length`）一致。
2. **`GenerationConfirmInfo` 减肥**：砍掉 `provider` / `model` / `describeCalls` / `batchSize` /
   `portraitCalls`，加 `materials`（聊天记录合计）、`empty`、`skipped`。
3. **`genPage` 只说素材**：总览只有「聊天记录 N 条 / 图片 N 张 / 录音 N 条」三行（为零的不出）；
   逐人明细；有素材时不再出长说明。
4. **无新素材**：`startGeneration` 照旧翻开工单——首行「没有新的素材」、一句点名说明、
   「开始生成」置 `disabled`；`answerGenConfirm` 兜底：即使合成点击派发到 `start` 也按取消结。
5. **旧记录的误报不用等下次跑完**（ADR-0226 补偿节）：旧版把条数记成子集条数 ⇒ 指纹永不命中，
   而同秒容差又把锚点那条自身当候选。ui 预筛层加一条——**候选全停在锚点一秒内 = 上次那批**，
   按「没有新素材」结；只要有任意一条严格晚于锚点就照常跑。全库 25 位实测：20 位判回无新素材。

## 验收

- [x] `genPage` 输出里不出现「调用」「模型」「元/￥/¥/$」
- [x] 无新素材：`empty` 置位 → 说明 + `disabled` 按钮，且不起引擎
- [x] 同一导出再导：导入记录条数 = 全量条数 → 指纹命中 → `skip`
- [x] 候选全停在锚点一秒内 → 按无新素材结；有严格晚于锚点的候选 → 照常进引擎
- [x] `pnpm test` + `pnpm exec tsc --noEmit` 全绿；共享原型产物重出
