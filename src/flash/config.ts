/**
 * 闪念配置（ticket 18，源码 CONFIG L78-96 逐字）
 */
import { tryGetSettings } from '../core/settings-provider';

interface FlashConfig {
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

export function buildConfig(): FlashConfig {
  const s: any = tryGetSettings();
  // ADR-0009：storagePath 优先；旧 META_PATH/VEC_PATH（完整文件路径）兼容兜底（取其目录）
  const dirOf = (v: string) => String(v || '').trim().replace(/\/+$/, '');
  const metaDir = s.storagePath
    ? dirOf(s.storagePath)
    : dirOf(s.META_PATH).replace(/\/ai_completion_meta\.json$/, '');
  const vecDir = s.storagePath
    ? dirOf(s.storagePath)
    : dirOf(s.VEC_PATH).replace(/\/ai_completion_vectors\.vec$/, '');
  return {
    OLLAMA_URL: s.OLLAMA_URL || 'http://localhost:11434',
    EMBEDDING_MODEL: s.EMBEDDING_MODEL || 'bge-m3',
    META_PATH: (metaDir || 'CONFIG/STORAGE') + '/ai_completion_meta.json',
    VEC_PATH: (vecDir || 'CONFIG/STORAGE') + '/ai_completion_vectors.vec',
    TOP_K: Number(s.TOP_K) || 20,
    CHAT_TOP_K: Number(s.CHAT_TOP_K) || 20,
    CHUNK_MIN_LENGTH: Number(s.CHUNK_MIN_LENGTH) || 50,
    ALLOW_PATHS: s.ALLOW_PATHS ? String(s.ALLOW_PATHS).split(',').map((p: string) => p.trim()).filter(Boolean) : ['卡片盒', '主题盒', '我的', '归档', 'CODE'],
    CONCURRENCY: Number(s.CONCURRENCY) || 15,
    CONTEXT_LIMIT: Number(s.CONTEXT_LIMIT) || 600,
    DEBOUNCE_DELAY: Number(s.DEBOUNCE_DELAY) || 300,
    CURSOR_POLL_INTERVAL: Number(s.CURSOR_POLL_INTERVAL) || 500,
    OLLAMA_CHAT_MODEL: s.OLLAMA_CHAT_MODEL || 'qwen2.5:14b-instruct',
    DEEPSEEK_MODEL: s.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    DEFAULT_USE_DEEPSEEK: s.DEFAULT_USE_DEEPSEEK === 'true',
    MAX_HISTORY: Number(s.MAX_HISTORY) || 10,
    OLLAMA_REMOTE_URL: s.OLLAMA_REMOTE_URL || 'http://192.168.1.8:11434',
  };
}

/** IS_MOBILE 检测（源码 L12） */
export const IS_MOBILE: boolean = /Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') || ((globalThis as any).obsidian?.Platform?.isMobile === true);
