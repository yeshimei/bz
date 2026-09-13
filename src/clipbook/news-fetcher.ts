/**
 * 聚合讯插件内抓取核心（issue 302 / ADR-0128）：自 tools/news-watcher/watcher.js 移植。
 * 抓取 = 纯逻辑 + 依赖注入（httpGet / 存储），生产环境由 requestUrl 适配与
 * news-data 合并写承接；桌面/移动同源（ADR-0008 守护退役，插件全责）。
 * 纯数据层（无 DOM），node 环境可测。
 *
 * 四源照搬：知乎日报（latest API + 逐篇 detail）、果壳科学人（science_api + 逐篇
 * INITIAL_STORE 正文）、B站 UP 动态（每 UP 最近 N 条窗口 + 裁剪 + 风控标记）、
 * RSS 订阅（轻量 XML 解析 + 每 feed 30 条窗口裁剪 + 标题回填）。
 * 24h 窗口（知乎/果壳）、URL + 标题双去重、fetchedAt 打标口径与守护完全一致。
 */
import { requestUrl } from 'obsidian';
import { notice } from '../core/notice';
import { readNewsData, writeNewsDataMerged, normalizeFetchIntervalMin, FETCH_INTERVAL_STEPS, DEFAULT_FETCH_INTERVAL_MIN, type NewsSources, type NewsWriteIntent, type RssFeed } from './news-data';
import { articleKeyOf } from './constants';
import { enqueueNewsWrite } from './write-queue';

// ---------- 常量（对齐守护） ----------

export const WINDOW_MS = 24 * 60 * 60 * 1000; // 最近 24 小时滚动窗口
export const RSS_MAX_PER_FEED = 30; // RSS 每 feed 平台保留最近条数
export const FETCH_TIMEOUT_MS = 15000;

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};
const BILIBILI_API = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space';
const BILIBILI_HOME = 'https://www.bilibili.com/';

// 抓取间隔档位/归一单源在 news-data（FETCH_INTERVAL_STEPS / normalizeFetchIntervalMin），此处按需转出
export { FETCH_INTERVAL_STEPS, DEFAULT_FETCH_INTERVAL_MIN };

// ---------- HTTP 通道 ----------

export type HttpGet = (url: string, headers?: Record<string, string>) => Promise<string | null>;

/** requestUrl 适配：15s 超时（Promise.race，requestUrl 不支持中止）、非 2xx → null（对齐守护 safeFetch 语义） */
export function requestUrlHttpGet(): HttpGet {
  return async (url, headers) => {
    try {
      const req = requestUrl({ url, method: 'GET', headers: { ...HEADERS, ...(headers || {}) }, throw: false }).then((resp) => {
        return resp.status >= 200 && resp.status < 300 ? resp.text : null;
      });
      const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), FETCH_TIMEOUT_MS));
      return await Promise.race([req, timer]);
    } catch {
      return null;
    }
  };
}

// ---------- 磁盘读写（依赖注入；生产默认走 news-data 合并写） ----------

/** 抓取期读到的库状态快照（parseNewsFileContent 归一后各段） */
export interface FetchDiskState {
  articles: any[];
  sources: NewsSources;
  bilibiliUps: string[];
  bilibiliMaxItems: number;
  bilibiliCookie: string;
  bilibiliUpInfo: Record<string, { name?: string; avatar?: string }>;
  rssFeeds: RssFeed[];
  lastFetchAt: number;
  fetchIntervalMin: number;
}

export interface FetchStoreDeps {
  /** 读库快照；读失败返回 null（放弃本轮） */
  read: () => Promise<FetchDiskState | null>;
  /** 合并写意图（须在串行队列内）：articles 为本轮最终全集；removeArticleKeys 声明窗口裁剪
   *  删除（writeNewsDataMerged 是磁盘∪声明并集，不声明删除则被裁条目从磁盘复活——P1 修复）；
   *  lastFetchAt 仅在非全源失败轮声明（全失败轮不推进锚点，下次打开即重试） */
  write: (intent: NewsWriteIntent & { set: { articles: any[]; lastFetchAt?: number } }) => Promise<void>;
}

