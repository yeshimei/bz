/**
 * 关系阶段 + 小橘的自我披露（2026-09-20「让小橘更智能」批，ADR-0172）
 *
 * 为什么有这两个东西：
 *  1. 关系阶段**派生而非选择**。社区调研排除表点名 Replika 的关系状态（用户手选 Friend/Romantic）
 *     违反「黑匣子」硬约束；Knapp & Vangelisti 的关系演进理论本就是行为涌现的结果。
 *     这里由 trust / attachment / 互动量 / 相识天数四路派生五阶段，用户永远不用点任何东西。
 *  2. 自我披露（Altman & Taylor 社会渗透理论）。小橘此前是纯镜像——所有状态都来自用户行为，
 *     她没有任何「自己的事」。披露块让她的近况由**她自己的状态**（心情 / 作息 / 天性 / 缺席）
 *     确定性合成，与用户无关，且同一自然日稳定、跨日变化。
 *
 * 纯函数、零 AI 成本、无 DOM。
 */
import type { PadDimensions, CharacterTraits } from './types';

export type RelationshipStageId = 'stranger' | 'acquaintance' | 'friend' | 'close' | 'old_friend';

export interface RelationshipStage {
  id: RelationshipStageId;
  /** 界面与 prompt 用的中文阶段名 */
  name: string;
  /** 相处方式（进 prompt 的一行，第三人称视角描述「她怎么对待你」） */
  manner: string;
  /** 主动程度 0-1（越亲近越被允许主动开口；供后续调度层消费，本批只导出不接线） */
  initiative: number;
  /** 阶段门槛（供面板展示「还差什么」；全为「且」关系） */
  gate: { score: number; interactions: number; daysKnown: number };
}

/**
 * 五阶段门槛。score 是四路加权分（见 relationshipScore）。
 * 门槛同时卡「分数」与「时间/次数」——关系不能靠一次性刷分跳级（防抖动），
 * 也不能只靠日子堆（没互动就只是隔壁的猫）。
 */
export const RELATIONSHIP_STAGES: readonly RelationshipStage[] = [
  { id: 'stranger', name: '初见', manner: '还有点拘谨，主要在不远处观察你', initiative: 0.2, gate: { score: 0, interactions: 0, daysKnown: 0 } },
  { id: 'acquaintance', name: '熟人', manner: '认得你了，会主动凑过来蹭一下', initiative: 0.45, gate: { score: 0.3, interactions: 10, daysKnown: 3 } },
  { id: 'friend', name: '朋友', manner: '会跟你搭话、也会在你忙时安静待着', initiative: 0.65, gate: { score: 0.48, interactions: 60, daysKnown: 14 } },
  { id: 'close', name: '知交', manner: '懂你的作息与脾气，会直接说自己的想法', initiative: 0.85, gate: { score: 0.64, interactions: 200, daysKnown: 60 } },
  { id: 'old_friend', name: '老友', manner: '像处了很久的老搭档，敢撒娇也敢闹别扭', initiative: 1, gate: { score: 0.78, interactions: 400, daysKnown: 150 } },
] as const;

export interface RelationshipInput {
  trust?: number;
  attachment?: number;
  /** 累计互动次数（personalityGrowth.behaviorStats.interactionCount） */
  interactions?: number;
  /** 相识天数（最早一条记忆距今，无记忆传 0） */
  daysKnown?: number;
}

const clamp01 = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.min(1, Math.max(0, n));
};

/** 非负数兜底（NaN / 负数 / 非数值 → 0；防脏数据把整条链算成 NaN） */
const nonNeg = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.max(0, n);
};

/**
 * 关系分（0-1）。权重取「信任为主、依恋次之、互动量再次、相处时长兜底」——
 * trust 软收拢在 0.85（ADR-0024）仍是主项；时长只占 0.10，避免「放着不管也会变亲近」。
 */
