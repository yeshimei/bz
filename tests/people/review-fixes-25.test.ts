// @vitest-environment node
/**
 * 脸谱域审计批（2026-10-01）回归测试——数据层四组：
 *   1) stats：computeStats 必须把录音三项（recordingCount / recordingTotalSec）搬进 ContactStats。
 *      漏了 = 录音在统计里隐形：媒体徽章不显示、给 AI 的素材说明也没有它（jobs 两处 buildMediaNote
 *      按「全零返回空串」判无素材，纯录音的联系人会拿到空说明）。
 *   2) digest：切批把 `[录音 …]` 也算媒体——只数语音/图片时，纯录音批拿不到「录音行是亲口说的原话」
 *      那段提示词，转写白做、quotes 静默偏少。
 *   3) media：群成员名**恰好是标签词**（昵称叫「图片」）时前缀剥不掉，成员名被当成媒体标签 →
 *      统计串类；补了窄口剥法，并守住四条既有口径（真标签 / 单层标签 / 普通成员名 / 真语音条）。
 *   4) recording：按联系人清录音任务（删人收尾用；不清的话转写跑完会把删掉的人重建出来）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { computeStats } from '../../src/people/stats';
import { chunkMessages, chunkMetaOf, buildExtractPrompt } from '../../src/people/digest';
import { buildMediaNote, formatMediaCount, parseMediaTag } from '../../src/people/media';
import {
  cancelRecordingTasksOfTalker,
  enqueueRecordingTask,
  isRecordingQueued,
  isRecordingRunning,
  queuedRecordingItems,
  recordingQueuePosition,
  resetRecordingProcessesForTests,
  resetRecordingQueueForTests,
  runningRecordingItems,
  setRecordingQueueSleepForTests,
  setRecordingRunnerForTests,
  type RecordingQueueEntry,
} from '../../src/people/recording';
import { releaseHeavy, resetHeavyGateForTests, tryAcquireHeavy } from '../../src/people/heavy-gate';
import type { ExternalToolHandle } from '../../src/core/external-tool';
import type { UnifiedMessage } from '../../src/people/types';

const BASE = Date.UTC(2024, 4, 1, 12, 0, 0);
const msg = (n: number, text: string, isSender = true): UnifiedMessage => ({ ts: BASE + n * 60000, isSender, text });

// ---------------------------------------------------------------- 1) stats

describe('computeStats：录音三项不许漏（审计 #2）', () => {
  it('语音 / 图片 / 录音三类素材都进 ContactStats（含录音总时长）', () => {
    const s = computeStats(
      [
        msg(1, '[语音 12秒·平静] 你好呀'),
        msg(2, '[录音 3分02秒] 今天去爬山了'),
        msg(3, '[图片] 一只橘猫'),
      ],
      { 文本: 0 }
    );
    expect(s.voiceCount).toBe(1);
    expect(s.recordingCount).toBe(1);
    expect(s.recordingTotalSec).toBe(182); // 3 分 02 秒
    expect(s.imageCount).toBe(1);
  });

  it('只有录音的联系人：recordingCount 非零（不是「没素材」）', () => {
    const s = computeStats([msg(1, '[录音 45秒] 一段口述'), msg(2, '普通文本')], {});
    expect(s.voiceCount).toBe(0);
    expect(s.imageCount).toBe(0);
    expect(s.recordingCount).toBe(1);
    expect(s.recordingTotalSec).toBe(45);
  });
});

describe('buildMediaNote：只传语音/图片会漏掉录音（审计 #2 的消费端）', () => {
  it('传齐录音三项后，纯录音也有媒体说明（含录音计数与情感标记口径）', () => {
    const note = buildMediaNote({ voiceCount: 0, voiceTotalSec: 0, imageCount: 0, recordingCount: 2, recordingTotalSec: 200 });
    expect(note).toContain('录音 2 段');
    expect(note).toContain('语音与录音已转写成文字并入对话');
    expect(note).toContain('情感识别结果');
  });

  it('漏传录音三项 = 说明为空串（这就是修复前的现场）', () => {
    expect(buildMediaNote({ voiceCount: 0, voiceTotalSec: 0, imageCount: 0 })).toBe('');
  });

  it('formatMediaCount 里录音段与时长都在', () => {
    expect(formatMediaCount({ voiceCount: 1, voiceTotalSec: 12, imageCount: 0, recordingCount: 2, recordingTotalSec: 200 }))
      .toContain('录音 2 段');
  });
});

// ---------------------------------------------------------------- 2) digest

describe('切批与提示词：录音也算媒体（审计 #3）', () => {
  const rec = (n: number) => msg(n, '[录音 3分02秒·平静] 爬山那天的原话');

  it('纯录音批：批内 media 带上 recording 计数', () => {
    const chunks = chunkMessages([rec(1), rec(2), msg(3, '嗯')], { maxChars: 10000, maxCount: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].media).toEqual({ voice: 0, image: 0, recording: 2 });
  });

  it('纯录音批的采集 prompt 带「录音行是原话」两段指引（修复前一段都没有）', () => {
    const chunks = chunkMessages([rec(1), rec(2)], { maxChars: 10000, maxCount: 100 });
    const prompt = buildExtractPrompt(chunks[0], '老王');
    expect(prompt).toContain('本段含媒体消息'); // 媒体说明段
    expect(prompt).toContain('`[录音 …]` 行都是亲口说的话'); // quotes 指引
  });

  it('落盘批元数据形状不变：chunkMetaOf 不带 recording（旧任务不因升级判漂移）', () => {
    const chunks = chunkMessages([rec(1), msg(2, '[语音 12秒] 口述'), msg(3, '[图片] 猫')], { maxChars: 10000, maxCount: 100 });
    const meta = chunkMetaOf(chunks[0]);
    expect(Object.keys(meta).sort()).toEqual(['count', 'from', 'image', 'to', 'voice']);
    expect(meta.voice).toBe(1);
    expect(meta.image).toBe(1);
  });

  it('零媒体批不带 media 字段（老口径不变）', () => {
    const chunks = chunkMessages([msg(1, '早'), msg(2, '早呀')], { maxChars: 10000, maxCount: 100 });
    expect(chunks[0].media).toBeUndefined();
  });
});

// ---------------------------------------------------------------- 3) media

describe('parseMediaTag：群成员名恰是标签词（审计 #9）', () => {
  it('成员名叫「图片」发的语音：判成语音（修复前判成图片）', () => {
    const m = parseMediaTag('[图片] [语音 12秒] 转写内容');
    expect(m?.kind).toBe('voice');
    expect(m?.text).toBe('转写内容');
  });

  it('成员名叫「录音」发的图片：判成图片', () => {
    const m = parseMediaTag('[录音] [图片] 一只橘猫');
    expect(m?.kind).toBe('image');
    expect(m?.text).toBe('一只橘猫');
  });

  it('无回归：单层标签（成员名＝标签词但消息本身没标签层）· 真语音条 · 真标签 · 普通成员名', () => {
    expect(parseMediaTag('[图片] 一只橘猫')).toMatchObject({ kind: 'image', text: '一只橘猫' });
    expect(parseMediaTag('[语音 12秒] 你好呀')).toMatchObject({ kind: 'voice', text: '你好呀' });
    expect(parseMediaTag('[引用「你好」] [语音 12秒] 内容')).toBeNull(); // 真标签层不被当成员名吃掉
    expect(parseMediaTag('[张三] [语音 12秒] 内容')).toMatchObject({ kind: 'voice', text: '内容' });
    expect(parseMediaTag('就是一段普通文本')).toBeNull();
  });
});

// ---------------------------------------------------------------- 4) recording

function fakeRunner() {
  const started: string[] = [];
  const stopped: string[] = [];
  const resolvers: Array<(v: unknown) => void> = [];
  const runner = (spec: { cmd?: string }) => {
    let resolve!: (v: unknown) => void;
    const done = new Promise<unknown>((r) => (resolve = r));
    started.push(String(spec.cmd));
    resolvers.push(resolve);
    const h: ExternalToolHandle = {
      stop: () => {
        stopped.push(String(spec.cmd));
        resolve({ ok: false, stopped: true, code: null, stderr: '', error: null });
      },
      done: done as ExternalToolHandle['done'],
    };
    return h;
  };
  return { started, stopped, resolvers, runner };
}

const flush = async (n = 12): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

const entry = (key: string, talker: string): RecordingQueueEntry => ({
  key,
  talker,
  file: key,
  spec: () => ({ cmd: key, args: [], shell: true }),
});

afterEach(() => {
  resetRecordingQueueForTests();
  resetRecordingProcessesForTests();
  resetHeavyGateForTests();
  setRecordingRunnerForTests(null);
  setRecordingQueueSleepForTests(null);
});

describe('cancelRecordingTasksOfTalker：删人时把该人的录音任务清干净（审计 #1）', () => {
  it('在跑的那条被停、排队的移出，别人的任务一条不动', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    setRecordingQueueSleepForTests(() => new Promise((r) => setTimeout(r, 0)));
    // A 先跑一条、排队一条；B 排队一条（泵是全局串行：只有第一条会起进程）
    tryAcquireHeavy('portrait'); // 占住重进程闸门：三条都先待着，便于构造确定态
    enqueueRecordingTask(entry('a1', 'A'));
    enqueueRecordingTask(entry('a2', 'A'));
    enqueueRecordingTask(entry('b1', 'B'));
    await flush();
    releaseHeavy('portrait'); // 放闸，让 a1 起进程
    await flush();
    expect(f.started).toEqual(['a1']);
    expect(isRecordingRunning('a1')).toBe(true); // 路径键 = sidecar 路径，这里 file=a1
    expect(recordingQueuePosition('a2')).toBe(1);

    const r = cancelRecordingTasksOfTalker('A'); // 不给 dataRoot：走直接杀（写不了控制文件）
    expect(r).toEqual({ stopped: 1, dequeued: 1 });
    expect(f.stopped).toEqual(['a1']); // 在跑的那条收到停止
    expect(isRecordingQueued('a2')).toBe(false); // A 的排队项被移出
    // B 不受影响：闸已放开，它会照常起进程（在队里等着、或已经在跑，二者都算活着）
    await flush();
    expect(isRecordingQueued('b1') || isRecordingRunning('b1')).toBe(true);
    expect(f.stopped).toEqual(['a1']); // 没有多停任何东西
    expect(runningRecordingItems().some((x) => x.talker === 'A')).toBe(false); // 收尾后账上没 A
    expect(queuedRecordingItems().some((q) => q.talker === 'A')).toBe(false);
  });

  it('该人没有任务时是干净的 no-op', () => {
    expect(cancelRecordingTasksOfTalker('查无此人')).toEqual({ stopped: 0, dequeued: 0 });
  });

  it('空 talker 直接返回，不误伤全队列', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    enqueueRecordingTask(entry('x1', 'X'));
    await flush();
    expect(cancelRecordingTasksOfTalker('')).toEqual({ stopped: 0, dequeued: 0 });
    expect(isRecordingRunning('x1')).toBe(true);
  });
});
