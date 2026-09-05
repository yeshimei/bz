/**
 * clipbook 域：侧写读写 + 状态机派生（ADR-0082 / issue 177）
 * 纯数据层测试（node 环境）：clipArticle 状态派生（saved/reading）、queryBySource 视图语义、
 * articleKeyOf、excerpt、emptySidecar 容错。
 */
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { articleKeyOf, excerpt } from '../../src/clipbook/constants';
import { readClipbookData, emptySidecar } from '../../src/clipbook/data';
import { clipArticle, clipFromNote, queryBySource, clipUrlSet, aggregateSites } from '../../src/clipbook/store';

beforeEach(() => {
  resetObsidianMocks();
  setApp(mockAppWithVault(new MockVault()));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
});

const base = (patch: Record<string, any> = {}) => ({
  url: 'https://x.com/a', title: '标题A', platform: '果壳科学人', author: '果壳',
  date: '2026-08-30 10:00:00', fetchedAt: '2026-08-30 09:00:00',
  ...patch,
});

describe('clipbook/data sidecar', () => {
  it('缺失文件 → 建空侧写可读', async () => {
    const d = await readClipbookData();
    expect(d).toEqual({ articleOverrides: {}, savedArchive: [], order: [] });
  });

  it('容错解析损坏段', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/clipbook.json', JSON.stringify({ articleOverrides: null, savedArchive: [{}, { url: 'u', title: 't' }], order: 'x' }));
    setApp(mockAppWithVault(vault));
    const d = await readClipbookData();
    expect(d.articleOverrides).toEqual({});
    expect(d.savedArchive).toEqual([{ url: 'u', title: 't' }]);
    expect(d.order).toEqual([]);
  });
});

