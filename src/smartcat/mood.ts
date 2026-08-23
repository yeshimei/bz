/**
 * 心情系统重构（grilling 拍板：彻底对齐社区 PAD 三维模型）
 * 三层：瞬时情绪（currentEmotion，事件/记忆标注）→ 心情（PAD 三维连续，
 * 60s 衰减 + 人格调制 + 互动影响——「持续的潮」）→ 人格（PersonalityGrowth，
 * 反思驱动主 + 互动驱动辅——「海底地形」）。
 *
 * 关键变化（相对原 SmartCatPluginMood.js）：
 *  1. 8 维 → PAD 三维（pleasure/arousal/dominance，0-100）；
 *  2. calculateCompositeMood 断线缺陷解除——currentMood 由 PAD 原型最近邻实时算出，
 *     不再恒为持久化 lastMood（铁律 4 原缺陷，本轮用户拍板解除）；
 *  3. EmotionalMemory 类删除——情感记忆并入记忆流（记忆条目 emotion 字段 + importance）；
 *  4. PersonalityGrowth 接通：反思驱动（applyReflectionInsights）+ 互动驱动（原
 *     developBasedOnInteraction 接线）；
 *  5. 存储全部收敛进 smartcat.json（data.mood / data.personalityGrowth）。
 */
import type { App } from 'obsidian';
import type { PadDimensions, SmartCatData } from './types';
import { characterTransition, trustUpdate, characterFromExperience, TRUST_CAP } from './character';
import { buildRhythmProfile } from './rhythm';
import { emotionToVAD } from './cognitive';

/** 5 档离散心情（显示层；PAD 原型最近邻判档） */
export const MOOD_MAP: Record<string, { emoji: string; state: string; prototype: [number, number, number] }> = {
  excellent: { emoji: '😻', state: '超开心', prototype: [85, 72, 60] },
  good: { emoji: '😸', state: '心情好', prototype: [70, 62, 55] },
  neutral: { emoji: '😼', state: '平常心', prototype: [50, 50, 50] },
  low: { emoji: '😿', state: '小低落', prototype: [30, 38, 45] },
  poor: { emoji: '🙀', state: '不开心', prototype: [18, 22, 38] },
};

/** PAD 原型顺序（判档用） */
const MOOD_KEYS = ['excellent', 'good', 'neutral', 'low', 'poor'] as const;

/** PAD 三维 → 5 档（原型最近邻，纯函数；面板/测试无 MoodSystem 实例时复用，ticket 071） */
export function moodLevelFromPad(pad: { pleasure: number; arousal: number; dominance: number }): string {
  let best: string = 'neutral';
  let bestDist = Infinity;
  for (const key of MOOD_KEYS) {
    const [ep, ea, ed] = MOOD_MAP[key].prototype;
    const dist = Math.sqrt((pad.pleasure - ep) ** 2 + (pad.arousal - ea) ** 2 + (pad.dominance - ed) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      best = key;
    }
  }
  return best;
}

/**
 * 温和共振增益（ADR-0025，用户拍板推翻「情绪不直接改写 PAD」）：
 * 观察/聊天情绪 → PAD 小步差量——负面略强于正面（共情），calm/neutral 趋近 0（不误动心情）。
 * 差量随后走既有 updatePad：人格乘数/抵抗力 + 60s 指数衰减回基线 50，不会成为用户情绪镜子。
 */
export const EMOTION_RESONANCE_GAIN = { positive: 4, negative: 6, arousal: 2.5, dominance: 2 } as const;

/** 情绪 → PAD 差量（纯函数；测试友好）：
 *  pleasure = 愉悦度（valence 距中性 0.35 起算，负面增益 6 > 正面 4）；
 *  arousal = (唤醒 − 0.4) × 5（calm/sad/sleepy 稍降、excited/anxious 稍升）；
 *  dominance = (支配 − 0.5) × 4（低落类情绪连带支配感下降）。 */
export function emotionResonanceDelta(emotion: string): { pleasure: number; arousal: number; dominance: number } {
  const vad = emotionToVAD(emotion);
  const p = vad.valence >= 0
    ? Math.max(0, vad.valence - 0.35) * EMOTION_RESONANCE_GAIN.positive
    : Math.min(0, vad.valence + 0.25) * EMOTION_RESONANCE_GAIN.negative;
  const a = (vad.arousal - 0.4) * 5;
  const d = (vad.dominance - 0.5) * 4;
  const r = (x: number) => Math.round(x * 10) / 10;
  return { pleasure: r(p), arousal: r(a), dominance: r(d) };
}

