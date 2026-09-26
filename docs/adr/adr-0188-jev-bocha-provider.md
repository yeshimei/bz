# ADR-0188：Jev 服务商注册表新增博查（同构在册门槛；模型缺省按服务商各配）

- 日期：2026-09-24
- 状态：已采纳（用户实测拍板：「试试这家的」，打通后「能使用了再去添加设置面板」，见 issue 430）
- 相关：issue 430（本票）/ issue 424 + ADR-0184（Jev 组收口为三行 + `JEV_PROVIDER_REGISTRY` 单家起点）/ ADR-0173（判定通道协议，报文口径未动）/ issue 392 + ADR-0181（回落编排，本票不触碰）/ issue 425 + ADR-0185（无关但同期，防编号误读）

## 背景

Jev 类生态一天内扩两家：硅基流动上线三款开源平替（Kev-4B / SemIf / diffusiongemma），博查发布
Bocha Jev（`bocha-jev-v1`）。当日实测：

- 硅基流动：三款只挂目录名，推理一律 20012 未放量；且走 OpenAI chat 面报文，与 SystemOne
  **不同构**——「判定通道」的零解析失败卖点（ADR-0173）依赖服务端类型化报文，chat 适配层只能
  靠提示词约束 + 自报置信度，校准概率（影院弃权门槛、建链 noul 分）的语义会掉。暂不接入。
- 博查：`jev.bochaai.com` 与 TypeSafe **完全同构**（同 `/v1/systemone` 报文、同 `/v1/models`
  列表格式、三题型响应字段一一对应），国内直连 0.22s（推理 28ms），测试期限免。

## 决策

1. **注册表加条目，不加协议字段**：博查同构，`askJev` / `fetchJevModels` / `parseJevModels`
   零改动复用。协议分叉（`protocol: 'systemone' | 'openai-chat'` + chat 适配层）等真有同构之外的
   服务商要接时再引入——为一个还没放量的服务商预写适配层是投机复杂度。
2. **在册门槛 = 与 SystemOne 报文同构**，写进描述符注释与 CONTEXT 词条：OpenAI chat 面的服务商
   （如硅基流动）先加适配层、不许直接进表。这条是给后来者的护栏，防止「拉个列表就能调」的
   诱惑把解析失败模式重新引进判定通道。
3. **描述符新增 `defaultModel`**，`resolveJevConfig` 模型留空按服务商回落（typesafe →
   `jev-latest`，bocha → `bocha-jev-v1`）。`JEV_DEFAULT_MODEL` 常量改为锚注册表首条
   （= typesafe 缺省），语义收窄为「Typesafe 的缺省」，常量值不变、存量用户无感。
4. **缺省服务商仍是 Typesafe**（注册表首条不动）；博查排第二。各家密钥互不通用，设置文案点明
   「换服务商须连密钥一起换」；`jev-latest` 在博查是兼容别名，存量模型键不换也能调。

## 后果

- 设置面板「Jev 服务商」下拉自动带出博查（options 由注册表驱动，无需 UI 改动）；国内用户判定
  延迟从 ~1–2s（跨国）降到 ~0.2s，测试期零成本。
- 硅基流动待其放量 + 决定接 chat 适配层时另起 issue；适配层要解决置信度语义（自报 vs 校准）
  与回落门槛的关系，不本票仓促定。
