// @vitest-environment node
/**
 * 媒体本地化测试（issue 368 增补；2026-09-17 扩图标 + 回写本地路径）：
 * 封面/图标串行下载到本地文件夹、属性回写成 vault 路径、已本地化不再重复请求、
 * 显示层四级兜底（本地文件 → 属性远端值 → 源键 → CDN 直拼）；截图整组下载 + 失败位对齐。
 * 成就图标不本地化（ADR-0176：改由界面直取远端 URL），相关用例随之删除。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import {
  coverDisplayUrl, ensurePosters, ensureShots, iconDisplayUrl, localCoverPath,
  localIconPath, localShotPath, resolvePosterFolder, resolveShotUrls, setMediaInterval, unloadPosters,
} from '../../src/gameshelf/posters';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { M } from '../../src/gameshelf/state';
import { requestUrl } from 'obsidian';

const vault = new MockVault();
const app = { vault } as any;
/** 本域主目录：海报落 `<游戏目录>/assets`（2026-10-31 起不再有 CONFIG/游戏海报 缺省） */
const MAIN_DIR = '我的/游戏';
const POSTER_DIR = `${MAIN_DIR}/assets`;
// COVER/ICON 在模块加载期就解析，夹具必须在它们之前就位
setSettingsProvider(() => ({ gameshelfFolderPath: MAIN_DIR }) as any);
const COVER = localCoverPath(1);
const ICON = localIconPath(1);

/** frontmatter 写入记录（upsertDetail 走 fileManager.processFrontMatter） */
const writes: Record<string, unknown>[] = [];

function setup() {
  setApp(app);
  setSettingsProvider(() => ({ gameshelfFolderPath: MAIN_DIR }) as any);
}

function media(over: Partial<Parameters<typeof ensurePosters>[1][number]> = {}) {
  return [{
    appid: 1,
    cover: null as string | null,
    coverSrc: 'https://cdn/1.jpg',
    icon: null as string | null,
    iconSrc: 'https://icon/1.jpg',
    file: {
      path: '我的/游戏/《A》.md',
    } as never,
    ...over,
  }];
}

