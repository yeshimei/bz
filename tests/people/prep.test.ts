// @vitest-environment jsdom
/**
 * 画脸谱工具段（prep）驱动层测试（issue 469 / ADR-0195 / ADR-0196 决策 1、3、4、5、7）。
 *
 * 被测对象 src/people/prep.ts（bz-face prep 驱动 + 控制文件契约 + 旁路表读取）与
 * src/people/datasource.ts 的靶向合并纯函数（applyVoiceToMsgs / applyImageMapToMsgs）：
 * runExternalTool 经 setPrepRunnerForTests 注入假件、fs 经 setPrepFsForTests 注入内存假件——
 * **不 spawn 真进程、不碰真实数据根、不真跑 prep**（468 在 .scratch/face-468 留有探针先例）。
 * 断言参数面（468 prep-core CLI）、四行协议映射（段计数累计 / 暂停态 / [bz-result] 权威）、
 * 协作式控制文件内容、失败面归类、转写与图片关联的幂等靶向升级、进度块 prep 渲染契约。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import type { ExternalToolCallbacks, ExternalToolOutcome, ExternalToolSpec } from '../../src/core/external-tool';
import {
  PREP_PHASES,
  PREP_PHASE_LABELS,
  applyPrepProgress,
  buildPrepSpec,
  classifyPrepFailure,
  clearPrepControl,
  collectPrepInfo,
  controlFilePath,
  newPrepProgress,
  prepAllDone,
  prepMediaTotals,
  prepOverallPct,
  prepPhaseLabel,
  prepStageLine,
  readPrepSidecars,
  setPrepFsForTests,
  setPrepRunnerForTests,
  startPrepSession,
  writePrepControl,
  type PrepFs,
  type PrepProgress,
  type PrepRunner,
} from '../../src/people/prep';
import { applyImageMapToMsgs, applyVoiceToMsgs, type ImageMapItem, type StoreMsg, type VoiceItem } from '../../src/people/datasource';
import { progressBlock, type JobsBlockState } from '../../src/people/render';

/** 假进程壳：记录 spec、转发协议行、手动终结（形状对齐 runExternalTool 返回的 handle） */
class FakeTool {
  calls: ExternalToolSpec[] = [];
  stopCalls = 0;
  private cb: ExternalToolCallbacks | null = null;
  private resolve: ((o: ExternalToolOutcome) => void) | null = null;

  runner: PrepRunner = (spec, cb) => {
    this.calls.push(spec);
    this.cb = cb;
    return {
      stop: () => {
        this.stopCalls++;
        void this.settle({ ok: false, stopped: true, code: null, stderr: '', error: null });
      },
      done: new Promise<ExternalToolOutcome>((r) => {
        this.resolve = r;
      }),
    };
  };

  step(t: string): void { this.cb!.onStep(t); }
  progress(phase: string | null, pct: number | null): void { this.cb!.onProgress(phase, pct); }
  info(data: Record<string, unknown>): void { this.cb!.onInfo(data); }
  result(data: Record<string, unknown>): void { this.cb!.onResult(data); }
  settle(o: Partial<ExternalToolOutcome>): Promise<void> {
    this.resolve?.({ ok: false, stopped: false, code: 1, stderr: '', error: null, ...o } as ExternalToolOutcome);
    return new Promise((r) => setTimeout(r, 0));
  }
}

/** 内存 fs 假件（控制文件 / 旁路表读写断言用） */
class MemFs implements PrepFs {
  files = new Map<string, string>();
  writeText(path: string, data: string): void { this.files.set(path, data); }
  readText(path: string): string | null { return this.files.get(path) ?? null; }
  exists(path: string): boolean { return this.files.has(path); }
  unlink(path: string): void { this.files.delete(path); }
}

let tool: FakeTool;
let fs: MemFs;

beforeEach(() => {
  resetObsidianMocks();
  tool = new FakeTool();
  fs = new MemFs();
  setPrepRunnerForTests(tool.runner);
  setPrepFsForTests(fs);
});

