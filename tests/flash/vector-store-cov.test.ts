// @vitest-environment node
/**
 * 闪念 VectorStore 覆盖率补测：
 * refresh 各早退/异常分支、未变文件旧向量段拷贝、嵌入全败与批量缺数兜底、
 * 多笔记检索映射、统一检索降级链（vector→text）、移动端三模式（remote/tfidf/text）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { VectorStore } from '../../src/flash/vector-store';
import { buildConfig } from '../../src/flash/config';

/** adapter mock：read/write/readBinary/writeBinary/exists（二进制独立存储） */
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

/**
 * app mock：getMarkdownFiles 返回带可控 mtime 的伪 TFile（驱动增量刷新判定）；
 * read 直接从 vault.files 取，取不到即抛（模拟读取失败）。
 */
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
    OLLAMA_REMOTE_URL: 'http://192.168.1.8:11434',
  };
}

/** fetch stub：/api/embed 按文本查表返回向量（缺省 [0.5,0.5]）；/api/embeddings 单条同规则 */
function stubEmbedFetch(byText: Record<string, number[]> = {}) {
  const lookup = (t: string) => byText[t] ?? [0.5, 0.5];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, opts: any) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (_url.endsWith('/api/embed')) {
        return { ok: true, status: 200, json: async () => ({ embeddings: body.input.map(lookup) }) };
      }
      return { ok: true, status: 200, json: async () => ({ embedding: lookup(body.prompt) }) };
    })
  );
}

/** 从内存 .vec 二进制解析出 dim 与全部 float32 行 */
function parseVec(binary: Map<string, ArrayBuffer>) {
  const buf = new Uint8Array(binary.get(buildConfig().VEC_PATH)!);
  const dim = new DataView(buf.buffer, 0, 4).getUint32(0, true);
  const payload = new Float32Array(buf.buffer.slice(4));
  return { dim, payload };
}

