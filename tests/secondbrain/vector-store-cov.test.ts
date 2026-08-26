// @vitest-environment node
/**
 * 第二大脑 VectorStore 覆盖补测（ticket 103 重写对齐）：
 * load 异常分支、refresh 边界（读取失败/空正文/短正文兜底）、检索降级链、
 * 移动端 initMobile 三态与 searchMobile 三级降级（tfidf 索引构建一次复用）、IS_MOBILE 分支。
 * ollama 模块经 vi.mock 替身（不碰网络）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { VectorStore } from '../../src/secondbrain/vector-store';
import { TFIDF } from '../../src/secondbrain/tfidf';
import { getEmbedding, getEmbeddingsBatch, checkRemoteOllama } from '../../src/secondbrain/ollama';

vi.mock('../../src/secondbrain/ollama', () => ({
  EMBED_BATCH_SIZE: 64,
  getEmbedding: vi.fn(),
  getEmbeddingsBatch: vi.fn(),
  checkRemoteOllama: vi.fn(),
}));

const STORE_PATH = 'CONFIG/STORAGE/secondbrain.json';
const VEC_PATH = 'CONFIG/STORAGE/secondbrain.vec';

/** 把 meta 对象包入 secondbrain.json 单文件结构（ticket 120；panel/link 段空置） */
function storeJSON(meta: unknown): string {
  return JSON.stringify({ version: 1, meta, panel: null, link: { queue: [], state: {} } });
}

/** 从单文件结构取出 meta 段（断言用） */
function readMeta(vault: MockVault): any {
  return JSON.parse(vault.files.get(STORE_PATH)!).meta;
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
    secondBrainOllamaUrl: 'http://localhost:11434',
    secondBrainChunkMinLength: '10',
    secondBrainAllowPaths: '我的',
    secondBrainRemoteOllamaUrl: 'http://192.168.1.8:11434',
    ...overrides,
  };
}

function vecBuffer(rows: number[][], dim: number): ArrayBuffer {
  const flat = new Float32Array(rows.flat());
  const out = new Uint8Array(4 + flat.byteLength);
  new DataView(out.buffer).setUint32(0, dim, true);
  out.set(new Uint8Array(flat.buffer, flat.byteOffset, flat.byteLength), 4);
  return out.buffer;
}

function parseRows(binary: Map<string, ArrayBuffer>): number[] {
  const buf = new Uint8Array(binary.get(VEC_PATH)!);
  return Array.from(new Float32Array(buf.buffer.slice(4)));
}

