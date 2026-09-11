#!/usr/bin/env node
// ============================================================
// News Watcher — 每 30 分钟抓取最近 24 小时的文章
// 源: 果壳科学人(新API) + 知乎日报(官方API) + B站 UP 投稿 + RSS 订阅（ADR-0121）
// 去重: URL + 标题，入库即未读
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const Parser = require('rss-parser');
const TurndownService = require('turndown');

// ---------- 路径配置 ----------
// 解析 news.json 路径，优先级：
//   1. NEWS_PATH 环境变量（绝对路径，含文件名）
//   2. ~/.news-watcherrc 的 vaultPath（相对 vault 的 CONFIG/STORAGE/news.json）
//   3. 缺省相对脚本位置（保持 vault 内 CONFIG/SCRIPTS/NodeJs/news-watcher 部署兼容）
function resolveNewsPath() {
    if (process.env.NEWS_PATH) return path.resolve(process.env.NEWS_PATH);
    const rcPath = path.join(os.homedir(), '.news-watcherrc');
    if (fs.existsSync(rcPath)) {
        try {
            const rc = JSON.parse(fs.readFileSync(rcPath, 'utf-8'));
            if (rc.vaultPath) return path.join(rc.vaultPath, 'CONFIG', 'STORAGE', 'news.json');
        } catch (e) {
            console.warn(`  ⚠ 读取 ${rcPath} 失败: ${e.message}`);
        }
    }
    return path.join(__dirname, '..', '..', '..', 'STORAGE', 'news.json');
}
const NEWS_PATH = resolveNewsPath();

// ---------- 守护参数 ----------
const FETCH_INTERVAL_MS = 30 * 60 * 1000; // 30 分钟一轮
const WINDOW_MS = 24 * 60 * 60 * 1000;    // 最近 24 小时滚动窗口
const TIMEOUT = 15000;
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
};

// ---------- ticket 124（ADR-0060）：news.json 四段结构 + B 站源 ----------
const BILIBILI_API = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space';
const BILIBILI_HOME = 'https://www.bilibili.com/';
const DEFAULT_SOURCES = { zhihu: true, guokr: true, bilibili: true, rss: true };

// ---------- ADR-0121：RSS 订阅源 ----------
const RSS_MAX_PER_FEED = 30; // 每 feed 平台保留最近条数（超出窗口裁剪）
const RSS_TURNDOWN = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
const RSS_PARSER = new Parser({ headers: HEADERS, timeout: TIMEOUT, customFields: { item: ['content:encoded'] } });

/** 纯函数：feed item → news 条目。title 为纯日期（YYYY-MM-DD，如橘鸦AI早报）时改写为
 *  「YYYY-MM-DD · feed名」防列表同题；platform/author = feed 名（rail 站点行/保存 site 同源）；
 *  正文 = content:encoded（缺省退 description/summary）经 turndown 转 markdown，原文外链保留。 */
function buildRssArticle(it, feedName) {
    if (!it) return null;
    const url = String(it.link || it.guid || '').trim();
    if (!url) return null;
    const rawTitle = String(it.title || '').trim();
    const title = /^\d{4}-\d{2}-\d{2}$/.test(rawTitle) ? `${rawTitle} · ${feedName}` : (rawTitle || feedName);
    const content = String(it['content:encoded'] || it.content || it.summary || '').trim();
    const body = content ? RSS_TURNDOWN.turndown(content).trim() : '';
    let date = '';
    const t = it.isoDate || it.pubDate;
    if (t) {
        const d = new Date(t);
        if (!isNaN(d.getTime())) date = localDatetime(d.getTime());
    }
    return { platform: feedName, title, url, author: feedName, date, body };
}

/** 纯函数：RSS 窗口裁剪（ADR-0121：每 feed 平台库内只保留最近 RSS_MAX_PER_FEED 条）。
 *  口径：本轮窗口条目 ∪ 库内同平台条目合并后按 date 降序（'YYYY-MM-DD HH:mm:ss' 字典序、
 *  缺失视为最旧）保最新 cap 条，其余返回待裁 url 列表（去重）。 */
