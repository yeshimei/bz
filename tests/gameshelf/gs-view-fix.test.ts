/**
 * 游戏库 UI 渲染与交互修复批回归（批 B bz-fix-gs-view）：
 * G1 后台重渲软通道（renderSoft 两层：打字/下拉菜单顺延 + 搜索框焦点快照落回）、
 * 搜索 180ms 防抖 / ESC 二段清词 / 尾部 ✕、三控件值互译（G5）、openDetail 收悬浮预览（G6）、
 * 转义单源收编（esc/escAttr/escCssUrl + stripTitleMarks + firstChar 码点）、
 * modalRepaintFn 生命周期、bindMediaFallback 全链路、mountOps 热区与 syncing 禁用、
 * openExternalUrl 收口、手动同步双刷收口、closePanel 清理清单（statusMsg 等）、
 * G3 门面不塌（heroz min-height）。
 *
 * 说明：本文件整体 vi.mock 掉 ./sync（runSync/autoSyncOnOpen/readSteamConfig）——
 * 只隔离同步编排层的网络面；详情数据链走真 detail.ts + requestUrl mock。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { requestUrl } from 'obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeAllModals } from '../../src/core/ui/modal';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetGameshelfState, type GameItem } from '../../src/gameshelf/state';
import { bindShotReel, closePanel, heroHtml, renderAll, renderList, shelfHtml } from '../../src/gameshelf/ui';
import { buildReport } from '../../src/gameshelf/report';
import { openGameshelf, unloadGameshelf } from '../../src/gameshelf/index';
import { rebuildItems } from '../../src/gameshelf/notes';
import { runSync } from '../../src/gameshelf/sync';
import { storeUrlOf } from '../../src/gameshelf/detail';

// sync 编排层整模块隔离：afterOpen 的自动同步静默、runSync 可按用例改写实现。
// readSteamConfig 给真配置 → 详情加载链走真 detail.ts + requestUrl mock。
vi.mock('../../src/gameshelf/sync', () => ({
  AUTO_SYNC_INTERVAL_MS: 30 * 60 * 1000,
  lastSyncedAt: () => 0,
  isSyncDue: () => true,
  readSteamConfig: () => ({ steamId: '76561198366147295', apiKey: 'k'.repeat(32) }),
  runSync: vi.fn(async () => ({ ok: true, added: 0, updated: 0, offShelf: 0 })),
  autoSyncOnOpen: vi.fn(async () => {}),
}));

const CONFIG = { gameshelfSteamId: '76561198366147295', gameshelfSteamApiKey: 'k'.repeat(32) };

function item(appid: number, name: string, playtimeMin: number, lastPlayed = '', offShelf = false, hasAch = false, zhName: string | null = null): GameItem {
  return {
    file: null, appid, name, zhName, playtimeMin, lastPlayed,
    cover: `https://cdn/${appid}.jpg`, coverSrc: `https://cdn/${appid}.jpg`, icon: null, iconSrc: null,
    windowsMin: playtimeMin, deckMin: 0, macMin: 0, linuxMin: 0, hasAch, offShelf, syncedAt: '2026-09-17T05:35:19.664Z',
  };
}

/** 测试基座 app：vault 空库 + metadataCache 认 file.__fm（队列/详情测试同款 fake 口径） */
function mkApp(vaultFiles: unknown[] = []): any {
  return {
    vault: { getMarkdownFiles: () => vaultFiles, getAbstractFileByPath: () => null, createFolder: async () => {} },
    metadataCache: { getFileCache: (f: any) => (f?.__fm ? { frontmatter: f.__fm } : null) },
  };
}

/** 搜索框 / 两个下拉（工具行常驻查询器） */
const searchInput = (): HTMLInputElement => document.querySelector('.bz-gs-search input') as HTMLInputElement;
const bucketSelectEl = (): HTMLElement => document.querySelector('#bz-gs-bucketsel .bz-select') as HTMLElement;
const sortSelectEl = (): HTMLElement => document.querySelector('#bz-gs-sortsel .bz-select') as HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  resetGameshelfState();
  resetObsidianMocks();
  setApp(mkApp());
  setSettingsProvider(() => CONFIG as any);
});

