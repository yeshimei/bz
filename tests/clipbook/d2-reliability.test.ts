// @vitest-environment node
/**
 * clipbook 域 D2 可靠写契约回归（试点域写路径迁移）：
 * - news.json：域私有写队列收编为 core enqueueFileTask 后，与同路径的其他 core 队列写方
 *   （外部域/未来迁移域）共享同一条 per-path 队列，并发写互不覆盖；
 * - clipbook.json：在读切换/删除清理的侧写读改写收编入串行队列（updateClipbookData），
 *   并发切换不同条目互不覆盖；坏文件留档 + 降级初始化后域功能可用；
 * - news.json 损坏保持「不清盘」语义（onCorrupt false：不留档不重建，readNewsData 错误态）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { enqueueFileTask, jsonFileStore } from '../../src/core/storage';
import { getNewsFilePath, readNewsData, writeNewsDataMerged } from '../../src/clipbook/news-data';
import { readClipbookData, updateClipbookData, clipbookFilePath } from '../../src/clipbook/data';
import { enqueueNewsWrite, drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { flowToggleReading } from '../../src/clipbook/flow';

function seedNews(vault: MockVault, articles: any[], extra: Record<string, any> = {}): void {
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
}

const art = (url: string, patch: Record<string, any> = {}) => ({
  platform: '果壳科学人', title: '文章' + url, url, body: '正文', ...patch,
});

beforeEach(() => {
  resetObsidianMocks();
  const vault = new MockVault();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
});

describe('news.json 写队列收编（core per-path 队列）', () => {
  it('①外部域 core 队列写方与 enqueueNewsWrite 并发：双方改动都落盘（共享同一路径队列）', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedNews(vault, [art('https://gk.com/1')]);
    // 模拟外部域写方：直接走 core enqueueFileTask（键 = news.json 路径）追加文章
    const foreignWrite = enqueueFileTask(getNewsFilePath(), async () => {
      const store = jsonFileStore<any>(getNewsFilePath());
      const cur = await store.read();
      cur.articles = [...cur.articles, art('https://zh.com/x', { body: '外部新增' })];
      await store.write(cur);
    });
    // 插件侧写方：段级合并声明 stats 段
    const pluginWrite = enqueueNewsWrite(() => writeNewsDataMerged({ set: { bilibiliMaxItems: 20 } }));
    await Promise.all([foreignWrite, pluginWrite]);
    await drainNewsWritesForTests();
    const disk = JSON.parse(vault.files.get(getNewsFilePath())!);
    expect(disk.articles.some((a: any) => a.url === 'https://zh.com/x')).toBe(true); // 外部新增未丢
    expect(disk.bilibiliMaxItems).toBe(20); // 插件声明段未丢
  });

  it('②解析坏文件 → 不清盘语义保持（onCorrupt false：不留档不重建，readNewsData 错误态）', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    const broken = '{"articles":';
    vault.files.set(getNewsFilePath(), broken);
    const res = await readNewsData();
    expect(res.ok).toBe(false);
    expect(vault.files.get(getNewsFilePath())).toBe(broken); // 原文件原样保留
    expect([...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/'))).toHaveLength(0);
  });
});

describe('clipbook.json 侧写读改写收编（updateClipbookData）', () => {
  it('①并发在读切换不同条目：双方都落盘（裸读改写会互相覆盖）', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    vault.files.set(clipbookFilePath(), JSON.stringify({ articleOverrides: {}, savedArchive: [], order: [] }));
    await Promise.all([
      flowToggleReading({ raw: art('https://gk.com/1') }),
      flowToggleReading({ raw: art('https://gk.com/2') }),
    ]);
    const sidecar = await readClipbookData();
    expect(Object.keys(sidecar.articleOverrides).sort()).toEqual(['url:https://gk.com/1', 'url:https://gk.com/2']);
  });

  it('①同条目连续两次切换：reading → unread（队列内基于磁盘现值翻转）', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    expect(await flowToggleReading({ raw: art('https://gk.com/1') })).toBe('reading');
    expect(await flowToggleReading({ raw: art('https://gk.com/1') })).toBe('unread');
    const sidecar = await readClipbookData();
    expect(sidecar.articleOverrides).toEqual({});
  });

  it('②解析坏文件 → 留档 CONFIG/.CORRUPT + 降级初始化后域功能可用', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    const broken = '{"articleOverrides":';
    vault.files.set(clipbookFilePath(), broken);
    // 坏文件 → 留档 + 降级空侧写，读取不抛
    const cur = await readClipbookData();
    expect(cur).toEqual({ articleOverrides: {}, savedArchive: [], order: [] });
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/clipbook.json.'));
    expect(backups).toHaveLength(1);
    expect(vault.files.get(backups[0])).toBe(broken);
    // 降级后域功能可用：在读切换正常落盘
    expect(await flowToggleReading({ raw: art('https://gk.com/9') })).toBe('reading');
    const sidecar = await updateClipbookData((d) => d);
    expect(Object.keys(sidecar.articleOverrides)).toEqual(['url:https://gk.com/9']);
  });
});