function capRssWindow(allArticles, perFeedArticles, cap = RSS_MAX_PER_FEED) {
    const pruned = [];
    const seen = new Set();
    for (const [name, arts] of Object.entries(perFeedArticles || {})) {
        if (!Array.isArray(arts) || arts.length === 0) continue;
        const windowUrls = new Set(arts.map((a) => a.url));
        const pool = (allArticles || []).filter((a) => a && a.platform === name && !windowUrls.has(a.url) && !seen.has(a.url));
        const byDate = (x, y) => String(y.date || '').localeCompare(String(x.date || ''));
        const keep = [...arts].sort(byDate).slice(0, cap);
        const keepUrls = new Set(keep.map((a) => a.url));
        const threshold = keep.length ? String(keep[keep.length - 1].date || '') : '';
        for (const a of pool) {
            const stale = threshold ? String(a.date || '') < threshold : true;
            if (stale) { seen.add(a.url); pruned.push(a.url); }
        }
        for (const a of arts) {
            if (!keepUrls.has(a.url) && !seen.has(a.url)) { seen.add(a.url); pruned.push(a.url); }
        }
    }
    return pruned;
}

/** ticket 126：UP 主资料段容错解析（uid → {name?, avatar?}；非对象/数组 → {}；头像统一转 https） */
function parseBilibiliUpInfo(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const [uid, v] of Object.entries(raw)) {
        if (!v || typeof v !== 'object') continue;
        const info = {};
        if (v.name) info.name = String(v.name);
        if (v.avatar) info.avatar = String(v.avatar).replace(/^http:/, 'https:');
        out[uid] = info;
    }
    return out;
}

/** ticket 127：B 站每 UP 抓取条数容错解析（默认 10，夹取 1..50） */
function parseBilibiliMaxItems(raw) {
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : 10;
}

/** ticket 127：B 站 Cookie 容错解析（字符串去空白；缺省空串） */
function parseBilibiliCookie(raw) {
    return typeof raw === 'string' ? raw.trim() : '';
}

/** 读 news.json → 对象 { articles, stats, bilibiliUps, bilibiliUpInfo, bilibiliMaxItems, bilibiliCookie, sources, rssFeeds }；
 *  旧纯数组自动包裹；损坏 → 空骨架。未解析的旧段（含已退役 briefUps/briefs）不透传——
 *  下一轮写回自然丢弃（ADR-0121 契约收缩，代码零兼容；vault 残留由部署流程清理）。
 *  rssFeeds（ADR-0121）为**插件侧维护段**：本进程只读（按 sources.rss 决定抓取），
 *  写回时经 `...disk` 原样带出（仅在回填缺失 title 时更新该段）。 */
function readNewsData() {
    if (!fs.existsSync(NEWS_PATH)) return { articles: [], stats: null, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: { ...DEFAULT_SOURCES }, rssFeeds: [], missing: true };
    try {
        const raw = JSON.parse(fs.readFileSync(NEWS_PATH, 'utf-8'));
        if (Array.isArray(raw)) return { articles: raw, stats: null, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: { ...DEFAULT_SOURCES }, rssFeeds: [], missing: false };
        if (raw && typeof raw === 'object') {
            return {
                articles: Array.isArray(raw.articles) ? raw.articles : [],
                stats: raw.stats && typeof raw.stats === 'object' ? raw.stats : null,
                bilibiliUps: Array.isArray(raw.bilibiliUps) ? raw.bilibiliUps.map((u) => String(u || '').trim()).filter(Boolean) : [],
                bilibiliUpInfo: parseBilibiliUpInfo(raw.bilibiliUpInfo),
                bilibiliMaxItems: parseBilibiliMaxItems(raw.bilibiliMaxItems),
                bilibiliCookie: parseBilibiliCookie(raw.bilibiliCookie),
                sources: raw.sources && typeof raw.sources === 'object' ? { ...DEFAULT_SOURCES, ...raw.sources } : { ...DEFAULT_SOURCES },
                rssFeeds: Array.isArray(raw.rssFeeds) ? raw.rssFeeds.filter((f) => f && typeof f === 'object' && String(f.url || '').trim()) : [],
                missing: false,
            };
        }
        return { articles: [], stats: null, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: { ...DEFAULT_SOURCES }, rssFeeds: [], missing: false };
    } catch {
        return { articles: [], stats: null, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: { ...DEFAULT_SOURCES }, rssFeeds: [], missing: false };
    }
}

