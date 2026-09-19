/**
 * 懂你上下文块（ADR-0025：小橘「感知→共情→记忆→表达」闭环的 B 面）
 * 把作息（rhythm）/情绪趋势（cognitive）/关系阶段（relationship）/缺席（absence）/
 * 检索记忆（调用方已格式化）/小橘自己的事（自我披露）/未聊完的线（open threads）
 * 组装成一段统一的背景知识，供聊天/自言自语/欢迎回来/书评/主动关心注入——
 * 各通道表达一致：「关掉聊天窗口，小橘也记得你」。
 *
 * 2026-09-20 ADR-0172 起分两半：
 *  - **你的一半**（作息/趋势/关系/缺席/记忆）——她了解你；
 *  - **她的一半**（自我披露/她惦记的线）——她也有自己的状态，不是只会复述你的镜子。
 * 纯函数（无 DOM/无异步）；记忆文本由调用方先检索再传入。
 */
import { describeRhythm, buildRhythmProfile, periodText } from './rhythm';
import { analyzeEmotionTrend, buildEmotionSnapshots, describeEmotionTrend } from './cognitive';
// A4（2026-09-19 审计）：缺席状态机接线——原先只进 dashboard 卡片，对话侧完全不知道「多久没见」
import { readAbsenceState, daysSincePresence } from './absence';
// ticket 163：生成的背景行涉及用户（「你通常…」「你和小橘的关系」）——喂 AI 前替换为称呼
import { replaceUserReference } from './memory';
// ADR-0172：关系阶段派生 + 自我披露 + 追问线
import { relationshipStage, daysKnownFrom, buildSelfDisclosure, describeStageLine } from './relationship';
import { formatOpenThreads, pendingThreads, type OpenThread } from './open-threads';
import type { PadDimensions, CharacterTraits } from './types';

export interface CompanionContextInput {
  /** 记忆流条目（作息/趋势分析的数据源） */
  memoryStream?: { created?: string; emotion?: string; importance?: number }[];
  /** 关系张量（PersonalityGrowth.relationship） */
  relationship?: { trust?: number; attachment?: number } | null;
  /** 当前瞬时情绪（可选，作为趋势补充上下文） */
  emotion?: string | null;
  /** 当前小时（默认取 now 的小时） */
  hour?: number;
  /** 检索记忆已格式化文本（formatMemoriesForPrompt 输出；可选） */
  memoriesText?: string;
  /** 编辑态数据（缺席状态机 phase/since + lastPresenceAt + openThreads）；缺省则不注入相关行 */
  editingData?: { absenceState?: unknown; lastPresenceAt?: unknown; openThreads?: unknown } | null;
  /** 累计互动次数（关系阶段派生；缺省 0） */
  interactionCount?: number;
  /** 当前 PAD（自我披露用；缺省中性） */
  pad?: PadDimensions | null;
  /** 性格特质（自我披露的「小心思」用；缺省省略） */
  traits?: Partial<CharacterTraits> | null;
  now?: number;
}

/** 组装「懂你上下文块」：无任何可用信号时返回空串（调用方自行省略） */
export function buildCompanionContext(i: CompanionContextInput): string {
  const now = i.now ?? Date.now();
  const stream = i.memoryStream || [];
  const hour = i.hour ?? new Date(now).getHours();
  const parts: string[] = [];

  const profile = buildRhythmProfile(stream as any, 30, now);
  const rhythmLine = profile.total >= 3
    ? replaceUserReference(`你通常在${describeRhythm(profile)}最活跃（现在是${periodText(hour)}）`)
    : '';
  if (rhythmLine) parts.push(rhythmLine);

  const snaps = buildEmotionSnapshots(stream);
  const trend = analyzeEmotionTrend(snaps);
  if (trend.count >= 1) parts.push(replaceUserReference(describeEmotionTrend(trend)));

  // 关系：2026-09-20 ADR-0172 起由「两个小数」升格为**派生阶段**——数字没人读得出含义，
  // 「你们现在是朋友」模型才知道该怎么说话（Knapp 阶段理论：相处方式随阶段变，不由用户选）
  const rel = i.relationship;
  const daysKnown = daysKnownFrom(stream.map((m) => m.created), now);
  const relInput = {
    trust: rel?.trust,
    attachment: rel?.attachment,
    interactions: i.interactionCount,
    daysKnown,
  };
  if (rel && typeof rel.trust === 'number') {
    const st = relationshipStage(relInput);
    const attach = typeof rel.attachment === 'number' ? ` / 依恋 ${rel.attachment.toFixed(2)}` : '';
    parts.push(replaceUserReference(`${describeStageLine(relInput)}（信任 ${rel.trust.toFixed(2)}${attach}）`));
    // 越亲近，越允许她说自己想说的（阶段 → 表达许可；不涉及任何调度改动）
    if (st.initiative >= 0.65) parts.push('你和小橘的相处已经够久了，她可以直接说自己的想法，不用一直顺着你');
  }

  // A4（2026-09-19 审计）：缺席状态进对话——机制早已就绪（ADR-0040 单一缺席状态机），
  // 但此前只进 dashboard 卡片，聊天/主动关心/prompt 全都不含它（最像人的设计躲在没人点的卡片里）。
  const ed = i.editingData;
  let absenceDays = 0;
  if (ed) {
    const phase = readAbsenceState(ed).phase;
    absenceDays = daysSincePresence(ed.lastPresenceAt, now);
    if (phase === 'missing' && absenceDays >= 1) {
      parts.push(replaceUserReference(`你已经 ${absenceDays} 天没出现了，小橘一直惦记着这件事`));
    } else if (phase === 'reunion') {
      parts.push(replaceUserReference('小橘刚重新见到你（你之前离开了一阵子，它有点高兴）'));
    }
  }

  const lines: string[] = [];
  if (parts.length) lines.push('- ' + parts.join('\n- '));

  // —— 她的一半（ADR-0172）：自己的状态 + 惦记的线。与「你的一半」相邻注入，
  // 模型更容易在同一句话里体现「她有自己的事」与「她了解你」。
  const threads: OpenThread[] = Array.isArray(ed?.openThreads) ? (ed!.openThreads as OpenThread[]) : [];
  const disclosure = buildSelfDisclosure({
    pad: i.pad ?? null,
    traits: i.traits ?? null,
    absenceDays,
    hour,
    now,
    pendingThreads: pendingThreads(threads, now).length,
  });
  if (disclosure) {
    // ticket 163 同口径：喂 AI 前把「你/用户」替换为称呼（与上面几行一致）
    lines.push('### 小橘自己的事（不是用户的事——她有不依赖你的状态，可自然流露，别报菜名）\n' + replaceUserReference(disclosure));
  }

  const threadBlock = formatOpenThreads(threads, now);
  if (threadBlock) lines.push(threadBlock);

  if (i.memoriesText) lines.push('### 相关记忆（小橘记得的事）\n' + i.memoriesText);
  return lines.join('\n\n');
}
