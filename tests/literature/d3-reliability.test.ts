// @vitest-environment node
/**
 * 文献盒 D3 可靠写契约回归（bili-tasks 后继 literature.json 写路径收编）：
 * ①并发事务不互踩——面板加任务（addTask）与下载守护进程回写状态（updateTask）并发，双方改动都落盘；
 * ②解析坏文件 → 原样留档 CONFIG/.CORRUPT + 降级初始化后域功能可用。
 */
import { describe, it, expect } from 'vitest';
import { LiteratureData } from '../../src/literature/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';

const PATH = 'CONFIG/STORAGE/literature.json';

/** 当前用例的 vault（setup 里记录，供断言读盘） */
let _vault: MockVault;

function setup(seed?: any[]) {
  _vault = new MockVault();
  if (seed) _vault.files.set(PATH, JSON.stringify(seed));
  setApp({ vault: _vault } as any);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  LiteratureData.init({ storagePath: 'CONFIG/STORAGE' });
  return _vault;
}

describe('literature.json D3 可靠写契约', () => {
  it('①并发事务：addTask（面板）与 updateTask（守护进程回写）交错，双方改动都落盘', async () => {
    setup([{ id: 't1', url: 'https://b23.tv/1', status: 'processing', created: '2026-01-01 00:00:00' }]);

    await Promise.all([
      LiteratureData.addTask({ url: 'https://b23.tv/2' }), // 面板追加
      LiteratureData.updateTask('t1', { status: 'success', videoPath: '文献盒/v1.mp4' }), // 守护进程回写
    ]);

    const raw = JSON.parse(_vault.files.get(PATH)!);
    expect(raw.find((r: any) => r.id === 't1').status).toBe('success'); // 回写未被陈旧基线回滚
    expect(raw.find((r: any) => r.url === 'https://b23.tv/2')).toBeTruthy(); // 新增未丢
    expect(raw).toHaveLength(2);
  });

  it('①续：deleteTask 与 clearHistory 并发，终态集合自洽（无半写）', async () => {
    setup([
      { id: 't1', url: 'u1', status: 'success', archived: true, created: '2026-01-01 00:00:00' },
      { id: 't2', url: 'u2', status: 'pending', created: '2026-01-01 00:00:00' },
      { id: 't3', url: 'u3', status: 'success', archived: true, created: '2026-01-01 00:00:00' },
    ]);

    await Promise.all([LiteratureData.deleteTask('t2'), LiteratureData.clearHistory()]);

    const raw = JSON.parse(_vault.files.get(PATH)!);
    // 串行执行后：清历史删 archived（t1/t3），删任务删 t2 —— 终态为两次事务的先后叠加
    expect(raw.every((r: any) => r.id !== 't1' && r.id !== 't3')).toBe(true);
    expect(Array.isArray(raw)).toBe(true);
  });

  it('②解析坏文件 → 留档 CONFIG/.CORRUPT + 降级空列表后可继续 addTask', async () => {
    setup();
    const broken = '[{"id":"t1","url":'; // 半截 JSON
    _vault.files.set(PATH, broken);

    const tasks = await LiteratureData.loadTasks(); // 留档 + 降级空列表，不抛
    expect(tasks).toEqual([]);
    const backups = [..._vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/literature.json.'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^CONFIG\/\.CORRUPT\/literature\.json\.\d{8}-\d{6}\.bak$/);
    expect(_vault.files.get(backups[0])).toBe(broken); // 原文原样留档
    // 降级后域功能可用
    const task = await LiteratureData.addTask({ url: 'https://b23.tv/9' });
    expect(task.status).toBe('pending');
  });
});
