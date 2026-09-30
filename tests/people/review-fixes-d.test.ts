// @vitest-environment jsdom
/**
 * 脸谱域 D 组体验增强回归（九项拍板的落地验证）：
 * 1. 留影大图换 core 灯箱（含 ←→ / 箭头翻图、描述随张换、Esc 收灯箱不收面板）；
 * 2. 键盘可达：照片格 Enter / Space 抽照片、数据源勾选行 Space 切勾、无弹窗无详情 ←→ 翻摊、
 *    焦点在输入框里不误触翻摊；
 * 3. 数据源页脚「画脸谱」退役（批量画谱入口消失，画谱从详情页逐人发起——sync-button.test 的
 *    492 回归已改走详情页，这里补渲染断言）；
 * 4. 档案编辑脏守卫：脏着切折 / Esc 先出「放弃？」确认且不丢已输入内容；放弃才清，继续编辑留原地；
 *    不脏直接放行；
 * 5. 随手记「撕掉」行内确认（纪事折 + 记一笔两处入口）：单击不删、确认才删、取消还原；
 * 6. 画谱「取消」先过流程框：确认才 removeJob，取消不动；
 * 7. 三小项：导入归并段逐人进度、关面板录音在跑出后台提示、找一找结果行真头像；
 * 8. 数据源页过滤框：过滤行数变化、勾选跨过滤保留（含页脚账）、清空恢复全列表。
 * 引擎 / AI / 门禁全注入假件；数据全构造；数据源相关用临时真实目录（读库外文件夹走 window.require）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  closePeoplePanel,
  isPeopleOpen,
  openDataSource,
  openPeoplePanel,
  setJobsModuleForTests,
  setUnlockGateForTests,
} from '../../src/people/ui';
import { dsPage, type DsModalState } from '../../src/people/render';
import type { JobView, JobsSnapshot, PersonJob } from '../../src/people/jobs';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { FaceDigest, PersonEntry } from '../../src/people/types';
import type { StoreContact } from '../../src/people/datasource';
import { startRecordingTask, setRecordingRunnerForTests, resetRecordingProcessesForTests } from '../../src/people/recording';
import type { ExternalToolCallbacks, ExternalToolOutcome, ExternalToolSpec } from '../../src/core/external-tool';

const require = createRequire(import.meta.url);
const PW = 'review-fixes-d-pw';
const T0 = new Date('2026-09-25T08:00:00').getTime();
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function key(sel: string, key: string): void {
  document.querySelector(sel)!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** 带脸谱素材的人物（详情页 / 撕掉确认都要 monthly 与 manualEvents 可选） */
function drawnPerson(over: Partial<PersonEntry> = {}): PersonEntry {
  const digest: FaceDigest = {
    person: '## 画像\n构造画像',
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

const noteOf = (id: string, ts: string, summary: string) => ({ id, ts, summary, createdAt: '2026-09-01T00:00:00.000Z' });

/** 往保库记录的聊天仓段塞已描述的留影（图片页签的预览网格靠它） */
async function seedSuppImages(safe: PeopleSafeStore, talker: string, texts: string[]): Promise<void> {
  const msgs: StoreContact['msgs'] = texts.map((t, i) => ({
    key: `img:k${i}`, ts: T0 + i, isSender: false, type: 3, img: `2026-09/IMG_${i}.jpg`, text: t,
  }));
  await safe.write(talker, (rec) => {
    rec.store = {
      msgs,
      watermarkSid: texts.length,
      stats: { msgCount: msgs.length, voiceCount: 0, voiceTotalSec: 0, imageCount: texts.length },
      kindCounts: { 图片: texts.length },
      updatedAt: new Date(T0).toISOString(),
    };
  });
}

let lastSafe: PeopleSafeStore;

async function bootStore(seed: PersonEntry[]): Promise<PeopleSafeStore> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  // peopleDataDir 给个占位路径：留影网格（suppDataRoot）与补充素材页要它非空才出预览
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: 'E:/bz-d-构造' }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  const safe = new PeopleSafeStore(sm);
  lastSafe = safe;
  setPeopleSafeStoreForTests(safe);
  for (const p of seed) {
    await safe.write(p.id, (rec) => { rec.person = p; });
  }
  return safe;
}

