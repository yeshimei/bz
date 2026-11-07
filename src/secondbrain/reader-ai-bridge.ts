/**
 * 阅读器门面的第二大脑侧实现（ADR-0294）。
 *
 * 只做接线与口径转换，不重写任何能力：
 *   · 检索 = VectorStore.search（桌面向量优先、异常降级文本；阈值与显示尺单一来源）；
 *   · 嵌入 = ollama 的 getEmbedding / getEmbeddingsBatch（查询侧指令、零向量校验都在那里）。
 *
 * 两条刻意的取舍：
 *   1. **批量按 EMBED_BATCH_SIZE 切**，不把整本书几十块一次塞给 Ollama——它按数组长度
 *      分配内存，几百块一起发容易把本地服务打挂；批失败再逐条回退（同 vector-store 口径），
 *      一条畸形不该让整批白跑。
 *   2. **检索不承诺索引就绪**：`searchNotes` 在索引未就绪时返回空数组而不是抛错——
 *      消费方（bz-reader 的「连接 AI 知识库」档）拿到的应该是「没内容可用」，由它自己
 *      决定出什么提示；抛错会把「还没建索引」和「检索坏了」混成一件事。
 */
import type { SearchHit, VectorStore } from './vector-store';
import { buildConfig } from './config';
import { noteTitleFromPath } from './chunk';
import { EMBED_BATCH_SIZE, getEmbedding, getEmbeddingsBatch } from './ollama';
import { setReaderAi, type ReaderAiApi, type ReaderNoteHit } from '../core/reader-ai';

/** 默认返回条数：够拼 6~8 段依据，又不至于把消费方的上下文塞满 */
const DEFAULT_TOP_K = 6;

function toNoteHit(hit: SearchHit): ReaderNoteHit {
  return {
    path: String(hit.path ?? ''),
    title: noteTitleFromPath(String(hit.path ?? '')),
    chunk: String(hit.chunk ?? ''),
    score: Number(hit.score) || 0,
  };
}

/** 用现有 store 拼出门面。抛错路径全部收敛成消费方能处理的结果 */
export function createReaderAi(store: VectorStore): ReaderAiApi {
  return {
    isIndexReady: () => {
      try {
        return store.isIndexReady();
      } catch {
        return false;
      }
    },
    embeddingModel: () => buildConfig().EMBEDDING_MODEL,
    async searchNotes(query: string, topK = DEFAULT_TOP_K): Promise<ReaderNoteHit[]> {
      const q = String(query ?? '').trim();
      if (!q) return [];
      if (!store.isIndexReady()) return [];
      const hits = await store.search(q, Math.max(1, Math.min(30, Math.floor(topK) || DEFAULT_TOP_K)));
      return (hits ?? []).map(toNoteHit);
    },
    async embedDocuments(texts: string[], signal?: AbortSignal): Promise<number[][]> {
      const list = (texts ?? []).map((t) => String(t ?? ''));
      if (!list.length) return [];
      const out: number[][] = [];
      for (let i = 0; i < list.length; i += EMBED_BATCH_SIZE) {
        const batch = list.slice(i, i + EMBED_BATCH_SIZE);
        try {
          out.push(...(await getEmbeddingsBatch(batch, undefined, signal)));
        } catch (e) {
          if (signal?.aborted) throw e;
          /* 批失败逐条回退：批接口对零向量 / 条数不符是整批拒绝，
             逐条走同一套校验，坏的那一条抛出去、好的照收。 */
          for (const text of batch) out.push(await getEmbedding(text, false, undefined, undefined, signal));
        }
      }
      return out;
    },
    embedQuery(text: string, signal?: AbortSignal): Promise<number[]> {
      return getEmbedding(String(text ?? ''), true, undefined, undefined, signal);
    },
  };
}

/** 注册（secondbrain/index.ts 在 ensure 时调用） */
export function registerReaderAi(store: VectorStore): void {
  setReaderAi(createReaderAi(store));
}

/** 撤销（unload 时调用） */
export function unregisterReaderAi(): void {
  setReaderAi(null);
}
