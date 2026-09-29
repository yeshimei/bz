// @vitest-environment node
/**
 * 录音处理队列测试（ADR-0218 决策 5/7）：全局一条串行、出队才组装 spec / 才判 prepare、
 * 移出队列、清空队列（不影响在跑的那条）、等闸门（画谱在跑时不启动）、抢占待命进程。
 * 纯逻辑层：进程壳 / 队列 sleep 都注入假件，不真起进程、不碰真实数据根。
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  clearRecordingQueue,
  dequeueRecordingTask,
  enqueueRecordingTask,
  isRecordingQueued,
  queuedRecordingCount,
  queuedRecordingItems,
  recordingQueuePosition,
  resetRecordingQueueForTests,
  resetRecordingProcessesForTests,
  runningRecordingItems,
  setRecordingQueueSleepForTests,
  setRecordingRunnerForTests,
  type RecordingQueueEntry,
} from '../../src/people/recording';
import { releaseHeavy, resetHeavyGateForTests, setHeavyPortraitBusy, setHeavyPreemptHandler, tryAcquireHeavy } from '../../src/people/heavy-gate';
import type { ExternalToolHandle } from '../../src/core/external-tool';

/** 让出若干轮宏任务（pump 的等待循环走 setTimeout，必须用宏任务推进） */
const flush = async (n = 8): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

function fakeRunner() {
  const started: string[] = [];
  const resolvers: Array<(v: unknown) => void> = [];
  const runner = (spec: { cmd?: string }) => {
    let resolve!: (v: unknown) => void;
    const done = new Promise<unknown>((r) => (resolve = r));
    started.push(String(spec.cmd));
    resolvers.push(resolve);
    const h: ExternalToolHandle = {
      stop: () => resolve({ ok: false, stopped: true, code: null, stderr: '', error: null }),
      done: done as ExternalToolHandle['done'],
    };
    return h;
  };
  return { started, resolvers, runner };
}

const entry = (key: string, over?: Partial<RecordingQueueEntry>): RecordingQueueEntry => ({
  key,
  talker: '大琳',
  file: key,
  spec: () => ({ cmd: key, args: [], shell: true }),
  ...over,
});

afterEach(() => {
  resetRecordingQueueForTests();
  resetRecordingProcessesForTests();
  resetHeavyGateForTests();
  setRecordingRunnerForTests(null);
  setRecordingQueueSleepForTests(null);
});

