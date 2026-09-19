/**
 * 游戏库批 A（同步链与队列架构，分支 bz-fix-gs-sync）修复回归。
 * 对照深审报告编号，逐项锁行为：
 * - F1  autoSyncOnOpen 返回 runSync promise（fire-and-forget 曾让三队列整批漏启动）
 * - A1  rebuildItems 未变条目复用旧对象（队列就地写的成果不脱靶）
 * - A2  metadataCache 未就绪保留既有条目（cinema 同款守卫）
 * - A3  backfill scheduleRerender 统一节流（首沿）语义
 * - F6  unloadBackfill 不复位 running（无双消费者）
 * - F7  无中文名款会话级负缓存收敛
 * - F8  媒体下载 20s 超时兜底（挂起图不堵死串行队列）
 * - F11 目录尾斜杠归一化
 * - F12 消歧文件名展示名剥尾巴
 * - A4  readSteamConfig 正典下沉 state.ts（sync 仅转发）
 * - A6  posterDisplayUrl 死代码删除
 * - A7  frontmatter 键台账守卫（GS_FM/GS_LEGACY_FM ↔ reconcile 同值）
 * - C6  synced 域事件契约
 * - S2  队列熔断人话通知收尾
 * 另补 open/close/unload 状态清理对称断言（深审测试缺口 3）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { parseFm } from '../helpers/frontmatter';
import { requestUrl } from 'obsidian';
import { autoSyncOnOpen, runSync } from '../../src/gameshelf/sync';
import { rebuildItems, upsertDetail } from '../../src/gameshelf/notes';
import { ensureZhNames, resetZhNameNoLocale, setZhNameInterval, unloadZhNames, ZH_NAME_MAX_FAILURES } from '../../src/gameshelf/names';
import { ensureBackfill, setBackfillInterval, unloadBackfill } from '../../src/gameshelf/backfill';
import { ensurePosters, unloadPosters, setMediaInterval } from '../../src/gameshelf/posters';
import { DEFAULT_FOLDER, M, resetGameshelfState, resolveGameshelfFolderPath, readSteamConfig, type GameItem } from '../../src/gameshelf/state';
import { readSteamConfig as syncReadSteamConfig } from '../../src/gameshelf/sync';
import { LEGACY_KEY_MAP, managedFm } from '../../src/gameshelf/reconcile';
import { GS_FM, GS_LEGACY_FM } from '../../src/gameshelf/constants';
import * as postersNs from '../../src/gameshelf/posters';
import { onDomainEvent } from '../../src/core/domain-bus';
import { openGameshelf, unloadGameshelf } from '../../src/gameshelf';
import { closePanel } from '../../src/gameshelf/ui';

/* ---------- mock 组装（sync.test 同范式；getFileCache 可注入未就绪） ---------- */

const vault = new MockVault();

function makeApp(opts?: { cacheMiss?: (path: string) => boolean }) {
  return {
    vault,
    metadataCache: {
      getFileCache: (file: any) =>
        opts?.cacheMiss?.(file.path) ? undefined : { frontmatter: parseFm(vault, file.path) },
    },
    fileManager: {
      processFrontMatter: async (file: any, cb: (fm: Record<string, any>) => void) => {
        const fm = parseFm(vault, file.path);
        cb(fm);
        const raw = vault.files.get(file.path)!;
        const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '');
        vault.files.set(file.path, fmText(fm) + body);
      },
    },
  } as any;
}

/** serializeFm 薄转发（helper 直引亦可，留名以对齐 sync.test 口径） */
import { serializeFm as fmText } from '../helpers/frontmatter';

function setup(settings: Record<string, unknown>) {
  setApp({ vault } as any);
  setSettingsProvider(() => settings as any);
}

const CONFIG = {
  gameshelfSteamId: '76561198366147295',
  gameshelfSteamApiKey: 'k'.repeat(32),
  gameshelfFolderPath: DEFAULT_FOLDER,
};

