#!/usr/bin/env node
// ============================================================
// News Watcher — 每 30 分钟抓取最近 24 小时的文章
// 源: 果壳科学人(新API) + 知乎日报(官方API)
// 去重: URL + 标题，入库即未读
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

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
const DEFAULT_SOURCES = { zhihu: true, guokr: true, bilibili: true };

/** 读 news.json → 四段对象 { articles, stats, bilibiliUps, sources }；旧纯数组自动包裹；损坏 → 空骨架 */
function readNewsData() {
    if (!fs.existsSync(NEWS_PATH)) return { articles: [], stats: null, bilibiliUps: [], sources: { ...DEFAULT_SOURCES }, missing: true };
    try {
        const raw = JSON.parse(fs.readFileSync(NEWS_PATH, 'utf-8'));
        if (Array.isArray(raw)) return { articles: raw, stats: null, bilibiliUps: [], sources: { ...DEFAULT_SOURCES }, missing: false };
        if (raw && typeof raw === 'object') {
            return {
                articles: Array.isArray(raw.articles) ? raw.articles : [],
                stats: raw.stats && typeof raw.stats === 'object' ? raw.stats : null,
                bilibiliUps: Array.isArray(raw.bilibiliUps) ? raw.bilibiliUps.map((u) => String(u || '').trim()).filter(Boolean) : [],
                sources: raw.sources && typeof raw.sources === 'object' ? { ...DEFAULT_SOURCES, ...raw.sources } : { ...DEFAULT_SOURCES },
                missing: false,
            };
        }
        return { articles: [], stats: null, bilibiliUps: [], sources: { ...DEFAULT_SOURCES }, missing: false };
    } catch {
        return { articles: [], stats: null, bilibiliUps: [], sources: { ...DEFAULT_SOURCES }, missing: false };
    }
}

/** 写回 news.json 四段（调用方保证读盘后改段再整写，保留非本域段） */
function writeNewsData(data) {
    const dir = path.dirname(NEWS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NEWS_PATH, JSON.stringify(data, null, 2), 'utf-8');
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

/** 单个 UP 主动态翻页抓取（仅 DYNAMIC_TYPE_AV 视频投稿；24h 窗口） */
async function fetchBilibiliUp(uid, existingUrls, cookie) {
    const articles = [];
    const cutoff = Date.now() - WINDOW_MS;
    let offset = '';
    const headers = { ...HEADERS };
    if (cookie) headers['Cookie'] = cookie;

    // 安全翻页上限（防异常接口死循环）
    for (let page = 0; page < 50; page++) {
        const url = `${BILIBILI_API}?host_mid=${encodeURIComponent(uid)}&offset=${encodeURIComponent(offset)}&timezone_offset=-480`;
        const text = await safeFetch(url, { headers });
        if (!text) break;
        let data;
        try { data = JSON.parse(text); } catch { break; }
        if (!data || data.code !== 0 || !data.data || !Array.isArray(data.data.items)) break;

        const items = data.data.items || [];
        if (items.length === 0) break;
        let crossedWindow = false;

        for (const it of items) {
            const article = buildBilibiliArticle(it, cutoff);
            if (!article) continue;
            if (article.url && existingUrls.has(article.url)) continue;
            articles.push(article);
            if (cutoff && it.modules && it.modules.module_author && Number(it.modules.module_author.pub_ts || 0) * 1000 < cutoff) {
                crossedWindow = true; // 越过 24h 边界（按时间倒序）
            }
        }

        if (crossedWindow || !data.data.has_more) break;
        offset = data.data.offset || '';
        if (!offset) break;
    }
    return articles;
}

/** B 站源：cookie 引导 + 逐 UP 主抓取（24h 窗口；批内/库内双去重由 checkAndFetch 统一完成） */
async function fetchBilibili(existingUrls, upUids) {
    const list = upUids || [];
    if (list.length === 0) {
        console.log('  📡 B站 (无 UP 主名单，跳过)');
        return [];
    }
    console.log(`  📡 B站 (${list.length} 位 UP 主)...`);
    const cookie = await getBilibiliCookie();
    if (!cookie) {
        console.log('  ✗ B站 cookie 引导失败，跳过本轮（下轮重试）');
        return [];
    }
    const seen = new Set();
    const articles = [];
    for (const uid of list) {
        const ups = await fetchBilibiliUp(uid, existingUrls, cookie);
        for (const a of ups) {
            if (seen.has(a.url)) continue;
            seen.add(a.url);
            articles.push(a);
        }
    }
    console.log(`  ✓ B站 ${articles.length} 条 (24h 内)`);
    return articles;
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
        if (sources.bilibili !== false) jobs.push(fetchBilibili(existingUrls, disk.bilibiliUps));
        else console.log('  🚫 B站 已关闭（sources.bilibili=false），跳过');

        const results = await Promise.all(jobs);
        let newArticles = results.flat().filter(a => a && !existingUrls.has(a.url));

        // 标题去重
        const beforeTitleDedup = newArticles.length;
        newArticles = newArticles.filter(a => !existingTitles.has(a.title.trim()));
        const titleDupCount = beforeTitleDedup - newArticles.length;
        if (titleDupCount > 0) console.log(`  🏷️  标题去重过滤 ${titleDupCount} 篇`);

        if (newArticles.length === 0) {
            console.log('  ℹ️  无新增文章');
            return;
        }

        for (const a of newArticles) {
            a.fetchedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
        }

        // 四段写回：仅替换 articles 段（保留 stats/bilibiliUps/sources——插件侧维护段）
        writeNewsData({ ...disk, articles: [...existing, ...newArticles] });

        console.log(`  ✅ 新增 ${newArticles.length} 篇，总计 ${existing.length + newArticles.length} 篇`);
        for (const a of newArticles) {
            console.log(`  📰 [${a.platform}] ${a.title} — ${a.author || '未知'}`);
        }
    } finally {
        running = false;
    }
}

// ---------- 主入口 ----------
if (require.main === module) {
    console.log('👁️  News Watcher 启动');
    console.log(`   监控: ${NEWS_PATH}`);
    console.log(`   源: 果壳科学人 + 知乎日报 + B站 UP 主`);
    console.log(`   节奏: 启动即抓 + 每 ${FETCH_INTERVAL_MS / 60000} 分钟轮询, 窗口 24h, 去重入库`);

    checkAndFetch();
    setInterval(checkAndFetch, FETCH_INTERVAL_MS);
}

module.exports = { NEWS_PATH, FETCH_INTERVAL_MS, resolveNewsPath, checkAndFetch, readNewsData, fetchBilibiliUp, getBilibiliCookie, buildBilibiliArticle };
