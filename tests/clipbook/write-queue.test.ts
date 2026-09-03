// @vitest-environment jsdom
/**
 * clipbook 域：news.json 写回串行队列 + 段级合并（F 审查项回归）。
 * 覆盖：daemon 并发追加文章不被写回覆盖（并集）、删除意图不复活、未声明段取磁盘值、
 * 声明段胜出、队列串行性；flowSave/flowMarkRead 的已处理标记与保存失败防线（C1/E 回归）。
 * 注：jsdom 而非 node——flowSave 成功路径经 core/notice 弹通知（ensureContainer 需 document）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getNewsFilePath, readNewsData, writeNewsDataMerged } from '../../src/clipbook/news-data';
import { enqueueNewsWrite, drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { flowSave, flowMarkRead } from '../../src/clipbook/flow';

function seedDisk(articles: any[], extra: Record<string, any> = {}): MockVault {
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
      ...extra,
    })
  );
  setApp(mockAppWithVault(vault));
  return vault;
}

const diskJson = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
});

describe('writeNewsDataMerged 段级合并', () => {
  it('F：写回不丢磁盘上插件快照中没有的新文章（daemon 在读-写窗口内追加）', async () => {
    const vault = seedDisk([{ platform: '果壳科学人', title: '旧文章', url: 'https://gk.com/1', body: '正文' }]);
    // 模拟插件基于旧快照准备好标记已处理的 articles 段（不含 daemon 之后追加的新文章）
    const snapshotList = [{ platform: '果壳科学人', title: '旧文章', url: 'https://gk.com/1', read: true, state: 'saved' }];
    // daemon 在插件的 read→write 窗口内追加新文章
    vault.files.set(
      getNewsFilePath(),
      JSON.stringify({
        ...diskJson(vault),
        articles: [
          { platform: '果壳科学人', title: '旧文章', url: 'https://gk.com/1', body: '正文' },
          { platform: '知乎日报', title: 'daemon 新文章', url: 'https://zh.com/9', body: '新正文' },
        ],
      })
    );
    await enqueueNewsWrite(() => writeNewsDataMerged({ set: { articles: snapshotList } }));
    const disk = diskJson(vault);
    // 旧文章已被标记已处理（声明条目胜出）
    const old = disk.articles.find((a: any) => a.url === 'https://gk.com/1');
    expect(old.read).toBe(true);
    expect(old.state).toBe('saved');
    expect(old.body).toBeUndefined();
    // daemon 新文章原样保留（盲覆盖实现会把它丢掉）
    const fresh = disk.articles.find((a: any) => a.url === 'https://zh.com/9');
    expect(fresh).toBeTruthy();
    expect(fresh.body).toBe('新正文');
    expect(fresh.read).toBeUndefined();
  });

  it('F：删除意图（removeArticleKeys）在并集合并时不被磁盘旧值复活', async () => {
    const vault = seedDisk([
      { platform: '果壳科学人', title: '要删的', url: 'https://gk.com/2' },
      { platform: '果壳科学人', title: '留下的', url: 'https://gk.com/3' },
    ]);
    void vault;
    await enqueueNewsWrite(() => writeNewsDataMerged({ set: { articles: [] }, removeArticleKeys: ['url:https://gk.com/2'] }));
    const disk = diskJson(vault);
    expect(disk.articles.map((a: any) => a.url)).toEqual(['https://gk.com/3']);
  });

  it('F：未声明段取磁盘现值——daemon 更新的 bilibiliCookie 不被旧快照覆盖', async () => {
    const vault = seedDisk([{ platform: 'B站', title: '视频', url: 'https://b23.tv/1' }], { bilibiliCookie: 'OLD' });
    // daemon 更新了 cookie
    vault.files.set(getNewsFilePath(), JSON.stringify({ ...diskJson(vault), bilibiliCookie: 'DAEMON-NEW' }));
    await enqueueNewsWrite(() => writeNewsDataMerged({ set: { bilibiliMaxItems: 20 } }));
    const disk = diskJson(vault);
    expect(disk.bilibiliCookie).toBe('DAEMON-NEW'); // 未声明段取磁盘
    expect(disk.bilibiliMaxItems).toBe(20); // 声明段胜出
  });

  it('F：声明 stats 段胜出，articles 未声明则整段取磁盘', async () => {
    const vault = seedDisk([{ platform: 'B站', title: '视频', url: 'https://b23.tv/1', body: 'b' }]);
    void vault;
    await enqueueNewsWrite(() =>
      writeNewsDataMerged({ set: { stats: { totalRead: 5, totalSaved: 2, totalSkipped: 3, byPlatform: { B站: 5 }, byDate: {} } } })
    );
    const disk = diskJson(vault);
    expect(disk.stats.totalRead).toBe(5);
    expect(disk.articles).toHaveLength(1);
    expect(disk.articles[0].body).toBe('b');
  });
});

describe('写回串行队列', () => {
  it('F：enqueueNewsWrite 严格按入队顺序执行（先入先出，不交错）', async () => {
    const order: number[] = [];
    const p1 = enqueueNewsWrite(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    const p2 = enqueueNewsWrite(async () => {
      order.push(2);
    });
    const p3 = enqueueNewsWrite(async () => {
      order.push(3);
    });
    await Promise.all([p1, p2, p3, drainNewsWritesForTests()]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('F：单操作失败不中断队列，后续操作照常执行且错误透传给该次调用方', async () => {
    const order: number[] = [];
    const boom = enqueueNewsWrite(async () => {
      throw new Error('boom');
    }).then(
      () => 'ok',
      (e) => (e as Error).message
    );
    const after = enqueueNewsWrite(async () => {
      order.push(1);
      return 'done';
    });
    await Promise.all([boom, after, drainNewsWritesForTests()]);
    expect(await boom).toBe('boom');
    expect(await after).toBe('done');
  });
});

describe('flowSave / flowMarkRead 已处理链路（含 C1/E 回归）', () => {
  it('保存成功 → 笔记落盘 + 标已处理（read/saved/清 body）+ 统计 +1（单次读改写）', async () => {
    const vault = seedDisk([{ platform: '果壳科学人', title: '文章A', url: 'https://gk.com/a', body: '正文A', date: '2026-09-01 08:00:00' }]);
    const raw = { platform: '果壳科学人', title: '文章A', url: 'https://gk.com/a', body: '正文A', date: '2026-09-01 08:00:00' };
    const ok = await flowSave({ raw });
    expect(ok).toBe(true);
    await drainNewsWritesForTests();
    // 剪藏笔记已写盘
    expect(vault.files.has('归档/网页剪藏/文章A.md')).toBe(true);
    const disk = diskJson(vault);
    const a = disk.articles.find((x: any) => x.url === 'https://gk.com/a');
    expect(a.read).toBe(true);
    expect(a.state).toBe('saved');
    expect(a.body).toBeUndefined();
    expect(disk.stats.totalSaved).toBe(1);
    expect(disk.stats.totalRead).toBe(1);
  });

  it('C1/E 回归：写盘失败 → 返回 false，条目仍带 body 且未标已处理（不被静默消费）', async () => {
    const vault = seedDisk([{ platform: '果壳科学人', title: '文章B', url: 'https://gk.com/b', body: '正文B', date: '2026-09-01 09:00:00' }]);
    const spy = vi.spyOn(vault, 'create').mockRejectedValue(new Error('disk full'));
    try {
      const ok = await flowSave({ raw: { platform: '果壳科学人', title: '文章B', url: 'https://gk.com/b', body: '正文B', date: '2026-09-01 09:00:00' } });
      expect(ok).toBe(false);
      await drainNewsWritesForTests();
      // news.json 未被标记：条目仍带正文、read 未置位、统计不动
      const disk = diskJson(vault);
      const a = disk.articles.find((x: any) => x.url === 'https://gk.com/b');
      expect(a.read).toBeUndefined();
      expect(a.body).toBe('正文B');
      expect(disk.stats.totalSaved).toBe(0);
      expect(disk.stats.totalRead).toBe(0);
      // 剪藏目录无半截文件
      expect(vault.files.has('归档/网页剪藏/文章B.md')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('flowMarkRead → read/skipped + 清 body + 统计 skipped +1', async () => {
    seedDisk([{ platform: '知乎日报', title: '文章D', url: 'https://zh.com/d', body: '正文D', date: '2026-09-01 11:00:00' }]);
    await flowMarkRead({ raw: { platform: '知乎日报', title: '文章D', url: 'https://zh.com/d', body: '正文D', date: '2026-09-01 11:00:00' } });
    await drainNewsWritesForTests();
    const res = await readNewsData();
    const a = res.data.articles.find((x: any) => x.url === 'https://zh.com/d');
    expect(a.read).toBe(true);
    expect(a.state).toBe('skipped');
    expect(a.body).toBeUndefined();
    expect(res.data.stats.totalSkipped).toBe(1);
    expect(res.data.stats.totalRead).toBe(1);
  });
});
