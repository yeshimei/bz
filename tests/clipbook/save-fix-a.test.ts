// @vitest-environment jsdom
/**
 * clipbook 修复批 A 回归（保存链 · 覆盖确认迁移 · 卸载收口 · 路径单源）。
 * 覆盖：
 * - 效率#3：同名覆盖确认迁 flow-dialog 三出口（覆盖更新/另存为新剪藏/取消）+ 披露副文案 + 危险反焦；
 * - CB4/A3：剪藏目录路径单源 clipDir/clipFilePathOf——尾斜杠设置下写盘/事件 clipPath/扫描三面一致；
 * - CB10/A1：createOverlay 存活登记 + closeAllOverlays 收口 + unloadClipbook 域内按 id 兜底；
 * - CB11：域事件载荷缺 path 拦截（不再放行防抖全量重扫）；
 * - A7：registerAutoRefresh 退订闭环（open→unload 循环后事件不再触发 reload，订阅不叠加）；
 * - 新-4：cleanClipTitleOf Windows 边界（尾点/尾空格剥除、保留设备名前置 _）；
 * - 效率#3 半：保存成功通知挂「打开笔记」action（openLinkText 实际写盘路径）。
 * ui 模块打桩观察 reloadIfOpen/invalidateClipBodyCache（index 事件接线测试用，file 级隔离不外溢）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/clipbook/ui', () => ({
  initPanel: vi.fn(),
  showPanel: vi.fn(),
  unloadPanel: vi.fn(),
  reloadIfOpen: vi.fn(),
  invalidateClipBodyCache: vi.fn(),
}));
vi.mock('../../src/knowledge', () => ({
  openKnowledgeAddTask: vi.fn(),
  upgradeNoteSourceInternal: vi.fn(async () => true),
}));

import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { emitDomainEvent, onDomainEvent } from '../../src/core/domain-bus';
import { closeAllOverlays, createOverlay } from '../../src/core/dom';
import { writeClipNote, clipDir, cleanClipTitleOf, clipFilePathOf } from '../../src/clipbook/save';
import { flowSave } from '../../src/clipbook/flow';
import { getNewsFilePath } from '../../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { scanClipDirectory } from '../../src/clipbook/scan';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { dataSourceGroupRows } from '../../src/clipbook/news-sources-group';
import { emptyDataSourceState } from '../../src/clipbook/news-source-settings';

const { reloadIfOpen } = await import('../../src/clipbook/ui');
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 默认设置（尾斜杠场景单独覆写） */
function setDefaultSettings(articleDirectory = '归档/网页剪藏'): void {
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory } as any));
}

/** 种 news.json（flowSave 链用） */
function seedNews(articles: any[]): MockVault {
  const vault = new MockVault();
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles,
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [],
      bilibiliUpInfo: {},
      bilibiliMaxItems: 10,
      bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    })
  );
  setApp(mockAppWithVault(vault));
  return vault;
}

function boot(): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({ articles: [], stats: {}, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: { zhihu: true, guokr: true, bilibili: true } }));
  setApp(mockAppWithVault(vault));
  return vault;
}

const flowAction = (i: number) => document.querySelector(`#bz-flow-dialog-action-${i}`) as HTMLElement;

beforeEach(() => {
  resetObsidianMocks();
  setDefaultSettings();
  vi.mocked(reloadIfOpen).mockClear();
});

// ================= 效率#3：覆盖确认迁 flow-dialog 三出口 =================