/** 生产存储适配：readNewsData / writeNewsDataMerged（串行队列） */
export function defaultFetchStore(): FetchStoreDeps {
  return {
    read: async () => {
      const res = await readNewsData();
      if (!res.ok) return null;
      const d = res.data;
      return {
        articles: d.articles,
        sources: { ...d.sources },
        bilibiliUps: [...d.bilibiliUps],
        bilibiliMaxItems: d.bilibiliMaxItems,
        bilibiliCookie: d.bilibiliCookie,
        bilibiliUpInfo: { ...d.bilibiliUpInfo },
        rssFeeds: d.rssFeeds.map((f) => ({ ...f })),
        lastFetchAt: d.lastFetchAt ?? 0,
        fetchIntervalMin: d.fetchIntervalMin ?? DEFAULT_FETCH_INTERVAL_MIN,
      };
    },
    write: (intent) => enqueueNewsWrite(async () => {
      await writeNewsDataMerged(intent);
    }),
  };
}

// ---------- 通用纯函数（照搬守护） ----------

/** 本地时间串 YYYY-MM-DD HH:mm:ss（news 条目 date/fetchedAt 统一口径，避免 UTC 偏移落错日） */
export function localDatetime(ts: number = Date.now()): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** HTML → Markdown（照搬守护正则版；知乎 detail body / 果壳 INITIAL_STORE content / RSS content 共用） */
export function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  md = md.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  md = md.replace(/<!--[\s\S]*?-->/g, '');
  md = md.replace(/<img[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*\/?>/gi, (m, src) => {
    const altM = m.match(/alt=["']([^"']*)["']/i);
    return `![${altM ? altM[1].replace(/\s+/g, ' ').trim() : ''}](${src})`;
  });
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n# ${t.trim()}\n`);
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n## ${t.trim()}\n`);
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n### ${t.trim()}\n`);
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, t) => `\n#### ${t.trim()}\n`);
  md = md.replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  md = md.replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    return cleanText ? `[${cleanText}](${url})` : '';
  });
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) =>
    '\n' + t.trim().split('\n').map((l) => `> ${l.trim()}`).join('\n') + '\n');
  md = md.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, (_, c) => `\n\`\`\`\n${c.trim()}\n\`\`\`\n`);
  md = md.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre>([\s\S]*?)<\/pre>/gi, (_, c) => `\n\`\`\`\n${c.trim()}\n\`\`\`\n`);
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n');
  md = md.replace(/<figure[^>]*>/gi, '\n');
  md = md.replace(/<\/figure>/gi, '\n');
  md = md.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, '\n> $1\n');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<div[^>]*>/gi, '\n');
  md = md.replace(/\r\n/g, '\n');
  md = md.replace(/\r/g, '\n');
  const codeBlocks: string[] = [];
  md = md.replace(/\n(`{3}[\s\S]*?`{3})\n/g, (_, code) => { codeBlocks.push(code); return `\n%%CODEBLOCK_${codeBlocks.length - 1}%%\n`; });
  const inlineMedia: string[] = [];
  md = md.replace(/(!?\[[^\]]*\]\([^)]*\))/g, (_, m) => { inlineMedia.push(m); return `%%MEDIA_${inlineMedia.length - 1}%%`; });
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  md = md.replace(/%%MEDIA_(\d+)%%/g, (_, i) => inlineMedia[+i] || '');
  md = md.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => codeBlocks[+i] || '');
  md = md.replace(/\*\*\*\*/g, '** **');
  md = md.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');
  md = md.replace(/^ +/gm, '');
  return md.trim();
}

/** 从果壳文章页提取正文（INITIAL_STORE 内嵌 JSON） */
export function extractGuokrContent(html: string): string | null {
  const i = html.indexOf('window.INITIAL_STORE=');
  if (i >= 0) {
    const j = html.indexOf('</script>', i);
    if (j > i) {
      try {
        const raw = html.slice(i + 'window.INITIAL_STORE='.length, j).trim().replace(/;\s*$/, '');
        const store = JSON.parse(raw);
        const art = store.articleStore && store.articleStore.article;
        if (art && art.content) return art.content;
      } catch { /* 内嵌 JSON 损坏按无正文处理 */ }
    }
  }
  return null;
}

// ---------- 轻量 RSS 解析（替代 rss-parser，ADR-0128） ----------

/** XML 文本节点解码（CDATA 已剥后的实体回写） */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