afterEach(() => {
  closeAllModals();
  unloadGameshelf();
  vi.useRealTimers();
});

/** 常规打开：面板 + 两个条目（AAA 时长第一，BBB 带 frontmatter 可供悬浮/详情用） */
function openWithTwo(app: any): void {
  openGameshelf(app);
  M.items = [item(1, 'AAA', 6000), item(2, 'BBB', 600)];
  renderAll(app);
}

describe('G1 后台重渲软通道（renderSoft：打字顺延 + 焦点落回）', () => {
  it('打字心跳内后台重渲顺延：输入框同一节点、焦点不丢；手停 400ms 补刷后焦点与词原样落回', () => {
    vi.useFakeTimers();
    const app = mkApp();
    openWithTwo(app);
    const input = searchInput();
    input.focus();
    input.value = '深岩';
    input.dispatchEvent(new Event('input', { bubbles: true })); // 心跳 + 搜索防抖挂起
    M.renderFn?.(); // 队列节流重渲口径（names/backfill/posters/sync 现统一接 renderSoft）
    // 静默期内：不整刷——输入框同一节点、焦点还在、词还在
    expect(M.renderFn).not.toBeNull();
    expect(searchInput()).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('深岩');
    // 手停补刷：整刷发生，但焦点守护把搜索框原样落回
    vi.advanceTimersByTime(400);
    const input2 = searchInput();
    expect(input2).not.toBe(input); // 补刷照常发生（工具行换血）
    expect(document.activeElement).toBe(input2); // 焦点落回新框
    expect(input2.value).toBe('深岩'); // 防抖前的词不丢
  });

  it('无打字心跳时后台重渲立即整刷（不延迟）——M.renderFn 确已接线 renderSoft', () => {
    const app = mkApp();
    openWithTwo(app);
    const input = searchInput();
    M.renderFn?.();
    expect(searchInput()).not.toBe(input); // 立即重渲，无 400ms 顺延
  });

  it('移动端下拉菜单开着：后台重渲顺延、菜单存活；补刷窗口过后照常收口', () => {
    vi.useFakeTimers();
    const app = mkApp();
    openWithTwo(app);
    const sel = bucketSelectEl();
    sel.click(); // 开菜单（jsdom 下 open 的量宽兜底全走 0 值，不炸）
    expect(sel.querySelector('.bz-select-menu')).toBeTruthy();
    M.renderFn?.();
    // 顺延：菜单没被整刷吃掉（disposeSelects 未跑）
    expect(sel.isConnected).toBe(true);
    expect(sel.querySelector('.bz-select-menu')).toBeTruthy();
    // 补刷窗口过后：整刷发生，旧下拉连菜单一起收口
    vi.advanceTimersByTime(400);
    expect(sel.isConnected).toBe(false);
    expect(document.querySelector('.bz-select.open')).toBeNull();
  });

  it('关面板收口：renderFn 置空、顺延定时器与搜索防抖一并作废（推进时钟不炸）', () => {
    vi.useFakeTimers();
    const app = mkApp();
    openWithTwo(app);
    const input = searchInput();
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    M.renderFn?.(); // 顺延定时器挂起
    closePanel();
    expect(M.renderFn).toBeNull();
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });
});

