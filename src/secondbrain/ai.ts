/**
 * 第二大脑 AI 通道（issue 359 定形「跟随 AI 设置」：对话请求全部经 core AIService）
 * - ticket 103~107：QA 双通道（勾选 DeepSeek / 回退本地 Ollama qwen2.5），设置键 secondBrainChatModel 等；
 * - ticket 108：用户拍板「统一使用 ai」——对话与概括都走 core/ai（aiProvider：DeepSeek / OpenCode Go），
 *   不再回退 Ollama（Ollama 从此专注嵌入 bge-m3）；旧对话设置键随 issue 334/ADR-0148 删除（零消费死键）；
 * - issue 359：DeepSeek 专用形态退役——删除 getDeepseekAI/resetDeepseekAI 单例缓存与域内写死模型名
 *   （AIService 本就无状态，provider 解析走 core 自身缓存，main 设置变更时 resetAIProviderCache，
 *   域级实例缓存只是多余一层且 DeepSeek 命名误导），对齐全仓惯例每次 createAI() 即用即弃：
 *   提供商 / 端点 / 密钥 / 模型 / max_tokens / 思考档位全部由主设置页 AI 设置解析——
 *   AI.ask 不显式指定模型（prompt 第二参 undefined）→ 用户设置的 per-provider 模型优先生效
 *   （core ai-cov 回归锚），仅 provider 未配模型（如 deepseek 不强制模型）时才落 core 默认兜底。
 */
import { createAI } from '../core/ai';

/** AI.ask 附加选项：signal 取消 + onDelta 流式增量回调，原样透传 core/ai */
export interface AskOptions {
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
}

export const AI = {
  /** 统一入口：失败直接抛出，由调用方 toast 报错（不静默回退 Ollama——ticket 108）；
   *  opts 可选（既有单参调用零兼容负担），透传取消/流式 */
  async ask(prompt: string, opts?: AskOptions): Promise<string> {
    // 不显式传模型 → provider 解析（AI 设置）的模型优先，core 默认仅作 provider 未配模型时的兜底
    return createAI().prompt(prompt, undefined, opts ?? {});
  },
};
