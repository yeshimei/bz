/**
 * D1 可靠写契约回归测试（core/storage 三原语）：
 * - enqueueFileTask：同路径 FIFO 串行 / 异路径并行 / 任务异常不堵队列
 * - updateFileSections / mergeWriteSections：只动声明段 / 读-改-段写一步式 / 并发段写不丢更新 /
 *   缺省基底 / 非对象形态抛错
 * - 冲突留档：解析失败、写失败留档 CONFIG/.CORRUPT + 人话化通知 + 同文件去重（见文件后半段）
 *
 * 含通知 toast 文案断言（需 DOM），故本文件保持默认 jsdom 环境（不加 node 环境标注）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueFileTask,
  mergeWriteSections,
  updateFileSections,
  jsonFileStore,
  __resetCorruptNotifyForTests,
} from '../../src/core/storage';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { __resetNoticeForTests } from '../../src/core/notice';

/** 让微任务队列与挂起的定时器跑完（串行/并行断言前的确定性同步点） */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('enqueueFileTask（D1 原语 1：同文件读改写串行队列）', () => {
  beforeEach(() => {
    setSettingsProvider(() => ({} as any));
  });

  it('同路径任务 FIFO 串行：前序未完成前后续不启动', async () => {
    const events: string[] = [];
    const gates: Array<() => void> = [];
    const t1 = enqueueFileTask('a.json', async () => {
      events.push('t1-start');
      await new Promise<void>((r) => gates.push(r)); // 挂起模拟慢 IO
      events.push('t1-end');
      return 1;
    });
    const t2 = enqueueFileTask('a.json', async () => {
      events.push('t2-start');
      return 2;
    });
    await tick();
    expect(events).toEqual(['t1-start']); // t2 未抢跑
    gates.shift()!();
    expect(await t1).toBe(1);
    expect(await t2).toBe(2);
    expect(events).toEqual(['t1-start', 't1-end', 't2-start']);
  });

  it('异路径任务并行：慢文件不阻塞其他文件', async () => {
    let releaseA: (() => void) | null = null;
    const aDone = enqueueFileTask('slow.json', () => new Promise<string>((r) => { releaseA = () => r('a'); }));
    const bDone = enqueueFileTask('other.json', async () => 'b');
    await tick();
    expect(await bDone).toBe('b'); // a 还挂着，b 已完成
    releaseA!();
    expect(await aDone).toBe('a');
  });

  it('任务异常不堵队列：错误只上抛该调用方，后续任务照常执行', async () => {
    const t1 = enqueueFileTask('a.json', async () => {
      throw new Error('boom');
    });
    const t2 = enqueueFileTask('a.json', async () => 'ok');
    await expect(t1).rejects.toThrow('boom');
    expect(await t2).toBe('ok');
    // 队列清空后再入队立即执行（条目随队尾清理，不积压）
    const t3 = enqueueFileTask('a.json', async () => 'again');
    expect(await t3).toBe('again');
  });
});

describe('updateFileSections / mergeWriteSections（D1 原语 2：段级合并写）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
  });

  it('只动声明段：未声明段保留磁盘现值（双写者不互踩）', async () => {
    vault.files.set(
      'CONFIG/STORAGE/news.json',
      JSON.stringify({ articles: [1, 2], stats: { totalRead: 5 }, sources: { zhihu: true } })
    );
    await mergeWriteSections<{ articles: unknown[]; stats: { totalRead: number }; sources: Record<string, boolean> }>(
      'CONFIG/STORAGE/news.json',
      { stats: { totalRead: 6 } }
    );
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/news.json')!)).toEqual({
      articles: [1, 2],
      stats: { totalRead: 6 },
      sources: { zhihu: true },
    });
  });

  it('读-改-段写一步式：writer 拿磁盘现值产出声明段，返回合并后完整对象', async () => {
    vault.files.set('CONFIG/STORAGE/data.json', JSON.stringify({ n: 1, keep: 'x' }));
    const next = await updateFileSections<{ n: number; keep: string }>('CONFIG/STORAGE/data.json', (cur) => ({
      n: cur.n + 1,
    }));
    expect(next).toEqual({ n: 2, keep: 'x' });
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/data.json')!)).toEqual({ n: 2, keep: 'x' });
  });

  it('并发段写不丢更新：两个 writer 各改一段，两段都落盘（裸读改写此处会互相覆盖）', async () => {
    vault.files.set('CONFIG/STORAGE/both.json', JSON.stringify({ a: 0, b: 0 }));
    const p1 = updateFileSections<{ a: number; b: number }>('CONFIG/STORAGE/both.json', async (cur) => {
      await new Promise((r) => setTimeout(r, 5)); // 读后处理延迟，制造交错窗口
      return { a: cur.a + 1 };
    });
    const p2 = updateFileSections<{ a: number; b: number }>('CONFIG/STORAGE/both.json', async (cur) => ({
      b: cur.b + 1,
    }));
    await Promise.all([p1, p2]);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/both.json')!)).toEqual({ a: 1, b: 1 });
  });

  it('缺失文件 → defaultValue 基底 + 声明段落盘', async () => {
    await mergeWriteSections<{ articles: unknown[]; sources: Record<string, boolean> }>(
      'CONFIG/STORAGE/fresh.json',
      { sources: { zhihu: true } },
      { defaultValue: { articles: [], sources: { zhihu: false } } }
    );
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/fresh.json')!)).toEqual({
      articles: [],
      sources: { zhihu: true },
    });
  });

  it('writer 返回空声明（falsy）→ 原样落盘不抛', async () => {
    vault.files.set('CONFIG/STORAGE/none.json', JSON.stringify({ a: 1 }));
    await updateFileSections('CONFIG/STORAGE/none.json', () => undefined as any);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/none.json')!)).toEqual({ a: 1 });
  });

  it('磁盘现值非对象形态（数组）→ 抛错不写盘（防静默改形丢数据）', async () => {
    vault.files.set('CONFIG/STORAGE/legacy.json', JSON.stringify([1, 2, 3]));
    await expect(mergeWriteSections('CONFIG/STORAGE/legacy.json', { a: 1 })).rejects.toThrow('对象形态');
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/legacy.json')!)).toEqual([1, 2, 3]); // 原文件未动
  });
});

