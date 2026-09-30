// @vitest-environment jsdom
/**
 * 脸谱域 B 组审查修复回归（渲染与样式线）：
 * 1. 「找一找」键入即滤（input 委托 + 防抖重画 + 找回焦点）——修复前打字永远不过滤；
 * 2. 录音起点候选下拉改 change 委托（原位落账不整页重画）——修复前 click 重画把下拉合上、change 没人接；
 * 3. 移出队列先 harvest 再 splice——修复前删第 k 条后其后录音的起点被前一条串位覆盖；
 * 4. 画谱总确认页被遮罩关闭 / 小签换页时按未授权结清——修复前 genConfirmOpen 永久挂起，本会话画脸谱恒「取消」；
 * 5. 未解锁时直开数据源（bz-people-import）：解锁建壳后补开数据源页；取消解锁清账不误弹；
 * 7. AI 补充等待期间换人：回包不写进别家的表单；
 * 9. 「找一找」页码左右按页序号——修复前按全局下标奇偶，偶数摊整页报错边；
 * 10. 抽照片 240ms 定时器在面板关闭后落地即作废——修复前重开面板直落详情页；
 * 11. 统计形态 / 补充素材仓账异步回包归属校验——修复前快速换人旧数据顶替新视图；
 * 6/8/12. 样式接线：印章四态类名、暗色断档、裸按钮双类提权（grep styles.css 断言）；
 * 13. 数据源页空态按状态分支文案 + 设置键描述与实际行为一致（render 纯层断言）。
 * 引擎 / AI / 解锁门禁都注入假件；数据全构造。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import * as aiMod from '../../src/core/ai';
import {
  closePeoplePanel,
  isPeopleOpen,
  openDataSource,
  openPeoplePanel,
  setJobsModuleForTests,
  setSuppRecQueueForTests,
  setUnlockGateForTests,
  startGeneration,
  type GenTarget,
  type JobsApi,
} from '../../src/people/ui';
import { dsPage, suppLocalTsValue, type DsModalState } from '../../src/people/render';
import { peopleSettingsSchema } from '../../src/people/settings';
import type { JobView } from '../../src/people/jobs';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { FaceDigest, PersonEntry } from '../../src/people/types';
import type { StoreContact } from '../../src/people/datasource';
import type { SuppRecQueueItem } from '../../src/people/render';

vi.mock('../../src/core/ai', () => ({
  createAI: vi.fn(),
  DEFAULT_AI_PROVIDER: 'zhipu',
  getProviderDescriptor: () => ({ label: '智谱 Plan', model: 'glm-test' }),
}));
const createAI = vi.mocked(aiMod.createAI);
const jsonMock = vi.fn();

const T0 = new Date('2026-09-25T08:00:00').getTime();
const PW = 'review-fixes-b-pw';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function fakeEngine(queue: JobView[] = []): JobsApi {
  const calls: Array<[unknown, unknown]> = [];
  const api: JobsApi = {
    startJobs: async (app, targets) => {
      calls.push([app, targets]);
      return { queued: targets.map((t) => t.name), skipped: [], resumed: [] };
    },
    resumeJobs: async (): Promise<void> => {},
    resume: (): boolean => true,
    pauseJobs: (): void => {},
    removeJob: (): boolean => false,
    subscribe: () => () => {},
    snapshot: () => ({ queue, currentIndex: queue.length ? 0 : -1, running: false }),
  };
  (api as JobsApi & { calls: Array<[unknown, unknown]> }).calls = calls;
  return api;
}

const engineCalls = (api: JobsApi): Array<[unknown, unknown]> => (api as JobsApi & { calls: Array<[unknown, unknown]> }).calls;

/** 带脸谱素材与导入统计的人物（详情页动作签 / 统计卡要用 monthly） */
function drawnPerson(over: Partial<PersonEntry> = {}): PersonEntry {
  const digest: FaceDigest = {
    portrait: '## 画像\n构造画像',
    events: [{ ts: '2026-05-01', summary: '构造大事', kind: 'major' }],
    quotes: [{ ts: '2026-05-01', who: '对方', text: '构造原话' }],
    moments: [{ ts: '2026-05-01', summary: '构造场景' }],
    traits: ['构造特质'],
    generatedAt: '2026-09-01T00:00:00.000Z',
  };
  return {
    id: 'wxid_a',
    name: '陈默',
    createdAt: '2026-03-01T00:00:00.000Z',
    imports: [{
      file: '数据源:陈默',
      importedAt: '2026-09-01T00:00:00.000Z',
      messageCount: 10,
      skippedCount: 0,
      timeFrom: '2026-01-01T00:00:00.000Z',
      timeTo: '2026-09-01T00:00:00.000Z',
      stats: {
        monthly: [['2026-01', 30], ['2026-02', 42]],
        initiatedByMe: 2,
        initiatedByOther: 3,
        myAvgReplySec: 10,
        otherAvgReplySec: 20,
        myHourly: [],
        otherHourly: [],
        kindCounts: { 文本: 10 },
      },
    }],
    digest,
    ...over,
  };
}

