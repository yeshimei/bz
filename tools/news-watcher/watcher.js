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

function readNews() {
    if (!fs.existsSync(NEWS_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(NEWS_PATH, 'utf-8')); }
    catch { return []; }
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

// ---------- 抓取与入库 ----------
async function checkAndFetch() {
    if (running) return;
    running = true;
    try {
        console.log(`\n🔔 轮询抓取 (窗口: 最近 24h)...`);

        const existing = readNews();
        const existingUrls = new Set(existing.map(a => a.url));
        const existingTitles = new Set(existing.map(a => a.title.trim()));

        const [guokr, zhihu] = await Promise.all([fetchGuokr(existingUrls), fetchZhihu()]);
        let newArticles = [...guokr, ...zhihu].filter(a => !existingUrls.has(a.url));

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

        const merged = [...existing, ...newArticles];
        const dir = path.dirname(NEWS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(NEWS_PATH, JSON.stringify(merged, null, 2), 'utf-8');

        console.log(`  ✅ 新增 ${newArticles.length} 篇，总计 ${merged.length} 篇`);
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
    console.log(`   源: 果壳科学人 + 知乎日报`);
    console.log(`   节奏: 启动即抓 + 每 ${FETCH_INTERVAL_MS / 60000} 分钟轮询, 窗口 24h, 去重入库`);

    checkAndFetch();
    setInterval(checkAndFetch, FETCH_INTERVAL_MS);
}

module.exports = { NEWS_PATH, resolveNewsPath, checkAndFetch };
