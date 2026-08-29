// @vitest-environment node
/**
 * ADR-0069 核心流测试：R0 钩子上移（behavior 路由驱动共振/在场/计数）/ 存储 sidecar 化迁移
 * （旧 smartcat.json fixture → 新布局，R2 清 observation 留 insight/digest，孤儿向量清理）/
 * R5 落盘防抖 / R1 日小结换源（behaviorStream + behavior-wording 渲染）/ R8 时间席纳入 digest /
 * 引用型记忆 API（upsertNoteMemory / removeMemoryByRef / setRefResolver / WithRefs 格式化）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmbedding } from '../../src/secondbrain/ollama';
import {
  MemorySystem, ruleCredibility, selectSlotMemories, chunkNoteText, NOTE_CHUNK_LIMIT_CHARS,
  migrateSmartcatSidecars, slimSmartCatData,
  getSmartcatMemorySidecarPath, getSmartcatBehaviorSidecarPath,
} from '../../src/smartcat/memory';
import { defaultSmartCatData, getSmartcatFilePath, getSmartcatVecPath, saveSmartCatData } from '../../src/smartcat/data';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import type { SmartCatData, MemoryStreamEntry, BehaviorItem } from '../../src/smartcat/types';

// mock settings-provider（行为流滚动窗口配置 + storagePath；测试可改值）
const mockSettings: Record<string, any> = {
  storagePath: 'CONFIG/STORAGE',
  behaviorMaxDays: 30,
  behaviorMaxCount: 2000,
};
vi.mock('../../src/core/settings-provider', () => ({
  tryGetSettings: () => mockSettings,
}));

// mock 向量模块（upsertNoteMemory 分块向量化；不碰网络）
vi.mock('../../src/secondbrain/ollama', () => ({
  getEmbedding: vi.fn(),
  checkRemoteOllama: vi.fn(async () => true),
  SEARCH_TIMEOUT_MS: 10000,
}));

/** 内存文件 vault（sidecar/迁移测试用；json + 二进制 vec 全支持） */
function makeFakeApp() {
  const files = new Map<string, string>();
  const binaries = new Map<string, Uint8Array>();
  const vault: any = {
    getAbstractFileByPath: (p: string) => (files.has(p) || binaries.has(p) ? { path: p } : null),
    read: async (f: any) => {
      const v = files.get(f.path);
      if (v === undefined) throw new Error('file not found: ' + f.path);
      return v;
    },
    modify: async (f: any, c: string) => { files.set(f.path, c); },
    create: async (p: string, c: string) => { files.set(p, c); return { path: p }; },
    createFolder: async () => {},
    adapter: {
      readBinary: async (p: string) => {
        const b = binaries.get(p);
        if (!b) throw new Error('no binary: ' + p);
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
      },
      writeBinary: async (p: string, buf: ArrayBuffer) => { binaries.set(p, new Uint8Array(buf)); },
    },
  };
  return { app: { vault } as any, files, binaries };
}

/** dim uint32 LE 头 + float32 平铺 → vec 文件字节（测试编码器） */
function encodeVec(dim: number, rows: number[][]): ArrayBuffer {
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, dim, true);
  const payload = new Float32Array(rows.length * dim);
  rows.forEach((r, i) => r.forEach((v, d) => { payload[i * dim + d] = v; }));
  const out = new Uint8Array(4 + payload.byteLength);
  out.set(header, 0);
  out.set(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength), 4);
  return out.buffer as ArrayBuffer;
}

/** vec 字节 → { dim, rows }（测试解码器） */
function decodeVec(buf: ArrayBuffer): { dim: number; rows: number[][] } {
  const arr = new Uint8Array(buf);
  const dim = new DataView(arr.buffer, 0, 4).getUint32(0, true);
  const payload = arr.slice(4);
  const count = Math.floor(payload.byteLength / 4 / dim);
  const f32 = new Float32Array(payload.buffer, payload.byteOffset, count * dim);
  return { dim, rows: Array.from({ length: count }, (_, i) => Array.from(f32.slice(i * dim, (i + 1) * dim))) };
}

