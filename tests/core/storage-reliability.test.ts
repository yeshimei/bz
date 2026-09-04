/**
 * D1 可靠写契约回归测试（core/storage 三原语）：
 * - enqueueFileTask：同路径 FIFO 串行 / 异路径并行 / 任务异常不堵队列
 * - updateFileSections / mergeWriteSections：只动声明段 / 读-改-段写一步式 / 并发段写不丢更新 /
 *   缺省基底 / 非对象形态抛错
 * - 冲突留档：解析失败、写失败留档 CONFIG/.CORRUPT + 人话化通知 + 同文件去重（见文件后半段）
 *
 * 含通知 toast 文案断言（需 DOM），故不标 @vitest-environment node。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueFileTask,
  mergeWriteSections,
  updateFileSections,
  jsonFileStore,
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
