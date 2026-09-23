/**
 * 判定编排（ADR-0173 §2 / ADR-0181）：**Jev 优先，不可用即当次回落 LLM** 的唯一落地。
 *
 * 与 `core/jev.ts`（通道本身，纯透传、失败一律抛）的分工：本模块只做**策略**——
 * 就绪门（`isJevConfigured`）、答案可用性（`parse` 抛错 = 畸形）、取消判别（`signal.aborted`）、
 * 回落时机。判定材料（state / 问题）与回落实现（LLM 路径）全部由调用方注入，故本层不认识任何域。
 *
 * 回落覆盖的「Jev 不可用」四类（2026-09-23 用户拍板：一律回落，不挑场景）：
 * ① 未启用 / 未配置（端点或密钥不齐）→ 不发请求直接回落；
 * ② 请求失败（超时 / 网络 / HTTP 非 2xx）→ 回落；
 * ③ 答案畸形（响应缺 answers、缺题单键、题型不符——由 `parse` 抛错表达）→ 回落；
 * ④ 取消（`signal.aborted`）**不回落**——用户主动放弃，回落等于白烧一次 LLM（issue 392 决策 6）。
 * 回落自身失败原样上抛，由调用方决定降级（关联入队重试 / 影院分类留空手点），不引第三层兜底。
 *
 * 独立成模块而非并入 `core/jev.ts` 的理由有二：通道口径「只做透传、不含业务/策略」不被污染；
 * 且调用方单测可直接 `vi.spyOn(jev, 'askJev')` 拦截（跨模块调用才过模块命名空间，同模块内自调用拦截不到）。
 */
import { askJev, isJevConfigured, type JevAnswer, type JevConfig, type JevQuestion } from './jev';

/** 取消异常（AbortError 语义；与 core/jev.ts 同义——两模块各持一份，不跨层共享私有实现） */
function abortError(): Error {
  const e = new Error('判定请求已取消');
  e.name = 'AbortError';
  return e;
}

/** 一次判定编排的计划：Jev 侧材料 + 答案判定 + 回落实现，全部由调用方注入 */
export interface JudgePlan<T> {
  /** Jev 侧材料（**惰性构造**：未就绪 / 已取消时不建，state 常要读 vault / 拼档案卡） */
  request: () => { state: string; questions: Record<string, JevQuestion> };
  /** 类型化答案 → 域内结果；**抛错 = 答案不可用**（缺题单键 / 题型不符）→ 回落 */
  parse: (answers: Record<string, JevAnswer>) => T;
  /** 生成通道回落（LLM 路径）；abort 时不调用，自身失败原样上抛 */
  fallback: () => Promise<T>;
  signal?: AbortSignal;
  /** 显式覆盖 Jev 配置（测试 / 特殊调用点；就绪门仍以设置为准，透传 askJev） */
  config?: Partial<JevConfig>;
}

/**
 * 判定：Jev 就绪即以 Jev 结果为准（`parse` 的返回值，含域内「弃权」的 null 语义——
 * 弃权是有效判定，不是失败，不回落）；任一「不可用」按上方四类分流。
 */
export async function judgeOrFallback<T>(plan: JudgePlan<T>): Promise<T> {
  const signal = plan.signal;
  // 取消优先于一切：已取消既不判定也不回落
  if (signal?.aborted) throw abortError();
  if (!isJevConfigured()) return plan.fallback();
  try {
    const { state, questions } = plan.request();
    const result = await askJev(state, questions, { signal, config: plan.config });
    return plan.parse(result.answers);
  } catch (e) {
    if (signal?.aborted) throw e; // 取消不算失败：抛出，不回落
    console.debug('[jev] 判定通道不可用，回落 LLM：', e instanceof Error ? e.message : e);
    return plan.fallback();
  }
}