let data: SmartCatData;
let saver: ReturnType<typeof vi.fn<(d: SmartCatData) => Promise<void>>>;

function make(opts: { ai?: boolean; app?: any } = {}): MemorySystem {
  data = defaultSmartCatData();
  saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
  resetAIProviderCache();
  if (opts.ai) setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  else setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }));
  const m = new MemorySystem(opts.app ?? ({ vault: { adapter: {} } } as any), () => data, saver);
  (m as any).ollamaAvailable = false;
  return m;
}

beforeEach(() => {
  (globalThis as any).fetch = undefined;
  vi.mocked(getEmbedding).mockReset();
  mockSettings.storagePath = 'CONFIG/STORAGE';
  mockSettings.behaviorMaxDays = 30;
  mockSettings.behaviorMaxCount = 2000;
});

describe('R0 钩子上移（致命项）：behavior 路由同样驱动生命线', () => {
  it('behavior-only 事件触发 onObservation（credibility=ruleCredibility 档位）+ onPresence + pendingSinceReflect++ + touchPresence', async () => {
    const m = make();
    const seen: MemoryStreamEntry[] = [];
    let presenceCount = 0;
    m.onObservation = (mem) => { seen.push(mem); };
    m.onPresence = () => { presenceCount++; };
    const beh = await m.addObservation('memo', { structured: { entityType: 'task', action: 'completed', name: '买菜' } }) as BehaviorItem;
    // 不进记忆流
    expect(data.memory.memoryStream.length).toBe(0);
    expect(data.memory.behaviorStream.length).toBe(1);
    // 共振钩子：伪记忆条目承载，credibility 取 ruleCredibility 档位默认值
    expect(seen.length).toBe(1);
    expect(seen[0].id).toBe(beh.id);
    expect(seen[0].source).toBe('memo');
    expect(seen[0].type).toBe('observation');
    expect(seen[0].credibility).toBe(ruleCredibility('memo', beh.description));
    // 在场 + 计数
    expect(presenceCount).toBe(1);
    expect((m as any).pendingSinceReflect).toBe(1);
    expect(typeof data.editingData.lastPresenceAt).toBe('number');
  });

  it('memory 路由：钩子/计数只触发一次（上移不重复计数），onObservation 带真实记忆条目', async () => {
    const m = make();
    const seen: MemoryStreamEntry[] = [];
    let presenceCount = 0;
    m.onObservation = (mem) => { seen.push(mem); };
    m.onPresence = () => { presenceCount++; };
    const mem = await m.addObservation('用户说：今天很开心', { importance: 0.7, emotion: 'happy', source: 'chat' }) as MemoryStreamEntry;
    expect(data.memory.memoryStream.length).toBe(1);
    expect(seen.length).toBe(1);
    expect(seen[0].id).toBe(mem.id);
    expect(seen[0].credibility).toBe(0.5); // chat 走 routing 档位
    expect(presenceCount).toBe(1);
    expect((m as any).pendingSinceReflect).toBe(1); // 不因双写而 +2
  });
});