/** Steam 库 + 商店中文名双接口 mock（GetOwnedGames / appdetails 各回各的） */
function mockSteam(ownedGames: any[], zhName = '中文名A') {
  (requestUrl as any).mockImplementation(async (opts: { url: string }) => {
    const url = String(opts.url);
    if (url.includes('GetRecentlyPlayedGames')) {
      return { status: 200, text: JSON.stringify({ response: { total_count: 0 } }), json: { response: { total_count: 0 } } };
    }
    if (url.includes('GetOwnedGames')) {
      const json = { response: { game_count: ownedGames.length, games: ownedGames } };
      return { status: 200, text: JSON.stringify(json), json };
    }
    if (url.includes('/api/appdetails')) {
      return { status: 200, json: [{ success: true, data: { name: zhName } }], text: '' };
    }
    return { status: 200, arrayBuffer: new ArrayBuffer(8) };
  });
}

function item(appid: number, name: string, over: Partial<GameItem> = {}): GameItem {
  return {
    file: null, appid, name, zhName: null, playtimeMin: 0, lastPlayed: '',
    cover: null, coverSrc: null, icon: null, iconSrc: null,
    windowsMin: 0, deckMin: 0, macMin: 0, linuxMin: 0, hasAch: false, offShelf: false, syncedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vault.files.clear();
  vault.binaryFiles.clear();
  vault.dirs.clear();
  document.body.innerHTML = '';
  resetGameshelfState();
  resetObsidianMocks();
  clearNotices();
  (requestUrl as any).mockReset();
  resetZhNameNoLocale();
  setZhNameInterval(0);
  setBackfillInterval(0);
  setMediaInterval(0);
  setup(CONFIG);
});

afterEach(() => {
  unloadZhNames();
  unloadBackfill();
  unloadPosters();
  vi.useRealTimers();
});

/* ---------- F1 自动同步链 ---------- */

describe('F1 autoSyncOnOpen 返回 promise（自动同步链断点）', () => {
  it('已配置 → 返回 runSync 的 promise，await 到同步完成（M.items 已含新条目）', async () => {
    mockSteam([{ appid: 548430, name: 'Deep Rock Galactic', playtime_forever: 65214, rtime_last_played: 1771934400 }]);
    const p = autoSyncOnOpen(makeApp());
    expect(p).toBeInstanceOf(Promise);
    await p;
    expect(M.items).toHaveLength(1);
    expect(M.items[0].appid).toBe(548430);
    expect(vault.files.has(`${DEFAULT_FOLDER}/《Deep Rock Galactic》.md`)).toBe(true);
  });

  it('未配置 / 关闭自动同步 → 同步返回 undefined，调用方 await 立即通过', async () => {
    setup({});
    expect(autoSyncOnOpen(makeApp())).toBeUndefined();
    setup({ ...CONFIG, gameshelfAutoSync: false });
    expect(autoSyncOnOpen(makeApp())).toBeUndefined();
    expect(requestUrl as any).not.toHaveBeenCalled();
  });

  it('openGameshelf 首开空库：自动同步完成后三队列对新条目启动（appdetails 中文名请求发生）', async () => {
    mockSteam([{ appid: 1, name: 'A', playtime_forever: 60, rtime_last_played: 1771934400 }]);
    openGameshelf(makeApp());
    await vi.waitFor(() => expect(vault.files.has(`${DEFAULT_FOLDER}/《A》.md`)).toBe(true));
    // 修复前 afterOpen 的 await 落空：三队列在同步前拿空列表，新游戏永远不补中文名
    await vi.waitFor(() => {
      const urls = (requestUrl as any).mock.calls.map((c: any[]) => String(c[0]?.url));
      expect(urls.some((u: string) => u.includes('/api/appdetails'))).toBe(true);
    });
    closePanel();
    unloadGameshelf();
  });
});

/* ---------- A1 rebuild × 队列竞态 ---------- */

