// @vitest-environment jsdom
/**
 * clipbook 增强包：flow 层回归（enh-clipbook）。
 * 覆盖：B站保存分流回写已处理态（enh 包 11，防重复建任务）、rail 源「全部标为已读」
 * 批量单次写回（enh 包 4）、误标/误删撤销恢复 raw 快照与统计回退（enh 包 5）。
 * 注：jsdom 而非 node——flowSave B 站分支经 core/notice 弹通知（需 document）；
 * literature 动态 import 打桩，避免拉起文献盒 UI。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getNewsFilePath, readNewsData } from '../../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { flowSave, flowMarkAllRead, flowUndoHandled, flowUndoDeleteNews, flowDeleteNews } from '../../src/clipbook/flow';

vi.mock('../../src/knowledge', () => ({ openKnowledgeAddTask: vi.fn() }));
const { openKnowledgeAddTask } = await import('../../src/knowledge');

function seedDisk(articles: any[]): MockVault {
  const vault = new MockVault();
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles,
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [],
      bilibiliUpInfo: {},
      bilibiliMaxItems: 10,
      bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    })
  );
  setApp(mockAppWithVault(vault));
  return vault;
}

const diskJson = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  vi.mocked(openKnowledgeAddTask).mockClear();
});

describe('B站保存分流回写（enh 包 11）', () => {
  it('B站链接保存 → 打开文献盒 + 回写已处理（read/saved/stats）+ 通知，不写剪藏笔记', async () => {
    const vault = seedDisk([
      { platform: 'B站', title: '视频一', url: 'https://b23.tv/1', author: '影视飓风', body: '简介', date: '2026-09-01 08:00:00' },
    ]);
    const ok = await flowSave({ raw: diskJson(vault).articles[0] });
    expect(ok).toBe(true);
    expect(openKnowledgeAddTask).toHaveBeenCalledTimes(1);
    await drainNewsWritesForTests();
    const disk = diskJson(vault);
    const a = disk.articles.find((x: any) => x.url === 'https://b23.tv/1');
    expect(a.read).toBe(true);
    expect(a.state).toBe('saved');
    expect(a.body).toBe('简介'); // issue 274：已收正文保留不清
    expect(disk.stats.totalSaved).toBe(1);
    expect(disk.stats.totalRead).toBe(1);
    // 分流不写剪藏目录
    expect(vault.files.has('归档/网页剪藏/视频一.md')).toBe(false);
    // 已标已处理 → 收件流视图不再出现（防重复建任务的口径）
    const { queryBySource } = await import('../../src/clipbook/store');
    const stream = queryBySource(disk.articles, { articleOverrides: {}, savedArchive: [], order: [] }, new Set(), [], { kind: 'all' }, {});
    expect(stream).toHaveLength(0);
  });
});

describe('rail 源「全部标为已读」（enh 包 4）', () => {
  it('批量标记：仅命中未读，一次读改写落盘，统计与分布正确', async () => {
    const vault = seedDisk([
      { platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', body: 'b1', date: '2026-09-01 08:00:00' },
      { platform: '果壳科学人', title: '乙', url: 'https://gk.com/2', body: 'b2', date: '2026-09-01 09:00:00' },
      { platform: '知乎日报', title: '已读丙', url: 'https://zh.com/3', read: true, state: 'skipped', date: '2026-09-01 10:00:00' },
    ]);
    await flowMarkAllRead([diskJson(vault).articles[0], diskJson(vault).articles[1]]);
    await drainNewsWritesForTests();
    const disk = diskJson(vault);
    const a = disk.articles.find((x: any) => x.url === 'https://gk.com/1');
    const b = disk.articles.find((x: any) => x.url === 'https://gk.com/2');
    expect(a.read).toBe(true);
    expect(a.state).toBe('skipped');
    expect(a.body).toBe('b1'); // issue 274：已读正文保留不清
    expect(b.read).toBe(true);
    expect(b.body).toBe('b2');
    // 已读条目不被二次计数
    const c = disk.articles.find((x: any) => x.url === 'https://zh.com/3');
    expect(c.read).toBe(true);
    expect(disk.stats.totalRead).toBe(2);
    expect(disk.stats.totalSkipped).toBe(2);
    expect(disk.stats.byPlatform['果壳科学人']).toBe(2);
  });

  it('空列表/全部已读 → 不产生写盘', async () => {
    const vault = seedDisk([{ platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', read: true, state: 'skipped' }]);
    const before = vault.files.get(getNewsFilePath());
    await flowMarkAllRead([]);
    await drainNewsWritesForTests();
    expect(vault.files.get(getNewsFilePath())).toBe(before);
  });
});

describe('已处理正文保留（issue 274）', () => {
  it('单篇已读 → 磁盘 body 保留；会话目录已读段条目可取正文（打开查看数据链路）', async () => {
    const vault = seedDisk([
      { platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', body: '正文甲', date: '2026-09-01 08:00:00' },
    ]);
    const { flowMarkRead } = await import('../../src/clipbook/flow');
    const store = await import('../../src/clipbook/store');
    await flowMarkRead({ raw: diskJson(vault).articles[0] });
    await drainNewsWritesForTests();
    const disk = diskJson(vault);
    expect(disk.articles[0].read).toBe(true);
    expect(disk.articles[0].state).toBe('skipped');
    expect(disk.articles[0].body).toBe('正文甲');
    // 会话目录（ADR-0108）：已读段条目仍携带正文（右栏/移动详情打开即渲染）
    const sidecar = { articleOverrides: {}, savedArchive: [], order: [] };
    const flat = store.queryBySourceFull(disk.articles, sidecar, new Set(), [], { kind: 'all' }, {});
    const buckets = store.bucketByState(flat);
    expect(buckets.read).toHaveLength(1);
    expect(buckets.read[0].body).toBe('正文甲');
    // 收件流口径不变：已处理仍不进收件流
    expect(store.queryBySource(disk.articles, sidecar, new Set(), [], { kind: 'all' }, {})).toHaveLength(0);
  });

  it('已收态（未命中剪藏目录，如 B 站转文献盒）→ 会话目录已收段条目可取正文', async () => {
    const vault = seedDisk([
      { platform: 'B站', title: '视频一', url: 'https://b23.tv/1', author: '影视飓风', body: '简介', date: '2026-09-01 08:00:00', read: true, state: 'saved' },
    ]);
    const store = await import('../../src/clipbook/store');
    const flat = store.queryBySourceFull(
      diskJson(vault).articles,
      { articleOverrides: {}, savedArchive: [], order: [] },
      new Set(), [], { kind: 'all' }, {}
    );
    const buckets = store.bucketByState(flat);
    expect(buckets.saved).toHaveLength(1);
    expect(buckets.saved[0].body).toBe('简介');
  });
});

describe('误标/误删撤销（enh 包 5）', () => {
  it('flowUndoHandled：恢复动作前 read/state/body + 统计回退', async () => {
    const vault = seedDisk([
      { platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', body: '正文甲', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00' },
    ]);
    const rawBefore = { ...diskJson(vault).articles[0] };
    // 误标已读
    const { flowMarkRead } = await import('../../src/clipbook/flow');
    await flowMarkRead({ raw: diskJson(vault).articles[0] });
    await drainNewsWritesForTests();
    let disk = diskJson(vault);
    expect(disk.articles[0].read).toBe(true);
    expect(disk.stats.totalRead).toBe(1);
    // 撤销 → 恢复未读 + 正文 + 统计归零
    await flowUndoHandled(rawBefore);
    await drainNewsWritesForTests();
    disk = diskJson(vault);
    expect(disk.articles[0].read).toBeUndefined();
    expect(disk.articles[0].state).toBeUndefined();
    expect(disk.articles[0].body).toBe('正文甲');
    expect(disk.stats.totalRead).toBe(0);
    expect(disk.stats.totalSkipped).toBe(0);
    expect(disk.stats.byPlatform['果壳科学人']).toBe(0);
  });

  it('flowDeleteNews 后 flowUndoDeleteNews：raw 快照插回；重复撤销不重复插', async () => {
    const vault = seedDisk([
      { platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', body: 'b1', date: '2026-09-01 08:00:00' },
      { platform: '果壳科学人', title: '乙', url: 'https://gk.com/2', body: 'b2', date: '2026-09-01 09:00:00' },
    ]);
    const rawBefore = { ...diskJson(vault).articles[0] };
    await flowDeleteNews({ raw: diskJson(vault).articles[0] });
    await drainNewsWritesForTests();
    expect(diskJson(vault).articles.map((a: any) => a.url)).toEqual(['https://gk.com/2']);
    await flowUndoDeleteNews(rawBefore);
    await drainNewsWritesForTests();
    expect(diskJson(vault).articles.map((a: any) => a.url)).toEqual(['https://gk.com/2', 'https://gk.com/1']);
    // 重复撤销（同 key 已在盘上）→ 不重复插
    await flowUndoDeleteNews(rawBefore);
    await drainNewsWritesForTests();
    expect(diskJson(vault).articles).toHaveLength(2);
  });
});
