/**
 * 每周知识动态 · 数据层（issue 360）
 *
 * 职责：每周静默聚合一次「本周知识库动态」——新增笔记数 / 新增关联数 / 主题撞车提示，
 * 有实质内容才产出（通知入口 + 弹层回放 + 主面板入口卡），无新内容零打扰。
 *
 * 数据口径（本文件为单一事实源，测试同锚）：
 * - 周界（滚动 7 天）：距上次聚合 lastRunAt ≥ WEEKLY_INTERVAL_MS 才再聚；聚合窗口 =
 *   (lastRunAt, now]，弹层与入口卡标注实际日期区间（「本周」为概念口径——每 ~7 天一份、
 *   报告最近一周动态，周日晚打开看到的就是本周新增）。首轮（无 lastRunAt）只立基线不产出：
 *   无对照快照时全部存量笔记都会被判「新增」，打扰且无意义；索引未就绪（空库待首次向量化）
 *   则连基线也延迟——本次跳过不写 lastRunAt，待索引就绪后的下一轮再立。
 * - 新增笔记：当前 meta.notes 键 − 上次快照 knownPaths 键（mtime 降序）。mtime 是文件修改时间，
 *   区分不了「新笔记」与「改笔记」，快照差分才是「新入脑」的真相；快照随每轮聚合刷新
 *   （knownPaths = 当前键，删除的笔记自然出局）。
 * - 新增关联：link.state 中 linkedAt 落在窗口内且 empty !== true 的条目（linkedAt 在每次成功
 *   建链后随基准哈希落盘——「已尝试且 0 条」的空跑不算新增关联）。
 * - 撞车阈值（两个通道，代码即口径、测试同锚）：
 *   ① 向量近邻（桌面默认）：vectorSearch 分数（原始余弦 [0,1]，与参考面板百分比同尺——
 *      issue 425/ADR-0185 起不再做 score^0.35 锐化）≥ WEEKLY_COLLISION_SCORE(0.63) 判「高度重合」，
 *      刻意高于自动关联候选下限 linkAgentMinScore 默认 0.30：「高度重合」要比「值得建链」严得多。
 *      查询文本 = 笔记标题 + 首块（≤ WEEKLY_QUERY_MAX_CHARS 截尾），控制嵌入调用成本。
 *   ② TF-IDF 降级（移动端 / embedding 不可达）：TFIDF BM25（chunk 粒度）先取近邻短名单，
 *      再以 TFIDF.tokenize 分词的 token 覆盖率（containment = |q∩d| / |q|，[0,1] 有绝对标尺）
 *      ≥ WEEKLY_COLLISION_CONTAINMENT(0.7) 复检判撞——BM25 分数经 max 归一后 top 恒为 1.0，
 *      无绝对阈值可用，故降级口径落在覆盖率上。
 * - 成本控制（issue Notes「摘要聚合优先用本地数据」）：近邻检索只对最近 WEEKLY_MAX_COLLISION_CHECKS
 *   篇新笔记执行；TF-IDF 索引每轮至多构建一次（懒构建）；AI 文案可选（未配置/失败静默降级纯列表，不阻塞）。
 * - 撞车目标只认「既有内容」：target 必须在上轮快照 knownPaths 内（新笔记互撞不冒充「与既有内容重合」）。
 *
 * 纯数据层（无 DOM / 无 notice 依赖），node 环境可测；通知与弹层在 weekly-ui.ts。
 */
import { loadStore, mutateStore, type WeeklyDigest, type WeeklyStoreSection } from './store-file';
import { loadLinkState } from './link-agent/data';
import { TFIDF } from './tfidf';
import { noteTitleFromPath } from './chunk';
import { buildConfig, IS_MOBILE } from './config';
import type { SearchHit } from './vector-store';

/** 周界：滚动 7 天（ms）——距上次聚合不足 7 天不再聚（测试可传 intervalMs 覆盖） */
export const WEEKLY_INTERVAL_MS = 7 * 24 * 3600 * 1000;

/**
 * 撞车阈值 · 向量通道（issue 360；issue 425/ADR-0185 换算到原始余弦尺）：vectorSearch 分数
 * （原始余弦 [0,1]，参考面板百分比同尺）≥ 0.63 判「高度重合」；高于自动关联候选下限 0.30——
 * 同一把尺上的两档语义：0.30「值得送 AI 裁判建链」，0.63「内容高度重合该提醒了」。
 * 0.63 即旧锐化尺 0.85（0.85^(1/0.35)）的同语义换算值。
 */
