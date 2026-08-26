// @vitest-environment node
/**
 * 第二大脑索引就绪判定与自愈（ticket 107）：
 * - isIndexReady：空库 / meta 残留但向量缺失 → false；健康库 → true；
 * - refresh 自愈：meta 有条目但 .vec 缺失（mtime 全匹配的损坏态）→ 全量重建而非「已最新」；
 * - refresh 并发去重：进行中重复调用复用同一 promise，只跑一轮；
 * - 全部嵌入失败：refresh 正常 resolve 且不登记条目（QA 同语义——主面板据此判定失败并给出原因）。
 * ollama 经 vi.mock 替身；vault.adapter 用内存假体。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { VectorStore } from '../../src/secondbrain/vector-store';
import { getEmbedding, getEmbeddingsBatch } from '../../src/secondbrain/ollama';

vi.mock('../../src/secondbrain/ollama', () => ({
  EMBED_BATCH_SIZE: 1,
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
    secondBrainChunkMinLength: '10',
    secondBrainAllowPaths: '我的',
    secondBrainRemoteOllamaUrl: 'http://192.168.1.8:11434',
    ...overrides,
  };
}

/** 从内存 .vec 解析 dim 与 float32 行 */
function parseVec(binary: Map<string, ArrayBuffer>) {
  const buf = new Uint8Array(binary.get(VEC_PATH)!);
  const dim = new DataView(buf.buffer).getUint32(0, true);
  return { dim, rows: Array.from(new Float32Array(buf.buffer.slice(4))) };
}

describe('VectorStore 索引就绪与自愈（ticket 107）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => sbSettings() as any);
    vi.mocked(getEmbeddingsBatch).mockReset();
    vi.mocked(getEmbedding).mockReset();
  });

  it('isIndexReady：空库 false；meta 残留但向量为空 false；健康库 true', async () => {
    const vault = new MockVault();
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 1, chunks: [{ text: 't' }] } }, _dim: 2 })
    );
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    const vs = new VectorStore(app as any);

    // 未 load：空 meta
    expect(vs.isIndexReady()).toBe(false);
    // meta 有条目但 .vec 缺失（损坏态）
    await vs.load();
    expect(Object.keys(vs.meta.notes).length).toBe(1);
    expect(vs.isIndexReady()).toBe(false);

    // 向量补齐后就绪
    vs.vectors = new Float32Array([1, 0]);
    vs.dim = 2;
    expect(vs.isIndexReady()).toBe(true);
  });

  it('自愈：meta 有条目但 .vec 缺失且 mtime 全匹配 → refresh 全量重建而非「已最新」', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的单一文本块内容用于自愈测试。');
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 11, chunks: [{ text: '旧块' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault); // 故意不种 .vec
    const app = makeApp(vault, adapter, { '我的/A.md': 11 });
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();
    expect(vs.isIndexReady()).toBe(false);

    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [0.5, 0.5]));
    await vs.refresh();

    expect(vi.mocked(getEmbeddingsBatch)).toHaveBeenCalledTimes(1); // 损坏态触发了重嵌
    expect(vs.isIndexReady()).toBe(true);
    const { dim, rows } = parseVec(binary);
    expect(dim).toBe(2);
    expect(rows.length / dim).toBe(1);
    const meta = JSON.parse(vault.files.get(STORE_PATH)!).meta;
    expect(meta.notes['我的/A.md'].chunks).toEqual([{ text: 'A\n足够长的单一文本块内容用于自愈测试。' }]); // 首块带标题（ticket 110）
  });

  it('refresh 并发去重：进行中重复调用复用同一 promise，只跑一轮', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的单一文本块内容用于并发去重。');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 3 });
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let batchCalls = 0;
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => {
      batchCalls++;
      await gate;
      return texts.map(() => [0.5, 0.5]);
    });

    const p1 = vs.refresh();
    const p2 = vs.refresh();
    expect(p1).toBe(p2); // 同一 promise
    release();
    await Promise.all([p1, p2]);
    expect(batchCalls).toBe(1); // 单块单批：两轮会两次
  });

  it('全部嵌入失败：refresh 正常 resolve、不登记条目、isIndexReady 保持 false（面板失败判定的前提）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的单一文本块内容用于失败路径。');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 7 });
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    vi.mocked(getEmbeddingsBatch).mockRejectedValue(new Error('Ollama 无响应'));
    vi.mocked(getEmbedding).mockRejectedValue(new Error('Ollama 无响应'));

    const progress: string[] = [];
    await expect(vs.refresh((m) => progress.push(m))).resolves.toBeUndefined(); // 不抛错（QA 同语义）
    expect(vs.meta.notes).toEqual({});
    expect(vs.isIndexReady()).toBe(false);
    expect(progress.some((m) => m.startsWith('✅'))).toBe(true); // QA 文案仍报「完成」→ 面板须自行判定
  });

  it('hasPendingChanges：无变更 false；新文件/已修改/已删除任一 true（ticket 108）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '内容 A。');
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 5, chunks: [{ text: 't' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault);
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, 2, true);
    const row = new Float32Array([1, 0]);
    const out = new Uint8Array(4 + row.byteLength);
    out.set(header, 0);
    out.set(new Uint8Array(row.buffer, row.byteOffset, row.byteLength), 4);
    binary.set(VEC_PATH, out.buffer);
    const app = makeApp(vault, adapter, { '我的/A.md': 5 });
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    expect(vs.hasPendingChanges()).toBe(false); // mtime 一致，无删除

    // 已修改
    app.vault.getMarkdownFiles = () => [{ path: '我的/A.md', stat: { mtime: 6 } }] as any;
    expect(vs.hasPendingChanges()).toBe(true);

    // 新文件
    app.vault.getMarkdownFiles = () => [{ path: '我的/B.md', stat: { mtime: 1 } }] as any;
    expect(vs.hasPendingChanges()).toBe(true);

    // 已删除（meta 有条目但文件列表没有）
    app.vault.getMarkdownFiles = () => [] as any;
    expect(vs.hasPendingChanges()).toBe(true);
  });

  it('rebuildAll：清空 meta/vec 与 VP 缓存后整库重嵌（ticket 108 重新索引）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的单一文本块内容用于重建。');
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 3 });
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [0.5, 0.5]));

    // 先正常建一次索引，制造存量
    await vs.refresh();
    expect(vs.isIndexReady()).toBe(true);
    const oldNotes = vs.meta.notes;

    // 再全量重建：meta 清空 → 重新整库嵌入
    await vs.rebuildAll();
    expect(vs.isIndexReady()).toBe(true);
    expect(Object.keys(vs.meta.notes)).toEqual(Object.keys(oldNotes));
    expect(vi.mocked(getEmbeddingsBatch)).toHaveBeenCalled(); // 确实重嵌了
    expect(parseVec(binary).rows.length / parseVec(binary).dim).toBe(1);
  });
});
