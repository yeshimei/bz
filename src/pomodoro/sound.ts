/**
 * 番茄钟提示音（ticket 29）：Web Audio 蜂鸣，零外部依赖。
 * 专注结束 = 低音 220Hz × 3 响；休息结束 = 高音 440Hz × 2 响。
 * 无 AudioContext（非浏览器）静默降级。移动端「开始」按钮即用户手势，满足 iOS 音频约束。
 */
export type SoundKind = 'focus-end' | 'break-end';

export function playSound(kind: SoundKind): void {
  const w = (typeof window !== 'undefined' ? window : globalThis) as any;
  const AC = w.AudioContext || w.webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC();
    const freq = kind === 'focus-end' ? 220 : 440;
    const times = kind === 'focus-end' ? 3 : 2;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }
    // 播完后关闭上下文释放资源
    const ctxRef = ctx;
    setTimeout(() => {
      void ctxRef.close();
    }, times * 350 + 200);
  } catch (e) {
    /* 音频不可用时静默 */
  }
}