afterEach(() => {
  setPrepRunnerForTests(null);
  setPrepFsForTests(null);
});

describe('纯函数：参数组装（468 prep-core CLI 参数面）', () => {
  it('buildPrepSpec：cmd=bz-face + prep + 位置联系人 + --data-root + --asr-engine（恒下发）；win32 路径与联系人包引号', () => {
    const spec = buildPrepSpec({ dataRoot: 'E:\\数据根', contact: '大琳' });
    expect(spec.cmd).toBe('bz-face');
    expect(spec.args).toEqual([
      'prep',
      process.platform === 'win32' ? '"大琳"' : '大琳',
      '--data-root',
      process.platform === 'win32' ? '"E:\\数据根"' : 'E:\\数据根',
      '--asr-engine',
      'sensevoice',
    ]);
    expect(spec.shell).toBe(true);
  });

  it('asr-engine=faster-whisper 才带 --asr-model；sensevoice 不带；src/python/ffmpeg 非空才传、python 不包引号', () => {
    const full = buildPrepSpec({
      dataRoot: 'D:\\根',
      contact: '陈默',
      asrEngine: 'faster-whisper',
      asrModel: ' small ',
      src: 'wxid_x',
      python: 'py -3',
      ffmpeg: 'C:\\ff\\ffmpeg.exe',
    });
    expect(full.args).toEqual([
      'prep',
      process.platform === 'win32' ? '"陈默"' : '陈默',
      '--data-root',
      process.platform === 'win32' ? '"D:\\根"' : 'D:\\根',
      '--asr-engine',
      'faster-whisper',
      '--asr-model',
      'small',
      '--src',
      process.platform === 'win32' ? '"wxid_x"' : 'wxid_x',
      '--ffmpeg',
      process.platform === 'win32' ? '"C:\\ff\\ffmpeg.exe"' : 'C:\\ff\\ffmpeg.exe',
      '--python',
      'py -3',
    ]);
    const bare = buildPrepSpec({ dataRoot: 'D:\\根', contact: '陈默', asrEngine: 'sensevoice', asrModel: 'small', src: '  ', python: '' });
    expect(bare.args).not.toContain('--asr-model');
    expect(bare.args).not.toContain('--src');
    expect(bare.args).not.toContain('--python');
  });
});

