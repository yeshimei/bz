// scripts/rss-catalog/lib.mjs — RSS 源库出版管线纯函数（issue 495 / ADR-0208）
//
// 上游 markdown 表格 → 目录条目 → 固定大类归类 → 目录对象组装。
// 全部纯函数（无 IO、无时钟），vitest 直测（tests/scripts/rss-catalog-lib.test.mjs）；
// fetch-upstream.mjs / build.mjs 是它的两个 IO 壳。
//
// 归类口径（ADR-0208 拍板）：上游是自由打标（实测 810 个去重标签，656 个只出现一两次），
// 不能直接当分类导航；固定大类 + 关键词映射（首中归类、一个条目可属多个大类），
// 原始标签全保留只作搜索词；未命中的进「综合」。

/** 上游登记（首期只接 timqian 一家；二期候选 awesome-rss-feeds-list，CC0） */
export const UPSTREAMS = [
  {
    id: 'timqian-chinese-independent-blogs',
    name: '中文独立博客列表',
    page: 'https://github.com/timqian/chinese-independent-blogs',
    raw: 'https://raw.githubusercontent.com/timqian/chinese-independent-blogs/master/README.md',
    license: 'MIT',
  },
];

/** 固定大类（顺序即 UI chips 顺序）；最后一位是未命中兜底 */
export const FALLBACK_CATEGORY = '综合';
export const CATEGORIES = [
  '编程技术',
  '前端与移动',
  'AI 与数据',
  '产品与创业',
  '设计创意',
  '数字生活',
  '读书学习',
  '生活随笔',
  '摄影影像',
  '旅行户外',
  '游戏娱乐',
  FALLBACK_CATEGORY,
];

/** 原始标签 → 大类 关键词映射（比对不区分大小写；标签命中任一关键词即归该类，可多类）
 *  关键词取实测高频标签的规范形（810 个标签的 top 覆盖 + 明显同义），映射未命中率随出版报告迭代。 */
export const CATEGORY_RULES = [
  { cat: '编程技术', keywords: ['编程', '技术', '后端', '算法', '开源', 'linux', '安全', '教程', '折腾', '数据库', '架构', '运维', 'devops', '程序员', '代码', '计算机', '网络', '云计算', '嵌入式', '区块链', 'golang', 'python', 'java', 'rust', 'php', 'docker', 'kubernetes'] },
  { cat: '前端与移动', keywords: ['前端', 'css', 'javascript', 'js', 'typescript', 'ts', 'react', 'vue', 'node', '小程序', 'ios', 'android', '移动开发', '客户端', 'html', 'web', '网页', 'flutter', 'swift'] },
  { cat: 'AI 与数据', keywords: ['ai', '人工智能', '机器学习', '深度学习', 'llm', 'aigc', '大模型', 'nlp', '数据', 'gpt', '神经网络', 'stable diffusion'] },
  { cat: '产品与创业', keywords: ['产品', '创业', '独立开发者', '独立开发', '商业', '增长', '运营', '管理', '出海', '变现'] },
  { cat: '设计创意', keywords: ['设计', 'ui', 'ux', '交互', '创意', '艺术', '插画', '字体', '品牌', '美学'] },
  { cat: '数字生活', keywords: ['数字生活', '效率', '工具', '生产力', '软件', 'app', '应用', '自动化', '苹果', 'apple', 'mac', 'iphone', 'ipad', 'windows', '数码', '硬件', '树莓派', 'nas', '安卓', '手机'] },
  { cat: '读书学习', keywords: ['读书', '阅读', '学习', '笔记', '知识管理', '书评', '英语', '写作'] },
  { cat: '生活随笔', keywords: ['生活', '随笔', '思考', '日常', '记录', '随想', '分享', '杂谈', '感悟', '观点', '评论', '日志', '日记', '情感', '人生', '成长'] },
  { cat: '摄影影像', keywords: ['摄影', '照片', '胶片', '相机', '影像', '拍照', '电影', '航拍'] },
  { cat: '旅行户外', keywords: ['旅行', '游记', '户外', '徒步', '自驾', '骑行', '露营'] },
  { cat: '游戏娱乐', keywords: ['游戏', '电玩', '主机', '手游', '桌游', '动漫', '音乐', '影视', '追剧', '任天堂', 'steam'] },
];

/** 上游表格行解析：`| [Feed](feed地址) | 博客名 | 站点 | 标签 |`。
 *  None 行（首列无 [Feed] 链接 = 上游就没给 RSS 地址）与坏行跳过并计数；
 *  标签按分号拆、去空白；url 里的 markdown 转义（\_ 等）还原。 */
export function parseTimqianTable(md) {
  const entries = [];
  let noFeed = 0;
  let malformed = 0;
  for (const rawLine of String(md || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    const feedM = line.match(/^\|\s*\[Feed\]\(([^)]+)\)\s*\|/);
    if (!feedM) {
      if (/^\|\s*None\s*\|/.test(line)) noFeed++;
      else if (/^\|[^|]+\|/.test(line)) malformed++;
      continue;
    }
    const cells = line.split('|').map((c) => c.trim());
    // cells: ['', '[Feed](url)', 博客名, 站点, 标签, '']
    const url = feedM[1].trim().replace(/\\([_*~`#])/g, '$1');
    const title = (cells[2] || '').replace(/\\([_*~`#])/g, '$1');
    const site = (cells[3] || '').replace(/\\([_*~`#])/g, '$1');
    const tags = (cells[4] || '')
      .split(/[;；]/)
      .map((t) => t.trim())
      .filter(Boolean);
    entries.push({ url, title, site, tags });
  }
  return { entries, noFeed, malformed };
}

/** 标签 → 固定大类（一个条目可属多个大类；未命中 → [综合]）。比对不区分大小写：
 *  标签精确等于关键词，或标签包含关键词（「前端开发」含「前端」）。 */
export function mapCategories(tags) {
  const lowered = (tags || []).map((t) => String(t || '').trim().toLowerCase()).filter(Boolean);
  const cats = [];
  for (const rule of CATEGORY_RULES) {
    const kws = rule.keywords;
    if (lowered.some((t) => kws.some((k) => t === k || t.includes(k)))) cats.push(rule.cat);
  }
  return cats.length > 0 ? cats : [FALLBACK_CATEGORY];
}

/** 合法 feed 地址（与插件端 normalizeRssFeedUrl 同口径：http/https 且无空白） */
export function isValidFeedUrl(url) {
  return /^https?:\/\/\S+$/i.test(String(url || '').trim());
}

/** 目录组装：url 去重（去尾斜杠比对、首见为准、不改写原串）、坏址剔除、归类、序沿用上游（订阅量粗排）。 */
export function buildCatalog({ entries, updatedAt, version = 1, upstreams = UPSTREAMS }) {
  const seen = new Set();
  const feeds = [];
  let duplicates = 0;
  let invalidUrl = 0;
  for (const e of entries || []) {
    const url = String(e.url || '').trim();
    if (!isValidFeedUrl(url)) {
      invalidUrl++;
      continue;
    }
    const key = url.replace(/\/+$/, '');
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const title = String(e.title || '').trim();
    const site = String(e.site || '').trim();
    const tags = (e.tags || []).map((t) => String(t).trim()).filter(Boolean);
    feeds.push({ url, title, site, tags, cats: mapCategories(tags) });
  }
  return {
    catalog: {
      version,
      updatedAt,
      meta: {
        sources: upstreams.map((u) => ({ id: u.id, name: u.name, url: u.page, license: u.license })),
      },
      categories: CATEGORIES,
      feeds,
    },
    duplicates,
    invalidUrl,
  };
}
