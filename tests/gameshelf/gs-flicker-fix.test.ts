/**
 * 后台队列落地时主界面屏闪的回归钉（2026-11-01 用户反馈：游戏库后台下载封面时不断屏闪）。
 *
 * 三处成因，各有钉子：
 * 1) 整面板整刷（renderAll）会把工具行、门面、整片网格连同所有 img 元素一起换掉
 *    → 三条后台队列（封面/图标、中文名、商店回填）改走 repaintFn 原地重绘，
 *    卡片 / 工具行 / 门面底图节点必须原样存活；
 * 2) renderAll 链内的网格重填本该静默（gsInRenderAll 的语义），但标记在 body.innerHTML
 *    之前就被复位了——后台队列每次节流重渲都演一遍 user 波浪 → 现在整条链由 finally 罩住。
 *    jsdom 无 WAAPI，动效层落终态内联（opacity:1），所以「演过没有」看内联样式即可；
 * 3) 原地重绘做不到的场合（统计页 / 按名称排 / 搜索中）必须交回整刷——否则改名不动位置、
 *    搜索词命中的卡片消失不了，比闪一下严重得多。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeAllModals } from '../../src/core/ui/modal';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetGameshelfState, type GameItem } from '../../src/gameshelf/state';
import { closePanel, openPanel, renderAll, renderList } from '../../src/gameshelf/ui';
import { localCoverPath, unloadPosters } from '../../src/gameshelf/posters';

const CONFIG = { gameshelfFolderPath: '我的/游戏', gameshelfSteamId: '76561198366147295', gameshelfSteamApiKey: 'k'.repeat(32) };

function item(appid: number, name: string, playtimeMin: number, lastPlayed = ''): GameItem {
  return {
    file: null, appid, name, zhName: null, playtimeMin, lastPlayed,
    cover: `https://cdn/${appid}.jpg`, coverSrc: `https://cdn/${appid}.jpg`, icon: null, iconSrc: null,
    windowsMin: playtimeMin, deckMin: 0, macMin: 0, linuxMin: 0, hasAch: false, offShelf: false,
    syncedAt: '2026-09-17T05:35:19.664Z',
  };
}

/** vault 桩：本地媒体是否「已落盘」由 files 现查（媒体队列下完图就是这个变化） */
const files = new Map<string, { path: string }>();
const app: any = {
  vault: {
    getMarkdownFiles: () => [],
    getAbstractFileByPath: (p: string) => files.get(p) ?? null,
    getResourcePath: (f: { path: string }) => `app://vault/${f.path}`,
    createFolder: async () => {},
  },
  metadataCache: { getFileCache: () => (fmOf ? { frontmatter: fmOf } : null) },
};
/** metadataCache 里那款游戏的属性（回填用例按需换） */
let fmOf: Record<string, unknown> | null = null;

const cards = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.bz-gs-card')];

beforeEach(() => {
  document.body.innerHTML = '';
  files.clear();
  fmOf = null;
  resetGameshelfState();
  resetObsidianMocks();
  setApp(app);
  setSettingsProvider(() => CONFIG as any);
});

afterEach(() => {
  closeAllModals();
  closePanel();
  unloadPosters();
});

/** 面板 + 两款（AAA 有游玩日期 → 缺省「最近玩」档下的列表首位） */
function openWithTwo(): void {
  openPanel(app); // M.items 空开面板：两条后台队列无事可做，不掺和本组断言
  M.items = [item(1, 'AAA', 600, '2026-08-01'), item(2, 'BBB', 60)];
  renderAll(app);
}

