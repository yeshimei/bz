// @vitest-environment node
/**
 * 收藏本 DataManager 测试（ticket 11）：CRUD + 排序。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { DataManager } from '../../src/favorites/data';
import { getStorageDir, getStoragePath } from '../../src/favorites/config';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

describe('DataManager', () => {
  let vault: MockVault;
  let dm: DataManager;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
    dm = new DataManager('CONFIG/STORAGE/favorites.json');
  });

  it('空库读取 → [] + 自动建文件', async () => {
    const data = await dm.getAll();
    expect(data).toEqual([]);
    expect(vault.files.has('CONFIG/STORAGE/favorites.json')).toBe(true);
  });

  it('add → unshift 到最前', async () => {
    await dm.add({ id: '1', tags: ['GitHub'], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-01-01 00:00:00', type: 'GitHub' } as any);
    await dm.add({ id: '2', tags: ['网站'], title: 'B', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-01-02 00:00:00', type: '网站' } as any);
    const data = await dm.getAll();
    expect(data.map((d) => d.id)).toEqual(['2', '1']);
  });

  it('update → 合并字段并落盘', async () => {
    await dm.add({ id: '1', tags: ['GitHub'], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-01-01 00:00:00', type: 'GitHub' } as any);
    await dm.update('1', { pinned: true, title: 'A2' });
    const data = await dm.getAll();
    expect(data[0].pinned).toBe(true);
    expect(data[0].title).toBe('A2');
    expect(data[0].type).toBe('GitHub'); // 未更新的字段保留
  });

  it('delete → 移除', async () => {
    await dm.add({ id: '1', tags: [], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '' } as any);
    await dm.add({ id: '2', tags: [], title: 'B', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '' } as any);
    await dm.delete('1');
    expect((await dm.getAll()).map((d) => d.id)).toEqual(['2']);
  });

  it('13 字段落盘格式', async () => {
    const item = {
      id: '1234567890', tags: ['GitHub'], title: 'T', description: 'D', pinned: true,
      url: 'https://github.com/a/b', balance: '10.5', balanceCacheTime: 123456, balanceError: null,
      linkedNote: '笔记.md', created: '2025-06-01 08:00:00', type: 'GitHub',
      llmConfig: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
    };
    await dm.add(item as any);
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(saved[0]).toEqual(item);
    expect(Object.keys(saved[0]).length).toBe(13); // 12 必选字段 + llmConfig
  });

  it('归档字段（ticket 140）：旧格式零迁移可读；归档 update 为加法扩展', async () => {
    await dm.add({ id: '1', tags: ['GitHub'], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-01-01 00:00:00', type: 'GitHub' } as any);
    // 旧数据（无 archived 字段）原样读回 = 未归档
    expect((await dm.getAll())[0].archived).toBeUndefined();

    await dm.update('1', { archived: true, archivedAt: '2026-08-30 10:00:00' });
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(saved[0].archived).toBe(true);
    expect(saved[0].archivedAt).toBe('2026-08-30 10:00:00');
    expect(Object.keys(saved[0]).length).toBe(14); // 12 基准字段（无 llmConfig）+ archived + archivedAt

    // 未归档条目不携带归档字段（写路径不加字段，兼容性最小扰动）
    await dm.add({ id: '2', tags: [], title: 'B', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '' } as any);
    const saved2 = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(Object.keys(saved2[0]).length).toBe(12); // unshift 在前 = 新条目 B（12 基准字段，无归档键）
    expect(saved2[1].archived).toBe(true); // 已归档条目不受第二次写入影响
  });
});

describe('存储路径解析（文件名固定 favorites.json）', () => {
  it('目录设置 → 拼接固定文件名', () => {
    expect(getStoragePath('我的/数据')).toBe('我的/数据/favorites.json');
    expect(getStoragePath('我的/数据/')).toBe('我的/数据/favorites.json');
  });
  it('未设置 → 默认目录', () => {
    expect(getStoragePath(undefined)).toBe('CONFIG/STORAGE/favorites.json');
  });
  it('兼容旧值：完整文件路径 → 取目录', () => {
    expect(getStoragePath('CONFIG/STORAGE/favorites.json')).toBe('CONFIG/STORAGE/favorites.json');
    expect(getStoragePath('我的/数据/fav.json')).toBe('我的/数据/favorites.json');
  });
  it('文件名不可改：自定义 fav.json 一律落 favorites.json', () => {
    const dir = getStorageDir('我的/数据/fav.json');
    expect(dir).toBe('我的/数据');
  });
});