export class MoodSystem {
  app: App;
  dataProvider: () => SmartCatData;
  dataSaver: (data: SmartCatData) => Promise<void>;
  /** PAD 三维（内存镜像 data.mood.pad） */
  pad: PadDimensions;
  /** 5 档显示位（由 PAD 原型最近邻实时算出，解除断线） */
  currentMood: string;
  moodHistory: any[] = [];
  lastInteractionTime = Date.now();
  private decayTimer: ReturnType<typeof setInterval> | null = null;

  constructor(app: App, dataProvider: () => SmartCatData, dataSaver: (data: SmartCatData) => Promise<void>) {
    this.app = app;
    this.dataProvider = dataProvider;
    this.dataSaver = dataSaver;
    this.pad = { ...this.dataProvider().mood.pad };
    this.currentMood = this.computeMoodLevel();
    this.init();
  }

  init(): void {
    this.ensureMoodClassApplied();
    this.startAutoDecay();
  }

  // ---------------- PAD 更新 ----------------

  /** 更新 PAD 某轴（性格调制：MATE traits → 乘数；clamp 0-100；变化微小不落盘） */
  updatePad(axis: 'pleasure' | 'arousal' | 'dominance', change: number, reason = ''): void {
    const character = this.getCharacterModulators();
    const multiplier = character.padMultipliers[axis] || 1.0;
    let adjusted = change * multiplier;
    // 负向抵抗力（从性格 traits 推导：乐观/情绪稳定越抗跌）
    if (change < 0) {
      const resistance = character.resistance[axis] || 1.0;
      adjusted = change * resistance;
    }
    const old = this.pad[axis];
    let next = old + adjusted;
    next = Math.max(0, Math.min(100, next));
    if (Math.abs(adjusted) > 0.1 && Math.abs(next - old) < 0.1) {
      next = old > 99 ? 100 : old < 1 ? 1 : old + (adjusted > 0 ? 0.5 : -0.5);
    }
    if (Math.abs(next - old) < 0.01) return;
    this.pad[axis] = Math.round(next * 10) / 10;
    this.moodHistory.push({ axis, change, adjusted, reason, timestamp: Date.now(), oldValue: old, newValue: this.pad[axis] });
    if (this.moodHistory.length > 200) this.moodHistory = this.moodHistory.slice(-100);
    // 5 档由 PAD 实时推出（断线解除）
    this.currentMood = this.computeMoodLevel();
    if (Math.abs(adjusted) >= 1) void this.saveMoodState();
  }

  /** 注册瞬时情绪（事件/记忆标注；记录但不改写 PAD，情绪由记忆承载） */
  registerEmotion(emotion: string): void {
    const data = this.dataProvider();
    data.mood.currentEmotion = emotion;
    void this.saveMoodState();
  }

  /** 温和共振（ADR-0025）：观察/聊天情绪 → PAD 差量（走 updatePad，人格调制+衰减生效） */
  applyEmotionResonance(emotion: string): boolean {
    const deltas = emotionResonanceDelta(emotion);
    if (Math.abs(deltas.pleasure) < 0.01 && Math.abs(deltas.arousal) < 0.01 && Math.abs(deltas.dominance) < 0.01) return false;
    this.updatePad('pleasure', deltas.pleasure, 'emotion:' + emotion);
    this.updatePad('arousal', deltas.arousal, 'emotion:' + emotion);
    this.updatePad('dominance', deltas.dominance, 'emotion:' + emotion);
    return true;
  }

  /** 情绪趋势回写（ADR-0025）：declining 温和低落 / improving 温和转好 / 高波动唤醒微升 */
  applyTrendDrift(trend: { trend: 'improving' | 'stable' | 'declining'; volatility: number }): void {
    if (trend.trend === 'declining') {
      this.updatePad('pleasure', -1.5, 'trend');
      this.updatePad('dominance', -1, 'trend');
    } else if (trend.trend === 'improving') {
      this.updatePad('pleasure', 1.5, 'trend');
    }
    if (trend.volatility >= 0.5) this.updatePad('arousal', 0.8, 'trend');
  }

  /** 当前瞬时情绪（无则 null） */
  getCurrentEmotion(): string | null {
    return this.dataProvider().mood.currentEmotion || null;
  }

  // ---------------- PAD → 5 档（原型最近邻，解除原 calculateCompositeMood 断线） ----------------

  /** 计算 5 档：当前 PAD 到各原型欧氏距离，取最近档（纯函数委托） */
  computeMoodLevel(): string {
    return moodLevelFromPad(this.pad);
  }

