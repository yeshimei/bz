# 453 · 超大量脸谱断点续跑：单批重试 + 续跑不重烧

## 现象

大琳 18477 条（切 ~47 批）跑脸谱，中间 AI 报错一次，任务停；用户再点「画脸谱」，**从第 1 批重新烧**。
用户的判断是「不是说好处理一批存一批吗」——落盘确实每批都在做，问题出在**入口**和**错误处理**。

## 根因（三条叠加，逐条已验证）

### R1 · 单批 AI 失败即整任务终止，无重试

`jobs.runJob` 批循环（src/people/jobs.ts:588-593）：`extractBatch` 抛错 → `finish({status:'error'})` → 整个任务停。
47~101 批里任意一次的**网络抖动 / 限流 / 超时 / 输出截断**都会让任务停在第 N 批。
没有重试，没有退避。

### R2 · error 态的进度块只给「删除任务」，没有「继续生成」

`render.JOBS_ACTIONS`：`error → { label: '删除任务', hook: 'data-people-jobs-dismiss' }`。
这是 450 遗留（当时 error 不可续，451 才放宽 `resume()` 接受 error 态，但**只改了印章，漏了进度块**）。
所以用户在进度块上看到的唯一出路是「删除任务」——而删了已完成的批次就真没了。用户不敢删，于是走别的入口。

### R3 · `startJobs` 对同人一律替换 = 从第 1 批重烧（主因）

`jobs.startJobs`（src/people/jobs.ts:373-374）：`st.queue = st.queue.filter(j => j.talker !== t.talker)` + push 全新任务
（`batchesDone: 0, results: []`）——**不继承任何已完成批次**。

而 error 态下 `ui.jobsBusy()` 为 false（只挡 running / paused），所以这些入口都会一路走到替换：

| 入口 | 路径 | 结果 |
|---|---|---|
| 封面墙印章「继续生成」 | `sealAction('resume')` → `jobs.resume` | ✓ 续跑（451 已修） |
| 封面墙印章「画脸谱 / 补画」 | `sealAction('draw'/'redraw')` → `generateOne` → `startGeneration` → `startJobs` | ✗ 重烧 |
| 详情头「画脸谱」 | `generateOne` → `startGeneration` → `startJobs` | ✗ 重烧 |
| 数据源弹窗「画脸谱」 | `generateFromDs` → `startGeneration` → `startJobs` | ✗ 重烧 |

叠加 R2：用户被 error 态进度块引导到「删除任务」之外的第二好选择——重新画一次，正好踩中重烧。

## 修法

### F1 · 批级自动重试（jobs.ts）

`extractBatch` 失败重试至多 `maxRetries`（缺省 2：最多 3 次尝试），退避 1s / 3s。
重试期间 `message = 第 X/Y 批失败（原因）——正在重试 k/2…` 并推快照（用户看得见它在自愈）。
`AbortError`（用户取消）不重试，立即收手。
退避函数可注入（`opts.sleep`）——测试不真等。
最终仍失败才 `error`，且文案带断点：
`第 X/Y 批提炼失败：<原因>；已完成 N/Y 批（无需重来，点「继续生成」从这批重试）`

### F2 · error 态进度块按可续性给动作（render.ts + ui.ts）

`JobsBlockState` 加 `resumable`；`JOBS_ACTIONS.error → 继续生成`；
仅当 `resumable === false`（漂移判废 `DRIFT_ERROR`，续跑必然再判废）才出「删除任务」。
口径与印章 `sealJobOf.resumable` 同源（抽 `isResumable(job)` 单一判定）。

### F3 · `startJobs` 复用已完成批次（jobs.ts，主修）

同名 talker 已有任务，且同时满足：

- 旧任务 `status !== 'done'`
- 旧任务 `batchesDone > 0`（有已付费成果）
- 指纹一致：`fingerprintOf(t.msgs)` 与 `job.msgCount / job.lastMsgKey` 相等（预览桶没动过）
- 模式一致：本次推导的 `effective === job.mode`
- 切批参数一致（同一份 `chunkFull`）

→ **复用旧任务对象**：保留 `results / batchesDone / chunks / stats / material / portrait / chronicle / events / quotes`，
只把 `status` 置 `'paused'`（待跑）、清 `error`、更新 `name / fileLabel / importRecord / msgCount / lastMsgKey / message`。
否则（指纹变了 / 无成果 / 已 done / 模式变了）照旧整体替换。

批次元数据不重切：`runJob` 本就在开跑前按同一逻辑重切并比对 `job.chunks`，不一致即判漂移——兜底仍在。

返回值加 `resumed: string[]`，ui 提示区分「已开始生成」与「从第 N 批继续（不重画）」。

### F4 · 入口分流 + 文案（ui.ts + render.ts）

- `generateOne(id)` 开头先看该人有无**可续任务**（非 running / 非 done，且 `resume()` 受理）→ 直接续跑，不碰 `startJobs`。
  这一道闸覆盖详情头按钮与印章的「画脸谱 / 补画 / 重新生成」。
- 详情头工具条的画笔按钮按任务态换图标与提示：有可续任务 → 刷新图标 + 「继续生成（已完成 N/M 批，不重画）」。

## 不做（记下）

- **截断类失败**（单批输出超长导致 JSON 解析失败）重试无效——需要拆批重试，另开 issue。
- **漂移判废的自动续跑**：目前仍判废（`DRIFT_ERROR`）。理论上「预览桶只追加」时前缀批可复用，
  但需要引入「已完成边界消息键」并可证明重切批前缀稳定，复杂度高，另议。
- 单批最终失败**不跳过**：静默缺料比失败更坏——保留 error 可续，用户点继续会重试该批。

## 验收

- 单测：批级重试（中途成功 → 任务 done；重试耗尽 → error 且 `batchesDone` / `results` 保留）
- 单测：`startJobs` 复用（error 中断后重新 startJobs 同靶 → 已完成批次不重烧、`askExtract` 只调剩余批；指纹变 → 整体替换从 0）
- 单测：进度块 error 可续出「继续生成」，不可续出「删除任务」
- 单测：详情头有可续任务时按钮走续跑（不触发 `startJobs`）
- 全量 `vitest run` + `tsc --noEmit` 绿；原型产物重出；合并回 master 后主仓构建部署
