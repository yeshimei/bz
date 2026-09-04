/**
 * 自动双链管线数据层（ticket 111；spec `.scratch/secondbrain-link-agent/spec.md`）
 *
 * 职责：
 * - 待处理队列 link 段（ticket 120：并入 secondbrain.json 的 link.queue，原独立
 *   secondbrain_link_queue.json 由 store-file 一次性迁移）：
 *   同 path 合并刷新 hash、消费成功移除、失败保留、对应文件删除时顺带清理；
 * - 正文基准哈希 link 段（ticket 120：link.state，原独立 secondbrain_link_state.json 迁移）：
 *   记录每篇笔记最近一次成功建链时的全文内容哈希——修改监听据此判断"内容是否有实质变化才重跑"；
 * - related 属性解析与幂等写入的纯函数部分：只写新笔记侧，已存在的链不重复添加，
 *   `linkAgentMaxLinks > 0` 时截断，默认 0 = 不限量；
 * - 裁判输出（严格 JSON `[{"id":1,"reason":"..."}]`）解析。
 *
 * 本文件保持纯数据层（无 DOM / 无 notice 依赖），供 node 环境测试直接加载；
 * queue/state 经 store-file 串行写链读写（与 meta/panel 段互斥）。
 */
import { loadStore, mutateStore } from '../store-file';
import { tryGetSettings } from '../../core/settings-provider';

/**
 * 关联范围解析（linkAgentScopes）：英文逗号分隔的 vault 内目录清单（风格同 aiAgentWatchedFolders），
 * 只决定**哪些笔记会被自动关联**（目标/触发侧：落盘监听目录 + 存量补链目标清单）；
 * **候选来源不受本范围限制**——一律取白名单索引库（secondBrainAllowPaths）中的全部笔记近邻。
 * 空值/缺省 = 什么也不录（不自动关联任何笔记），**不是**全库意思（用户拍板，ticket 116）。
 */
export function parseScopeList(raw: unknown): string[] {
  const list = String(raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  // 无 fallback：空 = 空（此前缺省回退「文献盒」，ticket 116 移除）
  return [...new Set(list)];
}

/** 读当前设置的关联范围目录清单（实时读取，弹窗改动即时生效于后续事件） */
export function getLinkAgentScopes(): string[] {
  return parseScopeList((tryGetSettings() as any).linkAgentScopes);
}

/**
 * 范围命中判定（目标/触发侧）：空范围 = 什么也不录入（任何路径都不命中），非空按目录递归匹配。
 * 用于监听触发、补链目标、死链扫描；候选检索不使用本判定。
 */
export function matchesScope(scopes: string[], path: string): boolean {
  if (!scopes.length) return false;
  return scopes.some((dir) => isUnderFolder(dir, path));
}

// ---------------- 存量补链目标清单（ticket 115） ----------------

export interface BackfillTargetPredicates {
  /** 是否位于关联范围内（linkAgentScopes） */
  inScope: (path: string) => boolean;
  /** frontmatter 是否已含 related（已连接的笔记跳过，related 即进度检查点） */
  hasRelated: (path: string) => boolean;
  /** 排除（加密锁定目录 / 队列内待重试条目等） */
  excluded: (path: string) => boolean;
}

/**
 * 计算存量补链目标清单（纯函数，node 环境可测）：
 * 只收 .md、去重、按路径字典序稳定输出；范围外 / 已含 related / 被排除的一律剔除。
 * 由调用方把 app（vault/metadataCache/encrypt 边界/队列）翻译成三个谓词。
 */
export function computeBackfillTargets(allPaths: string[], opts: BackfillTargetPredicates): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...allPaths].sort()) {
    if (!p.endsWith('.md') || seen.has(p)) continue;
    seen.add(p);
    if (!opts.inScope(p) || opts.hasRelated(p) || opts.excluded(p)) continue;
    out.push(p);
  }
  return out;
}

