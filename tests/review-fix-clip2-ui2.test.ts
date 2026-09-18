// @vitest-environment jsdom
/**
 * 剪藏本域 UI 收尾修复批回归（review-clipbook-bugs.md C11 / C16 / C17 / C18 / C19 / C20 / C21 / C22 / C29 / C32）：
 * - C11：skipped→saved 升级路径不再重复计 byPlatform/byDate（只推进已收桶）；
 * - C16：移动端折叠记忆（expandedMobArch）随 beginSession 复位——每次打开面板 = 新会话，
 *   详情往返（不经 beginSession）仍不丢；
 * - C17：静默「打开即已读」落盘后回写 M.stats 镜像 → rail 脚注「今日已读」即时刷新；
 * - C18：clipping:file-renamed 按载荷 oldPath 一并失效正文缓存；移出剪藏目录的改名也触发重载；
 * - C19：ESC 第一层收移动详情返回列表，第二层才关面板；
 * - C20：详情开着且当前条目被删（M.cur=null）时 renderAll 收起详情 overlay；
 * - C21：死代码清理——dotHtml/M.isMobile 删除；.bz-clip-favchip/.bz-clip-art-flag/stateFlag
 *   因既有测试引用面保留；
 * - C22：src/clipbook/prototype-render.js 陈旧孤本删除（评审壳消费 prototypes/ 那份）；
 * - C29：flowToggleReading 删除（articleOverrides 无生产写入方）；
 * - C32：flowMarkRead 仅 changed 时发 news:read；doMarkRead 撤销快照按磁盘现态重取
 *   （不被「打开即已读」的同步内存位污染）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { MockVault, mockAppWithVault } from './mock-vault';
import { setApp, getApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { emitDomainEvent, onDomainEvent } from '../src/core/domain-bus';
import { openClipbook, unloadClipbook } from '../src/clipbook';
import { closePanel, showPanel, __clipBodyCacheKeysForTests } from '../src/clipbook/ui';
import { M } from '../src/clipbook/state';
import { getNewsFilePath } from '../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../src/clipbook/write-queue';
import { localDayKey } from '../src/clipbook/constants';
import { flowSave, flowMarkRead } from '../src/clipbook/flow';
import { setClipDir } from './clipbook/helpers';

// flowSave B 站分流分支动态 import 文献盒 → 打桩，避免拉起其 UI 依赖
vi.mock('../src/knowledge', () => ({ openKnowledgeAddTask: vi.fn() }));

/** news.json 种子（lastFetchAt 拦 openClipbook 自动抓取，同 enhance.test.ts 口径） */
function seedNews(articles: any[], stats?: any): string {
  return JSON.stringify({
    articles,
    stats: stats || { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
    lastFetchAt: Date.now(),
  });
}

const diskNews = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

async function boot(vault: MockVault): Promise<void> {
  try { unloadClipbook(); } catch { /* 幂等 */ }
  resetObsidianMocks();
  document.body.innerHTML = '';
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  setClipDir('归档/网页剪藏');
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
}

function railRow(label: string): HTMLElement {
  return [...document.querySelectorAll('.bz-rail-item')].find((r) => r.getAttribute('title') === label) as HTMLElement;
}

async function contextMenuOn(target: HTMLElement): Promise<HTMLElement> {
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  return await vi.waitFor(() => {
    const el = document.querySelector('.bz-item-menu') as HTMLElement | null;
    expect(el, '右键菜单应弹出').toBeTruthy();
    return el!;
  });
}

const menuItem = (menu: HTMLElement, label: string) =>
  [...menu.querySelectorAll('.bz-item-menu-item')].find((b) => (b.textContent || '').includes(label)) as HTMLElement;

beforeEach(() => {
  try { unloadClipbook(); } catch { /* 幂等 */ }
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  try { closePanel(); } catch { /* 幂等 */ }
  try { unloadClipbook(); } catch { /* 幂等 */ }
});

// ================= C11 =================

describe('C11：skipped→saved 升级路径不重复计分布', () => {
  it('已读未收（read=true state=skipped）再保存：只推进已收桶，byPlatform/byDate/totalRead 不重复计', async () => {
    const today = localDayKey();
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews(
      [{ platform: '果壳科学人', title: '已读未收文', url: 'https://guokr.com/c11', author: '果壳', body: '正文', date: '2026-09-01 08:00:00', read: true, state: 'skipped' }],
      { totalRead: 1, totalSaved: 0, totalSkipped: 1, byPlatform: { 果壳科学人: 1 }, byDate: { [today]: 1 } },
    ));
    setApp(mockAppWithVault(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));

    const ok = await flowSave({ raw: diskNews(vault).articles[0] });
    expect(ok).toBe(true);
    await drainNewsWritesForTests();
    const disk = diskNews(vault);
    expect(disk.articles[0].state).toBe('saved');
    expect(disk.stats.totalSaved).toBe(1);         // 升级计入已收
    expect(disk.stats.totalRead).toBe(1);          // 修复前 +1 → 2（已读重复计）
    expect(disk.stats.totalSkipped).toBe(1);
    expect(disk.stats.byPlatform['果壳科学人']).toBe(1); // 修复前 +1 → 2（平台分布重复计）
    expect(disk.stats.byDate[today]).toBe(1);      // 修复前 +1 → 2（rail 脚注「今日已读」一篇计两次）
  });
});

