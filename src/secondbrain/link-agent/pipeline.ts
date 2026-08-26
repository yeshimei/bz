/**
 * 自动双链管线（ticket 111）：embedding 可达性门 → 增量索引 → 文献盒内向量近邻 Top-K →
 * core AI 裁判（ADR-0052 统一通道）→ 单侧写入 related。
 *
 * 流程对齐 spec `.scratch/secondbrain-link-agent/spec.md`「核心流程」②③④⑥：
 * - 探测短超时 ~1.5s（复用 secondBrainRemoteOllamaUrl/Ollama 客户端配置，移动端远程优先同 doRefresh 规则）；
 * - 不可达 → 入队（secondbrain_link_queue.json）；可达 → 就地完整管线；
 * - 裁判 prompt 指令前缀固定（命中供应商前缀缓存），强调「只链实质关联，存疑不链」；
 * - 写入幂等：related 已存在的链不重复添加；linkAgentMaxLinks > 0 时裁判提示附上限且写入侧截断；
 * - 队列消费：域初始化发现队列非空且服务可达即自动消费，完成后合并通知；
 * - 死链清理：文献盒各笔记 related 中指向不存在文件的条目移除；encrypt 锁定文件一律跳过。
 */
import type { App, TFile } from 'obsidian';
import { notice, notify, NoticeHandle } from '../../core/notice';
import { tryGetSettings } from '../../core/settings-provider';
import { buildConfig, IS_MOBILE } from '../config';
import { AI } from '../ai';
import type { SearchHit } from '../vector-store';
import {
  LITERATURE_BOX,
  LinkQueueItem,
  computeHash,
  enqueuePaths,
  dequeuePath,
  loadQueue,
  mergeRelated,
  normalizeRelatedEntry,
  parseRelatedEntries,
  parseJudgeOutput,
  planRemovals,
  pruneQueueByExists,
  toRelatedEntry,
  isUnderFolder,
} from './data';

/** embedding 可达性探测超时（spec：短超时 ~1.5s） */
export const LINK_PROBE_TIMEOUT_MS = 1500;

/** 批次防抖窗口（spec「核心流程①」：约 1 分钟内的批次聚合）；测试可注入短值 */
export let LINK_BATCH_DELAY_MS = 60000;
export function __setLinkBatchMsForTests(ms: number): void {
  LINK_BATCH_DELAY_MS = ms;
}

/** 批次进度/完成 toast 的 dedupeKey（同键合并动态更新单条） */
export const LINK_BATCH_NOTICE_KEY = 'bz-sb-link-agent-batch';
/** 失败合并提示的 dedupeKey（连续多次失败只提示一次） */
export const LINK_ERROR_NOTICE_KEY = 'bz-sb-link-agent-error';

/** 管线依赖的向量库最小面（只调用公开方法，不修改 vector-store） */
export interface LinkStoreLike {
  refresh(updateProgress?: (msg: string) => void): Promise<void>;
  vectorSearch(query: string, topK?: number, baseUrl?: string): Promise<SearchHit[]>;
}

export interface LinkAgentDeps {
  app: App;
  store: LinkStoreLike;
  /** 可注入探测实现（默认 fetch /api/tags）；测试注入假探测避免真实网络 */
  probe?: () => Promise<boolean>;
}

export type ProcessOutcome =
  | { status: 'done'; created: number }
  | { status: 'queued' }
  | { status: 'skipped' }
  | { status: 'failed'; error: string };

export interface BatchSummary {
  total: number;
  processed: number;
  created: number;
  queued: number;
  failed: number;
}

/** 裁判指令前缀（固定不变，命中供应商前缀缓存——spec「核心流程③」） */
const JUDGE_PROMPT_PREFIX = [
  '你是笔记库的双链裁判。给定一篇新笔记的档案卡和若干候选笔记的档案卡，',
  '逐一判断候选与新笔记是否存在实质的知识关联（共同主题、直接引用、同一事件或人物、强互补上下文）。',
  '标准：只链实质关联，存疑不链；宁缺勿滥。',
  '输出要求：严格 JSON 数组 [{"id":<候选编号>,"reason":"一句话理由"}]，按关联强度降序；无关联输出 []；不要输出 JSON 以外的任何文字。',
].join('');