/** 取标签内文本（先找 CDATA，再回退裸文本 + 实体解码）；无 → null */
function tagText(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return null;
  const cdata = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  const raw = cdata ? cdata[1] : m[1].replace(/<[^>]+>/g, '');
  return decodeXmlEntities(raw).trim() || null;
}

/** 轻量解析 RSS/Atom → 条目数组（title/link/guid/pubDate/content/summary；单条解析失败跳过） */
export function parseRssXml(xml: string): Array<{ title: string; link: string; guid: string; pubDate: string; content: string; summary: string }> {
  const out: Array<{ title: string; link: string; guid: string; pubDate: string; content: string; summary: string }> = [];
  const blocks = String(xml || '').match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) || [];
  for (const block of blocks) {
    const title = tagText(block, 'title') || '';
    // RSS: <link>text</link>；Atom: <link href="..."/>（可能多个，取第一个带 href 的）
    let link = tagText(block, 'link') || '';
    if (!link) {
      const hrefM = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = hrefM ? decodeXmlEntities(hrefM[1]).trim() : '';
    }
    const guid = tagText(block, 'guid') || tagText(block, 'id') || '';
    const pubDate = tagText(block, 'pubDate') || tagText(block, 'published') || tagText(block, 'updated') || '';
    const content = tagText(block, 'content:encoded') || tagText(block, 'content') || '';
    const summary = tagText(block, 'description') || tagText(block, 'summary') || '';
    if (!title && !link) continue;
    out.push({ title, link, guid, pubDate, content, summary });
  }
  return out;
}

export interface RssSourceItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  content: string;
  summary: string;
}

/** 纯函数：feed item → news 条目（照搬守护 buildRssArticle）：title 为纯日期时改写
 *  「YYYY-MM-DD · feed名」防列表同题；platform/author = feed 名；正文 = content（缺省退
 *  summary）经 htmlToMarkdown 转 markdown。 */
export function buildRssArticle(it: RssSourceItem | null, feedName: string): any | null {
  if (!it) return null;
  const url = String(it.link || it.guid || '').trim();
  if (!url) return null;
  const rawTitle = String(it.title || '').trim();
  const title = /^\d{4}-\d{2}-\d{2}$/.test(rawTitle) ? `${rawTitle} · ${feedName}` : (rawTitle || feedName);
  const content = String(it.content || it.summary || '').trim();
  const body = content ? htmlToMarkdown(content) : '';
  let date = '';
  if (it.pubDate) {
    const d = new Date(it.pubDate);
    if (!isNaN(d.getTime())) date = localDatetime(d.getTime());
  }
  return { platform: feedName, title, url, author: feedName, date, body };
}

/** 纯函数：RSS 窗口裁剪（照搬守护 capRssWindow）：每 feed 平台库内只保留最近 cap 条，
 *  按 date 降序（缺失视为最旧）保最新，其余返回待裁 url 列表（去重）。 */
export function capRssWindow(allArticles: any[], perFeedArticles: Record<string, any[]>, cap: number = RSS_MAX_PER_FEED): string[] {
  const pruned: string[] = [];
  const seen = new Set<string>();
  for (const [name, arts] of Object.entries(perFeedArticles || {})) {
    if (!Array.isArray(arts) || arts.length === 0) continue;
    const pool = (allArticles || []).filter((a) => a && a.platform === name && !seen.has(a.url));
    const keep = pool.slice().sort((x, y) => String(y.date || '').localeCompare(String(x.date || ''))).slice(0, cap);
    const keepUrls = new Set(keep.map((a) => a.url));
    for (const a of pool) {
      if (!keepUrls.has(a.url)) { seen.add(a.url); pruned.push(a.url); }
    }
  }
  return pruned;
}

// ---------- B站（照搬守护） ----------

