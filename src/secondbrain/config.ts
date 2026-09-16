/**
 * 第二大脑配置（ticket 103；原闪念 config）
 * - 设置键已换代 secondBrain*（settings.ts migrateSecondBrainSettings 负责旧值平移）；
 *   内部字段名保持 QA《闪念.js》原名，稳定 vector-store/ollama/smartcat 等消费方零改动。
 * - ticket 120 数据整合：JSON 全部并入 secondbrain.json（STORE_PATH），向量二进制改名 secondbrain.vec
 *   （VEC_PATH）；原 secondbrain_meta.json 语义并入 store-file 的 meta 段，不再单独文件。
 * - META_PATH/VEC_PATH 废弃设置键不再兜底：storagePath 为唯一目录口径（ADR-0009 延续）。
 * - ADR-0141 §3：ALLOW_PATHS = 三个盒子（无条件）∪ 白名单额外目录——白名单键从
 *   「唯一语料来源」降级为「三盒之外还要纳入检索的目录」（ticket 116 的「空 = 什么也不录」作废）。
 */
import { tryGetSettings } from '../core/settings-provider';
import { storageFile } from '../core/storage';
import { boxDirs, getKnowledgeBoxes, isBoxDir, parseDirList } from '../core/knowledge-boxes';

interface SecondBrainConfig {
  OLLAMA_URL: string;
  EMBEDDING_MODEL: string;
  STORE_PATH: string;
  VEC_PATH: string;
  TOP_K: number;
  CHAT_TOP_K: number;
  CHUNK_MIN_LENGTH: number;
  ALLOW_PATHS: string[];
  CONTEXT_LIMIT: number;
  DEBOUNCE_DELAY: number;
  CURSOR_POLL_INTERVAL: number;
  MAX_HISTORY: number;
  OLLAMA_REMOTE_URL: string;
}

/**
 * 索引目录解析（ADR-0141 §3）：三盒恒含 + 白名单额外目录。
 * 解析口径 = core `parseDirList`（逗号目录串的唯一解析器）；值里的三盒条目在此剔除（幂等）——
 * 三盒已无条件纳入，留着只会被当成「额外目录」误导（settings.ts 的 onload 迁移会把它们从盘上清掉，
 * 这里再兜一层防手改）。
 */
export function resolveAllowPaths(rawAllowPaths: unknown): string[] {
  const boxes = getKnowledgeBoxes();
  const dirs = boxDirs(boxes);
  const extra = parseDirList(rawAllowPaths).filter((p) => !isBoxDir(p, boxes) && !dirs.includes(p));
  return [...dirs, ...extra];
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
    ALLOW_PATHS: resolveAllowPaths(s.secondBrainAllowPaths),
    CONTEXT_LIMIT: Number(s.secondBrainContextLimit) || 600,
    DEBOUNCE_DELAY: Number(s.secondBrainDebounceDelay) || 300,
    CURSOR_POLL_INTERVAL: Number(s.secondBrainCursorPollInterval) || 500,
    MAX_HISTORY: Number(s.secondBrainMaxHistory) || 10,
    // 空 = 未配置远程（enh-sweep-a：不再回落写死内网 IP；消费方均有 || OLLAMA_URL/真值判断兜底）
    OLLAMA_REMOTE_URL: s.secondBrainRemoteOllamaUrl || '',
  };
}

/** IS_MOBILE 检测（QA 源码 L12 同语义） */
export const IS_MOBILE: boolean = /Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') || ((globalThis as any).obsidian?.Platform?.isMobile === true);
