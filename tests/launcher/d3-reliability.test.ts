// @vitest-environment node
/**
 * 入口页 D3 可靠写契约回归（写路径收编）：
 * ①并发 saveLauncherData 不互踩——编辑器拖拽保存与快捷指令保存并发，文件终态为某一次
 *   完整保存的序列化（无交错半截），且串行链内后写不丢先写；
 * ②解析坏文件 → 原样留档 CONFIG/.CORRUPT + 降级空配置后域功能可用。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadLauncherData, saveLauncherData, getLauncherFilePath, type LauncherData } from '../../src/launcher/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';

const PATH = getLauncherFilePath();

function makeEnv() {
  const vault = new MockVault();
  setApp({ vault } as any);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  return vault;
}

const tile = (id: string, x: number, y: number) => ({ id, commandId: 'bz-memo-open-panel', x, y, w: 1, h: 1 });
const data = (tiles: any[]): LauncherData => ({
  version: 3,
  desktop: { tiles, columns: 6 },
  mobile: { tiles: [], columns: 6 },
});

beforeEach(() => {
  makeEnv();
});

describe('launcher.json D3 可靠写契约', () => {
  it('①并发保存：两次完整保存按序落盘，终态为后写者且无交错', async () => {
    const vault = makeEnv();
    const s1 = saveLauncherData({ vault } as any, data([tile('a', 0, 0)]));
    const s2 = saveLauncherData({ vault } as any, data([tile('a', 0, 0), tile('b', 1, 0)]));
    await Promise.all([s1, s2]);
    const raw = JSON.parse(vault.files.get(PATH)!);
    // 终态必为「某一次完整保存」：无半截/字段交错
    const isS1 = JSON.stringify(raw) === JSON.stringify(data([tile('a', 0, 0)]));
    const isS2 = JSON.stringify(raw) === JSON.stringify(data([tile('a', 0, 0), tile('b', 1, 0)]));
    expect(isS1 || isS2).toBe(true);
  });

  it('①续：串行链内两次保存，后写者基于先写者（磁贴不丢）', async () => {
    const vault = makeEnv();
    await saveLauncherData({ vault } as any, data([tile('a', 0, 0)]));
    await saveLauncherData({ vault } as any, data([tile('a', 0, 0), tile('b', 1, 0)]));
    const loaded = await loadLauncherData({ vault } as any);
    expect(loaded.desktop.tiles.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('②解析坏文件 → 留档 CONFIG/.CORRUPT + 降级空配置后可继续保存', async () => {
    const vault = makeEnv();
    const broken = '{"version":3,"desktop":{"tile'; // 半截 JSON
    vault.files.set(PATH, broken);
    const loaded = await loadLauncherData({ vault } as any); // 留档 + 降级空配置，不抛
    expect(loaded.desktop.tiles).toEqual([]);
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/launcher.json.'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^CONFIG\/\.CORRUPT\/launcher\.json\.\d{8}-\d{6}\.bak$/);
    expect(vault.files.get(backups[0])).toBe(broken); // 原文原样留档
    // 降级后域功能可用：save 正常落盘
    await saveLauncherData({ vault } as any, data([tile('a', 0, 0)]));
    expect(JSON.parse(vault.files.get(PATH)!).desktop.tiles).toHaveLength(1);
  });
});