/** B站动态条目 → 新闻条目纯函数：仅 DYNAMIC_TYPE_AV；cutoffMs 越界返回 null（传 null 不走 24h 窗口） */
export function buildBilibiliArticle(it: any, cutoffMs: number | null): any | null {
  if (!it || it.type !== 'DYNAMIC_TYPE_AV') return null;
  const author = (it.modules && it.modules.module_author) || {};
  const dyn = (it.modules && it.modules.module_dynamic) || {};
  const desc = (it.modules && it.modules.module_desc) || {};
  const archive = (dyn.major && dyn.major.archive) || null;
  if (!archive || !archive.bvid || !archive.title) return null;

  const pubTs = Number(author.pub_ts || 0);
  if (!pubTs || isNaN(pubTs)) return null;
  if (cutoffMs && pubTs * 1000 < cutoffMs) return null;

  const url = `https://www.bilibili.com/video/${archive.bvid}`;
  const cover = String(archive.cover || '').replace(/^http:/, 'https:');
  const descText = String(desc.desc || '').trim();
  const intro = descText || String(archive.desc || '').trim();
  const body = [
    intro ? `${intro}\n\n` : '',
    cover ? `![封面](${cover})\n\n` : '',
    `🔗 观看：[${String(archive.title)}](${url})${archive.duration_text ? `（时长 ${archive.duration_text}）` : ''}`,
  ].join('').trim();
  const date = localDatetime(pubTs * 1000);

  return { platform: 'B站', title: String(archive.title), url, author: String(author.name || ''), date, body };
}

/** 从 B站动态条目提取 UP 主资料（name/face；首个含资料的条目即返回；无 → null；头像统一转 https） */
export function extractUpInfo(items: any[]): { name?: string; avatar?: string } | null {
  for (const it of items || []) {
    const author = it && it.modules && it.modules.module_author;
    if (!author) continue;
    if (author.name || author.face) {
      const info: { name?: string; avatar?: string } = {};
      if (author.name) info.name = String(author.name);
      if (author.face) info.avatar = String(author.face).replace(/^http:/, 'https:');
      return info;
    }
  }
  return null;
}

/** B站窗口收集：按 feed 最近优先收前 limit 条视频投稿（不走 24h 窗口）；收满返回 true。
 *  口径 =「每 UP 保留最近 N 条」总量（用户拍板 2026-08-29），非增量。 */
export function collectBilibiliBatch(items: any[], limit: number, out: any[]): boolean {
  for (const it of items || []) {
    if (out.length >= limit) return true;
    const a = buildBilibiliArticle(it, null);
    if (!a) continue;
    out.push(a);
  }
  return out.length >= limit;
}

/** B站窗口裁剪纯函数：仅未风控 UP 参与裁剪；与该 UP 同名（author 匹配）存量条目中，
 *  url 不在窗口内且 date 早于窗口内最早一条 → 裁掉。返回待裁 url 列表（去重）。 */
export function pruneBilibiliWindow(
  existingArticles: any[],
  perUpArticles: Record<string, any[]>,
  perUpRejected: Record<string, boolean>,
  upInfo: Record<string, { name?: string }>,
): string[] {
  const pruned: string[] = [];
  const seen = new Set<string>();
  for (const [uid, arts] of Object.entries(perUpArticles || {})) {
    if (!Array.isArray(arts) || arts.length === 0) continue;
    if (perUpRejected && perUpRejected[uid]) continue;
    const name = upInfo && upInfo[uid] && upInfo[uid].name;
    if (!name) continue;
    const windowUrls = new Set(arts.map((a) => a.url));
    const oldest = arts.map((a) => String(a.date || '')).sort()[0];
    if (!oldest) continue;
    for (const a of existingArticles || []) {
      if (!a || a.platform !== 'B站' || a.author !== name) continue;
      if (windowUrls.has(a.url) || seen.has(a.url)) continue;
      if (a.date && String(a.date) < oldest) {
        seen.add(a.url);
        pruned.push(a.url);
      }
    }
  }
  return pruned;
}

export interface BilibiliUpResult {
  articles: any[];
  upInfo: { name?: string; avatar?: string } | null;
  rejected: boolean;
}

/** 单个 UP 主动态翻页抓取（仅视频投稿；收「最近 N 条」窗口）；
 *  rejected = 接口被风控拦截（code 非 0），交上层通知更新 Cookie */
