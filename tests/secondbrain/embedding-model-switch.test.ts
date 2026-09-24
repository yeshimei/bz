// @vitest-environment node
/**
 * 换 Embedding 模型维度守卫（issue 422/ADR-0182）：
 * 不同模型维度不同（bge-m3 1024 维 / qwen3-embedding:8b 4096 维），旧向量按旧维度平铺，
 * 增量重嵌会把新维度向量写进行偏移里 → .vec 写坏、检索出垃圾。守卫三处：
 * - load()：库内记录模型（meta._model，旧库缺字段按历史默认 bge-m3 推断）与当前配置不一致 → 不装载、清库置标志；
 * - needsModelRebuild()：面板据此自动全量重建（运行中改设置也判得出来）；
 * - doRefresh()：非面板入口（后台防抖刷新）兜底清库，本轮转全量重嵌；
 * - saveStore()：有向量即记 _model（写盘的向量真实出自该模型）。
 * ollama 经 vi.mock 替身；vault.adapter 用内存假体（同 init-ready.test.ts 口径）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { VectorStore, recordedModelOf } from '../../src/secondbrain/vector-store';
import { getEmbedding, getEmbeddingsBatch } from '../../src/secondbrain/ollama';

vi.mock('../../src/secondbrain/ollama', () => ({
  EMBED_BATCH_SIZE: 1,
  getEmbedding: vi.fn(),
  getEmbeddingsBatch: vi.fn(),
  checkRemoteOllama: vi.fn(),
  SEARCH_TIMEOUT_MS: 10000,
}));

const STORE_PATH = 'CONFIG/STORAGE/secondbrain.json';
const VEC_PATH = 'CONFIG/STORAGE/secondbrain.vec';

/** 把 meta 对象包入 secondbrain.json 单文件结构（ticket 120；panel/link 段空置） */
function storeJSON(meta: unknown): string {
  return JSON.stringify({ version: 1, meta, panel: null, link: { queue: [], state: {} } });
}

function makeAdapter(vault: MockVault) {
  const binary = new Map<string, ArrayBuffer>();
  const adapter: any = {
    read: async (p: string) => {
      const f = vault.files.get(p);
      if (f === undefined) throw new Error('ENOENT');
      return f;
    },
    write: async (p: string, data: string) => {
      vault.files.set(p, data);
    },
    readBinary: async (p: string) => {
      const b = binary.get(p);
      if (!b) throw new Error('ENOENT');
      return b;
    },
    writeBinary: async (p: string, data: ArrayBuffer) => {
      binary.set(p, data.slice(0));
    },
    exists: async (p: string) => vault.files.has(p),
  };
  return { adapter, binary };
}

function makeApp(vault: MockVault, adapter: any, mtimes: Record<string, number> = {}) {
  return {
    vault: {
      getMarkdownFiles: () =>
        [...vault.files.keys()]
          .filter((p) => p.endsWith('.md'))
          .map((p) => ({ path: p, stat: { mtime: mtimes[p] ?? 1 } })),
      read: async (f: any) => {
        const v = vault.files.get(f.path);
        if (v === undefined) throw new Error('ENOENT: ' + f.path);
        return v;
      },
      adapter,
    },
  };
}

function sbSettings(overrides: Record<string, unknown> = {}) {
  return {
    storagePath: 'CONFIG/STORAGE',
    secondBrainAllowPaths: '我的',
    ...overrides,
  };
}

/** 种入 .vec（uint32LE dim 头 + float32 平铺），供「模型一致 → 正常装载」用例 */
function seedVec(binary: Map<string, ArrayBuffer>, dim: number, rows: number) {
  const head = new Uint8Array(4);
  new DataView(head.buffer).setUint32(0, dim, true);
  const payload = new Uint8Array(new Float32Array(dim * rows).buffer);
  const out = new Uint8Array(4 + payload.byteLength);
  out.set(head, 0);
  out.set(payload, 4);
  binary.set(VEC_PATH, out.buffer);
}

/** 从内存 .vec 解析 dim 与 float32 行数 */
function parseVec(binary: Map<string, ArrayBuffer>) {
  const buf = new Uint8Array(binary.get(VEC_PATH)!);
  const dim = new DataView(buf.buffer).getUint32(0, true);
  return { dim, rows: buf.byteLength - 4 ? (buf.byteLength - 4) / (dim * 4 || 1) : 0 };
}