describe('搜索：180ms 防抖 / ESC 二段清词 / 尾部 ✕', () => {
  it('防抖：每键不全网格重建，停手 180ms 后才重填', () => {
    vi.useFakeTimers();
    const app = mkApp();
    openWithTwo(app);
    expect(document.querySelectorAll('.bz-gs-card').length).toBe(2);
    const input = searchInput();
    input.focus();
    input.value = 'ZZZ'; // 无命中词
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll('.bz-gs-card').length).toBe(2); // 未重填（旧行为：每键即刷）
    vi.advanceTimersByTime(130); // 累计 180ms
    expect(document.querySelectorAll('.bz-gs-card').length).toBe(0); // 空态出现
    expect(M.query).toBe('ZZZ');
  });

  it('ESC 二段：有词只清词不关面板、焦点回框；无词放行（escManager 关面板）', () => {
    const app = mkApp();
    openWithTwo(app);
    const input = searchInput();
    input.focus();
    input.value = 'AAA';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // 第一段：只清词
    expect(input.value).toBe('');
    expect(M.query).toBe('');
    expect(M.currentOverlay).not.toBeNull(); // 面板还开着
    expect(document.activeElement).toBe(input);
    // 第二段（无词）：放行给 escManager → 关面板
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(M.currentOverlay).toBeNull();
  });

  it('✕ 一键清除：有词才显示，点 = 清词 + 刷新 + 焦点回框；「清除筛选」同 步复位 ✕', () => {
    const app = mkApp();
    openWithTwo(app);
    const clearBtn = (): HTMLButtonElement => document.querySelector('.bz-gs-search-clear') as HTMLButtonElement;
    expect(clearBtn().hidden).toBe(true); // 无词不显
    const input = searchInput();
    input.focus();
    input.value = 'AAA';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(clearBtn().hidden).toBe(false);
    clearBtn().click();
    expect(input.value).toBe('');
    expect(M.query).toBe('');
    expect(document.activeElement).toBe(input);
    expect(clearBtn().hidden).toBe(true);
    expect(document.querySelectorAll('.bz-gs-card').length).toBe(2);
  });

  it('空态「清除筛选」：词 + 输入框 + chips + 下拉 + ✕ 全部复位', () => {
    const app = mkApp();
    openWithTwo(app);
    M.query = 'ZZZ';
    M.bucket = 'idle';
    renderList(app);
    expect(document.querySelector('#bz-gs-clear-filter')).toBeTruthy();
    (document.querySelector('#bz-gs-clear-filter') as HTMLElement).click();
    expect(M.query).toBe('');
    expect(searchInput().value).toBe('');
    expect(M.bucket).toBe('all');
    expect(bucketSelectEl().querySelector('.bz-select-val')!.textContent).toContain('全部');
    expect((document.querySelector('.bz-gs-search-clear') as HTMLButtonElement).hidden).toBe(true);
    expect(document.querySelectorAll('.bz-gs-card').length).toBe(2);
  });
});

