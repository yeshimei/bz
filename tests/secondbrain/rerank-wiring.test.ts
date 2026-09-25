// @vitest-environment node
/**
 * 重排接线测试（issue 427/ADR-0186）：vectorSearch 末尾的 applyRerank——
 * 开关 / 模型门槛（qwen3-embedding:8b 才生效）、重排分定名次而 score 仍为余弦、
 * 整列重排（列表 ≤ RERANK_MAX_DOCS）与超长列表整轮跳过（> RERANK_MAX_DOCS，不半重排）、
 * 失败静默回退 + console.warn。
 * ollama 与 rerank 两模块均经 vi.mock 替身（不碰网络）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { VectorStore } from '../../src/secondbrain/vector-store';
import { getEmbedding } from '../../src/secondbrain/ollama';
import { rerankScores } from '../../src/secondbrain/rerank';
import { jevRerankScores } from '../../src/secondbrain/rerank-jev';
import { abortError } from '../../src/core/abort';


vi.mock('../../src/secondbrain/ollama', () => ({
  EMBED_BATCH_SIZE: 64,
  getEmbedding: vi.fn(),
  getEmbeddingsBatch: vi.fn(),
  checkRemoteOllama: vi.fn(),
  SEARCH_TIMEOUT_MS: 10000,
}));

vi.mock('../../src/secondbrain/rerank', () => ({
  RERANK_MAX_DOCS: 3, // 收紧上限便于断言（生产 50 = TopK 设置上限，见 panel-settings-rows 不变式测试）
  rerankScores: vi.fn(),
}));

vi.mock('../../src/secondbrain/rerank-jev', () => ({
  jevRerankScores: vi.fn(),
}));

/** N 笔记各一块：行与查询 [1,0] 的余弦 = 1 / 0.6 / 0.28 / 0.2（余弦序 a > b > c > d） */
function seedStore(count = 3): VectorStore {
  const rows: Array<[string, string, number[]]> = [
    ['a.md', '甲', [1, 0]],
    ['b.md', '乙', [0.6, 0.8]],
    ['c.md', '丙', [0.28, 0.96]],
    ['d.md', '丁', [0.2, 0.9797958971]],
  ];
  const vs = new VectorStore({ vault: { getMarkdownFiles: () => [], adapter: {} } } as any);
  vs.meta.notes = Object.fromEntries(
    rows.slice(0, count).map(([path, text]) => [path, { mtime: 1, chunks: [{ text }] }])
  );
  vs.meta._dim = 2;
  vs.dim = 2;
  vs.vectors = new Float32Array(rows.slice(0, count).flatMap(([, , v]) => v));
  return vs;
}

