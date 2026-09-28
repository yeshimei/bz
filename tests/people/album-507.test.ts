/**
 * 册子收尾批（issue 507）UI 行为测试：505 相册簿重写之后退化 / 缺失的那几处交互。
 *
 * 覆盖：
 *  · 「另有 N 条」六处列表点一下原地摊开（`.bz-people-more-hide` 摘掉、按钮退场）；
 *  · 换折（含同折再点）详情正文回到第一行从头读；
 *  · 联系人不足一页时后半摊出占位页（不报页码，避免「第 2 / 1 页」伪编号）；
 *  · 画谱进行中别人那页的「画脸谱」按下去且写清理由；删除不受任务影响，照常翻出删除页；
 *  · 桌面端鼠标滚轮翻摊（累积到位翻一摊，一次只翻一幕）。
 *
 * 锚位：照片格 `[data-people-pocket]`、详情页 `[data-people-detail]`、折签 `[data-people-fold]`、
 * 详情滚动宿主 `[data-people-scroll="detail"]`、册页 `.bz-people-spread > .bz-people-page`。
 * 引擎用假件注入（setJobsModuleForTests），数据全构造；不碰真实 vault / 微信。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closePeoplePanel, openPeoplePanel, setJobsModuleForTests, type JobsApi } from '../../src/people/ui';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { FaceDigest, PersonEntry } from '../../src/people/types';
import type { JobView, PersonJob } from '../../src/people/jobs';
import type { StoreContact } from '../../src/people/datasource';

const T0 = new Date('2026-09-25T08:00:00').getTime();
const PW = 'album507-pw';

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** 滚轮：deltaY 一次到位（阈值 60px） */
function wheel(sel: string, deltaY: number): void {
  const target = document.querySelector(sel)!;
  const e = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
}