  // ---------------- 性格调制（MATE traits → PAD，对齐 ADR-0023） ----------------

  /** 从性格系统推导 PAD 乘数/抵抗力（OCEAN+traits → 心情动力学参数）
   *  外向/多巴胺高 → 唤醒乘数高；乐观/血清素高 → 愉悦乘数高、抵抗力强；
   *  神经质/皮质醇高 → 波动放大（乘数 >1）；依赖式焦虑 → 愉悦抵抗力弱
   */
  getCharacterModulators(): { padMultipliers: Record<string, number>; resistance: Record<string, number> } {
    const g = this.dataProvider().personalityGrowth;
    const t = g.traits;
    const o = g.ocean;
    const line = (v: number) => Math.min(1.5, Math.max(0.5, 0.5 + (v - 0.5) * 1.0));
    const arousalM = line(t.dopamine) * (0.9 + o.extraversion * 0.2);
    const pleasureM = line(t.serotonin + (t.optimism - 0.5) * 0.5) * (0.9 + o.agreeableness * 0.2);
    const dominanceM = line(t.locus_control) * (0.9 + o.conscientiousness * 0.2);
    // 神经质/皮质醇 → 负向抵抗力弱（容易大起大落）
    const resistance = {
      pleasure: Math.min(1.4, Math.max(0.6, 1.0 - t.cortisol * 0.3 + t.serotonin * 0.2 + o.neuroticism * -0.3)),
      arousal: Math.min(1.4, Math.max(0.6, 1.0 - t.cortisol * 0.2 + o.neuroticism * -0.2)),
      dominance: Math.min(1.4, Math.max(0.6, 1.0 - t.anxiety * 0.3 + t.self_efficacy * 0.3)),
    };
    return {
      padMultipliers: { pleasure: pleasureM, arousal: arousalM, dominance: dominanceM },
      resistance,
    };
  }

  // ---------------- 衰减 ----------------

  /**
   * 自动衰减（60s；指数回摆向中性基线 50，2026-08-23 用户拍板生产补接线后校准）
   * 原线性 -0.02/min 向 0 无吸引子（空闲 1.7 天 pleasure 归 0），与 sim 指数回摆不一致；
   * 统一为 DECAY_LAMBDA 半衰（pleasure 10h/arousal 7h/dominance 3.5h）：增益进多少、潮汐回多少。
   */
  private static readonly BASE_PAD_ATTRACT = { pleasure: 50, arousal: 50, dominance: 50 };
  private static readonly DECAY_LAMBDA = { pleasure: 0.07, arousal: 0.10, dominance: 0.20 };
  private lastSavedPad: PadDimensions | null = null;

  startAutoDecay(): void {
    if (this.decayTimer) clearInterval(this.decayTimer);
    this.decayTimer = setInterval(() => {
      const mod = this.getCharacterModulators();
      for (const [axis, lambda] of Object.entries(MoodSystem.DECAY_LAMBDA)) {
        const multiplier = mod.padMultipliers[axis as keyof PadDimensions] || 1.0;
        // 回摆速率 ÷ 人格乘数（高 dopamine/serotonin → 回落更慢，与 updatePad 增益同侧调制）
        // dt=60s → 指数小时速率 λ（/h）折算到分钟：k=exp(−λ·dt/3600)
        const k = Math.exp(-lambda / multiplier * (60 / 3600));
        const attract = MoodSystem.BASE_PAD_ATTRACT[axis as keyof PadDimensions];
        const old = this.pad[axis as keyof PadDimensions] || 50;
        // 保留浮点精度（60s 微移 ~0.006，round 会吞掉回摆；落盘仍到 0.1 精度）
        this.pad[axis as keyof PadDimensions] = Math.max(0, Math.min(100, attract + (old - attract) * k));
      }
      // 红队 B P1-3：无事件也每 60s 全量写盘 → 改为任一轴相对上次落盘变化 ≥0.5 才写
      const lp = this.lastSavedPad;
      const dirty = !lp || (['pleasure', 'arousal', 'dominance'] as const).some((ax) => Math.abs((this.pad[ax] || 0) - (lp[ax] || 0)) >= 0.5);
      if (dirty) {
        this.lastSavedPad = { ...this.pad };
        void this.saveMoodState();
      }
    }, 60000);
  }

  stopAutoDecay(): void {
    if (this.decayTimer) {
      clearInterval(this.decayTimer);
      this.decayTimer = null;
    }
  }

  /** 持久化（{pad, lastUpdate, lastMood, currentEmotion}） */
  async saveMoodState(): Promise<void> {
    const data = this.dataProvider();
    data.mood.pad = { ...this.pad };
    data.mood.lastUpdate = Date.now();
    data.mood.lastMood = this.currentMood;
    await this.dataSaver(data);
  }

