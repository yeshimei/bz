// @vitest-environment node
/**
 * todo 域 D2 可靠写契约回归（试点域写路径迁移）：memo.json 双视角同源（与旧 memo 共写）。
 * ①并发写不互踩——批量迁移场景（updateSceneBulk）与单条完成（completeItem）并发，双方都落盘；
 * ②解析坏文件 → 原样留档 CONFIG/.CORRUPT + 降级初始化后域功能可用。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TodoData } from '../../src/todo/data';
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
  id, title: '待办' + id, scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null, ...patch,
});

describe('todo（memo.json 双视角）D2 可靠写契约', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    setSettingsProvider(() => ({ ...BASE_SETTINGS }) as any);
    TodoData.init({ ...BASE_SETTINGS });
  });

  it('①批量迁移场景与单条完成并发：双方改动都落盘', async () => {
    vault.files.set(MEMO_PATH, JSON.stringify([seedItem('a'), seedItem('b')]));
    await Promise.all([
      TodoData.updateSceneBulk('工作', '学习'),
      TodoData.completeItem('b'),
    ]);
    const raw = JSON.parse(vault.files.get(MEMO_PATH)!);
    expect(raw.find((r: any) => r.id === 'a').scene).toBe('学习'); // 批量迁移未被覆盖
    expect(raw.find((r: any) => r.id === 'b').completed).toBeTruthy(); // 完成态未丢
  });

  it('②解析坏文件 → 留档 CONFIG/.CORRUPT + 降级初始化后域功能可用', async () => {
    const broken = '[{broken';
    vault.files.set(MEMO_PATH, broken);
    // 坏文件降级为空库：批量迁移返回 0 不抛
    expect(await TodoData.updateSceneBulk('工作', '学习')).toBe(0);
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/memo.json.'));
    expect(backups).toHaveLength(1);
    expect(vault.files.get(backups[0])).toBe(broken);
    expect(JSON.parse(vault.files.get(MEMO_PATH)!)).toEqual([]); // 原路径降级初始化
    // 降级后域功能可用：新增 + 批量迁移正常
    await TodoData.addItem(seedItem('t') as any);
    expect(await TodoData.updateSceneBulk('工作', '学习')).toBe(1);
    expect((await TodoData.loadItems())[0].scene).toBe('学习');
  });
});
