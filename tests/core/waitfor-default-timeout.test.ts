// @vitest-environment node
/**
 * waitFor 默认超时守卫（tests/setup.ts）。
 *
 * vitest 4 的 `vi.waitFor` 默认 `timeout` 是硬编码 1000ms 且无全局配置键，全仓 1568 处调用
 * 都没传 timeout——并发跑测试时一次正常的 DOM 刷新被 CPU 争抢拖过 1s 就是假红。
 * setup.ts 把默认抬到 5s（与 testTimeout 20s 同源）。本文件把这条约定焊住：
 * 一旦升级 vitest / 改动 setup 把默认打回 1s，这里立刻红，而不是在全量里以「偶发失败」的形式出现。
 */
import { describe, expect, it, vi } from 'vitest';

describe('waitFor 默认超时（测试基建守卫）', () => {
  it('默认预算足以覆盖 1s 以上的慢响应（1.4s 后才满足条件仍通过）', async () => {
    const t0 = Date.now();
    await vi.waitFor(() => {
      if (Date.now() - t0 < 1400) throw new Error('not yet');
    });
    expect(Date.now() - t0).toBeGreaterThan(1100);
  });

  it('显式 timeout（数字简写）不被默认值覆盖', async () => {
    const t0 = Date.now();
    await expect(vi.waitFor(() => { throw new Error('never'); }, 400)).rejects.toThrow('never');
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it('显式 timeout（对象形式）不被默认值覆盖', async () => {
    const t0 = Date.now();
    await expect(vi.waitFor(() => { throw new Error('nope'); }, { timeout: 300 })).rejects.toThrow('nope');
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});