export async function fetchBilibiliUp(uid: string, cookie: string, maxItems: number, httpGet: HttpGet): Promise<BilibiliUpResult> {
  const articles: any[] = [];
  const limit = Math.max(1, Math.floor(Number(maxItems) || 10));
  let offset = '';
  let upInfo: { name?: string; avatar?: string } | null = null;
  let rejected = false;
  const headers = cookie ? { Cookie: cookie } : undefined;

  // 安全翻页上限（防异常接口死循环）
  for (let page = 0; page < 50; page++) {
    const url = `${BILIBILI_API}?host_mid=${encodeURIComponent(uid)}&offset=${encodeURIComponent(offset)}&timezone_offset=-480&web_location=333.999`;
    const text = await httpGet(url, headers);
    if (!text) break;
    let data: any;
    try { data = JSON.parse(text); } catch { break; }
    if (!data || data.code !== 0 || !data.data || !Array.isArray(data.data.items)) {
      if (data && data.code !== 0 && data.code !== undefined) rejected = true;
      break;
    }

    const items = data.data.items || [];
    if (items.length === 0) break;
    if (!upInfo) upInfo = extractUpInfo(items);
    if (collectBilibiliBatch(items, limit, articles)) break;
    if (!data.data.has_more) break;
    offset = data.data.offset || '';
    if (!offset) break;
  }
  return { articles, upInfo, rejected };
}

/** B站未登录 Cookie 引导：GET 主页收 Set-Cookie（buvid3 等），规避 API 风控 412；尽力而为 */
async function defaultBootstrapBilibiliCookie(): Promise<string | null> {
  try {
    const resp = await requestUrl({ url: BILIBILI_HOME, method: 'GET', headers: HEADERS, throw: false });
    if (resp.status < 200 || resp.status >= 300) return null;
    // headers 为小写键对象；多枚 set-cookie 可能逗号拼接——逐段取 cookie 名值对
    const raw = String((resp as any).headers?.['set-cookie'] || '');
    const cookies = raw
      .split(/,(?=[^;]+?=)/)
      .map((c) => String(c).split(';')[0].trim())
      .filter((c) => /^[^=]+=/.test(c));
    return cookies.length > 0 ? cookies.join('; ') : null;
  } catch {
    return null;
  }
}

export interface BilibiliFetchResult {
  articles: any[];
  upInfo: Record<string, { name?: string; avatar?: string }>;
  perUpArticles: Record<string, any[]>;
  perUpRejected: Record<string, boolean>;
  /** 是否需要提示用户配置 Cookie（风控拦截或匿名 Cookie 空手而归） */
  needsCookieNotice: boolean;
}

/** B站源：cookie 引导 + 逐 UP 抓「最近 N 条」窗口（不走 24h 窗口；对库去重交 runNewsFetchRound）。
 *  needsCookieNotice 仅风控拦截（rejected）或 cookie 引导失败为真——匿名 cookie 正常抓到 0 条
 *  与「UP 没发新动态」同貌，不误报（ADR-0128 通知收窄）。bootstrapCookie 缺省走 requestUrl（测试注入 fake） */
export async function fetchBilibili(upUids: string[], maxItems: number, cookie: string, httpGet: HttpGet, bootstrapCookie?: () => Promise<string | null>): Promise<BilibiliFetchResult> {
  const list = upUids || [];
  if (list.length === 0) {
    return { articles: [], upInfo: {}, perUpArticles: {}, perUpRejected: {}, needsCookieNotice: false };
  }
  const per = Math.max(1, Math.floor(Number(maxItems) || 10));
  const configured = cookie && String(cookie).trim();
  const ck = configured || (await (bootstrapCookie || defaultBootstrapBilibiliCookie)());
  if (!ck) {
    return { articles: [], upInfo: {}, perUpArticles: {}, perUpRejected: {}, needsCookieNotice: true };
  }
  const seen = new Set<string>();
  const articles: any[] = [];
  const upInfo: Record<string, { name?: string; avatar?: string }> = {};
  const perUpArticles: Record<string, any[]> = {};
  const perUpRejected: Record<string, boolean> = {};
  for (const uid of list) {
    const res = await fetchBilibiliUp(uid, ck, per, httpGet);
    perUpArticles[uid] = res.articles;
    if (res.rejected) perUpRejected[uid] = true;
    for (const a of res.articles) {
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      articles.push(a);
    }
    if (res.upInfo) upInfo[uid] = res.upInfo;
  }
  const needsCookieNotice = Object.keys(perUpRejected).length > 0;
  return { articles, upInfo, perUpArticles, perUpRejected, needsCookieNotice };
}

// ---------- 知乎 / 果壳（照搬守护） ----------

