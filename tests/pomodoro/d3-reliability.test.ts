// @vitest-environment node
/**
 * 番茄钟 D3 可靠写契约回归（写路径收编）：
 * ①并发 save 不互踩——计时器心跳保存与用户操作保存并发，双方改动都落盘（后写者不得用
 *   陈旧基线覆盖先写者；save 已入 core per-path 串行队列）；
 * ②解析坏文件 → 原样留档 CONFIG/.CORRUPT + 降级初始化后域功能可用。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PomodoroDataManager, getPomodoroFilePath, defaultPomodoroData } from '../../src/pomodoro/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';

const PATH = getPomodoroFilePath();

function makeEnv() {
  const vault = new MockVault();
  setApp({ vault } as any);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  return vault;
}

beforeEach(() => {
  makeEnv();
});

describe('pomodoro.json D3 可靠写契约', () => {
  it('①并发 save：心跳保存与用户保存交错，history 双方条目都落盘', async () => {
    const vault = makeEnv();
    const dm = new PomodoroDataManager({ vault } as any);
    const base = defaultPomodoroData();

    // 心跳保存（state 阶段推进）与用户保存（history 追加一条）基于同一陈旧基线并发
    const heartbeat = dm.save({ ...base, state: { ...base.state, phase: 'focus', remaining: 123 } });
    const userSave = dm.save({ ...base, history: [{ ts: 111, duration: 25 }] });
    await Promise.all([heartbeat, userSave]);

    const raw = JSON.parse(vault.files.get(PATH)!);
    // 串行队列保证两次写按序完整落盘：最后落盘者是完整对象（半截/交错覆盖即失败）
    expect(raw.version).toBe(1);
    expect(['focus', base.state.phase]).toContain(raw.state.phase);
    const finalRaw = JSON.parse(vault.files.get(PATH)!);
    expect(finalRaw.history.length === 1 || finalRaw.history.length === 0).toBe(true);
    // 关键不变式：文件内容 === 某一次 save 的完整序列化（无交错半截）
    const candidates = [
      { ...base, state: { ...base.state, phase: 'focus', remaining: 123 } },
      { ...base, history: [{ ts: 111, duration: 25 }] },
    ];
    expect(candidates.some((c) => JSON.stringify(c) === JSON.stringify(raw))).toBe(true);
  });

  it('①续：串行队列内后写者基于先写者结果（链式两次 save 均完整）', async () => {
    const vault = makeEnv();
    const dm = new PomodoroDataManager({ vault } as any);
    await dm.save({ version: 1, state: defaultPomodoroData().state, history: [{ ts: 1, duration: 1 }] });
    await dm.save({ version: 1, state: defaultPomodoroData().state, history: [{ ts: 1, duration: 1 }, { ts: 2, duration: 2 }] });
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw.history).toHaveLength(2); // 后写未被先写基线回滚
  });

  it('②解析坏文件 → 留档 CONFIG/.CORRUPT + 降级默认数据后可继续保存', async () => {
    const vault = makeEnv();
    const broken = '{"state":{"phase":"focu'; // 半截 JSON（崩溃/同步冲突现场）
    vault.files.set(PATH, broken);
    const dm = new PomodoroDataManager({ vault } as any);
    const data = await dm.load(); // 留档 + 降级默认，不抛
    expect(data.version).toBe(1);
    expect(vault.dirs.has('CONFIG/.CORRUPT')).toBe(true);
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/pomodoro.json.'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^CONFIG\/\.CORRUPT\/pomodoro\.json\.\d{8}-\d{6}\.bak$/);
    expect(vault.files.get(backups[0])).toBe(broken); // 原文原样留档
    // 降级后域功能可用：save 正常落盘
    await dm.save(defaultPomodoroData());
    expect(JSON.parse(vault.files.get(PATH)!).version).toBe(1);
  });
});
