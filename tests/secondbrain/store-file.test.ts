// @vitest-environment node
/**
 * store-file 单文件数据层测试（ticket 120）：
 * - 一次性迁移：四旧 JSON 合并组装 secondbrain.json、旧文件删除、旧 vec 改名 secondbrain.vec、幂等跳过；
 * - 空库不落盘（无旧文件 → loadStore 不产生文件，refresh 首建语义）；
 * - 段结构校验（queue 非数组/state 非对象/panel 缺失容错）+ 整文件损坏留档重建；
 * - 串行写链：并发 mutateStore（meta + link 同时写）不互相覆盖丢失；
 * - 与 link-agent/data 的 queue/state 段打通（loadLinkState/loadQueue 经 store 读写）。
 * - Syncthing 冲突自愈（ticket 152）：*.sync-conflict-* 段级 union 合并回主文件、.vec 行级重排、
 *   冲突文件删除、损坏冲突 JSON 保留、无冲突零行为。
 * 经 MockVault adapter（含 exists/remove/rename + adapter 级 readBinary/writeBinary），纯 node 环境。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import {
  getSecondBrainStorePath,
  getSecondBrainVecPath,
  loadStore,
  mutateStore,
  loadChatHistory,
  appendChatHistory,
  clearChatHistory,
  mergeStoreWithConflict,
} from '../../src/secondbrain/store-file';
import { loadQueue, enqueuePaths, dequeuePath, loadLinkState, upsertLinkState } from '../../src/secondbrain/link-agent/data';

const OLD_META = 'CONFIG/STORAGE/secondbrain_meta.json';
const OLD_PANEL = 'CONFIG/STORAGE/secondbrain_panel.json';
const OLD_QUEUE = 'CONFIG/STORAGE/secondbrain_link_queue.json';
const OLD_STATE = 'CONFIG/STORAGE/secondbrain_link_state.json';
const OLD_VEC = 'CONFIG/STORAGE/secondbrain_vectors.vec';
const STORE = () => getSecondBrainStorePath();
const VEC = () => getSecondBrainVecPath();
const CONFLICT_JSON = 'CONFIG/STORAGE/secondbrain.sync-conflict-20260830-041211-6M2OGGC.json';
const CONFLICT_VEC = 'CONFIG/STORAGE/secondbrain.sync-conflict-20260830-041207-6M2OGGC.vec';

/** 构造 .vec 字节：dim 头(uint32 LE) + 按行序提供的各 path 向量行（每行 dim 个 float） */
function makeVec(dim: number, rows: number[][]): Uint8Array {
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, dim, true);
  const flat = new Float32Array(rows.length * dim);
  rows.forEach((row, r) => row.forEach((v, c) => (flat[r * dim + c] = v)));
  const payload = new Uint8Array(flat.buffer, flat.byteOffset, flat.byteLength);
  const out = new Uint8Array(4 + payload.byteLength);
  out.set(header, 0);
  out.set(payload, 4);
  return out;
}

/** 由 meta 构造 .vec（行序 = notes 键序 × chunks 数；每行值 = path 序号+行内序号） */
function vecFromMeta(meta: any, dim = 2): Uint8Array {
  const rows: number[][] = [];
  let idx = 0;
  for (const [path, note] of Object.entries(meta?.notes || {})) {
    const chunks = (note as any).chunks || [];
    for (let c = 0; c < chunks.length; c++) rows.push([idx + 100, c]);
    idx++;
  }
  return makeVec(dim, rows);
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, storagePath: 'CONFIG/STORAGE', ...overrides }) as any);
  return { vault, app };
}