export const WEEKLY_COLLISION_SCORE = 0.63;

/**
 * 撞车阈值 · TF-IDF 降级通道：新笔记 token（TFIDF.tokenize，去停用词）被候选笔记覆盖率
 * ≥ 0.7 判「高度重合」。BM25 只作短名单召回（归一后 top 恒 1.0 无绝对标尺），判定落覆盖率。
 */
export const WEEKLY_COLLISION_CONTAINMENT = 0.7;

/** 成本护栏：单轮最多对最近 N 篇新笔记跑近邻检索（嵌入调用有成本） */
export const WEEKLY_MAX_COLLISION_CHECKS = 12;
/** 撞车提示条数上限 */
export const WEEKLY_MAX_COLLISIONS = 10;
/** 摘要各列表落盘上限（防长年撑大 secondbrain.json；UI 再自行取 Top N） */
export const WEEKLY_MAX_LIST = 200;
/** 向量通道查询文本截尾（标题 + 首块足够判「重合」，全文嵌入留给建链管线） */
export const WEEKLY_QUERY_MAX_CHARS = 1000;
/** TF-IDF 降级通道的 BM25 短名单长度（短名单内再做覆盖率复检） */
export const WEEKLY_TFIDF_SHORTLIST = 5;

/** 聚合结果状态：baseline 首轮立基线 / not-due 未到周界 / empty 空轮零打扰 / done 有产出 */
export type WeeklyRunStatus = 'baseline' | 'not-due' | 'empty' | 'done';

export interface WeeklyRunResult {
  status: WeeklyRunStatus;
  digest: WeeklyDigest | null;
}

/** 周界判定（纯函数）：无 lastRunAt → false（首轮立基线，不算「到期」）；距上次 ≥ interval → true */
export function isWeeklyRunDue(
  lastRunAt: number | null | undefined,
  now: number,
  intervalMs: number = WEEKLY_INTERVAL_MS
): boolean {
  if (typeof lastRunAt !== 'number' || !isFinite(lastRunAt) || lastRunAt <= 0) return false;
  return now - lastRunAt >= intervalMs;
}

/** 新增笔记差分（纯函数）：当前键 − 快照键，mtime 降序；畸形条目（mtime 非数）按 0 兜底排尾 */
export function diffNewNotes(
  currentNotes: Record<string, { mtime?: number } | undefined>,
  knownPaths: string[] | null | undefined
): Array<{ path: string; mtime: number }> {
  const known = new Set(knownPaths || []);
  const out: Array<{ path: string; mtime: number }> = [];
  for (const [path, entry] of Object.entries(currentNotes || {})) {
    if (known.has(path)) continue;
    const mtime = typeof entry?.mtime === 'number' && isFinite(entry.mtime) ? entry.mtime : 0;
    out.push({ path, mtime });
  }
  return out.sort((a, b) => b.mtime - a.mtime || a.path.localeCompare(b.path));
}

/** 新增关联收集（纯函数）：link.state 中 linkedAt 落在 (since, +∞) 且非空跑（empty!==true）的条目，时间降序 */
export function collectNewLinks(
  state: Record<string, { hash: string; linkedAt: string; empty?: boolean }>,
  sinceMs: number
): Array<{ path: string; linkedAt: string }> {
  const out: Array<{ path: string; linkedAt: string }> = [];
  for (const [path, entry] of Object.entries(state || {})) {
    if (!entry || typeof entry.linkedAt !== 'string' || !entry.linkedAt) continue;
    if (entry.empty === true) continue; // 「已尝试且 0 条」：没建出任何关联，不算新增
    const t = Date.parse(entry.linkedAt);
    if (!isFinite(t) || t <= sinceMs) continue;
    out.push({ path, linkedAt: entry.linkedAt });
  }
  return out.sort((a, b) => Date.parse(b.linkedAt) - Date.parse(a.linkedAt) || a.path.localeCompare(b.path));
}

/**
 * token 覆盖率（纯函数，TF-IDF 降级通道的判定标尺）：query 的 token（去停用词）被 doc 覆盖的比例。
 * query 无有效 token → 0（无从判重合，不误报）。
 */
