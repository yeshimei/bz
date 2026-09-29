/**
 * 解锁后首开面板的冷读加载指示测试（issue 483；505 起指示就写在相册簿的那一摊上）：
 * - 冷读（readAll 逐人解密）期间「解密中」的那一摊 + 「N/M 位」立即可见，任何联系人数据不出现；
 * - 进度计数经 readAll 回调原位推进（0/2 → 1/2），不重建那一摊；
 * - 加载完成原地替换成真实册页（照片格 replace），加载那一摊移除；
 * - 重开面板（保库记录缓存命中 = 整库热读）不出加载摊；
 * - 上锁 → 再解锁的同一路径行为一致（记录缓存已清 → 再次出加载摊 → 替换）。
 * 引擎用假件注入；readAll 经实例包装放慢（不注入新缝，贴真链）；数据全构造。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  closePeoplePanel,
  openPeoplePanel,
  setJobsModuleForTests,
  type JobsApi,
} from '../../src/people/ui';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { PersonEntry } from '../../src/people/types';

const PW = 'load-test-pw';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** 空引擎：只占位（本轮测的是冷读加载，不测生成） */
class FakeEngine implements JobsApi {
  startJobs = async (): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }> => ({ queued: [], skipped: [], resumed: [] });
  resumeJobs = async (): Promise<void> => undefined;
  resume = (): boolean => true;
  pauseJobs = (): void => undefined;
  removeJob = (): boolean => false;
  subscribe = (): (() => void) => () => undefined;
  snapshot = () => ({ queue: [], currentIndex: -1, running: false });
}

function entry(id: string): PersonEntry {
  return { id, name: id, createdAt: '2026-09-25T02:57:37.341Z', imports: [] };
}

/** 那位贴在册页上的照片格（505 起墙上的卡就是相册里的一格） */
const pocket = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-people-pocket="${id}"]`);
/** 解密中的那一摊 */
const loadingSpread = (): HTMLElement | null => document.querySelector<HTMLElement>('.bz-people-spread-load');
const countEl = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-people-load-num]');

/** 面板装配（467 范式）：解锁保库 + 注入共享 PeopleSafeStore；种子两位联系人 */
async function boot(): Promise<{ safe: PeopleSafeStore; sm: SafeManager }> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  const safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
  for (const p of [entry('莫莫'), entry('大琳')]) {
    await safe.write(p.id, (rec) => {
      rec.person = p;
    });
  }
  return { safe, sm };
}

/**
 * readAll 放慢包装：真链保留（逐人解密照跑），用三道闸把进度切开观察——
 * openGate 放行前 readAll 不启动（解密摊悬着）；midGate / lastGate 依次放行，逐段观察 0/2 → 1/2。
 */
function slowReadAll(safe: PeopleSafeStore): { releaseOpen: () => void; releaseMid: () => void; releaseLast: () => void } {
  let releaseOpen = () => undefined as void;
  let releaseMid = () => undefined as void;
  let releaseLast = () => undefined as void;
  const openGate = new Promise<void>((r) => (releaseOpen = r));
  const midGate = new Promise<void>((r) => (releaseMid = r));
  const lastGate = new Promise<void>((r) => (releaseLast = r));
  const orig = safe.readAll.bind(safe);
  (safe as unknown as { readAll: unknown }).readAll = async (cb?: (d: number, t: number) => void) => {
    await openGate;
    cb?.(0, 2);
    await midGate;
    cb?.(1, 2);
    await lastGate;
    return orig(cb); // 真链收尾：缓存 (1,2) (2,2) 照报，记录落 store 缓存供热读
  };
  return { releaseOpen, releaseMid, releaseLast };
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  setJobsModuleForTests(new FakeEngine());
});

afterEach(() => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setPeopleSafeStoreForTests(null);
});

describe('冷读加载指示（issue 483 / 505）', () => {
  it('解锁后首开：解密摊 + 「N/M 位」立即可见，解密完成原地替换成真实册页', async () => {
    const { safe } = await boot();
    safe.clearPlainCaches(); // 模拟刚解锁的冷读（解锁事件本来就会清明文缓存）
    const g = slowReadAll(safe);
    openPeoplePanel(getApp());
    await tick();
    await tick();
    // 解密摊先出：页眉写「正在解密联系人数据」+ 空位格；真实照片格与联系人名一个都不出现
    expect(loadingSpread()).toBeTruthy();
    expect(document.body.textContent).toContain('正在解密联系人数据');
    expect(document.querySelectorAll('.bz-people-cell.bz-people-wait').length).toBeGreaterThan(0);
    expect(pocket('莫莫')).toBeNull();
    expect(document.body.textContent).not.toContain('莫莫'); // 名字（加密索引）不可见

    // 放行开跑：计数原位推进 0/2 → 1/2（同一计数节点，只换文字不重建那一摊）
    g.releaseOpen();
    await vi.waitFor(() => expect(countEl()!.textContent).toBe('0'));
    await vi.waitFor(() => expect(document.querySelector<HTMLElement>('.bz-people-load-total')!.textContent).toBe('/ 2 位'));
    expect(loadingSpread()).toBeTruthy();
    g.releaseMid();
    await vi.waitFor(() => expect(countEl()!.textContent).toBe('1'));

    // 加载完成：真实册页原地呈现，解密摊（含计数）随替换消失
    g.releaseLast();
    await vi.waitFor(() => expect(pocket('莫莫')).toBeTruthy());
    expect(loadingSpread()).toBeNull();
    expect(countEl()).toBeNull();
    expect(pocket('大琳')).toBeTruthy();
  });

  it('重开面板（保库记录缓存命中，整库热读）不出解密摊', async () => {
    await boot(); // 首开前 write 已把记录写进保库（store 缓存温热）
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(pocket('莫莫')).toBeTruthy());
    closePeoplePanel();

    // 重开：ui 级快照已随关闭失效，但 store 级缓存命中（isFullyCached）→ 不出解密摊
    openPeoplePanel(getApp());
    await tick();
    await tick();
    expect(loadingSpread()).toBeNull();
    await vi.waitFor(() => expect(pocket('莫莫')).toBeTruthy());
    expect(loadingSpread()).toBeNull();
  });

  it('上锁 → 再解锁的同一路径行为一致：记录缓存已清，再解锁重新出解密摊', async () => {
    const { safe, sm } = await boot();
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(pocket('莫莫')).toBeTruthy());

    sm.lock(); // 任意路径上锁 → 面板合上只剩封皮 + 明文缓存清空
    await vi.waitFor(() => expect(document.querySelector('.bz-people-locked')).toBeTruthy());
    expect(document.querySelector('.bz-people-cover')).toBeTruthy();
    expect(pocket('莫莫')).toBeNull();

    const g = slowReadAll(safe); // 再解锁后的冷读放慢，观察加载摊
    sm.unlock(PW);
    await vi.waitFor(() => expect(loadingSpread()).toBeTruthy());
    expect(pocket('莫莫')).toBeNull();
    g.releaseOpen();
    g.releaseMid();
    g.releaseLast();
    await vi.waitFor(() => expect(pocket('莫莫')).toBeTruthy());
    expect(loadingSpread()).toBeNull();
  });
});
