/**
 * 影院（cinema）域常量：类型/状态/评分（复刻自 movie 域，独立成域不共享）
 */
/**
 * 状态枚举：想看=0 / 在看=1 / 已看=2（面板筛选/徽标等消费口径）。
 * 状态落盘单源键「状态」（想看/在看/已看，2026-09-30 拍板）：评分编码 -1/0 已退役，
 * 兼容推断已随退役收尾移除（2026-10-03）——无「状态」键一律按已看（parseMovieFile）。
 */
export const STATUS_WANT = 0;
export const STATUS_WATCHING = 1;
export const STATUS_WATCHED = 2;

/** 一刷记录（`重看` 数组的一项；ADR-0240）。
 *  at = 重温时刻（新档 `YYYY-MM-DD HH:mm:ss`，旧 date-only 档照旧）；
 *  rating = 这一刷的评分（10 分制；null = 该刷没打分，不进平均分母）。
 *  **首看不属于本数组**——它占第 1 刷，评分落在条目 `rating`（首评分）里，永不被重温覆盖。 */
export interface Rewatch {
  at: string;
  rating: number | null;
}

/** 刷数口径（唯一真理）：首看占 1 刷 + 重温次数。卡片「N刷」角标 / 详情「N 刷」徽标 /
 *  重温通知共用——禁各处再拼第二套算法。放 constants（shared.ts 纯层白名单内可值导入） */
export function rewatchCount(it: { rewatches: Rewatch[] }): number {
  return 1 + it.rewatches.length;
}

/** 平均评分（ADR-0240，界面显示与一切下游的唯一评分口径）：首评分 + 各次重温打分的算术平均，一位小数。
 *  **等权**——不做近因加权，第 2 刷的分与第 9 刷的分分量相同。
 *  分母只数**真的打过分的刷次**：某一刷没打分就不进分母，不以首评分或上一刷分兜底填充
 *  （宁可样本数少于刷数，不伪造数据）。首评分与每刷评分全缺席 → null（界面回落「未评分」）。
 *  自然推论：每刷都打出与首评分相同的分时，平均值恰好等于首评分，界面零跳变。 */
export function avgRating(it: { rating: number | null; rewatches: Rewatch[] }): number | null {
  const vals: number[] = [];
  if (typeof it.rating === 'number' && it.rating > 0) vals.push(it.rating);
  for (const r of it.rewatches) {
    if (typeof r.rating === 'number' && r.rating > 0) vals.push(r.rating);
  }
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/** 内置片单：重温候补架（「想重温」语义归堆，不动三状态机——就是一枚预置片单）。
 *  恒排片单枚举首位、侧栏固定显示、详情弹窗出专属 chip；不可在片单弹层里删除 */
export const REWATCH_SHELF = '重映厅';

/**
 * 默认评分（编辑窗预填默认分；10 分制中点 5）。
 * 评分口径（编码退役后）：只有 >0 是真分值（想看/在看/未评分在内存与盘上都不再占 -1/0），
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
  公开课: ['公开课'],
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

// ======================= 名称合法性（深审批A P3-7：三入口统一校验） =======================

/** 人话提示主干（编辑改名/新增建档/AI 加想看同源，尾巴按入口补动作指引） */
export const ILLEGAL_NAME_HINT = '名称含非法字符（\\ / : * ? " < > |）';

/** 名称是否含非法字符（saveEdit / saveNew / quickAddWant 统一跑，不再只有编辑改名一入口把关）；
 *  正则复用上方批 C 单源 ILLEGAL_NAME_RE（主线程收口归一：批 A 原私有副本与此同名，去重） */
export function hasIllegalNameChar(name: string): boolean {
  return ILLEGAL_NAME_RE.test(name);
}