describe('store-file 一次性迁移（ticket 120）', () => {
  beforeEach(() => {
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as any);
  });

  it('四旧 JSON 合并组装 secondbrain.json：meta/panel/link 三段齐备', async () => {
    const { vault } = makeEnv();
    vault.files.set(OLD_META, JSON.stringify({ version: 9, notes: { 'a.md': { mtime: 1, chunks: [{ text: 't' }] } }, _dim: 2 }));
    vault.files.set(OLD_PANEL, JSON.stringify({ summary: '概括', generatedAt: 123 }));
    vault.files.set(OLD_QUEUE, JSON.stringify([{ path: '文献盒/q.md', hash: 'h', queuedAt: 't' }]));
    vault.files.set(OLD_STATE, JSON.stringify({ '文献盒/s.md': { hash: 'h2', linkedAt: 't2' } }));

    const store = await loadStore();
    expect(vault.files.has(getSecondBrainStorePath())).toBe(true); // 迁移落盘
    expect((store.meta as any).version).toBe(9);
    expect((store.meta as any).notes['a.md'].chunks).toEqual([{ text: 't' }]);
    expect(store.panel).toEqual({ summary: '概括', generatedAt: 123 });
    expect(store.link.queue).toEqual([{ path: '文献盒/q.md', hash: 'h', queuedAt: 't' }]);
    expect(store.link.state['文献盒/s.md']).toEqual({ hash: 'h2', linkedAt: 't2' });

    // 旧文件全部删除
    expect(vault.files.has(OLD_META)).toBe(false);
    expect(vault.files.has(OLD_PANEL)).toBe(false);
    expect(vault.files.has(OLD_QUEUE)).toBe(false);
    expect(vault.files.has(OLD_STATE)).toBe(false);
  });

  it('旧 vec 改名 secondbrain.vec：二进制内容等价迁移（rename 路径）', async () => {
    const { vault } = makeEnv();
    const buf = new Uint8Array([0, 1, 2, 3, 9, 9]);
    vault.binaryFiles.set(OLD_VEC, buf);
    vault.files.set(OLD_META, JSON.stringify({ version: 9, notes: {}, _dim: 1 })); // 触发迁移

    await loadStore();
    expect(vault.binaryFiles.has(getSecondBrainVecPath())).toBe(true);
    expect(vault.binaryFiles.has(OLD_VEC)).toBe(false); // 旧文件清除
    expect(Array.from(vault.binaryFiles.get(getSecondBrainVecPath())!)).toEqual([0, 1, 2, 3, 9, 9]);
  });

  it('幂等：secondbrain.json 已存在时跳过迁移，旧文件即使残留也不再读', async () => {
    const { vault } = makeEnv();
    vault.files.set(getSecondBrainStorePath(), JSON.stringify({ version: 1, meta: null, panel: null, link: { queue: [], state: {} } }));
    vault.files.set(OLD_META, JSON.stringify({ version: 9, notes: { '残留.md': { mtime: 1, chunks: [{ text: 'x' }] } }, _dim: 2 }));

    const store = await loadStore();
    expect(store.meta).toEqual({}); // 未读取残留旧文件
    expect(vault.files.has(OLD_META)).toBe(true); // 残留保留不删（新文件已是权威）
  });

  it('无旧文件：返回空结构且不落盘（保持「空库不产生文件」语义）', async () => {
    const { vault } = makeEnv();
    const store = await loadStore();
    expect(store).toEqual({ version: 1, meta: null, panel: null, link: { queue: [], state: {} }, chatHistory: [] });
    expect(vault.files.has(getSecondBrainStorePath())).toBe(false);
  });
});

describe('store-file 段校验与损坏容错', () => {
  it('缺 meta / panel / link / chatHistory 段 → 段默认值（partial 文件不崩）', async () => {
    const { vault } = makeEnv();
    vault.files.set(getSecondBrainStorePath(), JSON.stringify({ version: 1 }));
    const store = await loadStore();
    expect(store.meta).toEqual({});
    expect(store.panel).toBeNull();
    expect(store.link).toEqual({ queue: [], state: {} });
    expect(store.chatHistory).toEqual([]); // ticket 141 加法扩展：旧文件缺段 → 空，零迁移
  });

  it('queue 非数组 / state 非对象 → 分别归一为空（容忍旧写错）', async () => {
    const { vault } = makeEnv();
    vault.files.set(
      getSecondBrainStorePath(),
      JSON.stringify({ version: 1, meta: null, panel: null, link: { queue: 'bad', state: [1, 2] } })
    );
    const store = await loadStore();
    expect(store.link.queue).toEqual([]);
    expect(store.link.state).toEqual({});
  });

  it('整文件损坏 → 改名留档 .corrupt- 重建空结构（jsonStore 同款容错）', async () => {
    const { vault } = makeEnv();
    vault.files.set(getSecondBrainStorePath(), 'not-json{{{');
    const store = await loadStore();
    expect(store.link.queue).toEqual([]);
    const corrupt = [...vault.files.keys()].find((p) => p.startsWith(getSecondBrainStorePath() + '.corrupt-'));
    expect(corrupt).toBeTruthy(); // 原文件留档
  });
});