/** 数据源相关用例的临时真实数据根（datasource 读库外目录走 window.require('fs')） */
let dataRoot = '';
function bootDsRoot(contacts: Array<[string, string]>): void {
  dataRoot = mkdtempSync(join(tmpdir(), 'bz-people-d-'));
  for (const [name, msg] of contacts) {
    mkdirSync(join(dataRoot, name), { recursive: true });
    writeFileSync(join(dataRoot, name, 'chat.json'), JSON.stringify([{ ct: 1_750_000_000, type: 1, msg }]));
  }
}

async function bootWithDsRoot(contacts: Array<[string, string]>): Promise<PeopleSafeStore> {
  bootDsRoot(contacts);
  const safe = await bootStore([drawnPerson()]);
  (window as unknown as { require?: unknown }).require = require;
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: dataRoot }) as never);
  setJobsModuleForTests(fakeEngine());
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(isPeopleOpen()).toBe(true));
  openDataSource();
  await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeTruthy());
  await vi.waitFor(() => expect(document.querySelectorAll('.bz-people-ds-row').length).toBe(contacts.length));
  return safe;
}

async function openAlbum(): Promise<void> {
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(document.querySelector('[data-people-pocket]')).toBeTruthy());
}

async function openDetail(id: string): Promise<void> {
  click(`[data-people-pocket="${id}"]`);
  await vi.waitFor(() => expect(document.querySelector(`[data-people-detail="${id}"]`)).toBeTruthy());
}

async function openNoteOf(id: string): Promise<void> {
  await openDetail(id);
  click(`[data-people-detail="${id}"] [data-people-act="note"]`);
  await vi.waitFor(() => expect(document.querySelector('[data-people-sub="note"]')).toBeTruthy());
}

/** 进档案编辑态（无档案人物走「补人物档案」入口） */
async function openProfEditor(id: string): Promise<void> {
  await openDetail(id);
  click(`[data-people-detail="${id}"] [data-people-act="prof"]`);
  await vi.waitFor(() => expect(document.querySelector('[data-people-sub="prof"]')).toBeTruthy());
  click('[data-people-prof-new], [data-people-prof-edit]');
  await vi.waitFor(() => expect(document.querySelector('.bz-people-prof-edit')).toBeTruthy());
}

// ---------------- 假引擎（进度便签渲染与取消确认用） ----------------

class FakeEngine {
  items: JobView[] = [];
  calls = { remove: [] as string[], resume: [] as string[] };
  private listeners: Array<(s: JobsSnapshot) => void> = [];

  startJobs = async (): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }> => ({ queued: [], skipped: [], resumed: [] });
  resumeJobs = async (): Promise<void> => {};
  resume = (talker: string): boolean => { this.calls.resume.push(talker); return true; };
  pauseJobs = (): void => {};
  removeJob = (talker: string): boolean => {
    this.calls.remove.push(talker);
    const before = this.items.length;
    this.items = this.items.filter((j) => j.talker !== talker);
    if (this.items.length < before) { this.emit(); return true; }
    return false;
  };
  subscribe = (fn: (s: JobsSnapshot) => void): (() => void) => {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
  };
  snapshot = (): JobsSnapshot => this.snap();
  push(items: JobView[]): void {
    this.items = items;
    this.emit();
  }
  private snap(): JobsSnapshot {
    const currentIndex = this.items.findIndex((j) => j.status === 'running');
    const queue: JobView[] = this.items.map((job, i) => ({
      ...job,
      batchesTotal: job.chunks?.length ?? 0,
      queueIndex: i + 1,
      queueTotal: this.items.length,
    }));
    return { queue, currentIndex, running: currentIndex >= 0 };
  }
  private emit(): void {
    const s = this.snap();
    for (const fn of [...this.listeners]) fn(s);
  }
}

