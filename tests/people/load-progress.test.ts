/**
 * 解锁后首开面板的冷读加载指示测试（issue 483）：
 * - 冷读（readAll 逐人解密）期间骨架 + 「正在解密联系人数据… N/M」立即可见，任何联系人数据不出现；
 * - 进度计数经 readAll 回调原位推进（0/2 → 1/2），不重建骨架；
 * - 加载完成原地替换成真实数据（replaceChildren 单次替换），加载态节点移除；
 * - 重开面板（保库记录缓存命中 = 整库热读）不出加载态；
 * - 上锁 → 再解锁的同一路径行为一致（记录缓存已清 → 再次出加载态 → 替换）。
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

const card = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-people-card="${id}"]`);
const loadingEl = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-people-loading]');
const countEl = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-people-load-count]');

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
 * openGate 放行前 readAll 不启动（骨架悬着）；midGate / lastGate 依次放行，逐段观察 0/2 → 1/2。
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

describe('冷读加载指示（issue 483）', () => {
  it('解锁后首开：骨架 + 加载文案 + N/M 计数立即可见，解密完成原地替换成真实数据', async () => {
    const { safe } = await boot();
    safe.clearPlainCaches(); // 模拟刚解锁的冷读（解锁事件本来就会清明文缓存）
    const g = slowReadAll(safe);
    openPeoplePanel(getApp());
    await tick();
    await tick();
    // 骨架先出：加载行 + 计数 + 折子墙占位卡；真实卡片与联系人名一个都不出现
    expect(loadingEl()).toBeTruthy();
    expect(document.body.textContent).toContain('正在解密联系人数据…');
    expect(document.querySelectorAll('.bz-people-load-card').length).toBeGreaterThan(0);
    expect(card('莫莫')).toBeNull();
    expect(document.body.textContent).not.toContain('莫莫'); // 名字（加密索引）不可见

    // 放行开跑：计数原位推进 0/2 → 1/2（同一计数节点，只换文字不重建骨架）
    g.releaseOpen();
    await vi.waitFor(() => expect(countEl()!.textContent).toBe('0/2'));
    expect(loadingEl()).toBeTruthy();
    g.releaseMid();
    await vi.waitFor(() => expect(countEl()!.textContent).toBe('1/2'));

    // 加载完成：真实数据原地呈现，加载态（含计数）随 replaceChildren 消失
    g.releaseLast();
    await vi.waitFor(() => expect(card('莫莫')).toBeTruthy());
    expect(loadingEl()).toBeNull();
    expect(card('大琳')).toBeTruthy();
  });

  it('重开面板（保库记录缓存命中，整库热读）不出加载态', async () => {
    await boot(); // 首开前 write 已把记录写进保库（store 缓存温热）
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('莫莫')).toBeTruthy());
    closePeoplePanel();

    // 重开：ui 级快照已随关闭失效，但 store 级缓存命中（isFullyCached）→ 不出骨架
    openPeoplePanel(getApp());
    await tick();
    await tick();
    expect(loadingEl()).toBeNull();
    await vi.waitFor(() => expect(card('莫莫')).toBeTruthy());
    expect(loadingEl()).toBeNull();
  });

  it('上锁 → 再解锁的同一路径行为一致：记录缓存已清，再解锁重新出加载态', async () => {
    const { safe, sm } = await boot();
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('莫莫')).toBeTruthy());

    sm.lock(); // 任意路径上锁 → 面板转锁定占位 + 明文缓存清空
    await vi.waitFor(() => expect(document.querySelector('.bz-people-locked')).toBeTruthy());
    expect(card('莫莫')).toBeNull();

    const g = slowReadAll(safe); // 再解锁后的冷读放慢，观察加载态
    sm.unlock(PW);
    await vi.waitFor(() => expect(loadingEl()).toBeTruthy());
    expect(card('莫莫')).toBeNull();
    g.releaseOpen();
    g.releaseMid();
    g.releaseLast();
    await vi.waitFor(() => expect(card('莫莫')).toBeTruthy());
    expect(loadingEl()).toBeNull();
  });
});
