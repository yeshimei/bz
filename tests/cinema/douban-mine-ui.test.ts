/**
 * 豆瓣「我账号看过的」导入：cookie 守卫 → 抓取预览 → 按已看建档（评分/日期/我的影片片单），
 * 以及片单整单动作（收录进影院 / 移除 / 改名）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, Platform } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { createOverlay, closeOverlay } from '../../src/cinema/ui';
import { configureDoubanListFetch, shutdownDoubanQueue } from '../../src/cinema/douban-queue';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { quickAddWatched } from '../../src/cinema/recommend';

const flush = (ms = 10): Promise<void> => new Promise((r) => setTimeout(r, ms));

function stubHoverCapable(on: boolean): void {
  (window as any).matchMedia = (q: string) => ({
    matches: on && q === '(hover: hover) and (pointer: fine)',
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
}

/** 库里放一条「片单收纳」的想看片（贴链接导入的产物形态）+ 一条正常已看片 */
function seedVault(): any {
  const vault = new MockVault();
  vault.files.set('我的/影视/《收纳片》.md', `---
tags:
- 电影
状态: 想看
片单收纳: true
片单: [片单A]
---
`);
  vault.files.set('我的/影视/《已在影院》.md', `---
tags:
- 电影
状态: 已看
片单: [片单A]
---
`);
  const app = mockAppWithVault(vault);
  M.appRef = app as any;
  M.folderPath = '我的/影视';
  rebuildItems(app as any);
  return app;
}

function setSettings(extra: Record<string, unknown> = {}): void {
  setSettingsProvider(() => ({ cinemaFolderPath: '我的/影视', ...extra }) as any);
}

beforeEach(() => {
  resetObsidianMocks();
  resetCinemaState();
  document.body.innerHTML = '';
  Platform.isMobile = false;
  stubHoverCapable(true);
  setSettings();
});

afterEach(() => {
  closeOverlay();
  configureDoubanListFetch(null);
  shutdownDoubanQueue();
});

describe('已看建档（quickAddWatched）', () => {
  it('写状态已看 + 评分 + 观影日期/已看日期（豆瓣标记日，不是今天）', async () => {
    const app = seedVault();
    await quickAddWatched(app, '导入片', '电影', { rating: 8, date: '2023-08-05' });
    const md = (app.vault as any).files.get('我的/影视/《导入片》.md') as string;
    expect(md).toContain('状态: 已看');
    expect(md).toContain('评分: 8');
    expect(md).toContain('观影日期: "2023-08-05"');
    expect(md).toContain('已看日期: "2023-08-05"');
    expect(md).not.toContain('想看日期');
  });

  it('没打分的条目不写「评分」键（未分 ≠ 0 分，缺键才是未评）', async () => {
    const app = seedVault();
    await quickAddWatched(app, '无分片', '电影', { rating: null, date: '2024-01-01' });
    const md = (app.vault as any).files.get('我的/影视/《无分片》.md') as string;
    expect(md).toContain('状态: 已看');
    expect(md).not.toContain('评分:');
  });
});