// ---------- 冲突留档（D1 原语 3） ----------

/** 通知侧隔离：清 toast DOM 与两级去重状态（notice 30s 窗口 + storage 留档通知 30s 窗口） */
function resetNoticeSide(): void {
  __resetNoticeForTests();
  __resetCorruptNotifyForTests();
  document.getElementById('bz-notice-container')?.remove();
}

describe('冲突留档：解析失败（D1 原语 3）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
    resetNoticeSide();
  });

  it('解析失败 → 原样留档 CONFIG/.CORRUPT（目录自动建）+ 降级初始化默认值', async () => {
    const broken = '{"x":'; // 半截 JSON（崩溃/同步冲突现场）
    vault.files.set('CONFIG/STORAGE/data.json', broken);
    expect(await jsonFileStore<unknown[]>('CONFIG/STORAGE/data.json', { defaultValue: [] }).read()).toEqual([]);
    // 留档目录已创建，留档文件名 <原文件名>.<yyyymmdd-hhmmss>.bak，内容 = 原文
    expect(vault.dirs.has('CONFIG/.CORRUPT')).toBe(true);
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/data.json.'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^CONFIG\/\.CORRUPT\/data\.json\.\d{8}-\d{6}\.bak$/);
    expect(vault.files.get(backups[0])).toBe(broken);
    // 原路径降级初始化为默认值
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/data.json')!)).toEqual([]);
  });

  it('留档文件名同秒撞名 → 追加 -N 序号不覆盖', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-09-04T10:08:00'));
      const store = jsonFileStore<unknown[]>('CONFIG/STORAGE/col.json', { defaultValue: [] });
      vault.files.set('CONFIG/STORAGE/col.json', '{a');
      await store.read();
      vault.files.set('CONFIG/STORAGE/col.json', '{b');
      await store.read();
      const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/col.json.')).sort();
      expect(backups).toEqual([
        'CONFIG/.CORRUPT/col.json.20260904-100800-2.bak',
        'CONFIG/.CORRUPT/col.json.20260904-100800.bak',
      ]);
      expect(vault.files.get(backups[0])).toBe('{b');
      expect(vault.files.get(backups[1])).toBe('{a');
    } finally {
      vi.useRealTimers();
      resetNoticeSide();
    }
  });

  it('留档失败（create 抛错）→ 原流程继续：降级重建照常、read 不抛', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const origCreate = vault.create.bind(vault);
    vault.create = async (path: string, content: string) => {
      if (path.startsWith('CONFIG/.CORRUPT/')) throw new Error('disk full');
      return origCreate(path, content);
    };
    try {
      vault.files.set('CONFIG/STORAGE/bad.json', '{broken');
      expect(await jsonFileStore<unknown[]>('CONFIG/STORAGE/bad.json', { defaultValue: [] }).read()).toEqual([]);
      expect([...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/'))).toHaveLength(0);
      expect(JSON.parse(vault.files.get('CONFIG/STORAGE/bad.json')!)).toEqual([]);
    } finally {
      vault.create = origCreate;
      warnSpy.mockRestore();
    }
  });

  it('onCorrupt 返回 false → 不留档不清盘（P1-32「不清盘」语义保持，且不重复弹 core 通知）', async () => {
    const broken = '{broken';
    vault.files.set('CONFIG/STORAGE/keep.json', broken);
    const store = jsonFileStore<unknown[] | null>('CONFIG/STORAGE/keep.json', { onCorrupt: () => false });
    expect(await store.read()).toBeNull();
    expect([...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/'))).toHaveLength(0);
    expect(vault.files.get('CONFIG/STORAGE/keep.json')).toBe(broken);
    expect(document.querySelectorAll('#bz-notice-container .bz-notice')).toHaveLength(0);
  });

  it('段写遇损坏文件 → 留档 + 降级初始化后以默认值为基底继续段写', async () => {
    vault.files.set('CONFIG/STORAGE/sec.json', '{broken');
    const next = await updateFileSections<{ articles: unknown[]; sources: Record<string, boolean> }>(
      'CONFIG/STORAGE/sec.json',
      () => ({ sources: { zhihu: true } }),
      { defaultValue: { articles: [], sources: { zhihu: false } } }
    );
    expect(next).toEqual({ articles: [], sources: { zhihu: true } });
    expect([...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/sec.json.'))).toHaveLength(1);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/sec.json')!)).toEqual({
      articles: [],
      sources: { zhihu: true },
    });
  });
});

