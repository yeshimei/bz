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

/** 路由模板的 :参数段解析：`/bilibili/user/video/:uid/:embed?/:category{.+}?`
 *  → [{ name:'uid', optional:false }, { name:'embed', optional:true }, { name:'category', optional:true }]
 *  （`{...}` 是路径正则尾巴，剥掉不参与拼参；`?` 是可选标记） */
export function parseRouteTemplate(template) {
  const params = [];
  const re = /:([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]*\})?(\?)?/g;
  let m;
  while ((m = re.exec(String(template || '')))) params.push({ name: m[1], optional: m[3] === '?' });
  return params;
}

/** 模板是否含 :参数段（含 = 订阅必须走参数表单，不能直订） */
export function isParametrizedTemplate(template) {
  return parseRouteTemplate(template).length > 0;
}

/**
 * 实例 + 路由模板 + 参数值 → 完整 feed 地址（ADR-0209 全参数化：订阅=拷贝用户自己拼出的 URL）。
 * 参数值按段 encode（值内的 / 保留段结构——RSSHub 通配段如 category=sy/gzdt_210283 合法）；
 * 可选参数空值整段剥掉；必选参数空值、可选参数乱序填（前空后有值——位置歧义静默错绑）、
 * 正则尾巴含斜杠的参数段（split 切断后无法替换，如 npm 包名段的 `(@x/)?y` 形状）→ 返回空串交调用方拦。
 * 与 src/core/rss-catalog.ts 的同名纯函数同口径（测试对齐）。
 */
export function buildRouteUrl(instance, template, values) {
  const base = String(instance || '').trim().replace(/\/+$/, '');
  const tpl = String(template || '').trim();
  if (!/^https?:\/\//i.test(base) || !tpl.startsWith('/') || /\s/.test(tpl)) return '';
  const segRe = /^:([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]*\})?(\?)?$/;
  const out = [];
  let sawOptionalEmpty = false;
  const filled = new Set();
  for (const seg of tpl.split('/')) {
    if (!seg) continue;
    const m = seg.match(segRe);
    if (!m) {
      if (seg.startsWith(':')) return ''; // 正则尾巴含 / 的参数段被切断
      out.push(seg);
      continue;
    }
    const v = String(values?.[m[1]] ?? '').trim();
    if (v) {
      if (m[3] === '?' && sawOptionalEmpty) return ''; // 前可选空后有值：位置歧义静默错绑
      filled.add(m[1]);
      out.push(v.split('/').map((part) => encodeURIComponent(part)).join('/'));
      continue;
    }
    if (m[3] === '?') {
      sawOptionalEmpty = true;
      continue;
    }
    return '';
  }
  const result = `${base}/${out.join('/')}`;
  for (const name of filled) {
    if (result.includes(`:${name}`)) return '';
  }
  return result;
}

/** 从 example 反解参数预填值（表单默认值）：模板段与示例段按 / 对位取值。
 *  尾部连续可选段在示例里被省略（如 :embed? 没填）时逐个剥离后对齐；
 *  字面段不一致或段数仍不齐 → 回空对象（预填不全无伤，不猜）。 */
export function reverseTemplateExample(template, example) {
  const tplSegs = String(template || '').split('/').filter(Boolean);
  const exSegs = String(example || '').split('?')[0].split('/').filter(Boolean);
  const segRe = /^:([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]*\})?(\?)?$/;
  const align = (tpl, ex) => {
    if (tpl.length !== ex.length) return null;
    const values = {};
    for (let i = 0; i < tpl.length; i++) {
      const m = tpl[i].match(segRe);
      if (!m) {
        if (tpl[i] !== ex[i]) return null; // 字面段不一致 = 不是同一路由的示例
        continue;
      }
      if (!ex[i] || ex[i].startsWith(':')) return null;
      values[m[1]] = decodeURIComponent(ex[i]);
    }
    return values;
  };
  if (tplSegs.length === exSegs.length) return align(tplSegs, exSegs) || {};
  const t = [...tplSegs];
  while (t.length > exSegs.length) {
    const m = t[t.length - 1].match(segRe);
    if (!m || m[3] !== '?') return {}; // 缺的不是可选段，不对位
    t.pop();
  }
  return align(t, exSegs) || {};
}

