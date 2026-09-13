// @vitest-environment node
/**
 * clipbook 聚合讯插件内抓取核心（issue 302 / ADR-0128）：
 * - 纯函数层：parseRssXml / buildRssArticle / capRssWindow / buildBilibiliArticle /
 *   collectBilibiliBatch / pruneBilibiliWindow / extractUpInfo / extractGuokrContent /
 *   normalizeFetchIntervalMin（移植守护 watcher.js 的口径回归）；
 * - 集成层：runNewsFetchRound + defaultFetchStore（MockVault 真实存储）——四源 fake httpGet
 *   → 双去重 / fetchedAt 打标 / lastFetchAt 落盘 / UP 资料合并 / 窗口裁剪 / 失败源计数。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getNewsFilePath } from '../../src/clipbook/news-data';
import {
  parseRssXml, buildRssArticle, capRssWindow, buildBilibiliArticle, collectBilibiliBatch,
  pruneBilibiliWindow, extractUpInfo, extractGuokrContent, runNewsFetchRound,
  defaultFetchStore, localDatetime, type HttpGet,
} from '../../src/clipbook/news-fetcher';
import { normalizeFetchIntervalMin } from '../../src/clipbook/news-data';

beforeEach(() => {
  resetObsidianMocks();
  setApp(mockAppWithVault(new MockVault()));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
});

// ---------- 纯函数层 ----------

describe('parseRssXml（轻量 RSS/Atom 解析）', () => {
  it('RSS item：CDATA 标题、link、content:encoded 优先、pubDate', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <title>橘鸦AI早报</title>
      <item><title><![CDATA[2026-09-13]]></title><link>https://a.example/1</link>
      <description><![CDATA[<p>摘要内容</p>]]></description>
      <content:encoded><![CDATA[<h2>全文标题</h2><p>正文段落</p>]]></content:encoded>
      <pubDate>Sun, 13 Sep 2026 08:00:00 GMT</pubDate></item>
      <item><title>无链接条目也保留 guid</title><guid>tag:2026</guid></item>
    </channel></rss>`;
    const items = parseRssXml(xml);
    expect(items.length).toBe(2);
    expect(items[0].title).toBe('2026-09-13');
    expect(items[0].link).toBe('https://a.example/1');
    expect(items[0].content).toContain('全文标题');
    expect(items[0].pubDate).toContain('2026');
    expect(items[1].guid).toBe('tag:2026');
  });

  it('Atom entry：link href 属性取址、summary 兜底', () => {
    const xml = `<feed><entry><title>Atom 文章</title>
      <link rel="alternate" href="https://a.example/atom"/>
      <summary>概要文本</summary><updated>2026-09-13T09:00:00Z</updated></entry></feed>`;
    const items = parseRssXml(xml);
    expect(items[0].link).toBe('https://a.example/atom');
    expect(items[0].summary).toBe('概要文本');
    expect(items[0].pubDate).toContain('2026-09-13');
  });

  it('实体解码与畸形输入容错', () => {
    const items = parseRssXml('<item><title>A &amp; B</title><link>https://a/?x=1&amp;y=2</link></item>');
    expect(items[0].title).toBe('A & B');
    expect(items[0].link).toBe('https://a/?x=1&y=2');
    expect(parseRssXml('not xml')).toEqual([]);
  });
});

describe('buildRssArticle（守护 buildRssArticle 口径）', () => {
  it('纯日期标题改写为「日期 · feed名」防同题；platform/author = feed 名', () => {
    const a = buildRssArticle({ title: '2026-09-13', link: 'https://a.example/1', guid: '', pubDate: 'Sun, 13 Sep 2026 08:00:00 GMT', content: '<p>正文</p>', summary: '' }, '橘鸦AI早报');
    expect(a.title).toBe('2026-09-13 · 橘鸦AI早报');
    expect(a.platform).toBe('橘鸦AI早报');
    expect(a.author).toBe('橘鸦AI早报');
    expect(a.body).toContain('正文');
    expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('正文缺省退 summary；无链接 guid 兜底；全空返回 null', () => {
    const b = buildRssArticle({ title: 't', link: '', guid: 'tag:1', pubDate: '', content: '', summary: '摘要正文' }, 'feed');
    expect(b.url).toBe('tag:1');
    expect(b.body).toContain('摘要正文');
    expect(buildRssArticle({ title: '', link: '', guid: '', pubDate: '', content: '', summary: '' }, 'feed')).toBeNull();
  });
});

describe('capRssWindow（每 feed 保留最近 cap 条）', () => {
  it('库内按 date 降序保最新 2 条，其余裁剪且去重', () => {
    const all = [
      { platform: 'f1', url: 'u1', date: '2026-09-13 01:00:00' },
      { platform: 'f1', url: 'u2', date: '2026-09-13 03:00:00' },
      { platform: 'f1', url: 'u3', date: '2026-09-13 02:00:00' },
      { platform: 'f1', url: 'u4', date: '' }, // 缺失视为最旧
    ];
    const pruned = capRssWindow(all, { f1: [{ platform: 'f1', url: 'w', date: '' }] }, 2);
    expect(pruned.sort()).toEqual(['u1', 'u4']);
  });
});

describe('B站纯函数（守护口径）', () => {
  const av = (bvid: string, pubTs: number, name = 'UP甲') => ({
    type: 'DYNAMIC_TYPE_AV',
    modules: {
      module_author: { name, pub_ts: pubTs, face: 'http://i0.hdslb.com/f.jpg' },
      module_dynamic: { major: { archive: { bvid, title: `视频${bvid}`, desc: '简介', cover: 'http://img/a.jpg', duration_text: '5:00' } } },
      module_desc: { desc: '动态描述' },
    },
  });

  it('buildBilibiliArticle：仅视频投稿；cutoff 越界拦；头像/封面统一 https', () => {
    const now = Date.now();
    const a = buildBilibiliArticle(av('BV1', Math.floor(now / 1000) - 60), now - 24 * 3600 * 1000);
    expect(a.platform).toBe('B站');
    expect(a.url).toBe('https://www.bilibili.com/video/BV1');
    expect(a.body).toContain('![封面](https://img/a.jpg)');
    expect(a.body).toContain('[视频BV1](https://www.bilibili.com/video/BV1)');
    expect(buildBilibiliArticle({ type: 'DYNAMIC_TYPE_WORD' }, null)).toBeNull();
    expect(buildBilibiliArticle(av('BV2', 1), now)).toBeNull(); // 远古投稿越 24h 界
  });

  it('collectBilibiliBatch：收满 limit 即停（总量口径非增量）', () => {
    const out: any[] = [];
    const full = collectBilibiliBatch([av('BV1', 100), av('BV2', 200), av('BV3', 300)], 2, out);
    expect(full).toBe(true);
    expect(out.length).toBe(2);
  });

  it('extractUpInfo：首个含资料条目；头像统一 https', () => {
    const info = extractUpInfo([av('BV1', 100)]);
    expect(info).toEqual({ name: 'UP甲', avatar: 'https://i0.hdslb.com/f.jpg' });
    expect(extractUpInfo([])).toBeNull();
  });

  it('pruneBilibiliWindow：风控轮不裁、窗口外且更旧的裁、更新的保守保留', () => {
    const existing = [
      { platform: 'B站', author: 'UP甲', url: 'old', date: '2026-09-01 00:00:00' },
      { platform: 'B站', author: 'UP甲', url: 'newer-not-in-window', date: '2026-09-13 23:00:00' },
    ];
    const windowArts = [
      { url: 'w1', date: '2026-09-13 10:00:00' },
      { url: 'w2', date: '2026-09-13 09:00:00' },
    ];
    expect(pruneBilibiliWindow(existing, { u1: windowArts }, {}, { u1: { name: 'UP甲' } })).toEqual(['old']);
    expect(pruneBilibiliWindow(existing, { u1: windowArts }, { u1: true }, { u1: { name: 'UP甲' } })).toEqual([]);
  });
});

describe('extractGuokrContent / localDatetime / normalizeFetchIntervalMin', () => {
  it('INITIAL_STORE 提取正文；损坏回 null', () => {
    const html = `<script>window.INITIAL_STORE={"articleStore":{"article":{"content":"<p>果壳正文</p>"}}};</script>`;
    expect(extractGuokrContent(html)).toBe('<p>果壳正文</p>');
    expect(extractGuokrContent('<script>window.INITIAL_STORE=broken</script>')).toBeNull();
    expect(extractGuokrContent('no marker')).toBeNull();
  });

  it('localDatetime 本地口径零填充', () => {
    const d = new Date(2026, 8, 13, 7, 5, 3);
    expect(localDatetime(d.getTime())).toBe('2026-09-13 07:05:03');
  });

  it('间隔档位归一：合法保留、非法回退 30', () => {
    for (const v of [30, 60, 120, 360]) expect(normalizeFetchIntervalMin(v)).toBe(v);
    for (const v of [0, 17, -30, 'abc', undefined, null, 45]) expect(normalizeFetchIntervalMin(v as any)).toBe(30);
  });
});

// ---------- 集成层（fake httpGet + MockVault 真实存储） ----------

function seedVault(vault: MockVault, data: Record<string, unknown>): void {
  vault.files.set(getNewsFilePath(), JSON.stringify({ articles: [], bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: 'ck', sources: { zhihu: true, guokr: true, bilibili: true, rss: true }, rssFeeds: [], ...data }));
}

const disk = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

/** 四源 fake httpGet：按 URL 前缀路由（知乎 latest/detail、果壳列表/文章页、B站动态、RSS） */
function makeHttpGet(opts: {
  zhihu?: any[]; guokr?: any[]; bili?: any; rssXml?: string; guokrArticleHtml?: string;
  failZhihu?: boolean;
}): HttpGet {
  return async (url) => {
    if (url.includes('news-at.zhihu.com/api/4/news/latest')) {
      if (opts.failZhihu) throw new Error('network');
      return JSON.stringify({ date: '20260913', stories: (opts.zhihu || []).map((z, i) => ({ id: z.id ?? String(i + 1), title: z.title, url: `https://daily.zhihu.com/story/${z.id ?? i + 1}` })) });
    }
    if (url.includes('news-at.zhihu.com/api/4/news/')) {
      const id = url.split('/').pop();
      const z = (opts.zhihu || []).find((x) => String(x.id) === id);
      return z ? JSON.stringify({ title: z.title, body: `<p>${z.body || z.title + '正文'}</p>`, editor_name: '编辑甲' }) : '{}';
    }
    if (url.includes('science_api/articles')) {
      return JSON.stringify(Object.assign({}, ...(opts.guokr || []).map((g) => ({ [g.id]: g }))));
    }
    if (url.includes('guokr.com/article/')) return opts.guokrArticleHtml || '<html></html>';
    if (url.includes('feed/space')) return JSON.stringify(opts.bili || { code: 0, data: { items: [], has_more: false, offset: '' } });
    if (url.endsWith('.xml')) return opts.rssXml || '';
    return null;
  };
}