describe('冲突留档：写失败兜底（D1 原语 3）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
    resetNoticeSide();
  });

  it('写失败 → 盘上原内容原样留档 + 原错误照抛（P2-3 调用方提示语义不变）', async () => {
    const old = JSON.stringify({ old: true });
    vault.files.set('CONFIG/STORAGE/w.json', old);
    const origModify = vault.modify.bind(vault);
    vault.modify = async (f: any, c: string) => {
      if (f.path === 'CONFIG/STORAGE/w.json') throw new Error('adapter locked');
      return origModify(f, c);
    };
    await expect(jsonFileStore('CONFIG/STORAGE/w.json').write({ fresh: 1 })).rejects.toThrow('adapter locked');
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/w.json.'));
    expect(backups).toHaveLength(1);
    expect(vault.files.get(backups[0])).toBe(old); // 写前内容留档
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/w.json')!)).toEqual({ old: true }); // 盘上未被破坏
  });
});

describe('留档通知：人话文案 + 同文件去重（D1 原语 3）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
    resetNoticeSide();
  });

  it('留档成功 → warning 通知含留档路径、文件名与「数据不会丢」', async () => {
    vault.files.set('CONFIG/STORAGE/toast.json', '{broken');
    await jsonFileStore<unknown[]>('CONFIG/STORAGE/toast.json', { defaultValue: [] }).read();
    const el = document.querySelector('#bz-notice-container .bz-notice--warning .bz-notice-msg');
    expect(el).toBeTruthy();
    const text = el!.textContent || '';
    const backup = [...vault.files.keys()].find((p) => p.startsWith('CONFIG/.CORRUPT/toast.json.'));
    expect(text).toContain('toast.json');
    expect(text).toContain(backup!);
    expect(text).toContain('数据不会丢');
  });

  it('写失败留档 → 通知文案区分「写入失败」', async () => {
    const origModify = vault.modify.bind(vault);
    vault.modify = async () => {
      throw new Error('locked');
    };
    vault.files.set('CONFIG/STORAGE/wf.json', '{}');
    await expect(jsonFileStore('CONFIG/STORAGE/wf.json').write({})).rejects.toThrow('locked');
    const text = document.querySelector('#bz-notice-container .bz-notice-msg')!.textContent || '';
    expect(text).toContain('写入失败');
    expect(text).toContain('数据不会丢');
  });

  it('同文件短时间重复失败 → 通知去重不刷屏，窗口过后恢复弹出', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-09-04T10:00:00'));
      const store = jsonFileStore<unknown[]>('CONFIG/STORAGE/dup.json', { defaultValue: [] });
      vault.files.set('CONFIG/STORAGE/dup.json', '{a');
      await store.read();
      vi.setSystemTime(new Date('2026-09-04T10:00:05'));
      vault.files.set('CONFIG/STORAGE/dup.json', '{b');
      await store.read();
      expect(document.querySelectorAll('#bz-notice-container .bz-notice')).toHaveLength(1); // 5s 内去重
      vi.setSystemTime(new Date('2026-09-04T10:00:36'));
      vault.files.set('CONFIG/STORAGE/dup.json', '{c');
      await store.read();
      expect(document.querySelectorAll('#bz-notice-container .bz-notice')).toHaveLength(2); // 31s 后恢复
    } finally {
      vi.useRealTimers();
      resetNoticeSide();
    }
  });

  it('通知去重只抑制弹窗：重复失败每次现场照常留档', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-09-04T10:00:00'));
      const store = jsonFileStore<unknown[]>('CONFIG/STORAGE/sil.json', { defaultValue: [] });
      vault.files.set('CONFIG/STORAGE/sil.json', '{a');
      await store.read();
      vault.files.set('CONFIG/STORAGE/sil.json', '{b');
      await store.read();
      const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/sil.json.'));
      expect(backups).toHaveLength(2); // 每次失败现场都留档
    } finally {
      vi.useRealTimers();
      resetNoticeSide();
    }
  });
});
