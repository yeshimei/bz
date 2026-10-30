// @vitest-environment jsdom
/**
 * memo item-1792395419930（2026-10-19）：
 *  ① 移动详情头行「返回 / 存为剪藏」左右互换（保存左、返回右）；
 *  ② 正文左右滑动切换上一篇/下一篇，低灵敏（位移门槛 + 横向主导 + 时限）。
 * 手势口径刻意做「宁可不动」——纵向滚正文不得误切篇，章首/章末越界不做任何事。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { unloadPanel } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { getNewsFilePath } from '../../src/clipbook/news-data';

/**
 * 设置注入必须早于「种数据」。
 *
 * 这些用例在模块顶层/`before*` 里先 `vault.files.set(getXxxFilePath(), ...)` 再注入设置，
 * 而路径由 `storagePath` 决定：注入前算出来的是缺省 `<插件>/storage`，跟下面注入的
 * `CONFIG/STORAGE` 不是同一个文件——表现为**整个文件的第一条用例读到 0 条**，
 * 靠 `retry` 重跑（此时上一轮的注入还留着）才绿。这里先注入一次，把顺序钉正。
 */
setSettingsProvider(() => ({
    storagePath: 'CONFIG/STORAGE',
    articleDirectory: '归档/网页剪藏',
    knowledgeDirectory: '文献盒',
    clipbookImageFolder: '',
  } as any));

const { Platform } = await import('obsidian');

function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '甲文', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '甲的正文' },
      { platform: '果壳科学人', title: '乙文', url: 'https://guokr.com/2', author: '果壳', date: '2026-09-01 09:00:00', fetchedAt: '2026-09-01 07:00:00', body: '乙的正文' },
      { platform: '果壳科学人', title: '丙文', url: 'https://guokr.com/3', author: '果壳', date: '2026-09-01 10:00:00', fetchedAt: '2026-09-01 07:00:00', body: '丙的正文' },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  return vault;
}

function boot(): MockVault {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  unloadPanel();
  resetObsidianMocks();
  const vault = seedVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({
    storagePath: 'CONFIG/STORAGE',
    articleDirectory: '归档/网页剪藏',
    knowledgeDirectory: '文献盒',
    clipbookImageFolder: '',
  } as any));
  openClipbook(getApp());
  return vault;
}

async function openMobDetailByTitle(title: string): Promise<void> {
  await vi.waitFor(() => expect(M.articles.length).toBe(3));
  const card = [...document.querySelectorAll('.bz-clip-mob-item') as unknown as HTMLElement[]]
    .find((el) => el.textContent?.includes(title));
  expect(card, `目录里应能找到 ${title}`).toBeTruthy();
  card!.click();
  await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
  await vi.waitFor(() => expect(M.cur?.title).toBe(title));
}

/** jsdom 没有 Touch 构造器：手工挂 touches / changedTouches */
function fireTouch(el: HTMLElement, type: 'touchstart' | 'touchend' | 'touchcancel', x = 0, y = 0): void {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const point = { clientX: x, clientY: y };
  Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : [point] });
  Object.defineProperty(ev, 'changedTouches', { value: [point] });
  el.dispatchEvent(ev);
}

function swipe(el: HTMLElement, dx: number, dy = 0): void {
  fireTouch(el, 'touchstart', 200, 300);
  fireTouch(el, 'touchend', 200 + dx, 300 + dy);
}

afterEach(() => {
  vi.restoreAllMocks();
  (Platform as any).isMobile = false;
  clearNotices();
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
});

beforeEach(() => {
  (Platform as any).isMobile = true;
});

describe('移动详情头行：保存左 / 返回右（memo item-1792395419930）', () => {
  it('DOM 顺序 = 存为剪藏 → 标题 → 返回', async () => {
    boot();
    await openMobDetailByTitle('甲文');
    const top = document.querySelector('.bz-clip-mob-detail-top') as HTMLElement;
    const save = top.querySelector('[data-clip-mob-save]') as HTMLElement;
    const back = top.querySelector('[data-clip-mob-back]') as HTMLElement;
    expect(save).toBeTruthy();
    expect(back).toBeTruthy();
    // compareDocumentPosition：save 在 back 之前（4 = DOCUMENT_POSITION_FOLLOWING）
    expect(save.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(back.textContent).toContain('返回');
    // 两个入口都仍然可点：返回能收详情、保存钮仍在（本篇未存）
    expect(save.textContent).toBe('存为剪藏');
    back.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(false));
  });
});

describe('正文左右滑动换篇：低灵敏（memo item-1792395419930）', () => {
  it('左滑 → 下一篇；右滑 → 上一篇', async () => {
    boot();
    await openMobDetailByTitle('甲文');
    const body = document.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
    swipe(body, -140); // 左滑 = 下一篇
    await vi.waitFor(() => expect(M.cur?.title).toBe('乙文'));
    swipe(body, 140); // 右滑 = 上一篇
    await vi.waitFor(() => expect(M.cur?.title).toBe('甲文'));
  });

  it('位移不足 96px 不切篇（低灵敏）', async () => {
    boot();
    await openMobDetailByTitle('甲文');
    const body = document.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
    swipe(body, -80);
    await new Promise((r) => setTimeout(r, 30));
    expect(M.cur?.title).toBe('甲文');
  });

  it('纵向为主（|dx| < 2|dy|）不切篇', async () => {
    boot();
    await openMobDetailByTitle('甲文');
    const body = document.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
    swipe(body, -120, -100);
    await new Promise((r) => setTimeout(r, 30));
    expect(M.cur?.title).toBe('甲文');
  });

  it('章末左滑越界：不换篇、不退出详情', async () => {
    boot();
    await openMobDetailByTitle('丙文');
    const body = document.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
    swipe(body, -160);
    await new Promise((r) => setTimeout(r, 30));
    expect(M.cur?.title).toBe('丙文');
    expect(M.mobDetailOpen).toBe(true);
  });

  it('章首右滑越界：不换篇', async () => {
    boot();
    await openMobDetailByTitle('甲文');
    const body = document.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
    swipe(body, 160);
    await new Promise((r) => setTimeout(r, 30));
    expect(M.cur?.title).toBe('甲文');
  });

  it('换篇后滚动归零（与「读下一则」同口径）', async () => {
    boot();
    await openMobDetailByTitle('甲文');
    const body = document.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
    body.scrollTop = 180;
    swipe(body, -140);
    await vi.waitFor(() => expect(M.cur?.title).toBe('乙文'));
    expect(body.scrollTop).toBe(0);
  });
});