function settings(overrides: Record<string, unknown> = {}) {
  return {
    storagePath: 'CONFIG/STORAGE',
    secondBrainOllamaUrl: 'http://localhost:11434',
    secondBrainEmbeddingModel: 'qwen3-embedding:8b',
    secondBrainRerank: true,
    secondBrainRerankJev: false, // issue 431/ADR-0189：缺省本地通道（既有用例语义零变化）
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
    vi.mocked(rerankScores).mockResolvedValue([0.1, 0.9, 0.05]); // 全列重排：b 压过 a

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['b.md', 'a.md', 'c.md']);
    // 分数随笔记走（b 仍显示自己的余弦 0.6，a 仍是 1），不随名次走——阈值判定仍只认余弦
    expect(res[0].score).toBeCloseTo(0.6, 5);
    expect(res[1].score).toBeCloseTo(1, 5);
    expect(res[2].score).toBeCloseTo(0.28, 5);
    expect(vi.mocked(rerankScores)).toHaveBeenCalledTimes(1);
    const [query, docs] = vi.mocked(rerankScores).mock.calls[0];
    expect(query).toBe('q');
    expect(docs).toEqual(['甲', '乙', '丙']); // 整列都进重排（3 ≤ 上限替身 3）
  });

  it('列表超过 RERANK_MAX_DOCS（建链候选池等后台链路）：整轮不重排，不半重排', async () => {
    const vs = seedStore(4);
    // 给一组「若被调用就会换序」的分数：顺序与 rerankScore 都不变，才真证明是早退而非失败回退
    vi.mocked(rerankScores).mockResolvedValue([0.05, 0.1, 0.9, 0.2]);

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md', 'd.md']); // 纯余弦序
    expect(res.map((r) => r.rerankScore)).toEqual([undefined, undefined, undefined, undefined]);
    expect(vi.mocked(rerankScores)).not.toHaveBeenCalled(); // 一对都不发（也不白付 GPU 耗时）
  });

  it('重排同分：保持原余弦序（稳定排序，不抖动）', async () => {
    const vs = seedStore();
    vi.mocked(rerankScores).mockResolvedValue([0.5, 0.5, 0.5]);

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

describe('检索取消与重排分回填（issue 428/429）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => settings() as any);
    vi.mocked(getEmbedding).mockReset();
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
    vi.mocked(rerankScores).mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('重排分回填 rerankScore（整列），score 不动——参考面板百分比据此与名次同尺', async () => {
    const vs = seedStore();
    vi.mocked(rerankScores).mockResolvedValue([0.1, 0.9, 0.05]); // 全列重排：b 压过 a

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['b.md', 'a.md', 'c.md']);
    expect(res.map((r) => r.rerankScore)).toEqual([0.9, 0.1, 0.05]);
    expect(res.map((r) => r.score)).toEqual([
      expect.closeTo(0.6, 5),
      expect.closeTo(1, 5),
      expect.closeTo(0.28, 5),
    ]);
  });

  it('signal 逐级下传：嵌入与重排都收到同一 signal（取消才能真中断 HTTP）', async () => {
    const vs = seedStore();
    const ac = new AbortController();
    vi.mocked(rerankScores).mockResolvedValue([0.9, 0.1, 0.5]);

    await vs.vectorSearch('q', 10, undefined, ac.signal);
    expect(vi.mocked(getEmbedding).mock.calls[0][4]).toBe(ac.signal);
    expect(vi.mocked(rerankScores).mock.calls[0][3]).toBe(ac.signal);
  });

  it('已取消的 signal：vectorSearch 在嵌入前就中断（AbortError），一次请求都不发', async () => {
    const vs = seedStore();
    const ac = new AbortController();
    ac.abort();

    await expect(vs.vectorSearch('q', 10, undefined, ac.signal)).rejects.toThrow('请求已中断');
    expect(vi.mocked(getEmbedding)).not.toHaveBeenCalled();
    expect(vi.mocked(rerankScores)).not.toHaveBeenCalled();
  });

  it('重排中途取消：AbortError 直抛，**不回退余弦序**（旧序回填会盖掉新查询的列表）', async () => {
    const vs = seedStore();
    const ac = new AbortController();
    vi.mocked(rerankScores).mockImplementation(async () => {
      ac.abort();
      throw Object.assign(new Error('请求已中断'), { name: 'AbortError' });
    });

    await expect(vs.vectorSearch('q', 10, undefined, ac.signal)).rejects.toThrow('请求已中断');
  });

  it('search 层：取消不降级文本、不触发降级回调（与「向量链路故障」分流）', async () => {
    const vs = seedStore();
    const ac = new AbortController();
    ac.abort();
    const onDegraded = vi.fn();

    await expect(vs.search('q', 10, onDegraded, ac.signal)).rejects.toThrow('请求已中断');
    expect(onDegraded).not.toHaveBeenCalled();
  });
});

