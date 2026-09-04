// @vitest-environment node
/**
 * 书架墙（bookshelf）数据层测试：md 解析/状态派生/EPUB 聚合/排序/统计/目录回落
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { M, resetBookshelfState } from '../../src/bookshelf/state';
import {
  scanMarkdownBooks, loadEpubItems, sortItems, kwFilter, currentSideItems, computeStats,
  resolveFolderPath, resolveBookTag, formatReadingTime, rebuildItems,
  categoryList, catFilterItems, findAnniversary, getDisplayItems,
} from '../../src/bookshelf/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

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
    M.folderPath = '书库';
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

  it('目录回落：新键优先 → libraryFolderPath → 书库', () => {
    expect(resolveFolderPath()).toBe('书库');
    setSettingsProvider(() => ({ libraryFolderPath: '旧书库' } as any));
    expect(resolveFolderPath()).toBe('旧书库');
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
    setSettingsProvider(() => ({ bookTag: '读书' } as any));
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

  it('computeStats：状态分布/今年读完/时长/近 12 月读完柱', () => {
    const { app } = seedVault();
    M.items = [...scanMarkdownBooks(app)];
    const s = computeStats(new Date(2026, 8, 3));
    expect(s.reading.length).toBe(1); // 认知觉醒（无 completionDate）
    expect(s.done.length).toBe(1); // 围城
    expect(s.unread.length).toBe(1); // 算法导论
    expect(s.doneThisYear.length).toBe(1);
    // 3小时20分 → 3 小时（向下取整小时）
    expect(s.totalHours).toBe(3);
    // 围城 2026-08 读完 → 8 月柱 count=1（bars[0] 是 11 个月前，向右排到 bars[11]=本月）
    const aug = s.bars.find((b) => b.label === '8月')!;
    expect(aug.count).toBe(1);
    expect(aug.isThis).toBe(false);
    expect(s.bars[0].label).toBe('10月'); // 11 个月前 = 2025-10
    expect(s.bars[11].label).toBe('本月');
    expect(s.bars[11].isThis).toBe(true);
    expect(s.bars[11].count).toBe(0); // 当前月（2026-09）无读完数据
  });

  it('computeStats：近 12 月柱数据↔标签映射（bars[11]=本月承载当月数据，bars[0] 承载 11 个月前）', () => {
    // 回归：旧实现 t = nowM - i 使 bars[0]（本月标签）承载 11 个月前数据，映射整体反转
    const vault = new MockVault();
    vault.files.set('书库/当月书.md', '---\ntags: [book]\nreadingDate: 2026-09-01\ncompletionDate: 2026-09-10\n---');
    vault.files.set('书库/去年书.md', '---\ntags: [book]\nreadingDate: 2025-10-01\ncompletionDate: 2025-10-20\n---');
    const app = makeApp(vault);
    M.items = [...scanMarkdownBooks(app)];
    const s = computeStats(new Date(2026, 8, 3)); // 2026-09（11 个月前 = 2025-10）
    expect(s.bars[11].label).toBe('本月');
    expect(s.bars[11].count).toBe(1); // 当月读完的「当月书」落在「本月」柱
    expect(s.bars[11].isThis).toBe(true);
    expect(s.bars[0].count).toBe(1); // 2025-10 读完的「去年书」落在首柱
    expect(s.bars[0].label).toBe('10月');
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

  it('categoryList：去重计数 + zh 序；EPUB null 分类归「未分类」桶', async () => {
    const { app } = seedVault(); // 认知觉醒=成长；围城/算法导论无 category → 未分类
    const items = scanMarkdownBooks(app);
    const list = categoryList(items);
    expect(list.map((c) => c.name)).toEqual(['成长', '未分类']); // zh localeCompare 序
    expect(list.find((c) => c.name === '未分类')?.count).toBe(2); // 围城 + 算法导论
    expect(list.find((c) => c.name === '成长')?.count).toBe(1);
    // EPUB category null → 并入「未分类」桶（仅分类面；kwFilter 口径不变）
    const vault2 = new MockVault();
    vault2.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: { a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub' } } },
    }));
    const epub = await loadEpubItems(makeApp(vault2));
    expect(categoryList([...items, ...epub]).find((c) => c.name === '未分类')?.count).toBe(3);
  });

  it('catFilterItems + getDisplayItems：分类与状态正交叠加', () => {
    const { app } = seedVault();
    M.items = [...scanMarkdownBooks(app)];
    // 只分类
    expect(catFilterItems(M.items, '成长').map((i) => i.title)).toEqual(['认知觉醒']);
    expect(catFilterItems(M.items, '未分类').length).toBe(2);
    expect(catFilterItems(M.items, 'all').length).toBe(3);
    // 状态 × 分类正交：已读 ∩ 成长 = 空
    M.side = 'done';
    M.catFilter = '成长';
    expect(getDisplayItems().length).toBe(0);
    M.catFilter = 'all';
    expect(getDisplayItems().map((i) => i.title)).toEqual(['围城']);
    M.side = 'all';
    M.catFilter = '未分类';
    expect(getDisplayItems().length).toBe(2);
  });

  it('findAnniversary：那年今天命中（取最早年）；今年/非今天/未读完不命中', () => {
    const mk = (title: string, completionDate: string | null) => ({
      file: null, title, author: '', category: null, cover: null, bookReview: null,
      readingDate: null, completionDate, progress: completionDate ? 100 : 0,
      readingTimeFormat: null, readingTimeMs: 0, highlights: 0, thinks: 0,
      status: completionDate ? '已读' : '未读', isEpub: false, epubVaultPath: null,
    } as any);
    const now = new Date(2026, 8, 4); // 2026-09-04
    const items = [
      mk('今年书', '2026-09-04'),   // 今年今天 → 不算纪念日
      mk('三年书', '2023-09-04'),   // 命中，3 年
      mk('错日子', '2022-05-01'),   // 月日不同
      mk('在读中', null),           // 未读完
      mk('十年书', '2016-09-04'),   // 命中，10 年（最早 → 胜出）
    ];
    const a = findAnniversary(items, now);
    expect(a).toBeTruthy();
    expect(a!.item.title).toBe('十年书');
    expect(a!.years).toBe(10);
    // 全不命中 → null（零空态）
    expect(findAnniversary([mk('今年书', '2026-09-04'), mk('在读中', null)], now)).toBeNull();
    expect(findAnniversary([], now)).toBeNull();
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
});