describe('G5 三控件值互译（chips / 分段 / 下拉）', () => {
  it('chip 点击回写档位下拉；分段点击回写排序下拉', () => {
    const app = mkApp();
    openWithTwo(app);
    const idleChip = document.querySelector('.bz-gs-chip[data-k="idle"]') as HTMLElement;
    idleChip.click();
    expect(M.bucket).toBe('idle');
    expect(bucketSelectEl().querySelector('.bz-select-val')!.textContent).toContain('从未启动');
    expect(idleChip.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.bz-gs-chip[data-k="all"]')!.getAttribute('aria-pressed')).toBe('false');

    const segLast = [...document.querySelectorAll('.bz-gs-sortseg .bz-segmented-btn')]
      .find((b) => b.textContent === '最近玩') as HTMLElement;
    segLast.click();
    expect(M.sort).toBe('last');
    expect(sortSelectEl().querySelector('.bz-select-val')!.textContent).toContain('按最近玩');
  });

  it('下拉选中回写 chips 选中态与分段（既有回路，双向对账）', () => {
    const app = mkApp();
    openWithTwo(app);
    const sel = bucketSelectEl();
    sel.click();
    const menuItem = [...sel.querySelectorAll('.bz-select-item')]
      .find((b) => (b.textContent || '').includes('从未启动')) as HTMLElement;
    menuItem.click();
    expect(M.bucket).toBe('idle');
    expect((document.querySelector('.bz-gs-chip[data-k="idle"]') as HTMLElement).classList.contains('bz-chip--sel')).toBe(true);

    const ssel = sortSelectEl();
    ssel.click();
    const mItem = [...ssel.querySelectorAll('.bz-select-item')]
      .find((b) => (b.textContent || '').includes('按最近玩')) as HTMLElement;
    mItem.click();
    expect(M.sort).toBe('last');
    const segOn = [...document.querySelectorAll('.bz-gs-sortseg .bz-segmented-btn')]
      .find((b) => b.classList.contains('is-on')) as HTMLElement;
    expect(segOn.textContent).toBe('最近玩');
  });

  it('chips 挂载即带 aria-pressed（首屏可读，不等首次点击）', () => {
    const app = mkApp();
    openWithTwo(app);
    const chips = document.querySelectorAll('.bz-gs-chip');
    expect(chips.length).toBeGreaterThan(0);
    chips.forEach((c) => expect(c.hasAttribute('aria-pressed')).toBe(true));
    expect(document.querySelector('.bz-gs-chip[data-k="all"]')!.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('G6 openDetail 收悬浮预览', () => {
  it('悬浮换脸/轮播进行中点卡片进弹窗：reel 摘除、门面回静息态（口径标签回显）', () => {
    const app = mkApp();
    openGameshelf(app);
    const b = item(2, 'BBB', 600);
    (b as any).file = { __fm: { '截图源': ['https://cdn/a.1920x1080.jpg', 'https://cdn/b.1920x1080.jpg'] } };
    M.items = [item(1, 'AAA', 6000), b];
    renderAll(app);
    const body = document.querySelector('#bz-gs-body') as HTMLElement;
    bindShotReel(app, body, true); // jsdom 无真 hover，显式开
    const cardB = document.querySelector('.bz-gs-card[data-appid="2"]') as HTMLElement;
    cardB.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(cardB.querySelector('.bz-gs-reel')).toBeTruthy(); // 轮播已起
    expect(document.querySelector('#bz-gs-hero')!.innerHTML).toContain('BBB'); // 门面换脸态
    cardB.click(); // 进详情弹窗
    expect(cardB.querySelector('.bz-gs-reel')).toBeNull(); // 定时器不再空转
    expect(document.querySelector('#bz-gs-hero')!.innerHTML).toContain('时长第一'); // 回静息（非换脸）
  });
});

describe('转义单源收编（cons C1 / G4 / arch A5）', () => {
  it('文本位 esc（五件套）/ 属性位 escAttr（双引号口径）——域内自写弱化版退役', () => {
    const it1 = item(1, 'A&B<C>"D\'E', 600);
    const hero = heroHtml(it1, '', buildReport([it1]));
    expect(hero).toContain('A&amp;B&lt;C&gt;&quot;D&#39;E'); // 展示名（文本位：五件套含 '）
    expect(hero).toContain('title="A&amp;B&lt;C&gt;&quot;D\'E"'); // title 属性位（双引号上下文，' 原样合法）
  });

  it('hero 背景 url(\'…\') 单引号上下文：\' → %27、& → &amp;（escCssUrl）', () => {
    const it1 = item(1, 'X', 600);
    const hero = heroHtml(it1, "https://cdn/it's a&b.jpg", buildReport([it1]));
    expect(hero).toContain("background-image:url('https://cdn/it%27s a&amp;b.jpg')");
  });

  it('firstChar 码点取字：emoji / 扩展区首字不再锯成代理对乱码', () => {
    expect(shelfHtml([item(1, '🎮Player', 60)], () => '')).toContain('data-initial="🎮"');
    expect(shelfHtml([item(2, '𠀀ECT', 60)], () => '')).toContain('data-initial="𠀀"');
  });

  it('展示名剥书名号走 core 单源：《名》→名；消歧尾巴随批A F12 一并剥（《名》 123→名）', () => {
    const f1 = { path: '我的/游戏/《小丑牌》.md', basename: '《小丑牌》', __fm: { AppID: 1 } };
    const f2 = { path: '我的/游戏/《X》 123.md', basename: '《X》 123', __fm: { AppID: 2 } };
    const app = mkApp([f1, f2]);
    setApp(app);
    rebuildItems(app);
    expect(M.items.map((i) => i.name)).toEqual(['小丑牌', 'X']);
  });
});

describe('详情弹窗：modalRepaintFn 生命周期 + 在商店打开收口', () => {
  const mockStoreApi = (): void => {
    (requestUrl as any).mockImplementation(async (opts: { url: string }) => {
      const u = opts.url;
      let json: unknown = {};
      if (u.includes('appdetails')) {
        json = [{ success: true, data: {
          type: 'game', genres: [{ description: '动作' }], developers: ['Ghost Ship Studios'],
          release_date: { date: '2020 年 5 月 13 日' }, supported_languages: '英语, 简体中文',
          platforms: { windows: true }, categories: [{ description: '单人' }], is_free: true,
          short_description: '挖矿射击', screenshots: [{ path_full: 'https://shot/1.jpg' }],
        } }];
      } else if (u.includes('appreviews')) {
        json = { query_summary: { review_score_desc: '特别好评', total_reviews: 10, total_positive: 9, total_negative: 1 } };
      } else if (u.includes('GetSchemaForGame')) {
        json = { game: { availableGameStats: { achievements: [{ name: 'A1', displayName: '初次挖掘', description: '挖一下' }] } } };
      } else if (u.includes('GetPlayerAchievements')) {
        json = { playerstats: { achievements: [{ apiname: 'A1', achieved: 1, unlocktime: 1700000000 }] } };
      } else if (u.includes('GlobalAchievementPercentages')) {
        json = { achievementpercentages: { achievements: [{ name: 'A1', percent: 7.5 }] } };
      }
      return { status: 200, text: JSON.stringify(json), json };
    });
  };

  it('点卡片挂 modalRepaintFn；改属性后调用重画截图段；弹窗关闭后调用自清为 null', async () => {
    mockStoreApi();
    const app = mkApp();
    openWithTwo(app);
    (document.querySelector('.bz-gs-card') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('#bz-gs-detail-store')!.textContent).toContain('Ghost Ship Studios');
    });
    expect(typeof M.modalRepaintFn).toBe('function');
    // 媒体队列改写属性后调它：截图段立刻切到新源（重读属性口径）。
    // ⚠️ 就地改写 file——openDetail 闭包捕获的是原条目对象，换数组元素它看不见
    (M.items[0] as any).file = { __fm: { '截图源': ['https://new-shot/1.jpg'] } };
    M.modalRepaintFn!();
    expect(document.querySelector('#bz-gs-detail-shots')!.innerHTML).toContain('https://new-shot/1.jpg');
    // 弹窗摘除后再调：自清，不留野钩子
    closeAllModals();
    M.modalRepaintFn!();
    expect(M.modalRepaintFn).toBeNull();
  });

  it('「在商店打开」走 core openExternalUrl（app.openUrl 一级兜底），不再裸 window.open', async () => {
    mockStoreApi();
    const openUrl = vi.fn();
    const app = { ...mkApp(), openUrl };
    openWithTwo(app);
    (document.querySelector('.bz-gs-card') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('#bz-gs-open-store')).toBeTruthy();
    });
    (document.querySelector('#bz-gs-open-store') as HTMLElement).click();
    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(String(openUrl.mock.calls[0][0])).toBe(storeUrlOf(1)); // 点的是首款卡（appid 1）
  });
});

describe('图片兜底全链路（bindMediaFallback）', () => {
  it('封面失败 → fallback 源试一次（fbDone）→ 再失败才 is-broken', () => {
    const app = mkApp();
    openGameshelf(app);
    const it1 = item(1, 'AAA', 6000);
    it1.coverSrc = 'https://remote/1.jpg'; // 本地值 ≠ 源值，兜底链路可辨
    M.items = [it1];
    renderAll(app);
    const img = document.querySelector('.bz-gs-card .bz-gs-cover img') as HTMLImageElement;
    expect(img.getAttribute('data-fallback-src')).toBe('https://remote/1.jpg');
    img.dispatchEvent(new Event('error')); // 第一次：切 fallback，不判死
    expect(img.dataset.fbDone).toBe('1');
    expect(img.src).toContain('https://remote/1.jpg');
    const cover = img.closest('.bz-gs-cover')!;
    expect(cover.classList.contains('is-broken')).toBe(false);
    img.dispatchEvent(new Event('error')); // 第二次：判死，首字占位
    expect(cover.classList.contains('is-broken')).toBe(true);
  });

  it('reel 内 img 失败被隔离：不触发封面兜底、不改写 src', () => {
    const app = mkApp();
    openWithTwo(app);
    const coverEl = document.querySelector('.bz-gs-cover') as HTMLElement;
    coverEl.insertAdjacentHTML('afterbegin', '<span class="bz-gs-reel"><img src="https://thumb/x.jpg" data-shot-full="https://full/x.jpg"></span>');
    const reelImg = coverEl.querySelector('.bz-gs-reel img') as HTMLImageElement;
    reelImg.dispatchEvent(new Event('error'));
    expect(coverEl.classList.contains('is-broken')).toBe(false);
    expect(reelImg.getAttribute('src')).toBe('https://thumb/x.jpg');
  });
});

describe('mountOps：触控热区 + syncing 禁用 + 手动同步收尾', () => {
  it('三枚常驻钮挂 bz-touch-target--lg（§8.2 热区下限）；syncing 中同步钮禁用', () => {
    const app = mkApp();
    openWithTwo(app);
    const btns = document.querySelectorAll('#bz-gs-heroops .bz-icon-btn');
    expect(btns.length).toBe(3);
    btns.forEach((b) => expect(b.classList.contains('bz-touch-target--lg')).toBe(true));
    M.syncing = true;
    renderAll(app);
    const sync = document.querySelector('#bz-gs-heroops [title="立即同步"]') as HTMLButtonElement;
    expect(sync.disabled).toBe(true);
    M.syncing = false;
    renderAll(app);
    expect((document.querySelector('#bz-gs-heroops [title="立即同步"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('手动同步收尾不再双刷（eff E6）：runSync 收口渲染后无第二次整刷', async () => {
    const app = mkApp();
    openWithTwo(app);
    // 先排空 openPanel→afterOpen 的自动同步链（其收尾 renderAll 属 index.ts 既有口径，
    // 与本断言无关，但不能让它跟点击链在微任务上赛跑）
    await new Promise((r) => setTimeout(r, 0));
    let midNode: HTMLInputElement | null = null;
    vi.mocked(runSync).mockImplementationOnce(async () => {
      M.renderFn?.(); // 复刻真 runSync finally 的收口渲染
      midNode = searchInput();
      return { ok: true, added: 0, updated: 0, offShelf: 0 };
    });
    (document.querySelector('#bz-gs-heroops [title="立即同步"]') as HTMLButtonElement).click();
    // 等收口渲染到达（runSync finally 口径 → 搜索框换血一次）
    await vi.waitFor(() => expect(midNode).not.toBeNull());
    await vi.waitFor(() => expect(searchInput()).toBe(midNode));
    // 让 onSyncClick 尾部（入队等）全部微/宏任务跑完，此后不得再换血
    // （旧代码此处 runSync 收口后还有一次直呼 renderAll → 节点必变，断言必红）
    await new Promise((r) => setTimeout(r, 0));
    expect(searchInput()).toBe(midNode);
  });
});

describe('closePanel 清理清单 + 门面跟随 + G3 门面不塌', () => {
  it('状态行不跨开关残留：closePanel 清 statusMsg，重开面板状态行干净', () => {
    const app = mkApp();
    openWithTwo(app);
    M.statusMsg = '同步完成：新增 5';
    renderAll(app);
    expect(document.querySelector('#bz-gs-status')!.textContent).toBe('同步完成：新增 5');
    closePanel();
    expect(M.statusMsg).toBe('');
    openGameshelf(app);
    expect(document.querySelector('#bz-gs-status')!.textContent).toBe('');
  });

  it('门面跟随列表首位：搜索过滤后 fillHero 展示命中首位', () => {
    const app = mkApp();
    openWithTwo(app);
    expect(document.querySelector('#bz-gs-hero')!.innerHTML).toContain('AAA');
    M.query = 'BBB';
    renderList(app);
    expect(document.querySelector('#bz-gs-hero')!.innerHTML).toContain('BBB');
    expect(document.querySelector('#bz-gs-hero')!.innerHTML).not.toContain('>AAA<');
  });

  it('G3 空态门面不塌：heroz 带 min-height 驻留（样式单源断言）+ hero 清空后容器不摘', () => {
    const css = readFileSync('src/gameshelf/styles.css', 'utf8');
    expect(css).toMatch(/\.bz-gs-heroz\s*\{[^}]*min-height:\s*50px/);
    const app = mkApp();
    openGameshelf(app);
    M.items = [];
    renderAll(app);
    expect(document.querySelector('.bz-gs-heroz')).toBeTruthy();
    expect(document.querySelector('#bz-gs-hero')!.innerHTML).toBe('');
  });

  it('ESC 层 id 对齐 bz-<域> 约定（cons C4，源码形制断言）', () => {
    const src = readFileSync('src/gameshelf/ui.ts', 'utf8');
    expect(src).toMatch(/const ESC_ID = 'bz-gameshelf'/);
  });
});
