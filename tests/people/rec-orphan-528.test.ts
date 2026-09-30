/**
 * 录音孤儿轮次与删除入口（issue 528）。
 *
 * 用户实测：「大琳，我删除了录音之后，并入的录音统计还是 410 条，没有被删除」。
 * 实况：`大琳/recordings/` 目录空（原件 2026-09-29 08:40 被清），但聊天仓里
 * `rec:大琳 周一 10点40分✔️.aac:*` 还剩 410 条轮次，`storeStatsOf` 照数不误。
 *
 * 两层根因（各钉一个断言）：
 *   1. 行集合只来自 `recordings/` 目录 → 文件没了行就消失，**删除入口跟着消失**；
 *   2. 统计集合来自仓内消息 → 那些轮次永远退不掉。两者没有交集约束 = 清不掉的账。
 *
 * 修法：行集合 = 磁盘文件 ∪ 仓内已并入文件名；孤儿行照出（徽章「源已失」、只留删除），
 * 删除走既有 suppDeleteRecording——它逐项判存在，磁盘项全跳过、仓内照清。
 * 引擎注入假件；保库用 MockVault 上的真 SafeManager；数据全构造。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetObsidianMocks } from '../mock-obsidian-entry';
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
import { storeStatsOf, type StoreContact } from '../../src/people/datasource';
import type { PersonEntry } from '../../src/people/types';

const PW = 'rec-orphan-pw';
const TALKER = '大琳';
/** 用户实测里那个文件名（带 emoji 后缀，是仓键的一部分——别改名） */
const ORPHAN_FILE = '大琳 周一 10点40分✔️.aac';
/** 仓里剩的轮次数（用户实测 410；这里取够断言口径即可） */
const TURNS = 7;
const T0 = Date.parse('2026-06-21T02:40:00Z');

function click(sel: string): void {
  const node = document.querySelector(sel);
  if (!node) throw new Error(`找不到节点：${sel}`);
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const fakeEngine = (): JobsApi => ({
  startJobs: async () => ({ queued: [], skipped: [], resumed: [] }),
  resumeJobs: async (): Promise<void> => undefined,
  resume: (): boolean => true,
  pauseJobs: (): void => undefined,
  removeJob: (): boolean => true,
  subscribe: (): (() => void) => () => undefined,
  snapshot: () => ({ queue: [], currentIndex: -1, running: false }),
});

const person = (): PersonEntry => ({ id: TALKER, name: TALKER, createdAt: '2026-06-21T00:00:00.000Z', imports: [] });

/** 仓里那 TURNS 条录音轮次（文本口径照 datasource.recordingTurnText：`[录音 3分02秒·平静] 转写`） */
function orphanStore(): StoreContact {
  const msgs: StoreContact['msgs'] = Array.from({ length: TURNS }, (_, i) => ({
    key: `rec:${ORPHAN_FILE}:${i}`,
    ts: T0 + i * 30_000,
    isSender: i % 2 === 0,
    type: 1,
    text: `[录音 3分02秒·平静] 第 ${i} 轮的转写正文`,
  }));
  return {
    msgs,
    watermarkSid: 0,
    stats: storeStatsOf(msgs),
    kindCounts: { 录音: TURNS },
    updatedAt: new Date(T0).toISOString(),
  };
}

let dataRoot = '';
let safe: PeopleSafeStore;

/** 起一个真临时数据根（默认空 recordings/）+ 保库，并把面板开到原声页签 */
async function boot(opts: { seedDiskFile?: string } = {}): Promise<void> {
  dataRoot = mkdtempSync(join(tmpdir(), 'bz-rec-orphan-'));
  mkdirSync(join(dataRoot, TALKER, 'recordings'), { recursive: true });
  if (opts.seedDiskFile) writeFileSync(join(dataRoot, TALKER, 'recordings', opts.seedDiskFile), 'fake-audio');

  const vault = new MockVault();
  setApp(makeApp(vault));
  // suppFs() 走 window.require('fs')（桌面口径）——不挂桩的话 record/目录读不到，行集合恒空
  (window as unknown as { require?: unknown }).require = require;
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: dataRoot }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
  await safe.write(TALKER, (rec) => {
    rec.person = person();
    rec.store = orphanStore();
  });

  setJobsModuleForTests(fakeEngine());
  setUnlockGateForTests(() => Promise.resolve(true));
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(document.querySelector(`[data-people-pocket="${TALKER}"]`)).toBeTruthy());
  click(`[data-people-pocket="${TALKER}"]`);
  await vi.waitFor(() => expect(document.querySelector(`[data-people-detail="${TALKER}"]`)).toBeTruthy());
  click(`[data-people-detail="${TALKER}"] [data-people-act="note"]`);
  await vi.waitFor(() => expect(document.querySelector('[data-people-sub="note"]')).toBeTruthy());
  click('[data-people-supp-tab="rec"]');
}