  /** 加载（24h 内合并 PAD；超时保持默认不覆写存储） */
  loadMoodState(): void {
    const data = this.dataProvider();
    const saved = data.mood;
    const hoursDiff = (Date.now() - saved.lastUpdate) / (1000 * 60 * 60);
    if (hoursDiff < 24) {
      this.pad = { ...this.pad, ...saved.pad };
    }
    this.currentMood = this.computeMoodLevel();
    this.ensureMoodClassApplied();
  }

  /** 表情类（容器挂 mood-<mood> 类） */
  ensureMoodClassApplied(): void {
    const container = document.getElementById('smart-companion-cat');
    if (!container) return;
    container.classList.remove('mood-excellent', 'mood-good', 'mood-neutral', 'mood-low', 'mood-poor');
    container.classList.add(`mood-${this.currentMood}`);
  }

  /** 当前心情 emoji（MOOD_MAP 查表） */
  getCurrentMoodEmoji(): string {
    const m = MOOD_MAP[this.currentMood];
    return m ? m.emoji : '😼';
  }

  /** 心情整体级别（MOOD_MAP key） */
  getOverallMood(): string {
    const m = MOOD_MAP[this.currentMood];
    return m ? this.currentMood : 'neutral';
  }

  /** 互动心情影响（PAD 版效果表；原 8 维 handleInteraction 语义迁移） */
  handleInteraction(type: string, intensity = 1): void {
    const effects: Record<string, Record<string, number>> = {
      pet: { pleasure: 6, arousal: 2, dominance: 1 },
      click: { arousal: 3, pleasure: 2 },
      learn: { arousal: 4, dominance: 3 },
      note_create: { pleasure: 3, dominance: 6, arousal: 3 },
      note_edit: { dominance: 6, arousal: 2, pleasure: 1 },
      note_read: { arousal: 4, pleasure: 2, dominance: 1 },
    };
    const eff = effects[type];
    if (eff) {
      for (const [axis, change] of Object.entries(eff)) {
        if (axis === 'pleasure' || axis === 'arousal' || axis === 'dominance') {
          this.updatePad(axis, change * intensity, type);
        }
      }
    }
  }

  dispose(): void {
    this.stopAutoDecay();
  }
}

/**
 * 性格成长（对齐 MATE ADR-0023：OCEAN 种子 + 30 特质 + relationship 张量 + 周统计）
 * 驱动源三路：character_transition（每条互动微移）、character_from_experience（周统计深更新）、
 * applyReflectionInsights（反思洞察 → existential 群组成长）。全部经 character.ts 纯函数。
 */
export class PersonalityGrowth {
  dataProvider: () => SmartCatData;
  dataSaver: (data: SmartCatData) => Promise<void>;

  constructor(dataProvider: () => SmartCatData, dataSaver: (data: SmartCatData) => Promise<void>) {
    this.dataProvider = dataProvider;
    this.dataSaver = dataSaver;
  }

  get traits(): any {
    return this.dataProvider().personalityGrowth.traits;
  }

  /** 互动驱动（MATE character_transition：δ=δbase×Σ|eᵢ|×近因；softUpdate 饱和）
   *  trustQuality：温暖互动的信任增益质量系数（默认 0.5；写日记/闪念以轻质量 0.15 计入，
   *  ADR-0024 产品决策——不聊天时陪伴也能在「共享生活」中生长） */
  async developBasedOnInteraction(interactionType: string, intensity: number, emotionIntensity = 0, trustQuality = 0.5): Promise<void> {
    const data = this.dataProvider();
    const g = data.personalityGrowth;
    const I = Math.max(emotionIntensity, intensity * 0.2);
    g.traits = characterTransition(g.traits, { emotionIntensity: I, trust: g.relationship.trust });
    // 互动类型有情绪价（pet/learn 温暖；note 专注）
    if (interactionType === 'pet' || interactionType === 'learn') {
      g.traits = characterTransition(g.traits, { emotionIntensity: 0.2, trust: g.relationship.trust });
    }
    // ADR-0025 修「warm 恒真」：温暖=pet/learn/talk/diary/flash（写日记/闪念轻质量温暖），
    // 中性=click/note_*（不升温不侵蚀，原表达式 `pet || !== click` 使侵蚀分支成为死代码）
    const warm = interactionType === 'pet' || interactionType === 'learn' || interactionType === 'talk' || interactionType === 'diary' || interactionType === 'flash';
    const neutral = interactionType === 'click' || interactionType.startsWith('note_');
    g.relationship.trust = trustUpdate(g.relationship.trust, { warm, neutral, quality: trustQuality, trustCap: TRUST_CAP ?? undefined });
    // 活跃时段统计（按当时钟点滚一个众数近似）
    this.tickBehaviorStats(interactionType);
    g.growthHistory.push({
      timestamp: Date.now(), interactionType, intensity, source: 'interaction', traitsBefore: { ...g.traits },
    });
    this.trimHistory();
    g.lastSave = Date.now();
    await this.dataSaver(data);
  }