function fakeEngine(queue: JobView[] = []): FakeEngine {
  const e = new FakeEngine();
  e.push(queue);
  return e;
}

const fakeJob = (partial: Partial<PersonJob>): JobView =>
  ({ talker: 'wxid_a', name: '陈默', status: 'paused', stage: 'extracting', batchesDone: 2, batchesTotal: 3, queueIndex: 1, queueTotal: 1, ...partial } as JobView);

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  setUnlockGateForTests(async () => true);
});

afterEach(async () => {
  for (let i = 0; i < 3; i++) await tick(0);
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setPeopleSafeStoreForTests(null);
  setUnlockGateForTests(null);
  setRecordingRunnerForTests(null);
  resetRecordingProcessesForTests();
  if (dataRoot) {
    try { rmSync(dataRoot, { recursive: true, force: true }); } catch { /* 临时目录尽力清 */ }
    dataRoot = '';
  }
});

// ---------------- 1 留影大图换 core 灯箱 ----------------

describe('留影接 core 灯箱（D 组 1）', () => {
  it('点留影缩略图出 core 灯箱（不再是域内自绘罩层）：标题留影、描述上底部说明、箭头在场', async () => {
    const safe = await bootStore([drawnPerson()]);
    await seedSuppImages(safe, 'wxid_a', ['[图片] 在山顶', '[图片] 吃火锅', '[图片] 看展']);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    await openNoteOf('wxid_a');
    click('[data-people-supp-tab="image"]');
    await vi.waitFor(() => expect(document.querySelectorAll('[data-people-supp-img-view]').length).toBe(3));

    click('[data-people-supp-img-view]');
    await vi.waitFor(() => expect(document.querySelector('.bz-lightbox')).toBeTruthy());
    // core 灯箱的形状：head 标题「留影」+ 底部说明 = 所点那张的描述（首格 = 仓里最后一张）
    expect(document.querySelector('.bz-lightbox-title')!.textContent).toBe('留影');
    expect(document.querySelector('.bz-lightbox-foot')!.textContent).toBe('看展');
    expect(document.querySelector('.bz-lightbox-prev')).toBeTruthy();
    expect(document.querySelector('.bz-lightbox-next')).toBeTruthy();
    // 域内自绘罩层退役：面板上不再出现它的类
    expect(document.querySelector('.bz-people-supp-imgview')).toBeNull();
  });

  it('灯箱内翻到下一张：内容跟着留影网格的顺序走；Esc 收灯箱不收面板', async () => {
    const safe = await bootStore([drawnPerson()]);
    await seedSuppImages(safe, 'wxid_a', ['[图片] 在山顶', '[图片] 吃火锅', '[图片] 看展']);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    await openNoteOf('wxid_a');
    click('[data-people-supp-tab="image"]');
    await vi.waitFor(() => expect(document.querySelectorAll('[data-people-supp-img-view]').length).toBe(3));
    click('[data-people-supp-img-view]');
    await vi.waitFor(() => expect(document.querySelector('.bz-lightbox')).toBeTruthy());

    click('.bz-lightbox-next');
    expect(document.querySelector('.bz-lightbox-foot')!.textContent).toBe('吃火锅');
    click('.bz-lightbox-next');
    expect(document.querySelector('.bz-lightbox-foot')!.textContent).toBe('在山顶');
    // 末位再翻不动（禁用），←→ 键回退
    expect((document.querySelector('.bz-lightbox-next') as HTMLButtonElement).disabled).toBe(true);
    key('.bz-lightbox', 'ArrowLeft');
    expect(document.querySelector('.bz-lightbox-foot')!.textContent).toBe('吃火锅');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-lightbox')).toBeNull(); // Esc 只收灯箱
    expect(isPeopleOpen()).toBe(true); // 面板还在
    expect(document.querySelector('[data-people-sub="note"]')).toBeTruthy();
  });
});

// ---------------- 2 键盘可达 ----------------

