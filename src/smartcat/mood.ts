/**
 * 心情系统（移植自 SmartCatPluginMood.js：MoodSystem/PersonalityGrowth/
 * TimeEmotionSystem（精简）/PersonalityInfluenceSystem/EmotionalMemory 核心）
 * 铁律 4 缺陷保留：currentMood 恒为持久化 lastMood 或 'content'（calculateCompositeMood 不接）；
 * currentPersonality 原版只读不写恒 undefined → 本版显式读 config.personality（等价回落 lively）。
 * 存储全部收敛进 smartcat.json（data.mood / data.personalityGrowth / data.emotionalMemory / data.timeEmotion）。
 */
import type { App } from 'obsidian';
import type { MoodDimensions, SmartCatData, Personality } from './types';

export const MOOD_MAP: Record<string, { emoji: string; state: string }> = {
  excellent: { emoji: '😻', state: '超开心' },
  good: { emoji: '😸', state: '心情好' },
  neutral: { emoji: '😼', state: '平常心' },
  low: { emoji: '😿', state: '小低落' },
  poor: { emoji: '🙀', state: '不开心' },
};

export class MoodSystem {
  app: App;
  dataProvider: () => SmartCatData;
  dataSaver: (data: SmartCatData) => Promise<void>;
  dimensions: MoodDimensions;
  negativeStates = { boredom: 0, fatigue: 0, distraction: 0, loneliness: 0 };
  stateThresholds = { critical: 80, warning: 60, normal: 30 };
  currentMood: string;
  moodHistory: any[] = [];
  lastInteractionTime = Date.now();
  private decayTimer: ReturnType<typeof setInterval> | null = null;

  constructor(app: App, dataProvider: () => SmartCatData, dataSaver: (data: SmartCatData) => Promise<void>) {
    this.app = app;
    this.dataProvider = dataProvider;
    this.dataSaver = dataSaver;
    const d = this.dataProvider().mood.dimensions;
    this.dimensions = { ...d };
    this.currentMood = this.dataProvider().mood.lastMood && this.dataProvider().mood.lastMood !== 'neutral'
      ? this.dataProvider().mood.lastMood
      : 'content';
    this.init();
  }

  init(): void {
    this.ensureMoodClassApplied();
    this.startAutoDecay();
  }

  /** updateMood（原 L2194-2264 逐字：人格乘数/负向抵抗力/energy 下限/边界/微变化防卡/历史截断/重要保存） */
  updateMood(dimension: string, change: number, reason = ''): void {
    if (!this.dimensions) this.dimensions = { happiness: 50, energy: 50, curiosity: 50, affection: 50, focus: 50, creativity: 50, productivity: 50, relaxation: 50 };
    if (!Object.prototype.hasOwnProperty.call(this.dimensions, dimension)) {
      (this.dimensions as any)[dimension] = 50;
    }
    const personality = this.getCurrentPersonality();
    const personalityEffects = this.getPersonalityEffects(personality);
    const moodMultiplier = personalityEffects.moodMultipliers[dimension] || 1.0;
    let adjustedChange = change * moodMultiplier;
    if (change < 0) {
      const resistance = this.getPersonalityResistance(personality, dimension);
      adjustedChange = change * resistance;
    }
    const oldValue = (this.dimensions as any)[dimension];
    let newValue = oldValue + adjustedChange;
    if (dimension === 'energy' && newValue < 5) newValue = 5;
    newValue = Math.max(0, Math.min(100, newValue));
    if (Math.abs(adjustedChange) > 0.1 && Math.abs(newValue - oldValue) < 0.1) {
      if (oldValue > 99) newValue = 100;
      else if (oldValue < 1) newValue = 1;
      else newValue = oldValue + (adjustedChange > 0 ? 0.5 : -0.5);
    }
    if (Math.abs(newValue - oldValue) < 0.01) return;
    (this.dimensions as any)[dimension] = Math.round(newValue * 10) / 10;
    this.moodHistory.push({
      dimension, originalChange: change, adjustedChange, reason,
      timestamp: Date.now(), oldValue, newValue: (this.dimensions as any)[dimension],
      personality, multiplierApplied: moodMultiplier,
    });
    if (this.moodHistory.length > 200) this.moodHistory = this.moodHistory.slice(-100);
    if (Math.abs(adjustedChange) >= 1) void this.saveMoodState();
  }

  /** 人格抵抗力表（原 getPersonalityResistance 逐字） */
  getPersonalityResistance(personality: string, dimension: string): number {
    const resistanceMap: Record<string, Record<string, number>> = {
      lively: { happiness: 0.8, energy: 0.9, affection: 0.7, boredom: 0.6 },
      quiet: { happiness: 1.2, energy: 1.1, focus: 0.9, relaxation: 1.3 },
      wise: { curiosity: 0.8, focus: 1.2, creativity: 1.1 },
      cute: { affection: 0.6, loneliness: 0.5, happiness: 0.8 },
      mentor: { productivity: 1.3, focus: 1.2, energy: 1.1 },
    };
    const map = resistanceMap[personality] || {};
    return map[dimension] || 1.0;
  }