describe('效率#3：同名覆盖确认 flow-dialog 三出口', () => {
  it('覆盖更新：现语义 modify 既有文件；披露副文案/文件名/编辑部皮在框上；危险主动作反焦取消', async () => {
    const vault = boot();
    vault.files.set('归档/网页剪藏/甲文.md', '旧内容');
    const p = writeClipNote({ platform: '果壳科学人', title: '甲文', url: 'https://guokr.com/1', body: '新正文' });
    await vi.waitFor(() => expect(flowAction(2)).toBeTruthy());
    const popup = document.getElementById('__shared_confirm_popup__')!;
    expect(popup.querySelector('h4')!.textContent).toBe('已存在同名剪藏');
    expect(popup.textContent).toContain('甲文.md');
    expect(popup.textContent).toContain('将覆盖现有摘要、标签与正文编辑');
    expect(popup.classList.contains('bz-clip-dialog-editorial')).toBe(true);
    // 覆盖更新为危险主动作：焦点反落首个非危险动作（取消），Enter=取消防误触
    expect(document.activeElement!.id).toBe('bz-flow-dialog-action-0');
    flowAction(2).click();
    expect(await p).toBe(true);
    expect(vault.files.get('归档/网页剪藏/甲文.md')).toContain('新正文');
  });

  it('另存为新剪藏：` · N` 序号去重循环后正常写盘，既有文件不动', async () => {
    const vault = boot();
    vault.files.set('归档/网页剪藏/乙文.md', '旧一');
    vault.files.set('归档/网页剪藏/乙文 · 2.md', '旧二');
    const p = writeClipNote({ platform: '果壳科学人', title: '乙文', url: 'https://guokr.com/2', body: '新文' });
    await vi.waitFor(() => expect(flowAction(1)).toBeTruthy());
    flowAction(1).click();
    expect(await p).toBe(true);
    expect(vault.files.get('归档/网页剪藏/乙文.md')).toBe('旧一');
    expect(vault.files.get('归档/网页剪藏/乙文 · 2.md')).toBe('旧二');
    expect(vault.files.get('归档/网页剪藏/乙文 · 3.md')).toContain('新文');
  });

  it('取消（按钮）= 现取消语义：不写盘返回 false', async () => {
    const vault = boot();
    vault.files.set('归档/网页剪藏/丙文.md', '旧内容');
    const p = writeClipNote({ platform: '果壳科学人', title: '丙文', url: 'https://guokr.com/3', body: '新文' });
    await vi.waitFor(() => expect(flowAction(0)).toBeTruthy());
    flowAction(0).click();
    expect(await p).toBe(false);
    expect(vault.files.get('归档/网页剪藏/丙文.md')).toBe('旧内容');
  });

  it('ESC = 取消语义，浮层随 flow-dialog 收口（clipbook-confirm 旧 id 退役）', async () => {
    const vault = boot();
    vault.files.set('归档/网页剪藏/丁文.md', '旧内容');
    const p = writeClipNote({ platform: '果壳科学人', title: '丁文', url: 'https://guokr.com/4', body: '新文' });
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_mask__')).toBeTruthy());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await p).toBe(false);
    expect(document.getElementById('__shared_confirm_mask__')).toBeFalsy();
    expect(vault.files.get('归档/网页剪藏/丁文.md')).toBe('旧内容');
  });
});

// ================= CB4/A3：剪藏目录路径单源 =================

describe('CB4/A3：剪藏目录路径单源（clipDir/clipFilePathOf）', () => {
  it('clipDir 尾斜杠归一 + 缺省串一处；clipFilePathOf 组装单一函数', () => {
    setDefaultSettings('归档/网页剪藏/');
    expect(clipDir()).toBe('归档/网页剪藏');
    expect(clipFilePathOf('标题')).toBe('归档/网页剪藏/标题.md');
    setDefaultSettings('归档/网页剪藏///');
    expect(clipDir()).toBe('归档/网页剪藏');
    setDefaultSettings('');
    expect(clipDir()).toBe('归档/网页剪藏'); // 缺省回退
  });

  it('尾斜杠设置下写盘路径无双斜杠，同名二次保存弹覆盖确认（修复前 miss 不弹）', async () => {
    setDefaultSettings('归档/网页剪藏/');
    const vault = boot();
    const ok = await writeClipNote({ platform: '果壳科学人', title: '尾文', url: 'https://guokr.com/9', body: '正文' });
    expect(ok).toBe(true);
    expect(vault.files.has('归档/网页剪藏/尾文.md')).toBe(true);
    expect(vault.files.has('归档/网页剪藏//尾文.md')).toBe(false);
    // 同名二次保存 → 覆盖确认弹出（单源前写盘路径双斜杠，预查 miss 不弹）
    const p = writeClipNote({ platform: '果壳科学人', title: '尾文', url: 'https://guokr.com/9', body: '二存' });
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_mask__')).toBeTruthy());
    flowAction(0).click();
    expect(await p).toBe(false);
  });

  it('尾斜杠设置下 flowSave 事件 clipPath 与写盘路径、扫描路径三者一致', async () => {
    setDefaultSettings('归档/网页剪藏/');
    const vault = seedNews([
      { platform: '果壳科学人', title: '单源文', url: 'https://guokr.com/10', author: '果壳', body: '正文', date: '2026-09-01 08:00:00' },
    ]);
    const saved: any[] = [];
    onDomainEvent('news', (e: any) => { if (e && e.kind === 'saved') saved.push(e); });
    const raw = JSON.parse(vault.files.get(getNewsFilePath())!).articles[0];
    expect(await flowSave({ raw })).toBe(true);
    expect(vault.files.has('归档/网页剪藏/单源文.md')).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0].clipPath).toBe('归档/网页剪藏/单源文.md');
    await drainNewsWritesForTests();
    // 扫描同一单源目录：刚写出的文件可见（读盘/扫描/事件同一路径）
    const notes = await scanClipDirectory(clipDir(), { vault });
    expect(notes).toHaveLength(1);
    expect(notes![0].path).toBe('归档/网页剪藏/单源文.md');
  });
});

