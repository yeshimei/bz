/**
 * 番茄钟提示音（ticket 29 修订 2026-08-1x）：阶段开始/暂停提示声，零外部依赖。
 * 专注开始 = 高音 880Hz 一声；短休开始 = 中音 523Hz 一声；长休开始 = 低音 392Hz 一声；暂停 = 中低音 440Hz 一声。
 * 听声即知状态（自动循环下无需打开弹窗）。无 AudioContext（非浏览器）静默降级。
 * 移动端「开始」按钮即用户手势，满足 iOS 音频约束。音量峰值 0.8（2026-08-1x 翻倍：默认太小）。
 *
 * 2026-09-23 特效批新增三味（用户拍板采纳 10/11/12）：
 *  - ceremony   收工钟声：基频 + 三泛音（1.5 / 2 / 2.76 倍）分层衰减，把「一声 beep」换成「一记钟」；
 *  - tick       倒数滴答：最后十秒每秒一记极轻短音（由 ui.render 驱动，随提示音总开关）；
 *  - transition 阶段过渡：低频下扫铺底，与落定音同响——原来的单音起落不再「生硬」。
 * 三者共用 spec 结构（可选 partials / sweepTo / type），老四味行为逐字不变。
 */
export type SoundKind =
  | 'focus-start'
  | 'short-break-start'
  | 'long-break-start'
  | 'pause'
  | 'ceremony'
  | 'tick'
  | 'transition';

/** 泛音：相对基频的倍率、增益、衰减时长系数（高泛音衰减快＝钟的金属感来源） */
interface Partial {
  ratio: number;
  gain: number;
  decay: number;
}

interface SoundSpec {
  freq: number;
  dur: number;
  type?: OscillatorType;
  /** 频率下扫终点（过渡音的低频包络） */
  sweepTo?: number;
  /** 泛音表；缺省 = 单音（老四味口径） */
  partials?: ReadonlyArray<Partial>;
}

const SOUND_CONFIG: Record<SoundKind, SoundSpec> = {
  'focus-start': { freq: 880, dur: 0.25 },
  'short-break-start': { freq: 523, dur: 0.3 },
  'long-break-start': { freq: 392, dur: 0.45 },
  pause: { freq: 440, dur: 0.2 },
  // 钟：D5 基频 + 五度 / 八度 / 十二度泛音，逐层变轻变短——衰减尾巴是「钟」与「beep」的分界
  ceremony: {
    freq: 587.33,
    dur: 1.35,
    partials: [
      { ratio: 1, gain: 1, decay: 1 },
      { ratio: 1.5, gain: 0.42, decay: 0.72 },
      { ratio: 2, gain: 0.22, decay: 0.5 },
      { ratio: 2.76, gain: 0.12, decay: 0.34 },
    ],
  },
  // 滴答：短促、窄、不抢戏（音量由 tick 自身的 dur 与三角波决定，不另设衰减）
  tick: { freq: 1900, dur: 0.055, type: 'triangle' },
  // 过渡：210 → 120Hz 下扫，像一口气沉下去
  transition: { freq: 210, dur: 0.5, sweepTo: 120 },
};

export function playSound(kind: SoundKind, volume = 100): void {
  const w = (typeof window !== 'undefined' ? window : globalThis) as any;
  const AC = w.AudioContext || w.webkitAudioContext;
  if (!AC) return;
  // 真静音：volume <= 0 直接不播（不建上下文、不振荡器）
  if (volume <= 0) return;
  try {
    const cfg = SOUND_CONFIG[kind];
    const ctx = new AC();
    // 浏览器自动播放策略兜底：上下文被挂起（如后台 tick 完成的非手势路径）先 resume 再播
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') void ctx.resume();
    // 音量 0-100（默认最大）：钳制 1-100（0 已在上方真静音短路）；峰值 0.8（翻倍）
    const peak = 0.8 * (Math.max(1, Math.min(100, volume)) / 100);
    const t = ctx.currentTime;
    const partials = cfg.partials ?? [{ ratio: 1, gain: 1, decay: 1 }];
    let tail = cfg.dur;
    for (const pt of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cfg.type ?? 'sine';
      const base = cfg.freq * pt.ratio;
      osc.frequency.value = base;
      if (cfg.sweepTo) osc.frequency.exponentialRampToValueAtTime(cfg.sweepTo * pt.ratio, t + cfg.dur * 0.9);
      const dur = cfg.dur * pt.decay;
      const amp = Math.max(0.001, peak * pt.gain);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(amp, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      if (dur > tail) tail = dur;
    }
    // 播完关闭上下文释放资源
    const ctxRef = ctx;
    setTimeout(() => {
      void ctxRef.close();
    }, tail * 1000 + 300);
  } catch (e) {
    /* 音频不可用时静默 */
  }
}