describe('R5 落盘防抖：行为流 sidecar 30s tick 合并落盘', () => {
  it('行为路由写入不再每事件 dataSaver（标脏防抖）；flushSidecars 后脏标记清除且 sidecar 落盘', async () => {
    const { app, files } = makeFakeApp();
    const m = make({ app });
    (saver as any).mockClear();
    await m.addObservation('memo', { structured: { entityType: 'task', action: 'completed', name: '买菜' } });
    expect(saver).not.toHaveBeenCalled(); // 行为路由零 dataSaver（R5）
    expect((m as any).behaviorDirty).toBe(true);
    await m.flushSidecars();
    expect((m as any).behaviorDirty).toBe(false);
    const side = JSON.parse(files.get(getSmartcatBehaviorSidecarPath())!);
    expect(side.version).toBe(1);
    expect(side.items.length).toBe(1);
    expect(side.items[0].description).toBe('memo:completed 买菜');
  });

  it('flushSidecars 单边写失败 → 脏标记保留（下轮 tick 重试），不抛错', async () => {
    const m = make(); // app 无 vault 文件能力 → 写失败
    m.markBehaviorDirty();
    await expect(m.flushSidecars()).resolves.toBeUndefined();
    expect((m as any).behaviorDirty).toBe(true);
  });

  it('slimSmartCatData：瘦身视图双流出清、原对象不动', () => {
    const d = defaultSmartCatData();
    d.memory.memoryStream.push({ id: 'x', created: '', lastAccessed: '', description: 'd', importance: 0.5, type: 'observation' });
    d.memory.behaviorStream.push({ id: 'b', timestamp: '', type: 't', source: 's', description: '' });
    const slim = slimSmartCatData(d);
    expect(slim.memory.memoryStream).toHaveLength(0);
    expect(slim.memory.behaviorStream).toHaveLength(0);
    expect(d.memory.memoryStream).toHaveLength(1); // 原对象不动
    expect(slim.config).toBe(d.config);
  });
});