describe('换 Embedding 模型：维度守卫（issue 422/ADR-0182）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => sbSettings() as any);
    vi.mocked(getEmbeddingsBatch).mockReset();
    vi.mocked(getEmbedding).mockReset();
  });

  it('recordedModelOf：库内 _model 优先；旧库缺字段按历史默认 bge-m3 推断', () => {
    expect(recordedModelOf(null)).toBe('bge-m3');
    expect(recordedModelOf({ version: 9, notes: {}, _dim: 2 })).toBe('bge-m3');
    expect(recordedModelOf({ version: 9, notes: {}, _dim: 2, _model: 'qwen3-embedding:8b' })).toBe(
      'qwen3-embedding:8b'
    );
  });

  it('load：库内模型与当前设置不一致 → 不装载、清库、needsModelRebuild 置真', async () => {
    const vault = new MockVault();
    vault.files.set(
      STORE_PATH,
      storeJSON({
        version: 9,
        notes: { '我的/A.md': { mtime: 1, chunks: [{ text: 't' }] } },
        _dim: 2,
        _model: 'bge-m3',
      })
    );
    const { adapter, binary } = makeAdapter(vault);
    seedVec(binary, 2, 1);
    const app = makeApp(vault, adapter, { '我的/A.md': 1 });
    setApp(app as any);
    // 换成 Qwen3-8B（4096 维）
    setSettingsProvider(() => sbSettings({ secondBrainEmbeddingModel: 'qwen3-embedding:8b' }) as any);

    const vs = new VectorStore(app as any);
    await vs.load();

    expect(vs.meta.notes).toEqual({}); // 旧维度向量不可装载
    expect(vs.meta._model).toBeUndefined(); // 空库无产出模型可言
    expect(vs.meta._dim).toBe(0);
    expect(vs.vectors.length).toBe(0);
    expect(vs.isIndexReady()).toBe(false);
    expect(vs.needsModelRebuild()).toBe(true); // 面板据此自动重建，而非落空库引导
  });

  it('load：旧库缺 _model 且当前设置非默认模型 → 按 bge-m3 推断判不一致（安全侧：多跑一次重建）', async () => {
    const vault = new MockVault();
    vault.files.set(
      STORE_PATH,
      storeJSON({
        version: 9,
        notes: { '我的/A.md': { mtime: 1, chunks: [{ text: 't' }] } },
        _dim: 2,
      })
    );
    const { adapter, binary } = makeAdapter(vault);
    seedVec(binary, 2, 1);
    const app = makeApp(vault, adapter, { '我的/A.md': 1 });
    setApp(app as any);
    setSettingsProvider(() => sbSettings({ secondBrainEmbeddingModel: 'qwen3-embedding:8b' }) as any);

    const vs = new VectorStore(app as any);
    await vs.load();

    expect(vs.meta.notes).toEqual({});
    expect(vs.needsModelRebuild()).toBe(true);
  });

  it('load：模型一致 → 正常装载，needsModelRebuild 保持假', async () => {
    const vault = new MockVault();
    vault.files.set(
      STORE_PATH,
      storeJSON({
        version: 9,
        notes: { '我的/A.md': { mtime: 1, chunks: [{ text: 't' }] } },
        _dim: 2,
        _model: 'bge-m3',
      })
    );
    const { adapter, binary } = makeAdapter(vault);
    seedVec(binary, 2, 1);
    const app = makeApp(vault, adapter, { '我的/A.md': 1 });
    setApp(app as any); // 设置缺省 → bge-m3

    const vs = new VectorStore(app as any);
    await vs.load();

    expect(Object.keys(vs.meta.notes)).toEqual(['我的/A.md']);
    expect(vs.isIndexReady()).toBe(true);
    expect(vs.needsModelRebuild()).toBe(false);
  });

  it('needsModelRebuild：空库恒假；装载后运行中改设置为新模型 → 真', async () => {
    const vault = new MockVault();
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    const empty = new VectorStore(app as any);
    expect(empty.needsModelRebuild()).toBe(false); // 空库无需重建

    vault.files.set('我的/A.md', '足够长的单一文本块内容用于运行中换模型判定。');
    const vs = new VectorStore(app as any);
    setApp(app as any);
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [0.5, 0.5]));
    await vs.load();
    await vs.refresh();
    expect(vs.needsModelRebuild()).toBe(false);

    setSettingsProvider(() => sbSettings({ secondBrainEmbeddingModel: 'qwen3-embedding:8b' }) as any);
    expect(vs.needsModelRebuild()).toBe(true); // 内存库仍出自 bge-m3
  });

  it('refresh 兜底（非面板入口）：运行中换模型 → 清库整库重嵌，按新维度落盘并更新 _model', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的单一文本块内容用于换模型重嵌。');
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 3 });
    setApp(app as any);

    const vs = new VectorStore(app as any);
    // 先按 bge-m3（2 维桩）建库
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [0.5, 0.5]));
    await vs.load();
    await vs.refresh();
    expect(parseVec(binary).dim).toBe(2);
    expect(JSON.parse(vault.files.get(STORE_PATH)!).meta._model).toBe('bge-m3');

    // 运行中换 Qwen3-8B（4 维桩）→ 后台防抖刷新兜底清库重嵌
    setSettingsProvider(() => sbSettings({ secondBrainEmbeddingModel: 'qwen3-embedding:8b' }) as any);
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [1, 0, 0, 0]));
    await vs.refresh();

    const { dim, rows } = parseVec(binary);
    expect(dim).toBe(4); // 全按新维度重写，不与旧 2 维段混存
    expect(rows).toBe(1);
    expect(vs.isIndexReady()).toBe(true);
    expect(JSON.parse(vault.files.get(STORE_PATH)!).meta._model).toBe('qwen3-embedding:8b');
    expect(vs.needsModelRebuild()).toBe(false); // 已按当前模型重嵌完
  });

  it('load 期清库后 needsModelRebuild 恒真直到重嵌完成（重启换模型路径不落空库引导）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的单一文本块内容用于重启换模型路径。');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 1 });
    setApp(app as any);
    vault.files.set(
      STORE_PATH,
      storeJSON({
        version: 9,
        notes: { '我的/A.md': { mtime: 1, chunks: [{ text: '旧块' }] } },
        _dim: 2,
        _model: 'bge-m3',
      })
    );
    setSettingsProvider(() => sbSettings({ secondBrainEmbeddingModel: 'qwen3-embedding:8b' }) as any);

    const vs = new VectorStore(app as any);
    await vs.load();
    expect(vs.needsModelRebuild()).toBe(true); // 清库后即使 meta 为空也保持真（区别于「运行中换模型」分支）

    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [1, 0, 0, 0]));
    await vs.rebuildAll();
    expect(vs.isIndexReady()).toBe(true);
    expect(vs.needsModelRebuild()).toBe(false);
  });
});
