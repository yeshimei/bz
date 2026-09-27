/**
 * 详情头删除（issue 500）：三档门禁落链测试。
 *   - 未画谱 / 画谱未完成 → 二次点击确认（第一次武装、3 秒回落，第二次真删）；
 *   - 已画脸谱 → 重输主密码（uiLockScreen + SafeManager.verifyPassword 只读校验），错误不删、通过才删、遮罩取消不删；
 *   - 删之前先停该人未完成任务（引擎是保库记录的唯一写方，任务在队列里会把记录写回来）。
 * 引擎用假件注入（setJobsModuleForTests）；保库注入 MockVault 上的真 SafeManager；数据全构造。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  closePeoplePanel,
  openPeoplePanel,
  setJobsModuleForTests,
  setUnlockGateForTests,
  type JobsApi,
} from '../../src/people/ui';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import { getSafeManager } from '../../src/encrypt';
import type { PersonEntry } from '../../src/people/types';

const PW = 'delete-test-pw';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function click(sel: string): void {
  const node = document.querySelector(sel);
  if (!node) throw new Error(`找不到节点：${sel}`);
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const card = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-people-card="${id}"]`);
const lockMask = (): HTMLElement | null => document.querySelector<HTMLElement>('.bz-lockscreen--mask');
const delBtn = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-people-del="${id}"]`);

/** 假引擎：removeJob 记一笔调用序（真删顺序契约：先停任务、再删记录） */
class FakeEngine implements JobsApi {
  constructor(private readonly order: string[]) {}
  startJobs = async (): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }> =>
    ({ queued: [], skipped: [], resumed: [] });
  resumeJobs = async (): Promise<void> => undefined;
  resume = (): boolean => true;
  pauseJobs = (): void => undefined;
  removeJob = (talker: string): boolean => { this.order.push(`removeJob:${talker}`); return true; };
  subscribe = (): (() => void) => () => undefined;
  snapshot = () => ({ queue: [], currentIndex: -1, running: false });
}

function entry(over: Partial<PersonEntry> = {}): PersonEntry {
  return { id: '莫莫', name: '莫莫', createdAt: '2026-09-25T02:57:37.341Z', imports: [], ...over };
}

const DRAWN: PersonEntry = entry({
  digest: { person: '## 画像速写\n- 凌晨三点还醒着', events: [], generatedAt: '2026-09-26T10:20:30.000Z' },
});

async function boot(seed: PersonEntry[], order: string[]): Promise<{ safe: PeopleSafeStore; sm: SafeManager }> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  const safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
  for (const p of seed) {
    await safe.write(p.id, (rec) => { rec.person = p; });
  }
  const origRemove = safe.removeContact.bind(safe);
  vi.spyOn(safe, 'removeContact').mockImplementation(async (talker: string) => {
    order.push(`removeContact:${talker}`);
    await origRemove(talker);
  });
  setJobsModuleForTests(new FakeEngine(order));
  // 门禁真链会弹真解锁屏（jsdom 里锁不住），只注入放行；密码门走的是真 verifyPassword
  setUnlockGateForTests(() => Promise.resolve(true));
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(card('莫莫')).toBeTruthy());
  click('[data-people-card="莫莫"]');
  await vi.waitFor(() => expect(delBtn('莫莫')).toBeTruthy());
  return { safe, sm };
}

/** 已画谱档：清单落在 encryptDir()（门禁真链的清单根），密码 = PW */
async function seedVaultPassword(): Promise<void> {
  await getSafeManager().unlock(PW);
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setUnlockGateForTests(null);
  setPeopleSafeStoreForTests(null);
  vi.restoreAllMocks();
});

