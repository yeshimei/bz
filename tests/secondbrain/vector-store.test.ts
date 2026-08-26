// @vitest-environment node
/**
 * 第二大脑 VectorStore 测试（ticket 103 重写对齐；ticket 110 起 meta v9；ticket 120 起 meta 并入
 * secondbrain.json 单文件）：
 * 数据文件路径换代（storagePath/secondbrain.json+vec）、版本不符自动重建（v8→v9）、白名单过滤、
 * 增量刷新与删除后合并写回（非末尾删除不错位回归）、批量嵌入降级、检索公式 cos=max(0,1−d²/2)。
 * ollama 模块经 vi.mock 替身（不碰网络），vault.adapter 用内存 Map 假体。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { VectorStore, CHECKPOINT_POLICY } from '../../src/secondbrain/vector-store';
import { searchTextIndex } from '../../src/secondbrain/text-search';
import { getEmbedding, getEmbeddingsBatch, SEARCH_TIMEOUT_MS } from '../../src/secondbrain/ollama';

vi.mock('../../src/secondbrain/ollama', () => ({
  EMBED_BATCH_SIZE: 1, // 每块一批：便于按文件隔离批量接口的成功/失败
  getEmbedding: vi.fn(),
  getEmbeddingsBatch: vi.fn(),
  checkRemoteOllama: vi.fn(),
  SEARCH_TIMEOUT_MS: 10000, // ticket 46：检索级超时（与嵌入 30s 分离）
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

/** adapter mock：read/write/readBinary/writeBinary（二进制独立存储） */
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

/** app mock：getMarkdownFiles 返回带可控 mtime 的伪 TFile（驱动增量刷新判定） */
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

/** 设置假体：键名已换代 secondBrain*，数据目录由 storagePath 决定 */
function sbSettings(overrides: Record<string, unknown> = {}) {
  return {
    storagePath: 'CONFIG/STORAGE',
    secondBrainOllamaUrl: 'http://localhost:11434',
    secondBrainEmbeddingModel: 'bge-m3',
    secondBrainTopK: '20',
    secondBrainChatTopK: '20',
    secondBrainChunkMinLength: '10',
    secondBrainAllowPaths: '我的',
    secondBrainConcurrency: '15',
    secondBrainContextLimit: '600',
    secondBrainDebounceDelay: '300',
    secondBrainCursorPollInterval: '500',
    secondBrainChatModel: 'qwen2.5:14b-instruct',
    secondBrainDeepseekModel: 'deepseek-v4-flash',
    secondBrainDefaultUseDeepseek: 'false',
    secondBrainMaxHistory: '10',
    secondBrainRemoteOllamaUrl: 'http://192.168.1.8:11434',
    ...overrides,
  };
}

/** 构造 .vec 二进制：uint32LE dim 头 + float32 平铺行 */
function vecBuffer(rows: number[][], dim: number): ArrayBuffer {
  const flat = new Float32Array(rows.flat());
  const out = new Uint8Array(4 + flat.byteLength);
  new DataView(out.buffer).setUint32(0, dim, true);
  out.set(new Uint8Array(flat.buffer, flat.byteOffset, flat.byteLength), 4);
  return out.buffer;
}

/** 从内存 .vec 解析 dim 与全部 float32（展开成数组便于 closeTo 断言） */
function parseVec(binary: Map<string, ArrayBuffer>) {
  const buf = new Uint8Array(binary.get(VEC_PATH)!);
  const dim = new DataView(buf.buffer).getUint32(0, true);
  return { dim, rows: Array.from(new Float32Array(buf.buffer.slice(4))) };
}

function expectClose(got: number[], exp: number[]) {
  expect(got.length).toBe(exp.length);
  exp.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 5));
}

