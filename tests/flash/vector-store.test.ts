/**
 * 闪念 VectorStore 测试（ticket 18）：二进制格式往返/增量刷新/检索降级链
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { VectorStore } from '../../src/flash/vector-store';
import { buildConfig } from '../../src/flash/config';

/** adapter mock：read/write/readBinary/writeBinary */
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

/** fetch stub：/api/embed 批量返回；/api/embeddings 单条返回 */
function stubFetch(fn: (url: string, body: any) => { embedding?: number[]; embeddings?: number[][] }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts: any) => {
    const body = opts?.body ? JSON.parse(opts.body) : {};
    const r = fn(url, body);
    return {
      ok: true,
      status: 200,
      json: async () => r,
    };
  }));
}

function makeApp(vault: MockVault, adapter: any) {
  const app: any = {
    vault: {
      getMarkdownFiles: () => vault.getMarkdownFiles(),
      read: (f: any) => vault.read(f),
      adapter,
    },
  };
  return app;
}

function flashSettings() {
  return {
    OLLAMA_URL: 'http://localhost:11434',
    EMBEDDING_MODEL: 'bge-m3',
    META_PATH: 'CONFIG/STORAGE/ai_completion_meta.json',
    VEC_PATH: 'CONFIG/STORAGE/ai_completion_vectors.vec',
    TOP_K: '20',
    CHAT_TOP_K: '20',
    CHUNK_MIN_LENGTH: '10',
    ALLOW_PATHS: '我的',
    CONCURRENCY: '15',
    CONTEXT_LIMIT: '600',
    DEBOUNCE_DELAY: '300',
    CURSOR_POLL_INTERVAL: '500',
    OLLAMA_CHAT_MODEL: 'qwen2.5:14b-instruct',
    DEEPSEEK_MODEL: 'deepseek-v4-flash',
    DEFAULT_USE_DEEPSEEK: 'false',
    MAX_HISTORY: '10',
    OLLAMA_REMOTE_URL: 'http://192.168.1.8:11434',
  };
}

describe('VectorStore', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => flashSettings() as any);
  });

  it('meta.json v7 格式 + vectors.vec 字节布局（dim uint32 LE + float32 平铺）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '第一句。第二句。第三句。第四句。第五句。第六句。');
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);

    const vs = new VectorStore(app as any);
    stubFetch((url, body) => {
      if (url.endsWith('/api/embed')) return { embeddings: body.input.map(() => [0.5, 0.5]) };
      return { embedding: [0.5, 0.5] };
    });

    await vs.load();
    expect(vs.meta.version).toBe(7);
    await vs.refresh();

    // meta 校验
    const meta = JSON.parse(vault.files.get(buildConfig().META_PATH)!);
    expect(meta.version).toBe(7);
    expect(meta._dim).toBe(2);
    const paths = Object.keys(meta.notes);
    expect(paths.length).toBe(1);
    expect(paths[0]).toBe('我的/A.md');
    expect(meta.notes[paths[0]].chunks.length).toBeGreaterThan(0);

    // vec 布局校验：header 4 字节 dim=2，payload float32
    const buf = new Uint8Array(binary.get(buildConfig().VEC_PATH)!);
    const dim = new DataView(buf.buffer, 0, 4).getUint32(0, true);
    expect(dim).toBe(2);
    const payload = new Float32Array(buf.buffer.slice(4));
    expect(payload.length).toBe(meta.notes[paths[0]].chunks.length * 2);
    expect(payload[0]).toBeCloseTo(0.5, 5);
  });

  it('增量刷新：mtime 不变 → ✅ 向量库已最新；文件删除清理条目', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '第一句。第二句。第三句。');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    stubFetch((url, body) => {
      if (url.endsWith('/api/embed')) return { embeddings: body.input.map(() => [0.5]) };
      return { embedding: [0.5] };
    });

    await vs.load();
    await vs.refresh();
    const progress1 = new Promise<string>((res) => {
      vs.updateProgress = res;
      vs.refresh();
    });
    const msg1 = await progress1;
    expect(msg1).toBe('✅ 向量库已最新');

    // 删除文件 → 条目清理
    vault.files.delete('我的/A.md');
    const msgs: string[] = [];
    vs.updateProgress = (m) => msgs.push(m);
    await vs.refresh();
    expect(Object.keys(vs.meta.notes)).toHaveLength(0);
  });

  it('批量嵌入失败 → 逐条降级', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '第一句。第二句。第三句。');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    const singleFetch = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts: any) => {
      if (url.endsWith('/api/embed')) {
        throw new Error('Ollama 错误: 500');
      }
      singleFetch(url);
      return { ok: true, status: 200, json: async () => ({ embedding: [0.25, 0.75] }) };
    }));

    await vs.load();
    await vs.refresh();
    expect(singleFetch).toHaveBeenCalled();
    const meta = JSON.parse(vault.files.get(buildConfig().META_PATH)!);
    expect(meta._dim).toBe(2);
  });

  it('load 版本不匹配 → 重置空库', async () => {
    const vault = new MockVault();
    vault.files.set(buildConfig().META_PATH, JSON.stringify({ version: 6, notes: { 'x.md': { mtime: 1, chunks: [] } }, _dim: 3 }));
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();
    expect(vs.meta.notes).toEqual({});
    expect(vs.dim).toBe(0);
  });

  it('vectorSearch：VP-Tree 检索 + cosSim + score^0.35', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '机器学习 神经网络。深度学习 算法。');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    stubFetch((url, body) => {
      if (url.endsWith('/api/embed')) return { embeddings: body.input.map(() => [1, 0]) };
      return { embedding: [0.9, 0.1] }; // 查询向量（检索前缀）
    });

    await vs.load();
    await vs.refresh();
    const results = await vs.vectorSearch('机器学习', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('我的/A.md');
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].score).toBeLessThanOrEqual(1);
    expect(typeof results[0].chunk).toBe('string');
  });
});
