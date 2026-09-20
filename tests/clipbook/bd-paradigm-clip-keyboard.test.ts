// @vitest-environment jsdom
/**
 * 呈报#12-E7（同型面板）剪藏本工作台键盘化 · 回归测试
 *
 * E7 拍板：保险库工作台键盘化牵动剪藏本同型面板一起落——
 * - 中栏条目行（div 化）role=button + tabindex=0，Enter/Space → 与点击同一落点
 *   （选中 → 阅读接力右栏，效率#6 焦点接力复用）；
 * - 移动折叠行（data-fold）补 tabindex=0 + Enter/Space 开合（桌面折叠行 C-UI5 先例对称）；
 * - memo 同型工作台面板随 memo 队尾重审统一处理（本轮禁改，域内注释已注记）。
 * 自造 fixture（MockVault 种子），不读任何真实数据。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { mobFoldHtml } from '../../src/clipbook/render';

function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '甲文标题', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '量子纠缠是一种奇妙的量子力学现象。' },
      { platform: '果壳科学人', title: '乙文标题', url: 'https://guokr.com/2', author: '果壳', date: '2026-09-02 08:00:00', fetchedAt: '2026-09-02 07:00:00', body: '第二篇正文。' },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  return vault;
}

describe('剪藏本工作台键盘化（E7 同型面板）', () => {
  beforeEach(() => {
    try { unloadClipbook(); } catch (e) { /* 幂等 */ }
    resetObsidianMocks();
    const vault = seedVault();
    setApp(mockAppWithVault(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏', knowledgeDirectory: '文献盒' } as any));
  });

  afterEach(() => {
    try { unloadClipbook(); } catch (e) { /* 幂等 */ }
    document.body.innerHTML = '';
  });

  it('中栏条目行可焦：role=button + tabindex=0（markup 侧）', async () => {
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const card = document.querySelector('.bz-clip-item') as HTMLElement | null;
    expect(card, '目录里应有条目行').toBeTruthy();
    expect(card!.getAttribute('role')).toBe('button');
    expect(card!.getAttribute('tabindex')).toBe('0');
  });

  it('Enter 选中条目：M.cur 切到该篇（与点击同一落点，初始选中第一篇）', async () => {
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const cards = [...document.querySelectorAll<HTMLElement>('.bz-clip-item')];
    expect(cards.length).toBe(2);
    const other = cards.find((c) => c.dataset.id !== M.cur?.id)!;
    other.focus();
    other.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(M.cur?.id).toBe(other.dataset.id); // Enter = 选中该篇
  });

  it('Space 同语义；普通键不触发选中', async () => {
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const cards = [...document.querySelectorAll<HTMLElement>('.bz-clip-item')];
    const target = cards.find((c) => c.dataset.id !== M.cur?.id)!;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(M.cur?.id).toBe(target.dataset.id); // Space 同语义
    // 普通字符键不触发选中：M.cur 不因字符键改变
    const other = cards.find((c) => c.dataset.id !== M.cur?.id)!;
    other.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true }));
    expect(M.cur?.id).toBe(target.dataset.id); // 保持不变
  });

  it('移动折叠行 markup：data-fold role=button + tabindex=0（Enter/Space 由 mobList 委托接管）', () => {
    const html = mobFoldHtml('read', 3, false);
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-fold');
  });
});
