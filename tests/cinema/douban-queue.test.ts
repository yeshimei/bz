/**
 * 豆瓣抓取队列测试（ADR-0113 / issue 255 / issue 256 修订）：
 * sweep 入队口径 / 会话去重 / spawn 完成验证清 pending / 失败聚合通知 / 硬超时杀进程 / 移动端禁用
 * issue 256：spawn 收宿主绝对路径（adapter.getFullPath）/ 完成后重建渲染 / 入口双探测（cli+node）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { MockVault, mockAppWithVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks, hasNotice, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetCinemaState, type CinemaItem } from '../../src/cinema/state';
import { pcardHtml } from '../../src/cinema/shared';
import { rebuildItems } from '../../src/cinema/data';
import {
  enqueueDoubanFetch,
  dequeueDoubanFetch,
  sweepDoubanFetch,
  isFetching,
  shutdownDoubanQueue,
  configureFetchQueue,
  waitForExit,
  FETCH_TIMEOUT_MS,
} from '../../src/cinema/douban-queue';

/** 等串行队列跑完（跨多个宏任务跳，25ms 足够 gapMs=refreshDelayMs=0 的链路收敛） */
const settle = () => new Promise((r) => setTimeout(r, 25));

/** mock adapter 的绝对路径前缀（见 mock-vault getFullPath），spawn 收绝对路径需映射回相对取内容 */
const toRel = (p: string) => p.replace(/^\/mock-vault-root\//, '');

/** 假 spawn：成功形态——向笔记追加 海报/豆瓣链接 字段（模拟工具写回） */
function makeSuccessSpawn(vault: MockVault) {
  const spawned: string[] = [];
  const spawn = async (_cli: string, notePath: string) => {
    spawned.push(notePath);
    const rel = toRel(notePath);
    const content = vault.files.get(rel) ?? '';
    if (!/^海报:/m.test(content)) vault.files.set(rel, `${content.replace(/\n*$/, '\n')}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
  };
  return { spawned, spawn };
}

/** 测试注入基线：jsdom 无 window.require，node/CLI 路径必须注入；刷新延迟归零供 settle 消化 */
const TEST_HOOKS = { cli: 'C:/fake/cli.js', node: 'C:/fake/node.exe', gapMs: 0, refreshDelayMs: 0 };

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

  it('sweep：缺海报或缺链接的条目入队（继承守护全责），齐全条目不碰；spawn 收宿主绝对路径', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《全缺》.md', '---\ntags: [电影]\n评分: 8\n---');
    vault.files.set('我的/影视/《有海报缺链接》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    vault.files.set('我的/影视/《齐全》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    rebuildItems(app);
    const { spawned, spawn } = makeSuccessSpawn(vault);
    configureFetchQueue({ ...TEST_HOOKS, spawn });

    sweepDoubanFetch(app);
    await settle();

    expect(spawned).toHaveLength(2);
    // issue 256：相对路径会被 CLI 拼到影片目录下双拼——必须是 adapter 解析的宿主绝对路径
    for (const p of spawned) expect(p).toMatch(/^\/mock-vault-root\//);
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
    configureFetchQueue({ ...TEST_HOOKS, spawn });

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
    M.appRef = app;
    rebuildItems(app);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    configureFetchQueue({
      ...TEST_HOOKS,
      spawn: async (_cli, notePath) => {
        await gate;
        const rel = toRel(notePath);
        vault.files.set(rel, `${vault.files.get(rel) ?? ''}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
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

  it('渲染联动：sweep 新增即渲染（loading 首帧可见）；完成后重建+渲染两次（立即退场+延迟上卡）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《缺信息》.md', '---\ntags: [电影]\n评分: 8\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    rebuildItems(app);
    M.currentOverlay = document.createElement('div');
    const renderFn = vi.fn();
    M.renderFn = renderFn;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    configureFetchQueue({
      ...TEST_HOOKS,
      spawn: async (_cli, notePath) => {
        await gate;
        const rel = toRel(notePath);
        vault.files.set(rel, `${vault.files.get(rel) ?? ''}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
      },
    });

    sweepDoubanFetch(app);
    // 入队即渲染：此前 renderFn 从未被调
    expect(renderFn).toHaveBeenCalledTimes(1);

    release();
    await settle();
    // 完成后：立即一次（loading 退场）+ refreshDelayMs=0 的延迟一次（海报/链接上卡）
    expect(renderFn).toHaveBeenCalledTimes(3);
  });

  it('spawn 成功但字段未到齐（搜索无结果）→ 失败聚合一条错误通知（含片名）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《小众片A》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    vault.files.set('我的/影视/《小众片B》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    configureFetchQueue({ ...TEST_HOOKS, spawn: async () => {} });

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

  it('node 不可用（显式 \'\'）→ 入队静默跳过（缺 Node 环境不当抓取失败上报）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《缺信息》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    const spawn = vi.fn();
    // node '' 语义=探测过但不可用（jsdom 无 window.require ≈ 移动端/无 Node 静默禁用）
    configureFetchQueue({ cli: 'C:/fake/cli.js', node: '', spawn, gapMs: 0, refreshDelayMs: 0 });

    sweepDoubanFetch(app);
    await settle();

    expect(spawn).not.toHaveBeenCalled();
  });

  it('完成信号兜底：spawn 迟迟不退出但字段落盘 → 轮询清 loading（用户实测退出信号丢失形态）', async () => {
    const vault = new MockVault();
    const path = '我的/影视/《信号丢失》.md';
    vault.files.set(path, '---\ntags: [电影]\n评分: 8\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    rebuildItems(app);
    configureFetchQueue({
      ...TEST_HOOKS,
      pollMs: 10,
      spawn: async (_cli, notePath) => {
        // 字段先落盘，进程永不退出（模拟宿主内 spawn 退出事件丢失/CLI 收尾迟滞）
        const rel = toRel(notePath);
        vault.files.set(rel, `${(vault.files.get(rel) ?? '').replace(/\n*$/, '\n')}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
        await new Promise(() => {});
      },
    });

    sweepDoubanFetch(app);
    expect(isFetching(path)).toBe(true);
    for (let i = 0; i < 100 && isFetching(path); i++) await new Promise((r) => setTimeout(r, 10));
    expect(isFetching(path)).toBe(false);
    // 轮询收尾算成功：不进失败聚合通知
    await settle();
    expect(hasNotice(/豆瓣信息获取失败/)).toBe(false);
  });

  it('isFetching 时限兜底：pending 超过单条超时 + 余量即视为过期（双信号全失 loading 不永转）', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    const path = '我的/影视/《超时》.md';
    vault.files.set(path, '---\ntags: [电影]\n评分: 8\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    rebuildItems(app);
    configureFetchQueue({ ...TEST_HOOKS, spawn: () => new Promise(() => {}) });
    sweepDoubanFetch(app);
    expect(isFetching(path)).toBe(true);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 30_000 + 1);
    expect(isFetching(path)).toBe(false);
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
    configureFetchQueue({ ...TEST_HOOKS, spawn: async () => {} });
    expect(() => enqueueDoubanFetch(null, 'X')).not.toThrow();
  });

  it('pcardHtml fetching：海报遮罩 spinner 只在抓取中渲染', () => {
    const it: CinemaItem = {
      file: null, name: 'X', typeTag: '电影', group: '电影', watchDate: null, rating: null,
      status: 2, poster: null, review: null, genre: null, director: null, actors: null,
      region: null, year: null, doubanRating: null, doubanUrl: null, synopsis: null,
      duration: null, seasonText: null,
    };
    expect(pcardHtml(it, null, true)).toContain('pw-fetch');
    expect(pcardHtml(it, null, false)).not.toContain('pw-fetch');
  });
});


describe('G8：删除影片出队豆瓣抓取队列', () => {
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

  function seedTwo(vault: MockVault) {
    vault.files.set('我的/影视/《甲》.md', '---\ntags: [电影]\n评分: -1\n---');
    vault.files.set('我的/影视/《乙》.md', '---\ntags: [电影]\n评分: -1\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    return M.items.slice();
  }

  it('正在抓取的影片被删除 → 取消集合消费，不记失败通知、pending 撤销', async () => {
    const vault = new MockVault();
    const [a] = seedTwo(vault);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    configureFetchQueue({ ...TEST_HOOKS, spawn: () => gate });
    expect(enqueueDoubanFetch(a.file!, '甲')).toBe(true);
    expect(isFetching(a.file!.path)).toBe(true);
    // 模拟删除成功（openConfirm → dequeueDoubanFetch）
    dequeueDoubanFetch(a.file!.path);
    expect(isFetching(a.file!.path)).toBe(false); // pending 撤销（loading 不再挂）
    release(); // spawn 退出（抓不到已删文件 → 失败形态）
    await settle();
    // 失败聚合通知不含已删片名（旧缺陷：十几秒后弹「以下影片获取失败：《甲》」且「重启后会自动重试」不实）
    expect(getNoticeMessages().join('\n')).not.toContain('甲');
  });

  it('排队中（未开始）的影片被删除 → 移出队列零 spawn', async () => {
    const vault = new MockVault();
    const [a, b] = seedTwo(vault);
    const spawned: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    configureFetchQueue({
      ...TEST_HOOKS,
      spawn: async (_cli: string, p: string) => {
        spawned.push(p);
        await gate;
      },
    });
    enqueueDoubanFetch(a.file!, '甲');
    enqueueDoubanFetch(b.file!, '乙'); // 排队中
    dequeueDoubanFetch(b.file!.path); // 删除乙
    release(); // 甲完成，队列继续
    await settle();
    expect(spawned.length).toBe(1); // 只有甲被抓
    expect(getNoticeMessages().join('\n')).not.toContain('乙');
  });
});
