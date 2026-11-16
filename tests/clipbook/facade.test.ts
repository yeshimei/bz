/**
 * clipbook 对外门面（剪藏成书）：源清单 / 文章清单 / 正文 / 已读 / 存剪藏。
 *
 * 这是 bz-reader「剪藏成书」的跨插件数据契约：阅读器只认这里的形状，
 * 不直接读 news.json / clipbook.json 的形状（那两个随时会加段）。
 * 纯函数 + 注入依赖，node 环境可测。
 */
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  buildExportIndex,
  createClipbookFacade,
  type ClipExportIndex,
  type ClipSummaryResult,
  type ExportBuildInput,
} from '../../src/clipbook/facade';

const feed = (title: string, url: string) => ({ title, url });

const newsArticle = (patch: Record<string, any> = {}) => ({
  url: 'https://x.com/a',
  title: '标题A',
  platform: '果壳科学人',
  author: '果壳',
  date: '2026-09-01 10:00:00',
  fetchedAt: '2026-09-01 09:00:00',
  body: '正文A',
  ...patch,
});

const clipNote = (patch: Record<string, any> = {}) => ({
  path: '归档/网页剪藏/标题A.md',
  file: {},
  url: 'https://x.com/a',
  author: '作者A',
  site: '果壳科学人',
  summary: '摘要A',
  tags: ['tag'],
  title: '标题A',
  created: 1790000000000,
  backlinkNames: [],
  domain: 'x.com',
  ...patch,
});

const input = (patch: Partial<ExportBuildInput> = {}): ExportBuildInput => ({
  articles: [],
  clips: [],
  rssFeeds: [],
  upIds: [],
  upInfo: {},
  sources: { zhihu: false, guokr: false, bilibili: true, rss: true },
  ...patch,
});

describe('buildExportIndex · 订阅源', () => {
  it('RSS / UP / 平台源都列出来，空源也保留', () => {
    const idx = buildExportIndex(input({
      rssFeeds: [feed('少数派', 'https://sspai.com/feed'), feed('阮一峰', 'https://ruanyf.com/feed')],
      upIds: ['1001'],
      upInfo: { '1001': { name: '影视飓风' } },
      sources: { zhihu: true, guokr: true, bilibili: true, rss: true },
    }));
    expect(idx.sources.map((s) => s.id)).toEqual([
      'rss:https://sspai.com/feed',
      'rss:https://ruanyf.com/feed',
      'bili:1001',
      'platform:zhihu',
      'platform:guokr',
    ]);
    expect(idx.sources.map((s) => s.name)).toEqual(['少数派', '阮一峰', '影视飓风', '知乎日报', '果壳科学人']);
  });

  it('平台开关关着就不出现', () => {
    const idx = buildExportIndex(input());
    expect(idx.sources.map((s) => s.id)).toEqual([]);
  });

  it('没有订阅但有文章：回落到站点源', () => {
    const idx = buildExportIndex(input({ articles: [newsArticle({ platform: '少数派' })] }));
    expect(idx.sources).toEqual([{ id: 'site:少数派', name: '少数派', kind: 'site' }]);
  });
});

describe('buildExportIndex · 文章归属', () => {
  it('RSS 文章按 platform 命中订阅标题', () => {
    const idx = buildExportIndex(input({
      rssFeeds: [feed('少数派', 'https://sspai.com/feed')],
      articles: [newsArticle({ platform: '少数派', url: 'https://sspai.com/post/1' })],
    }));
    expect(idx.rows[0].sourceId).toBe('rss:https://sspai.com/feed');
    expect(idx.rows[0].source).toBe('少数派');
  });

  it('B站文章按 author（uid）归到 UP 源', () => {
    const idx = buildExportIndex(input({
      upIds: ['1001'],
      upInfo: { '1001': { name: '影视飓风' } },
      articles: [newsArticle({ platform: 'B站', author: '1001', url: 'https://www.bilibili.com/video/BV1', title: '视频' })],
    }));
    expect(idx.rows[0].sourceId).toBe('bili:1001');
    expect(idx.rows[0].source).toBe('影视飓风');
  });

  it('剪藏笔记按 site 命中 RSS 订阅，没有命中就落站点源', () => {
    const idx = buildExportIndex(input({
      rssFeeds: [feed('少数派', 'https://sspai.com/feed')],
      clips: [
        clipNote({ url: 'https://sspai.com/post/2', site: '少数派', path: '剪藏/少数派.md' }),
        clipNote({ url: 'https://blog.example.com/a', site: '某博客', path: '剪藏/某博客.md', title: '某博客' }),
      ],
    }));
    const byKey = new Map(idx.rows.map((r) => [r.url, r]));
    expect(byKey.get('https://sspai.com/post/2')!.sourceId).toBe('rss:https://sspai.com/feed');
    expect(byKey.get('https://blog.example.com/a')!.sourceId).toBe('site:某博客');
    expect(idx.sources.some((s) => s.id === 'site:某博客')).toBe(true);
  });
});

