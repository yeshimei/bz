/**
 * 豆瓣抓取队列测试（ADR-0113 / issue 255）：
 * sweep 入队口径 / 会话去重 / spawn 完成验证清 pending / 失败聚合通知 / 硬超时杀进程 / 移动端禁用
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { MockVault, mockAppWithVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks, hasNotice, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import {
  enqueueDoubanFetch,
  sweepDoubanFetch,
  isFetching,
  shutdownDoubanQueue,
  configureFetchQueue,
  waitForExit,
  FETCH_TIMEOUT_MS,
} from '../../src/cinema/douban-queue';

/** 等串行队列跑完（跨多个宏任务跳，25ms 足够 gapMs=0 的链路收敛） */
const settle = () => new Promise((r) => setTimeout(r, 25));

/** 假 spawn：成功形态——向笔记追加 海报/豆瓣链接 字段（模拟工具写回） */
function makeSuccessSpawn(vault: MockVault) {
  const spawned: string[] = [];
  const spawn = async (_cli: string, notePath: string) => {
    spawned.push(notePath);
    const content = vault.files.get(notePath) ?? '';
    if (!/^海报:/m.test(content)) vault.files.set(notePath, `${content.replace(/\n*$/, '\n')}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
  };
  return { spawned, spawn };
}

describe('豆瓣抓取队列（douban-queue）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    shutdownDoubanQueue();
    clearNotices();
    M.folderPath = '我的/影视';
  });

  afterEach(() => {
    shutdownDoubanQueue();
    vi.useRealTimers();
  });

  it('sweep：缺海报或缺链接的条目入队（继承守护全责），齐全条目不碰', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《全缺》.md', '---\ntags: [电影]\n评分: 8\n---');
    vault.files.set('我的/影视/《有海报缺链接》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    vault.files.set('我的/影视/《齐全》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    const { spawned, spawn } = makeSuccessSpawn(vault);
    configureFetchQueue({ cli: 'C:/fake/cli.js', spawn, gapMs: 0 });

    sweepDoubanFetch(app);
    await settle();

    expect(spawned).toHaveLength(2);
    expect(spawned.some((p) => p.includes('《全缺》'))).toBe(true);
    expect(spawned.some((p) => p.includes('《有海报缺链接》'))).toBe(true);
    expect(spawned.some((p) => p.includes('《齐全》'))).toBe(false);
    // 完成后 loading 清除
    expect(isFetching('我的/影视/《全缺》.md')).toBe(false);
  });

  it('会话内去重：第二次 sweep 零新 spawn', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《缺信息》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    const { spawned, spawn } = makeSuccessSpawn(vault);
    configureFetchQueue({ cli: 'C:/fake/cli.js', spawn, gapMs: 0 });

    sweepDoubanFetch(app);
    await settle();
    expect(spawned).toHaveLength(1);
    // 成功后条目已齐；再扫一遍（即便条目仍缺也去重）零新增
    sweepDoubanFetch(app);
    await settle();
    expect(spawned).toHaveLength(1);
  });

  it('抓取中 isFetching=true，完成后清除；重开面板（再 sweep）不重复', async () => {
    const vault = new MockVault();
    const path = '我的/影视/《缺信息》.md';
    vault.files.set(path, '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    configureFetchQueue({
      cli: 'C:/fake/cli.js',
      gapMs: 0,
      spawn: async (_cli, notePath) => {
        await gate;
        vault.files.set(notePath, `${vault.files.get(notePath) ?? ''}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
      },
    });

    sweepDoubanFetch(app);
    expect(isFetching(path)).toBe(true);
    release();
    await settle();
    expect(isFetching(path)).toBe(false);
    sweepDoubanFetch(app);
    await settle();
    expect(isFetching(path)).toBe(false);
  });

  it('spawn 成功但字段未到齐（搜索无结果）→ 失败聚合一条错误通知（含片名）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《小众片A》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    vault.files.set('我的/影视/《小众片B》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    configureFetchQueue({ cli: 'C:/fake/cli.js', spawn: async () => {}, gapMs: 0 });

    sweepDoubanFetch(app);
    await settle();

    expect(hasNotice(/豆瓣信息获取失败/)).toBe(true);
    expect(getNoticeMessages().some((m) => m.includes('小众片A') && m.includes('小众片B'))).toBe(true);
  });

  it('CLI 不可用（未配置）→ 入队静默跳过，零 spawn 零通知', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《缺信息》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    const spawn = vi.fn();
    configureFetchQueue({ cli: '', spawn });
    // 注：cli '' 语义=探测过但不可用（jsdom 无 window.require ≈ 移动端静默禁用）

    sweepDoubanFetch(app);
    await settle();

    expect(spawn).not.toHaveBeenCalled();
    expect(getNoticeMessages()).toEqual([]);
  });

  it('waitForExit：正常退出 clearTimeout 不杀；超时 kill 兜底并 resolve', async () => {
    vi.useFakeTimers();
    const child = new EventEmitter();
    const kill = vi.fn();
    const p = waitForExit(child, FETCH_TIMEOUT_MS, kill);
    child.emit('close');
    await expect(p).resolves.toBeUndefined();
    expect(kill).not.toHaveBeenCalled();

    const child2 = new EventEmitter();
    const kill2 = vi.fn();
    const p2 = waitForExit(child2, FETCH_TIMEOUT_MS, kill2);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 1);
    await expect(p2).resolves.toBeUndefined();
    expect(kill2).toHaveBeenCalledTimes(1);
  });
});

describe('豆瓣抓取队列·frontmatter 契约', () => {
  it('完成验证容忍 YAML 引号（工具写入形态）', () => {
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《引号》.md',
      '---\ntags: [电影]\n评分: 8\n海报: "CONFIG/MOVIE POSTER/a.jpg"\n豆瓣链接: "https://movie.douban.com/subject/1/"\n---',
    );
    const fm = parseFrontmatter(vault.files.get('我的/影视/《引号》.md')!);
    expect(String(fm!['海报'])).toContain('CONFIG/MOVIE POSTER');
    expect(String(fm!['豆瓣链接'])).toContain('https://');
  });

  it('enqueueDoubanFetch：file 为 null 静默跳过', () => {
    configureFetchQueue({ cli: 'C:/fake/cli.js', spawn: async () => {}, gapMs: 0 });
    expect(() => enqueueDoubanFetch(null, 'X')).not.toThrow();
  });
});
