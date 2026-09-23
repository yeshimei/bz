// @vitest-environment node
/**
 * 番茄钟提示音测试（ticket 29 修订 2026-08-10）：阶段开始提示声——
 * 专注开始 880Hz 一声 / 短休开始 523Hz 一声 / 长休开始 392Hz 一声（听声即知状态，无需打开弹窗）。
 * AudioContext mock 断言调用（无 AudioContext 环境静默降级）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { playSound } from '../../src/pomodoro/sound';

class FakeOscillator {
  type = '';
  frequency = { value: 0, exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class FakeGain {
  gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn();
}
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator = vi.fn(() => new FakeOscillator());
  createGain = vi.fn(() => new FakeGain());
  close = vi.fn(() => Promise.resolve());
}

function mockAudio(): FakeAudioContext {
  const ctx = new FakeAudioContext();
  (globalThis as any).AudioContext = class {
    currentTime = 0;
    destination = {};
    createOscillator = ctx.createOscillator;
    createGain = ctx.createGain;
    close = ctx.close;
  };
  return ctx;
}

/** 挂起态上下文 mock：state='suspended' + resume 间谍（自动播放策略场景） */
function mockSuspendedAudio(): FakeAudioContext {
  const ctx: any = new FakeAudioContext();
  ctx.state = 'suspended';
  ctx.resume = vi.fn(() => Promise.resolve());
  (globalThis as any).AudioContext = class {
    currentTime = 0;
    destination = {};
    createOscillator = ctx.createOscillator;
    createGain = ctx.createGain;
    close = ctx.close;
    state = 'suspended';
    resume = ctx.resume;
  };
  return ctx;
}

afterEach(() => {
  delete (globalThis as any).AudioContext;
  delete (globalThis as any).webkitAudioContext;
});

describe('playSound（阶段开始提示声，各一声）', () => {
  it('专注开始：高音 880Hz 一声', () => {
    const ctx = mockAudio();
    playSound('focus-start');
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator.mock.results[0].value.frequency.value).toBe(880);
  });

  it('短休开始：中音 523Hz 一声', () => {
    const ctx = mockAudio();
    playSound('short-break-start');
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator.mock.results[0].value.frequency.value).toBe(523);
  });

  it('长休开始：低音 392Hz 一声', () => {
    const ctx = mockAudio();
    playSound('long-break-start');
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator.mock.results[0].value.frequency.value).toBe(392);
  });

  it('暂停：中低音 440Hz 一声', () => {
    const ctx = mockAudio();
    playSound('pause');
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator.mock.results[0].value.frequency.value).toBe(440);
  });

  it('无 AudioContext（非浏览器环境）静默不抛', () => {
    expect(() => playSound('focus-start')).not.toThrow();
    expect(() => playSound('short-break-start')).not.toThrow();
    expect(() => playSound('long-break-start')).not.toThrow();
    expect(() => playSound('pause')).not.toThrow();
    expect(() => playSound('ceremony')).not.toThrow();
    expect(() => playSound('tick')).not.toThrow();
    expect(() => playSound('transition')).not.toThrow();
  });

  it('收工钟声：基频 + 三泛音各一枚振荡器，泛音逐层变轻', () => {
    const ctx = mockAudio();
    playSound('ceremony');
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4);
    const freqs = ctx.createOscillator.mock.results.map((r) => r.value.frequency.value);
    expect(freqs[0]).toBeCloseTo(587.33, 2); // D5 基频
    expect(freqs[1]).toBeCloseTo(587.33 * 1.5, 2); // 五度
    const peakOf = (i: number) => (ctx.createGain.mock.results[i].value as FakeGain).gain.exponentialRampToValueAtTime.mock.calls[0][0];
    expect(peakOf(0)).toBeGreaterThan(peakOf(1));
    expect(peakOf(1)).toBeGreaterThan(peakOf(3));
  });

  it('倒数滴答：1900Hz 三角波一声（短促不抢戏）', () => {
    const ctx = mockAudio();
    playSound('tick');
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator.mock.results[0].value.frequency.value).toBe(1900);
    expect(ctx.createOscillator.mock.results[0].value.type).toBe('triangle');
  });

  it('阶段过渡：低频下扫 210 → 120Hz', () => {
    const ctx = mockAudio();
    playSound('transition');
    const freq = (ctx.createOscillator.mock.results[0].value as any).frequency;
    expect(freq.value).toBe(210);
    expect(freq.exponentialRampToValueAtTime).toHaveBeenCalledWith(120, expect.any(Number));
  });

  it('音量参数：50 → 峰值 0.4（0.8×50%，翻倍后）', () => {
    const ctx = mockAudio();
    playSound('focus-start', 50);
    const gain = ctx.createGain.mock.results[0].value as FakeGain;
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.4, 0.02);
  });

  it('音量缺省 → 峰值 0.8（默认最大，2026-08-1x 翻倍）', () => {
    const ctx = mockAudio();
    playSound('short-break-start');
    const gain = ctx.createGain.mock.results[0].value as FakeGain;
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.8, 0.02);
  });

  it('音量越界钳制：150 → 0.8', () => {
    const ctx = mockAudio();
    playSound('focus-start', 150);
    expect((ctx.createGain.mock.results[0].value as FakeGain).gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.8, 0.02);
  });

  it('音量 <=0 真静音：不建振荡器直接短路（P2，原近静音峰值行为废弃）', () => {
    const ctx = mockAudio();
    playSound('focus-start', 0);
    playSound('pause', -5);
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    expect(ctx.createGain).not.toHaveBeenCalled();
  });

  it('ctx.state=suspended → 播放前先 resume（P2 自动播放策略兜底）', () => {
    const ctx = mockSuspendedAudio();
    playSound('focus-start');
    expect((ctx as any).resume).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1); // resume 后正常出声
  });

  it('ctx 未挂起（无 state 字段）→ 不调用 resume，正常播放', () => {
    const ctx = mockAudio();
    playSound('short-break-start');
    expect((ctx as any).resume).toBeUndefined();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });
});
