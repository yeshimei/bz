/**
 * 第二大脑 Ollama HTTP（ticket 103；对齐 QA 闪念.js L100-151）
 */
import { buildConfig } from './config';

export const EMBED_BATCH_SIZE = 64;

/** Embedding HTTP 超时：嵌入端点可能因慢网络/CPU 推理超 10s（bge-m3 单批常见），保持 30s 不误伤批量嵌入 */
export const EMBED_TIMEOUT_MS = 30000;
/** 检索超时（ticket 46）：查询嵌入/检索全链路 10s 上限，超出即降级文本，避免参考面板/对话被挂起请求长期阻塞 */
export const SEARCH_TIMEOUT_MS = 10000;

async function httpFetch(url: string, opts: any, timeoutMs: number = EMBED_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error(`Ollama 无响应（超过 ${timeoutMs / 1000}s 未应答）：${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** 单条嵌入（isQuery 时加检索前缀；model 缺省跟随第二大脑设置——小橘记忆库可经设置面板覆盖） */
export async function getEmbedding(text: string, isQuery: boolean, baseUrl?: string, model?: string): Promise<number[]> {
  const CONFIG = buildConfig();
  const url = baseUrl || CONFIG.OLLAMA_URL;
  const prompt = isQuery ? `Represent this sentence for searching relevant passages: ${text}` : text;
  const resp = await httpFetch(`${url}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || CONFIG.EMBEDDING_MODEL, prompt }),
  });
  if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
  const data = await resp.json();
  const vec = data.embedding;
  if (!vec || !vec.length) throw new Error('向量为空');
  return vec;
}

/** 批量嵌入（baseUrl 缺省本地；ticket 107 移动端引导初始化传远程 URL） */
export async function getEmbeddingsBatch(texts: string[], baseUrl?: string): Promise<number[][]> {
  const CONFIG = buildConfig();
  const resp = await httpFetch(`${baseUrl || CONFIG.OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CONFIG.EMBEDDING_MODEL, input: texts }),
  });
  if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
  const data = await resp.json();
  // 空结果校验（QA L125 同语义，ticket 107 补回）：畸形 2xx 响应走逐条回退而非登记空向量
  const vec = data.embeddings;
  if (!vec || !vec.length) throw new Error('向量为空');
  return vec;
}

/** Ollama 对话 */
export async function ollamaChat(prompt: string, model?: string, baseUrl?: string): Promise<string> {
  const CONFIG = buildConfig();
  const url = baseUrl || CONFIG.OLLAMA_URL;
  const m = model || CONFIG.OLLAMA_CHAT_MODEL;
  const resp = await httpFetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: m,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.7 },
    }),
  });
  if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
  const data = await resp.json();
  return data.message?.content || '（无响应）';
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