describe('A1 rebuildItems 未变条目复用旧对象', () => {
  it('frontmatter 未变 → rebuild 前后条目同引用；队列在途整表重建后成果仍落在 M.items 现值', async () => {
    vault.files.set(`${DEFAULT_FOLDER}/《A》.md`, '---\nAppID: 1\n游玩分钟: 60\n---\n');
    const app = makeApp();
    const first = rebuildItems(app);
    const second = rebuildItems(app);
    expect(second[0]).toBe(first[0]); // 未变条目同一引用（A1 契约本体）

    // 竞态：中文名队列首条在途时 rebuild 整表替换 → 修复前成果写进无人引用的旧对象
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    (requestUrl as any).mockImplementation(async () => {
      await gate;
      return { status: 200, json: [{ success: true, data: { name: '中文名A' } }], text: '' };
    });
    ensureZhNames(app, first);
    await vi.waitFor(() => expect((requestUrl as any).mock.calls.length).toBe(1));
    rebuildItems(app); // 模拟 home 首页采集 / 同步链触发的整表重建
    release();
    await vi.waitFor(() => expect(M.items[0].zhName).toBe('中文名A'));
    expect(M.items[0].appid).toBe(1);
  });

  it('frontmatter 变了 → 换新对象（复用只对未变条目生效，不是无脑保旧）', () => {
    vault.files.set(`${DEFAULT_FOLDER}/《A》.md`, '---\nAppID: 1\n游玩分钟: 60\n---\n');
    const app = makeApp();
    const first = rebuildItems(app);
    vault.files.set(`${DEFAULT_FOLDER}/《A》.md`, '---\nAppID: 1\n游玩分钟: 120\n---\n');
    const second = rebuildItems(app);
    expect(second[0]).not.toBe(first[0]);
    expect(second[0].playtimeMin).toBe(120);
  });
});

/* ---------- A2 metadataCache 未就绪守卫 ---------- */

describe('A2 metadataCache 未就绪保留既有条目', () => {
  it('cache 未就绪的文件保留上一轮既有条目（同引用）；缓存就绪后正常解析接管', () => {
    vault.files.set(`${DEFAULT_FOLDER}/《A》.md`, '---\nAppID: 1\n游玩分钟: 60\n---\n');
    const app = makeApp();
    const first = rebuildItems(app);
    expect(first).toHaveLength(1);

    // 同步批量新建后立即重建的窗口：mock 缓存对该文件返回未就绪
    const appMiss = makeApp({ cacheMiss: (p) => p === `${DEFAULT_FOLDER}/《A》.md` });
    const second = rebuildItems(appMiss);
    expect(second).toHaveLength(1);
    expect(second[0]).toBe(first[0]); // 既有条目原样保留，三队列不漏排

    // 缓存就绪（且 frontmatter 长出了中文名）→ 下一次重建正常解析接管
    vault.files.set(`${DEFAULT_FOLDER}/《A》.md`, '---\nAppID: 1\n中文名: 小丑牌\n---\n');
    const third = rebuildItems(app);
    expect(third[0]).not.toBe(first[0]);
    expect(third[0].zhName).toBe('小丑牌');
  });

  it('已索引但无 AppID 的文件（非本域数据）不被保留分支救回', () => {
    vault.files.set(`${DEFAULT_FOLDER}/《A》.md`, '---\nAppID: 1\n---\n');
    const app = makeApp();
    expect(rebuildItems(app)).toHaveLength(1);
    vault.files.set(`${DEFAULT_FOLDER}/《杂记》.md`, '---\nnote: 随手记\n---\n');
    const appMiss = makeApp({ cacheMiss: (p) => p.includes('杂记') });
    expect(rebuildItems(appMiss)).toHaveLength(1);
  });
});

/* ---------- A3 scheduleRerender 节流契约 ---------- */