const imgMsg = (key: string, ts: number, text: string): StoreContact['msgs'][number] =>
  ({ key, ts, isSender: false, type: 3, img: `${key}.jpg`, text });

/** 往保库记录的聊天仓段塞图（留影页签的「已入库图片 N 张」靠它） */
async function seedImages(safe: PeopleSafeStore, talker: string, count: number, described = true): Promise<void> {
  const store: StoreContact = {
    msgs: Array.from({ length: count }, (_, i) => imgMsg(`s${i}:${T0 + i}`, T0 + i, described ? `[图] ${i}` : '')),
    watermarkSid: count,
    stats: { msgCount: count, voiceCount: 0, voiceTotalSec: 0, imageCount: count },
    kindCounts: { 图片: count },
    updatedAt: new Date(T0).toISOString(),
  };
  await safe.write(talker, (rec) => { rec.store = store; });
}

async function bootStore(seed: PersonEntry[], stores?: Record<string, (safe: PeopleSafeStore) => Promise<void>>): Promise<PeopleSafeStore> {
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
  for (const fn of Object.values(stores ?? {})) await fn(safe);
  return safe;
}

/** 上锁的保库（解锁门禁测试用）：SafeManager 不解锁，靠测试里的门禁假件真解锁 */
async function bootLocked(): Promise<SafeManager> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  setPeopleSafeStoreForTests(new PeopleSafeStore(sm));
  return sm;
}

async function openAlbum(): Promise<void> {
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(document.querySelector('[data-people-pocket]')).toBeTruthy());
}

/** 开到某人的详情页（抽照片 240ms 动画后对面翻出详情） */
async function openDetail(id: string): Promise<void> {
  click(`[data-people-pocket="${id}"]`);
  await vi.waitFor(() => expect(document.querySelector(`[data-people-detail="${id}"]`)).toBeTruthy());
}

/** 开到某人的补充素材页（记一笔页签起手） */
async function openNoteOf(id: string): Promise<void> {
  await openDetail(id);
  click(`[data-people-detail="${id}"] [data-people-act="note"]`);
  await vi.waitFor(() => expect(document.querySelector('[data-people-sub="note"]')).toBeTruthy());
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  createAI.mockReturnValue({ json: jsonMock } as never);
});

afterEach(() => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setPeopleSafeStoreForTests(null);
  setUnlockGateForTests(null);
  setSuppRecQueueForTests(null);
});

// ---------------- 1 「找一找」键入即滤 ----------------

describe('找一找输入框接线（B 组 P1）', () => {
  it('键入更新关键字并防抖重画：结果过滤、元信息带关键字、焦点回到重建后的输入框', async () => {
    await bootStore([
      drawnPerson({ id: 'wxid_a', name: '陈默' }),
      drawnPerson({ id: 'wxid_b', name: '林晚', createdAt: '2026-02-01T00:00:00.000Z' }),
    ]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    click('[data-people-dialog="find"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="find"]')).toBeTruthy());
    expect(document.querySelectorAll('[data-people-find-open]')).toHaveLength(0); // 空关键字只有提示

    const inp = document.querySelector<HTMLInputElement>('[data-people-find]')!;
    inp.value = '陈';
    inp.dispatchEvent(new Event('input', { bubbles: true }));

    // 防抖 150ms 后整册重画：只剩陈默，页眉元信息带关键字
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="find"] .bz-people-head-note')!.textContent).toBe('「陈」'));
    const rows = document.querySelectorAll('[data-people-find-open]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('陈默');
    // 重画换掉了输入框节点，焦点得找回新的那只（连打字不丢）
    expect(document.activeElement).toBe(document.querySelector('[data-people-find]'));
  });
});

// ---------------- 2 / 3 录音队列：候选下拉与移出队列 ----------------