// ================= C16 =================

describe('C16：移动端折叠记忆随会话复位', () => {
  it('展开「已读」段 → 详情往返仍展开；关面板重开 → 复位为收起', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '已读甲', url: 'https://guokr.com/c16', date: '2026-09-01 08:00:00', body: '正文甲', read: true, state: 'skipped' },
    ]));
    await boot(vault);
    await vi.waitFor(() => expect(M.articles.length).toBe(1));

    const foldOf = () => document.querySelector('[data-clip-mob-list] [data-fold-kind="read"]') as HTMLElement;
    await vi.waitFor(() => expect(foldOf()).toBeTruthy());
    expect(foldOf().getAttribute('aria-expanded')).toBe('false');
    foldOf().click();
    await vi.waitFor(() => expect(foldOf().getAttribute('aria-expanded')).toBe('true'));

    // 详情往返（不经过 beginSession）→ 展开态保留
    (document.querySelector('[data-clip-mob-list] .bz-clip-mob-item') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    (document.querySelector('[data-clip-mob-back]') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(false));
    expect(foldOf().getAttribute('aria-expanded')).toBe('true');

    // 关面板 → 重开 = 新会话：折叠记忆复位（修复前只随插件卸载清，重开仍停在上次展开的段）
    closePanel();
    showPanel();
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(foldOf()).toBeTruthy());
    expect(foldOf().getAttribute('aria-expanded')).toBe('false');
  });
});

// ================= C17 =================

describe('C17：静默打开即读后 rail 脚注刷新', () => {
  it('点开未读条目（打开即已读落盘）→ 「今日已读」脚注即时 +1', async () => {
    const today = localDayKey();
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '未读甲', url: 'https://guokr.com/c17', date: '2026-09-01 08:00:00', body: '正文甲' },
    ]));
    await boot(vault);
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    const foot = document.querySelector('[data-clip-rail-foot]') as HTMLElement;
    expect(foot.querySelector('b')!.textContent).toBe('0');

    (document.querySelector('.bz-clip-list .bz-clip-item') as HTMLElement).click();
    // 修复前：markHandledAndBump 只落盘不回写 M.stats → 脚注停留 0（下次装载才追上）
    await vi.waitFor(() => expect(foot.querySelector('b')!.textContent).toBe('1'));
    await drainNewsWritesForTests();
    expect(diskNews(vault).stats.byDate[today]).toBe(1);
  });
});

// ================= C18 =================