/** 候选池倍数：先取全局近邻大池，再过滤到文献盒范围截断 Top-K */
const CANDIDATE_POOL_MIN = 24;

function settingNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function boolSetting(v: unknown, fallback: boolean): boolean {
  return v === undefined || v === null ? fallback : v === true;
}

/** 剥 frontmatter 后的正文摘要（近邻查询词与新笔记档案卡首块共用） */
export function bodyExcerpt(content: string, maxLen: number): string {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, '');
  return body.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/**
 * embedding 服务可达性探测：GET <base>/api/tags，短超时 1.5s。
 * 端点规则与 vector-store.doRefresh 的 embedBase 一致：移动端优先远程 URL，桌面端本地。
 */
export async function probeEmbeddingReachable(baseUrl?: string): Promise<boolean> {
  const cfg = buildConfig();
  const url = baseUrl || (IS_MOBILE ? cfg.OLLAMA_REMOTE_URL || cfg.OLLAMA_URL : cfg.OLLAMA_URL);
  if (!url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_PROBE_TIMEOUT_MS);
  try {
    const resp = await fetch(`${url.replace(/\/+$/, '')}/api/tags`, { method: 'GET', signal: controller.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** encryptRoot 内的文件一律跳过（spec「错误处理与边界」） */
function isEncryptLockedPath(app: App, path: string): boolean {
  const s = tryGetSettings() as any;
  const root = String(s.encryptRoot || 'CONFIG/.ENCRYPT').replace(/\/+$/, '');
  return isUnderFolder(root, path);
}

export class LinkAgent {
  app: App;
  store: LinkStoreLike;
  private probeFn: () => Promise<boolean>;

  constructor(deps: LinkAgentDeps) {
    this.app = deps.app;
    this.store = deps.store;
    this.probeFn = deps.probe || (() => probeEmbeddingReachable());
  }

  private get maxTopK(): number {
    const s = tryGetSettings() as any;
    return settingNumber(s.linkAgentTopK, 8) || 8;
  }

  private get maxLinks(): number {
    const s = tryGetSettings() as any;
    return settingNumber(s.linkAgentMaxLinks, 0);
  }

  private get notifyEnabled(): boolean {
    const s = tryGetSettings() as any;
    return boolSetting(s.linkAgentNotify, true);
  }

  /** 单篇完整管线；assumeReachable=true 时跳过探测（队列消费已在入口统一探过） */
  async processNote(path: string, opts?: { assumeReachable?: boolean }): Promise<ProcessOutcome> {
    const s = tryGetSettings() as any;
    if (s.linkAgentEnabled === false) return { status: 'skipped' };
    const file = this.app.vault.getAbstractFileByPath(path) as TFile | null;
    if (!file || file.extension !== 'md') return { status: 'skipped' };
    if (isEncryptLockedPath(this.app, path)) return { status: 'skipped' };

    let content = '';
    try {
      content = await this.app.vault.read(file);
    } catch {
      return { status: 'skipped' };
    }
    const hash = computeHash(content);

    // ① 可达性门：不可达 → 入队（同 path 重入队由数据层合并刷新 hash）
    if (!opts?.assumeReachable) {
      const ok = await this.probeFn();
      if (!ok) {
        await enqueuePaths([path], { [path]: hash });
        return { status: 'queued' };
      }
    }

    // ② 增量索引：批内新笔记纳入后才有自身近邻可查（复用 store.refresh 公开增量入口）
    await this.store.refresh();

    const candidates = await this.findCandidates(path, content);

    // ③ 裁判（core AI，ADR-0052 统一通道）
    let picks: ReturnType<typeof parseJudgeOutput> = [];
    if (candidates.length > 0) {
      const prompt = this.buildJudgePrompt(file, content, candidates);
      let text = '';
      try {
        text = await AI.ask(prompt);
      } catch (e) {
        // 裁判失败：保留队列/下次重试（spec「错误处理与边界」）
        await enqueuePaths([path], { [path]: hash });
        return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
      }
      picks = parseJudgeOutput(text, candidates.length);
    }

    // ④ 写入：通过裁判的对子写入新笔记侧 related（单侧、幂等、上限截断在写入侧兜底）
    const links = picks
      .map((p) => candidates[p.id - 1])
      .filter((c) => !!c && c.path !== path && !!this.app.vault.getAbstractFileByPath(c.path));
    const created = await this.writeRelated(file, links.map((c) => c.path));
    return { status: 'done', created };
  }

  /** 文献盒范围内向量近邻候选：全局大池 → 过滤文献盒/去自身 → 按 path 去重取最优 → Top-K */
  async findCandidates(selfPath: string, content: string): Promise<SearchHit[]> {
    const topK = this.maxTopK;
    const cfg = buildConfig();
    const baseUrl = IS_MOBILE ? cfg.OLLAMA_REMOTE_URL || cfg.OLLAMA_URL : undefined;
    const pool = Math.max(topK * 3, CANDIDATE_POOL_MIN);
    let hits: SearchHit[] = [];
    try {
      hits = await this.store.vectorSearch(bodyExcerpt(content, 800), pool, baseUrl);
    } catch (e) {
      console.warn('[link-agent] 近邻检索失败', e);
      return [];
    }
    const bestByPath = new Map<string, SearchHit>();
    for (const hit of hits) {
      if (!isUnderFolder(LITERATURE_BOX, hit.path)) continue;
      if (hit.path === selfPath) continue;
      if (!this.app.vault.getAbstractFileByPath(hit.path)) continue;
      const cur = bestByPath.get(hit.path);
      if (!cur || hit.score > cur.score) bestByPath.set(hit.path, hit);
    }
    return [...bestByPath.values()].sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /** 组档案卡调 core AI 裁判；maxLinks>0 时提示附上限（写入侧仍截断兜底） */
  buildJudgePrompt(selfFile: TFile, selfContent: string, candidates: SearchHit[]): string {
    const s = tryGetSettings() as any;
    const maxLinks = settingNumber(s.linkAgentMaxLinks, 0);
    const lines: string[] = [JUDGE_PROMPT_PREFIX];
    if (maxLinks > 0) lines.push(`本次最多选择 ${maxLinks} 条。`);
    lines.push('', '## 新笔记');
    lines.push(this.dossierCard(selfFile, bodyExcerpt(selfContent, 400)));
    lines.push('', '## 候选笔记');
    candidates.forEach((c, i) => {
      const f = this.app.vault.getAbstractFileByPath(c.path) as TFile | null;
      lines.push(`### id=${i + 1}`);
      lines.push(this.dossierCard(f, (c.chunk || '').slice(0, 200)));
    });
    return lines.join('\n');
  }

  /** 档案卡紧凑格式：标题/tags/summary/首块截断 */
  private dossierCard(file: TFile | null, firstChunk: string): string {
    if (!file) return '-（文件缺失）';
    let tags = '';
    let summary = '';
    let title = file.basename;
    try {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
      if (fm) {
        if (typeof fm.title === 'string' && fm.title.trim()) title = fm.title.trim();
        else if (typeof fm['标题'] === 'string' && fm['标题'].trim()) title = fm['标题'].trim();
        const rawTags = fm.tags ?? fm.tag ?? fm['标签'];
        if (Array.isArray(rawTags)) tags = rawTags.map((t) => String(t)).join(', ');
        else if (typeof rawTags === 'string') tags = rawTags;
        const rawSummary = fm.summary ?? fm['简介'] ?? fm['一句话简介'];
        if (typeof rawSummary === 'string') summary = rawSummary;
      }
    } catch {
      /* metadataCache 缺失时退化为纯标题卡 */
    }
    const parts = [
      `标题：${title}`,
      tags ? `标签：${tags}` : '',
      summary ? `简介：${summary.slice(0, 120)}` : '',
      firstChunk ? `首块：${firstChunk}` : '',
    ].filter(Boolean);
    return `- ${parts.join('｜')}`;
  }

  /** 幂等写入 related（只写本笔记侧）；返回实际新增条数 */
  async writeRelated(file: TFile, targetPaths: string[]): Promise<number> {
    if (!targetPaths.length) return 0;
    let addedCount = 0;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        const existing = parseRelatedEntries(fm.related);
        const additions = targetPaths.map(toRelatedEntry);
        const merged = mergeRelated(existing, additions, this.maxLinks);
        addedCount = merged.added.length;
        if (merged.added.length > 0) {
          if (merged.entries.length > 0) fm.related = merged.entries;
          else delete fm.related;
        }
      });
    } catch (e) {
      console.warn('[link-agent] related 写入失败', e);
      return 0;
    }
    return addedCount;
  }

  /**
   * 批次处理：逐篇跑管线；批次进行中以 dedupeKey 合并动态更新单条 progress toast，
   * 结束时同键切换为完成通知（新建 0 条静默——隐藏进行中帧），失败合并提示一次。
   */
  async processBatch(paths: string[]): Promise<BatchSummary> {
    const summary: BatchSummary = { total: paths.length, processed: 0, created: 0, queued: 0, failed: 0 };
    if (!paths.length) return summary;
    const notifyOn = this.notifyEnabled;
    let handle: NoticeHandle | null = null;
    if (notifyOn) {
      handle = notify(`自动双链：处理中 0/${paths.length} 篇`, { type: 'progress', dedupeKey: LINK_BATCH_NOTICE_KEY });
    }
    for (let i = 0; i < paths.length; i++) {
      const outcome = await this.processNote(paths[i]);
      if (outcome.status === 'done') {
        summary.processed++;
        summary.created += outcome.created;
      } else if (outcome.status === 'queued') {
        summary.queued++;
      } else if (outcome.status === 'failed') {
        summary.failed++;
      }
      if (notifyOn) {
        // 同键合并：存活则原地更新消息并重置计时（notice 单框语义）
        notify(`自动双链：处理中 ${i + 1}/${paths.length} 篇`, { type: 'progress', dedupeKey: LINK_BATCH_NOTICE_KEY });
      }
    }
    if (notifyOn) {
      if (summary.created > 0) {
        notify(`本批新建关联 ${summary.created} 条`, { type: 'success', dedupeKey: LINK_BATCH_NOTICE_KEY });
      } else {
        handle?.hide(); // N=0 静默：收起进行中帧
      }
    }
    if (summary.failed > 0) {
      // 连续多次失败经合并通知提示一次（dedupeKey 同键合并 + 抑制窗口）
      notify(`${summary.failed} 篇笔记关联处理失败，已入队稍后自动重试`, {
        type: 'warning',
        dedupeKey: LINK_ERROR_NOTICE_KEY,
      });
    }
    return summary;
  }

  /**
   * 队列消费（域初始化调用）：队列非空且 embedding 可达 → 自动消费无需询问；
   * 成功移除条目、失败保留；全部完成后通知「待处理关联已处理完毕：N 篇 / 新建 M 条」。
   */
  async consumeQueue(): Promise<BatchSummary | null> {
    // 对应文件已删除的条目顺带清理
    try {
      await pruneQueueByExists((p) => !!this.app.vault.getAbstractFileByPath(p));
    } catch (e) {
      console.warn('[link-agent] 队列清理失败', e);
    }
    let items: LinkQueueItem[];
    try {
      items = await loadQueue();
    } catch (e) {
      console.warn('[link-agent] 队列读取失败', e);
      return null;
    }
    if (!items.length) return null;

    const reachable = await this.probeFn();
    if (!reachable) return null; // 不可达：静默保留队列（移动端自然回退）

    const summary: BatchSummary = { total: items.length, processed: 0, created: 0, queued: 0, failed: 0 };
    const notifyOn = this.notifyEnabled;
    let handle: NoticeHandle | null = null;
    if (notifyOn) {
      handle = notify(`待处理关联：处理中 0/${items.length} 篇`, { type: 'progress', dedupeKey: LINK_BATCH_NOTICE_KEY });
    }
    for (let i = 0; i < items.length; i++) {
      const outcome = await this.processNote(items[i].path, { assumeReachable: true });
      if (outcome.status === 'done') {
        summary.processed++;
        summary.created += outcome.created;
        await dequeuePath(items[i].path); // 消费成功移除
      } else if (outcome.status === 'failed') {
        summary.failed++; // 失败保留待下次
      } else if (outcome.status === 'queued') {
        summary.queued++;
      }
      if (notifyOn) {
        notify(`待处理关联：处理中 ${i + 1}/${items.length} 篇`, { type: 'progress', dedupeKey: LINK_BATCH_NOTICE_KEY });
      }
    }
    if (notifyOn) {
      if (summary.processed > 0) {
        notify(`待处理关联已处理完毕：${summary.processed} 篇 / 新建 ${summary.created} 条`, {
          type: 'success',
          dedupeKey: LINK_BATCH_NOTICE_KEY,
        });
      } else {
        handle?.hide();
      }
      if (summary.failed > 0) {
        notify(`${summary.failed} 篇待处理关联处理失败，已保留队列下次重试`, {
          type: 'warning',
          dedupeKey: LINK_ERROR_NOTICE_KEY,
        });
      }
    }
    return summary;
  }

  /**
   * 死链清理：解析文献盒各笔记 related，移除指向不存在文件的失效条目（非 wikilink 条目不动）。
   * encrypt 域锁定文件一律跳过：保险箱锁定态无法区分「已删除」与「已加密」，整体跳过本次清理；
   * 解锁态下清单内路径视为存活。返回实际移除条数；有移除才通知（零变化静默）。
   */
  async cleanDeadLinks(opts?: { silent?: boolean }): Promise<number> {
    const s = tryGetSettings() as any;
    if (s.linkAgentAutoClean === false) return 0;
    const cache = (this.app as any).metadataCache;
    if (!cache?.getFileCache) return 0;

    // encrypt 边界：无保险箱清单的库正常清理；有清单且解锁态把清单内原路径视为存活；
    // 有清单但锁定态无法区分「已删除」与「已加密移入」→ 整体跳过本次（encrypt 域锁定文件一律跳过）
    let encryptedPaths: Set<string> | null = null;
    try {
      const root = String((tryGetSettings() as any).encryptRoot || 'CONFIG/.ENCRYPT').replace(/\/+$/, '');
      let safeExists = false;
      try {
        const existsFn = (this.app.vault.adapter as any)?.exists;
        safeExists = typeof existsFn === 'function' ? !!(await existsFn.call(this.app.vault.adapter, `${root}/.safe.enc`)) : false;
      } catch {
        safeExists = false;
      }
      if (safeExists) {
        const enc = await import('../../encrypt');
        const sm = enc.getSafeManager();
        if (sm.unlocked) {
          encryptedPaths = new Set((sm.manifest?.notes ?? []).map((n: any) => String(n.path)));
        } else {
          return 0; // 锁定态：一律跳过
        }
      }
    } catch (e) {
      console.warn('[link-agent] encrypt 边界检查失败，按无保险箱处理', e);
    }

    // basename → 出现次数（Obsidian 最短路径链接解析：同名歧义时不判死）
    const mdFiles = (this.app.vault.getMarkdownFiles() as TFile[]).filter(Boolean);
    const basenameCounts = new Map<string, number>();
    for (const f of mdFiles) {
      const b = f.basename;
      basenameCounts.set(b, (basenameCounts.get(b) || 0) + 1);
    }
    const isAlive = (target: string): boolean => {
      const full = target.endsWith('.md') ? target : `${target}.md`;
      if (this.app.vault.getAbstractFileByPath(full)) return true;
      if ((encryptedPaths?.has(full) || encryptedPaths?.has(target)) === true) return true;
      const base = full.split('/').pop()?.replace(/\.md$/i, '') || '';
      return (basenameCounts.get(base) || 0) > 0;
    };

    let removedTotal = 0;
    const boxFiles = mdFiles.filter((f) => isUnderFolder(LITERATURE_BOX, f.path));
    for (const file of boxFiles) {
      let entries: string[];
      try {
        const fm = cache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
        entries = parseRelatedEntries(fm?.related);
      } catch {
        continue;
      }
      if (!entries.length) continue;
      const { keep, removed } = planRemovals(entries, isAlive);
      if (!removed.length) continue;
      try {
        await this.app.fileManager.processFrontMatter(file, (fmo: Record<string, unknown>) => {
          if (keep.length > 0) fmo.related = keep;
          else delete fmo.related;
        });
        removedTotal += removed.length;
      } catch (e) {
        console.warn(`[link-agent] 死链清理写回失败 [${file.path}]`, e);
      }
    }
    if (removedTotal > 0 && !opts?.silent && this.notifyEnabled) {
      notice(`已清理 ${removedTotal} 条失效关联`, 'delete');
    }
    return removedTotal;
  }
}
