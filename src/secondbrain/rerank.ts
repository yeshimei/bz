/**
 * 第二大脑重排客户端（issue 427/ADR-0186）：Qwen3-Reranker-4B 交叉编码打分。
 *
 * 口径：
 * - 提示词逐字照 Qwen3-Reranker 官方模板（system 判 yes/no + user 三段 Instruct/Query/Document）；
 * - 打分 = 首 token 在 yes/no 上的 logprob 归一化 P(yes)（Ollama logprobs 通道）。logprobs 拿不到
 *   **整轮判失败、回退余弦序**——不做 yes/no 文本二值降级：二值分只有 0/1 两档，并列全按余弦序排，
 *   且「余弦尺 / 二值尺」混用正是 ADR-0185 刚清理掉的问题（阈值全在余弦尺上）；
 * - 串行逐对调用：GPU 单实例下并发不缩短总时长，还会让超时预算失去意义；
 * - 整轮预算（RERANK_BUDGET_MS）用尽即失败。**要么整体重排、要么维持余弦序**，不做半重排——
 *   半重排会让同一列表里混着两种排序口径，用户看到的名次无法解释。
 */
import { buildConfig, RERANK_MODEL } from './config';

/** 指令文本与嵌入侧查询指令同句（Qwen3 官方检索口径），保证重排与召回对「问题」的理解一致 */
export const RERANK_INSTRUCT = 'Given a web search query, retrieve relevant passages that answer the query';
/** 单对调用上限：实际生效值 = min(该值, 整轮剩余预算)——6s 预算通常先到，此值是
 *  「单次挂起吞掉整轮」的绝对上限（实测冷启动首对 3.1~3.3s 含 4B 载入，落在预算内） */
export const RERANK_TIMEOUT_MS = 20000;
/** 整轮预算：须落在检索级 10s（SEARCH_TIMEOUT_MS）之内——嵌入 + 全扫 + 重排共享该上限。
 *  单对超时另按 min(RERANK_TIMEOUT_MS, 剩余预算) 收紧：否则一次挂起的调用就能让整轮
 *  跑出 20s+，把交互式检索拖过 10s 上限。 */
export const RERANK_BUDGET_MS = 6000;
/** 头部重排条数上限（覆盖现有全部 topK：参考面板/对话 20、建链候选池 24、每周撞车 10）；
 *  超出部分保持余弦序接在重排段之后 */
export const RERANK_MAX_DOCS = 24;
/** 重排上下文（tokens）：显式压到 2048 —— 模型自带默认 40200 会让 4B 占 10.1GB 显存，
 *  与 8B 嵌入（ctx 8192 占 7.19GB）无法共驻，每次检索都要换入换出（实测重载 3~15s）。
 *  2048 档实测 3.86GB，两者共驻 11.05GB/12GB，单对仅几十 ms。 */
export const RERANK_NUM_CTX = 2048;
/** 送重排的查询文本上限（字）：交互式查询（面板当前行 ≈300 字、对话提问）与每周撞车
 *  （WEEKLY_QUERY_MAX_CHARS 1000）本就在限内；只有建链管线的全文查询（上限 8000 字）会被截到
 *  标题 + 开篇——召回仍走全文（ticket 118 口径不动），重排看的是笔记开篇与候选的贴合度。 */
export const RERANK_QUERY_MAX_CHARS = 1000;
/** 送重排的候选段上限（字）：切块 ≤256 字（CHUNK_SIZE），首块含标题、另有极少数无空白长段，
 *  截断只伤这些边角，换的是 prompt 不超上下文。 */
export const RERANK_DOC_MAX_CHARS = 600;

const RERANK_SYS =
  'Judge whether the Document meets the requirements based on the Query and the Instruct provided. ' +
  'Note that the answer can only be "yes" or "no".';

