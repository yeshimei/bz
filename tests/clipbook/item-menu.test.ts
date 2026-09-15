// @vitest-environment jsdom
/**
 * clipbook（issue 329 追加修订）：条目菜单与抽屉头部测试。
 * 覆盖：news 条目「复制原文链接」（位置在保存之后/标记已读之前，点击写剪贴板 + 通知）、
 * 抽屉头对齐核心（attachItemActions 收 sheetTitle/sheetSub，域内自绘头部 sheetHead 零残留）、
 * clip 分支既有动作不动（复制双链/复制原文链接带 domain 小字）。
 * item-actions 走 importOriginal 包裹 mock：行为不变，仅旁路记录入参供断言。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { closeItemMenu } from '../../src/core/item-actions';

/** 旁路记录 attachItemActions 入参（桌面卡/移动卡/rail 行共用断言池） */
const capture = vi.hoisted(() => ({ calls: [] as Array<{ actions: any[]; opts: any }> }));
vi.mock('../../src/core/item-actions', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    attachItemActions: (card: any, actions: any, opts: any) => {
      capture.calls.push({ actions, opts });
      return actual.attachItemActions(card, actions, opts);
    },
  };
});

/** 种子：未读 news 一篇（带摘要素材正文）+ 剪藏笔记一篇（clip 分支对照） */
function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '甲文标题', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '量子纠缠是一种奇妙的量子力学现象，值得划词记录。' },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  vault.files.set('归档/网页剪藏/剪藏笔记A.md', '---\nurl: "https://guokr.com/old"\nsite: 果壳\ncreated: 2026-08-20 10:00:00\nsummary: "剪藏摘要一句"\n---\n剪藏正文。');
  return vault;
}

function boot(): MockVault {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  capture.calls.length = 0;
  const vault = seedVault();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏', knowledgeDirectory: '文献盒' } as any));
  return vault;
}

async function openDesktop(): Promise<void> {
  boot();
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBe(1));
}

async function openMenuOn(target: HTMLElement): Promise<HTMLElement> {
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  return vi.waitFor(() => {
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).toBeTruthy();
    return menu;
  });
}

function menuLabels(menu: HTMLElement): string[] {
  return [...menu.querySelectorAll('.bz-item-menu-label')].map((el) => el.textContent || '');
}

beforeEach(() => {
  boot();
});

afterEach(() => {
  try { closeItemMenu(); } catch (e) { /* 幂等 */ }
  vi.restoreAllMocks();
});

describe('news 条目菜单补「复制原文链接」（issue 329 追加修订）', () => {
  it('动作齐全且顺序：保存到剪藏本 → 复制原文链接 → 标记为已读 → 删除', async () => {
    await openDesktop();
    const menu = await openMenuOn(document.querySelector('.bz-clip-item') as HTMLElement);
    expect(menuLabels(menu)).toEqual(['保存到剪藏本', '复制原文链接', '标记为已读', '删除']);
  });

  it('点击复制原文链接 → 剪贴板写入原文 URL + 成功通知（正文无 emoji）', async () => {
    await openDesktop();
    const writeText = vi.fn(async (_t: string) => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const menu = await openMenuOn(document.querySelector('.bz-clip-item') as HTMLElement);
    const btn = [...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('复制原文链接')) as HTMLElement;
    btn.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith('https://guokr.com/1');
    const msg = await vi.waitFor(() => {
      const el = [...document.querySelectorAll('.bz-notice-msg')].find((n) => n.textContent === '原文链接已复制');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(msg.closest('.bz-notice')!.className).toContain('bz-notice--success');
  });

  it('已收条目（无保存/标读入口）仍可复制原文链接', async () => {
    const vault = boot();
    // 收件流唯一条目改为已收（state=saved）→ 动作只剩 复制原文链接 + 删除
    const disk = JSON.parse(vault.files.get('CONFIG/STORAGE/news.json')!);
    disk.articles[0].read = true;
    disk.articles[0].state = 'saved';
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify(disk));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    const menu = await openMenuOn(document.querySelector('.bz-clip-item') as HTMLElement);
    expect(menuLabels(menu)).toEqual(['复制原文链接', '删除']);
  });
});

describe('抽屉头部对齐核心（sheetTitle/sheetSub，自绘头部退役）', () => {
  it('条目卡 attachItemActions 收 sheetTitle/sheetSub，不再传 sheetHead；menuClass 保留', async () => {
    await openDesktop();
    const cardCalls = capture.calls.filter((c) =>
      c.opts && c.opts.menuClass === 'bz-clip-menu-editorial'
      && Array.isArray(c.actions) && c.actions.some((a) => a.label === '保存到剪藏本'));
    expect(cardCalls.length).toBeGreaterThanOrEqual(1);
    for (const c of cardCalls) {
      expect(c.opts.sheetHead).toBeUndefined();
      expect(c.opts.sheetTitle).toBe('甲文标题');
      expect(typeof c.opts.sheetSub).toBe('string');
      expect(c.opts.sheetSub!.length).toBeGreaterThan(0); // news 摘要 = body 首段截取
    }
  });

  it('移动目录卡同款（无 menuClass 的条目动作调用也走 sheetTitle/sheetSub）', async () => {
    await openDesktop();
    const mobCalls = capture.calls.filter((c) =>
      c.opts && !c.opts.menuClass
      && Array.isArray(c.actions) && c.actions.some((a) => a.label === '保存到剪藏本'));
    expect(mobCalls.length).toBeGreaterThanOrEqual(1);
    for (const c of mobCalls) {
      expect(c.opts.sheetHead).toBeUndefined();
      expect(c.opts.sheetTitle).toBe('甲文标题');
    }
  });

  it('clip 条目卡动作不动（打开笔记/复制双链/复制原文链接/删除），头部同样走核心', async () => {
    await openDesktop();
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const menu = await openMenuOn(document.querySelector('.bz-clip-item') as HTMLElement);
    expect(menuLabels(menu)).toEqual(['打开笔记', '复制双链', '复制原文链接', '重新生成摘要', '删除']);
    // clip 卡的抽屉头（mobile 通道）同样收 sheetTitle/sheetSub
    const clipCalls = capture.calls.filter((c) =>
      c.opts && Array.isArray(c.actions) && c.actions.some((a) => a.label === '打开笔记') && !c.opts.sheetHead);
    expect(clipCalls.length).toBeGreaterThanOrEqual(1);
    expect(clipCalls[0].opts.sheetTitle).toBe('剪藏笔记A');
  });

  it('自绘头部类零残留（DOM 无 .bz-clip-sheet-head/-title/-sum）', async () => {
    await openDesktop();
    await openMenuOn(document.querySelector('.bz-clip-item') as HTMLElement);
    expect(document.querySelector('.bz-clip-sheet-head')).toBeNull();
    expect(document.querySelector('.bz-clip-sheet-title')).toBeNull();
    expect(document.querySelector('.bz-clip-sheet-sum')).toBeNull();
  });
});
