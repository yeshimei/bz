/**
 * smartcat AI 层（用户拍板：AI 走 bz 内置——core/ai 的 getAIProvider 解析 provider，
 * 不设独立 apiKey 面板）。core/ai 的 AIService.prompt 只接受单 user prompt 字符串，
 * 不满足多轮 messages（system + history + user），故本域自建 chat completions 请求
 * （参数对齐原版：model deepseek-chat / max_tokens 300 / temperature 0.7 / stream false）；
 * 失败 fetch → fallback requestUrl 非流式（core/ai 同款策略）。
 */
import { requestUrl } from 'obsidian';
import { getAIProvider } from '../core/ai';
import type { ChatMessage } from './types';

/** 调 DeepSeek 多轮（走 bz provider；override 可指定，一般留空跟随 bz 设置） */
export async function callChat(messages: ChatMessage[], override?: string | { endpoint?: string; apiKey?: string; model?: string }): Promise<string> {
  return (await callCompletions(messages, override, {})).content;
}

/**
 * 结构化 JSON 通道（ADR-0021：importance 打分/反思需要 response_format）
 * 返回解析后的对象；解析失败抛错（调用方降级）。
 */
export async function callChatJson(messages: ChatMessage[], maxTokens = 300): Promise<any> {
  const r = await callCompletions(messages, undefined, { response_format: { type: 'json_object' }, max_tokens: maxTokens });
  try {
    const trimmed = (r.content || '').trim();
    return JSON.parse(trimmed);
  } catch (e: any) {
    throw new Error(`JSON 解析失败: ${e.message}`);
  }
}

/** 单次 AI 调用超时（P2 fetch 无超时修复）：fetch/requestUrl 两路径统一 60s，超时 reject 走既有错误降级链 */
export const AI_CALL_TIMEOUT_MS = 60 * 1000;
let callTimeoutMs = AI_CALL_TIMEOUT_MS;
/** 测试辅助：注入超时窗口（unload 无需恢复——模块级仅测试使用） */
export function __setAICallTimeoutMsForTests(ms: number): void { callTimeoutMs = ms; }

/** Promise 超时 race（到点 reject；settled 后清计时器） */
function raceTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}超时（${Math.round(callTimeoutMs / 1000)}s）`)), callTimeoutMs);
  });
  return Promise.race([p, timeout]).finally(() => { if (timer) clearTimeout(timer); }) as Promise<T>;
}

/** 统一请求（fetch 优先 → requestUrl 兜底；body 可扩展） */
async function callCompletions(
  messages: ChatMessage[],
  override?: string | { endpoint?: string; apiKey?: string; model?: string },
  extra: Record<string, any> = {},
): Promise<{ content: string }> {
  const provider = await getAIProvider(override);
  const model = provider.model || 'deepseek-chat';
  const body: Record<string, any> = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 300,
    temperature: 0.7,
    stream: false,
    ...extra,
  };
  try {
    // 无 CORS 头服务直接 requestUrl；否则 fetch 失败再 fallback
    if (provider.noCors) {
      return await nonStreamRequest(provider.endpoint, provider.apiKey, body);
    }
    return await streamCompatFetch(provider.endpoint, provider.apiKey, body);
  } catch (e: any) {
    try {
      return await nonStreamRequest(provider.endpoint, provider.apiKey, body);
    } catch (e2: any) {
      throw new Error(`AI 请求失败: ${e.message}（fallback: ${e2.message}）`);
    }
  }
}

/** fetch（原版 fetch 语义；非 SSE 直接读 JSON content）。
 *  P2：AbortController + setTimeout race（60s）——超时 abort 转可读错误，走既有降级链。 */
async function streamCompatFetch(endpoint: string, apiKey: string, body: any): Promise<{ content: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), callTimeoutMs);
  try {
    // race 兜底拒绝（含 mock fetch 不理会 signal 的场景）；abort 负责真正掐断底层连接
    const resp = await raceTimeout(fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: ac.signal,
    } as any), 'AI 请求');
    if (!resp.ok) {
      let msg = `API ${resp.status}`;
      try {
        const err = await resp.json();
        if (err.error && err.error.message) msg = err.error.message;
      } catch (e) { /* 保留状态码 */ }
      throw new Error(msg);
    }
    const data: any = await resp.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (content === undefined || content === null) throw new Error(`API ${resp.status}: 响应缺少 content`);
    return { content };
  } catch (e: any) {
    // abort 超时 → 可读错误消息（外层 callCompletions 捕获后走 requestUrl fallback，fallback 同样有超时）
    if (e && (e.name === 'AbortError' || /abort/i.test(String(e?.message || '')))) {
      throw new Error(`AI 请求超时（${Math.round(callTimeoutMs / 1000)}s）`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** requestUrl 非流式（Obsidian 官方 API，无 CORS 限制）。
 *  P2：requestUrl 无内建超时/中止——Promise race 60s 兜底（超时 reject 走既有错误链）。 */
async function nonStreamRequest(endpoint: string, apiKey: string, body: any): Promise<{ content: string }> {
  const resp: any = await raceTimeout(requestUrl({
    url: `${endpoint}/chat/completions`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ ...body, stream: false }),
  }), 'AI 请求(fallback)');
  const data = JSON.parse(resp.text);
  const errMsg = (data.error && (data.error.message || data.error.type)) || (data.message && data.message);
  if (errMsg) throw new Error(`API ${resp.status}: ${errMsg}`);
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (content === undefined || content === null) throw new Error(`API ${resp.status}: 响应缺少 content`);
  return { content };
}

/** 是否已配置 AI（data.json 或 QuickAdd 回退可解析）——未配置给引导文案 */
export async function isAIConfigured(): Promise<boolean> {
  try {
    await getAIProvider();
    return true;
  } catch (e) {
    return false;
  }
}