describe('键盘可达（D 组 2）', () => {
  it('照片格 Enter / Space 抽照片（此前键盘只聚焦不动作）', async () => {
    await bootStore([drawnPerson()]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    key('[data-people-pocket="wxid_a"]', 'Enter');
    await vi.waitFor(() => expect(document.querySelector('[data-people-detail="wxid_a"]')).toBeTruthy());

    // 合上再试 Space（Enter / Space 同走 pullPhoto）
    click('[data-people-act="back"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-detail="wxid_a"]')).toBeNull());
    key('[data-people-pocket="wxid_a"]', ' ');
    await vi.waitFor(() => expect(document.querySelector('[data-people-detail="wxid_a"]')).toBeTruthy());
  });

  it('无弹窗无详情 ←/→ 翻摊：左页序号跟着走', async () => {
    const seeds = Array.from({ length: 13 }, (_, i) =>
      drawnPerson({ id: `wxid_${i}`, name: `友人${i}`, createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() }));
    await bootStore(seeds);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    const firstNo = document.querySelector('.bz-people-head-count-in b')!.textContent;
    expect(firstNo).toBe('1');
    key('[data-people-pocket="wxid_0"]', 'ArrowRight');
    await vi.waitFor(() => expect(document.querySelector('.bz-people-head-count-in b')!.textContent).toBe('3'));
    key('.bz-people-spread', 'ArrowLeft');
    await vi.waitFor(() => expect(document.querySelector('.bz-people-head-count-in b')!.textContent).toBe('1'));
  });

  it('焦点在输入框里：Enter 不直提交、←/→ 不误触翻摊', async () => {
    await bootStore([drawnPerson()]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    click('[data-people-dialog="find"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="find"]')).toBeTruthy());
    const inp = document.querySelector<HTMLInputElement>('[data-people-find]')!;
    inp.focus();
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await tick(20);
    // 还稳稳停在找一找这页：没翻摊、没误触任何提交
    expect(document.querySelector('[data-people-sub="find"]')).toBeTruthy();
    expect(document.querySelector('[data-people-detail]')).toBeNull();
  });
});

// ---------------- 3 数据源页脚「画脸谱」退役 ----------------

describe('数据源页脚「画脸谱」退役（D 组 3）', () => {
  const state = (over: Partial<DsModalState> = {}): DsModalState => ({
    dataDir: 'D:/数据', scanning: false, importing: false,
    rows: [{ name: '陈默', displayName: '陈默', rawCount: 45, isGroup: false, media: '', previewCount: 10, newCount: 3, newApprox: false, processedTs: null, avatar: null, imported: true }],
    selected: ['陈默'], hiddenGroups: 0, notice: '', desktopOnly: false, scannedAt: '', syncing: false, sync: null,
    filter: '', totalRows: 1, allRows: undefined,
    ...over,
  });

  it('导入完成态也不再出「画脸谱」钮：页脚只剩勾选总账与「导入所选」（水位行的「未画脸谱」是另一码事）', () => {
    const page = dsPage(state());
    expect(page.querySelector('[data-people-ds-generate]')).toBeNull();
    expect(page.querySelector('.bz-people-pop-foot')!.textContent).not.toContain('画脸谱');
    expect(page.querySelector('[data-people-ds-import]')).toBeTruthy();
  });
});

// ---------------- 4 档案编辑脏守卫 ----------------

