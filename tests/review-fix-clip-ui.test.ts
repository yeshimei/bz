/**
 * 剪藏流家族修复批（review-all-bugs.md 第四节 F1-F15）UI 层回归：
 * - F3：已读条目右键「标记为已读」被 UI 守卫拦下（不重复计数/不发 news:read）；
 * - F4：剪藏本源搜索重选中条目后右栏同步渲染（防「高亮 A 读 B」）；
 * - F9：自动摘要失败通知「重试」走队列去重，双击只跑一次 AI；
 * - F11：番茄钟「重置」生效即落盘（重启不复活旧计时）；
 * - F12：冻结标记随 paused 清除——hidden 期间 resume→手动 pause 后 visible 不被静默续跑；
 * - F13：装载+落盘链路历史按保留窗裁剪；
 * - F14：favorites「打开」两层兜底落空时走 window.open，仍失败给人话提示；
 * - F15：favorites 表单单例守卫——重复打开只保留一层。
 * 数据层部分见 review-fix-clip.test.ts。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, getNoticeMessages } from './mock-obsidian-entry';
import { MockVault, mockAppWithVault } from './mock-vault';
import { setApp, getApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { setAISettingsProvider, resetAIProviderCache } from '../src/core/ai';
import { onDomainEvent } from '../src/core/domain-bus';
import { enqueueFileTask } from '../src/core/storage';

// ---- clipbook（F3 UI / F4） ----
import { openClipbook, unloadClipbook } from '../src/clipbook';
import { closePanel as closeClipPanel } from '../src/clipbook/ui';
import { M } from '../src/clipbook/state';
import { getNewsFilePath } from '../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../src/clipbook/write-queue';
import { setClipDir } from './clipbook/helpers';

// ---- auto-summary（F9） ----
import { processFile } from '../src/auto-summary/processor';
import { unloadAutoSummary } from '../src/auto-summary/index';

// ---- pomodoro（F11/F12/F13） ----
import { openPomodoro, ensurePomodoro, unloadPomodoro } from '../src/pomodoro';
import { getPomodoroFilePath } from '../src/pomodoro/data';

// ---- favorites（F14/F15） ----
import { DataManager } from '../src/favorites/data';
import { FavoritesAIService } from '../src/favorites/ai';
import { openPanel, openForm, initFavoritesUI, unloadFavoritesUI } from '../src/favorites/ui';

const T0 = new Date('2026-08-10T10:00:00').getTime();
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

const clipDisk = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);
const pomoDisk = (vault: MockVault) => JSON.parse(vault.files.get(getPomodoroFilePath())!);
/** 落盘屏障：随队列排空此前的 void save()（不落额外数据） */
const flushPomo = (vault: MockVault) => enqueueFileTask(getPomodoroFilePath(), async () => { void vault; });

describe('F3：已读条目「标记为已读」被 UI 守卫拦下', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    try { unloadClipbook(); } catch { /* 幂等 */ }
  });
  afterEach(() => {
    try { closeClipPanel(); } catch { /* 幂等 */ }
    try { unloadClipbook(); } catch { /* 幂等 */ }
  });

  it('右键已读条目点「标记为已读」→ 不发 news:read、统计不变', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), JSON.stringify({
      articles: [
        { platform: '果壳科学人', title: '已读甲', url: 'https://gk.com/read', body: '正文甲', date: '2026-09-01 08:00:00', read: true, state: 'skipped' },
      ],
      stats: { totalRead: 3, totalSaved: 1, totalSkipped: 2, byPlatform: { 果壳科学人: 3 }, byDate: {} },
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    }));
    setApp(mockAppWithVault(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
    setClipDir('归档/网页剪藏');
    const readEvents: any[] = [];
    const off = onDomainEvent('news', (evt) => readEvents.push(evt));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    // 无未读 → 已读折叠段自动展开，卡片在 DOM
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const card = document.querySelector('.bz-clip-item') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const items = [...document.querySelectorAll('.bz-item-menu button')] as HTMLElement[];
    const target = items.find((el) => {
      const sp = el.querySelectorAll('span');
      return sp.length > 0 && sp[sp.length - 1].textContent === '标记为已读';
    });
    expect(target, '已读条目菜单仍含「标记为已读」入口').toBeTruthy();
    target!.click();
    await drainNewsWritesForTests();
    off();
    expect(readEvents).toHaveLength(0); // 修复前重复发 news:read（smartcat 三跳重复喂）
    const disk = clipDisk(vault);
    expect(disk.articles[0].state).toBe('skipped');
    expect(disk.stats.totalRead).toBe(3); // 修复前重复 +1
  });
});