describe('A3 backfill scheduleRerender 节流（首沿）契约', () => {
  it('两条 job 间隔 900ms（< 1.2s 窗口）连续完成 → 1.2s 处重渲恰好一次，而非防抖式顺延为零次', async () => {
    vi.useFakeTimers();
    setBackfillInterval(900); // 队列节奏回到生产值：900ms < 1200ms 窗口才构成顺延条件
    const calls: string[] = [];
    (requestUrl as any).mockImplementation(async (o: { url: string }) => {
      calls.push(String(o.url));
      const appid = /appids=(\d+)/.exec(String(o.url))?.[1] ?? '0';
      return {
        status: 200,
        json: { [appid]: { success: true, data: { name: 'G', screenshots: [] } } },
        text: '',
      };
    });
    const writes: Record<string, unknown>[] = [];
    const app = {
      metadataCache: { getFileCache: (f: any) => (f?.__fm ? { frontmatter: f.__fm } : null) },
      fileManager: {
        processFrontMatter: async (_f: unknown, cb: (fm: Record<string, unknown>) => void) => {
          const fm: Record<string, unknown> = {};
          cb(fm);
          writes.push(fm);
        },
      },
      vault,
    } as any;
    const renderFn = vi.fn();
    M.renderFn = renderFn;
    ensureBackfill(app, [item(1, 'G1', { file: { __fm: null } as never }), item(2, 'G2', { file: { __fm: null } as never })]);
    await vi.advanceTimersByTimeAsync(0); // job1 完成 → 设 1.2s 定时器；进入 900ms 队列间隔
    await vi.advanceTimersByTimeAsync(900); // job2 完成 → 节流：窗口内跳过
    expect(calls.filter((u) => u.includes('/api/appdetails')).length).toBe(2);
    expect(renderFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(299);
    expect(renderFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); // t=1200（自首条完成起）
    expect(renderFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000); // 防抖变体会在这里再发一次（@2100）
    expect(renderFn).toHaveBeenCalledTimes(1);
  });
});

/* ---------- F6 unload 后无双消费者 ---------- */

describe('F6 unloadBackfill 后立即 ensure 不产生并发消费者', () => {
  it('unload 清队后在途循环自然退出，新 ensure 只入队不启动第二消费者（峰值在途请求 = 1）', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    let inflight = 0;
    let peak = 0;
    (requestUrl as any).mockImplementation(async (o: { url: string }) => {
      calls += 1;
      if (calls === 1) {
        inflight += 1;
        peak = Math.max(peak, inflight);
        try {
          await gate; // 首条挂起 = 旧循环在途窗口
        } finally {
          inflight -= 1;
        }
      }
      const appid = /appids=(\d+)/.exec(String(o.url))?.[1] ?? '0';
      return { status: 200, json: { [appid]: { success: true, data: { name: 'G', screenshots: [] } } }, text: '' };
    });
    const app = {
      metadataCache: { getFileCache: () => null },
      fileManager: { processFrontMatter: async (_f: unknown, cb: (fm: Record<string, unknown>) => void) => cb({}) },
      vault,
    } as any;
    ensureBackfill(app, [item(1, 'G1'), item(2, 'G2')]);
    await vi.waitFor(() => expect(calls).toBe(1));
    unloadBackfill(); // 清队列；running 不复位（F6 修复点）
    ensureBackfill(app, [item(1, 'G1'), item(2, 'G2')]);
    await new Promise((r) => setTimeout(r, 40));
    // 修复前：running 被置 false → 第二个 runQueue 启动 → 第二条请求在首条挂起期间发出
    expect(calls).toBe(1);
    expect(peak).toBe(1);
    release();
    await vi.waitFor(() => expect(calls).toBeGreaterThanOrEqual(2)); // 旧循环接管续跑，队列不丢
    expect(peak).toBe(1); // 全程串行
  });
});

/* ---------- F7 无中文名负缓存 ---------- */

