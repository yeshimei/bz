// @vitest-environment node
/**
 * 备忘录引用同步测试（自 ai-agent 拆分的 memo 域本地实现）：
 * rename 同步路径/标题、delete 即时清 linkedNote、rename 链合并去抖回放保序、
 * watchedFolders 范围外不动、卸载后静默。
 * stub 手法照抄 tests/ai-agent/ai-agent.test.ts（MockVault / vault 事件经总线
 * emitDomainEvent 派发；纯 JSON 读写无 DOM，故标 node 环境）。
 */
import { describe, it, expect } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ensureMemoFileSync, unloadMemoFileSync } from '../../src/memo/file-sync';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
};

async function setup() {
  unloadMemoFileSync(); // 重置幂等守卫与监听（模块单例跨测试共享）
  clearDomainEvents(); // 总线为模块级单例：清掉跨测试残留订阅
  const vault = new MockVault();
  const app = { vault: vault as any };
  setApp(app as any);
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  ensureMemoFileSync(app as any);
  return { vault };
}

/** 等待队列清空：rename 经 DEBOUNCE_DELAY（默认 300ms）合并去抖，先越过窗口再等队列 */
async function flushQueue() {
  await new Promise((r) => setTimeout(r, 400)); // 覆盖去抖窗口
  await new Promise((r) => setTimeout(r, 30));
  await new Promise((r) => setTimeout(r, 0));
}

function memoWrites(vault: MockVault): number {
  return vault.modifiedPaths.filter((p) => p.endsWith('memo.json')).length;
}

describe('memo 引用同步', () => {
  it('rename 事件（总线 vault:md-renamed）：同步 linkedNote/title/notePath', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '旧笔记', scene: '工作', linkedNote: '卡片盒/旧笔记.md', notePath: '卡片盒/旧笔记.md', url: null },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/旧笔记.md', newPath: '卡片盒/新笔记.md' });
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0]).toMatchObject({ title: '新笔记', linkedNote: '卡片盒/新笔记.md', notePath: '卡片盒/新笔记.md' });
  });

  it('rename 链 A→B→C 连发：合并去抖后按序回放，终态一致', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: 'A', scene: '工作', linkedNote: '卡片盒/A.md', notePath: '卡片盒/A.md', url: null },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/A.md', newPath: '卡片盒/B.md' });
    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/B.md', newPath: '卡片盒/C.md' });
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0]).toMatchObject({ title: 'C', linkedNote: '卡片盒/C.md', notePath: '卡片盒/C.md' });
  });

  it('delete 事件（总线 vault:md-deleted）：即时清空关联', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: 'A', linkedNote: '卡片盒/A.md' },
      { id: 'm2', title: 'B', linkedNote: '卡片盒/B.md' },
    ], null, 2));

    emitDomainEvent('vault:md-deleted', { path: '卡片盒/A.md' });
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].linkedNote).toBeNull();
    expect(bz[1].linkedNote).toBe('卡片盒/B.md'); // 无关条目不动
  });

  it('watchedFolders 外不动：范围外改名不处理、从未写回', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: 'A', linkedNote: '我的/日记/2024.md' },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '我的/日记/2024.md', newPath: '我的/日记/2025.md' });
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].linkedNote).toBe('我的/日记/2024.md'); // 未变
    expect(memoWrites(vault)).toBe(0); // 从未写回
  });

  it('卸载静默：去抖窗口内卸载积压事件不再回放，卸载后新事件不受理', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '旧笔记', linkedNote: '卡片盒/旧笔记.md' },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/旧笔记.md', newPath: '卡片盒/新笔记.md' });
    unloadMemoFileSync(); // 立即卸载：cancelled 置位 + 清去抖定时器
    await new Promise((r) => setTimeout(r, 500)); // 越过本应触发的去抖窗口
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)[0].linkedNote).toBe('卡片盒/旧笔记.md');
    expect(memoWrites(vault)).toBe(0);

    // 卸载后新事件同样静默（订阅已退订 + 任务首行短路）
    emitDomainEvent('vault:md-deleted', { path: '卡片盒/旧笔记.md' });
    await new Promise((r) => setTimeout(r, 60));
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].linkedNote).toBe('卡片盒/旧笔记.md');
    expect(memoWrites(vault)).toBe(0);
  });
});
