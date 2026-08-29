/**
 * 文献盒批量处理器测试（src/bili-downloader/processor.ts）：
 * 严格串行逐部（一次一部）、[bz-step]/[bz-p]/[bz-result] 解析、单部失败继续、
 * 遇错即停（设置项）、中止整批、非桌面端提示、设置项透传（清晰度/保留视频/输出目录）。
 * 外部进程一律经 window.require 打桩，无真实子进程与网络。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { BatchRunner } from '../../src/literature/processor';
import { LiteratureData } from '../../src/literature/data';
import type { LiteratureTask } from '../../src/literature/types';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { onDomainEvent } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';

/** 假子进程：stdout/stderr 可 emit；kill 可断言 */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn(() => true);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function seedTasks(): Promise<LiteratureTask[]> {
  await LiteratureData.addTask({ url: 'BV1xx411c7mD', start: '1:02:03', end: '1:05:00' });
  await LiteratureData.addTask({ url: 'BV1xx411c7mE' });
  return LiteratureData.loadTasks();
}

function makeEvents() {
  return { onTaskProgress: vi.fn(), onTaskInfo: vi.fn(), onTaskDone: vi.fn(), onBatchDone: vi.fn() };
}

describe('BatchRunner', () => {
  let vault: MockVault;
  let child: FakeChild;
  let cpMock: { spawn: ReturnType<typeof vi.fn> };
  const origRequire = (window as any).require;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    LiteratureData.init({ storagePath: 'CONFIG/STORAGE' });
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
    let all = await LiteratureData.loadTasks();
    expect(all[0].status).toBe('processing');
    expect(all[0].reason).toBe('解析中');
    child.stdout.emit('data', Buffer.from('[bz-step] 下载中\n'));
    await tick();
    all = await LiteratureData.loadTasks();
    expect(all[0].reason).toBe('下载中');
    expect(ev.onTaskProgress).toHaveBeenCalledTimes(3); // 启动中 + 解析中 + 下载中
    BatchRunner.abort();
    child.emit('close', 0);
    await p;
  });

  it('严格串行：第一部 spawn 后未完成前不 spawn 第二部；逐步文案 + [bz-result] 落终态', async () => {
    const tasks = await seedTasks();
    const steps: string[] = [];
    const done: LiteratureTask[] = [];
    const ev = {
      onTaskProgress: (t: LiteratureTask, s: string) => steps.push(`${t.id}:${s}`),
      onTaskInfo: vi.fn(),
      onTaskDone: (t: LiteratureTask) => done.push(t),
      onBatchDone: vi.fn(),
    };
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    // 串行：只 spawn 了第一部
    expect(cpMock.spawn).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = cpMock.spawn.mock.calls[0];
    expect(cmd).toBe('bili-dl'); // 无 fs.existsSync → 全局 shim
    expect(args[0]).toBe('--batch');
    // ADR-0066/0067：设置项与分P 随任务 JSON 透传（测试无 provider → 设置默认值、无分P）
    expect(JSON.parse(args[1])).toEqual({
      url: 'BV1xx411c7mD', start: '1:02:03', end: '1:05:00', page: null,
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
    let all = await LiteratureData.loadTasks();
    expect(all[0].status).toBe('success');
    // 第一部完成后才 spawn 第二部
    expect(cpMock.spawn).toHaveBeenCalledTimes(2);
    const child2 = cpMock.spawn.mock.results[1].value;
    child2.emit('close', 0);
    await p;
    expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 2, failed: 0, aborted: false, stopped: false });
    all = await LiteratureData.loadTasks();
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
    const all = await LiteratureData.loadTasks();
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
    const all = await LiteratureData.loadTasks();
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
    const all = await LiteratureData.loadTasks();
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
      onTaskProgress: (t: LiteratureTask, s: string, p?: any) => seen.push({ step: s, prog: p ?? null }),
      onTaskInfo: vi.fn(),
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
    const all = await LiteratureData.loadTasks();
    expect(all[0].reason).toBe('下载中');
    BatchRunner.abort();
    child.emit('close', 0);
    await p;
  });

  it('遇错即停（设置开启）：首部失败后不再 spawn 剩余，onBatchDone stopped:true', async () => {
    setSettingsProvider(() => ({ literatureStopOnFailure: true }) as any);
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
    const all = await LiteratureData.loadTasks();
    expect(all[0].status).toBe('failed');
    expect(all[1].status).toBe('pending'); // 未开始项保持待处理
  });

  it('设置项透传：quality/keepVideo/outputDir 随任务 JSON 下发', async () => {
    setSettingsProvider(() => ({ literatureQuality: '720', literatureKeepVideo: false, literatureOutputDir: 'D:/videos' }) as any);
    const tasks = await LiteratureData.loadTasks();
    if (tasks.length === 0) await LiteratureData.addTask({ url: 'BV1xx411c7mD' });
    const ev = makeEvents();
    const p = BatchRunner.runAll(await LiteratureData.loadTasks(), ev);
    await tick();
    const [, args] = cpMock.spawn.mock.calls[0];
    expect(JSON.parse(args[1]).options).toEqual({ quality: '720', keepVideo: false, outputDir: 'D:/videos' });
    child.emit('close', 0);
    await p;
  });

  it('任务级覆盖透传：task.page=2 / task.quality=1080 覆盖全局设置（ADR-0067）', async () => {
    setSettingsProvider(() => ({ literatureQuality: 'highest' }) as any);
    const t = await LiteratureData.addTask({ url: 'BV1xx411c7mD', quality: '1080', page: 2 });
    const ev = makeEvents();
    const p = BatchRunner.runAll(await LiteratureData.loadTasks(), ev);
    await tick();
    const [, args] = cpMock.spawn.mock.calls[0];
    const json = JSON.parse(args[1]);
    expect(json.page).toBe(2);
    expect(json.options.quality).toBe('1080'); // 任务级优先于全局
    child.emit('close', 0);
    await p;
    void t;
  });

  it('[bz-info] 解析信息：落库 title/uploader + onTaskInfo + 域事件 parsed（ADR-0067）', async () => {
    const bus: any[] = [];
    const sub = onDomainEvent('literature:tasks', (e) => bus.push(e));
    try {
      const tasks = await seedTasks();
      const ev = makeEvents();
      const p = BatchRunner.runAll(tasks, ev);
      await tick();
      child.stdout.emit('data', Buffer.from('[bz-step] 解析中\n'));
      child.stdout.emit('data', Buffer.from('[bz-info] {"title":"从零开始学B站","uploader":"某UP","bvid":"BV1xx411c7mD","url":"https://www.bilibili.com/video/BV1xx411c7mD","duration":600}\n'));
      await tick();
      expect(ev.onTaskInfo).toHaveBeenCalledTimes(1);
      let all = await LiteratureData.loadTasks();
      expect(all[0].title).toBe('从零开始学B站');
      expect(all[0].uploader).toBe('某UP');
      expect(bus).toHaveLength(1);
      expect(bus[0]).toMatchObject({ kind: 'parsed', url: 'BV1xx411c7mD', title: '从零开始学B站', uploader: '某UP' });
      BatchRunner.abort();
      child.emit('close', 0);
      await p;
    } finally {
      sub();
    }
  });

  it('再次批量处理：失败项续跑（重跑含 failed，成功项跳过，ADR-0067 断点续跑入口）', async () => {
    const tasks = await seedTasks();
    const ev = makeEvents();
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    child.stdout.emit('data', Buffer.from('[bz-step] 解析中\n[bz-info] {"title":"测试视频","uploader":"UP主","bvid":"BV1xx411c7mD","url":"BV1xx411c7mD","duration":600}\n'));
    child.emit('close', 1); // 首部失败（解析信息已留存 → 断点续跑场景）
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(2); // 第二部照常
    const child2 = cpMock.spawn.mock.results[1].value;
    child2.emit('close', 0);
    await p;
    let all = await LiteratureData.loadTasks();
    expect(all[0].status).toBe('failed');
    await vi.waitFor(async () => {
      const cur = await LiteratureData.loadTasks();
      expect(cur[0].title).toBe('测试视频'); // 解析信息落库（先落库后事件，确定性）
    });
    all = await LiteratureData.loadTasks();
    expect(all[1].archived).toBe(true);
    // 再点批量处理：只处理失败项，成功（归档）项跳过
    const ev2 = makeEvents();
    const p2 = BatchRunner.runAll(all, ev2);
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(3); // 失败项续跑
    const child3 = cpMock.spawn.mock.results[2].value;
    child3.emit('close', 0);
    await p2;
    expect(ev2.onBatchDone).toHaveBeenCalledWith({ success: 1, failed: 0, aborted: false, stopped: false });
    all = await LiteratureData.loadTasks();
    expect(all.filter((x) => x.status === 'failed')).toHaveLength(0);
    expect(all.filter((x) => x.archived)).toHaveLength(2); // 两部都归档
  });

  it('成功自动归档：archived=true + archivedAt 落库（ADR-0067）', async () => {
    const tasks = await seedTasks();
    const ev = makeEvents();
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    child.stdout.emit('data', Buffer.from('[bz-result] {"note":"文献盒/测试.md","video":"CONFIG/APPENDIX/v.mp4"}\n'));
    child.emit('close', 0);
    await tick();
    const all = await LiteratureData.loadTasks();
    expect(all[0].status).toBe('success');
    expect(all[0].archived).toBe(true);
    expect(all[0].archivedAt).toBeTruthy();
    expect(all[1].archived).toBe(false); // 未处理项不归档
    // 收尾：第二部仍会 spawn——中止并关闭，防止悬挂
    BatchRunner.abort();
    const child2 = cpMock.spawn.mock.results[1]?.value;
    if (child2) child2.emit('close', 0);
    await p;
  });
});