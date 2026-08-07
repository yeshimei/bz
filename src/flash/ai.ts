/**
 * 闪念 AI 模块（ticket 18，源码 L748-765 逐字：DeepSeek 优先 → Ollama 回退）
 */
import { createAI } from '../core/ai';
import { buildConfig } from './config';
import { ollamaChat } from './ollama';

let _deepseek: any = null;

export function initAI(): any {
  const CONFIG = buildConfig();
  _deepseek = createAI(undefined, CONFIG.DEEPSEEK_MODEL, {}, 16384);
  return _deepseek;
}

export const AI = {
  deepseek: _deepseek,

  async ask(prompt: string, useDeepSeek: boolean): Promise<string> {
    const CONFIG = buildConfig();
    if (useDeepSeek && AI.deepseek) {
      try {
        return await AI.deepseek.chat(prompt);
      } catch (e) {
        console.warn('DeepSeek 调用失败，回退到本地', e);
      }
    }
    return ollamaChat(prompt, CONFIG.OLLAMA_CHAT_MODEL);
  },
};
