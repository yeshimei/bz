// @vitest-environment node
/**
 * 番茄钟提示音测试（ticket 29）：Web Audio 蜂鸣——专注结束低音 3 响、休息结束高音 2 响。
 * AudioContext mock 断言调用（无 AudioContext 环境静默降级）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { playSound } from '../../src/pomodoro/sound';

class FakeOscillator {
  type = '';
  frequency = { value: 0 };
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

afterEach(() => {
  delete (globalThis as any).AudioContext;
  delete (globalThis as any).webkitAudioContext;
});

describe('playSound', () => {
  it('专注结束：低音 3 响（220Hz × 3 个 oscillator）', () => {
    const ctx = mockAudio();
    playSound('focus-end');
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
    const osc = ctx.createOscillator.mock.results[0].value as FakeOscillator;
    expect(osc.frequency.value).toBe(220);
  });

  it('休息结束：高音 2 响（440Hz × 2 个 oscillator）', () => {
    const ctx = mockAudio();
    playSound('break-end');
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    const osc = ctx.createOscillator.mock.results[0].value as FakeOscillator;
    expect(osc.frequency.value).toBe(440);
  });

  it('无 AudioContext（非浏览器环境）静默不抛', () => {
    expect(() => playSound('focus-end')).not.toThrow();
    expect(() => playSound('break-end')).not.toThrow();
  });
});
