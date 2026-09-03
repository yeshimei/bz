// @vitest-environment node
/**
 * 收藏本文件同步测试（引用同步 + 同名自动关联）：
 * 同名创建自动关联、打开自动关联（连开去重）、rename/delete 引用同步、
 * watchedFolders 范围外不动、卸载静默。
 * stub 手法照抄 tests/ai-agent/ai-agent.test.ts（MockVault / workspace 伪对象 /
 * vault 三类事件经总线 emitDomainEvent 派发、open 走 workspace handler）。
 */
import { describe, it, expect } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ensureFavoritesFileSync, unloadFavoritesFileSync } from '../../src/favorites/file-sync';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';

/** 事件可触发的 mock app（workspace 记录 handler；vault 三类事件已迁总线，经 emitDomainEvent 派发） */
function makeEventedApp(vault: MockVault) {
  const wsHandlers: Record<string, Function[]> = {};
  const app = {
    vault: vault as any,
    workspace: {
      on: (ev: string, cb: Function) => {
        (wsHandlers[ev] = wsHandlers[ev] || []).push(cb);
        return { ref: `ws-${ev}` };
      },
      offref: () => {},
    },
  };
  return { app, wsHandlers };
}

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
};

async function setup() {
  unloadFavoritesFileSync(); // 重置幂等守卫与监听（模块单例跨测试共享）
  clearDomainEvents(); // 总线为模块级单例：清掉跨测试残留订阅
  const vault = new MockVault();
  const { app, wsHandlers } = makeEventedApp(vault);
  setApp(app as any);
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  ensureFavoritesFileSync(app as any);
  return { vault, wsHandlers };
}

/** 等待队列清空：rename/create/file-open 经 DEBOUNCE_DELAY（默认 300ms）合并去抖，先越过窗口再等队列 */
async function flushQueue() {
  await new Promise((r) => setTimeout(r, 400)); // 覆盖去抖窗口
  await new Promise((r) => setTimeout(r, 30));
  await new Promise((r) => setTimeout(r, 0));
}

function favWrites(vault: MockVault): number {
  return vault.modifiedPaths.filter((p) => p.endsWith('favorites.json')).length;
}

describe('favorites 文件同步', () => {
  it('create 事件（总线 vault:md-created）：同名未关联条目自动关联', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: '新文章', linkedNote: null },
    ], null, 2));

    emitDomainEvent('vault:md-created', { path: '卡片盒/新文章.md' });
    await flushQueue();

    const fav = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(fav[0].linkedNote).toBe('卡片盒/新文章.md');
  });

  it('file-open 打开自动关联：同文件连开去重，合并为单个队列任务只写一次', async () => {
    const { vault, wsHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: '笔记X', linkedNote: null },
    ], null, 2));
    const file = { path: '卡片盒/笔记X.md', basename: '笔记X', extension: 'md' };
    wsHandlers['file-open'][0](file);
    wsHandlers['file-open'][0](file);
    wsHandlers['file-open'][0](file);

    // 窗口内（<300ms）：尚未回放，数据未动
    await new Promise((r) => setTimeout(r, 60));
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!)[0].linkedNote).toBeNull();
    expect(favWrites(vault)).toBe(0);

    // 越过窗口：连开去重后按序回放
    await flushQueue();
    const fav = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(fav[0].linkedNote).toBe('卡片盒/笔记X.md');
    expect(favWrites(vault)).toBe(1); // 只写一次
  });

  it('rename 事件（总线 vault:md-renamed）：同步 linkedNote/title/notePath', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: '旧笔记', linkedNote: '卡片盒/旧笔记.md', notePath: '卡片盒/旧笔记.md' },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/旧笔记.md', newPath: '卡片盒/新笔记.md' });
    await flushQueue();

    const fav = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(fav[0]).toMatchObject({ title: '新笔记', linkedNote: '卡片盒/新笔记.md', notePath: '卡片盒/新笔记.md' });
  });

  it('delete 事件（总线 vault:md-deleted）：即时清空关联', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: 'A', linkedNote: '卡片盒/A.md' },
    ], null, 2));

    emitDomainEvent('vault:md-deleted', { path: '卡片盒/A.md' });
    await flushQueue();

    const fav = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(fav[0].linkedNote).toBeNull();
  });

  it('watchedFolders 外不动：范围外的同名创建与改名都不处理、从未写回', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: '2024', linkedNote: null }, // 标题与范围外笔记同名，若误处理会被关联
    ], null, 2));

    emitDomainEvent('vault:md-created', { path: '我的/日记/2024.md' });
    await flushQueue();
    emitDomainEvent('vault:md-renamed', { oldPath: '我的/日记/2024.md', newPath: '我的/日记/2025.md' });
    await flushQueue();

    const fav = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(fav[0]).toMatchObject({ title: '2024', linkedNote: null }); // 关联/标题均未动
    expect(favWrites(vault)).toBe(0); // 从未写回
  });


  it('卸载静默：去抖窗口内卸载积压事件不再回放、不落盘，卸载后新事件不受理', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: '笔记Y', linkedNote: null },
    ], null, 2));

    emitDomainEvent('vault:md-created', { path: '卡片盒/笔记Y.md' });
    unloadFavoritesFileSync(); // 立即卸载：cancelled 置位 + 清去抖定时器
    await new Promise((r) => setTimeout(r, 500)); // 越过本应触发的去抖窗口
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!)[0].linkedNote).toBeNull();
    expect(favWrites(vault)).toBe(0);

    // 卸载后新事件同样静默（订阅已退订）
    emitDomainEvent('vault:md-created', { path: '卡片盒/笔记Y.md' });
    await flushQueue();
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!)[0].linkedNote).toBeNull();
    expect(favWrites(vault)).toBe(0);
  });
});
