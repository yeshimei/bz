// @vitest-environment node
/**
 * 工具坞面板数据（`<数据目录>/dock.json` + 设置里的 `dockTrust`）—— ADR-0239。
 *
 * 守卫六件（都是行为断言，不是读源码文本）：
 *  1. 文件不存在 → 建缺省文件（开关缺省开、登记表空）；
 *  2. 老库迁移：四个旧键读旧删旧、登记项进 dock.json、**信任摘出来留在设置**；
 *  3. 文件已存在 → 迁移种子不落盘（不覆盖面板里改过的值）；
 *  4. **文件里带的信任字段一律忽略**（信任只认设置里的 `dockTrust`）—— 这条是安全边界：
 *     dock.json 住在 vault 里，照收文件里的 trustedAt 就等于「别人的 vault 替我授权」；
 *  5. 写回：登记表进文件（剥信任）、信任进设置，两边互不串；
 *  6. 两个开关的读写与落盘（同步 set + persist 的两段式）；
 *  7. `loadData()` 返回 null（全新 vault）时迁移不抛 —— main.ts 直递原始值，别把 null 当对象。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, IndexLagVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import {
  __resetDockStoreForTests,
  dockStorePath,
  loadDockStore,
  migrateLegacyDockSettings,
  normalizeDockStore,
  readTrustMap,
  writeTrustMap,
  DOCK_STORE_FILENAME,
} from '../../src/dock/store';
import {
  readToolEntries,
  readRunStates,
  readTrustRecords,
  saveToolEntries,
  readDockSwitch,
  saveDockSwitch,
  untrustTool,
} from '../../src/dock/data';
import { runSignature } from '../../src/dock/registry';

const PATH = 'CONFIG/STORAGE/dock.json';
const ENTRY = { id: 'iamtxt-signin', path: 'E:/tools/iamtxt-signin/manifest.json', enabled: true };

describe('工具坞面板数据（dock.json + dockTrust）', () => {
  let vault: MockVault;
  let settings: Record<string, unknown>;
  let saved: number;

  beforeEach(() => {
    vault = new MockVault();
    settings = { storagePath: 'CONFIG/STORAGE' };
    saved = 0;
    setApp({ vault } as never);
    setSettingsProvider(() => settings as never);
    setSettingsSaver(async () => {
      saved += 1;
    });
    __resetDockStoreForTests();
  });

  afterEach(() => {
    __resetDockStoreForTests();
  });

  it('文件不在 → 建缺省文件；开关缺省开、登记表空', async () => {
    await loadDockStore();
    expect(dockStorePath()).toBe(PATH); // 跟随 storagePath
    expect(vault.files.has(PATH)).toBe(true);
    expect(JSON.parse(vault.files.get(PATH)!)).toEqual({
      v: 1,
      tools: [],
      runState: {},
      autoRun: true,
      notifyMissed: true,
    });
    expect(readToolEntries()).toEqual([]);
    expect(readDockSwitch('autoRun')).toBe(true);
    expect(readDockSwitch('notifyMissed')).toBe(true);
  });

  it('老库迁移：四键读旧删旧；登记项进 dock.json；信任摘出来留在设置', () => {
    const loaded: Record<string, unknown> = {
      dockTools: [{ ...ENTRY, trustedAt: '2026-10-04T05:27:55.787Z', trustedRun: 'node\u0000raw\u0000main.mjs' }],
      dockRunState: { 'iamtxt-signin': { consecutiveFailures: 2 } },
      dockAutoRun: false,
      dockNotifyMissed: false,
    };
    const mig = migrateLegacyDockSettings(loaded);
    expect(mig).not.toBeNull();
    // 读旧删旧：四把键一个不留
    for (const k of ['dockTools', 'dockRunState', 'dockAutoRun', 'dockNotifyMissed']) {
      expect(k in loaded).toBe(false);
    }
    // 信任归设置
    expect(mig!.trust).toEqual({ 'iamtxt-signin': { at: '2026-10-04T05:27:55.787Z', run: 'node\u0000raw\u0000main.mjs' } });
    expect(readTrustMap()).toEqual({}); // 还没写进设置对象
    // 登记项进种子，且**剥掉**信任
    expect(mig!.seed.tools).toEqual([ENTRY]);
    expect(mig!.seed.autoRun).toBe(false);
    expect(mig!.seed.notifyMissed).toBe(false);
    expect(mig!.seed.runState).toEqual({ 'iamtxt-signin': { consecutiveFailures: 2 } });
  });

  it('无老键 → 不迁移（返回 null，不碰设置对象）', () => {
    const loaded: Record<string, unknown> = { storagePath: 'CONFIG/STORAGE' };
    expect(migrateLegacyDockSettings(loaded)).toBeNull();
    expect(loaded).toEqual({ storagePath: 'CONFIG/STORAGE' });
  });

  it('迁移命中但设置里已有 dockTrust → 不整体覆盖（不复活已撤销的信任）', () => {
    const loaded: Record<string, unknown> = {
      dockTools: [{ ...ENTRY, trustedAt: '2020-01-01T00:00:00.000Z', trustedRun: 'old\u0000raw\u0000x' }],
      dockTrust: { iamtxt: { at: '2026-10-04T00:00:00.000Z' } },
    };
    const mig = migrateLegacyDockSettings(loaded);
    expect(mig).not.toBeNull();
    expect(mig!.trust).toEqual({ 'iamtxt-signin': { at: '2020-01-01T00:00:00.000Z', run: 'old\u0000raw\u0000x' } });
    // 设置里现存的授权原样保留，旧登记项里的信任不往里并
    expect(loaded.dockTrust).toEqual({ iamtxt: { at: '2026-10-04T00:00:00.000Z' } });
  });

  it('并发 persist 不倒挂：快照在任务执行时现取，后拨的开关最终落盘', async () => {
    await loadDockStore();
    const origWrite = vault.adapter.write.bind(vault.adapter);
    let n = 0;
    vault.adapter.write = async (p: string, c: string) => {
      const i = ++n;
      await new Promise((r) => setTimeout(r, i === 1 ? 30 : 5)); // 第一笔写得更慢，制造完成倒挂窗口
      return origWrite(p, c);
    };
    try {
      await Promise.all([saveDockSwitch('autoRun', false), saveDockSwitch('notifyMissed', false)]);
      const disk = JSON.parse(vault.files.get(PATH)!);
      expect(disk.autoRun).toBe(false);
      expect(disk.notifyMissed).toBe(false);
    } finally {
      vault.adapter.write = origWrite;
    }
  });

  it('loadData 返回 null（全新 vault）→ 迁移不抛、返回 null', () => {
    // main.ts onload 会把 `await this.loadData()` 的原始值直接递进来，全新 vault 上是 null
    expect(migrateLegacyDockSettings(null)).toBeNull();
    expect(migrateLegacyDockSettings(undefined)).toBeNull();
    expect(migrateLegacyDockSettings('nope')).toBeNull();
  });

  it('索引滞后（启动扫描未完成）：盘上已有 dock.json 时种子不得覆盖真数据', async () => {
    // onload 跑在 Obsidian 全量扫描完成之前：索引查不到盘上已有的 dock.json
    const real = { v: 1, tools: [{ ...ENTRY }], runState: {}, autoRun: false, notifyMissed: true };
    const lag = new IndexLagVault();
    lag.dirs.add('CONFIG/STORAGE');
    lag.files.set(PATH, JSON.stringify(real));
    setApp({ vault: lag } as never);
    const seed = normalizeDockStore({ v: 1, tools: [], autoRun: true, notifyMissed: true });
    const snap = await loadDockStore(seed);
    expect(snap.autoRun).toBe(false); // 快照读的是盘上真数据，不是种子
    expect(JSON.parse(lag.files.get(PATH)!)).toEqual(real); // 盘上没被种子覆盖
  });

  it('迁移种子只在文件此前不存在时落盘 —— 文件在就不覆盖', async () => {
    await loadDockStore();
    await saveToolEntries([{ id: 'kept', path: 'E:/tools/kept/manifest.json' }]);
    // 再来一次「带种子的装载」：文件已存在 → 种子被忽略
    const seed = normalizeDockStore({ v: 1, tools: [ENTRY], autoRun: false, notifyMissed: false });
    await loadDockStore(seed);
    expect(readToolEntries().map((e) => e.id)).toEqual(['kept']);
    expect(readDockSwitch('autoRun')).toBe(true);
  });

  it('安全边界：dock.json 里带的信任字段一律忽略（信任只认设置）', async () => {
    vault.files.set(
      PATH,
      JSON.stringify({
        v: 1,
        tools: [{ ...ENTRY, trustedAt: '2026-01-01T00:00:00.000Z', trustedRun: 'evil\u0000raw\u0000x' }],
        runState: {},
        autoRun: true,
        notifyMissed: true,
      }),
    );
    await loadDockStore();
    const [entry] = readToolEntries();
    expect(entry.trustedAt).toBeUndefined();
    expect(entry.trustedRun).toBeUndefined();
  });

  it('写回分家：登记表进文件（剥信任）、信任进设置，互不串', async () => {
    await loadDockStore();
    await saveToolEntries([
      { ...ENTRY, trustedAt: '2026-10-04T05:00:00.000Z', trustedRun: 'node\u0000raw\u0000main.mjs' },
    ]);
    const file = JSON.parse(vault.files.get(PATH)!);
    expect(file.tools).toEqual([ENTRY]); // 文件里没有信任字段
    expect(settings.dockTrust).toEqual({ 'iamtxt-signin': { at: '2026-10-04T05:00:00.000Z', run: 'node\u0000raw\u0000main.mjs' } });
    expect(readTrustRecords()).toEqual(settings.dockTrust);
    expect(saved).toBeGreaterThan(0);
    // 读回来：信任从设置并回登记项
    const [back] = readToolEntries();
    expect(back.trustedAt).toBe('2026-10-04T05:00:00.000Z');
    expect(back.trustedRun).toBe(runSignature({ cmd: 'node', args: ['main.mjs'] }));
  });

  it('撤销信任只动设置，不动 dock.json', async () => {
    await loadDockStore();
    await saveToolEntries([{ ...ENTRY, trustedAt: '2026-10-04T05:00:00.000Z' }]);
    const fileBefore = vault.files.get(PATH);
    await untrustTool('iamtxt-signin');
    expect(settings.dockTrust).toEqual({});
    expect(vault.files.get(PATH)).toBe(fileBefore);
    expect(readToolEntries()[0].trustedAt).toBeUndefined();
  });

  it('信任表归一：坏条目丢弃、run 缺省不填', () => {
    settings.dockTrust = { ok: { at: 'a' }, bad: { run: 'x' }, worse: 'nope', ok2: { at: 'b', run: 'r' } };
    expect(readTrustMap()).toEqual({ ok: { at: 'a' }, ok2: { at: 'b', run: 'r' } });
  });

  it('信任表没变则不写设置（不惊动 data.json）', async () => {
    const map = { a: { at: 'x' } };
    expect(await writeTrustMap(map)).toBe(true);
    const before = saved;
    expect(await writeTrustMap({ a: { at: 'x' } })).toBe(false);
    expect(saved).toBe(before);
  });

  it('台账（runState）读写往返', async () => {
    await loadDockStore();
    await saveToolEntries([ENTRY]);
    expect(readRunStates()).toEqual({});
    const { patchRunState } = await import('../../src/dock/data');
    await patchRunState('iamtxt-signin', { lastAttemptAt: '2026-10-04T05:00:00.000Z', consecutiveFailures: 3 });
    expect(readRunStates()['iamtxt-signin'].consecutiveFailures).toBe(3);
    await patchRunState('iamtxt-signin', null);
    expect(readRunStates()).toEqual({});
  });

  it('两个开关：同步 set 改内存、persist 才落盘', async () => {
    await loadDockStore();
    await saveDockSwitch('autoRun', false);
    expect(readDockSwitch('autoRun')).toBe(false);
    expect(JSON.parse(vault.files.get(PATH)!).autoRun).toBe(false);
    // 形态不对（非 false）一律视为开
    vault.files.set(PATH, JSON.stringify({ v: 1, tools: [], runState: {}, autoRun: 'x', notifyMissed: null }));
    await loadDockStore();
    expect(readDockSwitch('autoRun')).toBe(true);
    expect(readDockSwitch('notifyMissed')).toBe(true);
  });

  it('版本不认识 → 当没写过（缺省值，不猜）', async () => {
    vault.files.set(PATH, JSON.stringify({ v: 99, tools: [ENTRY], autoRun: false }));
    await loadDockStore();
    expect(readToolEntries()).toEqual([]);
    expect(readDockSwitch('autoRun')).toBe(true);
  });

  it('面板数据文件名常量与路径同源', () => {
    expect(DOCK_STORE_FILENAME).toBe('dock.json');
  });
});
