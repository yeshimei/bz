/**
 * 影视动作观察文案层（ticket 074，ADR-0026 修订：方法监听）：
 * 用户拍板——观察从「事件快照 diff」（vault create/modify/delete）改为「方法监听」：
 * movie 域 UI 确认回调直接调 smartcat.notifyMovieAction(事件)，文案构造集中本模块（纯函数可测）。
 * 覆盖范围：UI 动作（创建想看/在看/已看、状态流转、评分/改分、写改删影评、删除）；
 * 手改 frontmatter、正文记内容、自动保存连发一律不观察（用户拍板放弃——防逐字编辑刷屏，
 * 方法监听天然零噪音且一次动作一条）。
 * 数据语义零改动：状态 = movie 域枚举 want/watching/watched。
 */
export type MovieStatus = 'want' | 'watching' | 'watched';

/** 影视动作事件（movie 域确认回调 → smartcat.notifyMovieAction） */
export type MovieActionEvent =
  | { kind: 'created'; name: string; status: MovieStatus; rating: number | null; review: string | null }
  | { kind: 'status'; name: string; from: MovieStatus; to: MovieStatus }
  | { kind: 'rated'; name: string; fromRating: number | null; toRating: number }
  | { kind: 'review'; name: string; fromReview: string | null; toReview: string | null }
  | { kind: 'deleted'; name: string };

/** 创建观察文案（已看合并评分与影评；评分/影评缺省省略对应段） */
export function movieCreatedText(name: string, status: MovieStatus, rating: number | null, review: string | null): string {
  switch (status) {
    case 'want':
      return `你把《${name}》加入想看`;
    case 'watching':
      return `你开始看《${name}》`;
    case 'watched': {
      const done = `你看完了《${name}》`;
      const rated = rating !== null && rating > 0 ? `，给了 ${rating} 分` : '';
      const reviewed = review ? `，写了影评：${review.slice(0, 80)}` : '';
      return done + rated + reviewed;
    }
  }
}

const STATUS_LABEL: Record<MovieStatus, string> = { want: '想看', watching: '在看', watched: '已看' };

/** 状态流转观察文案：顺向完成（想/在 → 已）用「你看完了」，回退显式描述 */
export function movieStatusChangeText(name: string, from: MovieStatus, to: MovieStatus): string {
  if (to === 'watched' && from !== 'watched') return `你看完了《${name}》`;
  if (to === 'want' && from === 'watched') return `你把《${name}》改回想看`;
  return `你把《${name}》从${STATUS_LABEL[from]}改为${STATUS_LABEL[to]}`;
}

/** 评分/改分观察文案：from 无有效分（null/<=0）→ 首次评分，否则改分 */
export function movieRatedText(name: string, fromRating: number | null, toRating: number): string {
  const fromScored = fromRating !== null && fromRating > 0;
  return fromScored ? `你把《${name}》的评分从 ${fromRating} 改为 ${toRating}` : `你给《${name}》评了 ${toRating} 分`;
}

/** 影评观察文案（写/改/删；空串视为无；无变化返回 null） */
export function movieReviewText(name: string, fromReview: string | null, toReview: string | null): string | null {
  const from = fromReview || null;
  const to = toReview || null;
  if (from === to) return null;
  if (!from && to) return `你写了《${name}》的影评：${to.slice(0, 80)}`;
  if (from && to) return `你改了《${name}》的影评：${to.slice(0, 80)}`;
  return `你删掉了《${name}》的影评`;
}

/** 删除观察文案 */
export function movieDeletedText(name: string): string {
  return `你删除了《${name}》的影视记录`;
}

/** 事件 → 观察文本（smartcat.notifyMovieAction 调用；无变化返回 null） */
export function buildMovieActionText(evt: MovieActionEvent): string | null {
  switch (evt.kind) {
    case 'created':
      return movieCreatedText(evt.name, evt.status, evt.rating, evt.review);
    case 'status':
      return movieStatusChangeText(evt.name, evt.from, evt.to);
    case 'rated':
      return movieRatedText(evt.name, evt.fromRating, evt.toRating);
    case 'review':
      return movieReviewText(evt.name, evt.fromReview, evt.toReview);
    case 'deleted':
      return movieDeletedText(evt.name);
  }
}