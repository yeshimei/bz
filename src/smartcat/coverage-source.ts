/**
 * ADR-0069 行为流全量盘点补齐——复习计划/题库/附件搬移 观察文案构造层（纯函数可测）。
 *
 * issue 261 接线：review 域（index/app）与 attach 域（ui.runMove）已 emitDomainEvent 派发
 * review/attach 域事件，smartcat index 订阅端调本层构造入行为流（routing：review:started/
 * added/removed/rated、quiz:added/answered、attach:moved）；quiz 已并入 review（quiz-core），
 * 其构造层保留待其动作点接线。
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