// ================= 新-4：cleanClipTitleOf Windows 边界 =================

describe('新-4：cleanClipTitleOf Windows 命名边界', () => {
  it('尾点/尾空格剥除；保留设备名前置 _（大小写不敏感）；非法字符剥除', () => {
    expect(cleanClipTitleOf('结尾点.')).toBe('结尾点');
    expect(cleanClipTitleOf('尾空格 ')).toBe('尾空格');
    expect(cleanClipTitleOf('尾点尾空. . ')).toBe('尾点尾空');
    expect(cleanClipTitleOf('con')).toBe('_con');
    expect(cleanClipTitleOf('Nul')).toBe('_Nul');
    expect(cleanClipTitleOf('COM1')).toBe('_COM1');
    expect(cleanClipTitleOf('lpt9 ')).toBe('_lpt9');
    expect(cleanClipTitleOf('constant')).toBe('constant'); // 前缀命中不算保留名
    expect(cleanClipTitleOf('a?b/c:d*e')).toBe('abcde');
    expect(cleanClipTitleOf('')).toBe('');
  });

  it('保留名/尾点标题保存不再恒失败（落盘为 _con / 结尾点.md）', async () => {
    const vault = boot();
    expect(await writeClipNote({ platform: '果壳科学人', title: 'con', url: 'https://guokr.com/11', body: '正文' })).toBe(true);
    expect(await writeClipNote({ platform: '果壳科学人', title: '结尾点.', url: 'https://guokr.com/12', body: '正文' })).toBe(true);
    expect(vault.files.has('归档/网页剪藏/_con.md')).toBe(true);
    expect(vault.files.has('归档/网页剪藏/结尾点.md')).toBe(true);
  });
});

// ================= 效率#3 半：保存成功通知挂「打开笔记」 =================

describe('效率#3 半：保存成功通知挂「打开笔记」action', () => {
  it('success 通知带 action，点击 openLinkText 打开实际写盘路径', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    (app.workspace as any).openLinkText = vi.fn(async () => {});
    setApp(app);
    expect(await writeClipNote({ platform: '果壳科学人', title: '丁文', url: 'https://guokr.com/13', body: '正文' })).toBe(true);
    await vi.waitFor(() => {
      const el = [...document.querySelectorAll('.bz-notice--success')].find((n) => (n.textContent || '').includes('已保存：丁文'));
      expect(el).toBeTruthy();
    });
    const success = [...document.querySelectorAll('.bz-notice--success')].find((n) => (n.textContent || '').includes('已保存：丁文'))!;
    const action = success.querySelector('.bz-notice-action') as HTMLElement;
    expect(action.textContent).toBe('打开笔记');
    action.click();
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('归档/网页剪藏/丁文.md', '');
  });
});

// ================= CB10/A1：自建 overlay 卸载收口 =================