describe('C18：clipping:file-renamed 按 oldPath 失效正文缓存并重载', () => {
  const FM = '---\nurl: "https://a.com/c18"\ncreated: 2026-08-20 10:00:00\n---\n';
  const cacheKeys = () => __clipBodyCacheKeysForTests();

  it('改名移出再移回原名：旧路径缓存已失效，回读磁盘新正文（不残留陈旧正文）', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([]));
    vault.files.set('归档/网页剪藏/甲.md', FM + '版本一正文');
    await boot(vault);
    await vi.waitFor(() => expect((M.clipNotes || []).length).toBe(1));

    railRow('剪藏本').click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const mdText = () => {
      const el = document.querySelector('[data-clip-reader] [data-clip-md]') as HTMLElement | null;
      return el ? el.textContent || '' : '';
    };
    await vi.waitFor(() => expect(mdText()).toContain('版本一正文')); // 缓存写入（key=甲.md）

    // 改名甲 → 乙（原文内容同步换新版）：旧键必须被失效（缓存键 = 旧 path；只失效 newPath 等于没失效）
    vault.files.delete('归档/网页剪藏/甲.md');
    vault.files.set('归档/网页剪藏/乙.md', FM + '版本二正文');
    emitDomainEvent('clipping:file-renamed', { oldPath: '归档/网页剪藏/甲.md', newPath: '归档/网页剪藏/乙.md', movedOut: false });
    // 等重载落定（cur 换到新路径条目 = 重载已渲染）→ 缓存换键
    await vi.waitFor(() => expect(M.cur && M.cur.id).toContain('乙.md'), { timeout: 3000 });
    await vi.waitFor(() => expect(cacheKeys()).toContain('归档/网页剪藏/乙.md'), { timeout: 3000 });
    expect(cacheKeys()).not.toContain('归档/网页剪藏/甲.md'); // 修复前旧键常驻
    await vi.waitFor(() => expect(mdText()).toContain('版本二正文'));

    // 改名乙 → 甲（同内容）：修复前旧键（甲.md=版本一正文）未被失效 → 读回陈旧正文
    vault.files.delete('归档/网页剪藏/乙.md');
    vault.files.set('归档/网页剪藏/甲.md', FM + '版本二正文');
    emitDomainEvent('clipping:file-renamed', { oldPath: '归档/网页剪藏/乙.md', newPath: '归档/网页剪藏/甲.md', movedOut: false });
    // 等重载落定（cur 回到甲路径）再断言正文——修复前此刻读的是陈旧缓存「版本一正文」
    await vi.waitFor(() => expect(M.cur && M.cur.id).toContain('甲.md'), { timeout: 3000 });
    await vi.waitFor(() => expect(mdText()).toContain('版本二正文'), { timeout: 3000 });
    expect(mdText()).not.toContain('版本一正文');
  });

  it('改名移出剪藏目录：旧路径命中即重载，面板不残留幽灵条目', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([]));
    vault.files.set('归档/网页剪藏/丙.md', FM + '正文');
    await boot(vault);
    await vi.waitFor(() => expect((M.clipNotes || []).length).toBe(1));

    railRow('剪藏本').click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));

    vault.files.delete('归档/网页剪藏/丙.md');
    vault.files.set('归档/其它/丙.md', FM + '正文');
    emitDomainEvent('clipping:file-renamed', { oldPath: '归档/网页剪藏/丙.md', newPath: '归档/其它/丙.md', movedOut: true });
    // 修复前：newPath 不在剪藏目录 → schedule 提前 return，面板留着已不存在的条目
    await vi.waitFor(() => expect((M.clipNotes || []).length).toBe(0), { timeout: 3000 });
    expect(document.querySelectorAll('.bz-clip-item').length).toBe(0);
    expect(cacheKeys()).not.toContain('归档/网页剪藏/丙.md');
  });
});

// ================= C19 =================

describe('C19：ESC 先收移动详情返回列表', () => {
  it('详情屏按 ESC → 回列表（面板仍开）；再按一次 → 关面板', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '果壳甲', url: 'https://guokr.com/c19', date: '2026-09-01 08:00:00', body: '正文甲' },
    ]));
    await boot(vault);
    await vi.waitFor(() => expect(M.articles.length).toBe(1));

    (document.querySelector('[data-clip-mob-list] .bz-clip-mob-item') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    const detail = document.querySelector('[data-clip-mob-detail]') as HTMLElement;
    expect(detail.style.display).toBe('flex');
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // 修复前：单层直关整个面板（详情屏无「先返回」层级）
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(false));
    expect(M.open).toBe(true);
    expect(overlay.style.display).toBe('flex');
    expect(detail.style.display).toBe('none');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await vi.waitFor(() => expect(M.open).toBe(false));
    expect(overlay.style.display).toBe('none');
  });
});

// ================= C20 =================

describe('C20：当前条目被删且列表清空时收起详情', () => {
  it('详情开着删掉唯一条目 → 详情 overlay 收起（不留已删文章的详情屏）', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '待删甲', url: 'https://guokr.com/c20', date: '2026-09-01 08:00:00', body: '正文甲' },
    ]));
    await boot(vault);
    await vi.waitFor(() => expect(M.articles.length).toBe(1));

    (document.querySelector('[data-clip-mob-list] .bz-clip-mob-item') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));

    // 桌面目录右键删除该唯一条目 → refreshAfterAction：盘面清空 → M.cur=null → renderAll
    // 翻转（效率整改 5 免确认口径）：删除不再弹 openFlowDialog 确认框，直落 + notifyUndo
    const menu = await contextMenuOn(document.querySelector('.bz-clip-list .bz-clip-item') as HTMLElement);
    menuItem(menu, '删除').click();

    await vi.waitFor(() => expect(M.cur).toBeNull());
    // 修复前：M.mobDetailOpen 仍 true、overlay 仍 flex，残留已删文章详情屏
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(false));
    expect((document.querySelector('[data-clip-mob-detail]') as HTMLElement).style.display).toBe('none');
  });
});

