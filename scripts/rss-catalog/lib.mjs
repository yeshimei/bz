// scripts/rss-catalog/lib.mjs — RSS 源库出版管线纯函数（issue 495 / ADR-0208；issue 497 / ADR-0209 扩 RSSHub 上游）
//
// 上游 markdown 表格 / RSSHub 路由目录 → 目录条目 → 固定大类归类 → 目录对象组装。
// 全部纯函数（无 IO、无时钟），vitest 直测（tests/scripts/rss-catalog-lib.test.mjs）；
// fetch-upstream.mjs / build.mjs 是它的两个 IO 壳。
//
// 归类口径（ADR-0208 拍板）：timqian 上游是自由打标（实测 810 个去重标签，656 个只出现一两次），
// 不能直接当分类导航；固定大类 + 关键词映射（首中归类、一个条目可属多个大类），
// 原始标签全保留只作搜索词；未命中的进「综合」。
// RSSHub 路由（ADR-0209）不走关键词映射：官方 categories 直映射（见 RSS_HUB_CATEGORY_MAP）。

/** 上游登记（format：markdown 表格 | json 路由目录；destExt 随 format 定快照扩展名） */
export const UPSTREAMS = [
  {
    id: 'timqian-chinese-independent-blogs',
    name: '中文独立博客列表',
    page: 'https://github.com/timqian/chinese-independent-blogs',
    raw: 'https://raw.githubusercontent.com/timqian/chinese-independent-blogs/master/README.md',
    license: 'MIT',
    format: 'markdown',
  },
  {
    id: 'rsshub-docs-routes',
    name: 'RSSHub 路由目录',
    page: 'https://github.com/DIYgod/RSSHub-Docs',
    raw: 'https://raw.githubusercontent.com/DIYgod/RSSHub-Docs/master/src/public/routes.json',
    license: 'AGPL-3.0（RSSHub 项目数据；路由路径与参数描述为功能性事实数据，出版署名保留）',
    format: 'json',
  },
];

/** RSSHub 路由条目 url 的出版期默认实例（ADR-0209 用户拍板：实测国内可达的社区公共实例）。
 *  运行时默认值以 src/core/rss-catalog.ts 的同名常量为插件侧单源，两侧同值由测试对齐。 */
export const RSS_HUB_DEFAULT_INSTANCE = 'https://rsshub.rssforever.com';

/** 固定大类（顺序即 UI chips 顺序）；最后一位是未命中兜底。
 *  ADR-0209 扩 3 类（新闻资讯/校园学术/财经）：RSSHub 路由的三大块（new-media 488 /
 *  university 487 / finance 153）在 495 按独立博客画像设计的 12 类里没有着落；
 *  timqian 既有归类不受影响（新增类只接 RSSHub 直映射）。 */
