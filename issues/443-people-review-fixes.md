# 443 — people 评审修复（P1×3 + P2×5，P2-4 另票、P2-6 本档）

issue 439-442（脸谱档案随手记 / 互动统计 / 增量提炼 / UI 深化）合并 master 后的代码评审修复票。
评审确认无 P0；本票修 P1 全部 3 项 + P2 的 1/2/3/5/7 共 5 项，P2-4 明确不做（跨域改动另票），P2-6 即本档。

## P1（必修）

### P1-1 增量素材合并改均匀抽样，旧素材不再挤出新素材
- 原状：`buildFaceIncremental` 里 quotes `dedupeByText([...old, ...new]).slice(0, 60)`、画像 / 时间线素材 `events.slice(0, 300)`，都是旧在前留头——旧素材满额时新素材整批进不了 prompt。
- 修复：`digest.ts` 的 `evenlySample` 加 `export`；合并去重后 `evenlySample(merged, 60)`（quotes）、`evenlySample(events, 300)`（画像与时间线素材），首尾必保、按时间跨度均匀取。落盘的 `digest.events` 保持全量，抽样只影响送 prompt 的口径；上限与 `MATERIAL_LIMITS`（quotes 60 / moments 40 / traits 30 / chronicle 300）对齐。
- 位置：`src/people/incremental.ts`（`buildFaceIncremental`）。

### P1-2 编辑态变量不随面板关闭重置
- `closePeoplePanel()` 补 `profEditId = null; noteAddId = null;`；原「不用动 closePeoplePanel」的注释假设有误，已改为「面板关闭在 closePeoplePanel 一并重置」。
- 位置：`src/people/ui.ts`。

### P1-3 核心判定逻辑迁出补测
- 新建 `src/people/incremental.ts`：`planIncremental` / `buildFaceIncremental` / `dedupeEvents` / `dedupeByText` / `mergeManualEvents` 从 ui.ts 迁出（签名不变，ui.ts 改 import，行为不变）；`estimateCost` 因依赖 ui 层 peopleSnap 快照留在 ui.ts。
- 新建 `tests/people/incremental.test.ts`（node 环境）：planIncremental 四模式（full / newer / older / skip）、dedupeByText 去重、mergeManualEvents 去重排序、buildFaceIncremental 假 ask 全流程（抽样保尾、kind 回填、时间线兜底）。
- `tests/people/data.test.ts` 补 `mergeInto` 用例：imports 按 importedAt 升序合并、manualEvents 按 ts 升序合并、digest 继承（to 无脸谱继承 from 的，已有则保留自己的）、from 被移除、fromId === toId 直接返回。

## P2

### P2-1 skip 误伤（planIncremental）
- a) skip 前先过整份指纹：`existing.imports` 里不存在 `messageCount === msgs.length && timeFrom === from && timeTo === to` 的记录时不 skip——指纹检查前移到锚点过滤之前（同一导出再导直接 skip，含锚点同秒的尾巴也不会重炼）；结尾重合但内容不同的导出继续走 newer / older，不再静默丢。
- b) 锚点过滤同秒容差：`m.ts > anchor` 改为 `m.ts > anchor - 1`（即 `ts ≥ anchor`），秒级导出里与锚点同秒的消息不再丢。
- 单测：`incremental.test.ts` 中「同秒容差」「skip 误伤修复」两例。

### P2-2 skip 不落 0 记录（runGeneration）
- skip 路径不再 `appendImport`（不再产生 messageCount=0 的空记录）；该人物全部导入记录都没有 stats 且本次本地算出了 stats 时，补写到最近一条 ImportRecord（没有记录则跳过）；顺带应用改名。

### P2-3 merge 模式删除按钮误触（applyWall）
- 合并选择模式（`mergeFromId` 非空）下卡片不渲染删除按钮——该模式下卡片点击被「选目标」分支先吃掉，删除按钮是够不着的诱误触陷阱。单人库（canMerge=false）保留删除入口，不受影响。

### P2-5 统计口径说明（renderInsights）
- 互动数据卡 meta 行补一句「共 X 条文本（形态占比含图片/语音等全部消息形态）」——「共 X 条」只数进提炼的文本消息，与形态占比分母不同。数据未动。

### P2-7 合并确认横幅补画像说明（renderList）
- 确认横幅补「对方（from）的脸谱不带入，合并后建议重画」，让用户明确 from 的 digest 处置。

### P2-6 留档
- 即本文件。

## 不做 / 已知取舍

- **P2-4（cleanFileNameOf 上收 core）不做**：与 clipbook 同款函数的归并属跨域改动，另开票。
- **traits / moments 不持久化导致重画性格漂移**：增量重画时特质 / 场景素材只来自新批次（旧 digest 不存这两类），多次增量后画像的性格侧可能向新素材漂移。留作后续票（需先定 digest 结构是否扩 traits/moments 字段及其与旧数据兼容口径）。
- planIncremental 指纹（条数 + 跨度）理论上有极小概率把「恰好同条数同跨度」的不同导出误判为重复；真实导出粒度下概率可忽略，未加文件名参与指纹（文件名可能重命名，参与反而误伤）。

## 门禁记录（worktree `feat/people-review-fixes`）

- `pnpm exec tsc --noEmit`：0 错误。
- `pnpm vitest run tests/people/`：63 用例全绿（存量 48 + 新增 15）。
- 三守卫（d3-write-gate / bd-paradigm-hover-isolation / css-aggregation-manifest）：全绿。
- `pnpm test` 全量：全绿。
- worktree 内未构建（禁令遵守）。
