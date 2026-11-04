// @vitest-environment node
import { makeApp } from '../helpers/app';
/**
 * 书架墙（bookshelf）数据层测试：md 解析/状态派生/EPUB 聚合/排序/统计/目录回落
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { M, resetBookshelfState } from '../../src/bookshelf/state';
import {
  scanMarkdownBooks, loadEpubItems, resolveFolderPath, resolveBookTag, formatReadingTime,
  rebuildItems, isBookshelfPath, readEpubAggregates,
} from '../../src/bookshelf/data';
import { READER_DEFAULT_DATA_DIR } from '../../src/bookshelf/reader-source';
// 深审 arch A1：data.ts 不再依赖渲染纯层（读 M 的状态包装迁 ui.ts）——
// 数据层测试改断言纯管道形态（显式入参，语义等价）
import {
  sortItems, kwFilter, currentSideItems, catFilterItems, getDisplayItems,
} from '../../src/bookshelf/render';


function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  vault.files.set('书库/认知觉醒.md', `---
tags: [book]
author: 周岭
category: 成长
readingDate: 2026-08-01
readingProgress: 60
readingTimeFormat: 3小时20分
highlights: 12
thinks: 3
bookReview: 值得反复读
---`);
  vault.files.set('书库/小说/围城.md', `---
tags: book
author: 钱钟书
readingDate: 2026-07-01
completionDate: 2026-08-15
readingProgress: 100
---`);
  vault.files.set('书库/未分类/算法导论.md', `---
tags: [book]
author: CLRS
---`);
  // 目录下非 book 标签的书：不出现
  vault.files.set('书库/别处.md', '---\ntags: [literature]\n---');
  const app = makeApp(vault);
  return { vault, app };
}

describe('bookshelf 数据层', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    // 目录缺省已留空（ADR-0274）：未配置就不扫任何东西，本文件验的是「已配好书库」的解析行为
    setSettingsProvider(() => ({ bookshelfFolderPath: '书库' }) as any);
  });
  afterEach(() => {
    setSettingsProvider(null as any);
  });

  it('解析 md 书目：字段/cover 前缀/status 三态/子文件夹', () => {
    const { app } = seedVault();
    const items = scanMarkdownBooks(app);
    expect(items.length).toBe(3);
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i]));
    expect(byTitle['认知觉醒'].author).toBe('周岭');
    expect(byTitle['认知觉醒'].category).toBe('成长');
    expect(byTitle['认知觉醒'].readingTimeFormat).toBe('3小时20分');
    expect(byTitle['认知觉醒'].highlights).toBe(12);
    expect(byTitle['认知觉醒'].status).toBe('在读');
    expect(byTitle['围城'].status).toBe('已读');
    expect(byTitle['算法导论'].status).toBe('未读');
    expect(byTitle['围城'].progress).toBe(100);
    expect(byTitle['认知觉醒'].isEpub).toBe(false);
  });

  it('issue 226 书脊起伏：md 书时长——readingTime 毫秒直读；readingTimeFormat 中英双格式兜底', () => {
    const vault = new MockVault();
    vault.files.set('书库/毫秒直读.md', '---\ntags: [book]\nreadingTime: 42113009\nreadingTimeFormat: 11h41m53s\n---');
    vault.files.set('书库/英文格式.md', '---\ntags: [book]\nreadingTimeFormat: 11h41m53s\n---');
    vault.files.set('书库/中文格式.md', '---\ntags: [book]\nreadingTimeFormat: 3小时20分\n---');
    vault.files.set('书库/无时长.md', '---\ntags: [book]\n---');
    const byTitle = Object.fromEntries(scanMarkdownBooks(makeApp(vault)).map((i) => [i.title, i]));
    expect(byTitle['毫秒直读'].readingTimeMs).toBe(42113009);
    expect(byTitle['英文格式'].readingTimeMs).toBe(11 * 3600000 + 41 * 60000 + 53000);
    expect(byTitle['中文格式'].readingTimeMs).toBe(3 * 3600000 + 20 * 60000);
    expect(byTitle['无时长'].readingTimeMs).toBe(0);
  });

  it('cover 无斜杠 → 拼 CONFIG/BOOK/书名/', () => {
    const vault = new MockVault();
    vault.files.set('书库/A.md', '---\ntags: [book]\ncover: cover.jpg\n---');
    const app = makeApp(vault);
    const [it] = scanMarkdownBooks(app);
    expect(it?.cover).toBe('CONFIG/BOOK/A/cover.jpg');
  });

  it('cover 已是路径 → 原样', () => {
    const vault = new MockVault();
    vault.files.set('书库/B.md', '---\ntags: [book]\ncover: CONFIG/BOOK/x/1.jpg\n---');
    const app = makeApp(vault);
    const [it] = scanMarkdownBooks(app);
    expect(it?.cover).toBe('CONFIG/BOOK/x/1.jpg');
  });

  it('目录解析：两口都空 = 未配置；旧键一次性迁进新键；新键优先', () => {
    // 未配置 = 空串（不再回落字面量「书库」，ADR-0274）
    setSettingsProvider(() => ({}) as any);
    expect(resolveFolderPath()).toBe('');

    // 旧键有值：读出来并**就地写进新键**（否则老用户会被当成没配置，明明他早有书架）
    const store: Record<string, unknown> = { libraryFolderPath: '旧书库' };
    setSettingsProvider(() => store as any);
    expect(resolveFolderPath()).toBe('旧书库');
    expect(store.bookshelfFolderPath).toBe('旧书库');

    setSettingsProvider(() => ({ bookshelfFolderPath: '我的书', libraryFolderPath: '旧书库' } as any));
    expect(resolveFolderPath()).toBe('我的书');
  });

  it('bookTag 旧键存量值运行时回落（library 域退役删键，零感知迁移）', () => {
    // 键已从 BzSettings 接口删除，但用户 data.json 可能仍存旧值——运行时读存量值
    expect(resolveBookTag()).toBe('book');
    setSettingsProvider(() => ({ bookTag: '读书' } as any));
    expect(resolveBookTag()).toBe('读书');
    setSettingsProvider(() => ({ bookTag: '   ' } as any));
    expect(resolveBookTag()).toBe('book'); // 空白脏值回落缺省
  });

  it('旧 bookTag 存量值仍驱动书目筛选（自定义标签的书可识别）', () => {
    const vault = new MockVault();
    vault.files.set('书库/三体.md', '---\ntags: [读书]\nauthor: 刘慈欣\n---');
    vault.files.set('书库/不匹配.md', '---\ntags: [novel]\n---');
    // 目录缺省已留空（ADR-0274）：覆盖 provider 时把书库目录一起带上，否则一条都扫不到
    setSettingsProvider(() => ({ bookshelfFolderPath: '书库', bookTag: '读书' }) as any);
    const items = scanMarkdownBooks(makeApp(vault));
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('三体');
  });

  it('EPUB 聚合条目：从 weave-data.json 构建（ADR-0013 口径）', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: {
        a: {
          meta: { title: '百年孤独', author: '马尔克斯' },
          file: { vaultPath: 'books/百年孤独.epub', sourceId: 's1' },
          reading: { position: { percent: 0.62 }, stats: { lastReadTime: 1725000000000, completedTime: 0, totalReadTime: 10800000 } },
          notes: { highlights: [{ id: 'h1', text: 'xx' }], excerpts: [{ id: 'e1' }] },
        },
        b: {
          meta: { title: '没有路径的书' },
          file: {},
        },
      },
    }));
    const app = makeApp(vault);
    const items = await loadEpubItems(app);
    expect(items.length).toBe(1);
    const it = items[0];
    expect(it.title).toBe('百年孤独');
    expect(it.isEpub).toBe(true);
    expect(it.status).toBe('在读');
    expect(it.progress).toBe(62);
    expect(it.readingTimeFormat).toBe('3小时');
    expect(it.highlights).toBe(1);
    expect(it.thinks).toBe(1);
    expect(it.epubVaultPath).toBe('books/百年孤独.epub');
  });

  it('formatReadingTime：毫秒 → 中文时长', () => {
    expect(formatReadingTime(0)).toBeNull();
    expect(formatReadingTime(45 * 60000)).toBe('45分');
    expect(formatReadingTime(3 * 3600000 + 20 * 60000)).toBe('3小时20分');
  });

  it('排序：date 主日期倒序/无日期排后；title/author/progress', () => {
    const { app } = seedVault();
    const items = scanMarkdownBooks(app);
    const byDate = sortItems(items, 'date');
    expect(byDate[0].title).toBe('围城'); // completionDate 2026-08-15 最新
    expect(byDate[2].title).toBe('算法导论'); // 无日期排最后
    const byTitle = sortItems(items, 'title').map((i) => i.title);
    expect(byTitle).toEqual(['算法导论', '围城', '认知觉醒'].sort((a, b) => a.localeCompare(b, 'zh')));
    const byProg = sortItems(items, 'progress');
    expect(byProg[0].title).toBe('围城');
    expect(byProg[2].title).toBe('算法导论');
  });

  it('kwFilter：书名/作者/分类命中', () => {
    const { app } = seedVault();
    const items = scanMarkdownBooks(app);
    expect(kwFilter(items, '钱钟书').length).toBe(1);
    expect(kwFilter(items, '成长').length).toBe(1);
    expect(kwFilter(items, '觉醒').length).toBe(1);
    expect(kwFilter(items, '不存在').length).toBe(0);
  });

  it('B6：EPUB progress 归一按 Weave 契约单口径（0-1 小数；1.0=100；>1 旧口径直取钳 100）', async () => {
    const vault = new MockVault();
    const mk = (id: string, title: string, percent: number) => [id, {
      meta: { title },
      file: { vaultPath: `books/${title}.epub` },
      reading: { position: { percent } },
    }] as const;
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: Object.fromEntries([
        mk('a', '半程', 0.5),
        mk('b', '读完', 1.0),
        mk('c', '旧口径', 45),
        mk('d', '越界', 150),
        mk('e', '零', 0),
      ]),
    }));
    const app = makeApp(vault);
    const items = await loadEpubItems(app);
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i]));
    expect(byTitle['半程'].progress).toBe(50);
    expect(byTitle['读完'].progress).toBe(100);
    expect(byTitle['读完'].status).toBe('在读'); // percent 有值 → 在读（completionTime 缺失）
    expect(byTitle['旧口径'].progress).toBe(45);
    expect(byTitle['越界'].progress).toBe(100);
    expect(byTitle['零'].progress).toBe(0);
    expect(byTitle['零'].status).toBe('未读');
  });

  it('B11：EPUB 无分类置 null，搜「未分类」不误命中 EPUB', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: { a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub' } } },
    }));
    const app = makeApp(vault);
    const items = await loadEpubItems(app);
    expect(items[0].category).toBeNull();
    expect(kwFilter(items, '未分类').length).toBe(0);
  });

  it('issue 221：EPUB 分类接 meta.subjects[0]；subjects 空数组/非字符串/空白值回落 null', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: {
        ok: { meta: { title: '红楼梦', subjects: ['中国古典文学', '清代小说'] }, file: { vaultPath: 'books/hlm.epub' } },
        empty: { meta: { title: '空数组', subjects: [] }, file: { vaultPath: 'books/empty.epub' } },
        bad: { meta: { title: '非字符串', subjects: [42, null] }, file: { vaultPath: 'books/bad.epub' } },
        blank: { meta: { title: '空白值', subjects: ['   '] }, file: { vaultPath: 'books/blank.epub' } },
        nofield: { meta: { title: '无字段' }, file: { vaultPath: 'books/nofield.epub' } },
      },
    }));
    const app = makeApp(vault);
    const items = await loadEpubItems(app);
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i]));
    expect(byTitle['红楼梦'].category).toBe('中国古典文学');
    expect(byTitle['空数组'].category).toBeNull();
    expect(byTitle['非字符串'].category).toBeNull();
    expect(byTitle['空白值'].category).toBeNull();
    expect(byTitle['无字段'].category).toBeNull();
  });

  it('audit H：EPUB 日期本地时区切片（UTC+8 早 8 点前读完不再归前一天）', async () => {
    const vault = new MockVault();
    const ts = new Date(2024, 11, 24, 7, 30).getTime(); // UTC+8 下对应 2024-12-23T23:30Z
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: { a: { meta: { title: '时区书' }, file: { vaultPath: 'books/tz.epub' }, reading: { position: { percent: 0.5 }, stats: { lastReadTime: ts } } } },
    }));
    const app = makeApp(vault);
    const [it] = await loadEpubItems(app);
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, '0');
    expect(it.readingDate).toBe(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    expect(it.readingDate).toBe('2024-12-24'); // 本地日期（旧 UTC 切片会给 2024-12-23）
  });

  it('B10：书库目录对象存在走 TFolder 直取；目录缺失回落全量过滤（含目录自身单文件）', () => {
    const { vault, app } = seedVault();
    // 目录对象路径：嵌套子目录（书库/小说/围城.md）也被递归收进
    const items = scanMarkdownBooks(app);
    expect(items.map((i) => i.title)).toContain('围城');
    // 回落路径：书库目录不存在，书库.md 单文件本身是书
    const vault2 = new MockVault();
    vault2.files.set('书库.md', '---\ntags: [book]\nauthor: 单文件\n---');
    vault2.files.set('别处/别的.md', '---\ntags: [book]\n---');
    const items2 = scanMarkdownBooks(makeApp(vault2));
    expect(items2.length).toBe(1);
    expect(items2[0].title).toBe('书库');
  });

  it('currentSideItems：在读/未读/已读/全部', () => {
    const { app } = seedVault();
    const items = scanMarkdownBooks(app);
    expect(currentSideItems(items, 'all').length).toBe(3);
    expect(currentSideItems(items, 'reading').length).toBe(1);
    expect(currentSideItems(items, 'unread').length).toBe(1);
    expect(currentSideItems(items, 'done').length).toBe(1);
  });

  it('catFilterItems + getDisplayItems：分类与状态正交叠加', () => {
    const { app } = seedVault();
    M.items = [...scanMarkdownBooks(app)];
    // 深审 arch A1：改走纯管道形态（显式入参 = M 当前视图快照）
    const view = () => ({ side: M.side, catFilter: M.catFilter, q: M.searchKeyword, sortMode: M.sortMode });
    // 只分类
    expect(catFilterItems(M.items, '成长').map((i) => i.title)).toEqual(['认知觉醒']);
    expect(catFilterItems(M.items, '未分类').length).toBe(2);
    expect(catFilterItems(M.items, 'all').length).toBe(3);
    // 状态 × 分类正交：已读 ∩ 成长 = 空
    M.side = 'done';
    M.catFilter = '成长';
    expect(getDisplayItems(M.items, view()).length).toBe(0);
    M.catFilter = 'all';
    expect(getDisplayItems(M.items, view()).map((i) => i.title)).toEqual(['围城']);
    M.side = 'all';
    M.catFilter = '未分类';
    expect(getDisplayItems(M.items, view()).length).toBe(2);
  });

    it('audit I：rebuildItems 并发交错——旧重建晚到不回写覆盖新数据（序号守卫）', async () => {
    // 场景：重建 1 的 EPUB 读取在途时新增书目并触发重建 2；重建 2 先完成，重建 1 的
    // 陈旧 md 快照（无 B 书）后到——旧实现会把 B 书从 M.items 挤掉
    const vault = new MockVault();
    vault.files.set('书库/A.md', '---\ntags: [book]\n---');
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: { e: { meta: { title: 'E书' }, file: { vaultPath: 'books/e.epub' } } },
    }));
    const app = makeApp(vault);
    const weaveJson = vault.files.get('CONFIG/STORAGE/weave-data.json')!;
    let calls = 0;
    let release!: (v: string) => void;
    (vault.adapter as any).read = (path: string) => {
      calls++;
      if (calls === 1) return new Promise<string>((r) => { release = r; });
      return Promise.resolve(weaveJson);
    };
    const p1 = rebuildItems(app); // 旧重建：扫描只有 A，EPUB 读取挂起
    vault.files.set('书库/B.md', '---\ntags: [book]\n---');
    const p2 = rebuildItems(app); // 新重建：扫描 A+B，先完成
    await p2;
    release(weaveJson);
    await p1;
    expect(M.items.map((i) => i.title).sort()).toEqual(['A', 'B', 'E书']);
  });

  it('深审 RR-A1/RR-F7：收录谓词单源 isBookshelfPath——目录前缀/目录本身单文件/库外三形态', () => {
    const folder = resolveFolderPath(); // 缺省回落「书库」
    expect(folder).toBe('书库');
    // 目录前缀
    expect(isBookshelfPath('书库/A.md', folder)).toBe(true);
    expect(isBookshelfPath('书库/子/嵌套.md', folder)).toBe(true);
    // 目录本身是单个 md 笔记（RR-F7：旧刷新通道漏此形态）
    expect(isBookshelfPath('书库.md', folder)).toBe(true);
    // 库外（含同名前缀目录陷阱）
    expect(isBookshelfPath('Inbox/笔记.md', folder)).toBe(false);
    expect(isBookshelfPath('书库别馆/A.md', folder)).toBe(false);
  });
});

/**
 * bz 阅读（bz-reader.json）兼容：缺省数据目录 `bz-reader/storage`（2026-11-04 起；旧默认
 * 「bz 阅读」只剩存量用户显式指着的形态）；读入后与 weave 合并成同一批条目。
 * 字段差异（fileRef / comment / createdAt / 秒单位）的归一细节在 reader-source.test.ts，
 * 这里只验书库墙看到的结果（标题/进度/状态/时长/来源/想法计数）。
 */
