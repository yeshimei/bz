/**
 * 第二大脑 Ollama HTTP（ticket 103；对齐 QA 闪念.js L100-151）
 */
import { buildConfig } from './config';
import { isValidVector } from './vector-math';
import { abortError, linkAbort } from '../core/abort';

export const EMBED_BATCH_SIZE = 64;

/** Embedding HTTP 超时：嵌入端点可能因慢网络/CPU 推理超 10s（bge-m3 单批常见），保持 30s 不误伤批量嵌入 */
export const EMBED_TIMEOUT_MS = 30000;
/** 检索超时（ticket 46）：查询嵌入/检索全链路 10s 上限，超出即降级文本，避免参考面板/对话被挂起请求长期阻塞 */
export const SEARCH_TIMEOUT_MS = 10000;

/**
 * 请求通道（自带超时 controller；`signal` 为调用方的取消通道，issue 428）。
 * 两种中断必须分开报：取消（面板换了新查询/关面板）抛 AbortError 静默收口，
 * 超时才是「Ollama 无响应」。用 `timedOut` 标记而非 `controller.signal.aborted` 判定——
 * 取消也会让该 controller 中断，光看它会把取消误报成超时。
 */
async function httpFetch(url: string, opts: any, timeoutMs: number = EMBED_TIMEOUT_MS, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const unlink = linkAbort(signal, controller);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (e) {
    if (signal?.aborted) throw abortError();
    if (timedOut || controller.signal.aborted) {
      throw new Error(`Ollama 无响应（超过 ${timeoutMs / 1000}s 未应答）：${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

/**
 * 查询侧指令前缀（issue 422/ADR-0182：query 指令是模型族属性，随当前模型分派）。
 * - Qwen3-Embedding（qwen3-embedding:0.6b/4b/8b）：官方检索格式 Instruct + Query 两行，
 *   文档侧不加指令（见 getEmbeddingsBatch）；
 * - 其余（bge-m3 等）：沿用原有英文检索指令前缀，逐字不动——存量索引口径不受影响。
 */
export function queryInstruction(model: string): string {
  if (/qwen3[-_]?embedding/i.test(model)) {
    return 'Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: ';
  }
  return 'Represent this sentence for searching relevant passages: ';
}

/** 单条嵌入（isQuery 时按模型加检索指令前缀；model 缺省跟随第二大脑设置——小橘记忆库可经设置面板覆盖）。
 *  signal（issue 428）：查询侧取消通道——面板换新查询即中断在途的查询嵌入。 */
export async function getEmbedding(text: string, isQuery: boolean, baseUrl?: string, model?: string, signal?: AbortSignal): Promise<number[]> {
  const CONFIG = buildConfig();
  const url = baseUrl || CONFIG.OLLAMA_URL;
  const resolved = model || CONFIG.EMBEDDING_MODEL;
  const prompt = isQuery ? `${queryInstruction(resolved)}${text}` : text;
  const resp = await httpFetch(`${url}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: resolved, prompt }),
  }, EMBED_TIMEOUT_MS, signal);
  if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
  const data = await resp.json();
  const vec = data.embedding;
  if (!vec || !vec.length) throw new Error('向量为空');
  // issue 425/ADR-0185：零向量（或含 NaN/Infinity）绝不放行——旧库那 5 条零向量正是
  // 「任何查询都命中同一批 78%」的根因（零向量到任意单位向量的距离恒 1.0）
  if (!isValidVector(vec) || !Array.isArray(vec)) throw new Error('向量无效（全零或含非有限分量）');
  return vec;
}

/** 批量嵌入（baseUrl 缺省本地；ticket 107 移动端引导初始化传远程 URL；signal = 取消通道，见 getEmbedding） */
export async function getEmbeddingsBatch(texts: string[], baseUrl?: string, signal?: AbortSignal): Promise<number[][]> {
  const CONFIG = buildConfig();
  const resp = await httpFetch(`${baseUrl || CONFIG.OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CONFIG.EMBEDDING_MODEL, input: texts }),
  }, EMBED_TIMEOUT_MS, signal);
  if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
  const data = await resp.json();
  // 空结果校验（QA L125 同语义，ticket 107 补回）：畸形 2xx 响应走逐条回退而非登记空向量
  const vec = data.embeddings;
  if (!Array.isArray(vec) || !vec.length) throw new Error('向量为空');
  // issue 425/ADR-0185：条数与输入不符 / 含零向量或维度不齐 → 整批失败交逐条回退
  // （逐条路径由 getEmbedding 同口径把关）——坏向量一旦登记进库就会长期污染检索结果
  if (vec.length !== texts.length) throw new Error(`批量向量结果与输入不匹配（${vec.length}/${texts.length}）`);
  const dim = (vec[0] as number[]).length;
  for (const v of vec) {
    if (!isValidVector(v) || v.length !== dim) throw new Error('批量向量含无效向量（零向量/非有限分量/维度不齐）');
  }
  return vec;
}

/** 检查远程 Ollama */
export async function checkRemoteOllama(url: string): Promise<boolean> {
  try {
    const resp = await httpFetch(`${url}/api/tags`, { method: 'GET' });
    return resp.ok;
  } catch {
    return false;
  }
}
