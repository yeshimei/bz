/**
 * 文献盒批量处理器测试（src/bili-downloader/processor.ts）：
 * 严格串行逐部（一次一部）、[bz-step]/[bz-p]/[bz-result] 解析、单部失败继续、
 * 遇错即停（设置项）、中止整批、非桌面端提示、设置项透传（清晰度/保留视频/输出目录）。
 * 外部进程一律经 window.require 打桩，无真实子进程与网络。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { BatchRunner } from '../../src/bili-downloader/processor';
import { TasksData } from '../../src/bili-downloader/data';
import type { BiliTask } from '../../src/bili-downloader/types';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';

/** 假子进程：stdout/stderr 可 emit；kill 可断言 */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn(() => true);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function seedTasks(): Promise<BiliTask[]> {
  await TasksData.addTask({ url: 'BV1xx411c7mD', start: '1:02:03', end: '1:05:00' });
  await TasksData.addTask({ url: 'BV1xx411c7mE' });
  return TasksData.loadTasks();
}

function makeEvents() {
  return { onTaskProgress: vi.fn(), onTaskDone: vi.fn(), onBatchDone: vi.fn() };
}

describe('BatchRunner', () => {
  let vault: MockVault;
  let child: FakeChild;
  let cpMock: { spawn: ReturnType<typeof vi.fn> };
  const origRequire = (window as any).require;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    TasksData.init({ storagePath: 'CONFIG/STORAGE' });
    child = new FakeChild();
    cpMock = { spawn: vi.fn(() => child) };
    (window as any).require = () => cpMock;
    clearNotices();
  });

  afterEach(() => {
    (window as any).require = origRequire;
    vi.restoreAllMocks();
    BatchRunner.running = false;
    BatchRunner.aborted = false;
    BatchRunner.stoppedFail = false;
    BatchRunner._child = null;
    setSettingsProvider(() => ({}) as any);
    clearNotices();
  });

  it('非桌面端（无 window.require）→ 错误提示且不进入处理', async () => {
    (window as any).require = undefined;
    const ev = makeEvents();
    await BatchRunner.runAll([], ev);
    expect(getNoticeMessages().join('\n')).toContain('仅桌面端可用：文献盒处理需要 Node.js 外部进程');
    expect(ev.onBatchDone).not.toHaveBeenCalled();
  });

  it('步骤文案持久化：[bz-step] 落库后 UI 重读可见（修「一直显示启动中」）', async () => {
    const tasks = await seedTasks();
    const ev = makeEvents();
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    child.stdout.emit('data', Buffer.from('[bz-step] 解析中\n'));
    await tick();
    let all = await TasksData.loadTasks();
    expect(all[0].status).toBe('processing');
    expect(all[0].reason).toBe('解析中');
    child.stdout.emit('data', Buffer.from('[bz-step] 下载中\n'));
    await tick();
    all = await TasksData.loadTasks();
    expect(all[0].reason).toBe('下载中');
    expect(ev.onTaskProgress).toHaveBeenCalledTimes(3); // 启动中 + 解析中 + 下载中
    BatchRunner.abort();
    child.emit('close', 0);
    await p;
  });

  it('严格串行：第一部 spawn 后未完成前不 spawn 第二部；逐步文案 + [bz-result] 落终态', async () => {
    const tasks = await seedTasks();
    const steps: string[] = [];
    const done: BiliTask[] = [];
    const ev = {
      onTaskProgress: (t: BiliTask, s: string) => steps.push(`${t.id}:${s}`),
      onTaskDone: (t: BiliTask) => done.push(t),
      onBatchDone: vi.fn(),
    };
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    // 串行：只 spawn 了第一部
    expect(cpMock.spawn).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = cpMock.spawn.mock.calls[0];
    expect(cmd).toBe('bili-dl'); // 无 fs.existsSync → 全局 shim
    expect(args[0]).toBe('--batch');
    // ADR-0066：设置项随任务 JSON 透传（测试无 provider → 默认值）
    expect(JSON.parse(args[1])).toEqual({
      url: 'BV1xx411c7mD', start: '1:02:03', end: '1:05:00',
      options: { quality: 'highest', keepVideo: true, outputDir: '' },
    });
    expect(opts.shell).toBe(true);
    child.stdout.emit('data', Buffer.from('[bz-step] 下载中\n[bz-step] 剪辑中\n'));
    child.stdout.emit('data', Buffer.from('[bz-result] {"note":"文献盒/测试.md","video":"CONFIG/APPENDIX/v.mp4"}\n'));
    child.emit('close', 0);
    await tick();
    expect(steps).toContain(`${tasks[0].id}:下载中`);
    expect(steps).toContain(`${tasks[0].id}:剪辑中`);
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ status: 'success', notePath: '文献盒/测试.md', videoPath: 'CONFIG/APPENDIX/v.mp4' });
    let all = await TasksData.loadTasks();
    expect(all[0].status).toBe('success');
    // 第一部完成后才 spawn 第二部
    expect(cpMock.spawn).toHaveBeenCalledTimes(2);
    const child2 = cpMock.spawn.mock.results[1].value;
    child2.emit('close', 0);
    await p;
    expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 2, failed: 0, aborted: false, stopped: false });
    all = await TasksData.loadTasks();
    expect(all.map((x) => x.status).sort()).toEqual(['success', 'success']);
  });

  it('单部失败继续剩余：失败项带原因、后续继续处理', async () => {
    const tasks = await seedTasks();
    const ev = makeEvents();
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(1);
    child.stderr.emit('data', Buffer.from('视频已删除或失效'));
    child.emit('close', 1);
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(2); // 继续跑第二部
    const child2 = cpMock.spawn.mock.results[1].value;
    child2.emit('close', 0);
    await p;
    expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 1, failed: 1, aborted: false, stopped: false });
    const all = await TasksData.loadTasks();
    const f = all.find((x) => x.id === tasks[0].id)!;
    expect(f.status).toBe('failed');
    expect(f.reason).toContain('视频已删除或失效');
    expect(all[1].status).toBe('success');
  });

  it('spawn 同步抛 ENOENT → 失败原因含安装引导', async () => {
    cpMock = { spawn: vi.fn(() => { throw Object.assign(new Error('spawn bili-dl ENOENT'), { code: 'ENOENT' }); }) };
    const tasks = await seedTasks();
    const ev = makeEvents();
    const p = BatchRunner.runAll(tasks, ev);
    await p;
    const all = await TasksData.loadTasks();
    expect(all[0].status).toBe('failed');
    expect(all[0].reason).toContain('未找到 bili-dl');
    expect(all[1].status).toBe('failed');
    expect(all[1].reason).toContain('未找到 bili-dl');
    expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 0, failed: 2, aborted: false, stopped: false });
  });

  it('中止整批：当前项标记已中止、kill 子进程、未开始项保持待处理', async () => {
    const tasks = await seedTasks();
    const ev = makeEvents();
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(1);
    BatchRunner.abort();
    expect(child.kill).toHaveBeenCalled();
    child.emit('close', 0); // 即使进程正常退出，aborted 优先 → 已中止
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(1); // 第二部不再启动
    await p;
    expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 0, failed: 1, aborted: true, stopped: false });
    const all = await TasksData.loadTasks();
    expect(all.find((x) => x.id === tasks[0].id)!.status).toBe('failed');
    expect(all.find((x) => x.id === tasks[0].id)!.reason).toBe('已中止');
    expect(all.find((x) => x.id === tasks[1].id)!.status).toBe('pending');
  });

  it('running 期间重复 runAll 直接忽略', async () => {
    const tasks = await seedTasks();
    BatchRunner.running = true;
    const ev = makeEvents();
    await BatchRunner.runAll(tasks, ev);
    expect(cpMock.spawn).not.toHaveBeenCalled();
    expect(ev.onBatchDone).not.toHaveBeenCalled();
    BatchRunner.running = false;
  });

  it('[bz-p] 进度行解析：onTaskProgress 第三参带阶段百分比，瞬态不落库', async () => {
    const tasks = await seedTasks();
    const seen: Array<{ step: string; prog: any }> = [];
    const ev = {
      onTaskProgress: (t: BiliTask, s: string, p?: any) => seen.push({ step: s, prog: p ?? null }),
      onTaskDone: vi.fn(),
      onBatchDone: vi.fn(),
    };
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    child.stdout.emit('data', Buffer.from('[bz-step] 下载中\n'));
    child.stdout.emit('data', Buffer.from('[bz-p] {"phase":"download","pct":42.5}\n'));
    child.stdout.emit('data', Buffer.from('[bz-p] {"phase":"download","pct":88}\n'));
    child.stdout.emit('data', Buffer.from('[bz-p] {"phase":"download","pct":null}\n'));
    await tick();
    // 进度事件三连：step 文案沿用当前步骤，pct 依次 42.5 / 88 / null
    const progs = seen.filter((x) => x.prog && x.prog.phase === 'download');
    expect(progs.map((x) => x.prog.pct)).toEqual([42.5, 88, null]);
    // 进度是瞬态：storage 里 reason 仍是步骤文案（未因进度行变化）
    const all = await TasksData.loadTasks();
    expect(all[0].reason).toBe('下载中');
    BatchRunner.abort();
    child.emit('close', 0);
    await p;
  });

  it('遇错即停（设置开启）：首部失败后不再 spawn 剩余，onBatchDone stopped:true', async () => {
    setSettingsProvider(() => ({ biliStopOnFailure: true }) as any);
    const tasks = await seedTasks();
    const ev = makeEvents();
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(1);
    child.emit('close', 1); // 首部失败
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(1); // 不再跑第二部
    await p;
    expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 0, failed: 1, aborted: false, stopped: true });
    const all = await TasksData.loadTasks();
    expect(all[0].status).toBe('failed');
    expect(all[1].status).toBe('pending'); // 未开始项保持待处理
  });

  it('设置项透传：quality/keepVideo/outputDir 随任务 JSON 下发', async () => {
    setSettingsProvider(() => ({ biliQuality: '720', biliKeepVideo: false, biliOutputDir: 'D:/videos' }) as any);
    const tasks = await TasksData.loadTasks();
    if (tasks.length === 0) await TasksData.addTask({ url: 'BV1xx411c7mD' });
    const ev = makeEvents();
    const p = BatchRunner.runAll(await TasksData.loadTasks(), ev);
    await tick();
    const [, args] = cpMock.spawn.mock.calls[0];
    expect(JSON.parse(args[1]).options).toEqual({ quality: '720', keepVideo: false, outputDir: 'D:/videos' });
    child.emit('close', 0);
    await p;
  });
});