/** logprobs 段 → P(yes)：取首 token 位置里 yes/no 两类 logprob 做二分类归一化（softmax）。
 *  类内累加（logsumexp）：「yes」「 yes」「Yes」是不同 token，只取首个会低估该类概率。
 *  **必须带 top_logprobs**：只有首 token 一条 logprob 时无法归一化（如旧版服务忽略 top_logprobs），
 *  按「拿不到 logprobs」处理返回 null —— 否则每对都只落 0/1 两档、并列全按余弦序排，等于
 *  用「看起来生效了」掩盖没重排（ADR-0186 明令不做二值降级）。 */
export function yesNoLogprobScore(logprobs: unknown): number | null {
  const first = Array.isArray(logprobs) ? (logprobs[0] as Record<string, unknown>) : null;
  if (!first || !Array.isArray(first.top_logprobs) || !first.top_logprobs.length) return null;
  const raw = first.top_logprobs as unknown[];
  let ly: number | null = null;
  let ln: number | null = null;
  const acc = (a: number | null, b: number): number =>
    a === null ? b : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b)));
  for (const item of raw) {
    const e = (item || {}) as { token?: unknown; logprob?: unknown };
    // 非有限值（±Infinity / NaN）一律当无效候选：留着会让下面的归一出 NaN
    if (typeof e.logprob !== 'number' || !Number.isFinite(e.logprob)) continue;
    const t = String(e.token ?? '').toLowerCase().replace(/[^a-z]/g, '');
    if (t === 'yes') ly = acc(ly, e.logprob);
    if (t === 'no') ln = acc(ln, e.logprob);
  }
  if (ly === null && ln === null) return null;
  if (ly === null) return 0; // 只现 no：yes 概率按 0 记（另一档不可见 = 极低）
  if (ln === null) return 1;
  const m = Math.max(ly, ln);
  const py = Math.exp(ly - m);
  const pn = Math.exp(ln - m);
  return py / (py + pn);
}

async function rerankOne(baseUrl: string, query: string, doc: string, timeoutMs: number): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: RERANK_MODEL,
        stream: false,
        // 关思考：本模型是 Qwen3 思考模板转换版，不关则首 token 恒为 thinking 标记（num_predict 1 下
        // 根本走不到 yes/no），拿不到 logprobs → 每次都回退余弦序、重排形同虚设。
        // 旧版 Ollama 不认该字段（多余字段被忽略）→ 仍是「拿不到分即回退」，只是不生效，不会出错。
        think: false,
        logprobs: true,
        top_logprobs: 8,
        options: { num_predict: 1, temperature: 0, num_ctx: RERANK_NUM_CTX },
        messages: [
          { role: 'system', content: RERANK_SYS },
          {
            role: 'user',
            content: `<Instruct>: ${RERANK_INSTRUCT}\n<Query>: ${query.slice(0, RERANK_QUERY_MAX_CHARS)}\n<Document>: ${doc.slice(0, RERANK_DOC_MAX_CHARS)}`,
          },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
    const data: any = await resp.json();
    const score = yesNoLogprobScore(data?.logprobs);
    if (score === null) throw new Error('Ollama 未返回 yes/no logprobs（该服务的重排打分不可用）');
    return score;
  } catch (e) {
    if (controller.signal.aborted) throw new Error(`重排调用超时（${Math.round(timeoutMs / 1000)}s）`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 串行重排打分：docs 顺序进、分数同序出（长度一致）。任一环节失败即抛错——调用方
 * （vector-store）catch 后按余弦序返回并 console.warn，绝不打断检索链路。
 * baseUrl 与嵌入侧同口径（移动端传远程 URL；undefined = 本地设置地址）。
 */
export async function rerankScores(query: string, docs: string[], baseUrl?: string): Promise<number[]> {
  const url = (baseUrl || buildConfig().OLLAMA_URL).replace(/\/+$/, '');
  const deadline = Date.now() + RERANK_BUDGET_MS;
  const out: number[] = [];
  for (const doc of docs) {
    const left = deadline - Date.now();
    if (left <= 0) {
      throw new Error(`重排预算用尽（${RERANK_BUDGET_MS}ms，完成 ${out.length}/${docs.length} 对）`);
    }
    out.push(await rerankOne(url, query, doc, Math.min(RERANK_TIMEOUT_MS, left)));
  }
  return out;
}
