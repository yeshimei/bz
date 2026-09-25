# 450 脸谱生成：详细进度 + 后台化 + 断点续跑

## 需求（2026-09-25 用户拍板）

1. 画脸谱给**详细进度条 + 进度说明**：阶段化（切批 → 逐批采集 → 画像 → 时间线），逐批带日期区间与条数，超大记录要讲清抽样规则，不让用户困惑。
2. **关闭窗口再打开不会消失**：生成与面板生命周期解耦，关面板转后台继续。
3. **重启也会续上**：生成状态持久化；已完成批次的结果落盘，重启后续跑不重烧已付批次。
4. 超大信息（数万条消息）不困惑：切批/抽样/调用次数预告先行说明。

## 设计口径

- 引擎化：`src/people/jobs.ts` 新建 GenerationEngine（模块级单例，独立于面板生命周期）；
  任务队列（多人顺序），每批 AI 采集完成后原子落盘 `CONFIG/STORAGE/people-jobs.json`。
- 持久化内容：批元数据（from/to/count/媒体数）+ 已完成批的提炼结果（events/quotes/moments/traits JSON）+
  画像/时间线成品 + 消息集指纹（msgCount + 末条 key）。**聊天原文与批内对话行不落盘**（ADR-0191）。
- 续跑判定：指纹一致 → 跳过已完成批次继续；指纹漂移（中途导入过新数据）→ 任务判废，提示重新生成。
- 进度模型：percent = (已完成批 + 已完成成文阶段) / (总批数 + 2)；阶段文案示例——
  - 切批：`消息 20773 条 → 35 批（每批 ≤400 条 · ≤12000 字），共 37 次 AI 调用`
  - 抽样：`消息 91234 条 → 300 批超上限，均匀抽样 60 批（覆盖全时段，首尾必保）`
  - 采集：`第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条`
  - 成文：`素材采集完成：事件 214 · 原话 63 · 场景 88 → 正在生成画像`
- UI：面板进度块（进度条 + 阶段文案 + 多人队列 `（2/5 人）`），重开面板/重启后渲染当前任务态；
  中断任务出「继续生成」；运行中出「暂停」。
- digest.buildFace 的 onProgress 升级为阶段化进度回调（extracting/portrait/chronicle + 当前批元数据）。

## 分工

- E1：jobs.ts（引擎 + 持久化 + 续跑判定）、digest.ts/incremental.ts（阶段化进度回调）、相应测试。
- E2：ui.ts（生成链改走引擎 + 进度块渲染 + 重开/中断续跑入口）、render.ts（进度块 html）、相应测试。
- 接口契约见两代理提示词（jobs.ts 独属 E1；ui/render 独属 E2；digest/incremental 独属 E1，E2 只消费）。

## E1 交付契约（2026-09-25 E1 落地后补；E2 按此接线）

### jobs.ts 引擎 API

```ts
// 目标（msgs 必须是全量预览桶消息 previewToUnified(pv.msgs)——续跑重读预览桶校验指纹的前提）
startJobs(app, targets: JobTarget[], opts?: JobStartOptions): Promise<{ queued: string[]; skipped: string[] }>
// JobTarget = { talker, name, msgs, kindCounts?, skippedCount?, fileLabel, insights? }
// JobStartOptions = { mode?: 'full'|'incremental'|'auto'（缺省 auto=引擎自己跑 planIncremental）,
//                     chunkOpts?, askExtract?, askPortrait?, oldOf? }
// 想等整批跑完：await startJobs(...); await whenIdle();

resumeJobs(app, ai?: { askExtract?, askPortrait? }): Promise<void>  // 启动扫描 running→interrupted；会话内幂等（已启动不覆盖内存队列）
resume(talker): boolean          // paused/interrupted → 续跑（排队待跑也是 paused 态，runner 按序拾起）
pauseJobs(): void                // 当前批完成后停；成文两调用照常收尾；队列不再拾起后续
removeJob(talker): Promise<boolean>  // 删除任务（运行中的也删，当前 AI 调用作废）；async，落盘后 resolve
subscribe(fn: (s: JobsSnapshot) => void): () => void  // 订阅即推一次当前态；此后每次落盘/阶段推进都推
snapshot(): JobsSnapshot
whenIdle(): Promise<void>        // 等队列跑空
fingerprintOf(msgs): { msgCount, lastMsgKey }  // 指纹推导（测试构造崩溃现场用）
getJobsFilePath() / JobStore     // CONFIG/STORAGE/people-jobs.json（storagePath 覆盖基目录）
__resetJobsForTests()            // 测试隔离
DRIFT_ERROR = '消息集已变化（导入过新数据），请删除任务后重新生成'
```

### JobsSnapshot

`{ queue: JobView[]; currentIndex: number; running: boolean }`；
`JobView = PersonJob & { batchesTotal: number; queueIndex: number; queueTotal: number }`（派生字段不落盘，进度块直用）。

### PersonJob 关键字段（done 后产物位）

- 产物：`portrait` / `chronicle` / `events`（全量合并）/ `quotes`（抽样后）/ **`material.traits` 与 `material.moments`**（抽样后，注意在 material 里不是顶层）+ `material.mediaNote/statsNote`。
- 落 ImportRecord 用：`importRecord = { fileLabel, skippedCount, messageCount（实际进提炼的条数）, timeFrom, timeTo }` + `stats`（完整 ContactStats，含 kindCounts）。随手记并入（mergeManualEvents）与锚点写回在 ui 层写 people.json 时做。
- 进度：`stage`（chunked/extracting/portrait/chronicle/done）、`message`（切批/抽样/逐批/成文文案，口径见设计节）、`error`、`batchesDone`、`chunks`（批元数据，无对话原文）。

### 行为口径

- 引擎自跑 planIncremental（auto）；E2 预筛 skip 后交 startJobs 也不会双跳（引擎重复判定幂等）。
- 增量续跑：重读预览桶 + 人物卡 → 重推导提炼集 → 重切批与落盘批元数据比对 → 双保险判漂移。
- done 后任务保留在队列里（E2 落盘后可 removeJob 清理）；重复 startJobs 同一 talker = 替换为新任务。

### digest.ts / incremental.ts 新签名（破坏旧位置参数，ui 旧调用点已由 E2 改走引擎）

```ts
buildFace(askExtract, askPortrait, messages, name, opts?: FaceRunOptions): Promise<BuiltFace>
buildFaceIncremental(askExtract, askPortrait, msgs, name, old, opts?: FaceRunOptions): Promise<BuiltFace>
// FaceRunOptions = { chunkOpts?, mediaNote?, statsNote?, onProgress?: (p: FaceProgress) => void, onMaterial?: (c: MaterialCounts) => void }
// FaceProgress = { stage: 'extracting'|'portrait'|'chronicle', done, total, current?: ChunkMeta }  // extracting total=抽样后批数
// MaterialCounts = { events, quotes, moments, traits }  // 合并去重后、抽样前口径（成文文案「事件 214 · 原话 63 …」）
// 新导出：DEFAULTS / chunkMetaOf / mergeBatches / toPortraitMaterial / mergeWithOld（incremental）
```
