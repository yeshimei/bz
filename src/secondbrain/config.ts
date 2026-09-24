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
import { isQwen3Embedding8b } from '../core/ai-models';
import { storageFile } from '../core/storage';
import { boxDirs, getKnowledgeBoxes, isBoxDir, parseDirList } from '../core/knowledge-boxes';

interface SecondBrainConfig {
  OLLAMA_URL: string;
  EMBEDDING_MODEL: string;
  STORE_PATH: string;
  VEC_PATH: string;
  TOP_K: number;
  CHAT_TOP_K: number;
  ALLOW_PATHS: string[];
  DEBOUNCE_DELAY: number;
  CURSOR_POLL_INTERVAL: number;
  MAX_HISTORY: number;
  OLLAMA_REMOTE_URL: string;
}

/** 参考面板 / 移动面板的检索防抖（ms）——issue 424/ADR-0184 起固化：原设置项已删 */
export const SEARCH_DEBOUNCE_DELAY = 300;
/** 光标位置轮询间隔（ms）——同上，固化：原设置项已删 */
export const CURSOR_POLL_INTERVAL_MS = 500;

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


/** 默认向量化模型（设置留空时回落到此；ADR-0182：库内未记录产出模型的旧库也按此推断——
 *  历史上默认值一直是 bge-m3，故「未记录 = bge-m3」是安全推断：换过模型的老库会被判不一致，
 *  多跑一次重建而不写坏向量库） */
export const DEFAULT_EMBEDDING_MODEL = 'bge-m3';

/** 重排模型（issue 427/ADR-0186）：与 Qwen3-Embedding-8B 配对的交叉编码重排器（社区转换版）。
 *  **为什么 4B 而不是 8B**：实测 12GB 显存（4070）下 Qwen3-Reranker-8B（ctx 8192 占 9.6GB）
 *  与 qwen3-embedding:8b（7.19GB）无法共驻，每次检索要多付 ~8s 模型换入换出（嵌入重载 4.4s +
 *  重排重载 3.9s），20 条重排 ≈ 9.7s 直接撞上 SEARCH_TIMEOUT_MS 10s → 面板降级纯文本检索，
 *  比不重排更差；4B（2.5GB）与嵌入共驻，单对仅 +几十 ms。 */
export const RERANK_MODEL = 'dengcao/Qwen3-Reranker-4B:Q4_K_M';

/**
 * 重排通道（issue 431/ADR-0189）：总闸 × 通道开关的二选一结果。
 */
export type RerankChannel = 'off' | 'local' | 'jev';

/**
 * 重排通道单源判定（issue 431/ADR-0189）：AI 面板各行可见性与检索侧 applyRerank 分流**共用这一条**。
 * - `off`：总闸关；或 Jev 关但嵌入非 8B（本地通道的门收窄在此——与原 rerankActive 语义一致）；
 * - `local`：总闸开 + Jev 关 + 嵌入为 Qwen3-Embedding-8B（ADR-0186 语义零改动）；
 * - `jev`：总闸开 + Jev 开——不查嵌入模型、不查本地 Reranker（云端判定不吃本地显存）。
 * 暗态原则（ADR-0186 决策 3）以通道为单位继续成立：行可见性 = 生效条件（各自通道）。
 */
export function rerankChannel(): RerankChannel {
  const s: any = tryGetSettings();
  if (s.secondBrainRerank === false) return 'off';
  if (s.secondBrainRerankJev === true) return 'jev';
  return isQwen3Embedding8b(s.secondBrainEmbeddingModel || DEFAULT_EMBEDDING_MODEL) ? 'local' : 'off';
}

/**
 * 实际生效的重排模型（issue 429）：设置留空 → 默认 RERANK_MODEL（4B）。
 * 换重排模型不动向量索引（重排是纯换序层），故与 Embedding 模型的「换模型需重建」不同——
 * 改完下一次检索即生效。仅本地通道消费（issue 431/ADR-0189：Jev 通道的模型由 JEV 组决定）。
 */
export function resolvedRerankModel(): string {
  const s: any = tryGetSettings();
  return String(s.secondBrainRerankModel || '').trim() || RERANK_MODEL;
}

export function buildConfig(): SecondBrainConfig {
  const s: any = tryGetSettings();
  return {
    OLLAMA_URL: s.secondBrainOllamaUrl || 'http://localhost:11434',
    EMBEDDING_MODEL: s.secondBrainEmbeddingModel || DEFAULT_EMBEDDING_MODEL,
    STORE_PATH: storageFile('secondbrain.json'),
    VEC_PATH: storageFile('secondbrain.vec'),
    TOP_K: Number(s.secondBrainTopK) || 20,
    CHAT_TOP_K: Number(s.secondBrainChatTopK) || 20,
    ALLOW_PATHS: resolveAllowPaths(s.secondBrainAllowPaths),
    DEBOUNCE_DELAY: SEARCH_DEBOUNCE_DELAY,
    CURSOR_POLL_INTERVAL: CURSOR_POLL_INTERVAL_MS,
    MAX_HISTORY: Number(s.secondBrainMaxHistory) || 10,
    // 空 = 未配置远程（enh-sweep-a：不再回落写死内网 IP；消费方均有 || OLLAMA_URL/真值判断兜底）
    OLLAMA_REMOTE_URL: s.secondBrainRemoteOllamaUrl || '',
  };
}

/** IS_MOBILE 检测（QA 源码 L12 同语义） */
export const IS_MOBILE: boolean = /Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') || ((globalThis as any).obsidian?.Platform?.isMobile === true);
