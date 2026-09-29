// @vitest-environment node
/**
 * 重进程闸门测试（ADR-0218）：互斥与同身份重入、抢占判定（只有"仅待命进程占闸"才可抢）、
 * 等待与放弃、订阅通知。纯状态机，无 DOM、不起进程。
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  canAcquireHeavy,
  heavyGateCanPreempt,
  heavyGateDepth,
  heavyGateHolder,
  heavyGatePortraitBusy,
  preemptHeavyStandby,
  releaseHeavy,
  resetHeavyGateForTests,
  setHeavyPortraitBusy,
  setHeavyPreemptHandler,
  subscribeHeavy,
  tryAcquireHeavy,
  waitHeavyGate,
} from '../../src/people/heavy-gate';

afterEach(() => resetHeavyGateForTests());

describe('重进程闸门（ADR-0218）', () => {
  it('互斥 + 同身份可重入（计数归零才真松手）', () => {
    expect(heavyGateHolder()).toBeNull();
    expect(tryAcquireHeavy('portrait')).toBe(true);
    expect(heavyGateHolder()).toBe('portrait');
    expect(tryAcquireHeavy('portrait')).toBe(true); // 画谱侧：runJob 与 prep 会话各持一份
    expect(heavyGateDepth()).toBe(2);
    expect(tryAcquireHeavy('recording')).toBe(false); // 异身份互斥
    expect(canAcquireHeavy('recording')).toBe(false);
    releaseHeavy('portrait');
    expect(heavyGateHolder()).toBe('portrait'); // 还有一份（prep 待命进程）
    releaseHeavy('portrait');
    expect(heavyGateHolder()).toBeNull();
    expect(tryAcquireHeavy('recording')).toBe(true);
  });

  it('释放未持有的身份 = no-op（不误松别人的闸）', () => {
    tryAcquireHeavy('recording');
    releaseHeavy('portrait');
    expect(heavyGateHolder()).toBe('recording');
    expect(heavyGateDepth()).toBe(1);
  });

  it('抢占：只有「仅待命进程占闸」时可抢；任务在跑 / 闸门空着都不抢', () => {
    let preempted = 0;
    setHeavyPreemptHandler(() => preempted++);
    tryAcquireHeavy('portrait');
    setHeavyPortraitBusy(true); // 任务 running
    expect(heavyGatePortraitBusy()).toBe(true);
    expect(heavyGateCanPreempt()).toBe(false);
    expect(preemptHeavyStandby()).toBe(false);
    setHeavyPortraitBusy(false); // 任务出 running → 只剩待命进程
    expect(heavyGateCanPreempt()).toBe(true);
    expect(preemptHeavyStandby()).toBe(true);
    expect(preempted).toBe(1);
    releaseHeavy('portrait');
    setHeavyPortraitBusy(false);
    expect(heavyGateCanPreempt()).toBe(false); // 闸门空着没什么可抢
  });

  it('未注册抢占回调时 preempt 返回 false（调用方继续等）', () => {
    tryAcquireHeavy('portrait');
    expect(heavyGateCanPreempt()).toBe(true);
    expect(preemptHeavyStandby()).toBe(false);
  });

  it('等待：能取就立刻取；取不到轮询等到释放；keepWaiting=false 立即放弃且不空转', async () => {
    const sleeps: number[] = [];
    const sleep = async (ms: number): Promise<void> => {
      sleeps.push(ms);
    };
    tryAcquireHeavy('recording');
    expect(await waitHeavyGate('portrait', () => false, sleep)).toBe(false);
    expect(sleeps).toHaveLength(0); // 放弃时不睡一觉再说
    let n = 0;
    const sleep2 = async (): Promise<void> => {
      n++;
      if (n === 2) releaseHeavy('recording');
    };
    expect(await waitHeavyGate('portrait', undefined, sleep2)).toBe(true);
    expect(heavyGateHolder()).toBe('portrait');
  });

  it('订阅：持有 / busy 翻转 / 释放都通知；退订后不再收', () => {
    const seen: string[] = [];
    const off = subscribeHeavy(() => seen.push(`${heavyGateHolder()}:${heavyGatePortraitBusy()}`));
    tryAcquireHeavy('portrait');
    setHeavyPortraitBusy(true);
    releaseHeavy('portrait');
    expect(seen).toEqual(['portrait:false', 'portrait:true', 'null:false']);
    off();
    tryAcquireHeavy('recording');
    expect(seen).toHaveLength(3);
  });
});
