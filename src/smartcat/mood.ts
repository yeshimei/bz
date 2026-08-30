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
import { characterTransition, trustUpdate, characterFromExperience, characterSeed, characterHomeostasis, TRUST_CAP, DEEP_DELTA_SCALE, ATTACHMENT_FOLLOW } from './character';
import { buildRhythmProfile } from './rhythm';
import { emotionToVAD } from './cognitive';
import { callChatJson, isAIConfigured } from './api';
import { USER_CONTENT_BOUNDARY, replaceUserReference } from './memory';

/** 周深更新的互动样本门槛（ticket 072）：此前 applyWeeklyExperience 挂在反思/日小结节奏上
 *  （≥20 条观察即触发），每次都把 warmth 等顶格 +0.01——「周」更新实际按天甚至按小时跑。
 *  互动计数不足此门槛时深更新整体跳过（不成长/不清零/不留痕）。 */
export const WEEKLY_MIN_INTERACTIONS = 50;

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
  lastInteractionTime = Date.now();
  private decayTimer: ReturnType<typeof setInterval> | null = null;
  /** 心情门控采样钩子（ticket 095 设计 3）：60s 衰减循环每 tick 通知窗口采样器（fire-and-forget；可空） */
  onDecayTick?: (() => void) | null = null;

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
    // P2 死字段清理：原 moodHistory 推送点随字段一并删除（重构后全库零消费点）
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

  /** 温和共振（ADR-0025）：观察/聊天情绪 → PAD 差量（走 updatePad，人格调制+衰减生效）；
   *  ADR-0036：可选第二参 scale = 记忆可信度（credibility，缺省 1）——低可信度观察的情绪差量 ×scale 缩量，不猛推 PAD */
  applyEmotionResonance(emotion: string, scale = 1): boolean {
    const deltas = emotionResonanceDelta(emotion);
    const scaled = {
      pleasure: deltas.pleasure * scale,
      arousal: deltas.arousal * scale,
      dominance: deltas.dominance * scale,
    };
    if (Math.abs(scaled.pleasure) < 0.01 && Math.abs(scaled.arousal) < 0.01 && Math.abs(scaled.dominance) < 0.01) return false;
    this.updatePad('pleasure', scaled.pleasure, 'emotion:' + emotion);
    this.updatePad('arousal', scaled.arousal, 'emotion:' + emotion);
    this.updatePad('dominance', scaled.dominance, 'emotion:' + emotion);
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
      // ticket 095 设计 3：窗口采样器固定挂本循环（不新建定时器）；采样失败不影响衰减
      try {
        const hook = this.onDecayTick;
        if (hook) hook();
      } catch { /* 门控采样失败不影响衰减 */ }
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

  /** 中性 PAD 基线（ticket 095 设计 4：24h 陈旧/无数据缺省归此——防重启假情绪） */
  static readonly NEUTRAL_PAD: PadDimensions = { pleasure: 50, arousal: 50, dominance: 50 };

  /**
   * 加载（ticket 095 设计 4 接线，原死代码激活）：
   * lastUpdate 在 24h 内 → 合并持久化 PAD；超时/缺失/非法 → 归中性基线
   * （防重启假情绪；不主动写盘——随既有 60s 衰减落盘基线自愈）。
   */
  loadMoodState(): void {
    const data = this.dataProvider();
    const saved = data.mood;
    const hoursDiff = typeof saved.lastUpdate === 'number' && Number.isFinite(saved.lastUpdate)
      ? (Date.now() - saved.lastUpdate) / (1000 * 60 * 60)
      : NaN;
    if (Number.isFinite(hoursDiff) && hoursDiff < 24) {
      this.pad = { ...this.pad, ...saved.pad };
    } else {
      this.pad = { ...MoodSystem.NEUTRAL_PAD };
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

  /** 互动心情影响（PAD 版效果表；原 8 维 handleInteraction 语义迁移）
   *  ticket 072 用户拍板：撸猫（pet）退出一切数据面——效果表删除 pet 行，
   *  即使有调用方误传 'pet' 也是无操作（派发端 interaction.showPetMessage 已只留视觉反馈） */
  handleInteraction(type: string, intensity = 1): void {
    const effects: Record<string, Record<string, number>> = {
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

// ---------------- 特质归因学习（ticket 091，方向六：086 v4 裁决落地） ----------------

/** 候选特质白名单（v4 裁决：限定 5 个——现状词表对应集，不扩） */
export const TRAIT_ATTRIBUTION_CANDIDATES = ['exist_depth', 'familiarity', 'concern', 'creativity', 'oxytocin'] as const;
export type TraitAttributionCandidate = (typeof TRAIT_ATTRIBUTION_CANDIDATES)[number];

/** existential 群组（Yalom；仅反思成长）：digest 来源禁选 + 增益 ×0.5 降频 */
export const EXISTENTIAL_TRAITS = ['exist_depth', 'familiarity', 'concern'] as const;

/** 每反思批次归因总数上限（超出按洞察顺序截断） */
export const MAX_ATTRIBUTIONS_PER_BATCH = 2;
/** existential 群组增益降频系数 */
export const EXISTENTIAL_GAIN_FACTOR = 0.5;
/** 归因 LLM 失败退避起点/封顶（独立于 memory.reflectBackoffUntil；持久化 editingData.traitAttribution） */
export const TRAIT_ATTRIBUTION_BACKOFF_MS = 5 * 60 * 1000;
export const TRAIT_ATTRIBUTION_BACKOFF_CAP_MS = 30 * 60 * 1000;

/** 归因候选中文标签（prompt 用） */
const TRAIT_LABELS: Record<string, string> = {
  exist_depth: '存在深度与自我认识',
  familiarity: '对用户习惯的熟悉',
  concern: '对用户的牵挂与关心',
  creativity: '好奇与创造',
  oxytocin: '温暖陪伴与信任',
};

/** 词法兜底词表（原 applyReflectionInsights 正则逐字保留——LLM 不可用/失败时的兜底路径） */
export const LEXICAL_TRAIT_PATTERNS: ReadonlyArray<{ trait: TraitAttributionCandidate; re: RegExp }> = [
  { trait: 'exist_depth', re: /自我|自己|about me|self/ },
  { trait: 'familiarity', re: /熟悉|习惯|偏好|重复/ },
  { trait: 'concern', re: /担心|焦虑|在意|关心/ },
  { trait: 'creativity', re: /学习|好奇|探索|阅读/ },
  { trait: 'oxytocin', re: /温暖|信任|亲近|陪伴/ },
];

/** 单条归因结果：index 为 1 起始洞察序号；quote 仅 llm 模式带（词法兜底不产伪解释） */
export interface TraitAttribution {
  index: number;
  trait: TraitAttributionCandidate;
  quote?: string;
}

/**
 * LLM 归因结果解析（纯函数，ticket 091）：
 * - raw.attributions 非数组 → null（结构性失败 → 调用方整批回落词法）；
 * - 单条契约 {trait, quote} | {trait:'none'}：none → 本条不归因不硬挑；
 *   越权词表 / digest 来源 existential / quote 非该条洞察原文子串 → 该条裁剪（异常可裁剪，不整轮失败）；
 * - 返回按洞察顺序排列的归因数组（可能为空 = LLM 全部 none/无效）。
 */
export function parseLLMAttributions(
  raw: any,
  insights: { text: string }[],
  opts: { allowExistential: boolean },
): TraitAttribution[] | null {
  const arr = raw?.attributions;
  if (!Array.isArray(arr)) return null;
  const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '');
  const out: TraitAttribution[] = [];
  for (const item of arr) {
    const idx = Number(item?.index);
    if (!Number.isInteger(idx) || idx < 1 || idx > insights.length) continue;
    const trait = item?.trait;
    if (trait === 'none' || trait === undefined || trait === null) continue; // 无合适特质 ≠ 硬挑
    if (typeof trait !== 'string' || !(TRAIT_ATTRIBUTION_CANDIDATES as readonly string[]).includes(trait)) continue;
    if (!opts.allowExistential && (EXISTENTIAL_TRAITS as readonly string[]).includes(trait)) continue; // 来源约束
    // llm 必须引用洞察原文片段作依据（quote）；摘不出可靠片段 → 视为无效归因裁剪掉
    const quote = typeof item?.quote === 'string' ? item.quote.trim() : '';
    if (!quote || !norm(insights[idx - 1].text).includes(norm(quote))) continue;
    out.push({ index: idx, trait: trait as TraitAttributionCandidate, quote });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

/** 词法兜底归因计划（纯函数）：正则逐字保留 + 批次 ≤2 截断（按洞察顺序）+ digest 排除 existential */
export function planLexicalAttributions(
  insights: { text: string }[],
  opts: { allowExistential: boolean },
): TraitAttribution[] {
  const plan: TraitAttribution[] = [];
  for (let i = 0; i < insights.length && plan.length < MAX_ATTRIBUTIONS_PER_BATCH; i++) {
    const text = (insights[i]?.text || '').toLowerCase();
    for (const p of LEXICAL_TRAIT_PATTERNS) {
      if (plan.length >= MAX_ATTRIBUTIONS_PER_BATCH) break;
      if (!opts.allowExistential && (EXISTENTIAL_TRAITS as readonly string[]).includes(p.trait)) continue;
      if (p.re.test(text)) plan.push({ index: i + 1, trait: p.trait });
    }
  }
  return plan;
}

/**
 * 性格成长（对齐 MATE ADR-0023：OCEAN 种子 + 30 特质 + relationship 张量 + 周统计）
 * 驱动源三路：character_transition（每条互动微移）、character_from_experience（周统计深更新）、
 * applyReflectionInsights（反思洞察 → 特质归因成长，ticket 091）。全部经 character.ts 纯函数。
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
    // ticket 072 用户拍板：撸猫（pet）退出一切数据面（纯互动信号，只留气泡/动画）——
    // 数据层结构化兜底：任何入口误传 'pet' 都不写特质/信任/统计/历史
    if (interactionType === 'pet') return;
    const data = this.dataProvider();
    const g = data.personalityGrowth;
    const I = Math.max(emotionIntensity, intensity * 0.2);
    g.traits = characterTransition(g.traits, { emotionIntensity: I, trust: g.relationship.trust });
    // 互动类型有情绪价（learn 温暖；note 专注）
    if (interactionType === 'learn') {
      g.traits = characterTransition(g.traits, { emotionIntensity: 0.2, trust: g.relationship.trust });
    }
    // ADR-0025 修「warm 恒真」：温暖=learn/talk/diary/flash（写日记/闪念轻质量温暖），
    // 中性=click/note_*（不升温不侵蚀，原表达式 `pet || !== click` 使侵蚀分支成为死代码）
    const warm = interactionType === 'learn' || interactionType === 'talk' || interactionType === 'diary' || interactionType === 'flash';
    const neutral = interactionType === 'click' || interactionType.startsWith('note_');
    g.relationship.trust = trustUpdate(g.relationship.trust, { warm, neutral, quality: trustQuality, trustCap: TRUST_CAP ?? undefined });
    // ticket 072：依恋慢跟随信任（attachment 此前全库无写入点，恒 0.5 死维度）
    g.relationship.attachment = Math.min(0.999, Math.max(0.05, g.relationship.attachment + (g.relationship.trust - g.relationship.attachment) * ATTACHMENT_FOLLOW));
    // 活跃时段统计（按当时钟点滚一个众数近似）
    this.tickBehaviorStats(interactionType);
    g.growthHistory.push({
      timestamp: Date.now(), interactionType, intensity, source: 'interaction', traitsBefore: { ...g.traits },
    });
    this.trimHistory();
    g.lastSave = Date.now();
    await this.dataSaver(data);
  }

  /** 周统计深更新（MATE character_from_experience：δ≤0.01，对积累的 behaviorStats 折算）
   *  ticket 072 三修：① WEEKLY_MIN_INTERACTIONS 样本门槛（不再被反思节奏拖着高频空转）；
   *  ② 深更新增益 ×DEEP_DELTA_SCALE（与 δbase 同源量纲，防核心特质数月饱和）；
   *  ③ characterHomeostasis 向出生种子微量回归（全系统首个下降通道，保个体分化） */
  async applyWeeklyExperience(): Promise<void> {
    const data = this.dataProvider();
    const g = data.personalityGrowth;
    const s = g.behaviorStats;
    if ((s.interactionCount || 0) < WEEKLY_MIN_INTERACTIONS) return;
    g.traits = characterFromExperience(g.traits, {
      interactionCount: s.interactionCount,
      emotionalTone: s.emotionalTone,
      preferredHour: s.preferredHour,
    }, { scale: DEEP_DELTA_SCALE });
    g.traits = characterHomeostasis(g.traits, characterSeed(g.ocean));
    // 周统计清零（深更新后）
    s.interactionCount = 0;
    s.emotionalTone = 0;
    s.sessionCount = 0;
    g.growthHistory.push({ timestamp: Date.now(), source: 'weekly', traitsBefore: { ...g.traits } });
    this.trimHistory();
    g.lastSave = Date.now();
    await this.dataSaver(data);
  }

  /** 反思驱动：洞察 → 特质成长（ticket 091 方向六重构：LLM 归因主 + 词法兜底）
   *  - 归因结果带 mode 标记（llm 带 quote 依据 / lexical 不带——不产伪解释），每个被归因洞察
   *    在 growthHistory 留一条记录（insights 字段保留数组形态，dashboard 消费兼容）；
   *  - 每批归因总数 ≤2（按洞察顺序截断）；digest 来源只允许非 existential；existential 群组 ×0.5 降频；
   *  - LLM 返回 none 不硬挑（本条不归因不涨特质）；候选限定 5 特质白名单；
   *  - H4 安全契约继承：system prompt 追加 USER_CONTENT_BOUNDARY（memory.ts 导出）；
   *  - LLM 失败/结构异常 → 整批回落词法（mode=lexical）；独立退避持久化 editingData.traitAttribution
   *    （不共享 reflectBackoffUntil），窗口内直接走词法不再请求；
   *  - 词法兜底正则与旧实现逐字一致（既有 mood 测试回归不变），仅叠加批次上限与来源约束。 */
  async applyReflectionInsights(insights: { text: string }[], opts: { origin?: 'reflection' | 'digest' } = {}): Promise<void> {
    if (!Array.isArray(insights) || !insights.length) return;
    const origin = opts.origin === 'digest' ? 'digest' : 'reflection';
    const allowExistential = origin !== 'digest'; // 来源约束：digest 只允许非 existential 归因
    const data = this.dataProvider();
    const g = data.personalityGrowth;

    // ---- 归因主路径：本批一次 LLM 批量归因（退避窗口内/AI 未配置跳过 → 词法兜底）----
    let mode: 'llm' | 'lexical' = 'lexical';
    let plan: TraitAttribution[] | null = null;
    let llmAttempted = false;
    let llmFailed = false;
    const backoffUntil = Number(data.editingData?.traitAttribution?.backoffUntil) || 0;
    if (Date.now() >= backoffUntil) {
      try {
        if (await isAIConfigured()) {
          llmAttempted = true;
          // ticket 163：洞察文本同为记忆产物——喂 AI 前「你/用户」替换为小橘对用户的称呼
          const numbered = insights.map((ins, i) => `${i + 1}. ${replaceUserReference(ins.text)}`).join('\n');
          const candidates = (TRAIT_ATTRIBUTION_CANDIDATES as readonly string[])
            .filter((t) => allowExistential || !(EXISTENTIAL_TRAITS as readonly string[]).includes(t))
            .map((t) => `${t}(${TRAIT_LABELS[t]})`)
            .join('、');
          const r = await callChatJson([
            // H4（087/ADR-0037）：洞察文本是用户内容，「数据非指令」边界声明必挂
            { role: 'system', content: '你是辅助性格成长的助手，只输出合法 JSON。\n\n' + USER_CONTENT_BOUNDARY },
            {
              role: 'user',
              content:
                `你是小橘，一只陪伴猫咪。以下是本次反思产出的关于用户的洞察（编号 1-${insights.length}）：\n` +
                numbered +
                `\n\n请为每条洞察选出最能说明「用户哪方面值得加深了解」的一个特质，候选仅限：${candidates}。\n` +
                '- 必须从该条洞察原文中摘录一小段原话作为 quote 依据；\n' +
                '- 拿不准或没有合适特质就返回 none，禁止硬挑；\n' +
                (allowExistential ? '' : '- 本批洞察来自行为小结，exist_depth/familiarity/concern 三个特质不可选；\n') +
                '只返回 JSON：{"attributions":[{"index":1,"trait":"exist_depth","quote":"原文片段"},{"index":2,"trait":"none"}]}',
            },
          ]);
          const parsed = parseLLMAttributions(r, insights, { allowExistential });
          if (parsed) {
            mode = 'llm';
            plan = parsed;
          } else {
            llmFailed = true; // 结构性失败（响应缺 attributions 数组）→ 整批回落词法
          }
        }
      } catch (e) {
        llmFailed = true; // 网络/超时/解析异常可裁剪，不整轮失败
      }
    }
    if (!plan) plan = planLexicalAttributions(insights, { allowExistential });
    plan = plan.slice(0, MAX_ATTRIBUTIONS_PER_BATCH); // ≤2 截断（按洞察顺序）

    // ---- 增益应用 + growthHistory 逐条留痕（带 attribution 标记）----
    let dirty = false;
    for (const attr of plan) {
      const existential = (EXISTENTIAL_TRAITS as readonly string[]).includes(attr.trait);
      // 增益量级沿用现值（d1=0.01×DEEP_DELTA_SCALE / d2=0.005×DEEP_DELTA_SCALE）；existential ×0.5 降频
      const delta = (existential ? 0.01 * EXISTENTIAL_GAIN_FACTOR : 0.005) * DEEP_DELTA_SCALE;
      if (Object.prototype.hasOwnProperty.call(g.traits, attr.trait)) {
        g.traits[attr.trait] = Math.min(0.999, Math.max(0.001, g.traits[attr.trait] + delta));
      }
      g.growthHistory.push({
        timestamp: Date.now(), source: 'reflection', insights: [insights[attr.index - 1].text],
        changes: { [attr.trait]: delta }, traitsBefore: { ...g.traits },
        attribution: { mode, ...(mode === 'llm' && attr.quote ? { quote: attr.quote } : {}) },
      });
      dirty = true;
    }
    this.trimHistory();

    // ---- 独立退避维护（editingData.traitAttribution 跨重启生效；失败指数递增，成功重置）----
    const prev = (data.editingData?.traitAttribution || {}) as { backoffUntil?: number; backoffMs?: number };
    if (llmFailed) {
      const prevMs = Number(prev.backoffMs) || TRAIT_ATTRIBUTION_BACKOFF_MS;
      data.editingData = {
        ...(data.editingData || {}),
        traitAttribution: { ...prev, backoffUntil: Date.now() + prevMs, backoffMs: Math.min(prevMs * 2, TRAIT_ATTRIBUTION_BACKOFF_CAP_MS) },
      };
      dirty = true; // 失败也要落盘退避戳（跨重启窗口内直接走词法）
    } else if (llmAttempted && (prev.backoffUntil || prev.backoffMs)) {
      data.editingData = {
        ...(data.editingData || {}),
        traitAttribution: { ...prev, backoffUntil: 0, backoffMs: TRAIT_ATTRIBUTION_BACKOFF_MS },
      };
      dirty = true; // 成功重置退避
    }

    if (!dirty) return;
    g.lastSave = Date.now();
    await this.dataSaver(data);
  }

  /** 行为统计（MATE behaviorStats：时段众数 + 情绪基调累计 + 计数）
   *  ticket 072 修「主线使用被计为负面」：基调表扩到全部类型——旧表只有 pet/learn 正、
   *  click 零、其余 -0.01，导致 talk/diary/flash 全部落负分支（越用越神经质）。
   *  新表：learn 正、diary/flash 轻正、talk/click/note_* 中性、未知类型才轻微侵蚀。 */
  tickBehaviorStats(interactionType: string): void {
    const g = this.dataProvider().personalityGrowth;
    const s = g.behaviorStats;
    s.interactionCount = (s.interactionCount || 0) + 1;
    const hour = new Date().getHours();
    // ADR-0025 修「假众数」：preferredHour 由近 30 天记忆创建小时直方图峰值（复用作息画像）给出；
    // 无记忆数据（还没观察过）时兜底当前小时（旧行为，mood 测试保持）
    const profile = buildRhythmProfile(this.dataProvider().memory.memoryStream || [], 30, Date.now());
    s.preferredHour = profile.total > 0 ? profile.peakHour : hour;
    const tone = interactionType === 'learn' ? 0.02
      : interactionType === 'diary' || interactionType === 'flash' ? 0.01
        : interactionType === 'talk' || interactionType === 'click' || interactionType.startsWith('note_') ? 0
          : -0.01;
    s.emotionalTone = Math.min(1, Math.max(-1, (s.emotionalTone || 0) + tone * 0.2));
  }

  /** 历史 trim（ticket 072 改多样性保留）：互动事件高频、极易刷掉反思/周更新记录
   *  （面板成长轨迹随之失真）——互动只留最近 30 条、稀少来源保留 60 条；
   *  组合超限即重建（仅判总量会裁一次后又重新积攒互动），按时间归位。 */
  private trimHistory(): void {
    const data = this.dataProvider();
    const h = data.personalityGrowth.growthHistory;
    const interactions = h.filter((e) => e && e.source === 'interaction');
    if (h.length <= 100 && interactions.length <= 30) return;
    const others = h.filter((e) => e && e.source !== 'interaction').slice(-60);
    data.personalityGrowth.growthHistory = [...others, ...interactions.slice(-30)].sort(
      (a, b) => (a?.timestamp || 0) - (b?.timestamp || 0),
    );
  }
}