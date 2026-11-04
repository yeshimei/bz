// @vitest-environment node
/**
 * bz 阅读（bz-reader）数据源测试：数据目录解析 / 三态读取 / 归一字段。
 * 归一目标见 src/bookshelf/reader-source.ts 头注与 bz-reader src/data/schema.ts 的对端契约。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  READER_DATA_FILE,
  READER_DEFAULT_DATA_DIR,
  normalizeReaderDataDir,
  resolveReaderPluginDir,
  resolveReaderDataDir,
  resolveReaderDataFilePath,
  readReaderData,
  normalizeReaderAggregates,
  readReaderAggregates,
  mergeLegacyReaderTitles,
  resetReaderCorruptWarned,
} from '../../src/bookshelf/reader-source';

const PLUGIN_DIR = '.obsidian/plugins/bz-reader';

/** 带 plugins.manifests 的 app：真机由 Obsidian 注入，mock 默认没有 */
function appOf(vault: MockVault, opts: { pluginDir?: string; configDir?: string } = {}) {
  const app = mockAppWithVault(vault) as any;
  app.plugins = { manifests: { 'bz-reader': { dir: opts.pluginDir ?? PLUGIN_DIR } }, plugins: {} };
  if (opts.configDir) app.vault.configDir = opts.configDir;
  return app;
}

const READER_JSON = {
  version: 1,
  schemaVersion: 2,
  books: [
    {
      id: 'b1',
      meta: { title: '悉达多', author: '黑塞', wordCount: 80000, subjects: ['小说'], coverPath: 'bz-reader/storage/covers/b1.jpg' },
      fileRef: { vaultPath: '书库/悉达多.epub', format: 'epub', size: 1024 },
      reading: {
        position: { percent: 0.42, cfi: 'epubcfi(/6/2!/4/2)' },
        stats: { totalReadTime: 90, lastReadTime: 1700000000000, completedTime: 0, startReadTime: 1690000000000 },
        sessions: [{ start: 1699990000000, end: 1699990900000, durationSeconds: 900 }],
      },
      notes: {
        highlights: [
          { id: 'h1', text: '原文一', comment: '想法一', createdAt: 1699990000000, cfiRange: 'epubcfi(/6/2!/4/2)', chapterTitle: '第一章' },
          { id: 'h2', text: '原文二', createdAt: 1699990100000, cfiRange: 'epubcfi(/6/4!/4/2)', chapterTitle: '第二章' },
        ],
        // bz-reader 的镜像：每条 highlight 都有一份，不论有没有想法
        excerpts: [
          { id: 'h1', text: '原文一', comment: '想法一', createdAt: 1699990000000 },
          { id: 'h2', text: '原文二', createdAt: 1699990100000 },
        ],
        bookmarks: [{ id: 'm1', percent: 0.3, cfi: 'epubcfi(/6/2!/4/2)', createdAt: 1699990200000 }],
      },
      addedAt: 1699900000000,
      updatedAt: 1700000000000,
    },
    // 缺 fileRef.vaultPath / 缺 title：坏条目直接丢
    { id: 'b2', meta: { title: '没有路径' }, fileRef: {} },
    { id: 'b3', meta: {}, fileRef: { vaultPath: '书库/无题.epub' } },
  ],
};

