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
  const provider = await getAIProvider(override);
  const model = provider.model || 'deepseek-chat';
  const body: Record<string, any> = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 300,
    temperature: 0.7,
    stream: false,
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

/** fetch（原版 fetch 语义；非 SSE 直接读 JSON content） */
async function streamCompatFetch(endpoint: string, apiKey: string, body: any): Promise<string> {
  const resp = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
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
  return content;
}

/** requestUrl 非流式（Obsidian 官方 API，无 CORS 限制） */
async function nonStreamRequest(endpoint: string, apiKey: string, body: any): Promise<string> {
  const resp: any = await requestUrl({
    url: `${endpoint}/chat/completions`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ ...body, stream: false }),
  });
  const data = JSON.parse(resp.text);
  const errMsg = (data.error && (data.error.message || data.error.type)) || (data.message && data.message);
  if (errMsg) throw new Error(`API ${resp.status}: ${errMsg}`);
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (content === undefined || content === null) throw new Error(`API ${resp.status}: 响应缺少 content`);
  return content;
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