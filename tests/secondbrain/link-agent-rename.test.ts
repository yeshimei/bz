/**
 * 自动关联改名同步测试（issue 339，jsdom）：
 * - vault:md-renamed 消费：队列条目与基准哈希键 oldPath→newPath 去抖合并 rekey（hash/queuedAt/empty 随键保留）；
 * - 改名笔记不重复入队（旧键不残留、防抖缓冲旧路径改指新路径，批次只有新路径一条）；
 * - 移出三盒 / 改名成非 md → 按删除口径就地清理；链式改名 A→B→C 防抖合并按序回放；
 * - 新旧都在盒外的无关改名不触发 store 写（空库不产生文件语义不被绕过）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { clearDomainEvents, emitDomainEvent } from '../../src/core/domain-bus';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { LinkAgentWatcher, __setLinkRekeyDebounceMsForTests } from '../../src/secondbrain/link-agent/watch';
import { __setLinkBatchMsForTests } from '../../src/secondbrain/link-agent/pipeline';
import { enqueuePaths, loadQueue, loadLinkState, upsertLinkState } from '../../src/secondbrain/link-agent/data';

function baseSettings() {
  // ADR-0141 §3：三盒恒含索引（文献盒/卡片盒/主题盒为缺省目录），白名单留空不影响判定
  return { ...DEFAULT_SETTINGS, secondBrainAllowPaths: '' } as any;
}

beforeEach(() => {
  resetObsidianMocks();
  clearDomainEvents();
  __setLinkRekeyDebounceMsForTests(30);
  __setLinkBatchMsForTests(30);
  setSettingsProvider(baseSettings);
  setSettingsSaver(() => Promise.resolve());
});

/** 构造 watcher 世界：注入 mock app 与假 agent（rekey 走真数据层 store-file） */
function makeWorld(vault: MockVault) {
  const app = mockAppWithVault(vault);
  setApp(app as any);
  const agent = {
    processBatch: vi.fn(async () => ({ total: 0, processed: 0, created: 0, queued: 0, failed: 0 })),
    cleanDeadLinks: vi.fn(async () => 0),
    filterChangedForRelink: vi.fn(async (paths: string[]) => paths),
    dropLinkBaseline: vi.fn(async () => {}),
  } as any;
  const watcher = new LinkAgentWatcher(app as any, agent);
  return { vault, agent, watcher };
}

const waitDebounce = () => new Promise((r) => setTimeout(r, 70));

describe('改名同步（issue 339：vault:md-renamed 消费）', () => {
  it('改名 rekey：队列条目与基准哈希键迁移到新路径，hash/empty 随键保留（状态不丢）', async () => {
    const { vault, watcher } = makeWorld(new MockVault());
    vault.files.set('文献盒/A.md', 'a');
    await enqueuePaths(['文献盒/A.md'], { '文献盒/A.md': 'aaaa0000:1' });
    await upsertLinkState('文献盒/A.md', 'bbbb0000:2', true);
    watcher.start();
    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/A.md', newPath: '文献盒/B.md' });
    await waitDebounce();
    const queue = await loadQueue();
    expect(queue.map((q) => q.path)).toEqual(['文献盒/B.md']);
    expect(queue[0].hash).toBe('aaaa0000:1');
    const state = await loadLinkState();
    expect(state['文献盒/A.md']).toBeUndefined();
    expect(state['文献盒/B.md']?.hash).toBe('bbbb0000:2');
    expect(state['文献盒/B.md']?.empty).toBe(true);
    watcher.destroy();
  });

  it('改名笔记不重复入队：管线把新路径再入队也只合并为一条（同 path 重入队语义不变）', async () => {
    const { vault, watcher } = makeWorld(new MockVault());
    vault.files.set('文献盒/B.md', 'b');
    await enqueuePaths(['文献盒/A.md'], { '文献盒/A.md': 'aaaa0000:1' });
    watcher.start();
    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/A.md', newPath: '文献盒/B.md' });
    await waitDebounce();
    // 改名后管线照常对新路径入队（hash 刷新）——队列仍只有一条，不出现 A/B 双条目
    await enqueuePaths(['文献盒/B.md'], { '文献盒/B.md': 'cccc0000:1' });
    const queue = await loadQueue();
    expect(queue.map((q) => q.path)).toEqual(['文献盒/B.md']);
    expect(queue[0].hash).toBe('cccc0000:1');
    watcher.destroy();
  });

  it('改名后冲刷批次不重复：缓冲内旧路径改指新路径，批次只有新路径一条', async () => {
    const { vault, agent, watcher } = makeWorld(new MockVault());
    vault.files.set('文献盒/B.md', 'b');
    watcher.start();
    watcher.onCreated('文献盒/A.md'); // 创建后立刻改名（同防抖窗口）
    watcher.onRenamed('文献盒/A.md', '文献盒/B.md');
    await waitDebounce();
    expect(agent.processBatch).toHaveBeenCalledTimes(1);
    expect(agent.processBatch.mock.calls[0][0]).toEqual(['文献盒/B.md']);
    watcher.destroy();
  });

  it('改名移出三盒：队列条目与基准就地清理（与删除同口径，不残留 stale 键）', async () => {
    const { vault, watcher } = makeWorld(new MockVault());
    await enqueuePaths(['文献盒/A.md']);
    await upsertLinkState('文献盒/A.md', 'h1');
    watcher.start();
    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/A.md', newPath: '随笔/B.md' });
    await waitDebounce();
    expect(await loadQueue()).toEqual([]);
    expect(Object.keys(await loadLinkState())).toEqual([]);
    watcher.destroy();
  });

  it('改名成非 md：队列与基准按删除口径清理', async () => {
    const { vault, watcher } = makeWorld(new MockVault());
    await enqueuePaths(['文献盒/A.md']);
    await upsertLinkState('文献盒/A.md', 'h1');
    watcher.start();
    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/A.md', newPath: '文献盒/A.canvas' });
    await waitDebounce();
    expect(await loadQueue()).toEqual([]);
    expect(Object.keys(await loadLinkState())).toEqual([]);
    watcher.destroy();
  });

  it('链式改名 A→B→C：防抖窗口内合并、按序回放，终态只有 C', async () => {
    const { vault, watcher } = makeWorld(new MockVault());
    await enqueuePaths(['文献盒/A.md'], { '文献盒/A.md': 'h' });
    watcher.start();
    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/A.md', newPath: '文献盒/B.md' });
    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/B.md', newPath: '文献盒/C.md' });
    await waitDebounce();
    const queue = await loadQueue();
    expect(queue.map((q) => q.path)).toEqual(['文献盒/C.md']);
    expect(queue[0].hash).toBe('h');
    watcher.destroy();
  });

  it('新旧都在盒外的无关改名：不触发 store 写（空库不产生 secondbrain.json）', async () => {
    const { vault, watcher } = makeWorld(new MockVault());
    watcher.start();
    emitDomainEvent('vault:md-renamed', { oldPath: '我的/日记/2601010000.md', newPath: '我的/日记/2601020000.md' });
    await waitDebounce();
    expect(vault.files.has('CONFIG/STORAGE/secondbrain.json')).toBe(false);
    watcher.destroy();
  });
});
