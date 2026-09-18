// @vitest-environment jsdom
/**
 * 剪藏本（clipbook）· T8 MarkdownRenderer 渲染抛错兜底分支钉死（review-deep clipbook-arch 测试缺口 8）
 *
 * 现状行为直接钉死（无并行翻转项）：hydrateArticleMarkdown 渲染 reject →
 *   ① 容器落 `el.textContent = md` 纯文本兜底（铁律 6 兜底语义——渲染失败/空产出不白屏）；
 *   ② 兜底不叠加双份：占位（「正在读取剪藏正文…」）已在水合前清空（C5），兜底是整容器替换
 *      而非追加，正文恰出现一次。
 * mock render 恒 reject（追加语义 mock 默认成功路径由 ui.test/mob-clip-body.test 盖）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, mockMarkdownRenderer } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { getNewsFilePath } from '../../src/clipbook/news-data';

/** mock-obsidian-entry 的默认追加语义实现（用例内换 reject，结束后恢复） */
const DEFAULT_RENDER = mockMarkdownRenderer.render.getMockImplementation();

const NEWS_BODY = '渲染兜底探针正文段落，用于纯文本回退断言。';
const CLIP_NOTE = [
  '---',
  'url: "https://gk.com/clip-note-1"',
  'created: 2026-08-20 10:00:00',
  '---',
  '剪藏正文第一段，水合失败走兜底。',
  '',
  '剪藏正文第二段。',
].join('\n');

function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles: [
        { platform: '果壳科学人', title: '兜底探针文', url: 'https://gk.com/fallback-1', author: '果壳', date: '2026-09-01 08:00:00', body: NEWS_BODY },
      ],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true }, rssFeeds: [], lastFetchAt: 0, fetchIntervalMin: 30,
    })
  );
  vault.files.set('归档/网页剪藏/剪藏探针.md', CLIP_NOTE);
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

/** 渲染恒拒绝（兜底分支探针） */
function rejectAllRenders(reason = '渲染探针-拒绝') {
  mockMarkdownRenderer.render.mockRejectedValue(new Error(reason));
}

beforeEach(() => {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  mockMarkdownRenderer.render.mockReset();
  if (DEFAULT_RENDER) mockMarkdownRenderer.render.mockImplementation(DEFAULT_RENDER);
  document.body.innerHTML = '';
});

describe('T8 渲染兜底（hydrateArticleMarkdown reject → textContent 纯文本，现状直接钉死）', () => {
  it('news 条目水合拒绝：右栏落纯文本兜底，正文恰一次、无渲染产出子元素', async () => {
    seedVault();
    rejectAllRenders();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    (document.querySelector('.bz-clip-item') as HTMLElement).click();

    const mdEl = (await vi.waitFor(() => {
      const el = document.querySelector('[data-clip-md]') as HTMLElement | null;
      expect(el?.textContent || '').toContain(NEWS_BODY);
      return el;
    })) as HTMLElement;

    // ① 纯文本兜底：textContent = md 原文（不是空容器、不是报错白屏）
    expect(mdEl.textContent).toBe(NEWS_BODY);
    // ② 不叠加双份：兜底是整容器替换，正文恰出现一次
    expect(mdEl.textContent.indexOf(NEWS_BODY)).toBe(mdEl.textContent.lastIndexOf(NEWS_BODY));
    expect(mdEl.children.length).toBe(0); // 渲染产出（追加语义 block）不存在
  });

  it('剪藏条目水合拒绝：占位被清、纯文本兜底不与「正在读取剪藏正文…」叠加', async () => {
    const vault = seedVault();
    void vault;
    rejectAllRenders();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    // 切「剪藏本」源（唯一剪藏条目被自动选中 → renderReader 占位 → loadClipBody → 水合拒绝 → 兜底）
    ([
      ...document.querySelectorAll('.bz-rail-item'),
    ] as HTMLElement[]).find((r) => r.textContent!.includes('剪藏本'))!.click();

    const mdEl = (await vi.waitFor(() => {
      const el = document.querySelector('[data-clip-md]') as HTMLElement | null;
      expect(el?.textContent || '').toContain('剪藏正文第一段');
      return el;
    })) as HTMLElement;

    const stripped = '剪藏正文第一段，水合失败走兜底。\n\n剪藏正文第二段。';
    // ① 兜底 = 剥壳正文原文（cachedRead → stripClipChrome）
    expect(mdEl.textContent).toBe(stripped);
    // ② 占位不叠加双份：C5 水合前清占位 + 兜底整容器替换
    expect(mdEl.textContent).not.toContain('正在读取剪藏正文');
    expect(mdEl.textContent.indexOf('剪藏正文第一段')).toBe(mdEl.textContent.lastIndexOf('剪藏正文第一段'));
    expect(mdEl.children.length).toBe(0);
  });
});