describe('存储 sidecar 化：升级迁移（旧 smartcat.json → 新布局）', () => {
  function oldFormatData(): SmartCatData {
    const d = defaultSmartCatData();
    d.memory.memoryStream.push(
      { id: 'obs_1', created: '2026-08-01T00:00:00.000Z', lastAccessed: '2026-08-01T00:00:00.000Z', description: '事件观察', importance: 0.6, type: 'observation' },
      { id: 'obs_2', created: '2026-08-02T00:00:00.000Z', lastAccessed: '2026-08-02T00:00:00.000Z', description: '事件观察二', importance: 0.6, type: 'observation' },
      { id: 'insight_1', created: '2026-08-03T00:00:00.000Z', lastAccessed: '2026-08-03T00:00:00.000Z', description: '洞察保留', importance: 0.75, type: 'insight', source: 'reflection', evidenceIds: ['obs_1'] },
    );
    d.memory.behaviorStream.push(
      { id: 'beh_1', timestamp: '2026-08-01T01:00:00.000Z', type: 'completed', source: 'memo', description: 'memo:completed 买菜' },
    );
    return d;
  }

  it('旧格式 fixture 进 → 新布局出：observation 清空（R2）、insight 保留、行为流迁出、smartcat.json 瘦身', async () => {
    const { app, files, binaries } = makeFakeApp();
    const data = oldFormatData();
    // 旧向量文件：3 行（obs_1=0, obs_2=1, insight_1=2），dim=2
    binaries.set(getSmartcatVecPath(), new Uint8Array(encodeVec(2, [[1, 0], [0, 1], [1, 1]])));
    files.set(getSmartcatFilePath(), JSON.stringify(data));

    await migrateSmartcatSidecars(app, data);

    // 记忆 sidecar：observation 清空、insight 保留
    const memSide = JSON.parse(files.get(getSmartcatMemorySidecarPath())!);
    expect(memSide.version).toBe(1);
    expect(memSide.entries.map((e: MemoryStreamEntry) => e.id)).toEqual(['insight_1']);
    // 行为 sidecar：全量迁出
    const behSide = JSON.parse(files.get(getSmartcatBehaviorSidecarPath())!);
    expect(behSide.items.map((b: BehaviorItem) => b.id)).toEqual(['beh_1']);
    // 内存对象原位替换
    expect(data.memory.memoryStream.map((e) => e.id)).toEqual(['insight_1']);
    expect(data.memory.behaviorStream.map((b) => b.id)).toEqual(['beh_1']);
    // smartcat.json 瘦身重写（meta/config 留、双流出清）
    const rewritten = JSON.parse(files.get(getSmartcatFilePath())!);
    expect(rewritten.memory.memoryStream).toHaveLength(0);
    expect(rewritten.memory.behaviorStream).toHaveLength(0);
    expect(rewritten.memory.reflection).toBeDefined();
    expect(rewritten.config).toBeDefined();
    // 孤儿向量清理：只剩 insight 主行（重排到新下标 0），observation 行丢弃
    const vec = decodeVec(new Uint8Array(binaries.get(getSmartcatVecPath())!).buffer as ArrayBuffer);
    expect(vec.rows.length).toBe(1);
    expect(vec.rows[0]).toEqual([1, 1]);
  });

  it('止血（用户拍板 2026-08-29）：首次迁移向量清理产物与现盘字节一致 → 跳过 writeBinary', async () => {
    const { app, files, binaries } = makeFakeApp();
    const data = oldFormatData();
    // 只留一条 insight（下标 0），旧 vec 已与其对齐（1 行 [1,1]）→ 清理产物 == 现盘字节
    data.memory.memoryStream = data.memory.memoryStream.filter((e) => e.id === 'insight_1');
    files.set(getSmartcatFilePath(), JSON.stringify(data));
    binaries.set(getSmartcatVecPath(), new Uint8Array(encodeVec(2, [[1, 1]])));
    let binaryWrites = 0;
    const adapter = app.vault.adapter as any;
    const origWriteBinary = adapter.writeBinary.bind(adapter);
    adapter.writeBinary = async (p: string, buf: ArrayBuffer) => { binaryWrites++; return origWriteBinary(p, buf); };

    await migrateSmartcatSidecars(app, data);

    expect(binaryWrites).toBe(0); // 清理产物与现盘一致 → 不写
    expect(data.memory.memoryStream.map((e) => e.id)).toEqual(['insight_1']);
  });

  it('幂等：sidecar 已在 → 采纳 sidecar 条目，不重复迁移不清数据', async () => {
    const { app, files } = makeFakeApp();
    const data = oldFormatData();
    await migrateSmartcatSidecars(app, data);
    // 第二次跑（模拟重启）：内存对象被 normalizeData 复原成旧布局也不影响——sidecar 为准
    const data2 = oldFormatData();
    await migrateSmartcatSidecars(app, data2);
    expect(data2.memory.memoryStream.map((e) => e.id)).toEqual(['insight_1']);
    expect(data2.memory.behaviorStream.map((b) => b.id)).toEqual(['beh_1']);
    const memSide = JSON.parse(files.get(getSmartcatMemorySidecarPath())!);
    expect(memSide.entries).toHaveLength(1);
  });

  it('sidecar 坏 JSON → 抛错中止 + 备份 .bak；二次迁移旧 .bak 被替换不抛 create 冲突', async () => {
    const { app, files } = makeFakeApp();
    files.set(getSmartcatMemorySidecarPath(), '{broken json');
    const data = defaultSmartCatData();
    await expect(migrateSmartcatSidecars(app, data)).rejects.toThrow(/损坏/);
    expect(files.get(getSmartcatMemorySidecarPath() + '.bak')).toBe('{broken json');
    // smartcat.json 未被瘦身（保留现场）
    // 再次迁移：.bak 先删后建，不因已存在抛 create 冲突
    await expect(migrateSmartcatSidecars(app, defaultSmartCatData())).rejects.toThrow(/损坏/);
    expect(files.get(getSmartcatMemorySidecarPath() + '.bak')).toBe('{broken json');
  });

  it('全新安装（无旧数据无 sidecar）→ 迁移产出空 sidecar，不抛错', async () => {
    const { app, files } = makeFakeApp();
    const data = defaultSmartCatData();
    await migrateSmartcatSidecars(app, data);
    expect(JSON.parse(files.get(getSmartcatMemorySidecarPath())!).entries).toHaveLength(0);
    expect(JSON.parse(files.get(getSmartcatBehaviorSidecarPath())!).items).toHaveLength(0);
    expect(files.has(getSmartcatFilePath())).toBe(true);
  });

  it('止血（用户拍板 2026-08-29）：sidecar 已在的 adopt 轮零写盘——sidecar 不重写、smartcat.json 内容没变不落盘、lastUpdated 不刷新', async () => {
    const { app, files } = makeFakeApp();
    await migrateSmartcatSidecars(app, oldFormatData()); // 首次迁移：三份文件落盘
    const before = files.get(getSmartcatFilePath())!;
    // 记录后续写盘调用
    const writes: string[] = [];
    const v = app.vault as any;
    const origModify = v.modify.bind(v);
    v.modify = async (f: any, c: string) => { writes.push(f.path); return origModify(f, c); };
    const origCreate = v.create.bind(v);
    v.create = async (p: string, c: string) => { writes.push(p); return origCreate(p, c); };
    // 重启场景：内存数据 = 盘上瘦身视图（loadSmartCatData 产物），sidecar 双双已在
    const data2 = JSON.parse(before) as SmartCatData;
    await migrateSmartcatSidecars(app, data2);
    expect(writes).toEqual([]); // 三份文件一个都没动（旧实现每轮刷 mtime 制造同步冲突）
    expect(files.get(getSmartcatFilePath())!).toBe(before);
    expect(data2.memory.lastUpdated).toBe(JSON.parse(before).memory.lastUpdated);
  });
});

