/**
 * ADR-0069 行为流全量盘点补齐——复习计划/题库/入口页/附件搬移 观察文案构造层（纯函数可测）。
 *
 * 这四域（review/quiz/launcher/attach）当前 UI 不经 emitDomainEvent 派发域事件、历史上从未接入
 * addObservation；本模块按 ADR「全面补齐」把文案构造先行落为纯函数（routing 已有对应 behavior
 * 规则：review:started/added/removed/rated、quiz:added/answered、launcher:opened、attach:moved），
 * 域侧后续接线时只需 emitDomainEvent(域名, 载荷) + 订阅端调本层构造即可，文案口径集中此处。
 * 密码域/加密域为 ADR-0069 隐私豁免（routing exempt，不写任何流），不设文案构造。
 */
import type { StructuredMeta } from './types';

/** 复习评分档位（对齐 review 域 reviewMarkRating 的四档） */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/** 复习计划事件动作面 */
export type ReviewAction = 'started' | 'added' | 'removed' | 'rated';

/**
 * 复习计划动作 → StructuredMeta（行为流，review:* 路由）。
 * started 无条目名（整场复习开始）；added/removed/rated 带条目名；rated 另带评分档位。
 */
export function buildReviewStructured(action: ReviewAction, name?: string, rating?: ReviewRating): StructuredMeta | null {
  if (action === 'started') {
    return { entityType: 'review', action: 'started' };
  }
  const n = String(name || '').trim();
  if (!n) return null;
  return {
    entityType: 'review', action,
    name: n,
    extras: rating ? { rating } : undefined,
  };
}

/**
 * 题库动作 → StructuredMeta（行为流，quiz:* 路由）。
 * added 带题目名；answered 带题目名与对错（correct 缺省不记对错）。
 */
export function buildQuizAddedStructured(name: string): StructuredMeta | null {
  const n = String(name || '').trim();
  if (!n) return null;
  return { entityType: 'quiz', action: 'added', name: n };
}

export function buildQuizAnsweredStructured(name: string, correct?: boolean): StructuredMeta | null {
  const n = String(name || '').trim();
  if (!n) return null;
  return {
    entityType: 'quiz', action: 'answered', name: n,
    extras: typeof correct === 'boolean' ? { correct } : undefined,
  };
}

/** 入口页打开 → StructuredMeta（行为流，launcher:opened 路由；无条目概念，仅动作本身） */
export function buildLauncherOpenedStructured(): StructuredMeta {
  return { entityType: 'launcher', action: 'opened' };
}

/**
 * 附件搬移 → StructuredMeta（行为流，attach:moved 路由）；count = 搬移附件数（缺省/非正不带计数）。
 */
export function buildAttachMovedStructured(count?: number): StructuredMeta {
  return {
    entityType: 'attach', action: 'moved',
    count: typeof count === 'number' && count > 0 ? count : undefined,
    extras: typeof count === 'number' && count > 0 ? { count } : undefined,
  };
}
