/**
 * 番茄钟数据层测试（ticket 27）：pomodoro.json 读写 + storagePath 优先 + 容错
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { PomodoroDataManager, POMODORO_FILE_PATH, getPomodoroFilePath, defaultPomodoroData } from '../../src/pomodoro/data';
import { createInitialState, recover, DEFAULT_DURATIONS, DEFAULT_OPTIONS } from '../../src/pomodoro/state';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

describe('getPomodoroFilePath', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
  });

  it('默认 CONFIG/STORAGE/pomodoro.json', () => {
    expect(getPomodoroFilePath()).toBe('CONFIG/STORAGE/pomodoro.json');
  });

  it('storagePath 设置优先', () => {
    setSettingsProvider(() => ({ storagePath: 'DATA/番茄' } as any));
    expect(getPomodoroFilePath()).toBe('DATA/番茄/pomodoro.json');
  });
});

describe('PomodoroDataManager', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
  });

  it('load：文件不存在 → 默认数据 + 建默认数据文件（统一读写语义）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.version).toBe(1);
    expect(data.state).toEqual(createInitialState());
    expect(data.history).toEqual([]);
    expect(vault.files.has(POMODORO_FILE_PATH)).toBe(true); // 统一读写语义：缺失建文件
  });

  it('load：坏 JSON → 原文件改名留档重建 + 默认数据', async () => {
    const vault = new MockVault();
    const broken = '{oops';
    vault.files.set(POMODORO_FILE_PATH, broken);
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.state.phase).toBe('idle');
    expect(data.history).toEqual([]);
    // 统一读写语义：原内容改名留档（不再直接覆盖丢失）
    const backups = [...vault.files.keys()].filter((p) => p.startsWith(POMODORO_FILE_PATH + '.corrupt-'));
    expect(backups).toHaveLength(1);
    expect(vault.files.get(backups[0])).toBe(broken);
    expect(JSON.parse(vault.files.get(POMODORO_FILE_PATH)!)).toEqual(defaultPomodoroData());
  });

  it('load：解析正常数据（含部分缺省补齐）', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: 123456, remaining: 0, paused: false, cycleFocusCount: 2 },
        history: [{ ts: 1, duration: 1500 }],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.state.phase).toBe('focus');
    expect(data.state.endTime).toBe(123456);
    expect(data.state.cycleFocusCount).toBe(2);
    expect(data.history).toEqual([{ ts: 1, duration: 1500 }]);
  });

  it('load：history 非法条目被过滤', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [{ ts: 1, duration: 1500 }, { ts: 'x' }, null, { duration: 5 }],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.history).toEqual([{ ts: 1, duration: 1500 }]);
  });

  it('save：新文件建目录并写入（jsonStore 语义）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    await dm.save({ version: 1, state: createInitialState(), history: [{ ts: 9, duration: 1500 }] });
    expect(vault.files.get(POMODORO_FILE_PATH)).toBeTruthy();
    const raw = JSON.parse(vault.files.get(POMODORO_FILE_PATH)!);
    expect(raw.version).toBe(1);
    expect(raw.state.phase).toBe('idle');
    expect(raw.history).toEqual([{ ts: 9, duration: 1500 }]);
  });

  it('save：覆盖既有文件', async () => {
    const vault = new MockVault();
    vault.files.set(POMODORO_FILE_PATH, JSON.stringify(defaultPomodoroData()));
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    await dm.save({ version: 1, state: { phase: 'focus', endTime: 42, remaining: 0, paused: false, cycleFocusCount: 1 }, history: [] });
    const raw = JSON.parse(vault.files.get(POMODORO_FILE_PATH)!);
    expect(raw.state.phase).toBe('focus');
    expect(raw.state.endTime).toBe(42);
  });

  it('load：非法 phase / 负数 remaining 回退默认', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'weird', endTime: 5, remaining: -3, paused: 'yes', cycleFocusCount: 'x' },
        history: [],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.state.phase).toBe('idle');
    expect(data.state.remaining).toBe(0);
    expect(data.state.paused).toBe(false);
    expect(data.state.cycleFocusCount).toBe(0);
  });

  it('恢复链路：load 暂停态 + recover 不流转', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: null, remaining: 1200, paused: true, cycleFocusCount: 1 },
        history: [],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    const r = recover(data.state, data.history, Date.now() + 3_600_000, DEFAULT_DURATIONS, DEFAULT_OPTIONS);
    expect(r.state.paused).toBe(true);
    expect(r.state.remaining).toBe(1200);
    expect(r.history.length).toBe(0);
  });

  it('恢复链路：load 运行中超时 → recover 回空闲（ticket 62 不补算）→ save 落盘', async () => {
    const vault = new MockVault();
    const now = Date.now();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: now - 60_000, remaining: 0, paused: false, cycleFocusCount: 3 },
        history: [],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    const r = recover(data.state, data.history, now, DEFAULT_DURATIONS, DEFAULT_OPTIONS);
    expect(r.state.phase).toBe('idle'); // 超时 → 回空闲（不再补算流转）
    expect(r.state.endTime).toBeNull();
    expect(r.history.length).toBe(0); // 不编造历史
    await dm.save({ version: 1, state: r.state, history: r.history });
    const reloaded = await dm.load();
    expect(reloaded.state.phase).toBe('idle');
    expect(reloaded.history).toEqual(r.history);
  });

  it('load：旧数据 state 残留 target 字段 → 忽略不迁移（ticket 63）', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0, target: { type: 'book', path: '书库/活着.md', label: '读《活着》' } },
        history: [],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect((data.state as any).target).toBeUndefined(); // target 字段不再写入新状态
  });

  it('load：history 带 target 条目保留（target 字段忽略）', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [
          { ts: 1, duration: 1500, target: { type: 'memo', id: 'm1', label: '写报告' } },
          { ts: 2, duration: 1500 },
        ],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.history).toHaveLength(2); // 合法条目保留
    expect((data.history[0] as any).target).toBeUndefined(); // target 字段忽略
    expect(data.history[1].duration).toBe(1500);
  });

  it('往返：save → load 数据一致（无 target/reading 字段）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = {
      version: 1 as const,
      state: { phase: 'long-break' as const, endTime: null, remaining: 900, paused: false, cycleFocusCount: 0 },
      history: [{ ts: 1, duration: 1500 }, { ts: 2, duration: 1500 }],
    };
    await dm.save(data);
    const loaded = await dm.load();
    expect(loaded).toEqual(data);
  });

  it('load：旧数据 reading 字段（ticket 51-56 遗留）→ 忽略不迁移（ticket 63）', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [],
        reading: { active: true, book: { path: '书架/活着.epub', title: '活着' }, state: { phase: 'focus', endTime: 1, remaining: 0, paused: false, cycleFocusCount: 0 } },
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect((data as any).reading).toBeUndefined(); // reading 字段不再进入新数据
  });

  it('pausedBy 冻结来源标记：合法值保留 / 非法值与旧数据回退 undefined（P1-4）', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: null, remaining: 600, paused: true, cycleFocusCount: 1, pausedBy: 'autopause' },
        history: [],
      })
    );
    let app = makeApp(vault);
    setApp(app);
    let dm = new PomodoroDataManager(app);
    expect((await dm.load()).state.pausedBy).toBe('autopause'); // 合法标记保留

    // 非法值 → 回退 undefined（手动暂停语义，重启后仍锁定）
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: null, remaining: 600, paused: true, cycleFocusCount: 1, pausedBy: 'manual' },
        history: [],
      })
    );
    dm = new PomodoroDataManager(app);
    expect((await dm.load()).state.pausedBy).toBeUndefined();

    // 旧数据无此字段 → undefined（兼容读取）
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: null, remaining: 600, paused: true, cycleFocusCount: 1 },
        history: [],
      })
    );
    dm = new PomodoroDataManager(app);
    expect((await dm.load()).state.pausedBy).toBeUndefined();
  });

  it('pausedBy 往返：冻结落盘写入标记；手动暂停保存后文件不含该键（P1-4）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    // 冻结态保存 → 文件带 pausedBy:'autopause'
    await dm.save({
      version: 1,
      state: { phase: 'focus', endTime: null, remaining: 600, paused: true, pausedBy: 'autopause', cycleFocusCount: 1 },
      history: [],
    });
    let raw = JSON.parse(vault.files.get(POMODORO_FILE_PATH)!);
    expect(raw.state.pausedBy).toBe('autopause');
    // 手动暂停态保存 → 不写该键
    await dm.save({
      version: 1,
      state: { phase: 'focus', endTime: null, remaining: 600, paused: true, cycleFocusCount: 1 },
      history: [],
    });
    raw = JSON.parse(vault.files.get(POMODORO_FILE_PATH)!);
    expect('pausedBy' in raw.state).toBe(false);
  });
});