describe('F7 Steam 无本地化的款会话内收敛', () => {
  it('商店返回 = 原名 → 记负缓存；重开面板（rebuild + 再 ensure）不再发请求', async () => {
    (requestUrl as any).mockImplementation(async () => ({
      status: 200,
      json: { '7': { success: true, data: { name: 'Bongo Cat' } } },
      text: '',
    }));
    const app = makeApp();
    const round1 = [item(7, 'Bongo Cat')];
    ensureZhNames(app, round1);
    await vi.waitFor(() => expect(round1[0].zhName).toBe('Bongo Cat'));
    expect((requestUrl as any).mock.calls.length).toBe(1);
    // 模拟重开面板：整表重建出全新条目对象（内存 zhName 归 null）再 ensure
    const round2 = [item(7, 'Bongo Cat')];
    ensureZhNames(app, round2);
    await new Promise((r) => setTimeout(r, 30));
    expect((requestUrl as any).mock.calls.length).toBe(1); // 负缓存收敛：零新请求
    expect(round2[0].zhName).toBeNull(); // 也不写内存（没有中文名可写）
  });
});

/* ---------- F8 媒体下载超时 ---------- */

describe('F8 媒体下载 20s 超时兜底', () => {
  it('首张挂起图到点弃果 → 队列继续处理后续条目（不整队停摆）', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    (requestUrl as any).mockImplementation(async (o: { url: string }) => {
      calls.push(String(o.url));
      if (calls.length === 1) return new Promise(() => undefined); // 首张永不 settle
      return { status: 200, arrayBuffer: new ArrayBuffer(8) };
    });
    ensurePosters(
      { vault } as any,
      [item(1, 'A', { coverSrc: 'https://cdn/1.jpg' }), item(2, 'B', { coverSrc: 'https://cdn/2.jpg' })].map((it) => ({
        appid: it.appid,
        cover: null,
        coverSrc: it.coverSrc,
        icon: null,
        iconSrc: null,
        file: null,
      })),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.length).toBe(1); // 首张已发出并挂起
    await vi.advanceTimersByTimeAsync(20_000); // 超时到点 → download false
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.length).toBe(2); // 修复前：第二张永不发出
    expect(calls[1]).toContain('2.jpg');
  });
});

/* ---------- F11 目录尾斜杠 ---------- */

describe('F11 目录配置尾斜杠归一化', () => {
  it('正斜杠/反斜杠尾缀剥除；空值回落默认', () => {
    setSettingsProvider(() => ({ gameshelfFolderPath: '我的/游戏/' } as any));
    expect(resolveGameshelfFolderPath()).toBe('我的/游戏');
    setSettingsProvider(() => ({ gameshelfFolderPath: 'Games\\' } as any));
    expect(resolveGameshelfFolderPath()).toBe('Games');
    setSettingsProvider(() => ({ gameshelfFolderPath: '  ' } as any));
    expect(resolveGameshelfFolderPath()).toBe(DEFAULT_FOLDER);
  });

  it('尾斜杠配置不再让扫描零匹配（修复前前缀拼成 `我的/游戏//`）', () => {
    setSettingsProvider(() => ({ gameshelfFolderPath: '我的/游戏/' } as any));
    vault.files.set('我的/游戏/《A》.md', '---\nAppID: 1\n---\n');
    expect(rebuildItems(makeApp())).toHaveLength(1);
  });
});

/* ---------- F12 消歧文件名展示名 ---------- */

describe('F12 消歧文件名展示名剥尾巴', () => {
  it('《名》 appid.md → 名；《名》.md → 名；无书名号原样', () => {
    vault.files.set(`${DEFAULT_FOLDER}/《Hades》 1145360.md`, '---\nAppID: 1145360\n---\n');
    vault.files.set(`${DEFAULT_FOLDER}/《Balatro》.md`, '---\nAppID: 2379780\n---\n');
    vault.files.set(`${DEFAULT_FOLDER}/Plain.md`, '---\nAppID: 100\n---\n');
    const items = rebuildItems(makeApp());
    const byAppid = new Map(items.map((it) => [it.appid, it.name]));
    expect(byAppid.get(1145360)).toBe('Hades'); // 修复前显示「Hades》 1145360」
    expect(byAppid.get(2379780)).toBe('Balatro');
    expect(byAppid.get(100)).toBe('Plain');
  });

  it('重建后同名消歧款在队列入账写盘路径正确（file 引用未受展示名影响）', async () => {
    vault.files.set(`${DEFAULT_FOLDER}/《A》 1.md`, '---\nAppID: 1\n---\n');
    const app = makeApp();
    (requestUrl as any).mockImplementation(async () => ({
      status: 200,
      json: [{ success: true, data: { name: '中文名A' } }],
      text: '',
    }));
    ensureZhNames(app, rebuildItems(app));
    await vi.waitFor(() => expect(parseFm(vault, `${DEFAULT_FOLDER}/《A》 1.md`)['中文名']).toBe('中文名A'));
  });
});

