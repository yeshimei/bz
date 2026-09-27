# 497 · 画谱单次总确认 + 进度细化

## 背景（用户原话口径）

1. 「把两次确认放在开始画脸谱之前，合并成一次确认，让用户获取全部的情况。确认之后，后续就按流程走，不再弹任何弹窗，一直到完成为止。」
2. 「画脸谱的进度提示不够详细，不是每个步骤都有提示；每个步骤里面处理了什么东西也没有提示到。想提示的尽量多一点，让下面的进度块走得更快（细粒度推进）。」

## 现状问题

- 画谱链路两次确认（ADR-0196 决策 8）：describe 段前「图片描述确认」+ 切批定案后「画像生成确认」，逐人逐次打断。
- 进度块主行只显示 prep/describe 阶段行或「第 N/M 批」，引擎 `job.message` 的细文案（批的日期段与条数、素材采集完成统计、《其人》→《我们》→《时间线》阶段推进、prep onStep 的「加载转写引擎…」）从未上屏。
- 后段（person/bond/chronicle）主行停留在过期批号「正在生成 · 第 N/M 批」。

## 方案

### A. 单次总确认（ui 层，引擎门契约不变）

- `startGeneration`：planTargets 后、startJobs 前，组装 `GenerationConfirmInfo` 弹**一次**总确认窗（body 级，面板可不开；Esc/遮罩=取消）：
  - 总览：N 位联系人 · 图片 X 张（约 Y 次描述调用）· 语音 K 条（本地离线转写，免费）· 画像约 M 次调用；
  - 每人一行：名称 · 素材 N 条 · 图片 X 张 · 语音 K 条；
  - 服务商/模型标注（describeModelLabelOf，两段同通道）；
  - 说明行：「确认后自动完成全部步骤，中途不再询问」；
  - 按钮：开始生成 / 取消。
- 估算（纯函数进 jobs.ts，结构化入参防 ui→jobs 反向依赖）：
  - 描述调用 ≈ ceil(图片总数 / batchSizeFromSettings())；
  - 画像调用 ≈ Σ min(chunkMessages(msgs).length, DEFAULTS.maxBatches) + 3。
- 确认后：startJobs 注入**自动放行门**（`askDescribeConfirm/askPortraitConfirm = async () => 'start'`）；resumeJobs 同样自动放行（任务入队即已获授权）。
- 引擎两道门代码保留（测试/编程消费不受影响；门未注入的缺省语义不变）。
- 删除 ui 层 askDescribeConfirm/askPortraitConfirm 与 render 层 describeConfirmModal/portraitConfirmModal（生产无调用方后即为死代码）。

### B. 进度块细化（render 层）

- `JobsBlockState` 增 `stage`；主行运行态：prep 阶段行 → describe 阶段行 → 后段阶段标签（person=正在生成《其人》/ bond=正在生成《我们》/ chronicle=正在生成关系时间线 / chunked=正在切批组装素材）→ 批次文案。
- 新增副行 `bz-people-jobs-sub`：运行/暂停/中断态显示引擎 `job.message`（批详情、素材统计、阶段推进、prep step 文案全部可见）。

## 门禁

people 域测试（describe-ui 重构为总确认口径 + progressBlock 新断言）+ 全量 + tsc + 自审 + diff 审查。
