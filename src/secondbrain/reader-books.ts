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

export interface ReaderBookAiApi {
  isShared(): boolean;
  stats(): Promise<ReaderBookStats>;
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

/** 共享开着才给统计；关着、没装、抛错，一律 null（调用方据此不显示那一行） */
export async function sharedBookStats(app: App | null | undefined): Promise<ReaderBookStats | null> {
  const api = readerBooksApi(app);
  if (!api) return null;
  try {
    if (!api.isShared()) return null;
    const s = await api.stats();
    return s && s.books > 0 ? s : null;
  } catch {
    return null;
  }
}

/** 共享开着才搜书；任何失败都收敛成空数组（笔记那边照常回答） */
export async function searchSharedBooks(
  app: App | null | undefined,
  query: string,
  topK = 4,
): Promise<ReaderBookHit[]> {
  const q = String(query ?? '').trim();
  if (!q) return [];
  const api = readerBooksApi(app);
  if (!api) return [];
  try {
    if (!api.isShared()) return [];
    const hits = await api.search(q, topK);
    return Array.isArray(hits) ? hits : [];
  } catch {
    return [];
  }
}

/**
 * 书的结果 → 第二大脑的检索结果形状。
 *
 * `path` 这一栏在展示里就是来源名（引用卡与提示词都读它），书没有库内路径，
 * 所以写成「《书名》· 章」——用户看到的是他认的东西，而不是一串假的 .md。
 * 它不会被当成文件打开：引用卡只显示文字（见 chat-panel 的 citeRows）。
 */
export function bookHitToSearchHit(hit: ReaderBookHit): SearchHit {
  const title = String(hit.title ?? '').trim();
  const chapter = String(hit.chapter ?? '').trim();
  const label = title || chapter || '书';
  return {
    path: `《${label}》${chapter && chapter !== title ? ` · ${chapter}` : ''}`,
    chunk: String(hit.chunk ?? ''),
    score: Number(hit.score) || 0,
    bookId: String(hit.bookId ?? '').trim() || undefined,
  };
}