/** description 截断（表单提示用，控产物体积）：超长截断加省略号 */
export function truncateDesc(text, max = 200) {
  const t = String(text || '').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

/** RSSHub routes.json 原始数据 → 蒸馏快照（只留出版所需字段，8.5MB → 约 1.2MB 入库）。
 *  全量命名空间/路由都留（不含筛选——筛选口径在 parseRssHubRoutes，可随报告迭代）。
 *  ADR-0209 全参数化：路由级加回 parameters（表单说明）/ heat（排序）/ description 截断。 */
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
        parameters: r.parameters && typeof r.parameters === 'object' && !Array.isArray(r.parameters)
          ? Object.fromEntries(Object.entries(r.parameters).map(([k, v]) => [String(k), String(v)]))
          : {},
        heat: Number(r.heat) || 0,
        desc: truncateDesc(r.description),
      };
    }
    out[nsId] = { name: String(ns.name || ''), url: String(ns.url || ''), heat: Number(ns.heat) || 0, routes };
  }
  return out;
}

/**
 * 蒸馏快照 → 目录条目（ADR-0209 全参数化，用户拍板 2026-09-27）：
 * 三免（免 requireConfig/requirePuppeteer/antiCrawler）全收，**不再依赖 example**——
 * 无参数路由开箱直订；带参数路由 via 存模板、parameters 作表单说明、example 作预填，
 * 订阅 = 用户在表单里填自己的参数拼 URL（示例标本不当源卖）。
 * 条目按路由 heat 降序（黄页浏览序 = 热度粗排）。
 */
export function parseRssHubRoutes(data) {
  const entries = [];
  const dropped = { needConfig: 0, needPuppeteer: 0, antiCrawler: 0, malformed: 0 };
  if (!data || typeof data !== 'object') return { entries, dropped };
  for (const [nsId, ns] of Object.entries(data)) {
    if (!ns || typeof ns !== 'object' || !ns.routes || typeof ns.routes !== 'object') {
      dropped.malformed++;
      continue;
    }
    const nsName = String(ns.name || nsId).trim() || nsId;
    const nsSite = String(ns.url || '').trim();
    for (const [routeKey, r] of Object.entries(ns.routes)) {
      if (!r || typeof r !== 'object') {
        dropped.malformed++;
        continue;
      }
      // 模板用 routes 的键：它是含 ns 前缀的完整路由（如 /81/81rc/:category{.+}?）；
      // r.path 字段是省略 ns 的子路径（/81rc/...），拿它拼 url 会跨命名空间互相撞车
      const template = String(routeKey || '').trim();
      if (!template.startsWith('/')) {
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
      const routeName = String(r.name || '').trim();
      const cats = Array.isArray(r.categories) ? r.categories.map((c) => String(c).trim()).filter(Boolean) : [];
      const example = String(r.example || '').trim();
      const params = r.parameters && typeof r.parameters === 'object' ? r.parameters : {};
      const entry = {
        url: joinRssHubUrl(RSS_HUB_DEFAULT_INSTANCE, template),
        title: routeName ? `${nsName} · ${routeName}` : nsName,
        site: nsSite,
        tags: [nsId, ...cats],
        cats: mapRssHubCategories(cats),
        via: template,
        heat: Number(r.heat) || 0,
      };
      // 带参数路由：表单素材三件套（示例预填 / 参数说明 / 描述提示）。
      // example 上游偶见未编码的空格/查询串（如 linkedin 职位示例），脏形状不预填
      if (isParametrizedTemplate(template)) {
        if (example && /^\/\S*$/.test(example)) entry.viaExample = example;
        if (Object.keys(params).length > 0) entry.params = params;
        if (r.desc) entry.desc = r.desc;
      }
      entries.push(entry);
    }
  }
  entries.sort((a, b) => b.heat - a.heat);
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
    // 全参数化表单素材（ADR-0209）：示例预填路径 / 参数说明表 / 截断描述——仅带参数路由携带
    if (e.viaExample) feed.viaExample = String(e.viaExample).trim();
    if (e.params && typeof e.params === 'object' && !Array.isArray(e.params) && Object.keys(e.params).length > 0) {
      feed.params = Object.fromEntries(Object.entries(e.params).map(([k, v]) => [String(k).trim(), String(v)]).filter(([k]) => k));
    }
    if (e.desc) feed.desc = String(e.desc).trim();
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