export function tokenContainment(query: string, doc: string): number {
  const qTokens = [...new Set(TFIDF.tokenize(query))];
  if (!qTokens.length) return 0;
  const dTokens = new Set(TFIDF.tokenize(doc));
  let hit = 0;
  for (const t of qTokens) if (dTokens.has(t)) hit++;
  return hit / qTokens.length;
}

/** 撞车候选挑拣（纯函数 · 向量通道）：命中里取「分最高且 ≥ 阈值」的既有笔记；无达标者返回 null */
export function pickVectorCollision(
  selfPath: string,
  hits: SearchHit[],
  existingPaths: Set<string>,
  threshold: number = WEEKLY_COLLISION_SCORE
): { path: string; targetPath: string; score: number; mode: 'vector' } | null {
  // 同 path 多 chunk 命中先归并到最高分（去重不能早于取最优，否则低分首命会顶掉高分后命）
  const bestByPath = new Map<string, SearchHit>();
  for (const h of hits) {
    if (h.path === selfPath) continue; // 自身不算撞
    if (!existingPaths.has(h.path)) continue; // 撞车目标只认既有内容（本轮新笔记互撞不冒充）
    const cur = bestByPath.get(h.path);
    if (!cur || h.score > cur.score) bestByPath.set(h.path, h);
  }
  let best: SearchHit | null = null;
  for (const h of bestByPath.values()) {
    if (h.score < threshold) continue;
    if (!best || h.score > best.score) best = h;
  }
  if (!best) return null;
  return { path: selfPath, targetPath: best.path, score: best.score, mode: 'vector' };
}

/** 撞车候选挑拣（纯函数 · TF-IDF 降级通道）：短名单内取覆盖率最高且 ≥ 阈值者；docTextOf 取不到正文返回 null */
export function pickTfidfCollision(
  selfPath: string,
  selfText: string,
  hits: Array<{ path: string }>,
  docTextOf: (path: string) => string,
  existingPaths: Set<string>,
  threshold: number = WEEKLY_COLLISION_CONTAINMENT
): { path: string; targetPath: string; score: number; mode: 'tfidf' } | null {
  let best: { targetPath: string; score: number } | null = null;
  const seen = new Set<string>();
  for (const h of hits) {
    if (h.path === selfPath) continue;
    if (!existingPaths.has(h.path)) continue;
    if (seen.has(h.path)) continue;
    seen.add(h.path);
    const score = tokenContainment(selfText, docTextOf(h.path));
    if (score < threshold) continue;
    if (!best || score > best.score) best = { targetPath: h.path, score };
  }
  if (!best) return null;
  return { path: selfPath, targetPath: best.targetPath, score: best.score, mode: 'tfidf' };
}

