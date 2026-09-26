/**
 * 封面墙成员口径测试（issue 452）：墙 = 人物卡 ∪ 聊天仓联系人。
 * 522 的实例是「导入所选只进仓」（447）导致「导入了素材但没画过」的人在面板上彻底不可见
 * （真实数据：大琳 18477 条只在 people-preview.json 里）——本轮给无卡者合成内存占位卡，
 * 并对占位卡上的档案 / 随手记写入做「先建空卡」兜底。
 * 引擎用假件注入（setJobsModuleForTests）；数据全构造。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closePeoplePanel, isPeopleOpen, openPeoplePanel, setJobsModuleForTests, setUnlockGateForTests, type JobsApi } from '../../src/people/ui';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { PersonEntry } from '../../src/people/types';
import type { StoreContact } from '../../src/people/datasource';

const T0 = new Date('2026-09-25T08:00:00').getTime();
const PW = 'wall-test-pw';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** 空引擎：只记调用（本轮测的是墙，不测生成） */
class FakeEngine implements JobsApi {
  calls = { start: [] as unknown[], pause: 0, resume: [] as string[], remove: [] as string[] };
  startJobs = async (_app: unknown, targets: unknown[]): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }> => {
    this.calls.start.push(targets);
    return { queued: [], skipped: [], resumed: [] };
  };
  resumeJobs = async (): Promise<void> => undefined;
  resume = (t: string): boolean => { this.calls.resume.push(t); return true; };
  pauseJobs = (): void => { this.calls.pause++; };
  removeJob = (): boolean => false;
  subscribe = (): (() => void) => () => undefined;
  snapshot = () => ({ queue: [], currentIndex: -1, running: false });
}

/** 聊天仓种子（467：写进该联系人的保库记录 store 段；条数 / 首尾跨度即卡面水位口径，media = 侧写媒体计数） */
async function seedPreview(
  safe: PeopleSafeStore,
  id: string,
  count: number,
  updatedAt = '2026-09-25T08:00:00.000Z',
  media: { voiceCount?: number; voiceTotalSec?: number; imageCount?: number } = {}
): Promise<void> {
  const store: StoreContact = {
    msgs: Array.from({ length: count }, (_, i) => ({ key: `s${i}`, ts: T0 + i * 60_000, isSender: i % 2 === 1, type: 1, text: `构造消息${i}` })),
    watermarkSid: count,
    stats: {
      msgCount: count,
      voiceCount: media.voiceCount ?? 0,
      voiceTotalSec: media.voiceTotalSec ?? 0,
      imageCount: media.imageCount ?? 0,
    },
    updatedAt,
  };
  await safe.write(id, (rec) => {
    rec.store = store;
  });
}