describe('saveSmartCatData 写前比对（Syncthing 冲突止血，用户拍板 2026-08-29）', () => {
  it('内容没变 → 不落盘；内容变了 → 照写', async () => {
    const { app, files } = makeFakeApp();
    const d = defaultSmartCatData();
    await saveSmartCatData(app, d); // 首次 create
    expect(files.has(getSmartcatFilePath())).toBe(true);
    const writes: string[] = [];
    const v = app.vault as any;
    const origModify = v.modify.bind(v);
    v.modify = async (f: any, c: string) => { writes.push(f.path); return origModify(f, c); };
    // 同内容（序列化等价的对象）再存 → 跳过写
    await saveSmartCatData(app, JSON.parse(JSON.stringify(d)) as SmartCatData);
    expect(writes).toEqual([]);
    // 内容变化 → modify 落盘
    d.editingData = { lastPresenceAt: 123 };
    await saveSmartCatData(app, d);
    expect(writes).toEqual([getSmartcatFilePath()]);
  });
});

describe('R1 日小结换源：原料/触发计数从 behaviorStream，evidenceIds 指向行为条目', () => {
  it('行为条目驱动触发与产出：prompt 含 behavior-wording 人类文案，evidenceIds = 行为条目 id', async () => {
    const m = make({ ai: true });
    data.memory.reflection.lastDigestAt = Date.now() - 20 * 60 * 60 * 1000;
    data.memory.reflection.digestCount = 1;
    const behs: BehaviorItem[] = [];
    for (const name of ['买菜', '跑步', '读书']) {
      const b = await m.addObservation('memo', { structured: { entityType: 'task', action: 'completed', name } }) as BehaviorItem;
      behs.push(b);
    }
    expect(data.memory.memoryStream.length).toBe(0); // 事件不进记忆流
    expect((m as any).shouldDigest(Date.now())).toBe(true);
    const fetchMock = vi.fn(async (url: string, init?: any) => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ digests: [{ text: '一天过得充实', evidence: [1, 2] }] }) } }],
      }),
    }));
    (globalThis as any).fetch = fetchMock;
    await m.digest();
    const digests = data.memory.memoryStream.filter((x) => x.type === 'insight' && x.source === 'digest');
    expect(digests.length).toBe(1);
    // evidenceIds 指向行为条目 id（R1）
    expect(digests[0].evidenceIds).toEqual([behs[0].id, behs[1].id]);
    // 喂 LLM 前机读 description 经 behavior-wording 渲染成人类文案
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    const prompt = body.messages[1].content as string;
    expect(prompt).toContain('你完成了备忘录「买菜」');
    expect(prompt).not.toContain('memo:completed 买菜');
    expect(data.memory.reflection.lastDigestAt).toBeGreaterThan(0);
  });

  it('无新增行为条目 → 不触发（计数换源自 behaviorStream）', async () => {
    const m = make({ ai: true });
    data.memory.reflection.lastDigestAt = Date.now() - 20 * 60 * 60 * 1000;
    data.memory.reflection.digestCount = 1;
    expect((m as any).shouldDigest(Date.now())).toBe(false);
    // 直接往记忆流塞 observation 不再驱动日小结（换源语义）
    data.memory.memoryStream.push({ id: 'o', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '旧式观察', importance: 0.8, type: 'observation' });
    expect((m as any).shouldDigest(Date.now())).toBe(false);
  });
});

