/**
 * 影院（cinema）入口/目录回落 + 事件补发测试（ADR-0087 接管旧 movie 域）
 * - ensureCinema：cinemaFolderPath 显式配置生效；缺省回落「我的/影视」
 * - quickAddWant：发 movie:created(want) 域事件（smartcat 行为流依赖）+ 建笔记 + 入抓取队列
 * - runAIRecommend / 快速状态窗 / 删除等事件补发由 ui.test / recommend.test 覆盖
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { onDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { registerPanelEsc, unregisterPanelEsc } from '../../src/core/esc-manager';
import { getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { ensureCinema, unloadCinema, applyDefaultView, openCinema, openCinemaAnalysis } from '../../src/cinema';
import { closeYearbookOverlay } from '../../src/cinema/ui';
import { rebuildItems } from '../../src/cinema/data';
import { quickAddWant } from '../../src/cinema/recommend';
import { configureFetchQueue, enqueueDoubanFetch, isFetching, shutdownDoubanQueue } from '../../src/cinema/douban-queue';

function makeApp(vault: MockVault) {
  const app = mockAppWithVault(vault);
  setApp(app);
  return app;
}

describe('cinema ensureCinema 目录回落（ADR-0087）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadCinema();
    setSettingsProvider(() => ({} as any));
  });

  it('未配置 cinemaFolderPath → 回落默认「我的/影视」', () => {
    setSettingsProvider(() => ({} as any));
    const vault = new MockVault();
    ensureCinema(makeApp(vault));
    expect(M.folderPath).toBe('我的/影视');
  });

  it('显式配置 cinemaFolderPath → 使用该目录', () => {
    setSettingsProvider(() => ({ cinemaFolderPath: '我的/影院' } as any));
    const vault = new MockVault();
    ensureCinema(makeApp(vault));
    expect(M.folderPath).toBe('我的/影院');
  });

  it('cinemaFolderPath 为空白串 → 回落默认（trim 判断）', () => {
    setSettingsProvider(() => ({ cinemaFolderPath: '   ' } as any));
    const vault = new MockVault();
    ensureCinema(makeApp(vault));
    expect(M.folderPath).toBe('我的/影视');
  });

  it('G6 回归：会话内改「影视文件夹」→ 下次 ensureCinema 即同步（不再缓存首次值）', () => {
    setSettingsProvider(() => ({ cinemaFolderPath: '我的/影院' } as any));
    const vault = new MockVault();
    const app = makeApp(vault);
    ensureCinema(app);
    expect(M.folderPath).toBe('我的/影院');
    // 已初始化状态下改设置（幂等闸门不再拦目录同步）
    setSettingsProvider(() => ({ cinemaFolderPath: '我的/新影院' } as any));
    ensureCinema(app);
    expect(M.folderPath).toBe('我的/新影院');
    // 清空配置 → 回落默认（resolveCinemaFolderPath 唯一单源）
    setSettingsProvider(() => ({} as any));
    ensureCinema(app);
    expect(M.folderPath).toBe('我的/影视');
  });
});

describe('cinema 默认视图接线（issue 194）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadCinema();
    setSettingsProvider(() => ({} as any));
  });

  it('未配置 → 默认最近观看排序 + 状态全部', () => {
    setSettingsProvider(() => ({} as any));
    applyDefaultView();
    expect(M.sortMode).toBe('date');
    expect(M.statusFilter).toBeNull();
  });

  it('合法配置生效（rating 排序 + 已看筛选）', () => {
    setSettingsProvider(() => ({ cinemaSortMode: 'rating', cinemaStatusFilter: '已看' } as any));
    applyDefaultView();
    expect(M.sortMode).toBe('rating');
    expect(M.statusFilter).toBe('已看');
  });

  it('非法值回落（未知排序回 date、未知状态回全部）', () => {
    setSettingsProvider(() => ({ cinemaSortMode: 'xxx', cinemaStatusFilter: '想' } as any));
    applyDefaultView();
    expect(M.sortMode).toBe('date');
    expect(M.statusFilter).toBeNull();
  });
});

describe('cinema quickAddWant 事件补发（movie:created want）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
  });

  it('加入想看 → 建笔记 + 发 movie:created(want) 事件（抓取走队列，进度零通知）', async () => {
    const seen: any[] = [];
    const off = onDomainEvent('movie', (evt) => seen.push(evt));
    const vault = new MockVault();
    const app = makeApp(vault);
    await quickAddWant(app, '新片', '电影');

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ kind: 'created', name: '新片', status: 'want', rating: null });
    expect((vault.files as any).get('我的/影视/《新片》.md')).toContain('评分: -1');
    // 进度零通知（ADR-0113）：反馈只在卡片 loading，未配置 CLI 时队列静默禁用
    expect(document.querySelector('.bz-notice--progress')).toBeNull();
    off();
  });
});

describe('cinema 打开面板触发豆瓣抓取队列（ADR-0113）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearNotices();
    shutdownDoubanQueue();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
  });
  afterEach(() => {
    unloadCinema();
    shutdownDoubanQueue();
    setSettingsProvider(() => ({} as any));
  });

  /** 假执行器（ADR-0129 执行器=插件内 fetch）：写回海报+豆瓣链接（模拟 fetcher 成功），记录调用 */
  function successFetch(vault: MockVault) {
    const fetched: string[] = [];
    const fetch = async (file: any) => {
      fetched.push(file.path);
      vault.files.set(file.path, `${vault.files.get(file.path) ?? ''}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
      return { ok: true } as const;
    };
    return { fetched, fetch };
  }

  it('openCinema → 有海报缺链接的笔记入队抓取并清 pending（静默无通知）', async () => {
    setSettingsProvider(() => ({} as any));
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《缺信息》.md',
      '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---',
    );
    const app = makeApp(vault);
    const { fetched, fetch } = successFetch(vault);
    configureFetchQueue({ fetch, gapMs: 0, refreshDelayMs: 0 });
    openCinema(app);
    await new Promise((r) => setTimeout(r, 25));
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toContain('《缺信息》');
    expect(isFetching('我的/影视/《缺信息》.md')).toBe(false);
    // 完全静默（ADR-0113 拍板）：抓取不发任何通知
    expect(getNoticeMessages()).toEqual([]);
  });

  // 观影分析（覆盖影院面板的一层，ADR-0175）语义：只看不抓——面板没开就先开面板（层得有落脚处），
  // 但**不**走 openCinema 的扫尾入队；补抓只由 openCinema（打开影院）那条路径负责（上一条用例钉着）。
  it('openCinemaAnalysis（覆盖层）：面板没开先开面板再盖层，不触发抓取入队，影片照常渲染', async () => {
    setSettingsProvider(() => ({} as any));
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《缺信息》.md',
      '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---',
    );
    const app = makeApp(vault);
    const { fetched, fetch } = successFetch(vault);
    configureFetchQueue({ fetch, gapMs: 0, refreshDelayMs: 0 });
    openCinemaAnalysis(app);
    await new Promise((r) => setTimeout(r, 25));
    expect(fetched).toHaveLength(0);
    expect(document.querySelector('.bz-yb'), '观影分析层开了').toBeTruthy();
    expect(document.querySelector('[data-cinema-root]'), '面板在层下待命').toBeTruthy();
    expect(document.querySelector('.bz-yb-box'), '纸面在层框里（框 = 面板矩形）').toBeTruthy();
    closeYearbookOverlay();
    expect(document.querySelector('.bz-yb'), '关层即回影院面板').toBeNull();
  });
});

describe('cinema 卸载清理（unloadCinema，审查批 C 补断言）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    clearNotices();
    shutdownDoubanQueue();
    unregisterPanelEsc('bz-cinema'); // 清前序用例可能残留的 ESC 层，保证断言从净态出发
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
  });
  afterEach(() => {
    unloadCinema();
    shutdownDoubanQueue();
    unregisterPanelEsc('bz-cinema');
    setSettingsProvider(() => ({} as any));
  });

  it('卸载三态：overlay 摘除 / renderFn 置空 / 队列与去重集清空', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《卸载片》.md', '---\ntags: [电影]\n评分: -1\n---');
    const app = makeApp(vault);
    const overlay = document.createElement('div');
    M.currentOverlay = overlay;
    document.body.appendChild(overlay);
    M.renderFn = vi.fn();
    rebuildItems(app);
    const file = M.items[0].file!;
    // 抓取中态（悬挂执行器，永不返回）：卸载必须撤 loading、清队列与去重
    configureFetchQueue({ gapMs: 0, refreshDelayMs: 0, fetch: () => new Promise(() => {}) });
    expect(enqueueDoubanFetch(file, '卸载片')).toBe(true);
    expect(isFetching(file.path)).toBe(true);

    unloadCinema();

    // 态1 overlay 摘除：引用清空 + DOM 摘除（局部引用防 M 置空后断言空转）
    expect(M.currentOverlay).toBeNull();
    expect(overlay.isConnected).toBe(false);
    // 态2 renderFn 置空（resetCinemaState 兜渲染句柄失效）
    expect(M.renderFn).toBeNull();
    // 态3 队列与去重集清空：pending 撤销（loading 退）+ attempted 清空（同会话可重新入队）
    expect(isFetching(file.path)).toBe(false);
    expect(enqueueDoubanFetch(file, '卸载片')).toBe(true);
  });

  it('卸载注销面板 ESC 层（批C）：同 id 重新注册可生效，ESC 到达新层', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    ensureCinema(app); // ui.registerEscapeHandler → registerPanelEsc('bz-cinema')
    unloadCinema(); // 修复前：ESC 层残留在 panelEscHandles，重启用后同 id 注册被幂等静默吞
    const closeSpy = vi.fn();
    // 槽位已清 → 本调用注册新层；修复前静默 no-op，下方 ESC 到不了 closeSpy
    registerPanelEsc('bz-cinema', () => true, closeSpy);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closeSpy).toHaveBeenCalledTimes(1);
    unregisterPanelEsc('bz-cinema'); // 清理本用例注册的层
  });
});