describe('档案编辑脏守卫（D 组 4）', () => {
  const typeInto = (sel: string, value: string): void => {
    const inp = document.querySelector<HTMLInputElement>(sel)!;
    inp.value = value;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('脏着切折：先出「放弃？」确认且已输入内容不丢；放弃才清编辑态并切过去', async () => {
    await bootStore([drawnPerson()]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    await openProfEditor('wxid_a');
    typeInto('[data-people-prof-field="hometown"]', '杭州');

    click('[data-people-fold="e"]'); // 点纪事折签
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-leave-ok]')).toBeTruthy());
    // 确认是就地插入：整页没重画，输入的「杭州」还在框里
    expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="hometown"]')!.value).toBe('杭州');
    // 还没放弃：编辑态与原折都没动
    expect(document.querySelector('.bz-people-prof-edit')).toBeTruthy();
    expect(document.querySelector('[data-people-fold="e"].on')).toBeNull();

    click('[data-people-prof-leave-ok]');
    await vi.waitFor(() => expect(document.querySelector('.bz-people-prof-edit')).toBeNull());
    expect(document.querySelector('[data-people-fold="e"].on')).toBeTruthy(); // 放弃后切到了纪事折
    expect(document.querySelector('[data-people-prof-leave-ok]')).toBeNull();
  });

  it('脏着按 Esc：同一道确认；「继续编辑」收起确认留在原地（内容原样）', async () => {
    await bootStore([drawnPerson()]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    await openProfEditor('wxid_a');
    typeInto('[data-people-prof-field="hometown"]', '苏州');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-leave-ok]')).toBeTruthy());
    expect(document.querySelector('[data-people-sub="prof"]')).toBeTruthy(); // Esc 没有关掉这页

    click('[data-people-prof-leave-cancel]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-prof-leave-ok]')).toBeNull());
    // 留在编辑态：编辑卡与输入值原样（确认条就地摘除，不重画）
    expect(document.querySelector('.bz-people-prof-edit')).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>('[data-people-prof-field="hometown"]')!.value).toBe('苏州');
  });

  it('不脏直接切折：不出确认，直接过去', async () => {
    await bootStore([drawnPerson()]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    await openProfEditor('wxid_a');
    click('[data-people-fold="b"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-fold="b"].on')).toBeTruthy());
    expect(document.querySelector('[data-people-prof-leave-ok]')).toBeNull();
    expect(document.querySelector('.bz-people-prof-edit')).toBeNull(); // 编辑态照旧退出
  });
});

// ---------------- 5 随手记「撕掉」行内确认 ----------------

describe('随手记撕掉行内确认（D 组 5）', () => {
  it('记一笔页签：单击撕掉不删、出确认；确认才删；取消还原', async () => {
    await bootStore([drawnPerson({ manualEvents: [noteOf('ev1', '2026-05-01', '第一笔'), noteOf('ev2', '2026-05-02', '第二笔')] })]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    await openNoteOf('wxid_a');
    // 页签是面板级记忆态（前面的用例可能把 suppTab 留在留影/原声）——显式回到「记一笔」
    click('[data-people-supp-tab="text"]');
    await vi.waitFor(() => expect(document.querySelectorAll('[data-people-note-del]').length).toBe(2));

    click('[data-people-note-del]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-note-del-ok]')).toBeTruthy());
    // 单击没删：两条都还在，被点那条的就地换成确认
    expect(document.querySelectorAll('.bz-people-note-row').length).toBe(2);
    expect(document.querySelector('.bz-people-note-row')!.textContent).toContain('撕掉这张？');

    click('[data-people-note-del-cancel]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-note-del-ok]')).toBeNull());
    expect(document.querySelectorAll('.bz-people-note-row').length).toBe(2); // 取消还原

    click('[data-people-note-del]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-note-del-ok]')).toBeTruthy());
    click('[data-people-note-del-ok]');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-people-note-row').length).toBe(1));
    expect(getNoticeMessages().some((m) => m.includes('已删除随手记'))).toBe(true);
  });

  it('纪事折入口：同一套确认（撕掉 → 确认才删）', async () => {
    await bootStore([drawnPerson({ manualEvents: [noteOf('ev1', '2026-05-01', '第一笔')] })]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    await openDetail('wxid_a');
    click('[data-people-fold="e"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-note-del]')).toBeTruthy());

    click('[data-people-note-del]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-note-del-ok]')).toBeTruthy());
    expect(document.querySelector('[data-people-note-del]')).toBeNull(); // 按钮换成了确认
    click('[data-people-note-del-cancel]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-note-del]')).toBeTruthy()); // 还原
  });
});

// ---------------- 6 画谱「取消」加确认框 ----------------