describe('我账号的影片：三状态导入（想看 / 在看 / 已看）', () => {
  /** 按路径分发三份名单（wish / do / collect），顺带记录请求顺序 */
  const stubPages = (pages: Record<string, any[]>, seen?: string[]): void => {
    configureDoubanListFetch(async (_app: unknown, base: string) => {
      seen?.push(base.replace('https://movie.douban.com/people/150820610', ''));
      const key = base.split('/').pop() ?? '';
      const entries = pages[key] ?? [];
      return { entries, firstPageEmpty: entries.length === 0, listTitle: '' };
    });
  };

  it('没填 Cookie：不发起抓取，提示并给「去设置」出口', async () => {
    let called = 0;
    configureDoubanListFetch(async () => {
      called++;
      return { entries: [], firstPageEmpty: false, listTitle: '' };
    });
    const app = seedVault();
    createOverlay(app);
    (document.querySelector('.j-import-mine') as HTMLElement).click();
    await flush();
    expect(called).toBe(0);
    expect(hasNotice(/先填豆瓣 Cookie/)).toBe(true);
  });

  it('弹层内的点击不冒泡到主面板：点列表行只改勾选，不切视图、不改筛选、弹层不消失', async () => {
    // 回归 2026-11-01 真机：弹层挂在 sec 内，而主面板的点击委托也挂在 sec 上；分组容器当时
    // 与侧栏 rail 共用 data-g，点任意一行 → 被当成「按类型筛选 watched」→ 整页重渲染把弹层
    // 冲掉，落到 `watched · 0 部`。
    setSettings({ cinemaDoubanCookie: 'dbcl2=150820610:abc' });
    stubPages({
      collect: [{ sid: '1292052', name: '肖申克的救赎', stars: 5, at: '2023-08-05', comment: '' }],
    });
    const app = seedVault();
    createOverlay(app);
    (document.querySelector('.j-import-mine') as HTMLElement).click();
    await flush(60);

    const row = document.querySelector<HTMLElement>('.mine-row');
    expect(row).toBeTruthy();
    const selBefore = row!.classList.contains('sel');
    row!.click();
    await flush();

    expect(row!.classList.contains('sel')).toBe(!selBefore); // 勾选照常切换
    expect(M.typeFilter).toBe(null);                        // 没被当成侧栏类型筛选
    expect(document.querySelector('.mine-row')).toBeTruthy(); // 弹层还在
  });

  it('Cookie 里没有 dbcl2（不是登录态）：同样拦在抓取前', async () => {
    setSettings({ cinemaDoubanCookie: 'bid=abc; ck=xyz' });
    let called = 0;
    configureDoubanListFetch(async () => {
      called++;
      return { entries: [], firstPageEmpty: false, listTitle: '' };
    });
    const app = seedVault();
    createOverlay(app);
    (document.querySelector('.j-import-mine') as HTMLElement).click();
    await flush();
    expect(called).toBe(0);
    expect(hasNotice(/没有登录信息/)).toBe(true);
  });

  it('三份名单一起抓（wish → do → collect），默认全选，本地已有的置灰不计入', async () => {
    setSettings({ cinemaDoubanCookie: 'dbcl2="150820610:xyz"' });
    const seen: string[] = [];
    stubPages({
      wish: [{ sid: 'w1', name: '想看甲', stars: null, at: '2024-03-15', comment: '' }],
      do: [{ sid: 'd1', name: '在看甲', stars: null, at: '2024-01-02', comment: '' }],
      collect: [
        { sid: 'c1', name: '已在影院', stars: 4, at: '2023-08-05', comment: '' },
        { sid: 'c2', name: '看过乙', stars: 5, at: '2023-05-01', comment: '' },
      ],
    }, seen);
    const app = seedVault();
    createOverlay(app);
    (document.querySelector('.j-import-mine') as HTMLElement).click();
    await flush(40);
    expect(seen).toEqual(['/wish', '/do', '/collect']);
    // 顶部三格（想看 / 在看 / 已看）
    const cells = [...document.querySelectorAll('.mine-bar-c')];
    expect(cells.length).toBe(3);
    expect(cells[0].textContent).toContain('想看');
    expect(cells[2].textContent).toContain('已看');
    // 已看组里《已在影院》在库：置灰、不勾
    const libRows = document.querySelectorAll('.mine-row.lib');
    expect(libRows.length).toBe(1);
    expect(libRows[0].textContent).toContain('已在影院');
    // 默认全选 = 4 条里 3 条（在库的那条不算）
    expect(document.querySelector('.j-mine-sum')?.textContent).toContain('已选 3 部');
    expect(document.querySelector('.j-mine-sum')?.textContent).toContain('1 部已在影院');
    expect(cells[2].textContent).toContain('本地已有 1 部');
  });

  it('全不选 → 开始同步禁用；再整组勾回来恢复', async () => {
    setSettings({ cinemaDoubanCookie: 'dbcl2="150820610:xyz"' });
    stubPages({ wish: [{ sid: 'w1', name: '想看甲', stars: null, at: '2024-03-15', comment: '' }] });
    const app = seedVault();
    createOverlay(app);
    (document.querySelector('.j-import-mine') as HTMLElement).click();
    await flush(40);
    const next = document.querySelector('.j-mine-next') as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    (document.querySelector('.j-mine-none') as HTMLElement).click();
    await flush();
    expect(next.disabled).toBe(true);
    expect(document.querySelector('.j-mine-sum')?.textContent).toContain('还没有选片');
    (document.querySelector('.mine-bar-c[data-mg="want"]') as HTMLElement).click();
    await flush();
    expect(next.disabled).toBe(false);
  });

  it('同步：按状态建档（已看带评分与标记日）、不归入任何片单、不打片单收纳', async () => {
    setSettings({ cinemaDoubanCookie: 'dbcl2="150820610:xyz"' });
    stubPages({
      do: [{ sid: 'd1', name: '在看甲', stars: null, at: '2024-01-02', comment: '' }],
      collect: [{ sid: 'c1', name: '看过乙', stars: 4, at: '2023-08-05', comment: '' }],
    });
    const app = seedVault();
    createOverlay(app);
    (document.querySelector('.j-import-mine') as HTMLElement).click();
    await flush(40);
    (document.querySelector('.j-mine-next') as HTMLElement).click();
    await flush();
    // 二次确认层：只留风控警告，数量进按钮
    const confirm = document.querySelector('.j-mine-go') as HTMLElement;
    expect(confirm.textContent).toContain('确认同步 2 部');
    expect(document.querySelector('.mine-stage[data-stage="confirm"]')?.textContent).toContain('每 4 秒 1 部');
    confirm.click();
    await flush(60);
    const watched = (app.vault as any).files.get('我的/影视/《看过乙》.md') as string;
    expect(watched).toContain('状态: 已看');
    expect(watched).toContain('评分: 8'); // 4 星 ×2
    expect(watched).toContain('已看日期: "2023-08-05"');
    expect(watched).not.toContain('片单');
    expect(watched).not.toContain('片单收纳');
    const watching = (app.vault as any).files.get('我的/影视/《在看甲》.md') as string;
    expect(watching).toContain('状态: 在看');
    expect(watching).toContain('在看日期: "2024-01-02"');
    expect(watching).not.toContain('片单');
    // 同步层：建档计数走满
    expect(document.querySelector('.j-mine-b1')?.textContent).toBe('2 / 2');
    expect(hasNotice(/已同步 2 部/)).toBe(false); // 关窗才报，此时还在层里
  });
});