/** 写回 news.json 四段（调用方保证读盘后改段再整写，保留非本域段）；
 *  `missing` 是读兜底标记不是数据段，落盘前剥离（防八段契约报约定外段）。 */
function writeNewsData(data) {
    const { missing, ...persist } = data || {};
    const dir = path.dirname(NEWS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NEWS_PATH, JSON.stringify(persist, null, 2), 'utf-8');
}

/** B 站未登录 Cookie 引导：GET 主页收集 Set-Cookie（buvid3 等），规避 API 风控 412 */
async function getBilibiliCookie() {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
        const resp = await fetch(BILIBILI_HOME, { headers: HEADERS, redirect: 'follow', signal: ctrl.signal });
        clearTimeout(timer);
        const setCookies = typeof resp.headers.getSetCookie === 'function' ? resp.headers.getSetCookie() : [];
        const cookies = (setCookies || [])
            .map((c) => String(c).split(';')[0])
            .filter((c) => /^[^=]+=/.test(c));
        return cookies.length > 0 ? cookies.join('; ') : null;
    } catch {
        return null;
    }
}

/**
 * B 站动态条目 → 新闻条目纯函数（ticket 124）：仅 DYNAMIC_TYPE_AV 返回非 null；
 * 供 fetchBilibiliUp 与 node:test 单测使用。
 */
function buildBilibiliArticle(it, cutoffMs) {
    if (!it || it.type !== 'DYNAMIC_TYPE_AV') return null; // 仅视频投稿
    const author = (it.modules && it.modules.module_author) || {};
    const dyn = (it.modules && it.modules.module_dynamic) || {};
    const desc = (it.modules && it.modules.module_desc) || {};
    const archive = (dyn.major && dyn.major.archive) || null;
    if (!archive || !archive.bvid || !archive.title) return null;

    const pubTs = Number(author.pub_ts || 0);
    if (!pubTs || isNaN(pubTs)) return null;
    if (cutoffMs && pubTs * 1000 < cutoffMs) return null; // 越过 24h 边界

    const url = `https://www.bilibili.com/video/${archive.bvid}`;
    const cover = String(archive.cover || '').replace(/^http:/, 'https:');
    const descText = String(desc.desc || '').trim();
    const intro = descText || String(archive.desc || '').trim();
    const body = [
        intro ? `${intro}\n\n` : '',
        cover ? `![封面](${cover})\n\n` : '',
        `🔗 观看：[${String(archive.title)}](${url})${archive.duration_text ? `（时长 ${archive.duration_text}）` : ''}`,
    ].join('').trim();
    const d = new Date(pubTs * 1000);
    const p2 = (n) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;

    return { platform: 'B站', title: String(archive.title), url, author: String(author.name || ''), date, body };
}

/** ticket 126：从 B 站动态条目提取 UP 主资料（name/face；首个含资料的条目即返回；无 → null；头像统一转 https） */
function extractUpInfo(items) {
    for (const it of items || []) {
        const author = it && it.modules && it.modules.module_author;
        if (!author) continue;
        if (author.name || author.face) {
            const info = {};
            if (author.name) info.name = String(author.name);
            if (author.face) info.avatar = String(author.face).replace(/^http:/, 'https:');
            return info;
        }
    }
    return null;
}