describe('未画谱档：二次点击确认即可删（issue 500）', () => {
  it('第一次点只武装（记录不动 + 提示再点一次），第二次点才真删并回列表', async () => {
    const order: string[] = [];
    const { safe } = await boot([entry()], order);

    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-del="莫莫"]')!.getAttribute('aria-label')).toBe('再点确认删除'));
    expect(await safe.read('莫莫')).toBeTruthy(); // 没删
    expect(order).toEqual([]);
    expect(hasNotice(/再点一次「删除」确认/)).toBe(true);

    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(order).toContain('removeContact:莫莫'));
    expect(await safe.read('莫莫')).toBeFalsy();
    expect(hasNotice(/已删除「莫莫」/)).toBe(true);
    expect(document.querySelector('[data-people-card="莫莫"]')).toBeNull(); // 详情已回墙
  });

  it('武装态 3 秒回落（不改数据，只回普通态）——用假定时器推时间', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const order: string[] = [];
      const { safe } = await boot([entry()], order);
      click('[data-people-del="莫莫"]');
      await vi.waitFor(() => expect(document.querySelector('[data-people-del="莫莫"]')!.getAttribute('aria-label')).toBe('再点确认删除'));
      vi.advanceTimersByTime(3100);
      await vi.waitFor(() => expect(document.querySelector('[data-people-del="莫莫"]')!.getAttribute('aria-label')).toBe('删除'));
      expect(await safe.read('莫莫')).toBeTruthy();
      expect(order).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('已画谱档：重输主密码才可删（issue 500）', () => {
  it('点删除弹密码门（不是武装态）；输错不删并提示，输对才删', async () => {
    const order: string[] = [];
    const { safe } = await boot([DRAWN], order);
    await seedVaultPassword();

    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(lockMask()).toBeTruthy());
    const mask = lockMask()!;
    expect(mask.classList.contains('bz-lockscreen--people')).toBe(true);
    expect(mask.querySelector('[data-ls="title"]')!.textContent).toBe('删除确认');
    expect(mask.querySelector('[data-ls="sub"]')!.textContent).toContain('脸谱生成于 2026-09-26');
    expect(mask.querySelector('[data-ls="go"]')!.textContent).toBe('确认删除');

    const input = mask.querySelector<HTMLInputElement>('[data-ls="p1"]')!;
    input.value = 'wrong-pw';
    mask.querySelector<HTMLButtonElement>('[data-ls="go"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(mask.querySelector('[data-ls="err"]')!.textContent).toContain('主密码错误，未删除'));
    expect(await safe.read('莫莫')).toBeTruthy(); // 没删
    expect(lockMask()).toBeTruthy(); // 门还开着

    input.value = PW;
    mask.querySelector<HTMLButtonElement>('[data-ls="go"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(order).toEqual(['removeJob:莫莫', 'removeContact:莫莫']));
    expect(await safe.read('莫莫')).toBeFalsy();
    expect(lockMask()).toBeNull(); // 通过即收场
  });

  it('密码门取消（点遮罩）→ 什么都不删', async () => {
    const order: string[] = [];
    const { safe } = await boot([DRAWN], order);
    await seedVaultPassword();

    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(lockMask()).toBeTruthy());
    lockMask()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(lockMask()).toBeNull());
    await tick();
    expect(await safe.read('莫莫')).toBeTruthy();
    expect(order).toEqual([]);
  });

  it('主密码为空直接拦下（不发校验、不删）', async () => {
    const order: string[] = [];
    const { safe } = await boot([DRAWN], order);
    await seedVaultPassword();

    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(lockMask()).toBeTruthy());
    const mask = lockMask()!;
    mask.querySelector<HTMLButtonElement>('[data-ls="go"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(mask.querySelector('[data-ls="err"]')!.textContent).toContain('请输入主密码确认'));
    expect(await safe.read('莫莫')).toBeTruthy();
    expect(order).toEqual([]);
  });
});

describe('删除口径（issue 500）：先停任务再删记录，数据源目录不动', () => {
  it('删之前先调 removeJob（引擎是保库记录的写方，任务留着会把记录写回来）', async () => {
    const order: string[] = [];
    const { safe } = await boot([entry()], order);
    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(delBtn('莫莫')!.getAttribute('aria-label')).toBe('再点确认删除'));
    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(order).toHaveLength(2));
    expect(order).toEqual(['removeJob:莫莫', 'removeContact:莫莫']);
    expect(await safe.read('莫莫')).toBeFalsy();
    expect(hasNotice(/未完成的任务一并停掉/)).toBe(true);
  });
});