describe('runNewsFetchRound + defaultFetchStore（集成）', () => {
  it('四源抓取：新增入库 + fetchedAt/lastFetchAt 打标 + 双去重', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {
      articles: [{ platform: '知乎日报', title: '旧文章', url: 'https://daily.zhihu.com/story/999', fetchedAt: '2026-09-12 00:00:00' }],
      bilibiliUps: ['1001'],
      rssFeeds: [{ url: 'https://daily.juya.uk/rss.xml' }],
    });
    const now = new Date(2026, 8, 13, 12, 0, 0).getTime();
    const httpGet = makeHttpGet({
      zhihu: [{ id: '1', title: '新知乎文', body: '知乎正文' }, { id: '999', title: '旧文章' }], // url 已存在 → 去重
      guokr: [{ id: 'g1', title: '果壳新文', date_published: '2026-09-13T10:00:00Z', authors: [{ nickname: '作者甲' }] }],
      guokrArticleHtml: `<script>window.INITIAL_STORE={"articleStore":{"article":{"content":"<p>果壳正文</p>"}}};</script>`,
      bili: { code: 0, data: { items: [{ type: 'DYNAMIC_TYPE_AV', modules: { module_author: { name: 'UP甲', pub_ts: Math.floor(now / 1000) - 3600 }, module_dynamic: { major: { archive: { bvid: 'BV1x', title: 'B站新视频', desc: '简介', cover: 'https://img/c.jpg' } }, module_desc: { desc: '动态描述' } } } }, { type: 'DYNAMIC_TYPE_WORD', modules: {} }], has_more: false, offset: '' } },
      rssXml: `<rss><channel><title>橘鸦AI早报</title><item><title><![CDATA[2026-09-13]]></title><link>https://juya.uk/1</link><content:encoded><![CDATA[<p>早报正文</p>]]></content:encoded><pubDate>Sun, 13 Sep 2026 06:00:00 GMT</pubDate></item></channel></rss>`,
    });
    const r = await runNewsFetchRound({ httpGet, store: defaultFetchStore(), now: () => now });
    expect(r.added).toBe(4); // 知乎 1（旧文去重）+ 果壳 1 + B站 1 + RSS 1
    expect(r.failedSources).toEqual([]);

    const d = disk(vault);
    const titles = d.articles.map((a: any) => a.title);
    expect(titles).toContain('新知乎文');
    expect(titles).toContain('果壳新文');
    expect(titles).toContain('B站新视频');
    expect(titles).toContain('2026-09-13 · 橘鸦AI早报');
    const zhihu = d.articles.find((a: any) => a.title === '新知乎文');
    expect(zhihu.body).toContain('知乎正文');
    expect(zhihu.author).toBe('编辑甲');
    expect(zhihu.fetchedAt).toBe('2026-09-13 12:00:00');
    const guokr = d.articles.find((a: any) => a.title === '果壳新文');
    expect(guokr.body).toContain('果壳正文');
    expect(guokr.author).toBe('作者甲');
    expect(d.lastFetchAt).toBe(now);
    expect(d.fetchIntervalMin).toBe(30); // 缺省段归一
    expect(d.bilibiliUpInfo['1001']).toEqual({ name: 'UP甲' }); // UP 资料回填
    // 标题去重：旧文章仍在库（url 命中既有，不重复追加）
    expect(d.articles.filter((a: any) => a.title === '旧文章').length).toBe(1);
  });

  it('标题去重：同题不同 url 不重复入库', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {
      articles: [{ platform: '知乎日报', title: '同名文章', url: 'https://daily.zhihu.com/story/old' }],
    });
    const httpGet = makeHttpGet({ zhihu: [{ id: '1', title: '同名文章' }] });
    const r = await runNewsFetchRound({ httpGet, store: defaultFetchStore(), now: () => 0 });
    expect(r.added).toBe(0);
    expect(disk(vault).articles.length).toBe(1);
  });

  it('单源失败：failedSources 计数不中断其他源', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {});
    const httpGet = makeHttpGet({ failZhihu: true, guokr: [{ id: 'g1', title: '果壳文', date_published: '2026-09-13T10:00:00Z' }] });
    const r = await runNewsFetchRound({ httpGet, store: defaultFetchStore(), now: () => Date.now() });
    expect(r.failedSources).toContain('知乎日报');
    expect(r.added).toBe(1);
  });

  it('B站窗口裁剪真实落盘（P1 回归）：窗口外老条目从磁盘删除，非仅视图裁剪', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    const now = new Date(2026, 8, 13, 12, 0, 0).getTime();
    seedVault(vault, {
      sources: { zhihu: false, guokr: false, bilibili: true, rss: false },
      bilibiliUps: ['1001'],
      bilibiliCookie: 'ck',
      articles: [{ platform: 'B站', author: 'UP甲', url: 'https://www.bilibili.com/video/BVold', date: '2026-09-01 00:00:00' }],
    });
    const httpGet = makeHttpGet({
      bili: { code: 0, data: { items: [{ type: 'DYNAMIC_TYPE_AV', modules: { module_author: { name: 'UP甲', pub_ts: Math.floor(now / 1000) - 3600 }, module_dynamic: { major: { archive: { bvid: 'BVnew', title: '新视频', desc: '', cover: '' } }, module_desc: { desc: '' } } } }], has_more: false, offset: '' } },
    });
    await runNewsFetchRound({ httpGet, store: defaultFetchStore(), now: () => now });
    const urls = disk(vault).articles.map((a: any) => a.url);
    expect(urls).toContain('https://www.bilibili.com/video/BVnew');
    expect(urls).not.toContain('https://www.bilibili.com/video/BVold'); // writeNewsDataMerged 并集复活即回归
  });

  it('B站风控 rejected：窗口不裁 + needsCookieNotice；源开关关闭则跳过', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {
      sources: { zhihu: false, guokr: false, bilibili: true, rss: false },
      bilibiliUps: ['1001'],
      bilibiliCookie: 'ck',
      articles: [{ platform: 'B站', author: 'UP甲', url: 'old', date: '2026-09-01 00:00:00' }],
    });
    const httpGet = makeHttpGet({ bili: { code: -352, message: '风控' } });
    const r = await runNewsFetchRound({ httpGet, store: defaultFetchStore(), now: () => Date.now() });
    expect(r.added).toBe(0);
    expect(r.needsCookieNotice).toBe(true);
    expect(disk(vault).articles.length).toBe(1); // 风控轮窗口不裁，old 保留
  });
});
