/**
 * 性格系统（对齐 MATE 论文 v6：Deterministic Emotional Architecture for AI Companions）
 * 从「5 选 1 预设人格」改为「OCEAN 出生种子 + 30 特质成长」：
 *  - ocean: 五因素 0-1（出生随机 N(0.5, 0.15)，落盘一次——「nature provides the seed」）
 *  - traits: 30 项 0-1，9 临床群组（Bowlby/Young/Vaillant/Rotter/Schwartz/Cloninger/Yalom）
 *  - relationship: trust/attachment（MATE 关系张量核心，贯穿性格更新与表达欲）
 *  - behaviorStats: 周统计（时段/频率/构成/情绪）→ character_from_experience
 * 核心：纯函数确定性演化（deterministic boundaries, non-deterministic content），
 * LLM 只读状态向量，不读行为指令。
 */
import type { OceanProfile, CharacterTraits, PersonalityGrowthData } from './types';

/** 30 特质（MATE 论文 Table 2）——9 群组全量
 *  注意：defense 群的 "avoidance" 与 attachment 群的同名；behavioral 群 "depth"
 *  与 existential 群同名——为避免类型歧义，冲突项加群组前缀（如 def_avoidance）。
 */
export const TRAIT_GROUPS = {
  attachment: ['anxiety', 'avoidance', 'separation_tol'],          // Bowlby
  coreBeliefs: ['self_worth', 'world_safety', 'others_trust'],     // Young
  cognitive: ['reflectiveness', 'analytical', 'creativity'],       // Witkin/Kagan
  defense: ['humor', 'intellectual', 'def_avoidance', 'support'],  // Vaillant
  selfConcept: ['locus_control', 'self_esteem', 'self_efficacy'],  // Rotter/Bandura
  values: ['enhancement', 'transcendence', 'change', 'conservation'], // Schwartz
  behavioral: ['warmth', 'directness', 'beh_depth', 'conflict', 'optimism'], // —
  neuro: ['serotonin', 'dopamine', 'oxytocin', 'cortisol'],        // Cloninger
  existential: ['exist_depth', 'familiarity', 'concern'],          // Yalom，从 0.0 起（仅反思成长）
} as const;

export const DEFAULT_TRAITS: CharacterTraits = {
  // attachment (Bowlby)
  anxiety: 0.5, avoidance: 0.5, separation_tol: 0.5,
  // coreBeliefs (Young)
  self_worth: 0.5, world_safety: 0.5, others_trust: 0.5,
  // cognitive
  reflectiveness: 0.5, analytical: 0.5, creativity: 0.5,
  // defense (Vaillant)
  humor: 0.5, intellectual: 0.5, def_avoidance: 0.5, support: 0.5,
  // selfConcept
  locus_control: 0.5, self_esteem: 0.5, self_efficacy: 0.5,
  // values (Schwartz)——双向轴，存 0-1 标量（<0.5 趋第一极，>0.5 趋第二极）
  enhancement: 0.5, transcendence: 0.5, change: 0.5, conservation: 0.5,
  // behavioral
  warmth: 0.5, directness: 0.5, beh_depth: 0.5, conflict: 0.5, optimism: 0.5,
  // neuro (Cloninger)
  serotonin: 0.5, dopamine: 0.5, oxytocin: 0.5, cortisol: 0.5,
  // existential (Yalom)——出生 0.0，仅反思/自省成长
  exist_depth: 0.0, familiarity: 0.0, concern: 0.0,
};

/** 默认 OCEAN（出生种子会在首次落盘时随机生成并固定） */
export const DEFAULT_OCEAN: OceanProfile = {
  openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5,
};

/** 随机 OCEAN 出生种子（MATE: N(0.5, 0.15) 截断到 [0.1, 0.9]） */
export function randomOceanSeed(): OceanProfile {
  const clamp = (v: number) => Math.min(0.9, Math.max(0.1, v));
  const g = (): number => {
    // Box-Muller 近似正态
    const u = Math.random || (() => 0.5);
    const r1 = Math.max(1e-9, u());
    const r2 = Math.max(1e-9, u());
    return clamp(0.5 + 0.15 * Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2));
  };
  return {
    openness: g(), conscientiousness: g(), extraversion: g(), agreeableness: g(), neuroticism: g(),
  };
}

