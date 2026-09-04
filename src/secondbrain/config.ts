/**
 * 第二大脑配置（ticket 103；原闪念 config）
 * - 设置键已换代 secondBrain*（settings.ts migrateSecondBrainSettings 负责旧值平移）；
 *   内部字段名保持 QA《闪念.js》原名，稳定 vector-store/ollama/smartcat 等消费方零改动。
 * - ticket 120 数据整合：JSON 全部并入 secondbrain.json（STORE_PATH），向量二进制改名 secondbrain.vec
 *   （VEC_PATH）；原 secondbrain_meta.json 语义并入 store-file 的 meta 段，不再单独文件。
 * - META_PATH/VEC_PATH 废弃设置键不再兜底：storagePath 为唯一目录口径（ADR-0009 延续）。
 */
import { tryGetSettings } from '../core/settings-provider';
import { storageFile } from '../core/storage';

interface SecondBrainConfig {
  OLLAMA_URL: string;
  EMBEDDING_MODEL: string;
  STORE_PATH: string;
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
  return {
    OLLAMA_URL: s.secondBrainOllamaUrl || 'http://localhost:11434',
    EMBEDDING_MODEL: s.secondBrainEmbeddingModel || 'bge-m3',
    STORE_PATH: storageFile('secondbrain.json'),
    VEC_PATH: storageFile('secondbrain.vec'),
    TOP_K: Number(s.secondBrainTopK) || 20,
    CHAT_TOP_K: Number(s.secondBrainChatTopK) || 20,
    CHUNK_MIN_LENGTH: Number(s.secondBrainChunkMinLength) || 50,
    ALLOW_PATHS: s.secondBrainAllowPaths
      ? String(s.secondBrainAllowPaths)
          .split(',')
          .map((p: string) => p.trim())
          .filter(Boolean)
      : [], // ticket 116：空 = 什么也不录（不索引任何目录），不再是缺省目录清单
    CONCURRENCY: Number(s.secondBrainConcurrency) || 15,
    CONTEXT_LIMIT: Number(s.secondBrainContextLimit) || 600,
    DEBOUNCE_DELAY: Number(s.secondBrainDebounceDelay) || 300,
    CURSOR_POLL_INTERVAL: Number(s.secondBrainCursorPollInterval) || 500,
    OLLAMA_CHAT_MODEL: s.secondBrainChatModel || 'qwen2.5:14b-instruct',
    DEEPSEEK_MODEL: s.secondBrainDeepseekModel || 'deepseek-v4-flash',
    DEFAULT_USE_DEEPSEEK: s.secondBrainDefaultUseDeepseek === 'true',
    MAX_HISTORY: Number(s.secondBrainMaxHistory) || 10,
    // 空 = 未配置远程（enh-sweep-a：不再回落写死内网 IP；消费方均有 || OLLAMA_URL/真值判断兜底）
    OLLAMA_REMOTE_URL: s.secondBrainRemoteOllamaUrl || '',
  };
}

/** IS_MOBILE 检测（QA 源码 L12 同语义） */
export const IS_MOBILE: boolean = /Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') || ((globalThis as any).obsidian?.Platform?.isMobile === true);