describe('bz 阅读数据源：路径解析', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetReaderCorruptWarned();
    setSettingsProvider(() => ({}) as any);
  });
  afterEach(() => setSettingsProvider(null as any));

  it('normalizeReaderDataDir：缺省 bz-reader/storage；去首尾斜杠/反斜杠；拒绝上跳与点目录', () => {
    expect(READER_DEFAULT_DATA_DIR).toBe('bz-reader/storage');
    expect(normalizeReaderDataDir('')).toBe(READER_DEFAULT_DATA_DIR);
    expect(normalizeReaderDataDir(undefined)).toBe(READER_DEFAULT_DATA_DIR);
    expect(normalizeReaderDataDir('/读书/')).toBe('读书');
    expect(normalizeReaderDataDir('读书\\子目录')).toBe('读书/子目录');
    expect(normalizeReaderDataDir('../跑路')).toBe(READER_DEFAULT_DATA_DIR);
    expect(normalizeReaderDataDir('.obsidian/plugins')).toBe(READER_DEFAULT_DATA_DIR);
    // 旧默认「bz 阅读」是用户 data.json 里的存量显式值：归一原样保留，不清洗不迁移
    expect(normalizeReaderDataDir('bz 阅读')).toBe('bz 阅读');
  });

  it('插件目录：manifest.dir 优先；没有 manifest 时 configDir/plugins/bz-reader 兜底', () => {
    const vault = new MockVault();
    expect(resolveReaderPluginDir(appOf(vault, { pluginDir: '.obsidian/plugins/bz 阅读' })))
      .toBe('.obsidian/plugins/bz 阅读');
    const bare = mockAppWithVault(vault) as any;
    expect(resolveReaderPluginDir(bare)).toBe('.obsidian/plugins/bz-reader');
    const custom = mockAppWithVault(vault) as any;
    custom.vault.configDir = '.config-obsidian';
    expect(resolveReaderPluginDir(custom)).toBe('.config-obsidian/plugins/bz-reader');
  });

  it('数据目录读插件 data.json 的顶层 dataDir（不是 settings 里的）', async () => {
    const vault = new MockVault();
    vault.files.set(
      `${PLUGIN_DIR}/data.json`,
      JSON.stringify({ version: 1, settings: {}, dataDir: '我的阅读/数据' }),
    );
    const app = appOf(vault);
    expect(await resolveReaderDataDir(app)).toBe('我的阅读/数据');
    expect(await resolveReaderDataFilePath(app)).toBe(`我的阅读/数据/${READER_DATA_FILE}`);
  });

  it('插件未安装/配置损坏 → 回落缺省 bz-reader/storage', async () => {
    const vault = new MockVault();
    const app = appOf(vault);
    expect(await resolveReaderDataDir(app)).toBe(READER_DEFAULT_DATA_DIR);
    vault.files.set(`${PLUGIN_DIR}/data.json`, '{ 坏的 json');
    expect(await resolveReaderDataDir(app)).toBe(READER_DEFAULT_DATA_DIR);
  });
});

describe('bz 阅读数据源：读取三态', () => {
  beforeEach(() => resetObsidianMocks());

  it('missing / ok / corrupt 三态可区分', async () => {
    const vault = new MockVault();
    const app = appOf(vault);
    expect((await readReaderData(app)).state).toBe('missing');

    vault.files.set(`${READER_DEFAULT_DATA_DIR}/${READER_DATA_FILE}`, JSON.stringify({ books: [] }));
    expect((await readReaderData(app)).state).toBe('ok');

    vault.files.set(`${READER_DEFAULT_DATA_DIR}/${READER_DATA_FILE}`, '{ 半截');
    expect((await readReaderData(app)).state).toBe('corrupt');
  });

  it('损坏降级为空数组且不抛（silent：不弹告警）', async () => {
    const vault = new MockVault();
    vault.files.set(`${READER_DEFAULT_DATA_DIR}/${READER_DATA_FILE}`, '{ 半截');
    const app = appOf(vault);
    expect(await readReaderAggregates(app, { silent: true })).toEqual([]);
  });
});

describe('bz 阅读数据源：归一为 weave 聚合形状', () => {
  beforeEach(() => resetObsidianMocks());

  it('字段映射：fileRef → file、comment → commentText、createdAt → createdTime', () => {
    const [book] = normalizeReaderAggregates(READER_JSON);
    expect(book.file.vaultPath).toBe('书库/悉达多.epub');
    expect(book.meta.title).toBe('悉达多');
    expect(book.notes.highlights[0].commentText).toBe('想法一');
    expect(book.notes.highlights[0].createdTime).toBe(1699990000000);
    expect(book.notes.highlights[1].commentText).toBeUndefined();
  });

  it('totalReadTime 秒 → 毫秒（weave 按毫秒记账，上层统一）', () => {
    const [book] = normalizeReaderAggregates(READER_JSON);
    expect(book.reading.stats.totalReadTime).toBe(90000);
    expect(book.reading.stats.lastReadTime).toBe(1700000000000);
  });

  it('想法口径：excerpts 镜像只保留有 comment 的条目（thinks 不虚增）', () => {
    const [book] = normalizeReaderAggregates(READER_JSON);
    expect(book.notes.highlights.length).toBe(2);
    expect(book.notes.excerpts.length).toBe(1);
    expect(book.notes.excerpts[0].id).toBe('h1');
  });

  it('缺 vaultPath / 缺 title 的坏条目直接丢；bookmarks 保留', () => {
    const books = normalizeReaderAggregates(READER_JSON);
    expect(books.length).toBe(1);
    expect(books[0].notes.bookmarks.length).toBe(1);
  });

  it('books 不是数组 / 顶层坏了 → []（不抛）', () => {
    expect(normalizeReaderAggregates(null)).toEqual([]);
    expect(normalizeReaderAggregates({ books: {} })).toEqual([]);
  });

  it('readReaderAggregates 端到端：从插件 data.json 指定的目录读业务数据', async () => {
    const vault = new MockVault();
    vault.files.set(`${PLUGIN_DIR}/data.json`, JSON.stringify({ dataDir: '读书' }));
    vault.files.set(`读书/${READER_DATA_FILE}`, JSON.stringify(READER_JSON));
    const books = await readReaderAggregates(appOf(vault));
    expect(books.length).toBe(1);
    expect(books[0].file.vaultPath).toBe('书库/悉达多.epub');
  });
});

