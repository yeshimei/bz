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
import type { PadDimensions, SmartCatData, Personality } from './types';

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

  /** 更新 PAD 某轴（人格乘数调制；clamp 0-100；变化微小不落盘） */
  updatePad(axis: 'pleasure' | 'arousal' | 'dominance', change: number, reason = ''): void {
    const personality = this.getCurrentPersonality();
    const multiplier = this.getPersonalityEffects(personality).padMultipliers[axis] || 1.0;
    let adjusted = change * multiplier;
    // 负向抵抗力（人格越相关越抗跌）
    if (change < 0) {
      const resistance = this.getPersonalityResistance(personality, axis);
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
    this.moodHistory.push({ axis, change, adjusted, reason, timestamp: Date.now(), oldValue: old, newValue: this.pad[axis], personality });
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

  // ---------------- 人格调制（PAD 版） ----------------

  /** 人格抵抗力表（PAD 三轴；lively 兜底） */
  getPersonalityResistance(personality: string, axis: string): number {
    const resistanceMap: Record<string, Record<string, number>> = {
      lively: { pleasure: 0.8, arousal: 0.9 },
      quiet: { arousal: 1.1, pleasure: 1.2 },
      wise: { dominance: 1.2, arousal: 1.0 },
      cute: { pleasure: 0.8, dominance: 0.9 },
      mentor: { dominance: 1.3, arousal: 1.1 },
    };
    const map = resistanceMap[personality] || {};
    return map[axis] || 1.0;
  }

  /** 人格影响（PAD 三轴 moodMultipliers；lively 全 1.0 兜底） */
  getPersonalityEffects(personality: string): { padMultipliers: Record<string, number> } {
    const tables: Record<string, Record<string, number>> = {
      lively: { pleasure: 1.0, arousal: 1.0, dominance: 1.0 },
      quiet: { pleasure: 1.1, arousal: 0.95, dominance: 1.0 },
      wise: { pleasure: 1.0, arousal: 1.0, dominance: 1.15 },
      cute: { pleasure: 1.15, arousal: 1.0, dominance: 0.9 },
      mentor: { pleasure: 0.95, arousal: 1.05, dominance: 1.2 },
    };
    return { padMultipliers: tables[personality] || tables.lively };
  }

  /** 当前人格（读 config.personality，缺省 lively） */
  getCurrentPersonality(): Personality {
    const p = this.dataProvider().config.personality;
    return (p as Personality) || 'lively';
  }

  // ---------------- 衰减 ----------------

  /** 自动衰减（60s；PAD 三轴各自速率 ÷ 人格乘数） */
  startAutoDecay(): void {
    if (this.decayTimer) clearInterval(this.decayTimer);
    const baseDecayRates: Record<string, number> = {
      pleasure: -0.02, arousal: -0.03, dominance: -0.02,
    };
    this.decayTimer = setInterval(() => {
      const effects = this.getPersonalityEffects(this.getCurrentPersonality());
      for (const [axis, rate] of Object.entries(baseDecayRates)) {
        const multiplier = effects.padMultipliers[axis] || 1.0;
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

/** 人格成长（保存 traits + growthHistory；反思驱动主 + 互动驱动辅） */
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

  /** 人格影响（原 getPersonalityInfluence 逐字；供 PAD 更新调制） */
  getPersonalityInfluence(): any {
    const t = this.traits;
    return {
      happinessMultiplier: 1 + (t.playfulness - 50) * 0.01,
      affectionMultiplier: 1 + (t.sociability - 50) * 0.015,
      decayResistance: 1 - (t.independence - 50) * 0.005,
      curiosityBoost: 1 + (t.curiosity - 50) * 0.01,
    };
  }

  /** 互动成长（原 developBasedOnInteraction 接线；互动驱动） */
  async developBasedOnInteraction(interactionType: string, intensity: number): Promise<void> {
    const developmentEffects: Record<string, Record<string, number>> = {
      pet: { sociability: 1, independence: -0.5 },
      click: { curiosity: 0.5, playfulness: 0.3 },
      learn: { curiosity: 1, independence: 0.3 },
      note_create: { curiosity: 0.8, focus: 0.5 },
      note_edit: { focus: 0.6, curiosity: 0.3 },
      note_read: { curiosity: 0.4, focus: 0.2 },
    };
    const effects = developmentEffects[interactionType];
    if (!effects) return;
    const t = this.traits;
    for (const [trait, change] of Object.entries(effects)) {
      t[trait] = Math.max(0, Math.min(100, t[trait] as number + change * intensity));
    }
    const data = this.dataProvider();
    data.personalityGrowth.growthHistory.push({
      timestamp: Date.now(), interactionType, effects, intensity, source: 'interaction', traitsBefore: { ...t },
    });
    this.trimHistory();
    data.personalityGrowth.lastSave = Date.now();
    await this.dataSaver(data);
  }

  /** 反思驱动：记忆流洞察 → 特质调整（社区三层：人格随经历成长的主通道） */
  async applyReflectionInsights(insights: { text: string }[]): Promise<void> {
    if (!Array.isArray(insights) || !insights.length) return;
    const t = this.traits;
    const changes: Record<string, number> = {};
    for (const ins of insights) {
      const text = (ins.text || '').toLowerCase();
      if (/学习|阅读|好奇|探索|new|learn|study/.test(text)) (changes.curiosity = (changes.curiosity || 0) + 1);
      if (/社交|朋友|陪伴|热闹|soci|play/.test(text)) (changes.sociability = (changes.sociability || 0) + 1);
      if (/独处|安静|独立|专注/.test(text)) (changes.independence = (changes.independence || 0) + 1);
      if (/玩|游戏|fun|playful|轻松/.test(text)) (changes.playfulness = (changes.playfulness || 0) + 1);
    }
    if (!Object.keys(changes).length) return;
    for (const [trait, delta] of Object.entries(changes)) {
      t[trait] = Math.max(0, Math.min(100, t[trait] as number + delta));
    }
    const data = this.dataProvider();
    data.personalityGrowth.growthHistory.push({
      timestamp: Date.now(), source: 'reflection', insights: insights.map((i) => i.text), changes, traitsBefore: { ...t },
    });
    this.trimHistory();
    data.personalityGrowth.lastSave = Date.now();
    await this.dataSaver(data);
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