// ================= C32 =================

describe('C32：重复标读不重复喂行为流；撤销快照按磁盘现态', () => {
  it('同一篇两次 flowMarkRead（第二跳盘面已读）→ 只发一条 news:read', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '甲', url: 'https://guokr.com/c32a', date: '2026-09-01 08:00:00', body: '正文甲' },
    ]));
    setApp(mockAppWithVault(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
    const evts: any[] = [];
    const off = onDomainEvent('news', (e: any) => evts.push(e));
    try {
      await flowMarkRead({ raw: diskNews(vault).articles[0] });   // 首跳（打开即已读）
      await drainNewsWritesForTests();
      await flowMarkRead({ raw: diskNews(vault).articles[0] });   // 第二跳（落盘窗口内手动标读）
      await drainNewsWritesForTests();
    } finally {
      off();
    }
    expect(evts.filter((e) => e && e.kind === 'read')).toHaveLength(1); // 修复前第二跳重复喂
    expect(diskNews(vault).stats.totalRead).toBe(1);
  });

  it('内存 raw.read 被「打开即已读」同步位污染的窗口内手动标读：撤销按磁盘快照恢复未读', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '未读甲', url: 'https://guokr.com/c32b', date: '2026-09-01 08:00:00', body: '正文甲' },
    ]));
    setApp(mockAppWithVault(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
    setClipDir('归档/网页剪藏');
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(document.querySelector('.bz-clip-item')).toBeTruthy());

    // 复刻「打开即已读」的同步内存位（未落盘；等价于落盘窗口内）——卡面快照仍为未读
    M.articles[0].read = true;

    const menu = await contextMenuOn(document.querySelector('.bz-clip-item') as HTMLElement);
    const readBtn = menuItem(menu, '标记为已读');
    expect(readBtn, '守卫通过（卡面快照未读）→ 菜单应挂标读项').toBeTruthy();
    readBtn.click();
    // 动作链里有「读盘取撤销快照 → 入队写盘」两步异步：等盘面落定再断言（drain 早于入队会空跑）
    await vi.waitFor(() => expect(diskNews(vault).articles[0].read).toBe(true));
    await drainNewsWritesForTests();

    const undo = await vi.waitFor(() => {
      const el = [...document.querySelectorAll('.bz-notice-action')].find((x) => x.textContent === '撤销') as HTMLElement | undefined;
      expect(el, '撤销按钮应在').toBeTruthy();
      return el!;
    });
    undo.click();
    await drainNewsWritesForTests();
    // 修复前：rawBefore 取被污染的内存 raw（read=true）→ 撤销「恢复未读」实际仍已读
    await vi.waitFor(() => {
      const disk = diskNews(vault);
      expect(disk.articles[0].read).toBeUndefined();
      expect(disk.stats.totalRead).toBe(0);
    });
  });
});

// ================= C21 / C22 / C29（结构守卫） =================

describe('C21/C22/C29：死代码/孤本清理落地', () => {
  const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

  it('孤本 src/clipbook/prototype-render.js 已删；dotHtml/isMobile/flowToggleReading 不再出现', () => {
    // C22：陈旧孤本（评审壳消费 prototypes/clipbook/ 那份，由 build-preview 重出）
    expect(existsSync(resolve(process.cwd(), 'src/clipbook/prototype-render.js'))).toBe(false);
    // C21：零调用方死代码
    expect(repo('src/clipbook/render.ts')).not.toContain('dotHtml');
    expect(repo('src/clipbook/state.ts')).not.toContain('isMobile');
    // C29：在读切换动线退役（articleOverrides 无生产写入方）
    expect(repo('src/clipbook/flow.ts')).not.toContain('flowToggleReading');
  });

  it('保留项（存在既有测试引用面）：.bz-clip-favchip / .bz-clip-art-flag / stateFlag 不动', () => {
    // enh-sweep-c（favchip.sm 8px 例外）与 walkthrough-fix-c（art-flag color-mix 档）断言引用
    const css = repo('src/clipbook/styles.css');
    expect(css).toContain('.bz-clip-favchip');
    expect(css).toContain('.bz-clip-art-flag');
    const render = repo('src/clipbook/render.ts');
    expect(render).toContain('stateFlag');
    expect(render).toContain('stateLabel');
  });
});