/** 日期区间（纯函数）：「9 月 8 日 – 9 月 15 日」（跨年补年份） */
export function formatDigestRange(since: number, until: number): string {
  const a = new Date(since);
  const b = new Date(until);
  const day = (d: Date) => `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = sameYear ? day(a) : `${a.getFullYear()} 年 ${day(a)}`;
  return `${left} – ${day(b)}`;
}

/** 聚合依赖最小面（只消费公开成员；测试用假实现） */
export interface WeeklyStoreLike {
  meta: { notes: Record<string, { mtime: number; chunks: { text: string }[] }> };
  vectorSearch(query: string, topK?: number, baseUrl?: string): Promise<SearchHit[]>;
  /**
   * 索引就绪判定（可选，VectorStore.isIndexReady 同款）：首轮「空索引延迟立基线」用它——
   * 缺省时按 meta.notes 是否为空兜底（空库必不就绪；有残留 meta 但向量未装载的损坏态由真实现报告）。
   */
  isIndexReady?: () => boolean;
}

export interface WeeklyRunOptions {
  /** 手动命令直跑：跳过周界判定（首轮亦照常产出——有快照对照才有意义，无快照仍只立基线） */
  force?: boolean;
  now?: number;
  /** 探测 embedding 可达（默认走 link-agent 的 probeEmbeddingReachable；测试注入免真实网络） */
  probe?: () => Promise<boolean>;
  /** AI 文案生成（默认 AI.ask；测试注入；返回 null/抛错 = 降级纯列表） */
  askAI?: (prompt: string) => Promise<string>;
}

/** 摘要有无实质内容（空轮零打扰的判据） */
function hasSubstance(d: WeeklyDigest): boolean {
  return d.newNotes.length > 0 || d.newLinks.length > 0 || d.collisions.length > 0;
}

/** AI 人话总结（可选步）：提示词给计数与撞车名单，要一段人话；失败/未配置由调用方静默降级 */
export function buildWeeklySummaryPrompt(digest: WeeklyDigest): string {
  const noteNames = digest.newNotes.slice(0, 20).map((n) => noteTitleFromPath(n.path));
  const collideNames = digest.collisions
    .slice(0, 10)
    .map((c) => `${noteTitleFromPath(c.path)} 与 ${noteTitleFromPath(c.targetPath)} 高度重合`);
  return [
    `这是知识库最近一周的动态：新增笔记 ${digest.newNotes.length} 篇、新增关联 ${digest.newLinks.length} 条、` +
      `其中 ${digest.collisions.length} 篇与既有内容高度重合。`,
    noteNames.length ? `新增笔记：${noteNames.join('、')}。` : '',
    collideNames.length ? `撞车情况：${collideNames.join('；')}。` : '',
    '请用不超过三句的中文，口吻平实地说说这一周知识库的变化，并点出值得注意的重复内容。不要分点，不要标题，不要使用 emoji。',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * 聚合编排：读盘状态 → 周界判定 → 差分（新增笔记/关联）→ 撞车检测（向量优先、TF-IDF 降级）→
 * 可选 AI 文案 → 落盘（lastRunAt/knownPaths 每轮必写、空索引首轮除外；digest 仅非空轮写）。
 * 抛错一律向上（调用方 catch 后静默告警——周报是后台任务，不弹错误打扰）。
 */
export async function runWeeklyDigest(store: WeeklyStoreLike, opts: WeeklyRunOptions = {}): Promise<WeeklyRunResult> {
  const now = opts.now ?? Date.now();
  const prev = (await loadStore()).weekly;
  const currentPaths = Object.keys(store.meta.notes);

  // 首轮（无 lastRunAt）：只立基线不产出（无对照快照，产出必是全库噪音）
  if (!prev) {
    // 空索引延迟立基线（审查修复）：索引未就绪（空库等首次向量化）时本次跳过、不写 lastRunAt——
    // 否则基线立在空库上，稍后首次向量化全库入索引，下轮差分把全部存量误报「新增」
    const indexReady = store.isIndexReady ? store.isIndexReady() : currentPaths.length > 0;
    if (!indexReady) return { status: 'baseline', digest: null };
    await saveWeeklySection({ lastRunAt: now, knownPaths: currentPaths, digest: null });
    return { status: 'baseline', digest: null };
  }
  // 周界判定：距上次不足 7 天不再聚（force = 手动命令直跑）
  if (!opts.force && !isWeeklyRunDue(prev.lastRunAt, now)) {
    return { status: 'not-due', digest: prev.digest };
  }

  // 摘要区间起点收敛到 now（审查修复）：时钟回拨后 lastRunAt 在未来，直接取会让 since > until
  //（区间倒置渲染）；force 手动路径可触发，取 min 保证区间恒为正序
  const since = Math.min(prev.lastRunAt, now);
  const newNotes = diffNewNotes(store.meta.notes, prev.knownPaths);
  const newLinks = collectNewLinks(await loadLinkState(), since);
  const collisions = await detectCollisions(store, newNotes, prev, opts);

  const digest: WeeklyDigest = {
    generatedAt: now,
    since,
    until: now,
    newNotes: newNotes.slice(0, WEEKLY_MAX_LIST),
    newLinks: newLinks.slice(0, WEEKLY_MAX_LIST),
    collisions: collisions.slice(0, WEEKLY_MAX_COLLISIONS),
  };

  // AI 文案可选（issue 360）：未配置/失败降级纯列表，不阻塞产出
  if (hasSubstance(digest) && opts.askAI) {
    try {
      const text = await opts.askAI(buildWeeklySummaryPrompt(digest));
      const trimmed = String(text || '').trim();
      if (trimmed) digest.aiSummary = trimmed;
    } catch {
      /* AI 未配置或失败：纯列表呈现 */
    }
  }

  const next: WeeklyStoreSection = {
    lastRunAt: now,
    knownPaths: currentPaths,
    digest: hasSubstance(digest) ? digest : prev.digest, // 空轮保留上一份非空摘要供面板入口卡回放
  };
  await saveWeeklySection(next);
  return { status: hasSubstance(digest) ? 'done' : 'empty', digest: hasSubstance(digest) ? digest : null };
}

/** 写回 weekly 段（经 store-file 串行写链，与 meta/link/chatHistory 各段互斥） */
async function saveWeeklySection(section: WeeklyStoreSection): Promise<void> {
  await mutateStore((s) => {
    s.weekly = section;
  });
}

/**
 * 撞车检测：向量通道（探测 embedding 可达 → 逐篇 vectorSearch）优先；
 * 不可达/移动端降级 TF-IDF：BM25（chunk 粒度、只收既有笔记）短名单 → 覆盖率复检。
 * 通道内单篇失败跳过该篇（不拖垮整轮）；只查最近 WEEKLY_MAX_COLLISION_CHECKS 篇控成本。
 */
async function detectCollisions(
  store: WeeklyStoreLike,
  newNotes: Array<{ path: string; mtime: number }>,
  prev: WeeklyStoreSection,
  opts: WeeklyRunOptions
): Promise<WeeklyDigest['collisions']> {
  if (!newNotes.length) return [];
  const targets = newNotes.slice(0, WEEKLY_MAX_COLLISION_CHECKS);
  const existingPaths = new Set(prev.knownPaths);
  const out: WeeklyDigest['collisions'] = [];

  const probe = opts.probe ?? (await import('./link-agent/pipeline')).probeEmbeddingReachable;
  const useVector = await probe().catch(() => false);
  // 嵌入端点与 link-agent.findCandidates 同规则：移动端优先远程 URL，桌面本地（undefined = ollama.ts 默认）
  const cfg = buildConfig();
  const baseUrl = IS_MOBILE ? cfg.OLLAMA_REMOTE_URL || cfg.OLLAMA_URL : undefined;

  if (useVector) {
    for (const note of targets) {
      try {
        const hits = await store.vectorSearch(queryTextOf(note.path, store), WEEKLY_TFIDF_SHORTLIST * 2, baseUrl);
        const c = pickVectorCollision(note.path, hits, existingPaths);
        if (c) out.push(c);
      } catch {
        /* 单篇检索失败跳过 */
      }
    }
    return out;
  }

  // TF-IDF 降级：懒构建一次（chunk 粒度、只收既有笔记——新笔记互撞不进索引）
  const docs: Array<{ path: string; text: string }> = [];
  for (const [path, entry] of Object.entries(store.meta.notes)) {
    if (!existingPaths.has(path)) continue;
    for (const chunk of entry.chunks) {
      if (chunk.text) docs.push({ path, text: chunk.text });
    }
  }
  if (!docs.length) return [];
  const tfidf = new TFIDF();
  tfidf.build(docs);
  if (tfidf.N === 0) return [];
  for (const note of targets) {
    try {
      const selfText = fullTextOf(note.path, store);
      if (!selfText) continue;
      const hits = tfidf.search(selfText.slice(0, WEEKLY_QUERY_MAX_CHARS), WEEKLY_TFIDF_SHORTLIST);
      const c = pickTfidfCollision(
        note.path,
        selfText,
        hits,
        (p) => fullTextOf(p, store),
        existingPaths
      );
      if (c) out.push(c);
    } catch {
      /* 单篇失败跳过 */
    }
  }
  return out;
}

/** 向量通道查询文本：标题 + 首块（≤ WEEKLY_QUERY_MAX_CHARS） */
function queryTextOf(path: string, store: WeeklyStoreLike): string {
  const entry = store.meta.notes[path];
  const first = entry?.chunks[0]?.text || '';
  return (noteTitleFromPath(path) + '\n' + first).slice(0, WEEKLY_QUERY_MAX_CHARS);
}

/** 全文拼接（TF-IDF 通道覆盖率与查询用；title 在首块里已含） */
function fullTextOf(path: string, store: WeeklyStoreLike): string {
  const entry = store.meta.notes[path];
  if (!entry) return '';
  return entry.chunks
    .map((c) => c.text)
    .filter(Boolean)
    .join('\n');
}