/** character_seed：OCEAN × 逻辑映射 → 初始 30 特质（出生禀赋，MATE §3.2） */
export function characterSeed(ocean: OceanProfile): CharacterTraits {
  const t = { ...DEFAULT_TRAITS };
  const line = (v: number) => Math.min(0.99, Math.max(0.01, v)); // logistic 余量
  const from = (o: number, delta: number) => line(0.5 + (o - 0.5) * delta);
  // OCEAN 关键轴 → 群组初值（开放→认知/存在、外向→行为/神经、宜人→依恋/信念、神经质→神经、尽责→自我概念）
  t.creativity = from(ocean.openness, 0.6);
  t.reflectiveness = from(ocean.openness, 0.5);
  t.analytical = from(ocean.conscientiousness, 0.4);
  t.warmth = from(ocean.agreeableness, 0.6);
  t.others_trust = from(ocean.agreeableness, 0.5);
  t.separation_tol = from(ocean.agreeableness, 0.3);
  t.anxiety = line(0.5 + (ocean.neuroticism - 0.5) * 0.5);
  t.cortisol = line(0.5 + (ocean.neuroticism - 0.5) * 0.6);
  t.serotonin = line(0.5 - (ocean.neuroticism - 0.5) * 0.4);
  t.dopamine = from(ocean.extraversion, 0.6);
  t.optimism = line(0.5 + (ocean.extraversion - 0.5) * 0.4);
  t.self_efficacy = from(ocean.conscientiousness, 0.5);
  t.locus_control = from(ocean.conscientiousness, 0.4);
  t.directness = from(ocean.extraversion, 0.4);
  t.support = from(ocean.agreeableness, 0.4);
  // existential 出生 0.0（仅反思成长）——已由 DEFAULT_TRAITS 覆盖
  return t;
}

/**
 * RL 校准配方（ADR-0024，2026-08-23 正式训练收敛；第 2 轮红队裁决补卡）
 * 生产采用 = 真实库事件流（过去 365 天真实使用）环境最优配方；合成配方对照存档 ADR-0024。
 *   - CHARACTER_DELTA_BASE：0.003 → 0.00083（真实交互稀疏，δ 收敛；合成对照 0.0096）
 *   - TRUST_WARM_GAIN / TRUST_ERODE_GAIN：0.01/0.003 → 0.0082/0.0029（≈0.01×0.824、0.003×0.973）
 *   - TRUST_CAP：0.85 软收拢（2026-08-23 用户拍板——真实密度下纯线性增益必然顶格 99.9%，
 *     RL 预演 reward 0.616→0.823；软收拢更平滑且平衡点留「情感余温」，见 trustUpdate）
 */
export const CHARACTER_DELTA_BASE = 0.00083;
export const TRUST_WARM_GAIN = 0.0082;
export const TRUST_ERODE_GAIN = 0.0029;
export const TRUST_CAP: number | null = 0.85;
/** 软收拢系数（红队 C §5.1）：每信任事件向 cap 收拢 2%，平衡点 v* = cap + K/(1−K)·gain ≈ cap + 49·gain */
export const TRUST_SOFT_K = 0.98;

/** logistic saturation：x + δ(1−x)，永不达 1.0（MATE §3.2） */
export function softUpdate(x: number, delta: number): number {
  const clamped = Math.min(0.999, Math.max(0.001, x));
  return clamped + delta * (1 - clamped);
}

/** character_transition：每条消息微移（MATE §3.2）
 *  δ = δbase × 情绪强度 Σ|eᵢ| × 近因(1 + (1−trust))
 */
export function characterTransition(
  traits: CharacterTraits,
  opts: { emotionIntensity?: number; trust?: number; deltaBase?: number },
): CharacterTraits {
  const I = opts.emotionIntensity ?? 0;
  const trust = opts.trust ?? 0.5;
  const delta = (opts.deltaBase ?? CHARACTER_DELTA_BASE) * I * (1 + (1 - trust));
  if (delta <= 0) return { ...traits };
  const out = { ...traits };
  // 正向微移核心成长特质（warmth/self_worth/others_trust/depth 缓慢积累）
  const keys: (keyof CharacterTraits)[] = ['warmth', 'self_worth', 'others_trust', 'exist_depth', 'optimism', 'humor'];
  for (const k of keys) out[k] = softUpdate(traits[k], delta);
  return out;
}

