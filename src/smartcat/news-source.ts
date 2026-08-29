/**
 * 聚合讯观察文案层（ticket 076，ADR-0029）：方法监听——
 * news 域 reader 动作（下一篇/保存）直接调 smartcat.notifyNewsRead(事件)/notifyNewsSaved，
 * 文案构造集中本模块（纯函数可测）。
 * 覆盖范围：保存观察（带阅读时长）+ 平台 + 标题；跳过观察（ticket 123 追加：news:skipped → 行为流）；
 * 阅读/跳过文案保留兼容（2026-08-25 用户拍板：reader 只发保存→2026-08-27 追加拍板：跳过也发，
 * 三态文案 read/skipped 保留兼容、saved 实际使用）；
 * 保存联动 auto-summary（方案 a）：待补全登记 → 剪藏 modify 补全完整观察 / 2 分钟降级。
 * 数据语义零改动：news.json / news-stats.json 不落时长（观察携带）；待补全表为内存态（smartcat.json 零改动）。
 *
 * P2b（ticket 123）：新增 buildNewsStructured——构造 StructuredMeta 供行为流写入。
 */
import type { StructuredMeta } from './types';
export type NewsReadState = 'read' | 'skipped' | 'saved';

/** 聚合讯阅读事件（news 域 reader 方法监听 → smartcat.notifyNewsRead / notifyNewsSaved） */
export interface NewsReadEvent {
  title: string;
  platform: string;
  state: NewsReadState;
  /** 取整分钟（≥1；跳过态不带时长文案，字段仍携带） */
  durationMin: number;
}

/** 三态观察文案（用户拍板）；saved = 保存立即形态（无摘要/标签，降级用） */
export function buildNewsReadText(state: NewsReadState, title: string, platform: string, durationMin: number): string {
  switch (state) {
    case 'read':
      return `你阅读了《${title}》（${platform}·读了 ${durationMin} 分钟）`;
    case 'skipped':
      return `你跳过了《${title}》（${platform}）`;
    case 'saved':
      return `你保存了《${title}》（${platform}·读了 ${durationMin} 分钟）`;
  }
}

/** 保存完整观察文案（auto-summary 补全：摘要/标签缺省省略对应段；tags 为数组） */
export function buildNewsSavedFullText(
  title: string,
  platform: string,
  durationMin: number,
  summary: string | null,
  tags: string[] | null,
): string {
  const base = buildNewsReadText('saved', title, platform, durationMin);
  const sum = summary ? `：${summary}` : '';
  const tagText = tags && tags.length ? ' ' + tags.map((t) => `#${t}`).join(' ') : '';
  return base + sum + tagText;
}

// ==================== P2b 结构化元数据（行为流） ====================

/** 聚合讯阅读事件 → StructuredMeta（行为流） */
export function buildNewsReadStructured(evt: NewsReadEvent): StructuredMeta {
  return {
    entityType: 'news', action: evt.state, name: evt.title,
    extras: { platform: evt.platform, durationMin: evt.durationMin },
  };
}

/** 聚合讯保存完整观察 → StructuredMeta（行为流；auto-summary 补全后产出） */
export function buildNewsSavedStructured(
  title: string, platform: string, durationMin: number,
  summary: string | null, tags: string[] | null,
): StructuredMeta {
  return {
    entityType: 'news', action: 'saved', name: title,
    extras: { platform, durationMin, summary: summary ?? undefined, tags: tags ?? undefined },
  };
}
// （剪藏删除构建器已移除，2026-08-29 用户拍板断开 clipping:deleted 行为记录）
