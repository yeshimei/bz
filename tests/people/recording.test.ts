/**
 * 录音管线驱动测试（issue 509 / ADR-0212、0213）：spawn 组装（pythonPath 口径）、
 * sidecar 解析与进度归一、条目状态机、文件名时间解析三级回落、质心就绪态（node 下
 * fs 不可得恒 missing）、进程注册表（幂等起跑 / stop / onExit）。纯逻辑层，无 DOM。
 *
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  buildRecordingSpec,
  buildVoiceprintSpec,
  clearRecControl,
  faceRecSupportError,
  formatRecElapsed,
  hasRecordingTurns,
  isRecordingRunning,
  parseRecordingFilenameTs,
  parseRecordingSidecar,
  probeFaceCapabilities,
  recControlFilePath,
  recordingItemState,
  recordingPhasePct,
  recordingSidecarPath,
  recordingStageOf,
  recordingTsOf,
  recordingsDirOf,
  resetFaceCapabilitiesForTests,
  setRecordingFsForTests,
  setRecordingRunnerForTests,
  startRecordingTask,
  stopRecordingTask,
  runningRecordingItems,
  voiceprintRefPath,
  voiceprintRefStatus,
  writeRecControl,
  type RecordingSidecar,
} from '../../src/people/recording';
import type { ExternalToolHandle } from '../../src/core/external-tool';

describe('路径组装', () => {
  it('recordingsDirOf / sidecar / 质心 npz 的固定布局（ADR-0212；质心随数据根，0214）', () => {
    expect(recordingsDirOf('E:\\数据根', '大琳')).toBe('E:\\数据根/大琳/recordings');
    expect(recordingSidecarPath('E:\\数据根', '大琳', '周二.aac')).toBe('E:\\数据根/大琳/recordings/周二.aac.turns.json');
    expect(voiceprintRefPath('E:\\数据根', '大琳')).toBe('E:\\数据根/voiceprints/大琳.npz');
    // 质心随数据根走（0214 收编 bz-face 包，不再依赖「数据根父目录有 tools」的布局）
    expect(voiceprintRefPath('E:/Obsidian/微信脸谱数据/export_full', '大琳')).toBe('E:/Obsidian/微信脸谱数据/export_full/voiceprints/大琳.npz');
  });

  it('buildRecordingSpec：bz-face rec、路径参数包引号、--python 非空才传（口径同 prep）', () => {
    const spec = buildRecordingSpec({ dataRoot: 'D:\\根', talker: '大琳', file: 'r.m4a' });
    expect(spec.cmd).toBe('bz-face');
    expect(spec.shell).toBe(true);
    expect(spec.args).toEqual([
      'rec',
      '"r.m4a"',
      '--data-root',
      '"D:\\根"',
      '--contact',
      '"大琳"',
    ]);
    const withPy = buildRecordingSpec({ dataRoot: 'D:\\根', talker: '大', file: 'r', python: 'C:\\Program Files\\py.exe ' });
    expect(withPy.args).toEqual(['rec', '"r"', '--data-root', '"D:\\根"', '--contact', '"大"', '--python', 'C:\\Program Files\\py.exe']);
  });

  it('buildVoiceprintSpec：bz-face refs、路径参数包引号', () => {
    const spec = buildVoiceprintSpec({ dataRoot: 'D:\\根', talker: '大琳', python: 'py -3' });
    expect(spec.cmd).toBe('bz-face');
    expect(spec.args).toEqual(['refs', '--data-root', '"D:\\根"', '--contact', '"大琳"', '--python', 'py -3']);
  });
});

describe('sidecar 解析', () => {
  it('全字段读回：snake_case 归一 camelCase，turns 逐条映射', () => {
    const s = parseRecordingSidecar(
      JSON.stringify({
        file: 'r.aac',
        contact: '大琳',
        phase: 'transcribe',
        duration_sec: 4581.8,
        mode: 'dual',
        speakers_sec: { 我: 2412, 大琳: 1050.2, '?': 5.7 },
        progress: { text: '转写 3/579', done: 3, total: 579 },
        diag: { windows: 10984 },
        turns: [
          { start: 2.01, end: 4.18, speaker: '我', emotion: '平静', text: '哎开场白', mean_abs_llr: 0.294 },
          { start: 10.26, end: 10.73, speaker: '?', text: '嗯' },
        ],
      }),
    );
    expect(s).not.toBeNull();
    expect(s!.phase).toBe('transcribe');
    expect(s!.durationSec).toBe(4581.8);
    expect(s!.speakersSec).toEqual({ 我: 2412, 大琳: 1050.2, '?': 5.7 });
    expect(s!.turns).toHaveLength(2);
    expect(s!.turns![0]).toEqual({ start: 2.01, end: 4.18, speaker: '我', emotion: '平静', text: '哎开场白', meanAbsLlr: 0.294 });
    expect(s!.turns![1].emotion).toBeUndefined();
  });

  it('坏 JSON / 缺 phase / 非法 phase / 数组体 → null', () => {
    expect(parseRecordingSidecar('{oops')).toBeNull();
    expect(parseRecordingSidecar(JSON.stringify({ file: 'r' }))).toBeNull();
    expect(parseRecordingSidecar(JSON.stringify({ phase: '乱写' }))).toBeNull();
    expect(parseRecordingSidecar('[]')).toBeNull();
  });

  it('error phase 带 error 字段读回', () => {
    const s = parseRecordingSidecar(JSON.stringify({ phase: 'error', error: 'RuntimeError: boom' }));
    expect(s!.phase).toBe('error');
    expect(s!.error).toBe('RuntimeError: boom');
  });
});

describe('进度与状态机', () => {
  it('recordingPhasePct：done/total 归一 0-100；不可估返回 null（绝不假报）', () => {
    expect(recordingPhasePct({ phase: 'voiceprint', progress: { done: 3000, total: 10984 } })).toBe(27);
    expect(recordingPhasePct({ phase: 'done', progress: { done: 579, total: 579 } })).toBe(100);
    expect(recordingPhasePct({ phase: 'vad', progress: { done: 0, total: 0 } })).toBeNull();
    expect(recordingPhasePct({ phase: 'vad' })).toBeNull();
    expect(recordingPhasePct(null)).toBeNull();
  });

  it('recordingItemState：仓事实 merged 权威；无 sidecar pending；中途 phase = interrupted', () => {
    expect(recordingItemState(null, true)).toBe('merged');
    expect(recordingItemState(null, false)).toBe('pending');
    expect(recordingItemState({ phase: 'voiceprint' } as RecordingSidecar, false)).toBe('interrupted');
    expect(recordingItemState({ phase: 'transcribe' } as RecordingSidecar, false)).toBe('interrupted');
    expect(recordingItemState({ phase: 'error', error: 'x' } as RecordingSidecar, false)).toBe('failed');
    expect(recordingItemState({ phase: 'done' } as RecordingSidecar, false)).toBe('merged');
    expect(recordingItemState({ phase: 'done' } as RecordingSidecar, true)).toBe('merged');
  });

  it('hasRecordingTurns：key 前缀 rec:<file>: 判定（不同 file 不串）', () => {
    expect(hasRecordingTurns([{ key: 'rec:r.aac:0' }, { key: 's1:1' }], 'r.aac')).toBe(true);
    expect(hasRecordingTurns([{ key: 'rec:other.aac:0' }], 'r.aac')).toBe(false);
    expect(hasRecordingTurns([], 'r.aac')).toBe(false);
  });
});

describe('文件名时间解析', () => {
  it('紧凑 8 位日期 + 4/6 位时间（分隔符任意）', () => {
    expect(parseRecordingFilenameTs('20260923_001830.aac')).toBe(new Date(2026, 8, 23, 0, 18, 30).getTime());
    expect(parseRecordingFilenameTs('录音20260923-2211.m4a')).toBe(new Date(2026, 8, 23, 22, 11, 0).getTime());
    expect(parseRecordingFilenameTs('20260923.m4a')).toBe(new Date(2026, 8, 23, 0, 0, 0).getTime());
  });
  it('分隔日期与中文日期', () => {
    expect(parseRecordingFilenameTs('2026-09-23 00.18.30.aac')).toBe(new Date(2026, 8, 23, 0, 18, 30).getTime());
    expect(parseRecordingFilenameTs('2026年9月23日 0点18分.m4a')).toBe(new Date(2026, 8, 23, 0, 18, 0).getTime());
  });
  it('无日期不猜；非法日期返回 null', () => {
    expect(parseRecordingFilenameTs('大琳 周二 00点18分✔️.aac')).toBeNull();
    expect(parseRecordingFilenameTs('voice memo.m4a')).toBeNull();
    expect(parseRecordingFilenameTs('20261323_001830.aac')).toBeNull(); // 13 月
  });
  it('不存在的日子不滚进下月（20260230 → null）', () => {
    expect(parseRecordingFilenameTs('20260230_100000.aac')).toBeNull();
    expect(parseRecordingFilenameTs('20260431_a.aac')).toBeNull();
    expect(parseRecordingFilenameTs('20260228_100000.aac')).not.toBeNull();
  });
  it('recordingTsOf 三级回落：文件名 → mtime → now', () => {
    const fromName = parseRecordingFilenameTs('20260923_001830.aac')!;
    expect(recordingTsOf('20260923_001830.aac', 111)).toBe(fromName);
    expect(recordingTsOf('周二.aac', 111, 222)).toBe(111);
    expect(recordingTsOf('周二.aac', undefined, 222)).toBe(222);
  });
});

describe('质心就绪态与进程注册表', () => {
  afterEach(() => setRecordingRunnerForTests(null));

  it('非桌面端 fs 不可得：voiceprintRefStatus 恒 missing', () => {
    expect(voiceprintRefStatus('D:\\根', '大琳')).toBe('missing');
  });

  it('startRecordingTask：幂等起跑、onExit 摘除、stop 可杀', async () => {
    let stopped = 0;
    const handles: ExternalToolHandle[] = [];
    setRecordingRunnerForTests(() => {
      let resolve!: (v: any) => void;
      const done = new Promise<any>((r) => (resolve = r));
      const h: ExternalToolHandle = {
        stop: () => {
          stopped++;
          resolve({ ok: false, stopped: true, code: null, stderr: '', error: null });
        },
        done,
      };
      handles.push(h);
      return h;
    });
    const spec = buildRecordingSpec({ dataRoot: 'D:\\根', talker: '大', file: 'r.m4a' });
    const key = recordingSidecarPath('D:\\根', '大', 'r.m4a');
    const exits: string[] = [];
    startRecordingTask(spec, key, (o) => exits.push(o.stopped ? 'stopped' : o.ok ? 'ok' : 'error'));
    startRecordingTask(spec, key, () => exits.push('should-not-fire')); // 幂等护栏
    expect(isRecordingRunning(key)).toBe(true);
    expect(handles).toHaveLength(1);
    stopRecordingTask(key);
    await Promise.resolve();
    expect(stopped).toBe(1);
    expect(isRecordingRunning(key)).toBe(false);
    // 终结后可再起（重启续跑）
    startRecordingTask(spec, key);
    expect(isRecordingRunning(key)).toBe(true);
    stopRecordingTask(key);
  });
});

describe('阶段链与耗时（issue 511）', () => {
  afterEach(() => setRecordingRunnerForTests(null));

  it('recordingStageOf：缺席 / 旧账 = load；fresh 下三段各归其位，done 归 transcribe', () => {
    expect(recordingStageOf(null, false)).toBe('load');
    expect(recordingStageOf(null, true)).toBe('load');
    expect(recordingStageOf({ phase: 'vad' }, true)).toBe('vad');
    expect(recordingStageOf({ phase: 'voiceprint' }, true)).toBe('voiceprint');
    expect(recordingStageOf({ phase: 'transcribe' }, true)).toBe('transcribe');
    // 上一轮的余账（本轮还没落第一笔）= 冷加载期，不能拿旧段冒充本轮进度
    expect(recordingStageOf({ phase: 'transcribe' }, false)).toBe('load');
    expect(recordingStageOf({ phase: 'error', error: 'x' }, false)).toBe('load');
    // done 在 fresh 下归 transcribe：完成瞬间由 onExit 重画行状态，轮询帧内短暂可见不算撒谎
    expect(recordingStageOf({ phase: 'done', turns: [] }, true)).toBe('transcribe');
  });

  it('formatRecElapsed：秒 / 分秒两档，负值按 0', () => {
    expect(formatRecElapsed(0)).toBe('0s');
    expect(formatRecElapsed(45_000)).toBe('45s');
    expect(formatRecElapsed(59_900)).toBe('59s');
    expect(formatRecElapsed(192_000)).toBe('3m12s');
    expect(formatRecElapsed(-5)).toBe('0s');
  });

  it('startRecordingTask 记起跑时刻，runningRecordingItems 带出（进度行算已耗时用）', () => {
    setRecordingRunnerForTests(() => {
      let resolve!: (v: any) => void;
      const done = new Promise<any>((r) => (resolve = r));
      return { stop: () => resolve({ ok: false, stopped: true, code: null, stderr: '', error: null }), done };
    });
    const t0 = Date.now() - 1000;
    const key = recordingSidecarPath('D:\\根', '大', 't.m4a');
    startRecordingTask(buildRecordingSpec({ dataRoot: 'D:\\根', talker: '大', file: 't.m4a' }), key);
    const items = runningRecordingItems();
    expect(items).toHaveLength(1);
    expect(items[0].startedAt).toBeGreaterThanOrEqual(t0);
    expect(items[0].startedAt).toBeLessThanOrEqual(Date.now());
    stopRecordingTask(key);
  });
});

describe('协作式控制文件与版本门（issue 510）', () => {
  afterEach(() => {
    setRecordingRunnerForTests(null);
    setRecordingFsForTests(null);
    resetFaceCapabilitiesForTests();
  });

  /** fs 桩：记录调用，writeFileSync 内容可查 */
  function fsStub() {
    const calls: string[] = [];
    const files = new Map<string, string>();
    return {
      calls,
      files,
      f: {
        mkdirSync: () => {},
        writeFileSync: (p: string, data: string) => {
          calls.push(`write:${p}`);
          files.set(p, data);
        },
        rmSync: (p: string) => {
          calls.push(`rm:${p}`);
          files.delete(p);
        },
        existsSync: (p: string) => files.has(p),
      },
    };
  }

  it('buildRecordingSpec：--ffmpeg 非空才传、路径包引号（口径同 prep）', () => {
    const withFf = buildRecordingSpec({ dataRoot: 'D:\\根', talker: '大琳', file: 'r.m4a', ffmpeg: 'C:\\tools\\ffmpeg.exe' });
    const ffArgs = withFf.args ?? [];
    expect(ffArgs).toContain('--ffmpeg');
    expect(ffArgs[ffArgs.indexOf('--ffmpeg') + 1]).toBe('"C:\\tools\\ffmpeg.exe"');
    const noFf = buildRecordingSpec({ dataRoot: 'D:\\根', talker: '大琳', file: 'r.m4a', ffmpeg: '   ' });
    expect(noFf.args ?? []).not.toContain('--ffmpeg');
  });

  it('recControlFilePath 按任务派生；writeRecControl 写 stop；clearRecControl 摘文件', () => {
    expect(recControlFilePath('D:\\根', '大琳', 'r.m4a')).toBe('D:\\根/.bz-face/rec-control/大琳/r.m4a.control.json');
    const { calls, files, f } = fsStub();
    setRecordingFsForTests(f);
    expect(writeRecControl('D:\\根', 'stop', '大琳', 'r.m4a')).toBe(true);
    const p = recControlFilePath('D:\\根', '大琳', 'r.m4a');
    expect(calls).toContain(`write:${p}`);
    expect(files.get(p)).toBe('{"action":"stop"}\n');
    clearRecControl('D:\\根', '大琳', 'r.m4a');
    expect(calls).toContain(`rm:${p}`);
    // 无 fs（非桌面端）/ 任务三参不齐 → 写失败返回 false，不抛
    setRecordingFsForTests(null);
    expect(writeRecControl('D:\\根', 'stop', '大琳', 'r.m4a')).toBe(false);
    setRecordingFsForTests(f);
    expect(writeRecControl('D:\\根', 'stop', '', 'r.m4a')).toBe(false);
  });

  it('协作停止：写任务专属 rec-control、不立即杀；终结后自动清控制文件', async () => {
    let stopped = 0;
    setRecordingRunnerForTests(() => {
      let resolve!: (v: any) => void;
      const done = new Promise<any>((r) => (resolve = r));
      return {
        stop: () => {
          stopped++;
          resolve({ ok: false, stopped: true, code: null, stderr: '', error: null });
        },
        done,
      } satisfies ExternalToolHandle;
    });
    const { calls, f } = fsStub();
    setRecordingFsForTests(f);
    const root = 'D:\\根';
    const key = recordingSidecarPath(root, '大', 'r.m4a');
    startRecordingTask(buildRecordingSpec({ dataRoot: root, talker: '大', file: 'r.m4a' }), key, undefined, { talker: '大', file: 'r.m4a', dataRoot: root });
    // 起跑即清本任务的陈旧控制文件
    expect(calls.filter((c) => c.startsWith('rm:'))).toContain(`rm:${recControlFilePath(root, '大', 'r.m4a')}`);
    stopRecordingTask(key, { dataRoot: root, talker: '大', file: 'r.m4a' });
    expect(calls.filter((c) => c.startsWith('write:'))).toEqual([`write:${recControlFilePath(root, '大', 'r.m4a')}`]);
    expect(stopped).toBe(0); // 没有立刻杀——等脚本在安全点自己退
    // 90s 内脚本退了（done resolve）→ 定时器摘除，不再兜底杀
    await Promise.resolve();
    expect(stopped).toBe(0);
  });

  it('任务三参不齐的停止保持旧口径：直接杀', () => {
    let stopped = 0;
    setRecordingRunnerForTests(() => {
      let resolve!: (v: any) => void;
      const done = new Promise<any>((r) => (resolve = r));
      return {
        stop: () => {
          stopped++;
          resolve({ ok: false, stopped: true, code: null, stderr: '', error: null });
        },
        done,
      } satisfies ExternalToolHandle;
    });
    const key = recordingSidecarPath('D:\\根', '大', 'r.m4a');
    startRecordingTask(buildRecordingSpec({ dataRoot: 'D:\\根', talker: '大', file: 'r.m4a' }), key);
    stopRecordingTask(key);
    stopRecordingTask(key, { dataRoot: 'D:\\根' }); // 缺 talker/file → 直杀
    expect(stopped).toBe(2);
  });

  it('capabilities 探测：[bz-result] 体解析 + 会话级缓存 + 探测失败返回 null', async () => {
    let runs = 0;
    setRecordingRunnerForTests((spec, cb) => {
      runs += 1;
      expect(spec.args).toEqual(['capabilities']);
      void Promise.resolve().then(() => {
        cb.onResult({ ok: true, version: '0.5.0', commands: ['sync', 'rec', 'refs'] });
      });
      let resolve!: (v: any) => void;
      const done = new Promise<any>((r) => (resolve = r));
      void Promise.resolve().then(() => resolve({ ok: true, stopped: false, code: 0, stderr: '', error: null }));
      return { stop: () => {}, done } satisfies ExternalToolHandle;
    });
    const caps = await probeFaceCapabilities();
    expect(caps).toEqual({ version: '0.5.0', commands: ['sync', 'rec', 'refs'] });
    await probeFaceCapabilities();
    expect(runs).toBe(1); // 会话级缓存：第二次不再起进程

    // 探测失败（无结果行 / 启动失败）→ null，且缓存住
    resetFaceCapabilitiesForTests();
    setRecordingRunnerForTests(() => {
      let resolve!: (v: any) => void;
      const done = new Promise<any>((r) => (resolve = r));
      void Promise.resolve().then(() => resolve({ ok: false, stopped: false, code: null, stderr: '', error: new Error('找不到命令') }));
      return { stop: () => {}, done } satisfies ExternalToolHandle;
    });
    expect(await probeFaceCapabilities()).toBeNull();
    expect(await probeFaceCapabilities()).toBeNull();
  });

  it('faceRecSupportError：能力未知放行；< 0.5 或缺 rec 给升级指引（npm link 口径）；0.5+ 放行', () => {
    expect(faceRecSupportError(null)).toBeNull();
    const old = faceRecSupportError({ version: '0.4.0', commands: ['rec'] });
    expect(old).toContain('过旧');
    expect(old).toContain('npm link'); // 本包不发 registry，指引不能是 npm update
    expect(faceRecSupportError({ version: '0.5.0', commands: ['sync'] })).toContain('过旧');
    expect(faceRecSupportError({ version: '0.5.0', commands: ['sync', 'rec', 'refs'] })).toBeNull();
    expect(faceRecSupportError({ version: '0.10.0', commands: ['rec'] })).toBeNull();
    expect(faceRecSupportError({ version: '1.2.0', commands: ['rec'] })).toBeNull();
  });
});