describe('画谱取消先确认（D 组 6）', () => {
  it('点取消出流程框（写明断点一并丢弃与已完成批数）；「继续画」不动任务，「取消任务」才删', async () => {
    await bootStore([drawnPerson()]);
    const engine = fakeEngine([fakeJob({ status: 'paused', batchesDone: 2 })]);
    setJobsModuleForTests(engine);
    await openAlbum();
    await vi.waitFor(() => expect(document.querySelector('[data-people-jobs-cancel]')).toBeTruthy());

    click('[data-people-jobs-cancel]');
    await vi.waitFor(() => expect(document.querySelector('#__shared_confirm_popup__')).toBeTruthy());
    const popup = document.querySelector('#__shared_confirm_popup__')!;
    expect(popup.textContent).toContain('已完成的批次断点将一并丢弃');
    expect(popup.textContent).toContain('已完成 2 批');

    // 「继续画」：任务留着
    click('#__shared_confirm_cancel__');
    await vi.waitFor(() => expect(document.querySelector('#__shared_confirm_popup__')).toBeNull());
    expect(engine.calls.remove).toEqual([]);
    expect(document.querySelector('[data-people-jobs-cancel]')).toBeTruthy();

    // 「取消任务」：真删
    click('[data-people-jobs-cancel]');
    await vi.waitFor(() => expect(document.querySelector('#__shared_confirm_popup__')).toBeTruthy());
    click('#__shared_confirm_ok__');
    await vi.waitFor(() => expect(engine.calls.remove).toEqual(['wxid_a']));
    expect(getNoticeMessages().some((m) => m.includes('已取消这次画脸谱'))).toBe(true);
  });
});

// ---------------- 7 三小项 ----------------

describe('导入归并段逐人进度（D 组 7①）', () => {
  it('归并循环把「正在并入「某某」（i/total）」原位刷进导入通知行', async () => {
    await bootWithDsRoot([['陈默', '早'], ['林晚', '在吗']]);
    // 勾上两位
    const rows = [...document.querySelectorAll('[data-people-ds-check]')];
    for (const r of rows) r.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();
    // 拖慢第一位的落库写：归并段的逐人进度在等待窗口里看得见
    const origWrite = lastSafe.write.bind(lastSafe);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let first = true;
    (lastSafe as unknown as { write: unknown }).write = async (...args: unknown[]) => {
      if (first) { first = false; await gate; }
      return (origWrite as (...a: unknown[]) => Promise<unknown>)(...args);
    };
    click('[data-people-ds-import]');
    await vi.waitFor(() => {
      const t = document.querySelector('[data-people-ds-notice]')?.textContent ?? '';
      return /正在并入「.+」（1\/2）…/.test(t);
    });
    release();
    // 导入完成即合页（issue 507 沿用）
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeNull());
  });
});

describe('关面板录音在跑出后台提示（D 组 7②）', () => {
  it('录音转写在跑时关面板：info 交代「转后台继续」；没有在跑的则不打扰', async () => {
    await bootStore([drawnPerson()]);
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    // 假进程壳：起一条不终结的录音任务（占住 running 注册表）
    setRecordingRunnerForTests((spec: ExternalToolSpec, cb: ExternalToolCallbacks) => {
      void spec; void cb;
      return {
        stop: () => {},
        done: new Promise<ExternalToolOutcome>(() => {}), // 永不终结
      };
    });
    startRecordingTask({ cmd: 'bz-face', args: [] }, 'E:/构造/wxid_a/a.turns.json', undefined, { talker: 'wxid_a', file: 'a.m4a', dataRoot: 'E:/构造' });

    closePeoplePanel();
    expect(getNoticeMessages().some((m) => m.includes('录音转写转后台继续，重开面板查看进度'))).toBe(true);
    expect(getNoticeMessages().every((m) => !m.includes('已转后台继续生成'))).toBe(true); // 画谱没在跑，不出那份
  });
});