describe('VectorStore 覆盖补测（refresh 早退与异常分支）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => flashSettings() as any);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('白名单过滤后无文件 → 提示「没有符合条件的文件」并直接返回', async () => {
    const vault = new MockVault();
    vault.files.set('其他/B.md', '不在白名单');
    const { adapter } = makeAdapter(vault);
    const vs = new VectorStore(makeApp(vault, adapter) as any);
    const progress = vi.fn();
    await vs.refresh(progress);
    expect(progress).toHaveBeenCalledWith('⚠️ 没有符合条件的文件');
    expect(vs.meta.notes).toEqual({});
  });

  it('所有文件 mtime 未变 → 提示「向量库已最新」，不做任何向量化', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '已有内容。足够长的句子。');
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 7 });
    const vs = new VectorStore(app as any);
    // 预置一条已同步条目（mtime 与文件一致）
    vs.meta.notes['我的/A.md'] = { mtime: 7, chunks: [{ text: '已有内容' }] };
    stubEmbedFetch();
    const progress = vi.fn();
    await vs.refresh(progress);
    expect(progress).toHaveBeenCalledWith('✅ 向量库已最新');
    expect(binary.size).toBe(0); // 未写任何向量文件
  });

  it('增量刷新：已删除文件的条目被清理，未变文件拷贝旧向量段、变更文件写新向量', async () => {
    const vault = new MockVault();
    const a1 = '甲'.repeat(130);
    const a2 = '乙'.repeat(130);
    const b1 = '闪念储备内容第九段落测试';
    vault.files.set('我的/A.md', `${a1}。${a2}。`);
    vault.files.set('我的/B.md', `${b1}。`);
    const { adapter, binary } = makeAdapter(vault);
    let mtimes: Record<string, number> = { '我的/A.md': 1, '我的/B.md': 1 };
    const vs = new VectorStore(makeApp(vault, adapter, mtimes) as any);
    // B 的向量给特殊值，用于验证「拷贝旧段」语义
    stubEmbedFetch({ [b1]: [0.9, 0.1] });

    await vs.load();
    await vs.refresh();
    expect(vs.dim).toBe(2);
    const first = parseVec(binary);
    expect(first.payload.length).toBe(6); // A 两块 + B 一块

    // 第二轮：A 内容变化（mtime 前移），B 不变；同时模拟另一文件 C 已被删除（条目应被清理）
    vs.meta.notes['我的/C.md'] = { mtime: 1, chunks: [{ text: '幽灵条目' }] };
    vault.files.delete('我的/A.md');
    const nA1 = '丙'.repeat(130);
    const nA2 = '丁'.repeat(130);
    vault.files.set('我的/A.md', `${nA1}。${nA2}。`);
    mtimes['我的/A.md'] = 2; // 原地改（app 闭包持有同一对象）
    await vs.refresh();

    const meta = JSON.parse(vault.files.get(buildConfig().META_PATH)!);
    expect(meta.notes['我的/C.md']).toBeUndefined(); // 已删除文件的条目被清理
    expect(meta.notes['我的/B.md'].chunks.length).toBe(1);
    const second = parseVec(binary);
    expect(second.payload.length).toBe(6); // 新 A 两块 + B 旧一块
    // B 的旧向量段原样保留（行序 A,A,B → 第 3 行是 B）
    expect(second.payload[4]).toBeCloseTo(0.9, 5);
    expect(second.payload[5]).toBeCloseTo(0.1, 5);
  });

  it('读文件失败 → 该文件条目被删除且不参与本轮向量化', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '正常文件内容。够长。');
    const { adapter, binary } = makeAdapter(vault);
    const vs = new VectorStore(makeApp(vault, adapter) as any);
    vs.meta.notes['我的/坏文件.md'] = { mtime: 0, chunks: [{ text: '旧' }] };
    // 让「坏文件」出现在文件列表但读取时失败
    const app: any = makeApp(vault, adapter);
    const origList = app.vault.getMarkdownFiles;
    app.vault.getMarkdownFiles = () => [...origList(), { path: '我的/坏文件.md', stat: { mtime: 9 } }];
    vs.app = app;
    stubEmbedFetch();

    await vs.refresh();
    const meta = JSON.parse(vault.files.get(buildConfig().META_PATH)!);
    expect(meta.notes['我的/坏文件.md']).toBeUndefined(); // 读取失败的条目被删除
    expect(meta.notes['我的/A.md']).toBeDefined();
    expect(binary.size).toBe(1);
  });

  it('分块为空但正文非空 → 兜底截取前 256 字作为单块', async () => {
    const vault = new MockVault();
    const short = '无句读短文'; // 长度 < CHUNK_MIN_LENGTH(10)，smartChunk 返回 []
    vault.files.set('我的/S.md', short);
    const { adapter, binary } = makeAdapter(vault);
    const vs = new VectorStore(makeApp(vault, adapter) as any);
    stubEmbedFetch({ [short]: [0.25, 0.75] });

    await vs.load();
    await vs.refresh();
    const meta = JSON.parse(vault.files.get(buildConfig().META_PATH)!);
    expect(meta.notes['我的/S.md'].chunks).toEqual([{ text: short }]);
    const { payload } = parseVec(binary);
    expect(payload.length).toBe(2);
    expect(payload[0]).toBeCloseTo(0.25, 5);
  });

  it('批量与逐条嵌入全部失败 → 条目登记但向量保持为空（dim 不变）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/F.md', '全部嵌入都会失败的文件。内容足够分块。');
    const { adapter, binary } = makeAdapter(vault);
    const vs = new VectorStore(makeApp(vault, adapter) as any);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Ollama 挂了');
      })
    );

    await vs.load();
    await vs.refresh();
    expect(vs.dim).toBe(0); // 无新向量 → dim 保持原值
    expect(vs.vectors.length).toBe(0);
    const meta = JSON.parse(vault.files.get(buildConfig().META_PATH)!);
    expect(meta.notes['我的/F.md'].chunks.length).toBeGreaterThan(0); // 条目仍登记
    const buf = new Uint8Array(binary.get(buildConfig().VEC_PATH)!);
    expect(new DataView(buf.buffer, 0, 4).getUint32(0, true)).toBe(0); // vec 头部 dim=0
  });

  it('批量返回数量不足 → 缺失项以空向量占位（vecs[k] || []）', async () => {
    const vault = new MockVault();
    const s1 = '甲'.repeat(130);
    const s2 = '乙'.repeat(130);
    vault.files.set('我的/P.md', `${s1}。${s2}。`);
    const { adapter, binary } = makeAdapter(vault);
    const vs = new VectorStore(makeApp(vault, adapter) as any);
    // 批量接口只回 1 条（少于请求数）
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, _opts: any) => {
        if (_url.endsWith('/api/embed')) {
          return { ok: true, status: 200, json: async () => ({ embeddings: [[0.5, 0.5]] }) };
        }
        return { ok: true, status: 200, json: async () => ({ embedding: [0.5, 0.5] }) };
      })
    );

    await vs.load();
    await vs.refresh();
    expect(vs.dim).toBe(2); // 首个真实向量决定 dim
    // 生产语义：缺失项以空数组占位，但 Float32Array(flat()) 会丢弃空行 ——
    // 向量行数少于 chunk 数是该分支的真实表现（罕见边界：批量返回不足）。
    const { payload } = parseVec(binary);
    expect(payload.length).toBe(2);
    expect(payload[0]).toBeCloseTo(0.5, 5);
    const meta = JSON.parse(vault.files.get(buildConfig().META_PATH)!);
    expect(meta.notes['我的/P.md'].chunks.length).toBe(2); // meta 块数仍按正文记录
  });

  it('load：meta.json 损坏（非法 JSON）→ 重置空库', async () => {
    const vault = new MockVault();
    vault.files.set(buildConfig().META_PATH, '{这不是JSON');
    const { adapter } = makeAdapter(vault);
    const vs = new VectorStore(makeApp(vault, adapter) as any);
    await vs.load();
    expect(vs.meta.notes).toEqual({});
    expect(vs.dim).toBe(0);
  });

  it('loadVectors：.vec 读取失败 → 向量清空、dim 归零', async () => {
    const vault = new MockVault();
    const { adapter } = makeAdapter(vault);
    const vs = new VectorStore(makeApp(vault, adapter) as any);
    vs.dim = 3;
    vs.vectors = new Float32Array([1, 2, 3]);
    await vs.loadVectors(); // readBinary 必然 ENOENT
    expect(vs.vectors.length).toBe(0);
    expect(vs.dim).toBe(0);
  });
});