describe('R8 时间席候选纳入 digest 条目', () => {
  it('digest 条目（insight + source=digest）命中星期几锚点 → 进槽位选择结果', () => {
    const now = Date.now();
    const weekAgoSameWeekday = new Date(now - 7 * 86400000).toISOString();
    const pool: MemoryStreamEntry[] = Array.from({ length: 6 }, (_, i) => ({
      id: `o${i}`, created: new Date(now - i * 1000).toISOString(), lastAccessed: new Date(now).toISOString(),
      description: `普通观察${i}`, importance: 0.5, type: 'observation',
    }));
    const digest: MemoryStreamEntry = {
      id: 'd1', created: weekAgoSameWeekday, lastAccessed: weekAgoSameWeekday,
      description: '【今日小结】上周 today', importance: 0.7, type: 'insight', source: 'digest',
    };
    pool.push(digest); // 7 条 > maxEntries 6，槽位收缩启动
    const picked = selectSlotMemories(pool, { maxEntries: 6, now });
    expect(picked).toContain(digest);
    // 普通 insight（非 digest）不进时间席（情绪席只认 observation 的既有口径不动）
    const plainInsight: MemoryStreamEntry = { ...digest, id: 'i9', source: 'reflection', created: weekAgoSameWeekday };
    const pool2 = [...pool.filter((x) => x.id !== 'd1'), plainInsight];
    const picked2 = selectSlotMemories(pool2, { maxEntries: 6, now });
    expect(picked2).not.toContain(plainInsight);
  });
});

