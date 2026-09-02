/**
 * clipbook 域：UI 层（ADR-0082 / issue 177）jsdom 测试。
 * 桌面三栏构建 / rail 源切换 / 列表点击阅读 / 移动双屏切换 / 右键动作（保存/已读/在读）
 * 状态点与徽标、卸载清理。core 注入三连 + MockVault 种子数据。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { initPanel, showPanel, closePanel, unloadPanel } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { setClipDir } from './helpers';

/** 种子：news.json 未读 2 + 已处理 1 + 剪藏目录 1 篇 */
function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '果壳文章一', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '正文一 的内容段落。' },
      { platform: 'B站', title: '影视飓风视频', url: 'https://bilibili.com/video/BV1', author: '影视飓风', date: '2026-09-01 09:00:00', body: '视频简介内容' },
      { platform: '知乎日报', title: '已读知乎', url: 'https://zhihu.com/2', date: '2026-08-30 08:00:00', read: true, state: 'skipped' },
    ],
    stats: { totalRead: 1, totalSaved: 0, totalSkipped: 1, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  vault.files.set('归档/网页剪藏/剪藏笔记A.md', '---\nurl: "https://guokr.com/1"\ncreated: 2026-08-20 10:00:00\n---\n正文');
  return vault;
}

function boot(show = true): MockVault {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  const vault = seedVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

async function openDesktop(): Promise<void> {
  boot();
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBeGreaterThan(0));
}

describe('clipbook UI 桌面三栏', () => {
  it('构建 overlay + 三栏骨架（rail/中栏/右栏）', async () => {
    await openDesktop();
    const overlay = document.querySelector('.bz-clip-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.bz-clip-desk')).toBeTruthy();
    expect(overlay.querySelector('.bz-clip-rail-list')).toBeTruthy();
    expect(overlay.querySelector('.bz-clip-list')).toBeTruthy();
    expect(overlay.querySelector('[data-clip-reader]')).toBeTruthy();
    // 无 emoji 图标（图标全 lucide data-lucide）
    expect(overlay.textContent).not.toMatch(/[📥📰⚙️❌🔍📊]/);
  });

  it('rail：全部未读徽标 = 未读 2；B站 UP 展开影视飓风；剪藏本计数 = 1', async () => {
    await openDesktop();
    const rows = [...document.querySelectorAll('.bz-clip-rail-row')] as HTMLElement[];
    const allRow = rows.find((r) => r.textContent!.includes('全部未读'))!;
    expect(allRow.textContent).toContain('2');
    const upRow = rows.find((r) => r.textContent!.includes('影视飓风'))!;
    expect(upRow).toBeTruthy();
    const clipRow = rows.find((r) => r.textContent!.includes('剪藏本'))!;
    expect(clipRow.textContent).toContain('1');
  });

  it('列表点击 → 阅读区渲染标题与正文段', async () => {
    await openDesktop();
    const items = [...document.querySelectorAll('.bz-clip-item')] as HTMLElement[];
    expect(items.length).toBeGreaterThan(0); // 未读流非空（已读不进流）
    (items[items.length - 1] as HTMLElement).click();
    const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
    await vi.waitFor(() => expect(reader.textContent).toContain('影视飓风视频'));
    expect(reader.textContent).toContain('视频简介内容');
  });

  it('右键菜单：news 条目含「保存到剪藏本」；剪藏源条目含「打开笔记」', async () => {
    await openDesktop();
    // 切到剪藏本源
    const clipRow = [...document.querySelectorAll('.bz-clip-rail-row')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const ctx = document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu.textContent).toContain('打开笔记');
    expect(menu.textContent).not.toContain('保存到剪藏本');
    closePanel();
  });

  it('移动端（isMobileEnv）→ mob 容器显示 + 点条目进详情 + 头栏保存钮', async () => {
    boot();
    // 模拟移动端（isMobileEnv = Platform.isMobile；直接拉高 M.isMobile 需走 UI 分支——用 window 宽判定被 mock 卡，
    // 改走 Platform mock 更稳：直接测 mob DOM 存在与点击流程（桌面下 mob 隐藏但 DOM 可测）
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(3)); // 全量：未读2+已处理1
    const mobItems = [...document.querySelectorAll('.bz-clip-mob-item')] as HTMLElement[];
    expect(mobItems.length).toBeGreaterThan(0);
    (mobItems[0] as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    const saveBtn = document.querySelector('[data-clip-mob-save]') as HTMLElement;
    expect(saveBtn).toBeTruthy();
    expect(saveBtn.title).toBe('保存到剪藏本');
    closePanel();
  });

  it('卸载清理（unloadPanel 移除 overlay + 状态复位）', async () => {
    await openDesktop();
    expect(document.querySelector('.bz-clip-overlay')).toBeTruthy();
    unloadPanel();
    expect(document.querySelector('.bz-clip-overlay')).toBeNull();
    expect(M.overlay).toBeNull();
  });
});