/* ---------- A4 readSteamConfig 下沉 ---------- */

describe('A4 readSteamConfig 正典在 state.ts', () => {
  it('state 与 sync 两个出口同引用；读值正确、provider 抛错回落空串', () => {
    expect(syncReadSteamConfig).toBe(readSteamConfig);
    setup({ gameshelfSteamId: '76561198', gameshelfSteamApiKey: 'KEY' });
    expect(readSteamConfig()).toEqual({ steamId: '76561198', apiKey: 'KEY' });
    setSettingsProvider(() => {
      throw new Error('provider boom');
    });
    expect(readSteamConfig()).toEqual({ steamId: '', apiKey: '' });
  });
});

/* ---------- A6 死代码 ---------- */

describe('A6 posterDisplayUrl 旧签名已删除', () => {
  it('posters 模块不再导出 posterDisplayUrl（新代码用 coverDisplayUrl）', () => {
    expect((postersNs as Record<string, unknown>).posterDisplayUrl).toBeUndefined();
    expect(typeof postersNs.coverDisplayUrl).toBe('function');
  });
});

/* ---------- A7 键台账守卫 ---------- */

describe('A7 frontmatter 键台账与读写两侧同值', () => {
  it('台账内无重名键（值唯一）', () => {
    const values = Object.values(GS_FM);
    expect(new Set(values).size).toBe(values.length);
  });

  it('GS_LEGACY_FM ↔ reconcile.LEGACY_KEY_MAP 逐对同值（两表不得漂移）', () => {
    for (const [oldKey, cnKey] of Object.entries(LEGACY_KEY_MAP)) {
      expect(Object.values(GS_LEGACY_FM)).toContain(oldKey);
      expect(Object.values(GS_FM)).toContain(cnKey);
    }
    for (const oldKey of Object.values(GS_LEGACY_FM)) {
      expect(Object.keys(LEGACY_KEY_MAP)).toContain(oldKey);
    }
  });

  it('managedFm 写侧产出键全部在台账内（未接表的 reconcile 也不得引入台账外新键）', () => {
    const game = {
      appid: 1, name: 'A', playtimeMin: 60, lastPlayedTs: 0, iconUrl: null,
      windowsMin: 0, macMin: 0, linuxMin: 0, deckMin: 0, hasAchievements: false,
    };
    const fm = managedFm(game, '2026-09-19T00:00:00.000Z');
    const ledger = new Set<string>(Object.values(GS_FM));
    for (const k of Object.keys(fm)) expect(ledger.has(k)).toBe(true);
  });
});

/* ---------- C6 synced 事件契约 ---------- */

describe('C6 synced 域事件契约', () => {
  it('runSync 成功后发射 gameshelf 事件，载荷含 kind:synced 与三计数', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const off = onDomainEvent('gameshelf', (e) => seen.push(e as Record<string, unknown>));
    try {
      mockSteam([{ appid: 1, name: 'A', playtime_forever: 60, rtime_last_played: 1771934400 }]);
      const r = await runSync(makeApp(), { force: true });
      expect(r.ok).toBe(true);
      expect(seen).toEqual([{ kind: 'synced', added: 1, updated: 0, offShelf: 0 }]);
    } finally {
      off();
    }
  });
});

/* ---------- S2 熔断通知 ---------- */