/** 仓里还剩多少条 rec 轮次（删除后的真判据，不看界面） */
async function vaultRecCount(): Promise<number> {
  const rec = await safe.read(TALKER);
  return (rec?.store.msgs ?? []).filter((m) => m.key.startsWith('rec:')).length;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

afterEach(() => {
  try {
    closePeoplePanel();
  } catch {
    /* 幂等 */
  }
  setJobsModuleForTests(null);
  setPeopleSafeStoreForTests(null);
  setUnlockGateForTests(null);
  delete (window as unknown as { require?: unknown }).require;
  if (dataRoot) {
    try {
      rmSync(dataRoot, { recursive: true, force: true });
    } catch {
      /* Windows 句柄未释放时忍一下：临时目录随系统清 */
    }
    dataRoot = '';
  }
});

describe('录音孤儿轮次（issue 528）', () => {
  it('磁盘没有原件、仓里有轮次 → 行照出（徽章「源已失」）并给删除入口', async () => {
    await boot();
    await vi.waitFor(() => expect(document.querySelector(`[data-people-supp-row="${ORPHAN_FILE}"]`)).toBeTruthy());

    const row = document.querySelector<HTMLElement>(`[data-people-supp-row="${ORPHAN_FILE}"]`)!;
    // 修复前：这一行根本不存在（行集合只来自 recordings/ 目录），删除入口一起消失
    expect(row.querySelector('.bz-people-supp-badge')?.textContent).toBe('源已失');
    expect(row.classList.contains('orphan')).toBe(true);
    // 如实报「仓里还剩几条」——用户看到的 410 就是这个数
    expect(row.textContent).toContain(`仓内 ${TURNS} 条转写轮次仍在统计`);
    // 删除入口在（这是清掉它的唯一路径）
    expect(row.querySelector(`[data-people-supp-rec-del="${ORPHAN_FILE}"]`)).not.toBeNull();
    // 原件与 sidecar 都不在：改起点 / 查看轮次无从谈起，不给
    expect(row.querySelector(`[data-people-supp-rec-start-edit="${ORPHAN_FILE}"]`)).toBeNull();
    expect(row.querySelector(`[data-people-supp-rec-turns="${ORPHAN_FILE}"]`)).toBeNull();
    // 顺带钉住统计口径：仓里那 7 条真的被 storeStatsOf 数成录音
    const rec = await safe.read(TALKER);
    expect(rec?.store.stats.recordingCount).toBe(TURNS);
  });

  it('喊明「为什么统计退不掉、去哪清」——页头出提示块', async () => {
    await boot();
    await vi.waitFor(() => expect(document.querySelector('.bz-people-supp-orphans')).toBeTruthy());
    const box = document.querySelector<HTMLElement>('.bz-people-supp-orphans')!;
    expect(box.textContent).toContain('原件已不在磁盘');
    expect(box.textContent).toContain('转写轮次还在');
    expect(box.textContent).toContain('点「删除」即可清掉');
  });

  it('确认面板：只说清仓里轮次，不给「同时删除录音原件」这个勾（原件早就不在了）', async () => {
    await boot();
    await vi.waitFor(() => expect(document.querySelector(`[data-people-supp-rec-del="${ORPHAN_FILE}"]`)).toBeTruthy());
    click(`[data-people-supp-rec-del="${ORPHAN_FILE}"]`);
    await vi.waitFor(() => expect(document.querySelector(`[data-people-supp-rec-del-ok="${ORPHAN_FILE}"]`)).toBeTruthy());

    const box = document.querySelector<HTMLElement>(`.bz-people-supp-row[data-people-supp-row="${ORPHAN_FILE}"] .bz-people-supp-delbox`)!;
    expect(box.textContent).toContain('原件已不在磁盘');
    expect(box.textContent).toContain(`那 ${TURNS} 条转写轮次`);
    expect(box.querySelector(`[data-people-supp-rec-del-file="${ORPHAN_FILE}"]`)).toBeNull();
    // 收起（recDelPending 在关面板后不会复位：不清掉会污染下一个用例，也顺带钉住这个已知遗留）
    click(`[data-people-supp-rec-del-cancel="${ORPHAN_FILE}"]`);
    await vi.waitFor(() => expect(document.querySelector(`[data-people-supp-rec-del-ok="${ORPHAN_FILE}"]`)).toBeNull());
  });

  it('点确认 → 仓内轮次真清掉、统计归零、行消失（用户要的就是这个）', async () => {
    await boot();
    await vi.waitFor(() => expect(document.querySelector(`[data-people-supp-rec-del="${ORPHAN_FILE}"]`)).toBeTruthy());
    expect(await vaultRecCount()).toBe(TURNS);

    click(`[data-people-supp-rec-del="${ORPHAN_FILE}"]`);
    await vi.waitFor(() => expect(document.querySelector(`[data-people-supp-rec-del-ok="${ORPHAN_FILE}"]`)).toBeTruthy());
    click(`[data-people-supp-rec-del-ok="${ORPHAN_FILE}"]`);

    // 仓里轮次清零（kindCounts 与 stats 同步重算）
    await vi.waitFor(async () => expect(await vaultRecCount()).toBe(0));
    const rec = await safe.read(TALKER);
    expect(rec?.store.stats.recordingCount).toBe(0);
    expect(rec?.store.kindCounts?.录音 ?? 0).toBe(0);
    // 行与提示块一起收掉（mergedRecs 刷完就没有这个文件名了）
    await vi.waitFor(() => expect(document.querySelector(`[data-people-supp-row="${ORPHAN_FILE}"]`)).toBeNull());
    expect(document.querySelector('.bz-people-supp-orphans')).toBeNull();
  });

  it('原件还在磁盘上 → 不出孤儿行、不出提示块（别把正常行误标成源已失）', async () => {
    await boot({ seedDiskFile: ORPHAN_FILE });
    // 等刷新跑完（refreshSuppStoreInfo → 重画）再断言
    await vi.waitFor(() => expect(document.querySelector('.bz-people-supp-list')).toBeTruthy());
    const row = document.querySelector<HTMLElement>(`[data-people-supp-row="${ORPHAN_FILE}"]`)!;
    expect(row.classList.contains('orphan')).toBe(false);
    expect(row.querySelector('.bz-people-supp-badge')?.textContent).not.toBe('源已失');
    expect(document.querySelector('.bz-people-supp-orphans')).toBeNull();
  });
});