  /** 人格影响（原 PersonalityInfluenceSystem.getPersonalityEffects 语义：
   * 8 维 moodMultipliers 表；lively 全 1.0 兜底） */
  getPersonalityEffects(personality: string): { moodMultipliers: Record<string, number> } {
    const tables: Record<string, Record<string, number>> = {
      lively: { happiness: 1.0, energy: 1.0, curiosity: 1.0, affection: 1.0, focus: 1.0, creativity: 1.0, productivity: 1.0, relaxation: 1.0 },
      quiet: { happiness: 1.1, energy: 0.95, curiosity: 1.0, affection: 1.0, focus: 1.15, creativity: 1.0, productivity: 1.0, relaxation: 1.1 },
      wise: { happiness: 1.0, energy: 1.0, curiosity: 1.2, affection: 0.9, focus: 1.2, creativity: 1.05, productivity: 1.05, relaxation: 0.95 },
      cute: { happiness: 1.15, energy: 1.0, curiosity: 1.0, affection: 1.2, focus: 0.9, creativity: 1.1, productivity: 0.95, relaxation: 1.0 },
      mentor: { happiness: 0.95, energy: 1.1, curiosity: 1.05, affection: 0.95, focus: 1.15, creativity: 1.0, productivity: 1.25, relaxation: 0.9 },
    };
    return { moodMultipliers: tables[personality] || tables.lively };
  }

  /** 当前人格（原版 currentPersonality 恒 undefined → 回落 lively；本版读 config.personality） */
  getCurrentPersonality(): Personality {
    const p = this.dataProvider().config.personality;
    return (p as Personality) || 'lively';
  }