describe('VectorStore（v8 元数据与增量刷新）', () => {
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

  /** 按文本查表返回二维向量的批量嵌入替身 */
  function mockBatchEmbed(byText: Record<string, number[]>, track?: string[]) {
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => {
      if (track) track.push(...texts);
      return texts.map((t) => byText[t] ?? [0.5, 0.5]);
    });
  }

  it('数据文件路径换代：storagePath 下 secondbrain.json / secondbrain.vec，当前版本往返', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '第一段内容足够长可以成块。第二段内容也同样足够长可以成块。');
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 11 });
    setApp(app as any);
    const vs = new VectorStore(app as any);

    await vs.load(); // 文件不存在 → 空库
    expect(vs.meta.version).toBe(9);
    mockBatchEmbed({});
    await vs.refresh();

    // 键名换代断言：新路径落盘（旧 ai_completion_* / secondbrain_meta.json 不再出现）
    expect(vault.files.has(STORE_PATH)).toBe(true);
    expect(binary.has(VEC_PATH)).toBe(true);
    const meta = readMeta(vault);
    expect(meta.version).toBe(9);
    expect(meta._dim).toBe(2);
    expect(Object.keys(meta.notes)).toEqual(['我的/A.md']);

    // 往返：重新 load 能恢复 meta 与 .vec 向量
    const vs2 = new VectorStore(app as any);
    await vs2.load();
    expect(vs2.meta.notes['我的/A.md'].chunks.length).toBeGreaterThan(0);
    expect(vs2.dim).toBe(2);
    expect(vs2.vectors.length).toBe(2);
  });

  it('load：version≠9 → 重置为空库且不读 .vec；下次 refresh 全量重建且新块无 YAML 头、首块带标题（v8→v9，ticket 110）', async () => {
    const vault = new MockVault();
    const fm = '---\nreviewStart: 2026-08-01\nreviewStage: 2\n---\n';
    const body = '记忆依据图式构建的正文内容足够长可以成块入库使用。';
    vault.files.set('我的/幽灵之战.md', fm + body);
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 8, notes: { 'x.md': { mtime: 1, chunks: [{ text: '旧' }] } }, _dim: 3 })
    );
    const { adapter, binary } = makeAdapter(vault);
    binary.set(VEC_PATH, vecBuffer([[9, 9]], 2)); // 若被读取会破坏断言
    const app = makeApp(vault, adapter, { '我的/幽灵之战.md': 1 });
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();
    expect(vs.meta.version).toBe(9);
    expect(vs.meta.notes).toEqual({}); // v8 旧条目不复活
    expect(vs.dim).toBe(0);
    expect(vs.vectors.length).toBe(0); // 提前 return，loadVectors 未执行

    // 版本重置后的下一轮刷新即全量重建路径：全部文件重嵌，YAML 头与样板字段不入向量文本
    const embedded: string[] = [];
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => {
      embedded.push(...texts);
      return texts.map(() => [0.5, 0.5]);
    });
    await vs.refresh();
    expect(Object.keys(vs.meta.notes)).toEqual(['我的/幽灵之战.md']);
    expect(embedded).toHaveLength(1);
    expect(embedded[0]).not.toContain('reviewStart');
    expect(embedded[0]).not.toContain('---');
    expect(embedded[0]).toContain(body);
    expect(embedded[0].startsWith('幽灵之战\n')).toBe(true); // 标题信号在首块
    const meta = readMeta(vault);
    expect(meta.notes['我的/幽灵之战.md'].chunks[0].text).toBe(embedded[0]); // meta 存的即嵌入文本
  });

  it('refresh：ALLOW_PATHS 目录前缀/全等过滤；meta 只存 text、向量只进 .vec', async () => {
    const vault = new MockVault();
    vault.files.set('卡片盒/N1.md', '卡片盒笔记内容足够长可以成块了吧。');
    vault.files.set('CODE/root.md', '根笔记内容同样足够长可以成块了吧哈。');
    vault.files.set('其他/X.md', '不在白名单内的文件内容足够长成块。');
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    setSettingsProvider(() => sbSettings({ secondBrainAllowPaths: '卡片盒,CODE/root.md' }) as any);
    const vs = new VectorStore(app as any);
    await vs.load();
    mockBatchEmbed({});
    await vs.refresh();

    // 「目录/ 前缀」与「全等」两种命中都保留，其余排除
    expect(Object.keys(vs.meta.notes)).toEqual(['卡片盒/N1.md', 'CODE/root.md']);
    const meta = readMeta(vault);
    for (const entry of Object.values<any>(meta.notes)) {
      for (const c of entry.chunks) expect(Object.keys(c)).toEqual(['text']); // 全程只存 text
    }
    const { dim, rows } = parseVec(binary);
    expect(dim).toBe(2);
    expect(rows.length).toBe(4); // 两文件各 1 块 × dim 2
  });

  it('refresh：删除非末尾文件后其余文件向量不错位（A/B/C 合并回归）', async () => {
    const vault = new MockVault();
    const A1 = '甲'.repeat(130), A2 = '乙'.repeat(130);
    const B1 = '丙'.repeat(130), B2 = '丁'.repeat(130);
    const C1 = '戊'.repeat(130), C2 = '己'.repeat(130);
    vault.files.set('我的/A.md', `${A1}。${A2}。`);
    vault.files.set('我的/B.md', `${B1}。${B2}。`);
    vault.files.set('我的/C.md', `${C1}。${C2}。`);
    const { adapter, binary } = makeAdapter(vault);
    const mtimes: Record<string, number> = { '我的/A.md': 1, '我的/B.md': 1, '我的/C.md': 1 };
    const app = makeApp(vault, adapter, mtimes);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    // ticket 110 起首块带标题前缀（<basename>\n<原文>），第二块及以后不带；嵌入替身按最终块文本查表
    const EMBED: Record<string, number[]> = {
      ['A\n' + A1]: [1, 0],
      [A2]: [0.9, 0.1],
      ['B\n' + B1]: [0.5, 0.5],
      [B2]: [0.6, 0.4],
      ['C\n' + C1]: [0.2, 0.8],
      [C2]: [0.7, 0.7],
    };
    const embeddedTexts: string[] = [];
    mockBatchEmbed(EMBED, embeddedTexts);

    await vs.load();
    await vs.refresh();
    expectClose(parseVec(binary).rows, [
      ...EMBED['A\n' + A1], ...EMBED[A2], ...EMBED['B\n' + B1], ...EMBED[B2], ...EMBED['C\n' + C1], ...EMBED[C2],
    ]);

    // 第二轮：删除中间文件 B，改 C 触发刷新；A 不变
    const NC1 = '癸'.repeat(130);
    const NC2 = '壬'.repeat(130);
    EMBED['C\n' + NC1] = [-1, 0];
    EMBED[NC2] = [0, -1];
    vault.files.delete('我的/B.md');
    vault.files.set('我的/C.md', `${NC1}。${NC2}。`);
    mtimes['我的/C.md'] = 2;
    embeddedTexts.length = 0;
    await vs.refresh();

    const meta = readMeta(vault);
    expect(Object.keys(meta.notes)).toEqual(['我的/A.md', '我的/C.md']); // B 条目已清理
    expect(embeddedTexts.every((t) => t === 'C\n' + NC1 || t === NC2)).toBe(true); // A 未被重嵌
    // 关键回归：未变的 A 按「删除前」源偏移拷贝，两段数值仍在正确位置（不错位到 B 的旧槽位）
    expectClose(parseVec(binary).rows, [[1, 0], [0.9, 0.1], -1, 0, 0, -1].flat());
  });

  it('refresh：仅清理失效条目也必须落盘并提示数量（旧版提前 return 缺陷已修）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '存活文件占位内容。');
    vault.files.set(
      STORE_PATH,
      storeJSON({
        version: 9,
        notes: {
          '我的/A.md': { mtime: 1, chunks: [{ text: 't1' }] },
          '我的/Ghost.md': { mtime: 1, chunks: [{ text: 'g1' }, { text: 'g2' }] },
        },
        _dim: 2,
      })
    );
    const { adapter, binary } = makeAdapter(vault);
    binary.set(VEC_PATH, vecBuffer([[1, 0], [0, 1], [0.5, 0.5]], 2));
    const app = makeApp(vault, adapter, { '我的/A.md': 1 });
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();
    expect(Object.keys(vs.meta.notes)).toEqual(['我的/A.md', '我的/Ghost.md']);

    const progress = vi.fn();
    await vs.refresh(progress);

    expect(progress).toHaveBeenCalledWith('✅ 向量库已最新（清理 1 个失效条目）');
    const meta = readMeta(vault);
    expect(Object.keys(meta.notes)).toEqual(['我的/A.md']); // saveStore 落盘
    expectClose(parseVec(binary).rows, [1, 0]); // saveVectors 紧凑重排，Ghost 两行移除
  });

  it('refresh：无删除无变更 → 提示「向量库已最新」且完全不落盘', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '内容不重要不会读。');
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 5, chunks: [{ text: 't' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault);
    // 健康库：meta 与 .vec 一致（ticket 107 起「meta 有条目但向量缺失」会触发全量重建自愈，不再「已最新」）
    binary.set(VEC_PATH, vecBuffer([[1, 0]], 2));
    const app = makeApp(vault, adapter, { '我的/A.md': 5 });
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();
    const metaBefore = vault.files.get(STORE_PATH);
    const writeSpy = vi.spyOn(adapter, 'write');
    const writeBinSpy = vi.spyOn(adapter, 'writeBinary');

    const progress = vi.fn();
    await vs.refresh(progress);

    expect(progress).toHaveBeenCalledWith('✅ 向量库已最新');
    expect(writeSpy).not.toHaveBeenCalled(); // 无删除不写盘
    expect(writeBinSpy).not.toHaveBeenCalled();
    expect(binary.size).toBe(1); // 仅预种的 .vec，无新增写盘
    expect(vault.files.get(STORE_PATH)).toBe(metaBefore);
  });

  it('refresh：白名单为空且有存量 → 清空全部并落盘；本就为空 → 仅提示不写盘', async () => {
    // 分支一：有存量 → 清空 + saveVectors + saveStore
    const vault = new MockVault();
    vault.files.set('其他/X.md', '白名单外文件');
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 1, chunks: [{ text: 't' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault);
    binary.set(VEC_PATH, vecBuffer([[1, 0]], 2));
    const app = makeApp(vault, adapter, {});
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();
    const progress = vi.fn();
    await vs.refresh(progress);
    expect(progress).toHaveBeenCalledWith('✅ 向量库已清空（白名单为空）');
    expect(vs.meta.notes).toEqual({});
    expect(parseVec(binary).rows).toEqual([]); // .vec 只剩 dim=0 头
    expect(readMeta(vault).notes).toEqual({});

    // 分支二：本来就空 → 只提示
    const vs2 = new VectorStore(app as any);
    await vs2.load();
    const progress2 = vi.fn();
    await vs2.refresh(progress2);
    expect(progress2).toHaveBeenCalledWith('⚠️ 没有符合条件的文件');
  });

  it('refresh：批量接口对某文件失败且逐条回退亦全败 → 该文件条目删除；正常文件照常入库', async () => {
    const vault = new MockVault();
    const A1 = '甲'.repeat(130);
    const A2 = '乙'.repeat(130);
    const G1 = '单块内容也要够长才行啊哈哈。';
    vault.files.set('我的/A.md', `${A1}。${A2}。`);
    vault.files.set('我的/G.md', G1);
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    // 批量接口按文本隔离：G 的批失败（触发逐条回退），A 的批正常（首块带标题前缀）
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => {
      if (texts.some((t) => t.endsWith(G1))) throw new Error('G 批量失败');
      return texts.map((t) => (t === 'A\n' + A1 || t === A1 ? [1, 0] : [0, 0.9]));
    });
    vi.mocked(getEmbedding).mockRejectedValue(new Error('单条也失败')); // G 回退全败

    await vs.refresh();
    const meta = readMeta(vault);
    expect(Object.keys(meta.notes)).toEqual(['我的/A.md']); // 全败文件条目删除
    expect(meta.notes['我的/A.md'].chunks).toEqual([{ text: 'A\n' + A1 }, { text: A2 }]); // 首块带标题（ticket 110）
    expectClose(parseVec(binary).rows, [1, 0, 0, 0.9]);
  });

  it('refresh：批量失败回退逐条成功 → 正常登记两块并落盘（ticket 103 修复口径：回填 fileChunksMap）', async () => {
    const vault = new MockVault();
    const S1 = '甲'.repeat(130);
    const S2 = '乙'.repeat(130);
    vault.files.set('我的/A.md', `${S1}。${S2}。`);
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    // 批量不可用 → 逐条回退全部成功：chunks 与向量数一致，合并写回不越界
    vi.mocked(getEmbeddingsBatch).mockRejectedValue(new Error('批量不可用'));
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
    await expect(vs.refresh()).resolves.toBeUndefined();
    const meta = readMeta(vault);
    expect(meta.notes['我的/A.md'].chunks).toEqual([{ text: 'A\n' + S1 }, { text: S2 }]); // 首块带标题（ticket 110）
    expectClose(parseVec(binary).rows, [1, 0, 1, 0]);
  });

  it('ticket 3 失败计数：部分段落失败 → 不发「✅ 向量化完成」、末条提示失败段数；全部成功才发完成通知', async () => {
    const vault = new MockVault();
    const A1 = '甲'.repeat(130);
    const B1 = '乙'.repeat(130);
    vault.files.set('我的/A.md', `${A1}。`);
    vault.files.set('我的/B.md', `${B1}。`);
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    // B 的批失败且逐条回退亦失败（1 段）；A 正常（1 段）——逐条 catch 内 failed++ 计数
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => {
      if (texts.some((t) => t.includes(B1))) throw new Error('B 批失败');
      return texts.map(() => [1, 0]);
    });
    vi.mocked(getEmbedding).mockRejectedValue(new Error('单条也失败'));

    const progress: string[] = [];
    await vs.refresh((m) => progress.push(m));
    // 登记契约不变：A 入库；B 未登记 → mtime 差异下轮增量重试（断点续传语义未变）
    expect(Object.keys(readMeta(vault).notes)).toEqual(['我的/A.md']);
    expect(progress.some((m) => m.includes('1 段向量化失败，请检查 Ollama 服务'))).toBe(true);
    expect(progress.some((m) => m.startsWith('✅ 向量化完成'))).toBe(false); // 假成功消除

    // 全部成功才发完成通知：B 补齐（A mtime 已登记不变）→ failed=0
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => texts.map(() => [0.5, 0.5]));
    vi.mocked(getEmbedding).mockResolvedValue([0.5, 0.5]);
    const progress2: string[] = [];
    await vs.refresh((m) => progress2.push(m));
    expect(progress2.some((m) => m.startsWith('✅ 向量化完成'))).toBe(true);
    expect(parseVec(binary).rows.length).toBe(4); // A 1 段 + B 1 段，dim=2
  });

  it('[3] 部分失败文件不「部分登记」：失败段不丢，下轮 refresh 整篇重试（新库场景）', async () => {
    const vault = new MockVault();
    const S1 = '甲'.repeat(130);
    const S2 = '乙'.repeat(130);
    vault.files.set('我的/A.md', `${S1}。${S2}。`);
    const { adapter, binary } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    // 第 1 段成功、第 2 段批失败且逐条回退亦失败 → 部分成功但不登记
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => {
      if (texts.some((t) => t.includes(S2))) throw new Error('第二段批失败');
      return texts.map(() => [1, 0]);
    });
    vi.mocked(getEmbedding).mockRejectedValue(new Error('单条也失败'));
    await vs.refresh();
    // 与断点暂存 ckptDoneFiles 同口径：整篇不写 mtime（部分登记会让失败段下轮被 mtime 跳过而永久丢失）
    expect(readMeta(vault).notes).toEqual({});

    // 下轮全部成功 → 整篇重试登记两段（失败段不丢失）
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => texts.map(() => [0.5, 0.5]));
    vi.mocked(getEmbedding).mockResolvedValue([0.5, 0.5]);
    await vs.refresh();
    const meta = readMeta(vault);
    expect(meta.notes['我的/A.md'].chunks).toEqual([{ text: 'A\n' + S1 }, { text: S2 }]);
    expect(parseVec(binary).rows.length).toBe(4); // 2 段 × dim 2
  });

  it('[3] 存量文件重嵌部分失败：保留旧条目与旧向量，下轮按 mtime 差异整篇重试', async () => {
    const vault = new MockVault();
    const S1 = '甲'.repeat(130);
    const S2 = '乙'.repeat(130);
    vault.files.set('我的/A.md', `${S1}。${S2}。`);
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 5, chunks: [{ text: '旧' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault);
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, 2, true);
    const row = new Float32Array([1, 0]);
    const out = new Uint8Array(4 + row.byteLength);
    out.set(header, 0);
    out.set(new Uint8Array(row.buffer, row.byteOffset, row.byteLength), 4);
    binary.set(VEC_PATH, out.buffer);
    const app = makeApp(vault, adapter, { '我的/A.md': 99 }); // mtime 变化 → 重嵌
    setApp(app as any);
    const vs = new VectorStore(app as any);
    await vs.load();

    // 第 1 段成功、第 2 段失败：不覆盖旧条目（mtime 仍是旧值 → 下轮继续重试），旧向量保留
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => {
      if (texts.some((t) => t.includes(S2))) throw new Error('第二段批失败');
      return texts.map(() => [1, 0]);
    });
    vi.mocked(getEmbedding).mockRejectedValue(new Error('单条也失败'));
    await vs.refresh();
    let meta = readMeta(vault);
    expect(meta.notes['我的/A.md']).toEqual({ mtime: 5, chunks: [{ text: '旧' }] }); // 旧条目原样保留
    expect(parseVec(binary).rows).toEqual([1, 0]); // 旧向量未动

    // 下轮全部成功 → 整篇重嵌登记两段
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => texts.map(() => [0.5, 0.5]));
    vi.mocked(getEmbedding).mockResolvedValue([0.5, 0.5]);
    await vs.refresh();
    meta = readMeta(vault);
    expect(meta.notes['我的/A.md'].mtime).toBe(99);
    expect(meta.notes['我的/A.md'].chunks).toEqual([{ text: 'A\n' + S1 }, { text: S2 }]);
    expectClose(parseVec(binary).rows, [0.5, 0.5, 0.5, 0.5]);
  });

  it('断点暂存：A 嵌完落盘，新 store 从磁盘恢复并补嵌 B（ticket 114）', async () => {
    const vault = new MockVault();
    const A1 = '甲'.repeat(130);
    vault.files.set('我的/A.md', `A.md内容${A1}结束。`);
    vault.files.set('我的/B.md', 'B.md内容丙'.repeat(15) + '结束。');
    const { adapter, binary } = makeAdapter(vault);
    const mtimes: Record<string, number> = { '我的/A.md': 1, '我的/B.md': 1 };
    const app = makeApp(vault, adapter, mtimes);
    setApp(app as any);

    const origPolicy = { ...CHECKPOINT_POLICY };
    CHECKPOINT_POLICY.minIntervalMs = 0;
    CHECKPOINT_POLICY.minNewChunks = 1;

    // 第 1 轮：只让 A 嵌入成功（B 的批量失败 → 逐条回退也失败 → B 被丢弃）
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => {
      if (texts.some((t) => t.includes('B.md内容'))) throw new Error('B 模拟全败');
      return texts.map(() => [0.5, 0.5]);
    });
    vi.mocked(getEmbedding).mockRejectedValue(new Error('单条也失败'));

    const store1 = new VectorStore(app as any);
    await store1.load();
    vi.spyOn(Date, 'now').mockReturnValue(0);
    await store1.refresh();

    // A 已写盘，B 被丢弃
    const meta1 = readMeta(vault);
    expect(Object.keys(meta1.notes)).toEqual(['我的/A.md']);
    expect(parseVec(binary).dim).toBe(2);

    // store2 加载 → isIndexReady=true（A），hasPendingChanges=true（B 不在 meta）
    const store2 = new VectorStore(app as any);
    await store2.load();
    expect(store2.isIndexReady()).toBe(true);
    expect(store2.hasPendingChanges()).toBe(true);

    // 第 2 轮：全部成功
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts: string[]) => texts.map(() => [0.5, 0.5]));
    vi.mocked(getEmbedding).mockResolvedValue([0.5, 0.5]);
    vi.spyOn(Date, 'now').mockReturnValue(10000);
    await store2.refresh();

    const finalMeta = readMeta(vault);
    expect(Object.keys(finalMeta.notes).sort()).toEqual(['我的/A.md', '我的/B.md']);
    let expectedTotal = 0;
    for (const n of Object.values(finalMeta.notes)) expectedTotal += (n as any).chunks.length;
    expect(parseVec(binary).rows.length).toBe(expectedTotal * 2);

    vi.mocked(Date.now).mockRestore();
    Object.assign(CHECKPOINT_POLICY, origPolicy);
  });
});

