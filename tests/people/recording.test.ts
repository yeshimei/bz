/**
 * 录音管线驱动测试（issue 509 / ADR-0212、0213）：spawn 组装（pythonPath 口径）、
 * sidecar 解析与进度归一、条目状态机、文件名时间解析三级回落、质心就绪态（node 下
 * fs 不可得恒 missing）、进程注册表（幂等起跑 / stop / onExit）。纯逻辑层，无 DOM。
 *
 * @vitest-environment node
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildRecordingSpec,
  buildRecordingCheckSpec,
  buildRecordingTurnsMd,
  buildVoiceprintSpec,
  clearRecControl,
  duplicateRecordingGroups,
  faceRecSupportError,
  fmtClock,
  formatRecElapsed,
  hasRecordingTurns,
  isRecordingRunning,
  parseRecordingCheckResult,
  parseRecordingFilenameTs,
  parseRecordingSidecar,
  probeFaceCapabilities,
  recControlFilePath,
  readRecordingMeta,
  readRecordingSidecar,
  recordingFailureText,
  recordingItemState,
  recordingMetaPath,
  recordingPhasePct,
  recordingSidecarPath,
  recordingStageOf,
  recordingStartCandidates,
  recordingStartOf,
  recordingTurnsComplete,
  recordingTurnsMdPath,
  recordingTsOf,
  recordingsDirOf,
  RECORDING_DERIVED_SUFFIXES,
  resetFaceCapabilitiesForTests,
  resetRecordingProcessesForTests,
  resetRecordingSidecarCacheForTests,
  resolveRecordingTargetName,
  setRecordingFsForTests,
  setRecordingRunnerForTests,
  startRecordingTask,
  stopRecordingTask,
  isRecordingFile,
  runningRecordingItems,
  voiceprintRefPath,
  voiceprintRefStatus,
  writeRecControl,
  writeRecordingMeta,
  writeRecordingTurnsMd,
  type RecordingSidecar,
} from '../../src/people/recording';
import type { ExternalToolHandle } from '../../src/core/external-tool';
import type { RecordingTurn } from '../../src/people/datasource';

/** 内存 fs 桩（meta 读写 / 派生物过滤用）：写读往返 + mkdir 记录，不碰真磁盘 */
function memMetaFs() {
  const files = new Map<string, string>();
  const dirs: string[] = [];
  return {
    files,
    dirs,
    fs2: {
      mkdirSync: (p: string) => {
        dirs.push(p);
      },
      writeFileSync: (p: string, s: string) => {
        files.set(p, s);
      },
      readFileSync: (p: string) => {
        if (!files.has(p)) throw new Error('ENOENT');
        return files.get(p)!;
      },
    },
  };
}

/**
 * 重复巡检验证用的内存 fs：`readdirSync` + `statSync(size)` + `readFileSync`。
 * 内容用字符串存，sha 用 node:crypto 现算（与 fileSha256 同算法），
 * 并记录每次**真读内容**的文件——用来断言「尺寸各异的库一次都不读」。
 */
function memDupFs(files: Record<string, string>, reads: string[]) {
  const store = new Map(Object.entries(files));
  return {
    readdirSync: () => [...store.keys()],
    statSync: (p: string) => {
      const key = p.slice(p.lastIndexOf('/') + 1);
      if (!store.has(key)) throw new Error('ENOENT');
      return { size: store.get(key)!.length };
    },
    readFileSync: (p: string) => {
      const key = p.slice(p.lastIndexOf('/') + 1);
      if (!store.has(key)) throw new Error('ENOENT');
      reads.push(key);
      return store.get(key)!;
    },
  };
}

/** 与生产同算法的 sha（node 环境直接 node:crypto，不需要 window.require） */
const testSha = (s: string): string => createHash('sha256').update(s).digest('hex');

/** 巡检入参：从 memDupFs 的 readFileSync 取值算 sha（缺文件 → null） */
function dupShaOf(fs2: { readFileSync: (p: string) => string }) {
  return (p: string): string | null => {
    try {
      return testSha(fs2.readFileSync(p));
    } catch {
      return null;
    }
  };
}

/**
 * 进程注册表跨用例隔离：前一条用例收尾的 `running.delete` 挂在微任务链上（done.then），
 * 未 flush 即进下一条时，同 key 的 startRecordingTask 会因「占位还在」静默返回 null（用例假绿重试）
 */