describe('录音导入队列交互（B 组 P1）', () => {
  const pick = (over: Partial<SuppRecQueueItem>): SuppRecQueueItem => ({
    path: 'E:/下载/r.aac', name: 'r.aac', sha256: 'ab', startMs: null, candidates: [], ...over,
  });
  const T1 = new Date(2026, 8, 19, 10, 14).getTime();
  const T2 = new Date(2026, 8, 12, 10, 14).getTime();
  const T3 = new Date(2026, 8, 5, 10, 14).getTime();

  /** 开到补充素材页并摆好队列（真路径要弹系统文件对话框，走注入缝） */
  async function bootRecQueue(items: SuppRecQueueItem[]): Promise<void> {
    await bootStore([drawnPerson()]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    await openNoteOf('wxid_a');
    setSuppRecQueueForTests(items);
    click('[data-people-supp-tab="rec"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-supp-rec-drop="0"]')).toBeTruthy());
  }

  it('起点候选下拉：change 落账并原位同步起点框（不整页重画，下拉不被合上）', async () => {
    const item = pick({ name: 'a.aac', startMs: T1, candidates: [T1, T2] });
    await bootRecQueue([item]);
    const sel = document.querySelector<HTMLSelectElement>('[data-people-supp-rec-cand="0"]')!;
    expect(sel.value).toBe(String(T1)); // 初始选中 = startMs
    sel.dataset.probe = 'keep-me'; // 整页重画会换节点——探针还在 = 原位刷新
    sel.value = String(T2);
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    const ts = document.querySelector<HTMLInputElement>('[data-people-supp-rec-ts="0"]')!;
    expect(ts.value).toBe(suppLocalTsValue(T2)); // 起点框原位跟着换（落盘前 harvest 以它为准）
    expect(item.startMs).toBe(T2); // 模型侧真落账（队列注入缝持有同一引用）
    expect(document.querySelector<HTMLElement>('[data-people-supp-rec-cand="0"]')!.dataset.probe).toBe('keep-me');
    expect(document.querySelector('.bz-people-supp-qrow')!.classList.contains('need-ts')).toBe(false);
  });

  it('移出队列：删中间一条，其后录音的起点不被前一条串位覆盖', async () => {
    // path 是队列条目的身份键（入队时按它去重）——夹具照真实口径各给各的
    const A = pick({ path: 'E:/下载/a.aac', name: 'a.aac', startMs: T1 });
    const B = pick({ path: 'E:/下载/b.aac', name: 'b.aac', startMs: T2 });
    const C = pick({ path: 'E:/下载/c.aac', name: 'c.aac', startMs: T3 });
    await bootRecQueue([A, B, C]);
    expect(document.querySelectorAll('.bz-people-supp-qrow')).toHaveLength(3);

    click('[data-people-supp-rec-drop="1"]');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-people-supp-qrow')).toHaveLength(2));

    // 修复前：renderAlbum 开头的 harvest 拿旧 DOM 下标写新数组，C 的起点被 B 的值覆盖成 T2
    expect(C.startMs).toBe(T3);
    expect(A.startMs).toBe(T1);
    expect(document.querySelector<HTMLInputElement>('[data-people-supp-rec-ts="1"]')!.value).toBe(suppLocalTsValue(T3));
  });
});

// ---------------- 4 画谱总确认的结清 ----------------