describe('clipbook/store 派生', () => {
  it('articleKeyOf：url 优先', () => {
    expect(articleKeyOf(base())).toBe('url:https://x.com/a');
    expect(articleKeyOf({ title: 't', date: '2026-01-01' })).toBe('td:t|2026-01-01');
  });

  it('clipArticle：未读默认 unread；body 截取摘要', () => {
    const a = clipArticle(base({ body: '正文内容 '.repeat(60) }), {});
    expect(a.st).toBe('unread');
    expect(a.origin).toBe('news');
    expect(a.id).toBe('url:https://x.com/a');
    expect(a.summary.length).toBeLessThanOrEqual(111);
    expect(a.summary.endsWith('…')).toBe(true);
    expect(a.srcName).toBe('果壳科学人');
  });

  it('clipArticle：reading 侧写 → reading', () => {
    const ov = { [articleKeyOf(base())]: { reading: true } };
    const a = clipArticle(base(), { overrides: ov });
    expect(a.st).toBe('reading');
  });

  it('clipArticle：saved 三通道（news state / 归档 / url 命中剪藏）', () => {
    expect(clipArticle(base({ state: 'saved' }), {}).st).toBe('saved');
    expect(clipArticle(base({ state: 'skipped' }), { savedKeys: new Set(['https://x.com/a']) }).st).toBe('saved');
    expect(clipArticle(base(), { clipByUrl: new Set(['https://x.com/a']) }).st).toBe('saved');
  });

  it('B站 UP 展开：srcName=UP 名', () => {
    const a = clipArticle(base({ platform: 'B站', author: '影视飓风', url: 'https://www.bilibili.com/video/BV1' }), {});
    expect(a.srcName).toBe('影视飓风');
    expect(a.typeLabel).toBe('UP主');
  });

  it('queryBySource：all 只含未处理（read!==true），saved/已剪藏隐藏', () => {
    const arts = [
      base({ url: 'u1', read: false }), // 未读保留
      base({ url: 'u2', title: 'B', read: true, state: 'skipped' }), // 已处理不进流
      base({ url: 'u3', title: 'C', read: false, state: 'saved' }), // news saved → 收件流隐藏
      base({ url: 'https://clip.ed/1', title: 'D', read: false }), // url 命中剪藏目录 → 保底 saved 隐藏
    ];
    const sidecar = { ...emptySidecar(), articleOverrides: { 'url:u1': { reading: true } } };
    const list = queryBySource(arts, sidecar, new Set(['https://clip.ed/1']), [], { kind: 'all' });
    expect(list.map((a) => a.url)).toEqual(['u1']);
    expect(list[0].st).toBe('reading'); // reading 侧写保留在流内
  });

  it('queryBySource：平台源 + UP 过滤', () => {
    const arts = [
      base({ url: 'u1', read: false, platform: 'B站', author: '影视飓风' }),
      base({ url: 'u2', read: false, platform: 'B站', author: '亿点点不一样' }),
      base({ url: 'u3', read: false, platform: '果壳科学人' }),
    ];
    const biliAll = queryBySource(arts, emptySidecar(), new Set(), [], { kind: 'inbox', platform: 'B站' });
    expect(biliAll.length).toBe(2);
    const yjf = queryBySource(arts, emptySidecar(), new Set(), [], { kind: 'inbox', platform: 'B站', up: '影视飓风' });
    expect(yjf.length).toBe(1);
    expect(yjf[0].url).toBe('u1');
    const guokr = queryBySource(arts, emptySidecar(), new Set(), [], { kind: 'inbox', platform: '果壳科学人' });
    expect(guokr.length).toBe(1);
  });

  it('queryBySource：clip 源返回剪藏条目（saved）', () => {
    const notes = [{ path: '归档/网页剪藏/笔记一.md', title: '笔记一', site: '知乎日报', url: 'https://zhihu.com/x', created: Date.now() }];
    const list = queryBySource([], emptySidecar(), new Set(), notes, { kind: 'clip' });
    expect(list.length).toBe(1);
    expect(list[0].origin).toBe('clip');
    expect(list[0].st).toBe('saved');
    expect(list[0].notePath).toBe('归档/网页剪藏/笔记一.md');
  });

  it('clipFromNote 直接派生（剪藏详情打开入口）', () => {
    const a = clipFromNote({ path: 'p.md', title: 'T', site: '果壳', url: 'https://g.cn/1', summary: 's', tags: ['a'], created: 1000 });
    expect(a.st).toBe('saved');
    expect(a.backlinks).toEqual([]);
  });


  it('excerpt：去图片/链接保文字/去记号', () => {
    expect(excerpt('![图](x) 文字 [链接](https://y) 后文')).toBe('文字 链接 后文');
    expect(excerpt('短文本')).toBe('短文本');
    expect(excerpt('')).toBe('');
    expect(excerpt('*强调* **粗** `码`')).toBe('强调 粗 码');
  });

  it('C7：同 key 重入不丢可视时长；切换目标才归零', async () => {
    const { setReadingSession, pauseReadingSession, __readingSessionStateForTests } = await import('../../src/clipbook/flow');
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000);
      setReadingSession('a');
      vi.setSystemTime(1_000_000 + 60_000); // 可视 60s
      setReadingSession('a'); // renderReader 重渲染重入（旧行为重置起点 → 丢 60s）
      vi.setSystemTime(1_000_000 + 90_000);
      pauseReadingSession();
      // 90s 全部计入（旧实现只余 30s）
      expect(__readingSessionStateForTests().accumMs).toBe(90_000);
      // 同篇再进入：恢复计时并继续累计
      setReadingSession('a');
      expect(__readingSessionStateForTests().opened).toBe(true);
      vi.setSystemTime(1_000_000 + 120_000);
      pauseReadingSession();
      expect(__readingSessionStateForTests().accumMs).toBe(120_000);
      // 切换目标：归零重开
      setReadingSession('b');
      expect(__readingSessionStateForTests()).toMatchObject({ curKey: 'b', accumMs: 0, opened: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('C6：B站 UP 名 upInfo 回填（缺省回退 author/uid）', async () => {
    const arts = [
      { platform: 'B站', title: '视频', url: 'https://b23.tv/1', author: '9823496', body: 'b' },
    ];
    const withInfo = clipArticle(arts[0], { upInfo: { '9823496': { name: '影视飓风' } } });
    expect(withInfo.srcName).toBe('影视飓风');
    const noInfo = clipArticle(arts[0], { upInfo: {} });
    expect(noInfo.srcName).toBe('9823496');
  });

  it('issue 206：domain 解析——无协议 URL 补 https；无 url 按平台兜底根域', () => {
    expect(clipArticle(base({ url: 'daily.zhihu.com/story/1' }), {}).domain).toBe('daily.zhihu.com');
    expect(clipArticle(base({ url: '' }), {}).domain).toBe('guokr.com'); // 果壳科学人兜底
    expect(clipArticle(base({ url: '', platform: '知乎日报' }), {}).domain).toBe('zhihu.com');
    expect(clipArticle(base({ url: '', platform: 'B站' }), {}).domain).toBe('bilibili.com');
  });

  it('issue 206：queryBySource news 面按 timeTs 降序（新文章在最前）', () => {
    const arts = [
      base({ url: 'u-old', fetchedAt: '2026-08-30 09:00:00' }),
      base({ url: 'u-new', fetchedAt: '2026-09-05 22:00:00' }),
      base({ url: 'u-mid', fetchedAt: '2026-09-01 12:00:00' }),
    ];
    const list = queryBySource(arts, emptySidecar(), new Set(), [], { kind: 'all' });
    expect(list.map((a) => a.url)).toEqual(['u-new', 'u-mid', 'u-old']);
  });
});

// ===== issue 222：rail 按 site 属性分类（aggregateSites + queryBySource site 源）=====

describe('clipbook site 聚合与站点源（issue 222）', () => {
  // 剪藏：果壳×2、微信公众号×1、空/缺 site×2（归「未知」）
  const notes = [
    { path: '归档/网页剪藏/a.md', site: '果壳', title: '剪A', url: 'https://guokr.com/1' },
    { path: '归档/网页剪藏/b.md', site: '微信公众号', title: '剪B', url: 'https://mp.weixin.qq.com/1' },
    { path: '归档/网页剪藏/c.md', site: '果壳', title: '剪C', url: 'https://guokr.com/3' },
    { path: '归档/网页剪藏/d.md', site: '', title: '剪D' },
    { path: '归档/网页剪藏/e.md', title: '剪E' },
  ];
  const arts = (extra: any[] = []) => [
    { platform: '知乎日报', title: '知乎文', url: 'https://zhihu.com/1', date: '2026-09-01 08:00:00' },
    { platform: '果壳科学人', title: '已读果壳', url: 'https://guokr.com/9', read: true, date: '2026-09-01 08:00:00' },
    { platform: 'B站', title: 'BV视频', url: 'https://b23.tv/1', date: '2026-09-02 08:00:00' },
    ...extra,
  ];

  it('aggregateSites：剪藏全量 + 未读 news 面；已处理骨架/url 命中剪藏不重复计', () => {
    const rows = aggregateSites(
      arts([{ platform: '果壳科学人', title: '未读但已剪藏', url: 'https://guokr.com/1', date: '2026-09-03 08:00:00' }]),
      notes,
      new Set<string>(),
      new Set<string>(['https://guokr.com/1']),
    );
    const get = (site: string) => rows.find((r) => r.site === site)!;
    expect(get('果壳')).toEqual({ site: '果壳', total: 2, unread: 0 });       // 剪藏 ×2；未读 news url 命中剪藏不重复计
    expect(get('微信公众号')).toEqual({ site: '微信公众号', total: 1, unread: 0 });
    expect(get('未知')).toEqual({ site: '未知', total: 2, unread: 0 });        // 空/缺 site 归桶
    expect(get('知乎日报')).toEqual({ site: '知乎日报', total: 1, unread: 1 }); // site 缺省回落 platform
    expect(get('B站')).toMatchObject({ total: 1, unread: 1 });
    expect(get('果壳科学人')).toBeUndefined(); // 已读骨架 + 命中项均不建行
  });

  it('aggregateSites：savedArchive 命中不计；排序 = 总数降序 → 未读降序 → 名 zh 序', () => {
    const rows = aggregateSites(
      arts(),
      notes,
      new Set<string>(['https://zhihu.com/1']), // 知乎文被侧写归档 → 不计
      new Set<string>(),
    );
    expect(rows.find((r) => r.site === '知乎日报')).toBeUndefined();
    expect(rows.map((r) => r.site)).toEqual(['果壳', '未知', 'B站', '微信公众号']); // 总数 2/2/1/1；并列 1 时未读降序（B站 1 > 微信 0）
  });

  it('queryBySource site 源：未读 news + 该站剪藏全量；saved 命中隐藏（剪藏面承接）', () => {
    // 知乎日报站点：1 条未读 news，无剪藏
    const zh = queryBySource(arts(), emptySidecar(), new Set(), notes, { kind: 'site', site: '知乎日报' });
    expect(zh).toHaveLength(1);
    expect(zh[0].origin).toBe('news');
    expect(zh[0].site).toBe('知乎日报');
    // 果壳站点：2 条剪藏（news 面该文已读不入池）
    const gk = queryBySource(arts(), emptySidecar(), new Set(), notes, { kind: 'site', site: '果壳' });
    expect(gk).toHaveLength(2);
    expect(gk.every((a) => a.origin === 'clip' && a.st === 'saved')).toBe(true);
    // 未读 news 但 url 命中剪藏 → news 面 saved 隐藏，列表只剩剪藏条目（不重复）
    const dual = queryBySource(
      [{ platform: '果壳科学人', title: '双命中', url: 'https://guokr.com/1', date: '2026-09-03 08:00:00' }],
      emptySidecar(),
      new Set(['https://guokr.com/1']),
      [notes[0]],
      { kind: 'site', site: '果壳' },
    );
    expect(dual).toHaveLength(1);
    expect(dual[0].origin).toBe('clip');
    // 空站点名归「未知」桶可查
    const unk = queryBySource([], emptySidecar(), new Set(), notes, { kind: 'site', site: '未知' });
    expect(unk).toHaveLength(2);
  });
});