describe('F4：剪藏本源搜索重选后右栏同步渲染', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    try { unloadClipbook(); } catch { /* 幂等 */ }
  });
  afterEach(() => {
    try { closeClipPanel(); } catch { /* 幂等 */ }
    try { unloadClipbook(); } catch { /* 幂等 */ }
  });

  it('搜索命中第二条剪藏 → M.cur 与阅读区都切到命中条目（不高亮 A 读 B）', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), JSON.stringify({
      articles: [],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    }));
    vault.files.set('归档/网页剪藏/剪藏笔记甲.md', '---\nurl: "https://a.com/1"\ncreated: 2026-08-20 10:00:00\n---\n甲的正文');
    vault.files.set('归档/网页剪藏/剪藏笔记乙.md', '---\nurl: "https://b.com/2"\ncreated: 2026-08-21 10:00:00\n---\n乙的正文');
    setApp(mockAppWithVault(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
    setClipDir('归档/网页剪藏');
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect((M.clipNotes || []).length).toBe(2)); // 装载完成（含剪藏扫描）
    // 切剪藏本源：两条剪藏平铺
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    await vi.waitFor(() => expect(!!M.cur).toBe(true));
    const firstId = M.cur!.id; // 默认选中第一条
    const otherTitle = firstId.includes('剪藏笔记甲') ? '剪藏笔记乙' : '剪藏笔记甲';
    const otherId = firstId === 'clip:归档/网页剪藏/剪藏笔记甲.md' ? 'clip:归档/网页剪藏/剪藏笔记乙.md' : 'clip:归档/网页剪藏/剪藏笔记甲.md';
    // 搜索另一条：目录高亮与选中悄悄切换，右栏必须跟着切（修复前仍显示旧文章）
    const search = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    search.value = otherTitle;
    search.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(M.cur && M.cur.id === otherId).toBe(true));
    const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
    expect(reader.textContent).toContain(otherTitle); // 修复前为 null（首条非命中被替换前的旧文）
    void firstId;
  });
});

describe('F9：自动摘要失败「重试」走队列去重', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetAIProviderCache();
    setAISettingsProvider(() => ({})); // 未配 AI：失败原因走「未配置」文案
    document.body.innerHTML = '';
    unloadAutoSummary();
  });
  afterEach(() => {
    unloadAutoSummary();
  });

  it('双击「重试」→ 队列去重只补跑一次 AI（修复前双倍花费）', async () => {
    const vault = new MockVault();
    vault.files.set('归档/网页剪藏/r.md', `---\nurl: "https://x.com/r"\n---\n\n${'段落内容。'.repeat(30)}`);
    const app = mockAppWithVault(vault);
    setApp(app);
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(null) // 首跑失败
      .mockResolvedValue('{"title":"重试标题","summary":"摘要内容","tags":["AI"]}'); // 重试成功
    await processFile(app, { prompt } as any, vault.file('归档/网页剪藏/r.md'));
    expect(vault.files.has('归档/网页剪藏/r.md')).toBe(true);
    const retryBtn = document.querySelector('.bz-notice .bz-notice-action') as HTMLElement;
    expect(retryBtn.textContent).toBe('重试');
    retryBtn.click();
    retryBtn.click(); // 双击：修复前并发跑两次 AI
    await tick(60);
    expect(prompt).toHaveBeenCalledTimes(2); // 首跑 1 + 重试 1（去重后）
    expect(vault.files.has('归档/网页剪藏/重试标题.md')).toBe(true);
  });
});

describe('F11/F12/F13：番茄钟落盘与冻结标记', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    unloadPomodoro();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
    setSettingsProvider(() => ({ pomodoroSound: false }) as any);
  });
  afterEach(() => {
    unloadPomodoro();
    vi.useRealTimers();
  });

  async function boot(vault: MockVault): Promise<void> {
    const app = mockAppWithVault(vault);
    setApp(app);
    await ensurePomodoro(app); // 注册 visibilitychange 监听
    await openPomodoro(app);
    await vi.advanceTimersByTimeAsync(10);
  }
  const btn = (id: string) => document.getElementById(id) as HTMLElement;
  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('F11：重置生效即落盘——重启不再复活旧计时（修复前 reset 恒 none 不 save）', async () => {
    const vault = new MockVault();
    await boot(vault);
    btn('pomodoro-btn-start').click(); // 开始专注
    await vi.advanceTimersByTimeAsync(10);
    await flushPomo(vault);
    expect(pomoDisk(vault).state.endTime).not.toBeNull(); // 运行态已落盘
    btn('pomodoro-btn-reset').click(); // 重置
    await vi.advanceTimersByTimeAsync(10);
    await flushPomo(vault);
    const disk = pomoDisk(vault).state;
    expect(disk.endTime).toBeNull(); // 修复前：磁盘仍是运行态，重启弹「番茄钟继续」复活
    expect(disk.paused).toBe(false);
  });

  it('F12：hidden 期间 resume→手动 pause，visible 不被残留冻结标记静默续跑', async () => {
    const vault = new MockVault();
    await boot(vault);
    btn('pomodoro-btn-start').click(); // 运行中
    await vi.advanceTimersByTimeAsync(10);
    setHidden(true); // 冻结（autoPauseMain=true）
    await vi.advanceTimersByTimeAsync(10);
    await flushPomo(vault);
    expect(pomoDisk(vault).state.paused).toBe(true);
    btn('pomodoro-btn-start').click(); // hidden 中 resume（popout 窗口等入口）：清冻结标记
    await vi.advanceTimersByTimeAsync(10);
    btn('pomodoro-btn-start').click(); // 再手动暂停
    await vi.advanceTimersByTimeAsync(10);
    await flushPomo(vault);
    expect(pomoDisk(vault).state.paused).toBe(true);
    setHidden(false); // 恢复可见：不得续跑手动暂停
    await vi.advanceTimersByTimeAsync(10);
    await flushPomo(vault);
    expect(pomoDisk(vault).state.paused).toBe(true); // 修复前：残留标记致 endTime 被重新拉起
    expect(pomoDisk(vault).state.endTime).toBeNull();
  });

  it('F13：装载+落盘链路历史按保留窗裁剪（窗外旧记录清除）', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), JSON.stringify({
      version: 1,
      state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
      history: [
        { ts: T0 - 40 * 24 * 60 * 60 * 1000, duration: 1500 }, // 40 天前（窗外）
        { ts: T0 - 60 * 1000, duration: 1500 }, // 一小时前（窗内）
      ],
    }));
    await boot(vault);
    btn('pomodoro-btn-start').click(); // start 事件触发落盘
    await vi.advanceTimersByTimeAsync(10);
    await flushPomo(vault);
    const history = pomoDisk(vault).history;
    expect(history).toHaveLength(1); // 修复前永不裁剪，旧记录一直躺在盘上
    expect(history[0].ts).toBe(T0 - 60 * 1000);
  });
});