describe('纯函数：阶段词汇表与计数账本', () => {
  it('四段词与工具 PREP_PHASES 同词汇：media/derive/map/transcribe → 中文；未知词空', () => {
    expect(PREP_PHASES).toEqual(['media', 'derive', 'map', 'transcribe']);
    expect(prepPhaseLabel('media')).toBe(PREP_PHASE_LABELS.media);
    expect(prepPhaseLabel('derive')).toBe('派生图片档');
    expect(prepPhaseLabel('map')).toBe('图片关联表');
    expect(prepPhaseLabel('transcribe')).toBe('语音转写');
    expect(prepPhaseLabel('wat')).toBe('');
    expect(prepPhaseLabel(null)).toBe('');
  });

  it('collectPrepInfo：media 各类求和（done+skip 计完成、fail 计总数）、段末记入 donePhases', () => {
    const prog = newPrepProgress();
    expect(collectPrepInfo(prog, { phase: 'media', counts: { voice: { done: 1, skip: 2, fail: 1 }, image: { done: 4, skip: 0, fail: 0 } } })).toBe(true);
    expect(prog.counts.media).toEqual({ done: 7, total: 8 });
    expect(prog.donePhases).toEqual(['media']);
    expect(collectPrepInfo(prog, { phase: 'wat' })).toBe(false); // 未知段不认
  });

  it('collectPrepInfo：derive/transcribe 三项、map refs×mapped、暂停 / 恢复态', () => {
    const prog = newPrepProgress();
    collectPrepInfo(prog, { phase: 'derive', done: 3, skip: 1, fail: 1 });
    expect(prog.counts.derive).toEqual({ done: 4, total: 5 });
    collectPrepInfo(prog, { phase: 'map', refs: 12, mapped: 9 });
    expect(prog.counts.map).toEqual({ done: 9, total: 12 });
    collectPrepInfo(prog, { phase: 'transcribe', done: 2, skip: 3, fail: 0 });
    expect(prog.counts.transcribe).toEqual({ done: 5, total: 5 });
    expect(collectPrepInfo(prog, { phase: 'media', status: 'paused', note: '收到暂停指令' })).toBe(true);
    expect(prog.paused).toBe(true);
    expect(collectPrepInfo(prog, { phase: 'media', status: 'resumed' })).toBe(true);
    expect(prog.paused).toBe(false);
  });

  it('applyPrepProgress：总数已预存的段按 pct 推算已完成（单调、钳上限）；总数未知不动', () => {
    const prog = newPrepProgress({ media: 100 });
    applyPrepProgress(prog, 'media', 40);
    expect(prog.counts.media).toEqual({ done: 40, total: 100 });
    applyPrepProgress(prog, 'media', 20); // pct 回退不倒退（工具分片顺序起伏）
    expect(prog.counts.media!.done).toBe(40);
    applyPrepProgress(prog, 'media', 110);
    expect(prog.counts.media!.done).toBe(100);
    const bare = newPrepProgress();
    applyPrepProgress(bare, 'media', 40);
    expect(bare.counts.media).toBeUndefined(); // 没总数绝不编数
    expect(bare.pct).toBe(40);
  });

  it('prepOverallPct：四段均分、当前段按 pct 折算、全完成 100', () => {
    expect(prepOverallPct(newPrepProgress())).toBe(0);
    const one = newPrepProgress();
    collectPrepInfo(one, { phase: 'media', done: 1, skip: 0, fail: 0 });
    expect(prepOverallPct(one)).toBe(25);
    const two = newPrepProgress();
    collectPrepInfo(two, { phase: 'media', done: 1, skip: 0, fail: 0 });
    collectPrepInfo(two, { phase: 'derive', done: 1, skip: 0, fail: 0 });
    applyPrepProgress(two, 'map', null); // map 段不可估按 0——保守不假报
    expect(prepOverallPct(two)).toBe(50);
    applyPrepProgress(two, 'transcribe', 50);
    expect(prepOverallPct(two)).toBe(63);
    const all = newPrepProgress();
    for (const p of PREP_PHASES) collectPrepInfo(all, { phase: p, done: 1, skip: 0, fail: 0 });
    expect(prepAllDone(all)).toBe(true);
    expect(prepOverallPct(all)).toBe(100);
  });

  it('prepStageLine：计数命中给 已完成/总数、未知总数给百分比、不可估给省略号', () => {
    const prog = newPrepProgress();
    prog.phase = 'media';
    expect(prepStageLine(prog)).toBe('媒体导出…');
    prog.pct = 40;
    expect(prepStageLine(prog)).toBe('媒体导出 40%');
    prog.counts.media = { done: 312, total: 1631 };
    expect(prepStageLine(prog)).toBe('媒体导出 312/1631');
  });

  it('prepMediaTotals：kindCounts 中文形态键求和；零媒体返回 null（决策 9 自动跳过）；缺键回落 stats', () => {
    expect(prepMediaTotals({ 文本: 5, 语音: 12, 图片: 3, 视频: 1, 文件: 2 })).toEqual({ media: 18, transcribe: 12, map: 3 });
    expect(prepMediaTotals({ 文本: 5 })).toBeNull();
    expect(prepMediaTotals(undefined, { voiceCount: 4, imageCount: 2 })).toEqual({ media: 6, transcribe: 4, map: 2 });
    expect(prepMediaTotals({}, { voiceCount: 0, imageCount: 0 })).toBeNull();
  });
});