beforeEach(() => {
  resetRecordingProcessesForTests();
});

describe('路径组装', () => {
  it('recordingsDirOf / sidecar / 质心 npz 的固定布局（ADR-0212；质心随数据根，0214）', () => {
    expect(recordingsDirOf('E:\\数据根', '大琳')).toBe('E:\\数据根/大琳/recordings');
    // sidecar 剥扩展名（issue 512 对齐 bz_rec.py 的 splitext 口径——磁盘账本是 <名>.turns.json）
    expect(recordingSidecarPath('E:\\数据根', '大琳', '周二.aac')).toBe('E:\\数据根/大琳/recordings/周二.turns.json');
    // 带空格 / emoji 的真实导出名、多点文件名只剥最后一段、无扩展名原样保留
    expect(recordingSidecarPath('E:\\数据根', '大琳', '周六 10点14分✔️.aac')).toBe('E:\\数据根/大琳/recordings/周六 10点14分✔️.turns.json');
    expect(recordingSidecarPath('E:\\数据根', '大琳', 'a.b.m4a')).toBe('E:\\数据根/大琳/recordings/a.b.turns.json');
    expect(recordingSidecarPath('E:\\数据根', '大琳', '无扩展名')).toBe('E:\\数据根/大琳/recordings/无扩展名.turns.json');
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
    // .exe 路径形态 → quotePythonArg 包引号（防带空格路径被 shell 拆碎）；尾随空白先 trim 再判
    expect(withPy.args).toEqual(['rec', '"r"', '--data-root', '"D:\\根"', '--contact', '"大"', '--python', '"C:\\Program Files\\py.exe"']);
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
    // done 带轮次 = merged（编排层并入动作紧随其后，UI 短暂同义）
    expect(recordingItemState({ phase: 'done', turns: [{ start: 0, end: 1, speaker: '我', text: '嗨' }] } as unknown as RecordingSidecar, false)).toBe('merged');
    // done 而零轮次（无有效语音）≠ merged：并仓判定要求 turns.length > 0，标 merged 会变成点并仓永无动作的假态
    expect(recordingItemState({ phase: 'done' } as RecordingSidecar, false)).toBe('failed');
    expect(recordingItemState({ phase: 'done', turns: [] } as unknown as RecordingSidecar, false)).toBe('failed');
    expect(recordingItemState({ phase: 'done' } as RecordingSidecar, true)).toBe('merged');
  });

  it('recordingFailureText：零轮次 done（无有效语音）给人话，不冒充「进程异常退出」', () => {
    const t = recordingFailureText({ phase: 'done', turns: [] } as unknown as RecordingSidecar);
    expect(t).toContain('没有转写出有效语音');
    expect(t).not.toContain('进程异常退出');
    expect(t).toContain('重试');
    // error 照旧；done 带轮次不走该分支（也轮不到 failure 文案）
    expect(recordingFailureText({ phase: 'error', error: 'boom' })).toContain('boom');
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

  it('faceRecSupportError：能力未知放行；< 0.6 或缺 rec / check 给升级指引（npm link 口径）；0.6+ 放行', () => {
    expect(faceRecSupportError(null)).toBeNull();
    const old = faceRecSupportError({ version: '0.5.0', commands: ['rec', 'refs', 'check'] });
    expect(old).toContain('过旧');
    expect(old).toContain('npm link'); // 本包不发 registry，指引不能是 npm update
    expect(faceRecSupportError({ version: '0.6.0', commands: ['sync'] })).toContain('过旧');
    expect(faceRecSupportError({ version: '0.6.0', commands: ['rec'] })).toContain('过旧'); // 缺 check（旁音/抽检的伴生能力）
    expect(faceRecSupportError({ version: '0.6.0', commands: ['sync', 'rec', 'refs', 'check'] })).toBeNull();
    expect(faceRecSupportError({ version: '0.10.0', commands: ['rec', 'check'] })).toBeNull();
    expect(faceRecSupportError({ version: '1.2.0', commands: ['rec', 'check'] })).toBeNull();
  });
});

describe('sidecar 读缓存（ADR-0219：stat 判变化才 open）', () => {
  afterEach(() => {
    setRecordingFsForTests(null);
    resetRecordingSidecarCacheForTests();
  });

  /** fs 桩：statSync 恒可调（记录次数），readFileSync 记录 open 次数，签名 / 存在性 / 内容可改 */
  function stubFs() {
    const reads: string[] = [];
    let statCalls = 0;
    let present = true;
    let sig = { mtimeMs: 1, ctimeMs: 1, size: 10 };
    let body: unknown = { phase: 'transcribe', turns: [{ start: 0, end: 1, speaker: '我', text: '嗨' }] };
    return {
      fs2: {
        statSync: () => {
          statCalls++;
          if (!present) throw new Error('ENOENT');
          return sig;
        },
        readFileSync: () => {
          reads.push('read');
          return JSON.stringify(body);
        },
      },
      reads,
      statCalls: () => statCalls,
      setSig: (s: Partial<typeof sig>) => {
        sig = { ...sig, ...s };
      },
      setPresent: (v: boolean) => {
        present = v;
      },
      setBody: (b: unknown) => {
        body = b;
      },
    };
  }

  it('签名未变不重复 open：轮询不再每秒占读句柄（脚本 os.replace 才不被拒）', () => {
    const sb = stubFs();
    setRecordingFsForTests(sb.fs2);
    expect(readRecordingSidecar('D:\\根', '大琳', 'r.aac')?.phase).toBe('transcribe');
    readRecordingSidecar('D:\\根', '大琳', 'r.aac');
    readRecordingSidecar('D:\\根', '大琳', 'r.aac');
    expect(sb.reads).toHaveLength(1); // 三次调用只 open 一次
    expect(sb.statCalls()).toBe(3); // stat 每次照做（便宜、不占读句柄）
    sb.setSig({ size: 11 }); // 账本长了一笔（逐轮落账）
    readRecordingSidecar('D:\\根', '大琳', 'r.aac');
    expect(sb.reads).toHaveLength(2);
  });

  it('缺文件 → null 且不 open（并清缓存）；文件出现后照常读到新内容', () => {
    const sb = stubFs();
    setRecordingFsForTests(sb.fs2);
    sb.setPresent(false);
    expect(readRecordingSidecar('D:\\根', '大琳', 'r.aac')).toBeNull();
    expect(sb.reads).toHaveLength(0);
    sb.setPresent(true);
    expect(readRecordingSidecar('D:\\根', '大琳', 'r.aac')?.phase).toBe('transcribe');
    expect(sb.reads).toHaveLength(1);
  });

  it('resetRecordingSidecarCacheForTests：清缓存后强制重读（测试隔离用）', () => {
    const sb = stubFs();
    setRecordingFsForTests(sb.fs2);
    readRecordingSidecar('D:\\根', '大琳', 'r.aac');
    resetRecordingSidecarCacheForTests();
    readRecordingSidecar('D:\\根', '大琳', 'r.aac');
    expect(sb.reads).toHaveLength(2);
  });
});

describe('转写完成度兜底（ADR-0219 决策 4）', () => {
  const turn = (text: string): RecordingTurn => ({ start: 0, end: 1, speaker: '我', text });

  it('done 恒为完成（须有轮次）；停在 transcribe 但成果已齐也算完成；真中断 / 出错不算', () => {
    expect(recordingTurnsComplete(null)).toBe(false);
    expect(recordingTurnsComplete({ phase: 'done' })).toBe(false); // 无轮次 = 无成果
    expect(recordingTurnsComplete({ phase: 'done', turns: [turn('嗨')] })).toBe(true);
    // 收尾标记丢了（账本替换被拒），成果其实全在账本里
    expect(recordingTurnsComplete({ phase: 'transcribe', turns: [turn('嗨'), turn('嗯')] })).toBe(true);
    // 有空白轮 → 按未齐处理（点「续跑」只补空轮，很便宜）
    expect(recordingTurnsComplete({ phase: 'transcribe', turns: [turn('嗨'), turn('  ')] })).toBe(false);
    // progress 走完的旁证：转写循环确实到底，即便有空白轮也认
    expect(recordingTurnsComplete({ phase: 'transcribe', progress: { done: 2, total: 2 }, turns: [turn('嗨'), turn('')] })).toBe(true);
    expect(recordingTurnsComplete({ phase: 'transcribe', progress: { done: 1, total: 2 }, turns: [turn('嗨'), turn('')] })).toBe(false);
    expect(recordingTurnsComplete({ phase: 'vad', turns: [turn('嗨')] })).toBe(false);
    expect(recordingTurnsComplete({ phase: 'error', turns: [turn('嗨')] })).toBe(false);
  });
});

describe('录音 meta 与派生物过滤（ADR-0217）', () => {
  afterEach(() => setRecordingFsForTests(null));

  /** 内存 fs 桩：写读往返 + mkdir 记录 */
  function memFs() {
    const files = new Map<string, string>();
    const dirs: string[] = [];
    return {
      files,
      dirs,
      fs2: {
        mkdirSync: (p: string) => {
          dirs.push(p);
        },
        writeFileSync: (p: string, s: string) => {
          files.set(p, s);
        },
        readFileSync: (p: string) => {
          if (!files.has(p)) throw new Error('ENOENT');
          return files.get(p)!;
        },
      },
    };
  }

  it('meta / turns.md 路径剥扩展名，与 sidecar 同布局（换数据根整体搬）', () => {
    expect(recordingMetaPath('E:\\数据根', '大琳', '周六 10点14分✔️.aac')).toBe('E:\\数据根/大琳/recordings/周六 10点14分✔️.meta.json');
    expect(recordingTurnsMdPath('E:\\数据根', '大琳', 'a.b.m4a')).toBe('E:\\数据根/大琳/recordings/a.b.turns.md');
  });

  it('过滤清单是单源（ADR-0217）：四条派生后缀就这四条，加后缀必须同时想过删除清理', () => {
    // 这份清单同时决定「录音页列哪些行」与「删除时清哪些文件」——漂了会漏列或漏删
    expect([...RECORDING_DERIVED_SUFFIXES]).toEqual(['.turns.json', '.meta.json', '.turns.md', '.tmp']);
  });

  it('isRecordingFile：只认原件，四类派生后缀（含带 pid 半截 tmp）都排除', () => {
    expect(isRecordingFile('大琳 周六.aac')).toBe(true);
    expect(isRecordingFile('无扩展名')).toBe(true);
    expect(isRecordingFile('a.turns.json')).toBe(false);
    expect(isRecordingFile('a.meta.json')).toBe(false);
    expect(isRecordingFile('a.turns.md')).toBe(false);
    expect(isRecordingFile('a.turns.json.12345.0.tmp')).toBe(false);
    expect(isRecordingFile('')).toBe(false);
  });

  it('writeRecordingMeta / readRecordingMeta 往返；畸形字段丢弃、坏 JSON 回落 null', () => {
    const m = memFs();
    setRecordingFsForTests(m.fs2);
    expect(readRecordingMeta('D:\\根', '大琳', 'r.aac')).toBeNull(); // 缺文件
    expect(writeRecordingMeta('D:\\根', '大琳', 'r.aac', { startMs: 1758_000_000_000, sha256: 'abc', startSource: 'manual' })).toBe(true);
    expect(m.dirs[0]).toBe('D:\\根/大琳/recordings');
    expect(readRecordingMeta('D:\\根', '大琳', 'r.aac')).toEqual({ startMs: 1758_000_000_000, sha256: 'abc', startSource: 'manual' });
    const p = recordingMetaPath('D:\\根', '大琳', 'r.aac');
    m.files.set(p, JSON.stringify({ startMs: 'x', sha256: '', startSource: 'nope', extra: 1 }));
    expect(readRecordingMeta('D:\\根', '大琳', 'r.aac')).toEqual({});
    m.files.set(p, '{bad');
    expect(readRecordingMeta('D:\\根', '大琳', 'r.aac')).toBeNull();
  });

  it('无 fs（非桌面端）：读写各自安全回落（读 null / 写 false），不抛', () => {
    setRecordingFsForTests(null);
    expect(readRecordingMeta('D:\\根', '大琳', 'r.aac')).toBeNull();
    expect(writeRecordingMeta('D:\\根', '大琳', 'r.aac', { startMs: 1 })).toBe(false);
  });

  it('并仓写时间轴时顺手扫清陈旧半截 tmp；新于本次处理开始的不动（修 #10）', () => {
    const now = Date.now();
    const dir = 'D:\\根/大琳/recordings';
    const removed: string[] = [];
    setRecordingFsForTests({
      mkdirSync: () => {},
      writeFileSync: () => {},
      readdirSync: () => [
        'r.aac', // 原件
        'r.turns.json', // 账本
        'r.turns.json.111.0.tmp', // 崩溃遗留（mtime 早于本次处理）：清
        'r.turns.json.222.1.tmp', // 新于本次处理开始（可能在写）：不动
        'other.turns.json.333.0.tmp', // 别的 stem：不在清扫范围
        'r.meta.json',
      ],
      statSync: (p: string) => {
        const name = p.slice(p.lastIndexOf('/') + 1);
        if (name === 'r.turns.json.222.1.tmp') return { mtimeMs: now + 60_000 };
        return { mtimeMs: now - 3_600_000 };
      },
      rmSync: (p: string) => {
        removed.push(p);
      },
    });
    expect(writeRecordingTurnsMd('D:\\根', '大琳', 'r.aac', '# md')).toBe(true);
    expect(removed).toEqual([`${dir}/r.turns.json.111.0.tmp`]);
  });
});

describe('起点一等化：候选反推与生效口径（ADR-0217）', () => {
  afterEach(() => setRecordingFsForTests(null));

  /** mtime = 2026-09-23（周三）15:00 本地 */
  const mtime = new Date(2026, 8, 23, 15, 0, 0).getTime();

  it('文件名有绝对时间 → 唯一候选就是它（不走 mtime）', () => {
    expect(recordingStartCandidates('20260901123000.aac', mtime)).toEqual([new Date(2026, 8, 1, 12, 30).getTime()]);
  });

  it('只有「周X + N点N分」→ 给候选（都不晚于 mtime，最多 3 个，最近的在前）', () => {
    const c = recordingStartCandidates('大琳 周六 10点14分✔️.aac', mtime);
    expect(c).toHaveLength(3);
    for (const t of c) expect(t).toBeLessThanOrEqual(mtime); // mtime 只作上界
    expect(c.every((t) => new Date(t).getDay() === 6)).toBe(true);
    expect(new Date(c[0]).getHours()).toBe(10);
    expect(new Date(c[0]).getMinutes()).toBe(14);
    expect(c[0]).toBeGreaterThan(c[1]); // 最近的在最前
  });

  it('「小时:分」写法也认；无时刻信息 → 空（导入页必填）', () => {
    const c = recordingStartCandidates('录音 10:14.m4a', mtime);
    expect(new Date(c[0]).getHours()).toBe(10);
    expect(new Date(c[0]).getMinutes()).toBe(14);
    // mtime 是当天 15:00，10:14 早于它 → 就落在同一天（mtime 只作上界）
    expect(new Date(c[0]).getDate()).toBe(23);
    // 反过来：时刻晚于 mtime → 往前退一天（文件不可能早于录制时刻落盘）
    const late = recordingStartCandidates('录音 22:14.m4a', mtime);
    expect(new Date(late[0]).getDate()).toBe(22);
    expect(recordingStartCandidates('大琳 的录音.aac', mtime)).toEqual([]);
    expect(recordingStartCandidates('大琳 的录音.aac', 0)).toEqual([]);
  });

  it('recordingStartOf：meta 的用户确认值优先于文件名/mtime，缺 meta 才回落旧口径', () => {
    const m = memMetaFs();
    setRecordingFsForTests(m.fs2);
    expect(recordingStartOf('D:\\根', '大琳', '20260901123000.aac')).toBe(new Date(2026, 8, 1, 12, 30).getTime());
    writeRecordingMeta('D:\\根', '大琳', '20260901123000.aac', { startMs: 111, startSource: 'manual' });
    expect(recordingStartOf('D:\\根', '大琳', '20260901123000.aac')).toBe(111); // meta 压过文件名
    writeRecordingMeta('D:\\根', '大琳', '无名.aac', { startMs: 222, startSource: 'candidate' });
    expect(recordingStartOf('D:\\根', '大琳', '无名.aac', mtime)).toBe(222);
    expect(recordingStartOf('D:\\根', '大琳', '另一个无名.aac', mtime)).toBe(mtime);
  });
});

describe('导入去重与同名消歧（issue 516 Q1/Q2）', () => {
  it('无冲突 → 原名；同名已在 → 依次试 (2) (3)；全占 → null', () => {
    expect(resolveRecordingTargetName(() => false, 'a.aac')).toBe('a.aac');
    const has2 = (nm: string): boolean => nm === 'a.aac';
    expect(resolveRecordingTargetName(has2, 'a.aac')).toBe('a (2).aac');
    const has23 = (nm: string): boolean => nm === 'a.aac' || nm === 'a (2).aac';
    expect(resolveRecordingTargetName(has23, 'a.aac')).toBe('a (3).aac');
    expect(resolveRecordingTargetName(() => true, 'a.aac')).toBeNull();
  });

  it('后缀加在扩展名前，多段扩展名只切最后一段（与 sidecar 剥名口径一致）', () => {
    const taken = (nm: string): boolean => nm === '我的录音.final.m4a';
    expect(resolveRecordingTargetName(taken, '我的录音.final.m4a')).toBe('我的录音.final (2).m4a');
    expect(resolveRecordingTargetName(() => false, '无扩展名')).toBe('无扩展名');
  });

  it('库里巡检：同尺寸才读盘哈希——尺寸各异的库一次内容都不读（大库不拖慢册页）', () => {
    const reads: string[] = [];
    const fs2 = memDupFs({ a: 'AAAA', b: 'BBBBB', c: 'CCCCCC' }, reads);
    expect(duplicateRecordingGroups('d', fs2, dupShaOf(fs2))).toEqual([]);
    expect(reads).toEqual([]); // 尺寸全不同 → 一次都没读
  });

  it('库里巡检：同尺寸 + 同内容 → 报一组（组内按名排序）；同尺寸不同内容不报', () => {
    const fs2 = memDupFs({ '甲.aac': 'SAME', '乙.aac': 'SAME', '丙.aac': 'DIFF' }, []);
    // 甲 / 乙 同内容 → 一组；丙 与它们同尺寸（4 字节）但内容不同 → 自己不成组
    expect(duplicateRecordingGroups('d', fs2, dupShaOf(fs2))).toEqual([['乙.aac', '甲.aac']]);
  });

  it('库里巡检：多组并存；派生文件（sidecar / meta / turns.md）不参与；0 字节跳过', () => {
    const fs2 = memDupFs(
      {
        'a.aac': 'XX', 'b.aac': 'XX', // 组一
        'a.turns.json': 'XX', 'a.meta.json': 'XX', 'a.turns.md': 'XX', // 派生物：同名同内容也不报
        'one.m4a': 'YYYY', 'two.m4a': 'YYYY', // 组二
        '空.aac': '', '空2.aac': '', // 0 字节：跳过（哈希没意义）
      },
      [],
    );
    expect(duplicateRecordingGroups('d', fs2, dupShaOf(fs2))).toEqual([
      ['b.aac', 'a.aac'].sort(),
      ['two.m4a', 'one.m4a'].sort(),
    ].sort((x, y) => x[0].localeCompare(y[0])));
  });

  it('库里巡检：目录不存在 / 无 fs → 空数组不抛', () => {
    expect(duplicateRecordingGroups('d', null)).toEqual([]);
    expect(duplicateRecordingGroups('d', { readdirSync: () => { throw new Error('ENOENT'); } })).toEqual([]);
  });
});

describe('逐轮时间轴（ADR-0217 Q21：含旁音、绝对时间 = 起点 + 偏移）', () => {
  it('fmtClock：mm:ss，过一小时才带小时段', () => {
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(62)).toBe('01:02');
    expect(fmtClock(3599)).toBe('59:59');
    expect(fmtClock(3600)).toBe('1:00:00');
    expect(fmtClock(-5)).toBe('00:00');
    expect(fmtClock(NaN)).toBe('00:00');
  });

  it('表头四行（起点 / 轮次含旁音计数 / 段落数 / 模式）+ 每轮七列（含段界列）', () => {
    const startMs = new Date(2026, 8, 19, 10, 14, 0).getTime();
    const md = buildRecordingTurnsMd('r.aac', startMs, {
      phase: 'done',
      mode: 'dual',
      turns: [
        { start: 3, end: 7, speaker: '我', emotion: '平静', text: '喂，在吗' },
        { start: 8, end: 12, speaker: '其他', text: '（电视里的声音）' },
        { start: 13, end: 15, speaker: '大琳', text: '' },
      ],
    });
    expect(md).toContain('# r.aac · 转写时间轴');
    expect(md).toContain('- 起点：2026-09-19 10:14:00');
    expect(md).toContain('- 轮次：3（其中旁音 1）');
    expect(md).toContain('- 段落：1 段'); // 只有「我」那一轮成段（旁音 / 空轮都不是段）
    expect(md).toContain('- 模式：dual');
    // 段界列：段首轮写粗体段序、旁音轮写「旁音」、空转写轮不属于任何段写「—」
    expect(md).toContain('| 1 | **1** | 2026-09-19 10:14:03 | 00:03-00:07 | 我 | 平静 | 喂，在吗 |');
    // 旁音轮也留档（这份档的用处之一就是复核没误杀）
    expect(md).toContain('| 2 | 旁音 | 2026-09-19 10:14:08 | 00:08-00:12 | 其他 | — | （电视里的声音） |');
    expect(md).toContain('| 3 | — | 2026-09-19 10:14:13 | 00:13-00:15 | 大琳 | — | （空转写） |');
    expect(md.endsWith('\n')).toBe(true);
  });

  it('段界列：同段后续轮写 ↳、段数随段序递增，与「并成几条消息」严格对应', () => {
    const md = buildRecordingTurnsMd('r.aac', 0, {
      phase: 'done',
      turns: [
        { start: 0, end: 4, speaker: '我', text: 'A1' },
        { start: 4, end: 8, speaker: '我', text: 'A2' },
        { start: 8, end: 10, speaker: '其他', text: '旁音' },
        { start: 10, end: 12, speaker: '我', text: '   ' },
        { start: 12, end: 16, speaker: '我', text: 'A3' },
        { start: 16, end: 20, speaker: '大琳', text: 'B1' },
      ],
    });
    expect(md).toContain('- 段落：3 段'); // A1A2（同人连续）/ A3（被旁音断过）/ B1
    const rows = md.split('\n').filter((l) => /^\| \d+ \|/.test(l));
    expect(rows.map((r) => r.split('|')[2].trim())).toEqual(['**1**', '↳', '旁音', '—', '**2**', '**3**']);
  });

  it('空轮次不抛：表头照出、表体为空', () => {
    const md = buildRecordingTurnsMd('空.aac', 0, { phase: 'transcribe' });
    expect(md).toContain('- 轮次：0');
    expect(md).toContain('- 模式：—');
    expect(md.split('\n').filter((l) => l.startsWith('| '))).toHaveLength(1); // 只剩表头分隔行
  });

  it('writeRecordingTurnsMd：建目录 + 落盘；无 fs / 缺参回落 false', () => {
    const m = memMetaFs();
    setRecordingFsForTests(m.fs2);
    expect(writeRecordingTurnsMd('D:\\根', '大琳', 'r.aac', 'x')).toBe(true);
    expect(m.dirs[0]).toBe('D:\\根/大琳/recordings');
    expect(m.files.get(recordingTurnsMdPath('D:\\根', '大琳', 'r.aac'))).toBe('x');
    setRecordingFsForTests(null);
    expect(writeRecordingTurnsMd('D:\\根', '大琳', 'r.aac', 'x')).toBe(false);
  });
});

describe('归属抽检（issue 516 Q15：check 组装与结果解析）', () => {
  it('buildRecordingCheckSpec：一个进程带全部 --src，路径带引号（空格 / 中文）', () => {
    const spec = buildRecordingCheckSpec({
      dataRoot: 'E:\\数据 根',
      talker: '大琳',
      srcs: ['E:\\下载\\a b.aac', 'E:\\下载\\c.aac'],
      ffmpeg: 'C:\\ff\\ffmpeg.exe',
    });
    expect(spec.cmd).toBe('bz-face');
    const args = spec.args ?? [];
    expect(args[0]).toBe('check');
    expect(args.join(' ')).toContain('--data-root');
    expect(args.filter((a) => a === '--src')).toHaveLength(2);
    expect(args).toContain('"E:\\下载\\a b.aac"');
    expect(args).toContain('--ffmpeg');
    expect(spec.shell).toBe(true);
  });

  it('parseRecordingCheckResult：只认三值，畸形一律空表（空表 = 全放行）', () => {
    expect(parseRecordingCheckResult({ verdicts: { 'E:/a.aac': 'ok', 'E:/b.aac': 'stranger' } }).get('E:/b.aac')).toBe('stranger');
    expect(parseRecordingCheckResult({ verdicts: { 'E:/a.aac': 'unknown' } }).get('E:/a.aac')).toBe('unknown');
    expect(parseRecordingCheckResult({ verdicts: { 'E:/a.aac': 'weird' } }).size).toBe(0);
    expect(parseRecordingCheckResult({}).size).toBe(0);
    expect(parseRecordingCheckResult(null).size).toBe(0);
    expect(parseRecordingCheckResult({ verdicts: ['x'] } as any).size).toBe(0);
  });
});