describe('store-file 串行写链（防并发覆盖）', () => {
  it('并发 mutateStore：meta 与 link 同时写，两段都保留（不互相覆盖）', async () => {
    const { vault } = makeEnv();
    vault.files.set(OLD_META, JSON.stringify({ version: 9, notes: {}, _dim: 2 })); // 迁移建库

    await loadStore(); // 完成迁移，之后并发写
    // meta 写 50 轮 + link 写 50 轮交错并发
    const metaWrites = Array.from({ length: 50 }, (_, i) =>
      mutateStore((s) => {
        ((s.meta as any).notes ??= {})['n' + i] = { mtime: i, chunks: [{ text: 't' + i }] };
      })
    );
    const linkWrites = Array.from({ length: 50 }, (_, i) =>
      mutateStore((s) => {
        if (!s.link.queue.some((q) => q.path === 'q' + i)) s.link.queue.push({ path: 'q' + i, queuedAt: 't' });
      })
    );
    await Promise.all([...metaWrites, ...linkWrites]);

    const store = await loadStore();
    expect(Object.keys((store.meta as any).notes)).toHaveLength(50); // meta 50 条无丢失
    expect(store.link.queue).toHaveLength(50); // link 50 条无丢失
  });

  it('经 link-agent/data 打通：enqueuePaths 与 upsertLinkState 写入 store 段，读回一致', async () => {
    const { vault } = makeEnv();
    await enqueuePaths(['文献盒/a.md'], { '文献盒/a.md': 'h1' });
    await upsertLinkState('文献盒/b.md', 'h2');

    expect((await loadQueue()).map((i) => i.path)).toEqual(['文献盒/a.md']);
    expect((await loadLinkState())['文献盒/b.md'].hash).toBe('h2');
    // 两段同文件共存
    const store = await loadStore();
    expect(store.link.queue[0].path).toBe('文献盒/a.md');
    expect(store.link.state['文献盒/b.md'].hash).toBe('h2');

    await dequeuePath('文献盒/a.md');
    expect(await loadQueue()).toEqual([]);
  });

  it('止血（用户拍板 2026-08-29）：mutateStore 无实质变更 → 写前比对跳过落盘（不刷 mtime）', async () => {
    const { vault } = makeEnv();
    await mutateStore((s) => { s.meta = { hello: 1 }; }); // 首写建库
    expect(vault.files.has(getSecondBrainStorePath())).toBe(true);
    const before = vault.files.get(getSecondBrainStorePath())!;
    vault.modifiedPaths.length = 0;
    // no-op 变更（含 read→normalize→stringify 往返等价）→ 不写
    await mutateStore(() => {});
    expect(vault.modifiedPaths).toEqual([]);
    expect(vault.files.get(getSecondBrainStorePath())).toBe(before);
    // 实质变更 → 照写
    await mutateStore((s) => { (s.meta as any).world = 2; });
    expect(vault.modifiedPaths).toEqual([getSecondBrainStorePath()]);
    expect((await loadStore()).meta).toEqual({ hello: 1, world: 2 });
  });
});