/** 待处理队列条目（spec「数据设计」：存事件不存半成品） */
export interface LinkQueueItem {
  path: string;
  /** 入队时的内容哈希（同 path 重入队刷新） */
  hash?: string;
  /** ISO 时间戳 */
  queuedAt?: string;
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

/**
 * 「笔记已有关联」判定（v1.7/ticket 167）：related **非空**（至少 1 个有效条目）才算「有」；
 * `related: []` / 空值 / 缺失一律视为未接管（自动双链继续建链）。
 * 与存量补链 hasRelated（ticket 115）同一语义，统一出口。
 */
export function hasRelatedEntries(value: unknown): boolean {
  return parseRelatedEntries(value).length > 0;
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

// ---------------- 待处理队列 CRUD（ticket 120：store link.queue 段；消费方拿到后跑完整管线） ----------------

/** 读队列（不存在/畸形按空队处理；store-file 自带损坏留档重建兜底） */
export async function loadQueue(): Promise<LinkQueueItem[]> {
  const store = await loadStore();
  const data = store.link.queue;
  if (!Array.isArray(data)) return [];
  return data
    .filter((it) => it && typeof it.path === 'string' && it.path.endsWith('.md'))
    .map((it: any) => ({
      path: it.path as string,
      hash: typeof it.hash === 'string' ? it.hash : undefined,
      queuedAt: typeof it.queuedAt === 'string' ? it.queuedAt : undefined,
    }));
}


/**
 * 入队：同 path 合并并刷新 hash 与 queuedAt（幂等重入队不产生重复条目）。
 * @param hashes 可选 path→hash 映射（管线在入队前已算好内容哈希）
 */
export async function enqueuePaths(paths: string[], hashes?: Record<string, string>): Promise<void> {
  const now = new Date().toISOString();
  await mutateStore((s) => {
    const items = Array.isArray(s.link.queue) ? s.link.queue : [];
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
    s.link.queue = items;
  });
}

/** 消费成功移除单条（不存在则空操作） */
export async function dequeuePath(path: string): Promise<void> {
  await mutateStore((s) => {
    const items = Array.isArray(s.link.queue) ? s.link.queue : [];
    const next = items.filter((i) => i.path !== path);
    if (next.length !== items.length) s.link.queue = next;
  });
}

/** 对应文件已删除的条目顺带清理；返回移除数 */
export async function pruneQueueByExists(exists: (path: string) => boolean): Promise<number> {
  let removed = 0;
  await mutateStore((s) => {
    const items = Array.isArray(s.link.queue) ? s.link.queue : [];
    const next = items.filter((i) => exists(i.path));
    removed = items.length - next.length;
    if (removed > 0) s.link.queue = next;
  });
  return removed;
}

// ---------------- 正文基准哈希（v1.4/ticket 119：正文大改自动重跑；ticket 120：store link.state 段） ----------------

/** 基准状态条目：最近一次成功建链时的全文内容哈希 + 时间戳 */
export interface LinkStateEntry {
  hash: string;
  linkedAt: string;
}

/** 全部基准状态：path → 条目 */
export type LinkStateMap = Record<string, LinkStateEntry>;

/**
 * 读全部基准状态：文件不存在 / 非对象（损坏或旧 [] 形态）一律按空对象处理。
 * store-file 底层对损坏文件走改名留档重建（jsonStore 同款），此处再兜一层对象形态校验。
 */
export async function loadLinkState(): Promise<LinkStateMap> {
  const store = await loadStore();
  const data = store.link.state;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: LinkStateMap = {};
  for (const [path, entry] of Object.entries(data as Record<string, unknown>)) {
    const e = entry as LinkStateEntry | null | undefined;
    if (e && typeof e === 'object' && typeof e.hash === 'string' && e.hash) {
      out[path] = { hash: e.hash, linkedAt: typeof e.linkedAt === 'string' ? e.linkedAt : '' };
    }
  }
  return out;
}

/** upsert 单篇基准（成功建链后调用）：刷新全文内容哈希与时间戳 */
export async function upsertLinkState(path: string, hash: string): Promise<void> {
  if (!path || !hash) return;
  await mutateStore((s) => {
    s.link.state[path] = { hash, linkedAt: new Date().toISOString() };
  });
}

/** 移除单篇基准（文件删除清理时用；不存在则空操作） */
export async function removeLinkState(path: string): Promise<void> {
  await mutateStore((s) => {
    if (path in s.link.state) delete s.link.state[path];
  });
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