describe('F14/F15：favorites 打开兜底与表单单例', () => {
  function favSetup(): { vault: MockVault; dm: DataManager; ai: FavoritesAIService } {
    resetObsidianMocks();
    document.body.innerHTML = '';
    unloadFavoritesUI();
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      {
        id: '1', tags: ['GitHub'], title: '例站', description: '', pinned: false,
        url: 'https://example.com/page', balance: null, balanceCacheTime: null, balanceError: null,
        linkedNote: null, created: '2026-01-01 00:00:00', type: 'GitHub', archived: false, archivedAt: null,
      },
    ]));
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
    const dm = new DataManager('CONFIG/STORAGE/favorites.json');
    const ai = new FavoritesAIService();
    initFavoritesUI(app, dm, ai);
    return { vault, dm, ai };
  }

  afterEach(() => {
    unloadFavoritesUI();
    document.body.innerHTML = '';
  });

  it('F14：openUrl 与 electron 兜底都落空 → 先试 window.open，仍失败给人话提示', async () => {
    const { vault } = favSetup();
    const app = getApp() as any;
    app.openUrl = vi.fn(() => { throw new Error('移动端无 openUrl'); });
    const winOpen = vi.fn((url: string) => ({}));
    (window as any).open = winOpen;
    openPanel(getApp(), new DataManager('CONFIG/STORAGE/favorites.json'), new FavoritesAIService());
    const card = await vi.waitFor(() => {
      const c = document.querySelector('[data-fav-content] .bz-fav-card') as HTMLElement | null;
      expect(c).toBeTruthy();
      return c!;
    });
    card.click();
    await tick(10);
    expect(winOpen).toHaveBeenCalledTimes(1);
    expect(String(winOpen.mock.calls[0][0])).toContain('example.com/page');
    expect(getNoticeMessages().some((m) => m.includes('无法打开链接'))).toBe(false);
    void vault;
  });

  it('F14：window.open 也失败（返回 null）→ 提示「无法打开链接」不再静默', async () => {
    favSetup();
    const app = getApp() as any;
    app.openUrl = vi.fn(() => { throw new Error('移动端无 openUrl'); });
    (window as any).open = vi.fn(() => null);
    openPanel(getApp(), new DataManager('CONFIG/STORAGE/favorites.json'), new FavoritesAIService());
    const card = await vi.waitFor(() => {
      const c = document.querySelector('[data-fav-content] .bz-fav-card') as HTMLElement | null;
      expect(c).toBeTruthy();
      return c!;
    });
    card.click();
    await tick(10);
    expect(getNoticeMessages().some((m) => m.includes('无法打开链接'))).toBe(true); // 修复前全落空无任何提示
  });

  it('F15：表单已开再开（命令/编辑入口叠加）→ 单例收敛为一层', () => {
    favSetup();
    openForm(null);
    expect(document.querySelectorAll('.bz-fav-form').length).toBe(1);
    ((document.querySelector('#fz-title') as HTMLInputElement).value = '未保存草稿');
    openForm(null); // 修复前叠加第二层遮罩，ESC 一次只关一层
    expect(document.querySelectorAll('.bz-fav-form').length).toBe(1);
    expect((document.querySelector('#fz-title') as HTMLInputElement).value).toBe(''); // 新表单干净
  });
});
