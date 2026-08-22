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

  /** 当前瞬时情绪（无则 null） */
  getCurrentEmotion(): string | null {
    return this.dataProvider().mood.currentEmotion || null;
  }

  // ---------------- PAD → 5 档（原型最近邻，解除原 calculateCompositeMood 断线） ----------------

  /** 计算 5 档：当前 PAD 到各原型欧氏距离，取最近档 */
  computeMoodLevel(): string {
    const { pleasure: p, arousal: a, dominance: d } = this.pad;
    let best: string = 'neutral';
    let bestDist = Infinity;
    for (const key of MOOD_KEYS) {
      const [ep, ea, ed] = MOOD_MAP[key].prototype;
      const dist = Math.sqrt((p - ep) ** 2 + (a - ea) ** 2 + (d - ed) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        best = key;
      }
    }
    return best;
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

  /** 自动衰减（60s；PAD 三轴各自速率 ÷ 人格乘数） */
  startAutoDecay(): void {
    if (this.decayTimer) clearInterval(this.decayTimer);
    const baseDecayRates: Record<string, number> = {
      pleasure: -0.02, arousal: -0.03, dominance: -0.02,
    };
    this.decayTimer = setInterval(() => {
      const mod = this.getCharacterModulators();
      for (const [axis, rate] of Object.entries(baseDecayRates)) {
        const multiplier = mod.padMultipliers[axis] || 1.0;
        const adjustedRate = rate * (1 / multiplier);
        const old = this.pad[axis as keyof PadDimensions] || 50;
        this.pad[axis as keyof PadDimensions] = Math.max(0, Math.round((old + adjustedRate) * 10) / 10);
      }
      void this.saveMoodState();
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

  /** 互动驱动（MATE character_transition：δ=δbase×Σ|eᵢ|×近因；softUpdate 饱和） */
  async developBasedOnInteraction(interactionType: string, intensity: number, emotionIntensity = 0): Promise<void> {
    const data = this.dataProvider();
    const g = data.personalityGrowth;
    const I = Math.max(emotionIntensity, intensity * 0.2);
    g.traits = characterTransition(g.traits, { emotionIntensity: I, trust: g.relationship.trust });
    // 互动类型有情绪价（pet/learn 温暖；note 专注）
    if (interactionType === 'pet' || interactionType === 'learn') {
      g.traits = characterTransition(g.traits, { emotionIntensity: 0.2, trust: g.relationship.trust });
    }
    g.relationship.trust = trustUpdate(g.relationship.trust, { warm: interactionType === 'pet' || interactionType !== 'click', trustCap: TRUST_CAP ?? undefined });
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

  /** 行为统计（MATE behaviorStats：时段众数近似 + 情绪基调 EMA + 计数） */
  tickBehaviorStats(interactionType: string): void {
    const g = this.dataProvider().personalityGrowth;
    const s = g.behaviorStats;
    s.interactionCount = (s.interactionCount || 0) + 1;
    const hour = new Date().getHours();
    // preferredHour：简单滚众（出现最多的时段）
    s.preferredHour = hour;
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