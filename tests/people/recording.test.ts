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
  hasRecordingTurns,
  isRecordingRunning,
  parseRecordingFilenameTs,
  parseRecordingSidecar,
  recordingItemState,
  recordingPhasePct,
  recordingSidecarPath,
  recordingTsOf,
  recordingsDirOf,
  recordingToolScriptPath,
  setRecordingRunnerForTests,
  startRecordingTask,
  stopRecordingTask,
  voiceprintRefPath,
  voiceprintRefStatus,
  type RecordingSidecar,
} from '../../src/people/recording';
import type { ExternalToolHandle } from '../../src/core/external-tool';

describe('路径组装', () => {
  it('recordingsDirOf / sidecar / 脚本 / 质心 npz 的固定布局（ADR-0212）', () => {
    expect(recordingsDirOf('E:\\数据根', '大琳')).toBe('E:\\数据根/大琳/recordings');
    expect(recordingSidecarPath('E:\\数据根', '大琳', '周二.aac')).toBe('E:\\数据根/大琳/recordings/周二.aac.turns.json');
    expect(recordingToolScriptPath('E:\\数据根/', 'rec_slide_hmm.py')).toBe('E:\\数据根/tools/rec_slide_hmm.py');
    expect(voiceprintRefPath('E:\\数据根', '大琳')).toBe('E:\\数据根/tools/voiceprints/大琳.npz');
  });

  it('buildRecordingSpec：python 空回落 python、参数四件套、不经 shell', () => {
    const spec = buildRecordingSpec({ dataRoot: 'D:\\根', talker: '大琳', file: 'r.m4a' });
    expect(spec.cmd).toBe('python');
    expect(spec.shell).toBe(false);
    expect(spec.args).toEqual([
      'D:\\根/tools/rec_slide_hmm.py',
      'D:\\根/大琳/recordings/r.m4a',
      '大琳',
      'D:\\根/大琳/recordings/r.m4a.turns.json',
    ]);
    const withPy = buildRecordingSpec({ dataRoot: 'D:\\根', talker: '大', file: 'r', python: 'C:\\Program Files\\py.exe ' });
    expect(withPy.cmd).toBe('C:\\Program Files\\py.exe');
  });

  it('buildVoiceprintSpec：python + 脚本 + 联系人', () => {
    const spec = buildVoiceprintSpec({ dataRoot: 'D:\\根', talker: '大琳', python: 'py -3' });
    expect(spec.cmd).toBe('py -3');
    expect(spec.args).toEqual(['D:\\根/tools/voiceprint_refs.py', '大琳']);
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