describe('画谱总确认不被挂起（B 组 P1）', () => {
  const msgs = (): GenTarget['msgs'] => [
    { ts: T0, isSender: true, text: '早' },
    { ts: T0 + 60_000, isSender: false, text: '早呀' },
  ];
  const target = (): GenTarget => ({
    talker: 'wxid_a', name: '陈默', msgs: msgs(), kindCounts: { 文本: 2 }, skippedCount: 0, fileLabel: '数据源:陈默',
  });

  it('总确认开着时点面板外遮罩关面板：按未授权结清（Promise 落定），再开画谱确认能正常弹出', async () => {
    const engine = fakeEngine();
    await bootStore([drawnPerson({ imports: [], digest: undefined })]);
    setJobsModuleForTests(engine);
    await openAlbum();

    const gen = startGeneration([target()]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="gen"]')).toBeTruthy());
    (document.querySelector('.bz-people-scope') as HTMLElement).dispatchEvent(new MouseEvent('click'));
    expect(isPeopleOpen()).toBe(false);
    await gen; // 修复前永远挂起（测试会超时）
    expect(getNoticeMessages().some((m) => m.includes('已取消，本次不生成'))).toBe(true);
    expect(engineCalls(engine)).toHaveLength(0); // 未授权：引擎没起跑

    // 结清后再画：确认页能再次弹出并放行（修复前 genConfirmOpen 卡死恒返回 cancel）
    await openAlbum();
    const gen2 = startGeneration([target()]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="gen"]')).toBeTruthy());
    click('[data-people-gen-start]');
    await gen2;
    expect(engineCalls(engine)).toHaveLength(1);
  });

  it('总确认开着时点「找一找」小签换页：确认按未授权结清、页面照换，再画不再被卡', async () => {
    const engine = fakeEngine();
    await bootStore([drawnPerson({ imports: [], digest: undefined })]);
    setJobsModuleForTests(engine);
    await openAlbum();

    const gen = startGeneration([target()]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="gen"]')).toBeTruthy());
    click('[data-people-dialog="find"]'); // 小签换页：openDialog 直接覆盖 dialog
    await gen; // 修复前永远挂起
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="find"]')).toBeTruthy());
    expect(getNoticeMessages().some((m) => m.includes('已取消，本次不生成'))).toBe(true);

    const gen2 = startGeneration([target()]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="gen"]')).toBeTruthy());
    click('[data-people-gen-start]');
    await gen2;
    expect(engineCalls(engine)).toHaveLength(1);
  });
});

// ---------------- 5 未解锁直开数据源 ----------------

describe('未解锁时直开数据源（B 组 P2）', () => {
  it('bz-people-import 在锁着时调：解锁成功建好壳后数据源页补开', async () => {
    const sm = await bootLocked();
    setUnlockGateForTests(async () => { await sm.unlock(PW); return true; });
    setJobsModuleForTests(fakeEngine());
    openDataSource();
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeTruthy());
    expect(isPeopleOpen()).toBe(true);
  });

  it('取消解锁：面板不开、账清掉——之后再正常开面板也不误弹数据源页', async () => {
    const sm = await bootLocked();
    let allow = false;
    setUnlockGateForTests(async () => { if (allow) await sm.unlock(PW); return allow; });
    openDataSource();
    await tick(20);
    expect(isPeopleOpen()).toBe(false);

    allow = true;
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(isPeopleOpen()).toBe(true));
    await tick(40);
    expect(document.querySelector('[data-people-sub="ds"]')).toBeNull(); // 取消过的直开不补账
  });
});

// ---------------- 7 AI 补充换人 ----------------

describe('AI 补充背景归属（B 组 P2）', () => {
  it('等待期间换到另一位：回包不写进别家的编辑表单', async () => {
    const A = drawnPerson({ id: 'wxid_a', name: '陈默', profile: { birthday: '1990-01-01' } });
    const B = drawnPerson({ id: 'wxid_b', name: '林晚', createdAt: '2026-02-01T00:00:00.000Z', profile: undefined });
    await bootStore([A, B]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    await openDetail('wxid_a');
    click('[data-people-act="prof"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="prof"]')).toBeTruthy());
    click('[data-people-prof-edit], [data-people-prof-new]');
    await vi.waitFor(() => expect(document.querySelector('.bz-people-prof-edit')).toBeTruthy());

    let resolveJson!: (v: string) => void;
    jsonMock.mockImplementation(() => new Promise<string>((r) => { resolveJson = r; }));
    click('[data-people-prof-ai]'); // A 的 AI 补充起跑，挂在 await 上
    await tick();

    // 等待期间换人：合上 A 的档案页，开 B 的编辑表单
    click('[data-people-sub="prof"] [data-people-close]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="prof"]')).toBeNull());
    await openDetail('wxid_b');
    click('[data-people-act="prof"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="prof"]')).toBeTruthy());
    click('[data-people-prof-edit], [data-people-prof-new]');
    await vi.waitFor(() => expect(document.querySelector('.bz-people-prof-edit')).toBeTruthy());

    resolveJson(JSON.stringify({ personality: 'AI 填的' })); // A 的回包这时才落地
    await tick(20);
    // 修复前：回包写进 B 的表单。现在一个字都不写
    expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="personality"]')!.value).toBe('');
    expect(getNoticeMessages().some((m) => m.includes('AI 已补'))).toBe(false);
  });
});

// ---------------- 9 找一找左右按页序号 ----------------