describe('S2 队列熔断人话收尾', () => {
  it('names 连错到上限 → 一条 warning 通知（「已暂停 + 下次打开会继续」），逐条失败不弹', async () => {
    (requestUrl as any).mockImplementation(async () => ({ status: 200, json: [], text: '[]' }));
    const app = { fileManager: { processFrontMatter: async (_f: unknown, cb: (fm: Record<string, unknown>) => void) => cb({}) } } as any;
    const list = [1, 2, 3, 4, 5, 6].map((n) => item(n, 'G' + n));
    ensureZhNames(app, list);
    await vi.waitFor(() => expect((requestUrl as any).mock.calls.length).toBe(ZH_NAME_MAX_FAILURES));
    await new Promise((r) => setTimeout(r, 20));
    expect(hasNotice('网络不畅，游戏库自动补全已暂停，下次打开会继续')).toBe(true);
  });

  it('同窗内 backfill 再熔断不叠第二条（共用 dedupeKey 原地合并）', async () => {
    (requestUrl as any).mockImplementation(async (o: { url: string }) => {
      const url = String(o.url);
      const appid = /appids=(\d+)/.exec(url)?.[1] ?? '0';
      return { status: 200, json: { [appid]: { success: false } }, text: '' }; // 每条都失败
    });
    const namesApp = { fileManager: { processFrontMatter: async (_f: unknown, cb: (fm: Record<string, unknown>) => void) => cb({}) } } as any;
    ensureZhNames(namesApp, [1, 2, 3, 4, 5, 6].map((n) => item(n, 'G' + n)));
    await vi.waitFor(() => expect(hasNotice(/自动补全已暂停/)).toBe(true));
    const countAfterNames = document.querySelectorAll('.bz-notice').length;
    const callsBefore = (requestUrl as any).mock.calls.length; // names 熔断已耗 3 次请求
    const app = {
      metadataCache: { getFileCache: () => null },
      fileManager: { processFrontMatter: async (_f: unknown, cb: (fm: Record<string, unknown>) => void) => cb({}) },
      vault,
    } as any;
    ensureBackfill(app, [item(11, 'B1'), item(12, 'B2'), item(13, 'B3'), item(14, 'B4')]);
    await vi.waitFor(() => expect((requestUrl as any).mock.calls.length).toBe(callsBefore + 3)); // 连错 3 条即停
    expect(document.querySelectorAll('.bz-notice').length).toBe(countAfterNames); // 不新弹
  });
});

/* ---------- open/close/unload 状态清理对称 ---------- */

describe('面板状态清理对称（深审测试缺口 3）', () => {
  it('open 后 renderFn/overlay 在位；close 摘除面板；unload 后 M 全量复位', () => {
    setup({});
    const app = makeApp();
    openGameshelf(app);
    expect(M.renderFn).toBeTruthy();
    expect(M.currentOverlay).toBeTruthy();
    closePanel();
    // 注意：closePanel 不清 renderFn/statusMsg 是在案 UX-1（closePanel 清理清单不完整，
    // 批 B 辖区）——此处只锁「面板摘除 + overlay 归零」的现状契约，不把待改行为钉死
    expect(M.currentOverlay).toBeNull();
    expect(document.querySelector('.bz-gs-panel')).toBeNull();
    unloadGameshelf();
    expect(M.renderFn).toBeNull();
    expect(M.modalRepaintFn).toBeNull();
    expect(M.items).toHaveLength(0);
    expect(M.appRef).toBeNull();
  });
});

/* ---------- upsertDetail（键收编面回归） ---------- */

describe('notes.upsertDetail 写盘（批 A 键收编不改变行为）', () => {
  it('只 assign 传入键，其余 frontmatter 不动', async () => {
    vault.files.set(`${DEFAULT_FOLDER}/《A》.md`, '---\nAppID: 1\n自定义: 手写\n---\n正文。\n');
    await upsertDetail(makeApp(), vault.getMarkdownFiles()[0], { 中文名: '小丑牌' });
    const fm = parseFm(vault, `${DEFAULT_FOLDER}/《A》.md`);
    expect(fm['中文名']).toBe('小丑牌');
    expect(fm['自定义']).toBe('手写');
  });
});
