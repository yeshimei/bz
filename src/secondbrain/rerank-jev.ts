/**
 * 第二大脑重排第二通道（issue 431/ADR-0189）：Jev 决策模型 noul 判定。
 *
 * 与本地通道（`./rerank`，Qwen3-Reranker 交叉编码）并立的云端档：查询 + 候选清单拼进 state，
 * 每条候选一题 noul（判「该片段是否与查询相关」），连续 0–1 校准概率直接当重排分——与本地
 * P(yes) 语义同构，显示同尺机制（issue 429 `hit.rerankScore`）原样复用。走 `judgeOrFallback`
 * （ADR-0181「新接入点一律消费它」）且 fallback 槽位 = 维持余弦序——**首个不落 LLM 的回落**：
 * 重排是增强层，失败只该损失增强，50 条逐条 LLM 在检索 10s 预算内不可能（ADR-0186 决策 4 口径）。
 *
 * 口径（issue 431 拍板）：
 * - 题型必为 noul——`score` 量表档位粗、并列多，正是 ADR-0186 反对的粗糙分；
 * - **缺题键 = 整轮畸形**（parse 抛错 → 回落余弦），有意偏离 link-agent 决策 9 的「计 0」：
 *   计 0 会把相关条目沉底，同一列表一部分按 noul 排、一部分沉底，即半排观感；
 * - 取消不回落（类别④语义，judgeOrFallback 内置）——直抛 AbortError 由 applyRerank 透传，
 *   回填旧序会盖掉新查询的列表（ADR-0187）；
 * - 超时 = min(Jev 固化 10s, 重排段预算 6s)：与本地通道同预算口径（`RERANK_BUDGET_MS`），
 *   不得让重排段跑穿检索级 `SEARCH_TIMEOUT_MS` 10s；
 * - 不绑 8B 嵌入门、与 `secondBrainRerankModel` 无关——通道选择在 `rerankChannel()`（config）。
 */
import { askJev, JEV_DEFAULT_TIMEOUT_MS, type JevAnswer, type JevNoulAnswer, type JevQuestion } from '../core/jev';
import { judgeOrFallback } from '../core/jev-fallback';
import { RERANK_BUDGET_MS, RERANK_QUERY_MAX_CHARS } from './rerank';

/** 单条候选送审摘录上限（字）：本地通道 600 字；Jev 侧 state 整批上限未实测，先取半档
 *  （50 条 × 300 字 ≈ 15K 字），实现期探针后可调（issue 431 遗留项：超限先砍单条长度、不砍批） */
export const JEV_RERANK_DOC_MAX_CHARS = 300;
/** Jev 请求超时（ms）：min(Jev 固化 10s, 重排段预算 6s)——重排段不得跑穿检索级 10s */
export const JEV_RERANK_TIMEOUT_MS = Math.min(JEV_DEFAULT_TIMEOUT_MS, RERANK_BUDGET_MS);

/**
 * state 构造：查询（沿用本地通道 1000 字截断）+ 编号候选清单（doc_0…doc_N-1，各截 300 字）。
 * 形态照 link-agent 档案卡口径——开头一句任务说明 + 分节标题，不要求模型输出任何结构化文本
 * （Jev 不生成文本，答案在 answers 键下，state 只是判定材料）。
 */
export function buildJevRerankState(query: string, docs: string[]): string {
  const lines: string[] = [
    '你是检索重排裁判。给定一个查询和若干编号的文档片段，',
    '逐一判断每个片段是否与查询相关：能回答查询、或切合查询意图即为相关。',
    '',
    '## 查询',
    query.slice(0, RERANK_QUERY_MAX_CHARS),
    '',
    '## 候选文档',
  ];
  docs.forEach((d, i) => {
    lines.push(`### doc_${i}`);
    lines.push(d.slice(0, JEV_RERANK_DOC_MAX_CHARS));
  });
  return lines.join('\n');
}

/**
 * 问题构造：每条候选一题 noul，键 `doc_0…doc_N-1`（与 state 的编号一一对应）。
 * 一次 askJev 问完整批（加问不加价，link-agent 同款）。
 */
export function buildJevRerankQuestions(count: number): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = {};
  for (let i = 0; i < count; i++) {
    questions[`doc_${i}`] = {
      type: 'noul',
      instructions: `文档片段 doc_${i} 是否与查询相关（能回答查询、或切合查询意图）？`,
    };
  }
  return questions;
}

/**
 * 答案 → 重排分（与 docs 同序）。**缺题键 / 题型不符 / 取值越界一律抛错 = 整轮畸形**，
 * 交 judgeOrFallback 回落余弦序——不静默当成 0 分（那会让一次故障伪装成「这几条确实不相关」，
 * 也会造成半排；issue 431 决策 6）。
 */
export function parseJevRerankAnswers(answers: Record<string, JevAnswer>, count: number): number[] {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('Jev 重排响应缺少 answers 字段（整体缺失/非对象）');
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = answers[`doc_${i}`] as JevNoulAnswer | undefined;
    if (
      !a ||
      a.type !== 'noul' ||
      typeof a.noul !== 'number' ||
      !Number.isFinite(a.noul) ||
      a.noul < 0 ||
      a.noul > 1
    ) {
      throw new Error(`Jev 重排答案畸形：doc_${i} 缺失 / 题型不符 / 取值越界`);
    }
    out.push(a.noul);
  }
  return out;
}

/**
 * Jev 通道重排打分：成功返回与 docs 同序的 noul 分；**任何不可用（未配密钥 / 超时 / 网络 /
 * HTTP 非 2xx / 响应畸形 / 缺题键）返回 null = 维持余弦序**（judgeOrFallback 的 fallback 槽位）。
 * 取消（`signal.aborted`）抛 AbortError、不回落——调用方（applyRerank）直抛，不回填旧序。
 */
export async function jevRerankScores(query: string, docs: string[], signal?: AbortSignal): Promise<number[] | null> {
  return judgeOrFallback<number[] | null>({
    signal,
    // 材料惰性构造：未就绪 / 已取消时不白拼 state（judgeOrFallback 保证此序）
    request: () => ({
      state: buildJevRerankState(query, docs),
      questions: buildJevRerankQuestions(docs.length),
    }),
    parse: (answers) => parseJevRerankAnswers(answers, docs.length),
    fallback: async () => null,
    config: { timeoutMs: JEV_RERANK_TIMEOUT_MS },
  });
}