describe('找一找结果的左右定位（B 组 P3）', () => {
  it('第 2 页的条目恒报「右」（按页序号，不是全局下标奇偶）', async () => {
    const seeds = Array.from({ length: 8 }, (_, i) =>
      drawnPerson({ id: `wxid_${i}`, name: `友人${i}`, createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), imports: [], digest: undefined }));
    await bootStore(seeds);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    click('[data-people-dialog="find"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="find"]')).toBeTruthy());
    const inp = document.querySelector<HTMLInputElement>('[data-people-find]')!;
    inp.value = '友人';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('[data-people-find-open]')).toHaveLength(8));

    // 每页 6 位：全局序号 6..7 落第 2 页（页序号 1 → 右）。修复前 6 号按奇偶报成「左」
    const sides = [...document.querySelectorAll('.bz-people-find-side')].map((n) => n.textContent);
    expect(sides[6]).toContain('第 2 页 右');
    expect(sides[7]).toContain('第 2 页 右');
  });
});

// ---------------- 10 抽照片定时器 ----------------

describe('抽照片定时器不越过面板生命周期（B 组 P3）', () => {
  it('点照片后立刻关面板：240ms 定时器落地作废，重开面板不直落详情页', async () => {
    await bootStore([drawnPerson()]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    click('[data-people-pocket="wxid_a"]'); // 起了 240ms 定时器
    closePeoplePanel();
    expect(isPeopleOpen()).toBe(false);
    await tick(300); // 修复前：定时器这时落地，detailId 被写回

    await openAlbum();
    await vi.waitFor(() => expect(document.querySelector('[data-people-pocket="wxid_a"]')).toBeTruthy());
    await tick(300); // 即便还有残留定时器这时才跑也不该写回
    expect(document.querySelector('[data-people-detail="wxid_a"]')).toBeNull();
  });
});

// ---------------- 11 异步回包归属校验 ----------------

describe('异步回包的归属校验（B 组 P3）', () => {
  it('统计形态回包前换人：旧人的 kindCounts 不顶替新人的统计页', async () => {
    const safe = await bootStore(
      [
        drawnPerson({ id: 'wxid_a', name: '陈默' }),
        drawnPerson({ id: 'wxid_b', name: '林晚', createdAt: '2026-02-01T00:00:00.000Z' }),
      ],
      {
        a: async (s) => {
          await s.write('wxid_a', (rec) => { rec.store = { msgs: [], watermarkSid: 0, stats: { msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, kindCounts: { 图片: 3 }, updatedAt: '' }; });
        },
        b: async (s) => {
          await s.write('wxid_b', (rec) => { rec.store = { msgs: [], watermarkSid: 0, stats: { msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, kindCounts: { 语音: 1 }, updatedAt: '' }; });
        },
      },
    );
    // 拖慢 A 的读，让它的回包晚于换人
    const origRead = safe.read.bind(safe);
    (safe as unknown as { read: (id: string) => Promise<unknown> }).read = async (id: string) => {
      if (id === 'wxid_a') await new Promise((r) => setTimeout(r, 40));
      return origRead(id);
    };
    setJobsModuleForTests(fakeEngine());
    await openAlbum();

    await openDetail('wxid_a');
    click('[data-people-act="stats"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="stats"]')).toBeTruthy());
    click('[data-people-sub="stats"] [data-people-close]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="stats"]')).toBeNull());

    await openDetail('wxid_b');
    click('[data-people-act="stats"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="stats"] .bz-people-kinds')!.textContent).toContain('语音'));

    await tick(80); // A 的慢回包这时早已落地
    const kinds = document.querySelector('[data-people-sub="stats"] .bz-people-kinds')!;
    expect(kinds.textContent).toContain('语音');
    expect(kinds.textContent).not.toContain('图片'); // 修复前被 A 的 { 图片: 3 } 顶替
  });

  it('补充素材仓账回包前换人：旧人的图片统计不顶替新页', async () => {
    const safe = await bootStore(
      [
        drawnPerson({ id: 'wxid_a', name: '陈默' }),
        drawnPerson({ id: 'wxid_b', name: '林晚', createdAt: '2026-02-01T00:00:00.000Z' }),
      ],
      {
        a: (s) => seedImages(s, 'wxid_a', 3),
        b: (s) => seedImages(s, 'wxid_b', 1),
      },
    );
    const origRead = safe.read.bind(safe);
    (safe as unknown as { read: (id: string) => Promise<unknown> }).read = async (id: string) => {
      if (id === 'wxid_a') await new Promise((r) => setTimeout(r, 40));
      return origRead(id);
    };
    setJobsModuleForTests(fakeEngine());
    await openAlbum();

    await openNoteOf('wxid_a'); // A 的仓账读挂在 40ms 上
    click('[data-people-sub="note"] [data-people-close]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="note"]')).toBeNull());

    await openNoteOf('wxid_b');
    click('[data-people-supp-tab="image"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="note"]')!.textContent).toContain('已入库图片 1 张'));

    await tick(80); // A 的回包落地
    const note = document.querySelector('[data-people-sub="note"]')!;
    expect(note.textContent).toContain('已入库图片 1 张'); // 仍是 B 的仓账
    expect(note.textContent).not.toContain('已入库图片 3 张'); // 修复前被 A 的 3 张顶替
  });
});