const card = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-people-card="${id}"]`);
const cardMeta = (id: string): string => card(id)!.querySelector('.bz-people-fold-meta')!.textContent!;
const cardWho = (id: string): string => card(id)!.querySelector('.bz-people-fold-who')!.textContent!;
const cardSeal = (id: string): string => card(id)!.querySelector('.bz-people-seal')!.textContent!;

function entry(over: Partial<PersonEntry> = {}): PersonEntry {
  return { id: '莫莫', name: '莫莫', createdAt: '2026-09-25T02:57:37.341Z', imports: [], ...over };
}

/** 面板装配（467）：解锁保库 + 注入共享 PeopleSafeStore；人物卡种子 = 保库记录 person 段 */
async function boot(seed?: PersonEntry[]): Promise<{ vault: MockVault; safe: PeopleSafeStore; sm: SafeManager }> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  const safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
  for (const p of seed ?? []) {
    await safe.write(p.id, (rec) => {
      rec.person = p;
    });
  }
  return { vault, safe, sm };
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

describe('墙成员 = 人物卡 ∪ 聊天仓（452）', () => {
  it('聊天仓有素材、people.json 没卡 → 上墙为「待画」折子，条数与跨度取时间线口径', async () => {
    const { safe } = await boot([entry({ imports: [{ file: '数据源:莫莫', importedAt: '2026-09-25T02:57:37.341Z', messageCount: 126, skippedCount: 0, timeFrom: '2026-03-03T17:55:24.000Z', timeTo: '2026-03-27T12:58:06.000Z' }] })]);
    await seedPreview(safe, '大琳', 3);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('大琳')).toBeTruthy());

    expect(card('大琳')!.querySelector('.bz-people-seal')!.textContent).toBe('待画'); // 451 四态的未画谱
    expect(cardMeta('大琳')).toBe('3 条'); // 聊天仓时间线口径，不是「尚无消息」
    expect(cardMeta('莫莫')).toBe('126 条'); // 有卡者走导入记录口径
    expect(document.querySelectorAll('[data-people-card]')).toHaveLength(2);
  });

  it('只看不写：合成卡不落人物卡（合成导入记录只喂渲染；记录 person.imports 保持空）', async () => {
    const { safe } = await boot();
    await seedPreview(safe, '大琳', 5);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('大琳')).toBeTruthy());
    await tick();
    expect((await safe.read('大琳'))?.person.imports ?? []).toEqual([]); // 盘上零变更
    expect(cardWho('大琳')).toBe('2026-09 ~ 2026-09'); // 跨度来自聊天仓首尾
  });

  it('有卡但还没有导入记录（手写档案建的卡）→ 卡面水位用聊天仓兜底', async () => {
    const { safe } = await boot([entry({ id: '大琳', name: '大琳' })]);
    await seedPreview(safe, '大琳', 7);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('大琳')).toBeTruthy());
    expect(cardMeta('大琳')).toBe('7 条');
    expect(document.querySelectorAll('[data-people-card]')).toHaveLength(1); // 不重复出卡
  });

  it('空记录出「尚无消息」卡（467：记录 = 人物卡 + 聊天仓一体，清空数据不动卡）；无记录的联系人不上墙', async () => {
    const { safe } = await boot([entry()]);
    await safe.write('空仓', (rec) => {
      rec.store = { msgs: [], watermarkSid: 0, stats: { msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, updatedAt: '2026-09-25T00:00:00.000Z' };
    });
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('莫莫')).toBeTruthy());
    // 记录本身即人物卡：空数据显示「尚无消息」，不再复刻旧「仓在卡不在」的占位形态
    expect(card('空仓')!.querySelector('.bz-people-fold-meta')!.textContent).toBe('尚无消息');
    expect(document.querySelectorAll('[data-people-card]')).toHaveLength(2);
  });

  it('点占位卡的印章「待画」→ 用聊天仓素材交引擎画脸谱（451 × 452 接上）', async () => {
    const { safe } = await boot();
    await seedPreview(safe, '大琳', 4);
    const engine = new FakeEngine();
    setJobsModuleForTests(engine);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('大琳')).toBeTruthy());

    click('[data-people-card="大琳"] [data-people-seal-act="draw"]');
    await vi.waitFor(() => expect(engine.calls.start).toHaveLength(1));
    const targets = engine.calls.start[0] as Array<{ talker: string; msgs: unknown[] }>;
    expect(targets[0].talker).toBe('大琳');
    expect(targets[0].msgs).toHaveLength(4);
  });

  it('在占位卡上存档案：先落一张空卡再写，不抛「人物不存在」（455 档案页改弹窗，路径同款）', async () => {
    const { safe } = await boot();
    await seedPreview(safe, '大琳', 3);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('大琳')).toBeTruthy());

    click('[data-people-card="大琳"]'); // 进详情
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-open]')).toBeTruthy());
    click('[data-people-prof-open]'); // 开「补充背景」弹窗
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-pop] [data-people-prof-new]')).toBeTruthy()); // 无档案 → 补档入口
    click('[data-people-prof-new]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-save]')).toBeTruthy());
    document.querySelector<HTMLInputElement>('[data-people-prof-field="job"]')!.value = '插画师';
    click('[data-people-prof-save]');
    await vi.waitFor(async () => expect((await safe.read('大琳'))?.person.profile?.job).toBe('插画师'));

    const saved = (await safe.read('大琳'))!.person;
    expect(saved.profile!.job).toBe('插画师');
    expect(saved.imports).toEqual([]); // 合成导入记录不落盘
    expect(getNoticeMessages().some((m) => m.includes('档案已保存'))).toBe(true);
  });

  // ---------------- issue 454：合成记录的媒体数 ----------------

  it('合成卡带媒体数（454）：卡面徽章出语音 / 图片；详情头 H1 精简后媒体明细归统计弹窗', async () => {
    const { safe } = await boot();
    await seedPreview(safe, '大琳', 9, '2026-09-25T08:00:00.000Z', { voiceCount: 1289, voiceTotalSec: 8464, imageCount: 1615 });
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('大琳')).toBeTruthy());

    const meta = card('大琳')!.querySelector('.bz-people-fold-meta')!.textContent!;
    expect(meta).toContain('语音 1289 条');
    expect(meta).toContain('图片 1615 张'); // 卡面 meta 行（9 条 · 语音… · 图片…）

    click('[data-people-card="大琳"]'); // 进详情
    await vi.waitFor(() => expect(document.querySelector('.bz-people-dt-head')).toBeTruthy());
    expect(document.querySelector('.bz-people-card-meta')!.textContent).toContain('9 条消息'); // H1 一行 meta
    expect(document.querySelector('.bz-people-dt-nums')).toBeNull(); // 数字格已随 H1 移除
  });

  it('合成卡只有媒体三项（454）：统计弹窗出占位并引导画脸谱，不画全 0 的空统计卡（455 数据页改弹窗）', async () => {
    const { safe } = await boot();
    await seedPreview(safe, '大琳', 9, '2026-09-25T08:00:00.000Z', { voiceCount: 3, voiceTotalSec: 60, imageCount: 2 });
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('大琳')).toBeTruthy());
    click('[data-people-card="大琳"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-stats-open]')).toBeTruthy());
    click('[data-people-stats-open]');
    // 等统计弹窗渲染出来（占位钩子跟着弹窗出现）
    await vi.waitFor(() => expect(document.querySelector('[data-people-stats-pop] [data-people-data-hint]')).toBeTruthy());

    expect(document.querySelector('.bz-people-ins-rows')).toBeNull(); // 没有 monthly 明细就不出统计卡
    expect(document.querySelector('[data-people-stats-pop] [data-people-data-hint]')!.textContent).toContain('画完脸谱后');
  });
});

// ---------------- issue 467：解锁门禁与上锁不可读 ----------------

describe('解锁门禁与上锁不可读（467 / ADR-0194）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setJobsModuleForTests(new FakeEngine());
  });

  afterEach(() => {
    try { closePeoplePanel(); } catch { /* 幂等 */ }
    setJobsModuleForTests(null);
    setUnlockGateForTests(null);
    setPeopleSafeStoreForTests(null);
  });

  it('未解锁且解锁被取消：面板不打开，任何联系人数据不出现在 DOM', async () => {
    const { sm } = await boot([entry()]);
    sm.lock(); // 保持上锁态
    setUnlockGateForTests(async () => false); // 模拟用户在解锁屏点取消
    openPeoplePanel(getApp());
    await tick();
    await tick();
    expect(isPeopleOpen()).toBe(false);
    expect(document.querySelector('[data-people-card]')).toBeNull();
    expect(document.body.textContent).not.toContain('莫莫'); // 名字（加密索引）不可见
  });

  it('开面板即要求解锁（门禁假件放行后才渲染）；上锁后面板立即转不可读、清掉全部联系人数据', async () => {
    const { sm, safe } = await boot([entry()]);
    sm.lock();
    let gateCalls = 0;
    setUnlockGateForTests(async () => {
      gateCalls += 1;
      await sm.unlock('wall-test-pw'); // 模拟用户输入主密码解锁成功
      return true;
    });
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(card('莫莫')).toBeTruthy());
    expect(gateCalls).toBe(1); // 解锁门禁前置：开面板即弹
    // 会话中上锁（锁屏 / 安全模式任意路径）→ 明文缓存清空 + 面板只剩锁定占位
    sm.lock();
    await vi.waitFor(() => expect(document.querySelector('.bz-people-locked')).toBeTruthy());
    expect(document.querySelector('[data-people-card]')).toBeNull();
    expect(document.body.textContent).not.toContain('莫莫');
    await expect(safe.read('莫莫')).rejects.toThrow('未解锁');
    // 重新解锁 → 面板恢复渲染
    await sm.unlock('wall-test-pw');
    await vi.waitFor(() => expect(card('莫莫')).toBeTruthy());
  });
});
