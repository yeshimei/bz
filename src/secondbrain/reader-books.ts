/**
 * 阅读器书籍出口（第二大脑侧）。
 *
 * bz 阅读插件把书的向量存在它自己的目录里，并在它的设置里控制一颗
 * 「连接至 BZ AI 知识库」开关。这里只做三件事：
 *
 *   1. 找到那个插件实例上的 `bookAi` 门面（没有就是没有，不猜）；
 *   2. **开关关着就一条都不返回**——第二大脑里不该出现任何书籍统计，
 *      也不该搜到书；
 *   3. 把书的结果归一成第二大脑认的形状，好让提问时能和笔记一起拼上下文。
 *
 * 一条刻意的取舍：**不读它的画像文件、也不自己算向量**。书的嵌入模型
 * 是它配的，我们不知道、也不该知道；拿第二大脑的模型去算书的问题，
 * 只会得到一堆看起来像分数的垃圾。检索能力由它提供，我们只做展示与拼接。
 */
import type { App } from 'obsidian';
import type { SearchHit } from './vector-store';

export interface ReaderBookHit {
  bookId: string;
  title: string;
  chapter: string;
  chunk: string;
  score: number;
}

export interface ReaderBookStats {
  books: number;
  blocks: number;
  chars: number;
  lastAt: number | null;
  models: string[];
}

/**
 * 单本书的清单行（2026-11-08）：第二大脑统计面板要把书和笔记摆在一起，
 * 汇总数字不够用——来源分布每本书一行、最近向量化按时间和笔记混排。
 */
export interface ReaderBookItem {
  bookId: string;
  /** 书名（缺失是空串，界面兜底成「未命名」） */
  title: string;
  /** 可检索块数 */
  blocks: number;
  /** 正文总字数（按块计） */
  chars: number;
  /** 最近一次建／重建的时间（ms） */
  updatedAt: number;
  /** 产出向量的模型名 */
  model: string;
  /** 画像方案：vector 可检索；compress 只有要点 */
  plan: 'vector' | 'compress';
}

export interface ReaderBookAiApi {
  isShared(): boolean;
  stats(): Promise<ReaderBookStats>;
  /** 清单（可选：老版阅读器没有这个方法，第二大脑退回汇总行，不影响其它） */
  books?: () => Promise<ReaderBookItem[]>;
  search(query: string, topK?: number): Promise<ReaderBookHit[]>;
}

const READER_PLUGIN_ID = 'bz-reader';

type AnyApp = {
  plugins?: {
    getPlugin?: (id: string) => unknown;
    plugins?: Record<string, unknown>;
  };
};

/**
 * 取门面。
 *
 * 版本不同会缺半边（老版阅读器没有 bookAi），所以逐个函数用 typeof 判；
 * 缺一个就整体当不可用——半个门面比没有更容易在调用点上炸。
 */
export function readerBooksApi(app: App | null | undefined): ReaderBookAiApi | null {
  try {
    const plugins = (app as AnyApp | null | undefined)?.plugins;
    if (!plugins) return null;
    const viaGetter = typeof plugins.getPlugin === 'function' ? plugins.getPlugin(READER_PLUGIN_ID) : null;
    const raw = viaGetter ?? plugins.plugins?.[READER_PLUGIN_ID] ?? null;
    if (!raw || typeof raw !== 'object') return null;
    const api = (raw as { bookAi?: Partial<ReaderBookAiApi> }).bookAi;
    if (!api) return null;
    const need = ['isShared', 'stats', 'search'] as const;
    if (need.some((k) => typeof (api as Record<string, unknown>)[k] !== 'function')) return null;
    return api as ReaderBookAiApi;
  } catch {
    return null;
  }
}

/** 检索等待上限：外部插件卡住时，宁可少这一层依据，不能把整轮回答挂死 */
const BOOK_SEARCH_TIMEOUT_MS = 3000;

/** 统计等待上限：面板打开时要读它的索引文件，慢也不该无限等 */
const BOOK_STATS_TIMEOUT_MS = 3000;