describe('引用型记忆 API（记忆目录流调用契约）', () => {
  it('upsertNoteMemory：description 存引用、created/lastAccessed 用 seed.created（R7）、importance 走打分链、向量主行登记', async () => {
    const { app } = makeFakeApp();
    const m = make({ app });
    (m as any).ollamaAvailable = true;
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
    await m.upsertNoteMemory({ refPath: '笔记/A.md', fullText: '这是笔记全文内容', created: '2024-01-02T00:00:00.000Z', source: 'note' });
    expect(data.memory.memoryStream.length).toBe(1);
    const e = data.memory.memoryStream[0];
    expect(e.description).toBe('笔记/A.md');
    expect(e.ref).toEqual({ path: '笔记/A.md' });
    expect(e.created).toBe('2024-01-02T00:00:00.000Z');
    expect(e.lastAccessed).toBe('2024-01-02T00:00:00.000Z'); // R7：lastAccessed 缺省 = created
    expect(e.importance).toBeGreaterThan(0);
    expect(e.type).toBe('observation');
    expect((m as any).vectorIndexMap.get(e.id)).toBe(0);
  });

  it('超长全文分块：一条目挂多向量（主行 + 额外行），检索取各行余弦最大值；重复入库 = 更新不重复建', async () => {
    const { app } = makeFakeApp();
    const m = make({ app });
    (m as any).ollamaAvailable = true;
    vi.mocked(getEmbedding).mockResolvedValue([0, 1]);
    mockSettings.smartcatChunkLimitChars = NOTE_CHUNK_LIMIT_CHARS; // 固定 6000 上限（运行时默认 800，见分块设置）
    const longText = '# 段一\n' + '甲'.repeat(NOTE_CHUNK_LIMIT_CHARS) + '\n# 段二\n' + '乙'.repeat(NOTE_CHUNK_LIMIT_CHARS);
    await m.upsertNoteMemory({ refPath: '笔记/长文.md', fullText: longText });
    const e = data.memory.memoryStream[0];
    const extras = (m as any).vectorExtraRows as Map<string, number[]>;
    expect(extras.get(e.id)!.length).toBe(3); // 4 块（两段各超限硬切）→ 主行 + 3 额外行
    expect((m as any).vectors.length).toBe(4 * (m as any).dim); // 1 主行(下标0) + 3 额外行
    expect(m.semanticRelevance(e.id, [0, 1])).toBeCloseTo(1, 5);
    // 更新：同引用再入库 → 不新建条目
    await m.upsertNoteMemory({ refPath: '笔记/长文.md', fullText: '新全文' });
    expect(data.memory.memoryStream.length).toBe(1);
    expect(data.memory.memoryStream[0].id).toBe(e.id);
  });

  it('removeMemoryByRef：删条目 + 全部向量（整库紧凑重排），返回删除数', async () => {
    const { app } = makeFakeApp();
    const m = make({ app });
    (m as any).ollamaAvailable = true;
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
    await m.upsertNoteMemory({ refPath: '笔记/A.md', fullText: 'A 全文' });
    await m.upsertNoteMemory({ refPath: '笔记/B.md', fullText: 'B 全文' });
    expect(data.memory.memoryStream.length).toBe(2);
    const removed = await m.removeMemoryByRef('笔记/A.md');
    expect(removed).toBe(1);
    expect(data.memory.memoryStream.map((e) => e.description)).toEqual(['笔记/B.md']);
    // B 的主行平移到新下标 0
    const b = data.memory.memoryStream[0];
    expect((m as any).vectorIndexMap.get(b.id)).toBe(0);
    // 再删不存在的引用 → 0
    expect(await m.removeMemoryByRef('笔记/不存在.md')).toBe(0);
  });

  it('formatMemoriesForPromptWithRefs：命中引用经读取器取正文；null = 失效标记（staleRefs，不崩）', async () => {
    const m = make();
    const alive: MemoryStreamEntry = {
      id: 'r1', created: '2024-01-02T00:00:00.000Z', lastAccessed: '2024-01-02T00:00:00.000Z',
      description: '笔记/A.md', importance: 0.6, type: 'observation', source: 'note', ref: { path: '笔记/A.md' },
    };
    const stale: MemoryStreamEntry = {
      id: 'r2', created: '2024-01-02T00:00:00.000Z', lastAccessed: '2024-01-02T00:00:00.000Z',
      description: '笔记/已删.md', importance: 0.6, type: 'observation', source: 'note', ref: { path: '笔记/已删.md' },
    };
    m.setRefResolver(async (ref) => (ref === '笔记/A.md' ? '这是 A 的正文内容' : null));
    const { text, staleRefs } = await m.formatMemoriesForPromptWithRefs([alive, stale]);
    expect(text).toContain('这是 A 的正文内容');
    expect(staleRefs.map((x) => x.id)).toEqual(['r2']); // 失效标记：调用方安排清理
    // 读取器抛错同按失效处理（只保证不崩）
    m.setRefResolver(async () => { throw new Error('boom'); });
    const r2 = await m.formatMemoriesForPromptWithRefs([alive]);
    expect(r2.staleRefs.map((x) => x.id)).toEqual(['r1']);
    // 未注入读取器 → 回显引用路径
    const m2 = make();
    const r3 = await m2.formatMemoriesForPromptWithRefs([alive]);
    expect(r3.text).toContain('笔记/A.md');
    expect(r3.staleRefs).toHaveLength(0);
  });
});