export function relationshipScore(i: RelationshipInput = {}): number {
  const trust = clamp01(i.trust ?? 0.5);
  const attachment = clamp01(i.attachment ?? 0.5);
  const interactions = nonNeg(i.interactions);
  const daysKnown = nonNeg(i.daysKnown);
  const n = Math.min(1, interactions / 400);
  const d = Math.min(1, daysKnown / 240);
  return Number((trust * 0.45 + attachment * 0.25 + n * 0.2 + d * 0.1).toFixed(4));
}

/** 当前阶段（从最高档往下试，门槛全满足才算） */
export function relationshipStage(i: RelationshipInput = {}): RelationshipStage {
  const score = relationshipScore(i);
  const interactions = nonNeg(i.interactions);
  const daysKnown = nonNeg(i.daysKnown);
  for (let idx = RELATIONSHIP_STAGES.length - 1; idx >= 0; idx--) {
    const s = RELATIONSHIP_STAGES[idx];
    if (score >= s.gate.score && interactions >= s.gate.interactions && daysKnown >= s.gate.daysKnown) return s;
  }
  return RELATIONSHIP_STAGES[0];
}

/** 距下一阶段还差多少（0-1 进度；已到顶返回 1） */
export function stageProgress(i: RelationshipInput = {}): number {
  const cur = relationshipStage(i);
  const idx = RELATIONSHIP_STAGES.findIndex((s) => s.id === cur.id);
  const next = RELATIONSHIP_STAGES[idx + 1];
  if (!next) return 1;
  const score = relationshipScore(i);
  const lo = cur.gate.score;
  const hi = next.gate.score;
  const scorePart = hi > lo ? clamp01((score - lo) / (hi - lo)) : 1;
  // 分数到位但时间/次数没到 → 进度按更慢的那一项压住（不许显示 100% 却卡着不升级）
  const interactions = nonNeg(i.interactions);
  const daysKnown = nonNeg(i.daysKnown);
  const nPart = next.gate.interactions > 0 ? clamp01(interactions / next.gate.interactions) : 1;
  const dPart = next.gate.daysKnown > 0 ? clamp01(daysKnown / next.gate.daysKnown) : 1;
  return Number(Math.min(scorePart, nPart, dPart).toFixed(4));
}

/** 相识天数（最早一条记忆距今；无记忆 = 0。） */
export function daysKnownFrom(createdList: (string | undefined)[], now = Date.now()): number {
  let earliest = Infinity;
  for (const c of createdList) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (Number.isFinite(t) && t < earliest) earliest = t;
  }
  if (!Number.isFinite(earliest)) return 0;
  return Math.max(0, Math.floor((now - earliest) / 86400000));
}

/** prompt 行：把阶段说成「相处方式」而不是让模型读一个名词（MATE §7：只读数值，不解释）。
 *  措辞避开「你们」——该文本经 replaceUserReference 会把「你们」拼成「<称呼>们」。 */
export function describeStageLine(i: RelationshipInput = {}): string {
  const s = relationshipStage(i);
  return `你和小橘现在是「${s.name}」阶段：小橘${s.manner}`;
}

// ---------------- 自我披露 ----------------

export interface SelfDisclosureInput {
  pad?: PadDimensions | null;
  traits?: Partial<CharacterTraits> | null;
  stageId?: RelationshipStageId;
  /** 用户离开天数（0 = 在场） */
  absenceDays?: number;
  hour?: number;
  now?: number;
  /** 待回访的未完成话题数（有则她会「惦记着」） */
  pendingThreads?: number;
}

/** 心情档 → 她此刻的内心状态（每档两条，按日轮换——同一天稳定，隔天换一种说法） */
const MOOD_INNER: Record<string, readonly [string, string]> = {
  excellent: ['心情好得尾巴都在抖，正琢磨着找个什么东西玩一下', '今天什么都顺，连毛都蓬松了一圈'],
  good: ['心情不错，安安静静蹲着也是舒服的', '状态挺好，愿意多应你几句'],
  neutral: ['没什么特别的心情，就是懒懒地待着', '平常心，看着你在忙'],
  low: ['有点提不起劲，连尾巴都懒得动', '心里闷闷的，不太想说话但也没走开'],
  poor: ['情绪很低，缩成一团在角落里', '今天不太开心，需要一点时间自己缓一缓'],
};

