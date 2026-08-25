/**
 * 第二大脑 AI 双通道（ticket 103；对齐 QA 闪念.js L747-765 语义）
 * DeepSeek 优先（勾选时），失败自动回退本地 Ollama。
 * DeepSeek 通道走 bz core/ai 的 createAI()（替代 QA 的 window.__utils.createAI——铁律 5 不挂 window）。
 */
import { createAI } from '../core/ai';
import { buildConfig } from './config';
import { ollamaChat } from './ollama';

type AIService = ReturnType<typeof createAI>;
let deepseek: AIService | null = null;

/** DeepSeek 服务懒创建（unload 由域入口置空，对齐 clip-archive 先例） */
export function getDeepseekAI(): AIService {
  if (!deepseek) deepseek = createAI({}, buildConfig().DEEPSEEK_MODEL, {}, 16384);
  return deepseek;
}

export function resetDeepseekAI(): void {
  deepseek = null;
}

export const AI = {
  async ask(prompt: string, useDeepSeek: boolean): Promise<string> {
    const CONFIG = buildConfig();
    if (useDeepSeek) {
      try {
        return await getDeepseekAI().chat(prompt);
      } catch (e) {
        console.warn('[secondbrain] DeepSeek 调用失败，回退到本地', e);
      }
    }
    return ollamaChat(prompt, CONFIG.OLLAMA_CHAT_MODEL);
  },
};