describe('CB10/A1：createOverlay 存活登记 + closeAllOverlays + unloadClipbook 兜底', () => {
  it('closeAllOverlays：开 UP 管理/RSS 管理 → 一处收口，close 幂等可复开', async () => {
    const vault = seedNews([]);
    void vault;
    const rows = dataSourceGroupRows({ ...emptyDataSourceState(true), bilibiliUps: ['33'] });
    const ctx: any = { rowEl: document.createElement('div'), refreshVisibility: () => {} };
    const upRow = rows.find((r) => (r as any).name === 'UP 主名单') as any;
    const rssRow = rows.find((r) => (r as any).name === 'RSS 订阅源') as any;
    await upRow.onClick(ctx);
    await rssRow.onClick(ctx);
    expect(document.getElementById('bz-up-manager-mask')).toBeTruthy();
    expect(document.getElementById('bz-rss-manager-mask')).toBeTruthy();
    closeAllOverlays();
    expect(document.getElementById('bz-up-manager-mask')).toBeFalsy();
    expect(document.getElementById('bz-up-manager-popup')).toBeFalsy();
    expect(document.getElementById('bz-rss-manager-mask')).toBeFalsy();
    expect(document.getElementById('bz-rss-manager-popup')).toBeFalsy();
    // close 复位单例旗标：同一按钮可再次打开
    await upRow.onClick(ctx);
    expect(document.getElementById('bz-up-manager-mask')).toBeTruthy();
    closeAllOverlays();
  });

  it('unloadClipbook：close 收口在开弹窗 + 按 id 摘残留（-mask/-popup 四 id）', async () => {
    const vault = seedNews([]);
    void vault;
    const rows = dataSourceGroupRows({ ...emptyDataSourceState(true), bilibiliUps: ['33'] });
    const ctx: any = { rowEl: document.createElement('div'), refreshVisibility: () => {} };
    const upRow = rows.find((r) => (r as any).name === 'UP 主名单') as any;
    await upRow.onClick(ctx);
    expect(document.getElementById('bz-up-manager-mask')).toBeTruthy();
    unloadClipbook();
    expect(document.getElementById('bz-up-manager-mask')).toBeFalsy();
    expect(document.getElementById('bz-up-manager-popup')).toBeFalsy();
    // 按 id 兜底：手工残留的四 id（模拟任何漏网路径）一并摘除
    for (const id of ['bz-up-manager-mask', 'bz-up-manager-popup', 'bz-rss-manager-mask', 'bz-rss-manager-popup']) {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
    unloadClipbook();
    for (const id of ['bz-up-manager-mask', 'bz-up-manager-popup', 'bz-rss-manager-mask', 'bz-rss-manager-popup']) {
      expect(document.getElementById(id)).toBeFalsy();
    }
  });

  it('createOverlay 缺省登记：closeAllOverlays 也能收口未注入 close 的自建遮罩', () => {
    const { mask, popup } = createOverlay({ maskId: 'bz-test-a-mask', popupId: 'bz-test-a-popup' });
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    closeAllOverlays();
    expect(document.getElementById('bz-test-a-mask')).toBeFalsy();
    expect(document.getElementById('bz-test-a-popup')).toBeFalsy();
  });
});

// ================= CB11 + A7：域事件载荷拦截与退订闭环 =================

describe('CB11 + A7：自动刷新事件拦截与退订闭环', () => {
  it('缺 path 载荷跳过；目录外跳过；unload 后不再 reload；open/unload 循环订阅不叠加', async () => {
    const vault = new MockVault();
    // 种「刚抓取过」的 lastFetchAt：openClipbook 的 void maybeFetchNews() 走间隔判定静默跳过，
    // 不触发 executeFetchRound（其完成回调也会调 reloadIfOpen，混入本测试的计数）
    vault.files.set(
      getNewsFilePath(),
      JSON.stringify({ articles: [], stats: {}, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: { zhihu: true, guokr: true, bilibili: true }, lastFetchAt: Date.now(), fetchIntervalMin: 30 })
    );
    setApp(mockAppWithVault(vault));
    const inDir = (p: string) => ({ path: p });
    openClipbook(getApp());
    // 目录内事件：300ms 防抖后 reload 一次（接线在位的 sanity）
    emitDomainEvent('clipping:file-created', inDir('归档/网页剪藏/甲.md'));
    await wait(500);
    expect(reloadIfOpen).toHaveBeenCalledTimes(1);
    // CB11：载荷缺 path 的异常事件显式跳过，不放行防抖全量重扫
    emitDomainEvent('clipping:file-created', {} as any);
    emitDomainEvent('clipping:file-created', null as any);
    await wait(500);
    expect(reloadIfOpen).toHaveBeenCalledTimes(1);
    // 目录外事件不触发
    emitDomainEvent('clipping:file-modified', inDir('其他目录/乙.md'));
    await wait(500);
    expect(reloadIfOpen).toHaveBeenCalledTimes(1);
    // A7：unload 后事件不再触发 reload（退订闭环）
    unloadClipbook();
    emitDomainEvent('clipping:file-created', inDir('归档/网页剪藏/丙.md'));
    await wait(500);
    expect(reloadIfOpen).toHaveBeenCalledTimes(1);
    // A7：open→unload 循环后重开，单事件只 reload 一次（订阅数不叠加）
    openClipbook(getApp());
    unloadClipbook();
    openClipbook(getApp());
    emitDomainEvent('clipping:file-modified', inDir('归档/网页剪藏/丁.md'));
    await wait(500);
    expect(reloadIfOpen).toHaveBeenCalledTimes(2);
    unloadClipbook();
  });
});