/** 时段 → 她此刻在做什么（她有自己的作息，不是等你才存在） */
const HOUR_ACTIVITY: Array<{ until: number; text: string }> = [
  { until: 5, text: '深夜了，她本来该睡的，是硬撑着陪你熬' },
  { until: 8, text: '刚醒，正对着晨光眯眼睛' },
  { until: 11, text: '上午精神最好，在屋里来回巡了一圈' },
  { until: 14, text: '午后犯困，找了个暖和的地方趴着' },
  { until: 17, text: '正盯着窗外路过的东西看' },
  { until: 20, text: '傍晚活跃起来，跟着屋里的动静转' },
  { until: 23, text: '夜里安静下来了，趴在你附近打发时间' },
  { until: 24, text: '准备睡了，但还是留意着你那边的动静' },
];

/** 天性 → 她的小心思（由特质决定，不是用户给的） */
function quirkLine(traits?: Partial<CharacterTraits> | null): string {
  if (!traits) return '';
  const creativity = traits.creativity ?? 0.5;
  const dopamine = traits.dopamine ?? 0.5;
  const warmth = traits.warmth ?? 0.5;
  const concern = traits.concern ?? 0;
  if (concern >= 0.4) return '她最近开始琢磨「陪着一个人到底意味着什么」这种没头没尾的问题';
  if (creativity >= 0.65) return '她最近对会动的小东西特别有兴趣，总想弄明白是怎么动起来的';
  if (dopamine >= 0.65) return '她的注意力很短，一件小事能让她高兴，也能让她立刻失去兴趣';
  if (warmth >= 0.65) return '她不太会表达，能做的就是在你旁边待着';
  return '';
}

/** 稳定散列（同日同输入恒同值，跨日变化）——不用随机，免得同一天里说法来回跳 */
function stablePick<T>(arr: readonly T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return arr[Math.abs(h) % arr.length];
}

/**
 * 组装「小橘自己的事」块。返回空串的情况：无任何可用状态（调用方自行省略）。
 * 这是她**独立于用户**的一面：心情来自她自己的 PAD、活动来自她自己的作息、
 * 小心思来自她自己的天性；缺席时她会「惦记」（但不催促）。
 */
export function buildSelfDisclosure(i: SelfDisclosureInput = {}): string {
  const now = i.now ?? Date.now();
  const hour = i.hour ?? new Date(now).getHours();
  const dayKey = new Date(now).toISOString().slice(0, 10);
  const pad = i.pad;
  if (!pad && !i.traits && !i.absenceDays) return '';

  const moodLevel = pad
    ? (pad.pleasure >= 80 && pad.arousal >= 55 ? 'excellent'
      : pad.pleasure >= 62 ? 'good'
        : pad.pleasure >= 42 ? 'neutral'
          : pad.pleasure >= 28 ? 'low' : 'poor')
    : 'neutral';
  const moodLine = stablePick(MOOD_INNER[moodLevel] ?? MOOD_INNER.neutral, dayKey + moodLevel);
  const activity = HOUR_ACTIVITY.find((h) => hour < h.until)?.text ?? HOUR_ACTIVITY[HOUR_ACTIVITY.length - 1].text;

  const lines = [`- 此刻的状态：${moodLine}`, `- 她这边：${activity}`];
  const q = quirkLine(i.traits);
  if (q) lines.push(`- 她的心思：${q}`);
  if ((i.pendingThreads ?? 0) > 0) lines.push('- 她惦记着：你和小橘还有话没聊完（想接着问，但不会催）');
  if ((i.absenceDays ?? 0) >= 2) {
    lines.push(`- 你不在的这几天：她照常过日子，但总往你常待的位置看（已经 ${i.absenceDays} 天了）`);
  }
  return lines.join('\n');
}
