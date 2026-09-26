# 430 · AI 面板「Jev 服务商」新增博查（bocha-jev-v1，SystemOne 同构）

- 状态：已实现（2026-09-24）
- 用户原话①：「先试一下流通性吧，看能不能接通这个模型，能不能使用了再去添加设置面板」
- 用户原话②（博查发布图：「博查发布Bocha Jev决策模型，API限时免费测试」）：「试试这家的」
- 用户原话③（给出博查 key 后实测通过）：「给设置面板的jev添加硅基流动服务商」（硅基流动侧经查
  报文不同构且三款平替模型未放量，当日改为接入已实测打通的博查，见「背景」）
- 关联：issue 424 + ADR-0184（Jev 组收口为服务商/密钥/模型三行，本票在其上扩注册表）/
  ADR-0173（判定通道协议）/ issue 392 + ADR-0181（回落编排，本票不触碰）
- 号位说明：429 之后取 430

## 背景与目标

Jev 类生态 2026-09-24 一天内扩了两家：硅基流动上线三款开源平替（Kev-4B / SemIf / diffusiongemma），
博查发布 Bocha Jev（`bocha-jev-v1`）。当日实测结论：

- **硅基流动**：三款模型只挂目录名（`/v1/models` 可见），推理一律 20012「Model does not exist」，
  未放量；且走 OpenAI chat 面报文，与 SystemOne **不同构**，接入需另写适配层（提示工程路径，
  置信度只能自报）。暂不接入。
- **博查**：`jev.bochaai.com/v1/systemone` 实测全通——报文/模型列表格式与 TypeSafe **完全同构**
  （`{model, state, questions}` → `{model, answers, usage}`），三题型（noul/choice/score）全部正确，
  总耗时 0.22s（国内直连，推理 28ms），测试期限免（200 QPS、单候选 512 token）。
  `jev-latest` 在博查是 `bocha-jev-v1` 的兼容别名。

目标：把博查加进 `JEV_PROVIDER_REGISTRY`，设置面板「Jev 服务商」下拉自动带出，模型缺省按服务商各配。

## 决策

1. **注册表加条目，不加协议字段**。博查与 Typesafe 同构，`askJev` / `fetchJevModels` /
   `parseJevModels` 零改动复用；描述符新增 `defaultModel`（typesafe → `jev-latest`，
   bocha → `bocha-jev-v1`），`resolveJevConfig` 模型留空按服务商回落。在册门槛写进描述符注释：
   **必须与 SystemOne 报文同构**，OpenAI chat 面的服务商（如硅基流动）先加适配层、不许直接进表。
2. **缺省服务商仍是 Typesafe**（注册表首条不动，`DEFAULT_JEV_PROVIDER` /
   `JEV_DEFAULT_ENDPOINT` / `JEV_DEFAULT_MODEL` 口径不变，存量用户无感）。博查排第二。
3. **设置文案**：服务商行 desc 改「判定通道的服务商，各家密钥不通用」；模型行 desc 改
   「判定使用的模型，留空跟随服务商缺省」，placeholder 仍钉 `jev-latest`（示例展示，博查亦是有效别名）。
4. **密钥互不通用**：Typesafe 与博查各发各的 key，换服务商须连同密钥、模型一起换
   （`jev-latest` 别名兜底存量模型键，不换也能调）。

## 验证

- 实测（2026-09-24，无代理直连）：`GET /v1/models` 200（0.17s）；`POST /v1/systemone` 三题型
  一次问全 200（0.22s）——noul 0.995 / choice 退货 0.999（含完整概率分布）/ score 1.99（含五档
  概率 + legend 回显），metadata 带 `calibrated: true`。
- 测试：注册表两家在册 + 博查描述符字段、缺省模型按服务商各配（手输优先）、博查实测响应原样
  可解析（多余 `data` 字段不炸）、`fetchJevModels` 按服务商打对端点；settings-schema 不变式
  断言同步两家 options。
