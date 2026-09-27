/**
 * 详情头删除（issue 500 / 501）：三档门禁落链测试。
 *   - 未画谱 / 画谱未完成 → 弹确认框二次确认（501：废掉「图标灯光 + 通知」那套看不出来的确认）；
 *   - 已画脸谱 → 重输主密码（uiLockScreen + SafeManager.verifyPassword 只读校验），错误不删、通过才删、遮罩取消不删；
 *   - 删之前先停该人未完成任务（引擎是保库记录的唯一写方，任务在队列里会把记录写回来）；
 *   - 删完墙上那张卡立刻消失（501：面板记录快照要同步失效，否则会被合成「待画」占位卡挂回来）。
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
/** 二次确认走核心流程框（openFlowDialog）：遮罩 / 按钮 id 是冻结契约 */
const flowMask = (): HTMLElement | null => document.querySelector<HTMLElement>('#__shared_confirm_mask__');
const flowOk = (): HTMLElement | null => document.querySelector<HTMLElement>('#__shared_confirm_ok__');
const flowCancel = (): HTMLElement | null => document.querySelector<HTMLElement>('#__shared_confirm_cancel__');

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
    await safe.write(p.id, (rec) => {
      rec.person = p;
      // 501 回归：仓里放一条真消息——删完若面板快照没失效，wallPeople 会拿它合成
      // 「待画」占位卡把卡挂回墙上（改前必须关面板 / 重启才消失）
      rec.store = {
        ...rec.store,
        msgs: [{ key: 'm1', ts: Date.parse('2026-09-20T10:00:00Z'), isSender: true, type: 1, text: '在吗' }],
        stats: { msgCount: 1, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 },
      };
    });
  }
  const origRemove = safe.removeContact.bind(safe);
  // 记账放在 await 之后：调用序断言成立（removeJob 是同步入账，必然在前），
  // 且「order 齐了」= 记录真落盘删掉了——不然断言会抢在删除完成前跑，测试发飘
  vi.spyOn(safe, 'removeContact').mockImplementation(async (talker: string) => {
    await origRemove(talker);
    order.push(`removeContact:${talker}`);
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

describe('未画谱档：弹确认框二次确认（issue 500 / 501）', () => {
  it('点删除弹确认框（不是通知消息）；点取消什么都不删、框收起', async () => {
    const order: string[] = [];
    const { safe } = await boot([entry()], order);

    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(flowMask()).toBeTruthy());
    expect(flowMask()!.querySelector('h4')!.textContent).toBe('删除联系人');
    expect(flowMask()!.querySelector('p')!.textContent).toContain('确定删除「莫莫」吗？');
    expect(flowCancel()!.textContent).toBe('取消');
    expect(flowOk()!.textContent).toBe('删除');
    expect(await safe.read('莫莫')).toBeTruthy(); // 还没删

    flowCancel()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(flowMask()).toBeNull());
    await tick();
    expect(await safe.read('莫莫')).toBeTruthy();
    expect(order).toEqual([]);
  });

  it('点遮罩（取消语义）同样不删', async () => {
    const order: string[] = [];
    const { safe } = await boot([entry()], order);

    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(flowMask()).toBeTruthy());
    flowMask()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(flowMask()).toBeNull());
    await tick();
    expect(await safe.read('莫莫')).toBeTruthy();
    expect(order).toEqual([]);
  });

  it('确认后才真删，并回列表；墙上那张卡立刻消失（501 回归）', async () => {
    const order: string[] = [];
    const { safe } = await boot([entry()], order);

    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(flowOk()).toBeTruthy());
    flowOk()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(order).toEqual(['removeJob:莫莫', 'removeContact:莫莫']));
    await vi.waitFor(async () => expect(await safe.read('莫莫')).toBeFalsy());
    expect(hasNotice(/已删除「莫莫」/)).toBe(true);
    // 关键：不等关面板 / 重启，删完这一帧墙上就得没有它
    // （记录快照没失效的话，这条会一直挂着，waitFor 超时即红）
    await vi.waitFor(() => expect(document.querySelector('[data-people-card="莫莫"]')).toBeNull());
    expect(document.querySelector('[data-people-del="莫莫"]')).toBeNull(); // 详情已回墙
  });
});

describe('已画谱档：重输主密码才可删（issue 500）', () => {
  it('点删除弹密码门（不是确认框）；输错不删并提示，输对才删', async () => {
    const order: string[] = [];
    const { safe } = await boot([DRAWN], order);
    await seedVaultPassword();

    click('[data-people-del="莫莫"]');
    await vi.waitFor(() => expect(lockMask()).toBeTruthy());
    expect(flowMask()).toBeNull(); // 已画谱走密码门，不走确认框
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
    await vi.waitFor(async () => expect(await safe.read('莫莫')).toBeFalsy());
    expect(lockMask()).toBeNull(); // 通过即收场
    expect(document.querySelector('[data-people-card="莫莫"]')).toBeNull(); // 卡片同样立刻消失
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
    await vi.waitFor(() => expect(flowOk()).toBeTruthy());
    flowOk()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(order).toHaveLength(2));
    expect(order).toEqual(['removeJob:莫莫', 'removeContact:莫莫']);
    await vi.waitFor(async () => expect(await safe.read('莫莫')).toBeFalsy());
    expect(hasNotice(/未完成的任务一并停掉/)).toBe(true);
  });
});
