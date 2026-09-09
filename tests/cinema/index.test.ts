/**
 * 影院（cinema）入口/目录回落 + 事件补发测试（ADR-0087 接管旧 movie 域）
 * - ensureCinema：cinemaFolderPath 显式配置生效；缺省回落「我的/影视」
 * - quickAddWant：发 movie:created(want) 域事件（smartcat 行为流依赖）+ 建笔记 + 入抓取队列
 * - runAIRecommend / 快速状态窗 / 删除等事件补发由 ui.test / recommend.test 覆盖
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { onDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { ensureCinema, unloadCinema, applyDefaultView, openCinema, openCinemaAnalysis } from '../../src/cinema';
import { quickAddWant } from '../../src/cinema/recommend';
import { configureFetchQueue, isFetching, shutdownDoubanQueue } from '../../src/cinema/douban-queue';

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

  /** 假 spawn：写回海报+豆瓣链接（模拟工具成功），记录调用。
   *  spawn 收到 adapter.getFullPath 绝对路径，映射回 vault 相对路径取内容 */
  function successSpawn(vault: MockVault) {
    const spawned: string[] = [];
    const spawn = async (_cli: string, notePath: string) => {
      spawned.push(notePath);
      const rel = notePath.replace(/^\/mock-vault-root\//, '');
      vault.files.set(rel, `${vault.files.get(rel) ?? ''}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
    };
    return { spawned, spawn };
  }

  it('openCinema → 有海报缺链接的笔记入队抓取并清 pending（静默无通知）', async () => {
    setSettingsProvider(() => ({} as any));
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《缺信息》.md',
      '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---',
    );
    const app = makeApp(vault);
    const { spawned, spawn } = successSpawn(vault);
    configureFetchQueue({ cli: 'C:/fake/cli.js', node: 'C:/fake/node.exe', spawn, gapMs: 0, refreshDelayMs: 0 });
    openCinema(app);
    await new Promise((r) => setTimeout(r, 25));
    expect(spawned).toHaveLength(1);
    expect(spawned[0]).toContain('《缺信息》');
    expect(isFetching('我的/影视/《缺信息》.md')).toBe(false);
    // 完全静默（ADR-0113 拍板）：抓取不发任何通知
    expect(getNoticeMessages()).toEqual([]);
  });

  it('openCinemaAnalysis（面板未开分支）同样触发入队', async () => {
    setSettingsProvider(() => ({} as any));
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《缺信息》.md',
      '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---',
    );
    const app = makeApp(vault);
    const { spawned, spawn } = successSpawn(vault);
    configureFetchQueue({ cli: 'C:/fake/cli.js', node: 'C:/fake/node.exe', spawn, gapMs: 0, refreshDelayMs: 0 });
    openCinemaAnalysis(app);
    await new Promise((r) => setTimeout(r, 25));
    expect(spawned).toHaveLength(1);
  });
});