describe('chunkNoteText 分块（R3：不静默截断）', () => {
  it('短文单块；超限按标题切块、单段超限硬切，全文覆盖不丢字', () => {
    expect(chunkNoteText('')).toEqual([]);
    expect(chunkNoteText('短文')).toEqual(['短文']);
    const long = '# 甲\n' + 'x'.repeat(NOTE_CHUNK_LIMIT_CHARS + 10) + '\n# 乙\n短段';
    const chunks = chunkNoteText(long);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(NOTE_CHUNK_LIMIT_CHARS);
    // 全文覆盖（不静默截断）：去标题行拼接后长度不小于原正文
    const joined = chunks.join('');
    expect(joined.length).toBeGreaterThanOrEqual(long.replace(/^# /gm, '').length - 10);
  });
});

describe('upsertNoteMemory 内容哈希跳过（重启全量扫描零 AI 调用）', () => {
  it('同内容重复入库：不重调打分链、不重嵌入、不重复建条；内容变化才重打分并更新哈希', async () => {
    const { app } = makeFakeApp();
    const m = make({ app });
    (m as any).ollamaAvailable = true;
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
    const seed = { refPath: '日记/2026-08-29.md', locator: '09:30', fullText: '早上一杯咖啡，状态不错', created: '2026-08-29T09:30:00' };
    await m.upsertNoteMemory(seed);
    expect(data.memory.memoryStream.length).toBe(1);
    expect(data.memory.memoryStream[0].contentHash).toBeTruthy();
    const embeddingCallsAfterFirst = vi.mocked(getEmbedding).mock.calls.length;
    // 重启场景：同内容再次全量扫描 → 直接跳过（向量调用数不变）
    await m.upsertNoteMemory(seed);
    expect(data.memory.memoryStream.length).toBe(1);
    expect(vi.mocked(getEmbedding).mock.calls.length).toBe(embeddingCallsAfterFirst);
    // 内容变化 → 走更新：重嵌入、哈希刷新
    await m.upsertNoteMemory({ ...seed, fullText: '晚上改了主意，喝了茶' });
    expect(data.memory.memoryStream.length).toBe(1);
    expect(vi.mocked(getEmbedding).mock.calls.length).toBeGreaterThan(embeddingCallsAfterFirst);
    expect(data.memory.memoryStream[0].contentHash).toBeTruthy();
  });

  it('diarySeeds 式 refPath 自带 #定位符：描述不再双 #（path#t#t），ref.path 存纯路径；旧脏条目命中去重并自愈', async () => {
    const { app } = makeFakeApp();
    const m = make({ app });
    (m as any).ollamaAvailable = true;
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
    // diarySeeds 实际产出：refPath = 路径#时间，locator 又单传一份
    const seed = { refPath: '日记/2026-08-29.md#09:30', locator: '09:30', fullText: '早上一杯咖啡，状态不错', created: '2026-08-29T09:30:00' };
    await m.upsertNoteMemory(seed);
    const e = data.memory.memoryStream[0];
    expect(e.ref!.path).toBe('日记/2026-08-29.md'); // 纯路径（refResolver/removeMemoryByRef 切分正确）
    expect(e.description).toBe('日记/2026-08-29.md#09:30'); // 单 #（不再 path#09:30#09:30）
    // 旧 sidecar 遗留脏条目（ref.path 带 #时间 尾巴）：同内容命中去重（不重打分重建），ref 自愈为纯路径
    const dirty = data.memory.memoryStream[0];
    dirty.ref = { path: '日记/2026-08-29.md#09:30', locator: '09:30' };
    dirty.description = '日记/2026-08-29.md#09:30#09:30'; // 双 # 描述（旧版写入）
    const embeddingsBefore = vi.mocked(getEmbedding).mock.calls.length;
    await m.upsertNoteMemory(seed);
    expect(data.memory.memoryStream.length).toBe(1);
    expect(data.memory.memoryStream[0].ref!.path).toBe('日记/2026-08-29.md');
    expect(data.memory.memoryStream[0].description).toBe('日记/2026-08-29.md#09:30'); // 描述同步自愈（单 #）
    expect(vi.mocked(getEmbedding).mock.calls.length).toBe(embeddingsBefore);
  });
});
