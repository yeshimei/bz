// @vitest-environment node
/**
 * store-file 单文件数据层测试（ticket 120）：
 * - 一次性迁移：四旧 JSON 合并组装 secondbrain.json、旧文件删除、旧 vec 改名 secondbrain.vec、幂等跳过；
 * - 空库不落盘（无旧文件 → loadStore 不产生文件，refresh 首建语义）；
 * - 段结构校验（queue 非数组/state 非对象/panel 缺失容错）+ 整文件损坏留档重建；
 * - 串行写链：并发 mutateStore（meta + link 同时写）不互相覆盖丢失；
 * - 与 link-agent/data 的 queue/state 段打通（loadLinkState/loadQueue 经 store 读写）。
 * 经 MockVault adapter（含 exists/remove/rename），纯 node 环境。
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
} from '../../src/secondbrain/store-file';
import { loadQueue, enqueuePaths, dequeuePath, loadLinkState, upsertLinkState } from '../../src/secondbrain/link-agent/data';

const OLD_META = 'CONFIG/STORAGE/secondbrain_meta.json';
const OLD_PANEL = 'CONFIG/STORAGE/secondbrain_panel.json';
const OLD_QUEUE = 'CONFIG/STORAGE/secondbrain_link_queue.json';
const OLD_STATE = 'CONFIG/STORAGE/secondbrain_link_state.json';
const OLD_VEC = 'CONFIG/STORAGE/secondbrain_vectors.vec';

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