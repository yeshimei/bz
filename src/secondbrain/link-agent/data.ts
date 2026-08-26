/**
 * 自动双链管线数据层（ticket 111；spec `.scratch/secondbrain-link-agent/spec.md`）
 *
 * 职责：
 * - 待处理队列 CONFIG/STORAGE/secondbrain_link_queue.json 的读写（jsonStore 同款 STORAGE json CRUD）：
 *   同 path 合并刷新 hash、消费成功移除、失败保留、对应文件删除时顺带清理；
 * - related 属性解析与幂等写入的纯函数部分：只写新笔记侧，已存在的链不重复添加，
 *   `linkAgentMaxLinks > 0` 时截断，默认 0 = 不限量；
 * - 裁判输出（严格 JSON `[{"id":1,"reason":"..."}]`）解析。
 *
 * 本文件保持纯数据层（无 DOM / 无 notice 依赖），供 node 环境测试直接加载。
 */
import { jsonStore } from '../../core/json-store';
import { tryGetSettings } from '../../core/settings-provider';

/** 文献盒（CONTEXT.md「Literature Box」）：v1 候选范围与触发监听都限定此目录 */
export const LITERATURE_BOX = '文献盒';

/** 待处理队列条目（spec「数据设计」：存事件不存半成品） */
export interface LinkQueueItem {
  path: string;
  /** 入队时的内容哈希（同 path 重入队刷新） */
  hash?: string;
  /** ISO 时间戳 */
  queuedAt?: string;
}

/** 队列文件路径（ADR-0009：storagePath 为唯一目录口径，同 review/data.ts 模式） */
export function getLinkQueueFilePath(): string {
  const s = tryGetSettings() as any;
  const dir =
    String(s.storagePath ?? '')
      .trim()
      .replace(/\/+$/, '') || 'CONFIG/STORAGE';
  return `${dir}/secondbrain_link_queue.json`;
}

/** 目录边界判定：path 恰为 folder 或位于其下（递归语义；与 review/watch.isUnderFolder 同构，域内私有副本不跨域 import） */
export function isUnderFolder(folder: string, path: string): boolean {
  const f = (folder || '').trim().replace(/\/+$/, '');
  if (!f) return false;
  return path === f || path.startsWith(f + '/');
}

/** 内容哈希（FNV-1a 32 位 hex + 长度后缀）：同 path 重入队判定内容是否变化用 */
export function computeHash(content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + ':' + content.length.toString(16);
}

// ---------------- related 属性：解析 / 幂等合并 / 失效清理规划 ----------------

/** 从 frontmatter 值解析 related 字符串数组（容忍数组 / 单字符串 / 缺失 / 畸形项） */
export function parseRelatedEntries(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0);
}

/** 目标 vault 路径（含 .md）→ related 条目字符串 `[[路径去.md]]` */
export function toRelatedEntry(targetPath: string): string {
  return `[[${targetPath.replace(/\.md$/i, '')}]]`;
}

/**
 * related 条目 → 目标 vault 路径（去 .md）；非 wikilink / 空值返回 null。
 * 容忍别名（`[[p|别名]]`）、块引用（`[[p#^id]]`）、多余括号与 .md 后缀。
 */
