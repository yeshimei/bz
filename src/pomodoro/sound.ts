/**
 * 番茄钟提示音（ticket 29 修订 2026-08-10）：阶段开始提示声，零外部依赖。
 * 专注开始 = 高音 880Hz 一声；短休开始 = 中音 523Hz 一声；长休开始 = 低音 392Hz 一声。
 * 听声即知当前阶段（自动循环下无需打开弹窗）。无 AudioContext（非浏览器）静默降级。
 * 移动端「开始」按钮即用户手势，满足 iOS 音频约束。
 */
export type SoundKind = 'focus-start' | 'short-break-start' | 'long-break-start';

const SOUND_CONFIG: Record<SoundKind, { freq: number; dur: number }> = {
  'focus-start': { freq: 880, dur: 0.25 },
  'short-break-start': { freq: 523, dur: 0.3 },
  'long-break-start': { freq: 392, dur: 0.45 },
};

export function playSound(kind: SoundKind): void {
  const w = (typeof window !== 'undefined' ? window : globalThis) as any;
  const AC = w.AudioContext || w.webkitAudioContext;
  if (!AC) return;
  try {
    const cfg = SOUND_CONFIG[kind];
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = cfg.freq;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + cfg.dur + 0.02);
    // 播完关闭上下文释放资源
    const ctxRef = ctx;
    setTimeout(() => {
      void ctxRef.close();
    }, cfg.dur * 1000 + 300);
  } catch (e) {
    /* 音频不可用时静默 */
  }
}
