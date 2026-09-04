// @vitest-environment node
/**
 * favorites 域 D2 可靠写契约回归（试点域写路径迁移）：
 * ①并发写不互踩——两个 DataManager 实例（面板 UI 与后台文件同步两个视角）并发
 *   add/update/mutateAll，双方改动都落盘；
 * ②解析坏文件 → 原样留档 CONFIG/.CORRUPT + 降级初始化后域功能可用。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataManager } from '../../src/favorites/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

const PATH = 'CONFIG/STORAGE/favorites.json';

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

const item = (id: string, patch: Record<string, any> = {}) => ({
  id, tags: [], title: '条目' + id, description: '', pinned: false, url: '', balance: null,
  balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-06-01 08:00:00', type: '',
  ...patch,
});

describe('favorites.json D2 可靠写契约', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
    vault.files.set(PATH, '[]');
  });

  it('①两视角并发 add：两条都落盘不丢', async () => {
    const dmUi = new DataManager(PATH);
    const dmSync = new DataManager(PATH); // 模拟 file-sync 代理视角（同文件另一实例）
    await Promise.all([dmUi.add(item('a')), dmSync.add(item('b'))]);
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw.map((d: any) => d.id).sort()).toEqual(['a', 'b']);
  });

  it('①并发 update 与 mutateAll（余额批量写回语义）：双方改动都落盘', async () => {
    const dmUi = new DataManager(PATH);
    const dmSync = new DataManager(PATH);
    await dmUi.add(item('a'));
    await dmUi.add(item('b'));
    await Promise.all([
      dmUi.update('a', { pinned: true }),
      dmSync.mutateAll((data) => {
        const t = data.find((d) => d.id === 'b');
        if (t) {
          t.balance = '9.9';
          t.balanceCacheTime = 123;
        }
      }),
    ]);
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw.find((d: any) => d.id === 'a').pinned).toBe(true); // update 未被覆盖
    expect(raw.find((d: any) => d.id === 'b').balance).toBe('9.9'); // 批量写回未丢
  });

  it('②解析坏文件 → 留档 CONFIG/.CORRUPT + 降级初始化后域功能可用', async () => {
    const broken = '[{broken';
    vault.files.set(PATH, broken);
    const dm = new DataManager(PATH);
    // 坏文件 → 留档 + 降级重建空库，读取不抛
    expect(await dm.getAll()).toEqual([]);
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/favorites.json.'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^CONFIG\/\.CORRUPT\/favorites\.json\.\d{8}-\d{6}\.bak$/);
    expect(vault.files.get(backups[0])).toBe(broken);
    expect(JSON.parse(vault.files.get(PATH)!)).toEqual([]);
    // 降级后域功能可用
    await dm.add(item('c'));
    expect((await dm.getAll()).map((d) => d.id)).toEqual(['c']);
  });
});
