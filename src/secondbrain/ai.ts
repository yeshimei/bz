/**
 * 第二大脑 AI 通道（ticket 108 起统一走 bz core/ai，主设置页「🤖 AI」服务商单选）
 * - ticket 103~107：QA 双通道（勾选 DeepSeek / 回退本地 Ollama qwen2.5），设置键 secondBrainDeepseekModel 等；
 * - ticket 108：用户拍板「统一使用 ai」——对话与概括都走 core/ai（aiProvider：DeepSeek / OpenCode Go），
 *   不再回退 Ollama（Ollama 从此专注嵌入 bge-m3）；旧三个对话设置键保留 data.json 不再消费
 *   （CONCURRENCY 死配置同款处理），内部模型名改用 QA 冻结常量。
 */
import { createAI } from '../core/ai';

type AIService = ReturnType<typeof createAI>;
let deepseek: AIService | null = null;

/** 主设置页 AI 服务懒创建（unload 由域入口置空）；defaultModel 用 QA 冻结默认值，provider 配置的模型优先 */
export function getDeepseekAI(): AIService {
  if (!deepseek) deepseek = createAI({}, 'deepseek-v4-flash', {}, 16384);
  return deepseek;
}

export function resetDeepseekAI(): void {
  deepseek = null;
}

/** AI.ask 附加选项（ticket 141）：signal 取消 + onDelta 流式增量回调，原样透传 core/ai */
export interface AskOptions {
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
}

export const AI = {
  /** 统一入口：失败直接抛出，由调用方 toast 报错（不静默回退 Ollama——ticket 108）；
   *  opts 可选（既有单参调用零兼容负担），透传取消/流式（ticket 141） */
  async ask(prompt: string, opts?: AskOptions): Promise<string> {
    // prompt() 不显式传模型 → 用 createAI 注入的 defaultModel；provider.model 配置存在时优先生效
    return getDeepseekAI().prompt(prompt, undefined, opts ?? {});
  },
};