/** 知乎日报：官方 API 当天全部 stories + 逐篇 detail 正文 */
export async function fetchZhihu(httpGet: HttpGet): Promise<any[]> {
  const articles: any[] = [];
  const text = await httpGet('https://news-at.zhihu.com/api/4/news/latest');
  if (!text) return articles;

  try {
    const data = JSON.parse(text);
    const list = data.stories || [];
    const rawDate = data.date || '';
    const formattedDate = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;

    for (const item of list) {
      const title = item.title || '';
      const id = item.id || '';
      const url = item.url || (id ? `https://daily.zhihu.com/story/${id}` : '');
      if (!title || !url) continue;

      let body = '', author: string | null = null;
      const detailText = await httpGet(`https://news-at.zhihu.com/api/4/news/${id}`);
      if (detailText) {
        try {
          const detail = JSON.parse(detailText);
          if (detail.body) body = htmlToMarkdown(detail.body);
          if (detail.editor_name) author = detail.editor_name;
        } catch { /* 单篇 detail 失败按无正文入库 */ }
      }
      articles.push({ platform: '知乎日报', title, url, author, date: formattedDate || null, body });
    }
  } catch { /* 列表失败静默，外层按失败源计数 */ }
  return articles;
}

/** 果壳科学人：新站 API 单次拉全量，过滤最近 24h + 逐篇 INITIAL_STORE 正文（对库去重交上层） */
export async function fetchGuokr(httpGet: HttpGet, now: number = Date.now()): Promise<any[]> {
  const articles: any[] = [];
  const cutoff = now - WINDOW_MS;

  const text = await httpGet('https://www.guokr.com/beta/proxy/science_api/articles?offset=0&limit=50');
  if (!text) return articles;
  let list: any[];
  try { list = Object.values(JSON.parse(text)); } catch { return articles; }

  const seen = new Set<string>(); // 批内去重（API 可能返回重复数据）
  for (const item of list) {
    const published = new Date(item.date_published).getTime();
    if (!item.date_published || isNaN(published)) continue;
    if (published < cutoff) continue; // 越过 24h 边界（按时间倒序）

    const id = String(item.id || '');
    const title = item.title || '';
    const url = `https://www.guokr.com/article/${id}`;
    if (!id || !title || seen.has(url)) continue;
    seen.add(url);

    const author = item.authors?.[0]?.nickname || item.author?.nickname || null;
    let body = '';
    const html = await httpGet(url);
    if (html) {
      const content = extractGuokrContent(html);
      if (content) body = htmlToMarkdown(content);
    }
    articles.push({
      platform: '果壳科学人', title, url, author,
      date: item.date_published.replace('T', ' ').substring(0, 19),
      body,
    });
  }
  return articles;
}

