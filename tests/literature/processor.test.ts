/**
 * 文献盒批量处理器测试（src/literature/processor.ts，ticket 136/ADR-0071：AI 回迁插件侧）：
 * 严格串行逐部（一次一部）、[bz-step]/[bz-p]/[bz-info]/[bz-result] 解析、
 * CLI close(0) 后插件侧 AI 链路（读转录临时文件 → generateVideoNote → 删临时文件 →
 * 成功落库归档 + converted 域事件）、转录读取失败 / AI 失败（含未配置）→ 任务 failed
 * 不落半成品笔记（+ failed 域事件）、单部失败继续、遇错即停、中止整批、非桌面端提示、
 * taskJson options 全量下发（compress/crf/vaultPath/ffmpegPath 等）。
 * 终审修复（P2-1/P2-2/P2-4/P3-2/P2-5）：终态落库抛错（处理中被删除）批量不挂起、
 * spawn 固定全局 bili-dl（无本地 CLI 指针探测）、CLI 非 0 退出清理转录临时文件、
 * [bz-info] 不再发射 parsed 域事件（契约收敛 converted/failed）、
 * --batch 参数经 shell 启动改传 base64（`b64:` 前缀——JSON 引号/空格会被 cmd 对消，P2-5）。
 * 外部进程一律经 window.require 打桩（child_process + fs），AI 经 vi.mock('note-gen')
 * 整模块打桩（仅用 generateVideoNote），无真实网络。
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

// AI 打桩：整模块 mock note-gen（processor 仅用 generateVideoNote；ESM 命名导入可被 vi.mock 替换）
const noteGenMocks = vi.hoisted(() => ({
  generateVideoNote: vi.fn(async () => '文献盒/测试.md'),
}));
vi.mock('../../src/literature/note-gen', () => ({
  generateVideoNote: noteGenMocks.generateVideoNote,
}));

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

const TRANSCRIPT = '这是转写文稿的第一段。这是第二段！';
const RESULT_LINE = '[bz-result] {"transcript":"C:/tmp/bz-transcript-abc.txt","video":"CONFIG/APPENDIX/v.mp4"}\n';
const INFO_LINE = '[bz-info] {"title":"从零开始学B站","uploader":"某UP","bvid":"BV1xx411c7mD","url":"https://www.bilibili.com/video/BV1xx411c7mD","duration":600}\n';

describe('BatchRunner', () => {
  let vault: MockVault;
  let child: FakeChild;
  let cpMock: { spawn: ReturnType<typeof vi.fn> };
  let fsMock: { existsSync: ReturnType<typeof vi.fn>; readFileSync: ReturnType<typeof vi.fn>; unlinkSync: ReturnType<typeof vi.fn> };
  const origRequire = (window as any).require;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    LiteratureData.init({ storagePath: 'CONFIG/STORAGE' });
    child = new FakeChild();
    cpMock = { spawn: vi.fn(() => child) };
    fsMock = {
      existsSync: vi.fn(() => false), // P2-2 后不再被探测；保留以断言 spawn 决议不触碰 fs
      readFileSync: vi.fn(() => TRANSCRIPT),
      unlinkSync: vi.fn(),
    };
    // window.require 路由：child_process → spawn 桩；fs → 文件桩（AI 阶段读转录/删临时文件）
    (window as any).require = (name: string) => {
      if (name === 'child_process') return cpMock;
      if (name === 'fs') return fsMock;
      throw new Error('未知模块：' + name);
    };
    noteGenMocks.generateVideoNote.mockReset().mockResolvedValue('文献盒/测试.md');
    clearNotices();
  });

  afterEach(() => {
    (window as any).require = origRequire;
    vi.clearAllMocks();
    BatchRunner.running = false;
    BatchRunner.aborted = false;
    BatchRunner.stoppedFail = false;
    BatchRunner._child = null;
    BatchRunner._cp = null;
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

  it('严格串行 + close(0) 驱动插件侧 AI：读转录 → generateVideoNote → 删临时文件 → 成功落库归档 + converted 事件', async () => {
    const tasks = await seedTasks();
    const steps: string[] = [];
    const done: LiteratureTask[] = [];
    const bus: any[] = [];
    const sub = onDomainEvent('literature:tasks', (e) => bus.push(e));
    try {
      const ev = {
        onTaskProgress: (t: LiteratureTask, s: string) => steps.push(`${t.id}:${s}`),
        onTaskInfo: vi.fn(),
        onTaskDone: (t: LiteratureTask) => done.push(t),
        onBatchDone: vi.fn(),
      };
      const p = BatchRunner.runAll(tasks, ev);
      await tick();
      // 严格串行：第一部未完成前不 spawn 第二部；spawn 固定走全局 bili-dl shim（无本地指针探测）
      expect(cpMock.spawn).toHaveBeenCalledTimes(1);
      const [cmd, args, opts] = cpMock.spawn.mock.calls[0];
      expect(cmd).toBe('bili-dl');
      expect(args[0]).toBe('--batch');
      expect(opts.shell).toBe(true);
      child.stdout.emit('data', Buffer.from('[bz-step] 下载中\n[bz-step] 剪辑中\n'));
      child.stdout.emit('data', Buffer.from(INFO_LINE));
      child.stdout.emit('data', Buffer.from(RESULT_LINE));
      child.emit('close', 0);
      // 插件侧 AI：读转录（UTF-8 全文）→ generateVideoNote（title 取 [bz-info] 解析值）→ 删临时文件
      await vi.waitFor(() => expect(noteGenMocks.generateVideoNote).toHaveBeenCalledTimes(1));
      expect(fsMock.readFileSync).toHaveBeenCalledWith('C:/tmp/bz-transcript-abc.txt', 'utf8');
      expect(fsMock.unlinkSync).toHaveBeenCalledWith('C:/tmp/bz-transcript-abc.txt'); // 读毕删除
      expect(noteGenMocks.generateVideoNote).toHaveBeenCalledWith({
        transcript: TRANSCRIPT,
        videoTitle: '从零开始学B站',
        url: 'BV1xx411c7mD',
        uploader: '某UP',
      });
      // 插件侧 AI 步骤固定文案进时间线（ui.ts STEP_DONE_MAP 完成态按此匹配）
      expect(steps).toContain(`${tasks[0].id}:AI 生成文献笔记中`);
      expect(steps).toContain(`${tasks[0].id}:笔记落盘中`);
      // 第一部（含 AI）完成后才 spawn 第二部
      await vi.waitFor(() => expect(cpMock.spawn).toHaveBeenCalledTimes(2));
      const child2 = cpMock.spawn.mock.results[1].value;
      child2.stdout.emit('data', Buffer.from(RESULT_LINE));
      child2.emit('close', 0);
      await p;
      expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 2, failed: 0, aborted: false, stopped: false });
      const all = await LiteratureData.loadTasks();
      expect(all.map((x) => x.status).sort()).toEqual(['success', 'success']);
      const first = all.find((x) => x.id === tasks[0].id)!;
      expect(first.notePath).toBe('文献盒/测试.md'); // generateVideoNote 返回的笔记路径
      expect(first.videoPath).toBe('CONFIG/APPENDIX/v.mp4'); // [bz-result] video 落库
      expect(first.archived).toBe(true); // 成功自动归档
      expect(first.archivedAt).toBeTruthy();
      expect(done).toHaveLength(2);
      // converted 域事件：成功任务各一条，载荷带 id/url/notePath
      const converted = bus.filter((e) => e.kind === 'converted');
      expect(converted).toHaveLength(2);
      expect(converted[0]).toMatchObject({ kind: 'converted', id: tasks[0].id, url: 'BV1xx411c7mD', notePath: '文献盒/测试.md' });
    } finally {
      sub();
    }
  });

  it('转录临时文件缺失/读取失败 → 任务 failed「转录文件读取失败」、不调 AI、临时文件尽量清理', async () => {
    const tasks = await seedTasks();
    const ev = makeEvents();
    const bus: any[] = [];
    const sub = onDomainEvent('literature:tasks', (e) => bus.push(e));
    try {
      // 首部转录读取失败 → 失败继续第二部（第二部读取正常、AI 成功）
      fsMock.readFileSync = vi.fn()
        .mockImplementationOnce(() => { throw new Error('ENOENT: no such file'); })
        .mockImplementation(() => TRANSCRIPT);
      const p = BatchRunner.runAll(tasks, ev);
      await tick();
      child.stdout.emit('data', Buffer.from(RESULT_LINE));
      child.emit('close', 0);
      // 首部失败后照常继续第二部
      await vi.waitFor(() => expect(cpMock.spawn).toHaveBeenCalledTimes(2));
      const child2 = cpMock.spawn.mock.results[1].value;
      child2.stdout.emit('data', Buffer.from(RESULT_LINE));
      child2.emit('close', 0);
      await p;
      expect(noteGenMocks.generateVideoNote).toHaveBeenCalledTimes(1); // 仅第二部进入 AI；首部读失败不调 AI
      expect(fsMock.unlinkSync).toHaveBeenCalledWith('C:/tmp/bz-transcript-abc.txt'); // 失败也尝试清理
      const all = await LiteratureData.loadTasks();
      const f = all.find((x) => x.id === tasks[0].id)!;
      expect(f.status).toBe('failed');
      expect(f.reason).toBe('转录文件读取失败');
      expect(all[1].status).toBe('success');
      expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 1, failed: 1, aborted: false, stopped: false });
      expect(bus.filter((e) => e.kind === 'failed')).toHaveLength(1); // 失败部发射 failed，成功部发射 converted
      expect(bus.filter((e) => e.kind === 'converted')).toHaveLength(1);
    } finally {
      sub();
    }
  });

  it('AI 失败（含 AI 未配置）→ 该任务 failed、不落半成品笔记、临时文件清理、failed 域事件', async () => {
    await LiteratureData.addTask({ url: 'BV1xx411c7mD' });
    noteGenMocks.generateVideoNote.mockRejectedValue(new Error('未配置 AI 服务'));
    const ev = makeEvents();
    const bus: any[] = [];
    const sub = onDomainEvent('literature:tasks', (e) => bus.push(e));
    try {
      const p = BatchRunner.runAll(await LiteratureData.loadTasks(), ev);
      await tick();
      child.stdout.emit('data', Buffer.from(RESULT_LINE));
      child.emit('close', 0);
      await p;
      expect(fsMock.unlinkSync).toHaveBeenCalledWith('C:/tmp/bz-transcript-abc.txt'); // AI 失败也清理临时文件
      const all = await LiteratureData.loadTasks();
      expect(all[0].status).toBe('failed');
      expect(all[0].reason).toContain('AI 生成文献笔记失败');
      expect(all[0].reason).toContain('未配置 AI 服务');
      expect(all[0].notePath).toBeNull(); // 不落半成品笔记
      expect(all[0].archived).toBe(false);
      expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 0, failed: 1, aborted: false, stopped: false });
      expect(bus).toEqual([expect.objectContaining({ kind: 'failed', id: all[0].id, url: 'BV1xx411c7mD' })]);
    } finally {
      sub();
    }
  });

  it('[bz-result] video 为 null → videoPath null（keepVideo 关闭场景）', async () => {
    await LiteratureData.addTask({ url: 'BV1xx411c7mD' });
    const ev = makeEvents();
    const p = BatchRunner.runAll(await LiteratureData.loadTasks(), ev);
    await tick();
    child.stdout.emit('data', Buffer.from('[bz-result] {"transcript":"C:/tmp/t.txt","video":null}\n'));
    child.emit('close', 0);
    await p;
    const all = await LiteratureData.loadTasks();
    expect(all[0].status).toBe('success');
    expect(all[0].videoPath).toBeNull();
    expect(all[0].notePath).toBe('文献盒/测试.md');
  });

  it('taskJson options 全量下发：compress/crf/vaultPath/ffmpegPath 等 + 任务级/全局设置映射（ADR-0071）', async () => {
    (vault.adapter as any).getBasePath = () => 'D:/Obsidian/我的库';
    setSettingsProvider(() => ({
      literatureQuality: '1080',
      literatureKeepVideo: false,
      literatureOutputDir: 'D:/videos',
      literatureCompress: true,
      literatureCrf: 26,
      literatureFfmpegPath: 'ffmpeg',
      literatureFfprobePath: 'ffprobe',
      literaturePythonPath: 'python',
      literatureWhisperModel: 'small',
      literatureCacheDir: 'D:/cache',
      literatureCacheRetentionDays: 14,
    }) as any);
    await LiteratureData.addTask({ url: 'BV1xx411c7mD', quality: '720', page: 3 });
    const ev = makeEvents();
    const p = BatchRunner.runAll(await LiteratureData.loadTasks(), ev);
    await tick();
    const [, args] = cpMock.spawn.mock.calls[0];
    expect(args[0]).toBe('--batch');
    expect(args[1]).toMatch(/^b64:/); // P2-5：经 shell 启动 JSON 改 base64 传输（b64: 前缀）
    const json = JSON.parse(Buffer.from(args[1].slice(4), 'base64').toString('utf8'));
    expect(json.page).toBe(3);
    expect(json.options).toEqual({
      quality: '720', // 任务级 quality 优先于全局
      keepVideo: false,
      outputDir: 'D:/videos',
      compress: true,
      crf: 26,
      vaultPath: 'D:/Obsidian/我的库',
      ffmpegPath: 'ffmpeg',
      ffprobePath: 'ffprobe',
      pythonPath: 'python',
      whisperModel: 'small',
      cacheDir: 'D:/cache',
      cacheRetentionDays: 14,
    });
    child.emit('close', 0);
    await p;
  });

  it('空设置下的 options 默认值：quality highest / keepVideo / compress 开 / crf 23；留空键不下发（ticket 149 rc 兜底）', async () => {
    await LiteratureData.addTask({ url: 'BV1xx411c7mD' });
    const ev = makeEvents();
    const p = BatchRunner.runAll(await LiteratureData.loadTasks(), ev);
    await tick();
    const [cmd, args, opts] = cpMock.spawn.mock.calls[0];
    expect(cmd).toBe('bili-dl');
    expect(opts.shell).toBe(true);
    expect(JSON.parse(Buffer.from(args[1].slice(4), 'base64').toString('utf8'))).toEqual({
      url: 'BV1xx411c7mD', start: null, end: null, page: null,
      // 留空 = 跟随工具默认配置（rc/DEFAULTS）→ 键不下发（undefined 被 JSON.stringify 省略），
      // 避免空串覆盖 rc 兜底（ticket 149：Python 路径留空时整批转写报「未配置 pythonPath」）
      options: {
        quality: 'highest', keepVideo: true,
        compress: true, crf: 23, vaultPath: '',
        cacheRetentionDays: 7,
      },
    });
    child.emit('close', 0);
    await p;
  });

  it('spawn 决议唯一化（P2-2）：不探测本地 CLI 指针，固定全局 bili-dl --batch（shell:true）', async () => {
    await LiteratureData.addTask({ url: 'BV1xx411c7mD' });
    const ev = makeEvents();
    const p = BatchRunner.runAll(await LiteratureData.loadTasks(), ev);
    await tick();
    expect(fsMock.existsSync).not.toHaveBeenCalled(); // 移除本机绝对路径探测（发布版不含开发者本机路径）
    const [cmd, args, opts] = cpMock.spawn.mock.calls[0];
    expect(cmd).toBe('bili-dl');
    expect(args[0]).toBe('--batch');
    expect(opts.shell).toBe(true);
    child.emit('close', 0);
    await p;
  });

  it('单部失败继续剩余：失败项带原因、后续继续处理（CLI close 非 0）', async () => {
    const tasks = await seedTasks();
    const ev = makeEvents();
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(1);
    // P2-4：转录已写出但 CLI 非 0 退出 → 临时文件仍要清理（不残留系统临时目录）
    child.stdout.emit('data', Buffer.from(RESULT_LINE));
    child.stderr.emit('data', Buffer.from('视频已删除或失效'));
    child.emit('close', 1);
    await tick();
    expect(fsMock.unlinkSync).toHaveBeenCalledWith('C:/tmp/bz-transcript-abc.txt');
    expect(cpMock.spawn).toHaveBeenCalledTimes(2); // 继续跑第二部
    const child2 = cpMock.spawn.mock.results[1].value;
    child2.stdout.emit('data', Buffer.from(RESULT_LINE));
    child2.emit('close', 0);
    await p;
    expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 1, failed: 1, aborted: false, stopped: false });
    const all = await LiteratureData.loadTasks();
    const f = all.find((x) => x.id === tasks[0].id)!;
    expect(f.status).toBe('failed');
    expect(f.reason).toContain('视频已删除或失效');
    expect(all[1].status).toBe('success');
  });

  it('任务终态落库抛错（处理中被删除）→ 批量不挂起：尽力走回调、后续任务继续、onBatchDone 正常（P2-1）', async () => {
    const realUpdate = LiteratureData.updateTask.bind(LiteratureData);
    const spy = vi.spyOn(LiteratureData, 'updateTask').mockImplementation(async (id: string, patch: any) => {
      // 模拟任务处理中被删除（抽屉「删除」任意状态可用 / cleanupTaskRecordsForNote 连带删除）：
      // 终态写必抛「任务不存在」，中间态写照常
      if (patch && (patch.status === 'success' || patch.status === 'failed')) throw new Error('任务不存在');
      return realUpdate(id, patch);
    });
    try {
      const tasks = await seedTasks();
      const ev = makeEvents();
      const p = BatchRunner.runAll(tasks, ev);
      await tick();
      child.stdout.emit('data', Buffer.from(RESULT_LINE));
      child.emit('close', 0);
      // 首部终态落库失败 → 尽力走 onTaskDone/onEnd → 不挂起，继续第二部
      await vi.waitFor(() => expect(cpMock.spawn).toHaveBeenCalledTimes(2));
      expect(ev.onTaskDone).toHaveBeenCalledTimes(1);
      const child2 = cpMock.spawn.mock.results[1].value;
      child2.stdout.emit('data', Buffer.from(RESULT_LINE));
      child2.emit('close', 0);
      await p; // 无 reject 兜底时此处永不返回（_runOne Promise 卡死）
      expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 2, failed: 0, aborted: false, stopped: false });
      expect(ev.onTaskDone).toHaveBeenCalledTimes(2);
      expect(BatchRunner.running).toBe(false); // 无任务残留挂起状态
    } finally {
      spy.mockRestore();
    }
  });

  it('spawn 同步抛 ENOENT → 失败原因含安装引导，全部任务失败', async () => {
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

  it('遇错即停（设置开启）：首部 CLI 失败后不再 spawn 剩余，onBatchDone stopped:true', async () => {
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

  it('AI 失败 + 遇错即停：单部 failed 后不再 spawn 剩余（插件侧失败同样触发中断）', async () => {
    setSettingsProvider(() => ({ literatureStopOnFailure: true }) as any);
    const tasks = await seedTasks();
    noteGenMocks.generateVideoNote.mockRejectedValue(new Error('网络错误'));
    const ev = makeEvents();
    const p = BatchRunner.runAll(tasks, ev);
    await tick();
    child.stdout.emit('data', Buffer.from(RESULT_LINE));
    child.emit('close', 0);
    await p;
    expect(cpMock.spawn).toHaveBeenCalledTimes(1); // 不再跑第二部
    expect(ev.onBatchDone).toHaveBeenCalledWith({ success: 0, failed: 1, aborted: false, stopped: true });
    const all = await LiteratureData.loadTasks();
    expect(all[0].status).toBe('failed');
    expect(all[1].status).toBe('pending');
  });

  it('[bz-info] 解析信息：落库 title/uploader + onTaskInfo 回调，不发射文献盒域事件（P3-2，契约收敛 converted/failed）', async () => {
    const bus: any[] = [];
    const sub = onDomainEvent('literature:tasks', (e) => bus.push(e));
    try {
      const tasks = await seedTasks();
      const ev = makeEvents();
      const p = BatchRunner.runAll(tasks, ev);
      await tick();
      child.stdout.emit('data', Buffer.from('[bz-step] 解析中\n'));
      child.stdout.emit('data', Buffer.from(INFO_LINE));
      await vi.waitFor(() => expect(ev.onTaskInfo).toHaveBeenCalledTimes(1));
      await vi.waitFor(async () => {
        const all = await LiteratureData.loadTasks();
        expect(all[0].title).toBe('从零开始学B站');
        expect(all[0].uploader).toBe('某UP');
      });
      // parsed 域事件已删除：解析信息不发射任何 literature:tasks 事件（仅 converted/failed 两类）
      expect(bus).toEqual([]);
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
    child.stdout.emit('data', Buffer.from('[bz-step] 解析中\n'));
    child.stdout.emit('data', Buffer.from(INFO_LINE));
    child.emit('close', 1); // 首部失败（解析信息已留存 → 断点续跑场景）
    await vi.waitFor(() => expect(cpMock.spawn).toHaveBeenCalledTimes(2)); // 第二部照常
    const child2 = cpMock.spawn.mock.results[1].value;
    child2.stdout.emit('data', Buffer.from(RESULT_LINE));
    child2.emit('close', 0);
    await p;
    let all = await LiteratureData.loadTasks();
    expect(all[0].status).toBe('failed');
    await vi.waitFor(async () => {
      const cur = await LiteratureData.loadTasks();
      expect(cur[0].title).toBe('从零开始学B站'); // 解析信息落库（先落库后事件，确定性）
    });
    all = await LiteratureData.loadTasks();
    expect(all[1].archived).toBe(true);
    // 再点批量处理：只处理失败项，成功（归档）项跳过
    const ev2 = makeEvents();
    const p2 = BatchRunner.runAll(all, ev2);
    await tick();
    expect(cpMock.spawn).toHaveBeenCalledTimes(3); // 失败项续跑
    const child3 = cpMock.spawn.mock.results[2].value;
    child3.stdout.emit('data', Buffer.from(RESULT_LINE));
    child3.emit('close', 0);
    await p2;
    expect(ev2.onBatchDone).toHaveBeenCalledWith({ success: 1, failed: 0, aborted: false, stopped: false });
    all = await LiteratureData.loadTasks();
    expect(all.filter((x) => x.status === 'failed')).toHaveLength(0);
    expect(all.filter((x) => x.archived)).toHaveLength(2); // 两部都归档
  });
});