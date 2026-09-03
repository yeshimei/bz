// @vitest-environment node
/**
 * memo.json 写竞态收敛（per-path 串行队列）：
 *   - 同一文件多个 store 实例并发「读→改→写」时，后写者不得用陈旧基线覆盖先写者；
 *   - memo UI（DataManager）与 todo UI（TodoData）同写 memo.json 的跨域并发场景；
 *   - enqueueFileTask 顺序保证 / 异常不阻塞后续任务。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataManager } from '../../src/memo/data';
import { TodoData } from '../../src/todo/data';
import { enqueueFileTask } from '../../src/core/storage';
import { setApp } from '../../src/core/app';
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

describe('memo.json 写竞态收敛', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    DataManager.init({ ...BASE_SETTINGS });
    TodoData.init({ ...BASE_SETTINGS });
  });

  it('跨域并发各改一条：两条改动都落盘（修复前后写者覆盖先写者）', async () => {
    vault.files.set(MEMO_PATH, JSON.stringify([
      { id: 'a', title: '甲', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
      { id: 'b', title: '乙', scene: '学习', priority: 'minor', created: '2025-06-14 11:00:00', completed: null },
    ]));
    // memo 面板与 todo 面板同时各改一条（无队列时两次 updateItem 都基于同一基线，后写抹掉先写）
    await Promise.all([
      DataManager.updateItem('a', { priority: 'important' } as any),
      TodoData.updateItem('b', { due: '2025-07-01 09:00' } as any),
    ]);
    const raw = JSON.parse(vault.files.get(MEMO_PATH)!);
    expect(raw.find((r: any) => r.id === 'a').priority).toBe('important');
    expect(raw.find((r: any) => r.id === 'b').due).toBe('2025-07-01 09:00');
  });

  it('同域并发 add：两条都落盘不丢', async () => {
    vault.files.set(MEMO_PATH, JSON.stringify([]));
    await Promise.all([
      DataManager.addItem({ id: 'x1', title: '甲', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00' } as any),
      TodoData.addItem({ id: 'x2', title: '乙', scene: '学习', priority: 'minor', created: '2025-06-14 10:00:00', completed: null, due: null, notePath: null, notePosition: null, scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null } as any),
    ]);
    const raw = JSON.parse(vault.files.get(MEMO_PATH)!);
    const ids = raw.map((r: any) => r.id).sort();
    expect(ids).toEqual(['x1', 'x2']);
  });
});

describe('enqueueFileTask 队列语义', () => {
  it('同路径任务按入队顺序串行执行；不同路径互不阻塞', async () => {
    const order: string[] = [];
    const t1 = enqueueFileTask('f.json', async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push('f:1');
    });
    const t2 = enqueueFileTask('f.json', async () => {
      order.push('f:2');
    });
    const t3 = enqueueFileTask('g.json', async () => {
      order.push('g:1');
    });
    await Promise.all([t1, t2, t3]);
    // 同路径严格串行（f:1 → f:2）；异路径不排队（g:1 在 f:1 的 20ms 等待窗口内先行完成）
    expect(order.indexOf('f:1')).toBeLessThan(order.indexOf('f:2'));
    expect(order).toContain('g:1');
  });

  it('前序任务失败不阻塞后续任务，异常向调用方传播', async () => {
    await expect(enqueueFileTask('bad.json', async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');
    let ran = false;
    await enqueueFileTask('bad.json', async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});
