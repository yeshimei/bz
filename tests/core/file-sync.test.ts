// @vitest-environment node
/**
 * core/file-sync 公共壳纯逻辑测试（issue 365 全域复用上收）：
 * watched folders 匹配（含目录本身口径）、范围外引用放行（E22）、DEBOUNCE_DELAY
 * 去抖合并回放保序与缺省 300ms、delete 即时派发、buildRenameEvent 载荷构造、
 * onMdDeleted 后置消费者、unload 后不再触发、积压任务 _cancelled 首行短路、
 * 失败错误语义（console.error + notify 去重、队列不断链）。
 * 域事件走内存总线 domain-bus（模块级 Map 即内存 fake）；域数据层用内存数组
 * 模拟读改写（纯逻辑无 DOM，故标 node 环境）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return {
    ...actual,
    notify: vi.fn(() => ({ setMessage: vi.fn(), setType: vi.fn(), hide: vi.fn() })),
  };
});
import { createFileSync, type FileSyncConfig, type FileSyncRenameEvent } from '../../src/core/file-sync';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { notify } from '../../src/core/notice';

/** 域 fake 数据形态：带路径引用的条目 */
interface Ref {
  path?: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 域 fake：内存数组数据 + 写盘/纯函数调用记录 */
function makeAgent(opts: Partial<FileSyncConfig<Ref[], FileSyncRenameEvent>> & { debounce?: string } = {}) {
  let data: Ref[] = [];
  const writes: string[] = [];
  const renames: FileSyncRenameEvent[] = [];
  const deletes: string[] = [];
  const config: FileSyncConfig<Ref[], FileSyncRenameEvent> = {
    logTag: '[fake-file-sync]',
    failNotice: '测试同步失败，数据可能不一致',
    failDedupeKey: 'fake-file-sync',
    watchedFolders: () => ['卡片盒'],
    commit: async (apply) => {
      if (apply(data)) writes.push('w');
    },
    referencedBy: async (path) => data.some((it) => it?.path === path),
    applyRename: (items, ev) => {
      renames.push(ev);
      let changed = false;
      for (const it of items) {
        if (it.path === ev.oldPath) { it.path = ev.newPath; changed = true; }
      }
      return changed;
    },
    applyDelete: (items, path) => {
      deletes.push(path);
      let changed = false;
      for (const it of items) {
        if (it.path === path) { it.path = null; changed = true; }
      }
      return changed;
    },
    ...opts,
  };
  setSettingsProvider(() => ({ ...(opts.debounce !== undefined ? { DEBOUNCE_DELAY: opts.debounce } : {}) } as any));
  const agent = createFileSync(config);
  agent.ensure({ vault: {} } as any);
  return { agent, writes, renames, deletes, setData: (d: Ref[]) => { data = d; } };
}

/** 等 rename 去抖窗口（覆盖可调的 DEBOUNCE_DELAY）+ 队列清空 */
async function flushQueue(windowMs: number) {
  await sleep(windowMs + 50);
  await sleep(30);
  await sleep(0);
}

afterEach(() => {
  clearDomainEvents(); // 总线为模块级单例：清掉跨测试残留订阅
  vi.mocked(notify).mockClear();
});

describe('watched folders 匹配与范围放行', () => {
  it('范围内 rename 派发（前缀匹配），范围外且无引用的不派发', async () => {
    const { renames, writes, setData } = makeAgent({ debounce: '30' });
    setData([{ path: '卡片盒/A.md' }]);

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/A.md', newPath: '卡片盒/B.md' });
    emitDomainEvent('vault:md-renamed', { oldPath: '随手记/无关.md', newPath: '随手记/改名.md' });
    await flushQueue(30);

    expect(renames).toEqual([{ oldPath: '卡片盒/A.md', newPath: '卡片盒/B.md' }]);
    expect(writes).toHaveLength(1);
  });

  it('目录本身也算范围内（path === 目录 口径）', async () => {
    const { renames } = makeAgent({ debounce: '30' });
    // 新路径即目录本身：inFolders 命中「等于目录」分支
    emitDomainEvent('vault:md-renamed', { oldPath: '其他/移入.md', newPath: '卡片盒' });
    await flushQueue(30);
    expect(renames).toHaveLength(1);
  });

  it('范围外放行（E22）：路径被域数据实际引用的照常派发', async () => {
    const { renames, setData } = makeAgent({ debounce: '30' });
    setData([{ path: '我的/日记/2024.md' }]); // 范围外但被引用

    emitDomainEvent('vault:md-renamed', { oldPath: '我的/日记/2024.md', newPath: '我的/日记/2025.md' });
    await flushQueue(30);
    expect(renames).toEqual([{ oldPath: '我的/日记/2024.md', newPath: '我的/日记/2025.md' }]);
  });
});

describe('去抖合并与派发', () => {
  it('DEBOUNCE_DELAY 缺省 300：窗口内不回放，越过窗口按序回放', async () => {
    const { renames, setData } = makeAgent(); // 不设 DEBOUNCE_DELAY → 缺省 300
    setData([{ path: '卡片盒/A.md' }]);

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/A.md', newPath: '卡片盒/B.md' });
    await sleep(100);
    expect(renames).toHaveLength(0); // 未越过窗口
    await flushQueue(300);
    expect(renames).toEqual([{ oldPath: '卡片盒/A.md', newPath: '卡片盒/B.md' }]);
  });

  it('rename 链 A→B→C 连发：合并成批后按序回放，终态一致', async () => {
    const { renames, setData } = makeAgent({ debounce: '30' });
    setData([{ path: '卡片盒/A.md' }]);

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/A.md', newPath: '卡片盒/B.md' });
    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/B.md', newPath: '卡片盒/C.md' });
    await flushQueue(30);

    expect(renames.map((r) => r.oldPath)).toEqual(['卡片盒/A.md', '卡片盒/B.md']); // 顺序保留
    expect(renames.every((r) => r.newPath !== undefined)).toBe(true);
  });

  it('delete 即时通道：不等去抖窗口直接入队执行', async () => {
    const { deletes, writes, setData } = makeAgent({ debounce: '30' });
    setData([{ path: '卡片盒/A.md' }]);

    emitDomainEvent('vault:md-deleted', { path: '卡片盒/A.md' });
    await sleep(80); // 远短于缺省去抖窗口也该已执行（delete 不走 flusher）

    expect(deletes).toEqual(['卡片盒/A.md']);
    expect(writes).toHaveLength(1);
  });

  it('buildRenameEvent 载荷构造：域可附加字段，newBasename 为新路径 basename', async () => {
    const renames: any[] = [];
    const { setData } = makeAgent({
      debounce: '30',
      buildRenameEvent: (evt, newBasename) => ({ ...evt, newTitle: newBasename }),
      applyRename: (items: any[], ev: any) => {
        renames.push(ev);
        return false;
      },
    } as any);
    setData([{ path: '卡片盒/A.md' }]);

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/A.md', newPath: '卡片盒/新名.md' });
    await flushQueue(30);
    expect(renames).toEqual([{ oldPath: '卡片盒/A.md', newPath: '卡片盒/新名.md', newTitle: '新名' }]);
  });

  it('onMdDeleted 后置消费者：守卫不命中也执行；未配置时缺省不调用不报错', async () => {
    const consumer = vi.fn(async () => {});
    const a = makeAgent({ debounce: '30', onMdDeleted: consumer });
    a.setData([]); // 无引用、范围外：delete 守卫不命中

    emitDomainEvent('vault:md-deleted', { path: '随手记/X.md' });
    await flushQueue(30);
    expect(consumer).toHaveBeenCalledTimes(1);
    expect(consumer).toHaveBeenCalledWith(expect.anything(), '随手记/X.md');
    expect(a.writes).toHaveLength(0); // 守卫没过 → commit 不跑

    // 未配置 onMdDeleted：同样事件不报错照常处理
    const b = makeAgent({ debounce: '30' });
    b.setData([{ path: '卡片盒/Y.md' }]);
    emitDomainEvent('vault:md-deleted', { path: '卡片盒/Y.md' });
    await flushQueue(30);
    expect(b.deletes).toEqual(['卡片盒/Y.md']);
  });
});

describe('unload 与 _cancelled 短路', () => {
  it('unload 后不再触发：去抖窗口内卸载积压事件不回放，卸载后新事件静默', async () => {
    const { agent, renames, deletes, setData } = makeAgent({ debounce: '30' });
    setData([{ path: '卡片盒/A.md' }]);

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/A.md', newPath: '卡片盒/B.md' });
    agent.unload(); // 去抖窗口内立即卸载：清定时器 + 置位 _cancelled
    await sleep(100);
    expect(renames).toHaveLength(0); // 积压事件不回放

    emitDomainEvent('vault:md-deleted', { path: '卡片盒/B.md' });
    await sleep(50);
    expect(deletes).toHaveLength(0); // 订阅已退订：新事件不受理
  });

  it('_cancelled 首行短路：卸载后积压在队列里的任务不再执行', async () => {
    // 受控 commit：首个任务挂起，让第二个任务积压在队列里
    const applied: string[] = [];
    let gate: (() => void) | null = null;
    const config: FileSyncConfig<Ref[], FileSyncRenameEvent> = {
      logTag: '[fake-file-sync]',
      failNotice: '测试同步失败，数据可能不一致',
      failDedupeKey: 'fake-file-sync',
      watchedFolders: () => ['卡片盒'],
      commit: (apply) =>
        new Promise<void>((resolve) => {
          gate = () => {
            apply([{ path: '卡片盒/A.md' }]); // apply 执行会推入 applied（路径条目）
            resolve();
          };
        }),
      referencedBy: async () => true,
      applyRename: () => false,
      applyDelete: (_items, path) => {
        applied.push(path);
        return true;
      },
    };
    setSettingsProvider(() => ({ DEBOUNCE_DELAY: '30' } as any));
    const agent = createFileSync(config);
    agent.ensure({ vault: {} } as any);

    emitDomainEvent('vault:md-deleted', { path: '卡片盒/A.md' });
    await sleep(50); // 第一个任务已开跑并挂起在 commit
    emitDomainEvent('vault:md-deleted', { path: '卡片盒/A.md' });
    await sleep(50); // 第二个任务入队排在挂起任务之后

    agent.unload(); // 置位 _cancelled
    gate!(); // 放行第一个任务 → 队列推进
    await sleep(80);

    expect(applied).toEqual(['卡片盒/A.md']); // 只有第一个执行，积压任务首行短路
  });
});

describe('错误语义', () => {
  it('commit 抛错：console.error 带域标签 + notify 带去重键，队列不断链（后续任务照常）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    const { setData } = makeAgent({
      debounce: '30',
      commit: async (apply) => {
        if (fail) throw new Error('boom');
        apply([]);
      },
    });
    setData([{ path: '卡片盒/A.md' }]);

    emitDomainEvent('vault:md-deleted', { path: '卡片盒/A.md' });
    await flushQueue(30);
    expect(notify).toHaveBeenCalledWith('测试同步失败，数据可能不一致', { type: 'error', dedupeKey: 'fake-file-sync' });
    expect(errSpy).toHaveBeenCalledWith('[fake-file-sync]', expect.any(Error));

    fail = false; // 队列 .catch 兜住后链未断：下一任务照常执行
    emitDomainEvent('vault:md-deleted', { path: '卡片盒/A.md' });
    await flushQueue(30);
    expect(notify).toHaveBeenCalledTimes(1); // 失败通知只有第一次
    errSpy.mockRestore();
  });
});