describe('纯函数：失败面归类（同 sync 口径）', () => {
  it('ENOENT → 安装指引；依赖缺失 → doctor；工具中文引导透传不带多余 hint', () => {
    expect(classifyPrepFailure({ ok: false, stopped: false, code: null, stderr: '', error: new Error('外部工具启动失败：spawn bz-face ENOENT') }).hint)
      .toContain('npm link');
    const dep = classifyPrepFailure({ ok: false, stopped: false, code: 1, stderr: 'ModuleNotFoundError: No module named funasr', error: new Error('外部工具异常退出（退出码 1）') });
    expect(dep.message).toBe('Python 缺少预处理依赖');
    expect(dep.hint).toContain('bz-face doctor');
    const guide = classifyPrepFailure({ ok: false, stopped: false, code: 1, stderr: '', error: new Error('外部工具异常退出（退出码 1）：联系人目录不存在：E:\\根\\大琳——先跑 bz-face sync') });
    expect(guide.message).toContain('联系人目录不存在');
    expect(guide.hint).toBe('');
  });
});

describe('控制文件契约（协作式暂停；468 parseControlAction 消费侧）', () => {
  it('writePrepControl 写 `<数据根>/.bz-face/control.json` {action}；clearPrepControl 清掉残留', async () => {
    expect(controlFilePath('E:\\根')).toBe('E:\\根/.bz-face/control.json');
    await writePrepControl('E:\\根', 'pause');
    expect(JSON.parse(fs.files.get(controlFilePath('E:\\根'))!)).toEqual({ action: 'pause' });
    await writePrepControl('E:\\根', 'resume');
    expect(JSON.parse(fs.files.get(controlFilePath('E:\\根'))!)).toEqual({ action: 'resume' });
    clearPrepControl('E:\\根');
    expect(fs.files.has(controlFilePath('E:\\根'))).toBe(false);
  });

  it('fs 不可用（数据根未配置）写失败只返回 false，不抛', async () => {
    setPrepFsForTests(null);
    await expect(writePrepControl('', 'pause')).resolves.toBe(false);
  });

  it('readPrepSidecars：读 voice.json + image_map.json；两表全缺返回 null；坏行过滤', () => {
    fs.files.set('E:/根/大琳/voice.json', JSON.stringify([{ wav: '大琳/voice/1.wav', sid: 11, dur: 3, text: '构造转写', emotion: 'HAPPY' }, '坏行', null]));
    fs.files.set('E:/根/大琳/image_map.json', JSON.stringify([{ file: '2026-05/p1.jpg', ct: 1, sid: 22 }]));
    const side = readPrepSidecars('E:\\根', '大琳')!; // 数据根反斜杠传入（win32 形态），内部归一成正斜杠读
    expect(side.voice).toHaveLength(1);
    expect(side.voice[0].text).toBe('构造转写');
    expect(side.imageMap).toEqual([{ file: '2026-05/p1.jpg', ct: 1, sid: 22 }]);
    expect(readPrepSidecars('E:\\根', '无表')).toBeNull();
    fs.files.set('E:/根/坏/voice.json', '{oops');
    expect(readPrepSidecars('E:\\根', '坏')).toBeNull(); // 坏 JSON 视作无表
  });
});