beforeEach(() => {
  vault.files.clear();
  vault.binaryFiles.clear();
  vault.dirs.clear();
  writes.length = 0;
  setMediaInterval(0); // 第二条队列（截图）任务间有 120ms 间隔，测试归零
  unloadPosters();
  (requestUrl as any).mockReset();
  (requestUrl as any).mockImplementation(async () => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
  // upsertDetail 只经 fileManager.processFrontMatter——假 App 记下写入即可
  app.fileManager = {
    processFrontMatter: async (_f: unknown, cb: (fm: Record<string, unknown>) => void) => {
      const fm: Record<string, unknown> = {};
      cb(fm);
      writes.push(fm);
    },
  };
});

describe('媒体本地化队列', () => {
  it('封面与图标都缺本地文件 → 各下一次，回写 vault 路径；重复入队去重', async () => {
    setup();
    ensurePosters(app, media());
    ensurePosters(app, media()); // 重复调用：pending 去重
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(vault.binaryFiles.has(COVER)).toBe(true);
    expect(vault.binaryFiles.has(ICON)).toBe(true);
    expect(writes[writes.length - 1]).toMatchObject({ 封面: COVER, 图标: ICON });
    const urls = (requestUrl as any).mock.calls.map((c: any[]) => String(c[0]?.url));
    expect(urls.filter((u: string) => u.includes('cdn/1.jpg')).length).toBe(1);
    expect(urls.filter((u: string) => u.includes('icon/1.jpg')).length).toBe(1);
  });

  it('本地文件已在、属性还是远端 → 不发请求，直接回写本地路径（迁移/自愈）', async () => {
    setup();
    vault.binaryFiles.set(COVER, new Uint8Array(8));
    vault.binaryFiles.set(ICON, new Uint8Array(8));
    ensurePosters(app, media({ cover: 'https://cdn/1.jpg', icon: 'https://icon/1.jpg' }));
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect((requestUrl as any).mock.calls.length).toBe(0);
    expect(writes[0]).toMatchObject({ 封面: COVER, 图标: ICON });
  });

  it('已完全本地化（文件在 + 属性已指本地）→ 不入队，零请求零写入', async () => {
    setup();
    vault.binaryFiles.set(COVER, new Uint8Array(8));
    vault.binaryFiles.set(ICON, new Uint8Array(8));
    ensurePosters(app, media({ cover: COVER, icon: ICON }));
    await new Promise((r) => setTimeout(r, 30));
    expect((requestUrl as any).mock.calls.length).toBe(0);
    expect(writes.length).toBe(0);
  });

  it('没有图标源 → 跳过图标，不影响封面', async () => {
    setup();
    ensurePosters(app, media({ iconSrc: null }));
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(vault.binaryFiles.has(COVER)).toBe(true);
    expect(vault.binaryFiles.has(ICON)).toBe(false);
    expect(writes[writes.length - 1]).not.toHaveProperty('图标');
  });

  it('下载失败 → 不写属性（属性保持远端，显示回落远端源）', async () => {
    setup();
    (requestUrl as any).mockImplementation(async () => ({ status: 403, arrayBuffer: new ArrayBuffer(0) }));
    ensurePosters(app, media({ iconSrc: null }));
    await new Promise((r) => setTimeout(r, 60));
    expect(writes.length).toBe(0);
    expect(vault.binaryFiles.has(COVER)).toBe(false);
  });

  it('下完图走 repaintFn（原地重绘），不走 renderFn（整刷=屏闪）', async () => {
    setup();
    const repaint = vi.fn(() => true); // true = 已原地处理干净
    const render = vi.fn();
    M.repaintFn = repaint;
    M.renderFn = render;
    try {
      ensurePosters(app, media({ iconSrc: null }));
      await vi.waitFor(() => expect(repaint).toHaveBeenCalled(), { timeout: 4000 });
      expect(render).not.toHaveBeenCalled();
    } finally {
      M.repaintFn = null;
      M.renderFn = null;
    }
  }, 8000);

  it('原地重绘做不到（返回 false）时回落整刷：统计页/按名称排/搜索中就是这条路', async () => {
    setup();
    const repaint = vi.fn(() => false);
    const render = vi.fn();
    M.repaintFn = repaint;
    M.renderFn = render;
    try {
      ensurePosters(app, media({ iconSrc: null }));
      await vi.waitFor(() => expect(render).toHaveBeenCalled(), { timeout: 4000 });
      expect(repaint).toHaveBeenCalled();
    } finally {
      M.repaintFn = null;
      M.renderFn = null;
    }
  }, 8000);
});

describe('封面兜底链（2026-11-02）：header → 胶囊图 → 第一张商店截图 → 库内主视觉', () => {
  it('header 404 → 改下 capsule_616x353，存成同一个 <appid>.jpg；属性指本地', async () => {
    setup();
    (requestUrl as any).mockImplementation(async (o: { url: string }) => (
      o.url.includes('header.jpg') || o.url.includes('cdn/1.jpg')
        ? { status: 404, arrayBuffer: new ArrayBuffer(0) }
        : { status: 200, arrayBuffer: new ArrayBuffer(8) }
    ));
    ensurePosters(app, media({ iconSrc: null }));
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(vault.binaryFiles.has(COVER)).toBe(true);
    expect(writes[writes.length - 1]).toMatchObject({ 封面: COVER });
    const urls = (requestUrl as any).mock.calls.map((c: any[]) => String(c[0]?.url));
    expect(urls.some((u: string) => u.includes('capsule_616x353'))).toBe(true);
  });

  it('header 与胶囊图都没有 → 拿第一张商店截图当封面（本地已有就拷，不再走网络）', async () => {
    setup();
    const shot = localShotPath(1, 0);
    vault.binaryFiles.set(shot, new Uint8Array([7, 7, 7]));
    (requestUrl as any).mockImplementation(async () => ({ status: 404, arrayBuffer: new ArrayBuffer(0) }));
    ensurePosters(app, media({ iconSrc: null }));
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(vault.binaryFiles.get(COVER)).toEqual(new Uint8Array([7, 7, 7]));
    expect(writes[writes.length - 1]).toMatchObject({ 封面: COVER });
    // 只试了 header + capsule 两次远端：截图那跳走本地拷贝，不耗网络
    expect((requestUrl as any).mock.calls.length).toBe(2);
  });

  it('网络失败（非 404）不往下兜 —— 断一次网不该把封面永久钉在兜底图上', async () => {
    setup();
    (requestUrl as any).mockImplementation(async () => {
      throw new Error('socket hang up');
    });
    ensurePosters(app, media({ iconSrc: null }));
    await new Promise((r) => setTimeout(r, 40));
    expect((requestUrl as any).mock.calls.length).toBe(1); // 只碰了 header，没试胶囊图
    expect(writes.length).toBe(0);
    expect(vault.binaryFiles.has(COVER)).toBe(false);
  });

  it('常规图全无、只剩 library_hero → 用主视觉兜底（Shelldiver 3862670 的实测形态）', async () => {
    setup();
    (requestUrl as any).mockImplementation(async (o: { url: string }) => (
      o.url.includes('library_hero.jpg')
        ? { status: 200, arrayBuffer: new ArrayBuffer(8) }
        : { status: 404, arrayBuffer: new ArrayBuffer(0) }
    ));
    ensurePosters(app, media({ iconSrc: null }));
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(vault.binaryFiles.has(COVER)).toBe(true);
    expect(writes[writes.length - 1]).toMatchObject({ 封面: COVER });
  });

  it('封面等第一张截图：截图队列落地时顺手补封面（同一轮就见效，不必等下次开面板）', async () => {
    setup();
    // 常规封面图全 404；商店截图的地址（s/）可下
    (requestUrl as any).mockImplementation(async (o: { url: string }) => (
      o.url.includes('/s/')
        ? { status: 200, arrayBuffer: new ArrayBuffer(8) }
        : { status: 404, arrayBuffer: new ArrayBuffer(0) }
    ));
    ensurePosters(app, media({ iconSrc: null }));
    // header + capsule + hero 三次 404 → 记账「等截图」，同时落一条判缺（免得下次开面板重跑整条链）
    await vi.waitFor(() => expect((requestUrl as any).mock.calls.length).toBe(3));
    expect(writes.length).toBe(1);
    expect(writes[0]).toHaveProperty('封面缺');
    expect(writes[0]).not.toHaveProperty('封面');
    ensureShots(app, {
      appid: 1,
      file: { path: '我的/游戏/《A》.md' } as never,
      remote: ['https://s/1.jpg'],
      prevLocal: [],
    });
    await vi.waitFor(() => expect(vault.binaryFiles.has(COVER)).toBe(true));
    expect(writes[writes.length - 1]).toMatchObject({ 封面: COVER, 截图: [localShotPath(1, 0)] });
  });
});

describe('显示 URL 四级兜底', () => {
  it('本地文件在 → 用 vault resource URL（最高优先）', () => {
    setup();
    vault.binaryFiles.set(COVER, new Uint8Array(8));
    vault.binaryFiles.set(ICON, new Uint8Array(8));
    expect(coverDisplayUrl(app, 1, 'https://cdn/1.jpg', null)).toBe('app://mock-vault/' + COVER);
    expect(iconDisplayUrl(app, 1, ICON, 'https://icon/1.jpg')).toBe('app://mock-vault/' + ICON);
  });

  it('本地文件不在 → 属性远端值 → 源键 → CDN 直拼', () => {
    setup();
    expect(resolvePosterFolder()).toBe(POSTER_DIR);
    expect(coverDisplayUrl(app, 9, 'https://cdn/9.jpg', 'https://src/9.jpg')).toBe('https://cdn/9.jpg');
    // 属性是本地路径但文件没了 → 落到源键
    expect(coverDisplayUrl(app, 9, localCoverPath(9), 'https://src/9.jpg')).toBe('https://src/9.jpg');
    // 都没有 → CDN 直拼兜底
    expect(coverDisplayUrl(app, 9, null, null)).toContain('steam/apps/9/header.jpg');
    // 图标没有直拼兜底：拿不到就空串（UI 不渲染）
    expect(iconDisplayUrl(app, 9, null, null)).toBe('');
    expect(iconDisplayUrl(app, 9, null, 'https://icon/9.jpg')).toBe('https://icon/9.jpg');
  });
});

describe('商店截图本地化（2026-09-18）', () => {
  const REMOTE = ['https://s/1.jpg', 'https://s/2.jpg', 'https://s/3.jpg'];
  const notes = () => ({ appid: 1, file: { path: '我的/游戏/《A》.md' } as never, remote: REMOTE, prevLocal: [] as string[] });

  it('整组下载后写回 `截图` 数组（与截图源同序同长）', async () => {
    setup();
    ensureShots(app, notes());
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(writes[writes.length - 1]).toMatchObject({ 截图: [localShotPath(1, 0), localShotPath(1, 1), localShotPath(1, 2)] });
    expect(vault.binaryFiles.has(localShotPath(1, 0))).toBe(true);
  });

  it('某张失败 → 该位留空串不压缩（压缩会让下标错位、图与位置对不上）', async () => {
    setup();
    (requestUrl as any).mockImplementation(async (o: { url: string }) => (
      o.url.includes('/2.jpg') ? { status: 404, arrayBuffer: new ArrayBuffer(0) } : { status: 200, arrayBuffer: new ArrayBuffer(8) }
    ));
    ensureShots(app, notes());
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(writes[writes.length - 1]['截图']).toEqual([localShotPath(1, 0), '', localShotPath(1, 2)]);
  });

  it('全失败 → 不写属性（别把满屏空串写进笔记）', async () => {
    setup();
    (requestUrl as any).mockImplementation(async () => ({ status: 403, arrayBuffer: new ArrayBuffer(0) }));
    ensureShots(app, notes());
    await new Promise((r) => setTimeout(r, 40));
    expect(writes.length).toBe(0);
  });

  it('本地已在且属性一致 → 零请求零写入', async () => {
    setup();
    const all = REMOTE.map((_, i) => localShotPath(1, i));
    all.forEach((p) => vault.binaryFiles.set(p, new Uint8Array(4)));
    ensureShots(app, { ...notes(), prevLocal: all });
    await new Promise((r) => setTimeout(r, 40));
    expect((requestUrl as any).mock.calls.length).toBe(0);
    expect(writes.length).toBe(0);
  });

  it('展示 URL：本地优先、本地缺回落该位的远端源', () => {
    setup();
    vault.binaryFiles.set(localShotPath(1, 0), new Uint8Array(4));
    const got = resolveShotUrls(app, [localShotPath(1, 0), '', ''], REMOTE);
    expect(got[0]).toBe('app://mock-vault/' + localShotPath(1, 0));
    expect(got[1]).toBe('https://s/2.jpg');
    expect(got[2]).toBe('https://s/3.jpg');
  });
});

describe('封面判缺：四跳全 404 → 落一条带日期的结论，窗口内不再重试', () => {
  it('四跳全 404 → 写「封面缺」，不写「封面」；请求数 = 3（本地没有截图可拷）', async () => {
    setup();
    (requestUrl as any).mockImplementation(async () => ({ status: 404, arrayBuffer: new ArrayBuffer(0) }));
    ensurePosters(app, media({ iconSrc: null }));
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0), { timeout: 4000 });
    const last = writes[writes.length - 1];
    expect(String(last['封面缺'])).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(last).not.toHaveProperty('封面');
    expect(vault.binaryFiles.has(COVER)).toBe(false);
    expect((requestUrl as any).mock.calls.length).toBe(3); // header → capsule → library_hero
  }, 8000);

  it('网络失败（不是 404）不落判缺结论 —— 断一次网不该把封面封死 30 天', async () => {
    setup();
    (requestUrl as any).mockImplementation(async () => {
      throw new Error('socket hang up');
    });
    ensurePosters(app, media({ iconSrc: null }));
    await new Promise((r) => setTimeout(r, 60));
    expect(writes.length).toBe(0);
  });

  it('判缺窗口内的条目不再入队：一个请求都不发', async () => {
    setup();
    const before = (requestUrl as any).mock.calls.length;
    ensurePosters(app, media({ iconSrc: null, coverMissing: new Date().toISOString() }));
    await new Promise((r) => setTimeout(r, 40));
    expect((requestUrl as any).mock.calls.length).toBe(before);
    expect(writes.length).toBe(0);
  });

  it('结论过期（31 天前）→ 重新走一遍兜底链', async () => {
    setup();
    const old = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
    (requestUrl as any).mockImplementation(async () => ({ status: 404, arrayBuffer: new ArrayBuffer(0) }));
    ensurePosters(app, media({ iconSrc: null, coverMissing: old }));
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0), { timeout: 4000 });
    expect(writes[writes.length - 1]['封面缺']).not.toBe(old); // 重判，日期刷新
  }, 8000);
});