describe('bookshelf 数据层：bz 阅读数据源', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    setSettingsProvider(() => ({ bookshelfFolderPath: '书库' }) as any);
  });
  afterEach(() => {
    setSettingsProvider(null as any);
  });

  function seedReader(vault: MockVault, books: any[], dataDir = READER_DEFAULT_DATA_DIR) {
    vault.files.set(`${dataDir}/bz-reader.json`, JSON.stringify({ version: 1, schemaVersion: 2, books }));
  }

  const READER_BOOK = {
    id: 'rb1',
    meta: { title: '悉达多', author: '黑塞', wordCount: 80000, subjects: ['小说'], coverPath: 'bz-reader/storage/covers/rb1.jpg' },
    fileRef: { vaultPath: '书库/悉达多.epub', format: 'epub' },
    reading: {
      position: { percent: 0.42, cfi: 'epubcfi(/6/2!/4/2)' },
      stats: { totalReadTime: 90, lastReadTime: 1700000000000, completedTime: 0 },
      sessions: [],
    },
    notes: {
      highlights: [
        { id: 'h1', text: '原文一', comment: '想法一', createdAt: 1699990000000, cfiRange: 'epubcfi(/6/2!/4/2)', chapterTitle: '第一章' },
        { id: 'h2', text: '原文二', createdAt: 1699990100000, cfiRange: 'epubcfi(/6/4!/4/2)' },
      ],
      excerpts: [
        { id: 'h1', text: '原文一', comment: '想法一', createdAt: 1699990000000 },
        { id: 'h2', text: '原文二', createdAt: 1699990100000 },
      ],
      bookmarks: [],
    },
    addedAt: 1699900000000,
    updatedAt: 1700000000000,
  };

  it('bz-reader.json 的书进入书库墙：进度/状态/时长秒转毫秒/字数页数/来源标记/CFI', async () => {
    const vault = new MockVault();
    seedReader(vault, [READER_BOOK]);
    const app = makeApp(vault);
    const items = await loadEpubItems(app);
    expect(items.length).toBe(1);
    const it = items[0];
    expect(it.title).toBe('悉达多');
    expect(it.isEpub).toBe(true);
    expect(it.progress).toBe(42);
    expect(it.status).toBe('在读');
    expect(it.readingTimeFormat).toBe('2分'); // 90 秒 = 1.5 分 → 四舍五入 2 分
    expect(it.epubVaultPath).toBe('书库/悉达多.epub');
    expect(it.epubSource).toBe('reader');
    expect(it.epubBookId).toBe('rb1');
    expect(it.epubCfi).toBe('epubcfi(/6/2!/4/2)');
    expect(it.category).toBe('小说');
    // 字数/页数与阅读报告同源（meta.wordCount，500 字/页）
    expect(it.wordCount).toBe(80000);
    expect(it.pages).toBe(160);
  });

  it('想法计数：bz 阅读的 excerpts 是划线镜像——thinks 等于「有想法」的条数，不是划线总数', async () => {
    const vault = new MockVault();
    seedReader(vault, [READER_BOOK]);
    const [it] = await loadEpubItems(makeApp(vault));
    expect(it.highlights).toBe(2);
    expect(it.thinks).toBe(1);
  });

  it('同一条 vaultPath 双源并存：取最近活动的一份；并列/更新时 bz 阅读优先', async () => {
    const mkWeave = (lastReadTime: number) => JSON.stringify({
      books: {
        w1: {
          id: 'w1',
          meta: { title: '悉达多（weave）' },
          file: { vaultPath: '书库/悉达多.epub' },
          reading: { position: { percent: 0.1 }, stats: { lastReadTime } },
        },
      },
    });

    // weave 更晚 → 用 weave
    const vaultOldReader = new MockVault();
    vaultOldReader.files.set('CONFIG/STORAGE/weave-data.json', mkWeave(1800000000000));
    seedReader(vaultOldReader, [READER_BOOK]);
    const [byWeave] = await loadEpubItems(makeApp(vaultOldReader));
    expect(byWeave.title).toBe('悉达多（weave）');
    expect(byWeave.epubSource).toBe('weave');

    // bz 阅读更晚 → 用 bz 阅读
    const vaultNewReader = new MockVault();
    vaultNewReader.files.set('CONFIG/STORAGE/weave-data.json', mkWeave(1600000000000));
    seedReader(vaultNewReader, [READER_BOOK]);
    const [byReader] = await loadEpubItems(makeApp(vaultNewReader));
    expect(byReader.title).toBe('悉达多');
    expect(byReader.epubSource).toBe('reader');
    expect(byReader.epubBookId).toBe('rb1');

    // 并列（同样活动时刻）→ bz 阅读优先
    const vaultTie = new MockVault();
    vaultTie.files.set('CONFIG/STORAGE/weave-data.json', mkWeave(0));
    seedReader(vaultTie, [{ ...READER_BOOK, reading: { ...READER_BOOK.reading, stats: { ...READER_BOOK.reading.stats, lastReadTime: 0 } }, updatedAt: 0, addedAt: 0 }]);
    const [tie] = await loadEpubItems(makeApp(vaultTie));
    expect(tie.epubSource).toBe('reader');
  });

  it('同一本：weave 读过、bz 阅读只是导入过（无进度/无划线）→ 取 weave 那份，进度不被清零', async () => {
    const vaultJustImported = new MockVault();
    vaultJustImported.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: {
        w1: {
          id: 'w1',
          meta: { title: '悉达多（weave）' },
          file: { vaultPath: '书库/悉达多.epub' },
          reading: { position: { percent: 0.5 }, stats: { lastReadTime: 1600000000000 } },
        },
      },
    }));
    // bz 阅读刚导入：addedAt/updatedAt 都是「现在」，但一页没读、一条线没划
    seedReader(vaultJustImported, [{
      ...READER_BOOK,
      reading: { position: { percent: 0 }, stats: { totalReadTime: 0, lastReadTime: 0 }, sessions: [] },
      notes: { highlights: [], excerpts: [], bookmarks: [] },
      addedAt: 1800000000000,
      updatedAt: 1800000000000,
    }]);
    const [item] = await loadEpubItems(makeApp(vaultJustImported));
    // 只按 addedAt 比时间会选到 reader（书架显示 0%、划线清零），迁移期批量导入必然撞上
    expect(item.epubSource).toBe('weave');
    expect(item.progress).toBe(50);
  });

  it('bz 阅读数据目录跟插件 data.json 的 dataDir 走（不是写死缺省值）', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/bz-reader/data.json', JSON.stringify({ dataDir: '读书/阅读数据' }));
    vault.files.set('读书/阅读数据/bz-reader.json', JSON.stringify({ books: [READER_BOOK] }));
    const app = makeApp(vault) as any;
    app.plugins = { manifests: { 'bz-reader': { dir: '.obsidian/plugins/bz-reader' } } };
    const [it] = await loadEpubItems(app);
    expect(it.title).toBe('悉达多');
  });

  it('存量用户：data.json 显式指着旧默认「bz 阅读」→ 仍读旧目录（默认值改动不动老数据）', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/bz-reader/data.json', JSON.stringify({ dataDir: 'bz 阅读' }));
    vault.files.set('bz 阅读/bz-reader.json', JSON.stringify({ books: [READER_BOOK] }));
    const app = makeApp(vault) as any;
    app.plugins = { manifests: { 'bz-reader': { dir: '.obsidian/plugins/bz-reader' } } };
    const [it] = await loadEpubItems(app);
    expect(it.title).toBe('悉达多');
    expect(it.epubSource).toBe('reader');
  });

  it('bz-reader.json 损坏 → 降级为空（不炸）；同库 weave 条目照常显示', async () => {
    const vault = new MockVault();
    vault.files.set(`${READER_DEFAULT_DATA_DIR}/bz-reader.json`, '{ 半截');
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: { w1: { meta: { title: 'weave 书' }, file: { vaultPath: 'books/w.epub' } } },
    }));
    // silent：本用例在 node 环境跑（无 DOM），读侧损坏告警由 UI 层场景覆盖
    const aggregates = await readEpubAggregates(makeApp(vault), { silent: true });
    expect(aggregates.map((a) => a.meta.title)).toEqual(['weave 书']);
  });
});