const cell = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-people-pocket="${id}"]`);
const pages = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.bz-people-spread > .bz-people-page')];

/** 点照片进详情：手册先放一段「抽出照片」动画（240ms），等对面那页翻开 */
async function openDetail(id: string): Promise<void> {
  click(`[data-people-pocket="${id}"]`);
  await vi.waitFor(() => expect(document.querySelector(`[data-people-detail="${id}"]`)).toBeTruthy());
}

/** 只记调用 + 可手推快照的假引擎（形状对齐 jobs.ts 契约） */
class FakeEngine implements JobsApi {
  items: PersonJob[] = [];
  calls = { start: [] as unknown[], resumeJobs: 0, pause: 0, resume: [] as string[], remove: [] as string[] };
  /** 订阅者（测试用来确认面板已经挂上跟帧，再手动推帧） */
  subs: Array<(s: { queue: JobView[]; currentIndex: number; running: boolean }) => void> = [];

  startJobs = async (_app: unknown, targets: unknown[]): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }> => {
    this.calls.start.push(targets);
    return { queued: [], skipped: [], resumed: [] };
  };
  resumeJobs = async (): Promise<void> => { this.calls.resumeJobs++; };
  resume = (t: string): boolean => { this.calls.resume.push(t); return true; };
  pauseJobs = (): void => { this.calls.pause++; };
  removeJob = (t: string): boolean => {
    this.calls.remove.push(t);
    const before = this.items.length;
    this.items = this.items.filter((j) => j.talker !== t);
    if (this.items.length < before) { this.emit(); return true; }
    return false;
  };
  subscribe = (fn: (s: { queue: JobView[]; currentIndex: number; running: boolean }) => void): (() => void) => {
    this.subs.push(fn);
    return () => { this.subs = this.subs.filter((f) => f !== fn); };
  };
  snapshot = () => this.snap();
  push(items: PersonJob[]): void { this.items = items; this.emit(); }
  private snap(): { queue: JobView[]; currentIndex: number; running: boolean } {
    const currentIndex = this.items.findIndex((j) => j.status === 'running');
    const queue: JobView[] = this.items.map((job, i) => ({ ...job, batchesTotal: job.chunks?.length ?? 0, queueIndex: i + 1, queueTotal: this.items.length }));
    return { queue, currentIndex, running: currentIndex >= 0 };
  }
  private emit(): void { const s = this.snap(); for (const fn of [...this.subs]) fn(s); }
}

/** 一条构造任务（必填面 + 常用可选项） */
function jobFor(id: string, name: string, over: Partial<PersonJob> = {}): PersonJob {
  return {
    talker: id,
    name,
    mode: 'full',
    fileLabel: `数据源:${name}`,
    status: 'running',
    stage: 'extracting',
    msgCount: 3,
    contentHash: 'h',
    chunks: [{ from: '2026-09-01', to: '2026-09-30', count: 3 }],
    batchesDone: 0,
    results: [],
    material: { traits: [], moments: [] },
    importRecord: { fileLabel: `数据源:${name}`, skippedCount: 0, messageCount: 3, timeFrom: new Date(T0).toISOString(), timeTo: new Date(T0).toISOString() },
    message: '第 1/3 批 · 2026-09-01 ~ 2026-09-30 · 3 条',
    startedAt: new Date(T0).toISOString(),
    updatedAt: new Date(T0).toISOString(),
    ...over,
  };
}

/** 带脸谱（traits / quotes / moments 都超量）的一册 */
function digest(over: Partial<FaceDigest> = {}): FaceDigest {
  return {
    person: '## 其人\n- 话不多，回消息慢半拍',
    traits: Array.from({ length: 14 }, (_, i) => `特质${i + 1}`),
    quotes: Array.from({ length: 10 }, (_, i) => ({ text: `原话${i + 1}`, who: 'TA', ts: '2026-05-01' })),
    moments: Array.from({ length: 8 }, (_, i) => ({ ts: '2026-05-01', summary: `片刻${i + 1}` })),
    events: [],
    generatedAt: '2026-09-25T00:00:00.000Z',
    ...over,
  };
}

const entry = (id: string, over: Partial<PersonEntry> = {}): PersonEntry => ({
  id,
  name: id,
  createdAt: new Date(T0).toISOString(),
  imports: [],
  ...over,
});

/** 聊天仓种子（467：写进保库记录 store 段——上墙口与素材水位都看它） */
async function seedStore(safe: PeopleSafeStore, id: string, count = 3): Promise<void> {
  const store: StoreContact = {
    msgs: Array.from({ length: count }, (_, i) => ({ key: `s${i}`, ts: T0 + i * 60_000, isSender: i % 2 === 0, type: 1, text: `构造消息${i}` })),
    watermarkSid: count,
    stats: { msgCount: count, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 },
    updatedAt: new Date(T0).toISOString(),
  };
  await safe.write(id, (rec) => { rec.store = store; });
}

async function boot(seed: PersonEntry[] = []): Promise<PeopleSafeStore> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  const safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
  for (const p of seed) await safe.write(p.id, (rec) => { rec.person = p; });
  return safe;
}

/** 开面板 + 等册上照片贴出来（渲染异步：解锁门禁 → 冷读 → 整册重画） */
async function openAlbum(): Promise<void> {
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(document.querySelector('[data-people-pocket]')).toBeTruthy());
}

let engine: FakeEngine;

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  engine = new FakeEngine();
  setJobsModuleForTests(engine);
});

afterEach(() => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setPeopleSafeStoreForTests(null);
});

describe('「另有 N 条」点一下摊开（item 1）', () => {
  /** 六处列表全塞到超量：可见条数保持原样（12 / 8 / 10 / 6 / 8 / 14），多出来的收着等点 */
  const richDigest = (): FaceDigest => digest({
    interests: Array.from({ length: 12 }, (_, i) => ({ ts: '2026-05-01', topic: `在聊${i + 1}` })),
    threads: Array.from({ length: 10 }, (_, i) => ({ ts: '2026-05-01', text: `未竟${i + 1}` })),
    events: Array.from({ length: 16 }, (_, i) => ({ ts: '2026-05-01', kind: 'minor' as const, summary: `事件${i + 1}` })),
  });

  /** 一处列表：条数对得上 → 超量的收着且签上写着条数 → 点一下全摊开、签退场 */
  function expectFoldable(sel: string, total: number, first: number, moreText: string): void {
    const box = document.querySelector<HTMLElement>(sel);
    expect(box, `找不到列表 ${sel}`).toBeTruthy();
    expect(box!.querySelectorAll('.bz-people-more-hide'), `${sel} 收着的条数`).toHaveLength(total - first);
    const more = box!.querySelector<HTMLElement>('[data-people-more]');
    expect(more, `${sel} 没有摊开签`).toBeTruthy();
    expect(more!.textContent).toBe(moreText);
    more!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(box!.querySelectorAll('.bz-people-more-hide'), `${sel} 点完还收着`).toHaveLength(0);
    expect(box!.querySelector('[data-people-more]')).toBeNull();
  }

  it('六处列表都超量：先按原可见条数摆好，其余收着，末尾一枚签；点一下原地全摊开、签退场', async () => {
    const safe = await boot([entry('wxid_a', { name: '陈默', digest: richDigest() })]);
    await seedStore(safe, 'wxid_a');
    await openAlbum();
    await openDetail('wxid_a');
    // 卷一《其人》四处
    expectFoldable('.bz-people-traits', 14, 12, '…另有 2 条'); // 性格特质
    expectFoldable('.bz-people-quotes', 10, 8, '…另有 2 条'); // 代表原话（原来静默截断）
    expectFoldable('.bz-people-ints', 12, 10, '…另有 2 条'); // 最近在聊什么（原来静默截断）
    expectFoldable('.bz-people-moms', 8, 6, '…另有 2 个片刻'); // 留下的片刻
    // 卷二《相交》
    click('[data-people-fold="b"]');
    await vi.waitFor(() => expect(document.querySelector('.bz-people-ftab.on')!.textContent).toBe('相交'));
    expectFoldable('.bz-people-thr', 10, 8, '…另有 2 条'); // 未竟之事（原来静默截断）
    // 卷三《纪事》：同月纪事（16 条摆 14）
    click('[data-people-fold="e"]');
    await vi.waitFor(() => expect(document.querySelector('.bz-people-ftab.on')!.textContent).toBe('纪事'));
    expectFoldable('.bz-people-mon-in', 16, 14, '…同月另有 2 条');
  });

  it('没超量的列表不画那枚签（数据本来就不够，别凭空长出一个入口）', async () => {
    const safe = await boot([entry('wxid_a', { name: '陈默', digest: digest() })]);
    await seedStore(safe, 'wxid_a');
    await openAlbum();
    await openDetail('wxid_a');
    expect(document.querySelectorAll('.bz-people-quotes .bz-people-more-hide')).toHaveLength(2); // 10 条，摆 8
    expect(document.querySelectorAll('.bz-people-moms .bz-people-more-hide')).toHaveLength(2); // 8 条，摆 6
    const quotes = document.querySelectorAll<HTMLElement>('.bz-people-quotes [data-people-more]');
    expect(quotes).toHaveLength(1);
    expect(quotes[0].textContent).toBe('…另有 2 条');
  });

  it('数据不够格的列表一点不挂（既没有收着的，也没有那枚签）', async () => {
    const safe = await boot([entry('wxid_a', { name: '陈默', digest: digest({ traits: ['话少', '慢半拍'] }) })]);
    await seedStore(safe, 'wxid_a');
    await openAlbum();
    await openDetail('wxid_a');
    const box = document.querySelector<HTMLElement>('.bz-people-traits')!;
    expect(box.querySelectorAll('.bz-people-trait')).toHaveLength(2);
    expect(box.querySelectorAll('.bz-people-more-hide')).toHaveLength(0);
    expect(box.querySelector('[data-people-more]')).toBeNull();
  });
});

describe('换折回到第一行（item 2）', () => {
  it('往下读远了点另一折：详情正文从头读起（不接着上一折的滚动位置落进正文中间）', async () => {
    const safe = await boot([entry('wxid_a', { name: '陈默', digest: digest() })]);
    await seedStore(safe, 'wxid_a');
    await openAlbum();
    await openDetail('wxid_a');
    const body = document.querySelector<HTMLElement>('[data-people-scroll="detail"]')!;
    expect(body.classList.contains('sc-top')).toBe(true);
    body.scrollTop = 260; // 往下翻了
    click('[data-people-fold="b"]');
    await vi.waitFor(() => expect(document.querySelector('.bz-people-ftab.on')!.textContent).toBe('相交'));
    expect(document.querySelector<HTMLElement>('[data-people-scroll="detail"]')!.scrollTop).toBe(0);
    // 换折那一下正文才放进动画（issue 507：505 之后 `.bz-people-in` 没人挂）
    expect(document.querySelector('.bz-people-fsheet-body')!.classList.contains('bz-people-in')).toBe(true);
  });

  it('同一折再点一下 = 回到这一折的开头', async () => {
    const safe = await boot([entry('wxid_a', { name: '陈默', digest: digest() })]);
    await seedStore(safe, 'wxid_a');
    await openAlbum();
    await openDetail('wxid_a');
    const body = document.querySelector<HTMLElement>('[data-people-scroll="detail"]')!;
    body.scrollTop = 180;
    click('[data-people-fold="p"]'); // 当前就在「其人」这一折
    expect(document.querySelector<HTMLElement>('[data-people-scroll="detail"]')!.scrollTop).toBe(0);
  });
});

describe('不足一页时后半摊出占位页（item 3）', () => {
  it('册上只有一位：右页照样摊开（6 个空位），且不报页码（不出现「第 2 / 1 页」这种伪编号）', async () => {
    const safe = await boot([entry('wxid_a', { name: '陈默', digest: digest() })]);
    await seedStore(safe, 'wxid_a');
    await openAlbum();
    const all = pages();
    expect(all).toHaveLength(2);
    expect(all[0].querySelector('.bz-people-head-count-in')!.textContent).toBe('1 / 1');
    const blank = all[1];
    expect(blank.querySelector('.bz-people-head-count-in')).toBeNull();
    expect(blank.querySelectorAll('.bz-people-vacant')).toHaveLength(6);
    expect(blank.textContent).toContain('空页');
  });

  it('正好摊满两页时不补占位页（页数够就不画蛇添足）', async () => {
    const seed: PersonEntry[] = [];
    for (let i = 1; i <= 8; i++) seed.push(entry(`wxid_${i}`, { name: `联系人${i}` }));
    const safe = await boot(seed);
    for (let i = 1; i <= 8; i++) await seedStore(safe, `wxid_${i}`);
    await openAlbum();
    expect(pages()).toHaveLength(2);
    expect(pages()[1].querySelector('.bz-people-head-count-in')!.textContent).toBe('2 / 2');
    expect(document.querySelector('.bz-people-vacant')).toBeTruthy(); // 满页内仍有空位（8 位摊两页）
  });
});

describe('画谱进行中的动作面（item 8）', () => {
  it('别人那页的「画脸谱」按下去并把理由写在按钮上；自己那一位照旧可点', async () => {
    const safe = await boot([
      entry('wxid_a', { name: '陈默', digest: digest() }),
      entry('wxid_b', { name: '林晚' }),
    ]);
    await seedStore(safe, 'wxid_a');
    await seedStore(safe, 'wxid_b');
    engine.items = [jobFor('wxid_a', '陈默')];
    await openAlbum();

    await openDetail('wxid_b');
    const other = document.querySelector<HTMLButtonElement>('[data-people-detail="wxid_b"] [data-people-act="generate"]')!;
    expect(other.disabled).toBe(true);
    expect(other.querySelector('.bz-people-act-hint')!.textContent).toBe('等「陈默」画完');
    expect(other.getAttribute('data-people-jobs-lock')).toBe('1');

    await openDetail('wxid_a');
    const mine = document.querySelector<HTMLButtonElement>('[data-people-detail="wxid_a"] [data-people-act="generate"]')!;
    expect(mine.disabled).toBe(false);
    expect(mine.hasAttribute('data-people-jobs-lock')).toBe(false);
  });

  it('任务在跑也照样翻出删除页（删除不排在画谱后面）', async () => {
    const safe = await boot([
      entry('wxid_a', { name: '陈默', digest: digest() }),
      entry('wxid_b', { name: '林晚' }),
    ]);
    await seedStore(safe, 'wxid_a');
    await seedStore(safe, 'wxid_b');
    engine.items = [jobFor('wxid_a', '陈默')];
    await openAlbum();
    await openDetail('wxid_b');
    click('[data-people-act="del"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="del"]')).toBeTruthy());
  });
});

describe('一次性动效接回（item 5）', () => {
  it('任务进场那一下：进度便签带 `bz-people-note-in` 落下来，只落一次（后面每帧不再重放）', async () => {
    const safe = await boot([entry('wxid_a', { name: '陈默', digest: digest() })]);
    await seedStore(safe, 'wxid_a');
    await openAlbum();
    await vi.waitFor(() => expect(engine.subs.length).toBeGreaterThan(0)); // 面板已挂上跟帧
    engine.push([jobFor('wxid_a', '陈默')]);
    const note = document.querySelector<HTMLElement>('[data-people-jobs]')!;
    expect(note.classList.contains('bz-people-note-in')).toBe(true);
    // 队列没空过 → 下一帧不再放这一下（否则一秒落一次就成了抖）
    engine.push([jobFor('wxid_a', '陈默', { batchesDone: 1 })]);
    expect(document.querySelector<HTMLElement>('[data-people-jobs]')!.classList.contains('bz-people-note-in')).toBe(false);
  });
});

describe('桌面端鼠标滚轮翻摊（item 9）', () => {
  it('滚轮往下累积到位：翻到下一摊；没到阈值不翻', async () => {
    const seed: PersonEntry[] = [];
    for (let i = 1; i <= 13; i++) seed.push(entry(`wxid_${i}`, { name: `联系人${i}` }));
    const safe = await boot(seed); // 13 位 = 3 页（第 3 页只有 1 位）
    for (let i = 1; i <= 13; i++) await seedStore(safe, `wxid_${i}`);
    await openAlbum();
    expect(pages()[0].querySelector('.bz-people-head-count-in')!.textContent).toBe('1 / 3');
    wheel('.bz-people-spread', 30); // 没到 60px 阈值：不翻
    expect(pages()[0].querySelector('.bz-people-head-count-in')!.textContent).toBe('1 / 3');
    wheel('.bz-people-spread', 120);
    await vi.waitFor(() => expect(pages()[0].querySelector('.bz-people-head-count-in')!.textContent).toBe('3 / 3'));
    expect(pages()).toHaveLength(2); // 末摊：第 3 页 + 补的占位页
  });
});
