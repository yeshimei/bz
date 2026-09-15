/**
 * 自动关联通道（issue 309；ADR-0141 起消费方 = 知识盒）：知识盒录入面板 ←→ 第二大脑 link agent
 * 的唯一接线口。
 *
 * 三段能力对上「生成 → 预览 → 确认写入」三步：
 * - preview：AI 出内容**之后立刻**跑（草稿还没落盘）——近邻检索 + AI 裁判，返回命中的关联目标，
 *   面板在属性区就地显示「分析中… → 关联名」。这是用户要的「生成完就看到关联过程」；
 * - apply：确认写入落盘后，把上面算好的目标写进新笔记 frontmatter.related（幂等、单侧）；
 * - now：无预演结果时的兜底（面板直接调，跑完整单篇管线）；
 * - backfill：批量补链（自动关联的两个命令之一「为未关联笔记批量补链」走这里）。
 *
 * 为什么预演要独立于落盘：建链本要读文件、写 related，但**候选检索与裁判只需要正文**
 * （查询向量由正文算出，候选来自索引库），所以草稿未落盘也能先算——落盘那一刻只差一次写入。
 *
 * 依赖方向：secondbrain 在 index.ts 注入 bridge，knowledge 只经本模块取用（core ← 域）；
 * 未注入（第二大脑未启用 / 自动关联关闭 / 测试与原型未接线）→ getLinkBridge() 返回 null，
 * 调用方按「自动关联未开启」呈现，不得报错、不得阻塞录入本身。
 *
 * 范围（ADR-0141 §2）：关联范围恒为三个盒子，**盒外路径由实现侧拒绝**（`out-of-scope`）——
 * 本模块只传路径，不重复判定盒界；调用方按 out-of-scope 提示「该笔记不在三个盒子内」。
 */

/** 建链结果（与 link-agent 的 ProcessOutcome 同形；core 不引域类型，故此处独立声明） */
export type LinkNowOutcome =
  | { status: 'done'; created: number }
  | { status: 'queued' }
  | { status: 'skipped' }
  | { status: 'skipped-related' }
  /** 路径在三个盒子之外（ADR-0141 §2：范围不再可配，手动命令亦无豁免） */
  | { status: 'out-of-scope' }
  | { status: 'failed'; error: string };

/** 批量补链结果（自动关联命令「为未关联笔记批量补链」的汇总；core 不引域类型） */
export type LinkBackfillOutcome =
  | { status: 'done'; processed: number; created: number }
  | { status: 'unreachable' }
  | { status: 'no-targets' }
  | { status: 'disabled' };

/** 预演命中的关联目标（展示名已按 frontmatter.title → 文件名回退解析） */
export interface LinkPick {
  path: string;
  title: string;
}

/** 关联预演结果 */
export type LinkPreviewOutcome =
  | { status: 'done'; picks: LinkPick[] }
  | { status: 'queued' }
  | { status: 'skipped' }
  | { status: 'failed'; error: string };

export interface LinkBridge {
  /** 单篇即时建链（无预演结果时的兜底：完整跑一遍检索 + 裁判 + 写入）；force = 强制重跑（跳过「已有 related 不建链」尊重门） */
  now(path: string, opts?: { force?: boolean }): Promise<LinkNowOutcome>;
  /** 关联预演（只算不写）：草稿正文 → 命中的关联目标 */
  preview(content: string, title?: string): Promise<LinkPreviewOutcome>;
  /** 把预演结果写进某篇的 related（确认写入落盘后调用） */
  apply(path: string, targetPaths: string[]): Promise<LinkNowOutcome>;
  /** 批量补链：三个盒子内缺 related 的笔记，逐篇跑管线（启动自动补链的手动兜底） */
  backfill(): Promise<LinkBackfillOutcome>;
}

let _bridge: LinkBridge | null = null;

/** 注入/撤销（第二大脑域初始化与卸载时调用；传 null 撤销） */
export function setLinkBridge(bridge: LinkBridge | null): void {
  _bridge = bridge;
}

/** 取通道（null = 未注入，调用方按「自动双链未开启」处理） */
export function getLinkBridge(): LinkBridge | null {
  return _bridge;
}
