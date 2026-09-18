// @vitest-environment node
/**
 * 媒体本地化测试（issue 368 增补；2026-09-17 扩图标 + 回写本地路径）：
 * 封面/图标串行下载到本地文件夹、属性回写成 vault 路径、已本地化不再重复请求、
 * 显示层四级兜底（本地文件 → 属性远端值 → 源键 → CDN 直拼）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import {
  DEFAULT_POSTER_FOLDER, achIconDisplayUrl, achIconsMissing, coverDisplayUrl, ensureAchIcons, ensurePosters,
  ensureShots, iconDisplayUrl, localAchIconPath, localCoverPath, localIconPath, localShotPath,
  resolvePosterFolder, resolveShotUrls, setMediaInterval, unloadPosters,
} from '../../src/gameshelf/posters';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { requestUrl } from 'obsidian';

const vault = new MockVault();
const app = { vault } as any;
const COVER = localCoverPath(1);
const ICON = localIconPath(1);

/** frontmatter 写入记录（upsertDetail 走 fileManager.processFrontMatter） */
const writes: Record<string, unknown>[] = [];

function setup() {
  setApp(app);
  setSettingsProvider(() => ({}) as any);
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
  setMediaInterval(0); // 第二条队列（成就图标/截图）任务间有 120ms 间隔，测试归零
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
    expect(resolvePosterFolder()).toBe(DEFAULT_POSTER_FOLDER);
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

describe('成就图标本地化（2026-09-18）', () => {
  it('路径契约：appid + apiname + 解锁态 → 文件名；apiname 里的非法字符换 _（防越界写）', () => {
    setup();
    expect(localAchIconPath(548430, 'APPROVED_GREENBEARD', true))
      .toBe(`${DEFAULT_POSTER_FOLDER}/548430-ach-APPROVED_GREENBEARD-on.jpg`);
    expect(localAchIconPath(548430, 'APPROVED_GREENBEARD', false))
      .toBe(`${DEFAULT_POSTER_FOLDER}/548430-ach-APPROVED_GREENBEARD-off.jpg`);
    expect(localAchIconPath(1, 'A/B:C', true)).toBe(`${DEFAULT_POSTER_FOLDER}/1-ach-A_B_C-on.jpg`);
  });

  it('两色都下（彩色 + 灰色各一次请求），且**一个属性键都不占**', async () => {
    setup();
    ensureAchIcons(app, 548430, [{ apiName: 'A1', on: 'https://cdn/a1-on.jpg', off: 'https://cdn/a1-off.jpg' }]);
    await vi.waitFor(() => expect(vault.binaryFiles.has(localAchIconPath(548430, 'A1', true))).toBe(true));
    await vi.waitFor(() => expect(vault.binaryFiles.has(localAchIconPath(548430, 'A1', false))).toBe(true));
    const urls = (requestUrl as any).mock.calls.map((c: any[]) => String(c[0]?.url));
    expect(urls).toContain('https://cdn/a1-on.jpg');
    expect(urls).toContain('https://cdn/a1-off.jpg');
    expect(writes.length).toBe(0);
  });

  it('本地两色都在 → 零请求（状态翻转零下载的前提）', async () => {
    setup();
    vault.binaryFiles.set(localAchIconPath(548430, 'A1', true), new Uint8Array(4));
    vault.binaryFiles.set(localAchIconPath(548430, 'A1', false), new Uint8Array(4));
    ensureAchIcons(app, 548430, [{ apiName: 'A1', on: 'https://cdn/a1-on.jpg', off: 'https://cdn/a1-off.jpg' }]);
    await new Promise((r) => setTimeout(r, 40));
    expect((requestUrl as any).mock.calls.length).toBe(0);
  });

  it('Steam 没给 icongray → 只下彩色，不报错', async () => {
    setup();
    ensureAchIcons(app, 1, [{ apiName: 'A1', on: 'https://cdn/on.jpg', off: null }]);
    await vi.waitFor(() => expect(vault.binaryFiles.has(localAchIconPath(1, 'A1', true))).toBe(true));
    expect(vault.binaryFiles.has(localAchIconPath(1, 'A1', false))).toBe(false);
  });

  it('显示 URL：本地文件在 → vault 资源；不在 → 空串（界面用占位圆点，不回退远端）', () => {
    setup();
    expect(achIconDisplayUrl(app, 1, 'A1', true)).toBe('');
    vault.binaryFiles.set(localAchIconPath(1, 'A1', true), new Uint8Array(4));
    expect(achIconDisplayUrl(app, 1, 'A1', true)).toBe('app://mock-vault/' + localAchIconPath(1, 'A1', true));
    expect(achIconDisplayUrl(app, 1, 'A1', false)).toBe('');
  });

  it('achIconsMissing：只查当前解锁态那一色（灰图 Steam 常不给，两色都查会永远判缺）', () => {
    setup();
    const rows = [{ apiName: 'A1', unlocked: true }];
    expect(achIconsMissing(app, 1, rows)).toBe(true);
    vault.binaryFiles.set(localAchIconPath(1, 'A1', true), new Uint8Array(4));
    expect(achIconsMissing(app, 1, rows)).toBe(false); // 灰图不在也不管
    expect(achIconsMissing(app, 1, [{ apiName: 'A1', unlocked: false }])).toBe(true); // 换解锁态就换成查灰图
    expect(achIconsMissing(app, 1, [])).toBe(false); // 没有成就行 → 没什么可缺
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