describe('靶向合并纯函数（ADR-0197 决策 4：合并进聊天仓由插件执行；幂等）', () => {
  const vm = (over: Partial<StoreMsg>): StoreMsg => ({ key: 'k', ts: 1, isSender: false, type: 1, text: '', ...over });

  it('applyVoiceToMsgs：wav 全路径 / 尾段名 / sid 三键匹配，text 升级 `[语音 N秒·情感] 转写`；同值不重计', () => {
    const msgs: StoreMsg[] = [
      vm({ key: 'a', type: 34, sid: 11, dur: 14, wav: '大琳/voice/a_11.wav', text: '' }),
      vm({ key: 'b', type: 34, sid: 12, dur: 5, wav: '大琳/voice/b_12.wav', text: '[语音 5秒]' }),
    ];
    const voice: VoiceItem[] = [
      { wav: '大琳/voice/a_11.wav', sid: 11, dur: 14, text: '构造转写内容', emotion: 'HAPPY' },
      { wav: 'b_12.wav', text: '尾段名命中', emotion: '' },
    ];
    expect(applyVoiceToMsgs(msgs, voice, { previewVoice: true })).toBe(2);
    expect(msgs[0].text).toBe('[语音 14秒·开心] 构造转写内容');
    expect(msgs[1].text).toBe('[语音 5秒] 尾段名命中');
    expect(applyVoiceToMsgs(msgs, voice, { previewVoice: true })).toBe(0); // 幂等：同键同值不重计
  });

  it('applyVoiceToMsgs：sid 兜底（wav 缺）；失败条目（ERR / <转写失败）跳过；previewVoice 关不动 text', () => {
    const msgs: StoreMsg[] = [
      vm({ key: 'a', type: 34, sid: 11, dur: 9, text: '' }),
      vm({ key: 'b', type: 34, sid: 12, dur: 3, wav: '大琳/voice/b.wav', text: '' }),
    ];
    const voice: VoiceItem[] = [
      { sid: 11, text: 'sid 兜底命中', emotion: 'SAD' },
      { wav: '大琳/voice/b.wav', text: '<转写失败:boom>', emotion: 'ERR' },
    ];
    expect(applyVoiceToMsgs(msgs, voice, { previewVoice: true })).toBe(1);
    expect(msgs[0].text).toBe('[语音 9秒·难过] sid 兜底命中');
    expect(msgs[1].text).toBe(''); // 失败保持空前态，重跑 prep 即补齐
    const off = [vm({ key: 'c', type: 34, sid: 13, dur: 3, text: '' })];
    expect(applyVoiceToMsgs(off, [{ sid: 13, text: '不进时间线' }], { previewVoice: false })).toBe(0);
    expect(off[0].text).toBe('');
  });

  it('applyImageMapToMsgs：sid 精确（可覆盖已有 img）→ ct+type=3 兜底（只补缺）；幂等重跑不重计', () => {
    const msgs: StoreMsg[] = [
      vm({ key: 'p1', type: 3, sid: 21, ts: Date.UTC(2026, 4, 1, 12) }),
      vm({ key: 'p2', type: 3, ts: Date.UTC(2026, 4, 2, 12) }),
      vm({ key: 'p3', type: 3, ts: Date.UTC(2026, 4, 3, 12), img: '2026-05/旧.jpg' }),
      vm({ key: 'p4', type: 3, sid: 31, ts: Date.UTC(2026, 4, 4, 12), img: '2026-05/旧31.jpg' }),
    ];
    const map: ImageMapItem[] = [
      { file: '2026-05/new.jpg', ct: 1, sid: 21 },
      { file: '2026-05/ct命中.jpg', ct: Date.UTC(2026, 4, 2, 12) / 1000 },
      { file: '2026-05/不该猜进来.jpg', ct: Date.UTC(2026, 4, 3, 12) / 1000 }, // ct 兜底不碰已有 img 的条目
      { file: '2026-05/sid覆盖.jpg', ct: 2, sid: 31 },
    ];
    expect(applyImageMapToMsgs(msgs, map)).toBe(3);
    expect(msgs[0].img).toBe('2026-05/new.jpg');
    expect(msgs[1].img).toBe('2026-05/ct命中.jpg');
    expect(msgs[2].img).toBe('2026-05/旧.jpg'); // ct 兜底只补缺：旧关联保留
    expect(msgs[3].img).toBe('2026-05/sid覆盖.jpg'); // sid 精确：原始字段按新值更新（upsert）
    expect(applyImageMapToMsgs(msgs, map)).toBe(0);
  });
});