describe('找一找结果行真头像（D 组 7③）', () => {
  it('结果行带上保库记录里的头像 data URL（不再写死空串落成首字圆章）', async () => {
    const safe = await bootStore([drawnPerson({ name: '陈默' }), drawnPerson({ id: 'wxid_b', name: '林晚', createdAt: '2026-02-01T00:00:00.000Z' })]);
    await safe.write('wxid_b', () => {}, { avatar: { base64: 'aGVsbG8=', ext: 'jpg' } });
    setJobsModuleForTests(fakeEngine());
    await openAlbum();
    click('[data-people-dialog="find"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="find"]')).toBeTruthy());
    const inp = document.querySelector<HTMLInputElement>('[data-people-find]')!;
    inp.value = '陈';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('[data-people-find-open]')).toHaveLength(1));

    const want = await safe.avatarDataUrl('wxid_b');
    // 林晚不在「陈」的结果里——改搜「晚」验她的真头像
    inp.value = '晚';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('[data-people-find-open]')).toHaveLength(1));
    const img = document.querySelector('.bz-people-find-ava img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(want);
  });
});

// ---------------- 8 数据源页过滤框 ----------------

describe('数据源页过滤框（D 组 8）', () => {
  it('键入过滤行数变化、页眉报「N / 共 M 位」；勾选跨过滤保留（页脚账不丢被滤掉的勾选）；清空恢复全列表', async () => {
    await bootWithDsRoot([['陈默', '早'], ['陈大', '吃了吗'], ['林晚', '在吗']]);
    // 先勾上「林晚」
    const rowOf = (name: string): HTMLElement =>
      [...document.querySelectorAll<HTMLElement>('.bz-people-ds-row')].find((r) => r.textContent?.includes(name))!;
    rowOf('林晚').querySelector<HTMLElement>('[data-people-ds-check]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();
    expect(document.querySelector('[data-people-ds-count]')!.textContent).toContain('已选 1 位');

    // 键入「陈」：只剩两位，页眉 N / 共 M 位
    const inp = document.querySelector<HTMLInputElement>('[data-people-ds-filter]')!;
    inp.value = '陈';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-people-ds-row')).toHaveLength(2));
    expect(document.querySelector('.bz-people-head-note')!.textContent).toBe('2 / 共 3 位');
    // 被滤掉的「林晚」勾选不丢：页脚账照算（口径 = 全量行）
    expect(document.querySelector('[data-people-ds-count]')!.textContent).toContain('已选 1 位');

    // 清空过滤：全列表回来，勾选还在
    click('[data-people-ds-filter-clear]');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-people-ds-row')).toHaveLength(3));
    expect(document.querySelector('.bz-people-head-note')!.textContent).toContain('3 位联系人');
    expect(rowOf('林晚').querySelector('[data-people-ds-check]')!.getAttribute('aria-checked')).toBe('true');
    // 清空后焦点回到过滤框（与找一找同口径）
    expect(document.activeElement).toBe(document.querySelector('[data-people-ds-filter]'));
  });

  it('过滤无匹配：给「没匹配」提示，不渲染空列表', async () => {
    await bootWithDsRoot([['陈默', '早'], ['林晚', '在吗']]);
    const inp = document.querySelector<HTMLInputElement>('[data-people-ds-filter]')!;
    inp.value = '不存在';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-people-ds-row')).toHaveLength(0));
    expect(document.querySelector('[data-people-sub="ds"]')!.textContent).toContain('没匹配「不存在」');
    expect(document.querySelector('.bz-people-head-note')!.textContent).toBe('0 / 共 2 位');
  });

  it('键盘 Space 切勾选（勾选框可聚焦）：与点击同账，不可勾的档 Space 无效', async () => {
    await bootWithDsRoot([['陈默', '早'], ['林晚', '在吗']]);
    key('[data-people-ds-check]', ' ');
    await tick();
    expect(document.querySelector('[data-people-ds-check]')!.getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('[data-people-ds-count]')!.textContent).toContain('已选 1 位');
    key('[data-people-ds-check]', ' ');
    await tick();
    expect(document.querySelector('[data-people-ds-check]')!.getAttribute('aria-checked')).toBe('false');
  });
});
