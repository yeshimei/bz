/**
 * 影院（cinema）域常量：类型/状态/评分（复刻自 movie 域，独立成域不共享）
 */
/**
 * 状态枚举：想看=0 / 在看=1 / 已看=2（面板筛选/徽标等消费口径）。
 * 注意与「评分编码」是两套数值（错位勿混）：评分 -1=想看 / 0=在看 / >0=已看，
 * 评分 → 状态枚举的推断在 data.ts parseMovieFile（rating === -1/0/其余）。
 */
export const STATUS_WANT = 0;
export const STATUS_WATCHING = 1;
export const STATUS_WATCHED = 2;

/**
 * 默认评分（编辑窗预填默认分；10 分制中点 5）。
 * 评分编码口径（≠上方状态枚举）：-1=想看 / 0=在看 / >0（或无评分）=已看，
 * 消费推断唯一落点 data.ts parseMovieFile。
 */
export const DEFAULT_RATING = 5;

/**
 * 文件名非法字符集（Windows 保留集；名称源自文件名《X》，改名拦截/海报落盘替换共用）：
 * 域内统一从此取口径，禁止各处内联字符类（审查批 C 收敛）。
 * 消费：douban-fetcher（海报文件名替换 `_`）；ui.ts 改名拦截 ILLEGAL_NAME_RE 待收口切换。
 */
export const ILLEGAL_NAME_CHARS = '\\\\/:*?"<>|';
/** 同字符集的整词正则（.test() 拦截用；供 ui.ts 侧后续一行切换） */
export const ILLEGAL_NAME_RE = new RegExp(`[${ILLEGAL_NAME_CHARS}]`);
/** 同字符集的全局正则（.replace 全量替换用；douban-fetcher 海报文件名清洗） */
export const ILLEGAL_NAME_RE_GLOBAL = new RegExp(`[${ILLEGAL_NAME_CHARS}]`, 'g');

/** 类型分组：组 → 细分 tag 清单 */
export const TYPE_GROUPS: Record<string, string[]> = {
  电影: ['电影'],
  剧集: ['国产剧', '美剧', '英剧', '德剧', '日剧', '韩剧', '哥伦比亚剧'],
  动漫: ['日漫', '国漫', '美漫'],
  纪录片: ['纪录片'],
  公开课: ['公开课', 'TED'],
};

export const ALL_TAGS: string[] = Object.values(TYPE_GROUPS).flat();

/** 组展示顺序（左栏/移动端分类条） */
export const GROUP_ORDER: string[] = ['电影', '剧集', '动漫', '纪录片', '公开课', '其他'];

/** 类型色（功能色，双主题一致；与原型一比一） */
export const TYPE_COLORS: Record<string, string> = {
  电影: '#e6951d',
  剧集: '#3d7bd6',
  动漫: '#d64d8f',
  纪录片: '#45a35c',
  公开课: '#9b6dd4',
  其他: '#888',
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

// ======================= 风格框架（issue 236 / ADR-0103） =======================

// 当前仅午夜场上岸（gazette/booth 为 styles.css 预留段，设置项见 settings.ts）；
// 未来多风格时在此定义风格 id 联合类型（读设置取值属行为层，ADR-0104 纯度守卫）。
