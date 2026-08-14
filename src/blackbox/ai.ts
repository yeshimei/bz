/**
 * 黑匣子 AI 服务统一入口（ticket 64）：deepseek（默认，createAI 全局）/
 * ollama（本地，blackboxAIProvider=ollama 时走 Ollama /api/chat，format json）。
 */
import { createAI } from '../core/ai';
import { tryGetSettings } from '../core/settings-provider';

interface BlackBoxAI {
  json: (prompt: string) => Promise<string>;
}

/** 读取黑匣子 AI 设置（storagePath 无关，读 MemoSettings） */
export function getBlackBoxAISettings(): { provider: string; url: string; model: string } {
  const s = tryGetSettings() as any;
  return {
    provider: (s && s.blackboxAIProvider) || 'deepseek',
    url: ((s && s.blackboxOllamaUrl) || 'http://localhost:11434').replace(/\/+$/, ''),
    model: (s && s.blackboxOllamaModel) || 'qwen2.5:14b-instruct',
  };
}

/** Ollama JSON 调用（fetch POST /api/chat；format json 要求模型返回 JSON） */
export async function ollamaJson(prompt: string, url: string, model: string): Promise<string> {
  const resp = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, format: 'json' }),
  });
  if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
  const data: any = await resp.json();
  const content = data && data.message && data.message.content;
  if (typeof content !== 'string' || !content) throw new Error('Ollama 响应缺少 content');
  return content;
}

/** 黑匣子 AI 统一入口（返回 {json}；deepseek → createAI，ollama → 本地） */
export function getBlackBoxAI(): BlackBoxAI {
  const cfg = getBlackBoxAISettings();
  if (cfg.provider === 'ollama') {
    return {
      json: (prompt: string) => ollamaJson(prompt, cfg.url, cfg.model),
    };
  }
  return createAI();
}