describe('store-file chatHistory 段（ticket 141 加法扩展）', () => {
  it('旧数据无段 → loadChatHistory 返回空数组（零迁移），写盘后带 chatHistory 段', async () => {
    const { vault } = makeEnv();
    vault.files.set(
      getSecondBrainStorePath(),
      JSON.stringify({ version: 1, meta: { notes: {} }, panel: null, link: { queue: [], state: {} } })
    );
    expect(await loadChatHistory()).toEqual([]);
    await appendChatHistory({ role: 'user', content: 'q1' });
    const raw = JSON.parse(vault.files.get(getSecondBrainStorePath())!);
    expect(raw.meta).toEqual({ notes: {} }); // 旧段原样保留
    expect(raw.chatHistory).toEqual([{ role: 'user', content: 'q1' }]);
  });

  it('appendChatHistory 逐条/批量追加，读回顺序一致', async () => {
    const { vault } = makeEnv();
    await appendChatHistory({ role: 'user', content: 'q1' });
    await appendChatHistory([
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ]);
    expect(await loadChatHistory()).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ]);
    expect(vault.files.has(getSecondBrainStorePath())).toBe(true); // 每轮写盘
  });

  it('上限 100 条：超出截断最旧', async () => {
    makeEnv();
    for (let i = 0; i < 120; i++) {
      await appendChatHistory({ role: 'user', content: '问题' + i });
    }
    const hist = await loadChatHistory();
    expect(hist).toHaveLength(100);
    expect(hist[0].content).toBe('问题20'); // 最旧 20 条被截断
    expect(hist[99].content).toBe('问题119');
  });

  it('clearChatHistory 清空并写盘（写盘断言）', async () => {
    const { vault } = makeEnv();
    await appendChatHistory({ role: 'user', content: 'q' });
    expect((await loadChatHistory()).length).toBe(1);
    await clearChatHistory();
    expect(await loadChatHistory()).toEqual([]);
    expect(JSON.parse(vault.files.get(getSecondBrainStorePath())!).chatHistory).toEqual([]);
  });

  it('段校验：chatHistory 非数组 → []；role/content 不合法条目剔除', async () => {
    const { vault } = makeEnv();
    vault.files.set(getSecondBrainStorePath(), JSON.stringify({ version: 1, chatHistory: 'bad' }));
    expect(await loadChatHistory()).toEqual([]);

    vault.files.set(
      getSecondBrainStorePath(),
      JSON.stringify({
        version: 1,
        chatHistory: [
          { role: 'user', content: '合法' },
          { role: 'system', content: '非法角色' },
          { role: 'assistant' }, // 缺 content
          '裸字符串',
          null,
        ],
      })
    );
    expect(await loadChatHistory()).toEqual([{ role: 'user', content: '合法' }]);
  });

  it('与其他段共存：chatHistory 写入不覆盖 link/meta（串行链同文件多段）', async () => {
    makeEnv(); // 新 env（前序用例的 app 单例不串扰）
    await enqueuePaths(['文献盒/a.md'], { '文献盒/a.md': 'h1' });
    await mutateStore((s) => { (s.meta as any).kept = true; });
    await appendChatHistory({ role: 'user', content: '共存问题' });
    const store = await loadStore();
    expect((store.meta as any).kept).toBe(true);
    expect(store.link.queue.map((q) => q.path)).toEqual(['文献盒/a.md']);
    expect(store.chatHistory).toEqual([{ role: 'user', content: '共存问题' }]);
  });
});

