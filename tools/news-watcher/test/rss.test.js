const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// watcher 在 require 时解析 NEWS_PATH——先落一个临时 news.json 再加载模块
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'news-rss-'));
process.env.NEWS_PATH = path.join(tmpDir, 'news.json');
const { buildRssArticle, capRssWindow, readNewsData } = require('../watcher.js');

test('buildRssArticle：纯日期标题改写为「日期 · feed名」，platform/author = feed 名', () => {
    const a = buildRssArticle({
        title: '2026-09-10',
        link: 'https://daily.juya.uk/posts/2026-09-10/',
        pubDate: 'Thu, 10 Sep 2026 01:36:00 GMT',
        'content:encoded': '<h2>要闻</h2><ul><li>一条新闻 <a href="https://x.com/a">原文</a></li></ul>',
    }, '橘鸦AI早报');
    assert.strictEqual(a.platform, '橘鸦AI早报');
    assert.strictEqual(a.author, '橘鸦AI早报');
    assert.strictEqual(a.title, '2026-09-10 · 橘鸦AI早报');
    assert.ok(a.date && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(a.date), 'date 为本地时间串');
    assert.ok(a.body.includes('## 要闻'), 'turndown 标题转 atx');
    assert.ok(a.body.includes('一条新闻 [原文](https://x.com/a)'), 'turndown 列表与外链保留');
});

test('buildRssArticle：非日期标题原样保留；无 link/guid → null；正文退 description', () => {
    // rss-parser 把 <description> 映射为 item.content（description 键不存在），正文回退链走 content
    const a = buildRssArticle({ title: '某篇真实标题', link: 'https://a.com/1', content: '<p>摘要</p>' }, '某源');
    assert.strictEqual(a.title, '某篇真实标题');
    assert.strictEqual(a.body, '摘要');
    assert.strictEqual(buildRssArticle({ title: 'x' }, '某源'), null);
    assert.strictEqual(buildRssArticle(null, '某源'), null);
});

test('capRssWindow：每 feed 平台只保留最近 cap 条（date 降序，缺失视为最旧）', () => {
    const mk = (platform, url, date) => ({ platform, url, date });
    const existing = [
        mk('橘鸦AI早报', 'u-old1', '2026-08-01 08:00:00'),
        mk('橘鸦AI早报', 'u-old2', '2026-08-02 08:00:00'),
        mk('知乎日报', 'u-zh', '2026-08-01 08:00:00'), // 非 feed 平台不参与
    ];
    const window = [
        mk('橘鸦AI早报', 'u-new1', '2026-09-01 08:00:00'),
        mk('橘鸦AI早报', 'u-new2', '2026-09-02 08:00:00'),
    ];
    const pruned = capRssWindow([...existing, ...window], { '橘鸦AI早报': window }, 2);
    // cap=2，窗口已占满 2 条 → 库内更旧的 u-old1/u-old2 全裁
    assert.deepStrictEqual(pruned.sort(), ['u-old1', 'u-old2']);
});

test('capRssWindow：窗口超 cap 时裁窗口内最旧的；无日期条目视为最旧', () => {
    const mk = (url, date) => ({ platform: 'F', url, date });
    const window = [mk('w1', '2026-09-03 00:00:00'), mk('w2', '2026-09-02 00:00:00'), mk('w3', '2026-09-01 00:00:00'), mk('w4', '')];
    const pruned = capRssWindow(window, { F: window }, 2);
    // cap=2 保 w1/w2；w3（更旧）与 w4（无日期）裁掉
    assert.deepStrictEqual(pruned.sort(), ['w3', 'w4']);
});

test('capRssWindow：空窗口/空库安全', () => {
    assert.deepStrictEqual(capRssWindow([], { F: [] }, 30), []);
    assert.deepStrictEqual(capRssWindow([{ platform: 'F', url: 'u' }], {}, 30), []);
});

test('readNewsData：briefs/briefUps 残留段不透传，rssFeeds 解析且过滤非法条目', () => {
    fs.writeFileSync(process.env.NEWS_PATH, JSON.stringify({
        articles: [],
        sources: { zhihu: true, guokr: true, bilibili: true, rss: true },
        rssFeeds: [{ url: 'https://a.com/rss.xml', title: 'A' }, { url: '' }, null],
        briefs: [{ bvid: 'BV1' }],
        briefUps: ['123'],
    }));
    const disk = readNewsData();
    assert.deepStrictEqual(disk.rssFeeds, [{ url: 'https://a.com/rss.xml', title: 'A' }]);
    assert.strictEqual('briefs' in disk, false);
    assert.strictEqual('briefUps' in disk, false);
});