describe('进程会话（暂停待命复用同一进程）', () => {
  const noopCbs = (): ExternalToolCallbacks => ({ onStep: () => {}, onProgress: () => {}, onInfo: () => {}, onResult: () => {} });
  const spec = (): ExternalToolSpec => ({ cmd: 'bz-face', args: ['prep'], shell: true });

  it('同联系人活会话复用（runner 只调一次）；终结后 alive=false 重起起新进程', async () => {
    const s1 = startPrepSession('大琳', spec(), noopCbs());
    const s1b = startPrepSession('大琳', spec(), noopCbs());
    expect(s1b).toBe(s1);
    expect(tool.calls).toHaveLength(1);
    await tool.settle({ ok: true, code: 0 });
    expect(s1.alive()).toBe(false);
    startPrepSession('大琳', spec(), noopCbs());
    expect(tool.calls).toHaveLength(2);
  });

  it('换人跑：被 stop 的旧会话终结回调不得把新会话误标已死（否则恢复时同一联系人双起进程）', async () => {
    startPrepSession('大琳', spec(), noopCbs());
    const b = startPrepSession('陈默', spec(), noopCbs()); // 换人：大琳进程被 stop
    expect(tool.calls).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 0)); // 让大琳的终结回调跑完——旧缺陷在此置脏共享标志
    const reused = startPrepSession('陈默', spec(), noopCbs());
    expect(reused).toBe(b); // 陈默会话仍活着：复用，不重起第三个进程
    expect(tool.calls).toHaveLength(2);
  });

  it('[bz-result] 由会话记账进终态（PrepOutcome.result）；stop 走 handle（中断语义）', async () => {
    const seen: Record<string, unknown>[] = [];
    const s = startPrepSession('大琳', spec(), { ...noopCbs(), onResult: (d) => seen.push(d) });
    tool.result({ ok: true, failed: 0 });
    await tool.settle({ ok: true, code: 0 });
    const out = await s.done;
    expect(seen).toHaveLength(1);
    expect(out.result).toEqual({ ok: true, failed: 0 });
    expect(out.outcome.ok).toBe(true);
    const s2 = startPrepSession('大琳', spec(), noopCbs());
    s2.handle.stop();
    expect(tool.stopCalls).toBe(1);
    const out2 = await s2.done;
    expect(out2.outcome.stopped).toBe(true);
  });
});

describe('进度块 prep 渲染契约（469）', () => {
  const state = (over: Partial<JobsBlockState>): JobsBlockState => ({
    talker: 'wxid_a',
    name: '陈默',
    status: 'running',
    message: '',
    batchesDone: 0,
    batchesTotal: 12,
    stagesDone: 0,
    queueIndex: 1,
    queueTotal: 1,
    ...over,
  });

  it('preprocess 运行中：阶段行带 已完成/总数，进度条 = 工具段折算总进度', () => {
    const b = progressBlock(state({ prep: { stageText: '媒体导出 312/1631', overall: 16, failed: 0 } }));
    expect(b.querySelector('.bz-people-jobs-main')!.textContent).toBe('媒体导出 312/1631');
    expect(b.querySelector('.bz-people-jobs-fill')!.getAttribute('style')).toBe('width:16%');
  });

  it('prep 暂停面：`已暂停 · <阶段行>`；失败计账且不在跑时出「重试失败项」', () => {
    const paused = progressBlock(state({ status: 'paused', prep: { stageText: '语音转写 45/1289', overall: 34, failed: 0 } }));
    expect(paused.querySelector('.bz-people-jobs-main')!.textContent).toBe('已暂停 · 语音转写 45/1289');
    expect(paused.querySelector('[data-people-jobs-prep-retry]')).toBeNull();
    const failed = progressBlock(state({ status: 'paused', prep: { stageText: null, overall: 100, failed: 2 } }));
    expect(failed.querySelector('[data-people-jobs-prep-retry]')!.textContent).toBe('重试失败项');
    const running = progressBlock(state({ prep: { stageText: null, overall: 10, failed: 2 } }));
    expect(running.querySelector('[data-people-jobs-prep-retry]')).toBeNull(); // running 不并列重试
  });

  it('无 prep 段的任务渲染与改前一致（回归：455 契约不漂移）', () => {
    const b = progressBlock(state({ batchesDone: 3, message: '第 4/12 批' }));
    expect(b.querySelector('.bz-people-jobs-main')!.textContent).toBe('正在生成 · 第 4/12 批');
    expect(b.querySelector('[data-people-jobs-prep-retry]')).toBeNull();
  });
});