describe('VectorStore（检索链路）', () => {
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

  /** 直接种入两笔记正交向量的现成库（跳过刷新流程） */
  function seedOrthoStore(): { vs: VectorStore; app: any } {
    const app: any = { vault: { getMarkdownFiles: () => [], adapter: {} } };
    const vs = new VectorStore(app);
    vs.meta.notes = {
      'a.md': { mtime: 1, chunks: [{ text: '苹果' }] },
      'b.md': { mtime: 1, chunks: [{ text: '香蕉' }] },
    };
    vs.meta._dim = 2;
    vs.dim = 2;
    vs.vectors = new Float32Array([1, 0, 0, 1]);
    return { vs, app };
  }

  it('vectorSearch：同向得分 1、正交得分 0（cos=max(0,1−d²/2)，反转旧 1−√d/2 失真口径）', async () => {
    const { vs } = seedOrthoStore();
    vi.mocked(getEmbedding).mockResolvedValue([0, 3]); // 未归一化查询向量，方向同 b

    const results = await vs.vectorSearch('香蕉', 5);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ path: 'b.md', chunk: '香蕉' });
    expect(results[0].score).toBe(1); // d²=0 → 1^0.35
    expect(results[1]).toMatchObject({ path: 'a.md', chunk: '苹果' });
    expect(results[1].score).toBe(0); // 归一化正交 d²=2 → max(0,0)=0（旧公式误给 ≈0.29）
  });

  it('vectorSearch：path::chunk 去重与 topK 截断', async () => {
    const app: any = { vault: { getMarkdownFiles: () => [], adapter: {} } };
    const vs = new VectorStore(app);
    vs.meta.notes = {
      'a.md': { mtime: 1, chunks: [{ text: 'X' }, { text: 'X' }] }, // 同文重复块（行 0/1 向量相同）
      'b.md': { mtime: 1, chunks: [{ text: 'Y' }] },
    };
    vs.meta._dim = 2;
    vs.dim = 2;
    vs.vectors = new Float32Array([1, 0, 1, 0, 0, 1]);
    vi.mocked(getEmbedding).mockResolvedValue([0, 1]); // 查询朝向 Y

    const all = await vs.vectorSearch('q', 20);
    expect(all.map((r) => r.path + '::' + r.chunk)).toEqual(['b.md::Y', 'a.md::X']); // 行 0/1 命中去重为一条
    const top1 = await vs.vectorSearch('q', 1);
    expect(top1).toHaveLength(1);
    expect(top1[0].path).toBe('b.md');
  });

  it('VP 索引缓存：键相同且 vectors 引用未变时跳过重建，引用变更后重建', async () => {
    const { vs } = seedOrthoStore();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
      await vs.vectorSearch('q1', 5);
      await vs.vectorSearch('q2', 5);
      const builds = () => logSpy.mock.calls.filter((c) => String(c[0]).includes('VP-Tree built')).length;
      expect(builds()).toBe(1); // 同键同引用 → 复用

      vs.vectors = new Float32Array([1, 0, 0, 1]); // 内容相同但引用已变
      await vs.vectorSearch('q3', 5);
      expect(builds()).toBe(2); // 引用校验触发重建
    } finally {
      logSpy.mockRestore();
    }
  });

  it('searchText 直通 searchTextIndex(query, meta.notes, topK)，返回命中 chunk 原文', () => {
    const vs = new VectorStore({ vault: {} } as any);
    vs.meta.notes['a.md'] = { mtime: 1, chunks: [{ text: '机器学习入门指南' }, { text: '神经网络基础概念' }] };
    const r = vs.searchText('机器学习', 5);
    expect(r).toEqual(searchTextIndex('机器学习', vs.meta.notes, 5));
    expect(r[0].chunk).toBe('机器学习入门指南');
    expect(vs.searchText('', 5)).toEqual([]);
  });

  it('[46] 检索超时：vectorSearch 挂起超过 SEARCH_TIMEOUT_MS → 降级文本并触发 onDegraded（嵌入 30s 不受检索 10s 影响）', async () => {
    vi.useFakeTimers();
    try {
      const { vs } = seedOrthoStore();
      const onDegraded = vi.fn();
      vi.mocked(getEmbedding).mockImplementation(() => new Promise<number[]>(() => {})); // 查询嵌入挂起

      const p = vs.search('苹果', 20, onDegraded);
      await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS + 1); // 跨过 10s 检索级超时
      const results = await p;
      expect(onDegraded).toHaveBeenCalledTimes(1); // 降级信号已触发（参考面板据此给提示）
      expect(results.length).toBeGreaterThan(0); // 文本降级照常出结果
      expect(results[0].chunk).toBe('苹果');
    } finally {
      vi.useRealTimers();
    }
  });
});
