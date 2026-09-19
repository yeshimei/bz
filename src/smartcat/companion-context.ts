/**
 * 懂你上下文块（ADR-0025：小橘「感知→共情→记忆→表达」闭环的 B 面）
 * 把作息（rhythm）/情绪趋势（cognitive）/信任依恋（relationship）/检索记忆（调用方已格式化）
 * 组装成一段统一的背景知识，供聊天/自言自语/欢迎回来/书评/主动关心注入——
 * 各通道表达一致：「关掉聊天窗口，小橘也记得你」。
 * 纯函数（无 DOM/无异步）；记忆文本由调用方先检索再传入。
 */
import { describeRhythm, buildRhythmProfile, periodText } from './rhythm';
import { analyzeEmotionTrend, buildEmotionSnapshots, describeEmotionTrend } from './cognitive';
// A4（2026-09-19 审计）：缺席状态机接线——原先只进 dashboard 卡片，对话侧完全不知道「多久没见」
import { readAbsenceState, daysSincePresence } from './absence';
// ticket 163：生成的背景行涉及用户（「你通常…」「你和小橘的关系」）——喂 AI 前替换为称呼
import { replaceUserReference } from './memory';

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
  /** 编辑态数据（缺席状态机 phase/since + lastPresenceAt）；缺省则不注入「多久没见」行 */
  editingData?: { absenceState?: unknown; lastPresenceAt?: unknown } | null;
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

  const rel = i.relationship;
  if (rel && typeof rel.trust === 'number') {
    const attach = typeof rel.attachment === 'number' ? ` / 依恋 ${rel.attachment.toFixed(2)}` : '';
    parts.push(replaceUserReference(`你和小橘的关系：信任 ${rel.trust.toFixed(2)}${attach}`));
  }

  // A4（2026-09-19 审计）：缺席状态进对话——机制早已就绪（ADR-0040 单一缺席状态机），
  // 但此前只进 dashboard 卡片，聊天/主动关心/prompt 全都不含它（最像人的设计躲在没人点的卡片里）。
  const ed = i.editingData;
  if (ed) {
    const phase = readAbsenceState(ed).phase;
    const days = daysSincePresence(ed.lastPresenceAt, now);
    if (phase === 'missing' && days >= 1) {
      parts.push(replaceUserReference(`你已经 ${days} 天没出现了，小橘一直惦记着这件事`));
    } else if (phase === 'reunion') {
      parts.push(replaceUserReference('小橘刚重新见到你（你之前离开了一阵子，它有点高兴）'));
    }
  }

  const lines: string[] = [];
  if (parts.length) lines.push('- ' + parts.join('\n- '));
  if (i.memoriesText) lines.push('### 相关记忆（小橘记得的事）\n' + i.memoriesText);
  return lines.join('\n\n');
}