describe('片单整单动作（侧栏片单行右键）', () => {
  it('收录进影院：二次确认后才摘「片单收纳」（取消则一部不动），片单保留', async () => {
    const app = seedVault();
    createOverlay(app);
    const rail = document.querySelector('.rail-item[data-l="片单A"]') as HTMLElement;
    expect(rail).toBeTruthy();
    const openMenu = (): HTMLElement => {
      rail.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
      const menu = document.querySelector('.bz-item-menu') as HTMLElement;
      expect(menu).toBeTruthy();
      return menu;
    };
    const labels = [...openMenu().querySelectorAll('button, .bz-item-menu-item')].map((b) => b.textContent ?? '');
    expect(labels.some((t) => t.includes('收录进影院'))).toBe(true);
    expect(labels.some((t) => t.includes('改名'))).toBe(true);
    expect(labels.some((t) => t.includes('移除'))).toBe(true);
    const clickAdmit = (menu: HTMLElement): void => {
      const admit = [...menu.querySelectorAll('button, .bz-item-menu-item')]
        .find((b) => (b.textContent ?? '').includes('收录进影院')) as HTMLElement;
      admit.click();
    };
    // 第一次：先出确认框（本域皮），取消 → 一部不动
    clickAdmit(openMenu());
    await flush();
    const popup = document.getElementById('__shared_confirm_popup__');
    expect(popup?.className).toContain('bz-cinema-flow-dialog');
    expect(popup?.textContent).toContain('片单「片单A」里的 1 部');
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await flush(20);
    const before = (app.vault as any).files.get('我的/影视/《收纳片》.md') as string;
    expect(before).toContain('片单收纳'); // 取消：标志还在
    // 第二次：确认 → 摘标志，片单保留
    clickAdmit(openMenu());
    await flush();
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await flush(30);
    const md = (app.vault as any).files.get('我的/影视/《收纳片》.md') as string;
    expect(md).not.toContain('片单收纳');
    expect(md).toContain('片单A'); // 片单保留
  });

  it('移除：二次确认后才删（取消则一部不动）', async () => {
    const app = seedVault();
    createOverlay(app);
    const rail = document.querySelector('.rail-item[data-l="片单A"]') as HTMLElement;
    rail.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    const remove = [...menu.querySelectorAll('button, .bz-item-menu-item')].find((b) => (b.textContent ?? '').includes('移除')) as HTMLElement;
    remove.click();
    await flush();
    // 确认框（本域皮：bz-cinema-flow-dialog）
    const popup = document.getElementById('__shared_confirm_popup__');
    expect(popup?.className).toContain('bz-cinema-flow-dialog');
    expect(popup?.textContent).toContain('连同片单内 2 部影片');
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await flush(20);
    expect((app.vault as any).files.has('我的/影视/《收纳片》.md')).toBe(true); // 取消：一部不动
  });
});