describe('VectorStore 补测（load 异常分支）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => sbSettings() as any);
    vi.mocked(getEmbeddingsBatch).mockReset();
    vi.mocked(getEmbedding).mockReset();
    vi.mocked(checkRemoteOllama).mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('secondbrain.json 损坏（非法 JSON）→ store-file 留档重建空结构，向量库重置空库', async () => {
    const vault = new MockVault();
    vault.files.set(STORE_PATH, '{这不是JSON');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();
    expect(vs.meta.version).toBe(9);
    expect(vs.meta.notes).toEqual({});
    expect(vs.dim).toBe(0);
  });

  it('meta 缺失 → 空库；loadVectors 失败 → 向量清空、dim 归零', async () => {
    const vault = new MockVault();
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load(); // meta 与 .vec 均不存在
    expect(vs.meta.notes).toEqual({});
    expect(vs.vectors.length).toBe(0);

    vs.dim = 3;
    vs.vectors = new Float32Array([1, 2, 3]);
    await vs.loadVectors(); // readBinary 必然 ENOENT → 兜底清零
    expect(vs.vectors.length).toBe(0);
    expect(vs.dim).toBe(0);
  });

  it('version=9 正常载入：meta 条目与 .vec 行恢复', async () => {
    const vault = new MockVault();
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { 'a.md': { mtime: 1, chunks: [{ text: 't1' }, { text: 't2' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault);
    binary.set(VEC_PATH, vecBuffer([[1, 0], [0, 1]], 2));
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();
    expect(Object.keys(vs.meta.notes)).toEqual(['a.md']);
    expect(vs.dim).toBe(2);
    expect(Array.from(vs.vectors)).toEqual([1, 0, 0, 1]);
  });
});

describe('VectorStore 补测（refresh 边界）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => sbSettings() as any);
    vi.mocked(getEmbeddingsBatch).mockReset();
    vi.mocked(getEmbedding).mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('读文件失败 → 该条目被删除且不参与本轮向量化，其余文件照常', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '正常文件内容。够长成块。');
    const { adapter, binary } = makeAdapter(vault);
    const vs = new VectorStore(makeApp(vault, adapter) as any);
    // 「坏文件」出现在文件列表但读取时抛错
    const app: any = makeApp(vault, adapter);
    const origList = app.vault.getMarkdownFiles;
    app.vault.getMarkdownFiles = () => [...origList(), { path: '我的/坏.md', stat: { mtime: 9 } }];
    setApp(app);
    vs.app = app;

    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [0.5, 0.5]));
    await vs.refresh();

    const meta = readMeta(vault);
    expect(meta.notes['我的/坏.md']).toBeUndefined(); // 读取失败条目被删除
    expect(meta.notes['我的/A.md']).toBeDefined();
    expect(binary.size).toBe(1); // 正常文件已落盘
  });

  it('全部待处理文件正文为空 → 提示「无新内容」，不登记条目', async () => {
    const vault = new MockVault();
    vault.files.set('我的/E.md', '');
    vault.files.set('我的/F.md', '  \n\n  ');
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    const progress = vi.fn();
    await vs.refresh(progress);

    expect(progress).toHaveBeenCalledWith('✅ 向量化完成（无新内容）');
    expect(vs.meta.notes).toEqual({});
    expect(binary.size).toBe(0); // 提前返回不写盘
  });

  it('正文短于 minChunk → 调用方兜底取整段为单块；不传 updateProgress 用默认 noop', async () => {
    const vault = new MockVault();
    const short = '短文';
    vault.files.set('我的/S.md', short);
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) =>
      texts.map((t) => (t === 'S\n' + short ? [0.25, 0.75] : [0.5, 0.5]))
    );
    await vs.refresh(); // 不传回调 → 默认 noop 不抛错

    const meta = readMeta(vault);
    expect(meta.notes['我的/S.md'].chunks).toEqual([{ text: 'S\n' + short }]); // 首块带标题（ticket 110）
    const rows = parseRows(binary);
    expect(rows.length).toBe(2);
    expect(rows[0]).toBeCloseTo(0.25, 5);
  });
});