describe('Jev 重排通道分流（issue 431/ADR-0189）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => settings() as any);
    vi.mocked(getEmbedding).mockReset();
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
    vi.mocked(rerankScores).mockReset();
    vi.mocked(jevRerankScores).mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Jev 开：名次按 noul 分，score 仍余弦；本地通道一次不发（二选一）', async () => {
    setSettingsProvider(() => settings({ secondBrainRerankJev: true }) as any);
    const vs = seedStore();
    vi.mocked(jevRerankScores).mockResolvedValue([0.1, 0.9, 0.05]); // 按档序给分：b(0.9) 压过 a(0.1)

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['b.md', 'a.md', 'c.md']);
    expect(res.map((r) => r.rerankScore)).toEqual([0.9, 0.1, 0.05]);
    expect(res[0].score).toBeCloseTo(0.6, 5); // score 不动：阈值仍走余弦单尺
    expect(vi.mocked(jevRerankScores)).toHaveBeenCalledTimes(1);
    const [query, docs] = vi.mocked(jevRerankScores).mock.calls[0];
    expect(query).toBe('q');
    expect(docs).toEqual(['甲', '乙', '丙']); // 整列进重排
    expect(vi.mocked(rerankScores)).not.toHaveBeenCalled();
  });

  it('Jev 开 + 嵌入非 8B：照样走 Jev 重排（云端不吃本地显存，8B 门只管本地通道）', async () => {
    setSettingsProvider(() => settings({ secondBrainEmbeddingModel: 'bge-m3', secondBrainRerankJev: true }) as any);
    const vs = seedStore();
    vi.mocked(jevRerankScores).mockResolvedValue([0.2, 0.9, 0.1]);

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['b.md', 'a.md', 'c.md']);
    expect(vi.mocked(jevRerankScores)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(rerankScores)).not.toHaveBeenCalled();
  });

  it('Jev 不可用（null = 未配密钥 / 超时 / 畸形 / 缺题）：维持余弦序，无 rerankScore', async () => {
    setSettingsProvider(() => settings({ secondBrainRerankJev: true }) as any);
    const vs = seedStore();
    vi.mocked(jevRerankScores).mockResolvedValue(null);

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md']); // 纯余弦序
    expect(res.map((r) => r.rerankScore)).toEqual([undefined, undefined, undefined]);
  });

  it('Jev 抛非取消错：整轮回余弦序 + console.warn，不打断检索', async () => {
    setSettingsProvider(() => settings({ secondBrainRerankJev: true }) as any);
    const vs = seedStore();
    vi.mocked(jevRerankScores).mockRejectedValue(new Error('Jev API 503'));
    const warnSpy = vi.spyOn(console, 'warn');

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('重排不可用，按余弦序返回'))).toBe(true);
  });

  it('Jev 中途取消：AbortError 直抛，不回退余弦序（与本地通道同口径）', async () => {
    setSettingsProvider(() => settings({ secondBrainRerankJev: true }) as any);
    const vs = seedStore();
    const ac = new AbortController();
    vi.mocked(jevRerankScores).mockRejectedValue(abortError());

    await expect(vs.vectorSearch('q', 10, undefined, ac.signal)).rejects.toMatchObject({ name: 'AbortError' });
    // signal 透传回归锁（对齐本地通道同款断言）：applyRerank 若漏传 signal，此行即红——
    // 上面的无条件 reject 不感知实参，单靠它锁不住透传（review 收口补）
    expect(vi.mocked(jevRerankScores).mock.calls[0][2]).toBe(ac.signal);
  });

  it('Jev 不可用（null 回落）：console.warn 留痕（ADR-0189 决策 5 与本地通道失败同口径）', async () => {
    setSettingsProvider(() => settings({ secondBrainRerankJev: true }) as any);
    const vs = seedStore();
    vi.mocked(jevRerankScores).mockResolvedValue(null);
    const warnSpy = vi.spyOn(console, 'warn');

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('Jev 重排不可用，按余弦序返回'))).toBe(true);
  });

  it('总闸关：即使 Jev 开着也不重排（off 优先于通道选择，无「总闸关了 Jev 还在跑」的怪态）', async () => {
    setSettingsProvider(() => settings({ secondBrainRerank: false, secondBrainRerankJev: true }) as any);
    const vs = seedStore();

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(vi.mocked(jevRerankScores)).not.toHaveBeenCalled();
    expect(vi.mocked(rerankScores)).not.toHaveBeenCalled();
  });

  it('超长列表：Jev 通道同样整轮跳过（不半重排，也不白付云端往返）', async () => {
    setSettingsProvider(() => settings({ secondBrainRerankJev: true }) as any);
    const vs = seedStore(4);
    vi.mocked(jevRerankScores).mockResolvedValue([0.05, 0.1, 0.9, 0.2]);

    const res = await vs.vectorSearch('q', 10);
    expect(res.map((r) => r.path)).toEqual(['a.md', 'b.md', 'c.md', 'd.md']);
    expect(vi.mocked(jevRerankScores)).not.toHaveBeenCalled();
  });
});
