// @vitest-environment jsdom
/**
 * clipbook 增强包 UI 回归（enh-clipbook）。
 * 覆盖：桌面搜索防抖（包1）/ 移动长按抽屉接入（包2）/ 右栏读剪藏正文+缓存失效+打开笔记
 * （包3）/ rail 源行批量已读（包4）/ 误标误删可撤销（包5）/ 阅读动线（自动在读、前进
 * 下一篇、←→jk，包6）/ 阅读字号三档（包7）/ 面板尺寸记忆（包8）/ 副题术语（包12）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { reloadIfOpen, invalidateClipBodyCache, __autoReadingDelayForTests } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';

const CLIP_A = '---\nurl: "https://example.com/clip-a"\ncreated: 2026-08-20 10:00:00\n---\n```dataviewjs\nawait dv.view(`CONFIG/SCRIPTS/DataView/摘要`)\n```\n\n剪藏正文第一段，用于右栏阅读。\n\n> 引用一句话\n';
const CLIP_B = '---\nurl: "https://example.com/clip-a"\ncreated: 2026-08-20 10:00:00\n---\n剪藏正文第二段，缓存失效后出现。\n';

function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '果壳文章一', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '正文一 的内容段落。' },
      { platform: 'B站', title: '影视飓风视频', url: 'https://bilibili.com/video/BV1', author: '影视飓风', date: '2026-09-01 09:00:00', body: '视频简介内容' },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  vault.files.set('归档/网页剪藏/剪藏笔记A.md', CLIP_A);
  return vault;
}

function boot(settingsPatch: Record<string, any> = {}): { vault: MockVault; settings: any; saveSpy: ReturnType<typeof vi.fn> } {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
  const vault = seedVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  const settings = { storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏', clipbookMobileDefaultFullscreen: false, ...settingsPatch };
  const saveSpy = vi.fn(async () => {});
  setSettingsProvider(() => settings as any);
  setSettingsSaver(saveSpy);
  return { vault, settings, saveSpy };
}

async function openDesktop(settingsPatch: Record<string, any> = {}): Promise<ReturnType<typeof boot>> {
  const ctx = boot(settingsPatch);
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBe(2));
  return ctx;
}

const diskJson = (vault: MockVault) => JSON.parse(vault.files.get('CONFIG/STORAGE/news.json')!);

async function openContextMenuOn(target: HTMLElement): Promise<HTMLElement> {
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
  return document.querySelector('.bz-item-menu') as HTMLElement;
}

beforeEach(() => {
  __autoReadingDelayForTests(10000);
});

afterEach(() => {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  __autoReadingDelayForTests(10000);
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
});

describe('桌面搜索（enh 包 1）', () => {
  it('desk-head 搜索框存在；输入 180ms 防抖后列表过滤', async () => {
    await openDesktop();
    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    expect(input).toBeTruthy();
    // 防抖窗口内不刷新
    input.value = '影视飓风';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(document.querySelectorAll('.bz-clip-item').length).toBe(2);
    // 防抖到期 → 过滤命中 1 条
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const items = [...document.querySelectorAll('.bz-clip-item')] as HTMLElement[];
    expect(items[0].textContent).toContain('影视飓风视频');
  });

  it('切换源清空搜索框与搜索词', async () => {
    await openDesktop();
    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    input.value = '果壳';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    // 切到剪藏本源 → 搜索清空
    const clipRow = [...document.querySelectorAll('.bz-clip-rail-row')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(M.sel.kind).toBe('clip'));
    expect(input.value).toBe('');
  });
});

describe('移动端长按抽屉（enh 包 2）', () => {
  it('renderMobList 每卡挂 attachItemActions（.bz-item-card），动作与桌面同源', async () => {
    await openDesktop();
    const cards = [...document.querySelectorAll('.bz-clip-mob-item')] as HTMLElement[];
    expect(cards.length).toBe(2);
    for (const card of cards) {
      expect(card.classList.contains('bz-item-card')).toBe(true);
    }
  });
});

describe('右栏读剪藏正文（enh 包 3）', () => {
  async function gotoClipArticle(): Promise<ReturnType<typeof boot>> {
    const ctx = await openDesktop();
    const clipRow = [...document.querySelectorAll('.bz-clip-rail-row')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    return ctx;
  }

  it('懒加载 cachedRead → 剥 frontmatter/dataviewjs → 段落渲染 + 打开笔记主按钮', async () => {
    await gotoClipArticle();
    const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
    const md = await vi.waitFor(() => {
      const el = reader.querySelector('[data-clip-md]') as HTMLElement;
      expect(el.textContent).toContain('剪藏正文第一段');
      return el;
    });
    // frontmatter 与 dataviewjs 摘要块不进正文
    expect(md.textContent).not.toContain('dataviewjs');
    expect(md.textContent).not.toContain('url:');
    expect(md.textContent).toContain('引用一句话');
    // 打开笔记主按钮（保留）
    const calls: string[] = [];
    (getApp() as any).workspace.openLinkText = async (p: string) => { calls.push(p); };
    (reader.querySelector('[data-clip-open-note]') as HTMLElement).click();
    await vi.waitFor(() => expect(calls).toEqual(['归档/网页剪藏/剪藏笔记A.md']));
    expect(M.open).toBe(false); // openNote 顺手收面板
  });

  it('按 path 缓存；invalidateClipBodyCache 后重读新内容', async () => {
    const { vault } = await gotoClipArticle();
    const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
    await vi.waitFor(() => expect((reader.querySelector('[data-clip-md]') as HTMLElement).textContent).toContain('剪藏正文第一段'));
    // 文件变更 + 缓存失效 → 重渲染读新内容
    vault.files.set('归档/网页剪藏/剪藏笔记A.md', CLIP_B);
    invalidateClipBodyCache('归档/网页剪藏/剪藏笔记A.md');
    reloadIfOpen();
    await vi.waitFor(() => expect((reader.querySelector('[data-clip-md]') as HTMLElement).textContent).toContain('剪藏正文第二段'));
  });
});

describe('rail 源行批量已读（enh 包 4）', () => {
  it('rail 行挂动作；「全部标为已读（N 篇）」确认框写明 N 篇，确认后批量落盘', async () => {
    const { vault } = await openDesktop();
    const allRow = [...document.querySelectorAll('.bz-clip-rail-row')].find((r) => r.textContent!.includes('全部未读')) as HTMLElement;
    expect(allRow.classList.contains('bz-item-card')).toBe(true);
    const menu = await openContextMenuOn(allRow);
    const btn = [...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('全部标为已读')) as HTMLElement;
    expect(btn.textContent).toContain('2 篇');
    btn.click();
    const popup = await vi.waitFor(() => {
      const el = document.querySelector('#__shared_confirm_popup__') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    expect(popup.textContent).toContain('「全部未读」');
    expect(popup.textContent).toContain('2 篇');
    (document.querySelector('#__shared_confirm_ok__') as HTMLElement).click();
    await drainNewsWritesForTests();
    await vi.waitFor(() => {
      const unread = diskJson(vault).articles.filter((a: any) => !a.read);
      expect(unread).toHaveLength(0);
    });
  });

  it('剪藏本源行不挂批量已读（无未读语义）', async () => {
    await openDesktop();
    const clipRow = [...document.querySelectorAll('.bz-clip-rail-row')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    // 无动作 → 不弹菜单
    await new Promise((r) => setTimeout(r, 60));
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });
});

describe('误标/误删可撤销（enh 包 5）', () => {
  it('标记已读后通知带撤销 → 点击恢复未读与正文，统计回退', async () => {
    const { vault } = await openDesktop();
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    const menu = await openContextMenuOn(item);
    const readBtn = [...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('标记为已读')) as HTMLElement;
    readBtn.click();
    await drainNewsWritesForTests();
    const noticeAction = await vi.waitFor(() => {
      const el = document.querySelector('.bz-notice-action') as HTMLElement;
      expect(el).toBeTruthy();
      expect(el.textContent).toBe('撤销');
      return el;
    });
    noticeAction.click();
    await drainNewsWritesForTests();
    await vi.waitFor(() => {
      const a = diskJson(vault).articles.find((x: any) => x.url === 'https://guokr.com/1');
      expect(a.read).toBeUndefined();
      expect(a.body).toBe('正文一 的内容段落。');
      expect(diskJson(vault).stats.totalRead).toBe(0);
    });
  });

  it('删除剪藏 → vault.trash 移入系统回收站（确认文案写明），撤销后原路径恢复', async () => {
    const { vault } = await openDesktop();
    const clipRow = [...document.querySelectorAll('.bz-clip-rail-row')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    const menu = await openContextMenuOn(item);
    const delBtn = [...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.trim() === '删除') as HTMLElement;
    delBtn.click();
    const popup = await vi.waitFor(() => {
      const el = document.querySelector('#__shared_confirm_popup__') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    expect(popup.textContent).toContain('系统回收站');
    (document.querySelector('#__shared_confirm_ok__') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(vault.trashed.some((t) => t.path === '归档/网页剪藏/剪藏笔记A.md' && t.system)).toBe(true);
      expect(vault.files.has('归档/网页剪藏/剪藏笔记A.md')).toBe(false);
    });
    // 通知撤销 → 原路径重建
    const noticeAction = await vi.waitFor(() => document.querySelector('.bz-notice-action') as HTMLElement);
    noticeAction.click();
    await vi.waitFor(() => {
      expect(vault.files.has('归档/网页剪藏/剪藏笔记A.md')).toBe(true);
      expect(vault.files.get('归档/网页剪藏/剪藏笔记A.md')).toContain('剪藏正文第一段');
    });
  });
});

describe('阅读动线（enh 包 6）', () => {
  it('右栏停留超阈值自动落「在读」（可手动覆盖：手动处理后不生效）', async () => {
    __autoReadingDelayForTests(30);
    const { vault } = await openDesktop();
    // M.cur = 列表第一条（未读果壳文章一）
    expect(M.cur!.id).toBe('url:https://guokr.com/1');
    await new Promise((r) => setTimeout(r, 130));
    await drainNewsWritesForTests();
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/clipbook.json')!);
    const ovs = Object.values(raw.articleOverrides) as Array<{ reading?: boolean }>;
    expect(ovs.some((o) => o && o.reading === true)).toBe(true);
  });

  it('标已读后前进到同位置下一篇', async () => {
    await openDesktop();
    expect(M.cur!.id).toBe('url:https://guokr.com/1');
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    const menu = await openContextMenuOn(item);
    const readBtn = [...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('标记为已读')) as HTMLElement;
    readBtn.click();
    await drainNewsWritesForTests();
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://bilibili.com/video/BV1'));
  });

  it('右栏聚焦 ←/→/j/k 切换条目', async () => {
    await openDesktop();
    const pane = document.querySelector('[data-clip-read-pane]') as HTMLElement;
    expect(pane).toBeTruthy();
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://bilibili.com/video/BV1'));
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://guokr.com/1'));
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://bilibili.com/video/BV1'));
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://guokr.com/1'));
  });
});

describe('阅读字号三档（enh 包 7）', () => {
  it('小/中/大分段切换 → 落设置 saveSettings + 正文 class 跟随', async () => {
    const { settings, saveSpy } = await openDesktop();
    const segBtns = [...document.querySelectorAll('[data-clip-fs] .bz-segmented-btn')] as HTMLElement[];
    expect(segBtns.map((b) => b.textContent)).toEqual(['小', '中', '大']);
    const body = document.querySelector('.bz-clip-read-body') as HTMLElement;
    // 默认中档
    expect(body.classList.contains('fs-sm')).toBe(false);
    expect(body.classList.contains('fs-lg')).toBe(false);
    // 切「大」
    (segBtns.find((b) => b.textContent === '大') as HTMLElement).click();
    expect(body.classList.contains('fs-lg')).toBe(true);
    expect(settings.clipbookReaderFontSize).toBe('large');
    // 切「小」
    (segBtns.find((b) => b.textContent === '小') as HTMLElement).click();
    expect(body.classList.contains('fs-sm')).toBe(true);
    expect(settings.clipbookReaderFontSize).toBe('small');
    await vi.waitFor(() => expect(saveSpy).toHaveBeenCalled());
  });

  it('记忆档位打开即生效（large → fs-lg）', async () => {
    await openDesktop({ clipbookReaderFontSize: 'large' });
    const body = document.querySelector('.bz-clip-read-body') as HTMLElement;
    expect(body.classList.contains('fs-lg')).toBe(true);
    expect(body.classList.contains('fs-sm')).toBe(false);
  });
});

describe('面板拖拽缩放 + 尺寸记忆（enh 包 8）', () => {
  it('有记忆值时打开即套用内联宽高（仅桌面）', async () => {
    await openDesktop({ clipbookPanelWidth: 900, clipbookPanelHeight: 640 });
    const frame = document.querySelector('.bz-clip-frame') as HTMLElement;
    expect(frame.style.width).toBe('900px');
    expect(frame.style.height).toBe('640px');
  });

  it('记忆值越界（超视口 92%）打开即钳制', async () => {
    await openDesktop({ clipbookPanelWidth: 5000, clipbookPanelHeight: 5000 });
    const frame = document.querySelector('.bz-clip-frame') as HTMLElement;
    // jsdom 视口 1024×768 → 92% = 942×706（与 todo 面板同口径）
    expect(frame.style.width).toBe('942px');
    expect(frame.style.height).toBe('706px');
  });

  it('0=未拖过 → 打开走默认（不写内联尺寸以外的值）', async () => {
    await openDesktop();
    const frame = document.querySelector('.bz-clip-frame') as HTMLElement;
    expect(frame.style.width).toBe('1180px');
    expect(frame.style.height).toBe('760px');
  });

  it('拖动右缘 → settings 记忆并经 150ms 防抖落盘', async () => {
    const { settings, saveSpy } = await openDesktop();
    const frame = document.querySelector('.bz-clip-frame') as HTMLElement;
    frame.getBoundingClientRect = () => ({ width: 1180, height: 760, left: 0, top: 0 } as DOMRect);
    frame.dispatchEvent(new MouseEvent('mousedown', { clientX: 1179, clientY: 300, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1300, clientY: 300, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 1300, clientY: 300, bubbles: true }));
    await vi.waitFor(() => expect(settings.clipbookPanelWidth).toBe(942)); // cap(min(1600, 1024*0.92))
    // uiResizable 每帧对宽高双向钳视口 92%：jsdom 高 768×0.92=706 < 当前 760 → 同步钳小
    expect(settings.clipbookPanelHeight).toBe(706);
    await vi.waitFor(() => expect(saveSpy).toHaveBeenCalled());
  });
});

describe('副题术语（enh 包 12）', () => {
  it('头行副题为「未读流与剪藏」，不再出现「聚合讯已接入」', async () => {
    await openDesktop();
    const overlay = document.querySelector('.bz-clip-overlay') as HTMLElement;
    expect(overlay.querySelector('.bz-clip-head-sub')!.textContent).toBe('未读流与剪藏');
    expect(overlay.textContent).not.toContain('聚合讯已接入');
  });
});