describe('录音处理队列（ADR-0218 决策 5）', () => {
  it('全局串行：前一条跑完才起下一条', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    setRecordingQueueSleepForTests(() => new Promise((r) => setTimeout(r, 0)));
    enqueueRecordingTask(entry('a'));
    enqueueRecordingTask(entry('b'));
    await flush();
    expect(f.started).toEqual(['a']);
    expect(isRecordingQueued('b')).toBe(true);
    expect(recordingQueuePosition('b')).toBe(1);
    expect(queuedRecordingItems().map((q) => q.file)).toEqual(['b']);
    f.resolvers[0]({ ok: true, stopped: false, code: 0, stderr: '', error: null });
    await flush();
    expect(f.started).toEqual(['a', 'b']);
  });

  it('入队幂等：同 key 已在跑 / 已在队都不重复入', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    tryAcquireHeavy('portrait'); // 占住闸门：pump 停在等待，队列保持不动
    enqueueRecordingTask(entry('a'));
    enqueueRecordingTask(entry('a'));
    await flush(3);
    expect(queuedRecordingCount()).toBe(1);
    expect(f.started).toEqual([]);
  });

  it('闸门被画谱占着时不起进程；释放后才出队（prepare 也是那一刻才调）', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    setRecordingQueueSleepForTests(() => new Promise((r) => setTimeout(r, 0)));
    tryAcquireHeavy('portrait');
    let prepared = 0;
    enqueueRecordingTask(
      entry('a', {
        prepare: async () => {
          prepared++;
          return true;
        },
      }),
    );
    await flush(4);
    expect(prepared).toBe(0);
    expect(f.started).toEqual([]);
    releaseHeavy('portrait');
    await flush(6);
    expect(prepared).toBe(1);
    expect(f.started).toEqual(['a']);
  });

  it('prepare 返回 false：该条放弃、不起进程，队列继续下一条', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    setRecordingQueueSleepForTests(() => new Promise((r) => setTimeout(r, 0)));
    enqueueRecordingTask(entry('a', { prepare: async () => false }));
    enqueueRecordingTask(entry('b'));
    await flush();
    expect(f.started).toEqual(['b']);
  });

  it('只有待命 prep 进程占闸时：先请求抢占，对方释放后照常起跑', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    setRecordingQueueSleepForTests(() => new Promise((r) => setTimeout(r, 0)));
    let preempted = 0;
    setHeavyPreemptHandler(() => {
      preempted++;
      releaseHeavy('portrait'); // 模拟：协作式终结待命进程后松开闸门
    });
    tryAcquireHeavy('portrait'); // 无 busy = 待命（不是任务在跑）
    enqueueRecordingTask(entry('a'));
    await flush(10);
    expect(preempted).toBeGreaterThan(0);
    expect(f.started).toEqual(['a']);
  });

  it('画谱任务**真在跑**时一次都不抢；跑完只剩待命进程时才抢（回归：抢占不能"试过一次就锁死"）', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    setRecordingQueueSleepForTests(() => new Promise((r) => setTimeout(r, 0)));
    let preempted = 0;
    setHeavyPreemptHandler(() => {
      preempted++;
      releaseHeavy('portrait');
    });
    tryAcquireHeavy('portrait');
    setHeavyPortraitBusy(true); // 任务真在跑：不可抢占（抢了会让画谱中途断）
    enqueueRecordingTask(entry('a'));
    await flush(12);
    expect(preempted).toBe(0);
    expect(f.started).toEqual([]); // 一直在等，没起进程
    setHeavyPortraitBusy(false); // 任务跑完：只剩待命 prep 进程持闸
    await flush(12);
    // 若 latch 的是"试过"而非"成功"，这里 preempted 会停在 0、录音永久等下去（本批修过的真死锁）
    expect(preempted).toBe(1);
    expect(f.started).toEqual(['a']);
  });

  it('抢占成功后不再重发（stop 已送到，重发只堆定时器）', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    setRecordingQueueSleepForTests(() => new Promise((r) => setTimeout(r, 0)));
    let preempted = 0;
    setHeavyPreemptHandler(() => {
      preempted++;
      releaseHeavy('portrait'); // 松开后 recording 才拿得到
    });
    tryAcquireHeavy('portrait');
    enqueueRecordingTask(entry('a'));
    await flush(12);
    expect(preempted).toBe(1); // 成功一次即止
    // 再去占闸门（模拟画谱下一个任务的 prep 又起来），抢占应重新计一次而非沿用旧 latch
    f.resolvers[0]({ ok: true, stopped: false, code: 0, stderr: '', error: null });
    await flush(6);
    tryAcquireHeavy('portrait');
    enqueueRecordingTask(entry('b'));
    await flush(12);
    expect(preempted).toBe(2);
    expect(f.started).toEqual(['a', 'b']);
  });

  it('移出队列：不再启动；清空队列：等待中全清，在跑的那条不受影响', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    setRecordingQueueSleepForTests(() => new Promise((r) => setTimeout(r, 0)));
    enqueueRecordingTask(entry('a'));
    await flush();
    expect(f.started).toEqual(['a']);
    enqueueRecordingTask(entry('b'));
    enqueueRecordingTask(entry('c'));
    await flush(2);
    expect(dequeueRecordingTask('b')).toBe(true);
    expect(dequeueRecordingTask('b')).toBe(false); // 已移出
    expect(clearRecordingQueue()).toBe(1); // 只剩 c
    await flush(3);
    expect(f.started).toEqual(['a']); // c 没被启动
    expect(runningRecordingItems().map((i) => i.file)).toEqual(['a']); // 在跑的没被清
    expect(queuedRecordingCount()).toBe(0);
  });

  it('spec 也在出队时才组装（入队时闸门被占 → spec 未调用）', async () => {
    const f = fakeRunner();
    setRecordingRunnerForTests(f.runner);
    setRecordingQueueSleepForTests(() => new Promise((r) => setTimeout(r, 0)));
    let specCalls = 0;
    tryAcquireHeavy('portrait');
    enqueueRecordingTask(
      entry('a', {
        spec: () => {
          specCalls++;
          return { cmd: 'a', args: [], shell: true };
        },
      }),
    );
    await flush(3);
    expect(specCalls).toBe(0);
    releaseHeavy('portrait');
    await flush(6);
    expect(specCalls).toBe(1);
  });
});