/** ticket n：B 站窗口收集——按 feed 最近优先收前 limit 条视频投稿（无 24h 窗口、不看已抓过）；
 *  收满返回 true（纯函数，供 fetchBilibiliUp 与 node:test 单测使用）。
 *  语义修正（用户拍板 2026-08-29）：配置的 N 是「每 UP 保留最近 N 条」的总量口径，
 *  不再是「每轮收 N 条没抓过的」增量口径——增量语义会让每 UP 条目每轮 +10 无上界累积。 */
function collectBilibiliBatch(items, limit, out) {
    for (const it of items || []) {
        if (out.length >= limit) return true;
        const a = buildBilibiliArticle(it, null); // cutoff=null：不走 24h 窗口
        if (!a) continue;
        out.push(a);
    }
    return out.length >= limit;
}

/** ticket n：B 站窗口裁剪纯函数（用户拍板 2026-08-29：每 UP 库内只保留最近 N 条）。
 *  输入：现有 articles、本轮 fetchBilibili 的 perUp 窗口/风控标记/UP 资料。
 *  规则：仅当该 UP 本轮未遭风控（rejected=false）且抓到了窗口时参与裁剪；
 *        与该 UP 同名（author 匹配）的存量条目中，url 不在窗口内且 date 早于窗口内最早一条 → 裁掉
 *        （date 为统一 'YYYY-MM-DD HH:mm:ss' 格式，字典序即可比较）。
 *  保守边界：比窗口内最早一条更新的存量（分页截断等异常残留）不裁，防误删。
 *  返回待裁剪的 url 列表（去重）。 */
