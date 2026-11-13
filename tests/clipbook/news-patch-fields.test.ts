// @vitest-environment node
/**
 * news.json 按字段补丁（NewsWriteIntent.patchArticleFields，2026-11-13）。
 *
 * 由来：剪藏成书门面生成 AI 摘要时原先传整条旧快照（`set.articles = [{...raw, aiSummary}]`），
 * 而 set 的声明条目是整条胜出——AI 生成要几秒，这期间后台抓取更新了同一篇，写回去就把
 * 新内容退回旧版本。改成字段补丁后只动 aiSummary，其余字段一律取磁盘现值；磁盘上没有的
 * 条目也不会被补丁复活。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getNewsFilePath, readNewsData, writeNewsDataMerged } from '../../src/clipbook/news-data';
import { articleKeyOf } from '../../src/clipbook/constants';

function seedNews(vault: MockVault, articles: any[]): void {
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
    }),
  );
}

const art = (url: string, patch: Record<string, any> = {}) => ({
  platform: '果壳科学人', title: '文章' + url, url, body: '旧正文', ...patch,
});

function setup(articles: any[]): { vault: MockVault } {
  const vault = new MockVault();
  setApp({ vault } as any);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  seedNews(vault, articles);
  return { vault };
}

beforeEach(() => {
  resetObsidianMocks();
});

describe('writeNewsDataMerged · patchArticleFields', () => {
  it('只改声明字段，其余字段取磁盘现值（不拿旧快照覆盖新内容）', async () => {
    const { vault } = setup([art('https://x.com/a')]);
    const key = articleKeyOf({ url: 'https://x.com/a' });

    // 模拟「生成摘要期间后台抓到了新内容」：磁盘现值已是新正文 + 已读
    seedNews(vault, [art('https://x.com/a', { body: '后台刚抓到的新正文', read: true })]);

    const ok = await writeNewsDataMerged({ set: {}, patchArticleFields: { [key]: { aiSummary: '一段摘要' } } });
    expect(ok).toBe(true);

    const res = await readNewsData();
    const hit = (res.data.articles || []).find((a: any) => a.url === 'https://x.com/a');
    expect(hit.aiSummary).toBe('一段摘要');
    expect(hit.body).toBe('后台刚抓到的新正文'); // 新内容没被旧快照退回
    expect(hit.read).toBe(true);
  });

  it('磁盘上没有的 key 不新增条目（文章已被删/被裁，不借补丁复活）', async () => {
    setup([art('https://x.com/a')]);
    const ghost = articleKeyOf({ url: 'https://x.com/ghost' });

    const ok = await writeNewsDataMerged({ set: {}, patchArticleFields: { [ghost]: { aiSummary: '幽灵' } } });
    expect(ok).toBe(true);

    const res = await readNewsData();
    expect((res.data.articles || []).some((a: any) => a.url === 'https://x.com/ghost')).toBe(false);
    expect((res.data.articles || []).length).toBe(1);
  });

  it('与 set.articles 同时声明时，set 的整条条目胜出', async () => {
    setup([art('https://x.com/a')]);
    const key = articleKeyOf({ url: 'https://x.com/a' });

    await writeNewsDataMerged({
      set: { articles: [art('https://x.com/a', { body: '整条声明' })] },
      patchArticleFields: { [key]: { aiSummary: '补丁不该生效' } },
    });

    const res = await readNewsData();
    const hit = (res.data.articles || []).find((a: any) => a.url === 'https://x.com/a');
    expect(hit.body).toBe('整条声明');
    expect(hit.aiSummary).toBeUndefined();
  });
});