describe('媒体下完图：原地换图，不重建面板', () => {
  it('封面本地化后只换那张 img 的 src，卡片与工具行节点原样存活', () => {
    openWithTwo();
    const card = document.querySelector('.bz-gs-card[data-appid="1"]') as HTMLElement;
    const img = card.querySelector('.bz-gs-cover img') as HTMLImageElement;
    const tools = document.querySelector('.bz-gs-tools');
    const art = document.querySelector('.bz-gs-hero-art') as HTMLElement;
    const local = localCoverPath(1);
    expect(img.getAttribute('src')).toBe('https://cdn/1.jpg'); // 本地还没有 → 远端兜底
    expect(art.dataset.coverUrl).toBe('https://cdn/1.jpg');

    // 模拟 posters.runQueue 的收尾：文件落盘 + 内存条目改指本地 → 叫一声重绘钩子
    files.set(local, { path: local });
    M.items[0].cover = local;
    M.repaintFn?.();

    expect(document.querySelector('.bz-gs-card[data-appid="1"]')).toBe(card); // 没被重建
    expect(document.querySelector('.bz-gs-tools')).toBe(tools);
    expect(img.getAttribute('src')).toBe(`app://vault/${local}`);
    // 门面底图同步换（静息态快照也跟上：悬浮换脸复原时不回旧图）
    expect(art.dataset.coverUrl).toBe(`app://vault/${local}`);
    expect(art.style.backgroundImage).toContain(`app://vault/${local}`);
  });

  it('地址没变 → 原样不动；封面换地址后兜底链重新起算', () => {
    openWithTwo();
    const img = document.querySelector('.bz-gs-card[data-appid="1"] .bz-gs-cover img') as HTMLImageElement;
    M.repaintFn?.(); // 无变化
    expect(img.getAttribute('src')).toBe('https://cdn/1.jpg');

    img.dataset.fbDone = '1'; // 上一轮兜底已用掉
    const card = document.querySelector('.bz-gs-card[data-appid="1"]') as HTMLElement;
    card.querySelector('.bz-gs-cover')!.classList.add('is-broken');
    const local = localCoverPath(1);
    files.set(local, { path: local });
    M.items[0].cover = local;
    M.repaintFn?.();
    expect(img.dataset.fbDone).toBeUndefined(); // 新图重新给一次兜底机会
    expect(card.querySelector('.bz-gs-cover')!.classList.contains('is-broken')).toBe(false);
  });

  it('原地钩子与整刷钩子各走各的：面板关了就置空', () => {
    openWithTwo();
    expect(typeof M.repaintFn).toBe('function');
    expect(typeof M.renderFn).toBe('function');
    closePanel();
    expect(M.repaintFn).toBeNull();
    expect(() => M.renderFn?.()).not.toThrow();
  });
});

describe('中文名 / 成就回填也原地重绘（同样不重建网格）', () => {
  it('中文名落地：只改卡名与原名副行，卡片节点存活', () => {
    openWithTwo();
    const card = document.querySelector('.bz-gs-card[data-appid="1"]') as HTMLElement;
    M.items[0].zhName = '甲游戏';
    expect(M.repaintFn?.({ order: true })).toBe(true);
    expect(document.querySelector('.bz-gs-card[data-appid="1"]')).toBe(card); // 没被重建
    expect(card.querySelector('.bz-gs-name')!.textContent).toBe('甲游戏');
    expect(card.querySelector('.bz-gs-orig')!.textContent).toBe('AAA'); // 原名退居副行
    expect(card.querySelector('.bz-gs-cover')!.getAttribute('data-initial')).toBe('甲');
  });

  it('成就回填：条是新挂上去的节点，宽度 = 已解/总数', () => {
    openWithTwo();
    M.items[0].file = { path: '我的/游戏/《AAA》.md' } as never;
    const card = document.querySelector('.bz-gs-card[data-appid="1"]') as HTMLElement;
    expect(card.querySelector('.bz-gs-strip')).toBeNull(); // 回填前：无成就页 → 不画条

    fmOf = { 成就总数: 10, 成就已解: 4 };
    M.items[0].hasAch = true;
    expect(M.repaintFn?.({ order: true })).toBe(true);
    const strip = card.querySelector('.bz-gs-strip') as HTMLElement;
    expect(strip).not.toBeNull();
    expect(strip.querySelector('i')!.getAttribute('style')).toContain('40%');
    expect(card.querySelector('.bz-gs-trophy')).toBeNull(); // 没满就不挂奖杯
  });
});

describe('原地重绘做不到的场合，交回整刷', () => {
  it('按名称排 / 搜索中：改名可能换位或让卡片消失，不能只改字面', () => {
    openWithTwo();
    M.sort = 'name';
    expect(M.repaintFn?.({ order: true })).toBe(false);
    M.sort = 'last';
    M.query = '甲';
    expect(M.repaintFn?.({ order: true })).toBe(false);
    M.query = '';
    expect(M.repaintFn?.({ order: true })).toBe(true);
  });

  it('统计页：数字是整页算的，原地改不出来', () => {
    openWithTwo();
    M.view = 'stats';
    renderAll(app);
    expect(M.repaintFn?.()).toBe(false);
    M.view = 'shelf';
  });
});

describe('整刷链内不重播卡带波浪（gsInRenderAll 罩住整条链）', () => {
  it('renderAll 重填的卡片零入场内联；用户触发的 renderList 照常演', () => {
    openWithTwo();
    // 开机首渲演过一次；下面每次 renderAll 都是新节点，从「有没有内联终态」就能看出演没演
    cards().forEach((c) => expect(c.style.opacity).toBe(''));
    renderAll(app); // 后台队列节流重渲口径
    cards().forEach((c) => expect(c.style.opacity).toBe(''));

    renderList(app); // 用户点筛选/排序/搜索走这条 —— 波照演
    expect(cards()[0].style.opacity).toBe('1');
  });
});