function pruneBilibiliWindow(existingArticles, perUpArticles, perUpRejected, upInfo) {
    const pruned = [];
    const seen = new Set();
    for (const [uid, arts] of Object.entries(perUpArticles || {})) {
        if (!Array.isArray(arts) || arts.length === 0) continue;
        if (perUpRejected && perUpRejected[uid]) continue; // 风控轮窗口不完整，不裁
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

/** 单个 UP 主动态翻页抓取（仅 DYNAMIC_TYPE_AV 视频投稿；ticket n：收「最近 N 条」窗口，不走 24h 窗口）；
 *  返回 { articles, upInfo, rejected }——articles=该 UP 当前最近 N 条窗口（含已入库条目，去重交 checkAndFetch）；
 *  upInfo=本轮抓到的该 UP 主名字/头像（ticket 126，无则 null）；
 *  rejected=接口被风控拦截（code -352/-412 等，ticket 127：匿名 Cookie 常见，交由 fetchBilibili 引导用户配登录 Cookie） */
async function fetchBilibiliUp(uid, cookie, maxItems) {
    const articles = [];
    const limit = Math.max(1, Math.floor(Number(maxItems) || 10));
    let offset = '';
    let upInfo = null;
    let rejected = false;
    const headers = { ...HEADERS };
    if (cookie) headers['Cookie'] = cookie;

    // 安全翻页上限（防异常接口死循环）；web_location=333.999 为网页端常规参数，部分风控场景可放行
    for (let page = 0; page < 50; page++) {
        const url = `${BILIBILI_API}?host_mid=${encodeURIComponent(uid)}&offset=${encodeURIComponent(offset)}&timezone_offset=-480&web_location=333.999`;
        const text = await safeFetch(url, { headers });
        if (!text) break;
        let data;
        try { data = JSON.parse(text); } catch { break; }
        if (!data || data.code !== 0 || !data.data || !Array.isArray(data.data.items)) {
            if (data && data.code !== 0 && data.code !== undefined) rejected = true; // 风控拦截
            break;
        }

        const items = data.data.items || [];
        if (items.length === 0) break;
        if (!upInfo) upInfo = extractUpInfo(items);
        if (collectBilibiliBatch(items, limit, articles)) break; // 窗口已收满
        if (!data.data.has_more) break;
        offset = data.data.offset || '';
        if (!offset) break;
    }
    return { articles, upInfo, rejected };
}

/** B 站源：cookie 引导 + 逐 UP 主抓「最近 N 条」窗口（不走 24h 窗口；新增条目由 checkAndFetch 对库去重）；
 *  返回 { articles, upInfo, perUpArticles, perUpRejected }——articles=全部 UP 窗口合并（批内去重），
 *  perUpArticles/perUpRejected=逐 UP 窗口与风控标记（供 checkAndFetch 做窗口裁剪），upInfo=各 UP 主资料合并（ticket 126） */
async function fetchBilibili(upUids, maxItems, cookie) {
    const list = upUids || [];
    if (list.length === 0) {
        console.log('  📡 B站 (无 UP 主名单，跳过)');
        return { articles: [], upInfo: {}, perUpArticles: {}, perUpRejected: {} };
    }
    const per = Math.max(1, Math.floor(Number(maxItems) || 10));
    console.log(`  📡 B站 (${list.length} 位 UP 主，每 UP 最近 ${per} 条)...`);
    // ticket 127：优先用用户在「UP 主名单管理」弹窗配置的 Cookie；未配置则自动引导（buvid3 等）
    const configured = cookie && String(cookie).trim();
    const ck = configured || (await getBilibiliCookie());
    if (!ck) {
        console.log('  ✗ B站 无可用 Cookie（自动引导失败或 API 风控 412）——请在剪藏本设置 ⚙️ → UP 主名单管理 → 粘贴登录后的 B 站 Cookie 后重试');
        return { articles: [], upInfo: {}, perUpArticles: {}, perUpRejected: {} };
    }
    const seen = new Set();
    const articles = [];
    const upInfo = {};
    const perUpArticles = {};
    const perUpRejected = {};
    for (const uid of list) {
        const res = await fetchBilibiliUp(uid, ck, per);
        perUpArticles[uid] = res.articles;
        if (res.rejected) perUpRejected[uid] = true;
        for (const a of res.articles) {
            if (seen.has(a.url)) continue;
            seen.add(a.url);
            articles.push(a);
        }
        if (res.upInfo) upInfo[uid] = res.upInfo;
    }
    console.log(`  ✓ B站 窗口 ${articles.length} 条 (最近 ${per} 条/UP)`);
    if (Object.keys(perUpRejected).length > 0) {
        // ticket 127：匿名/弱 Cookie 常被 -352/-412 拦截（返回空），引导配置登录后 Cookie（含 SESSDATA）
        console.log('  ✗ B站 接口风控拦截（-352/412）——匿名 Cookie 拿不到动态数据，请在剪藏本设置 ⚙️ → UP 主名单管理 → 粘贴浏览器「登录后」的 B 站 Cookie（含 SESSDATA）保存，下轮生效');
    } else if (articles.length === 0 && !configured) {
        console.log('  ℹ️ B站 本轮 0 条——若名单无误却应抓到内容，多因未登录 Cookie；请在该弹窗粘贴登录后的 Cookie 后重试');
    }
    return { articles, upInfo, perUpArticles, perUpRejected };
}

/** 本地时间串 YYYY-MM-DD HH:mm:ss（news 条目 date/fetchedAt 统一口径，避免 UTC 偏移落错日） */
function localDatetime(ts = Date.now()) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** RSS 源：逐 feed 拉取解析（rss-parser，30s 超时/15s TIMEOUT 取小者由 Parser 配置）；
 *  返回 { articles, perFeed, titleUpdates }——perFeed=平台名 → 本轮窗口条目（供 capRssWindow 裁剪），
 *  titleUpdates=缺失 title 的 feed 回填（url → feed 自带标题，ADR-0121）。单 feed 失败只记日志不中断。 */
async function fetchRss(feeds) {
    const articles = [];
    const perFeed = {};
    const titleUpdates = {};
    for (const feed of feeds || []) {
        const url = String((feed && feed.url) || '').trim();
        if (!url) continue;
        try {
            const parsed = await RSS_PARSER.parseURL(url);
            const parsedTitle = String((parsed && parsed.title) || '').trim();
            const name = String((feed && feed.title) || parsedTitle || url).trim();
            if (!feed.title && parsedTitle) titleUpdates[url] = parsedTitle;
            const items = ((parsed && parsed.items) || [])
                .map((it) => buildRssArticle(it, name))
                .filter(Boolean);
            perFeed[name] = items;
            articles.push(...items);
            console.log(`  ✓ RSS ${name}: 窗口 ${items.length} 条`);
        } catch (e) {
            console.log(`  ✗ RSS ${url}: ${(e && e.message) || e}`);
        }
    }
    return { articles, perFeed, titleUpdates };
}

let running = false;

// ---------- 工具 ----------
async function safeFetch(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const resp = await fetch(url, { headers: { ...HEADERS, ...options.headers }, signal: controller.signal, redirect: 'follow' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.text();
    } catch (e) {
        console.warn(`  ✗ ${url.split('?')[0]}: ${e.message}`);
        return null;
    } finally { clearTimeout(timer); }
}

// ---------- HTML → Markdown ----------
function htmlToMarkdown(html) {
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
        '\n' + t.trim().split('\n').map(l => `> ${l.trim()}`).join('\n') + '\n');
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
    const codeBlocks = [];
    md = md.replace(/\n(\`{3}[\s\S]*?\`{3})\n/g, (_, code) => { codeBlocks.push(code); return `\n%%CODEBLOCK_${codeBlocks.length - 1}%%\n`; });
    const inlineMedia = [];
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

// 从果壳文章页提取正文（INITIAL_STORE 内嵌 JSON）
function extractGuokrContent(html) {
    const i = html.indexOf('window.INITIAL_STORE=');
    if (i >= 0) {
        const j = html.indexOf('</script>', i);
        if (j > i) {
            try {
                const raw = html.slice(i + 'window.INITIAL_STORE='.length, j).trim().replace(/;\s*$/, '');
                const store = JSON.parse(raw);
                const art = store.articleStore && store.articleStore.article;
                if (art && art.content) return art.content;
            } catch {}
        }
    }
    return null;
}

// ---------- 数据源 ----------

// 果壳科学人: 新站 API（offset 参数无效，单次 limit 拉全量），过滤最近 24h，全部抓取
async function fetchGuokr(existingUrls) {
    console.log('  📡 果壳科学人 (science_api)...');
    const articles = [];
    const cutoff = Date.now() - WINDOW_MS;

    const text = await safeFetch('https://www.guokr.com/beta/proxy/science_api/articles?offset=0&limit=50');
    if (!text) return articles;
    let list;
    try { list = Object.values(JSON.parse(text)); } catch { return articles; }

    const seen = new Set(); // 批内去重（API 可能返回重复数据）
    for (const item of list) {
        const published = new Date(item.date_published).getTime();
        if (!item.date_published || isNaN(published)) continue;
        if (published < cutoff) continue; // 越过 24h 边界（按时间倒序）

        const id = String(item.id || '');
        const title = item.title || '';
        const url = `https://www.guokr.com/article/${id}`;
        if (!id || !title || seen.has(url) || existingUrls.has(url)) continue;
        seen.add(url);

        const author = item.authors?.[0]?.nickname || item.author?.nickname || null;
        let body = '';
        const html = await safeFetch(url);
        if (html) {
            const content = extractGuokrContent(html);
            if (content) body = htmlToMarkdown(content);
        }
        articles.push({
            platform: '果壳科学人', title, url, author,
            date: item.date_published.replace('T', ' ').substring(0, 19),
            body
        });
    }
    console.log(`  ✓ 果壳 ${articles.length} 篇 (24h 内)`);
    return articles;
}

// 知乎日报: 官方 API，当天全部 stories
async function fetchZhihu() {
    console.log('  📡 知乎日报 (API)...');
    const articles = [];
    const text = await safeFetch('https://news-at.zhihu.com/api/4/news/latest');
    if (!text) return articles;

    try {
        const data = JSON.parse(text);
        const list = data.stories || [];
        const rawDate = data.date || '';
        const formattedDate = rawDate.length === 8
            ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`
            : rawDate;

        for (const item of list) {
            const title = item.title || '';
            const id = item.id || '';
            const url = item.url || (id ? `https://daily.zhihu.com/story/${id}` : '');
            if (!title || !url) continue;

            let body = '', author = null;
            const detailText = await safeFetch(`https://news-at.zhihu.com/api/4/news/${id}`);
            if (detailText) {
                try {
                    const detail = JSON.parse(detailText);
                    if (detail.body) body = htmlToMarkdown(detail.body);
                    if (detail.editor_name) author = detail.editor_name;
                } catch {}
            }
            articles.push({ platform: '知乎日报', title, url, author, date: formattedDate || null, body });
        }
        console.log(`  ✓ 知乎日报 ${articles.length} 篇`);
    } catch {}
    return articles;
}

// ---------- 抓取与入库（ticket 124：四段读写 + sources 开关 + B 站源）----------
async function checkAndFetch() {
    if (running) return;
    running = true;
    try {
        console.log(`\n🔔 轮询抓取 (窗口: 最近 24h)...`);

        const disk = readNewsData();
        const existing = disk.articles;
        const existingUrls = new Set(existing.map(a => a.url));
        const existingTitles = new Set(existing.map(a => a.title.trim()));

        // 按 sources 开关决定抓哪些源（默认全开；插件剪藏本设置「数据源」组写四段）
        const sources = disk.sources || { ...DEFAULT_SOURCES };
        const jobs = [];
        if (sources.guokr !== false) jobs.push(fetchGuokr(existingUrls).then((r) => r));
        else console.log('  🚫 果壳 已关闭（sources.guokr=false），跳过');
        if (sources.zhihu !== false) jobs.push(fetchZhihu().then((r) => r));
        else console.log('  🚫 知乎日报 已关闭（sources.zhihu=false），跳过');
        // B 站：并入 jobs 并行抓取，同时收集本轮 UP 主资料（ticket 126）与「最近 N 条」配置（ticket 127）
        const biliPromise = sources.bilibili !== false
            ? fetchBilibili(disk.bilibiliUps, disk.bilibiliMaxItems, disk.bilibiliCookie)
            : null;
        if (!biliPromise) console.log('  🚫 B站 已关闭（sources.bilibili=false），跳过');
        if (biliPromise) jobs.push(biliPromise.then((r) => r.articles));

        // RSS 订阅源（ADR-0121）：按总开关 + 订阅列表抓取，并入同一去重入库链
        const rssPromise = sources.rss !== false && Array.isArray(disk.rssFeeds) && disk.rssFeeds.length > 0
            ? fetchRss(disk.rssFeeds)
            : null;
        if (sources.rss === false) console.log('  🚫 RSS 订阅 已关闭（sources.rss=false），跳过');
        else if (!rssPromise) console.log('  📡 RSS 订阅 (订阅列表为空，跳过)');
        if (rssPromise) jobs.push(rssPromise.then((r) => r.articles));

        const results = await Promise.all(jobs);
        const biliRes = biliPromise ? await biliPromise : null;
        const biliUpInfo = biliRes ? biliRes.upInfo : {};
        const rssRes = rssPromise ? await rssPromise : null;
        let newArticles = results.flat().filter(a => a && !existingUrls.has(a.url));

        // 标题去重
        const beforeTitleDedup = newArticles.length;
        newArticles = newArticles.filter(a => !existingTitles.has(a.title.trim()));
        const titleDupCount = beforeTitleDedup - newArticles.length;
        if (titleDupCount > 0) console.log(`  🏷️  标题去重过滤 ${titleDupCount} 篇`);

        // ticket n（用户拍板 2026-08-29）：B 站窗口裁剪——每 UP 库内只保留最近 N 条，超出窗口的老条目移除
        const prunedUrls = biliRes
            ? pruneBilibiliWindow(existing, biliRes.perUpArticles, biliRes.perUpRejected, biliRes.upInfo)
            : [];
        if (prunedUrls.length > 0) console.log(`  🧹 B站 窗口外清理 ${prunedUrls.length} 条`);
        const prunedSet = new Set(prunedUrls);
        let remaining = prunedUrls.length > 0 ? existing.filter(a => !prunedSet.has(a.url)) : existing;

        // ADR-0121：RSS 窗口裁剪——每 feed 平台库内只保留最近 30 条
        const rssPrunedUrls = rssRes ? capRssWindow([...remaining, ...newArticles], rssRes.perFeed, RSS_MAX_PER_FEED) : [];
        if (rssPrunedUrls.length > 0) console.log(`  🧹 RSS 窗口外清理 ${rssPrunedUrls.length} 条`);
        if (rssPrunedUrls.length > 0) {
            const rssPrunedSet = new Set(rssPrunedUrls);
            remaining = remaining.filter(a => !rssPrunedSet.has(a.url));
            newArticles = newArticles.filter(a => !rssPrunedSet.has(a.url));
        }

        // ADR-0121：缺失 title 的 feed 用 feed 自带标题回填（写回 rssFeeds 段）
        const rssTitleUpdates = rssRes && Object.keys(rssRes.titleUpdates).length > 0
            ? (disk.rssFeeds || []).map((f) => (rssRes.titleUpdates[f.url] ? { ...f, title: rssRes.titleUpdates[f.url] } : f))
            : null;

        if (newArticles.length === 0 && prunedUrls.length === 0 && rssPrunedUrls.length === 0 && !rssTitleUpdates) {
            console.log('  ℹ️  无新增文章');
        } else {
            for (const a of newArticles) {
                a.fetchedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
            }

            // 段级写回：替换 articles + 合并本轮 UP 主资料 + 回填 RSS feed 名（保留 stats/bilibiliUps/sources——插件侧维护段）
            writeNewsData({
                ...disk,
                articles: [...remaining, ...newArticles],
                bilibiliUpInfo: { ...(disk.bilibiliUpInfo || {}), ...biliUpInfo },
                ...(rssTitleUpdates ? { rssFeeds: rssTitleUpdates } : {}),
            });

            console.log(`  ✅ 新增 ${newArticles.length} 篇${prunedUrls.length > 0 ? `，B站窗口外清理 ${prunedUrls.length} 条` : ''}${rssPrunedUrls.length > 0 ? `，RSS窗口外清理 ${rssPrunedUrls.length} 条` : ''}，总计 ${remaining.length + newArticles.length} 篇`);
            for (const a of newArticles) {
                console.log(`  📰 [${a.platform}] ${a.title} — ${a.author || '未知'}`);
            }
        }
    } finally {
        running = false;
    }
}

// ---------- 主入口 ----------
if (require.main === module) {
    console.log('👁️  News Watcher 启动');
    console.log(`   监控: ${NEWS_PATH}`);
    console.log(`   源: 果壳科学人 + 知乎日报 + B站 UP 主 + RSS 订阅`);
    console.log(`   节奏: 启动即抓 + 每 ${FETCH_INTERVAL_MS / 60000} 分钟轮询, 窗口 24h, 去重入库`);

    checkAndFetch();
    setInterval(checkAndFetch, FETCH_INTERVAL_MS);
}

module.exports = { NEWS_PATH, FETCH_INTERVAL_MS, resolveNewsPath, checkAndFetch, readNewsData, fetchBilibiliUp, getBilibiliCookie, buildBilibiliArticle, extractUpInfo, parseBilibiliUpInfo, parseBilibiliMaxItems, parseBilibiliCookie, collectBilibiliBatch, pruneBilibiliWindow, buildRssArticle, capRssWindow, localDatetime, RSS_MAX_PER_FEED };
