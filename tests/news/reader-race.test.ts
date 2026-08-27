/**
 * 聚合讯竞态与游标回归（P0-5 双写者丢数据 / 半截 JSON 容错 / P2 游标锚定）。
 * 独立测试文件：vi.resetModules 保证每例拿到全新 reader 模块状态（currentIndex/allArticles 干净）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';

const NEWS_JSON = 'CONFIG/STORAGE/news.json';
const STATS_JSON = 'CONFIG/STORAGE/news-stats.json';

function makeArticle(title: string, body = `${title} 正文`) {
  return {
    title,
    url: `https://x.com/${encodeURIComponent(title)}`,
    platform: '站',
    author: '甲',
    date: '2025-06-10 09:00:00',
    summary: `${title}摘要`,
    tags: ['AI'],
    body,
  };
}

type ReaderModule = typeof import('../../src/news/reader');

describe('聚合讯 saveArticles 双写者合并（P0-5）', () => {
  let reader: ReaderModule;
  let setAppFresh: typeof setApp;

  beforeEach(async () => {
    vi.resetModules();
    // resetModules 后 reader 与 core/app 必须取自同一张新模块图
    reader = await import('../../src/news/reader');
    ({ setApp: setAppFresh } = await import('../../src/core/app'));
  });

  function setup(disk: any[]) {
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    const vault = new MockVault();
    // ticket 124：四段结构 fixture（stats 内嵌）
    vault.files.set(NEWS_JSON, JSON.stringify({ articles: disk, stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} }, bilibiliUps: [], sources: { zhihu: true, guokr: true, bilibili: true } }));
    setAppFresh({ vault, metadataCache: {}, workspace: { openLinkText: vi.fn() } } as any);
    reader.init(false);
    return vault;
  }

  it('vitest 时序模拟：加载 [A,B] → 磁盘被外部追加成 [A,B,C] → 处理后 save → 磁盘=[处理后A,B,C]，C 不丢', async () => {
    const A = makeArticle('A');
    const B = makeArticle('B');
    const C = makeArticle('C', 'C 外部追加正文');
    const vault = setup([A, B]);

    await reader.loadArticles();
    reader.render();
    expect(document.querySelector('.news-card-title')!.textContent).toBe('A');

    // 内存快照完成后、保存开始前：另一写入者向磁盘追加 C（真实竞态窗口）
    const disk4 = JSON.parse(vault.files.get(NEWS_JSON)!);
    disk4.articles = [A, B, C];
    vault.files.set(NEWS_JSON, JSON.stringify(disk4));

    reader.skipArticle(); // A 标读（delete body）→ 内部触发 saveArticles
    await new Promise((r) => setTimeout(r, 20)); // 冲刷异步写回链

    const saved = JSON.parse(vault.files.get(NEWS_JSON)!);
    expect(saved.articles.map((s: any) => s.title)).toEqual(['A', 'B', 'C']);
    expect(saved.articles[0].read).toBe(true); // 内存处理状态照常落盘
    expect(saved.articles[0].state).toBe('skipped');
    expect(saved.articles[0].body).toBeUndefined();
    expect(saved.articles[2].read).toBeUndefined(); // 外部追加项原样保留
    expect(saved.articles[2].body).toBe('C 外部追加正文');
    expect(saved.bilibiliUps).toEqual([]); // 非本域段保留
    expect(saved.sources).toEqual({ zhihu: true, guokr: true, bilibili: true });
  });

  it('mergeWithDisk：url 键优先合并处理状态；无 url 回退 title+date 键；磁盘多出的项保留；内存新增防御性追加', () => {
    const mem = [
      { url: 'u1', title: '甲', date: 'd1', read: true },
      { title: '乙', date: 'd2', read: true }, // 无 url → title+date 键
      { url: 'mem-only', title: '内' }, // 磁盘没有的内存项 → 追加不丢
    ];
    const disk = [
      { url: 'u1', title: '甲', date: 'd1' },
      { url: 'u9', title: '乙', date: '其他日期' }, // url 不同且 title+date 不同 → 磁盘独有，保留
      { title: '乙', date: 'd2' }, // title+date 命中内存第 2 项
      { url: 'disk-only', title: '丁' },
    ];
    const merged = reader.mergeWithDisk(mem, disk);
    expect(merged).toHaveLength(5);
    expect(merged[0]).toMatchObject({ url: 'u1', read: true }); // 内存版本覆盖（url 键）
    expect(merged[1]).toMatchObject({ url: 'u9' }); // 磁盘独有原样
    expect(merged[2]).toMatchObject({ title: '乙', date: 'd2', read: true }); // title+date 合并
    expect(merged[3]).toMatchObject({ url: 'disk-only' }); // 磁盘多出的项保留
    expect(merged[4]).toMatchObject({ url: 'mem-only' }); // 内存新增防御性追加
  });

  it('崩溃半截 JSON：load 容错不清盘（error toast + 错误态，不渲染「读完」态），save 不覆写原样保留', async () => {
    const halfJson = '{"articles": [';
    const vault = setup([]);
    vault.files.set(NEWS_JSON, halfJson);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await reader.loadArticles();
      expect(warnSpy).toHaveBeenCalled(); // 技术详情进 console
      expect(hasNotice(/新闻数据读取失败/)).toBe(true); // 人话 error toast
      reader.render();
      // 错误态而非「读完」态：不出现完成卡片
      expect(document.querySelector('.news-card-area')).toBeNull();
      const doneEl = document.querySelector('.news-done');
      expect(doneEl).not.toBeNull();
      expect(doneEl!.textContent).toContain('新闻数据读取失败');
      expect(doneEl!.textContent).not.toContain('今日文章已读完');

      await reader.saveArticles();
      expect(vault.files.get(NEWS_JSON)).toBe(halfJson); // 解析失败不覆写
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('磁盘为 JSON 但非数组也非对象（如数字）→ save 跳过不覆写（防御）', async () => {
    const notArray = '42';
    const vault = setup([]);
    vault.files.set(NEWS_JSON, notArray);
    try {
      await reader.loadArticles();
      await reader.saveArticles();
      expect(vault.files.get(NEWS_JSON)).toBe(notArray);
    } finally {
      // 无 warn 断言（readNewsData 静默回退空骨架；saveArticles 遇 !ok 直接返回）
    }
  });
});

describe('聚合讯游标锚定（P2：重载/过滤后按标识定位）', () => {
  let reader: ReaderModule;
  let setAppFresh: typeof setApp;

  beforeEach(async () => {
    vi.resetModules();
    reader = await import('../../src/news/reader');
    ({ setApp: setAppFresh } = await import('../../src/core/app'));
  });

  function setup(disk: any[]) {
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    const vault = new MockVault();
    vault.files.set(NEWS_JSON, JSON.stringify(disk));
    vault.files.set(STATS_JSON, JSON.stringify({ totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} }));
    setAppFresh({ vault, metadataCache: {}, workspace: { openLinkText: vi.fn() } } as any);
    reader.init(false);
    return vault;
  }

  it('重载后当前篇在外部刷新列表中移位 → 游标停在同一篇而非错位', async () => {
    const A = makeArticle('A');
    const B = makeArticle('B');
    const C = makeArticle('C');
    const X = makeArticle('X');
    const vault = setup([A, B, C]);

    await reader.loadArticles();
    reader.render();
    reader.skipArticle(); // A 读 → 当前指向 B
    expect(document.querySelector('.news-card-title')!.textContent).toBe('B');
    await new Promise((r) => setTimeout(r, 20)); // 冲刷内部 saveArticles

    // 外部刷新：磁盘重排为 [C, X, B]（B 移位到 index 2）
    vault.files.set(NEWS_JSON, JSON.stringify([C, X, B]));
    await reader.loadArticles();
    reader.render();
    // 锚定成功：仍停在 B（旧行为按索引夹取会错位到别的文章或越界）
    expect(document.querySelector('.news-card-title')!.textContent).toBe('B');
  });

  it('锚定失败（当前篇从磁盘消失）→ 夹取边界，不越界', async () => {
    const A = makeArticle('A');
    const B = makeArticle('B');
    const C = makeArticle('C');
    const D = makeArticle('D');
    const vault = setup([A, B, C]);

    await reader.loadArticles();
    reader.render();
    reader.skipArticle();
    reader.skipArticle(); // 读两篇 → 当前指向第三篇 C（index 2）
    expect(document.querySelector('.news-card-title')!.textContent).toBe('C');
    await new Promise((r) => setTimeout(r, 20));

    // 外部刷新：只剩一篇 D，C 消失 → anchored=-1 → index 2 越界 → 夹取到 0
    vault.files.set(NEWS_JSON, JSON.stringify([D]));
    await reader.loadArticles();
    reader.render();
    expect(document.querySelector('.news-card-title')!.textContent).toBe('D');
  });
});
