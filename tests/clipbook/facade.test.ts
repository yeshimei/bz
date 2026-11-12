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
    expect(idx.rows[0].summary.length).toBeGreaterThan(0);
  });
});

describe('createClipbookFacade', () => {
  const makeFacade = (idx: ClipExportIndex, opts: { folderOk?: boolean; noteText?: string } = {}) => {
    const markRead = vi.fn(async (raws: any[]) => raws.length);
    const save = vi.fn(async (_raw: any) => ({ ok: true, notePath: '归档/网页剪藏/标题A.md' }));
    const facade = createClipbookFacade({
      readIndex: async () => idx,
      readNote: async () => opts.noteText ?? '---\nurl: x\n---\n> [!summary] 标题\n> 摘要\n\n正文A',
      markRead,
      save,
      isFolderReady: () => opts.folderOk !== false,
      dataVersion: async () => 'v1',
    });
    return { facade, markRead, save };
  };

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
});
