/**
 * 第二大脑配置（ticket 103；原闪念 config）
 * - 设置键已换代 secondBrain*（settings.ts migrateSecondBrainSettings 负责旧值平移）；
 *   内部字段名保持 QA《闪念.js》原名，稳定 vector-store/ollama/smartcat 等消费方零改动。
 * - 数据文件更名 secondbrain_meta.json / secondbrain_vectors.vec（meta v7→v8 首载整库重建）。
 * - META_PATH/VEC_PATH 废弃设置键不再兜底：storagePath 为唯一目录口径（ADR-0009 延续）。
 */
import { tryGetSettings } from '../core/settings-provider';

interface SecondBrainConfig {
  OLLAMA_URL: string;
  EMBEDDING_MODEL: string;
  META_PATH: string;
  VEC_PATH: string;
  TOP_K: number;
  CHAT_TOP_K: number;
  CHUNK_MIN_LENGTH: number;
  ALLOW_PATHS: string[];
  CONCURRENCY: number;
  CONTEXT_LIMIT: number;
  DEBOUNCE_DELAY: number;
  CURSOR_POLL_INTERVAL: number;
  OLLAMA_CHAT_MODEL: string;
  DEEPSEEK_MODEL: string;
  DEFAULT_USE_DEEPSEEK: boolean;
  MAX_HISTORY: number;
  OLLAMA_REMOTE_URL: string;
}

export function buildConfig(): SecondBrainConfig {
  const s: any = tryGetSettings();
  const dir =
    String(s.storagePath ?? '')
      .trim()
      .replace(/\/+$/, '') || 'CONFIG/STORAGE';
  return {
    OLLAMA_URL: s.secondBrainOllamaUrl || 'http://localhost:11434',
    EMBEDDING_MODEL: s.secondBrainEmbeddingModel || 'bge-m3',
    META_PATH: dir + '/secondbrain_meta.json',
    VEC_PATH: dir + '/secondbrain_vectors.vec',
    TOP_K: Number(s.secondBrainTopK) || 20,
    CHAT_TOP_K: Number(s.secondBrainChatTopK) || 20,
    CHUNK_MIN_LENGTH: Number(s.secondBrainChunkMinLength) || 50,
    ALLOW_PATHS: s.secondBrainAllowPaths
      ? String(s.secondBrainAllowPaths)
          .split(',')
          .map((p: string) => p.trim())
          .filter(Boolean)
      : ['卡片盒', '主题盒', '我的', '归档', 'CODE'],
    CONCURRENCY: Number(s.secondBrainConcurrency) || 15,
    CONTEXT_LIMIT: Number(s.secondBrainContextLimit) || 600,
    DEBOUNCE_DELAY: Number(s.secondBrainDebounceDelay) || 300,
    CURSOR_POLL_INTERVAL: Number(s.secondBrainCursorPollInterval) || 500,
    OLLAMA_CHAT_MODEL: s.secondBrainChatModel || 'qwen2.5:14b-instruct',
    DEEPSEEK_MODEL: s.secondBrainDeepseekModel || 'deepseek-v4-flash',
    DEFAULT_USE_DEEPSEEK: s.secondBrainDefaultUseDeepseek === 'true',
    MAX_HISTORY: Number(s.secondBrainMaxHistory) || 10,
    OLLAMA_REMOTE_URL: s.secondBrainRemoteOllamaUrl || 'http://192.168.1.8:11434',
  };
}

/** IS_MOBILE 检测（QA 源码 L12 同语义） */
export const IS_MOBILE: boolean = /Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') || ((globalThis as any).obsidian?.Platform?.isMobile === true);
