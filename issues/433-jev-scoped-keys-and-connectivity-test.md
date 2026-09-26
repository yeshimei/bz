# 431 · Jev 密钥/模型按服务商分存（切换联动）+ LLM/JEV 密钥行「测试」按钮

- 状态：已实现（2026-09-24）
- 用户原话①：「切换不同的服务商的时候，下面的key跟模型的名字也要跟着换的」
- 用户原话②（grill-with-docs 拍板）：「按推荐的来，q4 按钮的名字可以变成两个字吗？」——按钮定名「测试」
- 关联：issue 430 + ADR-0188（博查入册，本票是其直接后果——两家共用一组键立刻互相覆盖）/
  issue 424 + ADR-0184（Jev 组三行收口，本票改其绑定形态）/ ticket 172（LLM per-provider
  覆盖 map 范式，本票照办）/ ADR-0148（max_tokens 面板独裁，测试按钮不绕过）
- 号位说明：431/432 已被并行会话占用（Jev 重排设计 / 观影分析），改号 433；ADR-0189 同被占用，改号 ADR-0190

## 背景与目标

博查入册后，`jevApiKey` / `jevModel` 两个全局键成了两家共用的一个槽：切服务商必须手抄密钥、
手改模型，否则拿 Typesafe 的 key 打博查（或反之）。用户要求：**切服务商，下面的 key 和模型名
跟着换**。同时要求给 LLM 与 JEV 的密钥输入框前各加一颗按钮：**跑一次真实调用验证连通**。

经 grilling 拍板四项：

1. **行形态 = 保持三行**（服务商/密钥/模型），密钥与模型行走三函数绑定 + refreshKey——
   切下拉，两行显示值原地换成该家存的那份；不做 visibleWhen 每家一行（LLM 密钥范式）。
2. **存储 = 两张按服务商分存的 map**（`jevApiKeys` / `jevModels`，键 = 服务商 id，空 = 删键）；
   旧全局键一次性迁入 typesafe 槽位后退役（存量用户无感）。
3. **测试口径 = 真实调用**：JEV 发一道 noul 小题走完整判定链（鉴权/报文/解析全过）；LLM 走
   现成 AI.ask 链路（含流式与兜底）发极小请求。成功/失败都弹通知（带服务商、模型、耗时）；
   成功 = 链路无抛错且回复非空（哑响应不算通）。deepseek/智谱会花一分钱以下的真实费用。
4. **按钮 = 密钥行行内「测试」**（RowAction 渲染在输入框左侧）：LLM 每家密钥行各一颗
   （按行锁定服务商 id），JEV 单行一颗（测当前服务商）。

## 决策

- **迁移**：`migrateRetiredJevKeys` 扩展——`jevApiKey` → `jevApiKeys.typesafe`、`jevModel` →
  `jevModels.typesafe`（非空才搬，搬运前仍做 `jev-1.13.0` → `jev-latest` 改写），随后两键删除；
  已有 map 时只写 typesafe 槽位、不动其他服务商。幂等口径不变（C16）。
- **解析单源**：`resolveJevConfig` 读当前服务商的 map 槽位（密钥空 = 未配置；模型空 = 该家
  `defaultModel`），`isJevConfigured` 口径随之自然修正——**只看当前服务商那格**，另一家配了
  不算数。core/jev 是分存键的唯一读者，schema 的三函数绑定只做读写转发。
- **UI 联动**：refreshKey 挂当前服务商槽位值，任意行变更后渲染器重读——切换即换值，零专门代码；
  「获取模型」照 LLM 模型行补竞态护栏（拉取期间服务商被切 → 弃用结果提示重试）。
- **测试按钮的数据层**：`core/jev.testJevConnectivity()` / `core/ai.testAIConnectivity(providerId?)`
  独立成函数（可单测、可复用），schema 的 onClick 只做「落盘防抖值 → 调函数 → 弹通知」。
  LLM 侧按 id 走字符串 override 解析（不读不写全局缓存），测的是行所属那家，与下拉当前值无关。

## 验证

- 单测：迁移六例（搬槽/空值/共存/幂等）、分存读取（切服务商换槽、空槽回落缺省、他家不算已配置）、
  两个 test 函数（成功回传 / 缺密钥抛错 / 哑响应判不通）、schema 断言（三函数绑定 + refreshKey +
  两颗按钮）、模型选择器 UI 选中写 `jevModels.typesafe`。
- 全量 `pnpm test` + `tsc --noEmit` 全绿（番茄钟两用例在全量负载下偶发时序抖动，单独复跑恒绿，
  主仓库同环境复现，非本票引入）。
- 原型快照 `scripts/build-preview.mjs` 重出（JEV 行为链变更波及七个域的行为包）。