/** RSS 源：逐 feed 拉取解析；单 feed 失败只跳过不中断 */
export async function fetchRss(feeds: RssFeed[], httpGet: HttpGet): Promise<{ articles: any[]; perFeed: Record<string, any[]>; titleUpdates: Record<string, string> }> {
  const articles: any[] = [];
  const perFeed: Record<string, any[]> = {};
  const titleUpdates: Record<string, string> = {};
  for (const feed of feeds || []) {
    const url = String((feed && feed.url) || '').trim();
    if (!url) continue;
    const xml = await httpGet(url);
    if (!xml) continue;
    try {
      const feedTitle = String(xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
      const name = String((feed && feed.title) || feedTitle || url).trim();
      if (!feed.title && feedTitle) titleUpdates[url] = feedTitle;
      const items = parseRssXml(xml)
        .map((it) => buildRssArticle(it, name))
        .filter(Boolean);
      perFeed[name] = items;
      articles.push(...items);
    } catch { /* 单 feed 解析失败跳过 */ }
  }
  return { articles, perFeed, titleUpdates };
}

// ---------- 抓取与入库（照搬守护 checkAndFetch，存储换插件合并写） ----------

export interface NewsFetchResult {
  added: number;
  prunedBilibili: number;
  prunedRss: number;
  failedSources: string[];
  needsCookieNotice: boolean;
}

export interface RunFetchDeps {
  httpGet: HttpGet;
  store: FetchStoreDeps;
  now?: () => number;
}

/** 单轮抓取：读库 → 四源并行（B站/RSS 串行段在内各自完成）→ 去重/窗口裁剪 → 合并写 + lastFetchAt */
export async function runNewsFetchRound(deps: RunFetchDeps): Promise<NewsFetchResult> {
  const httpGet = deps.httpGet;
  const now = deps.now || Date.now;
  const disk = await deps.store.read();
  if (!disk) {
    return { added: 0, prunedBilibili: 0, prunedRss: 0, failedSources: ['读取 news.json 失败'], needsCookieNotice: false };
  }
  const existing = disk.articles;
  const existingUrls = new Set(existing.map((a) => a.url));
  const existingTitles = new Set(existing.map((a) => String(a.title || '').trim()));

  // 按 sources 开关决定抓哪些源（默认全开；剪藏本设置「数据源」组写）
  const sources = disk.sources || { zhihu: true, guokr: true, bilibili: true, rss: true };
  const failedSources: string[] = [];

  const guokrP = sources.guokr !== false ? fetchGuokr(httpGet, now()) : null;
  const zhihuP = sources.zhihu !== false ? fetchZhihu(httpGet) : null;
  // 名单为空视同源未启用（与守护「无 UP 主名单，跳过」口径一致，且参与 attempted 全失败判定）
  const biliP = sources.bilibili !== false && disk.bilibiliUps.length > 0 ? fetchBilibili(disk.bilibiliUps, disk.bilibiliMaxItems, disk.bilibiliCookie, httpGet) : null;
  const rssP = sources.rss !== false && disk.rssFeeds.length > 0 ? fetchRss(disk.rssFeeds, httpGet) : null;

  // 单源抛错只记失败源不中断本轮（fetchXxx 内部已吞网络错，这里兜防御性异常）
  const guarded = async <T>(p: Promise<T> | null, name: string, fallback: T): Promise<T | null> => {
    if (!p) return null;
    try {
      return await p;
    } catch {
      failedSources.push(name);
      return fallback;
    }
  };
  const emptyBili: BilibiliFetchResult = { articles: [], upInfo: {}, perUpArticles: {}, perUpRejected: {}, needsCookieNotice: false };
  const emptyRss = { articles: [] as any[], perFeed: {} as Record<string, any[]>, titleUpdates: {} as Record<string, string> };
  const guokrList = (await guarded(guokrP, '果壳科学人', [] as any[])) || [];
  const zhihuList = (await guarded(zhihuP, '知乎日报', [] as any[])) || [];
  const biliRes = await guarded(biliP, 'B站', emptyBili);
  const rssRes = await guarded(rssP, 'RSS', emptyRss);

  let newArticles = [guokrList, zhihuList, biliRes ? biliRes.articles : [], rssRes ? rssRes.articles : []]
    .flat()
    .filter((a) => a && !existingUrls.has(a.url));

  // 标题去重
  newArticles = newArticles.filter((a) => !existingTitles.has(String(a.title || '').trim()));

  // B站窗口裁剪：每 UP 库内只保留最近 N 条（风控轮不裁）
  const prunedUrls = biliRes ? pruneBilibiliWindow(existing, biliRes.perUpArticles, biliRes.perUpRejected, biliRes.upInfo) : [];
  const prunedSet = new Set(prunedUrls);
  let remaining = prunedUrls.length > 0 ? existing.filter((a) => !prunedSet.has(a.url)) : existing;

  // RSS 窗口裁剪：每 feed 平台库内只保留最近 30 条
  const rssPrunedUrls = rssRes ? capRssWindow([...remaining, ...newArticles], rssRes.perFeed, RSS_MAX_PER_FEED) : [];
  if (rssPrunedUrls.length > 0) {
    const rssPrunedSet = new Set(rssPrunedUrls);
    remaining = remaining.filter((a) => !rssPrunedSet.has(a.url));
    newArticles = newArticles.filter((a) => !rssPrunedSet.has(a.url));
  }

  // 缺失 title 的 feed 用 feed 自带标题回填
  const rssTitleUpdates = rssRes && Object.keys(rssRes.titleUpdates).length > 0
    ? disk.rssFeeds.map((f) => (rssRes.titleUpdates[f.url] ? { ...f, title: rssRes.titleUpdates[f.url] } : f))
    : undefined;

  const fetchedAt = localDatetime(now());
  for (const a of newArticles) a.fetchedAt = fetchedAt;

  // 全部已尝试源失败 → 不推进 lastFetchAt（下次打开即重试，不等满档位）
  const attempted = [guokrP, zhihuP, biliP, rssP].filter((p) => p !== null).length;
  const allFailed = attempted > 0 && failedSources.length >= attempted;

  const finalArticles = [...remaining, ...newArticles];

  // 窗口裁剪走 removeArticleKeys 显式删除（合并写为磁盘∪声明并集，只换 articles 会复活被裁条目）：
  // 口径 = 磁盘有而本轮终集没有的 url 一律声明删除（覆盖 B站/RSS 两套窗口裁剪）
  const finalUrls = new Set(finalArticles.map((a) => a.url));
  const removeArticleKeys = existing
    .filter((a) => a && a.url && !finalUrls.has(a.url))
    .map((a) => articleKeyOf(a)); // removeArticleKeys 口径 = articleKeyOf 键（news-data 合并写按此匹配）

  await deps.store.write({
    set: {
      articles: finalArticles,
      // UP 主资料与磁盘存量合并（段级合并写按声明段整段覆盖）
      ...(biliRes && Object.keys(biliRes.upInfo).length > 0
        ? { bilibiliUpInfo: { ...disk.bilibiliUpInfo, ...biliRes.upInfo } }
        : {}),
      ...(rssTitleUpdates ? { rssFeeds: rssTitleUpdates } : {}),
      ...(allFailed ? {} : { lastFetchAt: now() }),
    },
    ...(removeArticleKeys.length > 0 ? { removeArticleKeys } : {}),
  });

  return {
    added: newArticles.length,
    prunedBilibili: prunedUrls.length,
    prunedRss: rssPrunedUrls.length,
    failedSources,
    needsCookieNotice: biliRes ? biliRes.needsCookieNotice : false,
  };
}

// ---------- 触发链（间隔判定 + 互斥） ----------

let fetching = false;

/** 抓取完成回调（index.ts 注册 reloadIfOpen 刷新未读流；数据层不反向依赖 UI） */
let onFetched: ((r: NewsFetchResult) => void) | null = null;
export function setNewsFetchDoneListener(fn: (r: NewsFetchResult) => void): void {
  onFetched = fn;
}

/** 单轮执行（互斥 + 完成通知）：手动与自动共用 */
async function executeFetchRound(deps?: Partial<RunFetchDeps>): Promise<NewsFetchResult | null> {
  if (fetching) return null;
  fetching = true;
  try {
    const r = await runNewsFetchRound({
      httpGet: deps?.httpGet || requestUrlHttpGet(),
      store: deps?.store || defaultFetchStore(),
      now: deps?.now,
    });
    if (r.failedSources.length > 0) {
      notice(`聚合讯抓取部分失败：${r.failedSources.join('、')}`, 'warning');
    }
    if (r.needsCookieNotice) {
      notice('B站接口被风控拦截，请在剪藏本设置的数据源中更新 B站 Cookie', 'warning');
    }
    if (onFetched) onFetched(r);
    return r;
  } finally {
    fetching = false;
  }
}

/** 自动触发：距 lastFetchAt 不足间隔则静默跳过（onload / openClipbook 挂此） */
export async function maybeFetchNews(deps?: Partial<RunFetchDeps>): Promise<NewsFetchResult | null> {
  if (fetching) return null;
  const store = deps?.store || defaultFetchStore();
  const disk = await store.read();
  if (!disk) return null;
  const intervalMin = normalizeFetchIntervalMin(disk.fetchIntervalMin);
  const now = deps?.now || Date.now;
  if (now() - disk.lastFetchAt < intervalMin * 60 * 1000) return null;
  return executeFetchRound(deps);
}

/** 手动触发结果反馈（命令 / 设置「立即抓取」共用；CONTEXT 通知文案：完成态动词「已」）：
 *  抓取中 → info；部分失败 → 静默（executeFetchRound 已发 warning，不叠加 success）；
 *  成功 → success 计数（手动触发无就地可见结果，保留反馈——ADR-0128） */
export function notifyManualFetchResult(r: NewsFetchResult | null): void {
  if (!r) {
    notice('抓取已在进行中，请稍候', 'info');
    return;
  }
  if (r.failedSources.length > 0) return;
  notice(r.added > 0 ? `已抓取，新增 ${r.added} 篇文章` : '已抓取，暂无新文章', 'success');
}

/** 手动触发（bz-clipbook-fetch-now / 设置组「立即抓取」）：忽略间隔立即抓 */
export async function fetchNowNews(deps?: Partial<RunFetchDeps>): Promise<NewsFetchResult | null> {
  return executeFetchRound(deps);
}
