// @vitest-environment node
/**
 * 加密保险箱预览层稳定性测试：预览生成永不挂起（"无限循环"回归防护）。
 * 空 src 立即返回 null；从不 resolve 的加载 Promise 会在超时后被拒绝——加密主流程绝不因预览卡死。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { compressImage, videoFrame, withTimeout, PREVIEW_TIMEOUT_MS } from '../../src/encrypt/preview';

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout 超时保护', () => {
  it('从不 resolve 的 Promise 在超时后被拒绝（不无限等待）', async () => {
    vi.useFakeTimers();
    const never = new Promise<void>(() => {});
    const guarded = withTimeout(never, PREVIEW_TIMEOUT_MS, '测试资源');
    let settled = false;
    guarded.catch(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(PREVIEW_TIMEOUT_MS);
    expect(settled).toBe(true);
  });

  it('按时 resolve 的 Promise 正常通过', async () => {
    vi.useFakeTimers();
    const ok = Promise.resolve();
    const result = await withTimeout(ok, PREVIEW_TIMEOUT_MS, '测试资源');
    expect(result).toBeUndefined();
  });
});

describe('预览产物生成不挂起', () => {
  it('空 src：compressImage 立即返回 null（无论 canvas 是否可用）', async () => {
    const r = await compressImage('', 960, 0.7);
    expect(r).toBeNull();
  });

  it('空 src：videoFrame 立即返回 null', async () => {
    const r = await videoFrame('', 960, 0.7);
    expect(r).toBeNull();
  });

  it('无效 src 在测试环境（无 canvas 实现）返回 null 而非抛错/挂起', async () => {
    const imgR = await compressImage('bad-src', 960, 0.7);
    const vidR = await videoFrame('bad-src', 960, 0.7);
    expect(imgR).toBeNull();
    expect(vidR).toBeNull();
  });
});