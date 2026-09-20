// @vitest-environment node
/**
 * EPUB 供数面契约对照锁（深审 RR-A1 路线 A）：
 * 同一份 weave-data fixture 同时喂书架墙（bookshelf/data loadEpubItems → buildEpubItem）
 * 与阅读报告（reading-report/stats getEpubBookNotes → buildEpubBookNoteEntry），
 * 断言共享字段逐项等值——宿主改字段映射时此测试红给报告侧提词，镜像漂移在 CI 拦截。
 * （RR-F1 subjects / RR-F4 readingDate progress 前置 / progress 归一口径随锁固化。）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { loadEpubItems } from '../../src/bookshelf/data';
import { getEpubBookNotes } from '../../src/reading-report/stats';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: { getFileCache: () => null },
    workspace: {},
    plugins: { plugins: { 'weave-epub-reader': { settings: { dataPath: 'CONFIG/STORAGE' } } } },
  } as any;
}

/** 覆盖 subjects 有/无、percent 0/0.5/150、lastReadTime 有无 的聚合 fixture */
function aggregate(overrides: {
  id: string;
  percent: number;
  subjects?: string[];
  lastReadTime?: number;
  completedTime?: number;
}) {
  return {
    id: overrides.id,
    file: { vaultPath: `书库/${overrides.id}.epub` },
    meta: {
      title: `书-${overrides.id}`,
      author: '测试作者',
      ...(overrides.subjects ? { subjects: overrides.subjects } : {}),
    },
    reading: {
      position: { chapterIndex: 0, cfi: '', percent: overrides.percent },
      stats: {
        totalReadTime: 60000,
        ...(overrides.lastReadTime !== undefined ? { lastReadTime: overrides.lastReadTime } : {}),
        ...(overrides.completedTime !== undefined ? { completedTime: overrides.completedTime } : {}),
      },
      sessions: [{ start: 1734900000000, end: 1734901200000, durationSeconds: 1200 }],
    },
    notes: { bookmarks: [], highlights: [{ id: 'h1' }], excerpts: [{ id: 'e1' }, { id: 'e2' }] },
  };
}

describe('EPUB 供数面契约对照（buildEpubItem × buildEpubBookNoteEntry 恒等）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({}) as any);
  });

  /** 种 weave-data → 两侧装载（供数面单源消费下的等值锁） */
  async function contract(books: Record<string, any>) {
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({ schemaVersion: 2, books }));
    const app = makeApp(vault);
    const wallItems = await loadEpubItems(app);
    const reportEntries = await getEpubBookNotes(app);
    return { wallItems, reportEntries };
  }

  it('subjects 有值：category 两侧等值（ADR-0099 通道）', async () => {
    const { wallItems, reportEntries } = await contract({
      a: aggregate({ id: 'a', percent: 0.5, subjects: ['中国古典文学', '哲学'], lastReadTime: 1735000000000 }),
    });
    expect(wallItems[0].category).toBe('中国古典文学');
    expect(reportEntries[0].frontmatter.category).toBe(wallItems[0].category);
  });

  it('subjects 缺失：墙侧 null（kwFilter 不误命中）/ 报告侧「未分类」串——归桶等值', async () => {
    const { wallItems, reportEntries } = await contract({
      a: aggregate({ id: 'a', percent: 0.5, lastReadTime: 1735000000000 }),
    });
    expect(wallItems[0].category).toBeNull();
    // 报告 frontmatter 需要字符串做分布；墙侧 categoryLabel(it) || '未分类' 同桶
    expect(reportEntries[0].frontmatter.category).toBe('未分类');
  });

  it.each([
    ['0-1 小数 0.5', 0.5],
    ['旧版 0-100 口径 50', 50],
    ['读完 1.0', 1],
    ['超 100 钳 100（150）', 150],
    ['0（重读重置）', 0],
  ])('progress 归一与 readingDate 生成两侧恒等（%s）', async (_name, percent) => {
    const { wallItems, reportEntries } = await contract({
      a: aggregate({ id: 'a', percent, lastReadTime: 1735000000000 }),
    });
    const wall = wallItems[0];
    const report = reportEntries[0].frontmatter;
    expect(report.readingProgress).toBe(wall.progress);
    // RR-F4：progress=0 时两侧同判「未读」——readingDate 同时为 null
    if (wall.progress === 0) {
      expect(wall.readingDate).toBeNull();
      expect(report.readingDate).toBeNull();
    } else {
      expect(report.readingDate).toBe(wall.readingDate);
    }
  });

  it('其余共享字段：作者/划线/想法/时长毫秒/完成日期 逐项等值', async () => {
    const { wallItems, reportEntries } = await contract({
      a: aggregate({ id: 'a', percent: 0.8, subjects: ['文学'], lastReadTime: 1735000000000, completedTime: 1735600000000 }),
    });
    const wall = wallItems[0];
    const report = reportEntries[0].frontmatter;
    expect(report.author).toBe(wall.author);
    expect(report.highlights).toBe(wall.highlights);
    expect(report.thinks).toBe(wall.thinks);
    expect(report.readingTime).toBe(wall.readingTimeMs);
    expect(report.completionDate).toBe(wall.completionDate);
    expect(report.title).toBe(wall.title);
  });

  it('缺 lastReadTime：进度 > 0 时两侧 readingDate 同为 null（不互相臆造日期）', async () => {
    const { wallItems, reportEntries } = await contract({
      a: aggregate({ id: 'a', percent: 0.5 }),
    });
    expect(wallItems[0].readingDate).toBeNull();
    expect(reportEntries[0].frontmatter.readingDate).toBeNull();
  });
});
