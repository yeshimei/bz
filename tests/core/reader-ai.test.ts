// @vitest-environment node
/**
 * 阅读器 AI 门面（ADR-0294）：src/core/reader-ai.ts 的注册生命周期 +
 * src/secondbrain/reader-ai-bridge.ts 的口径（条数、空查询、降级、批量切分与逐条回退）。
 *
 * 嵌入层整体 mock：这里验的是「门面把什么交给谁」，不是 Ollama 的 HTTP 细节
 * （那一层由 tests/secondbrain/* 的既有用例守着）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getReaderAi, setReaderAi, type ReaderAiApi } from '../../src/core/reader-ai';

const embedCalls = vi.hoisted(() => ({
  batch: [] as string[][],
  single: [] as Array<{ text: string; isQuery: boolean }>,
  failBatch: false,
  failSingleAt: -1,
}));

vi.mock('../../src/secondbrain/ollama', () => {
  return {
    EMBED_BATCH_SIZE: 2,
    SEARCH_TIMEOUT_MS: 10000,
    EMBED_TIMEOUT_MS: 30000,
    async getEmbeddingsBatch(texts: string[]) {
      embedCalls.batch.push([...texts]);
      if (embedCalls.failBatch) throw new Error('Ollama 错误: 500');
      return texts.map((t) => [t.length, 1]);
    },
    async getEmbedding(text: string, isQuery: boolean) {
      embedCalls.single.push({ text, isQuery });
      if (embedCalls.single.length - 1 === embedCalls.failSingleAt) throw new Error('向量为空');
      return [text.length, 0];
    },
  };
});

vi.mock('../../src/secondbrain/config', () => ({
  buildConfig: () => ({ EMBEDDING_MODEL: 'bge-m3', OLLAMA_URL: 'http://localhost:11434' }),
}));

vi.mock('../../src/secondbrain/chunk', () => ({
  noteTitleFromPath: (p: string) => String(p).split('/').pop()!.replace(/\.md$/, ''),
}));

import { createReaderAi } from '../../src/secondbrain/reader-ai-bridge';

function fakeStore(hits: Array<{ path: string; chunk: string; score: number }>, ready = true) {
  return {
    isIndexReady: () => ready,
    search: vi.fn(async () => hits),
  } as unknown as Parameters<typeof createReaderAi>[0];
}

describe('阅读器门面注册', () => {
  beforeEach(() => setReaderAi(null));

  it('未注册时取到 null（调用方据此判定「这台 bz 没这个能力」）', () => {
    expect(getReaderAi()).toBeNull();
  });

  it('注册后取到同一个对象，置 null 即撤销（卸载不留半个门面）', () => {
    const api: ReaderAiApi = {
      isIndexReady: () => true,
      embeddingModel: () => 'm',
      searchNotes: async () => [],
      embedDocuments: async () => [],
      embedQuery: async () => [],
    };
    setReaderAi(api);
    expect(getReaderAi()).toBe(api);
    setReaderAi(null);
    expect(getReaderAi()).toBeNull();
  });
});

describe('检索口径', () => {
  beforeEach(() => {
    embedCalls.batch.length = 0;
    embedCalls.single.length = 0;
    embedCalls.failBatch = false;
    embedCalls.failSingleAt = -1;
  });

  it('命中映射成「路径 + 标题 + 片段 + 分数」，标题取自文件名', async () => {
    const api = createReaderAi(
      fakeStore([{ path: '笔记/心流.md', chunk: '心流是一种专注状态', score: 0.83 }]),
    );
    const hits = await api.searchNotes('心流', 5);
    expect(hits).toEqual([
      { path: '笔记/心流.md', title: '心流', chunk: '心流是一种专注状态', score: 0.83 },
    ]);
  });

  it('空查询不问检索（省一次向量化）', async () => {
    const store = fakeStore([]);
    const api = createReaderAi(store);
    expect(await api.searchNotes('   ')).toEqual([]);
    expect((store as unknown as { search: ReturnType<typeof vi.fn> }).search).not.toHaveBeenCalled();
  });

  it('索引未就绪返回空数组而不是抛错（提示文案归消费方）', async () => {
    const api = createReaderAi(fakeStore([{ path: 'a.md', chunk: 'x', score: 1 }], false));
    expect(await api.searchNotes('任何')).toEqual([]);
  });

  it('topK 夹在 1..30，防止消费方传进一个把内存打满的值', async () => {
    const store = fakeStore([]);
    const api = createReaderAi(store);
    await api.searchNotes('x', 9999);
    expect((store as unknown as { search: ReturnType<typeof vi.fn> }).search).toHaveBeenCalledWith('x', 30);
  });
});

describe('嵌入口径', () => {
  beforeEach(() => {
    embedCalls.batch.length = 0;
    embedCalls.single.length = 0;
    embedCalls.failBatch = false;
    embedCalls.failSingleAt = -1;
  });

  it('批量按批大小切分，不把整本书一次塞给嵌入服务', async () => {
    const api = createReaderAi(fakeStore([]));
    const out = await api.embedDocuments(['a', 'bb', 'ccc', 'dddd', 'eeeee']);
    expect(embedCalls.batch).toEqual([['a', 'bb'], ['ccc', 'dddd'], ['eeeee']]);
    expect(out).toHaveLength(5);
  });

  it('批失败逐条回退：坏的抛出去，好的照收', async () => {
    embedCalls.failBatch = true;
    embedCalls.failSingleAt = 1;
    const api = createReaderAi(fakeStore([]));
    await expect(api.embedDocuments(['a', 'bb'])).rejects.toThrow('向量为空');
    expect(embedCalls.single.map((c) => c.text)).toEqual(['a', 'bb']);
  });

  it('查询嵌入带查询语义（isQuery=true，指令前缀由嵌入层按模型加）', async () => {
    const api = createReaderAi(fakeStore([]));
    await api.embedQuery('这本书讲了什么');
    expect(embedCalls.single).toEqual([{ text: '这本书讲了什么', isQuery: true }]);
  });

  it('模型名从设置现取（换模型后消费方据此判定画像要不要重建）', () => {
    const api = createReaderAi(fakeStore([]));
    expect(api.embeddingModel()).toBe('bge-m3');
  });
});