describe('VectorStore 覆盖补测（检索链路）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => flashSettings() as any);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** 两篇笔记各一块的现成向量库（分块为空时兜底块=原文字面量，含句号） */
  async function makeTwoNoteStore() {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '苹果香蕉橘子。');
    vault.files.set('我的/B.md', '深度学习算法。');
    const { adapter } = makeAdapter(vault);
    const vs = new VectorStore(makeApp(vault, adapter) as any);
    stubEmbedFetch({
      '苹果香蕉橘子。': [1, 0],
      '深度学习算法。': [0, 1],
    });
    await vs.load();
    await vs.refresh();
    return vs;
  }

  it('vectorSearch：命中第二篇笔记（路径累积偏移 cum += count 分支）', async () => {
    const vs = await makeTwoNoteStore();
    // 查询向量接近 B（[0,1]）
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, opts: any) => ({
        ok: true,
        status: 200,
        json: async () => ({ embedding: [0, 1] }),
      }))
    );
    const results = await vs.vectorSearch('深度学习', 5);
    expect(results.length).toBe(2); // k=min(topK*3,N)=2 全返回
    expect(results[0].path).toBe('我的/B.md'); // 相似度最高排前
    expect(results[0].chunk).toBe('深度学习算法。');
    expect(results[1].path).toBe('我的/A.md'); // 第二命中跨过第一条目的偏移区间
    const scores = results.map((r) => r.score);
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });

  it('search：向量检索抛错 → console.warn 后降级文本检索（功能不中断）', async () => {
    const vs = await makeTwoNoteStore();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('网络断开');
      })
    );
    const results = await vs.search('深度学习', 5);
    warn.mockRestore();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('我的/B.md');
  });

  it('searchText：按 meta.notes 构建倒排索引并附首块文本', async () => {
    const vault = new MockVault();
    const vs = new VectorStore(makeApp(vault, new (class {})() as any) as any);
    vs.meta.notes['我的/A.md'] = { mtime: 1, chunks: [{ text: '机器学习入门' }, { text: '神经网络基础' }] };
    const results = vs.searchText('机器学习', 5);
    expect(results.length).toBe(1);
    expect(results[0].path).toBe('我的/A.md');
    expect(results[0].chunk).toBe('机器学习入门'); // 附该笔记首块文本
    expect(results[0].score).toBeLessThanOrEqual(1);
  });

  it('initMobile：远程 Ollama 可用 → remote 模式', async () => {
    const vault = new MockVault();
    const vs = new VectorStore(makeApp(vault, null as any) as any);
    vs.meta.notes['我的/A.md'] = { mtime: 1, chunks: [{ text: '远程优先' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(url).toContain('/api/tags');
        return { ok: true, status: 200, json: async () => ({ models: [] }) };
      })
    );
    const msg = await vs.initMobile();
    expect(msg).toContain('远程 Ollama 已连接');
    expect(vs.mode).toBe('remote');
  });

  it('initMobile：远程不可用且有笔记 → tfidf 模式', async () => {
    const vault = new MockVault();
    const vs = new VectorStore(makeApp(vault, null as any) as any);
    vs.meta.notes['我的/A.md'] = { mtime: 1, chunks: [{ text: '机器学习笔记内容' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('不可达');
      })
    );
    const msg = await vs.initMobile();
    expect(msg).toContain('TF-IDF 就绪');
    expect(vs.mode).toBe('tfidf');
  });

  it('initMobile：远程不可用且无笔记 → text 模式空态文案', async () => {
    const vs = new VectorStore(makeApp(new MockVault(), null as any) as any);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('不可达');
      })
    );
    const msg = await vs.initMobile();
    expect(msg).toBe('✅ 移动端模式：已加载 0 篇笔记');
    expect(vs.mode).toBe('text');
  });

  it('searchMobile：remote 模式走远程向量检索（请求打到远程地址）', async () => {
    const vs = new VectorStore(makeApp(new MockVault(), null as any) as any);
    vs.mode = 'remote';
    // 直接种入向量库：单条目单块，向量 [0,1]
    vs.meta.notes['我的/B.md'] = { mtime: 1, chunks: [{ text: '深度学习算法。' }] };
    vs.dim = 2;
    vs.vectors = new Float32Array([0, 1]);
    const seenUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seenUrls.push(url);
        return { ok: true, status: 200, json: async () => ({ embedding: [0, 1] }) };
      })
    );
    const results = await vs.searchMobile('深度学习', 5);
    expect(seenUrls.some((u) => u.startsWith('http://192.168.1.8:11434/api/embeddings'))).toBe(true);
    expect(results.length).toBe(1);
    expect(results[0].path).toBe('我的/B.md');
  });

  it('searchMobile：remote 检索失败 → 降级文本检索（不抛出）', async () => {
    const vs = new VectorStore(makeApp(new MockVault(), null as any) as any);
    vs.mode = 'remote';
    vs.meta.notes['我的/B.md'] = { mtime: 1, chunks: [{ text: '深度学习算法。' }] };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('远程宕机');
      })
    );
    const results = await vs.searchMobile('深度学习', 5);
    warn.mockRestore();
    expect(results.length).toBe(1);
    expect(results[0].path).toBe('我的/B.md');
  });

  it('searchMobile：tfidf 模式返回 BM25 式加权结果', async () => {
    const vs = new VectorStore(makeApp(new MockVault(), null as any) as any);
    vs.mode = 'tfidf';
    vs.meta.notes['我的/A.md'] = { mtime: 1, chunks: [{ text: '苹果香蕉橘子' }] };
    vs.meta.notes['我的/B.md'] = { mtime: 1, chunks: [{ text: '深度学习算法' }] };
    const results = await vs.searchMobile('深度学习', 5);
    expect(results.length).toBe(1);
    expect(results[0].path).toBe('我的/B.md');
    expect(results[0].chunk).toBe('深度学习算法'); // toChunkResults 附首块
    expect(results[0].score).toBeLessThanOrEqual(1);
  });

  it('searchMobile：默认（vector）模式下直走本地文本检索', async () => {
    const vs = new VectorStore(makeApp(new MockVault(), null as any) as any);
    vs.mode = 'vector';
    vs.meta.notes['我的/A.md'] = { mtime: 1, chunks: [{ text: '苹果香蕉橘子' }] };
    const results = await vs.searchMobile('苹果', 5);
    expect(results.length).toBe(1);
    expect(results[0].path).toBe('我的/A.md');
  });
});

// 本文件最后一个用例：动态重载模块验证移动端开关（避免污染其他用例的模块实例）
describe('VectorStore 覆盖补测（IS_MOBILE 移动端分支）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('IS_MOBILE=true 时 search 直走文本索引（不发任何网络请求）', async () => {
    vi.resetModules();
    // 重载后 core/settings-provider 是新实例，须重新注入设置
    const sp = await import('../../src/core/settings-provider');
    sp.setSettingsProvider(() => flashSettings() as any);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const { VectorStore: MobileVS } = await import('../../src/flash/vector-store');
    const vs = new MobileVS(makeApp(new MockVault(), null as any) as any);
    vs.meta.notes['我的/A.md'] = { mtime: 1, chunks: [{ text: '机器学习笔记' }] };
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const results = await vs.search('机器学习', 5);
    expect(fetchSpy).not.toHaveBeenCalled(); // 移动端不走向量检索 → 零请求
    expect(results.length).toBe(1);
    expect(results[0].path).toBe('我的/A.md');
    vi.unstubAllGlobals();
    // 还原模块图，防影响后续测试文件（本用例置于文件末尾）
    vi.resetModules();
    await import('../../src/core/settings-provider');
  });
});
