// @vitest-environment node
/**
 * 重排接线测试（issue 427/ADR-0186）：vectorSearch 末尾的 applyRerank——
 * 开关 / 模型门槛（qwen3-embedding:8b 才生效）、重排分定名次而 score 仍为余弦、
 * 头部截断（RERANK_MAX_DOCS）与尾部保序、失败静默回退 + console.warn。
 * ollama 与 rerank 两模块均经 vi.mock 替身（不碰网络）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { VectorStore } from '../../src/secondbrain/vector-store';
import { getEmbedding } from '../../src/secondbrain/ollama';
import { rerankScores } from '../../src/secondbrain/rerank';

vi.mock('../../src/secondbrain/ollama', () => ({
  EMBED_BATCH_SIZE: 64,
  getEmbedding: vi.fn(),
  getEmbeddingsBatch: vi.fn(),
  checkRemoteOllama: vi.fn(),
  SEARCH_TIMEOUT_MS: 10000,
}));

vi.mock('../../src/secondbrain/rerank', () => ({
  RERANK_MAX_DOCS: 2, // 收紧截断便于断言（生产 24）
  rerankScores: vi.fn(),
}));

/** 三笔记各一块：行与查询 [1,0] 的余弦 = 1 / 0.6 / 0.28（余弦序 a > b > c） */
function seedStore(): VectorStore {
  const vs = new VectorStore({ vault: { getMarkdownFiles: () => [], adapter: {} } } as any);
  vs.meta.notes = {
    'a.md': { mtime: 1, chunks: [{ text: '甲' }] },
    'b.md': { mtime: 1, chunks: [{ text: '乙' }] },
    'c.md': { mtime: 1, chunks: [{ text: '丙' }] },
  };
  vs.meta._dim = 2;
  vs.dim = 2;
  vs.vectors = new Float32Array([1, 0, 0.6, 0.8, 0.28, 0.96]);
  return vs;
}

function settings(overrides: Record<string, unknown> = {}) {
  return {
    storagePath: 'CONFIG/STORAGE',
    secondBrainOllamaUrl: 'http://localhost:11434',
    secondBrainEmbeddingModel: 'qwen3-embedding:8b',
    secondBrainRerank: true,
    ...overrides,
  };
}

describe('vectorSearch 重排接线（issue 427/ADR-0186）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => settings() as any);
    vi.mocked(getEmbedding).mockReset();
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]); // 与行 0 同向：余弦 1 / 0.6 / 0.28
    vi.mocked(rerankScores).mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('开关开 + 8B 模型：名次按重排分，但 score 字段保持余弦值（单一分数尺）', async () => {
    const vs = seedStore();
    vi.mocked(rerankScores).mockResolvedValue([0.1, 0.9]); // 头部两条对调：b > a

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['b.md', 'a.md', 'c.md']);
    // 分数随笔记走（b 仍显示自己的余弦 0.6，a 仍是 1），不随名次走——面板百分比可能不单调是刻意的
    expect(res[0].score).toBeCloseTo(0.6, 5);
    expect(res[1].score).toBeCloseTo(1, 5);
    expect(res[2].score).toBeCloseTo(0.28, 5);
    expect(vi.mocked(rerankScores)).toHaveBeenCalledTimes(1);
    const [query, docs] = vi.mocked(rerankScores).mock.calls[0];
    expect(query).toBe('q');
    expect(docs).toEqual(['甲', '乙']); // 只送头部 RERANK_MAX_DOCS（替身 = 2）条
  });

  it('头部截断：尾部（第 3 条起）不吃重排、保持余弦序接在其后', async () => {
    const vs = seedStore();
    vi.mocked(rerankScores).mockResolvedValue([0.9, 0.1]); // 头部两条对调

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md']); // 头部重排 + 尾部 c 保余弦序
    expect(vi.mocked(rerankScores).mock.calls[0][1]).toEqual(['甲', '乙']);
  });

  it('重排同分：保持原余弦序（稳定排序，不抖动）', async () => {
    const vs = seedStore();
    vi.mocked(rerankScores).mockResolvedValue([0.5, 0.5]);

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('开关关：跳过重排，返回余弦序且不调重排', async () => {
    setSettingsProvider(() => settings({ secondBrainRerank: false }) as any);
    const vs = seedStore();

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(vi.mocked(rerankScores)).not.toHaveBeenCalled();
  });

  it('模型非 8B（行隐藏即不生效）：即使开关残留 true 也不重排', async () => {
    setSettingsProvider(() => settings({ secondBrainEmbeddingModel: 'bge-m3' }) as any);
    const vs = seedStore();

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(vi.mocked(rerankScores)).not.toHaveBeenCalled();
  });

  it('重排失败（模型未装 / 超时 / 预算用尽）：静默回退余弦序 + console.warn，不抛错', async () => {
    const vs = seedStore();
    vi.mocked(rerankScores).mockRejectedValue(new Error('重排超时（20000ms）'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(res.map((r) => r.score)).toEqual([
      expect.closeTo(1, 5),
      expect.closeTo(0.6, 5),
      expect.closeTo(0.28, 5),
    ]);
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('重排不可用，按余弦序返回'))).toBe(true);
  });

  it('命中不足 2 条：不调重排（单条无可排）', async () => {
    const vs = seedStore();
    const res = await vs.vectorSearch('q', 1);
    expect(res).toHaveLength(1);
    expect(vi.mocked(rerankScores)).not.toHaveBeenCalled();
  });
});
