/**
 * 第二大脑 Ollama HTTP（ticket 103；对齐 QA 闪念.js L100-151）
 */
import { buildConfig } from './config';

export const EMBED_BATCH_SIZE = 64;

/** Ollama HTTP 统一超时（P1-10）：Ollama 未启动/挂起时请求将永久 pending，卡死检索链路 */
export const OLLAMA_TIMEOUT_MS = 30000;

async function httpFetch(url: string, opts: any): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error(`Ollama 无响应（超过 ${OLLAMA_TIMEOUT_MS / 1000}s 未应答）：${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** 单条嵌入（isQuery 时加检索前缀） */
export async function getEmbedding(text: string, isQuery: boolean, baseUrl?: string): Promise<number[]> {
  const CONFIG = buildConfig();
  const url = baseUrl || CONFIG.OLLAMA_URL;
  const prompt = isQuery ? `Represent this sentence for searching relevant passages: ${text}` : text;
  const resp = await httpFetch(`${url}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CONFIG.EMBEDDING_MODEL, prompt }),
  });
  if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
  const data = await resp.json();
  const vec = data.embedding;
  if (!vec || !vec.length) throw new Error('向量为空');
  return vec;
}

/** 批量嵌入 */
export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const CONFIG = buildConfig();
  const resp = await httpFetch(`${CONFIG.OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CONFIG.EMBEDDING_MODEL, input: texts }),
  });
  if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
  const data = await resp.json();
  return data.embeddings || [];
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
