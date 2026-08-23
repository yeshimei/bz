/**
 * 聚合讯观察文案层（ticket 076，ADR-0029）：方法监听——
 * news 域 reader 动作（下一篇/保存）直接调 smartcat.notifyNewsRead(事件)/notifyNewsSaved，
 * 文案构造集中本模块（纯函数可测）。
 * 覆盖范围：逐篇三态（阅读/跳过/保存）+ 阅读时长 + 平台 + 标题；
 * 保存联动 auto-summary（方案 a）：待补全登记 → 剪藏 modify 补全完整观察 / 2 分钟降级。
 * 数据语义零改动：news.json / news-stats.json 不落时长（观察携带）；待补全表为内存态（smartcat.json 零改动）。
 */
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