export const FALLBACK_CATEGORY = '综合';
export const CATEGORIES = [
  '新闻资讯',
  '编程技术',
  '前端与移动',
  'AI 与数据',
  '产品与创业',
  '财经',
  '设计创意',
  '数字生活',
  '读书学习',
  '校园学术',
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

/** 单标签 × 单关键词命中判定：中文关键词按包含（「前端开发」含「前端」）；
 *  ASCII 关键词按词边界（防 linux⊃ux、ai⊃aimless 这类巧合包含——出版报告复核发现的真实误挂） */
function tagHasKeyword(tag, kw) {
  if (tag === kw) return true;
  if (!/[a-z0-9]/.test(kw)) return tag.includes(kw);
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=[^a-z0-9]|$)`).test(tag);
}

/** 标签 → 固定大类（一个条目可属多个大类；未命中 → [综合]）。比对不区分大小写 */
export function mapCategories(tags) {
  const lowered = (tags || []).map((t) => String(t || '').trim().toLowerCase()).filter(Boolean);
  const cats = [];
  for (const rule of CATEGORY_RULES) {
    if (lowered.some((t) => rule.keywords.some((k) => tagHasKeyword(t, k)))) cats.push(rule.cat);
  }
  return cats.length > 0 ? cats : [FALLBACK_CATEGORY];
}

/** RSSHub 官方分类 → 固定大类直映射（ADR-0209 决策 6：官方分类比自由打标可靠，不走关键词；
 *  未列出的分类（如 other）不映射 → 落 [综合] 兜底。sport 只有 13 条，归「新闻资讯」（赛事资讯）。 */
export const RSS_HUB_CATEGORY_MAP = {
  'new-media': '新闻资讯',
  'traditional-media': '新闻资讯',
  government: '新闻资讯',
  popular: '新闻资讯',
  sport: '新闻资讯',
  programming: '编程技术',
  'program-update': '编程技术',
  design: '设计创意',
  'social-media': '数字生活',
  bbs: '数字生活',
  shopping: '数字生活',
  forecast: '数字生活',
  study: '读书学习',
  reading: '读书学习',
  university: '校园学术',
  journal: '校园学术',
  blog: '生活随笔',
  picture: '摄影影像',
  travel: '旅行户外',
  game: '游戏娱乐',
  multimedia: '游戏娱乐',
  anime: '游戏娱乐',
  live: '游戏娱乐',
  finance: '财经',
};

/** RSSHub 官方分类数组 → 固定大类（保持官方分类遍历序去重；未命中 → [综合]） */
export function mapRssHubCategories(rssCats) {
  const cats = [];
  for (const c of rssCats || []) {
    const mapped = RSS_HUB_CATEGORY_MAP[String(c || '').trim().toLowerCase()];
    if (mapped && !cats.includes(mapped)) cats.push(mapped);
  }
  return cats.length > 0 ? cats : [FALLBACK_CATEGORY];
}

/** 实例地址 + 路由路径 → 完整 feed 地址（实例去尾斜杠；形状不对返回空串交上游校验剔除） */
export function joinRssHubUrl(instance, routePath) {
  const base = String(instance || '').trim().replace(/\/+$/, '');
  const p = String(routePath || '').trim();
  if (!/^https?:\/\//i.test(base) || !p.startsWith('/') || /\s/.test(p)) return '';
  return base + p;
}

/** RSSHub routes.json 原始数据 → 蒸馏快照（只留出版所需字段，8.5MB → 约 1MB 入库）。
 *  全量命名空间/路由都留（不含筛选——筛选口径在 parseRssHubRoutes，可随报告迭代）。 */
export function distillRssHub(data) {
  const out = {};
  for (const [nsId, ns] of Object.entries(data || {})) {
    if (!ns || typeof ns !== 'object' || !ns.routes || typeof ns.routes !== 'object') continue;
    const routes = {};
    for (const [key, r] of Object.entries(ns.routes)) {
      if (!r || typeof r !== 'object') continue;
      const feat = r.features && typeof r.features === 'object' ? r.features : {};
      routes[key] = {
        path: String(r.path || key),
        name: String(r.name || ''),
        example: String(r.example || ''),
        categories: Array.isArray(r.categories) ? r.categories.map((c) => String(c)).filter(Boolean) : [],
        features: { requireConfig: !!feat.requireConfig, requirePuppeteer: !!feat.requirePuppeteer, antiCrawler: !!feat.antiCrawler },
      };
    }
    out[nsId] = { name: String(ns.name || ''), url: String(ns.url || ''), heat: Number(ns.heat) || 0, routes };
  }
  return out;
}

/**
 * 蒸馏快照 → 目录条目（ADR-0209 决策 2：三免全收——免 requireConfig/requirePuppeteer/
 * antiCrawler，example 存在且不含 `:参数` 占位；参数没填的地址不能直接订阅）。
 * 条目 url 用默认实例拼好（插件侧校验零改动），via 存路由路径作订阅时重拼素材。
 */
export function parseRssHubRoutes(data) {
  const entries = [];
  const dropped = { needConfig: 0, needPuppeteer: 0, antiCrawler: 0, noExample: 0, paramExample: 0, malformed: 0 };
  if (!data || typeof data !== 'object') return { entries, dropped };
  for (const [nsId, ns] of Object.entries(data)) {
    if (!ns || typeof ns !== 'object' || !ns.routes || typeof ns.routes !== 'object') {
      dropped.malformed++;
      continue;
    }
    const nsName = String(ns.name || nsId).trim() || nsId;
    const nsSite = String(ns.url || '').trim();
    for (const r of Object.values(ns.routes)) {
      if (!r || typeof r !== 'object') {
        dropped.malformed++;
        continue;
      }
      const feat = r.features && typeof r.features === 'object' ? r.features : {};
      if (feat.requireConfig) {
        dropped.needConfig++;
        continue;
      }
      if (feat.requirePuppeteer) {
        dropped.needPuppeteer++;
        continue;
      }
      if (feat.antiCrawler) {
        dropped.antiCrawler++;
        continue;
      }
      const example = String(r.example || '').trim();
      if (!example) {
        dropped.noExample++;
        continue;
      }
      if (example.split('/').some((seg) => seg.startsWith(':'))) {
        dropped.paramExample++;
        continue;
      }
      const routeName = String(r.name || '').trim();
      const cats = Array.isArray(r.categories) ? r.categories.map((c) => String(c).trim()).filter(Boolean) : [];
      entries.push({
        url: joinRssHubUrl(RSS_HUB_DEFAULT_INSTANCE, example),
        title: routeName ? `${nsName} · ${routeName}` : nsName,
        site: nsSite,
        tags: [nsId, ...cats],
        cats: mapRssHubCategories(cats),
        via: example,
      });
    }
  }
  return { entries, dropped };
}

/** 合法 feed 地址（与插件端 normalizeRssFeedUrl 同口径：http/https 且无空白） */
export function isValidFeedUrl(url) {
  return /^https?:\/\/\S+$/i.test(String(url || '').trim());
}

/** 目录组装：url 去重（去尾斜杠比对、首见为准、不改写原串）、坏址剔除、归类、序沿用上游（订阅量粗排）。
 *  条目带预映射 cats（RSSHub 直映射产物）则不跑关键词映射；带 via（路由路径）原样透传。 */
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
    const cats = Array.isArray(e.cats) && e.cats.length > 0 ? e.cats.map((c) => String(c).trim()).filter(Boolean) : mapCategories(tags);
    const feed = { url, title, site, tags, cats: cats.length > 0 ? cats : [FALLBACK_CATEGORY] };
    if (e.via) feed.via = String(e.via).trim();
    feeds.push(feed);
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
