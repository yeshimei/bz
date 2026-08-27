/**
 * 语义快照生成器（P2c，ticket 123）
 *
 * ADR-0059 分层策略：
 *   - shouldRegenerateSnapshot：hash 相同 → false；变化比例 ≥ threshold → true（大改重生成，小改只更新 hash）
 *   - generateSnapshot：产出 summary + tags + emotion，LLM 可用时走 AI，不可用/失败走非 AI 兜底
 *
 * 纯函数 + 依赖注入；AI 调用通过 SnapshotAIFn 参数传入（测试 mock），生产路径不硬依赖网络。
 * 情绪白名单沿用 cognitive.ts EMOTION_VAD 键集（不在本文件重复定义）。
 */
import type {
  SnapshotInput,
  SnapshotOptions,
  SemanticSnapshot,
  SnapshotAIFn,
} from './snapshot-types';

// ==================== 变化检测 ====================

/**
 * 计算两段文本的变化比例（0-1）。
 * 采用逐行 LCS（最长公共子序列）算法，避免外部 diff 库依赖。
 * 返回 changedLines / oldLinesTotal（归一化到 0-1）。
 */
export function computeDiffRatio(oldContent: string, newContent: string): number {
  if (!oldContent && !newContent) return 0;
  if (!oldContent) return 1;
  if (!newContent) return 1;

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const lcsLen = lcsLength(oldLines, newLines);
  const total = Math.max(oldLines.length, 1);
  return (total - lcsLen) / total;
}

/**
 * LCS 长度（动态规划，O(m*n) 时间 + O(min(m,n)) 空间）
 */
function lcsLength(a: string[], b: string[]): number {
  // 确保 b 是较短数组以节省空间
  if (a.length < b.length) [a, b] = [b, a];

  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[n];
}

/**
 * 判断是否需要重新生成快照。
 *
 * @param oldHash   上一次快照的 hash（null/undefined → 视为首次，需要生成）
 * @param newHash   当前内容的 hash
 * @param oldContent 上一次快照时的内容（用于计算变化比例）
 * @param newContent 当前内容
 * @param threshold  变化比例阈值（默认 0.30），≥ threshold → 需要重新生成
 * @returns true = 需要重新生成；false = 小改动只更新 hash
 */
export function shouldRegenerateSnapshot(
  oldHash: string | null | undefined,
  newHash: string,
  oldContent: string | undefined,
  newContent: string,
  threshold = 0.30,
): boolean {
  // 首次（无旧 hash）→ 需要生成
  if (!oldHash) return true;
  // hash 相同 → 无需生成
  if (oldHash === newHash) return false;
  // 有旧内容但无法计算差异比例 → 保守生成
  if (!oldContent) return true;
  // 计算变化比例
  const ratio = computeDiffRatio(oldContent, newContent);
  return ratio >= threshold;
}

// ==================== 快照生成 ====================

/** 情绪白名单（与 cognitive.ts EMOTION_VAD 键集一致） */
const EMOTION_WHITELIST = new Set([
  'happy', 'excited', 'content', 'calm', 'grateful', 'proud', 'hopeful',
  'amused', 'loving', 'neutral', 'sad', 'anxious', 'stressed', 'angry',
  'frustrated', 'fearful', 'disappointed', 'lonely', 'bored', 'confused',
  'overwhelmed', 'curious', 'sleepy', 'playful', 'focused', 'upset',
]);

/** 情绪回落默认值 */
const DEFAULT_EMOTION = 'calm';

/**
 * 校验情绪值是否在白名单内（沿用 sanitizeEmotion 模式）。
 */
function sanitizeEmotion(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  return EMOTION_WHITELIST.has(v) ? v : undefined;
}

/**
 * 非 AI 兜底：取首段前 N 字作 summary，简单关键词提取，emotion=calm。
 * 插件永不残废原则——LLM 不可用/失败时仍可产出基本快照。
 */
function fallbackSnapshot(content: string, maxSummaryLength = 100): SemanticSnapshot {
  // 摘要：取第一个非空段落前 N 字
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim());
  const firstParagraph = paragraphs[0]?.trim() ?? '';
  const summary = firstParagraph.length > maxSummaryLength
    ? firstParagraph.slice(0, maxSummaryLength) + '…'
    : firstParagraph || '(空内容)';

  // 关键词：提取高频中文词/英文词（简化版——取长度 ≥ 2 的独立词）
  const words = content.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) ?? [];
  const freq = new Map<string, number>();
  for (const w of words) {
    const key = w.toLowerCase();
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const tags = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  return {
    summary,
    tags,
    length: content.length,
    emotion: DEFAULT_EMOTION,
  };
}

/** 默认 AI prompt（创作型内容摘要生成） */
const SNAPSHOT_PROMPT = `你是一个内容分析助手。请对以下创作内容（日记/诗歌/信等）生成语义快照：
1. summary: 50-100 字的中文摘要，捕捉核心情感和主题
2. tags: 3-5 个关键词标签（中文或英文）
3. emotion: 从以下情绪词中选一个最匹配的：happy, sad, curious, sleepy, playful, focused, calm, upset, excited, content, grateful, proud, hopeful, neutral, anxious, stressed, angry, frustrated, disappointed, lonely, bored, confused, overwhelmed

请严格返回 JSON 格式：{"summary": "...", "tags": ["...", "..."], "emotion": "..."}`;

/**
 * 生成语义快照。
 *
 * @param content  文件内容
 * @param options  配置（aiFn 可注入；不提供则走兜底）
 * @returns SemanticSnapshot
 */
export async function generateSnapshot(
  content: string,
  options?: SnapshotOptions,
): Promise<SemanticSnapshot> {
  const maxSummaryLength = options?.maxSummaryLength ?? 100;

  if (!options?.aiFn) {
    return fallbackSnapshot(content, maxSummaryLength);
  }

  try {
    const result = await options.aiFn(content, SNAPSHOT_PROMPT);
    if (!result) return fallbackSnapshot(content, maxSummaryLength);

    const emotion = sanitizeEmotion(result.emotion) ?? DEFAULT_EMOTION;

    // 摘要截断：超过 maxSummaryLength 时加 '…' 后缀
    let summary = result.summary || '(无摘要)';
    if (summary.length > maxSummaryLength) {
      summary = summary.slice(0, maxSummaryLength) + '…';
    }

    return {
      summary,
      tags: Array.isArray(result.tags) ? result.tags.slice(0, 5) : [],
      time: new Date().toISOString(),
      length: content.length,
      emotion,
    };
  } catch {
    // AI 调用失败 → 非 AI 兜底
    return fallbackSnapshot(content, maxSummaryLength);
  }
}

/**
 * 简单字符串 hash（djb2 变体，用于 shouldRegenerateSnapshot 的 baseHash 比较）。
 * 非加密用途——仅用于快速比较内容是否变化。
 */
export function simpleHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}