  /** 周统计深更新（MATE character_from_experience：δ≤0.01，对积累的 behaviorStats 折算） */
  async applyWeeklyExperience(): Promise<void> {
    const data = this.dataProvider();
    const g = data.personalityGrowth;
    const s = g.behaviorStats;
    g.traits = characterFromExperience(g.traits, {
      interactionCount: s.interactionCount,
      emotionalTone: s.emotionalTone,
      preferredHour: s.preferredHour,
    });
    // 周统计清零（深更新后）
    s.interactionCount = 0;
    s.emotionalTone = 0;
    s.sessionCount = 0;
    g.growthHistory.push({ timestamp: Date.now(), source: 'weekly', traitsBefore: { ...g.traits } });
    this.trimHistory();
    g.lastSave = Date.now();
    await this.dataSaver(data);
  }

  /** 反思驱动：洞察 → existential 群组成长（depth/familiarity/concern 仅此渠道，MATE §3.2） */
  async applyReflectionInsights(insights: { text: string }[]): Promise<void> {
    if (!Array.isArray(insights) || !insights.length) return;
    const data = this.dataProvider();
    const g = data.personalityGrowth;
    const changes: Record<string, number> = {};
    for (const ins of insights) {
      const text = (ins.text || '').toLowerCase();
      if (/自我|自己|我|about me|self/.test(text)) (changes.exist_depth = (changes.exist_depth || 0) + 0.01);
      if (/熟悉|习惯|偏好|重复/.test(text)) (changes.familiarity = (changes.familiarity || 0) + 0.01);
      if (/担心|焦虑|在意|关心/.test(text)) (changes.concern = (changes.concern || 0) + 0.01);
      if (/学习|好奇|探索|阅读/.test(text)) (changes.creativity = (changes.creativity || 0) + 0.005);
      if (/温暖|信任|亲近|陪伴/.test(text)) (changes.oxytocin = (changes.oxytocin || 0) + 0.005);
    }
    if (!Object.keys(changes).length) return;
    for (const [trait, delta] of Object.entries(changes)) {
      if (Object.prototype.hasOwnProperty.call(g.traits, trait)) {
        g.traits[trait] = Math.min(0.99, Math.max(0.01, g.traits[trait] + delta));
      }
    }
    g.growthHistory.push({
      timestamp: Date.now(), source: 'reflection', insights: insights.map((i) => i.text), changes, traitsBefore: { ...g.traits },
    });
    this.trimHistory();
    g.lastSave = Date.now();
    await this.dataSaver(data);
  }

  /** 行为统计（MATE behaviorStats：时段众数 + 情绪基调 EMA + 计数） */
  tickBehaviorStats(interactionType: string): void {
    const g = this.dataProvider().personalityGrowth;
    const s = g.behaviorStats;
    s.interactionCount = (s.interactionCount || 0) + 1;
    const hour = new Date().getHours();
    // ADR-0025 修「假众数」：preferredHour 由近 30 天记忆创建小时直方图峰值（复用作息画像）给出；
    // 无记忆数据（还没观察过）时兜底当前小时（旧行为，mood 测试保持）
    const profile = buildRhythmProfile(this.dataProvider().memory.stream || [], 30, Date.now());
    s.preferredHour = profile.total > 0 ? profile.peakHour : hour;
    // 互动类型 → 情绪基调微调（pet/learn 正，click 中性）
    const tone = interactionType === 'pet' || interactionType === 'learn' ? 0.02 : interactionType === 'click' ? 0 : -0.01;
    s.emotionalTone = Math.min(1, Math.max(-1, (s.emotionalTone || 0) + tone * 0.2));
  }

  private trimHistory(): void {
    const data = this.dataProvider();
    if (data.personalityGrowth.growthHistory.length > 100) {
      data.personalityGrowth.growthHistory = data.personalityGrowth.growthHistory.slice(-50);
    }
  }

  getGrowthHistory(): any[] {
    return this.dataProvider().personalityGrowth.growthHistory || [];
  }
}