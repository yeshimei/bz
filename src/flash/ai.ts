/**
 * 闪念 AI 模块（ticket 18，源码 L748-765 语义：DeepSeek 优先 → Ollama 回退）
 * deepseek 实例由接线方注入；未注入时恒走本地 Ollama。
 */
import { buildConfig } from './config';
import { ollamaChat } from './ollama';

export const AI = {
  deepseek: null as any,

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
