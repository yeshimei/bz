/**
 * 影院（cinema）入口/目录回落 + 事件补发测试（ADR-0087 接管旧 movie 域）
 * - ensureCinema：cinemaFolderPath 显式配置生效；缺省回落「我的/影视」
 * - quickAddWant：发 movie:created(want) 域事件（smartcat 行为流依赖）+ progress 通知 + 建笔记
 * - runAIRecommend / 快速状态窗 / 删除等事件补发由 ui.test / recommend.test 覆盖
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { onDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { ensureCinema, unloadCinema, applyDefaultView, openCinema, openCinemaAnalysis } from '../../src/cinema';
import { quickAddWant } from '../../src/cinema/recommend';
import { todayStr } from '../../src/cinema/douban-sweep';

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

  it('加入想看 → 建笔记 + 发 movie:created(want) 事件 + progress 通知', async () => {
    const seen: any[] = [];
    const off = onDomainEvent('movie', (evt) => seen.push(evt));
    const vault = new MockVault();
    const app = makeApp(vault);
    await quickAddWant(app, '新片', '电影');

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ kind: 'created', name: '新片', status: 'want', rating: null });
    expect((vault.files as any).get('我的/影视/《新片》.md')).toContain('评分: -1');
    // progress 通知（poster 占位轮询等待；进度通知不自动消失）
    expect(document.querySelector('.bz-notice--progress')?.textContent).toContain('正在获取海报');
    off();
  });
});

describe('cinema 打开面板触发豆瓣触碰（ADR-0111）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearNotices();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
  });
  afterEach(() => {
    unloadCinema();
    setSettingsProvider(() => ({} as any));
  });

  it('openCinema → 有海报缺链接的笔记被写入当日 豆瓣检查（静默无通知）', async () => {
    setSettingsProvider(() => ({} as any));
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《缺信息》.md',
      '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---',
    );
    const app = makeApp(vault);
    openCinema(app);
    // sweep 是 fire-and-forget 异步：等微任务+宏任务清空后断言
    await new Promise((r) => setTimeout(r, 0));
    const fm = parseFrontmatter(vault.files.get('我的/影视/《缺信息》.md')!);
    expect(fm!['豆瓣检查']).toBe(todayStr());
    // 完全静默（ADR-0111 拍板）：触碰不发任何通知
    expect(getNoticeMessages()).toEqual([]);
  });

  it('openCinemaAnalysis（面板未开分支）同样触发触碰', async () => {
    setSettingsProvider(() => ({} as any));
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《缺信息》.md',
      '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---',
    );
    const app = makeApp(vault);
    openCinemaAnalysis(app);
    await new Promise((r) => setTimeout(r, 0));
    const fm = parseFrontmatter(vault.files.get('我的/影视/《缺信息》.md')!);
    expect(fm!['豆瓣检查']).toBe(todayStr());
  });
});
