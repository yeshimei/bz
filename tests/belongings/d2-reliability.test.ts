/**
 * 归物本 D2 可靠写契约回归（试点域写路径迁移）：
 * ①并发写不互踩——并发 saveDatabase 按 per-path 队列串行落盘，终态为后写者完整内容
 *   （无半截 JSON、无交错损坏）；
 * ②解析坏文件 → 原样留档 CONFIG/.CORRUPT + 降级初始化空库后保存/读取可用。
 * 含 notice toast 文案路径（域自管损坏文案），保持默认 jsdom 环境。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadDatabase, saveDatabase, getDataFilePath } from '../../src/belongings/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';

const PATH = 'CONFIG/STORAGE/belongings.json';

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

const dbOf = (ids: string[]) => ({
  version: '1.0',
  last_updated: '2026-09-04T10:00:00.000Z',
  items: Object.fromEntries(ids.map((id) => [id, { id, name: '物品' + id, category: '数码', price: 100, purchase_date: '2025-01-01' }])),
});

describe('belongings.json D2 可靠写契约', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
    vault.files.set(PATH, JSON.stringify(dbOf(['seed'])));
  });

  it('①并发保存按队列串行落盘：终态为后写者完整内容（无半截）', async () => {
    const first = await loadDatabase();
    (first.items as any)['a'] = { id: 'a', name: '甲' };
    const second = dbOf(['b']); // 另一视角的完整库（不含 a）
    await Promise.all([
      saveDatabase(first),
      saveDatabase(second as any), // 后入队 → 后写完整胜出
    ]);
    const raw = vault.files.get(PATH)!;
    const final = JSON.parse(raw); // 可完整解析（无交错半截）
    expect(Object.keys(final.items)).toEqual(['b']);
    expect(final.version).toBe('1.0');
    expect(final.last_updated).toBeTruthy();
    // 盘上分类固定内置默认形状（saveDatabase 剥离 categories，读取时重建）
    expect((await loadDatabase()).items).toHaveProperty('b');
  });

  it('②解析坏文件 → 留档 CONFIG/.CORRUPT + 降级初始化后保存/读取可用', async () => {
    const broken = '{"items":';
    vault.files.set(PATH, broken);
    // 坏文件 → 留档 + 降级重建空库，loadDatabase 走既有失败 notice 路径返回空库
    const db = await loadDatabase();
    expect(db.items).toEqual({});
    expect(vault.dirs.has('CONFIG/.CORRUPT')).toBe(true);
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/belongings.json.'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^CONFIG\/\.CORRUPT\/belongings\.json\.\d{8}-\d{6}\.bak$/);
    expect(vault.files.get(backups[0])).toBe(broken);
    // 降级后域功能可用：保存 → 读取正常
    await saveDatabase(dbOf(['x']) as any);
    const reloaded = await loadDatabase();
    expect(Object.keys(reloaded.items)).toEqual(['x']);
    expect(getDataFilePath()).toBe(PATH);
  });
});