describe('buildExportIndex · 去重与状态', () => {
  it('同一 URL 两侧都有：保留剪藏笔记，标 saved', () => {
    const idx = buildExportIndex(input({
      articles: [newsArticle()],
      clips: [clipNote()],
    }));
    expect(idx.rows).toHaveLength(1);
    expect(idx.rows[0].origin).toBe('clip');
    expect(idx.rows[0].state).toBe('saved');
    expect(idx.rows[0].notePath).toBe('归档/网页剪藏/标题A.md');
  });

  it('news 已读状态透出；未读保持 unread', () => {
    const idx = buildExportIndex(input({
      articles: [
        newsArticle({ url: 'https://x.com/read', read: true, state: 'skipped' }),
        newsArticle({ url: 'https://x.com/unread' }),
      ],
    }));
    const byKey = new Map(idx.rows.map((r) => [r.url, r]));
    expect(byKey.get('https://x.com/read')!.state).toBe('read');
    expect(byKey.get('https://x.com/unread')!.state).toBe('unread');
  });

  it('按时间倒序，稳定的 key 与摘要', () => {
    const idx = buildExportIndex(input({
      articles: [
        newsArticle({ url: 'https://x.com/old', date: '2026-08-01 00:00:00', fetchedAt: '2026-08-01 00:00:00' }),
        newsArticle({ url: 'https://x.com/new', date: '2026-09-01 00:00:00', fetchedAt: '2026-09-01 00:00:00' }),
      ],
    }));
    expect(idx.rows.map((r) => r.url)).toEqual(['https://x.com/new', 'https://x.com/old']);
    expect(idx.rows[0].key).toBe('url:https://x.com/new');
    /* 2026-11-13：`summary` 的门槛变了 —— 只有「在阅读器里生成过的 AI 摘要」
       （aiSummary）才出门面；RSS description 和正文摘录都不再顶替它。
       否则阅读器会把正文第一段原样抄到标题下面。 */
    expect(idx.rows[0].summary).toBe('');
  });

  it('正文长度随清单出门面：阅读器按它估页数（不再一律 1200）', () => {
    const idx = buildExportIndex(input({
      articles: [newsArticle({ url: 'https://x.com/a', body: '一二三四五' })],
      clips: [clipNote({ url: 'https://x.com/b' })],
    }));
    const byUrl = new Map(idx.rows.map((r) => [r.url, r]));
    expect(byUrl.get('https://x.com/a')!.size).toBe(5);
    /* 剪藏笔记清单阶段不读正文：给 0，阅读器渲染后回填 */
    expect(byUrl.get('https://x.com/b')!.size).toBe(0);
  });

  it('剪藏行带日期（剪藏后副标题的日期不再消失）', () => {
    const idx = buildExportIndex(input({ clips: [clipNote()] }));
    expect(idx.rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('订阅文章已经生成过 AI 摘要 → 清单里就是那段摘要，不是正文开头', () => {
    const idx = buildExportIndex(input({
      articles: [newsArticle({ body: '很长很长的正文开头，一直被当摘要用', aiSummary: '这才是 AI 摘要' })],
    }));
    expect(idx.rows[0].summary).toBe('这才是 AI 摘要');
  });

  it('RSS 自带的 summary 不进这个字段（那是 description，会和正文开头重复）', () => {
    const idx = buildExportIndex(input({
      articles: [newsArticle({ body: '正文开头一段', summary: '……等。查看全文' })],
    }));
    expect(idx.rows[0].summary).toBe('');
  });
});

describe('createClipbookFacade', () => {
  const makeFacade = (idx: ClipExportIndex, opts: { folderOk?: boolean; noteText?: string } = {}) => {
    const markRead = vi.fn(async (raws: any[]) => raws.length);
    const save = vi.fn(async (_raw: any) => ({ ok: true, notePath: '归档/网页剪藏/标题A.md' }));
    const summarize = vi.fn(async (_raw: any): Promise<ClipSummaryResult> => ({ ok: true, summary: 'AI 摘要一段' }));
    const open = vi.fn();
    const recordRead = vi.fn(async (entries: any[]) => entries.length);
    const facade = createClipbookFacade({
      readIndex: async () => idx,
      readNote: async () => opts.noteText ?? '---\nurl: x\n---\n> [!summary] 标题\n> 摘要\n\n正文A',
      /* 正文直读：真实实现读一次 news.json 按 key 找，测试里等价地从索引取 */
      readNewsBody: async (key: string) => String(idx.rows.find((r) => r.key === key)?.raw?.body ?? ''),
      markRead,
      save,
      summarize,
      recordRead,
      isFolderReady: () => opts.folderOk !== false,
      dataVersion: async () => 'v1',
      open,
    });
    return { facade, markRead, save, summarize, recordRead, open };
  };

  it('open 转交给主界面入口（阅读器「去设置」按钮走这里）', () => {
    const { facade, open } = makeFacade(buildExportIndex(input()));
    facade.open();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('articles 过滤：savedOnly 只留剪藏；includeRead=false 去掉已读', async () => {
    const idx = buildExportIndex(input({
      articles: [newsArticle({ url: 'https://x.com/read', read: true }), newsArticle({ url: 'https://x.com/new' })],
      clips: [clipNote({ url: 'https://x.com/saved', path: '剪藏/s.md' })],
    }));
    const { facade } = makeFacade(idx);
    expect((await facade.articles()).map((a) => a.url)).toEqual(['https://x.com/saved', 'https://x.com/read', 'https://x.com/new']);
    expect((await facade.articles({ savedOnly: true })).map((a) => a.url)).toEqual(['https://x.com/saved']);
    expect((await facade.articles({ includeRead: false })).map((a) => a.url)).toEqual(['https://x.com/saved', 'https://x.com/new']);
  });

  it('articleBody：剪藏笔记剥掉 frontmatter 与摘要卡，news 原样', async () => {
    const idx = buildExportIndex(input({
      articles: [newsArticle()],
      clips: [clipNote({ url: 'https://x.com/clip', path: '剪藏/c.md' })],
    }));
    const { facade } = makeFacade(idx);
    const clipBody = await facade.articleBody('clip:剪藏/c.md');
    expect(clipBody).toBe('正文A');
    const newsBody = await facade.articleBody('url:https://x.com/a');
    expect(newsBody).toBe('正文A');
    expect(await facade.articleBody('url:不存在')).toBe('');
  });

  it('markRead：只把未读的 news 交给 bz 的已读写回，返回变更数', async () => {
    const idx = buildExportIndex(input({
      articles: [
        newsArticle({ url: 'https://x.com/u1' }),
        newsArticle({ url: 'https://x.com/read', read: true }),
      ],
      clips: [clipNote({ url: 'https://x.com/saved', path: '剪藏/s.md' })],
    }));
    const { facade, markRead } = makeFacade(idx);
    const n = await facade.markRead(['url:https://x.com/u1', 'url:https://x.com/read', 'clip:剪藏/s.md', 'url:不存在']);
    expect(n).toBe(1);
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead.mock.calls[0][0].map((r: any) => r.url)).toEqual(['https://x.com/u1']);
  });

  it('markRead：多篇未读一次交底（只写一遍盘，不逐篇循环）', async () => {
    const idx = buildExportIndex(input({
      articles: [
        newsArticle({ url: 'https://x.com/u1' }),
        newsArticle({ url: 'https://x.com/u2' }),
        newsArticle({ url: 'https://x.com/u3' }),
      ],
    }));
    const { facade, markRead } = makeFacade(idx);
    const n = await facade.markRead(['url:https://x.com/u1', 'url:https://x.com/u2', 'url:https://x.com/u3']);
    expect(n).toBe(3);
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead.mock.calls[0][0].map((r: any) => r.url)).toEqual([
      'https://x.com/u1', 'https://x.com/u2', 'https://x.com/u3',
    ]);
  });

  it('articleBody：直读正文，不重建全索引（阅读器按章取，扫目录会乘上章数）', async () => {
    const idx = buildExportIndex(input({
      articles: [newsArticle({ url: 'https://x.com/a' })],
      clips: [clipNote({ url: 'https://x.com/clip', path: '剪藏/c.md' })],
    }));
    let indexed = 0;
    const facade = createClipbookFacade({
      readIndex: async () => { indexed++; return idx; },
      readNote: async () => '正文A',
      readNewsBody: async (key: string) => (key === 'url:https://x.com/a' ? '新闻正文' : ''),
      markRead: async () => 0,
      save: async () => ({ ok: true }),
      summarize: async () => ({ ok: true }),
      recordRead: async () => 0,
      isFolderReady: () => true,
      dataVersion: async () => 'v1',
      open: () => {},
    });
    expect(await facade.articleBody('clip:剪藏/c.md')).toBe('正文A');
    expect(await facade.articleBody('url:https://x.com/a')).toBe('新闻正文');
    expect(await facade.articleBody('url:不存在')).toBe('');
    expect(indexed).toBe(0);
  });

  it('saveArticle：写盘失败回 saveFailed，不再谎报「找不到」', async () => {
    const idx = buildExportIndex(input({ articles: [newsArticle({ url: 'https://x.com/a' })] }));
    const facade = createClipbookFacade({
      readIndex: async () => idx,
      readNote: async () => '',
      readNewsBody: async () => '',
      markRead: async () => 0,
      save: async () => ({ ok: false }),
      summarize: async () => ({ ok: true }),
      recordRead: async () => 0,
      isFolderReady: () => true,
      dataVersion: async () => 'v1',
      open: () => {},
    });
    expect(await facade.saveArticle('url:https://x.com/a')).toEqual({ ok: false, code: 'saveFailed' });
  });

  it('saveArticle：B站不存剪藏、剪藏文件夹没配、找不到条目都给稳定原因码', async () => {
    const idx = buildExportIndex(input({
      articles: [
        newsArticle({ url: 'https://www.bilibili.com/video/BV1', platform: 'B站', author: '1001' }),
        newsArticle({ url: 'https://x.com/a' }),
      ],
    }));
    const { facade, save } = makeFacade(idx);
    expect(await facade.saveArticle('url:https://www.bilibili.com/video/BV1')).toEqual({ ok: false, code: 'bilibili' });
    expect(await facade.saveArticle('url:不存在')).toEqual({ ok: false, code: 'notFound' });
    expect(save).not.toHaveBeenCalled();

    const { facade: noFolder } = makeFacade(idx, { folderOk: false });
    expect(await noFolder.saveArticle('url:https://x.com/a')).toEqual({ ok: false, code: 'noFolder' });

    const { facade: ok } = makeFacade(idx);
    expect(await ok.saveArticle('url:https://x.com/a')).toEqual({ ok: true, notePath: '归档/网页剪藏/标题A.md' });
  });

  it('sources / isReady 直接转发', async () => {
    const idx = buildExportIndex(input({ rssFeeds: [feed('少数派', 'https://sspai.com/feed')] }));
    const { facade } = makeFacade(idx);
    expect((await facade.sources()).map((s) => s.id)).toEqual(['rss:https://sspai.com/feed']);
    expect(facade.isReady()).toEqual({ ok: true });
    const { facade: noFolder } = makeFacade(idx, { folderOk: false });
    expect(noFolder.isReady()).toEqual({ ok: false, code: 'noFolder' });
  });

  it('summarizeArticle：订阅文章转给实现方，结果原样透传', async () => {
    const idx = buildExportIndex(input({ articles: [newsArticle()] }));
    const { facade, summarize } = makeFacade(idx);
    const out = await facade.summarizeArticle('url:https://x.com/a');
    expect(out).toEqual({ ok: true, summary: 'AI 摘要一段' });
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(summarize.mock.calls[0][0]).toMatchObject({ url: 'https://x.com/a' });
  });

  it('summarizeArticle：剪藏笔记不重复生成摘要（摘要来自它自己的 frontmatter）', async () => {
    const idx = buildExportIndex(input({ clips: [clipNote({ path: '剪藏/s.md' })] }));
    const { facade, summarize } = makeFacade(idx);
    expect(await facade.summarizeArticle('clip:剪藏/s.md')).toEqual({ ok: false, code: 'notFound' });
    expect(summarize).not.toHaveBeenCalled();
  });

  it('summarizeArticle：找不到条目直接 notFound，不打 AI', async () => {
    const { facade, summarize } = makeFacade(buildExportIndex(input({})));
    expect(await facade.summarizeArticle('url:不存在')).toEqual({ ok: false, code: 'notFound' });
    expect(summarize).not.toHaveBeenCalled();
  });

  it('summarizeArticle：AI 失败 / 写盘失败的原因码原样带回', async () => {
    const idx = buildExportIndex(input({ articles: [newsArticle()] }));
    const { facade, summarize } = makeFacade(idx);
    summarize.mockResolvedValueOnce({ ok: false, code: 'aiFailed' });
    expect(await facade.summarizeArticle('url:https://x.com/a')).toEqual({ ok: false, code: 'aiFailed' });
    summarize.mockResolvedValueOnce({ ok: false, code: 'writeFailed' });
    expect(await facade.summarizeArticle('url:https://x.com/a')).toEqual({ ok: false, code: 'writeFailed' });
  });
});
