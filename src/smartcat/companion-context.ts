/**
 * 懂你上下文块（ADR-0025：小橘「感知→共情→记忆→表达」闭环的 B 面）
 * 把作息（rhythm）/情绪趋势（cognitive）/信任依恋（relationship）/检索记忆（调用方已格式化）
 * 组装成一段统一的背景知识，供聊天/自言自语/欢迎回来/书评/主动关心注入——
 * 各通道表达一致：「关掉聊天窗口，小橘也记得你」。
 * 纯函数（无 DOM/无异步）；记忆文本由调用方先检索再传入。
 */
import { describeRhythm, buildRhythmProfile, periodText } from './rhythm';
import { analyzeEmotionTrend, buildEmotionSnapshots, describeEmotionTrend } from './cognitive';

export interface CompanionContextInput {
  /** 记忆流条目（作息/趋势分析的数据源） */
  stream?: { created?: string; emotion?: string; importance?: number }[];
  /** 关系张量（PersonalityGrowth.relationship） */
  relationship?: { trust?: number; attachment?: number } | null;
  /** 当前瞬时情绪（可选，作为趋势补充上下文） */
  emotion?: string | null;
  /** 当前小时（默认取 now 的小时） */
  hour?: number;
  /** 检索记忆已格式化文本（formatMemoriesForPrompt 输出；可选） */
  memoriesText?: string;
  now?: number;
}

/** 组装「懂你上下文块」：无任何可用信号时返回空串（调用方自行省略） */
export function buildCompanionContext(i: CompanionContextInput): string {
  const now = i.now ?? Date.now();
  const stream = i.stream || [];
  const hour = i.hour ?? new Date(now).getHours();
  const parts: string[] = [];

  const profile = buildRhythmProfile(stream as any, 30, now);
  const rhythmLine = profile.total >= 3
    ? `你通常在${describeRhythm(profile)}最活跃（现在是${periodText(hour)}）`
    : '';
  if (rhythmLine) parts.push(rhythmLine);

  const snaps = buildEmotionSnapshots(stream);
  const trend = analyzeEmotionTrend(snaps);
  if (trend.count >= 1) parts.push(describeEmotionTrend(trend));

  const rel = i.relationship;
  if (rel && typeof rel.trust === 'number') {
    const attach = typeof rel.attachment === 'number' ? ` / 依恋 ${rel.attachment.toFixed(2)}` : '';
    parts.push(`你和小橘的关系：信任 ${rel.trust.toFixed(2)}${attach}`);
  }

  const lines: string[] = [];
  if (parts.length) lines.push('- ' + parts.join('\n- '));
  if (i.memoriesText) lines.push('### 相关记忆（小橘记得的事）\n' + i.memoriesText);
  return lines.join('\n\n');
}