describe('VectorStore 补测（检索降级与移动端三级链）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => sbSettings() as any);
    vi.mocked(getEmbeddingsBatch).mockReset();
    vi.mocked(getEmbedding).mockReset();
    vi.mocked(checkRemoteOllama).mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** 种入两笔记的现成库（b.md 含可文本命中的内容） */
  function seedStore(): VectorStore {
    const vs = new VectorStore({ vault: {} } as any);
    vs.meta.notes['a.md'] = { mtime: 1, chunks: [{ text: '苹果香蕉橘子' }] };
    vs.meta.notes['b.md'] = { mtime: 1, chunks: [{ text: '深度学习算法。' }] };
    return vs;
  }

  it('search：向量检索抛错 → console.warn 后降级文本检索（功能不中断）', async () => {
    const vs = seedStore();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(getEmbedding).mockRejectedValue(new Error('网络断开'));
    const results = await vs.search('深度学习', 5);
    expect(warn).toHaveBeenCalled();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('b.md'); // 文本命中 chunk 原文
    expect(results[0].chunk).toBe('深度学习算法。');
  });

  it('vectorSearch：空库或查询嵌入缺失 → 返回空数组', async () => {
    const empty = new VectorStore({ vault: {} } as any);
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
    await expect(empty.vectorSearch('任意', 5)).resolves.toEqual([]); // 无向量

    const vs = seedStore();
    vs.dim = 2;
    vs.meta._dim = 2;
    vs.vectors = new Float32Array([1, 0]);
    vi.mocked(getEmbedding).mockResolvedValue(null as unknown as number[]);
    await expect(vs.vectorSearch('任意', 5)).resolves.toEqual([]); // 查询嵌入为空
  });

  it('initMobile 三态：远程可用→remote；不可用有数据→tfidf；无数据→text 空态文案', async () => {
    // remote
    const rvs = seedStore();
    vi.mocked(checkRemoteOllama).mockResolvedValue(true);
    await expect(rvs.initMobile()).resolves.toBe('✅ 远程 Ollama 已连接');
    expect(rvs.searchMode).toBe('remote');

    // tfidf（两笔记各 1 块 → 2 段）
    const tvs = seedStore();
    vi.mocked(checkRemoteOllama).mockResolvedValue(false);
    await expect(tvs.initMobile()).resolves.toBe('✅ TF-IDF 就绪（2 段）');
    expect(tvs.searchMode).toBe('tfidf');
    expect(tvs.tfidf.N).toBe(2);

    // text 空态
    const svs = new VectorStore({ vault: {} } as any);
    vi.mocked(checkRemoteOllama).mockResolvedValue(false);
    await expect(svs.initMobile()).resolves.toBe('⚠️ 没有符合条件的文件');
    expect(svs.searchMode).toBe('text');
  });

  it('searchMobile：remote 模式带远程 baseUrl 检索并命中', async () => {
    const vs = seedStore();
    vs.searchMode = 'remote';
    vs.dim = 2;
    vs.meta._dim = 2;
    vs.vectors = new Float32Array([1, 0, 0, 1]); // 行 0=a.md，行 1=b.md
    let seenBaseUrl: string | undefined;
    vi.mocked(getEmbedding).mockImplementation(async (_t, _q, url) => {
      seenBaseUrl = url;
      return [0, 1];
    });
    const results = await vs.searchMobile('深度学习', 5);
    expect(seenBaseUrl).toBe('http://192.168.1.8:11434'); // CONFIG.OLLAMA_REMOTE_URL
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ path: 'b.md', chunk: '深度学习算法。' });
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('searchMobile：remote 检索失败 → 降级文本检索（不抛出）', async () => {
    const vs = seedStore();
    vs.searchMode = 'remote'; // 非 tfidf 模式 → 直接落到 searchText
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(getEmbedding).mockRejectedValue(new Error('远程宕机'));
    const results = await vs.searchMobile('深度学习', 5);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('b.md');
  });

  it('searchMobile：tfidf 模式复用已建索引，两次查询只 build 一次', async () => {
    const vs = seedStore();
    vi.mocked(checkRemoteOllama).mockResolvedValue(false); // initMobile 建索引
    const buildSpy = vi.spyOn(TFIDF.prototype, 'build');
    await vs.initMobile();
    await vs.searchMobile('深度学习', 5);
    await vs.searchMobile('苹果', 5);
    expect(buildSpy).toHaveBeenCalledTimes(1);
    const hits = await vs.searchMobile('深度学习', 5);
    expect(hits[0].path).toBe('b.md');
    expect(hits[0].chunk).toBe('深度学习算法。'); // BM25 结果带 chunk 原文
  });

  it('searchMobile：默认 text 模式直走本地文本检索', async () => {
    const vs = seedStore();
    expect(vs.searchMode).toBe('text');
    const results = await vs.searchMobile('苹果', 5);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('a.md');
  });
});

// 本文件最后一个用例：动态重载模块验证 IS_MOBILE 开关（避免污染其他用例的模块实例）
describe('VectorStore 补测（IS_MOBILE 移动端分支）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('IS_MOBILE=true 时 search 直走文本索引（不发任何嵌入请求）', async () => {
    vi.resetModules();
    // 重载后 core/settings-provider 是新实例，须重新注入设置
    const sp = await import('../../src/core/settings-provider');
    sp.setSettingsProvider(() => sbSettings() as any);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const ollama = await import('../../src/secondbrain/ollama');
    vi.mocked(ollama.getEmbedding).mockResolvedValue([1, 0]);
    const { VectorStore: MobileVS } = await import('../../src/secondbrain/vector-store');
    const vs = new MobileVS({ vault: {} } as any);
    vs.meta.notes['我的/A.md'] = { mtime: 1, chunks: [{ text: '机器学习笔记内容' }] };

    const results = await vs.search('机器学习', 5);
    expect(ollama.getEmbedding).not.toHaveBeenCalled(); // 移动端不走向量检索 → 零请求
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('我的/A.md');

    // 还原模块图，防影响后续测试文件（本用例置于文件末尾）
    vi.resetModules();
    await import('../../src/core/settings-provider');
  });
});