  /** 自动衰减（原 startAutoDecay：60s，率表 × 1/multiplier） */
  startAutoDecay(): void {
    if (this.decayTimer) clearInterval(this.decayTimer);
    const baseDecayRates: Record<string, number> = {
      happiness: -0.02, energy: -0.04, curiosity: -0.015, affection: -0.01,
      focus: -0.03, creativity: -0.02, productivity: -0.025, relaxation: -0.015,
    };
    this.decayTimer = setInterval(() => {
      const effects = this.getPersonalityEffects(this.getCurrentPersonality());
      for (const [dimension, rate] of Object.entries(baseDecayRates)) {
        const multiplier = effects.moodMultipliers[dimension] || 1.0;
        const adjustedRate = rate * (1 / multiplier);
        const old = (this.dimensions as any)[dimension] || 50;
        (this.dimensions as any)[dimension] = Math.max(0, Math.round((old + adjustedRate) * 10) / 10);
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

  /** 持久化（原 saveMoodState：{dimensions, lastUpdate, lastMood}） */
  async saveMoodState(): Promise<void> {
    const data = this.dataProvider();
    data.mood.dimensions = { ...this.dimensions };
    data.mood.lastUpdate = Date.now();
    data.mood.lastMood = this.currentMood;
    await this.dataSaver(data);
  }

  /** 加载（原 loadMoodState：24h 内合并维度 + lastMood；超时保持默认不覆写存储） */
  loadMoodState(): void {
    const data = this.dataProvider();
    const saved = data.mood;
    const hoursDiff = (Date.now() - saved.lastUpdate) / (1000 * 60 * 60);
    if (hoursDiff < 24) {
      this.dimensions = { ...this.dimensions, ...saved.dimensions };
      if (saved.lastMood) this.currentMood = saved.lastMood === 'content' ? 'content' : saved.lastMood;
    }
    this.ensureMoodClassApplied();
  }

  /** 表情类（原 ensureMoodClassApplied：给猫容器挂 mood-<mood> 类） */
  ensureMoodClassApplied(): void {
    const container = document.getElementById('smart-companion-cat');
    if (!container) return;
    container.classList.remove('mood-excellent', 'mood-good', 'mood-neutral', 'mood-low', 'mood-poor');
    container.classList.add(`mood-${this.currentMood}`);
  }

  /** 当前心情 emoji（原 getCurrentMoodEmoji：MOOD_MAP 查表，未命中 neutral） */
  getCurrentMoodEmoji(): string {
    const m = MOOD_MAP[this.currentMood];
    return m ? m.emoji : '😼';
  }

  /** 心情整体级别（MOOD_MAP key；content → neutral 兜底） */
  getOverallMood(): string {
    const m = MOOD_MAP[this.currentMood];
    return m ? this.currentMood : 'neutral';
  }

  /** 互动心情影响（原 handleInteraction 定义：pet/click/learn/note_create/note_edit/note_read；原版无人调用，保留语义供 tapping 使用） */
  handleInteraction(type: string, intensity = 1): void {
    const effects: Record<string, Record<string, number>> = {
      pet: { happiness: 8, affection: 6, energy: 2 },
      click: { curiosity: 3, happiness: 2 },
      learn: { curiosity: 6, focus: 4 },
      note_create: { creativity: 8, productivity: 6, happiness: 3 },
      note_edit: { focus: 6, creativity: 4, productivity: 5 },
      note_read: { curiosity: 5, focus: 4, relaxation: 3 },
    };
    const eff = effects[type];
    if (eff) {
      for (const [dim, change] of Object.entries(eff)) this.updateMood(dim, change * intensity, type);
    }
  }

  dispose(): void {
    this.stopAutoDecay();
  }
}

/** 情感记忆（EmotionalMemory 移植精简：数据收敛进 data.emotionalMemory；保留统计/记录核心） */
export class EmotionalMemory {
  app: App;
  dataProvider: () => SmartCatData;
  dataSaver: (data: SmartCatData) => Promise<void>;
  config = { retentionDays: 30, maxMemories: 500, significanceThreshold: 0.3, compressionEnabled: true, autoSaveInterval: 5 * 60 * 1000 };
  private currentSession = { id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, startTime: Date.now(), processedInteractions: new Set<string>() };

  constructor(app: App, dataProvider: () => SmartCatData, dataSaver: (data: SmartCatData) => Promise<void>) {
    this.app = app;
    this.dataProvider = dataProvider;
    this.dataSaver = dataSaver;
  }

  get store(): any {
    if (!this.dataProvider().emotionalMemory) (this.dataProvider() as any).emotionalMemory = this.defaultStore();
    return this.dataProvider().emotionalMemory;
  }

  private defaultStore(): any {
    return {
      version: '2.0', lastUpdated: Date.now(), lastProcessed: { timestamp: 0, sessionId: null },
      memories: [], associations: {},
      statistics: { totalMemories: 0, memoryByType: {}, averageIntensity: 0, recentActivity: [] },
      learning: { patterns: {}, preferences: {}, adaptations: {} },
    };
  }

  /** 记录记忆（原 recordMemory 核心：去重/重要性阈值/记忆对象/关联/统计/上限压缩） */
  async recordMemory(context: any, emotionalResponse: any[], intensity: number, options: Record<string, any> = {}): Promise<any | null> {
    if (!Array.isArray(emotionalResponse)) return null;
    const memoryKey = this.generateMemoryKey(context, emotionalResponse);
    if (this.currentSession.processedInteractions.has(memoryKey)) return null;
    const significance = this.calculateSignificance(emotionalResponse, intensity, context);
    if (significance < this.config.significanceThreshold) return null;
    const memory = {
      id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      sessionId: this.currentSession.id,
      context: this.normalizeContext(context),
      emotionalResponse,
      intensity,
      significance,
      tags: this.extractTags(context),
      compressed: false,
    };
    this.store.memories.push(memory);
    this.currentSession.processedInteractions.add(memoryKey);
    this.updateStatistics();
    if (this.store.memories.length > this.config.maxMemories) this.compressOldMemories();
    this.store.lastUpdated = Date.now();
    await this.dataSaver(this.dataProvider());
    return memory;
  }

  /** 去重键（原 generateMemoryKey：context 前 2 标签 + 情感响应维符号串） */
  generateMemoryKey(context: any, emotionalResponse: any[]): string {
    const ctx = JSON.stringify({
      type: context?.interactionType,
      time: context?.timeOfDay,
      tags: context?.tags?.slice(0, 2),
    });
    const respStr = emotionalResponse
      .map((r: any) => `${r.dimension}_${Math.sign(r.change)}`)
      .sort()
      .join('|');
    return `${ctx}|${respStr}`;
  }

  /** 标准化上下文（原 normalizeContext：string 兼容 JSON/raw） */
  normalizeContext(context: any): any {
    if (typeof context === 'string') {
      try { context = JSON.parse(context); } catch (e) { context = { raw: context }; }
    }
    const now = new Date();
    return {
      interactionType: context?.interactionType || 'unknown',
      intensity: context?.intensity || 1,
      timestamp: context?.timestamp || now.getTime(),
      timeOfDay: context?.timeOfDay || this.getTimeOfDay(now),
      dayOfWeek: context?.dayOfWeek || now.getDay(),
      userActivity: context?.userActivity || 'interaction',
      noteAction: context?.noteAction,
      noteTitle: context?.noteTitle,
      contentType: context?.contentType,
      tags: context?.tags || [],
      emotionalStateBefore: context?.moodBefore || {},
      rawContext: context,
    };
  }

  getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    if (hour >= 5 && hour < 8) return 'early_morning';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 14) return 'noon';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    if (hour >= 22 && hour < 24) return 'night';
    return 'late_night';
  }

  /** 标签提取（原 extractTags：时间/会话阶段/互动/笔记/内容/情感/环境） */
  extractTags(context: any): string[] {
    const tags: string[] = [];
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    tags.push(`hour_${hour}`);
    tags.push(`time_${this.getTimeOfDay(now)}`);
    tags.push(dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : 'weekday');
    const sessionDuration = Date.now() - this.currentSession.startTime;
    if (sessionDuration < 30 * 60 * 1000) tags.push('first_session');
    else if (sessionDuration < 2 * 60 * 60 * 1000) tags.push('mid_session');
    else tags.push('late_session');
    if (context?.interactionType) tags.push(`interaction_${context.interactionType}`);
    if (context?.noteAction) tags.push(`note_${context.noteAction}`);
    if (context?.contentType) tags.push(`content_${context.contentType}`);
    if (context?.emotionalStateBefore) this.addEmotionalStateTags(tags, context.emotionalStateBefore);
    if (sessionDuration > 60 * 60 * 1000) tags.push('long_session');
    if (sessionDuration < 5 * 60 * 1000) tags.push('quick_check');
    if (context?.userActivity === 'focused_work') tags.push('focused_work');
    if (context?.userActivity === 'organization') tags.push('organization');
    return tags;
  }

  addEmotionalStateTags(tags: string[], state: any): void {
    if (state.energy > 70) tags.push('high_energy');
    else if (state.energy < 30) tags.push('low_energy');
    if (state.happiness > 70) tags.push('happy');
    else if (state.happiness < 30) tags.push('sad');
    if (state.focus > 70) tags.push('focused');
    else if (state.focus < 30) tags.push('distracted');
    if (state.creativity > 70) tags.push('creative');
    if (state.productivity > 70) tags.push('productive');
  }

  /** 重要性（原 calculateSignificance 逐字） */
  calculateSignificance(emotionalResponse: any[], intensity: number, context: any): number {
    let significance = 0;
    const totalChange = emotionalResponse.reduce((sum: number, r: any) => sum + Math.abs(r.change), 0);
    significance += totalChange * 0.3;
    significance += intensity * 0.4;
    const typeWeights: Record<string, number> = { pet: 0.8, note_create: 0.7, achievement: 0.9, learn: 0.6, note_edit: 0.5, note_read: 0.4, click: 0.2 };
    significance += (typeWeights[context?.interactionType] || 0.3) * 0.3;
    return Math.min(1, significance);
  }

  updateStatistics(): void {
    const s = this.store.statistics;
    s.totalMemories = this.store.memories.length;
    s.memoryByType = {};
    this.store.memories.forEach((m: any) => {
      const t = m.context?.interactionType || 'unknown';
      s.memoryByType[t] = (s.memoryByType[t] || 0) + 1;
    });
    s.averageIntensity = this.store.memories.length
      ? this.store.memories.reduce((sum: number, m: any) => sum + (m.intensity || 0), 0) / this.store.memories.length
      : 0;
    s.recentActivity = this.store.memories.slice(-10).map((m: any) => ({ timestamp: m.timestamp, type: m.context?.interactionType }));
  }

  /** 压缩旧记忆（简版：保留一半最旧，标记 compressed） */
  compressOldMemories(): void {
    const half = Math.floor(this.store.memories.length / 2);
    const compressed = this.store.memories.slice(0, half).map((m: any) => ({ ...m, compressed: true }));
    this.store.memories = [...compressed, ...this.store.memories.slice(half)];
    this.updateStatistics();
  }
}

/** 人格成长（PersonalityGrowth 移植：traits + growthHistory，存 data.personalityGrowth） */
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

  /** 人格影响（原 getPersonalityInfluence 逐字） */
  getPersonalityInfluence(): any {
    const t = this.traits;
    return {
      happinessMultiplier: 1 + (t.playfulness - 50) * 0.01,
      affectionMultiplier: 1 + (t.sociability - 50) * 0.015,
      decayResistance: 1 - (t.independence - 50) * 0.005,
      curiosityBoost: 1 + (t.curiosity - 50) * 0.01,
    };
  }

  /** 互动成长（原 developBasedOnInteraction 逐字） */
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
      timestamp: Date.now(), interactionType, effects, intensity, traitsBefore: { ...t },
    });
    if (data.personalityGrowth.growthHistory.length > 100) {
      data.personalityGrowth.growthHistory = data.personalityGrowth.growthHistory.slice(-50);
    }
    data.personalityGrowth.lastSave = Date.now();
    await this.dataSaver(data);
  }

  getGrowthHistory(): any[] {
    return this.dataProvider().personalityGrowth.growthHistory || [];
  }
}