/**
 * 豆瓣抓取队列测试（ADR-0113 / issue 255-256；ADR-0129 执行层迁入插件重写）：
 * sweep 入队口径 / 会话去重 / 执行器完成清 pending / 失败聚合通知（风控分文案）/
 * 硬超时 / **移动端启用**（spawn 退役：CLI/node 探测、绝对路径契约、退出信号轮询全部退役）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
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
  FETCH_TIMEOUT_MS,
  type FetchNote,
} from '../../src/cinema/douban-queue';
import type { DoubanFetchOutcome } from '../../src/cinema/douban-fetcher';

/** 等串行队列跑完（跨多个宏任务跳，25ms 足够 gapMs=refreshDelayMs=0 的链路收敛） */
const settle = () => new Promise((r) => setTimeout(r, 25));

/** 假执行器：成功形态——向笔记追加 海报/豆瓣链接 字段（模拟 fetcher 写回） */
function makeSuccessFetch(vault: MockVault) {
  const fetched: string[] = [];
  const fetch: FetchNote = async (file) => {
    fetched.push(file.path);
    const content = vault.files.get(file.path) ?? '';
    if (!/^海报:/m.test(content)) {
      vault.files.set(file.path, `${content.replace(/\n*$/, '\n')}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
    }
    return { ok: true };
  };
  return { fetched, fetch };
}

/** 测试注入基线：刷新延迟归零供 settle 消化 */
const TEST_HOOKS = { gapMs: 0, refreshDelayMs: 0 };

const okOutcome = (): DoubanFetchOutcome => ({ ok: true });

describe('豆瓣抓取队列（douban-queue，ADR-0129 执行器=插件内 fetch）', () => {
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
    M.appRef = app;
    rebuildItems(app);
    const { fetched, fetch } = makeSuccessFetch(vault);
    configureFetchQueue({ ...TEST_HOOKS, fetch });

    sweepDoubanFetch(app);
    await settle();

    expect(fetched).toHaveLength(2);
    expect(fetched.some((p) => p.includes('《全缺》'))).toBe(true);
    expect(fetched.some((p) => p.includes('《有海报缺链接》'))).toBe(true);
    expect(fetched.some((p) => p.includes('《齐全》'))).toBe(false);
    // 完成后 loading 清除
    expect(isFetching('我的/影视/《全缺》.md')).toBe(false);
  });

  it('会话内去重：第二次 sweep 零新抓取', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《缺信息》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    const { fetched, fetch } = makeSuccessFetch(vault);
    configureFetchQueue({ ...TEST_HOOKS, fetch });

    sweepDoubanFetch(app);
    await settle();
    expect(fetched).toHaveLength(1);
    // 成功后条目已齐；再扫一遍（即便条目仍缺也去重）零新增
    sweepDoubanFetch(app);
    await settle();
    expect(fetched).toHaveLength(1);
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
      fetch: async (file) => {
        await gate;
        const content = vault.files.get(file.path) ?? '';
        vault.files.set(file.path, `${content}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
        return okOutcome();
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
      fetch: async (file) => {
        await gate;
        const content = vault.files.get(file.path) ?? '';
        vault.files.set(file.path, `${content}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
        return okOutcome();
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

  it('执行器返回失败 → 失败聚合一条错误通知（含片名）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《小众片A》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    vault.files.set('我的/影视/《小众片B》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    configureFetchQueue({ ...TEST_HOOKS, fetch: async () => ({ ok: false, reason: 'notfound' }) });

    sweepDoubanFetch(app);
    await settle();

    expect(hasNotice(/豆瓣信息获取失败/)).toBe(true);
    expect(getNoticeMessages().some((m) => m.includes('小众片A') && m.includes('小众片B'))).toBe(true);
    // C5：重开面板 sweep 会被会话去重拦下、不会重试——文案如实指向重启重载
    expect(getNoticeMessages().some((m) => m.includes('重启 Obsidian（重载插件）后会自动重试'))).toBe(true);
    expect(getNoticeMessages().some((m) => m.includes('重开面板会自动重试'))).toBe(false);
  });

  it('风控失败单独聚合：文案含「豆瓣风控」且与一般失败分开', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《风控片》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    vault.files.set('我的/影视/《普通失败片》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    configureFetchQueue({
      ...TEST_HOOKS,
      fetch: async (file) => (file.name.includes('风控') ? { ok: false, reason: 'blocked' } : { ok: false, reason: 'notfound' }),
    });

    sweepDoubanFetch(app);
    await settle();

    expect(hasNotice(/豆瓣风控拦截/)).toBe(true);
    expect(hasNotice(/豆瓣信息获取失败/)).toBe(true);
    expect(getNoticeMessages().some((m) => m.includes('风控片') && m.includes('豆瓣风控'))).toBe(true);
    expect(getNoticeMessages().some((m) => m.includes('普通失败片') && m.includes('豆瓣风控'))).toBe(false);
    // C5：风控文案同步更正（重开面板不会重试，重启重载才会）
    expect(getNoticeMessages().some((m) => m.includes('豆瓣风控') && m.includes('重启 Obsidian（重载插件）后会自动重试'))).toBe(true);
  });

  it('移动端启用（ADR-0129）：无 child_process 环境照常入队执行', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《移动端新片》.md', '---\ntags: [电影]\n评分: 8\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    rebuildItems(app);
    const { fetched, fetch } = makeSuccessFetch(vault);
    configureFetchQueue({ ...TEST_HOOKS, fetch });

    // jsdom 无 window.require（≈移动端），旧 CLI 探测在此会静默禁用——现应照常入队
    expect(enqueueDoubanFetch(M.items[0].file!, '移动端新片')).toBe(true);
    await settle();
    expect(fetched).toHaveLength(1);
  });

  it('执行器抛异常按失败处理，不炸队列', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《抛异常》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    configureFetchQueue({ ...TEST_HOOKS, fetch: async () => { throw new Error('boom'); } });

    sweepDoubanFetch(app);
    await settle();
    expect(hasNotice(/豆瓣信息获取失败/)).toBe(true);
    expect(isFetching('我的/影视/《抛异常》.md')).toBe(false);
  });

  it('isFetching 时限兜底：pending 超过单条超时 + 余量即视为过期（执行器挂死 loading 不永转）', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    const path = '我的/影视/《超时》.md';
    vault.files.set(path, '---\ntags: [电影]\n评分: 8\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    rebuildItems(app);
    configureFetchQueue({ ...TEST_HOOKS, fetch: () => new Promise(() => {}) });
    sweepDoubanFetch(app);
    expect(isFetching(path)).toBe(true);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 30_000 + 1);
    expect(isFetching(path)).toBe(false);
  });

  it('C7：长队尾条目 loading 不提前过期（未开抓放宽时限；开抓后回归单条时限）', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    for (let i = 0; i < 20; i++) {
      vault.files.set(`我的/影视/《片${i}》.md`, '---\ntags: [电影]\n评分: 8\n---');
    }
    M.appRef = app;
    rebuildItems(app);
    const lastPath = M.items[M.items.length - 1].file!.path;
    const startedPaths: string[] = [];
    configureFetchQueue({
      gapMs: 15000, // 真实间隔：20 条队尾要等 ~4.5min 才开抓
      refreshDelayMs: 0,
      fetch: async (file) => {
        startedPaths.push(file.path);
        if (file.path === lastPath) return new Promise<DoubanFetchOutcome>(() => {}); // 尾条目悬挂
        return okOutcome();
      },
    });

    sweepDoubanFetch(app);
    // 推进 250s（已超单条 3min+30s 时限）：尾条目仍在队列未开抓，loading 不应消失
    await vi.advanceTimersByTimeAsync(250_000);
    expect(startedPaths).not.toContain(lastPath);
    expect(isFetching(lastPath)).toBe(true); // 修复前：入队时刻打点已过期 → false
    // 推进到尾条目真正开抓（≈300s），打点已刷新
    await vi.advanceTimersByTimeAsync(55_000);
    expect(startedPaths).toContain(lastPath);
    expect(isFetching(lastPath)).toBe(true);
    // 开抓后再推 3.5min → 单条时限过期（执行器挂死 loading 也不永转）
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 30_000 + 1);
    expect(isFetching(lastPath)).toBe(false);
  });

  it('单条硬超时：执行器悬挂超过 FETCH_TIMEOUT_MS 按失败收（Promise.race 兜底）', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    vault.files.set('我的/影视/《悬挂》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    configureFetchQueue({ ...TEST_HOOKS, fetch: () => new Promise<DoubanFetchOutcome>(() => {}) });
    sweepDoubanFetch(app);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 1);
    // fake timers 下 settle 的真实 setTimeout 永不到点——先回真实时钟再等队列收尾
    vi.useRealTimers();
    await settle();
    expect(hasNotice(/豆瓣信息获取失败/)).toBe(true);
  });
});

describe('豆瓣抓取队列·frontmatter 契约', () => {
  it('完成验证容忍 YAML 引号（fetcher 写入形态）', () => {
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《引号》.md',
      '---\ntags: [电影]\n评分: 8\n海报: "CONFIG/MOVIE POSTER/a.jpg"\n豆瓣链接: "https://movie.douban.com/subject/1/"\n---',
    );
    expect(vault.files.get('我的/影视/《引号》.md')).toContain('海报: "CONFIG/MOVIE POSTER/a.jpg"');
  });

  it('enqueueDoubanFetch：file 为 null 静默跳过', () => {
    configureFetchQueue({ ...TEST_HOOKS, fetch: async () => okOutcome() });
    expect(() => enqueueDoubanFetch(null, 'X')).not.toThrow();
  });

  it('pcardHtml fetching：海报遮罩 spinner 只在抓取中渲染', () => {
    const it: CinemaItem = {
      file: null, name: 'X', typeTag: '电影', group: '电影', watchDate: null, rating: null,
      status: 2, poster: null, review: null, genre: null, director: null, actors: null,
      region: null, year: null, releaseDate: null, doubanRating: null, doubanUrl: null, synopsis: null,
      duration: null, seasonText: null, hotComment: null,
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
    configureFetchQueue({ ...TEST_HOOKS, fetch: () => gate.then(() => ({ ok: false, reason: 'notfound' as const })) });
    expect(enqueueDoubanFetch(a.file!, '甲')).toBe(true);
    expect(isFetching(a.file!.path)).toBe(true);
    // 模拟删除成功（openConfirm → dequeueDoubanFetch）
    dequeueDoubanFetch(a.file!.path);
    expect(isFetching(a.file!.path)).toBe(false); // pending 撤销（loading 不再挂）
    release(); // 执行器返回（抓不到已删文件 → 失败形态）
    await settle();
    // 失败聚合通知不含已删片名（旧缺陷：十几秒后弹「以下影片获取失败：《甲》」且「重启后会自动重试」不实）
    expect(getNoticeMessages().join('\n')).not.toContain('甲');
  });

  it('排队中（未开始）的影片被删除 → 移出队列零抓取', async () => {
    const vault = new MockVault();
    const [a, b] = seedTwo(vault);
    const fetched: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    configureFetchQueue({
      ...TEST_HOOKS,
      fetch: async (file) => {
        fetched.push(file.path);
        await gate;
        return { ok: false, reason: 'notfound' };
      },
    });
    enqueueDoubanFetch(a.file!, '甲');
    enqueueDoubanFetch(b.file!, '乙'); // 排队中
    dequeueDoubanFetch(b.file!.path); // 删除乙
    release(); // 甲完成，队列继续
    await settle();
    expect(fetched.length).toBe(1); // 只有甲被抓
    expect(getNoticeMessages().join('\n')).not.toContain('乙');
  });

  it('C10：删除影片清除会话去重标记，同名重建可再入队补抓', async () => {
    const vault = new MockVault();
    const [a] = seedTwo(vault);
    configureFetchQueue({ ...TEST_HOOKS, fetch: async () => okOutcome() });
    expect(enqueueDoubanFetch(a.file!, '甲')).toBe(true);
    dequeueDoubanFetch(a.file!.path); // 删除（出队 + cancelled + attempted 清除）
    // 同名重建（路径相同）再入队：修复前 attempted 残留 → 永不补抓
    expect(enqueueDoubanFetch(a.file!, '甲')).toBe(true);
  });

  it('批C回归：删过未入队影片不留 cancelled 残留——同名重建后真失败必须记失败通知（不被豁免）', async () => {
    const vault = new MockVault();
    const [a] = seedTwo(vault);
    configureFetchQueue({ ...TEST_HOOKS, fetch: async () => ({ ok: false, reason: 'notfound' }) });
    // 删除一部**从未入队**的影片（openConfirm → dequeueDoubanFetch；队列/去重无条目可清）
    dequeueDoubanFetch(a.file!.path);
    // 同名重建（同路径）入队 → 首次抓取失败
    expect(enqueueDoubanFetch(a.file!, '甲')).toBe(true);
    await settle();
    // 修复前：dequeue 无条件记 cancelled、enqueue 不清残留 → pump 把真失败当「在抓被删」静默吞。
    // G8 豁免只该覆盖「在抓被删」那一次，重建后的条目是活条目，失败必须聚合计入通知
    expect(hasNotice(/豆瓣信息获取失败/)).toBe(true);
    expect(getNoticeMessages().some((m) => m.includes('甲'))).toBe(true);
  });

  it('审计#12（issue 337）：抓取目标被插件外删除 → 写回前守卫静默出队，零通知，同名重建可重抓', async () => {
    const vault = new MockVault();
    const [a] = seedTwo(vault);
    const path = a.file!.path;
    M.appRef = mockAppWithVault(vault); // 守卫读 M.appRef.vault 存在性（G8 路径之外的删除）
    const fetched: string[] = [];
    configureFetchQueue({
      ...TEST_HOOKS,
      fetch: async (file) => {
        fetched.push(file.path);
        return okOutcome();
      },
    });
    expect(enqueueDoubanFetch(a.file!, '甲')).toBe(true);
    vault.files.delete(path); // 抓取期间被插件外删除（不经 dequeueDoubanFetch，取消集合不含它）
    await settle();
    expect(fetched).toEqual([path]); // 抓取照跑，守卫在写回前接住
    expect(getNoticeMessages()).toEqual([]); // 静默：不进失败聚合（外部删除是用户意图，文案「会自动重试」对它不成立）
    expect(isFetching(path)).toBe(false);
    // attempted 已清：同名重建（同路径）可重新入队补抓（对齐 G8/C10 语义）
    vault.files.set(path, '---\ntags: [电影]\n评分: -1\n---');
    const rebuilt = M.appRef!.vault.getAbstractFileByPath(path) as any;
    expect(enqueueDoubanFetch(rebuilt, '甲')).toBe(true);
  });

  it('审计#12 对照：文件存在时守卫不误伤，写回照常零通知', async () => {
    const vault = new MockVault();
    const [a] = seedTwo(vault);
    M.appRef = mockAppWithVault(vault);
    const { fetched, fetch } = makeSuccessFetch(vault);
    configureFetchQueue({ ...TEST_HOOKS, fetch });
    expect(enqueueDoubanFetch(a.file!, '甲')).toBe(true);
    await settle();
    expect(fetched).toEqual([a.file!.path]);
    expect(vault.files.get(a.file!.path)).toContain('豆瓣链接');
    expect(getNoticeMessages()).toEqual([]);
  });
});