export function normalizeRelatedEntry(entry: string): string | null {
  const m = String(entry ?? '').match(/\[\[\s*([^\][]+?)\s*(?:#[^\][]*)?(?:\|[^\][]*)?\]\]/);
  if (!m) return null;
  const p = m[1].trim().replace(/\.md$/i, '');
  return p || null;
}

/**
 * 幂等合并：additions 中未存在于 existing 的链追加在后（保序），总量超 maxLinks（>0 才生效）截断。
 * 返回最终数组与实际新增项（added 已计入截断——被截掉的不算新建）。
 */
export function mergeRelated(
  existing: string[],
  additions: string[],
  maxLinks = 0
): { entries: string[]; added: string[] } {
  const have = new Set(existing.map((e) => e.trim()).filter(Boolean));
  const appended: string[] = [];
  for (const a of additions) {
    const key = a.trim();
    if (!key || have.has(key)) continue;
    have.add(key);
    appended.push(key);
  }
  let entries = [...existing, ...appended];
  let added = appended;
  if (maxLinks > 0 && entries.length > maxLinks) {
    entries = entries.slice(0, maxLinks);
    const kept = new Set(entries);
    added = appended.filter((a) => kept.has(a));
  }
  return { entries, added };
}

/** 失效清理规划：keep 保留条目 / removed 判死条目（isAlive 为目标路径存在性判定） */
export function planRemovals(
  entries: string[],
  isAlive: (targetPath: string) => boolean
): { keep: string[]; removed: string[] } {
  const keep: string[] = [];
  const removed: string[] = [];
  for (const e of entries) {
    const target = normalizeRelatedEntry(e);
    if (target === null || isAlive(target)) keep.push(e);
    else removed.push(e);
  }
  return { keep, removed };
}

// ---------------- 待处理队列 CRUD（jsonStore；消费方拿到后跑完整管线） ----------------

/** 读队列（不存在/畸形按空队处理；jsonStore 自带损坏留档重建兜底） */
export async function loadQueue(): Promise<LinkQueueItem[]> {
  const data = await jsonStore(getLinkQueueFilePath()).read();
  if (!Array.isArray(data)) return [];
  return data
    .filter((it) => it && typeof it.path === 'string' && it.path.endsWith('.md'))
    .map((it: any) => ({
      path: it.path as string,
      hash: typeof it.hash === 'string' ? it.hash : undefined,
      queuedAt: typeof it.queuedAt === 'string' ? it.queuedAt : undefined,
    }));
}

/** 写队列 */
export async function saveQueue(items: LinkQueueItem[]): Promise<void> {
  await jsonStore(getLinkQueueFilePath()).write(items);
}

/**
 * 入队：同 path 合并并刷新 hash 与 queuedAt（幂等重入队不产生重复条目）。
 * @param hashes 可选 path→hash 映射（管线在入队前已算好内容哈希）
 */
export async function enqueuePaths(paths: string[], hashes?: Record<string, string>): Promise<void> {
  const items = await loadQueue();
  const now = new Date().toISOString();
  for (const path of paths) {
    if (!path || !path.endsWith('.md')) continue;
    const cur = items.find((i) => i.path === path);
    const hash = hashes?.[path];
    if (cur) {
      if (hash !== undefined) cur.hash = hash;
      cur.queuedAt = now;
    } else {
      items.push({ path, ...(hash !== undefined ? { hash } : {}), queuedAt: now });
    }
  }
  await saveQueue(items);
}

/** 消费成功移除单条（不存在则空操作） */
export async function dequeuePath(path: string): Promise<void> {
  const items = await loadQueue();
  const next = items.filter((i) => i.path !== path);
  if (next.length !== items.length) await saveQueue(next);
}

/** 对应文件已删除的条目顺带清理；返回移除数 */
export async function pruneQueueByExists(exists: (path: string) => boolean): Promise<number> {
  const items = await loadQueue();
  const next = items.filter((i) => exists(i.path));
  const removed = items.length - next.length;
  if (removed > 0) await saveQueue(next);
  return removed;
}

// ---------------- 裁判输出解析（严格 JSON `[{"id":1,"reason":"..."}]`） ----------------

export interface JudgePick {
  id: number;
  reason: string;
}

/**
 * 解析裁判输出为合法选项列表；任何畸形（非 JSON / 非数组 / id 越界 / 空串）整体或逐项丢弃，
 * 全部非法返回 []（= 无关联）。容忍 markdown 代码围栏包裹。
 */
export function parseJudgeOutput(text: string, maxId: number): JudgePick[] {
  if (!text) return [];
  let body = String(text).trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();
  const arrMatch = body.match(/\[[\s\S]*\]/);
  if (!arrMatch) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(arrMatch[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: JudgePick[] = [];
  const seen = new Set<number>();
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as any).id;
    const reason = (item as any).reason;
    if (!Number.isInteger(id) || id < 1 || id > maxId) continue;
    if (typeof reason !== 'string' || !reason.trim()) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, reason: reason.trim() });
  }
  return out;
}