/**
 * 给外部插件的 Promise 加等待上限，并响应取消。
 *
 * 超时 / 取消都按「拿不到」处理：调用方关心的是「这次有没有书这部分」，
 * 而不是错误本身——一个卡住的阅读器不该让第二大脑的问答停摆。
 */
function withDeadline<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (err: Error | null, value?: T) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (err) reject(err);
      else resolve(value as T);
    };
    if (signal?.aborted) { settle(new Error('aborted')); return; }
    signal?.addEventListener('abort', () => settle(new Error('aborted')), { once: true });
    timer = setTimeout(() => settle(new Error('timeout')), ms);
    p.then((v) => settle(null, v), (e) => settle(e instanceof Error ? e : new Error(String(e))));
  });
}

/** 共享开着才给统计；关着、没装、抛错、超时，一律 null（调用方据此不显示那一行） */
export async function sharedBookStats(app: App | null | undefined): Promise<ReaderBookStats | null> {
  const api = readerBooksApi(app);
  if (!api) return null;
  try {
    if (!api.isShared()) return null;
    const s = await withDeadline(api.stats(), BOOK_STATS_TIMEOUT_MS);
    return s && s.books > 0 ? s : null;
  } catch {
    return null;
  }
}

/**
 * 书籍清单（可选出口）：老版阅读器没有 `books()` → 返回 null，调用方退回汇总行。
 *
 * 归一化在这里做完（补空串、剔掉没有块/没有书号的行），渲染层不再猜。
 * 任何失败（关着 / 超时 / 抛错 / 空清单）都收敛成 null——「这次没有清单」，
 * 不是「没有书」，两种空态在界面上是不同的显示。
 */
export async function sharedBookList(app: App | null | undefined): Promise<ReaderBookItem[] | null> {
  const api = readerBooksApi(app);
  if (!api || typeof api.books !== 'function') return null;
  try {
    if (!api.isShared()) return null;
    const raw = await withDeadline(api.books(), BOOK_STATS_TIMEOUT_MS);
    if (!Array.isArray(raw) || !raw.length) return null;
    const list = raw
      .map((b) => ({
        bookId: String(b?.bookId ?? '').trim(),
        title: String(b?.title ?? '').trim(),
        blocks: Math.max(0, Number(b?.blocks) || 0),
        chars: Math.max(0, Number(b?.chars) || 0),
        updatedAt: Number(b?.updatedAt) || 0,
        model: String(b?.model ?? ''),
        plan: b?.plan === 'compress' ? ('compress' as const) : ('vector' as const),
      }))
      .filter((b) => b.bookId && b.blocks > 0);
    return list.length ? list : null;
  } catch {
    return null;
  }
}

/** 共享开着才搜书；任何失败（含超时 / 取消）都收敛成空数组（笔记那边照常回答） */
export async function searchSharedBooks(
  app: App | null | undefined,
  query: string,
  topK = 4,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ReaderBookHit[]> {
  const q = String(query ?? '').trim();
  if (!q || opts.signal?.aborted) return [];
  const api = readerBooksApi(app);
  if (!api) return [];
  try {
    if (!api.isShared()) return [];
    const hits = await withDeadline(api.search(q, topK), opts.timeoutMs ?? BOOK_SEARCH_TIMEOUT_MS, opts.signal);
    return Array.isArray(hits) ? hits : [];
  } catch {
    return [];
  }
}

/**
 * 书的结果 → 第二大脑的检索结果形状。
 *
 * 书没有库内路径：`path` 写成「《书名》· 章」，纯粹给人看（提示词与引用卡都读它）。
 * 同时单列 `label` 作为展示名——书名里可能带斜杠，下游按路径取 basename 会截成半截；
 * 有 `label` 的地方就别再拿 `path` 当路径处理。
 */
export function bookHitToSearchHit(hit: ReaderBookHit): SearchHit {
  const title = String(hit.title ?? '').trim();
  const chapter = String(hit.chapter ?? '').trim();
  const name = title || chapter || '书';
  const label = `《${name}》${chapter && chapter !== title ? ` · ${chapter}` : ''}`;
  return {
    path: label,
    label,
    chunk: String(hit.chunk ?? ''),
    score: Number(hit.score) || 0,
    bookId: String(hit.bookId ?? '').trim() || undefined,
  };
}