/** trust 微积分（MATE §3.3 关系张量精简版：体验温度 + 交互质量）
 *  温暖时升、忽冷忽热降（饱和式冷处理），单事件降幅有界
 *  ADR-0024 软收拢：设置 trustCap 时 v = cap + K·(v−cap)（指数趋近，非一刀切硬钳，
 *  平衡点 v* = cap + 49·gain，终态几乎就是 cap + 微量「情感余温」）
 *  ADR-0025 增 neutral：中性事件（click/note_*）不动 trust（原语义非 warm 即侵蚀，
 *  使侵蚀分支在真实调用下成死代码——中性交互不该「冷处理」用户）
 */
export function trustUpdate(current: number, opts: { warm?: boolean; hostile?: boolean; neutral?: boolean; quality?: number; trustCap?: number }): number {
  let v = current;
  if (opts.hostile) v -= 0.04;                          // 敌意/回绝：明确降
  else if (opts.warm) v += TRUST_WARM_GAIN * (opts.quality ?? 0.5); // 温暖互动：缓升（ADR-0024 校准增益）
  else if (!opts.neutral) v -= TRUST_ERODE_GAIN;        // 冷淡/无回应：轻微侵蚀（无标记保持原语义）
  // 中性事件（click/note_*）彻底不动 trust——跳过软收拢（连 cap 收敛也不应改变中性事件的 trust）
  if (opts.neutral) return Math.min(0.999, Math.max(0.05, v));
  if (opts.trustCap != null) v = opts.trustCap + TRUST_SOFT_K * (v - opts.trustCap); // 软收拢（用户拍板 0.85）
  return Math.min(0.999, Math.max(0.05, v));
}

/** character_from_experience：周统计深更新（MATE §3.2，δ≤0.01） */
export function characterFromExperience(
  traits: CharacterTraits,
  stats: { interactionCount?: number; emotionalTone?: number; preferredHour?: number },
): CharacterTraits {
  const out = { ...traits };
  const n = stats.interactionCount ?? 0;
  if (n <= 0) return out;
  const tone = stats.emotionalTone ?? 0;   // -1..1（正=温暖记忆多）
  const sat = (k: keyof CharacterTraits, delta: number) => { out[k] = softUpdate(traits[k], delta); };
  // 高频互动 → sociability 类特质成长（warmth/others_trust）
  sat('warmth', Math.min(0.01, 0.005 + n * 0.0005));
  sat('others_trust', Math.min(0.01, 0.003 + n * 0.0003));
  // 情绪基调：正 → optimism/self_worth 升；负 → anxiety/cortisol 升（MATE §5 病理现象）
  if (tone > 0) { sat('optimism', 0.008); sat('self_worth', 0.006); }
  else if (tone < 0) { sat('anxiety', 0.008); sat('cortisol', 0.006); }
  // 深夜活跃 → arousal 型特征（小橘也夜猫子化）
  if (stats.preferredHour !== undefined && (stats.preferredHour >= 22 || stats.preferredHour < 5)) {
    sat('dopamine', 0.006);
    sat('creativity', 0.004);
  }
  return out;
}

/** 状态向量（MATE §7 压缩注入：决定 if/when/how 的数值，LLM 只读不译） */
export function formatStateVector(g: PersonalityGrowthData, pad: { pleasure: number; arousal: number; dominance: number }, emotion: string | null): string {
  const o = g.ocean;
  const r = g.relationship;
  const keyTraits = ['warmth', 'directness', 'beh_depth', 'humor', 'self_worth', 'anxiety', 'others_trust', 'optimism'] as const;
  const t = keyTraits.map((k) => `${k}=${g.traits[k].toFixed(2)}`).join(' ');
  const emo = emotion ? ` emo=${emotion}` : '';
  return `<state>
PAD=[${pad.pleasure.toFixed(2)},${pad.arousal.toFixed(2)},${pad.dominance.toFixed(2)}]
OCEAN=[${o.openness.toFixed(2)},${o.conscientiousness.toFixed(2)},${o.extraversion.toFixed(2)},${o.agreeableness.toFixed(2)},${o.neuroticism.toFixed(2)}] trust=${r.trust.toFixed(2)} attach=${r.attachment.toFixed(2)}${emo}
char: ${t}
</state>`;
}