/**
 * 影院（cinema）域常量：类型/状态/评分（复刻自 movie 域，独立成域不共享）
 */
/** 状态枚举（评分推断）：想看=-1 / 在看=0 / 已看=>0 */
export const STATUS_WANT = 0;
export const STATUS_WATCHING = 1;
export const STATUS_WATCHED = 2;

/** 评分制刻度上限（10 分制） */
export const RATING_MAX = 10;
/** 默认评分（标记已看直改默认分；10 分制中点 5） */
export const DEFAULT_RATING = 5;

/** 类型分组：组 → 细分 tag 清单 */
export const TYPE_GROUPS: Record<string, string[]> = {
  电影: ['电影'],
  剧集: ['国产剧', '美剧', '英剧', '德剧', '日剧', '韩剧'],
  动漫: ['日漫', '国漫', '美漫'],
  纪录片: ['纪录片'],
  公开课: ['公开课', 'TED'],
};

export const ALL_TAGS: string[] = Object.values(TYPE_GROUPS).flat();

/** 组展示顺序（左栏/移动端分类条） */
export const GROUP_ORDER: string[] = ['电影', '剧集', '动漫', '纪录片', '公开课', '其他'];

/** 组 → 细分 tag 映射（左栏二级展开用） */
export const GROUP_SUBS: Record<string, string[]> = {
  剧集: ['美剧', '英剧', '国产剧', '日剧', '韩剧', '德剧'],
  动漫: ['日漫', '国漫', '美漫'],
  电影: [],
  纪录片: [],
  公开课: [],
  其他: [],
};

/** 类型色（功能色，双主题一致；与原型一比一） */
export const TYPE_COLORS: Record<string, string> = {
  电影: '#e6951d',
  剧集: '#3d7bd6',
  动漫: '#d64d8f',
  纪录片: '#45a35c',
  公开课: '#9b6dd4',
  其他: '#888',
};

/** 状态色 */
export const STATUS_COLORS: Record<string, string> = {
  想看: '#888',
  在看: '#e6951d',
  已看: '#45a35c',
};

/** tag → 组 */
export function getGroupForTag(tag: string): string | null {
  for (const [group, tags] of Object.entries(TYPE_GROUPS)) {
    if (tags.includes(tag)) return group;
  }
  return null;
}

/** tag → 组（未知 tag 归「其他」） */
export function getGroupSafe(tag: string): string {
  return getGroupForTag(tag) ?? '其他';
}

/**
 * 分 ↔ 星：满星 5 颗 = 10 分，半颗星 = 1 分；分数先 ÷2 得星数，再四舍五入到 0.5 星。
 * 固定 5 星轨道：实心 ★ = 已得整星，空心 ☆ = 半星或未得分。
 * 例：9.6 → ★★★★★；9.2 → ★★★★☆；8.0 → ★★★★☆；5.4 → ★★☆☆☆
 */
export function getStarString(rating: number): string {
  if (!rating || rating <= 0) return '';
  const stars = Math.min(Math.round((rating / 2) * 2) / 2, 5);
  const full = Math.floor(stars);
  let s = '';
  for (let i = 0; i < full; i++) s += '★';
  for (let j = full; j < 5; j++) s += '☆';
  return s;
}