/** 旧目录（0.1.2 之前的 bz 阅读/）兜底：用户来回切数据目录后，改名可能留在旧目录 */
describe('bz 阅读数据源：旧数据目录兜底', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetReaderCorruptWarned();
    setSettingsProvider(() => ({}) as any);
  });
  afterEach(() => setSettingsProvider(null as any));

  const LEGACY = `bz 阅读/${READER_DATA_FILE}`;
  const bookOf = (title: string, extra: Record<string, any> = {}) => ({
    id: 'b1',
    meta: { title, ...extra },
    fileRef: { vaultPath: '书库/红楼梦.epub' },
    reading: { position: { percent: 0.5 }, stats: { totalReadTime: 2, lastReadTime: 2 } },
    notes: { highlights: [], excerpts: [], bookmarks: [] },
    addedAt: 1,
    updatedAt: 2,
  });

  it('当前目录未改名（无 titleEdited）→ 旧目录的改名补进书库，其余字段仍用当前目录', async () => {
    const vault = new MockVault();
    vault.files.set(`${PLUGIN_DIR}/data.json`, JSON.stringify({ dataDir: '读书' }));
    vault.files.set(`读书/${READER_DATA_FILE}`, JSON.stringify({ books: [bookOf('红楼梦（全本）')] }));
    vault.files.set(LEGACY, JSON.stringify({ books: [bookOf('红楼梦', { titleEdited: true })] }));
    const books = await readReaderAggregates(appOf(vault));
    expect(books[0].meta.title).toBe('红楼梦');
    expect(books[0].meta.titleEdited).toBe(true);
    expect(books[0].reading.position.percent).toBe(0.5); // 进度以当前目录为准
  });

  it('当前目录自己 titleEdited=true → 不回退旧目录', async () => {
    const vault = new MockVault();
    vault.files.set(`${PLUGIN_DIR}/data.json`, JSON.stringify({ dataDir: '读书' }));
    vault.files.set(`读书/${READER_DATA_FILE}`, JSON.stringify({ books: [bookOf('石头记', { titleEdited: true })] }));
    vault.files.set(LEGACY, JSON.stringify({ books: [bookOf('红楼梦', { titleEdited: true })] }));
    const books = await readReaderAggregates(appOf(vault));
    expect(books[0].meta.title).toBe('石头记');
  });

  it('当前目录整份缺失 → 旧目录顶上（书不从书库消失）', async () => {
    const vault = new MockVault();
    vault.files.set(`${PLUGIN_DIR}/data.json`, JSON.stringify({ dataDir: '读书' }));
    vault.files.set(LEGACY, JSON.stringify({ books: [bookOf('红楼梦', { titleEdited: true })] }));
    const books = await readReaderAggregates(appOf(vault));
    expect(books).toHaveLength(1);
    expect(books[0].meta.title).toBe('红楼梦');
  });

  it('旧目录损坏 → 当前目录照常读', async () => {
    const vault = new MockVault();
    vault.files.set(`${PLUGIN_DIR}/data.json`, JSON.stringify({ dataDir: '读书' }));
    vault.files.set(`读书/${READER_DATA_FILE}`, JSON.stringify({ books: [bookOf('红楼梦（全本）')] }));
    vault.files.set(LEGACY, '{ 半截');
    const books = await readReaderAggregates(appOf(vault));
    expect(books[0].meta.title).toBe('红楼梦（全本）');
  });

  it('dataDir 本身就是 bz 阅读 → 只读这一份，不重复合并', async () => {
    const vault = new MockVault();
    vault.files.set(`${PLUGIN_DIR}/data.json`, JSON.stringify({ dataDir: 'bz 阅读' }));
    vault.files.set(LEGACY, JSON.stringify({ books: [bookOf('红楼梦', { titleEdited: true })] }));
    const books = await readReaderAggregates(appOf(vault));
    expect(books).toHaveLength(1);
    expect(books[0].meta.title).toBe('红楼梦');
  });

  it('mergeLegacyReaderTitles：id 缺失时按 vaultPath 匹配', () => {
    const primary = { books: [{ meta: { title: '旧长名' }, fileRef: { vaultPath: '书库/红楼梦.epub' } }] };
    const legacy = {
      books: [{ meta: { title: '红楼梦', titleEdited: true }, fileRef: { vaultPath: '书库/红楼梦.epub' } }],
    };
    mergeLegacyReaderTitles(primary, legacy);
    expect(primary.books[0].meta.title).toBe('红楼梦');
  });
});