// ---------------- 6 / 8 / 12 样式接线（grep styles.css） ----------------

describe('样式接线（B 组：印章四态 / 暗色断档 / 双类提权）', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/people/styles.css'), 'utf8');

  it('印章四态类名在 CSS 里都有落点：halted / queued 沿用 hold / wait 的虚边褪色（亮暗两处）', () => {
    // render.albumSealNode 输出 bz-people-seal-<state>（halted/queued/drawn/legacy）；
    // 修复前 CSS 只写了旧名 hold/wait，四态印全渲染成实心朱红
    expect(css).toMatch(/\.bz-people-seal-hold, \.bz-people-seal-halted \{/);
    expect(css).toMatch(/\.bz-people-seal-wait, \.bz-people-seal-queued \{/);
    expect(css).toMatch(/\.theme-dark \.bz-people-seal-hold, \.theme-dark \.bz-people-seal-halted \{/);
    expect(css).toMatch(/\.theme-dark \.bz-people-seal-wait, \.theme-dark \.bz-people-seal-queued \{/);
    // drawn / legacy 无专属语义类：由印章基类兜底（同 running 的实心朱红）
    expect(css).toMatch(/\.bz-people-seal \{/);
  });

  it('暗色断档补齐：数据源行 / 一眼账 / 随手记纸条 / 窄容器吸顶页眉都有 theme-dark 覆盖', () => {
    expect(css).toMatch(/\.theme-dark \.bz-people-ds-row, \.theme-dark \.bz-people-fact, \.theme-dark \.bz-people-note-row \{ background: #35312a/);
    expect(css).toMatch(/\.theme-dark \.bz-people-page-head \{ background: #2f2b24/);
  });

  it('裸按钮双类提权：「勾有更新的」与横幅叉不被 core reset 剥色', () => {
    expect(css).toMatch(/\.bz-people-ds-pickfresh\.bz-people-ds-pickfresh \{/);
    expect(css).toMatch(/\.bz-people-banner-x\.bz-people-banner-x \{/);
  });
});

// ---------------- 13 数据源页空态文案与设置口径 ----------------

describe('数据源页空态按状态分支（B 组 P3）', () => {
  const state = (over: Partial<DsModalState> = {}): DsModalState => ({
    dataDir: 'D:/演示数据/export_full',
    scanning: false,
    importing: false,
    rows: null,
    selected: [],
    hiddenGroups: 0,
    notice: '',
    desktopOnly: false,
    filter: '',
    totalRows: 0,
    scannedAt: '',
    syncing: false,
    sync: null,
    ...over,
  });

  it('扫描进行中不再说「还没扫描」；未配置数据根指路设置；有数据根保留原文案', () => {
    expect(dsPage(state({ scanning: true })).textContent).toContain('正在扫描联系人目录');
    expect(dsPage(state({ scanning: true })).textContent).not.toContain('还没扫描');
    const noDir = dsPage(state({ dataDir: '' }));
    expect(noDir.textContent).toContain('还没扫描');
    expect(noDir.textContent).toContain('设置 → 脸谱 → 数据源');
    const withDir = dsPage(state());
    expect(withDir.textContent).toContain('点右上「同步」从微信取数');
  });

  it('设置键描述与实际行为一致：空 = 数据源页提示先配置（不再说「不显示数据源入口」）', () => {
    const schema = peopleSettingsSchema();
    const row = schema.groups[0].rows.find((r) => (r as unknown as { binding?: { key?: string } }).binding?.key === 'peopleDataDir');
    expect(row).toBeTruthy();
    expect(row!.desc).toContain('数据源页提示先配置');
    expect(row!.desc).not.toContain('面板不显示数据源入口');
  });
});
