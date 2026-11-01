/**
 * 下图期间主界面屏闪的回归钉（2026-11-01 用户反馈：游戏库后台下载封面时主界面不断屏闪）。
 *
 * 两处成因，各钉一条：
 * 1) 媒体队列下完一批图就走一遍整面板整刷（renderAll），把工具行、门面、整片网格连同
 *    所有 img 元素一起换掉 →改走 mediaRepaintFn 原地换图，卡片/工具行节点必须原样存活；
 * 2) renderAll 链内的网格重填本该静默（gsInRenderAll 的语义），但标记在 body.innerHTML
 *    之前就被复位了——后台队列每次节流重渲都演一遍 user 波浪 → 现在整条链由 finally 罩住。
 *    jsdom 无 WAAPI，动效层落终态内联（opacity:1），所以「演过没有」看内联样式即可。
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
  metadataCache: { getFileCache: () => null },
};

const cards = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.bz-gs-card')];

beforeEach(() => {
  document.body.innerHTML = '';
  files.clear();
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
    M.mediaRepaintFn?.();

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
    M.mediaRepaintFn?.(); // 无变化
    expect(img.getAttribute('src')).toBe('https://cdn/1.jpg');

    img.dataset.fbDone = '1'; // 上一轮兜底已用掉
    const card = document.querySelector('.bz-gs-card[data-appid="1"]') as HTMLElement;
    card.querySelector('.bz-gs-cover')!.classList.add('is-broken');
    const local = localCoverPath(1);
    files.set(local, { path: local });
    M.items[0].cover = local;
    M.mediaRepaintFn?.();
    expect(img.dataset.fbDone).toBeUndefined(); // 新图重新给一次兜底机会
    expect(card.querySelector('.bz-gs-cover')!.classList.contains('is-broken')).toBe(false);
  });

  it('媒体钩子与整刷钩子各走各的：面板关了就置空', () => {
    openWithTwo();
    expect(typeof M.mediaRepaintFn).toBe('function');
    expect(typeof M.renderFn).toBe('function');
    closePanel();
    expect(M.mediaRepaintFn).toBeNull();
    expect(() => M.renderFn?.()).not.toThrow();
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