describe('store-file Syncthing 冲突自愈（ticket 152）', () => {
  /** 基础主库 + 冲突库（conf 多 1 篇新笔记，meta/vec 真实分叉——对齐真实诊断场景） */
  function setupConflictScenario(overrides?: { confMetaMtime?: number; bothDiffRows?: boolean }) {
    const env = makeEnv();
    const { vault } = env;
    const dim = 2;
    // 主库：a/b 两篇各 1 chunk
    const priMeta = {
      version: 9,
      _dim: dim,
      notes: {
        '文献盒/a.md': { mtime: 100, chunks: [{ text: 'a1' }] },
        '文献盒/b.md': { mtime: 100, chunks: [{ text: 'b1' }] },
      },
    };
    vault.files.set(
      STORE(),
      JSON.stringify({ version: 1, meta: priMeta, panel: { summary: '主', generatedAt: 100 }, link: { queue: [], state: {} }, chatHistory: [] })
    );
    vault.binaryFiles.set(VEC(), vecFromMeta(priMeta, dim));
    // 冲突库：a/b/c 三篇（c 为另一设备新索引的笔记）
    const confMeta = {
      version: 9,
      _dim: dim,
      notes: {
        '文献盒/a.md': { mtime: 100, chunks: [{ text: 'a1' }] },
        '文献盒/b.md': { mtime: 100, chunks: [{ text: 'b1' }] },
        '文献盒/c.md': { mtime: 200, chunks: [{ text: 'c1' }, { text: 'c2' }] },
      },
    };
    vault.files.set(
      CONFLICT_JSON,
      JSON.stringify({
        version: 1,
        meta: confMeta,
        panel: { summary: '冲突', generatedAt: 200 },
        link: { queue: [{ path: '文献盒/q.md' }], state: { '文献盒/b.md': { hash: 'h-new', linkedAt: '2026-08-30T10:00:00Z' } } },
        chatHistory: [{ role: 'user', content: '冲突提问' }],
      })
    );
    vault.binaryFiles.set(CONFLICT_VEC, vecFromMeta(confMeta, dim));
    return env;
  }

  it('段级 union：meta 新增笔记合并、mtime 大者择优、panel/queue/state/chatHistory 并集，冲突文件删除', async () => {
    const { vault } = setupConflictScenario();
    const store = await loadStore();
    // meta：并入冲突侧 c.md（主侧没有）
    expect(Object.keys((store.meta as any).notes)).toEqual(['文献盒/a.md', '文献盒/b.md', '文献盒/c.md']);
    expect((store.meta as any).notes['文献盒/c.md']).toBeTruthy();
    // panel：取 generatedAt 大者（冲突 200 > 主 100）
    expect(store!.panel!.generatedAt).toBe(200);
    // link.queue/state 并集
    expect(store.link.queue.map((q) => q.path)).toEqual(['文献盒/q.md']);
    expect(store.link.state['文献盒/b.md'].hash).toBe('h-new');
    // chatHistory 并集
    expect(store.chatHistory).toEqual([{ role: 'user', content: '冲突提问' }]);
    // 冲突文件删除
    expect(vault.files.has(CONFLICT_JSON)).toBe(false);
    expect(vault.binaryFiles.has(CONFLICT_VEC)).toBe(false);
    // 主文件已合并写回
    const raw = JSON.parse(vault.files.get(STORE())!);
    expect(Object.keys(raw.meta.notes)).toEqual(['文献盒/a.md', '文献盒/b.md', '文献盒/c.md']);
  });

  it('.vec 行级重排：c.md 的 2 行从冲突 vec 按键序补入主 vec（行序 = 合并后键序 × chunks）', async () => {
    const { vault } = setupConflictScenario();
    await loadStore();
    const merged = JSON.parse(vault.files.get(STORE())!);
    // 合并后键序：a(1行) b(1行) c(2行) → 共 4 行 dim=2
    const buf = vault.binaryFiles.get(VEC())!;
    const dim = new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true);
    expect(dim).toBe(2);
    expect((buf.byteLength - 4) / 4 / dim).toBe(4);
    // 按行级内容验证：a 行 [100,0]、b 行 [101,0]（主侧），c 首行 [102,0]（冲突侧行序 b 之前有 a+b）
    const flat = new Float32Array(buf.buffer, buf.byteOffset + 4, 4 * 2);
    expect(Array.from(flat.slice(0, 2))).toEqual([100, 0]);
    expect(Array.from(flat.slice(2, 4))).toEqual([101, 0]);
    // c 行：冲突 vec 中 c 的偏移 = conf 键序(a1行,b1行) 之后 → [102,0],[102,1]
    expect(Array.from(flat.slice(4, 6))).toEqual([102, 0]);
    expect(Array.from(flat.slice(6, 8))).toEqual([102, 1]);
  });

  it('meta 未变（冲突仅 link 段）→ 主 .vec 权威直接复用，仅删冲突 .vec', async () => {
    const { vault } = makeEnv();
    const dim = 2;
    const priMeta = { version: 9, _dim: dim, notes: { '文献盒/a.md': { mtime: 100, chunks: [{ text: 'a1' }] } } };
    vault.files.set(STORE(), JSON.stringify({ version: 1, meta: priMeta, panel: null, link: { queue: [], state: {} }, chatHistory: [] }));
    const priVec = vecFromMeta(priMeta, dim);
    vault.binaryFiles.set(VEC(), priVec);
    // 冲突 json：meta 与主完全一致，仅 link 段不同
    vault.files.set(
      CONFLICT_JSON,
      JSON.stringify({ version: 1, meta: priMeta, panel: null, link: { queue: [{ path: '文献盒/x.md' }], state: {} }, chatHistory: [] })
    );
    vault.binaryFiles.set(CONFLICT_VEC, makeVec(dim, [[999, 9]]));
    await loadStore();
    // 冲突文件删除
    expect(vault.files.has(CONFLICT_JSON)).toBe(false);
    expect(vault.binaryFiles.has(CONFLICT_VEC)).toBe(false);
    // 主 vec 原样保留（未重写）
    expect(vault.binaryFiles.get(VEC())).toBe(priVec);
    // queue 已并入
    expect((await loadStore()).link.queue.map((q) => q.path)).toEqual(['文献盒/x.md']);
  });

  it('损坏冲突 JSON → 不合并、不删除（保留待人工处置），主库不受影响', async () => {
    const { vault } = makeEnv();
    const dim = 2;
    const priMeta = { version: 9, _dim: dim, notes: { '文献盒/a.md': { mtime: 100, chunks: [{ text: 'a1' }] } } };
    vault.files.set(STORE(), JSON.stringify({ version: 1, meta: priMeta, panel: null, link: { queue: [], state: {} }, chatHistory: [] }));
    vault.binaryFiles.set(VEC(), vecFromMeta(priMeta, dim));
    vault.files.set(CONFLICT_JSON, 'not-json{{{');
    const store = await loadStore();
    expect(vault.files.has(CONFLICT_JSON)).toBe(true); // 保留
    expect(Object.keys((store.meta as any).notes)).toEqual(['文献盒/a.md']);
    expect(vault.files.get(STORE())).toBe(vault.files.get(STORE())); // 主文件未被改动
  });

  it('无冲突文件 → 加载零行为（不落盘、不删文件、不改内容）', async () => {
    const { vault } = makeEnv();
    const dim = 2;
    const priMeta = { version: 9, _dim: dim, notes: { '文献盒/a.md': { mtime: 100, chunks: [{ text: 'a1' }] } } };
    const raw = JSON.stringify({ version: 1, meta: priMeta, panel: null, link: { queue: [], state: {} }, chatHistory: [] });
    vault.files.set(STORE(), raw);
    const priVec = vecFromMeta(priMeta, dim);
    vault.binaryFiles.set(VEC(), priVec);
    vault.modifiedPaths.length = 0;
    await loadStore();
    expect(vault.modifiedPaths).toEqual([]); // 无任何写/删
    expect(vault.files.get(STORE())).toBe(raw);
  });

  it('mergeStoreWithConflict 纯函数：meta mtime 择优、queue 去重、chatHistory 去重、超限截断', () => {
    const mk = (mtime: number) => ({ mtime, chunks: [{ text: 't' }] });
    const primary: any = {
      version: 1,
      meta: { notes: { a: mk(10), b: mk(20) } },
      panel: { summary: 's1', generatedAt: 1 },
      link: { queue: [{ path: 'q1' }], state: { a: { hash: 'ha', linkedAt: 'A' } } },
      chatHistory: [{ role: 'user', content: 'u1' }, { role: 'user', content: 'u2' }],
    };
    const conflict: any = {
      version: 1,
      meta: { notes: { a: mk(30), c: mk(5) } }, // a mtime 更大 → 择优冲突侧；c 新增
      panel: { summary: 's2', generatedAt: 2 },
      link: {
        queue: [{ path: 'q1' }, { path: 'q2' }], // q1 去重、q2 新增
        state: { a: { hash: 'hb', linkedAt: 'B' }, c: { hash: 'hc', linkedAt: 'C' } }, // a 取 linkedAt 大者 B
      },
      chatHistory: [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }], // u1 去重、a1 新增
    };
    const merged = mergeStoreWithConflict(primary, conflict);
    expect((merged.meta as any).notes.a.mtime).toBe(30); // a 择优冲突侧
    expect((merged.meta as any).notes.c.mtime).toBe(5); // c 新增
    expect((merged.meta as any).notes.b.mtime).toBe(20);
    expect(merged.panel?.generatedAt).toBe(2);
    expect(merged.link.queue.map((q) => q.path)).toEqual(['q1', 'q2']);
    expect(merged.link.state.a.linkedAt).toBe('B');
    expect(merged.link.state.c.hash).toBe('hc');
    expect(merged.chatHistory).toEqual([{ role: 'user', content: 'u1' }, { role: 'user', content: 'u2' }, { role: 'assistant', content: 'a1' }]);
  });

  it('adapter 无 list 能力 → 静默跳过自愈（不阻断加载）', async () => {
    const { vault, app } = makeEnv();
    (app.vault.adapter as any).list = undefined;
    const priMeta = { version: 9, _dim: 2, notes: { '文献盒/a.md': { mtime: 100, chunks: [{ text: 'a1' }] } } };
    vault.files.set(STORE(), JSON.stringify({ version: 1, meta: priMeta, panel: null, link: { queue: [], state: {} }, chatHistory: [] }));
    const store = await loadStore();
    expect(Object.keys((store.meta as any).notes)).toEqual(['文献盒/a.md']);
  });
});