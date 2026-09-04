// @vitest-environment node
/**
 * memo 域 D2 可靠写契约回归（试点域写路径迁移）：
 * ①并发写不互踩——后台引用同步（memo/file-sync 的 enqueueFileTask 读改写）与面板
 *   DataManager.addItem 并发，双方改动都落盘（后写者不得用陈旧基线覆盖先写者）；
 * ②解析坏文件 → 原样留档 CONFIG/.CORRUPT + 降级初始化后域功能可用。
 * （memo.json 为数组形态，D1 段写原语按契约抛错不适用——串行队列即收编面。）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataManager } from '../../src/memo/data';
import { jsonFileStore, enqueueFileTask } from '../../src/core/storage';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  return {
    vault,
    workspace: { getActiveFile: () => null },
    metadataCache: { getFileCache: () => null },
  };
}

const BASE_SETTINGS = { storagePath: 'CONFIG/STORAGE', todoFilePath: 'CONFIG/STORAGE', cinemaFolderPath: '我的/影视' };
const MEMO_PATH = 'CONFIG/STORAGE/memo.json';

const seedItem = (id: string, patch: Record<string, any> = {}) => ({
  id, title: '条目' + id, scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null, ...patch,
});

describe('memo.json D2 可靠写契约', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    setSettingsProvider(() => ({ ...BASE_SETTINGS }) as any);
    DataManager.init({ ...BASE_SETTINGS });
  });

  it('①后台引用同步与面板 addItem 并发：双方改动都落盘', async () => {
    vault.files.set(MEMO_PATH, JSON.stringify([seedItem('a')]));
    // 模拟 memo/file-sync syncSource：per-path 队列内 读→改引用→写（与 DataManager 同队列）
    const syncWrite = enqueueFileTask(MEMO_PATH, async () => {
      const store = jsonFileStore<any[]>(MEMO_PATH);
      const items = await store.read();
      const it = items.find((i: any) => i.id === 'a');
      if (it) {
        it.linkedNote = '新路径.md';
        await store.write(items);
      }
    });
    const uiAdd = DataManager.addItem(seedItem('b') as any);
    await Promise.all([syncWrite, uiAdd]);
    const raw = JSON.parse(vault.files.get(MEMO_PATH)!);
    expect(raw.find((r: any) => r.id === 'a').linkedNote).toBe('新路径.md'); // 同步改动未被覆盖
    expect(raw.find((r: any) => r.id === 'b')).toBeTruthy(); // 面板新增未丢
  });

  it('②解析坏文件 → 留档 CONFIG/.CORRUPT + 降级初始化后域功能可用', async () => {
    const broken = '{"x":'; // 半截 JSON（崩溃/同步冲突现场）
    vault.files.set(MEMO_PATH, broken);
    // loadItems 走留档 + 降级重建空库，返回空列表不抛
    expect(await DataManager.loadItems()).toEqual([]);
    expect(vault.dirs.has('CONFIG/.CORRUPT')).toBe(true);
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/memo.json.'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^CONFIG\/\.CORRUPT\/memo\.json\.\d{8}-\d{6}\.bak$/);
    expect(vault.files.get(backups[0])).toBe(broken); // 原文原样留档
    expect(JSON.parse(vault.files.get(MEMO_PATH)!)).toEqual([]); // 原路径降级初始化
    // 降级后域功能可用：新增 → 读取正常
    await DataManager.addItem(seedItem('c') as any);
    expect((await DataManager.loadItems()).map((i: any) => i.id)).toEqual(['c']);
  });
});
