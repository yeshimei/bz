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

  it('load：文件不存在 → 默认数据（不建文件）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.version).toBe(1);
    expect(data.state).toEqual(createInitialState());
    expect(data.history).toEqual([]);
    expect(vault.files.has(POMODORO_FILE_PATH)).toBe(false);
  });

  it('load：坏 JSON → 默认数据', async () => {
    const vault = new MockVault();
    vault.files.set(POMODORO_FILE_PATH, '{oops');
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.state.phase).toBe('idle');
    expect(data.history).toEqual([]);
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
    await dm.save({ version: 1, state: { phase: 'focus', endTime: 42, remaining: 0, paused: false, cycleFocusCount: 1, target: null }, history: [] });
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

  it('恢复链路：load 运行中超时 → recover 重建为已完成 → save 落盘', async () => {
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
    expect(r.state.phase).toBe('long-break'); // 第 4 个专注完成 → 长休
    expect(r.state.cycleFocusCount).toBe(0);
    expect(r.history.length).toBe(1);
    expect(r.history[0].duration).toBe(25 * 60);
    await dm.save({ version: 1, state: r.state, history: r.history });
    const reloaded = await dm.load();
    expect(reloaded.state.phase).toBe('long-break');
    expect(reloaded.history).toEqual(r.history);
  });

  it('load：state 带合法 target 保留（重启目标不丢）；非法 target 回退 null', async () => {
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
    expect(data.state.target).toEqual({ type: 'book', path: '书库/活着.md', label: '读《活着》' });

    // 非法 target
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0, target: { type: 'evil', label: 1 } },
        history: [],
      })
    );
    const data2 = await dm.load();
    expect(data2.state.target).toBeNull();
  });

  it('load：history 条目 target 保留；非法 target 条目被过滤', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0, target: null },
        history: [
          { ts: 1, duration: 1500, target: { type: 'memo', id: 'm1', label: '写报告' } },
          { ts: 2, duration: 1500, target: { type: 'bad' } }, // 非法 target → 整条过滤
          { ts: 3, duration: 1500 },
        ],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.history).toHaveLength(2);
    expect(data.history[0].target).toEqual({ type: 'memo', id: 'm1', label: '写报告' });
    expect(data.history[1].target).toBeUndefined();
  });

  it('往返：save → load 数据一致', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = {
      version: 1 as const,
      state: { phase: 'long-break' as const, endTime: null, remaining: 900, paused: false, cycleFocusCount: 0, target: null },
      history: [{ ts: 1, duration: 1500 }, { ts: 2, duration: 1500 }],
      reading: { active: false, book: null, state: { phase: 'idle' as const, endTime: null, remaining: 0, paused: false, cycleFocusCount: 0, target: null }, prevState: null },
    };
    await dm.save(data);
    const loaded = await dm.load();
    expect(loaded).toEqual(data);
  });

  it('load：旧数据无 reading 字段 → 空会话（兼容不破坏）', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.reading).toEqual({ active: false, book: null, state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0, target: null }, prevState: null });
  });

  it('load：非法 reading 字段 → 归一为空会话（book 非法 / state 缺合法 phase）', async () => {
    const vault = new MockVault();
    vault.files.set(
      POMODORO_FILE_PATH,
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [],
        reading: { active: true, book: { path: 3 }, state: { phase: 'focus', endTime: 1, remaining: 0, paused: false, cycleFocusCount: 0 } },
      })
    );
    const app = makeApp(vault);
    setApp(app);
    const dm = new PomodoroDataManager(app);
    const data = await dm.load();
    expect(data.reading).toEqual({ active: false, book: null, state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0, target: null }, prevState: null });
  });
});
